/**
 * Rotation Schedule System
 *
 * Manages which team competes on which apparatus during each rotation.
 * This is essential for multi-team meets where different teams are on
 * different apparatus simultaneously.
 *
 * Meet Types:
 * - Dual (2 teams): Both teams on same event each rotation (head-to-head or alternating)
 * - Tri (3 teams): 3 teams on 3 events, 1 event empty per rotation (women's) or staggered (men's)
 * - Quad (4 teams): Perfect rotation for women's (4 teams, 4 events)
 * - 5-6 teams: Multiple teams may share an event
 *
 * Schedule Structure:
 * {
 *   rotationCount: number,
 *   schedule: {
 *     [rotation]: {
 *       [eventId]: string | string[] | null  // teamKey(s) or null if no team
 *     }
 *   }
 * }
 */

import { getEventsForGender, EVENT_ORDER } from './eventConfig';
import { getGenderFromCompType, getTeamCount } from './competitionUtils';

// ============================================================================
// ROTATION TEMPLATES
// ============================================================================

/**
 * Standard rotation templates for NCAA meets
 * These follow common NCAA conventions for each meet type.
 *
 * Team keys use 'team1', 'team2', etc. which map to config.team1Name, etc.
 * null = no team on that event for that rotation
 * Array = multiple teams on same event (dual meet head-to-head)
 */
