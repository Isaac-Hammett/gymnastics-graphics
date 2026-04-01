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

// API timeout (ms)
const API_TIMEOUT_MS = 15000;

// Virtius API base URL
const VIRTIUS_API_BASE = 'https://api.virti.us';

// Apparatus code normalization map
const APPARATUS_MAP = {
  // Full names
  'Floor Exercise': 'FX',
  'Pommel Horse': 'PH',
  'Still Rings': 'SR',
  'Vault': 'VT',
  'Parallel Bars': 'PB',
  'High Bar': 'HB',
  'Uneven Bars': 'UB',
  'Balance Beam': 'BB',
  'All Around': 'AA',
  // API short names
  'FLOOR': 'FX',
  'HORSE': 'PH',
  'RINGS': 'SR',
  'VAULT': 'VT',
  'PBARS': 'PB',
  'BAR': 'HB',
  'UBARS': 'UB',
  'BARS': 'UB',
  'BEAM': 'BB',
  // Already normalized
  'FX': 'FX',
  'PH': 'PH',
  'SR': 'SR',
  'VT': 'VT',
  'PB': 'PB',
  'HB': 'HB',
  'UB': 'UB',
  'BB': 'BB',
  'AA': 'AA'
};

// Men's apparatus list (Olympic order)
const MENS_APPARATUS = ['FX', 'PH', 'SR', 'VT', 'PB', 'HB'];

