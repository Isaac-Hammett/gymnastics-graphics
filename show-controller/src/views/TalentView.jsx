import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useShow } from '../context/ShowContext';
import { useTimesheet } from '../hooks/useTimesheet';
import CurrentSegment from '../components/CurrentSegment';
import NextSegment from '../components/NextSegment';
import RunOfShow from '../components/RunOfShow';
import QuickActions from '../components/QuickActions';
import ConnectionStatus from '../components/ConnectionStatus';
import { PlayIcon, LockClosedIcon, ClockIcon, DocumentTextIcon, VideoCameraIcon } from '@heroicons/react/24/solid';

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
