/**
 * AI Context Service
 *
 * Provides real-time AI-generated context and talking points during live show
 * execution. This service is used during show runtime (as opposed to
 * aiSuggestionService which is used during planning).
 *
 * Phase C: AI Context - Live Execution (P3)
 * Task 55: Create AIContextService stub
 * Task 56: Add `aiContextUpdated` socket event
 * Task 57: Create `useAIContext` hook
 * Task 58: Integrate with Virtius API for live stats
 * Task 59: Generate talking points in real-time
 * Task 60: Detect career highs, records during show
 * Task 61: Display AI context in Talent View
 * Task 62: Display AI context in Producer View
 */

import { getDb } from './productionConfigService.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Context types that can be generated
 */
const CONTEXT_TYPES = {
  SEGMENT: 'segment',           // Context for current segment
  ATHLETE: 'athlete',           // Athlete-specific talking points
  SCORE: 'score',              // Score-related context (career high, etc.)
  MATCHUP: 'matchup',          // Head-to-head matchup context
  MILESTONE: 'milestone',       // Milestone alerts (100th routine, etc.)
  BREAKING: 'breaking',         // Breaking news / live updates
};

/**
 * Priority levels for context items
 */
const PRIORITY = {
  CRITICAL: 'critical',   // Must mention (career high, record, etc.)
  HIGH: 'high',          // Should mention if time allows
  MEDIUM: 'medium',      // Nice to have
  LOW: 'low',            // Background info only
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  updateIntervalMs: 5000,      // How often to check for new context
  maxTalkingPoints: 5,         // Max talking points per segment
  lookAheadSegments: 2,        // Number of upcoming segments to prep
};

// ============================================================================
// AI Context Service Class
// ============================================================================

/**
 * AIContextService manages real-time context generation for live shows.
 *
 * It subscribes to show state changes and generates relevant talking points
 * for talent based on:
 * - Current segment type and content
 * - Live scores from Virtius API
 * - Athlete statistics and milestones
 * - Historical matchup data
 */
class AIContextService {
  /**
   * Create an AIContextService instance
   *
   * @param {Object} options - Configuration options
   * @param {string} options.compId - Competition ID
   * @param {Object} options.io - Socket.io instance for broadcasting
   * @param {Object} options.engine - TimesheetEngine instance (optional)
   */
  constructor(options = {}) {
    this.compId = options.compId || null;
    this.io = options.io || null;
    this.engine = options.engine || null;
    this.config = { ...DEFAULT_CONFIG, ...options.config };

    // State
    this._isRunning = false;
    this._currentContext = null;
    this._updateInterval = null;
    this._lastSegmentId = null;

    // Cached data
    this._competitionConfig = null;
    this._teamData = null;
    this._athleteStats = null;
  }

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Start the AI context service
   *
   * Begins monitoring the show and generating context updates.
   */
  async start() {
    if (this._isRunning) {
      console.log(`[AIContextService] Already running for ${this.compId}`);
      return;
    }

    console.log(`[AIContextService] Starting for competition ${this.compId}`);
    this._isRunning = true;

    // Load initial competition data
    await this._loadCompetitionData();

    // Start periodic context updates
    this._updateInterval = setInterval(
      () => this._updateContext(),
      this.config.updateIntervalMs
    );

    // Generate initial context
    await this._updateContext();
  }

  /**
   * Stop the AI context service
   */
  stop() {
    if (!this._isRunning) {
      return;
    }

    console.log(`[AIContextService] Stopping for competition ${this.compId}`);
    this._isRunning = false;

    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }

