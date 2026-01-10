import { useState, useEffect, useCallback } from 'react';
import {
  getHeadCoachCached,
  getTeamInfo,
  getCachedTeams,
  clearTeamCache,
  getTeamDashboard,
  getCoachingStaff,
  getTeamSocialLinks,
  getTeamRankings,
  getRtnRoster,
  getTeamSchedule,
} from '../lib/roadToNationals';

/**
 * Hook to fetch head coach for a team
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {{ coach: Object | null, loading: boolean, error: Error | null }}
 */
export function useHeadCoach(teamName, gender = 'mens') {
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamName) {
      setCoach(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getHeadCoachCached(teamName, gender)
      .then((result) => {
        if (!cancelled) {
          setCoach(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamName, gender]);

  return { coach, loading, error };
}

/**
 * Hook to fetch team info from Road to Nationals
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {{ teamInfo: Object | null, loading: boolean, error: Error | null }}
 */
export function useTeamInfo(teamName, gender = 'mens') {
  const [teamInfo, setTeamInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamName) {
      setTeamInfo(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getTeamInfo(teamName, gender)
      .then((result) => {
        if (!cancelled) {
          setTeamInfo(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamName, gender]);

  return { teamInfo, loading, error };
}

/**
 * Hook to fetch all teams for a gender
 * @param {'mens' | 'womens'} gender
 * @returns {{ teams: Array, loading: boolean, error: Error | null, refetch: Function }}
 */
export function useRtnTeams(gender = 'mens') {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getCachedTeams(gender);
      setTeams(data.teams || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [gender]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const refetch = useCallback(async () => {
    await clearTeamCache();
    fetchTeams();
  }, [fetchTeams]);

  return { teams, loading, error, refetch };
}

/**
 * Hook to fetch head coaches for multiple teams at once
 * @param {Array<{name: string, gender: 'mens' | 'womens'}>} teamsList
 * @returns {{ coaches: Map, loading: boolean, error: Error | null }}
 */
export function useHeadCoaches(teamsList) {
  const [coaches, setCoaches] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamsList || teamsList.length === 0) {
      setCoaches(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchAll = async () => {
      const results = new Map();

      // Group by gender to minimize API calls
      const byGender = {
        mens: teamsList.filter(t => t.gender === 'mens'),
        womens: teamsList.filter(t => t.gender === 'womens'),
      };

      try {
        // Fetch men's teams data once
        if (byGender.mens.length > 0) {
          const mensData = await getCachedTeams('mens');
          for (const team of byGender.mens) {
            const coach = findCoachInTeams(team.name, mensData.teams);
            if (coach) {
              results.set(team.name, coach);
            }
          }
        }

        // Fetch women's teams data once
        if (byGender.womens.length > 0) {
          const womensData = await getCachedTeams('womens');
          for (const team of byGender.womens) {
            const coach = findCoachInTeams(team.name, womensData.teams);
            if (coach) {
              results.set(team.name, coach);
            }
          }
        }

        if (!cancelled) {
          setCoaches(results);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(teamsList)]);

  return { coaches, loading, error };
}

/**
 * Helper to find coach in team array
 * @private
 */
function findCoachInTeams(teamName, teamsData) {
  const normalizedSearch = normalizeTeamName(teamName);

  const team = teamsData.find(t => {
    const normalizedName = normalizeTeamName(t.team_name);
    const normalizedFull = normalizeTeamName(t.full_team_name);
    const normalizedShort = normalizeTeamName(t.short_name);

    return normalizedName === normalizedSearch ||
           normalizedFull.includes(normalizedSearch) ||
           normalizedShort === normalizedSearch ||
           normalizedSearch.includes(normalizedName);
  });

  if (team && team.hc_first && team.hc_last) {
    return {
      firstName: team.hc_first.trim(),
      lastName: team.hc_last.trim(),
      fullName: `${team.hc_first.trim()} ${team.hc_last.trim()}`,
    };
  }

  return null;
}

/**
 * Normalize team name for comparison
 * @private
 */
function normalizeTeamName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/university|college|of|the|state/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ============================================================================
// Team Dashboard Hooks - Full team data including staff, roster, rankings, etc.
// ============================================================================

/**
 * Hook to fetch full team dashboard data
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {{ dashboard: Object | null, loading: boolean, error: Error | null }}
 */
export function useTeamDashboard(teamName, gender = 'womens') {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamName) {
      setDashboard(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getTeamDashboard(teamName, gender)
      .then((result) => {
        if (!cancelled) {
          setDashboard(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamName, gender]);

  return { dashboard, loading, error };
}

/**
 * Hook to fetch coaching staff for a team (head coach + assistants)
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {{ staff: Array, loading: boolean, error: Error | null }}
 */
export function useCoachingStaff(teamName, gender = 'womens') {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamName) {
      setStaff([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getCoachingStaff(teamName, gender)
      .then((result) => {
        if (!cancelled) {
          setStaff(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamName, gender]);

  return { staff, loading, error };
}

/**
 * Hook to fetch team social media links
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {{ links: Object, loading: boolean, error: Error | null }}
 */
export function useTeamSocialLinks(teamName, gender = 'womens') {
  const [links, setLinks] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamName) {
      setLinks({});
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getTeamSocialLinks(teamName, gender)
      .then((result) => {
        if (!cancelled) {
          setLinks(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamName, gender]);

  return { links, loading, error };
}

/**
 * Hook to fetch team rankings
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {{ rankings: Object | null, loading: boolean, error: Error | null }}
 */
export function useTeamRankings(teamName, gender = 'womens') {
  const [rankings, setRankings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamName) {
      setRankings(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getTeamRankings(teamName, gender)
      .then((result) => {
        if (!cancelled) {
          setRankings(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamName, gender]);

  return { rankings, loading, error };
}

/**
 * Hook to fetch team roster from RTN
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {{ roster: Array, loading: boolean, error: Error | null }}
 */
export function useRtnRoster(teamName, gender = 'womens') {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamName) {
      setRoster([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getRtnRoster(teamName, gender)
      .then((result) => {
        if (!cancelled) {
          setRoster(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamName, gender]);

  return { roster, loading, error };
}

/**
 * Hook to fetch team schedule
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {{ schedule: Array, loading: boolean, error: Error | null }}
 */
export function useTeamSchedule(teamName, gender = 'womens') {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!teamName) {
      setSchedule([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getTeamSchedule(teamName, gender)
      .then((result) => {
        if (!cancelled) {
          setSchedule(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [teamName, gender]);

  return { schedule, loading, error };
}

export default {
  // Basic hooks
  useHeadCoach,
  useTeamInfo,
  useRtnTeams,
  useHeadCoaches,

  // Dashboard hooks
  useTeamDashboard,
  useCoachingStaff,
  useTeamSocialLinks,
  useTeamRankings,
  useRtnRoster,
  useTeamSchedule,
};
