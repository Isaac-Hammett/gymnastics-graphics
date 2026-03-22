import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

/**
 * TalentClipInfo - Commentator's clip info display
 *
 * Shows current content (athlete, apparatus, score), talking points,
 * and upcoming items. Display varies by playout mode.
 *
 * PRD Reference: Section 4.8 - TalentView Commentator Clip Info
 */

// Apparatus display names
const APPARATUS_NAMES = {
  'VT': 'Vault',
  'UB': 'Uneven Bars',
  'BB': 'Balance Beam',
  'FX': 'Floor Exercise',
  'PH': 'Pommel Horse',
  'SR': 'Still Rings',
  'PB': 'Parallel Bars',
  'HB': 'High Bar'
};

// Placeholder talking points for Stage A (AI context integration in Stage B)
const PLACEHOLDER_TALKING_POINTS = [
  'Season high on this apparatus — previous best was 9.825',
  'Currently leads all-around standings',
  'Clean execution throughout the routine'
];

/**
 * Format score for display
 * - null/undefined: "pending" in gray italics
 * - 0: "0.000"
 * - > 0: formatted to 3 decimal places
 */
function formatScore(score) {
  if (score === null || score === undefined) {
    return { value: 'pending', isPending: true };
  }
  return { value: score.toFixed(3), isPending: false };
}