export const ROTATION_TEMPLATES = {
  // ============================================
  // WOMEN'S MEETS (4 events: vault, bars, beam, floor)
  // ============================================

  /**
   * Women's Dual Meet - Head-to-Head Format
   * Both teams compete on the SAME event each rotation
   */
  'womens-dual-headtohead': {
    rotationCount: 4,
    format: 'head-to-head',
    schedule: {
      1: { vault: ['team1', 'team2'], bars: null, beam: null, floor: null },
      2: { vault: null, bars: ['team1', 'team2'], beam: null, floor: null },
      3: { vault: null, bars: null, beam: ['team1', 'team2'], floor: null },
      4: { vault: null, bars: null, beam: null, floor: ['team1', 'team2'] },
    },
  },

  /**
   * Women's Dual Meet - Alternating Format
   * Teams start on adjacent apparatus and swap each rotation
   * R1: Team1=VT, Team2=UB | R2: Team1=UB, Team2=VT
   * R3: Team1=BB, Team2=FX | R4: Team1=FX, Team2=BB
   */
  'womens-dual-alternating': {
    rotationCount: 4,
    format: 'alternating',
    schedule: {
      1: { vault: 'team1', bars: 'team2', beam: null, floor: null },
      2: { vault: 'team2', bars: 'team1', beam: null, floor: null },
      3: { vault: null, bars: null, beam: 'team1', floor: 'team2' },
      4: { vault: null, bars: null, beam: 'team2', floor: 'team1' },
    },
  },

  /**
   * Women's Dual Meet - Default (head-to-head)
   */
  'womens-dual': {
    rotationCount: 4,
    format: 'head-to-head',
    schedule: {
      1: { vault: ['team1', 'team2'], bars: null, beam: null, floor: null },
      2: { vault: null, bars: ['team1', 'team2'], beam: null, floor: null },
      3: { vault: null, bars: null, beam: ['team1', 'team2'], floor: null },
      4: { vault: null, bars: null, beam: null, floor: ['team1', 'team2'] },
    },
  },

  /**
   * Women's Tri Meet
   * 3 teams, 4 apparatus - one apparatus empty each rotation
   * Standard NCAA rotation pattern
   */
  'womens-tri': {
    rotationCount: 4,
    format: 'rotation',
    schedule: {
      1: { vault: 'team1', bars: 'team2', beam: 'team3', floor: null },
      2: { vault: null, bars: 'team1', beam: 'team2', floor: 'team3' },
      3: { vault: 'team3', bars: null, beam: 'team1', floor: 'team2' },
      4: { vault: 'team2', bars: 'team3', beam: null, floor: 'team1' },
    },
  },

  /**
   * Women's Quad Meet
   * 4 teams, 4 apparatus - perfect rotation (all events active each rotation)
   * Teams progress FORWARD through Olympic order each rotation.
   *
   * Team paths:
   * - Team1: Vault → Bars → Beam → Floor
   * - Team2: Bars → Beam → Floor → Vault
   * - Team3: Beam → Floor → Vault → Bars
   * - Team4: Floor → Vault → Bars → Beam
   */
  'womens-quad': {
    rotationCount: 4,
    format: 'rotation',
    schedule: {
      1: { vault: 'team1', bars: 'team2', beam: 'team3', floor: 'team4' },
      2: { vault: 'team4', bars: 'team1', beam: 'team2', floor: 'team3' },
      3: { vault: 'team3', bars: 'team4', beam: 'team1', floor: 'team2' },
      4: { vault: 'team2', bars: 'team3', beam: 'team4', floor: 'team1' },
    },
  },

  // ============================================
  // MEN'S MEETS (6 events: floor, pommel, rings, vault, pBars, hBar)
  // ============================================

  /**
   * Men's Dual Meet - Head-to-Head Format
   * Both teams compete on the SAME event each rotation
   */
  'mens-dual-headtohead': {
    rotationCount: 6,
    format: 'head-to-head',
    schedule: {
      1: { floor: ['team1', 'team2'], pommel: null, rings: null, vault: null, pBars: null, hBar: null },
      2: { floor: null, pommel: ['team1', 'team2'], rings: null, vault: null, pBars: null, hBar: null },
      3: { floor: null, pommel: null, rings: ['team1', 'team2'], vault: null, pBars: null, hBar: null },
      4: { floor: null, pommel: null, rings: null, vault: ['team1', 'team2'], pBars: null, hBar: null },
      5: { floor: null, pommel: null, rings: null, vault: null, pBars: ['team1', 'team2'], hBar: null },
      6: { floor: null, pommel: null, rings: null, vault: null, pBars: null, hBar: ['team1', 'team2'] },
    },
  },

  /**
   * Men's Dual Meet - Alternating Format
   * Teams start on adjacent apparatus and swap each rotation pair
   */
  'mens-dual-alternating': {
    rotationCount: 6,
    format: 'alternating',
    schedule: {
      1: { floor: 'team1', pommel: 'team2', rings: null, vault: null, pBars: null, hBar: null },
      2: { floor: 'team2', pommel: 'team1', rings: null, vault: null, pBars: null, hBar: null },
      3: { floor: null, pommel: null, rings: 'team1', vault: 'team2', pBars: null, hBar: null },
      4: { floor: null, pommel: null, rings: 'team2', vault: 'team1', pBars: null, hBar: null },
      5: { floor: null, pommel: null, rings: null, vault: null, pBars: 'team1', hBar: 'team2' },
      6: { floor: null, pommel: null, rings: null, vault: null, pBars: 'team2', hBar: 'team1' },
    },
  },

  /**
   * Men's Dual Meet - Default (head-to-head)
   */
  'mens-dual': {
    rotationCount: 6,
    format: 'head-to-head',
    schedule: {
      1: { floor: ['team1', 'team2'], pommel: null, rings: null, vault: null, pBars: null, hBar: null },
      2: { floor: null, pommel: ['team1', 'team2'], rings: null, vault: null, pBars: null, hBar: null },
      3: { floor: null, pommel: null, rings: ['team1', 'team2'], vault: null, pBars: null, hBar: null },
      4: { floor: null, pommel: null, rings: null, vault: ['team1', 'team2'], pBars: null, hBar: null },
      5: { floor: null, pommel: null, rings: null, vault: null, pBars: ['team1', 'team2'], hBar: null },
      6: { floor: null, pommel: null, rings: null, vault: null, pBars: null, hBar: ['team1', 'team2'] },
    },
  },

  /**
   * Men's Tri Meet
   * 3 teams, 6 apparatus - 3 events active per rotation
   */
  'mens-tri': {
    rotationCount: 6,
    format: 'rotation',
    schedule: {
      1: { floor: 'team1', pommel: null, rings: 'team2', vault: null, pBars: 'team3', hBar: null },
      2: { floor: null, pommel: 'team1', rings: null, vault: 'team2', pBars: null, hBar: 'team3' },
      3: { floor: 'team3', pommel: null, rings: 'team1', vault: null, pBars: 'team2', hBar: null },
      4: { floor: null, pommel: 'team3', rings: null, vault: 'team1', pBars: null, hBar: 'team2' },
      5: { floor: 'team2', pommel: null, rings: 'team3', vault: null, pBars: 'team1', hBar: null },
      6: { floor: null, pommel: 'team2', rings: null, vault: 'team3', pBars: null, hBar: 'team1' },
    },
  },

  /**
   * Men's Quad Meet
   * 4 teams, 6 apparatus - 4 events active per rotation
   */
  'mens-quad': {
    rotationCount: 6,
    format: 'rotation',
    schedule: {
      1: { floor: 'team1', pommel: 'team2', rings: 'team3', vault: 'team4', pBars: null, hBar: null },
      2: { floor: null, pommel: 'team1', rings: 'team2', vault: 'team3', pBars: 'team4', hBar: null },
      3: { floor: null, pommel: null, rings: 'team1', vault: 'team2', pBars: 'team3', hBar: 'team4' },
      4: { floor: 'team4', pommel: null, rings: null, vault: 'team1', pBars: 'team2', hBar: 'team3' },
      5: { floor: 'team3', pommel: 'team4', rings: null, vault: null, pBars: 'team1', hBar: 'team2' },
      6: { floor: 'team2', pommel: 'team3', rings: 'team4', vault: null, pBars: null, hBar: 'team1' },
    },
  },
};

