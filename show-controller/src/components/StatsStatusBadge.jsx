import { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import { db, ref, onValue } from '../lib/firebase';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../lib/serverUrl';
import { buildTeamDbKey, parseCompetitionType } from '../hooks/useRtnStats';

const STALENESS_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * StatsStatusBadge - Shows RTN stats status for a competition card.
 * Reads directly from Firebase (no ShowContext needed).
 * Includes a Refresh Stats button that uses a temporary socket connection.
 */
export default function StatsStatusBadge({ compId, config }) {
  const [teamMetas, setTeamMetas] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Build team keys from config
  const { gender } = parseCompetitionType(config?.compType);
  const teamKeys = [];
  for (let i = 1; i <= 6; i++) {
    const teamName = config?.[`team${i}Name`];
    if (teamName) {
      // Prefer explicit team key from config (needed for composite/placeholder teams like WCGNIC)
      const teamKey = config?.[`team${i}Key`] || buildTeamDbKey(teamName, gender);
      if (teamKey) teamKeys.push({ index: i, teamKey });
    }
  }

  // Derive stable key from teamKeys array for useEffect dependency
  const teamKeysStr = teamKeys.map(t => t.teamKey).join(',');

  // Subscribe to meta for each team
  useEffect(() => {
    if (!teamKeys.length) return;

    const unsubs = [];
    for (const { index, teamKey } of teamKeys) {
      const metaRef = ref(db, `teamsDatabase/stats/${teamKey}/meta`);
      const unsub = onValue(metaRef, (snapshot) => {
        setTeamMetas(prev => ({
          ...prev,
          [index]: snapshot.val() || null,
        }));
      }, () => {
        // Ignore errors silently
      });
      unsubs.push(unsub);
    }

    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compId, teamKeysStr]);

  // Determine overall status from all team metas
  const metas = Object.values(teamMetas).filter(Boolean);
  const hasAnyStats = metas.length > 0;
  const allComplete = hasAnyStats && metas.every(m => m.status === 'complete' || m.status === 'composite');
  const anyError = metas.some(m => m.status === 'error');
  const anyPartial = metas.some(m => m.status === 'partial');

  // Find the oldest fetchedAt across all teams
  const oldestFetchedAt = metas.reduce((oldest, m) => {
    if (!m.fetchedAt) return oldest;
    const t = new Date(m.fetchedAt).getTime();
    return oldest === null ? t : Math.min(oldest, t);
  }, null);

  const isStale = oldestFetchedAt === null || (Date.now() - oldestFetchedAt > STALENESS_TTL);

  // Format timestamp
  const formatTimestamp = (ts) => {
    if (!ts) return 'Never';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Refresh handler using temporary socket (fire-and-forget)
  // We don't wait for rtnStatsResult because the socket may not join the
  // competition room in time (BUG-032). Instead, we rely on the Firebase
  // onValue listener above to update the badge when stats change.
  const handleRefresh = useCallback(() => {
    if (refreshing || !compId) return;
    setRefreshing(true);

    try {
      const socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        query: { compId },
      });

      socket.on('connect', () => {
        socket.emit('refreshRtnStats', { compId });
        // Disconnect immediately after emitting - Firebase listener will update UI
        setTimeout(() => {
          try { socket.disconnect(); } catch { /* ignore */ }
        }, 500); // Small delay to ensure emit is sent
      });

      socket.on('connect_error', () => {
        setRefreshing(false);
        try { socket.disconnect(); } catch { /* ignore */ }
      });

      // Stop spinner after 10 seconds (refresh should complete by then)
      // The Firebase listener will update the actual badge state
      setTimeout(() => setRefreshing(false), 10000);
    } catch {
      setRefreshing(false);
    }
  }, [compId, refreshing]);

  // Determine badge color and text
  let badgeColor, badgeText;
  if (!hasAnyStats) {
    badgeColor = 'bg-zinc-700 text-zinc-400';
    badgeText = 'No stats';
  } else if (anyError) {
    badgeColor = 'bg-red-500/20 text-red-400 border border-red-500/30';
    badgeText = 'Stats error';
  } else if (anyPartial) {
    badgeColor = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    badgeText = 'Partial';
  } else if (allComplete) {
    badgeColor = 'bg-green-500/20 text-green-400 border border-green-500/30';
    badgeText = 'Stats loaded';
  } else {
    badgeColor = 'bg-zinc-700 text-zinc-400';
    badgeText = 'No stats';
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${badgeColor}`}>
        {badgeText}
      </span>
      {hasAnyStats && (
        <span className="text-[10px] text-zinc-500">
          {formatTimestamp(oldestFetchedAt)}
        </span>
      )}
      {isStale && hasAnyStats && (
        <span className="text-[10px] text-yellow-500">Stale</span>
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRefresh(); }}
        disabled={refreshing}
        title="Refresh RTN Stats"
        className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors"
      >
        <ArrowPathIcon className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
