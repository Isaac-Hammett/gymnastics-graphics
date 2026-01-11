/**
 * Event Configuration System
 *
 * Central source of truth for gymnastics event definitions.
 * Provides event metadata, ordering, and helper functions for
 * both men's and women's gymnastics.
 *
 * Men's gymnastics has 6 events (Olympic order):
 * - Floor Exercise (FX)
 * - Pommel Horse (PH)
 * - Still Rings (SR)
 * - Vault (VT)
 * - Parallel Bars (PB)
 * - Horizontal Bar (HB)
 *
 * Women's gymnastics has 4 events (Olympic order):
 * - Vault (VT)
 * - Uneven Bars (UB)
 * - Balance Beam (BB)
 * - Floor Exercise (FX)
 */

/**
 * Event definitions with metadata
 * Each event has:
 * - id: Internal identifier used in Firebase, components, and CSS
 * - name: Full display name
 * - shortName: 2-letter abbreviation for compact displays
 * - apiName: Virtius API event name (uppercase)
 * - gender: Which gender uses this event ('mens', 'womens', or 'both')
 *
 * @type {Object.<string, {id: string, name: string, shortName: string, apiName: string, gender: 'mens' | 'womens' | 'both'}>}
 */
export const EVENTS = {
  // Men's events (in Olympic order)
  floor: {
    id: 'floor',
    name: 'Floor Exercise',
    shortName: 'FX',
    apiName: 'FLOOR',
    gender: 'both', // Floor appears in both men's and women's
  },
  pommel: {
    id: 'pommel',
    name: 'Pommel Horse',
    shortName: 'PH',
    apiName: 'HORSE',
    gender: 'mens',
  },
  rings: {
    id: 'rings',
    name: 'Still Rings',
    shortName: 'SR',
    apiName: 'RINGS',
    gender: 'mens',
  },
  vault: {
    id: 'vault',
    name: 'Vault',
    shortName: 'VT',
    apiName: 'VAULT',
    gender: 'both', // Vault appears in both men's and women's
  },
  pBars: {
    id: 'pBars',
    name: 'Parallel Bars',
    shortName: 'PB',
    apiName: 'PBARS',
    gender: 'mens',
  },
  hBar: {
    id: 'hBar',
    name: 'Horizontal Bar',
    shortName: 'HB',
    apiName: 'BAR',
    gender: 'mens',
  },
  // Women's events (in Olympic order)
  bars: {
    id: 'bars',
    name: 'Uneven Bars',
    shortName: 'UB',
    apiName: 'BARS',
    gender: 'womens',
  },
  beam: {
    id: 'beam',
    name: 'Balance Beam',
    shortName: 'BB',
    apiName: 'BEAM',
    gender: 'womens',
  },
};

/**
 * Ordered event lists by gender (Olympic/competition order)
 * These define the standard order events are competed in.
 *
 * @type {{mens: string[], womens: string[]}}
 */
export const EVENT_ORDER = {
  mens: ['floor', 'pommel', 'rings', 'vault', 'pBars', 'hBar'],
  womens: ['vault', 'bars', 'beam', 'floor'],
};

/**
 * Short name mapping for quick lookups (e.g., 'fx' -> 'floor')
 * Lowercase for case-insensitive matching
 *
 * @type {Object.<string, string>}
 */
export const SHORT_NAME_TO_ID = {
  fx: 'floor',
  ph: 'pommel',
  sr: 'rings',
  vt: 'vault',
  pb: 'pBars',
  hb: 'hBar',
  ub: 'bars',
  bb: 'beam',
};

/**
 * API name mapping for Virtius integration (e.g., 'FLOOR' -> 'floor')
 *
 * @type {Object.<string, string>}
 */
export const API_NAME_TO_ID = {
  FLOOR: 'floor',
  HORSE: 'pommel',
  RINGS: 'rings',
  VAULT: 'vault',
  PBARS: 'pBars',
  BAR: 'hBar',
  BARS: 'bars',
  BEAM: 'beam',
};

/**
 * Returns array of event objects in competition order for the given gender
 *
 * @param {string} gender - 'mens' or 'womens'
 * @returns {Array<{id: string, name: string, shortName: string, apiName: string, gender: string}>} Array of event config objects
 *
 * @example
 * getEventsForGender('mens')
 * // Returns: [{id: 'floor', name: 'Floor Exercise', shortName: 'FX', ...}, ...]
 *
 * @example
 * getEventsForGender('womens')
 * // Returns: [{id: 'vault', ...}, {id: 'bars', ...}, {id: 'beam', ...}, {id: 'floor', ...}]
 */
export function getEventsForGender(gender) {
  const eventIds = EVENT_ORDER[gender] || EVENT_ORDER.mens;
  return eventIds.map(id => EVENTS[id]);
}

/**
 * Returns the event IDs in competition order for the given gender
 *
 * @param {string} gender - 'mens' or 'womens'
 * @returns {string[]} Array of event IDs in competition order
 *
 * @example
 * getEventIdsForGender('mens')
 * // Returns: ['floor', 'pommel', 'rings', 'vault', 'pBars', 'hBar']
 */
