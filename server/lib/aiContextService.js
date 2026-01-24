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
// Virtius API Configuration
// ============================================================================

const VIRTIUS_API_BASE = 'https://api.virti.us';

/**
 * Event code mappings between different systems
 */
const EVENT_MAPPINGS = {
  // Virtius event names to short codes
  virtiusToShort: {
    FLOOR: 'FX',
    HORSE: 'PH',
    RINGS: 'SR',
    VAULT: 'VT',
    PBARS: 'PB',
    BAR: 'HB',
    BARS: 'UB',
    BEAM: 'BB',
  },
  // Short codes to display names
  shortToDisplay: {
    FX: 'Floor Exercise',
    PH: 'Pommel Horse',
    SR: 'Still Rings',
    VT: 'Vault',
    PB: 'Parallel Bars',
    HB: 'High Bar',
    UB: 'Uneven Bars',
    BB: 'Balance Beam',
  },
};

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

    // Virtius API state
    this._virtiusSessionId = null;
    this._virtiusData = null;
    this._virtiusLastFetch = null;
    this._virtiusCacheMs = 10000; // Refresh Virtius data every 10 seconds
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
    const context = {
      segmentId: segment.id,
      segmentName: segment.name,
      timestamp: new Date().toISOString(),
      talkingPoints: [],
      athleteContext: [],
      scoreContext: null,
      milestones: [],
      liveScores: null,
    };

    // Fetch live scores from Virtius
    const liveScores = await this.fetchLiveScores();
    if (liveScores.available) {
      context.liveScores = {
        teams: liveScores.teams,
        currentRotation: liveScores.currentRotation,
        recentScores: liveScores.recentScores,
      };

      // Add score-based talking points
      const scorePoints = this._getScoreBasedTalkingPoints(liveScores, segment);
      context.talkingPoints.push(...scorePoints);
    }

    // Generate basic talking points based on segment type
    const basicPoints = this._getBasicTalkingPoints(segment);
    context.talkingPoints.push(...basicPoints);

    // Sort talking points by priority
    context.talkingPoints.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    });

    // Limit to max configured talking points
    context.talkingPoints = context.talkingPoints.slice(0, this.config.maxTalkingPoints);

    return context;
  }

  /**
   * Generate talking points based on live score data
   *
   * @param {Object} liveScores - Live scores from Virtius
   * @param {Object} segment - Current segment
   * @returns {Array} Score-based talking points
   */
  _getScoreBasedTalkingPoints(liveScores, segment) {
    const points = [];

    // Add team standings talking point
    if (liveScores.teams?.length >= 2) {
      const [leader, second] = liveScores.teams;
      const margin = ((leader.score || 0) - (second.score || 0)).toFixed(3);

      if (margin > 0) {
        points.push({
          id: `standings-${Date.now()}`,
          type: CONTEXT_TYPES.SCORE,
          priority: margin > 1 ? PRIORITY.MEDIUM : PRIORITY.HIGH,
          text: `${leader.name} leads ${second.name} by ${margin} points`,
          source: 'live-scores',
          data: { leader, second, margin: parseFloat(margin) },
        });
      } else if (margin === '0.000') {
        points.push({
          id: `standings-tied-${Date.now()}`,
          type: CONTEXT_TYPES.SCORE,
          priority: PRIORITY.HIGH,
          text: `${leader.name} and ${second.name} are TIED at ${leader.score?.toFixed(3)}`,
          source: 'live-scores',
          data: { leader, second, tied: true },
        });
      }
    }

    // Highlight recent high scores
    if (liveScores.recentScores?.length > 0) {
      const topScore = liveScores.recentScores[0];
      if (topScore.score >= 9.9) {
        points.push({
          id: `high-score-${Date.now()}`,
          type: CONTEXT_TYPES.SCORE,
          priority: topScore.score >= 10.0 ? PRIORITY.CRITICAL : PRIORITY.HIGH,
          text: `${topScore.athlete} (${topScore.team}) just scored ${topScore.score.toFixed(3)} on ${topScore.eventDisplay}!`,
          source: 'live-scores',
          data: topScore,
        });
      }
    }

    // Add rotation context
    if (liveScores.currentRotation) {
      points.push({
        id: `rotation-${Date.now()}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.LOW,
        text: `Currently in rotation ${liveScores.currentRotation}`,
        source: 'live-scores',
        data: { rotation: liveScores.currentRotation },
      });
    }

    return points;
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
  // Live Stats Integration (Task 58: Virtius API Integration)
  // ==========================================================================

  /**
   * Fetch live scores from Virtius API
   *
   * Caches results for `_virtiusCacheMs` milliseconds to avoid hammering the API.
   *
   * @param {boolean} forceRefresh - Force a fresh fetch, ignoring cache
   * @returns {Promise<Object>} Live score data with structure:
   *   {
   *     available: boolean,
   *     sessionId: string,
   *     meet: { name, date, location, sex },
   *     teams: [{ name, tricode, logo, score, rank }],
   *     currentRotation: number,
   *     eventResults: { [eventName]: { gymnasts: [...], teamScores: {...} } },
   *     recentScores: [{ athlete, team, event, score, timestamp }],
   *     fetchedAt: ISO timestamp
   *   }
   */
  async fetchLiveScores(forceRefresh = false) {
    // Check if we have a session ID
    if (!this._virtiusSessionId) {
      // Try to get it from competition config
      await this._loadVirtiusSessionId();
    }

    if (!this._virtiusSessionId) {
      return {
        available: false,
        reason: 'no_session_id',
        message: 'No Virtius session ID configured for this competition',
      };
    }

    // Check cache
    const now = Date.now();
    if (
      !forceRefresh &&
      this._virtiusData &&
      this._virtiusLastFetch &&
      now - this._virtiusLastFetch < this._virtiusCacheMs
    ) {
      return this._virtiusData;
    }

    try {
      const data = await this._fetchVirtiusSession(this._virtiusSessionId);
      const parsedData = this._parseVirtiusData(data);

      // Cache the parsed data
      this._virtiusData = parsedData;
      this._virtiusLastFetch = now;

      console.log(`[AIContextService] Fetched live scores for session ${this._virtiusSessionId}`);
      return parsedData;
    } catch (error) {
      console.error(`[AIContextService] Error fetching Virtius data:`, error);
      return {
        available: false,
        reason: 'fetch_error',
        message: error.message,
        sessionId: this._virtiusSessionId,
      };
    }
  }

  /**
   * Load Virtius session ID from competition config
   */
  async _loadVirtiusSessionId() {
    if (this._competitionConfig?.virtiusSessionId) {
      this._virtiusSessionId = this._competitionConfig.virtiusSessionId;
      return;
    }

    // Try to load from Firebase
    const db = getDb();
    if (!db || !this.compId) return;

    try {
      const snapshot = await db.ref(`competitions/${this.compId}/config/virtiusSessionId`).once('value');
      const sessionId = snapshot.val();
      if (sessionId) {
        this._virtiusSessionId = sessionId;
        console.log(`[AIContextService] Loaded Virtius session ID: ${sessionId}`);
      }
    } catch (error) {
      console.error(`[AIContextService] Error loading Virtius session ID:`, error);
    }
  }

  /**
   * Fetch raw data from Virtius API
   *
   * @param {string} sessionId - Virtius session ID
   * @returns {Promise<Object>} Raw Virtius API response
   */
  async _fetchVirtiusSession(sessionId) {
    const url = `${VIRTIUS_API_BASE}/session/${sessionId}/json`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Virtius session not found: ${sessionId}`);
      }
      throw new Error(`Virtius API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Parse raw Virtius data into a structured format for the AI context
   *
   * @param {Object} rawData - Raw Virtius API response
   * @returns {Object} Parsed score data
   */
  _parseVirtiusData(rawData) {
    const meet = rawData.meet || {};
    const teams = meet.teams || [];
    const eventResults = meet.event_results || [];

    // Parse teams with their current scores
    const parsedTeams = teams
      .sort((a, b) => (a.team_order || 0) - (b.team_order || 0))
      .map((team, index) => ({
        name: team.name || team.short_name,
        tricode: team.tricode,
        logo: team.logo,
        score: team.total_score || team.score || 0,
        rank: index + 1,
        teamOrder: team.team_order,
      }));

    // Sort by score to get actual rankings
    const sortedByScore = [...parsedTeams].sort((a, b) => (b.score || 0) - (a.score || 0));
    sortedByScore.forEach((team, idx) => {
      team.rank = idx + 1;
    });

    // Parse event results
    const parsedEventResults = {};
    for (const event of eventResults) {
      const eventName = event.event_name;
      const shortCode = EVENT_MAPPINGS.virtiusToShort[eventName] || eventName;

      parsedEventResults[shortCode] = {
        eventName,
        displayName: EVENT_MAPPINGS.shortToDisplay[shortCode] || eventName,
        gymnasts: (event.gymnasts || []).map((g) => ({
          name: g.full_name || g.name,
          firstName: g.first_name,
          lastName: g.last_name,
          team: g.team || g.team_name,
          tricode: g.tricode,
          score: g.score || g.total_score,
          rank: g.rank || g.place,
          difficulty: g.d_score,
          execution: g.e_score,
          startValue: g.start_value,
          deductions: g.deductions,
        })),
        teamScores: {},
      };

      // Aggregate team scores for this event
      for (const g of event.gymnasts || []) {
        const teamKey = g.tricode || g.team;
        if (teamKey && g.score) {
          if (!parsedEventResults[shortCode].teamScores[teamKey]) {
            parsedEventResults[shortCode].teamScores[teamKey] = {
              total: 0,
              count: 0,
              scores: [],
            };
          }
          parsedEventResults[shortCode].teamScores[teamKey].total += g.score;
          parsedEventResults[shortCode].teamScores[teamKey].count += 1;
          parsedEventResults[shortCode].teamScores[teamKey].scores.push(g.score);
        }
      }
    }

    // Calculate current rotation based on event results
    const currentRotation = this._inferCurrentRotation(eventResults, teams.length);

    // Get recent scores (last 5 scored routines across all events)
    const recentScores = this._extractRecentScores(eventResults);

    return {
      available: true,
      sessionId: this._virtiusSessionId,
      meet: {
        name: meet.name,
        date: meet.date,
        location: meet.location,
        sex: meet.sex,
        gender: meet.sex === 'women' ? 'womens' : 'mens',
      },
      teams: parsedTeams,
      currentRotation,
      eventResults: parsedEventResults,
      recentScores,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Infer current rotation based on completed events
   *
   * @param {Array} eventResults - Event results from Virtius
   * @param {number} teamCount - Number of teams
   * @returns {number} Estimated current rotation (1-based)
   */
  _inferCurrentRotation(eventResults, teamCount) {
    // Count events with at least one score
    let eventsWithScores = 0;
    for (const event of eventResults) {
      const hasScores = (event.gymnasts || []).some((g) => g.score > 0);
      if (hasScores) eventsWithScores++;
    }

    // For dual meets (2 teams), there are 6 rotations (men) or 4 rotations (women)
    // Each team does one event per rotation
    // So eventsWithScores roughly corresponds to rotations completed
    if (eventsWithScores === 0) return 1;

    // If all events have scores, we're likely at the end
    if (eventsWithScores >= eventResults.length) {
      return eventResults.length;
    }

    // Otherwise, estimate based on events completed
    return Math.min(eventsWithScores + 1, eventResults.length);
  }

  /**
   * Extract recent scores from event results
   *
   * @param {Array} eventResults - Event results from Virtius
   * @returns {Array} Recent scores sorted by most recent first
   */
  _extractRecentScores(eventResults) {
    const allScores = [];

    for (const event of eventResults) {
      const shortCode = EVENT_MAPPINGS.virtiusToShort[event.event_name] || event.event_name;

      for (const g of event.gymnasts || []) {
        if (g.score > 0) {
          allScores.push({
            athlete: g.full_name || g.name,
            team: g.tricode || g.team,
            event: shortCode,
            eventDisplay: EVENT_MAPPINGS.shortToDisplay[shortCode] || event.event_name,
            score: g.score,
            rank: g.rank || g.place,
            // We don't have timestamps from Virtius, so use order in results
            order: g.rank || 999,
          });
        }
      }
    }

    // Sort by event order (later events = more recent) then by rank
    // This is a heuristic since Virtius doesn't provide timestamps
    allScores.sort((a, b) => {
      // Scores are typically added in order, so later events are more recent
      return b.order - a.order;
    });

    // Return last 10 scores
    return allScores.slice(0, 10);
  }

  /**
   * Get current team standings from live scores
   *
   * @returns {Promise<Array>} Team standings array
   */
  async getTeamStandings() {
    const scores = await this.fetchLiveScores();
    if (!scores.available) {
      return [];
    }

    return scores.teams.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Get scores for a specific event
   *
   * @param {string} eventCode - Event code (FX, PH, SR, VT, PB, HB, UB, BB)
   * @returns {Promise<Object>} Event scores and rankings
   */
  async getEventScores(eventCode) {
    const scores = await this.fetchLiveScores();
    if (!scores.available) {
      return null;
    }

    return scores.eventResults[eventCode] || null;
  }

  /**
   * Get athlete's score on a specific event
   *
   * @param {string} athleteName - Athlete name to search for
   * @param {string} eventCode - Event code
   * @returns {Promise<Object|null>} Athlete's score or null
   */
  async getAthleteScore(athleteName, eventCode) {
    const eventScores = await this.getEventScores(eventCode);
    if (!eventScores) return null;

    const normalized = athleteName.toLowerCase().trim();
    return (
      eventScores.gymnasts.find(
        (g) => g.name?.toLowerCase().includes(normalized) || normalized.includes(g.lastName?.toLowerCase())
      ) || null
    );
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

      // Extract Virtius session ID if available
      if (this._competitionConfig?.virtiusSessionId) {
        this._virtiusSessionId = this._competitionConfig.virtiusSessionId;
        console.log(`[AIContextService] Found Virtius session ID: ${this._virtiusSessionId}`);
      }

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
      virtius: {
        sessionId: this._virtiusSessionId,
        hasData: !!this._virtiusData,
        lastFetch: this._virtiusLastFetch
          ? new Date(this._virtiusLastFetch).toISOString()
          : null,
        available: this._virtiusData?.available || false,
      },
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
  EVENT_MAPPINGS,
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
  EVENT_MAPPINGS,
};