    this._currentContext = null;
    this._lastSegmentId = null;
  }

  /**
   * Check if service is running
   */
  get isRunning() {
    return this._isRunning;
  }

  // ==========================================================================
  // Context Generation (Stubs - to be implemented in Task 59)
  // ==========================================================================

  /**
   * Update context based on current show state
   *
   * This is the main context generation loop. It:
   * 1. Checks current segment
   * 2. Queries for relevant context
   * 3. Generates talking points
   * 4. Broadcasts updates
   */
  async _updateContext() {
    if (!this._isRunning) return;

    try {
      // Get current show state
      const showState = this._getShowState();
      if (!showState || showState.showState !== 'RUNNING') {
        return;
      }

      const currentSegment = showState.currentSegment;
      if (!currentSegment) return;

      // Only regenerate if segment changed
      if (currentSegment.id === this._lastSegmentId) {
        return;
      }

      this._lastSegmentId = currentSegment.id;

      // Generate context for this segment (stub - returns placeholder data)
      const context = await this._generateSegmentContext(currentSegment);

      // Store and broadcast
      this._currentContext = context;
      this._broadcastContext(context);
    } catch (error) {
      console.error(`[AIContextService] Error updating context:`, error);
    }
  }

  /**
   * Generate context for a specific segment
   *
   * @param {Object} segment - Current segment data
   * @returns {Promise<Object>} Generated context
   */
  async _generateSegmentContext(segment) {
    // STUB: Basic structure - will be enhanced in Task 59
    const context = {
      segmentId: segment.id,
      segmentName: segment.name,
      timestamp: new Date().toISOString(),
      talkingPoints: [],
      athleteContext: [],
      scoreContext: null,
      milestones: [],
    };

    // Generate basic talking points based on segment type
    const points = this._getBasicTalkingPoints(segment);
    context.talkingPoints = points;

    return context;
  }

  /**
   * Get basic talking points for a segment type
   *
   * @param {Object} segment - Segment data
   * @returns {Array} Talking points
   */
  _getBasicTalkingPoints(segment) {
    // STUB: Returns placeholder talking points
    // Will be enhanced in Task 59 with actual AI/rule-based generation
    const points = [];

    // Add segment-specific placeholder points
    if (segment.notes) {
      points.push({
        id: `notes-${segment.id}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.HIGH,
        text: segment.notes,
        source: 'segment-notes',
      });
    }

    // Add type-specific placeholder
    if (segment.type === 'live' || segment.type === 'LIVE') {
      points.push({
        id: `type-${segment.id}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.MEDIUM,
        text: 'Live segment - engage with the audience',
        source: 'segment-type',
      });
    }

    return points;
  }

  // ==========================================================================
  // Live Stats Integration (Stub - to be implemented in Task 58)
  // ==========================================================================

  /**
   * Fetch live scores from Virtius API
   *
   * @returns {Promise<Object>} Live score data
   */
  async fetchLiveScores() {
    // STUB: Will integrate with Virtius API in Task 58
    console.log(`[AIContextService] fetchLiveScores stub called`);
    return {
      available: false,
      message: 'Virtius API integration pending (Task 58)',
    };
  }

  // ==========================================================================
  // Career High / Record Detection (Stub - to be implemented in Task 60)
  // ==========================================================================

  /**
   * Check if a score is a career high
   *
   * @param {string} athleteName - Athlete name
   * @param {string} event - Event code (FX, VT, etc.)
   * @param {number} score - Score to check
   * @returns {Promise<Object>} Career high check result
   */
  async checkCareerHigh(athleteName, event, score) {
    // STUB: Will implement career high detection in Task 60
    console.log(`[AIContextService] checkCareerHigh stub called for ${athleteName}`);
    return {
      isCareerHigh: false,
      previousHigh: null,
      message: 'Career high detection pending (Task 60)',
    };
  }

  /**
   * Detect if a score breaks any records
   *
   * @param {string} athleteName - Athlete name
   * @param {string} event - Event code
   * @param {number} score - Score to check
   * @returns {Promise<Object>} Record check result
   */
  async checkRecords(athleteName, event, score) {
    // STUB: Will implement record detection in Task 60
    console.log(`[AIContextService] checkRecords stub called for ${athleteName}`);
    return {
      breaksRecord: false,
      records: [],
      message: 'Record detection pending (Task 60)',
    };
  }

  // ==========================================================================
  // Broadcasting
  // ==========================================================================

  /**
   * Broadcast context update to connected clients
   *
   * @param {Object} context - Context to broadcast
   */
  _broadcastContext(context) {
    if (!this.io || !this.compId) {
      return;
    }

    // Broadcast to competition room
    this.io.to(`competition:${this.compId}`).emit('aiContextUpdated', {
      compId: this.compId,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  // ==========================================================================
  // Data Loading
  // ==========================================================================

  /**
   * Load competition data from Firebase
   */
  async _loadCompetitionData() {
    const db = getDb();
    if (!db || !this.compId) {
      console.warn('[AIContextService] Cannot load data - missing db or compId');
      return;
    }

    try {
      // Load competition config
      const configSnapshot = await db.ref(`competitions/${this.compId}/config`).once('value');
      this._competitionConfig = configSnapshot.val();

      // Load team data
      const teamDataSnapshot = await db.ref(`competitions/${this.compId}/teamData`).once('value');
      this._teamData = teamDataSnapshot.val();

      console.log(`[AIContextService] Loaded competition data for ${this.compId}`);
    } catch (error) {
      console.error(`[AIContextService] Error loading competition data:`, error);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Get current show state from engine
   *
   * @returns {Object|null} Current show state
   */
  _getShowState() {
    if (!this.engine) {
      return null;
    }

    try {
      return this.engine.getState();
    } catch (error) {
      console.error(`[AIContextService] Error getting show state:`, error);
      return null;
    }
  }

  /**
   * Get current context
   *
   * @returns {Object|null} Current context
   */
  getCurrentContext() {
    return this._currentContext;
  }

  /**
   * Force a context refresh
   */
  async refreshContext() {
    this._lastSegmentId = null; // Force regeneration
    await this._updateContext();
  }

  /**
   * Get service state for debugging
   */
  getState() {
    return {
      compId: this.compId,
      isRunning: this._isRunning,
      hasEngine: !!this.engine,
      hasCurrentContext: !!this._currentContext,
      lastSegmentId: this._lastSegmentId,
      config: this.config,
    };
  }
}

// ============================================================================
// Service Factory
// ============================================================================

// Map of active AIContextService instances by compId
const contextServices = new Map();

/**
 * Get or create an AIContextService for a competition
 *
 * @param {string} compId - Competition ID
 * @param {Object} options - Service options
 * @returns {AIContextService} Service instance
 */
function getOrCreateContextService(compId, options = {}) {
  if (!compId) {
    throw new Error('compId is required');
  }

  if (!contextServices.has(compId)) {
    const service = new AIContextService({ ...options, compId });
    contextServices.set(compId, service);
    console.log(`[AIContextService] Created service for ${compId}`);
  }

  return contextServices.get(compId);
}

/**
 * Get existing AIContextService for a competition
 *
 * @param {string} compId - Competition ID
 * @returns {AIContextService|null} Service instance or null
 */
function getContextService(compId) {
  return contextServices.get(compId) || null;
}

/**
 * Remove and stop AIContextService for a competition
 *
 * @param {string} compId - Competition ID
 */
function removeContextService(compId) {
  const service = contextServices.get(compId);
  if (service) {
    service.stop();
    contextServices.delete(compId);
    console.log(`[AIContextService] Removed service for ${compId}`);
  }
}

/**
 * List all active context services
 *
 * @returns {Array} List of service states
 */
function listContextServices() {
  const services = [];
  contextServices.forEach((service, compId) => {
    services.push({
      compId,
      ...service.getState(),
    });
  });
  return services;
}

// ============================================================================
// Export
// ============================================================================

const aiContextService = {
  // Service class for direct instantiation
  AIContextService,
  // Factory methods
  getOrCreateContextService,
  getContextService,
  removeContextService,
  listContextServices,
  // Constants
  CONTEXT_TYPES,
  PRIORITY,
  DEFAULT_CONFIG,
};

export default aiContextService;

export {
  AIContextService,
  getOrCreateContextService,
  getContextService,
  removeContextService,
  listContextServices,
  CONTEXT_TYPES,
  PRIORITY,
  DEFAULT_CONFIG,
};
