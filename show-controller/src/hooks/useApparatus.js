import { useMemo, useCallback } from 'react';
import { EVENTS, EVENT_ORDER } from '../lib/eventConfig';

/**
 * Hook that provides apparatus configuration based on competition gender.
 *
 * Men's gymnastics (MAG) has 6 apparatus in Olympic order:
 * - FX (Floor Exercise), PH (Pommel Horse), SR (Still Rings), VT (Vault), PB (Parallel Bars), HB (Horizontal Bar)
 *
 * Women's gymnastics (WAG) has 4 apparatus in Olympic order:
 * - VT (Vault), UB (Uneven Bars), BB (Balance Beam), FX (Floor Exercise)
 *
 * @param {string} gender - 'mens' or 'womens' (or MAG/WAG/male/female). Defaults to 'womens' if null/undefined
 * @returns {Object} Apparatus configuration and helpers
 *
 * @example
 * const { apparatus, apparatusCodes, getApparatusName, isValid } = useApparatus('womens');
 * // apparatus = [{code: 'VT', name: 'Vault', eventId: 'vault', order: 1}, ...]
 * // apparatusCodes = ['VT', 'UB', 'BB', 'FX']
 * // getApparatusName('VT') = 'Vault'
 * // isValid('VT') = true
 */
export function useApparatus(gender) {
  /**
   * Normalize various gender formats to 'mens' or 'womens'
   */
  const normalizedGender = useMemo(() => {
    if (!gender) return 'womens';
    const g = gender.toLowerCase();
    if (g === 'mens' || g === 'mag' || g === 'male' || g === 'm') return 'mens';
    if (g === 'womens' || g === 'wag' || g === 'female' || g === 'w') return 'womens';
    return 'womens'; // Default to womens
  }, [gender]);

  /**
   * Array of apparatus objects with code, name, eventId, and order
   * Memoized based on gender
   * @type {Array<{code: string, name: string, eventId: string, order: number}>}
   */
  const apparatus = useMemo(() => {
    const eventIds = EVENT_ORDER[normalizedGender] || EVENT_ORDER.womens;
    return eventIds.map((eventId, index) => {
      const event = EVENTS[eventId];
      return {
        code: event.shortName,
        name: event.name,
        eventId: event.id,
        order: index + 1
      };
    });
  }, [normalizedGender]);

  /**
   * Array of apparatus codes in Olympic order
   * @type {string[]}
   */
  const apparatusCodes = useMemo(() => {
    return apparatus.map(a => a.code);
  }, [apparatus]);

  /**
   * Get the full name for an apparatus code
   * @param {string} code - The apparatus code (e.g., 'VT', 'FX')
   * @returns {string} The full apparatus name or the code itself if not found
   */
  const getApparatusName = useCallback((code) => {
    if (!code) return '';
    const item = apparatus.find(a => a.code.toUpperCase() === code.toUpperCase());
    return item?.name || code;
  }, [apparatus]);

  /**
   * Check if an apparatus code is valid for the current gender
   * @param {string} code - The apparatus code to check
   * @returns {boolean} True if the code is valid for the gender
   */
  const isValid = useCallback((code) => {
    if (!code) return false;
    return apparatusCodes.some(c => c.toUpperCase() === code.toUpperCase());
  }, [apparatusCodes]);

  /**
   * Get apparatus object by code
   * @param {string} code - The apparatus code
   * @returns {Object|null} The apparatus object or null if not found
   */
  const getApparatusByCode = useCallback((code) => {
    if (!code) return null;
    return apparatus.find(a => a.code.toUpperCase() === code.toUpperCase()) || null;
  }, [apparatus]);

  /**
   * Get the event ID for an apparatus code
   * @param {string} code - The apparatus code
   * @returns {string|null} The event ID or null if not found
   */
  const getEventId = useCallback((code) => {
    const item = getApparatusByCode(code);
    return item?.eventId || null;
  }, [getApparatusByCode]);

  /**
   * Get the order (1-indexed) for an apparatus code
   * @param {string} code - The apparatus code
   * @returns {number|null} The order or null if not found
   */
  const getOrder = useCallback((code) => {
    const item = getApparatusByCode(code);
    return item?.order || null;
  }, [getApparatusByCode]);

  return {
    /**
     * Array of apparatus objects with code, name, eventId, and order
     * @type {Array<{code: string, name: string, eventId: string, order: number}>}
     */
    apparatus,

    /**
     * Array of apparatus codes in Olympic order
     * @type {string[]}
     */
    apparatusCodes,

    /**
     * Get the full name for an apparatus code
     * @type {function(string): string}
     */
    getApparatusName,

    /**
     * Check if an apparatus code is valid for the current gender
     * @type {function(string): boolean}
     */
    isValid,

    /**
     * Get apparatus object by code
     * @type {function(string): Object|null}
     */
    getApparatusByCode,

    /**
     * Get the event ID for an apparatus code
     * @type {function(string): string|null}
     */
    getEventId,

    /**
     * Get the order for an apparatus code
     * @type {function(string): number|null}
     */
    getOrder,

    /**
     * The normalized gender ('mens' or 'womens')
     * @type {string}
     */
    gender: normalizedGender,

    /**
     * Number of apparatus for this gender (6 for mens, 4 for womens)
     * @type {number}
     */
    count: apparatus.length
  };
}

export default useApparatus;
