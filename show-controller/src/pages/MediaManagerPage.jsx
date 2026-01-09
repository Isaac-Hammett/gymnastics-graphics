import { useState } from 'react';
import { Link } from 'react-router-dom';
import teamLogos, { getTeamLogo, hasTeamLogo } from '../lib/teamLogos';
import { getTeamRoster, getTeamRosterStats, getTeamsWithRosters } from '../lib/athleteHeadshots';
import { CheckCircleIcon, XCircleIcon, PhotoIcon, UserGroupIcon, ChevronDownIcon, ChevronRightIcon, ClipboardDocumentIcon } from '@heroicons/react/24/solid';

export default function MediaManagerPage() {
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [newAthleteName, setNewAthleteName] = useState('');
  const [newAthleteHeadshot, setNewAthleteHeadshot] = useState('');
  const [newAthleteTeam, setNewAthleteTeam] = useState('');
  const [copied, setCopied] = useState(null);

  // Get all unique teams from both logos and rosters
  const teamsWithLogos = Object.keys(teamLogos).filter(name => !['gw', 'cal', 'pennstate', 'psu'].includes(name));
  const teamsWithRosters = getTeamsWithRosters();
  const allTeams = [...new Set([...teamsWithLogos, ...teamsWithRosters])].sort();

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateAddCode = (type, name, url) => {
    if (type === 'team') {
      return `'${name.toLowerCase()}': '${url}',`;
    } else {
      return `'${name.toLowerCase()}': '${url}',`;
    }
  };

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
              <p className="text-zinc-400 text-sm">Manage team logos and athlete headshots</p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <PhotoIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{teamsWithLogos.length}</div>
                <div className="text-zinc-400 text-sm">Team Logos</div>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{teamsWithRosters.length}</div>
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
                <div className="text-2xl font-bold text-white">
                  {teamsWithRosters.reduce((sum, team) => sum + getTeamRosterStats(team).withHeadshots, 0)}
                </div>
                <div className="text-zinc-400 text-sm">Athlete Headshots</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Logos Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PhotoIcon className="w-5 h-5 text-blue-500" />
              Team Logos
            </h2>

            {/* Add New Team Form */}
            <div className="mb-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Add New Team Logo</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Team name (e.g., Ohio State)"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Logo URL (https://media.virti.us/...)"
                  value={newTeamLogo}
                  onChange={(e) => setNewTeamLogo(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
                {newTeamName && newTeamLogo && (
                  <div className="mt-2">
                    <div className="text-xs text-zinc-500 mb-1">Add this to teamLogos.js:</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 bg-zinc-900 rounded text-xs text-green-400 font-mono overflow-x-auto">
                        {generateAddCode('team', newTeamName, newTeamLogo)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generateAddCode('team', newTeamName, newTeamLogo), 'team-code')}
                        className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
                      >
                        {copied === 'team-code' ? (
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        ) : (
                          <ClipboardDocumentIcon className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Teams List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allTeams.map((team) => {
                const hasLogo = hasTeamLogo(team);
                const logoUrl = getTeamLogo(team);
                const rosterStats = getTeamRosterStats(team);

                return (
                  <div
                    key={team}
                    className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                    onClick={() => setExpandedTeam(expandedTeam === team ? null : team)}
                  >
                    {/* Logo Preview */}
                    <div className="w-10 h-10 bg-zinc-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {hasLogo ? (
                        <img src={logoUrl} alt={team} className="w-8 h-8 object-contain" />
                      ) : (
                        <PhotoIcon className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>

                    {/* Team Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium capitalize truncate">{team}</div>
                      <div className="text-xs text-zinc-500">
                        {rosterStats.total > 0
                          ? `${rosterStats.withHeadshots}/${rosterStats.total} headshots`
                          : 'No roster'}
                      </div>
                    </div>

                    {/* Status Icons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasLogo ? (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="w-5 h-5 text-red-500" />
                      )}
                      {rosterStats.total > 0 && (
                        expandedTeam === team ? (
                          <ChevronDownIcon className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4 text-zinc-400" />
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Athlete Headshots Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-green-500" />
              Athlete Headshots
            </h2>

            {/* Add New Athlete Form */}
            <div className="mb-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Add New Athlete Headshot</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Athlete name (e.g., John Smith)"
                  value={newAthleteName}
                  onChange={(e) => setNewAthleteName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Headshot URL (https://media.virti.us/...)"
                  value={newAthleteHeadshot}
                  onChange={(e) => setNewAthleteHeadshot(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <select
                  value={newAthleteTeam}
                  onChange={(e) => setNewAthleteTeam(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select team (optional)</option>
                  {allTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
                {newAthleteName && newAthleteHeadshot && (
                  <div className="mt-2">
                    <div className="text-xs text-zinc-500 mb-1">Add this to athleteHeadshots.js:</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1 bg-zinc-900 rounded text-xs text-green-400 font-mono overflow-x-auto">
                        {generateAddCode('athlete', newAthleteName, newAthleteHeadshot)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generateAddCode('athlete', newAthleteName, newAthleteHeadshot), 'athlete-code')}
                        className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
                      >
                        {copied === 'athlete-code' ? (
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        ) : (
                          <ClipboardDocumentIcon className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Team Roster */}
            {expandedTeam && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-2 capitalize">
                  {expandedTeam} Roster
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {getTeamRoster(expandedTeam).map((athlete, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2 bg-zinc-800/30 rounded-lg"
                    >
                      {/* Headshot Preview */}
                      <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        {athlete.hasHeadshot ? (
                          <img src={athlete.headshotUrl} alt={athlete.name} className="w-8 h-8 object-cover" />
                        ) : (
                          <UserGroupIcon className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>

                      {/* Athlete Name */}
                      <div className="flex-1 text-sm text-zinc-300 truncate">
                        {athlete.name}
                      </div>

                      {/* Status */}
                      {athlete.hasHeadshot ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Teams with Rosters */}
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Teams with Rosters</h3>
              {teamsWithRosters.length === 0 ? (
                <p className="text-zinc-500 text-sm">No team rosters defined yet.</p>
              ) : (
                <div className="space-y-2">
                  {teamsWithRosters.map((team) => {
                    const stats = getTeamRosterStats(team);
                    return (
                      <div
                        key={team}
                        className="flex items-center gap-3 p-2 bg-zinc-800/30 rounded-lg cursor-pointer hover:bg-zinc-800/50 transition-colors"
                        onClick={() => setExpandedTeam(expandedTeam === team ? null : team)}
                      >
                        <div className="flex-1">
                          <span className="text-white capitalize">{team}</span>
                        </div>
                        <div className="text-sm">
                          <span className={stats.percentage === 100 ? 'text-green-400' : stats.percentage >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                            {stats.withHeadshots}/{stats.total}
                          </span>
                          <span className="text-zinc-500 ml-1">({stats.percentage}%)</span>
                        </div>
                        {expandedTeam === team ? (
                          <ChevronDownIcon className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-3">How to Add New Media</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-zinc-400">
            <div>
              <h4 className="text-white font-medium mb-2">Team Logos</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to Virtius and find the team</li>
                <li>Right-click the team logo and copy image URL</li>
                <li>Paste the URL in the form above</li>
                <li>Copy the generated code</li>
                <li>Add it to <code className="text-green-400">src/lib/teamLogos.js</code></li>
              </ol>
            </div>
            <div>
              <h4 className="text-white font-medium mb-2">Athlete Headshots</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to Virtius team roster page</li>
                <li>Right-click athlete headshot and copy image URL</li>
                <li>Paste the URL in the form above</li>
                <li>Copy the generated code</li>
                <li>Add it to <code className="text-green-400">src/lib/athleteHeadshots.js</code></li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
