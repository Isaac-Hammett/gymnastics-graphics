/**
 * Production Checklist Validators
 *
 * Auto-validation functions for checklist items.
 * Each validator receives a context object and returns { status, detail }.
 *
 * Status values:
 * - 'complete': Requirement met (green)
 * - 'warning': Partial/suboptimal (amber)
 * - 'error': Requirement not met (red)
 * - 'checking': Async validation in progress (gray with spinner)
 *
 * Reference: docs/PRD-Production-Checklist/checklist-items-definition.md
 */

import { getTeamCount } from './competitionUtils';

/**
 * Helper: get team count from competition config
 */
function getTeamCountFromConfig(config) {
  if (!config?.compType) return 2;
  return getTeamCount(config.compType);
}

/**
 * Validators object - keyed by validator ID matching checklistItems.js
 */
export const validators = {
  // ============================================
  // Competition Config Validators (Phase 1: Setup)
  // ============================================

  /**
   * Check if event name is configured
   */
  'event-name': (ctx) => ({
    status: ctx.config?.eventName ? 'complete' : 'error',
    detail: ctx.config?.eventName || 'Not set',
  }),

  /**
   * Check if meet date is configured
   */
  'meet-date': (ctx) => ({
    status: ctx.config?.meetDate ? 'complete' : 'error',
    detail: ctx.config?.meetDate || 'Not set',
  }),

  /**
   * Check if venue is configured
   */
  'venue-configured': (ctx) => ({
    status: ctx.config?.venue ? 'complete' : 'error',
    detail: ctx.config?.venue || 'Not set',
  }),

  /**
   * Check if all teams are configured with names and logos.
   * Dynamic: checks N teams based on competition type.
   */
  'teams-configured': (ctx) => {
    const teamCount = getTeamCountFromConfig(ctx.config);
    const results = [];
    let allOk = true;

    for (let i = 1; i <= teamCount; i++) {
      const nameOk = !!ctx.config?.[`team${i}Name`];
      const logoOk = !!ctx.config?.[`team${i}Logo`];
      const ok = nameOk && logoOk;
      if (!ok) allOk = false;
      results.push(`Team ${i}: ${ok ? '✓' : '✗'}`);
    }

    return {
      status: allOk ? 'complete' : 'error',
      detail: results.join(', '),
    };
  },

  /**
   * Check if meet theme is configured.
   * Uses warning (not error) when missing — defaults work fine.
   */
  'theme-configured': (ctx) => ({
    status: ctx.config?.meetTheme ? 'complete' : 'warning',
    detail: ctx.config?.meetTheme || 'No theme set (using defaults)',
  }),

  // ============================================
  // Team Data Validators (Task 10)
  // ============================================
  // Placeholder for: rosters-loaded, headshots-uploaded

  // ============================================
  // Infrastructure Validators (Task 11)
  // ============================================
  // Placeholder for: vm-assigned, vm-online, socket-connected, obs-connected

  // ============================================
  // Rundown Validators (Task 12)
  // ============================================
  // Placeholder for: rundown-created, segments-named, graphics-assigned
};

/**
 * Run a validator by key.
 * Returns { status: 'pending', detail: 'No validator' } if validator not found.
 *
 * @param {string} validatorKey - The validator key from checklistItems.js
 * @param {object} ctx - Context object with config, teamData, etc.
 * @returns {{ status: string, detail: string }}
 */
export function runValidator(validatorKey, ctx) {
  const validator = validators[validatorKey];
  if (!validator) {
    return { status: 'pending', detail: 'No validator' };
  }
  try {
    return validator(ctx);
  } catch (error) {
    console.error(`Validator ${validatorKey} error:`, error);
    return { status: 'error', detail: 'Validation error' };
  }
}

/**
 * Run all validators and return a map of results.
 *
 * @param {object} ctx - Context object with config, teamData, etc.
 * @returns {Object<string, { status: string, detail: string }>}
 */
export function runAllValidators(ctx) {
  const results = {};
  for (const key of Object.keys(validators)) {
    results[key] = runValidator(key, ctx);
  }
  return results;
}