// Women's apparatus list (Olympic order)
const WOMENS_APPARATUS = ['VT', 'UB', 'BB', 'FX'];

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

  // ============================================================================
  // API Fetching
  // ============================================================================

  /**
   * Fetch data from Virtius API with timeout
   * @param {string} sessionId - Virtius session ID
   * @returns {Promise<Object>} Virtius API response
   * @throws {Error} On network error or timeout
   */
  async _fetchVirtiusData(sessionId) {
    const url = `${VIRTIUS_API_BASE}/session/${sessionId}/json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      this._log('fetch', `Fetching Virtius data from ${url}`);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this._log('fetch', `Received ${JSON.stringify(data).length} bytes`);
      return data;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`API timeout after ${API_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  }

  // ============================================================================
  // Data Processing
  // ============================================================================

  /**
   * Normalize apparatus name to short code
   * @param {string} name - Apparatus name (any format)
   * @returns {string} Short code (FX, PH, etc.)
   */
  _normalizeApparatus(name) {
    if (!name) return '';
    return APPARATUS_MAP[name] || APPARATUS_MAP[name.toUpperCase()] || name;
  }

  /**
   * Get team logo URL, checking local cache first then Firebase
   * @param {string} teamKey - Team key for Firebase lookup
   * @param {string} fallbackLogo - Fallback logo from Virtius API
   * @returns {Promise<string>} Logo URL
   */
  async _getTeamLogo(teamKey, fallbackLogo) {
    // Check cache first
    if (this._teamLogoCache.has(teamKey)) {
      return this._teamLogoCache.get(teamKey);
    }

    // Try Firebase lookup
    if (this._firebase && teamKey) {
      try {
        const snapshot = await this._firebase
          .ref(`teamsDatabase/teams/${teamKey}/logo`)
          .once('value');
        const logo = snapshot.val();
        if (logo) {
          this._teamLogoCache.set(teamKey, logo);
          return logo;
        }
      } catch (err) {
        // Firebase lookup failed, use fallback
        console.warn(`Team logo lookup failed for ${teamKey}:`, err.message);
      }
    }

    // Cache and return fallback
    const logo = fallbackLogo || '';
    if (teamKey) {
      this._teamLogoCache.set(teamKey, logo);
    }
    return logo;
  }

  /**
   * Process raw Virtius API data into graphic-ready structures
   * @param {Object} raw - Raw Virtius API response
   * @param {string} gender - 'mens' or 'womens'
   * @returns {Promise<Object>} Processed data: { leaderboards, teamTotals, rotationState, allAround }
   */
  async processVirtiusData(raw, gender) {
    const isWomens = gender === 'womens';
    const meet = raw?.meet;

    if (!meet) {
      throw new Error('Invalid API response: missing meet object');
    }

    // Build team info maps from API data
    const teamLogos = {};
    const teamNames = {};
    const gymnastToTeam = {};

    if (meet.teams) {
      for (const team of meet.teams) {
        const teamName = team.name || team.short_name || team.tricode || '';
        const teamLogo = team.logo || '';

        // Map various identifiers to logo and name
        if (team.tricode) {
          teamLogos[team.tricode] = teamLogo;
          teamNames[team.tricode] = teamName;
        }
        if (team.name) {
          teamLogos[team.name] = teamLogo;
          teamNames[team.name] = teamName;
        }
        if (team.short_name) {
          teamLogos[team.short_name] = teamLogo;
          teamNames[team.short_name] = teamName;
        }

        // Build gymnast -> team map from events
        if (team.events) {
          for (const event of team.events) {
            if (event.gymnasts) {
              for (const g of event.gymnasts) {
                const teamInfo = { name: teamName, logo: teamLogo };
                if (g.gymnast_id) {
                  gymnastToTeam[g.gymnast_id] = teamInfo;
                }
                // Also map by name for AA
                const fullName = g.full_name || `${g.first_name || ''} ${g.last_name || ''}`.trim();
                if (fullName) {
                  gymnastToTeam[fullName] = teamInfo;
                }
              }
            }
          }
        }
      }
    }

    // Process leaderboards for each apparatus
    const apparatusList = isWomens ? WOMENS_APPARATUS : MENS_APPARATUS;
    const leaderboards = {};

    for (const apparatus of apparatusList) {
      const leaderboard = await this._processApparatusLeaderboard(
        meet,
        apparatus,
        isWomens,
        gymnastToTeam,
        teamLogos,
        teamNames
      );
      if (leaderboard && leaderboard.length > 0) {
        leaderboards[apparatus] = leaderboard;
      }
    }

    // Process All-Around
    const allAround = await this._processAllAround(
      meet,
      isWomens,
      gymnastToTeam,
      teamLogos,
      teamNames
    );
    if (allAround && allAround.length > 0) {
      leaderboards.AA = allAround;
    }

    // Compute team totals
    const teamTotals = this._computeTeamTotals(meet);

    // Compute rotation state
    const rotationState = this._computeRotationState(meet, isWomens);

    return {
      leaderboards,
      teamTotals,
      rotationState,
      allAround
    };
  }

  /**
   * Process leaderboard for a single apparatus
   * @private
   */
  async _processApparatusLeaderboard(meet, apparatusCode, isWomens, gymnastToTeam, teamLogos, teamNames) {
    // Collect all scores for this apparatus across all teams
    const gymnasts = [];

    if (meet.teams) {
      for (const team of meet.teams) {
        if (team.events) {
          for (const event of team.events) {
            const eventCode = this._normalizeApparatus(event.event_name);
            if (eventCode !== apparatusCode) continue;

            if (event.gymnasts) {
              for (const g of event.gymnasts) {
                const score = parseFloat(g.final_score) || 0;
                if (score <= 0) continue; // Skip zero/scratched scores

                // Get team info
                const teamKey = team.tricode || team.short_name || '';
                const teamInfo = gymnastToTeam[g.gymnast_id] || gymnastToTeam[g.full_name] || {};
                const teamName = teamInfo.name || teamNames[teamKey] || team.name || '';
                const teamLogo = teamInfo.logo || teamLogos[teamKey] || team.logo || '';

                // Get detailed scores
                const diff = g.scores && g.scores.length > 0
                  ? parseFloat(g.scores[0].start) || 0
                  : 0;
                const exec = parseFloat(g.e_score) || 0;
                const nd = parseFloat(g.neutral) || 0;
                const bonus = parseFloat(g.bonus) || 0;
                const stickBonus = bonus > 0;

                const fullName = g.full_name || `${g.first_name || ''} ${g.last_name || ''}`.trim();

                gymnasts.push({
                  name: fullName,
                  team: teamName,
                  teamLogo,
                  score,
                  diff: isWomens ? null : diff,
                  exec: isWomens ? null : exec,
                  stickBonus: isWomens ? null : stickBonus,
                  gymnastId: g.gymnast_id,
                  apparatus: apparatusCode
                });
              }
            }
          }
        }
      }
    }

    // Sort by score descending
    gymnasts.sort((a, b) => b.score - a.score);

    // Apply gap ranking
    let currentRank = 1;
    for (let i = 0; i < gymnasts.length; i++) {
      if (i > 0 && gymnasts[i].score < gymnasts[i - 1].score) {
        currentRank = i + 1; // Skip tied positions
      }
      gymnasts[i].rank = currentRank;
    }

    // Compute isTied for each gymnast
    const rankCounts = {};
    for (const g of gymnasts) {
      rankCounts[g.rank] = (rankCounts[g.rank] || 0) + 1;
    }
    for (const g of gymnasts) {
      g.isTied = rankCounts[g.rank] > 1;
    }

    // Return top 10
    return gymnasts.slice(0, 10);
  }

  /**
   * Process All-Around leaderboard
   * @private
   */
  async _processAllAround(meet, isWomens, gymnastToTeam, teamLogos, teamNames) {
    const requiredEventCount = isWomens ? 4 : 6;
    const requiredEvents = isWomens
      ? ['VAULT', 'UBARS', 'BARS', 'BEAM', 'FLOOR', 'UB', 'VT', 'BB', 'FX']
      : ['FLOOR', 'HORSE', 'RINGS', 'VAULT', 'PBARS', 'BAR', 'FX', 'PH', 'SR', 'VT', 'PB', 'HB'];

    // First try to use pre-aggregated event_results
    const aaResults = meet.event_results?.find(e =>
      e.event_name === 'All Around' || e.event_name === 'AA'
    );

    if (aaResults?.gymnasts?.length >= 5) {
      // Use pre-aggregated results
      const gymnasts = [];
      for (const g of aaResults.gymnasts) {
        const score = parseFloat(g.final_score) || 0;
        if (score <= 0) continue;

        const fullName = g.full_name || `${g.first_name || ''} ${g.last_name || ''}`.trim();
        const teamInfo = gymnastToTeam[g.gymnast_id] || gymnastToTeam[fullName] || {};
        const teamKey = g.tricode || g.short_name || '';
        const teamName = teamInfo.name || teamNames[teamKey] || g.team_name || '';
        const teamLogo = teamInfo.logo || teamLogos[teamKey] || '';

        gymnasts.push({
          name: fullName,
          team: teamName,
          teamLogo,
          score,
          rank: g.place || 0,
          gymnastId: g.gymnast_id,
          apparatus: 'AA'
        });
      }

      // Re-apply gap ranking and isTied
      gymnasts.sort((a, b) => b.score - a.score);
      let currentRank = 1;
      for (let i = 0; i < gymnasts.length; i++) {
        if (i > 0 && gymnasts[i].score < gymnasts[i - 1].score) {
          currentRank = i + 1;
        }
        gymnasts[i].rank = currentRank;
      }

      const rankCounts = {};
      for (const g of gymnasts) {
        rankCounts[g.rank] = (rankCounts[g.rank] || 0) + 1;
      }
      for (const g of gymnasts) {
        g.isTied = rankCounts[g.rank] > 1;
      }

      return gymnasts.slice(0, 10);
    }

    // Fall back to manual aggregation
    const gymnastAA = {}; // name -> { scores: {event: score}, total, count, team, logo }

    if (meet.teams) {
      for (const team of meet.teams) {
        const teamName = team.name || team.short_name || team.tricode || '';
        const teamLogo = team.logo || '';

        if (team.events) {
          for (const event of team.events) {
            const rawName = event.event_name;
            const normalizedName = rawName?.toUpperCase() || '';
            if (!requiredEvents.includes(normalizedName) && !requiredEvents.includes(rawName)) {
              continue;
            }

            const eventCode = this._normalizeApparatus(rawName);

            if (event.gymnasts) {
              for (const g of event.gymnasts) {
                const fullName = g.full_name || `${g.first_name || ''} ${g.last_name || ''}`.trim();
                if (!fullName) continue;

                const score = parseFloat(g.final_score) || 0;
                if (score <= 0) continue;

                if (!gymnastAA[fullName]) {
                  gymnastAA[fullName] = {
                    name: fullName,
                    team: teamName,
                    teamLogo,
                    scores: {},
                    eventCount: 0,
                    total: 0,
                    gymnastId: g.gymnast_id
                  };
                }

                // Only count each event once
                if (!gymnastAA[fullName].scores[eventCode]) {
                  gymnastAA[fullName].scores[eventCode] = score;
                  gymnastAA[fullName].eventCount++;
                  gymnastAA[fullName].total += score;
                }
              }
            }
          }
        }
      }
    }

    // Filter to gymnasts with all required events
    const completeGymnasts = Object.values(gymnastAA)
      .filter(g => g.eventCount >= requiredEventCount)
      .sort((a, b) => b.total - a.total);

    // Apply gap ranking
    let currentRank = 1;
    for (let i = 0; i < completeGymnasts.length; i++) {
      if (i > 0 && completeGymnasts[i].total < completeGymnasts[i - 1].total) {
        currentRank = i + 1;
      }
      completeGymnasts[i].rank = currentRank;
    }

    // Compute isTied
    const rankCounts = {};
    for (const g of completeGymnasts) {
      rankCounts[g.rank] = (rankCounts[g.rank] || 0) + 1;
    }

    const result = completeGymnasts.slice(0, 10).map(g => ({
      name: g.name,
      team: g.team,
      teamLogo: g.teamLogo,
      score: g.total,
      rank: g.rank,
      isTied: rankCounts[g.rank] > 1,
      gymnastId: g.gymnastId,
      apparatus: 'AA'
    }));

    return result;
  }

  /**
   * Compute team totals from meet data
   * @private
   */
  _computeTeamTotals(meet) {
    const totals = {};

    if (meet.teams) {
      for (const team of meet.teams) {
        const teamKey = team.tricode || team.short_name || team.name || '';
        if (!teamKey) continue;

        let teamTotal = 0;
        const eventTotals = {};

        if (team.events) {
          for (const event of team.events) {
            const eventCode = this._normalizeApparatus(event.event_name);
            const eventScore = parseFloat(event.event_score) || 0;
            eventTotals[eventCode] = eventScore;
            teamTotal += eventScore;
          }
        }

        totals[teamKey] = {
          name: team.name || teamKey,
          logo: team.logo || '',
          total: teamTotal,
          events: eventTotals
        };
      }
    }

    return totals;
  }

  /**
   * Compute current rotation state from meet data
   * @private
   */
  _computeRotationState(meet, isWomens) {
    // Rotation state indicates which apparatus each team is currently on
    const state = {
      currentRotation: 0,
      teamPositions: {}
    };

    // Look at which events have scores to determine current rotation
    if (meet.teams) {
      let maxRotation = 0;

      for (const team of meet.teams) {
        const teamKey = team.tricode || team.short_name || team.name || '';
        if (!teamKey) continue;

        const completedEvents = [];
        if (team.events) {
          for (const event of team.events) {
            const hasScores = event.gymnasts?.some(g => parseFloat(g.final_score) > 0);
            if (hasScores) {
              completedEvents.push(this._normalizeApparatus(event.event_name));
            }
          }
        }

        state.teamPositions[teamKey] = {
          completedEvents,
          completedCount: completedEvents.length
        };

        if (completedEvents.length > maxRotation) {
          maxRotation = completedEvents.length;
        }
      }

      state.currentRotation = maxRotation;
    }

    return state;
  }

  // ============================================================================
  // Polling Loop
  // ============================================================================

  /**
   * Start the scoring ingestion service
   * Reads config from Firebase and begins polling if session ID exists
   */
  async start() {
    if (this._state !== 'stopped') {
      this._log('warning', 'Service already running');
      return;
    }

    this._log('info', 'Starting scoring ingestion service');

    try {
      // Read config from Firebase
      if (this._firebase) {
        const configRef = this._firebase.ref(`competitions/${this.compId}/config`);
        const snapshot = await configRef.once('value');
        const config = snapshot.val() || {};

        this._virtiusSessionId = config.virtiusSessionId || null;
        this._gender = config.gender || 'womens';

        // Read poll interval from scoringFeed config
        const feedConfig = config.scoringFeed || {};
        this._pollInterval = feedConfig.pollInterval || DEFAULT_POLL_INTERVAL;
      }

      // Guard: no session ID means we can't poll
      if (!this._virtiusSessionId) {
        this._log('warning', 'No virtiusSessionId configured - cannot start polling');
        return;
      }

      // Start polling
      this._startPolling();
      this._state = 'running';

      // Write initial status to Firebase
      await this._updateFeedStatus(FEED_STATUS.OK, null);

      this.emit('started', { compId: this.compId });
      this._log('info', `Started polling every ${this._pollInterval}s`);
      this._broadcastState();

      // Do an immediate poll
      await this._poll();

    } catch (error) {
      this._log('error', `Failed to start: ${error.message}`);
      await this._updateFeedStatus(FEED_STATUS.ERROR, error.message);
      throw error;
    }
  }

  /**
   * Stop the scoring ingestion service
   */
  async stop() {
    if (this._state === 'stopped') {
      return;
    }

    this._log('info', 'Stopping scoring ingestion service');

    this._stopPolling();
    this._state = 'stopped';

    // Write stopped status to Firebase
    await this._updateFeedStatus(FEED_STATUS.STOPPED, null);

    this.emit('stopped', { compId: this.compId });
    this._broadcastState();
  }

  /**
   * Force an immediate poll (manual refresh)
   */
  async forcePoll() {
    if (this._state !== 'running') {
      this._log('warning', 'Cannot force poll - service not running');
      return;
    }

    this._log('info', 'Force poll triggered');
    await this._poll();
  }

  /**
   * Start the polling timer
   * @private
   */
  _startPolling() {
    // Guard against double-start
    this._stopPolling();

    this._pollTimer = setInterval(async () => {
      try {
        await this._poll();
      } catch (err) {
        // Errors are handled inside _poll, this is a safety net
        console.error(`[ScoringIngestion:${this.compId}] Uncaught poll error:`, err.message);
      }
    }, this._pollInterval * 1000);
  }

  /**
   * Stop the polling timer
   * @private
   */
  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * Execute a single poll cycle
   * @private
   */
  async _poll() {
    if (!this._virtiusSessionId) {
      this._log('warning', 'No session ID - skipping poll');
      return;
    }

    this._log('poll', 'Starting poll cycle');
    const pollStartTime = Date.now();

    try {
      // Fetch data from Virtius API
      const rawData = await this._fetchVirtiusData(this._virtiusSessionId);

      // Process into graphic-ready structures
      const processed = await this.processVirtiusData(rawData, this._gender);

      // Write to Firebase using .update() on individual subpaths
      await this._writeToFirebase(processed);

      // Update tracking state
      this._lastPollAt = new Date().toISOString();
      this._lastPollResult = 'success';
      this._lastApiError = null;

      // Update feed status in Firebase
      await this._updateFeedStatus(FEED_STATUS.OK, null);

      const pollDuration = Date.now() - pollStartTime;
      this._log('poll', `Poll completed in ${pollDuration}ms`);

      this.emit('pollCompleted', {
        compId: this.compId,
        duration: pollDuration,
        leaderboardCount: Object.keys(processed.leaderboards).length,
        teamCount: Object.keys(processed.teamTotals).length
      });

      this._broadcastState();

    } catch (error) {
      this._lastPollAt = new Date().toISOString();
      this._lastPollResult = 'error';
      this._lastApiError = {
        message: error.message,
        timestamp: new Date().toISOString()
      };

      // Update feed status in Firebase
      await this._updateFeedStatus(FEED_STATUS.ERROR, error.message);

      this._log('error', `Poll failed: ${error.message}`);

      this.emit('pollError', {
        compId: this.compId,
        error: error.message
      });

      this._broadcastState();

      // Don't throw - let the polling loop continue
    }
  }

  /**
   * Write processed data to Firebase
   * Uses .update() on individual subpaths to avoid overwriting sibling data
   * @private
   */
  async _writeToFirebase(processed) {
    if (!this._firebase) {
      this._log('warning', 'No Firebase reference - skipping write');
      return;
    }

    const scoringRef = this._firebase.ref(`competitions/${this.compId}/scoring`);

    // Write each leaderboard separately
    for (const [apparatus, leaderboard] of Object.entries(processed.leaderboards)) {
      await scoringRef.child(`leaderboard/${apparatus}`).set(leaderboard);
    }

    // Write team totals
    if (processed.teamTotals && Object.keys(processed.teamTotals).length > 0) {
      await scoringRef.child('teamTotals').set(processed.teamTotals);
    }

    // Write rotation state
    if (processed.rotationState) {
      await scoringRef.child('rotationState').set(processed.rotationState);
    }

    // Write updatedAt timestamp
    await scoringRef.child('updatedAt').set(new Date().toISOString());

    this._log('write', `Wrote ${Object.keys(processed.leaderboards).length} leaderboards to Firebase`);
  }

  /**
   * Update feed status in Firebase config
   * @private
   */
  async _updateFeedStatus(status, errorMessage) {
    if (!this._firebase) return;

    const feedRef = this._firebase.ref(`competitions/${this.compId}/config/scoringFeed`);

    const update = {
      status,
      lastPollAt: this._lastPollAt || new Date().toISOString()
    };

    if (errorMessage) {
      update.errorMessage = errorMessage;
    } else {
      // Clear error message on success
      update.errorMessage = null;
    }

    await feedRef.update(update);
  }

  /**
   * Broadcast current state to connected clients
   * @private
   */
  _broadcastState() {
    if (!this._io) return;

    const room = `competition:${this.compId}`;
    this._io.to(room).emit('scoring:stateChanged', this.getState());
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