export function getEventIdsForGender(gender) {
  return EVENT_ORDER[gender] || EVENT_ORDER.mens;
}

/**
 * Returns the number of events for a gender (6 for mens, 4 for womens)
 *
 * @param {string} gender - 'mens' or 'womens'
 * @returns {number} Number of events (6 for mens, 4 for womens)
 *
 * @example
 * getEventCount('mens')   // 6
 * getEventCount('womens') // 4
 */
export function getEventCount(gender) {
  return EVENT_ORDER[gender]?.length || 6;
}

/**
 * Returns event object by ID
 *
 * @param {string} eventId - Event ID (e.g., 'floor', 'pommel', 'bars')
 * @returns {{id: string, name: string, shortName: string, apiName: string, gender: string} | null}
 *
 * @example
 * getEventById('floor')
 * // Returns: {id: 'floor', name: 'Floor Exercise', shortName: 'FX', apiName: 'FLOOR', gender: 'both'}
 */
export function getEventById(eventId) {
  return EVENTS[eventId] || null;
}

/**
 * Returns event object by short name (e.g., 'FX', 'PH')
 *
 * @param {string} shortName - Short name (case-insensitive)
 * @returns {{id: string, name: string, shortName: string, apiName: string, gender: string} | null}
 *
 * @example
 * getEventByShortName('FX')  // Returns floor event
 * getEventByShortName('ub')  // Returns bars event (case-insensitive)
 */
export function getEventByShortName(shortName) {
  const id = SHORT_NAME_TO_ID[shortName?.toLowerCase()];
  return id ? EVENTS[id] : null;
}

/**
 * Returns event object by Virtius API name
 *
 * @param {string} apiName - API event name (e.g., 'FLOOR', 'HORSE')
 * @returns {{id: string, name: string, shortName: string, apiName: string, gender: string} | null}
 *
 * @example
 * getEventByApiName('HORSE')  // Returns pommel event
 * getEventByApiName('BAR')    // Returns hBar event
 */
export function getEventByApiName(apiName) {
  const id = API_NAME_TO_ID[apiName?.toUpperCase()];
  return id ? EVENTS[id] : null;
}

/**
 * Returns display name for an event
 *
 * @param {string} eventId - Event ID
 * @param {'name' | 'shortName'} format - Output format (default: 'name')
 * @returns {string} Display name or the original eventId if not found
 *
 * @example
 * getEventName('floor')              // 'Floor Exercise'
 * getEventName('floor', 'shortName') // 'FX'
 * getEventName('unknown')            // 'unknown'
 */
export function getEventName(eventId, format = 'name') {
  const event = EVENTS[eventId];
  if (!event) return eventId;
  return format === 'shortName' ? event.shortName : event.name;
}

/**
 * Checks if an event is valid for a given gender
 *
 * @param {string} eventId - Event ID to check
 * @param {string} gender - 'mens' or 'womens'
 * @returns {boolean} True if the event is valid for the gender
 *
 * @example
 * isValidEventForGender('pommel', 'mens')   // true
 * isValidEventForGender('pommel', 'womens') // false
 * isValidEventForGender('vault', 'womens')  // true
 */
export function isValidEventForGender(eventId, gender) {
  const eventIds = EVENT_ORDER[gender];
  return eventIds ? eventIds.includes(eventId) : false;
}

/**
 * Converts an event ID to a short name
 *
 * @param {string} eventId - Event ID
 * @returns {string} Short name or original ID if not found
 *
 * @example
 * eventIdToShortName('floor')   // 'FX'
 * eventIdToShortName('pBars')   // 'PB'
 * eventIdToShortName('unknown') // 'unknown'
 */
export function eventIdToShortName(eventId) {
  return EVENTS[eventId]?.shortName || eventId;
}

/**
 * Converts a short name to an event ID
 *
 * @param {string} shortName - Short name (case-insensitive)
 * @returns {string | null} Event ID or null if not found
 *
 * @example
 * shortNameToEventId('FX')  // 'floor'
 * shortNameToEventId('pb')  // 'pBars'
 * shortNameToEventId('ZZ')  // null
 */
export function shortNameToEventId(shortName) {
  return SHORT_NAME_TO_ID[shortName?.toLowerCase()] || null;
}

/**
 * Converts a Virtius API event name to an event ID
 *
 * @param {string} apiName - Virtius API event name
 * @returns {string | null} Event ID or null if not found
 *
 * @example
 * apiNameToEventId('HORSE')  // 'pommel'
 * apiNameToEventId('BAR')    // 'hBar'
 * apiNameToEventId('UNKNOWN') // null
 */
export function apiNameToEventId(apiName) {
  return API_NAME_TO_ID[apiName?.toUpperCase()] || null;
}

