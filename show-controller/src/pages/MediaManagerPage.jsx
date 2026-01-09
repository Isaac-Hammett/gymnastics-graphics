import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  teams,
  getTeamLogo,
  getTeamRosterWithHeadshots,
  getTeamRosterStats,
  getAllTeamKeys,
  getTeamsBySchool,
  getAllSchools,
} from '../lib/teamsDatabase';
import { CheckCircleIcon, XCircleIcon, PhotoIcon, UserGroupIcon, ChevronDownIcon, ChevronRightIcon, ClipboardDocumentIcon } from '@heroicons/react/24/solid';

export default function MediaManagerPage() {
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [newAthleteName, setNewAthleteName] = useState('');
  const [newAthleteHeadshot, setNewAthleteHeadshot] = useState('');
  const [newAthleteTeam, setNewAthleteTeam] = useState('');
  const [copied, setCopied] = useState(null);

  // Get all teams grouped by school
  const teamsBySchool = getTeamsBySchool();
  const allTeamKeys = getAllTeamKeys();
  const schools = getAllSchools();

  // Stats
  const totalTeams = allTeamKeys.length;
  const teamsWithRosters = allTeamKeys.filter(key => teams[key].roster.length > 0).length;
  const totalAthletes = allTeamKeys.reduce((sum, key) => {
    const stats = getTeamRosterStats(key);
    return sum + stats.withHeadshots;
  }, 0);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateAddCode = (type, name, url) => {
    return `'${name.toLowerCase()}': '${url}',`;
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
                      />
                    )}
                    {/* Women's Team */}
                    {womensTeam && (
                      <TeamCard
                        team={womensTeam}
                        isExpanded={expandedTeam === womensTeam.key}
                        onToggle={() => setExpandedTeam(expandedTeam === womensTeam.key ? null : womensTeam.key)}
                      />
                    )}
                  </div>

                  {/* Expanded Roster */}
                  {(expandedTeam === mensTeam?.key || expandedTeam === womensTeam?.key) && (
                    <RosterView teamKey={expandedTeam} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add New Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add New Team Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Add New Team</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Team key (e.g., ohio-state-mens)"
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
                  <div className="text-xs text-zinc-500 mb-1">Add to teamsDatabase.js:</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 bg-zinc-900 rounded text-xs text-green-400 font-mono overflow-x-auto">
                      '{newTeamName}': {'{'} displayName: "...", school: "...", gender: "mens", logo: '{newTeamLogo}', roster: [] {'}'},
                    </code>
                    <button
                      onClick={() => copyToClipboard(`'${newTeamName}': { displayName: "...", school: "...", gender: "mens", logo: '${newTeamLogo}', roster: [] },`, 'team-code')}
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

          {/* Add New Athlete Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Add New Athlete</h2>
            <div className="space-y-3">
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
                <option value="">Select team</option>
                {allTeamKeys.map(key => (
                  <option key={key} value={key}>{teams[key].displayName}</option>
                ))}
              </select>
              {newAthleteName && newAthleteHeadshot && (
                <div className="mt-2">
                  <div className="text-xs text-zinc-500 mb-1">Add to athleteHeadshots in teamsDatabase.js:</div>
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
                <li>Add team entry to <code className="text-green-400">teamsDatabase.js</code></li>
                <li>Each school needs both -mens and -womens entries</li>
              </ol>
            </div>
            <div>
              <h4 className="text-white font-medium mb-2">Athlete Headshots</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to Virtius team roster page</li>
                <li>Copy athlete names to team's roster array</li>
                <li>Copy headshot URLs to athleteHeadshots object</li>
                <li>Names must match exactly (case-insensitive)</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ team, isExpanded, onToggle }) {
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

function RosterView({ teamKey }) {
  const roster = getTeamRosterWithHeadshots(teamKey);
  const team = teams[teamKey];

  if (roster.length === 0) {
    return (
      <div className="mt-3 p-3 bg-zinc-800/30 rounded-lg text-center">
        <p className="text-zinc-500 text-sm">No roster defined for {team.displayName}</p>
        <p className="text-xs text-zinc-600 mt-1">Add athletes to the roster array in teamsDatabase.js</p>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-zinc-800/30 rounded-lg">
      <h4 className="text-sm font-medium text-zinc-300 mb-2">{team.displayName} Roster</h4>
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
