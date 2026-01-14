import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCompetitions } from '../hooks/useCompetitions';
import { useVMPool, VM_STATUS } from '../hooks/useVMPool';

/**
 * CompetitionSelector - Landing page for selecting a competition to control.
 *
 * URL: /select
 *
 * Features:
 * - Lists all competitions from Firebase grouped by date
 * - Shows VM status for each competition
 * - Quick-connect buttons (Producer, Talent, Graphics)
 * - Search/filter by name
 * - Local Development mode option
 * - Handles ?redirect= query param for auto-navigation
 */
export default function CompetitionSelector() {
  const { competitions, loading, error } = useCompetitions();
  const {
    vms,
    availableVMs,
    assignVM,
    releaseVM,
    getVMForCompetition,
    hasVMAssigned,
    loading: vmPoolLoading,
  } = useVMPool();
  const [searchQuery, setSearchQuery] = useState('');
  const [vmStatuses, setVmStatuses] = useState({});
  const [assigningVm, setAssigningVm] = useState(null); // compId being assigned
  const [releasingVm, setReleasingVm] = useState(null); // compId being released
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirectPath = searchParams.get('redirect');

  // Group competitions by date
  const groupedCompetitions = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const groups = {
      today: [],
      tomorrow: [],
      upcoming: [],
      past: []
    };

    Object.entries(competitions).forEach(([compId, data]) => {
      const config = data?.config;
      if (!config) return;

      // Filter by search query
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        config.eventName?.toLowerCase().includes(searchLower) ||
        config.venue?.toLowerCase().includes(searchLower) ||
        config.team1Name?.toLowerCase().includes(searchLower) ||
        config.team2Name?.toLowerCase().includes(searchLower) ||
        compId.toLowerCase().includes(searchLower);

      if (!matchesSearch) return;

      const meetDate = config.meetDate ? new Date(config.meetDate) : null;
      const competition = { compId, config, meetDate };

      if (!meetDate) {
        groups.upcoming.push(competition);
      } else if (meetDate >= today && meetDate < tomorrow) {
        groups.today.push(competition);
      } else if (meetDate >= tomorrow && meetDate < new Date(tomorrow.getTime() + 86400000)) {
        groups.tomorrow.push(competition);
      } else if (meetDate >= today) {
        groups.upcoming.push(competition);
      } else {
        groups.past.push(competition);
      }
    });

    // Sort each group by date
    const sortByDate = (a, b) => {
      if (!a.meetDate && !b.meetDate) return 0;
      if (!a.meetDate) return 1;
      if (!b.meetDate) return -1;
      return a.meetDate - b.meetDate;
    };

    groups.today.sort(sortByDate);
    groups.tomorrow.sort(sortByDate);
    groups.upcoming.sort(sortByDate);
    groups.past.sort((a, b) => sortByDate(b, a)); // Reverse for past (most recent first)

    return groups;
  }, [competitions, searchQuery]);

  // Check VM status for each competition
  useEffect(() => {
    const checkVmStatus = async (compId, vmAddress) => {
      if (!vmAddress) {
        setVmStatuses(prev => ({ ...prev, [compId]: { online: false, noVm: true } }));
        return;
      }

      // Normalize vmAddress to URL
      const url = vmAddress.startsWith('http') ? vmAddress : `http://${vmAddress}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${url}/api/status`, {
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          setVmStatuses(prev => ({
            ...prev,
            [compId]: { online: true, obsConnected: data.obsConnected || false }
          }));
        } else {
          setVmStatuses(prev => ({ ...prev, [compId]: { online: false } }));
        }
      } catch {
        setVmStatuses(prev => ({ ...prev, [compId]: { online: false } }));
      }
    };

    // Check status for all competitions with vmAddress
    Object.entries(competitions).forEach(([compId, data]) => {
      const vmAddress = data?.config?.vmAddress;
      checkVmStatus(compId, vmAddress);
    });
  }, [competitions]);

  // Handle redirect query param
  const handleCompetitionClick = (compId, defaultPath = '/producer') => {
    const targetPath = redirectPath || defaultPath;
    navigate(`/${compId}${targetPath}`);
  };

  const getGenderBadge = (config) => {
    const gender = config?.gender || (config?.compType?.includes('womens') ? 'womens' : 'mens');
    const isWomens = gender === 'womens' || gender === 'WAG';
    return {
      label: isWomens ? 'WAG' : 'MAG',
      color: isWomens ? 'bg-pink-500' : 'bg-blue-500'
    };
  };

  const getTeams = (config) => {
    return [
      config?.team1Name,
      config?.team2Name,
      config?.team3Name,
      config?.team4Name,
      config?.team5Name,
      config?.team6Name
    ].filter(Boolean);
  };

  const formatDate = (date) => {
    if (!date) return 'No date set';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle assigning a VM to a competition
  const handleAssignVM = async (compId) => {
    setAssigningVm(compId);
    const result = await assignVM(compId);
    setAssigningVm(null);
    if (!result.success) {
      console.error('Failed to assign VM:', result.error);
    }
  };

  // Handle releasing a VM from a competition
  const handleReleaseVM = async (compId) => {
    setReleasingVm(compId);
    const result = await releaseVM(compId);
    setReleasingVm(null);
    if (!result.success) {
      console.error('Failed to release VM:', result.error);
    }
  };

  // Get VM status badge for a competition
  const getVMStatusBadge = (compId) => {
    const vm = getVMForCompetition(compId);
    if (!vm) return null;

    const statusConfig = {
      [VM_STATUS.AVAILABLE]: { color: 'bg-green-500', label: 'VM Ready' },
      [VM_STATUS.ASSIGNED]: { color: 'bg-blue-500', label: 'VM Assigned' },
      [VM_STATUS.IN_USE]: { color: 'bg-purple-500', label: 'VM In Use' },
      [VM_STATUS.STARTING]: { color: 'bg-yellow-500', label: 'VM Starting' },
      [VM_STATUS.STOPPING]: { color: 'bg-orange-500', label: 'VM Stopping' },
      [VM_STATUS.ERROR]: { color: 'bg-red-500', label: 'VM Error' },
    };

    const config = statusConfig[vm.status] || { color: 'bg-zinc-500', label: vm.status };
    return { ...config, vm };
  };

  const VmStatusIndicator = ({ compId }) => {
    const status = vmStatuses[compId];
    if (!status) {
      return <div className="w-3 h-3 rounded-full bg-zinc-600 animate-pulse" title="Checking..." />;
    }
    if (status.noVm) {
      return <div className="w-3 h-3 rounded-full bg-zinc-600" title="No VM configured" />;
    }
    if (status.online) {
      return (
        <div
          className={`w-3 h-3 rounded-full ${status.obsConnected ? 'bg-green-500' : 'bg-yellow-500'}`}
          title={status.obsConnected ? 'Online (OBS connected)' : 'Online (OBS disconnected)'}
        />
      );
    }
    return <div className="w-3 h-3 rounded-full bg-red-500" title="Offline" />;
  };

  const CompetitionCard = ({ compId, config }) => {
    const genderBadge = getGenderBadge(config);
    const teams = getTeams(config);
    const meetDate = config?.meetDate ? new Date(config.meetDate) : null;
    const vmBadge = getVMStatusBadge(compId);
    const hasVM = hasVMAssigned(compId);
    const isAssigning = assigningVm === compId;
    const isReleasing = releasingVm === compId;
    const canAssignVM = availableVMs.length > 0 && !hasVM;

    return (
      <div className="bg-zinc-900 border-2 border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <VmStatusIndicator compId={compId} />
            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${genderBadge.color}`}>
              {genderBadge.label}
            </span>
            {vmBadge && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold text-white ${vmBadge.color} cursor-help`}
                title={vmBadge.vm.publicIp ? `IP: ${vmBadge.vm.publicIp}` : 'No IP assigned'}
              >
                {vmBadge.label}
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500">{compId}</span>
        </div>

        <h3 className="text-lg font-bold text-white mb-1">
          {config?.eventName || 'Untitled Competition'}
        </h3>

        <div className="text-sm text-zinc-400 mb-2">
          {formatDate(meetDate)}
          {config?.venue && <span className="text-zinc-500"> • {config.venue}</span>}
        </div>

        {teams.length > 0 && (
          <div className="text-sm text-zinc-500 mb-3">
            {teams.join(' vs ')}
          </div>
        )}

        {/* VM IP display when assigned */}
        {vmBadge?.vm?.publicIp && (
          <div className="text-xs text-zinc-500 mb-3 font-mono">
            VM: {vmBadge.vm.publicIp}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {/* Producer button - disabled when no VM */}
          <button
            onClick={() => handleCompetitionClick(compId, '/producer')}
            disabled={!hasVM}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              hasVM
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
            title={!hasVM ? 'Assign a VM first' : undefined}
          >
            Producer
          </button>
          {/* Talent button - disabled when no VM */}
          <button
            onClick={() => handleCompetitionClick(compId, '/talent')}
            disabled={!hasVM}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              hasVM
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
            title={!hasVM ? 'Assign a VM first' : undefined}
          >
            Talent
          </button>
          <a
            href={`/output.html?comp=${compId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Graphics
          </a>
          <Link
            to={`/${compId}/camera-setup`}
            className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Cameras
          </Link>
        </div>

        {/* VM Assignment Controls */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800">
          {!hasVM ? (
            <button
              onClick={() => handleAssignVM(compId)}
              disabled={!canAssignVM || isAssigning}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                canAssignVM && !isAssigning
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              title={!canAssignVM ? 'No VMs available' : undefined}
            >
              {isAssigning ? (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Assigning...
                </span>
              ) : (
                `Assign VM${availableVMs.length > 0 ? ` (${availableVMs.length})` : ''}`
              )}
            </button>
          ) : (
            <button
              onClick={() => handleReleaseVM(compId)}
              disabled={isReleasing}
              className="px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-500 transition-colors disabled:opacity-50"
            >
              {isReleasing ? (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Releasing...
                </span>
              ) : (
                'Release VM'
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const CompetitionGroup = ({ title, competitions, emptyMessage }) => {
    if (competitions.length === 0) {
      if (emptyMessage) {
        return (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 pb-2 border-b border-zinc-800">
              {title}
            </h2>
            <p className="text-zinc-600 text-sm italic">{emptyMessage}</p>
          </div>
        );
      }
      return null;
    }

    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 pb-2 border-b border-zinc-800">
          {title} ({competitions.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.map(({ compId, config }) => (
            <CompetitionCard key={compId} compId={compId} config={config} />
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading competitions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load</h2>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  const totalCompetitions = Object.keys(competitions).length;
  const filteredCount =
    groupedCompetitions.today.length +
    groupedCompetitions.tomorrow.length +
    groupedCompetitions.upcoming.length +
    groupedCompetitions.past.length;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">Select Competition</h1>
          <p className="text-zinc-500">
            Choose a competition to control
            {redirectPath && (
              <span className="text-blue-400"> → {redirectPath}</span>
            )}
          </p>
        </div>

        {/* Local Development Option */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border-2 border-zinc-700 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">💻</span>
                <h3 className="text-lg font-bold text-white">Local Development</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Connect to local server at localhost:3003
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCompetitionClick('local', '/producer')}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
              >
                Producer
              </button>
              <button
                onClick={() => handleCompetitionClick('local', '/talent')}
                className="px-4 py-2 bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Talent
              </button>
              <Link
                to="/local/camera-setup"
                className="px-4 py-2 bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cameras
              </Link>
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search competitions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors text-center"
          >
            + Create Competition
          </Link>
        </div>

        {/* Search Results Info */}
        {searchQuery && (
          <p className="text-sm text-zinc-500 mb-4">
            Showing {filteredCount} of {totalCompetitions} competitions
          </p>
        )}

        {/* Competition Groups */}
        <CompetitionGroup
          title="Today"
          competitions={groupedCompetitions.today}
          emptyMessage={!searchQuery ? "No competitions scheduled for today" : null}
        />
        <CompetitionGroup
          title="Tomorrow"
          competitions={groupedCompetitions.tomorrow}
        />
        <CompetitionGroup
          title="Upcoming"
          competitions={groupedCompetitions.upcoming}
        />
        <CompetitionGroup
          title="Past"
          competitions={groupedCompetitions.past}
        />

        {/* No Results */}
        {filteredCount === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No competitions found</h3>
            <p className="text-zinc-400 mb-6">
              {searchQuery
                ? `No competitions match "${searchQuery}"`
                : "Create your first competition to get started"}
            </p>
            <Link
              to="/dashboard"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
            >
              Create Competition
            </Link>
          </div>
        )}

        {/* Footer Links */}
        <div className="mt-12 pt-6 border-t border-zinc-800 text-center">
          <div className="flex justify-center gap-6 text-sm flex-wrap">
            <Link to="/" className="text-zinc-500 hover:text-white transition-colors">
              Hub
            </Link>
            <Link to="/dashboard" className="text-zinc-500 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link to="/admin/vm-pool" className="text-zinc-500 hover:text-white transition-colors">
              VM Pool
            </Link>
            <Link to="/url-generator" className="text-zinc-500 hover:text-white transition-colors">
              URL Generator
            </Link>
            <Link to="/media-manager" className="text-zinc-500 hover:text-white transition-colors">
              Media Manager
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
