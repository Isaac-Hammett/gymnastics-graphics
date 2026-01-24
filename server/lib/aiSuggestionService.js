/**
 * AI Suggestion Service
 *
 * Generates intelligent segment suggestions for rundown planning based on
 * competition metadata, historical patterns, and gymnastics event structure.
 *
 * Phase D: AI Suggestions - Planning (P2)
 * Task 43: Create AI suggestion service on server
 */

import { getDb } from './productionConfigService.js';

// ============================================================================
// Constants
// ============================================================================

// Men's Olympic order
const MENS_EVENTS = ['Floor', 'Pommel Horse', 'Rings', 'Vault', 'Parallel Bars', 'High Bar'];
const MENS_EVENT_CODES = ['FX', 'PH', 'SR', 'VT', 'PB', 'HB'];

// Women's Olympic order
const WOMENS_EVENTS = ['Vault', 'Uneven Bars', 'Balance Beam', 'Floor'];
const WOMENS_EVENT_CODES = ['VT', 'UB', 'BB', 'FX'];

// Segment type definitions
const SEGMENT_TYPES = {
  VIDEO: 'video',
  LIVE: 'live',
  STATIC: 'static',
  BREAK: 'break',
  HOLD: 'hold',
  GRAPHIC: 'graphic',
};

// Confidence levels
const CONFIDENCE = {
  HIGH: 'high',       // 0.8-1.0 - Standard for all meets of this type
  MEDIUM: 'medium',   // 0.5-0.79 - Common but optional
  LOW: 'low',         // 0.2-0.49 - Contextual, based on specific meet details
};

// ============================================================================
// Segment Templates
// ============================================================================

/**
 * Pre-show segment templates (common to all meets)
 */
function getPreShowSegments(context) {
  const { team1Name, team2Name } = context;

  return [
    {
      id: 'template-pre-1',
      name: 'Starting Soon',
      type: SEGMENT_TYPES.STATIC,
      duration: 300,
      scene: 'Starting Soon',
      graphic: null,
      timingMode: 'fixed',
      notes: 'Display starting soon slate while audience enters',
      confidence: 0.95,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'pre-show',
      reason: 'Standard pre-show slate for all broadcasts',
    },
    {
      id: 'template-pre-2',
      name: 'Show Open',
      type: SEGMENT_TYPES.VIDEO,
      duration: 45,
      scene: 'Graphics Fullscreen',
      graphic: null,
      timingMode: 'fixed',
      notes: 'Intro video package',
      confidence: 0.9,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'pre-show',
      reason: 'Standard broadcast intro',
    },
    {
      id: 'template-pre-3',
      name: 'Team Logos',
      type: SEGMENT_TYPES.STATIC,
      duration: 10,
      scene: 'Graphics Fullscreen',
      graphic: { graphicId: 'logos', params: {} },
      timingMode: 'fixed',
      notes: 'Display competing team logos',
      confidence: 0.95,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'pre-show',
      reason: 'Team introduction graphic',
    },
    {
      id: 'template-pre-4',
      name: 'Welcome & Introductions',
      type: SEGMENT_TYPES.LIVE,
      duration: 60,
      scene: 'Talent Camera',
      graphic: null,
      timingMode: 'fixed',
      notes: 'Talent welcomes viewers and introduces the meet',
      confidence: 0.9,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'pre-show',
      reason: 'Standard talent intro segment',
    },
  ];
}

/**
 * Team introduction segment templates
 */
function getTeamIntroSegments(context) {
  const { teams, gender } = context;
  const segments = [];

  teams.forEach((team, index) => {
    if (!team.name) return;

    const teamSlot = index + 1;

    // Team coaches
    segments.push({
      id: `template-team-${teamSlot}-coaches`,
      name: `${team.name} Coaches`,
      type: SEGMENT_TYPES.LIVE,
      duration: 30,
      scene: 'Talent Camera',
      graphic: { graphicId: 'team-coaches', params: { teamSlot } },
      timingMode: 'fixed',
      notes: `Introduce ${team.name} coaching staff`,
      confidence: 0.85,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'team-intro',
      reason: 'Standard team introduction',
      teamContext: team.name,
    });

    // Team roster (if roster exists)
    if (team.roster && team.roster.length > 0) {
      segments.push({
        id: `template-team-${teamSlot}-roster`,
        name: `${team.name} Lineup`,
        type: SEGMENT_TYPES.STATIC,
        duration: 20,
        scene: 'Graphics Fullscreen',
        graphic: { graphicId: 'team-lineup', params: { teamSlot } },
        timingMode: 'fixed',
        notes: `Display ${team.name} starting lineup`,
        confidence: 0.75,
        confidenceLevel: CONFIDENCE.MEDIUM,
        category: 'team-intro',
        reason: 'Roster available - suggest lineup graphic',
        teamContext: team.name,
      });
    }
  });

  return segments;
}

