/**
 * useRtnStats - React hook for accessing RTN (Road To Nationals) statistics
 *
 * Subscribes to team stats from Firebase:
 * - Before show: reads from shared store at teamsDatabase/stats/{teamKey}/
 * - During show: reads from frozen snapshot at competitions/{compId}/rtnStats/
 *
 * Also listens for socket events (rtnStatsResult, rtnStatsProgress) to track
 * ingestion status in real-time.
 *
 * NOTE: This hook consumes server-side normalized stats from Firebase.
 * It is separate from useRoadToNationals.js which handles client-side RTN
 * dashboard fetching for coach names.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, ref, onValue } from '../lib/firebase';
import { useShow } from '../context/ShowContext';

const STALENESS_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Build a teamsDatabase key from a team name and gender.
 * Mirrors server-side buildTeamDbKey() in server/lib/rtnStatsService.js.
 * @param {string} schoolName - e.g., "Oklahoma", "Stanford"
 * @param {string} gender - "mens" or "womens"
 * @returns {string} e.g., "oklahoma-womens"
 */
function buildTeamDbKey(schoolName, gender) {
  if (!schoolName) return '';
  const normalized = schoolName
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s&-]/g, '')
    .replace(/-mens$/, '')
    .replace(/-womens$/, '')
    .replace(/ mens$/, '')
    .replace(/ womens$/, '')
    .replace(/ men$/, '')
    .replace(/ women$/, '')
    .replace(/\s+/g, '-')
    .trim();
  if (!normalized) return '';
  const genderSuffix = gender === 'womens' ? 'womens' : 'mens';
  return `${normalized}-${genderSuffix}`;
}

/**
 * Parse competition type string to extract gender and team count.
 * @param {string} compType - e.g., "womens-dual", "mens-tri", "womens-quad"
 * @returns {{ gender: string, teamCount: number }}
 */
function parseCompetitionType(compType) {
  if (!compType) return { gender: 'womens', teamCount: 2 };
  const parts = compType.toLowerCase().split('-');
  const gender = parts[0] === 'mens' ? 'mens' : 'womens';
  const typeMap = { dual: 2, tri: 3, quad: 4, '5': 5, '6': 6, '7': 7 };
  const teamCount = typeMap[parts[1]] || 2;
  return { gender, teamCount };
}

/**
 * Hook for accessing RTN statistics for teams in a competition.
 *
 * @param {string} compId - Competition ID
 * @param {object} config - Competition config object (from useCompetition)
 * @returns {{
 *   stats: Object,
 *   meta: Object,
 *   loading: boolean,
 *   error: string|null,
 *   refresh: (teamKey?: string) => void,
 *   isStale: boolean,
 *   progress: Object|null,
 *   teamKeys: Array<{index: number, teamKey: string}>
 * }}
 */
export function useRtnStats(compId, config) {
  const { socket, timesheetState } = useShow();

  const [sharedStats, setSharedStats] = useState({});
  const [snapshotStats, setSnapshotStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const loadedCountRef = useRef(0);

  const showIsRunning = useMemo(() => {
    return timesheetState?.isRunning || false;
  }, [timesheetState?.isRunning]);

  // Parse gender from competition type
  const { gender, teamCount } = useMemo(() => {
    return parseCompetitionType(config?.compType);
  }, [config?.compType]);

  // Build team keys from config
  const teamKeys = useMemo(() => {
    if (!config) return [];
    const keys = [];
    for (let i = 1; i <= 6; i++) {
      const teamName = config[`team${i}Name`];
      if (teamName) {
        const teamKey = buildTeamDbKey(teamName, gender);
        if (teamKey) {
          keys.push({ index: i, teamKey });
        }
      }
    }
    return keys;
  }, [config, gender]);

  // Subscribe to shared stats store (teamsDatabase/stats/{teamKey}/) for pre-show
  useEffect(() => {
    if (!teamKeys.length || showIsRunning) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadedCountRef.current = 0;
    const expectedCount = teamKeys.length;
    const unsubs = [];

    for (const { index, teamKey } of teamKeys) {
      const statsRef = ref(db, `teamsDatabase/stats/${teamKey}`);
      const unsub = onValue(statsRef, (snapshot) => {
        const data = snapshot.val();
        setSharedStats(prev => ({
          ...prev,
          [`team${index}`]: data || null,
        }));
        loadedCountRef.current++;
        if (loadedCountRef.current >= expectedCount) {
          setLoading(false);
        }
      }, (err) => {
        console.error(`[useRtnStats] Firebase error for ${teamKey}:`, err);
        setError(err.message);
        loadedCountRef.current++;
        if (loadedCountRef.current >= expectedCount) {
          setLoading(false);
        }
      });
      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [teamKeys, showIsRunning]);

  // Subscribe to competition snapshot (competitions/{compId}/rtnStats/) during show
  useEffect(() => {
    if (!compId || !showIsRunning) {
      setSnapshotStats(null);
      return;
    }

    const snapshotRef = ref(db, `competitions/${compId}/rtnStats`);
    const unsub = onValue(snapshotRef, (snapshot) => {
      setSnapshotStats(snapshot.val() || null);
      setLoading(false);
    }, (err) => {
      console.error('[useRtnStats] Firebase snapshot error:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [compId, showIsRunning]);

  // Socket listeners for rtnStatsResult and rtnStatsProgress
  useEffect(() => {
    if (!socket) return;

    const handleStatsResult = (data) => {
      if (data.compId && data.compId !== compId) return;
      if (data.error) {
        setError(data.error);
      } else {
        setError(null);
      }
      setProgress(null);
    };

    const handleStatsProgress = (data) => {
      if (data.compId && data.compId !== compId) return;
      setProgress(data);
    };

    socket.on('rtnStatsResult', handleStatsResult);
    socket.on('rtnStatsProgress', handleStatsProgress);

    return () => {
      socket.off('rtnStatsResult', handleStatsResult);
      socket.off('rtnStatsProgress', handleStatsProgress);
    };
  }, [socket, compId]);

  // Use snapshot stats during show, shared stats otherwise
  const stats = useMemo(() => {
    if (showIsRunning && snapshotStats) {
      return snapshotStats;
    }
    return sharedStats;
  }, [showIsRunning, snapshotStats, sharedStats]);

  // Derive meta from the first team that has it
  const meta = useMemo(() => {
    for (let i = 1; i <= 6; i++) {
      const teamStats = stats[`team${i}`];
      if (teamStats?.meta) {
        return teamStats.meta;
      }
    }
    return null;
  }, [stats]);

  // Check staleness from meta.fetchedAt
  const isStale = useMemo(() => {
    if (!meta?.fetchedAt) return true;
    const fetchedTime = new Date(meta.fetchedAt).getTime();
    return Date.now() - fetchedTime > STALENESS_TTL;
  }, [meta?.fetchedAt]);

  // Refresh function - emits refreshRtnStats socket event
  const refresh = useCallback((teamKey) => {
    if (!socket || !compId) return;
    socket.emit('refreshRtnStats', { compId, teamKey: teamKey || undefined });
    setProgress({ status: 'starting' });
  }, [socket, compId]);

  return {
    stats,
    meta,
    loading,
    error,
    refresh,
    isStale,
    progress,
    teamKeys,
  };
}

export { buildTeamDbKey, parseCompetitionType };

export default useRtnStats;
