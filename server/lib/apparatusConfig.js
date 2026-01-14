/**
 * Apparatus Configuration Module
 *
 * Provides apparatus details and validation for both men's (MAG) and women's (WAG) gymnastics.
 * Re-exports apparatus constants from showConfigSchema.js for convenience.
 */

import { MENS_APPARATUS, WOMENS_APPARATUS } from './showConfigSchema.js';

// Re-export for convenience
export { MENS_APPARATUS, WOMENS_APPARATUS };

/**
 * Apparatus details with full names and Olympic order by gender
 */
const APPARATUS_DETAILS = {
  // Men's Apparatus (Olympic order)
  FX: { code: 'FX', name: 'Floor Exercise', mensOrder: 1, womensOrder: 4 },
  PH: { code: 'PH', name: 'Pommel Horse', mensOrder: 2, womensOrder: null },
  SR: { code: 'SR', name: 'Still Rings', mensOrder: 3, womensOrder: null },
  VT: { code: 'VT', name: 'Vault', mensOrder: 4, womensOrder: 1 },
  PB: { code: 'PB', name: 'Parallel Bars', mensOrder: 5, womensOrder: null },
  HB: { code: 'HB', name: 'High Bar', mensOrder: 6, womensOrder: null },
  // Women's Apparatus (Olympic order)
  UB: { code: 'UB', name: 'Uneven Bars', mensOrder: null, womensOrder: 2 },
  BB: { code: 'BB', name: 'Balance Beam', mensOrder: null, womensOrder: 3 }
};

/**
 * Get apparatus array for a specific gender, sorted by Olympic order
 * @param {string} gender - 'mens' or 'womens'
 * @returns {Array<{code: string, name: string, order: number}>} Sorted apparatus array
 */
export function getApparatusForGender(gender) {
  const normalizedGender = normalizeGender(gender);
  const apparatusCodes = normalizedGender === 'mens' ? MENS_APPARATUS : WOMENS_APPARATUS;
  const orderKey = normalizedGender === 'mens' ? 'mensOrder' : 'womensOrder';

  return apparatusCodes
    .map(code => ({
      code,
      name: APPARATUS_DETAILS[code].name,
      order: APPARATUS_DETAILS[code][orderKey]
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Get apparatus codes for a specific gender (in Olympic order)
 * @param {string} gender - 'mens' or 'womens'
 * @returns {string[]} Array of apparatus codes
 */
export function getApparatusCodes(gender) {
  return getApparatusForGender(gender).map(a => a.code);
}

/**
 * Get the full name of an apparatus by its code
 * @param {string} code - Apparatus code (e.g., 'VT', 'UB')
 * @returns {string|null} Full apparatus name or null if invalid code
 */
export function getApparatusName(code) {
  const apparatus = APPARATUS_DETAILS[code];
  return apparatus ? apparatus.name : null;
}

/**
 * Check if an apparatus code is valid for a specific gender
 * @param {string} gender - 'mens' or 'womens'
 * @param {string} code - Apparatus code to validate
 * @returns {boolean} True if the code is valid for the given gender
 */
export function isValidApparatus(gender, code) {
  const normalizedGender = normalizeGender(gender);
  const validCodes = normalizedGender === 'mens' ? MENS_APPARATUS : WOMENS_APPARATUS;
  return validCodes.includes(code);
}

/**
 * Validate multiple apparatus codes against a gender
 * @param {string} gender - 'mens' or 'womens'
 * @param {string[]} codes - Array of apparatus codes to validate
 * @returns {{valid: boolean, invalidCodes: string[]}} Validation result
 */
export function validateApparatusCodes(gender, codes) {
  if (!Array.isArray(codes)) {
    return { valid: false, invalidCodes: [] };
  }

  const invalidCodes = codes.filter(code => !isValidApparatus(gender, code));

  return {
    valid: invalidCodes.length === 0,
    invalidCodes
  };
}

/**
 * Normalize gender string to 'mens' or 'womens'
 * @param {string} gender - Gender string (e.g., 'mens', 'womens', 'MAG', 'WAG', 'male', 'female')
 * @returns {string} Normalized gender ('mens' or 'womens', defaults to 'womens')
 */
function normalizeGender(gender) {
  if (!gender) return 'womens';

  const lower = gender.toLowerCase();
  if (lower === 'mens' || lower === 'mag' || lower === 'male' || lower === 'm') {
    return 'mens';
  }
  // Default to womens for any other value
  return 'womens';
}

/**
 * Get all apparatus details
 * @returns {Object} All apparatus details keyed by code
 */
export function getAllApparatusDetails() {
  return { ...APPARATUS_DETAILS };
}

// Default export with all functions
export default {
  MENS_APPARATUS,
  WOMENS_APPARATUS,
  getApparatusForGender,
  getApparatusCodes,
  getApparatusName,
  isValidApparatus,
  validateApparatusCodes,
  getAllApparatusDetails
};