/**
 * Get rotation segments based on competition type
 */
function getRotationSegments(context) {
  const { gender, teamCount, teams } = context;
  const events = gender === 'mens' ? MENS_EVENTS : WOMENS_EVENTS;
  const eventCodes = gender === 'mens' ? MENS_EVENT_CODES : WOMENS_EVENT_CODES;
  const rotationCount = events.length;

  const segments = [];

  for (let rotation = 1; rotation <= rotationCount; rotation++) {
    // Rotation summary graphic
    segments.push({
      id: `template-rotation-${rotation}-summary`,
      name: `Rotation ${rotation} Summary`,
      type: SEGMENT_TYPES.STATIC,
      duration: 15,
      scene: 'Graphics Fullscreen',
      graphic: {
        graphicId: 'event-summary',
        params: {
          summaryMode: 'rotation',
          summaryRotation: rotation,
        }
      },
      timingMode: 'fixed',
      notes: `Display Rotation ${rotation} preview`,
      confidence: 0.9,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'rotation',
      reason: 'Standard rotation intro',
    });

    // Competition action for this rotation
    // For dual meets, teams alternate apparatus
    if (teamCount === 2) {
      // Home team event
      const homeEventIndex = (rotation - 1) % events.length;
      const awayEventIndex = (homeEventIndex + 1) % events.length;

      segments.push({
        id: `template-rotation-${rotation}-action`,
        name: `Rotation ${rotation} - Competition`,
        type: SEGMENT_TYPES.LIVE,
        duration: null, // Manual advance
        scene: 'Dual View',
        graphic: null,
        timingMode: 'manual',
        notes: `${teams[0]?.name || 'Home'} on ${events[homeEventIndex]}, ${teams[1]?.name || 'Away'} on ${events[awayEventIndex]}`,
        confidence: 0.95,
        confidenceLevel: CONFIDENCE.HIGH,
        category: 'rotation',
        reason: 'Main competition segment',
      });
    } else {
      // Multi-team meet - all teams compete simultaneously
      segments.push({
        id: `template-rotation-${rotation}-action`,
        name: `Rotation ${rotation} - Competition`,
        type: SEGMENT_TYPES.LIVE,
        duration: null,
        scene: teamCount > 2 ? 'Quad View' : 'Dual View',
        graphic: null,
        timingMode: 'manual',
        notes: `All teams compete on assigned apparatus`,
        confidence: 0.95,
        confidenceLevel: CONFIDENCE.HIGH,
        category: 'rotation',
        reason: 'Main competition segment',
      });
    }

    // Rotation scores
    segments.push({
      id: `template-rotation-${rotation}-scores`,
      name: `Rotation ${rotation} Scores`,
      type: SEGMENT_TYPES.STATIC,
      duration: 20,
      scene: 'Graphics Fullscreen',
      graphic: { graphicId: 'scoreboard', params: {} },
      timingMode: 'fixed',
      notes: `Display scores after Rotation ${rotation}`,
      confidence: 0.85,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'rotation',
      reason: 'Score update after rotation',
    });

    // Commercial break between rotations (except last)
    if (rotation < rotationCount) {
      segments.push({
        id: `template-rotation-${rotation}-break`,
        name: 'Commercial Break',
        type: SEGMENT_TYPES.BREAK,
        duration: 120,
        scene: 'Starting Soon',
        graphic: null,
        timingMode: 'fixed',
        notes: 'Commercial break between rotations',
        confidence: 0.7,
        confidenceLevel: CONFIDENCE.MEDIUM,
        category: 'break',
        reason: 'Optional break between rotations',
      });
    }
  }

  return segments;
}

/**
 * Post-show segment templates
 */
function getPostShowSegments(context) {
  const { team1Name, team2Name, teamCount } = context;

  return [
    {
      id: 'template-post-1',
      name: 'Final Scores',
      type: SEGMENT_TYPES.STATIC,
      duration: 30,
      scene: 'Graphics Fullscreen',
      graphic: { graphicId: 'scoreboard', params: {} },
      timingMode: 'fixed',
      notes: 'Display final meet scores',
      confidence: 0.95,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'post-show',
      reason: 'Standard final score display',
    },
    {
      id: 'template-post-2',
      name: 'Post-Meet Analysis',
      type: SEGMENT_TYPES.LIVE,
      duration: 120,
      scene: 'Talent Camera',
      graphic: null,
      timingMode: 'fixed',
      notes: 'Talent discusses meet highlights and results',
      confidence: 0.85,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'post-show',
      reason: 'Standard post-meet wrap-up',
    },
    {
      id: 'template-post-3',
      name: 'Credits & Sign-Off',
      type: SEGMENT_TYPES.VIDEO,
      duration: 30,
      scene: 'Graphics Fullscreen',
      graphic: null,
      timingMode: 'fixed',
      notes: 'Production credits and sign-off',
      confidence: 0.9,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'post-show',
      reason: 'Standard broadcast close',
    },
  ];
}

