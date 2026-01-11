import { useMemo } from 'react';
import { getGenderFromCompType } from '../lib/competitionUtils';
import {
  getEventsForGender,
  getEventIdsForGender,
  getEventById,
  getEventByShortName,
  isValidEventForGender,
  getEventName,
  getEventCount,
  getRotationForEvent,
  getEventForRotation,
  getRotationCount,
  eventIdToShortName,
  EVENT_ORDER,
  EVENTS,
} from '../lib/eventConfig';

/**
 * Hook that provides event configuration based on competition type.
 *
 * Returns event lists, helper functions, and metadata appropriate
 * for the competition's gender (extracted from compType).
 *
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @returns {Object} Event configuration for the competition
 *
 * @example
 * const { events, eventCount, gender } = useEventConfig('womens-quad');
 * // events = [{id: 'vault', ...}, {id: 'bars', ...}, {id: 'beam', ...}, {id: 'floor', ...}]
 * // eventCount = 4
 * // gender = 'womens'
 *
 * @example
 * const { events, isValidEvent } = useEventConfig('mens-dual');
 * // events = [{id: 'floor', ...}, {id: 'pommel', ...}, ...]
 * // isValidEvent('pommel') = true
 * // isValidEvent('beam') = false
 */
export function useEventConfig(compType) {
  return useMemo(() => {
    // Extract gender from compType, defaulting to 'mens' if not determinable
    const gender = getGenderFromCompType(compType) || 'mens';

    // Get events in competition order for this gender
    const events = getEventsForGender(gender);
    const eventIds = getEventIdsForGender(gender);

    return {
      /**
       * The gender extracted from compType ('mens' or 'womens')
       * @type {string}
       */
      gender,

      /**
       * Array of event objects in competition order
       * @type {Array<{id: string, name: string, shortName: string, apiName: string, gender: string}>}
       */
      events,

      /**
       * Array of event IDs in competition order
       * @type {string[]}
       */
      eventIds,

      /**
       * Number of events for this gender (6 for mens, 4 for womens)
       * @type {number}
       */
      eventCount: events.length,

      /**
       * Number of rotations (same as eventCount)
       * @type {number}
       */
      rotationCount: events.length,

      /**
       * Get event object by ID
       * @param {string} id - Event ID
       * @returns {Object|null} Event object or null
       */
      getEvent: (id) => getEventById(id),

      /**
       * Get event object by short name (e.g., 'FX', 'UB')
       * @param {string} shortName - Event short name
       * @returns {Object|null} Event object or null
       */
      getEventByShortName: (shortName) => getEventByShortName(shortName),

      /**
       * Check if an event ID is valid for this competition's gender
       * @param {string} id - Event ID to check
       * @returns {boolean}
       */
      isValidEvent: (id) => isValidEventForGender(id, gender),

      /**
       * Get display name for an event
       * @param {string} id - Event ID
       * @param {'name'|'shortName'} format - Output format
       * @returns {string}
       */
      getEventName: (id, format = 'name') => getEventName(id, format),

      /**
       * Convert event ID to short name
       * @param {string} id - Event ID
       * @returns {string}
       */
      toShortName: (id) => eventIdToShortName(id),

      /**
       * Get rotation number for an event (1-indexed)
       * @param {string} eventId - Event ID
       * @returns {number|null}
       */
      getRotation: (eventId) => getRotationForEvent(eventId, gender),

      /**
       * Get event ID for a rotation number
       * @param {number} rotation - Rotation number (1-indexed)
       * @returns {string|null}
       */
      getEventForRotation: (rotation) => getEventForRotation(rotation, gender),
    };
  }, [compType]);
}

export default useEventConfig;
