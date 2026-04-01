/**
 * Scoring Ingestion Service
 *
 * Server-side polling service that fetches scoring data from Virtius API
 * and writes graphic-ready data to Firebase. This replaces browser-side
 * API calls in output.html with a single-source-of-truth data flow.
 *
 * Firebase paths written:
 *   competitions/{compId}/scoring/leaderboard/{apparatus} — Per-apparatus leaderboards
 *   competitions/{compId}/scoring/teamTotals — Team totals for all teams
 *   competitions/{compId}/scoring/rotationState — Current rotation info
 *   competitions/{compId}/scoring/leaderboard/AA — All-around leaderboard
 *   competitions/{compId}/scoring/updatedAt — Last update timestamp
 *   competitions/{compId}/config/scoringFeed — Feed status and config
 *
 * @module scoringIngestionService
 */

import { EventEmitter } from 'events';

// ============================================================================
// Constants
// ============================================================================

// Feed states
export const FEED_STATUS = {
  OK: 'ok',
  ERROR: 'error',
  STOPPED: 'stopped'
};

// Max event log entries (circular buffer)
const MAX_EVENT_LOG_ENTRIES = 50;

// Default poll interval (seconds)
const DEFAULT_POLL_INTERVAL = 15;

// ============================================================================
// ScoringIngestionService Class
// ============================================================================

/**
 * ScoringIngestionService - Fetches Virtius data and writes to Firebase
 *
 * Events emitted:
 * - 'started': Service started polling
 * - 'stopped': Service stopped polling
 * - 'pollCompleted': Poll cycle completed successfully
 * - 'pollError': Poll cycle failed
 * - 'autoStopped': Service auto-stopped (competition ended, timeout, etc.)
 */
export class ScoringIngestionService extends EventEmitter {
  /**
   * Create a new ScoringIngestionService
   * @param {Object} options - Configuration options
   * @param {string} options.compId - Competition ID
   * @param {Object} options.firebase - Firebase Admin database reference
   * @param {Object} options.io - Socket.io server for broadcasting
   */
  constructor(options = {}) {
    super();

    this.compId = options.compId;
    this._firebase = options.firebase;
    this._io = options.io;

    // Polling state
    this._state = 'stopped'; // 'stopped' | 'running'
    this._pollTimer = null;
    this._pollInterval = DEFAULT_POLL_INTERVAL;
    this._lastPollAt = null;
    this._lastPollResult = null;
    this._lastApiError = null;

    // Virtius session info (read from config on start)
    this._virtiusSessionId = null;
    this._gender = null;

    // Producer activity tracking (for auto-stop)
    this._lastProducerActivity = Date.now();

    // Firebase listeners (for cleanup)
    this._configListener = null;
    this._competitionStatusListener = null;
    this._producerTimeoutTimer = null;

    // Team logo cache (avoid repeated Firebase reads)
    this._teamLogoCache = new Map();

    // Event log (circular buffer for debugging)
    this._eventLog = [];
  }

  /**
   * Get comprehensive state snapshot
   * @returns {Object} Current service state
   */
  getState() {
    return {
      compId: this.compId,
      state: this._state,
      pollInterval: this._pollInterval,
      lastPollAt: this._lastPollAt,
      lastPollResult: this._lastPollResult,
      lastApiError: this._lastApiError,
      virtiusSessionId: this._virtiusSessionId,
      gender: this._gender,
      lastProducerActivity: this._lastProducerActivity,
      eventLogLength: this._eventLog.length
    };
  }

  /**
   * Log an event to the circular buffer
   * @param {string} type - Event type
   * @param {string} message - Event message
   * @param {Object} [data] - Additional data
   */
  _log(type, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data
    };

    this._eventLog.push(entry);

    // Trim to max size (circular buffer)
    while (this._eventLog.length > MAX_EVENT_LOG_ENTRIES) {
      this._eventLog.shift();
    }

    // Also log to console for debugging
    console.log(`[ScoringIngestion:${this.compId}] ${type}: ${message}`);
  }

  /**
   * Reset producer activity timestamp (called on any socket event)
   */
  resetProducerActivity() {
    this._lastProducerActivity = Date.now();
  }

  /**
   * Get event log (for debugging)
   * @returns {Array} Event log entries
   */
  getEventLog() {
    return [...this._eventLog];
  }
}

// ============================================================================
// Singleton Manager
// ============================================================================

// Map of compId -> ScoringIngestionService instances
const scoringServices = new Map();

/**
 * Get or create a scoring ingestion service for a competition
 * @param {string} compId - Competition ID
 * @param {Object} options - Options for creating new service
 * @returns {ScoringIngestionService}
 */
export function getScoringService(compId, options = {}) {
  if (!scoringServices.has(compId)) {
    const service = new ScoringIngestionService({ compId, ...options });
    scoringServices.set(compId, service);
  }
  return scoringServices.get(compId);
}

/**
 * Remove a scoring ingestion service (e.g., when competition ends)
 * @param {string} compId - Competition ID
 */
export function removeScoringService(compId) {
  const service = scoringServices.get(compId);
  if (service) {
    // Stop will be implemented in Task 3
    if (typeof service.stop === 'function') {
      service.stop();
    }
    scoringServices.delete(compId);
  }
}

/**
 * Get all active scoring ingestion services
 * @returns {Map<string, ScoringIngestionService>}
 */
export function getAllScoringServices() {
  return scoringServices;
}
