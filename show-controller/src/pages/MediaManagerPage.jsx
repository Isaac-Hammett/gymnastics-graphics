import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeamsDatabase } from '../hooks/useTeamsDatabase';
import { useTeamDashboard } from '../hooks/useRoadToNationals';
import { parseVirtiusRosterHtml } from '../hooks/useCompetitions';
import {
  CheckCircleIcon,
  XCircleIcon,
  PhotoIcon,
  UserGroupIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeAltIcon,
  TrophyIcon,
  LinkIcon,
  ArrowUpTrayIcon,
  CloudArrowUpIcon,
  PlusIcon,
} from '@heroicons/react/24/solid';

export default function MediaManagerPage() {
  const {
    teams,
    loading,
    error,
    getAllTeamKeys,
    getAllSchools,
    getTeamsBySchool,
    getTeamRosterWithHeadshots,
    getTeamRosterStats,
    importRoster,
    saveTeam,
    saveHeadshot,
  } = useTeamsDatabase();

  const [expandedTeam, setExpandedTeam] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Team Info lookup state
  const [lookupTeam, setLookupTeam] = useState('');
  const [lookupGender, setLookupGender] = useState('womens');

  // Virtius import state
  const [virtiusHtml, setVirtiusHtml] = useState('');
  const [importTeamKey, setImportTeamKey] = useState('');
  const [parsedAthletes, setParsedAthletes] = useState([]);

  // Add new team state
  const [newTeamKey, setNewTeamKey] = useState('');
  const [newTeamDisplayName, setNewTeamDisplayName] = useState('');
  const [newTeamSchool, setNewTeamSchool] = useState('');
  const [newTeamGender, setNewTeamGender] = useState('mens');
  const [newTeamLogo, setNewTeamLogo] = useState('');

  // Add single athlete state
  const [singleAthleteName, setSingleAthleteName] = useState('');
  const [singleAthleteHeadshot, setSingleAthleteHeadshot] = useState('');
  const [singleAthleteTeam, setSingleAthleteTeam] = useState('');

  // Get all teams grouped by school
  const teamsBySchool = getTeamsBySchool();
  const allTeamKeys = getAllTeamKeys();
  const schools = getAllSchools();

  // Stats
  const totalTeams = allTeamKeys.length;
  const teamsWithRosters = allTeamKeys.filter(key => teams[key]?.roster?.length > 0).length;
  const totalAthletes = allTeamKeys.reduce((sum, key) => {
    const stats = getTeamRosterStats(key);
    return sum + stats.withHeadshots;
  }, 0);

  // Parse Virtius HTML and extract athlete data
  const handleParseVirtius = () => {
    if (!virtiusHtml.trim()) {
      setParsedAthletes([]);
      return;
    }
    const athletes = parseVirtiusRosterHtml(virtiusHtml);
    setParsedAthletes(athletes);
  };

  // Save roster to Firebase
  const handleSaveRoster = async () => {
    if (!importTeamKey || parsedAthletes.length === 0) return;

    setSaving(true);
    setSaveMessage(null);

    const result = await importRoster(importTeamKey, parsedAthletes);

    if (result.success) {
      setSaveMessage({ type: 'success', text: `Saved ${result.athleteCount} athletes to ${teams[importTeamKey]?.displayName || importTeamKey}` });
      // Clear form
      setVirtiusHtml('');
      setParsedAthletes([]);
      setImportTeamKey('');
    } else {
      setSaveMessage({ type: 'error', text: result.error });
    }

    setSaving(false);
    setTimeout(() => setSaveMessage(null), 5000);
  };

  // Add new team to Firebase
  const handleAddTeam = async () => {
    if (!newTeamKey || !newTeamDisplayName || !newTeamSchool) return;

    setSaving(true);
    const result = await saveTeam(newTeamKey, {
      displayName: newTeamDisplayName,
      school: newTeamSchool,
      gender: newTeamGender,
      logo: newTeamLogo,
      roster: [],
    });

    if (result.success) {
      setSaveMessage({ type: 'success', text: `Added team: ${newTeamDisplayName}` });
      setNewTeamKey('');
      setNewTeamDisplayName('');
      setNewTeamSchool('');
      setNewTeamLogo('');
    } else {
      setSaveMessage({ type: 'error', text: result.error });
    }

    setSaving(false);
    setTimeout(() => setSaveMessage(null), 5000);
  };

  // Add single athlete headshot
  const handleAddSingleAthlete = async () => {
    if (!singleAthleteName || !singleAthleteHeadshot) return;

    setSaving(true);
    const result = await saveHeadshot(singleAthleteName, singleAthleteHeadshot, singleAthleteTeam);

    if (result.success) {
      setSaveMessage({ type: 'success', text: `Saved headshot for ${singleAthleteName}` });
      setSingleAthleteName('');
      setSingleAthleteHeadshot('');
      setSingleAthleteTeam('');
    } else {
      setSaveMessage({ type: 'error', text: result.error });
    }

    setSaving(false);
    setTimeout(() => setSaveMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading teams database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p>Error loading database: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back to Hub
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Media Manager</h1>
              <p className="text-zinc-400 text-sm">Manage team logos and athlete headshots (Firebase)</p>
            </div>
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-6 p-4 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-900/50 border border-green-700 text-green-300' : 'bg-red-900/50 border border-red-700 text-red-300'}`}>
            {saveMessage.text}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <PhotoIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{totalTeams}</div>
                <div className="text-zinc-400 text-sm">Teams ({schools.length} schools)</div>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{teamsWithRosters}</div>
                <div className="text-zinc-400 text-sm">Teams with Rosters</div>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{totalAthletes}</div>
                <div className="text-zinc-400 text-sm">Athlete Headshots</div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Info Lookup */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <GlobeAltIcon className="w-5 h-5 text-cyan-500" />
            Team Info (Road to Nationals)
          </h2>
          <p className="text-zinc-400 text-sm mb-4">
            Look up coaching staff, rankings, social links, and roster from Road to Nationals.
          </p>

          {/* Team selector */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Team name (e.g., UCLA, California, Stanford)"
              value={lookupTeam}
              onChange={(e) => setLookupTeam(e.target.value)}
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            />
            <select
              value={lookupGender}
              onChange={(e) => setLookupGender(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="womens">Women's</option>
              <option value="mens">Men's</option>
            </select>
          </div>

          {/* Team Info Display */}
          {lookupTeam && <TeamInfoDisplay teamName={lookupTeam} gender={lookupGender} />}
        </div>

        {/* Teams by School */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PhotoIcon className="w-5 h-5 text-blue-500" />
            Teams Database
          </h2>
          <p className="text-zinc-400 text-sm mb-4">
            Each school has a Men's and Women's team entry. Click a team to view its roster.
          </p>

          <div className="space-y-4">
            {schools.map((school) => {
              const schoolTeams = teamsBySchool[school];
              const mensTeam = schoolTeams.find(t => t.gender === 'mens');
              const womensTeam = schoolTeams.find(t => t.gender === 'womens');

              return (
                <div key={school} className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {/* Logo */}
                    <div className="w-12 h-12 bg-zinc-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {mensTeam?.logo ? (
                        <img src={mensTeam.logo} alt={school} className="w-10 h-10 object-contain" />
                      ) : (
                        <PhotoIcon className="w-6 h-6 text-zinc-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{school}</h3>
                      <p className="text-xs text-zinc-500">
                        {mensTeam?.logo ? 'Logo available' : 'No logo'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Men's Team */}
                    {mensTeam && (
                      <TeamCard
                        team={mensTeam}
                        isExpanded={expandedTeam === mensTeam.key}
                        onToggle={() => setExpandedTeam(expandedTeam === mensTeam.key ? null : mensTeam.key)}
                        getTeamRosterStats={getTeamRosterStats}
                      />
                    )}
                    {/* Women's Team */}
                    {womensTeam && (
                      <TeamCard
                        team={womensTeam}
                        isExpanded={expandedTeam === womensTeam.key}
                        onToggle={() => setExpandedTeam(expandedTeam === womensTeam.key ? null : womensTeam.key)}
                        getTeamRosterStats={getTeamRosterStats}
                      />
                    )}
                  </div>

                  {/* Expanded Roster */}
                  {(expandedTeam === mensTeam?.key || expandedTeam === womensTeam?.key) && (
                    <RosterView
                      teamKey={expandedTeam}
                      teams={teams}
                      getTeamRosterWithHeadshots={getTeamRosterWithHeadshots}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Import from Virtius */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ArrowUpTrayIcon className="w-5 h-5 text-green-500" />
            Import from Virtius
          </h2>
          <p className="text-zinc-400 text-sm mb-4">
            Paste the HTML from a Virtius roster page to automatically extract athlete names and headshot URLs.
            Data will be saved directly to Firebase.
          </p>

          <div className="space-y-4">
            {/* Team selector */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Target Team</label>
              <select
                value={importTeamKey}
                onChange={(e) => setImportTeamKey(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Select a team</option>
                {allTeamKeys.map(key => (
                  <option key={key} value={key}>{teams[key]?.displayName || key}</option>
                ))}
              </select>
            </div>

            {/* HTML input */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Virtius HTML (paste from roster page)</label>
              <textarea
                value={virtiusHtml}
                onChange={(e) => setVirtiusHtml(e.target.value)}
                placeholder="Paste the HTML from Virtius roster table here..."
                className="w-full h-32 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-green-500 resize-y"
              />
            </div>

            {/* Parse button */}
            <button
              onClick={handleParseVirtius}
              disabled={!virtiusHtml.trim()}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium rounded-lg transition-colors"
            >
              Parse HTML
            </button>

            {/* Results */}
            {parsedAthletes.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-zinc-700">
                <div className="text-sm text-green-400">
                  Found {parsedAthletes.length} athletes with headshots
                </div>

                {/* Preview athletes */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {parsedAthletes.map((athlete, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded">
                      <img
                        src={athlete.headshotUrl}
                        alt={athlete.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <span className="text-xs text-zinc-300 truncate">{athlete.name}</span>
                    </div>
                  ))}
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveRoster}
                  disabled={!importTeamKey || saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                >
                  <CloudArrowUpIcon className="w-5 h-5" />
                  {saving ? 'Saving...' : `Save ${parsedAthletes.length} Athletes to Firebase`}
                </button>

                {!importTeamKey && (
                  <p className="text-xs text-yellow-400">Please select a target team above before saving.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add New Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add New Team Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-blue-500" />
              Add New Team
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Team key (e.g., ohio-state-mens)"
                value={newTeamKey}
                onChange={(e) => setNewTeamKey(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Display name (e.g., Ohio State Men's)"
                value={newTeamDisplayName}
                onChange={(e) => setNewTeamDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="School name (e.g., Ohio State)"
                value={newTeamSchool}
                onChange={(e) => setNewTeamSchool(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <select
                value={newTeamGender}
                onChange={(e) => setNewTeamGender(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="mens">Men's</option>
                <option value="womens">Women's</option>
              </select>
              <input
                type="text"
                placeholder="Logo URL (https://media.virti.us/...)"
                value={newTeamLogo}
                onChange={(e) => setNewTeamLogo(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddTeam}
                disabled={!newTeamKey || !newTeamDisplayName || !newTeamSchool || saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
              >
                <CloudArrowUpIcon className="w-5 h-5" />
                {saving ? 'Saving...' : 'Add Team to Firebase'}
              </button>
            </div>
          </div>

          {/* Add Single Athlete Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-purple-500" />
              Add Single Athlete Headshot
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Athlete name (e.g., John Smith)"
                value={singleAthleteName}
                onChange={(e) => setSingleAthleteName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="Headshot URL (https://media.virti.us/...)"
                value={singleAthleteHeadshot}
                onChange={(e) => setSingleAthleteHeadshot(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              />
              <select
                value={singleAthleteTeam}
                onChange={(e) => setSingleAthleteTeam(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="">Select team (optional)</option>
                {allTeamKeys.map(key => (
                  <option key={key} value={key}>{teams[key]?.displayName || key}</option>
                ))}
              </select>
              <button
                onClick={handleAddSingleAthlete}
                disabled={!singleAthleteName || !singleAthleteHeadshot || saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
              >
                <CloudArrowUpIcon className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Headshot to Firebase'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ team, isExpanded, onToggle, getTeamRosterStats }) {
  const stats = getTeamRosterStats(team.key);
  const hasRoster = stats.total > 0;

  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
        isExpanded ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-zinc-700/50 hover:bg-zinc-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">
          {team.gender === 'mens' ? "Men's" : "Women's"}
        </span>
        {hasRoster && (
          <span className={`text-xs ${
            stats.percentage === 100 ? 'text-green-400' :
            stats.percentage >= 50 ? 'text-yellow-400' : 'text-zinc-500'
          }`}>
            ({stats.withHeadshots}/{stats.total})
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {hasRoster ? (
          <CheckCircleIcon className="w-4 h-4 text-green-500" />
        ) : (
          <XCircleIcon className="w-4 h-4 text-zinc-600" />
        )}
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-zinc-400" />
        )}
      </div>
    </button>
  );
}

function RosterView({ teamKey, teams, getTeamRosterWithHeadshots }) {
  const roster = getTeamRosterWithHeadshots(teamKey);
  const team = teams[teamKey];

  if (!roster || roster.length === 0) {
    return (
      <div className="mt-3 p-3 bg-zinc-800/30 rounded-lg text-center">
        <p className="text-zinc-500 text-sm">No roster defined for {team?.displayName || teamKey}</p>
        <p className="text-xs text-zinc-600 mt-1">Use "Import from Virtius" above to add athletes</p>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-zinc-800/30 rounded-lg">
      <h4 className="text-sm font-medium text-zinc-300 mb-2">{team?.displayName || teamKey} Roster</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
        {roster.map((athlete, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded"
          >
            <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {athlete.hasHeadshot ? (
                <img src={athlete.headshotUrl} alt={athlete.name} className="w-8 h-8 object-cover" />
              ) : (
                <UserGroupIcon className="w-4 h-4 text-zinc-500" />
              )}
            </div>
            <span className="text-xs text-zinc-300 truncate">{athlete.name}</span>
            {athlete.hasHeadshot ? (
              <CheckCircleIcon className="w-3 h-3 text-green-500 flex-shrink-0 ml-auto" />
            ) : (
              <XCircleIcon className="w-3 h-3 text-red-500 flex-shrink-0 ml-auto" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamInfoDisplay({ teamName, gender }) {
  const { dashboard, loading } = useTeamDashboard(teamName, gender);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        <span className="ml-3 text-zinc-400">Loading team data from Road to Nationals...</span>
      </div>
    );
  }

  // Derive all data from the single dashboard response
  const staff = dashboard?.staff
    ?.filter(s => s.position?.toLowerCase().includes('coach'))
    .map(s => ({
      id: s.id,
      fullName: `${s.first_name?.trim() || ''} ${s.last_name?.trim() || ''}`.trim(),
      position: s.position,
      imageUrl: s.image_url ? `https://www.roadtonationals.com/images/staff/${s.image_url}` : null,
    }))
    .sort((a, b) => {
      if (a.position?.toLowerCase().includes('head')) return -1;
      if (b.position?.toLowerCase().includes('head')) return 1;
      return 0;
    }) || [];

  const links = {};
  if (dashboard?.links) {
    for (const link of dashboard.links) {
      const type = link.tax_value?.toLowerCase() || '';
      if (type.includes('facebook')) links.facebook = link.link;
      else if (type.includes('twitter')) links.twitter = link.link;
      else if (type.includes('instagram')) links.instagram = link.link;
      else if (type.includes('official')) links.officialSite = link.link;
    }
  }

  const ranks = dashboard?.ranks;
  const rankings = ranks ? (gender === 'womens' ? {
    vault: ranks.vault ? parseInt(ranks.vault) : null,
    bars: ranks.bars ? parseInt(ranks.bars) : null,
    beam: ranks.beam ? parseInt(ranks.beam) : null,
    floor: ranks.floor ? parseInt(ranks.floor) : null,
    team: ranks.team ? parseInt(ranks.team) : null,
  } : {
    floor: ranks.floor ? parseInt(ranks.floor) : null,
    pommel: ranks.pommel ? parseInt(ranks.pommel) : null,
    rings: ranks.rings ? parseInt(ranks.rings) : null,
    vault: ranks.vault ? parseInt(ranks.vault) : null,
    pBars: ranks.pbars ? parseInt(ranks.pbars) : null,
    hBar: ranks.hbar ? parseInt(ranks.hbar) : null,
    team: ranks.team ? parseInt(ranks.team) : null,
  }) : null;

  const roster = dashboard?.roster?.map(r => ({
    id: r.id,
    fullName: `${r.fname?.trim() || ''} ${r.lname?.trim() || ''}`.trim(),
    hometown: r.hometown || '',
    year: r.school_year ? parseInt(r.school_year) : null,
  })) || [];

  const hasData = staff.length > 0 || Object.keys(links).length > 0 || rankings || roster.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-6 text-zinc-500">
        <p>No data found for "{teamName}" ({gender === 'womens' ? "Women's" : "Men's"})</p>
        <p className="text-xs mt-1">Try a different team name or check spelling</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Coaching Staff */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UserGroupIcon className="w-4 h-4 text-cyan-500" />
          Coaching Staff ({staff.length})
        </h3>
        {staff.length > 0 ? (
          <div className="space-y-2">
            {staff.map((coach) => (
              <div key={coach.id} className="flex items-center gap-3 p-2 bg-zinc-700/50 rounded">
                <div className="w-10 h-10 bg-zinc-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {coach.imageUrl ? (
                    <img src={coach.imageUrl} alt={coach.fullName} className="w-10 h-10 object-cover" />
                  ) : (
                    <UserGroupIcon className="w-5 h-5 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{coach.fullName}</div>
                  <div className="text-xs text-zinc-400">{coach.position}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No coaching staff found</p>
        )}
      </div>

      {/* Rankings */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <TrophyIcon className="w-4 h-4 text-yellow-500" />
          National Rankings
        </h3>
        {rankings ? (
          <div className="grid grid-cols-2 gap-2">
            {gender === 'womens' ? (
              <>
                <RankBadge label="Team" rank={rankings.team} />
                <RankBadge label="Vault" rank={rankings.vault} />
                <RankBadge label="Bars" rank={rankings.bars} />
                <RankBadge label="Beam" rank={rankings.beam} />
                <RankBadge label="Floor" rank={rankings.floor} />
              </>
            ) : (
              <>
                <RankBadge label="Team" rank={rankings.team} />
                <RankBadge label="Floor" rank={rankings.floor} />
                <RankBadge label="Pommel" rank={rankings.pommel} />
                <RankBadge label="Rings" rank={rankings.rings} />
                <RankBadge label="Vault" rank={rankings.vault} />
                <RankBadge label="P-Bars" rank={rankings.pBars} />
                <RankBadge label="H-Bar" rank={rankings.hBar} />
              </>
            )}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No rankings available</p>
        )}
      </div>

      {/* Social Links */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-blue-500" />
          Social & Links
        </h3>
        {Object.keys(links).length > 0 ? (
          <div className="space-y-2">
            {links.officialSite && (
              <SocialLink label="Official Site" url={links.officialSite} />
            )}
            {links.twitter && (
              <SocialLink label="Twitter/X" url={links.twitter} />
            )}
            {links.instagram && (
              <SocialLink label="Instagram" url={links.instagram} />
            )}
            {links.facebook && (
              <SocialLink label="Facebook" url={links.facebook} />
            )}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No social links found</p>
        )}
      </div>

      {/* RTN Roster */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UserGroupIcon className="w-4 h-4 text-green-500" />
          RTN Roster ({roster.length} athletes)
        </h3>
        {roster.length > 0 ? (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {roster.map((athlete) => (
              <div key={athlete.id} className="flex items-center justify-between p-1.5 bg-zinc-700/30 rounded text-xs">
                <span className="text-zinc-200">{athlete.fullName}</span>
                <span className="text-zinc-500">
                  {athlete.year ? `Yr ${athlete.year}` : ''} {athlete.hometown && `• ${athlete.hometown}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No roster found</p>
        )}
      </div>
    </div>
  );
}

function RankBadge({ label, rank }) {
  if (!rank) {
    return (
      <div className="flex items-center justify-between p-2 bg-zinc-700/30 rounded">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs text-zinc-600">--</span>
      </div>
    );
  }

  const color = rank <= 5 ? 'text-yellow-400' : rank <= 10 ? 'text-green-400' : rank <= 25 ? 'text-blue-400' : 'text-zinc-400';

  return (
    <div className="flex items-center justify-between p-2 bg-zinc-700/30 rounded">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`text-sm font-bold ${color}`}>#{rank}</span>
    </div>
  );
}

function SocialLink({ label, url }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 bg-zinc-700/30 rounded hover:bg-zinc-700/50 transition-colors"
    >
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-xs text-cyan-400 truncate flex-1">{url.replace(/https?:\/\/(www\.)?/, '').slice(0, 40)}...</span>
    </a>
  );
}
