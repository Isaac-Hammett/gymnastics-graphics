import { useEffect, useState, useCallback } from 'react';
import { db, ref, onValue, set, update, remove, get } from '../lib/firebase';
import { getTeamDashboard } from '../lib/roadToNationals';
import { normalizeName, getLookupKeys } from '../lib/nameNormalization';

/**
 * Fetch all headshots from Firebase teamsDatabase
 * Returns a map with multiple keys per headshot for flexible matching
 * Keys include: normalized name, stripped version, Firebase key variant
 */
async function getFirebaseHeadshots() {
  try {
    const headshotsRef = ref(db, 'teamsDatabase/headshots');
    const snapshot = await get(headshotsRef);
    const headshotsData = snapshot.val() || {};

    // Build a map with multiple keys per headshot for flexible matching
    const headshotMap = {};
    for (const [key, data] of Object.entries(headshotsData)) {
      if (data?.url) {
        // Store by Firebase key (underscores → spaces)
        const keyWithSpaces = key.toLowerCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
        headshotMap[keyWithSpaces] = data.url;

        // Store by fully normalized key
        const normalizedKey = normalizeName(key);
        headshotMap[normalizedKey] = data.url;

        // Store by name field if available
        if (data.name) {
          headshotMap[normalizeName(data.name)] = data.url;
          // Also store just lowercased version
          headshotMap[data.name.toLowerCase().trim().replace(/\s+/g, ' ')] = data.url;
        }

        // Store stripped version (only letters and spaces)
        const strippedKey = normalizedKey.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
        if (strippedKey && strippedKey.length > 2) {
          headshotMap[strippedKey] = data.url;
        }
      }
    }
    return headshotMap;
  } catch (err) {
    console.error('Failed to fetch Firebase headshots:', err);
    return {};
  }
}

/**
 * Look up a headshot URL from the headshot map using multiple lookup keys
 * Handles accents, hyphens, apostrophes, and other edge cases
 */
function lookupHeadshot(headshotMap, firstName, lastName) {
  if (!firstName && !lastName) return null;

  // Get all possible lookup keys for this name
  const keys = getLookupKeys(firstName, lastName);

  // Try each key until we find a match
  for (const key of keys) {
    if (headshotMap[key]) {
      return headshotMap[key];
    }
  }

  return null;
}

/**
 * Parse Virtius roster HTML to extract RTN IDs and headshot URLs
 * @param {string} html - Raw HTML from Virtius roster table
 * @returns {Array<{rtnId: string, headshotUrl: string, name: string}>}
 */
export function parseVirtiusRosterHtml(html) {
  const results = [];

  // Match each row: find athlete name, headshot URL, and RTN ID
  // Pattern: img src for headshot, then name in a div, then rtnId in an input
  const rowRegex = /<tr[^>]*role="row"[^>]*>([\s\S]*?)<\/tr>/gi;
  const imgRegex = /src="(https:\/\/media\.virti\.us\/upload\/images\/athlete\/[^"]+)"/i;
  const nameRegex = /alt="([^"]+)\s+Profile"/i;
  const rtnIdRegex = /<input[^>]*readonly[^>]*value="(\d+)"/i;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];

    const imgMatch = rowHtml.match(imgRegex);
    const nameMatch = rowHtml.match(nameRegex);
    const rtnIdMatch = rowHtml.match(rtnIdRegex);

    if (imgMatch && rtnIdMatch) {
      results.push({
        headshotUrl: imgMatch[1],
        name: nameMatch ? nameMatch[1] : 'Unknown',
        rtnId: rtnIdMatch[1],
      });
    }
  }

  return results;
}

/**
 * Fetch RTN dashboard data for all teams in a competition config
 * Returns an object with team1, team2, etc. keys containing RTN data
 * Also merges headshots from Firebase teamsDatabase if available
 */
