import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCompetitions, checkVmStatus } from '../hooks/useCompetitions';
import { useVMPool, VM_STATUS } from '../hooks/useVMPool';
import { useCoordinator, COORDINATOR_STATUS } from '../hooks/useCoordinator';
import CoordinatorStatus from '../components/CoordinatorStatus';
import { competitionTypes, teamCounts, typeLabels } from '../lib/graphicButtons';
import { useTeamsDatabase } from '../hooks/useTeamsDatabase';
import { useHeadCoach } from '../hooks/useRoadToNationals';
import { getGenderFromCompType, buildTeamKey } from '../lib/competitionUtils';
import { ExclamationTriangleIcon, CheckCircleIcon, UserIcon } from '@heroicons/react/24/solid';

/**
 * HomePage - Consolidated landing page combining:
 * - CompetitionSelector: Competition list, VM assignment, coordinator status
 * - HubPage: Links to all tools and overlays
 * - DashboardPage: Create/edit competition functionality
 *
 * URL: /
 */
export default function HomePage() {
  const {
    competitions,
    loading,
    error,
    createCompetition,
    updateCompetition,
    deleteCompetition,
    duplicateCompetition,
    refreshTeamData
  } = useCompetitions();
  const {
    vms,
    availableVMs,
    assignVM,
    releaseVM,
    getVMForCompetition,
    hasVMAssigned,
    loading: vmPoolLoading,
  } = useVMPool();
  const {
    status: coordinatorStatus,
    isWaking,
    error: coordinatorError,
    wake,
  } = useCoordinator();
  const { getTeamLogo } = useTeamsDatabase();

  const [searchQuery, setSearchQuery] = useState('');
  const [vmStatuses, setVmStatuses] = useState({});
  const [assigningVm, setAssigningVm] = useState(null);
  const [releasingVm, setReleasingVm] = useState(null);
  const [showPastCompetitions, setShowPastCompetitions] = useState(false);
  const navigate = useNavigate();

  // Modal state for create/edit
  const [showModal, setShowModal] = useState(false);
  const [editingCompId, setEditingCompId] = useState(null);
  const [formData, setFormData] = useState(getDefaultFormData());
  const [virtiusSessionId, setVirtiusSessionId] = useState('');
  const [virtiusFetching, setVirtiusFetching] = useState(false);
  const [virtiusError, setVirtiusError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Coordinator status helpers
  const isCoordinatorOffline = coordinatorStatus === COORDINATOR_STATUS.OFFLINE;
  const isCoordinatorStarting = coordinatorStatus === COORDINATOR_STATUS.STARTING;

  function getDefaultFormData() {
    return {
      compId: '',
      compType: '',
      gender: '',
      eventName: '',
      meetDate: '',
      venue: '',
      location: '',
      team1Name: '', team1Logo: '', team1Tricode: '',
      team2Name: '', team2Logo: '', team2Tricode: '',
      team3Name: '', team3Logo: '', team3Tricode: '',
      team4Name: '', team4Logo: '', team4Tricode: '',
      team5Name: '', team5Logo: '', team5Tricode: '',
      team6Name: '', team6Logo: '', team6Tricode: '',
    };
  }

  function generateCompId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Group competitions by date
  const groupedCompetitions = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups = {
      today: [],
      tomorrow: [],
      upcoming: [],
      past: []
    };

    Object.entries(competitions).forEach(([compId, data]) => {
      const config = data?.config;
      if (!config) return;

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

    const sortByDate = (a, b) => {
      if (!a.meetDate && !b.meetDate) return 0;
      if (!a.meetDate) return 1;
      if (!b.meetDate) return -1;
      return a.meetDate - b.meetDate;
    };

    groups.today.sort(sortByDate);
    groups.tomorrow.sort(sortByDate);
    groups.upcoming.sort(sortByDate);
    groups.past.sort((a, b) => sortByDate(b, a));

    return groups;
  }, [competitions, searchQuery]);

  // Check VM status for competitions (routes through coordinator in production)
  useEffect(() => {
    const checkStatuses = async () => {
      for (const [compId, data] of Object.entries(competitions)) {
        const vmAddress = data?.config?.vmAddress;
        if (!vmAddress) {
          setVmStatuses(prev => ({ ...prev, [compId]: { online: false, noVm: true } }));
          continue;
        }

        const status = await checkVmStatus(vmAddress, 5000, compId);
        setVmStatuses(prev => ({ ...prev, [compId]: status }));
      }
    };

    checkStatuses();
  }, [competitions]);

  // VM assignment handlers
  const handleAssignVM = async (compId) => {
    setAssigningVm(compId);
    const result = await assignVM(compId);
    setAssigningVm(null);
    if (!result.success) {
      console.error('Failed to assign VM:', result.error);
    }
  };

  const handleReleaseVM = async (compId) => {
    setReleasingVm(compId);
    const result = await releaseVM(compId);
    setReleasingVm(null);
    if (!result.success) {
      console.error('Failed to release VM:', result.error);
    }
  };

  // Virtius import
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function inferCompType(sex, teamCount) {
    const prefix = sex === 'women' ? 'womens' : 'mens';
    const suffix = teamCount === 2 ? 'dual' :
                   teamCount === 3 ? 'tri' :
                   teamCount === 4 ? 'quad' :
                   teamCount === 5 ? '5-team' : '6-team';
    return `${prefix}-${suffix}`;
  }

  async function fetchFromVirtius() {
    if (!virtiusSessionId.trim()) return;
    setVirtiusFetching(true);
    setVirtiusError(null);

    try {
      const response = await fetch(`https://api.virti.us/session/${virtiusSessionId.trim()}/json`);
      if (!response.ok) throw new Error('Session not found');
      const data = await response.json();

      const meet = data.meet;
      const teams = meet.teams || [];
      const sortedTeams = [...teams].sort((a, b) => (a.team_order || 0) - (b.team_order || 0));
      const compType = inferCompType(meet.sex, sortedTeams.length);
      const gender = meet.sex === 'women' ? 'womens' : 'mens';

      setFormData(prev => ({
        ...prev,
        eventName: meet.name || prev.eventName,
        meetDate: formatDate(meet.meet_date) || prev.meetDate,
        venue: meet.location?.split(',')[0]?.trim() || prev.venue,
        location: meet.location?.split(',').slice(1).join(',').trim() || prev.location,
        compType,
        gender,
        team1Name: sortedTeams[0]?.name || prev.team1Name,
        team1Logo: getTeamLogo(sortedTeams[0]?.name, gender) || prev.team1Logo,
        team1Tricode: sortedTeams[0]?.tricode || prev.team1Tricode,
        team2Name: sortedTeams[1]?.name || prev.team2Name,
        team2Logo: getTeamLogo(sortedTeams[1]?.name, gender) || prev.team2Logo,
        team2Tricode: sortedTeams[1]?.tricode || prev.team2Tricode,
        team3Name: sortedTeams[2]?.name || prev.team3Name,
        team3Logo: getTeamLogo(sortedTeams[2]?.name, gender) || prev.team3Logo,
        team3Tricode: sortedTeams[2]?.tricode || prev.team3Tricode,
        team4Name: sortedTeams[3]?.name || prev.team4Name,
        team4Logo: getTeamLogo(sortedTeams[3]?.name, gender) || prev.team4Logo,
        team4Tricode: sortedTeams[3]?.tricode || prev.team4Tricode,
        team5Name: sortedTeams[4]?.name || prev.team5Name,
        team5Logo: getTeamLogo(sortedTeams[4]?.name, gender) || prev.team5Logo,
        team5Tricode: sortedTeams[4]?.tricode || prev.team5Tricode,
        team6Name: sortedTeams[5]?.name || prev.team6Name,
        team6Logo: getTeamLogo(sortedTeams[5]?.name, gender) || prev.team6Logo,
        team6Tricode: sortedTeams[5]?.tricode || prev.team6Tricode,
        virtiusSessionId: virtiusSessionId.trim(),
      }));
    } catch (error) {
      setVirtiusError('Could not fetch Virtius session. Check the session ID and try again.');
    } finally {
      setVirtiusFetching(false);
    }
  }

  // Modal handlers
  function openCreateModal() {
    setEditingCompId(null);
    setFormData({ ...getDefaultFormData(), compId: generateCompId() });
    setVirtiusSessionId('');
    setVirtiusError(null);
    setShowModal(true);
  }

  function openEditModal(compId) {
    const config = competitions[compId]?.config || {};
    setEditingCompId(compId);
    const gender = config.gender || getGenderFromCompType(config.compType) || 'mens';
    setFormData({
      compId,
      compType: config.compType || 'mens-dual',
      gender,
      eventName: config.eventName || '',
      meetDate: config.meetDate || '',
      venue: config.venue || '',
      location: config.location || '',
      team1Name: config.team1Name || '', team1Logo: config.team1Logo || '', team1Tricode: config.team1Tricode || '',
      team2Name: config.team2Name || '', team2Logo: config.team2Logo || '', team2Tricode: config.team2Tricode || '',
      team3Name: config.team3Name || '', team3Logo: config.team3Logo || '', team3Tricode: config.team3Tricode || '',
      team4Name: config.team4Name || '', team4Logo: config.team4Logo || '', team4Tricode: config.team4Tricode || '',
      team5Name: config.team5Name || '', team5Logo: config.team5Logo || '', team5Tricode: config.team5Tricode || '',
      team6Name: config.team6Name || '', team6Logo: config.team6Logo || '', team6Tricode: config.team6Tricode || '',
      virtiusSessionId: config.virtiusSessionId || '',
    });
    setVirtiusSessionId(config.virtiusSessionId || '');
    setVirtiusError(null);
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const compId = formData.compId.toLowerCase().trim();
    const gender = formData.gender || getGenderFromCompType(formData.compType) || 'mens';

    const config = {
      compType: formData.compType,
      gender,
      eventName: formData.eventName,
      meetDate: formData.meetDate,
      venue: formData.venue,
      location: formData.location,
      virtiusSessionId: formData.virtiusSessionId || '',
      team1Name: formData.team1Name,
      team1Logo: formData.team1Logo || 'https://via.placeholder.com/200/00274C/FFCB05?text=T1',
      team1Tricode: formData.team1Tricode || '',
      team1Key: formData.team1Name ? buildTeamKey(formData.team1Name, gender) : '',
      team2Name: formData.team2Name,
      team2Logo: formData.team2Logo || 'https://via.placeholder.com/200/BB0000/FFFFFF?text=T2',
      team2Tricode: formData.team2Tricode || '',
      team2Key: formData.team2Name ? buildTeamKey(formData.team2Name, gender) : '',
      team3Name: formData.team3Name,
      team3Logo: formData.team3Logo || 'https://via.placeholder.com/200/006400/FFFFFF?text=T3',
      team3Tricode: formData.team3Tricode || '',
      team3Key: formData.team3Name ? buildTeamKey(formData.team3Name, gender) : '',
      team4Name: formData.team4Name,
      team4Logo: formData.team4Logo || 'https://via.placeholder.com/200/800080/FFFFFF?text=T4',
      team4Tricode: formData.team4Tricode || '',
      team4Key: formData.team4Name ? buildTeamKey(formData.team4Name, gender) : '',
      team5Name: formData.team5Name,
      team5Logo: formData.team5Logo || 'https://via.placeholder.com/200/FF6600/FFFFFF?text=T5',
      team5Tricode: formData.team5Tricode || '',
      team5Key: formData.team5Name ? buildTeamKey(formData.team5Name, gender) : '',
      team6Name: formData.team6Name,
      team6Logo: formData.team6Logo || 'https://via.placeholder.com/200/000080/FFFFFF?text=T6',
      team6Tricode: formData.team6Tricode || '',
      team6Key: formData.team6Name ? buildTeamKey(formData.team6Name, gender) : '',
      hosts: 'Host Name',
      team1Ave: '0.000', team1High: '0.000', team1Con: '0%', team1Coaches: 'Coach Name',
      team2Ave: '0.000', team2High: '0.000', team2Con: '0%', team2Coaches: 'Coach Name',
      team3Ave: '0.000', team3High: '0.000', team3Con: '0%', team3Coaches: 'Coach Name',
      team4Ave: '0.000', team4High: '0.000', team4Con: '0%', team4Coaches: 'Coach Name',
      team5Ave: '0.000', team5High: '0.000', team5Con: '0%', team5Coaches: 'Coach Name',
      team6Ave: '0.000', team6High: '0.000', team6Con: '0%', team6Coaches: 'Coach Name',
    };

    if (editingCompId) {
      await updateCompetition(editingCompId, config);
    } else {
      await createCompetition(compId, config);
    }

    setShowModal(false);
  }

  async function handleDelete() {
    if (!editingCompId) return;
    if (window.confirm(`Are you sure you want to delete competition "${editingCompId}"? This cannot be undone.`)) {
      await deleteCompetition(editingCompId);
      setShowModal(false);
    }
  }

  async function handleDuplicate(compId) {
    const newCompId = window.prompt(`Duplicate "${compId}" as:\n\nEnter new competition ID (lowercase, no spaces):`, compId + '-copy');
    if (!newCompId) return;

    if (!/^[a-z0-9-]+$/.test(newCompId)) {
      alert('Competition ID can only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    if (competitions[newCompId]) {
      alert(`Competition "${newCompId}" already exists. Please choose a different ID.`);
      return;
    }

    await duplicateCompetition(compId, newCompId);
  }

  async function handleDeleteFromCard(compId) {
    if (window.confirm(`Are you sure you want to delete "${compId}"?\n\nThis will permanently delete:\n- All configuration\n- Current graphic state\n- All data for this competition\n\nThis cannot be undone.`)) {
      await deleteCompetition(compId);
    }
  }

  async function handleRefreshTeamData() {
    if (!editingCompId) return;
    setRefreshing(true);
    try {
      await refreshTeamData(editingCompId);
    } catch (err) {
      console.error('Failed to refresh team data:', err);
    }
    setRefreshing(false);
  }

  // Helper functions
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
      config?.team1Name, config?.team2Name, config?.team3Name,
      config?.team4Name, config?.team5Name, config?.team6Name
    ].filter(Boolean);
  };

  const formatDisplayDate = (date) => {
    if (!date) return 'No date set';
    return date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  };

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

    const cfg = statusConfig[vm.status] || { color: 'bg-zinc-500', label: vm.status };
    return { ...cfg, vm };
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

  const teamCount = teamCounts[formData.compType] || 2;

  const totalCompetitions = Object.keys(competitions).length;
  const filteredCount =
    groupedCompetitions.today.length +
    groupedCompetitions.tomorrow.length +
    groupedCompetitions.upcoming.length +
    groupedCompetitions.past.length;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load</h2>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-extrabold text-white mb-2">Gymnastics Graphics</h1>
            <p className="text-zinc-500">Control center for broadcast graphics</p>
          </div>
          <div className="absolute right-6 md:right-10 top-6 md:top-10">
            <CoordinatorStatus />
          </div>
        </div>

        {/* Offline Banner */}
        {isCoordinatorOffline && (
          <div className="bg-red-900/30 border-2 border-red-800 rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-900/50 rounded-full flex items-center justify-center">
                  <span className="text-xl">*</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">System is Sleeping</h3>
                  <p className="text-sm text-red-300/70">
                    The coordinator is offline to save costs. VM operations are disabled.
                  </p>
                </div>
              </div>
              <button
                onClick={wake}
                disabled={isWaking}
                className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-colors ${
                  isWaking
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                {isWaking ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Starting System...
                  </span>
                ) : (
                  'Start System'
                )}
              </button>
            </div>
            {coordinatorError && (
              <div className="mt-3 text-sm text-red-400 bg-red-900/30 rounded-lg px-3 py-2">
                Error: {coordinatorError}
              </div>
            )}
          </div>
        )}

        {/* Starting Banner */}
        {isCoordinatorStarting && (
          <div className="bg-yellow-900/30 border-2 border-yellow-800 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-900/50 rounded-full flex items-center justify-center">
                <span className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">System Starting</h3>
                <p className="text-sm text-yellow-300/70">
                  The coordinator is starting up. This typically takes 60-90 seconds.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Local Development Option */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border-2 border-zinc-700 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">$</span>
                <h3 className="text-lg font-bold text-white">Local Development</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Connect to local server at localhost:3003
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/local/producer"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
              >
                Producer
              </Link>
              <Link
                to="/local/talent"
                className="px-4 py-2 bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Talent
              </Link>
              <Link
                to="/local/camera-setup"
                className="px-4 py-2 bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cameras
              </Link>
            </div>
          </div>
        </div>

        {/* Search and Create */}
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
          <button
            onClick={openCreateModal}
            className="px-6 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors"
          >
            + Create Competition
          </button>
        </div>

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
          renderCard={(comp) => (
            <CompetitionCard
              key={comp.compId}
              competition={comp}
              vmStatuses={vmStatuses}
              getGenderBadge={getGenderBadge}
              getTeams={getTeams}
              formatDisplayDate={formatDisplayDate}
              getVMStatusBadge={getVMStatusBadge}
              hasVMAssigned={hasVMAssigned}
              availableVMs={availableVMs}
              isCoordinatorOffline={isCoordinatorOffline}
              assigningVm={assigningVm}
              releasingVm={releasingVm}
              onAssignVM={handleAssignVM}
              onReleaseVM={handleReleaseVM}
              onEdit={openEditModal}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteFromCard}
              VmStatusIndicator={VmStatusIndicator}
              navigate={navigate}
            />
          )}
        />
        <CompetitionGroup
          title="Tomorrow"
          competitions={groupedCompetitions.tomorrow}
          renderCard={(comp) => (
            <CompetitionCard
              key={comp.compId}
              competition={comp}
              vmStatuses={vmStatuses}
              getGenderBadge={getGenderBadge}
              getTeams={getTeams}
              formatDisplayDate={formatDisplayDate}
              getVMStatusBadge={getVMStatusBadge}
              hasVMAssigned={hasVMAssigned}
              availableVMs={availableVMs}
              isCoordinatorOffline={isCoordinatorOffline}
              assigningVm={assigningVm}
              releasingVm={releasingVm}
              onAssignVM={handleAssignVM}
              onReleaseVM={handleReleaseVM}
              onEdit={openEditModal}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteFromCard}
              VmStatusIndicator={VmStatusIndicator}
              navigate={navigate}
            />
          )}
        />
        <CompetitionGroup
          title="Upcoming"
          competitions={groupedCompetitions.upcoming}
          renderCard={(comp) => (
            <CompetitionCard
              key={comp.compId}
              competition={comp}
              vmStatuses={vmStatuses}
              getGenderBadge={getGenderBadge}
              getTeams={getTeams}
              formatDisplayDate={formatDisplayDate}
              getVMStatusBadge={getVMStatusBadge}
              hasVMAssigned={hasVMAssigned}
              availableVMs={availableVMs}
              isCoordinatorOffline={isCoordinatorOffline}
              assigningVm={assigningVm}
              releasingVm={releasingVm}
              onAssignVM={handleAssignVM}
              onReleaseVM={handleReleaseVM}
              onEdit={openEditModal}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteFromCard}
              VmStatusIndicator={VmStatusIndicator}
              navigate={navigate}
            />
          )}
        />

        {/* Past competitions toggle */}
        {groupedCompetitions.past.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setShowPastCompetitions(!showPastCompetitions)}
              className="text-sm text-zinc-500 hover:text-white transition-colors flex items-center gap-2"
            >
              <span>{showPastCompetitions ? 'v' : '>'}</span>
              Past Competitions ({groupedCompetitions.past.length})
            </button>
            {showPastCompetitions && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedCompetitions.past.map((comp) => (
                  <CompetitionCard
                    key={comp.compId}
                    competition={comp}
                    vmStatuses={vmStatuses}
                    getGenderBadge={getGenderBadge}
                    getTeams={getTeams}
                    formatDisplayDate={formatDisplayDate}
                    getVMStatusBadge={getVMStatusBadge}
                    hasVMAssigned={hasVMAssigned}
                    availableVMs={availableVMs}
                    isCoordinatorOffline={isCoordinatorOffline}
                    assigningVm={assigningVm}
                    releasingVm={releasingVm}
                    onAssignVM={handleAssignVM}
                    onReleaseVM={handleReleaseVM}
                    onEdit={openEditModal}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDeleteFromCard}
                    VmStatusIndicator={VmStatusIndicator}
                    navigate={navigate}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {filteredCount === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">?</div>
            <h3 className="text-xl font-bold text-white mb-2">No competitions found</h3>
            <p className="text-zinc-400 mb-6">
              {searchQuery
                ? `No competitions match "${searchQuery}"`
                : "Create your first competition to get started"}
            </p>
            <button
              onClick={openCreateModal}
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
            >
              Create Competition
            </button>
          </div>
        )}

        {/* Management Tools Section */}
        <Section title="Management Tools">
          <ToolCard
            to="/media-manager"
            icon="[img]"
            title="Media Manager"
            description="Manage team logos and athlete headshots"
          />
          <ToolCard
            to="/url-generator"
            icon="[url]"
            title="URL Generator"
            description="Generate OBS overlay URLs"
          />
          <ToolCard
            to="/graphics-manager"
            icon="[gfx]"
            title="Graphics Manager"
            description="View all graphics, filter by category"
          />
          <ToolCard
            to="/import"
            icon="[csv]"
            title="Import Shows"
            description="Import show plans from CSV"
          />
        </Section>

        {/* System Administration Section */}
        <Section title="System Administration">
          <ToolCard
            to="/_admin/vm-pool"
            icon="[vm]"
            title="VM Pool"
            description="Manage EC2 instances"
          />
          <ToolCard
            to="/_admin/setup-guide"
            icon="[doc]"
            title="Setup Guide"
            description="Documentation for coordinator system"
          />
          <ExternalToolCard
            href="/output.html"
            icon="[out]"
            title="Graphics Output"
            description="View live graphics output"
          />
        </Section>

        {/* Overlay Templates Section */}
        <Section title="Overlay Templates">
          <ExternalToolCard href="/overlays/logos.html" icon="[logo]" title="Team Logos" description="Display team logos" />
          <ExternalToolCard href="/overlays/team-stats.html" icon="[stats]" title="Team Stats" description="Show team statistics" />
          <ExternalToolCard href="/overlays/coaches.html" icon="[coach]" title="Coaches" description="Display coaching staff" />
          <ExternalToolCard href="/overlays/hosts.html" icon="[host]" title="Hosts" description="Show broadcast hosts" />
          <ExternalToolCard href="/overlays/event-bar.html" icon="[bar]" title="Event Bar" description="Lower-third event info" />
          <ExternalToolCard href="/overlays/event-frame.html" icon="[frame]" title="Event Frame" description="Full-screen event title" />
          <ExternalToolCard href="/overlays/stream.html" icon="[stream]" title="Stream Cards" description="Starting/ending screens" />
        </Section>
      </div>

      {/* Create/Edit Competition Modal */}
      {showModal && (
        <CompetitionModal
          editingCompId={editingCompId}
          formData={formData}
          setFormData={setFormData}
          virtiusSessionId={virtiusSessionId}
          setVirtiusSessionId={setVirtiusSessionId}
          virtiusFetching={virtiusFetching}
          virtiusError={virtiusError}
          fetchFromVirtius={fetchFromVirtius}
          teamCount={teamCount}
          refreshing={refreshing}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          onRefreshTeamData={handleRefreshTeamData}
          onClose={() => setShowModal(false)}
          getTeamLogo={getTeamLogo}
        />
      )}
    </div>
  );
}

