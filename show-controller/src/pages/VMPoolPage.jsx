import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ServerIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClipboardIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CogIcon,
} from '@heroicons/react/24/solid';

// VM Status constants matching server-side
const VM_STATUS = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  IN_USE: 'in_use',
  STOPPED: 'stopped',
  STARTING: 'starting',
  STOPPING: 'stopping',
  ERROR: 'error',
};

// Status badge colors
const STATUS_COLORS = {
  [VM_STATUS.AVAILABLE]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [VM_STATUS.ASSIGNED]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  [VM_STATUS.IN_USE]: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  [VM_STATUS.STOPPED]: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  [VM_STATUS.STARTING]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  [VM_STATUS.STOPPING]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  [VM_STATUS.ERROR]: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Server URL - this page is standalone (not competition-bound)
const SERVER_URL = import.meta.env.VITE_LOCAL_SERVER || 'http://localhost:3003';

export default function VMPoolPage() {
  const [vms, setVMs] = useState([]);
  const [poolConfig, setPoolConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  // Fetch VM pool status
  const fetchPoolStatus = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setVMs(data.vms || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Fetch pool configuration
  const fetchPoolConfig = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool/config`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setPoolConfig(data);
    } catch (err) {
      console.error('Failed to fetch pool config:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchPoolStatus(), fetchPoolConfig()]);
      setLoading(false);
    }
    loadData();
  }, [fetchPoolStatus, fetchPoolConfig]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPoolStatus(), fetchPoolConfig()]);
    setRefreshing(false);
  };

  // Start a VM
  const handleStartVM = async (vmId) => {
    setActionLoading(prev => ({ ...prev, [vmId]: 'starting' }));
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool/${vmId}/start`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start VM');
      }
      await fetchPoolStatus();
    } catch (err) {
      console.error('Failed to start VM:', err);
      alert(`Failed to start VM: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [vmId]: null }));
    }
  };

  // Stop a VM
  const handleStopVM = async (vmId) => {
    setActionLoading(prev => ({ ...prev, [vmId]: 'stopping' }));
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool/${vmId}/stop`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to stop VM');
      }
      await fetchPoolStatus();
    } catch (err) {
      console.error('Failed to stop VM:', err);
      alert(`Failed to stop VM: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [vmId]: null }));
    }
  };

  // Copy SSH command to clipboard
  const copySSHCommand = (publicIp) => {
    const sshCommand = `ssh -i ~/.ssh/gymnastics-graphics-key-pair.pem ubuntu@${publicIp}`;
    navigator.clipboard.writeText(sshCommand);
  };

  // Calculate pool statistics
  const poolStats = useMemo(() => {
    const stats = {
      total: vms.length,
      available: 0,
      assigned: 0,
      inUse: 0,
      stopped: 0,
      starting: 0,
      error: 0,
    };

    for (const vm of vms) {
      switch (vm.status) {
        case VM_STATUS.AVAILABLE:
          stats.available++;
          break;
        case VM_STATUS.ASSIGNED:
          stats.assigned++;
          break;
        case VM_STATUS.IN_USE:
          stats.inUse++;
          break;
        case VM_STATUS.STOPPED:
          stats.stopped++;
          break;
        case VM_STATUS.STARTING:
        case VM_STATUS.STOPPING:
          stats.starting++;
          break;
        case VM_STATUS.ERROR:
          stats.error++;
          break;
      }
    }

    return stats;
  }, [vms]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 flex items-center gap-2">
          <ArrowPathIcon className="w-5 h-5 animate-spin" />
          Loading VM pool...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/select"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <ServerIcon className="w-5 h-5 text-purple-400" />
                VM Pool Management
              </h1>
              <div className="text-sm text-zinc-500">
                Manage EC2 instances for live production
              </div>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <div className="text-red-400 font-medium">Connection Error</div>
              <div className="text-sm text-red-400/70">{error}</div>
            </div>
          </div>
        )}

        {/* Pool Status Bar */}
        <PoolStatusBar stats={poolStats} />

        {/* Pool Configuration Panel (Collapsible) */}
        <div className="mb-6 bg-zinc-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setConfigExpanded(!configExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CogIcon className="w-5 h-5 text-zinc-400" />
              <span className="text-white font-medium">Pool Configuration</span>
            </div>
            {configExpanded ? (
              <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
            )}
          </button>

          {configExpanded && poolConfig && (
            <div className="px-4 pb-4 border-t border-zinc-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-zinc-700/30 rounded-lg p-3">
                  <div className="text-xs text-zinc-400 mb-1">Region</div>
                  <div className="text-white font-mono text-sm">{poolConfig.region || 'us-east-1'}</div>
                </div>
                <div className="bg-zinc-700/30 rounded-lg p-3">
                  <div className="text-xs text-zinc-400 mb-1">Min Warm VMs</div>
                  <div className="text-white font-mono text-sm">{poolConfig.minWarmVMs || 2}</div>
                </div>
                <div className="bg-zinc-700/30 rounded-lg p-3">
                  <div className="text-xs text-zinc-400 mb-1">Max VMs</div>
                  <div className="text-white font-mono text-sm">{poolConfig.maxVMs || 5}</div>
                </div>
                <div className="bg-zinc-700/30 rounded-lg p-3">
                  <div className="text-xs text-zinc-400 mb-1">Instance Type</div>
                  <div className="text-white font-mono text-sm">{poolConfig.instanceType || 't3.large'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* VM Cards Grid */}
        {vms.length === 0 ? (
          <div className="bg-zinc-800 rounded-xl p-8 text-center">
            <ServerIcon className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-white mb-2">No VMs in Pool</h2>
            <p className="text-zinc-400 mb-4">
              No EC2 instances found. The pool may not be initialized or AWS credentials may not be configured.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vms.map((vm) => (
              <VMCard
                key={vm.vmId}
                vm={vm}
                onStart={handleStartVM}
                onStop={handleStopVM}
                onCopySSH={copySSHCommand}
                actionLoading={actionLoading[vm.vmId]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Pool Status Bar - shows counts by status
 */
function PoolStatusBar({ stats }) {
  const utilizationPercent = stats.total > 0
    ? Math.round(((stats.assigned + stats.inUse) / stats.total) * 100)
    : 0;

  const isLowPool = stats.available === 0 && stats.stopped === 0;

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
        </div>
        <div className="text-sm text-zinc-400">
          {stats.total} total VM{stats.total !== 1 ? 's' : ''}
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
 * VM Card - displays individual VM details and actions
 */
function VMCard({ vm, onStart, onStop, onCopySSH, actionLoading }) {
  const statusColor = STATUS_COLORS[vm.status] || STATUS_COLORS[VM_STATUS.ERROR];
  const canStart = vm.status === VM_STATUS.STOPPED;
  const canStop = [VM_STATUS.AVAILABLE, VM_STATUS.ASSIGNED, VM_STATUS.ERROR].includes(vm.status);
  const hasPublicIP = !!vm.publicIp;

  // Service health indicators
  const services = vm.services || {};

  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <ServerIcon className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="text-white font-medium">{vm.name || vm.vmId}</div>
            <div className="text-xs text-zinc-500 font-mono">{vm.instanceId || vm.vmId}</div>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColor}`}>
          {vm.status}
        </span>
      </div>

      {/* Public IP */}
      {hasPublicIP && (
        <div className="mb-3 p-2 bg-zinc-700/30 rounded-lg">
          <div className="text-xs text-zinc-400 mb-1">Public IP</div>
          <div className="text-white font-mono text-sm">{vm.publicIp}</div>
        </div>
      )}

      {/* Assigned Competition */}
      {vm.assignedTo && (
        <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="text-xs text-blue-400 mb-1">Assigned To</div>
          <Link
            to={`/${vm.assignedTo}/producer`}
            className="text-white font-medium hover:text-blue-400 transition-colors"
          >
            {vm.assignedTo}
          </Link>
        </div>
      )}

      {/* Service Health Dots */}
      <div className="mb-3">
        <div className="text-xs text-zinc-400 mb-2">Services</div>
        <div className="flex items-center gap-3">
          <ServiceDot label="Node" healthy={services.node} />
          <ServiceDot label="OBS" healthy={services.obs} />
          <ServiceDot label="NoMachine" healthy={services.nomachine} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {canStart && (
          <button
            onClick={() => onStart(vm.vmId)}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {actionLoading === 'starting' ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            Start
          </button>
        )}

        {canStop && (
          <button
            onClick={() => onStop(vm.vmId)}
            disabled={!!actionLoading}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {actionLoading === 'stopping' ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <StopIcon className="w-4 h-4" />
            )}
            Stop
          </button>
        )}

        {hasPublicIP && (
          <button
            onClick={() => onCopySSH(vm.publicIp)}
            className="p-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
            title="Copy SSH command"
          >
            <ClipboardIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Last Health Check */}
      {vm.lastHealthCheck && (
        <div className="mt-3 text-xs text-zinc-500 text-right">
          Last checked: {new Date(vm.lastHealthCheck).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/**
 * Service health indicator dot
 */
function ServiceDot({ label, healthy }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className={`w-2 h-2 rounded-full ${
          healthy === true ? 'bg-green-400' :
          healthy === false ? 'bg-red-400' : 'bg-zinc-500'
        }`}
      />
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}