async function enrichTeamsWithRTN(config, gender = 'womens') {
  const teamData = {};
  const teamNames = [
    config.team1Name,
    config.team2Name,
    config.team3Name,
    config.team4Name,
    config.team5Name,
    config.team6Name,
  ].filter(Boolean); // Remove empty team names

  // Fetch RTN team dashboards and Firebase headshots in parallel
  const [rtnResults, firebaseHeadshots] = await Promise.all([
    Promise.allSettled(teamNames.map(name => getTeamDashboard(name, gender))),
    getFirebaseHeadshots()
  ]);

  rtnResults.forEach((result, index) => {
    const teamKey = `team${index + 1}`;
    if (result.status === 'fulfilled' && result.value) {
      const dashboard = result.value;

      // Extract and normalize the data we care about
      teamData[teamKey] = {
        rtnId: dashboard.id || null,
        fetchedAt: new Date().toISOString(),

        // Coaching staff (filtered to coaches only)
        coaches: (dashboard.staff || [])
          .filter(s => s.position?.toLowerCase().includes('coach'))
          .map(s => ({
            id: s.id,
            firstName: s.first_name?.trim() || '',
            lastName: s.last_name?.trim() || '',
            fullName: `${s.first_name?.trim() || ''} ${s.last_name?.trim() || ''}`.trim(),
            position: s.position,
            imageUrl: s.image_url ? `https://www.roadtonationals.com/images/staff/${s.image_url}` : null,
          }))
          .sort((a, b) => {
            if (a.position?.toLowerCase().includes('head')) return -1;
            if (b.position?.toLowerCase().includes('head')) return 1;
            return 0;
          }),

        // Rankings
        rankings: dashboard.ranks ? (gender === 'womens' ? {
          vault: dashboard.ranks.vault ? parseInt(dashboard.ranks.vault) : null,
          bars: dashboard.ranks.bars ? parseInt(dashboard.ranks.bars) : null,
          beam: dashboard.ranks.beam ? parseInt(dashboard.ranks.beam) : null,
          floor: dashboard.ranks.floor ? parseInt(dashboard.ranks.floor) : null,
          team: dashboard.ranks.team ? parseInt(dashboard.ranks.team) : null,
        } : {
          floor: dashboard.ranks.floor ? parseInt(dashboard.ranks.floor) : null,
          pommel: dashboard.ranks.phorse ? parseInt(dashboard.ranks.phorse) : null,
          rings: dashboard.ranks.rings ? parseInt(dashboard.ranks.rings) : null,
          vault: dashboard.ranks.vault ? parseInt(dashboard.ranks.vault) : null,
          pBars: dashboard.ranks.pbars ? parseInt(dashboard.ranks.pbars) : null,
          hBar: dashboard.ranks.highbar ? parseInt(dashboard.ranks.highbar) : null,
          team: dashboard.ranks.team ? parseInt(dashboard.ranks.team) : null,
        }) : null,

        // Team scoring stats (from RTN 'test' field)
        stats: dashboard.test ? {
          average: dashboard.test.ave || null,
          high: dashboard.test.high || null,
          rqs: dashboard.test.rqs || null, // Ranking Qualifying Score
        } : null,

        // Roster - merge with Firebase headshots by matching athlete names
        // Uses lookupHeadshot which tries multiple normalized keys for flexible matching
        roster: (dashboard.roster || []).map(r => {
          const firstName = r.fname?.trim() || '';
          const lastName = r.lname?.trim() || '';
          const fullName = `${firstName} ${lastName}`.trim();
          const headshotUrl = lookupHeadshot(firebaseHeadshots, firstName, lastName);

          return {
            id: r.id,
            firstName,
            lastName,
            fullName,
            hometown: r.hometown || '',
            year: r.school_year ? parseInt(r.school_year) : null,
            headshotUrl, // Merged from Firebase teamsDatabase using flexible matching
          };
        }),

        // Social links
        links: (() => {
          const links = {};
          for (const link of (dashboard.links || [])) {
            const type = link.tax_value?.toLowerCase() || '';
            if (type.includes('facebook')) links.facebook = link.link;
            else if (type.includes('twitter')) links.twitter = link.link;
            else if (type.includes('instagram')) links.instagram = link.link;
            else if (type.includes('official')) links.officialSite = link.link;
          }
          return links;
        })(),

        // Schedule
        schedule: (dashboard.meets || []).map(m => ({
          meetId: m.meet_id,
          date: m.meet_date,
          opponent: m.opponent,
          description: m.meet_desc || '',
          home: m.home === 'H',
          away: m.home === 'A',
          score: m.team_score ? parseFloat(m.team_score) : null,
        })),
      };
    }
  });

  return teamData;
}

/**
 * Validate VM address format (host:port)
 * @param {string} address - The VM address to validate
 * @returns {boolean} True if valid format
 */
export function isValidVmAddress(address) {
  if (!address || typeof address !== 'string') return false;

  // Match host:port format
  // Host can be IP address (xxx.xxx.xxx.xxx) or hostname (letters, numbers, dots, hyphens)
  // Port must be 1-65535
  const vmAddressRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?:\d{1,5}$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/;

  if (!vmAddressRegex.test(address)) return false;

  // Extract and validate port range
  const parts = address.split(':');
  const port = parseInt(parts[parts.length - 1], 10);

  return port >= 1 && port <= 65535;
}

/**
 * Check VM status by fetching /api/status endpoint
 * @param {string} vmAddress - The VM address (host:port format, no protocol)
 * @param {number} timeout - Timeout in milliseconds (default 5000)
 * @returns {Promise<{online: boolean, obsConnected?: boolean, error?: string}>}
 */