/**
 * Special segment suggestions based on roster analysis
 */
function getSpecialSegments(context) {
  const { teams, seniors, allAmericans } = context;
  const segments = [];

  // Senior recognition segments
  if (seniors && seniors.length > 0) {
    segments.push({
      id: 'template-special-seniors',
      name: 'Senior Recognition',
      type: SEGMENT_TYPES.LIVE,
      duration: 60,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'manual',
      notes: `Recognize seniors: ${seniors.slice(0, 3).map(s => s.name).join(', ')}${seniors.length > 3 ? ` and ${seniors.length - 3} more` : ''}`,
      confidence: 0.8,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'special',
      reason: `${seniors.length} senior(s) competing - suggest recognition segment`,
      athleteContext: seniors,
    });
  }

  // All-American feature
  if (allAmericans && allAmericans.length > 0) {
    segments.push({
      id: 'template-special-all-americans',
      name: 'All-American Spotlight',
      type: SEGMENT_TYPES.LIVE,
      duration: 45,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'fixed',
      notes: `Feature All-Americans: ${allAmericans.slice(0, 2).map(a => a.name).join(', ')}`,
      confidence: 0.7,
      confidenceLevel: CONFIDENCE.MEDIUM,
      category: 'special',
      reason: `${allAmericans.length} All-American(s) competing`,
      athleteContext: allAmericans,
    });
  }

  return segments;
}

// ============================================================================
// Context Analysis
// ============================================================================

/**
 * Parse competition type to extract gender and team count
 */
function parseCompetitionType(compType) {
  if (!compType) return { gender: 'womens', teamCount: 2 };

  const parts = compType.toLowerCase().split('-');
  const gender = parts[0] === 'mens' ? 'mens' : 'womens';

  let teamCount = 2;
  if (parts[1]) {
    const typeMap = { dual: 2, tri: 3, quad: 4, '5': 5, '6': 6 };
    teamCount = typeMap[parts[1]] || 2;
  }

  return { gender, teamCount };
}

/**
 * Build context object from competition config and team data
 */
