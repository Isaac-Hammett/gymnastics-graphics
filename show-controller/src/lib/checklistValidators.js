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

  /**
   * Check if rosters are loaded for all teams.
   * Dynamic: checks N teams based on competition type.
   */
  'rosters-loaded': (ctx) => {
    const teamCount = getTeamCountFromConfig(ctx.config);
    const results = [];
    let allOk = true;

    for (let i = 1; i <= teamCount; i++) {
      const roster = ctx.teamData?.[`team${i}`]?.roster;
      const count = Array.isArray(roster) ? roster.length : 0;
      if (count === 0) allOk = false;
      results.push(`Team ${i}: ${count}`);
    }

    return {
      status: allOk ? 'complete' : 'warning',
      detail: results.join(', '),
    };
  },

  /**
   * Check if headshots are uploaded for all teams (>= 80% threshold).
   * Dynamic: checks N teams based on competition type.
   *
   * Threshold rationale: 80% accounts for walk-ons and injured athletes who
   * won't compete and may not have headshots. Only ~6 of ~20 roster members
   * typically compete, so 80% of the full roster is a reasonable floor.
   */
  'headshots-uploaded': (ctx) => {
    const teamCount = getTeamCountFromConfig(ctx.config);

    const getHeadshotPercent = (roster) => {
      if (!Array.isArray(roster) || roster.length === 0) return 0;
      const withPhotos = roster.filter(a => a?.headshotUrl).length;
      return Math.round((withPhotos / roster.length) * 100);
    };

    let totalPct = 0;
    const results = [];

    for (let i = 1; i <= teamCount; i++) {
      const roster = ctx.teamData?.[`team${i}`]?.roster;
      const pct = getHeadshotPercent(roster);
      totalPct += pct;
      results.push(`T${i}: ${pct}%`);
    }

    const avgPct = teamCount > 0 ? Math.round(totalPct / teamCount) : 0;

    return {
      status: avgPct >= 80 ? 'complete' : avgPct >= 50 ? 'warning' : 'error',
      detail: results.join(', '),
    };
  },

  // ============================================
  // Infrastructure Validators (Task 11)
  // ============================================

  /**
   * Check if a VM is assigned to the competition.
   */
  'vm-assigned': (ctx) => ({
    status: ctx.config?.vmAddress ? 'complete' : 'error',
    detail: ctx.config?.vmAddress || 'No VM assigned',
  }),

  /**
   * Check if the VM is online.
   * Note: Custom VMs will always show offline since there's no health check path.
   * The vmStatus object is populated by polling in useProductionChecklist.
   */
  'vm-online': (ctx) => {
    // No VM assigned - show error
    if (!ctx.config?.vmAddress) {
      return { status: 'error', detail: 'No VM assigned' };
    }

    // VM status is being checked
    if (ctx.vmStatus?.checking) {
      return { status: 'checking', detail: 'Checking...' };
    }

    // VM is online
    if (ctx.vmStatus?.online) {
      return { status: 'complete', detail: 'Online' };
    }

    // VM is offline or error
    return {
      status: 'error',
      detail: ctx.vmStatus?.error || 'Offline',
    };
  },

  /**
   * Check if socket is connected to the coordinator.
   * Note: This will show red when no one is actively running the show,
   * which is expected pre-show behavior.
   */
  'socket-connected': (ctx) => ({
    status: ctx.socketConnected ? 'complete' : 'error',
    detail: ctx.socketConnected ? 'Connected' : 'Disconnected',
  }),

  /**
   * Check if OBS is connected.
   * Note: This will show red when OBS is not running, which is expected
   * pre-show until the producer starts OBS.
   */
  'obs-connected': (ctx) => ({
    status: ctx.obsConnected ? 'complete' : 'error',
    detail: ctx.obsConnected ? 'Connected' : 'Not connected',
  }),

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
