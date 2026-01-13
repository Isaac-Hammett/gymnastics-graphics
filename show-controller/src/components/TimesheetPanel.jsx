import { useEffect, useState, useCallback } from 'react';
import { useShow } from '../context/ShowContext';
import {
  PlayIcon,
  PauseIcon,
  BackwardIcon,
  ForwardIcon,
  StopIcon,
  ClockIcon,
  FilmIcon,
  PhotoIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/solid';

// Segment type icons
function getSegmentIcon(type) {
  switch (type) {
    case 'video':
      return <FilmIcon className="w-4 h-4" />;
    case 'graphic':
      return <PhotoIcon className="w-4 h-4" />;
    case 'live':
    case 'multi':
      return <VideoCameraIcon className="w-4 h-4" />;
    case 'hold':
      return <PauseIcon className="w-4 h-4" />;
    case 'break':
      return <ClockIcon className="w-4 h-4" />;
    default:
      return <PlayIcon className="w-4 h-4" />;
  }
}

// Segment type colors
function getSegmentColor(type) {
  switch (type) {
    case 'live':
    case 'multi':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'video':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'graphic':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'hold':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'break':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default:
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }
}

// Format milliseconds to MM:SS
function formatTime(ms) {
  if (ms == null || ms < 0) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format seconds to MM:SS
function formatSeconds(seconds) {
  if (seconds == null || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function TimesheetPanel({ collapsed: initialCollapsed = false }) {
  const { socket, state } = useShow();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [timesheetState, setTimesheetState] = useState(null);
  const [segmentListExpanded, setSegmentListExpanded] = useState(false);

  // Server URL for REST API calls
  const serverUrl = import.meta.env.PROD
    ? (import.meta.env.VITE_SOCKET_SERVER || '')
    : 'http://localhost:3003';

  // Fetch initial timesheet state
  useEffect(() => {
    async function fetchTimesheetState() {
      try {
        const res = await fetch(`${serverUrl}/api/timesheet/state`);
        if (res.ok) {
          setTimesheetState(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch timesheet state:', err);
      }
    }
    fetchTimesheetState();
  }, [serverUrl]);

  // Subscribe to timesheet socket events
  useEffect(() => {
    if (!socket) return;

    const handleTimesheetState = (newState) => {
      setTimesheetState(newState);
    };

    const handleTimesheetTick = (tickData) => {
      setTimesheetState(prev => prev ? {
        ...prev,
        segmentElapsedMs: tickData.segmentElapsedMs,
        segmentRemainingMs: tickData.segmentRemainingMs,
        segmentProgress: tickData.segmentProgress,
        showElapsedMs: tickData.showElapsedMs,
        canAdvanceHold: tickData.canAdvanceHold,
        holdRemainingMs: tickData.holdRemainingMs
      } : null);
    };

    const handleSegmentActivated = (data) => {
      setTimesheetState(prev => prev ? {
        ...prev,
        currentSegment: data.segment,
        currentSegmentIndex: data.index,
        nextSegment: data.nextSegment,
        segmentElapsedMs: 0,
        segmentRemainingMs: data.segment?.duration ? data.segment.duration * 1000 : null,
        segmentProgress: 0
      } : null);
    };

    socket.on('timesheetState', handleTimesheetState);
    socket.on('timesheetTick', handleTimesheetTick);
    socket.on('timesheetSegmentActivated', handleSegmentActivated);
    socket.on('timesheetStateChanged', handleTimesheetState);

    return () => {
      socket.off('timesheetState', handleTimesheetState);
      socket.off('timesheetTick', handleTimesheetTick);
      socket.off('timesheetSegmentActivated', handleSegmentActivated);
      socket.off('timesheetStateChanged', handleTimesheetState);
    };
  }, [socket]);

  // Timesheet control functions
  const startTimesheetShow = useCallback(() => {
    socket?.emit('startTimesheetShow');
  }, [socket]);

  const stopTimesheetShow = useCallback(() => {
    socket?.emit('stopTimesheetShow');
  }, [socket]);

  const advanceSegment = useCallback(() => {
    socket?.emit('advanceSegment', { advancedBy: 'producer' });
  }, [socket]);

  const previousSegment = useCallback(() => {
    socket?.emit('previousSegment', { triggeredBy: 'producer' });
  }, [socket]);

  const jumpToSegment = useCallback((segmentId) => {
    socket?.emit('goToSegment', { segmentId, triggeredBy: 'producer' });
  }, [socket]);

  // Get segments from showConfig
  const segments = state.showConfig?.segments || [];

  // Current segment info
  const currentSegment = timesheetState?.currentSegment;
  const nextSegment = timesheetState?.nextSegment;
  const isRunning = timesheetState?.isRunning;
  const engineState = timesheetState?.state;
  const currentIndex = timesheetState?.currentSegmentIndex ?? -1;

  // Time values
  const elapsed = timesheetState?.segmentElapsedMs || 0;
  const remaining = timesheetState?.segmentRemainingMs;
  const progress = timesheetState?.segmentProgress || 0;
  const duration = currentSegment?.duration ? currentSegment.duration * 1000 : null;

  // Hold segment state
  const isHold = timesheetState?.isHoldSegment;
  const canAdvanceHold = timesheetState?.canAdvanceHold;
  const holdRemainingMs = timesheetState?.holdRemainingMs || 0;

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-zinc-400" />
          <span className="font-medium text-white">Timesheet</span>
          {isRunning && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              Live
            </span>
          )}
          {engineState === 'paused' && (
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
              Paused
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {!collapsed && (
        <div className="p-4 pt-0 space-y-4">
          {/* Current Segment Display */}
          {currentSegment ? (
            <div className="space-y-3">
              {/* Current segment card */}
              <div className={`p-3 rounded-lg border ${getSegmentColor(currentSegment.type)}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getSegmentIcon(currentSegment.type)}
                  <span className="text-xs uppercase tracking-wide opacity-70">Now Playing</span>
                </div>
                <div className="text-lg font-bold text-white">{currentSegment.name}</div>
                <div className="text-sm opacity-70 capitalize">{currentSegment.type}</div>
              </div>

              {/* Time display */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-zinc-900 rounded-lg p-2">
                  <div className="text-xs text-zinc-500 uppercase">Elapsed</div>
                  <div className="text-xl font-mono font-bold text-white">{formatTime(elapsed)}</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-2">
                  <div className="text-xs text-zinc-500 uppercase">Remaining</div>
                  <div className={`text-xl font-mono font-bold ${
                    remaining != null && remaining <= 10000 ? 'text-red-400' : 'text-white'
                  }`}>
                    {remaining != null ? formatTime(remaining) : '--:--'}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {duration != null && (
                <div>
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        progress > 90 ? 'bg-red-500' : progress > 75 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(progress * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-zinc-500">
                    <span>{Math.round(progress * 100)}%</span>
                    <span>{formatTime(duration)} total</span>
                  </div>
                </div>
              )}

              {/* Hold segment warning */}
              {isHold && (
                <div className={`flex items-center gap-2 p-2 rounded-lg ${
                  canAdvanceHold ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  <span className="text-sm">
                    {canAdvanceHold
                      ? 'Hold segment ready - can advance'
                      : `Wait ${formatTime(holdRemainingMs)} before advancing`
                    }
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-zinc-500">
              {isRunning ? 'Loading...' : 'Show not started'}
            </div>
          )}

          {/* Next Segment Preview */}
          {nextSegment && (
            <div className="bg-zinc-900 rounded-lg p-3">
              <div className="text-xs text-zinc-500 uppercase mb-2">Up Next</div>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded ${getSegmentColor(nextSegment.type).split(' ')[0]}`}>
                  {getSegmentIcon(nextSegment.type)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white text-sm">{nextSegment.name}</div>
                  <div className="text-xs text-zinc-500">
                    {nextSegment.duration ? formatSeconds(nextSegment.duration) : 'Manual'}
                    {nextSegment.autoAdvance && ' • Auto'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-2">
            {!isRunning ? (
              <button
                onClick={startTimesheetShow}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
              >
                <PlayIcon className="w-4 h-4" />
                Start Show
              </button>
            ) : (
              <>
                <button
                  onClick={previousSegment}
                  disabled={currentIndex <= 0}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-colors"
                  title="Previous segment"
                >
                  <BackwardIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={advanceSegment}
                  disabled={isHold && !canAdvanceHold}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                    isHold && !canAdvanceHold
                      ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  <ForwardIcon className="w-4 h-4" />
                  Next
                </button>
                <button
                  onClick={stopTimesheetShow}
                  className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                  title="Stop show"
                >
                  <StopIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Segment List (collapsible) */}
          {segments.length > 0 && (
            <div>
              <button
                onClick={() => setSegmentListExpanded(!segmentListExpanded)}
                className="w-full flex items-center justify-between px-2 py-1 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                <span>Segment List ({currentIndex + 1}/{segments.length})</span>
                {segmentListExpanded ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </button>

              {segmentListExpanded && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {segments.map((segment, index) => {
                    const isCurrent = index === currentIndex;
                    const isPast = index < currentIndex;
                    const isFuture = index > currentIndex;

                    return (
                      <button
                        key={segment.id}
                        onClick={() => jumpToSegment(segment.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                          isCurrent
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : isPast
                            ? 'bg-zinc-900 text-zinc-500'
                            : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <span className={`w-5 text-center text-xs ${
                          isCurrent ? 'text-blue-400' : 'text-zinc-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className={`p-1 rounded ${getSegmentColor(segment.type).split(' ')[0]}`}>
                          {getSegmentIcon(segment.type)}
                        </span>
                        <span className="flex-1 truncate">{segment.name}</span>
                        {segment.duration && (
                          <span className="text-xs text-zinc-500">
                            {formatSeconds(segment.duration)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
