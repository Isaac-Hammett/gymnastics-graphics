import { useShow } from '../context/ShowContext';
import { PlayIcon, FilmIcon, PhotoIcon, MicrophoneIcon } from '@heroicons/react/24/solid';

function getSegmentIcon(type) {
  switch (type) {
    case 'video':
      return <FilmIcon className="w-6 h-6" />;
    case 'graphic':
      return <PhotoIcon className="w-6 h-6" />;
    case 'live':
      return <MicrophoneIcon className="w-6 h-6" />;
    default:
      return <PlayIcon className="w-6 h-6" />;
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function CurrentSegment() {
  const { state, elapsed } = useShow();
  const { currentSegment, isPlaying, isPaused } = state;

  if (!currentSegment) {
    return (
      <div className="bg-zinc-800 rounded-xl p-6">
        <div className="text-zinc-500 text-center">No segment loaded</div>
      </div>
    );
  }

  const duration = currentSegment.duration || 0;
  const progress = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;

  return (
    <div className="bg-zinc-800 rounded-xl p-6">
      <div className="text-sm text-zinc-400 uppercase tracking-wide mb-2">Now Playing</div>

      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-lg ${isPaused ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
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

      {duration > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-sm text-zinc-400">
            <span>{formatTime(elapsed)}</span>
            <span>{formatTime(duration)}</span>
          </div>
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
