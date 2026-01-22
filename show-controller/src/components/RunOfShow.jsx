import { useTimesheet } from '../hooks/useTimesheet';
import { CheckCircleIcon, PlayCircleIcon } from '@heroicons/react/24/solid';

export default function RunOfShow({ onSegmentClick, clickable = false }) {
  const { segments, currentIndex, totalSegments, jumpTo, formatTime } = useTimesheet();

  if (!segments || segments.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <div className="text-zinc-500">No show loaded</div>
      </div>
    );
  }

  // Handle segment click - use timesheet jumpTo if clickable
  const handleSegmentClick = (segmentId) => {
    if (clickable) {
      // Use timesheet jumpTo for segment navigation
      jumpTo(segmentId, 'producer');
      // Also call the optional callback if provided
      onSegmentClick?.(segmentId);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="text-sm text-zinc-400 uppercase tracking-wide">Show Progress</div>
        <div className="text-sm text-zinc-500">
          Segment {currentIndex + 1} of {totalSegments}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {segments.map((segment, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={segment.id}
              onClick={() => handleSegmentClick(segment.id)}
              className={`
                flex items-center gap-3 px-4 py-3 border-b border-zinc-800 last:border-b-0
                ${isCurrent ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}
                ${clickable ? 'cursor-pointer hover:bg-zinc-800' : ''}
              `}
            >
              <div className="w-6 flex justify-center">
                {isCompleted && (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                )}
                {isCurrent && (
                  <PlayCircleIcon className="w-5 h-5 text-blue-500" />
                )}
                {isPending && (
                  <div className="w-3 h-3 rounded-full border-2 border-zinc-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className={`
                  truncate
                  ${isCompleted ? 'text-zinc-500' : ''}
                  ${isCurrent ? 'text-white font-medium' : ''}
                  ${isPending ? 'text-zinc-400' : ''}
                `}>
                  {segment.name}
                </div>
              </div>

              {segment.duration && (
                <div className="text-xs text-zinc-500">
                  {formatTime(segment.duration * 1000)}
                </div>
              )}

              {segment.autoAdvance && (
                <div className="text-xs text-zinc-600">A</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
