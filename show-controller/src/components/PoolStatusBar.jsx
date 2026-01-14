import { ExclamationTriangleIcon, PlayIcon } from '@heroicons/react/24/solid';

/**
 * Status count badge for the pool status bar
 */
function StatusCount({ label, count, color }) {
  const colorClasses = {
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    zinc: 'bg-zinc-500/10 text-zinc-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    red: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className={`rounded-lg p-2 text-center ${colorClasses[color]}`}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

/**
 * Pool Status Bar - shows counts by status with utilization bar
 *
 * @param {Object} props
 * @param {Object} props.stats - Pool statistics object
 * @param {number} props.stats.total - Total VMs in pool
 * @param {number} props.stats.available - Available VMs count
 * @param {number} props.stats.assigned - Assigned VMs count
 * @param {number} props.stats.inUse - In use VMs count
 * @param {number} props.stats.stopped - Stopped VMs count
 * @param {number} props.stats.starting - Starting/stopping VMs count
 * @param {number} props.stats.error - Error VMs count
 * @param {Function} props.onStartColdVM - Callback to start a cold VM (optional)
 * @param {boolean} props.startingColdVM - Whether a cold VM is currently starting (optional)
 */
export default function PoolStatusBar({ stats, onStartColdVM, startingColdVM }) {
  const utilizationPercent = stats.total > 0
    ? Math.round(((stats.assigned + stats.inUse) / stats.total) * 100)
    : 0;

  const isLowPool = stats.available === 0 && stats.stopped === 0;
  const hasColdVMs = stats.stopped > 0;

  return (
    <div className="mb-6 bg-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-white font-medium">Pool Status</div>
          {isLowPool && (
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
              <ExclamationTriangleIcon className="w-3 h-3" />
              Pool exhausted
            </div>
          )}
          {!isLowPool && stats.available === 0 && hasColdVMs && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
              <ExclamationTriangleIcon className="w-3 h-3" />
              No warm VMs
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-400">
            {stats.total} total VM{stats.total !== 1 ? 's' : ''}
          </div>
          {/* Start Cold VM Quick Action */}
          {hasColdVMs && onStartColdVM && (
            <button
              onClick={onStartColdVM}
              disabled={startingColdVM}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayIcon className={`w-3.5 h-3.5 ${startingColdVM ? 'animate-pulse' : ''}`} />
              {startingColdVM ? 'Starting...' : `Start Cold VM (${stats.stopped})`}
            </button>
          )}
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>Utilization</span>
          <span>{utilizationPercent}%</span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              utilizationPercent > 80 ? 'bg-red-500' :
              utilizationPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${utilizationPercent}%` }}
          />
        </div>
      </div>

      {/* Status Counts */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <StatusCount label="Available" count={stats.available} color="green" />
        <StatusCount label="Assigned" count={stats.assigned} color="blue" />
        <StatusCount label="In Use" count={stats.inUse} color="purple" />
        <StatusCount label="Stopped" count={stats.stopped} color="zinc" />
        <StatusCount label="Starting" count={stats.starting} color="yellow" />
        <StatusCount label="Error" count={stats.error} color="red" />
      </div>
    </div>
  );
}

export { StatusCount };
