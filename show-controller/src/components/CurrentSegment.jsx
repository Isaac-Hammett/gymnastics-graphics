import { useTimesheet } from '../hooks/useTimesheet';
import { PlayIcon, FilmIcon, PhotoIcon, MicrophoneIcon, PauseIcon } from '@heroicons/react/24/solid';

function getSegmentIcon(type) {
  switch (type) {
    case 'video':
      return <FilmIcon className="w-6 h-6" />;
    case 'graphic':
      return <PhotoIcon className="w-6 h-6" />;
    case 'live':
      return <MicrophoneIcon className="w-6 h-6" />;
    case 'hold':
      return <PauseIcon className="w-6 h-6" />;
    default:
      return <PlayIcon className="w-6 h-6" />;
  }
}

/**
 * Get progress bar color based on progress value
 * @param {number} progress - Progress value 0-1
 * @returns {string} Tailwind color class
 */
function getProgressColor(progress) {
  if (progress > 0.9) return 'bg-red-500';
  if (progress > 0.75) return 'bg-yellow-500';
  return 'bg-blue-500';
}

export default function CurrentSegment() {
  const {
    currentSegment,
    elapsedFormatted,
    remainingFormatted,
    remaining,
    progress,
    isPaused,
    isHoldSegment,
    canAdvanceHold,
    holdRemainingMs,
    formatTime
  } = useTimesheet();

  if (!currentSegment) {
    return (
      <div className="bg-zinc-800 rounded-xl p-6">
        <div className="text-zinc-500 text-center">No segment loaded</div>
      </div>
    );
  }

  const duration = currentSegment.duration || 0;
  const progressPercent = Math.round(progress * 100);
  const remainingSeconds = remaining / 1000;

  return (
    <div className="bg-zinc-800 rounded-xl p-6">
      <div className="text-sm text-zinc-400 uppercase tracking-wide mb-2">Now Playing</div>

      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-lg ${isPaused ? 'bg-yellow-500/20 text-yellow-400' : isHoldSegment ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
          {getSegmentIcon(currentSegment.type)}
        </div>
        <div className="flex-1">
          <div className="text-xl font-bold text-white">{currentSegment.name}</div>
          <div className="text-sm text-zinc-400 capitalize">{currentSegment.type} segment</div>
        </div>
        {isPaused && (
          <div className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
            Paused
          </div>
        )}
      </div>

      {/* Elapsed / Remaining display */}
      <div className="flex gap-4 mb-4">
        <div className="bg-zinc-900 rounded-lg p-3 flex-1 text-center">
          <div className="text-xs text-zinc-500 uppercase mb-1">Elapsed</div>
          <div className="text-2xl font-mono text-white">{elapsedFormatted}</div>
        </div>
        <div className={`bg-zinc-900 rounded-lg p-3 flex-1 text-center ${remainingSeconds < 10 && remainingSeconds > 0 ? 'ring-2 ring-red-500' : ''}`}>
          <div className="text-xs text-zinc-500 uppercase mb-1">Remaining</div>
          <div className={`text-2xl font-mono ${remainingSeconds < 10 && remainingSeconds > 0 ? 'text-red-400' : 'text-white'}`}>
            {remainingFormatted}
          </div>
        </div>
      </div>

      {/* Progress bar with color coding */}
      {duration > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(progress)} transition-all duration-100`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-right text-xs text-zinc-400 mt-1">
            {progressPercent}%
          </div>
        </div>
      )}

      {/* Hold segment warning */}
      {isHoldSegment && !canAdvanceHold && (
        <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 mb-4 flex items-center gap-2">
          <span className="text-yellow-500 text-lg">&#9888;</span>
          <span className="text-yellow-300 text-sm">
            HOLD: Wait {Math.ceil(holdRemainingMs / 1000)}s before advancing
          </span>
        </div>
      )}

      {/* Hold segment ready */}
      {isHoldSegment && canAdvanceHold && (
        <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 mb-4 flex items-center gap-2">
          <span className="text-green-500 text-lg">&#10003;</span>
          <span className="text-green-300 text-sm">
            Hold segment ready - can advance
          </span>
        </div>
      )}

      {currentSegment.obsScene && (
        <div className="text-sm text-zinc-500">
          OBS Scene: <span className="text-zinc-300">{currentSegment.obsScene}</span>
        </div>
      )}

      {currentSegment.notes && (
        <div className="mt-4 p-3 bg-zinc-900 rounded-lg">
          <div className="text-xs text-zinc-500 uppercase mb-1">Notes</div>
          <div className="text-sm text-zinc-300">{currentSegment.notes}</div>
        </div>
      )}
    </div>
  );
}
