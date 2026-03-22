import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  FilmIcon,
  ForwardIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  VideoCameraIcon,
  FlagIcon,
} from '@heroicons/react/24/solid';

/**
 * PlayoutEventLog — Scrollable event log panel for playout diagnostics
 * Shows real-time playout events with time filtering and retry actions.
 *
 * Props (from usePlayoutState):
 * - eventLog: Array of event objects { id, timestamp, type, level, message, clipId?, athleteName?, canRetry? }
 *   - timestamp: Unix epoch milliseconds
 *   - type: 'clip_played' | 'clip_skipped' | 'clip_stalled' | 'clip_failed' | 'api_error' |
 *           'state_transition' | 'override' | 'rotation_advance' | 'playout_start' | 'playout_stop' |
 *           'flag_moment' | 'pause' | 'resume' | 'camera_switch'
 *   - level: 'success' | 'warning' | 'error' | 'info'
 * - actions: { retryClip }
 */

// Time filter options in milliseconds
const TIME_FILTERS = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  all: Infinity,
};

// Event type icons
function getEventIcon(type) {
  switch (type) {
    case 'clip_played':
      return <FilmIcon className="w-3.5 h-3.5" />;
    case 'clip_skipped':
    case 'clip_stalled':
      return <ForwardIcon className="w-3.5 h-3.5" />;
    case 'clip_failed':
      return <XCircleIcon className="w-3.5 h-3.5" />;
    case 'api_error':
      return <ExclamationTriangleIcon className="w-3.5 h-3.5" />;
    case 'playout_start':
    case 'playout_stop':
      return <PlayIcon className="w-3.5 h-3.5" />;
    case 'rotation_advance':
      return <ArrowPathIcon className="w-3.5 h-3.5" />;
    case 'state_transition':
      return <CheckCircleIcon className="w-3.5 h-3.5" />;
    case 'override':
      return <VideoCameraIcon className="w-3.5 h-3.5" />;
    case 'flag_moment':
      return <FlagIcon className="w-3.5 h-3.5" />;
    case 'pause':
      return <PauseIcon className="w-3.5 h-3.5" />;
    case 'resume':
      return <PlayIcon className="w-3.5 h-3.5" />;
    case 'camera_switch':
      return <VideoCameraIcon className="w-3.5 h-3.5" />;
    default:
      return <ClockIcon className="w-3.5 h-3.5" />;
  }
}

// Level styling
function getLevelStyle(level) {
  switch (level) {
    case 'success':
      return {
        dot: 'bg-green-500',
        text: 'text-green-400',
        icon: 'text-green-400',
      };
    case 'warning':
      return {
        dot: 'bg-amber-500',
        text: 'text-amber-400',
        icon: 'text-amber-400',
      };
    case 'error':
      return {
        dot: 'bg-red-500',
        text: 'text-red-400',
        icon: 'text-red-400',
      };
    case 'info':
    default:
      return {
        dot: 'bg-zinc-400',
        text: 'text-zinc-300',
        icon: 'text-zinc-400',
      };
  }
}

// Format timestamp to HH:MM:SS local time
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Truncate athlete name after 20 chars
function truncateAthleteName(name) {
  if (!name) return '';
  if (name.length <= 20) return name;
  return name.substring(0, 20) + '...';
}

export default function PlayoutEventLog({
  eventLog = [],
  actions = {},
}) {
  const { retryClip } = actions;

  // Time filter state - default to 15m
  const [timeFilter, setTimeFilter] = useState('15m');

  // Scroll container ref for auto-scroll behavior
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Filter events by time
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const filterMs = TIME_FILTERS[timeFilter];

    return eventLog
      .filter((event) => {
        if (filterMs === Infinity) return true;
        return now - event.timestamp < filterMs;
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Newest first
  }, [eventLog, timeFilter]);

  // Handle scroll to detect if user scrolled up (disable auto-scroll)
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If scrolled near the top (within 50px), disable auto-scroll
    // Auto-scroll shows newest at top, so scrolling down means user wants to see older
    const isNearTop = scrollTop < 50;
    setAutoScroll(isNearTop);
  };

  // Auto-scroll to top when new events arrive (if enabled)
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [filteredEvents.length, autoScroll]);

  // Handle retry button click
  const handleRetry = (clipId) => {
    if (retryClip && clipId) {
      retryClip(clipId);
    }
  };

  return (
    <div className="bg-zinc-800 rounded-xl p-4 flex flex-col h-full">
      {/* Header with time filter buttons */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-white uppercase tracking-wide">
            Event Log
          </span>
        </div>
        <div className="flex items-center gap-1">
          {Object.keys(TIME_FILTERS).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                timeFilter === filter
                  ? 'bg-zinc-600 text-white'
                  : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-300'
              }`}
            >
              {filter === 'all' ? 'All' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 space-y-1"
      >
        {filteredEvents.length === 0 ? (
          <div className="text-zinc-500 text-sm text-center py-4">
            No events in selected time range
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventLogEntry
              key={event.id}
              event={event}
              onRetry={handleRetry}
            />
          ))
        )}
      </div>

      {/* Event count footer */}
      <div className="mt-2 pt-2 border-t border-zinc-700 text-xs text-zinc-500">
        {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} shown
      </div>
    </div>
  );
}

/**
 * Single event log entry
 */
function EventLogEntry({ event, onRetry }) {
  const { id, timestamp, type, level, message, clipId, athleteName, canRetry } = event;
  const style = getLevelStyle(level);

  // Build display message with truncated athlete name
  let displayMessage = message;
  if (athleteName) {
    const truncated = truncateAthleteName(athleteName);
    // Replace full name with truncated version if present in message
    if (message.includes(athleteName)) {
      displayMessage = message.replace(athleteName, truncated);
    }
  }

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-zinc-700/50 group">
      {/* Timestamp */}
      <span className="text-xs text-zinc-500 font-mono whitespace-nowrap flex-shrink-0">
        {formatTimestamp(timestamp)}
      </span>

      {/* Level indicator dot */}
      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />

      {/* Icon */}
      <span className={`flex-shrink-0 mt-0.5 ${style.icon}`}>
        {getEventIcon(type)}
      </span>

      {/* Message */}
      <span
        className={`text-sm flex-1 truncate ${style.text}`}
        title={message}
      >
        {displayMessage}
      </span>

      {/* Retry button for failed/stalled clips */}
      {canRetry && clipId && (
        <button
          onClick={() => onRetry(clipId)}
          className="px-2 py-0.5 text-xs font-medium rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors opacity-0 group-hover:opacity-100"
        >
          Retry
        </button>
      )}
    </div>
  );
}
