import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';
import { db, ref, onValue } from '../lib/firebase';
import { buildTeamDbKey, parseCompetitionType } from '../hooks/useRtnStats';

/**
 * StatsDetailPanel - Collapsible panel showing detailed RTN stats for teams in a competition.
 * Reads directly from Firebase teamsDatabase/stats/{teamKey}/ (no ShowContext needed).
 *
 * Displays:
 * - Per-team: consistency trends, MVP standings, top scores, lineup frequency
 * - Per-athlete: event averages, event highs, lineup rate, MVP total
 * - Athletes sortable/filterable by event
 */
export default function StatsDetailPanel({ compId, config }) {
  const [teamStats, setTeamStats] = useState({});
  const [expanded, setExpanded] = useState(false);
  const [activeTeamIndex, setActiveTeamIndex] = useState(1);
  const [activeTab, setActiveTab] = useState('overview');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const { gender } = parseCompetitionType(config?.compType);
  const events = gender === 'womens'
    ? ['VT', 'UB', 'BB', 'FX', 'AA']
    : ['FX', 'PH', 'SR', 'VT', 'PB', 'HB', 'AA'];

  // Build team keys
  const teamKeys = [];
  for (let i = 1; i <= 6; i++) {
    const teamName = config?.[`team${i}Name`];
    if (teamName) {
      const teamKey = buildTeamDbKey(teamName, gender);
      if (teamKey) teamKeys.push({ index: i, teamKey, name: teamName });
    }
  }

  // Subscribe to full stats for each team when expanded
  useEffect(() => {
    if (!expanded || !teamKeys.length) return;

    const unsubs = [];
    for (const { index, teamKey } of teamKeys) {
      const statsRef = ref(db, `teamsDatabase/stats/${teamKey}`);
      const unsub = onValue(statsRef, (snapshot) => {
        setTeamStats(prev => ({
          ...prev,
          [index]: snapshot.val() || null,
        }));
      }, () => {
        // Silently ignore errors
      });
      unsubs.push(unsub);
    }

    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, compId, config?.compType, config?.team1Name, config?.team2Name]);

  if (!teamKeys.length) return null;

  const currentStats = teamStats[activeTeamIndex];
  const hasStats = currentStats && Object.keys(currentStats).length > 0;

  return (
    <div className="mt-2">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded); }}
        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {expanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
        {expanded ? 'Hide Stats' : 'View Stats'}
      </button>

      {expanded && (
        <div className="mt-2 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
          {/* Team selector tabs */}
          {teamKeys.length > 1 && (
            <div className="flex gap-1 mb-3">
              {teamKeys.map(({ index, name }) => (
                <button
                  key={index}
                  onClick={() => setActiveTeamIndex(index)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    activeTeamIndex === index
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {!hasStats ? (
            <div className="text-[11px] text-zinc-500 italic py-4 text-center">
              No RTN stats loaded for this team. Use the refresh button above to fetch stats.
            </div>
          ) : (
            <>
              {/* Content tabs */}
              <div className="flex gap-1 mb-3 border-b border-zinc-700 pb-2">
                {[
                  { key: 'overview', label: 'Overview' },
                  { key: 'athletes', label: 'Athletes' },
                  { key: 'consistency', label: 'Trends' },
                  { key: 'lineup', label: 'Lineup' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-2 py-1 rounded-t text-[11px] font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'text-blue-400 border-b-2 border-blue-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'overview' && (
                <OverviewTab stats={currentStats} events={events} gender={gender} />
              )}
              {activeTab === 'athletes' && (
                <AthletesTab
                  stats={currentStats}
                  events={events}
                  eventFilter={eventFilter}
                  setEventFilter={setEventFilter}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  sortDir={sortDir}
                  setSortDir={setSortDir}
                />
              )}
              {activeTab === 'consistency' && (
                <ConsistencyTab stats={currentStats} events={events} />
              )}
              {activeTab === 'lineup' && (
                <LineupTab stats={currentStats} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Overview Tab: Team ranking, MVP top 3, top scores, theoretical max ---
function OverviewTab({ stats, events }) {
  const ranking = stats?.teamRanking;
  const mvp = toArray(stats?.mvp);
  const topScores = stats?.topScores;

  return (
    <div className="space-y-3">
      {/* Team Ranking */}
      {ranking && (
        <div className="bg-zinc-900/50 rounded p-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Team Ranking</div>
          <div className="flex gap-4 text-[11px]">
            {ranking.rank && (
              <div>
                <span className="text-zinc-400">Rank: </span>
                <span className="text-white font-bold">#{ranking.rank}</span>
              </div>
            )}
            {ranking.ave && (
              <div>
                <span className="text-zinc-400">Ave: </span>
                <span className="text-white">{ranking.ave}</span>
              </div>
            )}
            {ranking.high && (
              <div>
                <span className="text-zinc-400">High: </span>
                <span className="text-white">{ranking.high}</span>
              </div>
            )}
            {ranking.rqs && (
              <div>
                <span className="text-zinc-400">RQS: </span>
                <span className="text-white">{ranking.rqs}</span>
              </div>
            )}
            {ranking.conference && (
              <div>
                <span className="text-zinc-400">Conf: </span>
                <span className="text-white">{ranking.conference}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MVP Top 5 */}
      {mvp.length > 0 && (
        <div className="bg-zinc-900/50 rounded p-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">MVP Standings (Top 5)</div>
          <div className="space-y-1">
            {mvp.slice(0, 5).map((athlete, i) => (
              <div key={athlete.rtnId || i} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 w-4 text-right">{i + 1}.</span>
                  <span className="text-white">{athlete.fullName || `${athlete.firstName} ${athlete.lastName}`}</span>
                </div>
                <span className="text-blue-400 font-medium">{formatScore(athlete.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Scores / Theoretical Max */}
      {topScores && (
        <div className="bg-zinc-900/50 rounded p-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Top Scores</div>
          {topScores.theoreticalMax && (
            <div className="text-[11px] mb-2">
              <span className="text-zinc-400">Theoretical Max: </span>
              <span className="text-green-400 font-bold">{formatScore(topScores.theoreticalMax)}</span>
            </div>
          )}
          {topScores.events && (
            <div className="grid grid-cols-2 gap-1">
              {events.filter(e => e !== 'AA').map(event => {
                const eventAthletes = toArray(topScores.events?.[event]);
                if (!eventAthletes.length) return null;
                return (
                  <div key={event} className="text-[10px]">
                    <span className="text-zinc-500">{event}: </span>
                    <span className="text-zinc-300">
                      {eventAthletes.slice(0, 2).map(a =>
                        `${a.fullName || a.lastName || '?'} (${a.high || '?'})`
                      ).join(', ')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!ranking && !mvp.length && !topScores && (
        <div className="text-[11px] text-zinc-500 italic text-center py-2">
          No overview data available.
        </div>
      )}
    </div>
  );
}

// --- Athletes Tab: Per-athlete averages, highs, lineup rate ---
function AthletesTab({ stats, events, eventFilter, setEventFilter, sortBy, setSortBy, sortDir, setSortDir }) {
  const highs = toArray(stats?.individualHighs);
  const averages = toArray(stats?.individualAverages);
  const lineup = toArray(stats?.lineup);
  const mvp = toArray(stats?.mvp);

  // Merge athlete data from all sources
  const athletes = mergeAthleteData(highs, averages, lineup, mvp);

  // Filter by event
  const filtered = eventFilter === 'ALL'
    ? athletes
    : athletes.filter(a => {
        const avgVal = a.averages?.[eventFilter];
        const highVal = a.highs?.[eventFilter];
        return (avgVal !== null && avgVal !== undefined) || (highVal !== null && highVal !== undefined);
      });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === 'total') {
      aVal = a.mvpTotal || 0;
      bVal = b.mvpTotal || 0;
    } else if (sortBy === 'rate') {
      aVal = a.lineupRate || 0;
      bVal = b.lineupRate || 0;
    } else if (sortBy === 'name') {
      return sortDir === 'asc'
        ? (a.fullName || '').localeCompare(b.fullName || '')
        : (b.fullName || '').localeCompare(a.fullName || '');
    } else {
      // Sort by event average
      aVal = a.averages?.[sortBy] || 0;
      bVal = b.averages?.[sortBy] || 0;
    }
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const SortArrow = ({ col }) => {
    if (sortBy !== col) return null;
    return <span className="ml-0.5">{sortDir === 'desc' ? '\u25BC' : '\u25B2'}</span>;
  };

  if (!athletes.length) {
    return (
      <div className="text-[11px] text-zinc-500 italic text-center py-4">
        No individual athlete stats available.
      </div>
    );
  }

  return (
    <div>
      {/* Event filter */}
      <div className="flex gap-1 mb-2 flex-wrap">
        <button
          onClick={() => setEventFilter('ALL')}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
            eventFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          All
        </button>
        {events.map(event => (
          <button
            key={event}
            onClick={() => setEventFilter(event)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              eventFilter === event ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {event}
          </button>
        ))}
      </div>

      {/* Athlete table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-700">
              <th
                className="text-left py-1 pr-2 cursor-pointer hover:text-zinc-300"
                onClick={() => toggleSort('name')}
              >
                Athlete<SortArrow col="name" />
              </th>
              {(eventFilter === 'ALL' ? events.filter(e => e !== 'AA') : [eventFilter]).map(event => (
                <th
                  key={`avg-${event}`}
                  className="text-right py-1 px-1 cursor-pointer hover:text-zinc-300"
                  onClick={() => toggleSort(event)}
                >
                  {event} Avg<SortArrow col={event} />
                </th>
              ))}
              {(eventFilter === 'ALL' ? events.filter(e => e !== 'AA') : [eventFilter]).map(event => (
                <th key={`hi-${event}`} className="text-right py-1 px-1">
                  {event} Hi
                </th>
              ))}
              <th
                className="text-right py-1 px-1 cursor-pointer hover:text-zinc-300"
                onClick={() => toggleSort('rate')}
              >
                Rate<SortArrow col="rate" />
              </th>
              <th
                className="text-right py-1 pl-1 cursor-pointer hover:text-zinc-300"
                onClick={() => toggleSort('total')}
              >
                MVP<SortArrow col="total" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((athlete, i) => (
              <tr key={athlete.rtnId || i} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-1 pr-2 text-white whitespace-nowrap">{athlete.fullName}</td>
                {(eventFilter === 'ALL' ? events.filter(e => e !== 'AA') : [eventFilter]).map(event => (
                  <td key={`avg-${event}`} className="text-right py-1 px-1 text-zinc-300">
                    {formatScore(athlete.averages?.[event])}
                  </td>
                ))}
                {(eventFilter === 'ALL' ? events.filter(e => e !== 'AA') : [eventFilter]).map(event => (
                  <td key={`hi-${event}`} className="text-right py-1 px-1 text-zinc-400">
                    {formatScore(athlete.highs?.[event])}
                  </td>
                ))}
                <td className="text-right py-1 px-1 text-zinc-400">
                  {athlete.lineupRate !== null ? `${Math.round(athlete.lineupRate * 100)}%` : '-'}
                </td>
                <td className="text-right py-1 pl-1 text-blue-400 font-medium">
                  {formatScore(athlete.mvpTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-zinc-600 mt-1">{sorted.length} athletes</div>
    </div>
  );
}

// --- Consistency Tab: Event score trends over time ---
function ConsistencyTab({ stats, events }) {
  const consistency = stats?.consistency;

  if (!consistency?.labels || !consistency?.events) {
    return (
      <div className="text-[11px] text-zinc-500 italic text-center py-4">
        No consistency data available.
      </div>
    );
  }

  const labels = toArray(consistency.labels);
  const eventData = consistency.events || {};

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Event Scores by Meet</div>

      {events.filter(e => e !== 'AA').map(event => {
        const scores = toArray(eventData[event]);
        if (!scores.length) return null;

        // Detect trend
        const recent = scores.slice(-3);
        let trend = 'stable';
        if (recent.length >= 3) {
          if (recent[2] > recent[0] && recent[2] > recent[1]) trend = 'up';
          else if (recent[2] < recent[0] && recent[2] < recent[1]) trend = 'down';
        }

        const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400';
        const trendIcon = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2194';
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;

        return (
          <div key={event} className="bg-zinc-900/50 rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] text-white font-medium">{event}</div>
              <div className={`text-[10px] ${trendColor}`}>
                {trendIcon} {trend} (avg {formatScore(avg)})
              </div>
            </div>
            <div className="flex gap-1 items-end h-6">
              {scores.map((score, i) => {
                const min = Math.min(...scores) - 0.5;
                const max = Math.max(...scores) + 0.1;
                const range = max - min || 1;
                const height = Math.max(4, ((score - min) / range) * 24);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-500/40 rounded-sm"
                      style={{ height: `${height}px` }}
                      title={`${labels[i] || `Meet ${i + 1}`}: ${formatScore(score)}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-0.5">
              {scores.map((score, i) => (
                <div key={i} className="flex-1 text-center text-[8px] text-zinc-600">
                  {formatScore(score)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Lineup Tab: Meet-by-meet lineup usage ---
function LineupTab({ stats }) {
  const lineup = toArray(stats?.lineup);

  if (!lineup.length) {
    return (
      <div className="text-[11px] text-zinc-500 italic text-center py-4">
        No lineup data available.
      </div>
    );
  }

  // Sort by lineup rate descending
  const sorted = [...lineup].sort((a, b) => (b.rate || 0) - (a.rate || 0));

  return (
    <div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Lineup Frequency</div>
      <div className="space-y-1">
        {sorted.map((athlete, i) => {
          const rate = athlete.rate || 0;
          const meets = toArray(athlete.meets);
          const totalMeets = meets.length;
          const appeared = meets.filter(m => m === 1).length;

          return (
            <div key={athlete.rtnId || i} className="flex items-center gap-2 text-[11px]">
              <span className="text-white w-32 truncate">
                {athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`}
              </span>
              <div className="flex-1 h-2 bg-zinc-800 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500/60 rounded"
                  style={{ width: `${Math.round(rate * 100)}%` }}
                />
              </div>
              <span className="text-zinc-400 w-20 text-right">
                {appeared}/{totalMeets} ({Math.round(rate * 100)}%)
              </span>
              {/* Individual meet dots */}
              <div className="flex gap-0.5">
                {meets.map((m, j) => (
                  <div
                    key={j}
                    className={`w-1.5 h-1.5 rounded-full ${m === 1 ? 'bg-green-500' : 'bg-zinc-700'}`}
                    title={`Meet ${j + 1}: ${m === 1 ? 'Competed' : 'Did not compete'}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Utility functions ---

/** Convert Firebase object-with-numeric-keys or array to proper array */
function toArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.every(k => /^\d+$/.test(k))) {
      return keys.sort((a, b) => Number(a) - Number(b)).map(k => data[k]);
    }
    return Object.values(data);
  }
  return [];
}

/** Format a score number for display */
function formatScore(val) {
  if (val === null || val === undefined) return '-';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '-';
  return num.toFixed(num >= 100 ? 2 : 3);
}

/** Merge athlete data from highs, averages, lineup, and MVP sources */
function mergeAthleteData(highs, averages, lineup, mvp) {
  const map = new Map();

  const getKey = (a) => a.rtnId || a.fullName || `${a.firstName}-${a.lastName}`;

  for (const a of averages) {
    const key = getKey(a);
    const existing = map.get(key) || {
      rtnId: a.rtnId,
      fullName: a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim(),
      averages: {},
      highs: {},
      lineupRate: null,
      mvpTotal: null,
    };
    existing.averages = a.events || {};
    map.set(key, existing);
  }

  for (const a of highs) {
    const key = getKey(a);
    const existing = map.get(key) || {
      rtnId: a.rtnId,
      fullName: a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim(),
      averages: {},
      highs: {},
      lineupRate: null,
      mvpTotal: null,
    };
    existing.highs = a.events || {};
    map.set(key, existing);
  }

  for (const a of lineup) {
    const key = getKey(a);
    const existing = map.get(key);
    if (existing) {
      existing.lineupRate = a.rate || null;
    } else {
      map.set(key, {
        rtnId: a.rtnId,
        fullName: a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim(),
        averages: {},
        highs: {},
        lineupRate: a.rate || null,
        mvpTotal: null,
      });
    }
  }

  for (const a of mvp) {
    const key = getKey(a);
    const existing = map.get(key);
    if (existing) {
      existing.mvpTotal = a.total || null;
    } else {
      map.set(key, {
        rtnId: a.rtnId,
        fullName: a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim(),
        averages: {},
        highs: {},
        lineupRate: null,
        mvpTotal: a.total || null,
      });
    }
  }

  return Array.from(map.values());
}
