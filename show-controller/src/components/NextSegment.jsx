import { useTimesheet } from '../hooks/useTimesheet';
import { PlayIcon, FilmIcon, PhotoIcon, MicrophoneIcon, ClockIcon } from '@heroicons/react/24/outline';

function getSegmentIcon(type) {
  switch (type) {
    case 'video':
      return <FilmIcon className="w-5 h-5" />;
    case 'graphic':
      return <PhotoIcon className="w-5 h-5" />;
    case 'live':
      return <MicrophoneIcon className="w-5 h-5" />;
    case 'hold':
      return <ClockIcon className="w-5 h-5" />;
    default:
      return <PlayIcon className="w-5 h-5" />;
  }
}

export default function NextSegment() {
  const { nextSegment, formatTime } = useTimesheet();

  if (!nextSegment) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <div className="text-sm text-zinc-400 uppercase tracking-wide mb-2">Up Next</div>
        <div className="text-zinc-500">End of show</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="text-sm text-zinc-400 uppercase tracking-wide mb-2">Up Next</div>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
          {getSegmentIcon(nextSegment.type)}
        </div>
        <div className="flex-1">
          <div className="font-medium text-white">{nextSegment.name}</div>
          {nextSegment.duration && (
            <div className="text-sm text-zinc-500">
              {formatTime(nextSegment.duration * 1000)} duration
            </div>
          )}
        </div>
        {nextSegment.autoAdvance && (
          <div className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
            Auto
          </div>
        )}
      </div>
    </div>
  );
}
