import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ServerIcon,
  ArrowPathIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CogIcon,
  PlusIcon,
  StopIcon,
} from '@heroicons/react/24/solid';
import VMCard, { VM_STATUS } from '../components/VMCard';
import PoolStatusBar from '../components/PoolStatusBar';
import CoordinatorStatus from '../components/CoordinatorStatus';
import SystemOfflinePage from './SystemOfflinePage';
import { useCoordinator, COORDINATOR_STATUS } from '../hooks/useCoordinator';

// Server URL - use VITE_API_URL for production coordinator, fallback to localhost for local dev
const SERVER_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_LOCAL_SERVER || 'http://localhost:3003';

export default function VMPoolPage() {
  console.log('[VMPoolPage] Component rendering');
  const [vms, setVMs] = useState([]);
  const [poolConfig, setPoolConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [startingColdVM, setStartingColdVM] = useState(false);
  const [launchingVM, setLaunchingVM] = useState(false);

  // Coordinator status
  const {
    status: coordinatorStatus,
    isWaking,
    isStopping,
    isAvailable: coordinatorAvailable,
    stop: stopCoordinator,
  } = useCoordinator();

  // Track previous coordinator availability to auto-fetch on reconnect
  const [prevCoordinatorAvailable, setPrevCoordinatorAvailable] = useState(false);

  // Fetch VM pool status
  const fetchPoolStatus = useCallback(async () => {
    console.log('[VMPoolPage] Fetching pool status from:', `${SERVER_URL}/api/admin/vm-pool`);
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool`);
      console.log('[VMPoolPage] Response status:', res.status);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      console.log('[VMPoolPage] Pool data:', data);
      setVMs(data.vms || []);
      setError(null);
    } catch (err) {
      console.error('[VMPoolPage] Fetch error:', err);
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

  // Initial load - only when coordinator is available
  useEffect(() => {
    async function loadData() {
      if (!coordinatorAvailable) {
        setLoading(false);
        return;
      }
      setLoading(true);
      await Promise.all([fetchPoolStatus(), fetchPoolConfig()]);
      setLoading(false);
    }
    loadData();
  }, [fetchPoolStatus, fetchPoolConfig, coordinatorAvailable]);

  // Auto-fetch when coordinator comes online
  useEffect(() => {
    if (coordinatorAvailable && !prevCoordinatorAvailable) {
      console.log('[VMPoolPage] Coordinator became available, fetching VM pool data');
      fetchPoolStatus();
      fetchPoolConfig();
    }
    setPrevCoordinatorAvailable(coordinatorAvailable);
  }, [coordinatorAvailable, prevCoordinatorAvailable, fetchPoolStatus, fetchPoolConfig]);

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

  // Launch a new VM from AMI
  const handleLaunchVM = async () => {
    if (!confirm('Launch a new EC2 instance? This will incur AWS charges.')) {
      return;
    }

    setLaunchingVM(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to launch VM');
      }
      const data = await res.json();
      alert(`VM launched successfully! Instance ID: ${data.instance?.instanceId || 'unknown'}`);
      await fetchPoolStatus();
    } catch (err) {
      console.error('Failed to launch VM:', err);
      alert(`Failed to launch VM: ${err.message}`);
    } finally {
      setLaunchingVM(false);
    }
  };

  // Start a cold VM (first stopped VM found)
  const handleStartColdVM = async () => {
    const stoppedVM = vms.find(vm => vm.status === VM_STATUS.STOPPED);
    if (!stoppedVM) {
      alert('No stopped VMs available to start');
      return;
    }

    setStartingColdVM(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool/${stoppedVM.vmId}/start`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start VM');
      }
      await fetchPoolStatus();
    } catch (err) {
      console.error('Failed to start cold VM:', err);
      alert(`Failed to start cold VM: ${err.message}`);
    } finally {
      setStartingColdVM(false);
    }
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

  // Handle stop system
  const handleStopSystem = async () => {
    if (!confirm('Stop the coordinator system? You will need to wake it up again to use VM pool features.')) {
      return;
    }
    await stopCoordinator();
  };

  // If coordinator is offline, show SystemOfflinePage instead
  if (coordinatorStatus === COORDINATOR_STATUS.OFFLINE && !isWaking) {
    return <SystemOfflinePage redirectTo="/_admin/vm-pool" />;
  }

  // If coordinator is stopping, show progress
  if (coordinatorStatus === COORDINATOR_STATUS.STOPPING || isStopping) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-10 h-10 text-orange-400 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">System Shutting Down...</h2>
          <p className="text-zinc-400 text-sm">
            The coordinator is stopping. This usually takes 30-60 seconds.
          </p>
        </div>
      </div>
    );
  }

  // If coordinator is starting, show progress overlay
  if (coordinatorStatus === COORDINATOR_STATUS.STARTING || isWaking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-10 h-10 text-yellow-400 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">System Starting Up...</h2>
          <p className="text-zinc-400 text-sm">
            The coordinator is starting. This usually takes 60-90 seconds.
          </p>
          <p className="text-zinc-500 text-xs mt-3">
            VM pool will load automatically when ready.
          </p>
        </div>
      </div>
    );
  }

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
              to="/"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Home
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

          <div className="flex items-center gap-3">
            {/* Coordinator Status */}
            <CoordinatorStatus />

            <div className="w-px h-6 bg-zinc-700" />

            <button
              onClick={handleLaunchVM}
              disabled={launchingVM}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-xs transition-colors disabled:opacity-50"
            >
              {launchingVM ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <PlusIcon className="w-4 h-4" />
              )}
              {launchingVM ? 'Launching...' : 'Launch VM'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <div className="w-px h-6 bg-zinc-700" />

            <button
              onClick={handleStopSystem}
              disabled={isStopping}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 border border-red-600/30 hover:bg-red-600/30 rounded-lg text-red-400 text-xs transition-colors disabled:opacity-50"
              title="Stop the coordinator to save costs"
            >
              {isStopping ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <StopIcon className="w-4 h-4" />
              )}
              {isStopping ? 'Stopping...' : 'Stop System'}
            </button>
          </div>
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
        <PoolStatusBar
          stats={poolStats}
          onStartColdVM={handleStartColdVM}
          startingColdVM={startingColdVM}
        />

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
            <button
              onClick={handleLaunchVM}
              disabled={launchingVM}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {launchingVM ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <PlusIcon className="w-4 h-4" />
              )}
              {launchingVM ? 'Launching...' : 'Launch New VM'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vms.map((vm) => (
              <VMCard
                key={vm.vmId}
                vm={vm}
                onStart={handleStartVM}
                onStop={handleStopVM}
                actionLoading={actionLoading[vm.vmId]}
                showAssignControls={false}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
