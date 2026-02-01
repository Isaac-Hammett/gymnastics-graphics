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

/**
 * Segment type patterns for context generation
 */
const SEGMENT_PATTERNS = {
  rotation: /rotation\s*(\d+)/i,
  event: /\b(floor|vault|bars|beam|rings|pommel|parallel|high bar|fx|vt|ub|bb|sr|ph|pb|hb)\b/i,
  team: /\b(intro|introduction|welcome)\b/i,
  interview: /\b(interview|feature|spotlight|profile)\b/i,
  scoring: /\b(score|scoring|results?|standings?)\b/i,
  break: /\b(break|intermission|halftime)\b/i,
  opening: /\b(open|opening|pre-?show|warmup)\b/i,
  closing: /\b(close|closing|post-?show|wrap|finale)\b/i,
};

/**
 * Event short code to full name mapping
 */
const EVENT_FULL_NAMES = {
  FX: 'Floor Exercise',
  VT: 'Vault',
  UB: 'Uneven Bars',
  BB: 'Balance Beam',
  PH: 'Pommel Horse',
  SR: 'Still Rings',
  PB: 'Parallel Bars',
  HB: 'High Bar',
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
    this._rtnStats = null;  // RTN stats snapshot from competitions/{compId}/rtnStats/

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

    // Load RTN stats snapshot (frozen at show start)
    await this._loadRtnStats();

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
      if (!showState || showState.state !== 'running') {
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
      achievements: [],
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

      // Scan for career highs and records (Task 60)
      const achievements = await this.scanForAchievements();
      context.achievements = achievements;

      // Add achievement-based talking points
      const achievementPoints = this._getAchievementTalkingPoints(achievements);
      context.talkingPoints.push(...achievementPoints);
    }

    // Generate basic talking points based on segment type
    const basicPoints = this._getBasicTalkingPoints(segment);
    context.talkingPoints.push(...basicPoints);

    // Generate RTN athlete stats talking points (Task 18)
    const segmentContext = this._analyzeSegmentName(segment.name || '');
    const athleteStatsPoints = this._getAthleteStatsTalkingPoints(segment, segmentContext);
    context.talkingPoints.push(...athleteStatsPoints);

    // Generate consistency trend talking points (Task 19)
    const consistencyPoints = this._getConsistencyTalkingPoints(segment, segmentContext);
    context.talkingPoints.push(...consistencyPoints);

    // Generate MVP and lineup talking points (Task 21)
    const mvpPoints = this._getMVPTalkingPoints(segment, segmentContext);
    context.talkingPoints.push(...mvpPoints);

    const lineupPoints = this._getLineupTalkingPoints(segment, segmentContext);
    context.talkingPoints.push(...lineupPoints);

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
   * Generate talking points from detected achievements
   *
   * @param {Array} achievements - Detected achievements
   * @returns {Array} Achievement-based talking points
   */
  _getAchievementTalkingPoints(achievements) {
    const points = [];

    for (const achievement of achievements) {
      const eventName = EVENT_FULL_NAMES[achievement.event] || achievement.event;

      if (achievement.type === 'career_high') {
        points.push({
          id: `career-high-${achievement.athleteName}-${Date.now()}`,
          type: CONTEXT_TYPES.SCORE,
          priority: PRIORITY.CRITICAL,
          text: `🎉 CAREER HIGH! ${achievement.athleteName} just scored ${achievement.score.toFixed(3)} on ${eventName} - beats previous best of ${achievement.previousHigh?.toFixed(3)} by ${achievement.improvement}!`,
          source: 'achievement-detection',
          data: achievement,
        });
      } else if (achievement.type === 'season_high') {
        points.push({
          id: `season-high-${achievement.athleteName}-${Date.now()}`,
          type: CONTEXT_TYPES.SCORE,
          priority: PRIORITY.HIGH,
          text: `⭐ SEASON HIGH! ${achievement.athleteName} scores ${achievement.score.toFixed(3)} on ${eventName} - their best of the season!`,
          source: 'achievement-detection',
          data: achievement,
        });
      } else if (achievement.type === 'record_broken') {
        const record = achievement.records[0];
        const recordType = record.type === 'school' ? 'SCHOOL RECORD' : 'MEET RECORD';
        points.push({
          id: `record-${achievement.athleteName}-${Date.now()}`,
          type: CONTEXT_TYPES.MILESTONE,
          priority: PRIORITY.CRITICAL,
          text: `🏆 NEW ${recordType}! ${achievement.athleteName} breaks the ${eventName} record with ${achievement.score.toFixed(3)}! Previous record: ${record.previousScore.toFixed(3)} by ${record.previousHolder}`,
          source: 'achievement-detection',
          data: achievement,
        });
      } else if (achievement.type === 'record_tied') {
        const record = achievement.tiedRecords[0];
        const recordType = record.type === 'school' ? 'school record' : 'meet record';
        points.push({
          id: `record-tied-${achievement.athleteName}-${Date.now()}`,
          type: CONTEXT_TYPES.MILESTONE,
          priority: PRIORITY.HIGH,
          text: `📊 ${achievement.athleteName} TIES the ${recordType} on ${eventName} with ${achievement.score.toFixed(3)}!`,
          source: 'achievement-detection',
          data: achievement,
        });
      }
    }

    return points;
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
   * Enhanced in Task 59 with intelligent context-aware generation based on:
   * - Segment name/type patterns
   * - Team data (seniors, rankings, coaches)
   * - Event-specific context
   * - Matchup analysis
   *
   * @param {Object} segment - Segment data
   * @returns {Array} Talking points
   */
  _getBasicTalkingPoints(segment) {
    const points = [];

    // Always include segment notes if present (highest priority)
    if (segment.notes) {
      points.push({
        id: `notes-${segment.id}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.HIGH,
        text: segment.notes,
        source: 'segment-notes',
      });
    }

    // Analyze segment name for context patterns
    const segmentName = segment.name || '';
    const segmentContext = this._analyzeSegmentName(segmentName);

    // Generate points based on segment context
    if (segmentContext.isRotation) {
      points.push(...this._getRotationTalkingPoints(segmentContext, segment));
    }

    if (segmentContext.isTeamIntro) {
      points.push(...this._getTeamIntroTalkingPoints(segment));
    }

    if (segmentContext.isInterview) {
      points.push(...this._getInterviewTalkingPoints(segment));
    }

    if (segmentContext.isScoring) {
      points.push(...this._getScoringTalkingPoints(segment));
    }

    if (segmentContext.isOpening) {
      points.push(...this._getOpeningTalkingPoints(segment));
    }

    if (segmentContext.isClosing) {
      points.push(...this._getClosingTalkingPoints(segment));
    }

    if (segmentContext.isBreak) {
      points.push(...this._getBreakTalkingPoints(segment));
    }

    // Add event-specific talking points if an event is detected
    if (segmentContext.event) {
      points.push(...this._getEventTalkingPoints(segmentContext.event, segment));
    }

    // Add matchup context if we have team data
    if (this._teamData) {
      const matchupPoints = this._getMatchupTalkingPoints(segment);
      points.push(...matchupPoints);
    }

    // Add type-specific context
    if (segment.type === 'live' || segment.type === 'LIVE') {
      points.push({
        id: `live-${segment.id}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.LOW,
        text: 'Live segment - engage with the audience',
        source: 'segment-type',
      });
    }

    return points;
  }

  /**
   * Analyze segment name to extract context patterns
   *
   * @param {string} name - Segment name
   * @returns {Object} Extracted context
   */
  _analyzeSegmentName(name) {
    const context = {
      isRotation: false,
      rotationNumber: null,
      event: null,
      isTeamIntro: false,
      isInterview: false,
      isScoring: false,
      isBreak: false,
      isOpening: false,
      isClosing: false,
    };

    // Check for rotation
    const rotationMatch = name.match(SEGMENT_PATTERNS.rotation);
    if (rotationMatch) {
      context.isRotation = true;
      context.rotationNumber = parseInt(rotationMatch[1], 10);
    }

    // Check for event references
    const eventMatch = name.match(SEGMENT_PATTERNS.event);
    if (eventMatch) {
      context.event = this._normalizeEventName(eventMatch[1]);
    }

    // Check other patterns
    context.isTeamIntro = SEGMENT_PATTERNS.team.test(name);
    context.isInterview = SEGMENT_PATTERNS.interview.test(name);
    context.isScoring = SEGMENT_PATTERNS.scoring.test(name);
    context.isBreak = SEGMENT_PATTERNS.break.test(name);
    context.isOpening = SEGMENT_PATTERNS.opening.test(name);
    context.isClosing = SEGMENT_PATTERNS.closing.test(name);

    return context;
  }

  /**
   * Normalize event name to short code
   *
   * @param {string} eventName - Event name or code
   * @returns {string} Normalized event code
   */
  _normalizeEventName(eventName) {
    const normalized = eventName.toUpperCase().trim();

    // Direct matches
    if (EVENT_FULL_NAMES[normalized]) return normalized;

    // Map full names to codes
    const nameMap = {
      FLOOR: 'FX',
      VAULT: 'VT',
      BARS: 'UB',
      BEAM: 'BB',
      POMMEL: 'PH',
      RINGS: 'SR',
      PARALLEL: 'PB',
      'HIGH BAR': 'HB',
    };

    return nameMap[normalized] || normalized;
  }

  /**
   * Generate talking points for rotation segments
   */
  _getRotationTalkingPoints(context, segment) {
    const points = [];
    const rotation = context.rotationNumber;

    if (rotation === 1) {
      points.push({
        id: `rotation-start-${segment.id}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.MEDIUM,
        text: 'First rotation - set the stage for the competition, introduce the teams and format',
        source: 'rotation-context',
      });
    } else if (rotation === 6) {
      points.push({
        id: `rotation-final-${segment.id}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.HIGH,
        text: 'Final rotation - championship moments ahead, build tension for the finish',
        source: 'rotation-context',
      });
    }

    // Add event-specific context for the rotation
    if (context.event) {
      const eventName = EVENT_FULL_NAMES[context.event] || context.event;
      points.push({
        id: `rotation-event-${segment.id}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.MEDIUM,
        text: `Teams competing on ${eventName} - highlight key athletes and watch for standout performances`,
        source: 'rotation-context',
      });
    }

    return points;
  }

  /**
   * Generate talking points for team introduction segments
   */
  _getTeamIntroTalkingPoints(segment) {
    const points = [];

    // Extract team info from segment name
    const segmentName = segment.name || '';

    // Get seniors from team data
    const seniors = this._getSeniorsFromTeamData();
    if (seniors.length > 0) {
      const seniorNames = seniors.slice(0, 3).map((s) => s.firstName || s.fullName.split(' ')[0]);
      points.push({
        id: `seniors-${segment.id}`,
        type: CONTEXT_TYPES.ATHLETE,
        priority: PRIORITY.HIGH,
        text: `Senior spotlight: ${seniorNames.join(', ')} - their final season`,
        source: 'roster-analysis',
        data: { seniors: seniors.slice(0, 3) },
      });
    }

    // Get freshmen for "new faces" context
    const freshmen = this._getFreshmenFromTeamData();
    if (freshmen.length > 0) {
      const freshmanNames = freshmen.slice(0, 2).map((f) => f.firstName || f.fullName.split(' ')[0]);
      points.push({
        id: `freshmen-${segment.id}`,
        type: CONTEXT_TYPES.ATHLETE,
        priority: PRIORITY.MEDIUM,
        text: `New faces to watch: ${freshmanNames.join(', ')} making their mark this season`,
        source: 'roster-analysis',
        data: { freshmen: freshmen.slice(0, 2) },
      });
    }

    // Add coach info
    const coaches = this._getCoachesFromTeamData();
    if (coaches.length > 0) {
      const headCoach = coaches.find((c) => c.position?.toLowerCase().includes('head')) || coaches[0];
      if (headCoach) {
        points.push({
          id: `coach-${segment.id}`,
          type: CONTEXT_TYPES.SEGMENT,
          priority: PRIORITY.MEDIUM,
          text: `Led by head coach ${headCoach.fullName || headCoach.firstName + ' ' + headCoach.lastName}`,
          source: 'team-data',
          data: { coach: headCoach },
        });
      }
    }

    return points;
  }

  /**
   * Generate talking points for interview/feature segments
   */
  _getInterviewTalkingPoints(segment) {
    const points = [];

    points.push({
      id: `interview-${segment.id}`,
      type: CONTEXT_TYPES.SEGMENT,
      priority: PRIORITY.MEDIUM,
      text: 'Feature segment - keep questions concise, let the subject tell their story',
      source: 'segment-type',
    });

    return points;
  }

  /**
   * Generate talking points for scoring segments
   */
  _getScoringTalkingPoints(segment) {
    const points = [];

    points.push({
      id: `scoring-${segment.id}`,
      type: CONTEXT_TYPES.SEGMENT,
      priority: PRIORITY.MEDIUM,
      text: 'Scoring update - compare current standings, highlight momentum shifts',
      source: 'segment-type',
    });

    return points;
  }

  /**
   * Generate talking points for opening segments
   */
  _getOpeningTalkingPoints(segment) {
    const points = [];

    points.push({
      id: `opening-${segment.id}`,
      type: CONTEXT_TYPES.SEGMENT,
      priority: PRIORITY.HIGH,
      text: 'Welcome viewers, set the scene for today\'s competition, preview key matchups',
      source: 'segment-type',
    });

    // Add matchup preview from rankings
    const rankingContext = this._getRankingComparisonContext();
    if (rankingContext) {
      points.push({
        id: `rankings-${segment.id}`,
        type: CONTEXT_TYPES.MATCHUP,
        priority: PRIORITY.MEDIUM,
        text: rankingContext,
        source: 'rankings-data',
      });
    }

    return points;
  }

  /**
   * Generate talking points for closing segments
   */
  _getClosingTalkingPoints(segment) {
    const points = [];

    points.push({
      id: `closing-${segment.id}`,
      type: CONTEXT_TYPES.SEGMENT,
      priority: PRIORITY.HIGH,
      text: 'Wrap up with final scores, standout performances, and what\'s next for both teams',
      source: 'segment-type',
    });

    return points;
  }

  /**
   * Generate talking points for break segments
   */
  _getBreakTalkingPoints(segment) {
    const points = [];

    points.push({
      id: `break-${segment.id}`,
      type: CONTEXT_TYPES.SEGMENT,
      priority: PRIORITY.MEDIUM,
      text: 'Transition segment - preview upcoming rotations, update standings if available',
      source: 'segment-type',
    });

    return points;
  }

  /**
   * Generate event-specific talking points
   */
  _getEventTalkingPoints(eventCode, segment) {
    const points = [];
    const eventName = EVENT_FULL_NAMES[eventCode] || eventCode;

    // Event-specific commentary tips
    const eventTips = {
      FX: 'Watch for tumbling passes, dance elements, and stick landings - energy and artistry matter',
      VT: 'Key factors: table height, distance, rotation, and landing - look for amplitude and control',
      UB: 'Focus on release moves, transitions, and dismounts - handstands and connections are crucial',
      BB: 'Balance, artistry, and confidence - watch for wobbles and deductions, acro series is key',
      PH: 'Continuous circular motion, scissors work - watch for leg separations and pauses',
      SR: 'Strength holds, swings, and dismount - look for stability and controlled movements',
      PB: 'Release moves, swings, and handstands - watch for form and dismount execution',
      HB: 'Release moves and catches, giant swings - dismount often determines the score',
    };

    if (eventTips[eventCode]) {
      points.push({
        id: `event-tips-${segment.id}`,
        type: CONTEXT_TYPES.SEGMENT,
        priority: PRIORITY.MEDIUM,
        text: `${eventName}: ${eventTips[eventCode]}`,
        source: 'event-expertise',
      });
    }

    // Get event-specific ranking comparison
    const eventRankings = this._getEventRankingComparison(eventCode);
    if (eventRankings) {
      points.push({
        id: `event-rankings-${segment.id}`,
        type: CONTEXT_TYPES.MATCHUP,
        priority: PRIORITY.MEDIUM,
        text: eventRankings,
        source: 'rankings-data',
      });
    }

    return points;
  }

  /**
   * Generate head-to-head matchup talking points from RTN individual stats
   *
   * Compares athletes across teams on the same events using individual highs
   * and averages. Also pulls league rankings from rtnCache/rankings/ if available.
   * Uses PRIORITY.HIGH to compete well in the 5-slot talking points budget.
   * Generates during rotation start and scoring segments.
   *
   * @param {Object} segment - Current segment
   * @returns {Array} Matchup talking points
   */
  _getMatchupTalkingPoints(segment) {
    const points = [];

    if (!this._teamData) return points;

    // Generate during rotation start, scoring, opening, and intro segments
    const segmentName = (segment.name || '').toLowerCase();
    const segmentContext = this._analyzeSegmentName(segment.name || '');
    const isRelevantSegment = segmentContext.isRotation || segmentContext.isScoring ||
      segmentContext.isOpening || segmentName.includes('intro');

    if (!isRelevantSegment) return points;

    // Determine focus event from segment context
    const focusEvent = segmentContext.event || null;

    // If we have RTN stats, generate athlete-level matchup comparisons
    if (this._rtnStats) {
      const matchupPoints = this._generateAthleteMatchups(segment, focusEvent);
      points.push(...matchupPoints);
    }

    // Add team-level ranking comparison (existing logic, upgraded to HIGH priority)
    const comparison = this._getRankingComparisonContext();
    if (comparison && !points.some((p) => p.source === 'rankings-data')) {
      points.push({
        id: `matchup-ranking-${segment.id}`,
        type: CONTEXT_TYPES.MATCHUP,
        priority: PRIORITY.HIGH,
        text: comparison,
        source: 'rankings-data',
      });
    }

    // Add league ranking context if available
    const leaguePoints = this._getLeagueRankingMatchupPoints(segment, focusEvent);
    points.push(...leaguePoints);

    // Limit to 3 matchup points to stay within budget
    return points.slice(0, 3);
  }

  /**
   * Generate athlete-level head-to-head matchup comparisons
   *
   * Finds the best athletes on each event from each team and compares them.
   * Focuses on events where competition is closest (smallest gap).
   *
   * @param {Object} segment - Current segment
   * @param {string|null} focusEvent - Event to focus on, or null for all
   * @returns {Array} Athlete matchup talking points
   */
  _generateAthleteMatchups(segment, focusEvent) {
    const points = [];

    // Collect team keys that have stats
    const teamsWithStats = [];
    for (const teamKey of ['team1', 'team2', 'team3', 'team4', 'team5', 'team6']) {
      if (this._rtnStats[teamKey]?.individualHighs || this._rtnStats[teamKey]?.individualAverages) {
        teamsWithStats.push(teamKey);
      }
    }

    if (teamsWithStats.length < 2) return points;

    // Get all event codes to compare
    const allEvents = focusEvent ? [focusEvent] : this._getCompetitionEvents();

    // Build per-team top athlete maps: { eventCode: { name, avg, high } }
    const teamTopAthletes = {};
    for (const teamKey of teamsWithStats) {
      teamTopAthletes[teamKey] = this._getTopAthletesPerEvent(teamKey);
    }

    // Generate pairwise comparisons between teams
    const matchups = [];
    for (let i = 0; i < teamsWithStats.length - 1; i++) {
      for (let j = i + 1; j < teamsWithStats.length; j++) {
        const teamA = teamsWithStats[i];
        const teamB = teamsWithStats[j];

        for (const eventCode of allEvents) {
          const athleteA = teamTopAthletes[teamA]?.[eventCode];
          const athleteB = teamTopAthletes[teamB]?.[eventCode];

          if (!athleteA || !athleteB) continue;

          // Calculate gap using averages (more meaningful than highs for matchups)
          const avgA = athleteA.avg;
          const avgB = athleteB.avg;
          const highA = athleteA.high;
          const highB = athleteB.high;

          // Need at least one comparison metric
          if (avgA == null && highA == null) continue;
          if (avgB == null && highB == null) continue;

          const gap = (avgA != null && avgB != null) ? Math.abs(avgA - avgB) : null;

          matchups.push({
            eventCode,
            teamA,
            teamB,
            athleteA,
            athleteB,
            gap,
            avgA,
            avgB,
            highA,
            highB,
          });
        }
      }
    }

    // Sort by closest competition (smallest gap) — most interesting matchups first
    matchups.sort((a, b) => {
      if (a.gap == null && b.gap == null) return 0;
      if (a.gap == null) return 1;
      if (b.gap == null) return -1;
      return a.gap - b.gap;
    });

    // Generate talking points from top matchups
    for (const matchup of matchups.slice(0, 3)) {
      const eventName = EVENT_FULL_NAMES[matchup.eventCode] || matchup.eventCode;
      const teamAName = this._getTeamDisplayName(matchup.teamA);
      const teamBName = this._getTeamDisplayName(matchup.teamB);

      // Build comparison text with available stats
      let text = `${eventName} matchup: ${matchup.athleteA.name}`;
      const partsA = [];
      if (matchup.highA != null) partsA.push(`${matchup.highA.toFixed(3)} high`);
      if (matchup.avgA != null) partsA.push(`${matchup.avgA.toFixed(3)} avg`);
      if (partsA.length) text += ` (${partsA.join(', ')})`;

      text += ` vs ${matchup.athleteB.name}`;
      const partsB = [];
      if (matchup.highB != null) partsB.push(`${matchup.highB.toFixed(3)} high`);
      if (matchup.avgB != null) partsB.push(`${matchup.avgB.toFixed(3)} avg`);
      if (partsB.length) text += ` (${partsB.join(', ')})`;

      points.push({
        id: `matchup-h2h-${matchup.eventCode}-${matchup.teamA}-${matchup.teamB}-${segment.id}`,
        type: CONTEXT_TYPES.MATCHUP,
        priority: PRIORITY.HIGH,
        text,
        source: 'rtn-matchup',
        data: {
          event: matchup.eventCode,
          teamA: teamAName,
          teamB: teamBName,
          athleteA: matchup.athleteA,
          athleteB: matchup.athleteB,
          gap: matchup.gap,
        },
      });
    }

    return points;
  }

  /**
   * Get the top athlete per event for a team from RTN stats
   *
   * @param {string} teamKey - Team key (e.g., 'team1')
   * @returns {Object} Map of eventCode -> { name, avg, high, rtnId }
   */
  _getTopAthletesPerEvent(teamKey) {
    const result = {};
    const teamStats = this._rtnStats[teamKey];
    if (!teamStats) return result;

    const individualAverages = this._toArray(teamStats.individualAverages);
    const individualHighs = this._toArray(teamStats.individualHighs);
    const rosterByRtnId = this._buildRosterRtnIdMap(teamKey);

    // Build a combined map: rtnId -> { name, events: { eventCode: { avg, high } } }
    const athleteMap = new Map();

    for (const athlete of individualAverages) {
      if (!athlete?.events) continue;
      const rtnId = athlete.rtnId ? String(athlete.rtnId) : null;
      const name = this._matchAthleteToRoster(athlete, rosterByRtnId) ||
                   athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim();
      const key = rtnId || name;
      if (!key) continue;

      if (!athleteMap.has(key)) athleteMap.set(key, { name, events: {} });
      const entry = athleteMap.get(key);
      for (const [eventCode, avg] of Object.entries(athlete.events)) {
        if (avg == null || eventCode === 'AA') continue;
        if (!entry.events[eventCode]) entry.events[eventCode] = {};
        entry.events[eventCode].avg = typeof avg === 'number' ? avg : null;
      }
    }

    for (const athlete of individualHighs) {
      if (!athlete?.events) continue;
      const rtnId = athlete.rtnId ? String(athlete.rtnId) : null;
      const name = this._matchAthleteToRoster(athlete, rosterByRtnId) ||
                   athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim();
      const key = rtnId || name;
      if (!key) continue;

      if (!athleteMap.has(key)) athleteMap.set(key, { name, events: {} });
      const entry = athleteMap.get(key);
      for (const [eventCode, high] of Object.entries(athlete.events)) {
        if (high == null || eventCode === 'AA') continue;
        if (!entry.events[eventCode]) entry.events[eventCode] = {};
        entry.events[eventCode].high = typeof high === 'number' ? high : null;
      }
    }

    // For each event, find the top athlete by average (or high if no average)
    for (const [, athleteData] of athleteMap) {
      for (const [eventCode, stats] of Object.entries(athleteData.events)) {
        const score = stats.avg ?? stats.high ?? 0;
        if (!result[eventCode] || score > (result[eventCode].avg ?? result[eventCode].high ?? 0)) {
          result[eventCode] = {
            name: athleteData.name,
            avg: stats.avg ?? null,
            high: stats.high ?? null,
          };
        }
      }
    }

    return result;
  }

  /**
   * Get event codes for the current competition based on gender
   *
   * @returns {string[]} Array of event codes
   */
  _getCompetitionEvents() {
    // Try to determine gender from competition config
    const compType = this._competitionConfig?.compType || '';
    if (compType.includes('womens')) {
      return ['VT', 'UB', 'BB', 'FX'];
    }
    if (compType.includes('mens')) {
      return ['FX', 'PH', 'SR', 'VT', 'PB', 'HB'];
    }

    // Fallback: check RTN stats meta for gender
    for (const teamKey of ['team1', 'team2']) {
      const meta = this._rtnStats?.[teamKey]?.meta;
      if (meta?.gender === 'womens') return ['VT', 'UB', 'BB', 'FX'];
      if (meta?.gender === 'mens') return ['FX', 'PH', 'SR', 'VT', 'PB', 'HB'];
    }

    // Default to women's events (more common)
    return ['VT', 'UB', 'BB', 'FX'];
  }

  /**
   * Generate talking points from league rankings for matchup context
   * Reads from this._leagueRankings (loaded at start) or cached data
   *
   * @param {Object} segment - Current segment
   * @param {string|null} focusEvent - Event to focus on, or null
   * @returns {Array} League ranking matchup points
   */
  _getLeagueRankingMatchupPoints(segment, focusEvent) {
    const points = [];

    if (!this._rtnStats) return points;

    // Look for individual ranking data from any team's stats to find nationally ranked athletes
    for (const teamKey of ['team1', 'team2', 'team3', 'team4', 'team5', 'team6']) {
      const teamStats = this._rtnStats[teamKey];
      if (!teamStats?.teamRanking) continue;

      const teamName = this._getTeamDisplayName(teamKey);
      const ranking = teamStats.teamRanking;

      // If team has a national ranking and it's notable (top 25)
      const rank = parseInt(ranking.rank, 10);
      if (!isNaN(rank) && rank <= 25 && ranking.ave) {
        // Check if we already have a ranking comparison from _getRankingComparisonContext
        // Only add individual team ranking if it wasn't already covered
        if (!points.some(p => p.data?.teamKey === teamKey)) {
          // Only add if focused on this being useful context (e.g., opening segment)
          if (focusEvent == null) {
            points.push({
              id: `league-rank-${teamKey}-${segment.id}`,
              type: CONTEXT_TYPES.MATCHUP,
              priority: PRIORITY.HIGH,
              text: `${teamName} ranked #${ranking.rank} nationally (${ranking.ave} avg, ${ranking.high} high)`,
              source: 'rtn-league-ranking',
              data: { teamKey, team: teamName, rank: ranking.rank, ave: ranking.ave, high: ranking.high },
            });
          }
        }
      }
    }

    // Limit to 2 league ranking points
    return points.slice(0, 2);
  }

  /**
   * Get seniors from team data
   */
  _getSeniorsFromTeamData() {
    const seniors = [];
    if (!this._teamData) return seniors;

    for (const teamKey of ['team1', 'team2']) {
      const team = this._teamData[teamKey];
      if (team?.roster) {
        const teamSeniors = team.roster.filter((a) => a.year === 4);
        seniors.push(...teamSeniors.map((s) => ({ ...s, team: teamKey })));
      }
    }

    return seniors;
  }

  /**
   * Get freshmen from team data
   */
  _getFreshmenFromTeamData() {
    const freshmen = [];
    if (!this._teamData) return freshmen;

    for (const teamKey of ['team1', 'team2']) {
      const team = this._teamData[teamKey];
      if (team?.roster) {
        const teamFreshmen = team.roster.filter((a) => a.year === 1);
        freshmen.push(...teamFreshmen.map((f) => ({ ...f, team: teamKey })));
      }
    }

    return freshmen;
  }

  /**
   * Get coaches from team data
   */
  _getCoachesFromTeamData() {
    const coaches = [];
    if (!this._teamData) return coaches;

    for (const teamKey of ['team1', 'team2']) {
      const team = this._teamData[teamKey];
      if (team?.coaches) {
        coaches.push(...team.coaches.map((c) => ({ ...c, team: teamKey })));
      }
    }

    return coaches;
  }

  /**
   * Get ranking comparison context text
   */
  _getRankingComparisonContext() {
    if (!this._teamData?.team1?.rankings || !this._teamData?.team2?.rankings) {
      return null;
    }

    const team1 = this._teamData.team1;
    const team2 = this._teamData.team2;
    const r1 = team1.rankings;
    const r2 = team2.rankings;

    if (!r1.team || !r2.team) return null;

    // Find which team is ranked higher
    const team1Name = this._getTeamDisplayName('team1');
    const team2Name = this._getTeamDisplayName('team2');

    if (r1.team < r2.team) {
      return `${team1Name} (ranked #${r1.team}) vs ${team2Name} (#${r2.team}) - ${Math.abs(r1.team - r2.team)} spots separate these teams`;
    } else if (r2.team < r1.team) {
      return `${team2Name} (ranked #${r2.team}) vs ${team1Name} (#${r1.team}) - ${Math.abs(r1.team - r2.team)} spots separate these teams`;
    } else {
      return `Both teams ranked #${r1.team} - evenly matched heading into today`;
    }
  }

  /**
   * Get event-specific ranking comparison
   */
  _getEventRankingComparison(eventCode) {
    if (!this._teamData?.team1?.rankings || !this._teamData?.team2?.rankings) {
      return null;
    }

    const eventRankingKey = {
      FX: 'floor',
      VT: 'vault',
      UB: 'bars',
      BB: 'beam',
      PH: 'horse',
      SR: 'rings',
      PB: 'pbars',
      HB: 'hbar',
    };

    const key = eventRankingKey[eventCode];
    if (!key) return null;

    const r1 = this._teamData.team1.rankings[key];
    const r2 = this._teamData.team2.rankings[key];

    if (!r1 || !r2) return null;

    const team1Name = this._getTeamDisplayName('team1');
    const team2Name = this._getTeamDisplayName('team2');
    const eventName = EVENT_FULL_NAMES[eventCode] || eventCode;

    if (r1 < r2) {
      return `On ${eventName}: ${team1Name} ranked #${r1}, ${team2Name} #${r2}`;
    } else if (r2 < r1) {
      return `On ${eventName}: ${team2Name} ranked #${r2}, ${team1Name} #${r1}`;
    }

    return null;
  }

  /**
   * Get team display name from competition config or team data
   */
  _getTeamDisplayName(teamKey) {
    // Try competition config first
    if (this._competitionConfig?.teams?.[teamKey]?.name) {
      return this._competitionConfig.teams[teamKey].name;
    }

    // Fall back to extracting from schedule opponent
    const team = this._teamData?.[teamKey];
    if (team?.schedule?.[0]?.opponent) {
      // Try to extract from context
      return teamKey === 'team1' ? 'Team 1' : 'Team 2';
    }

    return teamKey === 'team1' ? 'Home' : 'Away';
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
  // Career High / Record Detection (Task 60)
  // ==========================================================================

  /**
   * Check if a score is a career high for an athlete
   *
   * Compares against:
   * 1. Stored career bests in Firebase (athleteStats/{athleteId}/careerBests)
   * 2. Season bests from current show's score tracking
   * 3. Previous scores in current meet
   *
   * @param {string} athleteName - Athlete name
   * @param {string} event - Event code (FX, VT, etc.)
   * @param {number} score - Score to check
   * @returns {Promise<Object>} Career high check result
   */
  async checkCareerHigh(athleteName, event, score) {
    if (!athleteName || !event || typeof score !== 'number') {
      return { isCareerHigh: false, reason: 'invalid_input' };
    }

    try {
      // Get athlete's stored career bests
      const careerBests = await this._getAthleteCareerBests(athleteName);
      const previousHigh = careerBests?.[event] || null;

      // Check if this is a career high
      const isCareerHigh = previousHigh === null || score > previousHigh;
      const isSeasonHigh = await this._checkSeasonHigh(athleteName, event, score);
      const isMeetHigh = this._checkMeetHigh(athleteName, event, score);

      // Determine the type of achievement
      let achievementType = null;
      if (isCareerHigh && previousHigh !== null) {
        achievementType = 'career_high';
      } else if (isSeasonHigh) {
        achievementType = 'season_high';
      } else if (isMeetHigh) {
        achievementType = 'meet_high';
      }

      const result = {
        isCareerHigh: isCareerHigh && previousHigh !== null,
        isSeasonHigh,
        isMeetHigh,
        achievementType,
        previousHigh,
        improvement: previousHigh ? (score - previousHigh).toFixed(3) : null,
        score,
        event,
        athleteName,
      };

      // If this is a notable achievement, store it and generate alert
      if (achievementType) {
        await this._recordAchievement(result);
      }

      return result;
    } catch (error) {
      console.error(`[AIContextService] Error checking career high:`, error);
      return { isCareerHigh: false, error: error.message };
    }
  }

  /**
   * Detect if a score breaks any records
   *
   * Checks against:
   * 1. School records (stored in Firebase)
   * 2. Meet records (if available)
   * 3. Venue records (if available)
   *
   * @param {string} athleteName - Athlete name
   * @param {string} event - Event code
   * @param {number} score - Score to check
   * @param {string} teamTricode - Team tricode for school record lookup
   * @returns {Promise<Object>} Record check result
   */
  async checkRecords(athleteName, event, score, teamTricode = null) {
    if (!athleteName || !event || typeof score !== 'number') {
      return { breaksRecord: false, reason: 'invalid_input' };
    }

    const brokenRecords = [];

    try {
      // Check school record
      const schoolRecord = await this._getSchoolRecord(teamTricode, event);
      if (schoolRecord && score > schoolRecord.score) {
        brokenRecords.push({
          type: 'school',
          previousScore: schoolRecord.score,
          previousHolder: schoolRecord.holder,
          previousDate: schoolRecord.date,
          improvement: (score - schoolRecord.score).toFixed(3),
        });
      }

      // Check meet record (from current competition config)
      const meetRecord = await this._getMeetRecord(event);
      if (meetRecord && score > meetRecord.score) {
        brokenRecords.push({
          type: 'meet',
          previousScore: meetRecord.score,
          previousHolder: meetRecord.holder,
          previousYear: meetRecord.year,
          improvement: (score - meetRecord.score).toFixed(3),
        });
      }

      // Check if this ties a record (within 0.001)
      const tiedRecords = [];
      if (schoolRecord && Math.abs(score - schoolRecord.score) < 0.001) {
        tiedRecords.push({ type: 'school', score: schoolRecord.score });
      }
      if (meetRecord && Math.abs(score - meetRecord.score) < 0.001) {
        tiedRecords.push({ type: 'meet', score: meetRecord.score });
      }

      const result = {
        breaksRecord: brokenRecords.length > 0,
        tiesRecord: tiedRecords.length > 0,
        records: brokenRecords,
        tiedRecords,
        athleteName,
        event,
        score,
      };

      // If a record is broken, record it
      if (brokenRecords.length > 0) {
        await this._recordBrokenRecord(result);
      }

      return result;
    } catch (error) {
      console.error(`[AIContextService] Error checking records:`, error);
      return { breaksRecord: false, error: error.message };
    }
  }

  /**
   * Scan recent scores for career highs and records
   * Called during context updates to detect achievements in live scores
   *
   * @returns {Promise<Array>} List of detected achievements
   */
  async scanForAchievements() {
    const achievements = [];

    if (!this._virtiusData?.available || !this._virtiusData.recentScores) {
      return achievements;
    }

    // Get team tricodes for record lookups
    const teamTricodes = this._virtiusData.teams?.map(t => t.tricode) || [];

    for (const scoreData of this._virtiusData.recentScores) {
      // Skip if already processed
      const scoreKey = `${scoreData.athlete}-${scoreData.event}-${scoreData.score}`;
      if (this._processedScores?.has(scoreKey)) {
        continue;
      }

      // Mark as processed
      if (!this._processedScores) {
        this._processedScores = new Set();
      }
      this._processedScores.add(scoreKey);

      // Check for career high
      const careerResult = await this.checkCareerHigh(
        scoreData.athlete,
        scoreData.event,
        scoreData.score
      );

      if (careerResult.achievementType) {
        achievements.push({
          type: careerResult.achievementType,
          ...careerResult,
          timestamp: new Date().toISOString(),
        });
      }

      // Check for records
      const teamTricode = scoreData.team || teamTricodes[0];
      const recordResult = await this.checkRecords(
        scoreData.athlete,
        scoreData.event,
        scoreData.score,
        teamTricode
      );

      if (recordResult.breaksRecord) {
        achievements.push({
          type: 'record_broken',
          ...recordResult,
          timestamp: new Date().toISOString(),
        });
      } else if (recordResult.tiesRecord) {
        achievements.push({
          type: 'record_tied',
          ...recordResult,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Store achievements in current context
    if (achievements.length > 0) {
      this._recentAchievements = [
        ...achievements,
        ...(this._recentAchievements || []).slice(0, 20), // Keep last 20
      ];

      // Broadcast achievements
      this._broadcastAchievements(achievements);
    }

    return achievements;
  }

  /**
   * Get athlete's career bests from Firebase or cache
   *
   * @param {string} athleteName - Athlete name
   * @returns {Promise<Object|null>} Career bests by event
   */
  async _getAthleteCareerBests(athleteName) {
    if (!athleteName) return null;

    // Check cache first
    if (!this._careerBestsCache) {
      this._careerBestsCache = new Map();
    }

    const cacheKey = athleteName.toLowerCase().trim();
    if (this._careerBestsCache.has(cacheKey)) {
      return this._careerBestsCache.get(cacheKey);
    }

    // Try to load from Firebase
    const db = getDb();
    if (db) {
      try {
        const athleteKey = this._normalizeNameForKey(athleteName);
        const snapshot = await db.ref(`athleteStats/${athleteKey}/careerBests`).once('value');
        const careerBests = snapshot.val();

        if (careerBests) {
          this._careerBestsCache.set(cacheKey, careerBests);
          return careerBests;
        }
      } catch (error) {
        console.warn(`[AIContextService] Error loading career bests:`, error);
      }
    }

    // Try to get from team data roster (some rosters include season bests)
    const rosterBests = this._getAthleteFromRoster(athleteName);
    if (rosterBests?.seasonBests) {
      this._careerBestsCache.set(cacheKey, rosterBests.seasonBests);
      return rosterBests.seasonBests;
    }

    return null;
  }

  /**
   * Check if score is a season high
   *
   * @param {string} athleteName - Athlete name
   * @param {string} event - Event code
   * @param {number} score - Score to check
   * @returns {Promise<boolean>} True if season high
   */
  async _checkSeasonHigh(athleteName, event, score) {
    // Check session-tracked scores
    if (!this._sessionScores) {
      this._sessionScores = new Map();
    }

    const key = `${athleteName.toLowerCase()}-${event}`;
    const previousBest = this._sessionScores.get(key) || 0;

    if (score > previousBest) {
      this._sessionScores.set(key, score);
      return previousBest > 0; // Only true if there was a previous score
    }

    return false;
  }

  /**
   * Check if score is the athlete's meet high
   *
   * @param {string} athleteName - Athlete name
   * @param {string} event - Event code
   * @param {number} score - Score to check
   * @returns {boolean} True if meet high
   */
  _checkMeetHigh(athleteName, event, score) {
    if (!this._virtiusData?.eventResults) return false;

    const eventData = this._virtiusData.eventResults[event];
    if (!eventData?.gymnasts) return false;

    // Find all scores by this athlete on this event
    const athleteScores = eventData.gymnasts.filter(
      g => g.name?.toLowerCase().includes(athleteName.toLowerCase()) ||
           athleteName.toLowerCase().includes(g.lastName?.toLowerCase() || '')
    );

    // If only one score, it's their meet high by default
    if (athleteScores.length <= 1) return false;

    // Check if current score is highest
    const maxPreviousScore = Math.max(...athleteScores.map(s => s.score || 0));
    return score >= maxPreviousScore;
  }

  /**
   * Get school record for an event
   *
   * @param {string} teamTricode - Team tricode
   * @param {string} event - Event code
   * @returns {Promise<Object|null>} School record data
   */
  async _getSchoolRecord(teamTricode, event) {
    if (!teamTricode) return null;

    const db = getDb();
    if (!db) return null;

    try {
      const snapshot = await db.ref(`schoolRecords/${teamTricode}/${event}`).once('value');
      return snapshot.val();
    } catch (error) {
      console.warn(`[AIContextService] Error loading school record:`, error);
      return null;
    }
  }

  /**
   * Get meet record for an event
   *
   * @param {string} event - Event code
   * @returns {Promise<Object|null>} Meet record data
   */
  async _getMeetRecord(event) {
    if (!this._competitionConfig?.meetRecords) return null;
    return this._competitionConfig.meetRecords[event] || null;
  }

  /**
   * Record an achievement to Firebase
   *
   * @param {Object} achievement - Achievement data
   */
  async _recordAchievement(achievement) {
    const db = getDb();
    if (!db || !this.compId) return;

    try {
      const achievementData = {
        ...achievement,
        compId: this.compId,
        recordedAt: new Date().toISOString(),
      };

      // Store in competition's achievements
      await db.ref(`competitions/${this.compId}/production/achievements`).push(achievementData);

      // Update athlete's career best if applicable
      if (achievement.isCareerHigh) {
        const athleteKey = this._normalizeNameForKey(achievement.athleteName);
        await db.ref(`athleteStats/${athleteKey}/careerBests/${achievement.event}`).set(achievement.score);
      }

      console.log(`[AIContextService] Recorded achievement: ${achievement.achievementType} for ${achievement.athleteName}`);
    } catch (error) {
      console.warn(`[AIContextService] Error recording achievement:`, error);
    }
  }

  /**
   * Record a broken record to Firebase
   *
   * @param {Object} recordData - Record data
   */
  async _recordBrokenRecord(recordData) {
    const db = getDb();
    if (!db || !this.compId) return;

    try {
      // Store in competition's broken records
      await db.ref(`competitions/${this.compId}/production/brokenRecords`).push({
        ...recordData,
        compId: this.compId,
        recordedAt: new Date().toISOString(),
      });

      console.log(`[AIContextService] Recorded broken record for ${recordData.athleteName}`);
    } catch (error) {
      console.warn(`[AIContextService] Error recording broken record:`, error);
    }
  }

  /**
   * Broadcast achievements to connected clients
   *
   * @param {Array} achievements - Achievements to broadcast
   */
  _broadcastAchievements(achievements) {
    if (!this.io || !this.compId || !achievements.length) return;

    this.io.to(`competition:${this.compId}`).emit('aiAchievementsDetected', {
      compId: this.compId,
      achievements,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get athlete data from loaded roster
   *
   * @param {string} athleteName - Athlete name to find
   * @returns {Object|null} Athlete data from roster
   */
  _getAthleteFromRoster(athleteName) {
    if (!this._teamData) return null;

    const normalized = athleteName.toLowerCase().trim();

    for (const teamKey of ['team1', 'team2']) {
      const roster = this._teamData[teamKey]?.roster;
      if (!roster) continue;

      const athlete = roster.find(a =>
        a.fullName?.toLowerCase() === normalized ||
        `${a.firstName} ${a.lastName}`.toLowerCase() === normalized ||
        a.lastName?.toLowerCase() === normalized.split(' ').pop()
      );

      if (athlete) {
        return { ...athlete, teamKey };
      }
    }

    return null;
  }

  /**
   * Normalize athlete name to Firebase-safe key
   *
   * @param {string} name - Athlete name
   * @returns {string} Normalized key
   */
  _normalizeNameForKey(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[.#$[\]]/g, '')
      .replace(/\s+/g, '-');
  }

  /**
   * Get recent achievements
   *
   * @returns {Array} Recent achievements
   */
  getRecentAchievements() {
    return this._recentAchievements || [];
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
   * Load RTN stats snapshot from Firebase
   * Reads the frozen snapshot at competitions/{compId}/rtnStats/
   * This data was captured at show start by snapshotStatsForCompetition()
   */
  async _loadRtnStats() {
    const db = getDb();
    if (!db || !this.compId) {
      return;
    }

    try {
      const snapshot = await db.ref(`competitions/${this.compId}/rtnStats`).once('value');
      this._rtnStats = snapshot.val();

      if (this._rtnStats) {
        console.log(`[AIContextService] Loaded RTN stats snapshot for ${this.compId}`);
      } else {
        console.log(`[AIContextService] No RTN stats snapshot available for ${this.compId}`);
      }
    } catch (error) {
      console.warn(`[AIContextService] Error loading RTN stats:`, error);
      this._rtnStats = null;
    }
  }

  /**
   * Generate athlete-specific talking points from RTN individual stats
   *
   * Uses individual averages and highs from the RTN stats snapshot.
   * Matches athletes via rtnId (from teamData roster) or falls back to name matching.
   * Only generates during non-scoring segments (opening, intro, break, rotation start).
   *
   * @param {Object} segment - Current segment
   * @param {Object} segmentContext - Analyzed segment context
   * @returns {Array} Athlete stats talking points
   */
  _getAthleteStatsTalkingPoints(segment, segmentContext) {
    const points = [];

    if (!this._rtnStats) return points;

    // Only generate during non-scoring segments
    if (segmentContext.isScoring) return points;

    // Determine which event to focus on (if any)
    const focusEvent = segmentContext.event || null;

    // Iterate over teams in the snapshot
    for (const teamKey of ['team1', 'team2', 'team3', 'team4', 'team5', 'team6']) {
      const teamStats = this._rtnStats[teamKey];
      if (!teamStats) continue;

      const teamName = this._getTeamDisplayName(teamKey);
      const individualAverages = this._toArray(teamStats.individualAverages);
      const individualHighs = this._toArray(teamStats.individualHighs);

      if (!individualAverages.length && !individualHighs.length) continue;

      // Build a map of rtnId -> roster athlete for matching
      const rosterByRtnId = this._buildRosterRtnIdMap(teamKey);

      // Generate points from top averages
      for (const athlete of individualAverages.slice(0, 5)) {
        if (!athlete?.events) continue;

        const matchedName = this._matchAthleteToRoster(athlete, rosterByRtnId);
        const displayName = matchedName || athlete.fullName || `${athlete.firstName} ${athlete.lastName}`;
        if (!displayName) continue;

        // If we have a focus event, only mention that event
        const events = focusEvent ? { [focusEvent]: athlete.events[focusEvent] } : athlete.events;

        for (const [eventCode, avg] of Object.entries(events)) {
          if (avg === null || avg === undefined || eventCode === 'AA') continue;
          const eventName = EVENT_FULL_NAMES[eventCode] || eventCode;

          // Only generate points for notable averages (9.7+)
          if (typeof avg === 'number' && avg >= 9.7) {
            points.push({
              id: `rtn-avg-${displayName}-${eventCode}-${segment.id}`,
              type: CONTEXT_TYPES.ATHLETE,
              priority: PRIORITY.MEDIUM,
              text: `${displayName} (${teamName}) averages ${avg.toFixed(3)} on ${eventName}`,
              source: 'rtn-stats',
              data: { athlete: displayName, team: teamName, event: eventCode, average: avg },
            });
          }
        }
      }

      // Generate points from season highs
      for (const athlete of individualHighs.slice(0, 5)) {
        if (!athlete?.events) continue;

        const matchedName = this._matchAthleteToRoster(athlete, rosterByRtnId);
        const displayName = matchedName || athlete.fullName || `${athlete.firstName} ${athlete.lastName}`;
        if (!displayName) continue;

        const events = focusEvent ? { [focusEvent]: athlete.events[focusEvent] } : athlete.events;

        for (const [eventCode, high] of Object.entries(events)) {
          if (high === null || high === undefined || eventCode === 'AA') continue;
          const eventName = EVENT_FULL_NAMES[eventCode] || eventCode;

          // Only generate points for notable highs (9.9+)
          if (typeof high === 'number' && high >= 9.9) {
            points.push({
              id: `rtn-high-${displayName}-${eventCode}-${segment.id}`,
              type: CONTEXT_TYPES.ATHLETE,
              priority: PRIORITY.MEDIUM,
              text: `${displayName} (${teamName}) season high ${high.toFixed(3)} on ${eventName}`,
              source: 'rtn-stats',
              data: { athlete: displayName, team: teamName, event: eventCode, high },
            });
          }
        }
      }
    }

    // Deduplicate: prefer average over high for same athlete+event
    const seen = new Set();
    const deduped = [];
    for (const point of points) {
      const key = `${point.data?.athlete}-${point.data?.event}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(point);
      }
    }

    // Limit to top 4 to avoid overwhelming the talking points budget
    return deduped.slice(0, 4);
  }

  /**
   * Generate consistency trend talking points from RTN consistency data
   *
   * Analyzes per-event score arrays over time to detect trends:
   * - "improving" if last 3 scores are increasing
   * - "declining" if last 3 scores are decreasing
   * - "stable" otherwise
   *
   * Only generates during non-scoring segments (opening, intro, break, rotation start).
   * Uses PRIORITY.MEDIUM.
   *
   * @param {Object} segment - Current segment
   * @param {Object} segmentContext - Analyzed segment context
   * @returns {Array} Consistency trend talking points
   */
  _getConsistencyTalkingPoints(segment, segmentContext) {
    const points = [];

    if (!this._rtnStats) return points;

    // Only generate during non-scoring segments
    if (segmentContext.isScoring) return points;

    // Determine which event to focus on (if any)
    const focusEvent = segmentContext.event || null;

    for (const teamKey of ['team1', 'team2', 'team3', 'team4', 'team5', 'team6']) {
      const teamStats = this._rtnStats[teamKey];
      if (!teamStats?.consistency?.events) continue;

      const teamName = this._getTeamDisplayName(teamKey);
      const labels = this._toArray(teamStats.consistency.labels);
      const events = teamStats.consistency.events;

      for (const [eventCode, scores] of Object.entries(events)) {
        // If there's a focus event, only analyze that one
        if (focusEvent && eventCode !== focusEvent) continue;

        const scoreArr = this._toArray(scores).filter(s => typeof s === 'number' && s > 0);
        if (scoreArr.length < 3) continue;

        const eventName = EVENT_FULL_NAMES[eventCode] || eventCode;

        // Analyze trend using last 3 scores
        const last3 = scoreArr.slice(-3);
        const trend = this._detectTrend(last3);

        // Calculate standard deviation for consistency rating
        const stdDev = this._standardDeviation(scoreArr);
        const consistencyRating = stdDev < 0.15 ? 'very consistent' :
                                  stdDev < 0.3 ? 'consistent' :
                                  stdDev < 0.5 ? 'somewhat inconsistent' : 'inconsistent';

        // Format score progression string (last 3-4 scores)
        const recentScores = scoreArr.slice(-4);
        const scoreProgression = recentScores.map(s => s.toFixed(2)).join(' → ');

        if (trend === 'improving') {
          points.push({
            id: `rtn-trend-up-${teamKey}-${eventCode}-${segment.id}`,
            type: CONTEXT_TYPES.MATCHUP,
            priority: PRIORITY.MEDIUM,
            text: `${teamName} trending up on ${eventName}: ${scoreProgression}`,
            source: 'rtn-consistency',
            data: { team: teamName, event: eventCode, trend, scores: recentScores, stdDev, consistencyRating },
          });
        } else if (trend === 'declining') {
          points.push({
            id: `rtn-trend-down-${teamKey}-${eventCode}-${segment.id}`,
            type: CONTEXT_TYPES.MATCHUP,
            priority: PRIORITY.MEDIUM,
            text: `${teamName} trending down on ${eventName}: ${scoreProgression}`,
            source: 'rtn-consistency',
            data: { team: teamName, event: eventCode, trend, scores: recentScores, stdDev, consistencyRating },
          });
        } else if (consistencyRating === 'very consistent') {
          // Stable and very consistent is worth noting
          const avg = scoreArr.reduce((a, b) => a + b, 0) / scoreArr.length;
          points.push({
            id: `rtn-consistent-${teamKey}-${eventCode}-${segment.id}`,
            type: CONTEXT_TYPES.MATCHUP,
            priority: PRIORITY.MEDIUM,
            text: `${teamName} ${consistencyRating} on ${eventName} — averaging ${avg.toFixed(3)} across ${scoreArr.length} meets`,
            source: 'rtn-consistency',
            data: { team: teamName, event: eventCode, trend: 'stable', scores: recentScores, stdDev, consistencyRating, average: avg },
          });
        }
      }
    }

    // Limit to top 3 consistency points to avoid overwhelming the budget
    return points.slice(0, 3);
  }

  /**
   * Generate MVP talking points from RTN MVP data
   *
   * Highlights top contributors by total cumulative score across all events.
   * Also includes theoretical max from topScores data.
   * Only generates during non-scoring segments (opening, intro, break).
   * Uses PRIORITY.MEDIUM.
   *
   * @param {Object} segment - Current segment
   * @param {Object} segmentContext - Analyzed segment context
   * @returns {Array} MVP talking points
   */
  _getMVPTalkingPoints(segment, segmentContext) {
    const points = [];

    if (!this._rtnStats) return points;

    // Only generate during non-scoring segments
    if (segmentContext.isScoring) return points;

    for (const teamKey of ['team1', 'team2', 'team3', 'team4', 'team5', 'team6']) {
      const teamStats = this._rtnStats[teamKey];
      if (!teamStats) continue;

      const teamName = this._getTeamDisplayName(teamKey);
      const rosterByRtnId = this._buildRosterRtnIdMap(teamKey);

      // MVP talking points
      const mvpData = this._toArray(teamStats.mvp);
      if (mvpData.length > 0) {
        // Top MVP contributor
        const topMvp = mvpData[0];
        if (topMvp?.total && topMvp.total > 0) {
          const displayName = this._matchAthleteToRoster(topMvp, rosterByRtnId) ||
                              topMvp.fullName || `${topMvp.firstName || ''} ${topMvp.lastName || ''}`.trim();
          if (displayName) {
            points.push({
              id: `rtn-mvp-${teamKey}-${segment.id}`,
              type: CONTEXT_TYPES.ATHLETE,
              priority: PRIORITY.MEDIUM,
              text: `${displayName} leads ${teamName} with ${topMvp.total.toFixed(2)} total contribution across all events`,
              source: 'rtn-mvp',
              data: { athlete: displayName, team: teamName, total: topMvp.total },
            });
          }
        }
      }

      // Top scores / theoretical max
      const topScores = teamStats.topScores;
      if (topScores?.theoreticalMax && typeof topScores.theoreticalMax === 'number') {
        points.push({
          id: `rtn-themax-${teamKey}-${segment.id}`,
          type: CONTEXT_TYPES.MATCHUP,
          priority: PRIORITY.MEDIUM,
          text: `${teamName}'s theoretical max is ${topScores.theoreticalMax.toFixed(3)} if everyone hits their season highs`,
          source: 'rtn-topscores',
          data: { team: teamName, theoreticalMax: topScores.theoreticalMax },
        });
      }
    }

    // Limit to 3 points
    return points.slice(0, 3);
  }

  /**
   * Generate lineup talking points from RTN lineup data
   *
   * Highlights athletes who have competed in every meet (ironman gymnasts),
   * and detects recent additions to the lineup.
   * Only generates during non-scoring segments (opening, intro, break).
   * Uses PRIORITY.MEDIUM.
   *
   * @param {Object} segment - Current segment
   * @param {Object} segmentContext - Analyzed segment context
   * @returns {Array} Lineup talking points
   */
  _getLineupTalkingPoints(segment, segmentContext) {
    const points = [];

    if (!this._rtnStats) return points;

    // Only generate during non-scoring segments
    if (segmentContext.isScoring) return points;

    for (const teamKey of ['team1', 'team2', 'team3', 'team4', 'team5', 'team6']) {
      const teamStats = this._rtnStats[teamKey];
      if (!teamStats) continue;

      const teamName = this._getTeamDisplayName(teamKey);
      const rosterByRtnId = this._buildRosterRtnIdMap(teamKey);
      const lineupData = this._toArray(teamStats.lineup);

      if (!lineupData.length) continue;

      // Find total number of meets from the longest meets array
      let totalMeets = 0;
      for (const athlete of lineupData) {
        const meets = this._toArray(athlete.meets);
        if (meets.length > totalMeets) totalMeets = meets.length;
      }

      if (totalMeets === 0) continue;

      // Find ironman gymnasts (competed in every meet, rate === 1 or close)
      const ironmen = [];
      // Find recent additions (last meet is 1, but not all meets)
      const recentAdditions = [];

      for (const athlete of lineupData) {
        const meets = this._toArray(athlete.meets);
        const rate = typeof athlete.rate === 'number' ? athlete.rate : meets.filter(m => m === 1).length / totalMeets;
        const displayName = this._matchAthleteToRoster(athlete, rosterByRtnId) ||
                            athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim();
        if (!displayName) continue;

        const meetsCompeted = meets.filter(m => m === 1).length;

        if (rate >= 1.0 && totalMeets >= 3) {
          ironmen.push({ name: displayName, meets: meetsCompeted, total: totalMeets });
        }

        // Detect recent lineup addition: last meet is 1, but competed in fewer than half
        if (meets.length >= 2 && meets[meets.length - 1] === 1 && rate < 0.5 && meetsCompeted >= 1) {
          recentAdditions.push({ name: displayName, meets: meetsCompeted, total: totalMeets });
        }
      }

      // Ironman gymnasts (competed in all meets)
      if (ironmen.length > 0 && ironmen.length <= 5) {
        const names = ironmen.map(a => a.name);
        const meetCount = ironmen[0].total;
        points.push({
          id: `rtn-ironman-${teamKey}-${segment.id}`,
          type: CONTEXT_TYPES.ATHLETE,
          priority: PRIORITY.MEDIUM,
          text: `${names.join(', ')} ${names.length === 1 ? 'has' : 'have'} competed in all ${meetCount} meets for ${teamName}`,
          source: 'rtn-lineup',
          data: { team: teamName, athletes: ironmen, type: 'ironman' },
        });
      }

      // Recent lineup additions
      for (const addition of recentAdditions.slice(0, 1)) {
        points.push({
          id: `rtn-newlineup-${teamKey}-${addition.name}-${segment.id}`,
          type: CONTEXT_TYPES.ATHLETE,
          priority: PRIORITY.MEDIUM,
          text: `${addition.name} recently added to ${teamName}'s lineup — competed in ${addition.meets} of ${addition.total} meets`,
          source: 'rtn-lineup',
          data: { team: teamName, athlete: addition.name, type: 'recent-addition', meets: addition.meets, total: addition.total },
        });
      }
    }

    // Limit to 3 points
    return points.slice(0, 3);
  }

  /**
   * Detect trend direction from an array of scores
   *
   * @param {number[]} scores - Array of at least 3 scores (chronological order)
   * @returns {'improving'|'declining'|'stable'} Trend direction
   */
  _detectTrend(scores) {
    if (scores.length < 3) return 'stable';

    const last3 = scores.slice(-3);
    const isIncreasing = last3[0] < last3[1] && last3[1] < last3[2];
    const isDecreasing = last3[0] > last3[1] && last3[1] > last3[2];

    if (isIncreasing) return 'improving';
    if (isDecreasing) return 'declining';
    return 'stable';
  }

  /**
   * Calculate standard deviation of an array of numbers
   *
   * @param {number[]} values - Array of numbers
   * @returns {number} Standard deviation
   */
  _standardDeviation(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => (v - mean) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Build a map of rtnId -> roster athlete name for a team
   * Uses this._teamData.team{N}.roster[].rtnId
   *
   * @param {string} teamKey - Team key (e.g., 'team1')
   * @returns {Map} rtnId -> fullName map
   */
  _buildRosterRtnIdMap(teamKey) {
    const map = new Map();
    const roster = this._teamData?.[teamKey]?.roster;
    if (!roster || !Array.isArray(roster)) return map;

    for (const athlete of roster) {
      if (athlete.rtnId) {
        const name = athlete.fullName || athlete.name || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim();
        if (name) {
          map.set(String(athlete.rtnId), name);
        }
      }
    }

    return map;
  }

  /**
   * Match an RTN stats athlete record to a roster athlete
   * Tries rtnId match first, falls back to name matching
   *
   * @param {Object} rtnAthlete - RTN athlete record with rtnId, fullName, etc.
   * @param {Map} rosterByRtnId - Map of rtnId -> fullName from roster
   * @returns {string|null} Matched athlete name or null
   */
  _matchAthleteToRoster(rtnAthlete, rosterByRtnId) {
    // Try rtnId match first
    if (rtnAthlete.rtnId && rosterByRtnId.has(String(rtnAthlete.rtnId))) {
      return rosterByRtnId.get(String(rtnAthlete.rtnId));
    }

    // Fall back to name matching via _getAthleteFromRoster
    const rtnName = rtnAthlete.fullName || `${rtnAthlete.firstName || ''} ${rtnAthlete.lastName || ''}`.trim();
    if (rtnName) {
      const match = this._getAthleteFromRoster(rtnName);
      if (match) {
        return match.fullName || match.name || rtnName;
      }
    }

    return null;
  }

  /**
   * Convert Firebase object-or-array to array
   * Firebase may store arrays as objects with numeric keys
   *
   * @param {*} data - Firebase data (array, object, or null)
   * @returns {Array} Normalized array
   */
  _toArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') return Object.values(data);
    return [];
  }

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
      achievements: {
        recentCount: this._recentAchievements?.length || 0,
        processedScoresCount: this._processedScores?.size || 0,
        careerBestsCacheSize: this._careerBestsCache?.size || 0,
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
  SEGMENT_PATTERNS,
  EVENT_FULL_NAMES,
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
  SEGMENT_PATTERNS,
  EVENT_FULL_NAMES,
};
