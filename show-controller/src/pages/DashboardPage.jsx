import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompetitions } from '../hooks/useCompetitions';
import { competitionTypes, teamCounts, typeLabels } from '../lib/graphicButtons';
import { getTeamLogo, hasTeamLogo, hasTeamRoster, getTeamRosterStatsFlexible } from '../lib/teamsDatabase';
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

export default function DashboardPage() {
  const { competitions, loading, createCompetition, updateCompetition, deleteCompetition, duplicateCompetition } = useCompetitions();
  const [showModal, setShowModal] = useState(false);
  const [editingCompId, setEditingCompId] = useState(null);
  const [formData, setFormData] = useState(getDefaultFormData());
  const [virtiusSessionId, setVirtiusSessionId] = useState('');
  const [virtiusFetching, setVirtiusFetching] = useState(false);
  const [virtiusError, setVirtiusError] = useState(null);

  const competitionList = Object.keys(competitions);

  function getDefaultFormData() {
    return {
      compId: '',
      compType: '',
      eventName: '',
      meetDate: '',
      venue: '',
      location: '',
      team1Name: '',
      team1Logo: '',
      team1Tricode: '',
      team2Name: '',
      team2Logo: '',
      team2Tricode: '',
      team3Name: '',
      team3Logo: '',
      team3Tricode: '',
      team4Name: '',
      team4Logo: '',
      team4Tricode: '',
      team5Name: '',
      team5Logo: '',
      team5Tricode: '',
      team6Name: '',
      team6Logo: '',
      team6Tricode: '',
    };
  }


  // Generate a random competition ID
  function generateCompId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Format date from YYYY-MM-DD to readable format
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Infer competition type from sex and team count
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

      // Sort teams by team_order if available
      const sortedTeams = [...teams].sort((a, b) => (a.team_order || 0) - (b.team_order || 0));

      setFormData(prev => ({
        ...prev,
        eventName: meet.name || prev.eventName,
        meetDate: formatDate(meet.meet_date) || prev.meetDate,
        venue: meet.location?.split(',')[0]?.trim() || prev.venue,
        location: meet.location?.split(',').slice(1).join(',').trim() || prev.location,
        compType: inferCompType(meet.sex, sortedTeams.length),
        team1Name: sortedTeams[0]?.name || prev.team1Name,
        team1Logo: getTeamLogo(sortedTeams[0]?.name) || prev.team1Logo,
        team1Tricode: sortedTeams[0]?.tricode || prev.team1Tricode,
        team2Name: sortedTeams[1]?.name || prev.team2Name,
        team2Logo: getTeamLogo(sortedTeams[1]?.name) || prev.team2Logo,
        team2Tricode: sortedTeams[1]?.tricode || prev.team2Tricode,
        team3Name: sortedTeams[2]?.name || prev.team3Name,
        team3Logo: getTeamLogo(sortedTeams[2]?.name) || prev.team3Logo,
        team3Tricode: sortedTeams[2]?.tricode || prev.team3Tricode,
        team4Name: sortedTeams[3]?.name || prev.team4Name,
        team4Logo: getTeamLogo(sortedTeams[3]?.name) || prev.team4Logo,
        team4Tricode: sortedTeams[3]?.tricode || prev.team4Tricode,
        team5Name: sortedTeams[4]?.name || prev.team5Name,
        team5Logo: getTeamLogo(sortedTeams[4]?.name) || prev.team5Logo,
        team5Tricode: sortedTeams[4]?.tricode || prev.team5Tricode,
        team6Name: sortedTeams[5]?.name || prev.team6Name,
        team6Logo: getTeamLogo(sortedTeams[5]?.name) || prev.team6Logo,
        team6Tricode: sortedTeams[5]?.tricode || prev.team6Tricode,
        virtiusSessionId: virtiusSessionId.trim(),
      }));
    } catch (error) {
      setVirtiusError('Could not fetch Virtius session. Check the session ID and try again.');
    } finally {
      setVirtiusFetching(false);
    }
  }

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
    setFormData({
      compId,
      compType: config.compType || 'mens-dual',
      eventName: config.eventName || '',
      meetDate: config.meetDate || '',
      venue: config.venue || '',
      location: config.location || '',
      team1Name: config.team1Name || '',
      team1Logo: config.team1Logo || '',
      team1Tricode: config.team1Tricode || '',
      team2Name: config.team2Name || '',
      team2Logo: config.team2Logo || '',
      team2Tricode: config.team2Tricode || '',
      team3Name: config.team3Name || '',
      team3Logo: config.team3Logo || '',
      team3Tricode: config.team3Tricode || '',
      team4Name: config.team4Name || '',
      team4Logo: config.team4Logo || '',
      team4Tricode: config.team4Tricode || '',
      team5Name: config.team5Name || '',
      team5Logo: config.team5Logo || '',
      team5Tricode: config.team5Tricode || '',
      team6Name: config.team6Name || '',
      team6Logo: config.team6Logo || '',
      team6Tricode: config.team6Tricode || '',
      virtiusSessionId: config.virtiusSessionId || '',
    });
    setVirtiusSessionId(config.virtiusSessionId || '');
    setVirtiusError(null);
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const compId = formData.compId.toLowerCase().trim();

    const config = {
      compType: formData.compType,
      eventName: formData.eventName,
      meetDate: formData.meetDate,
      venue: formData.venue,
      location: formData.location,
      virtiusSessionId: formData.virtiusSessionId || '',
      team1Name: formData.team1Name,
      team1Logo: formData.team1Logo || 'https://via.placeholder.com/200/00274C/FFCB05?text=T1',
      team1Tricode: formData.team1Tricode || '',
      team2Name: formData.team2Name,
      team2Logo: formData.team2Logo || 'https://via.placeholder.com/200/BB0000/FFFFFF?text=T2',
      team2Tricode: formData.team2Tricode || '',
      team3Name: formData.team3Name,
      team3Logo: formData.team3Logo || 'https://via.placeholder.com/200/006400/FFFFFF?text=T3',
      team3Tricode: formData.team3Tricode || '',
      team4Name: formData.team4Name,
      team4Logo: formData.team4Logo || 'https://via.placeholder.com/200/800080/FFFFFF?text=T4',
      team4Tricode: formData.team4Tricode || '',
      team5Name: formData.team5Name,
      team5Logo: formData.team5Logo || 'https://via.placeholder.com/200/FF6600/FFFFFF?text=T5',
      team5Tricode: formData.team5Tricode || '',
      team6Name: formData.team6Name,
      team6Logo: formData.team6Logo || 'https://via.placeholder.com/200/000080/FFFFFF?text=T6',
      team6Tricode: formData.team6Tricode || '',
      // Defaults for stats
      hosts: 'Host Name',
      team1Ave: '0.000',
      team1High: '0.000',
      team1Con: '0%',
      team1Coaches: 'Coach Name',
      team2Ave: '0.000',
      team2High: '0.000',
      team2Con: '0%',
      team2Coaches: 'Coach Name',
      team3Ave: '0.000',
      team3High: '0.000',
      team3Con: '0%',
      team3Coaches: 'Coach Name',
      team4Ave: '0.000',
      team4High: '0.000',
      team4Con: '0%',
      team4Coaches: 'Coach Name',
      team5Ave: '0.000',
      team5High: '0.000',
      team5Con: '0%',
      team5Coaches: 'Coach Name',
      team6Ave: '0.000',
      team6High: '0.000',
      team6Con: '0%',
      team6Coaches: 'Coach Name',
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

  const teamCount = teamCounts[formData.compType] || 2;

  return (
    <div className="min-h-screen bg-zinc-950 p-10">
      <Link
        to="/"
        className="fixed top-5 left-5 flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm hover:bg-zinc-700 transition-colors z-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Hub
      </Link>

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-2">Gymnastics Graphics Dashboard</h1>
          <p className="text-zinc-500">Manage multiple competitions simultaneously</p>
        </div>

        <div className="flex justify-center mb-10">
          <button
            onClick={openCreateModal}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
          >
            + Create New Competition
          </button>
        </div>

        {competitionList.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-xl">
            <h2 className="text-xl font-semibold text-white mb-2">No Competitions Yet</h2>
            <p className="text-zinc-500 mb-6">Create your first competition to get started</p>
            <button
              onClick={openCreateModal}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
            >
              + Create Competition
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {competitionList.map((compId) => {
              const config = competitions[compId]?.config || {};
              const hasConfig = config.eventName && config.team1Name && config.team2Name;
              const teams = [config.team1Name, config.team2Name, config.team3Name, config.team4Name, config.team5Name, config.team6Name].filter(Boolean);

              return (
                <div
                  key={compId}
                  className="bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 hover:border-blue-500 transition-colors"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
                        {compId} • {typeLabels[config.compType] || 'Type not set'}
                      </div>
                      <div className="text-xl font-bold text-white mb-1">
                        {config.eventName || 'Untitled Competition'}
                      </div>
                      <div className="text-sm text-zinc-400">
                        {config.meetDate || 'Date not set'}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-semibold ${
                      hasConfig ? 'bg-green-500 text-black' : 'bg-zinc-700 text-white'
                    }`}>
                      {hasConfig ? 'Configured' : 'Draft'}
                    </span>
                  </div>

                  <div className="mb-5 pb-5 border-b border-zinc-800">
                    <div className="text-sm text-white mb-1">{teams.join(' vs ') || 'Teams not set'}</div>
                    <div className="text-xs text-zinc-500">{config.venue || 'Venue not set'} • {config.location || 'Location not set'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/controller?comp=${compId}`}
                      className="px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium text-center rounded-lg transition-colors"
                    >
                      Open Controller
                    </Link>
                    <a
                      href={`/output.html?comp=${compId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm text-center rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      Open Output
                    </a>
                    <Link
                      to={`/url-generator?comp=${compId}`}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm text-center rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      URL Generator
                    </Link>
                    <button
                      onClick={() => openEditModal(compId)}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      Edit Config
                    </button>
                    <button
                      onClick={() => handleDuplicate(compId)}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDeleteFromCard(compId)}
                      className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 text-red-400 text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-2">
              {editingCompId ? 'Edit Competition' : 'Create Competition'}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">Configure competition details</p>

            <form onSubmit={handleSubmit}>
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

              <FormGroup label="Competition Type">
                <select
                  value={formData.compType}
                  onChange={(e) => setFormData({ ...formData, compType: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select type...</option>
                  {competitionTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </FormGroup>

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

              <TeamLogoInput
                teamNum={1}
                teamName={formData.team1Name}
                teamLogo={formData.team1Logo}
                onNameChange={(val) => setFormData({ ...formData, team1Name: val })}
                onLogoChange={(val) => setFormData({ ...formData, team1Logo: val })}
                compType={formData.compType}
                required
              />

              <TeamLogoInput
                teamNum={2}
                teamName={formData.team2Name}
                teamLogo={formData.team2Logo}
                onNameChange={(val) => setFormData({ ...formData, team2Name: val })}
                onLogoChange={(val) => setFormData({ ...formData, team2Logo: val })}
                compType={formData.compType}
                required
              />

              {teamCount >= 3 && (
                <TeamLogoInput
                  teamNum={3}
                  teamName={formData.team3Name}
                  teamLogo={formData.team3Logo}
                  onNameChange={(val) => setFormData({ ...formData, team3Name: val })}
                  onLogoChange={(val) => setFormData({ ...formData, team3Logo: val })}
                  compType={formData.compType}
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
                  compType={formData.compType}
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
                  compType={formData.compType}
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
                  compType={formData.compType}
                  required
                />
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                {editingCompId && (
                  <button
                    type="button"
                    onClick={handleDelete}
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
      )}
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TeamLogoInput({ teamNum, teamName, teamLogo, onNameChange, onLogoChange, required, compType }) {
  const hasLogoInLibrary = teamName && hasTeamLogo(teamName);
  const hasLogoUrl = !!teamLogo;
  const logoStatus = hasLogoUrl ? 'has-url' : hasLogoInLibrary ? 'in-library' : teamName ? 'missing' : 'no-name';

  // Determine gender from competition type for roster lookup
  const gender = compType?.includes('womens') ? 'womens' : compType?.includes('mens') ? 'mens' : null;
  const hasRoster = teamName && hasTeamRoster(teamName, gender);
  const rosterStats = teamName ? getTeamRosterStatsFlexible(teamName, gender) : null;

  return (
    <div className="mb-4 p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-400">Team {teamNum}</span>
        <div className="flex items-center gap-3">
          {/* Logo status */}
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
          {/* Roster status */}
          {hasRoster && rosterStats && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircleIcon className="w-3 h-3" /> {rosterStats.total} athletes ({rosterStats.withHeadshots} photos)
            </span>
          )}
          {teamName && !hasRoster && (
            <Link
              to="/media-manager"
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
            >
              <ExclamationTriangleIcon className="w-3 h-3" /> No roster
            </Link>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {/* Logo preview */}
        <div className="w-12 h-12 bg-zinc-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
          {(teamLogo || (teamName && getTeamLogo(teamName))) ? (
            <img
              src={teamLogo || getTeamLogo(teamName)}
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