// ============================================================================
// SCHEDULE GENERATION
// ============================================================================

/**
 * Generate a rotation schedule for a competition type
 *
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @param {string} [format] - Optional format override ('head-to-head' or 'alternating')
 * @returns {Object} Rotation schedule object
 */
export function generateRotationSchedule(compType, format = null) {
  if (!compType) {
    return ROTATION_TEMPLATES['mens-dual'];
  }

  // Try exact match with format suffix
  if (format) {
    const withFormat = `${compType}-${format.replace(/-/g, '')}`;
    if (ROTATION_TEMPLATES[withFormat]) {
      return JSON.parse(JSON.stringify(ROTATION_TEMPLATES[withFormat]));
    }
  }

  // Try exact match
  if (ROTATION_TEMPLATES[compType]) {
    return JSON.parse(JSON.stringify(ROTATION_TEMPLATES[compType]));
  }

  // Generate dynamically based on gender and team count
  const gender = getGenderFromCompType(compType) || 'mens';
  const teamCount = getTeamCount(compType);

  return generateCustomSchedule(gender, teamCount);
}

/**
 * Generate a custom schedule when no template exists
 *
 * @param {string} gender - 'mens' or 'womens'
 * @param {number} teamCount - Number of teams
 * @returns {Object} Generated rotation schedule
 */
function generateCustomSchedule(gender, teamCount) {
  const eventIds = EVENT_ORDER[gender] || EVENT_ORDER.mens;
  const eventCount = eventIds.length;
  const rotationCount = eventCount;

  const schedule = {};

  for (let rotation = 1; rotation <= rotationCount; rotation++) {
    schedule[rotation] = {};

    eventIds.forEach((eventId, eventIndex) => {
      // Calculate which team is on this event in this rotation
      // Using modular arithmetic for round-robin
      const teamIndex = (eventIndex + rotation - 1) % Math.max(teamCount, eventCount);

      if (teamIndex < teamCount) {
        schedule[rotation][eventId] = `team${teamIndex + 1}`;
      } else {
        schedule[rotation][eventId] = null;
      }
    });
  }

  return {
    rotationCount,
    format: 'rotation',
    schedule,
  };
}

// ============================================================================
// SCHEDULE QUERIES
// ============================================================================

/**
 * Get all events happening in a specific rotation
 *
 * @param {Object} rotationSchedule - The full schedule object
 * @param {number} rotationNumber - Which rotation (1-indexed)
 * @returns {Array<{eventId: string, teamKeys: string[]}>} Active events with teams
 */
export function getEventsInRotation(rotationSchedule, rotationNumber) {
  const rotation = rotationSchedule?.schedule?.[rotationNumber];
  if (!rotation) return [];

  return Object.entries(rotation)
    .filter(([_, teamValue]) => teamValue !== null)
    .map(([eventId, teamValue]) => ({
      eventId,
      teamKeys: Array.isArray(teamValue) ? teamValue : [teamValue],
    }));
}

