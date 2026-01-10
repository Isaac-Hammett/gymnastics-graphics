import { useEffect, useState, useCallback } from 'react';
import { db, ref, onValue, set, update, get } from '../lib/firebase';

/**
 * Firebase-backed teams database hook
 * Stores team logos, rosters, and athlete headshots in Firebase
 *
 * Firebase structure:
 * teamsDatabase/
 *   teams/
 *     {teamKey}/  (e.g., 'army-mens', 'cal-womens')
 *       displayName: "Army Men's"
 *       school: "Army"
 *       gender: "mens"
 *       logo: "https://media.virti.us/..."
 *       roster: ["Ben Aguilar", "Carter Beck", ...]
 *   headshots/
 *     {normalizedName}/  (e.g., 'ben aguilar')
 *       url: "https://media.virti.us/..."
 *       teamKey: "army-mens"  (optional, for reference)
 *   aliases/
 *     {alias}: {schoolKey}  (e.g., 'california': 'cal')
 */

// Normalize name for lookup (lowercase, trim, collapse spaces)
function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Hook to access and manage the teams database in Firebase
 */
export function useTeamsDatabase() {
  const [teams, setTeams] = useState({});
  const [headshots, setHeadshots] = useState({});
  const [aliases, setAliases] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subscribe to teams database
  useEffect(() => {
    const teamsRef = ref(db, 'teamsDatabase/teams');
    const headshotsRef = ref(db, 'teamsDatabase/headshots');
    const aliasesRef = ref(db, 'teamsDatabase/aliases');

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) setLoading(false);
    };

    const unsubTeams = onValue(teamsRef, (snapshot) => {
      setTeams(snapshot.val() || {});
      checkLoaded();
    }, (err) => {
      setError(err.message);
      checkLoaded();
    });

    const unsubHeadshots = onValue(headshotsRef, (snapshot) => {
      setHeadshots(snapshot.val() || {});
      checkLoaded();
    }, (err) => {
      setError(err.message);
      checkLoaded();
    });

    const unsubAliases = onValue(aliasesRef, (snapshot) => {
      setAliases(snapshot.val() || {});
      checkLoaded();
    }, (err) => {
      setError(err.message);
      checkLoaded();
    });

    return () => {
      unsubTeams();
      unsubHeadshots();
      unsubAliases();
    };
  }, []);

  // ============================================
  // TEAM OPERATIONS
  // ============================================

  /**
   * Add or update a team
   */
  const saveTeam = useCallback(async (teamKey, teamData) => {
    try {
      const normalized = normalizeName(teamKey);
      await set(ref(db, `teamsDatabase/teams/${normalized}`), {
        displayName: teamData.displayName,
        school: teamData.school,
        gender: teamData.gender,
        logo: teamData.logo || '',
        roster: teamData.roster || [],
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Update team logo
   */
  const updateTeamLogo = useCallback(async (teamKey, logoUrl) => {
    try {
      const normalized = normalizeName(teamKey);
      await update(ref(db, `teamsDatabase/teams/${normalized}`), {
        logo: logoUrl,
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Update team roster (array of athlete names)
   */
  const updateTeamRoster = useCallback(async (teamKey, roster) => {
    try {
      const normalized = normalizeName(teamKey);
      await update(ref(db, `teamsDatabase/teams/${normalized}`), {
        roster: roster,
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ============================================
  // HEADSHOT OPERATIONS
  // ============================================

  /**
   * Save a single athlete headshot
   */
  const saveHeadshot = useCallback(async (athleteName, headshotUrl, teamKey = null) => {
    try {
      const normalized = normalizeName(athleteName);
      // Firebase keys can't contain . # $ [ ] so we encode them
      const safeKey = normalized.replace(/[.#$[\]]/g, '_');
      await set(ref(db, `teamsDatabase/headshots/${safeKey}`), {
        name: athleteName,
        url: headshotUrl,
        teamKey: teamKey,
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Save multiple headshots at once (batch operation)
   */
  const saveHeadshots = useCallback(async (headshotsArray, teamKey = null) => {
    try {
      const updates = {};
      for (const { name, headshotUrl } of headshotsArray) {
        const normalized = normalizeName(name);
        const safeKey = normalized.replace(/[.#$[\]]/g, '_');
        updates[`teamsDatabase/headshots/${safeKey}`] = {
          name: name,
          url: headshotUrl,
          teamKey: teamKey,
          updatedAt: new Date().toISOString(),
        };
      }

      // Use update with full paths for atomic batch write
      const rootRef = ref(db);
      await update(rootRef, updates);
      return { success: true, count: headshotsArray.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Import a full roster with headshots from parsed Virtius data
   */
  const importRoster = useCallback(async (teamKey, athletes) => {
    try {
      const normalized = normalizeName(teamKey);

      // 1. Update team roster with athlete names
      const rosterNames = athletes.map(a => a.name);
      await update(ref(db, `teamsDatabase/teams/${normalized}`), {
        roster: rosterNames,
        updatedAt: new Date().toISOString(),
      });

      // 2. Save all headshots
      const headshotsToSave = athletes.map(a => ({
        name: a.name,
        headshotUrl: a.headshotUrl,
      }));
      await saveHeadshots(headshotsToSave, teamKey);

      return { success: true, athleteCount: athletes.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [saveHeadshots]);

  // ============================================
  // QUERY HELPERS
  // ============================================

  /**
   * Get team by key
   */
  const getTeam = useCallback((teamKey) => {
    const normalized = normalizeName(teamKey);
    return teams[normalized] || null;
  }, [teams]);

  /**
   * Get team logo with flexible matching
   */
  const getTeamLogo = useCallback((teamName) => {
    if (!teamName) return '';

    const normalized = normalizeName(teamName);

    // Direct match
    if (teams[normalized]) return teams[normalized].logo || '';

    // Try with -mens/-womens suffix removed
    const withoutGender = normalized
      .replace(/-mens$/, '')
      .replace(/-womens$/, '')
      .replace(/ men'?s?$/i, '')
      .replace(/ women'?s?$/i, '');

    // Check aliases
    const aliasKey = aliases[withoutGender];
    if (aliasKey) {
      const mensTeam = teams[`${aliasKey}-mens`];
      if (mensTeam?.logo) return mensTeam.logo;
      const womensTeam = teams[`${aliasKey}-womens`];
      if (womensTeam?.logo) return womensTeam.logo;
    }

    // Try direct school match
    if (teams[`${withoutGender}-mens`]?.logo) return teams[`${withoutGender}-mens`].logo;
    if (teams[`${withoutGender}-womens`]?.logo) return teams[`${withoutGender}-womens`].logo;

    return '';
  }, [teams, aliases]);

  /**
   * Get athlete headshot URL
   */
  const getHeadshot = useCallback((athleteName) => {
    if (!athleteName) return '';
    const normalized = normalizeName(athleteName);
    const safeKey = normalized.replace(/[.#$[\]]/g, '_');
    return headshots[safeKey]?.url || '';
  }, [headshots]);

  /**
   * Check if athlete has a headshot
   */
  const hasHeadshot = useCallback((athleteName) => {
    return !!getHeadshot(athleteName);
  }, [getHeadshot]);

  /**
   * Get roster with headshot info for a team
   */
  const getTeamRosterWithHeadshots = useCallback((teamKey) => {
    const team = getTeam(teamKey);
    if (!team?.roster) return [];

    return team.roster.map(name => ({
      name,
      hasHeadshot: hasHeadshot(name),
      headshotUrl: getHeadshot(name),
    }));
  }, [getTeam, hasHeadshot, getHeadshot]);

  /**
   * Get roster stats for a team
   */
  const getTeamRosterStats = useCallback((teamKey) => {
    const roster = getTeamRosterWithHeadshots(teamKey);
    const withHeadshots = roster.filter(a => a.hasHeadshot).length;
    return {
      total: roster.length,
      withHeadshots,
      percentage: roster.length > 0 ? Math.round((withHeadshots / roster.length) * 100) : 0,
    };
  }, [getTeamRosterWithHeadshots]);

  /**
   * Resolve a team name to a school key (handles aliases and variations)
   * E.g., "California" -> "cal", "Penn State" -> "penn-state"
   */
  const resolveSchoolKey = useCallback((teamName) => {
    if (!teamName) return null;

    const normalized = normalizeName(teamName)
      .replace(/ men'?s?$/i, '')
      .replace(/ women'?s?$/i, '')
      .replace(/-mens$/, '')
      .replace(/-womens$/, '');

    // Check aliases first
    if (aliases[normalized]) {
      return aliases[normalized];
    }

    // Check if any team key starts with this school name
    const possibleKeys = Object.keys(teams).filter(key =>
      key.startsWith(normalized + '-') ||
      key === normalized
    );

    if (possibleKeys.length > 0) {
      // Extract school part from key (e.g., "penn-state-mens" -> "penn-state")
      return possibleKeys[0].replace(/-mens$/, '').replace(/-womens$/, '');
    }

    // Try converting spaces to dashes
    const dashedName = normalized.replace(/ /g, '-');
    if (aliases[dashedName]) {
      return aliases[dashedName];
    }

    const dashedPossibleKeys = Object.keys(teams).filter(key =>
      key.startsWith(dashedName + '-') ||
      key === dashedName
    );

    if (dashedPossibleKeys.length > 0) {
      return dashedPossibleKeys[0].replace(/-mens$/, '').replace(/-womens$/, '');
    }

    return null;
  }, [teams, aliases]);

  /**
   * Get team with flexible matching (handles various name formats)
   * @param {string} teamName - Team name in any format (e.g., "Penn State", "California Men's")
   * @param {string} gender - Optional gender: 'mens' or 'womens'
   */
  const getTeamFlexible = useCallback((teamName, gender = null) => {
    if (!teamName) return null;

    // First try exact match
    const exactMatch = getTeam(teamName);
    if (exactMatch) return exactMatch;

    // Resolve to school key
    const schoolKey = resolveSchoolKey(teamName);
    if (!schoolKey) return null;

    // Determine gender from input
    const normalized = normalizeName(teamName);
    let targetGender = gender;
    if (!targetGender) {
      if (normalized.includes('women') || normalized.includes('womens')) {
        targetGender = 'womens';
      } else if (normalized.includes('men') || normalized.includes('mens')) {
        targetGender = 'mens';
      }
    }

    // Try to get team with specific gender
    if (targetGender) {
      const teamWithGender = teams[`${schoolKey}-${targetGender}`];
      if (teamWithGender) return teamWithGender;
    }

    // Try mens first, then womens
    if (teams[`${schoolKey}-mens`]) return teams[`${schoolKey}-mens`];
    if (teams[`${schoolKey}-womens`]) return teams[`${schoolKey}-womens`];

    return null;
  }, [teams, getTeam, resolveSchoolKey]);

  /**
   * Get roster stats with flexible matching
   * @param {string} teamName - Team name in any format
   * @param {string} gender - Optional gender
   */
  const getTeamRosterStatsFlexible = useCallback((teamName, gender = null) => {
    const team = getTeamFlexible(teamName, gender);
    if (!team?.roster?.length) {
      return { total: 0, withHeadshots: 0, percentage: 0 };
    }

    const withHeadshots = team.roster.filter(name => hasHeadshot(name)).length;
    return {
      total: team.roster.length,
      withHeadshots,
      percentage: Math.round((withHeadshots / team.roster.length) * 100),
    };
  }, [getTeamFlexible, hasHeadshot]);

  /**
   * Check if team has a roster (with flexible matching)
   */
  const hasTeamRoster = useCallback((teamName, gender = null) => {
    const team = getTeamFlexible(teamName, gender);
    return team?.roster?.length > 0;
  }, [getTeamFlexible]);

  /**
   * Get all team keys
   */
  const getAllTeamKeys = useCallback(() => {
    return Object.keys(teams);
  }, [teams]);

  /**
   * Get all schools (unique)
   */
  const getAllSchools = useCallback(() => {
    const schools = new Set();
    for (const team of Object.values(teams)) {
      if (team.school) schools.add(team.school);
    }
    return Array.from(schools).sort();
  }, [teams]);

  /**
   * Get teams grouped by school
   */
  const getTeamsBySchool = useCallback(() => {
    const bySchool = {};
    for (const [key, team] of Object.entries(teams)) {
      if (!team.school) continue;
      if (!bySchool[team.school]) {
        bySchool[team.school] = [];
      }
      bySchool[team.school].push({ key, ...team });
    }
    return bySchool;
  }, [teams]);

  // ============================================
  // MIGRATION HELPER
  // ============================================

  /**
   * Migrate data from static teamsDatabase.js to Firebase
   * Call this once to populate Firebase with existing data
   */
  const migrateFromStatic = useCallback(async (staticTeams, staticHeadshots, staticAliases) => {
    try {
      // Migrate teams
      for (const [key, team] of Object.entries(staticTeams)) {
        await saveTeam(key, team);
      }

      // Migrate headshots
      const headshotsArray = Object.entries(staticHeadshots).map(([name, url]) => ({
        name,
        headshotUrl: url,
      }));
      await saveHeadshots(headshotsArray);

      // Migrate aliases
      if (staticAliases) {
        await set(ref(db, 'teamsDatabase/aliases'), staticAliases);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [saveTeam, saveHeadshots]);

  return {
    // State
    teams,
    headshots,
    aliases,
    loading,
    error,

    // Team operations
    saveTeam,
    updateTeamLogo,
    updateTeamRoster,
    getTeam,
    getTeamLogo,
    getAllTeamKeys,
    getAllSchools,
    getTeamsBySchool,

    // Flexible team lookups (handle various name formats)
    getTeamFlexible,
    getTeamRosterStatsFlexible,
    hasTeamRoster,

    // Headshot operations
    saveHeadshot,
    saveHeadshots,
    getHeadshot,
    hasHeadshot,

    // Combined operations
    importRoster,
    getTeamRosterWithHeadshots,
    getTeamRosterStats,

    // Migration
    migrateFromStatic,
  };
}

export default useTeamsDatabase;
