/**
 * useLeagueRankings - React hook for accessing RTN league rankings
 *
 * Subscribes to rtnCache/rankings/{gender}-{year}-{latestWeek}/ via Firebase.
 * Returns team rankings and per-event individual rankings.
 *
 * The refresh() function emits a fetchLeagueRankings socket event to trigger
 * server-side fetching from RTN. Uses a temporary socket connection so the hook
 * works both inside and outside ShowContext.
 *
 * NOTE: Rankings use week-based caching. The hook determines the latest available
 * week from Firebase cache keys, then subscribes to that week's data.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { db, ref, onValue, get } from '../lib/firebase';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../lib/serverUrl';

const RANKINGS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hook for consuming league rankings data from Firebase.
 *
 * @param {string} gender - "mens" or "womens"
 * @param {object} [options] - Optional config
 * @param {number} [options.year] - Season year (defaults to current year)
 * @param {number} [options.week] - Specific week (defaults to latest available)
 * @param {string} [options.league] - "ncaa" (default) or "gymact"
 * @returns {{ teamRankings, individualRankings, week, loading, error, refresh, isStale }}
 */
export default function useLeagueRankings(gender, options = {}) {
  const { year: optYear, week: optWeek, league } = options;
  const resolvedYear = optYear || new Date().getFullYear();

  const [teamRankings, setTeamRankings] = useState([]);
  const [individualRankings, setIndividualRankings] = useState({});
  const [week, setWeek] = useState(optWeek || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const unsubRef = useRef(null);

  // Determine latest week from available cache keys when no week specified
  useEffect(() => {
    if (!gender || optWeek) {
      if (optWeek) setWeek(optWeek);
      return;
    }

    const rankingsRef = ref(db, 'rtnCache/rankings');
    get(rankingsRef).then((snapshot) => {
      if (!snapshot.exists()) {
        setWeek(null);
        setLoading(false);
        return;
      }

      const data = snapshot.val();
      const leaguePrefix = league === 'gymact' ? 'gymact-' : '';
      const prefix = `${leaguePrefix}${gender}-${resolvedYear}-`;
      const weeks = Object.keys(data)
        .filter(k => k.startsWith(prefix))
        .map(k => parseInt(k.replace(prefix, ''), 10))
        .filter(w => !isNaN(w))
        .sort((a, b) => b - a); // descending

      if (weeks.length > 0) {
        setWeek(weeks[0]);
      } else {
        setWeek(null);
        setLoading(false);
      }
    }).catch((err) => {
      console.error('[useLeagueRankings] Failed to determine latest week:', err);
      setWeek(null);
      setLoading(false);
    });
  }, [gender, resolvedYear, optWeek, league]);

  // Subscribe to rankings data for the resolved week
  useEffect(() => {
    // Clean up previous subscription
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!gender || week === null) {
      setTeamRankings([]);
      setIndividualRankings({});
      setLoading(false);
      return;
    }

    const leaguePrefix = league === 'gymact' ? 'gymact-' : '';
    const cacheKey = `${leaguePrefix}${gender}-${resolvedYear}-${week}`;
    const rankingsPath = ref(db, `rtnCache/rankings/${cacheKey}`);

    setLoading(true);

    const unsub = onValue(rankingsPath, (snapshot) => {
      if (!snapshot.exists()) {
        setTeamRankings([]);
        setIndividualRankings({});
        setFetchedAt(null);
        setLoading(false);
        return;
      }

      const data = snapshot.val();

      // Normalize team rankings (Firebase may store as object with numeric keys)
      const teamArr = toArray(data.team);
      setTeamRankings(teamArr);

      // Normalize individual rankings per event
      const indiv = {};
      if (data.individual) {
        for (const [eventCode, athletes] of Object.entries(data.individual)) {
          indiv[eventCode] = toArray(athletes);
        }
      }
      setIndividualRankings(indiv);

      setFetchedAt(data.fetchedAt || null);
      setError(null);
      setLoading(false);
    }, (err) => {
      console.error('[useLeagueRankings] Firebase listener error:', err);
      setError(err.message);
      setLoading(false);
    });

    unsubRef.current = unsub;

    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, [gender, resolvedYear, week, league]);

  // Compute staleness
  const isStale = fetchedAt
    ? (Date.now() - new Date(fetchedAt).getTime()) > RANKINGS_CACHE_TTL
    : false;

  // Refresh handler using temporary socket connection
  const refresh = useCallback(() => {
    if (refreshing || !gender) return;
    setRefreshing(true);
    setError(null);

    try {
      const socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
      });

      const cleanup = () => {
        setRefreshing(false);
        try { socket.disconnect(); } catch { /* ignore */ }
      };

      socket.on('connect', () => {
        socket.emit('fetchLeagueRankings', {
          gender,
          year: resolvedYear,
          week: optWeek || undefined, // let server determine if not specified
          league: league || undefined,
        });
      });

      socket.on('leagueRankingsResult', (data) => {
        if (data.error) {
          setError(data.error);
        }
        if (data.week && data.week !== week) {
          // Server resolved to a different week — update our week
          setWeek(data.week);
        }
        cleanup();
      });

      socket.on('connect_error', () => {
        setError('Failed to connect to server');
        cleanup();
      });

      // Timeout after 60s
      setTimeout(cleanup, 60000);
    } catch (err) {
      setError(err.message);
      setRefreshing(false);
    }
  }, [gender, resolvedYear, optWeek, week, league, refreshing]);

  return {
    teamRankings,
    individualRankings,
    week,
    loading: loading || refreshing,
    error,
    refresh,
    isStale,
    fetchedAt,
  };
}

/**
 * Convert Firebase object (with numeric keys) or array to a proper array.
 * Firebase stores arrays as objects with numeric keys when there are gaps.
 */
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') {
    return Object.values(val);
  }
  return [];
}
