import { useEffect, useState, useCallback } from 'react';
import { db, ref, onValue, set, update, get } from '../lib/firebase';
import {
  normalizeName,
  getSafeFirebaseKey,
  getLookupKeys,
} from '../lib/nameNormalization';

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
 *
 * Name normalization is handled by the shared nameNormalization.js utility
 * to ensure consistent matching across all components.
 */

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
  // IMPORTANT: Team keys use hyphens (e.g., "army-mens") and should NOT be
  // run through normalizeName() which converts hyphens to spaces.
  // Team keys are stored as-is in Firebase.

  /**
   * Add or update a team
   * @param {string} teamKey - Team key with hyphens (e.g., "army-mens")
   */
  const saveTeam = useCallback(async (teamKey, teamData) => {
    try {
      // Use teamKey directly - do NOT normalize (hyphens are intentional)
      await set(ref(db, `teamsDatabase/teams/${teamKey}`), {
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
   * @param {string} teamKey - Team key with hyphens (e.g., "army-mens")
   */
  const updateTeamLogo = useCallback(async (teamKey, logoUrl) => {
    try {
      // Use teamKey directly - do NOT normalize
      await update(ref(db, `teamsDatabase/teams/${teamKey}`), {
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
   * @param {string} teamKey - Team key with hyphens (e.g., "army-mens")
   */
  const updateTeamRoster = useCallback(async (teamKey, roster) => {
    try {
      // Use teamKey directly - do NOT normalize
      await update(ref(db, `teamsDatabase/teams/${teamKey}`), {
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
   * Uses unified normalization from nameNormalization.js
   */
  const saveHeadshot = useCallback(async (athleteName, headshotUrl, teamKey = null) => {
    try {
      const normalized = normalizeName(athleteName);
      // Firebase keys can't contain . # $ [ ] / so we encode them
      const safeKey = getSafeFirebaseKey(normalized);
      await set(ref(db, `teamsDatabase/headshots/${safeKey}`), {
        name: athleteName,  // Store original name for display
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
   * Uses unified normalization from nameNormalization.js
   */
  const saveHeadshots = useCallback(async (headshotsArray, teamKey = null) => {
    try {
      const updates = {};
      for (const { name, headshotUrl } of headshotsArray) {
        const normalized = normalizeName(name);
        const safeKey = getSafeFirebaseKey(normalized);
        updates[`teamsDatabase/headshots/${safeKey}`] = {
          name: name,  // Store original name for display
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
   * Note: Team key is used as-is (not normalized) since Firebase stores
   * team keys with hyphens (e.g., "army-mens")
   */
  const importRoster = useCallback(async (teamKey, athletes) => {
    try {
      // Team key is used directly - do NOT normalize (hyphens are intentional)
      // 1. Update team roster with athlete names
      const rosterNames = athletes.map(a => a.name);
      await update(ref(db, `teamsDatabase/teams/${teamKey}`), {
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
   * Note: Team keys should NOT be normalized - they use hyphens (e.g., "army-mens")
   * and are stored as-is in Firebase
   */
  const getTeam = useCallback((teamKey) => {
    if (!teamKey) return null;
    // Direct lookup - team keys are stored with hyphens, not normalized
    return teams[teamKey] || null;
  }, [teams]);

  /**
   * Get team logo with flexible matching
   * @param {string} teamName - Team name in any format
   * @param {'womens' | 'mens' | null} preferredGender - Preferred gender for fallback lookup
   */
  const getTeamLogo = useCallback((teamName, preferredGender = null) => {
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

    // Determine lookup order based on preferredGender
    const genderOrder = preferredGender === 'womens'
      ? ['womens', 'mens']
      : ['mens', 'womens'];

    // Check aliases
    const aliasKey = aliases[withoutGender];
    if (aliasKey) {
      for (const gender of genderOrder) {
        const team = teams[`${aliasKey}-${gender}`];
        if (team?.logo) return team.logo;
      }
    }

    // Try direct school match with gender preference
    for (const gender of genderOrder) {
      if (teams[`${withoutGender}-${gender}`]?.logo) {
        return teams[`${withoutGender}-${gender}`].logo;
      }
    }

    return '';
  }, [teams, aliases]);

  /**
   * Get athlete headshot URL using flexible lookup
   * Tries multiple normalized keys to handle accents, hyphens, etc.
   *
   * Lookup order (optimized for speed):
   * 1. Safe Firebase key (most likely match - this is how we save)
   * 2. Normalized name (fallback for legacy data)
   * 3. Extended keys for edge cases (accents, middle names, etc.)
   */
  const getHeadshot = useCallback((athleteName) => {
    if (!athleteName) return '';

    // Primary lookup: normalize name and convert to safe Firebase key
    // This matches how saveHeadshot() stores the data
    const normalized = normalizeName(athleteName);
    const safeKey = getSafeFirebaseKey(normalized);

    // Try safe key first (this is how we save headshots)
    if (headshots[safeKey]?.url) {
      return headshots[safeKey].url;
    }

    // Fallback: try normalized name without safe key transformation
    // (handles legacy data or data imported differently)
    if (headshots[normalized]?.url) {
      return headshots[normalized].url;
    }

    // Extended fallback: use getLookupKeys for edge cases (accents, middle names, etc.)
    const parts = athleteName.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const keys = getLookupKeys(firstName, lastName);

    for (const key of keys) {
      const keySafe = getSafeFirebaseKey(key);
      if (headshots[keySafe]?.url) {
        return headshots[keySafe].url;
      }
      if (headshots[key]?.url) {
        return headshots[key].url;
      }
    }

    return '';
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

  // ============================================
  // DIAGNOSTICS
  // ============================================

  /**
   * Run data integrity diagnostics
   * Checks for common issues like orphaned headshots, missing data, etc.
   * @returns {Object} Diagnostic results with issues found
   */
  const runDiagnostics = useCallback(() => {
    const issues = [];
    const stats = {
      totalTeams: Object.keys(teams).length,
      totalHeadshots: Object.keys(headshots).length,
      teamsWithRosters: 0,
      teamsWithLogos: 0,
      totalRosterEntries: 0,
      headshotsMatched: 0,
      headshotsOrphaned: 0,
    };

    // Check each team
    for (const [teamKey, team] of Object.entries(teams)) {
      if (team.logo) stats.teamsWithLogos++;
      if (team.roster?.length > 0) {
        stats.teamsWithRosters++;
        stats.totalRosterEntries += team.roster.length;

        // Check each roster entry for headshot
        for (const name of team.roster) {
          const headshotUrl = getHeadshot(name);
          if (!headshotUrl) {
            issues.push({
              type: 'missing_headshot',
              severity: 'warning',
              teamKey,
              athleteName: name,
              message: `No headshot found for "${name}" on ${team.displayName || teamKey}`,
            });
          } else {
            stats.headshotsMatched++;
          }
        }
      }

      // Check for missing required fields
      if (!team.displayName) {
        issues.push({
          type: 'missing_field',
          severity: 'error',
          teamKey,
          field: 'displayName',
          message: `Team "${teamKey}" is missing displayName`,
        });
      }
      if (!team.school) {
        issues.push({
          type: 'missing_field',
          severity: 'error',
          teamKey,
          field: 'school',
          message: `Team "${teamKey}" is missing school name`,
        });
      }
      if (!team.gender) {
        issues.push({
          type: 'missing_field',
          severity: 'error',
          teamKey,
          field: 'gender',
          message: `Team "${teamKey}" is missing gender`,
        });
      }
    }

    // Check for headshots with invalid teamKey references
    for (const [key, headshot] of Object.entries(headshots)) {
      if (headshot.teamKey && !teams[headshot.teamKey]) {
        issues.push({
          type: 'orphaned_headshot',
          severity: 'warning',
          headshotKey: key,
          athleteName: headshot.name,
          referencedTeam: headshot.teamKey,
          message: `Headshot for "${headshot.name}" references non-existent team "${headshot.teamKey}"`,
        });
        stats.headshotsOrphaned++;
      }
    }

    // Calculate unmatched headshots (headshots not in any roster)
    const rosterNames = new Set();
    for (const team of Object.values(teams)) {
      if (team.roster) {
        for (const name of team.roster) {
          const normalized = normalizeName(name);
          const safeKey = getSafeFirebaseKey(normalized);
          rosterNames.add(normalized);
          rosterNames.add(safeKey);
        }
      }
    }

    return {
      stats,
      issues,
      summary: {
        totalIssues: issues.length,
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        missingHeadshots: issues.filter(i => i.type === 'missing_headshot').length,
        orphanedHeadshots: issues.filter(i => i.type === 'orphaned_headshot').length,
        missingFields: issues.filter(i => i.type === 'missing_field').length,
      },
    };
  }, [teams, headshots, getHeadshot]);

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

    // Diagnostics
    runDiagnostics,
  };
}

export default useTeamsDatabase;