export default function TalentClipInfo({
  currentMode,
  currentClip,
  nextClip,
  clipQueue,
  cameraStates
}) {
  // State for collapsing talking points on mobile
  const [talkingPointsExpanded, setTalkingPointsExpanded] = useState(true);

  // Get upcoming clips (next 2-3 queued items after current)
  const upcomingClips = (clipQueue?.queued || []).slice(0, 3);

  // Determine apparatus name for display
  const getApparatusName = (apparatus) => {
    return APPARATUS_NAMES[apparatus] || apparatus;
  };

  // Get current live apparatus from camera states
  const getLiveApparatus = () => {
    const liveCamera = cameraStates?.find(cam => cam.state === 'live' || cam.state === 'recording-live');
    if (liveCamera) {
      return getApparatusName(liveCamera.apparatus);
    }
    // Find any recording camera as fallback
    const recordingCamera = cameraStates?.find(cam => cam.state === 'recording');
    return recordingCamera ? getApparatusName(recordingCamera.apparatus) : 'Unknown';
  };

  // Render CLIP mode content (full athlete info)
  const renderClipContent = () => {
    if (!currentClip) {
      return (
        <div className="text-center py-8 text-zinc-500">
          <p>Waiting for clips...</p>
        </div>
      );
    }

    const score = formatScore(currentClip.score);

    return (
      <>
        {/* NOW SHOWING Section */}
        <div className="text-center space-y-2 pb-4 border-b border-zinc-700">
          <div className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
            NOW SHOWING
          </div>
          {/* Athlete name - large, truncates on mobile */}
          <h2 className="text-2xl sm:text-3xl font-bold text-white truncate px-2">
            {currentClip.athlete_name}
          </h2>
          {/* Apparatus */}
          <div className="text-lg text-zinc-300">
            {getApparatusName(currentClip.apparatus)}
          </div>
          {/* Team */}
          <div className="text-sm text-zinc-400">
            {currentClip.team_name}
          </div>
          {/* Score - always visible to commentator */}
          <div className="mt-3">
            <span className="text-zinc-400 mr-2">Score:</span>
            {score.isPending ? (
              <span className="text-zinc-500 italic">pending</span>
            ) : (
              <span className="text-xl font-mono font-bold text-white">{score.value}</span>
            )}
          </div>
        </div>

        {/* TALKING POINTS Section */}
        <div className="py-4 border-b border-zinc-700">
          <button
            onClick={() => setTalkingPointsExpanded(!talkingPointsExpanded)}
            className="w-full flex items-center justify-between text-left sm:cursor-default"
          >
            <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
              TALKING POINTS
            </span>
            {/* Collapse button visible only on mobile */}
            <span className="sm:hidden">
              {talkingPointsExpanded ? (
                <ChevronUpIcon className="w-4 h-4 text-purple-400" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-purple-400" />
              )}
            </span>
          </button>
          {/* Points list - collapsible on mobile, always visible on larger screens */}
          <ul className={`mt-2 space-y-2 ${talkingPointsExpanded ? 'block' : 'hidden'} sm:block`}>
            {PLACEHOLDER_TALKING_POINTS.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-purple-400 mt-0.5">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* UP NEXT Section */}
        {renderUpNext()}
      </>
    );
  };

  // Render LIVE mode content
  const renderLiveContent = () => {
    const apparatus = getLiveApparatus();
    const recordingCameras = cameraStates?.filter(cam =>
      cam.state === 'recording' || cam.state === 'recording-live' || cam.state === 'live'
    ) || [];

    return (
      <>
        <div className="text-center space-y-2 pb-4 border-b border-zinc-700">
          <div className="text-xs font-medium text-green-400 uppercase tracking-wider">
            NOW SHOWING
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-green-400">
            LIVE — {apparatus}
          </h2>
          {recordingCameras.length > 0 && (
            <div className="text-sm text-zinc-400">
              {recordingCameras.map(cam => (
                <span key={cam.cameraNumber} className="mr-3">
                  Cam {cam.cameraNumber}: {getApparatusName(cam.apparatus)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* UP NEXT Section */}
        {renderUpNext()}
      </>
    );
  };

  // Render FALLBACK/BREAK mode content
  const renderFallbackContent = () => {
    const modeLabel = currentMode === 'BREAK' ? 'BREAK' : 'FALLBACK';
    const hasQueuedClips = upcomingClips.length > 0;

    return (
      <>
        <div className="text-center space-y-2 pb-4 border-b border-zinc-700">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            NOW SHOWING
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-400">
            {modeLabel}
          </h2>
          {currentMode === 'BREAK' && (
            <div className="text-sm text-zinc-500">
              Rotation Summary
            </div>
          )}
        </div>

        {/* Next clip info or waiting message */}
        <div className="py-4 border-b border-zinc-700">
          {hasQueuedClips ? (
            <div className="text-center">
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                NEXT CLIP
              </div>
              <div className="text-white font-medium">
                {upcomingClips[0].athlete_name}
              </div>
              <div className="text-sm text-zinc-400">
                {getApparatusName(upcomingClips[0].apparatus)} · {upcomingClips[0].team_name}
              </div>
            </div>
          ) : (
            <div className="text-center text-zinc-500 py-4">
              Waiting for clips...
            </div>
          )}
        </div>

        {/* UP NEXT Section - show remaining if any */}
        {upcomingClips.length > 1 && renderUpNext(upcomingClips.slice(1))}
      </>
    );
  };

  // Render MOMENT_REPLAY content
  const renderReplayContent = () => {
    return (
      <>
        <div className="text-center space-y-2 pb-4 border-b border-zinc-700">
          <div className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
            NOW SHOWING
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-cyan-400">
            REPLAY
          </h2>
          {currentClip && (
            <>
              <div className="text-lg text-zinc-300">
                {currentClip.athlete_name}
              </div>
              <div className="text-sm text-zinc-400">
                {getApparatusName(currentClip.apparatus)} · {currentClip.team_name}
              </div>
            </>
          )}
        </div>

        {/* UP NEXT Section */}
        {renderUpNext()}
      </>
    );
  };

  // Render UP NEXT section (shared across modes)
  const renderUpNext = (clips = upcomingClips) => {
    if (!clips || clips.length === 0) {
      return null;
    }

    return (
      <div className="py-4">
        <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
          UP NEXT
        </div>
        <ul className="space-y-2">
          {clips.slice(0, 3).map((clip, idx) => {
            const score = formatScore(clip.score);
            return (
              <li
                key={clip.draft_id}
                className="flex items-center justify-between text-sm py-1 px-2 rounded bg-zinc-800/50"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-zinc-300 truncate">
                    {clip.athlete_name}
                  </span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-zinc-400 whitespace-nowrap">
                    {getApparatusName(clip.apparatus)}
                  </span>
                </div>
                <div className="text-zinc-500 ml-2 whitespace-nowrap">
                  {score.isPending ? (
                    <span className="italic text-xs">pending</span>
                  ) : (
                    <span className="font-mono">{score.value}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // Main render based on current mode
  const renderContent = () => {
    switch (currentMode) {
      case 'CLIP':
        return renderClipContent();
      case 'LIVE':
        return renderLiveContent();
      case 'MOMENT_REPLAY':
        return renderReplayContent();
      case 'FALLBACK':
      case 'BREAK':
        return renderFallbackContent();
      case 'PAUSED':
        // When paused, show same as clip mode but with paused indicator
        return (
          <>
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-3 py-2 mb-4 text-center">
              <span className="text-yellow-400 text-sm font-medium">PAUSED</span>
            </div>
            {renderClipContent()}
          </>
        );
      case 'OVERRIDE':
        return (
          <>
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg px-3 py-2 mb-4 text-center">
              <span className="text-amber-400 text-sm font-medium">OVERRIDE ACTIVE</span>
            </div>
            {renderLiveContent()}
          </>
        );
      default:
        return renderClipContent();
    }
  };

  return (
    <div className="bg-zinc-900 rounded-xl border-2 border-cyan-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-cyan-500/10 px-4 py-2 flex items-center gap-2 border-b border-cyan-500/30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-cyan-400"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
        </svg>
        <span className="text-sm font-medium text-cyan-400 uppercase tracking-wide">
          Clip Info
        </span>
        {/* Mode badge */}
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
          currentMode === 'CLIP' ? 'bg-green-500/30 text-green-300' :
          currentMode === 'LIVE' ? 'bg-green-500/30 text-green-300' :
          currentMode === 'MOMENT_REPLAY' ? 'bg-cyan-500/30 text-cyan-300' :
          currentMode === 'PAUSED' ? 'bg-yellow-500/30 text-yellow-300' :
          currentMode === 'OVERRIDE' ? 'bg-amber-500/30 text-amber-300' :
          'bg-zinc-500/30 text-zinc-300'
        }`}>
          {currentMode === 'MOMENT_REPLAY' ? 'REPLAY' : currentMode}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  );
}
