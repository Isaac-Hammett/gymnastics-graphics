import { useMemo } from 'react';
import {
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
} from '../lib/rotationSchedule';
import { getGenderFromCompType, getTeamCount } from '../lib/competitionUtils';
import { getEventById, getEventsForGender, EVENT_ORDER } from '../lib/eventConfig';

/**
 * Hook that provides rotation schedule information and utilities.
 *
 * Use this hook for components that need to know which teams are competing
 * on which events during each rotation. Essential for multi-team meets.
 *
 * For dual meets, this provides format detection (head-to-head vs alternating).
 * For tri/quad/multi meets, this provides the full rotation schedule.
 *
 * @param {Object} config - Competition config object from Firebase
 * @param {string} config.compType - Competition type (e.g., 'womens-quad')
 * @param {Object} [config.rotationSchedule] - Custom schedule (optional)
 * @returns {Object} Rotation schedule data and helper functions
 *
 * @example
 * const { getRotationSummary, isDualFormat, rotationCount } = useRotationSchedule(config);
 *
 * // Get all events happening in rotation 1
 * const events = getRotationSummary(1);
 * // For a quad meet: [{event: {id: 'vault', ...}, teamKeys: ['team1']}, ...]
 *
 * // For a dual head-to-head meet: [{event: {...}, teamKeys: ['team1', 'team2']}]
 */
export function useRotationSchedule(config) {
  const { compType, rotationSchedule: savedSchedule } = config || {};

  return useMemo(() => {
    // Use saved schedule from config, or generate from template
    const schedule = savedSchedule || generateRotationSchedule(compType);
    const gender = getGenderFromCompType(compType) || 'mens';
    const teamCount = getTeamCount(compType);
    const rotationCount = getRotationCount(schedule);
    const allEvents = getEventsForGender(gender);
    const format = getMeetFormat(schedule);

    // Format detection
    const isHeadToHead = isHeadToHeadFormat(schedule);
    const isAlternating = isAlternatingFormat(schedule);
    const isRotation = isRotationFormat(schedule);
    const isDualFormat = teamCount === 2;
    const isMultiTeamFormat = teamCount > 2;

    return {
      // ===== Core Data =====
      /**
       * The full rotation schedule object
       */
      schedule,

      /**
       * Number of rotations in the meet
       */
      rotationCount,

      /**
       * Gender of the competition ('mens' or 'womens')
       */
      gender,

      /**
       * Number of teams in the competition
       */
      teamCount,

      /**
       * All event objects for this gender (in Olympic order)
       */
      allEvents,

      /**
       * Event IDs in Olympic order for this gender
       */
      eventIds: EVENT_ORDER[gender] || EVENT_ORDER.mens,

      // ===== Format Detection =====
      /**
       * Meet format: 'head-to-head' | 'alternating' | 'rotation'
       */
      format,

      /**
       * True if head-to-head format (all teams on same event)
       */
      isHeadToHead,

      /**
       * True if alternating format (teams swap between adjacent events)
       */
      isAlternating,

      /**
       * True if rotation format (different teams on different events)
       */
      isRotation,

      /**
       * True if this is a dual meet (2 teams)
       */
      isDualFormat,

      /**
       * True if this is a multi-team meet (3+ teams)
       */
      isMultiTeamFormat,

      // ===== Helper Functions =====

      /**
       * Get summary of all events and teams for a specific rotation.
       * Use this for Event Summary graphics.
       *
       * @param {number} rotationNumber - 1-indexed rotation number
       * @returns {Array<{event: Object, eventId: string, teamKeys: string[]}>}
       *
       * @example
       * const events = getRotationSummary(1);
       * // Quad meet: [{event: {...}, eventId: 'vault', teamKeys: ['team1']}, ...]
       * // Dual meet: [{event: {...}, eventId: 'vault', teamKeys: ['team1', 'team2']}]
       */
      getRotationSummary: (rotationNumber) => {
        const events = getEventsInRotation(schedule, rotationNumber);

        return events.map(({ eventId, teamKeys }) => ({
          event: getEventById(eventId),
          eventId,
          teamKeys,
        }));
      },

      /**
       * Get which event a specific team is competing on in a rotation.
       *
       * @param {number} rotationNumber
       * @param {string} teamKey - e.g., 'team1'
       * @returns {{eventId: string, event: Object} | null}
       */
      getTeamEvent: (rotationNumber, teamKey) => {
        const eventId = getEventForTeam(schedule, rotationNumber, teamKey);
        if (!eventId) return null;
        return {
          eventId,
          event: getEventById(eventId),
        };
      },

      /**
       * Get which teams are competing on a specific event in a rotation.
       *
       * @param {number} rotationNumber
       * @param {string} eventId
       * @returns {string[]} Array of team keys
       */
      getEventTeams: (rotationNumber, eventId) => {
        return getTeamsForEvent(schedule, rotationNumber, eventId);
      },

      /**
       * Get list of active event IDs for a rotation.
       *
       * @param {number} rotationNumber
       * @returns {string[]} Array of event IDs
       */
      getActiveEventIds: (rotationNumber) => {
        return getActiveEventIds(schedule, rotationNumber);
      },

      /**
       * Get active events with full event objects for a rotation.
       *
       * @param {number} rotationNumber
       * @returns {Object[]} Array of event config objects
       */
      getActiveEvents: (rotationNumber) => {
        const eventIds = getEventsInRotation(schedule, rotationNumber).map(
          (e) => e.eventId
        );
        return eventIds.map((id) => getEventById(id)).filter(Boolean);
      },

      /**
       * Check if a team has a bye (not competing) in a rotation.
       *
       * @param {number} rotationNumber
       * @param {string} teamKey
       * @returns {boolean}
       */
      teamHasBye: (rotationNumber, teamKey) => {
        return teamHasBye(schedule, rotationNumber, teamKey);
      },

      /**
       * Get all rotations where a specific event has competitors.
       *
       * @param {string} eventId
       * @returns {number[]} Array of rotation numbers
       */
      getRotationsForEvent: (eventId) => {
        return getRotationsForEvent(schedule, eventId);
      },

      /**
       * Get a team's complete schedule (which event each rotation).
       *
       * @param {string} teamKey
       * @returns {Object.<number, string|null>} Map of rotation -> eventId
       */
      getTeamSchedule: (teamKey) => {
        return getTeamSchedule(schedule, teamKey);
      },

      /**
       * Get team info from config by team key.
       * Convenience function for accessing team names, logos, etc.
       *
       * @param {string} teamKey - e.g., 'team1'
       * @returns {{name: string, logo: string, tricode: string} | null}
       */
      getTeamInfo: (teamKey) => {
        if (!config || !teamKey) return null;
        const num = teamKey.replace('team', '');
        return {
          name: config[`team${num}Name`] || null,
          logo: config[`team${num}Logo`] || null,
          tricode: config[`team${num}Tricode`] || null,
        };
      },

      /**
       * Get all teams in the competition.
       *
       * @returns {Array<{teamKey: string, name: string, logo: string, tricode: string}>}
       */
      getAllTeams: () => {
        const teams = [];
        for (let i = 1; i <= teamCount; i++) {
          const teamKey = `team${i}`;
          teams.push({
            teamKey,
            name: config?.[`team${i}Name`] || null,
            logo: config?.[`team${i}Logo`] || null,
            tricode: config?.[`team${i}Tricode`] || null,
          });
        }
        return teams;
      },
    };
  }, [compType, savedSchedule, config]);
}

export default useRotationSchedule;
