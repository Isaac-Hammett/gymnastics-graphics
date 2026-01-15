import { useState } from 'react';
import { PlayIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { useCoordinator, COORDINATOR_STATUS } from '../hooks/useCoordinator';

/**
 * Formats seconds into a human-readable string
 */
function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return null;

  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

/**
 * CoordinatorStatus - Shows coordinator EC2 instance status with wake functionality
 *
 * Displays a status badge indicating whether the coordinator is:
 * - Online (green) - EC2 running and app responding
 * - Starting (yellow) - EC2 starting up or app initializing
 * - Offline (red) - EC2 stopped
 *
 * When offline, shows a "Start System" button.
 * When online, shows uptime and idle time on hover.
 */
export default function CoordinatorStatus() {
  const {
    status,
    appReady,
    isWaking,
    error,
    details,
    wake,
    checkStatus,
    estimatedTimeRemaining,
  } = useCoordinator();

  const [showTooltip, setShowTooltip] = useState(false);

  // Determine status colors
  const getStatusConfig = () => {
    switch (status) {
      case COORDINATOR_STATUS.ONLINE:
        return {
          dotColor: 'bg-green-500',
          bgColor: 'bg-green-500/10',
          textColor: 'text-green-400',
          label: 'Online',
        };
      case COORDINATOR_STATUS.STARTING:
        return {
          dotColor: 'bg-yellow-500 animate-pulse',
          bgColor: 'bg-yellow-500/10',
          textColor: 'text-yellow-400',
          label: 'Starting',
        };
      case COORDINATOR_STATUS.OFFLINE:
        return {
          dotColor: 'bg-red-500',
          bgColor: 'bg-red-500/10',
          textColor: 'text-red-400',
          label: 'Offline',
        };
      default:
        return {
          dotColor: 'bg-zinc-500',
          bgColor: 'bg-zinc-500/10',
          textColor: 'text-zinc-400',
          label: 'Unknown',
        };
    }
  };

  const statusConfig = getStatusConfig();

  const handleWake = async () => {
    await wake();
  };

  const handleRefresh = async () => {
    await checkStatus();
  };

  return (
    <div className="relative inline-flex items-center gap-2">
      {/* Status Badge */}
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${statusConfig.bgColor}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
        <span className={`text-sm font-medium ${statusConfig.textColor}`}>
          {statusConfig.label}
        </span>

        {/* Progress indicator when starting */}
        {status === COORDINATOR_STATUS.STARTING && estimatedTimeRemaining !== null && (
          <span className="text-xs text-yellow-400/70">
            ~{estimatedTimeRemaining}s
          </span>
        )}
      </div>

      {/* Tooltip with details when online */}
      {showTooltip && status === COORDINATOR_STATUS.ONLINE && details && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl min-w-[180px]">
          <div className="text-xs space-y-1.5">
            {details.uptime != null && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Uptime:</span>
                <span className="text-white font-medium">{formatUptime(details.uptime)}</span>
              </div>
            )}
            {details.idleMinutes != null && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Idle:</span>
                <span className="text-white font-medium">{details.idleMinutes}m</span>
              </div>
            )}
            {details.publicIp && (
              <div className="flex justify-between">
                <span className="text-zinc-400">IP:</span>
                <span className="text-zinc-300 font-mono text-[10px]">{details.publicIp}</span>
              </div>
            )}
            {details.firebase && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Firebase:</span>
                <span className={`font-medium ${details.firebase === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                  {details.firebase}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start System button when offline */}
      {status === COORDINATOR_STATUS.OFFLINE && !isWaking && (
        <button
          onClick={handleWake}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 text-sm font-medium rounded-lg hover:bg-green-500/30 transition-colors"
        >
          <PlayIcon className="w-4 h-4" />
          Start System
        </button>
      )}

      {/* Starting indicator */}
      {isWaking && (
        <div className="flex items-center gap-2 text-sm text-yellow-400">
          <ArrowPathIcon className="w-4 h-4 animate-spin" />
          <span>Starting...</span>
        </div>
      )}

      {/* Refresh button (when not waking) */}
      {!isWaking && status !== COORDINATOR_STATUS.STARTING && (
        <button
          onClick={handleRefresh}
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
          title="Refresh status"
        >
          <ArrowPathIcon className="w-4 h-4" />
        </button>
      )}

      {/* Error display */}
      {error && (
        <span className="text-xs text-red-400" title={error}>
          Error
        </span>
      )}
    </div>
  );
}