// Competition Card Component
function CompetitionCard({
  competition,
  vmStatuses,
  getGenderBadge,
  getTeams,
  formatDisplayDate,
  getVMStatusBadge,
  hasVMAssigned,
  availableVMs,
  isCoordinatorOffline,
  assigningVm,
  releasingVm,
  onAssignVM,
  onReleaseVM,
  onEdit,
  onDuplicate,
  onDelete,
  VmStatusIndicator,
  navigate
}) {
  const { compId, config, meetDate } = competition;
  const genderBadge = getGenderBadge(config);
  const teams = getTeams(config);
  const vmBadge = getVMStatusBadge(compId);
  const hasVM = hasVMAssigned(compId);
  const isAssigning = assigningVm === compId;
  const isReleasing = releasingVm === compId;
  const canAssignVM = availableVMs.length > 0 && !hasVM && !isCoordinatorOffline;
  const canReleaseVM = hasVM && !isCoordinatorOffline;

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
        {formatDisplayDate(meetDate)}
        {config?.venue && <span className="text-zinc-500"> - {config.venue}</span>}
      </div>

      {teams.length > 0 && (
        <div className="text-sm text-zinc-500 mb-3">
          {teams.join(' vs ')}
        </div>
      )}

      {vmBadge?.vm?.publicIp && (
        <div className="text-xs text-zinc-500 mb-3 font-mono">
          VM: {vmBadge.vm.publicIp}
        </div>
      )}

      {/* Action buttons - always navigate, CompetitionLayout handles VM errors */}
      <div className="flex gap-2 flex-wrap">
        <Link
          to={`/${compId}/producer`}
          className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500"
        >
          Producer
        </Link>
        <Link
          to={`/${compId}/talent`}
          className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        >
          Talent
        </Link>
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

      {/* VM & Edit Controls */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800 flex-wrap">
        {!hasVM ? (
          <button
            onClick={() => onAssignVM(compId)}
            disabled={!canAssignVM || isAssigning}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              canAssignVM && !isAssigning
                ? 'bg-green-600 text-white hover:bg-green-500'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
            title={
              isCoordinatorOffline
                ? 'Start system first'
                : !canAssignVM
                  ? 'No VMs available'
                  : undefined
            }
          >
            {isAssigning ? (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Assigning...
              </span>
            ) : (
              `Assign VM${!isCoordinatorOffline && availableVMs.length > 0 ? ` (${availableVMs.length})` : ''}`
            )}
          </button>
        ) : (
          <button
            onClick={() => onReleaseVM(compId)}
            disabled={!canReleaseVM || isReleasing}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              canReleaseVM && !isReleasing
                ? 'bg-orange-600 text-white hover:bg-orange-500'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
            title={isCoordinatorOffline ? 'Start system first' : undefined}
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
        <button
          onClick={() => onEdit(compId)}
          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDuplicate(compId)}
          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Duplicate
        </button>
        <button
          onClick={() => onDelete(compId)}
          className="px-3 py-1.5 bg-zinc-800 text-red-400 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// Competition Group Component
function CompetitionGroup({ title, competitions, emptyMessage, renderCard }) {
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
        {competitions.map(renderCard)}
      </div>
    </div>
  );
}

// Section Component for tools
function Section({ title, children }) {
  return (
    <div className="mb-10">
      <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4 pb-2 border-b border-zinc-800">
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {children}
      </div>
    </div>
  );
}

// Tool Card Component
function ToolCard({ to, icon, title, description }) {
  return (
    <Link
      to={to}
      className="block bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 hover:border-blue-500 hover:-translate-y-0.5 transition-all"
    >
      <div className="text-2xl mb-3 text-zinc-500">{icon}</div>
      <div className="text-lg font-bold text-white mb-2">{title}</div>
      <div className="text-sm text-zinc-500 leading-relaxed">{description}</div>
    </Link>
  );
}

// External Tool Card Component
function ExternalToolCard({ href, icon, title, description }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 hover:border-blue-500 hover:-translate-y-0.5 transition-all"
    >
      <div className="text-2xl mb-3 text-zinc-500">{icon}</div>
      <div className="text-lg font-bold text-white mb-2">{title}</div>
      <div className="text-sm text-zinc-500 leading-relaxed">{description}</div>
    </a>
  );
}

// Competition Modal Component
function CompetitionModal({
  editingCompId,
  formData,
  setFormData,
  virtiusSessionId,
  setVirtiusSessionId,
  virtiusFetching,
  virtiusError,
  fetchFromVirtius,
  teamCount,
  refreshing,
  onSubmit,
  onDelete,
  onRefreshTeamData,
  onClose,
  getTeamLogo
}) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-2">
          {editingCompId ? 'Edit Competition' : 'Create Competition'}
        </h2>
        <p className="text-sm text-zinc-500 mb-6">Configure competition details</p>

        <form onSubmit={onSubmit}>
          {/* Virtius Import Section */}
          <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
            <div className="text-xs text-zinc-400 mb-2">Import from Virtius (optional)</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={virtiusSessionId}
                onChange={(e) => setVirtiusSessionId(e.target.value)}
                placeholder="Session ID, e.g., EeUcxrjyBD"
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={fetchFromVirtius}
                disabled={virtiusFetching || !virtiusSessionId.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {virtiusFetching ? 'Fetching...' : 'Fetch'}
              </button>
            </div>
            {virtiusError && (
              <div className="mt-2 text-xs text-red-400">{virtiusError}</div>
            )}
          </div>

          <FormGroup label="Competition ID (no spaces, lowercase)">
            <input
              type="text"
              value={formData.compId}
              onChange={(e) => setFormData({ ...formData, compId: e.target.value })}
              disabled={!!editingCompId}
              placeholder="e.g., court1, meet-a, ncaa-finals"
              pattern="[a-z0-9-]+"
              required
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </FormGroup>

          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Competition Type">
              <select
                value={formData.compType}
                onChange={(e) => {
                  const newCompType = e.target.value;
                  const inferredGender = getGenderFromCompType(newCompType);
                  setFormData({ ...formData, compType: newCompType, gender: inferredGender || formData.gender });
                }}
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select type...</option>
                {competitionTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Gender">
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select gender...</option>
                <option value="womens">Women's</option>
                <option value="mens">Men's</option>
              </select>
            </FormGroup>
          </div>

          <FormGroup label="Event Name">
            <input
              type="text"
              value={formData.eventName}
              onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
              placeholder="e.g., Big Ten Dual Meet"
              required
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </FormGroup>

          <FormGroup label="Meet Date">
            <input
              type="text"
              value={formData.meetDate}
              onChange={(e) => setFormData({ ...formData, meetDate: e.target.value })}
              placeholder="e.g., January 15, 2025"
              required
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </FormGroup>

          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="Venue">
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                placeholder="e.g., Crisler Center"
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </FormGroup>
            <FormGroup label="Location">
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Ann Arbor, MI"
                required
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </FormGroup>
          </div>

          {/* Team inputs */}
          <TeamLogoInput
            teamNum={1}
            teamName={formData.team1Name}
            teamLogo={formData.team1Logo}
            onNameChange={(val) => setFormData({ ...formData, team1Name: val })}
            onLogoChange={(val) => setFormData({ ...formData, team1Logo: val })}
            gender={formData.gender}
            getTeamLogo={getTeamLogo}
            required
          />
          <TeamLogoInput
            teamNum={2}
            teamName={formData.team2Name}
            teamLogo={formData.team2Logo}
            onNameChange={(val) => setFormData({ ...formData, team2Name: val })}
            onLogoChange={(val) => setFormData({ ...formData, team2Logo: val })}
            gender={formData.gender}
            getTeamLogo={getTeamLogo}
            required
          />
          {teamCount >= 3 && (
            <TeamLogoInput
              teamNum={3}
              teamName={formData.team3Name}
              teamLogo={formData.team3Logo}
              onNameChange={(val) => setFormData({ ...formData, team3Name: val })}
              onLogoChange={(val) => setFormData({ ...formData, team3Logo: val })}
              gender={formData.gender}
              getTeamLogo={getTeamLogo}
              required
            />
          )}
          {teamCount >= 4 && (
            <TeamLogoInput
              teamNum={4}
              teamName={formData.team4Name}
              teamLogo={formData.team4Logo}
              onNameChange={(val) => setFormData({ ...formData, team4Name: val })}
              onLogoChange={(val) => setFormData({ ...formData, team4Logo: val })}
              gender={formData.gender}
              getTeamLogo={getTeamLogo}
              required
            />
          )}
          {teamCount >= 5 && (
            <TeamLogoInput
              teamNum={5}
              teamName={formData.team5Name}
              teamLogo={formData.team5Logo}
              onNameChange={(val) => setFormData({ ...formData, team5Name: val })}
              onLogoChange={(val) => setFormData({ ...formData, team5Logo: val })}
              gender={formData.gender}
              getTeamLogo={getTeamLogo}
              required
            />
          )}
          {teamCount >= 6 && (
            <TeamLogoInput
              teamNum={6}
              teamName={formData.team6Name}
              teamLogo={formData.team6Logo}
              onNameChange={(val) => setFormData({ ...formData, team6Name: val })}
              onLogoChange={(val) => setFormData({ ...formData, team6Logo: val })}
              gender={formData.gender}
              getTeamLogo={getTeamLogo}
              required
            />
          )}

          {/* Refresh Team Data - only when editing */}
          {editingCompId && (
            <div className="mb-4 p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
              <div className="text-xs text-zinc-400 mb-2">Sync Headshots from Media Manager</div>
              <p className="text-xs text-zinc-500 mb-3">
                Re-fetch rosters from RTN and merge latest headshots from Firebase.
              </p>
              <button
                type="button"
                onClick={onRefreshTeamData}
                disabled={refreshing}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Team Data'}
              </button>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            {editingCompId && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors"
            >
              Save Competition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Form Group Component
function FormGroup({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// Team Logo Input Component
function TeamLogoInput({ teamNum, teamName, teamLogo, onNameChange, onLogoChange, required, gender, getTeamLogo }) {
  const effectiveGender = gender || 'mens';
  const hasLogoFromFirebase = teamName && getTeamLogo(teamName, effectiveGender);
  const hasLogoUrl = !!teamLogo;
  const logoStatus = hasLogoUrl ? 'has-url' : hasLogoFromFirebase ? 'in-library' : teamName ? 'missing' : 'no-name';

  return (
    <div className="mb-4 p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Team {teamNum}</span>
          {effectiveGender && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              effectiveGender === 'womens'
                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {effectiveGender === 'womens' ? "W" : "M"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {logoStatus === 'has-url' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircleIcon className="w-3 h-3" /> Logo set
            </span>
          )}
          {logoStatus === 'in-library' && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <CheckCircleIcon className="w-3 h-3" /> In library
            </span>
          )}
          {logoStatus === 'missing' && (
            <Link
              to="/media-manager"
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
            >
              <ExclamationTriangleIcon className="w-3 h-3" /> Add logo
            </Link>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="w-12 h-12 bg-zinc-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
          {(teamLogo || (teamName && getTeamLogo(teamName, effectiveGender))) ? (
            <img
              src={teamLogo || getTeamLogo(teamName, effectiveGender)}
              alt={teamName || 'Team logo'}
              className="w-10 h-10 object-contain"
            />
          ) : (
            <span className="text-zinc-500 text-lg">?</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={teamName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={`Team ${teamNum} name`}
            required={required}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={teamLogo}
            onChange={(e) => onLogoChange(e.target.value)}
            placeholder="Logo URL (auto-filled if in library)"
            className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
