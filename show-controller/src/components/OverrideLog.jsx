import { useEffect, useState, useCallback } from 'react';
import { useShow } from '../context/ShowContext';
import {
  ClipboardDocumentListIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownTrayIcon,
  VideoCameraIcon,
  FilmIcon,
  ForwardIcon,
  BackwardIcon,
  ArrowRightIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/solid';

// Override type icons
function getOverrideIcon(type) {
  switch (type) {
    case 'advance':
      return <ForwardIcon className="w-4 h-4" />;
    case 'previous':
      return <BackwardIcon className="w-4 h-4" />;
    case 'jump':
      return <ArrowRightIcon className="w-4 h-4" />;
    case 'sceneOverride':
      return <FilmIcon className="w-4 h-4" />;
    case 'cameraOverride':
      return <VideoCameraIcon className="w-4 h-4" />;
    default:
      return <ExclamationCircleIcon className="w-4 h-4" />;
  }
}

// Override type colors
function getOverrideColor(type) {
  switch (type) {
    case 'advance':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'previous':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'jump':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'sceneOverride':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'cameraOverride':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    default:
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }
}

// Format override type for display
function formatOverrideType(type) {
  switch (type) {
    case 'advance':
      return 'Next';
    case 'previous':
      return 'Previous';
    case 'jump':
      return 'Jump';
    case 'sceneOverride':
      return 'Scene';
    case 'cameraOverride':
      return 'Camera';
    default:
      return type;
  }
}

// Format timestamp to HH:MM:SS
function formatTimestamp(timestamp) {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Get override details string
function getOverrideDetails(override) {
  switch (override.type) {
    case 'advance':
      return `${override.fromSegment?.name || 'Start'} → ${override.toSegment?.name || 'End'}`;
    case 'previous':
      return `${override.fromSegment?.name || 'Start'} ← ${override.toSegment?.name || 'Start'}`;
    case 'jump':
      return `Jumped to "${override.toSegment?.name || override.segmentId}"`;
    case 'sceneOverride':
      return `Switched to "${override.sceneName}"`;
    case 'cameraOverride':
      return `Camera: ${override.cameraName || override.cameraId}`;
    default:
      return JSON.stringify(override);
  }
}

export default function OverrideLog({ collapsed: initialCollapsed = true, defaultVisible = 5 }) {
  const { socket } = useShow();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [overrides, setOverrides] = useState([]);
  const [showAll, setShowAll] = useState(false);

  // Server URL for REST API calls
  const serverUrl = import.meta.env.PROD
    ? (import.meta.env.VITE_SOCKET_SERVER || '')
    : 'http://localhost:3003';

  // Fetch initial overrides
  useEffect(() => {
    async function fetchOverrides() {
      try {
        const res = await fetch(`${serverUrl}/api/timesheet/overrides`);
        if (res.ok) {
          const data = await res.json();
          setOverrides(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch overrides:', err);
      }
    }
    fetchOverrides();
  }, [serverUrl]);

  // Subscribe to override socket events
  useEffect(() => {
    if (!socket) return;

    const handleOverrideRecorded = (override) => {
      setOverrides(prev => [override, ...prev]);
    };

    const handleTimesheetState = (state) => {
      if (state.overrides) {
        setOverrides(state.overrides);
      }
    };

    socket.on('timesheetOverrideRecorded', handleOverrideRecorded);
    socket.on('timesheetState', handleTimesheetState);

    return () => {
      socket.off('timesheetOverrideRecorded', handleOverrideRecorded);
      socket.off('timesheetState', handleTimesheetState);
    };
  }, [socket]);

  // Export overrides as JSON
  const exportOverrides = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalOverrides: overrides.length,
      overrides: overrides
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `show-overrides-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [overrides]);

  // Visible overrides (show last N by default)
  const visibleOverrides = showAll ? overrides : overrides.slice(0, defaultVisible);
  const hasMore = overrides.length > defaultVisible;

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardDocumentListIcon className="w-5 h-5 text-zinc-400" />
          <span className="font-medium text-white">Override Log</span>
          {overrides.length > 0 && (
            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
              {overrides.length}
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
        <div className="p-4 pt-0 space-y-3">
          {/* Export button */}
          {overrides.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={exportOverrides}
                className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
                title="Export overrides for post-show analysis"
              >
                <ArrowDownTrayIcon className="w-3 h-3" />
                Export
              </button>
            </div>
          )}

          {/* Override list */}
          {overrides.length === 0 ? (
            <div className="text-center py-4 text-zinc-500 text-sm">
              No overrides recorded
            </div>
          ) : (
            <div className="space-y-2">
              {visibleOverrides.map((override, index) => (
                <div
                  key={override.timestamp || index}
                  className={`p-2 rounded-lg border ${getOverrideColor(override.type)}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`p-1 rounded ${getOverrideColor(override.type).split(' ')[0]}`}>
                      {getOverrideIcon(override.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {formatOverrideType(override.type)}
                        </span>
                        <span className="text-xs opacity-70 font-mono">
                          {formatTimestamp(override.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs opacity-80 truncate mt-0.5">
                        {getOverrideDetails(override)}
                      </div>
                      {override.triggeredBy && (
                        <div className="text-xs opacity-60 mt-0.5">
                          by {override.triggeredBy}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Show more/less toggle */}
              {hasMore && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  {showAll ? (
                    <>Show less ({defaultVisible})</>
                  ) : (
                    <>Show all ({overrides.length})</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Summary stats */}
          {overrides.length > 0 && (
            <div className="pt-2 border-t border-zinc-700">
              <div className="flex flex-wrap gap-2 text-xs">
                {['advance', 'previous', 'jump', 'sceneOverride', 'cameraOverride'].map(type => {
                  const count = overrides.filter(o => o.type === type).length;
                  if (count === 0) return null;
                  return (
                    <div
                      key={type}
                      className={`px-2 py-1 rounded ${getOverrideColor(type).split(' ').slice(0, 2).join(' ')}`}
                    >
                      {formatOverrideType(type)}: {count}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