export async function checkVmStatus(vmAddress, timeout = 5000) {
  if (!isValidVmAddress(vmAddress)) {
    return { online: false, error: 'Invalid VM address format' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`http://${vmAddress}/api/status`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { online: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    return {
      online: true,
      obsConnected: data.obsConnected || false,
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return { online: false, error: 'Request timed out' };
    }

    return { online: false, error: err.message || 'Connection failed' };
  }
}

export function useCompetitions() {
  const [competitions, setCompetitions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const competitionsRef = ref(db, 'competitions');

    const unsubscribe = onValue(competitionsRef, (snapshot) => {
      setCompetitions(snapshot.val() || {});
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createCompetition = useCallback(async (compId, config, options = {}) => {
    try {
      await set(ref(db, `competitions/${compId}/config`), config);

      // Optionally enrich with RTN data
      if (options.enrichWithRTN !== false) {
        // Use explicit gender field if available, otherwise extract from compType (backward compatibility)
        const gender = config.gender || (config.compType?.startsWith('womens') ? 'womens' : 'mens');
        const teamData = await enrichTeamsWithRTN(config, gender);
        if (Object.keys(teamData).length > 0) {
          await set(ref(db, `competitions/${compId}/teamData`), teamData);

          // Also sync coaches to config as newline-separated strings for graphics
          const configUpdates = {};
          for (const teamKey of Object.keys(teamData)) {
            const coaches = teamData[teamKey]?.coaches;
            if (coaches && Array.isArray(coaches) && coaches.length > 0) {
              const coachesString = coaches.map(c => c.fullName).join('\n');
              configUpdates[`${teamKey}Coaches`] = coachesString;
            }
          }

          if (Object.keys(configUpdates).length > 0) {
            await update(ref(db, `competitions/${compId}/config`), configUpdates);
          }
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const updateCompetition = useCallback(async (compId, config, options = {}) => {
    try {
      await update(ref(db, `competitions/${compId}/config`), config);

      // Optionally refresh RTN data (useful when team names change)
      if (options.refreshRTN) {
        // Use explicit gender field if available, otherwise extract from compType (backward compatibility)
        const gender = config.gender || (config.compType?.startsWith('womens') ? 'womens' : 'mens');
        const teamData = await enrichTeamsWithRTN(config, gender);
        if (Object.keys(teamData).length > 0) {
          await set(ref(db, `competitions/${compId}/teamData`), teamData);

          // Also sync coaches to config as newline-separated strings for graphics
          const configUpdates = {};
          for (const teamKey of Object.keys(teamData)) {
            const coaches = teamData[teamKey]?.coaches;
            if (coaches && Array.isArray(coaches) && coaches.length > 0) {
              const coachesString = coaches.map(c => c.fullName).join('\n');
              configUpdates[`${teamKey}Coaches`] = coachesString;
            }
          }

          if (Object.keys(configUpdates).length > 0) {
            await update(ref(db, `competitions/${compId}/config`), configUpdates);
          }
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Manually refresh RTN team data for a competition
  // Also syncs coaches to config for graphics to use
  const refreshTeamData = useCallback(async (compId) => {
    try {
      const configRef = ref(db, `competitions/${compId}/config`);
      const snapshot = await get(configRef);
      const config = snapshot.val();

      if (!config) {
        return { success: false, error: 'Competition not found' };
      }

      // Use explicit gender field if available, otherwise extract from compType (backward compatibility)
      const gender = config.gender || (config.compType?.startsWith('womens') ? 'womens' : 'mens');
      const teamData = await enrichTeamsWithRTN(config, gender);

      if (Object.keys(teamData).length > 0) {
        // Save rich teamData to Firebase
        try {
          await set(ref(db, `competitions/${compId}/teamData`), teamData);
        } catch (err) {
          console.error('[refreshTeamData] Failed to save teamData:', err);
        }

        // Sync coaches to config for graphics
        const configUpdates = {};
        for (const teamKey of Object.keys(teamData)) {
          const coaches = teamData[teamKey]?.coaches;
          if (coaches && Array.isArray(coaches) && coaches.length > 0) {
            configUpdates[`${teamKey}Coaches`] = coaches.map(c => c.fullName).join('\n');
          }
          // Note: Stats (AVE, HIGH) are entered manually - RTN data format needs investigation
        }

        if (Object.keys(configUpdates).length > 0) {
          await update(ref(db, `competitions/${compId}/config`), configUpdates);
        }

        return { success: true, teamsEnriched: Object.keys(teamData).length };
      }

      return { success: true, teamsEnriched: 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const deleteCompetition = useCallback(async (compId) => {
    try {
      await remove(ref(db, `competitions/${compId}`));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const duplicateCompetition = useCallback(async (sourceCompId, newCompId) => {
    try {
      const sourceRef = ref(db, `competitions/${sourceCompId}/config`);
      const snapshot = await get(sourceRef);
      const sourceConfig = snapshot.val();

      if (!sourceConfig) {
        return { success: false, error: 'Source competition has no configuration' };
      }

      const duplicateConfig = {
        ...sourceConfig,
        eventName: sourceConfig.eventName ? sourceConfig.eventName + ' (Copy)' : 'Copy'
      };

      await set(ref(db, `competitions/${newCompId}/config`), duplicateConfig);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Add headshots to a team's roster by matching RTN IDs
   * @param {string} compId - Competition ID
   * @param {string} teamKey - Team key (e.g., 'team1', 'team2')
   * @param {Array<{rtnId: string, headshotUrl: string}>} headshots - Array of RTN ID to headshot URL mappings
   * @returns {Promise<{success: boolean, matched: number, error?: string}>}
   */
  const addTeamHeadshots = useCallback(async (compId, teamKey, headshots) => {
    try {
      const rosterRef = ref(db, `competitions/${compId}/teamData/${teamKey}/roster`);
      const snapshot = await get(rosterRef);
      const roster = snapshot.val();

      if (!roster || !Array.isArray(roster)) {
        return { success: false, error: 'No roster found for this team' };
      }

      // Create a map of RTN ID to headshot URL for quick lookup
      const headshotMap = new Map();
      for (const { rtnId, headshotUrl } of headshots) {
        headshotMap.set(String(rtnId), headshotUrl);
      }

      // Update roster with headshots
      let matched = 0;
      const updatedRoster = roster.map(athlete => {
        const headshotUrl = headshotMap.get(String(athlete.id));
        if (headshotUrl) {
          matched++;
          return { ...athlete, headshotUrl };
        }
        return athlete;
      });

      await set(rosterRef, updatedRoster);
      return { success: true, matched };
    } catch (err) {
      return { success: false, matched: 0, error: err.message };
    }
  }, []);

  /**
   * Update the VM address for a competition
   * @param {string} compId - Competition ID
   * @param {string} vmAddress - VM address in host:port format (e.g., '3.81.127.185:3003')
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const updateVmAddress = useCallback(async (compId, vmAddress) => {
    // Validate vmAddress format before saving
    if (vmAddress && !isValidVmAddress(vmAddress)) {
      return { success: false, error: 'Invalid VM address format. Expected host:port (e.g., 192.168.1.1:3003)' };
    }

    try {
      await update(ref(db, `competitions/${compId}/config`), {
        vmAddress: vmAddress || null,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  return {
    competitions,
    loading,
    error,
    createCompetition,
    updateCompetition,
    deleteCompetition,
    duplicateCompetition,
    refreshTeamData,
    addTeamHeadshots,
    updateVmAddress,
    isValidVmAddress,
    checkVmStatus,
  };
}

export function useCompetition(compId) {
  const [config, setConfig] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [currentGraphic, setCurrentGraphic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!compId) {
      setLoading(false);
      return;
    }

    const configRef = ref(db, `competitions/${compId}/config`);
    const teamDataRef = ref(db, `competitions/${compId}/teamData`);
    const graphicRef = ref(db, `competitions/${compId}/currentGraphic`);

    const unsubConfig = onValue(configRef, (snapshot) => {
      setConfig(snapshot.val());
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    const unsubTeamData = onValue(teamDataRef, (snapshot) => {
      setTeamData(snapshot.val());
    });

    const unsubGraphic = onValue(graphicRef, (snapshot) => {
      setCurrentGraphic(snapshot.val());
    });

    return () => {
      unsubConfig();
      unsubTeamData();
      unsubGraphic();
    };
  }, [compId]);

  const updateConfig = useCallback(async (updates) => {
    if (!compId) return { success: false, error: 'No competition ID' };
    try {
      await update(ref(db, `competitions/${compId}/config`), updates);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [compId]);

  const setGraphic = useCallback(async (graphic, data = {}) => {
    if (!compId) return { success: false, error: 'No competition ID' };
    try {
      await set(ref(db, `competitions/${compId}/currentGraphic`), {
        graphic,
        data,
        timestamp: Date.now()
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [compId]);

  const clearGraphic = useCallback(async () => {
    return setGraphic('clear', {});
  }, [setGraphic]);

  return {
    config,
    teamData,
    currentGraphic,
    loading,
    error,
    updateConfig,
    setGraphic,
    clearGraphic,
  };
}
