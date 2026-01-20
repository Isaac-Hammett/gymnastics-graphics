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
  LinkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';
import VMCard, { VM_STATUS } from '../components/VMCard';
import PoolStatusBar from '../components/PoolStatusBar';
import CoordinatorStatus from '../components/CoordinatorStatus';
import SystemOfflinePage from './SystemOfflinePage';
import { useCoordinator, COORDINATOR_STATUS } from '../hooks/useCoordinator';
import { useCompetitions } from '../hooks/useCompetitions';
import { useVMPool } from '../hooks/useVMPool';
import { SERVER_URL } from '../lib/serverUrl';

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
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [selectedInstanceType, setSelectedInstanceType] = useState('t3.large');

  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedVMForAssign, setSelectedVMForAssign] = useState(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Get competitions for assignment
  const { competitions } = useCompetitions();
  const { assignVM, releaseVM, getVMForCompetition } = useVMPool();

  // Available instance types for the dropdown
  const INSTANCE_TYPES = [
    { value: 't3.large', label: 't3.large', description: '2 vCPU, 8 GB RAM - Standard workloads', cost: '$' },
    { value: 't3.xlarge', label: 't3.xlarge', description: '4 vCPU, 16 GB RAM - Medium workloads', cost: '$$' },
    { value: 'c5.xlarge', label: 'c5.xlarge', description: '4 vCPU, 8 GB RAM - Compute optimized', cost: '$$' },
    { value: 'c5.2xlarge', label: 'c5.2xlarge', description: '8 vCPU, 16 GB RAM - High performance', cost: '$$$' },
    { value: 'c5.4xlarge', label: 'c5.4xlarge', description: '16 vCPU, 32 GB RAM - Maximum performance', cost: '$$$$' },
  ];

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

  // Open launch modal
  const handleOpenLaunchModal = () => {
    setSelectedInstanceType('t3.large');
    setShowLaunchModal(true);
  };

  // Launch a new VM from AMI
  const handleLaunchVM = async () => {
    setShowLaunchModal(false);
    setLaunchingVM(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/vm-pool/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceType: selectedInstanceType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to launch VM');
      }
      const data = await res.json();
      alert(`VM launched successfully!\n\nInstance ID: ${data.instance?.instanceId || 'unknown'}\nType: ${selectedInstanceType}`);
      await fetchPoolStatus();
    } catch (err) {
      console.error('Failed to launch VM:', err);
      alert(`Failed to launch VM: ${err.message}`);
    } finally {
      setLaunchingVM(false);
    }
  };

  // Open assign modal for a specific VM
  const handleOpenAssignModal = (vm) => {
    setSelectedVMForAssign(vm);
    setAssignSearch('');
    setShowAssignModal(true);
  };

  // Assign VM to a competition
  const handleAssignVM = async (competitionId) => {
    if (!selectedVMForAssign) return;

    setAssigning(true);
    try {
      const result = await assignVM(competitionId, selectedVMForAssign.vmId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to assign VM');
      }
      setShowAssignModal(false);
      setSelectedVMForAssign(null);
      await fetchPoolStatus();
    } catch (err) {
      console.error('Failed to assign VM:', err);
      alert(`Failed to assign VM: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  // Release VM from competition
  const handleReleaseVM = async (vmId) => {
    const vm = vms.find(v => v.vmId === vmId);
    if (!vm?.assignedTo) return;

    setActionLoading(prev => ({ ...prev, [vmId]: 'releasing' }));
    try {
      const result = await releaseVM(vm.assignedTo);
      if (!result.success) {
        throw new Error(result.error || 'Failed to release VM');
      }
      await fetchPoolStatus();
    } catch (err) {
      console.error('Failed to release VM:', err);
      alert(`Failed to release VM: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [vmId]: null }));
    }
  };

  // Get competitions available for assignment (not already assigned to a VM)
  const availableCompetitions = useMemo(() => {
    const compList = Object.entries(competitions).map(([id, data]) => ({
      id,
      name: data.config?.eventName || id,
      date: data.config?.meetDate,
      gender: data.config?.gender,
      team1: data.config?.team1Name,
      team2: data.config?.team2Name,
      vmAddress: data.config?.vmAddress,
    }));

    // Filter out competitions that already have a VM assigned
    return compList.filter(comp => {
      const assignedVM = getVMForCompetition(comp.id);
      return !assignedVM;
    });
  }, [competitions, getVMForCompetition]);

  // Filter competitions by search
  const filteredCompetitions = useMemo(() => {
    if (!assignSearch.trim()) return availableCompetitions;

    const search = assignSearch.toLowerCase();
    return availableCompetitions.filter(comp =>
      comp.name.toLowerCase().includes(search) ||
      comp.id.toLowerCase().includes(search) ||
      comp.team1?.toLowerCase().includes(search) ||
      comp.team2?.toLowerCase().includes(search)
    );
  }, [availableCompetitions, assignSearch]);

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
              onClick={handleOpenLaunchModal}
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
                  <div className="text-white font-mono text-sm">{poolConfig.warmCount || 2}</div>
                </div>
                <div className="bg-zinc-700/30 rounded-lg p-3">
                  <div className="text-xs text-zinc-400 mb-1">Max VMs</div>
                  <div className="text-white font-mono text-sm">{poolConfig.maxInstances || 5}</div>
                </div>
                <div className="bg-zinc-700/30 rounded-lg p-3">
                  <div className="text-xs text-zinc-400 mb-1">Instance Type</div>
                  <div className="text-white font-mono text-sm">{poolConfig.defaultInstanceType || 't3.large'}</div>
                </div>
              </div>
              {/* AMI Info */}
              <div className="mt-4 bg-zinc-700/30 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-2">AMI Template</div>
                <div className="flex items-center justify-between">
                  <div className="text-white font-mono text-sm">{poolConfig.amiId || 'Not configured'}</div>
                  <div className="text-xs text-zinc-500">
                    VMs auto-update from <span className="text-purple-400">main</span> branch on boot
                  </div>
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
                onAssign={() => handleOpenAssignModal(vm)}
                onRelease={handleReleaseVM}
                actionLoading={actionLoading[vm.vmId]}
                showAssignControls={true}
                hasAvailableCompetitions={availableCompetitions.length > 0}
              />
            ))}
          </div>
        )}
      </main>

      {/* Launch VM Modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 border border-zinc-700">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-purple-400" />
              Launch New VM
            </h2>

            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">Instance Type</label>
              <div className="space-y-2">
                {INSTANCE_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${
                      selectedInstanceType === type.value
                        ? 'bg-purple-600/20 border-purple-500'
                        : 'bg-zinc-700/30 border-zinc-600 hover:border-zinc-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="instanceType"
                      value={type.value}
                      checked={selectedInstanceType === type.value}
                      onChange={(e) => setSelectedInstanceType(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">{type.label}</span>
                        <span className="text-yellow-400 text-xs">{type.cost}</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">{type.description}</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedInstanceType === type.value
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-zinc-500'
                    }`}>
                      {selectedInstanceType === type.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-zinc-700/30 rounded-lg p-3 mb-4">
              <div className="text-xs text-zinc-400">
                This will launch a new EC2 instance from the gymnastics-vm template.
                The VM will be available in 2-3 minutes.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLaunchModal(false)}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLaunchVM}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition-colors"
              >
                Launch VM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign VM Modal */}
      {showAssignModal && selectedVMForAssign && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4 border border-zinc-700 max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-blue-400" />
              Assign VM to Competition
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              Assigning <span className="text-white font-mono">{selectedVMForAssign.name || selectedVMForAssign.vmId}</span>
              {selectedVMForAssign.publicIp && (
                <span className="text-zinc-500"> ({selectedVMForAssign.publicIp})</span>
              )}
            </p>

            {/* Search */}
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search competitions..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Competition List */}
            <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
              {filteredCompetitions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-zinc-500 text-sm">
                    {availableCompetitions.length === 0
                      ? 'All competitions already have a VM assigned'
                      : 'No competitions match your search'}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCompetitions.map((comp) => (
                    <button
                      key={comp.id}
                      onClick={() => handleAssignVM(comp.id)}
                      disabled={assigning}
                      className="w-full p-3 bg-zinc-700/30 hover:bg-zinc-700/50 border border-zinc-600 hover:border-blue-500/50 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{comp.name}</div>
                          <div className="text-xs text-zinc-400 mt-1 flex items-center gap-2">
                            {comp.gender && (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                comp.gender === 'womens'
                                  ? 'bg-pink-500/20 text-pink-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {comp.gender === 'womens' ? 'WAG' : 'MAG'}
                              </span>
                            )}
                            {comp.date && (
                              <span>{new Date(comp.date).toLocaleDateString()}</span>
                            )}
                          </div>
                          {(comp.team1 || comp.team2) && (
                            <div className="text-xs text-zinc-500 mt-1 truncate">
                              {[comp.team1, comp.team2].filter(Boolean).join(' vs ')}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono shrink-0">
                          {comp.id.length > 20 ? comp.id.substring(0, 20) + '...' : comp.id}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-700">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedVMForAssign(null);
                }}
                disabled={assigning}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            {/* Assigning overlay */}
            {assigning && (
              <div className="absolute inset-0 bg-zinc-800/80 rounded-xl flex items-center justify-center">
                <div className="flex items-center gap-2 text-white">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  <span>Assigning VM...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