function buildContext(competitionConfig, teamsData) {
  const { gender, teamCount } = parseCompetitionType(competitionConfig?.compType);

  // Extract team info from config
  const teams = [];
  for (let i = 1; i <= 6; i++) {
    const teamKey = competitionConfig?.[`team${i}Key`];
    const teamName = competitionConfig?.[`team${i}Name`];

    if (teamName) {
      const teamData = teamsData?.[teamKey] || {};
      teams.push({
        slot: i,
        key: teamKey,
        name: teamName,
        logo: competitionConfig?.[`team${i}Logo`],
        roster: teamData.roster || [],
        coaches: competitionConfig?.[`team${i}Coaches`]?.split('\n').filter(Boolean) || [],
      });
    }
  }

  return {
    compId: competitionConfig?.compId,
    eventName: competitionConfig?.eventName,
    meetDate: competitionConfig?.meetDate,
    venue: competitionConfig?.venue,
    location: competitionConfig?.location,
    gender,
    teamCount: teams.length || teamCount,
    teams,
    team1Name: teams[0]?.name || 'Team 1',
    team2Name: teams[1]?.name || 'Team 2',
    // Placeholder for future roster analysis
    seniors: [],
    allAmericans: [],
  };
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate segment suggestions for a competition
 *
 * @param {string} compId - Competition ID
 * @param {Object} options - Generation options
 * @param {boolean} options.includePreShow - Include pre-show segments (default: true)
 * @param {boolean} options.includeTeamIntros - Include team intro segments (default: true)
 * @param {boolean} options.includeRotations - Include rotation segments (default: true)
 * @param {boolean} options.includePostShow - Include post-show segments (default: true)
 * @param {boolean} options.includeSpecial - Include special segments (default: true)
 * @param {number} options.minConfidence - Minimum confidence threshold (default: 0.5)
 * @returns {Promise<Object>} Suggestions result
 */
async function generateSuggestions(compId, options = {}) {
  const {
    includePreShow = true,
    includeTeamIntros = true,
    includeRotations = true,
    includePostShow = true,
    includeSpecial = true,
    minConfidence = 0.5,
  } = options;

  const db = getDb();
  if (!db) {
    return {
      success: false,
      error: 'Firebase not available',
      suggestions: [],
    };
  }

  try {
    // Fetch competition config
    const configSnapshot = await db.ref(`competitions/${compId}/config`).once('value');
    const competitionConfig = configSnapshot.val();

    if (!competitionConfig) {
      return {
        success: false,
        error: 'Competition not found',
        suggestions: [],
      };
    }

    // Fetch teams database for roster info
    const teamsSnapshot = await db.ref('teamsDatabase/teams').once('value');
    const teamsData = teamsSnapshot.val() || {};

    // Build context
    const context = buildContext(competitionConfig, teamsData);

    // Generate suggestions by category
    let suggestions = [];

    if (includePreShow) {
      suggestions = suggestions.concat(getPreShowSegments(context));
    }

    if (includeTeamIntros) {
      suggestions = suggestions.concat(getTeamIntroSegments(context));
    }

    if (includeRotations) {
      suggestions = suggestions.concat(getRotationSegments(context));
    }

    if (includePostShow) {
      suggestions = suggestions.concat(getPostShowSegments(context));
    }

    if (includeSpecial) {
      suggestions = suggestions.concat(getSpecialSegments(context));
    }

    // Filter by confidence threshold
    suggestions = suggestions.filter(s => s.confidence >= minConfidence);

    // Add order indices
    suggestions = suggestions.map((s, index) => ({
      ...s,
      suggestedOrder: index + 1,
    }));

    return {
      success: true,
      context: {
        compId,
        eventName: context.eventName,
        gender: context.gender,
        teamCount: context.teamCount,
        teams: context.teams.map(t => ({ name: t.name, rosterSize: t.roster?.length || 0 })),
      },
      suggestions,
      meta: {
        totalSuggestions: suggestions.length,
        byCategory: {
          'pre-show': suggestions.filter(s => s.category === 'pre-show').length,
          'team-intro': suggestions.filter(s => s.category === 'team-intro').length,
          'rotation': suggestions.filter(s => s.category === 'rotation').length,
          'post-show': suggestions.filter(s => s.category === 'post-show').length,
          'special': suggestions.filter(s => s.category === 'special').length,
          'break': suggestions.filter(s => s.category === 'break').length,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[AISuggestionService] Error generating suggestions:', error);
    return {
      success: false,
      error: error.message,
      suggestions: [],
    };
  }
}

/**
 * Get suggestions for a specific category
 */
async function getSuggestionsByCategory(compId, category) {
  const result = await generateSuggestions(compId, {
    includePreShow: category === 'pre-show' || category === 'all',
    includeTeamIntros: category === 'team-intro' || category === 'all',
    includeRotations: category === 'rotation' || category === 'all',
    includePostShow: category === 'post-show' || category === 'all',
    includeSpecial: category === 'special' || category === 'all',
  });

  if (category !== 'all') {
    result.suggestions = result.suggestions.filter(s => s.category === category);
  }

  return result;
}

/**
 * Get a quick suggestion count without full generation
 */
async function getSuggestionCount(compId) {
  const db = getDb();
  if (!db) {
    return { count: 0, available: false };
  }

  try {
    const configSnapshot = await db.ref(`competitions/${compId}/config`).once('value');
    const config = configSnapshot.val();

    if (!config) {
      return { count: 0, available: false };
    }

    const { gender, teamCount } = parseCompetitionType(config.compType);
    const events = gender === 'mens' ? MENS_EVENTS : WOMENS_EVENTS;

    // Estimate suggestion count:
    // Pre-show (4) + Team intros (2 per team) + Rotations (3-4 per rotation) + Post-show (3) + Specials (0-2)
    const preShowCount = 4;
    const teamIntroCount = teamCount * 2;
    const rotationCount = events.length * 4; // summary + action + scores + break
    const postShowCount = 3;

    return {
      count: preShowCount + teamIntroCount + rotationCount + postShowCount,
      available: true,
      gender,
      teamCount,
    };
  } catch (error) {
    return { count: 0, available: false, error: error.message };
  }
}

// ============================================================================
// Export
// ============================================================================

const aiSuggestionService = {
  generateSuggestions,
  getSuggestionsByCategory,
  getSuggestionCount,
  // Expose constants for testing
  SEGMENT_TYPES,
  CONFIDENCE,
  MENS_EVENTS,
  WOMENS_EVENTS,
};

export default aiSuggestionService;

export {
  generateSuggestions,
  getSuggestionsByCategory,
  getSuggestionCount,
  SEGMENT_TYPES,
  CONFIDENCE,
  MENS_EVENTS,
  WOMENS_EVENTS,
};
