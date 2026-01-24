import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useShow } from '../context/ShowContext';
import { useTimesheet } from '../hooks/useTimesheet';
import { useAIContext } from '../hooks/useAIContext';
import CurrentSegment from '../components/CurrentSegment';
import NextSegment from '../components/NextSegment';
import RunOfShow from '../components/RunOfShow';
import QuickActions from '../components/QuickActions';
import ConnectionStatus from '../components/ConnectionStatus';
import { PlayIcon, LockClosedIcon, ClockIcon, DocumentTextIcon, VideoCameraIcon, SparklesIcon, ChevronDownIcon, ChevronUpIcon, StarIcon, TrophyIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

// Talent roster - shared with RundownEditorPage
// TODO: In future, this should be fetched from Firebase based on competition config
const TALENT_ROSTER = [
  { id: 'talent-1', name: 'John Smith', role: 'Lead Commentator', abbreviation: 'JS' },
  { id: 'talent-2', name: 'Sarah Johnson', role: 'Color Analyst', abbreviation: 'SJ' },
  { id: 'talent-3', name: 'Mike Davis', role: 'Sideline Reporter', abbreviation: 'MD' },
  { id: 'talent-4', name: 'Emily Chen', role: 'Host', abbreviation: 'EC' },
  { id: 'talent-5', name: 'Alex Rodriguez', role: 'Analyst', abbreviation: 'AR' },
];

export default function TalentView() {
  const { state, startShow, identify, error } = useShow();
  const { showConfig, isPlaying, talentLocked, showProgress } = state;

  // Use timesheet for advance/previous with hold segment support
  const { advance: timesheetAdvance, isHoldSegment, canAdvanceHold, holdRemainingMs, currentSegment } = useTimesheet();

  // AI Context for talking points and milestones
  const {
    talkingPoints,
    highPriorityPoints,
    milestones,
    hasContext,
    isLoading: aiLoading,
    isRunning: aiRunning,
    refresh: refreshAI,
    error: aiError
  } = useAIContext();

  // State for AI panel expansion
  const [aiPanelExpanded, setAIPanelExpanded] = useState(true);

  // Get talent ID from URL query param (e.g., ?talentId=talent-1)
  const [searchParams] = useSearchParams();
  const talentId = searchParams.get('talentId');

  // Find the current talent from roster
  const currentTalent = useMemo(() => {
    if (!talentId) return null;
    return TALENT_ROSTER.find(t => t.id === talentId) || null;
  }, [talentId]);

  // Check if current talent is assigned to the current segment
  const isOnCamera = useMemo(() => {
    if (!talentId || !currentSegment?.talent) return false;
    return currentSegment.talent.includes(talentId);
  }, [talentId, currentSegment?.talent]);

  useEffect(() => {
    identify('talent', 'Talent');
  }, [identify]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Hub
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white">
                {showConfig?.showName || 'Show Controller'}
              </h1>
              <div className="text-sm text-zinc-500">Talent View</div>
            </div>
          </div>
          <ConnectionStatus />
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}

      {/* ON CAMERA Indicator - prominent when talent is assigned to current segment */}
      {isPlaying && isOnCamera && (
        <div className="bg-red-600 border-b-4 border-red-400 px-4 py-4 animate-pulse">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 text-white">
            <VideoCameraIcon className="w-8 h-8" />
            <span className="text-2xl font-bold uppercase tracking-wider">ON CAMERA</span>
            {currentTalent && (
              <span className="text-lg opacity-90">- {currentTalent.name}</span>
            )}
          </div>
        </div>
      )}

      {/* Talent Identity Banner - show when talent is identified but not on camera */}
      {isPlaying && currentTalent && !isOnCamera && (
        <div className="bg-zinc-800/50 border-b border-zinc-700 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-zinc-400 text-sm">
            <span>Viewing as: <span className="text-zinc-200 font-medium">{currentTalent.name}</span></span>
            <span className="text-zinc-600">({currentTalent.role})</span>
          </div>
        </div>
      )}

      {/* Talent Locked Warning */}
      {talentLocked && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-yellow-400 text-sm">
            <LockClosedIcon className="w-4 h-4" />
            Controls locked by producer
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {!isPlaying ? (
          /* Start Show */
          <div className="bg-zinc-800 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Start</h2>
            <p className="text-zinc-400 mb-6">
              {showConfig?.segments?.length || 0} segments loaded
            </p>
            <button
              onClick={startShow}
              className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-xl transition-colors"
            >
              <PlayIcon className="w-6 h-6" />
              Start Show
            </button>
          </div>
        ) : (
          <>
            {/* Current Segment */}
            <CurrentSegment />

            {/* Teleprompter Script Panel */}
            {currentSegment?.script && (
              <div className="bg-zinc-900 rounded-xl border-2 border-blue-500/30 overflow-hidden">
                <div className="bg-blue-500/10 px-4 py-2 flex items-center gap-2 border-b border-blue-500/30">
                  <DocumentTextIcon className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400 uppercase tracking-wide">Script</span>
                </div>
                <div className="p-6">
                  <div className="text-xl leading-relaxed text-white whitespace-pre-wrap font-sans">
                    {currentSegment.script}
                  </div>
                </div>
              </div>
            )}

            {/* AI Context Panel - Talking Points & Milestones */}
            {aiRunning && (
              <div className="bg-zinc-900 rounded-xl border-2 border-purple-500/30 overflow-hidden">
                {/* Header - always visible */}
                <button
                  onClick={() => setAIPanelExpanded(!aiPanelExpanded)}
                  className="w-full bg-purple-500/10 px-4 py-2 flex items-center justify-between border-b border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-medium text-purple-400 uppercase tracking-wide">AI Talking Points</span>
                    {hasContext && (
                      <span className="bg-purple-500/30 text-purple-300 text-xs px-2 py-0.5 rounded-full">
                        {talkingPoints.length}
                      </span>
                    )}
                    {highPriorityPoints.length > 0 && (
                      <span className="bg-red-500/30 text-red-300 text-xs px-2 py-0.5 rounded-full animate-pulse">
                        {highPriorityPoints.length} priority
                      </span>
                    )}
                    {milestones.length > 0 && (
                      <span className="bg-yellow-500/30 text-yellow-300 text-xs px-2 py-0.5 rounded-full">
                        <TrophyIcon className="w-3 h-3 inline mr-1" />
                        {milestones.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {aiLoading && (
                      <ArrowPathIcon className="w-4 h-4 text-purple-400 animate-spin" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); refreshAI(); }}
                      className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                      title="Refresh AI context"
                    >
                      <ArrowPathIcon className={`w-4 h-4 text-purple-400 ${aiLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {aiPanelExpanded ? (
                      <ChevronUpIcon className="w-5 h-5 text-purple-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                </button>

                {/* Content - collapsible */}
                {aiPanelExpanded && (
                  <div className="p-4 space-y-4">
                    {/* Error state */}
                    {aiError && (
                      <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        {aiError}
                      </div>
                    )}

                    {/* Milestones Alert - Critical priority */}
                    {milestones.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-yellow-400 uppercase tracking-wide flex items-center gap-1">
                          <TrophyIcon className="w-4 h-4" />
                          Milestones & Records
                        </div>
                        {milestones.map((milestone, idx) => (
                          <div
                            key={idx}
                            className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3"
                          >
                            <StarIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="text-yellow-200 font-medium">{milestone.title || milestone.type}</div>
                              {milestone.description && (
                                <div className="text-yellow-300/80 text-sm mt-1">{milestone.description}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* High Priority Talking Points */}
                    {highPriorityPoints.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-red-400 uppercase tracking-wide">Priority Points</div>
                        {highPriorityPoints.map((point, idx) => (
                          <div
                            key={point.id || idx}
                            className={`rounded-lg p-3 border-l-4 ${
                              point.priority === 'critical'
                                ? 'bg-red-500/10 border-red-500 text-red-200'
                                : 'bg-orange-500/10 border-orange-500 text-orange-200'
                            }`}
                          >
                            <div className="text-base leading-relaxed">{point.text}</div>
                            {point.source && (
                              <div className="text-xs opacity-60 mt-1">{point.source}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Regular Talking Points */}
                    {talkingPoints.filter(p => p.priority !== 'critical' && p.priority !== 'high').length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-purple-400 uppercase tracking-wide">Talking Points</div>
                        {talkingPoints
                          .filter(p => p.priority !== 'critical' && p.priority !== 'high')
                          .map((point, idx) => (
                            <div
                              key={point.id || idx}
                              className="bg-zinc-800/50 rounded-lg p-3 border-l-4 border-purple-500/50"
                            >
                              <div className="text-zinc-200 text-base leading-relaxed">{point.text}</div>
                              {point.source && (
                                <div className="text-xs text-zinc-500 mt-1">{point.source}</div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Empty state */}
                    {!hasContext && !aiLoading && !aiError && (
                      <div className="text-center text-zinc-500 py-4">
                        <SparklesIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No talking points for this segment</p>
                      </div>
                    )}

                    {/* Loading state */}
                    {aiLoading && !hasContext && (
                      <div className="text-center text-purple-400 py-4">
                        <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 animate-spin" />
                        <p className="text-sm">Loading talking points...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Next Segment Preview */}
            <NextSegment />

            {/* Hold Segment Warning */}
            {isHoldSegment && !canAdvanceHold && (
              <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-4 flex items-center gap-3">
                <ClockIcon className="w-6 h-6 text-yellow-500" />
                <div>
                  <div className="text-yellow-300 font-semibold">Hold Segment</div>
                  <div className="text-yellow-400 text-sm">
                    Wait {Math.ceil(holdRemainingMs / 1000)}s before advancing
                  </div>
                </div>
              </div>
            )}

            {/* Big Next Button */}
            <button
              onClick={() => timesheetAdvance('talent')}
              disabled={talentLocked || (isHoldSegment && !canAdvanceHold)}
              className={`
                w-full py-6 rounded-xl text-xl font-bold transition-all
                ${talentLocked || (isHoldSegment && !canAdvanceHold)
                  ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-98'
                }
              `}
            >
              {talentLocked ? (
                <span className="flex items-center justify-center gap-2">
                  <LockClosedIcon className="w-6 h-6" />
                  Controls Locked
                </span>
              ) : isHoldSegment && !canAdvanceHold ? (
                <span className="flex items-center justify-center gap-2">
                  <ClockIcon className="w-6 h-6" />
                  Hold - Wait {Math.ceil(holdRemainingMs / 1000)}s
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <PlayIcon className="w-6 h-6" />
                  NEXT
                </span>
              )}
            </button>

            {/* Quick Actions */}
            <QuickActions />

            {/* Run of Show */}
            <RunOfShow />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-zinc-500">
          <span>Segment {showProgress.completed + 1} of {showProgress.total}</span>
          <span>Gymnastics Graphics Show Controller</span>
        </div>
      </footer>
    </div>
  );
}
