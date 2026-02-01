import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import useLeagueRankings from '../hooks/useLeagueRankings';
import { parseCompetitionType, buildTeamDbKey } from '../hooks/useRtnStats';

/**
 * RankingsPanel - Collapsible panel showing league rankings for teams in a competition.
 * Uses useLeagueRankings hook to subscribe to rtnCache/rankings/ via Firebase.
 *
 * Displays:
 * - Team rankings table (rank, team name, ave, high, rqs) with competition teams highlighted
 * - Individual rankings per event with tabs for each event
 * - Refresh button to trigger server-side fetch from RTN
 */
export default function RankingsPanel({ compId, config }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('team');

  const { gender } = parseCompetitionType(config?.compType);
  const events = gender === 'womens'
    ? ['VT', 'UB', 'BB', 'FX', 'AA']
    : ['FX', 'PH', 'SR', 'VT', 'PB', 'HB', 'AA'];

  // Build set of team keys in this competition for highlighting
  const competitionTeamNames = new Set();
  for (let i = 1; i <= 6; i++) {
    const name = config?.[`team${i}Name`];
    if (name) competitionTeamNames.add(name.toLowerCase().trim());
  }

  const {
    teamRankings,
    individualRankings,
    week,
    loading,
    error,
    refresh,
    isStale,
    fetchedAt,
  } = useLeagueRankings(expanded ? gender : null);

  if (!gender) return null;

  const hasData = teamRankings.length > 0 || Object.keys(individualRankings).length > 0;

  // Check if a team name from rankings matches any competition team
  const isCompetitionTeam = (rankTeamName) => {
    if (!rankTeamName) return false;
    const normalized = rankTeamName.toLowerCase().trim();
    for (const compName of competitionTeamNames) {
      if (normalized.includes(compName) || compName.includes(normalized)) return true;
    }
    return false;
  };

  return (
    <div className="mt-2">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded); }}
        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {expanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
        {expanded ? 'Hide Rankings' : 'View Rankings'}
      </button>

      {expanded && (
        <div className="mt-2 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
          {/* Header with week info and refresh */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-zinc-400">
              {week ? `Week ${week}` : 'No rankings data'}
              {fetchedAt && (
                <span className="text-zinc-500 ml-2">
                  {new Date(fetchedAt).toLocaleDateString()}
                </span>
              )}
              {isStale && <span className="text-yellow-500 ml-1">(stale)</span>}
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); refresh(); }}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div className="text-[10px] text-red-400 mb-2">{error}</div>
          )}

          {!hasData && !loading && (
            <div className="text-[11px] text-zinc-500 text-center py-3">
              No rankings available. Click Refresh to fetch from RTN.
            </div>
          )}

          {hasData && (
            <>
              {/* Tab selector */}
              <div className="flex gap-1 mb-2 flex-wrap">
                <TabButton active={activeTab === 'team'} onClick={() => setActiveTab('team')}>
                  Teams
                </TabButton>
                {events.map(evt => (
                  <TabButton
                    key={evt}
                    active={activeTab === evt}
                    onClick={() => setActiveTab(evt)}
                  >
                    {evt}
                  </TabButton>
                ))}
              </div>

              {/* Team rankings table */}
              {activeTab === 'team' && (
                <TeamRankingsTable
                  rankings={teamRankings}
                  isCompetitionTeam={isCompetitionTeam}
                />
              )}

              {/* Individual rankings per event */}
              {activeTab !== 'team' && (
                <IndividualRankingsTable
                  athletes={individualRankings[activeTab] || []}
                  event={activeTab}
                  isCompetitionTeam={isCompetitionTeam}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-zinc-700/50 text-zinc-400 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}

function TeamRankingsTable({ rankings, isCompetitionTeam }) {
  if (!rankings.length) return <div className="text-[10px] text-zinc-500">No team rankings.</div>;

  // Show top 25 by default
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? rankings : rankings.slice(0, 25);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-700">
              <th className="text-left py-1 pr-2">#</th>
              <th className="text-left py-1 pr-2">Team</th>
              <th className="text-right py-1 pr-2">Ave</th>
              <th className="text-right py-1 pr-2">High</th>
              <th className="text-right py-1 pr-2">RQS</th>
              <th className="text-left py-1">Conf</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((team, i) => {
              const highlighted = isCompetitionTeam(team.name);
              return (
                <tr
                  key={i}
                  className={`border-b border-zinc-800 ${
                    highlighted ? 'bg-blue-900/30 text-blue-300' : 'text-zinc-300'
                  }`}
                >
                  <td className="py-0.5 pr-2 font-mono">{team.rank}</td>
                  <td className="py-0.5 pr-2 font-medium truncate max-w-[120px]">
                    {team.name}
                    {highlighted && <span className="ml-1 text-blue-400">*</span>}
                  </td>
                  <td className="py-0.5 pr-2 text-right font-mono">{team.ave}</td>
                  <td className="py-0.5 pr-2 text-right font-mono">{team.high}</td>
                  <td className="py-0.5 pr-2 text-right font-mono">{team.rqs}</td>
                  <td className="py-0.5 text-zinc-500">{team.conference}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rankings.length > 25 && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAll(!showAll); }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-1"
        >
          {showAll ? `Show top 25` : `Show all ${rankings.length} teams`}
        </button>
      )}
    </div>
  );
}

function IndividualRankingsTable({ athletes, event, isCompetitionTeam }) {
  if (!athletes.length) return <div className="text-[10px] text-zinc-500">No {event} rankings.</div>;

  // Show top 25 by default
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? athletes : athletes.slice(0, 25);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-700">
              <th className="text-left py-1 pr-2">#</th>
              <th className="text-left py-1 pr-2">Athlete</th>
              <th className="text-left py-1 pr-2">Team</th>
              <th className="text-right py-1 pr-2">Ave</th>
              <th className="text-right py-1 pr-2">High</th>
              <th className="text-right py-1">RQS</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((athlete, i) => {
              const highlighted = isCompetitionTeam(athlete.team);
              return (
                <tr
                  key={i}
                  className={`border-b border-zinc-800 ${
                    highlighted ? 'bg-blue-900/30 text-blue-300' : 'text-zinc-300'
                  }`}
                >
                  <td className="py-0.5 pr-2 font-mono">{athlete.rank}</td>
                  <td className="py-0.5 pr-2 font-medium truncate max-w-[100px]">
                    {athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim()}
                    {highlighted && <span className="ml-1 text-blue-400">*</span>}
                  </td>
                  <td className="py-0.5 pr-2 text-zinc-500 truncate max-w-[80px]">{athlete.team}</td>
                  <td className="py-0.5 pr-2 text-right font-mono">{athlete.ave}</td>
                  <td className="py-0.5 pr-2 text-right font-mono">{athlete.high}</td>
                  <td className="py-0.5 text-right font-mono">{athlete.rqs}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {athletes.length > 25 && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAll(!showAll); }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-1"
        >
          {showAll ? `Show top 25` : `Show all ${athletes.length} athletes`}
        </button>
      )}
    </div>
  );
}