/**
 * Get which event a specific team is competing on during a rotation
 *
 * @param {Object} rotationSchedule - The full schedule object
 * @param {number} rotationNumber - Which rotation (1-indexed)
 * @param {string} teamKey - Team key (e.g., 'team1')
 * @returns {string|null} Event ID or null if team has a bye
 */
export function getEventForTeam(rotationSchedule, rotationNumber, teamKey) {
  const rotation = rotationSchedule?.schedule?.[rotationNumber];
  if (!rotation) return null;

  for (const [eventId, teamValue] of Object.entries(rotation)) {
    if (Array.isArray(teamValue)) {
      if (teamValue.includes(teamKey)) return eventId;
    } else if (teamValue === teamKey) {
      return eventId;
    }
  }

  return null;
}

/**
 * Get which teams are competing on a specific event during a rotation
 *
 * @param {Object} rotationSchedule - The full schedule object
 * @param {number} rotationNumber - Which rotation (1-indexed)
 * @param {string} eventId - Event identifier
 * @returns {string[]} Array of team keys (empty if no teams)
 */
export function getTeamsForEvent(rotationSchedule, rotationNumber, eventId) {
  const rotation = rotationSchedule?.schedule?.[rotationNumber];
  if (!rotation) return [];

  const teamValue = rotation[eventId];
  if (!teamValue) return [];

  return Array.isArray(teamValue) ? teamValue : [teamValue];
}

/**
 * Get the total number of rotations in the schedule
 *
 * @param {Object} rotationSchedule - The full schedule object
 * @returns {number} Number of rotations
 */
export function getRotationCount(rotationSchedule) {
  return (
    rotationSchedule?.rotationCount ||
    Object.keys(rotationSchedule?.schedule || {}).length ||
    4
  );
}

/**
 * Get active event IDs for a rotation (events with at least one team)
 *
 * @param {Object} rotationSchedule - The full schedule object
 * @param {number} rotationNumber - Which rotation
 * @returns {string[]} Array of event IDs
 */
export function getActiveEventIds(rotationSchedule, rotationNumber) {
  return getEventsInRotation(rotationSchedule, rotationNumber).map((e) => e.eventId);
}

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Check if schedule uses head-to-head format (all teams on same event)
 *
 * @param {Object} rotationSchedule - The full schedule object
 * @returns {boolean} True if head-to-head format
 */
export function isHeadToHeadFormat(rotationSchedule) {
  if (rotationSchedule?.format === 'head-to-head') return true;
  if (rotationSchedule?.format === 'alternating') return false;
  if (rotationSchedule?.format === 'rotation') return false;

  // Auto-detect from schedule structure
  const firstRotation = rotationSchedule?.schedule?.[1];
  if (!firstRotation) return false;

  const activeEvents = Object.entries(firstRotation).filter(([_, v]) => v !== null);

  // Head-to-head: only one event active with multiple teams
  if (activeEvents.length === 1) {
    const [_, teamValue] = activeEvents[0];
    return Array.isArray(teamValue) && teamValue.length > 1;
  }

  return false;
}

/**
 * Check if schedule uses alternating format (teams swap events each rotation pair)
 *
 * @param {Object} rotationSchedule - The full schedule object
 * @returns {boolean} True if alternating format
 */
export function isAlternatingFormat(rotationSchedule) {
  if (rotationSchedule?.format === 'alternating') return true;
  if (rotationSchedule?.format === 'head-to-head') return false;
  if (rotationSchedule?.format === 'rotation') return false;

  // Auto-detect: 2 events active per rotation, teams swap between rotations
  const r1 = rotationSchedule?.schedule?.[1];
  const r2 = rotationSchedule?.schedule?.[2];
  if (!r1 || !r2) return false;

  const r1Events = Object.entries(r1).filter(([_, v]) => v !== null);
  const r2Events = Object.entries(r2).filter(([_, v]) => v !== null);

  // Alternating has 2 events active and teams swap
  if (r1Events.length === 2 && r2Events.length === 2) {
    // Check if teams swapped
    const [e1, t1] = r1Events[0];
    const [e2, t2] = r1Events[1];
    const r2Event1Teams = r2[e1];
    const r2Event2Teams = r2[e2];

    return r2Event1Teams === t2 && r2Event2Teams === t1;
  }

  return false;
}

