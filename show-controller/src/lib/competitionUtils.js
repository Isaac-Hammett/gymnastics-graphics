/**
 * Competition utility functions for extracting and working with
 * competition types, gender context, and team keys.
 *
 * These functions ensure consistent gender handling throughout the app,
 * preventing issues where women's competitions fall back to men's team data.
 */

import { normalizeName } from './nameNormalization';

/**
 * Extracts the gender string from a competition type.
 *
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @returns {'womens' | 'mens' | null} Gender string or null if not determinable
 *
 * @example
 * getGenderFromCompType('womens-quad')  // 'womens'
 * getGenderFromCompType('mens-dual')    // 'mens'
 * getGenderFromCompType('invalid')      // null
 */
export function getGenderFromCompType(compType) {
  if (!compType || typeof compType !== 'string') return null;

  const normalized = compType.toLowerCase().trim();

  if (normalized.startsWith('womens')) return 'womens';
  if (normalized.startsWith('mens')) return 'mens';

  // Handle variations like "women's-dual" or "men's-quad"
  if (normalized.startsWith("women's") || normalized.startsWith('women-')) return 'womens';
  if (normalized.startsWith("men's") || normalized.startsWith('men-')) return 'mens';

  return null;
}

/**
 * Extracts the gender string from a competition type with a fallback default.
 *
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @param {'womens' | 'mens'} defaultGender - Fallback gender if not determinable
 * @returns {'womens' | 'mens'} Gender string (never null)
 *
 * @example
 * getGenderSuffix('womens-quad')           // 'womens'
 * getGenderSuffix('invalid', 'womens')     // 'womens'
 * getGenderSuffix(null, 'mens')            // 'mens'
 */
export function getGenderSuffix(compType, defaultGender = 'mens') {
  const gender = getGenderFromCompType(compType);
  return gender || defaultGender;
}

/**
 * Constructs a proper team key from a school name and gender.
 *
 * @param {string} schoolName - School/team name (e.g., 'Stanford', 'Navy Men\'s')
 * @param {'womens' | 'mens'} gender - Gender suffix to use
 * @returns {string} Team key (e.g., 'stanford-womens', 'navy-mens')
 *
 * @example
 * buildTeamKey('Stanford', 'womens')       // 'stanford-womens'
 * buildTeamKey('Navy Men\'s', 'womens')    // 'navy-womens' (gender override)
 * buildTeamKey('Greenville', 'mens')       // 'greenville-mens'
 */
export function buildTeamKey(schoolName, gender) {
  if (!schoolName) return '';

  // Use normalizeName to handle special characters, then strip gender suffixes
  const normalized = normalizeName(schoolName)
    // Remove existing gender suffixes from the name
    .replace(/-mens$/, '')
    .replace(/-womens$/, '')
    .replace(/ mens$/, '')
    .replace(/ womens$/, '')
    .replace(/ men$/, '')
    .replace(/ women$/, '')
    // Replace spaces with hyphens for the key format
    .replace(/\s+/g, '-')
    .trim();

  if (!normalized) return '';

  // Use the provided gender, defaulting to 'mens' if not specified
  const genderSuffix = gender === 'womens' ? 'womens' : 'mens';

  return `${normalized}-${genderSuffix}`;
}

/**
 * Extracts just the school portion from a team key or name.
 *
 * @param {string} teamKeyOrName - Team key or name (e.g., 'stanford-womens', 'Navy Men\'s')
 * @returns {string} School name without gender (e.g., 'stanford', 'navy')
 *
 * @example
 * extractSchoolName('stanford-womens')     // 'stanford'
 * extractSchoolName('Navy Men\'s')         // 'navy'
 * extractSchoolName('greenville')          // 'greenville'
 */
export function extractSchoolName(teamKeyOrName) {
  if (!teamKeyOrName) return '';

  return normalizeName(teamKeyOrName)
    .replace(/-mens$/, '')
    .replace(/-womens$/, '')
    .replace(/ mens$/, '')
    .replace(/ womens$/, '')
    .replace(/ men$/, '')
    .replace(/ women$/, '')
    .replace(/\s+/g, '-')
    .trim();
}

/**
 * Checks if a competition type is for women's gymnastics.
 *
 * @param {string} compType - Competition type
 * @returns {boolean} True if women's competition
 */
export function isWomensCompetition(compType) {
  return getGenderFromCompType(compType) === 'womens';
}

/**
 * Checks if a competition type is for men's gymnastics.
 *
 * @param {string} compType - Competition type
 * @returns {boolean} True if men's competition
 */
export function isMensCompetition(compType) {
  return getGenderFromCompType(compType) === 'mens';
}

/**
 * Gets the team count from a competition type.
 *
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @returns {number} Number of teams (2-6), or 2 as default
 *
 * @example
 * getTeamCount('womens-quad')  // 4
 * getTeamCount('mens-dual')    // 2
 * getTeamCount('mens-tri')     // 3
 */
export function getTeamCount(compType) {
  if (!compType) return 2;

  const normalized = compType.toLowerCase();

  if (normalized.includes('dual')) return 2;
  if (normalized.includes('tri')) return 3;
  if (normalized.includes('quad')) return 4;
  if (normalized.includes('-5') || normalized.includes('5-team')) return 5;
  if (normalized.includes('-6') || normalized.includes('6-team')) return 6;

  return 2;
}