/**
 * Gets the rotation number for an event in the given gender's Olympic order
 * Rotation numbers are 1-indexed (R1, R2, etc.)
 *
 * @param {string} eventId - Event ID
 * @param {string} gender - 'mens' or 'womens'
 * @returns {number | null} Rotation number (1-6 for mens, 1-4 for womens) or null if not found
 *
 * @example
 * getRotationForEvent('floor', 'mens')   // 1
 * getRotationForEvent('vault', 'womens') // 1
 * getRotationForEvent('floor', 'womens') // 4
 */
export function getRotationForEvent(eventId, gender) {
  const eventIds = EVENT_ORDER[gender];
  if (!eventIds) return null;
  const index = eventIds.indexOf(eventId);
  return index >= 0 ? index + 1 : null;
}

/**
 * Gets the event ID for a given rotation number
 *
 * @param {number} rotation - Rotation number (1-indexed)
 * @param {string} gender - 'mens' or 'womens'
 * @returns {string | null} Event ID or null if invalid rotation
 *
 * @example
 * getEventForRotation(1, 'mens')   // 'floor'
 * getEventForRotation(1, 'womens') // 'vault'
 * getEventForRotation(7, 'mens')   // null
 */
export function getEventForRotation(rotation, gender) {
  const eventIds = EVENT_ORDER[gender];
  if (!eventIds || rotation < 1 || rotation > eventIds.length) return null;
  return eventIds[rotation - 1];
}

/**
 * Gets the number of rotations for a gender
 * (Same as getEventCount, but semantically clearer for rotation context)
 *
 * @param {string} gender - 'mens' or 'womens'
 * @returns {number} Number of rotations
 */
export function getRotationCount(gender) {
  return getEventCount(gender);
}

// ============================================================================
// Score Calculation Utilities
// ============================================================================

/**
 * Calculates total score from event scores based on gender
 *
 * @param {Object} eventScores - Object with event IDs as keys, scores as values
 * @param {string} gender - 'mens' or 'womens'
 * @returns {number} Total score
 *
 * @example
 * calculateTotalScore({ vault: 49.125, bars: 49.250, beam: 48.875, floor: 49.300 }, 'womens')
 * // Returns: 196.55
 */
export function calculateTotalScore(eventScores, gender) {
  if (!eventScores) return 0;

  const eventIds = getEventIdsForGender(gender);

  return eventIds.reduce((total, eventId) => {
    const score = eventScores[eventId];
    return total + (typeof score === 'number' && !isNaN(score) ? score : 0);
  }, 0);
}

/**
 * Validates that score object only contains valid events for gender
 *
 * @param {Object} eventScores - Object with event IDs as keys
 * @param {string} gender - 'mens' or 'womens'
 * @returns {boolean} True if all score keys are valid events for the gender
 *
 * @example
 * validateScoresForGender({ vault: 49.125, bars: 49.250 }, 'womens')  // true
 * validateScoresForGender({ pommel: 14.250, bars: 49.250 }, 'womens') // false (pommel is men's only)
 */
export function validateScoresForGender(eventScores, gender) {
  if (!eventScores) return true;

  const scoreKeys = Object.keys(eventScores).filter(k => k !== 'total');
  return scoreKeys.every(key => isValidEventForGender(key, gender));
}

/**
 * Filters score object to only include valid events for the gender
 *
 * @param {Object} eventScores - Object with event IDs as keys, scores as values
 * @param {string} gender - 'mens' or 'womens'
 * @returns {Object} Filtered scores object
 *
 * @example
 * filterScoresForGender({ vault: 49.125, pommel: 14.250, bars: 49.250 }, 'womens')
 * // Returns: { vault: 49.125, bars: 49.250 }
 */
export function filterScoresForGender(eventScores, gender) {
  if (!eventScores) return {};

  const eventIds = getEventIdsForGender(gender);
  const filtered = {};

  for (const eventId of eventIds) {
    if (eventScores[eventId] !== undefined) {
      filtered[eventId] = eventScores[eventId];
    }
  }

  // Preserve total if present
  if (eventScores.total !== undefined) {
    filtered.total = eventScores.total;
  }

  return filtered;
}

/**
 * Creates an empty scores object with all events set to null
 *
 * @param {string} gender - 'mens' or 'womens'
 * @returns {Object} Scores object with event IDs as keys, all values null
 *
 * @example
 * createEmptyScores('womens')
 * // Returns: { vault: null, bars: null, beam: null, floor: null, total: null }
 */
export function createEmptyScores(gender) {
  const eventIds = getEventIdsForGender(gender);
  const scores = {};

  for (const eventId of eventIds) {
    scores[eventId] = null;
  }
  scores.total = null;

  return scores;
}

export default {
  EVENTS,
  EVENT_ORDER,
  SHORT_NAME_TO_ID,
  API_NAME_TO_ID,
  getEventsForGender,
  getEventIdsForGender,
  getEventCount,
  getEventById,
  getEventByShortName,
  getEventByApiName,
  getEventName,
  isValidEventForGender,
  eventIdToShortName,
  shortNameToEventId,
  apiNameToEventId,
  getRotationForEvent,
  getEventForRotation,
  getRotationCount,
  calculateTotalScore,
  validateScoresForGender,
  filterScoresForGender,
  createEmptyScores,
};