/**
 * Check if schedule is multi-team rotation format
 *
 * @param {Object} rotationSchedule - The full schedule object
 * @returns {boolean} True if rotation format (3+ teams on different events)
 */
export function isRotationFormat(rotationSchedule) {
  if (rotationSchedule?.format === 'rotation') return true;

  return (
    !isHeadToHeadFormat(rotationSchedule) && !isAlternatingFormat(rotationSchedule)
  );
}

/**
 * Determine the meet format from schedule
 *
 * @param {Object} rotationSchedule
 * @returns {'head-to-head' | 'alternating' | 'rotation'} Format type
 */
export function getMeetFormat(rotationSchedule) {
  if (isHeadToHeadFormat(rotationSchedule)) return 'head-to-head';
  if (isAlternatingFormat(rotationSchedule)) return 'alternating';
  return 'rotation';
}

// ============================================================================
// TEAM UTILITIES
// ============================================================================

/**
 * Check if a team has a bye (not competing) in a specific rotation
 *
 * @param {Object} rotationSchedule
 * @param {number} rotationNumber
 * @param {string} teamKey
 * @returns {boolean} True if team has bye
 */
export function teamHasBye(rotationSchedule, rotationNumber, teamKey) {
  return getEventForTeam(rotationSchedule, rotationNumber, teamKey) === null;
}

/**
 * Get all rotations where a specific event has competitors
 *
 * @param {Object} rotationSchedule
 * @param {string} eventId
 * @returns {number[]} Array of rotation numbers
 */
export function getRotationsForEvent(rotationSchedule, eventId) {
  const rotations = [];
  const count = getRotationCount(rotationSchedule);

  for (let r = 1; r <= count; r++) {
    const teams = getTeamsForEvent(rotationSchedule, r, eventId);
    if (teams.length > 0) {
      rotations.push(r);
    }
  }

  return rotations;
}

/**
 * Get team's schedule - which event they compete on each rotation
 *
 * @param {Object} rotationSchedule
 * @param {string} teamKey
 * @returns {Object.<number, string|null>} Map of rotation -> eventId
 */
export function getTeamSchedule(rotationSchedule, teamKey) {
  const schedule = {};
  const count = getRotationCount(rotationSchedule);

  for (let r = 1; r <= count; r++) {
    schedule[r] = getEventForTeam(rotationSchedule, r, teamKey);
  }

  return schedule;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a rotation schedule for consistency
 *
 * @param {Object} rotationSchedule - Schedule to validate
 * @param {string} compType - Competition type for context
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateRotationSchedule(rotationSchedule, compType) {
  const errors = [];

  if (!rotationSchedule?.schedule) {
    errors.push('Missing schedule object');
    return { valid: false, errors };
  }

  const gender = getGenderFromCompType(compType) || 'mens';
  const teamCount = getTeamCount(compType);
  const eventIds = EVENT_ORDER[gender] || EVENT_ORDER.mens;
  const rotationCount = getRotationCount(rotationSchedule);

  // Check each rotation
  for (let r = 1; r <= rotationCount; r++) {
    const rotation = rotationSchedule.schedule[r];
    if (!rotation) {
      errors.push(`Missing rotation ${r}`);
      continue;
    }

    // Track team assignments to detect duplicates
    const assignedTeams = new Set();

    for (const [eventId, teamValue] of Object.entries(rotation)) {
      // Check event validity
      if (!eventIds.includes(eventId)) {
        errors.push(`Rotation ${r}: Invalid event '${eventId}' for ${gender}`);
        continue;
      }

      // Check team assignments
      if (teamValue !== null) {
        const teams = Array.isArray(teamValue) ? teamValue : [teamValue];
        for (const team of teams) {
          if (assignedTeams.has(team)) {
            errors.push(`Rotation ${r}: Team '${team}' assigned to multiple events`);
          }
          assignedTeams.add(team);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ROTATION_TEMPLATES,
  generateRotationSchedule,
  getEventsInRotation,
  getEventForTeam,
  getTeamsForEvent,
  getRotationCount,
  getActiveEventIds,
  isHeadToHeadFormat,
  isAlternatingFormat,
  isRotationFormat,
  getMeetFormat,
  teamHasBye,
  getRotationsForEvent,
  getTeamSchedule,
  validateRotationSchedule,
};
