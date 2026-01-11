/**
 * Road to Nationals API Integration
 * https://www.roadtonationals.com/api
 *
 * Provides access to NCAA gymnastics data including:
 * - Teams and head coaches
 * - Meet schedules
 * - Team rosters
 *
 * Uses Firebase for persistent caching to reduce API calls
 */

import { db, ref, get, set } from './firebase';

const RTN_BASE_URL = 'https://www.roadtonationals.com/api';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (data rarely changes)

/**
 * Fetch all women's teams from Road to Nationals
 * @returns {Promise<{year: string, teams: Array}>}
 */
export async function fetchWomensTeams() {
  const response = await fetch(`${RTN_BASE_URL}/women/teams`);
  if (!response.ok) {
    throw new Error(`Failed to fetch women's teams: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch all men's teams from Road to Nationals
 * @returns {Promise<{year: string, teams: Array}>}
 */
export async function fetchMensTeams() {
  const response = await fetch(`${RTN_BASE_URL}/men/teams`);
  if (!response.ok) {
    throw new Error(`Failed to fetch men's teams: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch teams for a specific gender
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<{year: string, teams: Array}>}
 */
export async function fetchTeams(gender) {
  return gender === 'womens' ? fetchWomensTeams() : fetchMensTeams();
}

/**
 * Get head coach for a team
 * @param {string} teamName - Team name (e.g., "California", "Navy", "Stanford")
 * @param {'mens' | 'womens'} gender - Gender of the team
 * @returns {Promise<{firstName: string, lastName: string, fullName: string} | null>}
 */
export async function getHeadCoach(teamName, gender = 'mens') {
  try {
    const data = await fetchTeams(gender);
    const normalizedSearch = normalizeTeamName(teamName);

    const team = data.teams.find(t => {
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
  } catch (error) {
    console.error('Error fetching head coach:', error);
    return null;
  }
}

/**
 * Get team info from Road to Nationals
 * @param {string} teamName - Team name
 * @param {'mens' | 'womens'} gender - Gender
 * @returns {Promise<Object | null>}
 */
export async function getTeamInfo(teamName, gender = 'mens') {
  try {
    const data = await fetchTeams(gender);
    const normalizedSearch = normalizeTeamName(teamName);

    const team = data.teams.find(t => {
      const normalizedName = normalizeTeamName(t.team_name);
      const normalizedFull = normalizeTeamName(t.full_team_name);
      const normalizedShort = normalizeTeamName(t.short_name);

      return normalizedName === normalizedSearch ||
             normalizedFull.includes(normalizedSearch) ||
             normalizedShort === normalizedSearch ||
             normalizedSearch.includes(normalizedName);
    });

    if (team) {
      return {
        id: team.id,
        name: team.team_name,
        fullName: team.full_team_name,
        shortName: team.short_name,
        location: team.location,
        headCoach: team.hc_first && team.hc_last
          ? `${team.hc_first.trim()} ${team.hc_last.trim()}`
          : null,
        teamSite: team.team_site,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching team info:', error);
    return null;
  }
}

/**
 * Get head coaches for multiple teams
 * @param {Array<{name: string, gender: 'mens' | 'womens'}>} teams
 * @returns {Promise<Map<string, {firstName: string, lastName: string, fullName: string}>>}
 */
export async function getHeadCoaches(teams) {
  const results = new Map();

  // Group by gender to minimize API calls
  const mensTeams = teams.filter(t => t.gender === 'mens');
  const womensTeams = teams.filter(t => t.gender === 'womens');

  // Fetch data once per gender
  const [mensData, womensData] = await Promise.all([
    mensTeams.length > 0 ? fetchMensTeams() : Promise.resolve({ teams: [] }),
    womensTeams.length > 0 ? fetchWomensTeams() : Promise.resolve({ teams: [] }),
  ]);

  // Process men's teams
  for (const team of mensTeams) {
    const coach = findCoachInData(team.name, mensData.teams);
    if (coach) {
      results.set(team.name, coach);
    }
  }

  // Process women's teams
  for (const team of womensTeams) {
    const coach = findCoachInData(team.name, womensData.teams);
    if (coach) {
      results.set(team.name, coach);
    }
  }

  return results;
}

/**
 * Find coach in team data array
 * @private
 */
function findCoachInData(teamName, teamsData) {
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

/**
 * Get weekly schedule for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<Object>}
 */
export async function getWeeklySchedule(date, gender = 'womens') {
  const endpoint = gender === 'womens'
    ? `${RTN_BASE_URL}/women/schedule2/${date}/0`
    : `${RTN_BASE_URL}/men/schedulesplit/${date}/0`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch schedule: ${response.status}`);
  }
  return response.json();
}

/**
 * Get year weeks (dates for each week of the season)
 * @param {number} year
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<Array>}
 */
export async function getYearWeeks(year, gender = 'womens') {
  const genderPath = gender === 'womens' ? 'women' : 'men';
  const response = await fetch(`${RTN_BASE_URL}/${genderPath}/yearweeks/${year}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch year weeks: ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// Team Dashboard API - Full team data including staff, roster, rankings, etc.
// ============================================================================

/**
 * Fetch team dashboard data from Road to Nationals (with Firebase caching)
 * Includes: staff, roster, rankings, social links, schedule, team info
 *
 * @param {string} teamId - RTN team ID
 * @param {'mens' | 'womens'} gender
 * @param {number} year - Season year (defaults to current year)
 * @returns {Promise<Object>} Full team dashboard data
 */
export async function fetchTeamDashboard(teamId, gender = 'womens', year = new Date().getFullYear()) {
  const cacheKey = `${gender}-${teamId}`;
  const now = Date.now();

  // Check in-memory cache first
  if (memoryCache.dashboards[cacheKey]) {
    return memoryCache.dashboards[cacheKey];
  }

  // Check Firebase cache
  try {
    const cacheRef = ref(db, `rtnCache/dashboards/${cacheKey}`);
    const snapshot = await get(cacheRef);

    if (snapshot.exists()) {
      const cached = snapshot.val();
      if (cached.timestamp && (now - cached.timestamp) < CACHE_DURATION) {
        memoryCache.dashboards[cacheKey] = cached.data;
        return cached.data;
      }
    }
  } catch {
    // Firebase cache miss
  }

  // Fetch from API
  const genderPath = gender === 'womens' ? 'women' : 'men';
  const response = await fetch(`${RTN_BASE_URL}/${genderPath}/dashboard/${year}/${teamId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch team dashboard: ${response.status}`);
  }
  const data = await response.json();

  // Store in Firebase
  try {
    const cacheRef = ref(db, `rtnCache/dashboards/${cacheKey}`);
    await set(cacheRef, {
      data: data,
      timestamp: now,
      fetchedAt: new Date(now).toISOString(),
    });
  } catch {
    // Firebase write failed
  }

  // Store in memory
  memoryCache.dashboards[cacheKey] = data;

  return data;
}

/**
 * Get team ID from team name using cached teams data
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<string | null>}
 */
export async function getTeamId(teamName, gender = 'mens') {
  try {
    const data = await getCachedTeams(gender);
    const normalizedSearch = normalizeTeamName(teamName);

    const team = data.teams.find(t => {
      const normalizedName = normalizeTeamName(t.team_name);
      const normalizedFull = normalizeTeamName(t.full_team_name);
      const normalizedShort = normalizeTeamName(t.short_name);

      return normalizedName === normalizedSearch ||
             normalizedFull.includes(normalizedSearch) ||
             normalizedShort === normalizedSearch ||
             normalizedSearch.includes(normalizedName);
    });

    return team?.id || null;
  } catch {
    return null;
  }
}

/**
 * Get full team dashboard by team name (convenience function)
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @param {number} year
 * @returns {Promise<Object | null>}
 */
export async function getTeamDashboard(teamName, gender = 'womens', year = new Date().getFullYear()) {
  const teamId = await getTeamId(teamName, gender);
  if (!teamId) return null;

  return fetchTeamDashboard(teamId, gender, year);
}

/**
 * Get coaching staff for a team
 * Returns all coaches including head coach and assistants
 *
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<Array<{id: string, firstName: string, lastName: string, fullName: string, position: string, email: string, imageUrl: string}>>}
 */
export async function getCoachingStaff(teamName, gender = 'womens') {
  try {
    const dashboard = await getTeamDashboard(teamName, gender);
    if (!dashboard?.staff) return [];

    return dashboard.staff
      .filter(s => s.position.toLowerCase().includes('coach'))
      .map(s => ({
        id: s.id,
        firstName: s.first_name?.trim() || '',
        lastName: s.last_name?.trim() || '',
        fullName: `${s.first_name?.trim() || ''} ${s.last_name?.trim() || ''}`.trim(),
        position: s.position,
        email: s.email || '',
        imageUrl: s.image_url ? `https://www.roadtonationals.com/images/staff/${s.image_url}` : null,
      }))
      .sort((a, b) => {
        // Head coach first, then assistants
        if (a.position.toLowerCase().includes('head')) return -1;
        if (b.position.toLowerCase().includes('head')) return 1;
        return 0;
      });
  } catch {
    return [];
  }
}

/**
 * Get team social media links
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<Object>} Links object with facebook, twitter, instagram, etc.
 */
export async function getTeamSocialLinks(teamName, gender = 'womens') {
  try {
    const dashboard = await getTeamDashboard(teamName, gender);
    if (!dashboard?.links) return {};

    const links = {};
    for (const link of dashboard.links) {
      const type = link.tax_value?.toLowerCase() || '';
      if (type.includes('facebook')) links.facebook = link.link;
      else if (type.includes('twitter')) links.twitter = link.link;
      else if (type.includes('instagram')) links.instagram = link.link;
      else if (type.includes('official')) links.officialSite = link.link;
      else if (type.includes('schedule')) links.schedule = link.link;
      else if (type.includes('roster')) links.roster = link.link;
    }
    return links;
  } catch {
    return {};
  }
}

/**
 * Get team rankings
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<Object | null>} Rankings by event
 */
export async function getTeamRankings(teamName, gender = 'womens') {
  try {
    const dashboard = await getTeamDashboard(teamName, gender);
    if (!dashboard?.ranks) return null;

    const ranks = dashboard.ranks;
    if (gender === 'womens') {
      return {
        vault: ranks.vault ? parseInt(ranks.vault) : null,
        bars: ranks.bars ? parseInt(ranks.bars) : null,
        beam: ranks.beam ? parseInt(ranks.beam) : null,
        floor: ranks.floor ? parseInt(ranks.floor) : null,
        team: ranks.team ? parseInt(ranks.team) : null,
      };
    } else {
      // Men's events
      return {
        floor: ranks.floor ? parseInt(ranks.floor) : null,
        pommel: ranks.pommel ? parseInt(ranks.pommel) : null,
        rings: ranks.rings ? parseInt(ranks.rings) : null,
        vault: ranks.vault ? parseInt(ranks.vault) : null,
        pBars: ranks.pbars ? parseInt(ranks.pbars) : null,
        hBar: ranks.hbar ? parseInt(ranks.hbar) : null,
        team: ranks.team ? parseInt(ranks.team) : null,
      };
    }
  } catch {
    return null;
  }
}

/**
 * Get team roster from RTN dashboard
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<Array<{id: string, firstName: string, lastName: string, fullName: string, hometown: string, year: number}>>}
 */
export async function getRtnRoster(teamName, gender = 'womens') {
  try {
    const dashboard = await getTeamDashboard(teamName, gender);
    if (!dashboard?.roster) return [];

    return dashboard.roster.map(r => ({
      id: r.id,
      firstName: r.fname?.trim() || '',
      lastName: r.lname?.trim() || '',
      fullName: `${r.fname?.trim() || ''} ${r.lname?.trim() || ''}`.trim(),
      hometown: r.hometown || '',
      year: r.school_year ? parseInt(r.school_year) : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Get team schedule/meets from RTN dashboard
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<Array>}
 */
export async function getTeamSchedule(teamName, gender = 'womens') {
  try {
    const dashboard = await getTeamDashboard(teamName, gender);
    if (!dashboard?.meets) return [];

    return dashboard.meets.map(m => ({
      meetId: m.meet_id,
      date: m.meet_date,
      opponent: m.opponent,
      description: m.meet_desc || '',
      home: m.home === 'H',
      away: m.home === 'A',
      score: m.team_score ? parseFloat(m.team_score) : null,
    }));
  } catch {
    return [];
  }
}

// In-memory cache for current session (backed by Firebase when permissions allow)
// NOTE: Firebase rules must allow read/write to 'rtnCache' path for persistent caching.
// Update your Firebase Realtime Database rules to include:
//   "rtnCache": {
//     ".read": true,
//     ".write": true
//   }
// If Firebase permissions fail, falls back to in-memory caching only.
let memoryCache = {
  mens: null,
  womens: null,
  dashboards: {}, // Cache for team dashboards: { 'womens-66': {...}, 'mens-6': {...} }
};

/**
 * Get cached team data from Firebase (reduces API calls)
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<{year: string, teams: Array}>}
 */
export async function getCachedTeams(gender) {
  const now = Date.now();
  const cacheKey = gender === 'womens' ? 'womens' : 'mens';

  // Check in-memory cache first (fastest)
  if (memoryCache[cacheKey]) {
    return memoryCache[cacheKey];
  }

  // Check Firebase cache
  try {
    const cacheRef = ref(db, `rtnCache/${cacheKey}`);
    const snapshot = await get(cacheRef);

    if (snapshot.exists()) {
      const cached = snapshot.val();

      // Check if cache is still valid
      if (cached.timestamp && (now - cached.timestamp) < CACHE_DURATION) {
        // Store in memory for subsequent calls
        memoryCache[cacheKey] = cached.data;
        return cached.data;
      }
    }
  } catch {
    // Firebase cache miss - will fetch from API (permissions may not be set for rtnCache path)
  }

  // Cache miss or stale - fetch from API
  const data = await fetchTeams(gender);

  // Store in Firebase
  try {
    const cacheRef = ref(db, `rtnCache/${cacheKey}`);
    await set(cacheRef, {
      data: data,
      timestamp: now,
      fetchedAt: new Date(now).toISOString(),
    });
  } catch {
    // Firebase write failed - data still cached in memory for this session
  }

  // Store in memory
  memoryCache[cacheKey] = data;

  return data;
}

/**
 * Clear the team cache (both Firebase and memory)
 * @param {'mens' | 'womens' | 'all'} gender - Which cache to clear
 */
export async function clearTeamCache(gender = 'all') {
  if (gender === 'all' || gender === 'mens') {
    memoryCache.mens = null;
    try {
      await set(ref(db, 'rtnCache/mens'), null);
    } catch {
      // Firebase clear failed - memory cleared anyway
    }
  }

  if (gender === 'all' || gender === 'womens') {
    memoryCache.womens = null;
    try {
      await set(ref(db, 'rtnCache/womens'), null);
    } catch {
      // Firebase clear failed - memory cleared anyway
    }
  }
}

/**
 * Get head coach using cached data (faster for multiple lookups)
 * @param {string} teamName
 * @param {'mens' | 'womens'} gender
 * @returns {Promise<{firstName: string, lastName: string, fullName: string} | null>}
 */
export async function getHeadCoachCached(teamName, gender = 'mens') {
  try {
    const data = await getCachedTeams(gender);
    const coach = findCoachInData(teamName, data.teams);
    return coach;
  } catch (error) {
    console.error('Error fetching head coach:', error);
    return null;
  }
}

export default {
  // Teams list
  fetchWomensTeams,
  fetchMensTeams,
  fetchTeams,
  getCachedTeams,
  clearTeamCache,

  // Head coach (from teams list)
  getHeadCoach,
  getHeadCoachCached,
  getHeadCoaches,

  // Team info (basic)
  getTeamInfo,
  getTeamId,

  // Team dashboard (full data)
  fetchTeamDashboard,
  getTeamDashboard,
  getCoachingStaff,
  getTeamSocialLinks,
  getTeamRankings,
  getRtnRoster,
  getTeamSchedule,

  // Schedule
  getWeeklySchedule,
  getYearWeeks,
};
