/**
 * AI Suggestion Service
 *
 * Generates intelligent segment suggestions for rundown planning based on
 * competition metadata, historical patterns, and gymnastics event structure.
 *
 * Phase D: AI Suggestions - Planning (P2)
 * Task 43: Create AI suggestion service on server
 * Task 44: Analyze competition metadata (type, teams, date)
 * Task 45: Query roster data for seniors, All-Americans, milestones
 * Task 46: Generate segment suggestions with confidence scores
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

// Confidence scoring factors - multipliers and bonuses for different context signals
const CONFIDENCE_FACTORS = {
  // Base confidence for having data
  HAS_ROSTER_DATA: 0.1,        // Bonus when roster data is available
  HAS_TEAM_STATS: 0.1,         // Bonus when team stats are available
  HAS_DATE_INFO: 0.05,         // Bonus when date/season info is available

  // Context-based adjustments
  CHAMPIONSHIP_MEET: 0.15,     // Bonus for championship meets (higher stakes = more segments)
  LATE_SEASON: 0.1,            // Bonus for late season (more storylines)
  CLOSE_MATCHUP: 0.1,          // Bonus when teams are evenly matched (more drama)

  // Special segment modifiers
  SENIOR_COUNT_THRESHOLD: 3,   // Min seniors to strongly suggest senior segment
  ALL_AMERICAN_BOOST: 0.15,    // Bonus when All-Americans are competing
  MILESTONE_BOOST: 0.1,        // Bonus when athletes have upcoming milestones
};

// ============================================================================
// Confidence Scoring Helpers
// ============================================================================

/**
 * Calculate a confidence level string from a numeric score
 * @param {number} score - Numeric confidence score (0-1)
 * @returns {string} Confidence level (high, medium, low)
 */
function getConfidenceLevel(score) {
  if (score >= 0.8) return CONFIDENCE.HIGH;
  if (score >= 0.5) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

/**
 * Calculate dynamic confidence based on context signals
 *
 * @param {number} baseConfidence - Base confidence score (0-1)
 * @param {Object} context - Competition context with metadata
 * @param {Object} factors - Specific factors to apply for this segment type
 * @returns {Object} { confidence: number, confidenceLevel: string, reasons: string[] }
 */
function calculateDynamicConfidence(baseConfidence, context, factors = {}) {
  let confidence = baseConfidence;
  const reasons = [];

  // Data availability bonuses
  if (factors.requiresRoster && context.teams?.some(t => t.roster?.length > 0)) {
    confidence += CONFIDENCE_FACTORS.HAS_ROSTER_DATA;
    reasons.push('Roster data available');
  }

  if (factors.requiresStats && context.statsAnalysis?.teamStats?.some(t => t.hasStats)) {
    confidence += CONFIDENCE_FACTORS.HAS_TEAM_STATS;
    reasons.push('Team statistics available');
  }

  if (context.dateInfo) {
    confidence += CONFIDENCE_FACTORS.HAS_DATE_INFO;

    // Season phase adjustments
    if (context.dateInfo.seasonPhase === 'championship') {
      confidence += CONFIDENCE_FACTORS.CHAMPIONSHIP_MEET;
      reasons.push('Championship meet - high stakes');
    } else if (context.dateInfo.seasonPhase === 'late') {
      confidence += CONFIDENCE_FACTORS.LATE_SEASON;
      reasons.push('Late season - playoff implications');
    }
  }

  // Matchup analysis adjustments
  if (context.statsAnalysis?.matchupNotes?.length > 0) {
    const isCloseMatchup = context.statsAnalysis.matchupNotes.some(
      n => n.includes('Close matchup') || n.includes('Very close')
    );
    if (isCloseMatchup) {
      confidence += CONFIDENCE_FACTORS.CLOSE_MATCHUP;
      reasons.push('Close matchup expected');
    }
  }

  // Special segment boosts
  if (factors.athleteFeature) {
    if (context.allAmericans?.length > 0) {
      confidence += CONFIDENCE_FACTORS.ALL_AMERICAN_BOOST;
      reasons.push(`${context.allAmericans.length} All-American(s) competing`);
    }
    if (context.milestones?.upcoming?.length > 0) {
      confidence += CONFIDENCE_FACTORS.MILESTONE_BOOST;
      reasons.push('Athletes approaching milestones');
    }
  }

  // Senior-specific boosts
  if (factors.seniorFeature && context.seniors?.length >= CONFIDENCE_FACTORS.SENIOR_COUNT_THRESHOLD) {
    const seniorsWithStorylines = context.seniors.filter(s => s.hasStorylines).length;
    if (seniorsWithStorylines > 0) {
      confidence += 0.1;
      reasons.push(`${seniorsWithStorylines} senior(s) with notable storylines`);
    }
  }

  // Cap at 1.0
  confidence = Math.min(1.0, confidence);

  return {
    confidence: Math.round(confidence * 100) / 100,
    confidenceLevel: getConfidenceLevel(confidence),
    reasons,
  };
}

/**
 * Build a detailed reason string for a segment suggestion
 *
 * @param {string} baseReason - Base reason for the segment
 * @param {Array} additionalReasons - Additional context-based reasons
 * @returns {string} Combined reason string
 */
function buildReasonString(baseReason, additionalReasons = []) {
  if (additionalReasons.length === 0) return baseReason;
  return `${baseReason}. Context: ${additionalReasons.join('; ')}`;
}

// ============================================================================
// Segment Templates
// ============================================================================

/**
 * Pre-show segment templates (common to all meets)
 */
function getPreShowSegments(context) {
  const { team1Name, team2Name, dateInfo, statsAnalysis, eventName } = context;

  const segments = [];

  // Starting Soon - always high confidence
  const startingSoon = calculateDynamicConfidence(0.9, context, {});
  segments.push({
    id: 'template-pre-1',
    name: 'Starting Soon',
    type: SEGMENT_TYPES.STATIC,
    duration: 300,
    scene: 'Starting Soon',
    graphic: null,
    timingMode: 'fixed',
    notes: 'Display starting soon slate while audience enters',
    confidence: startingSoon.confidence,
    confidenceLevel: startingSoon.confidenceLevel,
    category: 'pre-show',
    reason: buildReasonString('Standard pre-show slate for all broadcasts', startingSoon.reasons),
  });

  // Show Open - always high confidence
  const showOpen = calculateDynamicConfidence(0.85, context, {});
  segments.push({
    id: 'template-pre-2',
    name: 'Show Open',
    type: SEGMENT_TYPES.VIDEO,
    duration: 45,
    scene: 'Graphics Fullscreen',
    graphic: null,
    timingMode: 'fixed',
    notes: 'Intro video package',
    confidence: showOpen.confidence,
    confidenceLevel: showOpen.confidenceLevel,
    category: 'pre-show',
    reason: buildReasonString('Standard broadcast intro', showOpen.reasons),
  });

  // Team Logos - high confidence, gets boost when we have team data
  const teamLogos = calculateDynamicConfidence(0.9, context, { requiresRoster: true });
  segments.push({
    id: 'template-pre-3',
    name: 'Team Logos',
    type: SEGMENT_TYPES.STATIC,
    duration: 10,
    scene: 'Graphics Fullscreen',
    graphic: { graphicId: 'logos', params: {} },
    timingMode: 'fixed',
    notes: `Display ${team1Name} vs ${team2Name} logos`,
    confidence: teamLogos.confidence,
    confidenceLevel: teamLogos.confidenceLevel,
    category: 'pre-show',
    reason: buildReasonString('Team introduction graphic', teamLogos.reasons),
  });

  // Welcome & Introductions - higher confidence for big meets
  const welcome = calculateDynamicConfidence(0.85, context, {});
  let welcomeNotes = 'Talent welcomes viewers and introduces the meet';
  if (statsAnalysis?.matchupNotes?.length > 0) {
    welcomeNotes += `. Talking points: ${statsAnalysis.matchupNotes[0]}`;
  }
  segments.push({
    id: 'template-pre-4',
    name: 'Welcome & Introductions',
    type: SEGMENT_TYPES.LIVE,
    duration: 60,
    scene: 'Talent Camera',
    graphic: null,
    timingMode: 'fixed',
    notes: welcomeNotes,
    confidence: welcome.confidence,
    confidenceLevel: welcome.confidenceLevel,
    category: 'pre-show',
    reason: buildReasonString('Standard talent intro segment', welcome.reasons),
  });

  // Season/Meet Context segment - only for championship or late season
  if (dateInfo?.seasonPhase === 'championship' || dateInfo?.seasonPhase === 'late') {
    const meetContext = calculateDynamicConfidence(0.6, context, { requiresStats: true });
    const contextNotes = dateInfo.seasonPhase === 'championship'
      ? 'Discuss championship implications and what each team needs'
      : 'Discuss playoff implications, remaining schedule';

    segments.push({
      id: 'template-pre-5',
      name: 'Season Context',
      type: SEGMENT_TYPES.LIVE,
      duration: 45,
      scene: 'Talent Camera',
      graphic: { graphicId: 'scoreboard', params: {} },
      timingMode: 'fixed',
      notes: contextNotes,
      confidence: meetContext.confidence,
      confidenceLevel: meetContext.confidenceLevel,
      category: 'pre-show',
      reason: buildReasonString(
        `${dateInfo.seasonPhase === 'championship' ? 'Championship' : 'Late season'} meet context`,
        meetContext.reasons
      ),
    });
  }

  return segments;
}

/**
 * Team introduction segment templates
 */
function getTeamIntroSegments(context) {
  const { teams, gender, seniors, statsAnalysis } = context;
  const segments = [];

  teams.forEach((team, index) => {
    if (!team.name) return;

    const teamSlot = team.slot || (index + 1);
    const hasRoster = team.roster && team.roster.length > 0;
    const teamStats = statsAnalysis?.teamStats?.find(t => t.name === team.name);

    // Team coaches - higher confidence when we have roster data
    const coachConfidence = calculateDynamicConfidence(0.75, context, { requiresRoster: hasRoster });
    segments.push({
      id: `template-team-${teamSlot}-coaches`,
      name: `${team.name} Coaches`,
      type: SEGMENT_TYPES.LIVE,
      duration: 30,
      scene: 'Talent Camera',
      graphic: { graphicId: 'team-coaches', params: { teamSlot } },
      timingMode: 'fixed',
      notes: `Introduce ${team.name} coaching staff`,
      confidence: coachConfidence.confidence,
      confidenceLevel: coachConfidence.confidenceLevel,
      category: 'team-intro',
      reason: buildReasonString('Standard team introduction', coachConfidence.reasons),
      teamContext: team.name,
    });

    // Team roster (if roster exists) - higher confidence with more roster data
    if (hasRoster) {
      const rosterSize = team.roster.length;
      const rosterConfidence = calculateDynamicConfidence(
        0.7 + Math.min(0.15, rosterSize * 0.01), // Base + bonus for larger rosters
        context,
        { requiresRoster: true }
      );

      segments.push({
        id: `template-team-${teamSlot}-roster`,
        name: `${team.name} Lineup`,
        type: SEGMENT_TYPES.STATIC,
        duration: 20,
        scene: 'Graphics Fullscreen',
        graphic: { graphicId: 'team-lineup', params: { teamSlot } },
        timingMode: 'fixed',
        notes: `Display ${team.name} starting lineup (${rosterSize} athletes)`,
        confidence: rosterConfidence.confidence,
        confidenceLevel: rosterConfidence.confidenceLevel,
        category: 'team-intro',
        reason: buildReasonString(
          `Roster available with ${rosterSize} athletes`,
          rosterConfidence.reasons
        ),
        teamContext: team.name,
      });
    }

    // Team stats preview - if stats are available
    if (teamStats?.hasStats) {
      const statsConfidence = calculateDynamicConfidence(0.6, context, { requiresStats: true });
      const statsNotes = teamStats.seasonHigh
        ? `${team.name} season avg: ${teamStats.seasonAverage.toFixed(3)}, high: ${teamStats.seasonHigh.toFixed(3)}`
        : `${team.name} season avg: ${teamStats.seasonAverage.toFixed(3)}`;

      segments.push({
        id: `template-team-${teamSlot}-stats`,
        name: `${team.name} Season Stats`,
        type: SEGMENT_TYPES.STATIC,
        duration: 15,
        scene: 'Graphics Fullscreen',
        graphic: { graphicId: 'team-stats', params: { teamSlot } },
        timingMode: 'fixed',
        notes: statsNotes,
        confidence: statsConfidence.confidence,
        confidenceLevel: statsConfidence.confidenceLevel,
        category: 'team-intro',
        reason: buildReasonString('Season statistics available', statsConfidence.reasons),
        teamContext: team.name,
      });
    }

    // Team seniors feature - if team has seniors
    const teamSeniors = seniors?.filter(s => s.team === team.name) || [];
    if (teamSeniors.length > 0) {
      const seniorConfidence = calculateDynamicConfidence(0.55, context, { seniorFeature: true });
      const seniorNames = teamSeniors.slice(0, 3).map(s => s.name).join(', ');
      const hasStorylines = teamSeniors.some(s => s.hasStorylines);

      segments.push({
        id: `template-team-${teamSlot}-seniors`,
        name: `${team.name} Seniors`,
        type: SEGMENT_TYPES.LIVE,
        duration: 30,
        scene: 'Talent Camera',
        graphic: { graphicId: 'athlete-feature', params: { teamSlot } },
        timingMode: 'fixed',
        notes: `Feature seniors: ${seniorNames}${teamSeniors.length > 3 ? ` and ${teamSeniors.length - 3} more` : ''}`,
        confidence: seniorConfidence.confidence,
        confidenceLevel: seniorConfidence.confidenceLevel,
        category: 'team-intro',
        reason: buildReasonString(
          `${teamSeniors.length} senior(s) on ${team.name}${hasStorylines ? ' with notable storylines' : ''}`,
          seniorConfidence.reasons
        ),
        teamContext: team.name,
        athleteContext: teamSeniors,
      });
    }
  });

  return segments;
}

/**
 * Get rotation segments based on competition type
 */
function getRotationSegments(context) {
  const { gender, teamCount, teams, statsAnalysis, dateInfo } = context;
  const events = gender === 'mens' ? MENS_EVENTS : WOMENS_EVENTS;
  const eventCodes = gender === 'mens' ? MENS_EVENT_CODES : WOMENS_EVENT_CODES;
  const rotationCount = events.length;

  const segments = [];

  // Determine if this is a close matchup (affects segment confidence)
  const isCloseMatchup = statsAnalysis?.matchupNotes?.some(
    n => n.includes('Close matchup') || n.includes('Very close')
  );

  for (let rotation = 1; rotation <= rotationCount; rotation++) {
    // Rotation summary graphic - higher confidence for later rotations in close meets
    const summaryBaseConf = rotation === 1 ? 0.85 : (isCloseMatchup ? 0.9 : 0.8);
    const summaryConf = calculateDynamicConfidence(summaryBaseConf, context, { requiresStats: true });

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
      confidence: summaryConf.confidence,
      confidenceLevel: summaryConf.confidenceLevel,
      category: 'rotation',
      reason: buildReasonString('Standard rotation intro', summaryConf.reasons),
    });

    // Competition action for this rotation
    // For dual meets, teams alternate apparatus
    const actionConf = calculateDynamicConfidence(0.95, context, {});
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
        confidence: actionConf.confidence,
        confidenceLevel: actionConf.confidenceLevel,
        category: 'rotation',
        reason: buildReasonString('Main competition segment', actionConf.reasons),
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
        confidence: actionConf.confidence,
        confidenceLevel: actionConf.confidenceLevel,
        category: 'rotation',
        reason: buildReasonString('Main competition segment', actionConf.reasons),
      });
    }

    // Rotation scores - higher confidence for close matchups (more drama)
    const scoresBaseConf = isCloseMatchup ? 0.9 : 0.8;
    const scoresConf = calculateDynamicConfidence(scoresBaseConf, context, { requiresStats: true });

    segments.push({
      id: `template-rotation-${rotation}-scores`,
      name: `Rotation ${rotation} Scores`,
      type: SEGMENT_TYPES.STATIC,
      duration: 20,
      scene: 'Graphics Fullscreen',
      graphic: { graphicId: 'scoreboard', params: {} },
      timingMode: 'fixed',
      notes: `Display scores after Rotation ${rotation}${isCloseMatchup ? ' - watch the margin' : ''}`,
      confidence: scoresConf.confidence,
      confidenceLevel: scoresConf.confidenceLevel,
      category: 'rotation',
      reason: buildReasonString('Score update after rotation', scoresConf.reasons),
    });

    // Commercial break between rotations (except last)
    // Lower confidence for championship meets (often no commercial breaks)
    if (rotation < rotationCount) {
      const breakBaseConf = dateInfo?.seasonPhase === 'championship' ? 0.5 : 0.65;
      const breakConf = calculateDynamicConfidence(breakBaseConf, context, {});

      segments.push({
        id: `template-rotation-${rotation}-break`,
        name: 'Commercial Break',
        type: SEGMENT_TYPES.BREAK,
        duration: 120,
        scene: 'Starting Soon',
        graphic: null,
        timingMode: 'fixed',
        notes: 'Commercial break between rotations',
        confidence: breakConf.confidence,
        confidenceLevel: breakConf.confidenceLevel,
        category: 'break',
        reason: buildReasonString('Optional break between rotations', breakConf.reasons),
      });
    }

    // Mid-meet analysis - after rotation 3 in 6-rotation meets or rotation 2 in 4-rotation meets
    const midPoint = rotationCount === 6 ? 3 : 2;
    if (rotation === midPoint && isCloseMatchup) {
      const analysisConf = calculateDynamicConfidence(0.55, context, { requiresStats: true });

      segments.push({
        id: `template-rotation-${rotation}-analysis`,
        name: 'Mid-Meet Analysis',
        type: SEGMENT_TYPES.LIVE,
        duration: 45,
        scene: 'Talent Camera',
        graphic: { graphicId: 'scoreboard', params: {} },
        timingMode: 'fixed',
        notes: 'Talent discusses the meet so far and what to watch in second half',
        confidence: analysisConf.confidence,
        confidenceLevel: analysisConf.confidenceLevel,
        category: 'rotation',
        reason: buildReasonString('Close matchup - mid-meet analysis adds value', analysisConf.reasons),
      });
    }
  }

  return segments;
}

/**
 * Post-show segment templates
 */
function getPostShowSegments(context) {
  const { team1Name, team2Name, teamCount, statsAnalysis, dateInfo, allAmericans, milestones } = context;

  const segments = [];

  // Final Scores - always high confidence
  const scoresConf = calculateDynamicConfidence(0.9, context, { requiresStats: true });
  segments.push({
    id: 'template-post-1',
    name: 'Final Scores',
    type: SEGMENT_TYPES.STATIC,
    duration: 30,
    scene: 'Graphics Fullscreen',
    graphic: { graphicId: 'scoreboard', params: {} },
    timingMode: 'fixed',
    notes: 'Display final meet scores',
    confidence: scoresConf.confidence,
    confidenceLevel: scoresConf.confidenceLevel,
    category: 'post-show',
    reason: buildReasonString('Standard final score display', scoresConf.reasons),
  });

  // Event-by-event results - higher confidence for close matches or championship meets
  const isHighStakes = dateInfo?.seasonPhase === 'championship' || dateInfo?.seasonPhase === 'late';
  if (isHighStakes || statsAnalysis?.matchupNotes?.some(n => n.includes('Close'))) {
    const eventResultsConf = calculateDynamicConfidence(0.6, context, { requiresStats: true });

    segments.push({
      id: 'template-post-1b',
      name: 'Event-by-Event Results',
      type: SEGMENT_TYPES.STATIC,
      duration: 45,
      scene: 'Graphics Fullscreen',
      graphic: { graphicId: 'event-summary', params: { summaryMode: 'all' } },
      timingMode: 'fixed',
      notes: 'Display detailed breakdown by apparatus',
      confidence: eventResultsConf.confidence,
      confidenceLevel: eventResultsConf.confidenceLevel,
      category: 'post-show',
      reason: buildReasonString(
        isHighStakes ? 'High-stakes meet - detailed results add value' : 'Close match - show where it was won',
        eventResultsConf.reasons
      ),
    });
  }

  // Post-Meet Analysis - standard for all meets
  const analysisConf = calculateDynamicConfidence(0.8, context, {});
  let analysisNotes = 'Talent discusses meet highlights and results';
  if (statsAnalysis?.matchupNotes?.length > 0) {
    analysisNotes += `. Key storyline: ${statsAnalysis.matchupNotes[0]}`;
  }
  segments.push({
    id: 'template-post-2',
    name: 'Post-Meet Analysis',
    type: SEGMENT_TYPES.LIVE,
    duration: 120,
    scene: 'Talent Camera',
    graphic: null,
    timingMode: 'fixed',
    notes: analysisNotes,
    confidence: analysisConf.confidence,
    confidenceLevel: analysisConf.confidenceLevel,
    category: 'post-show',
    reason: buildReasonString('Standard post-meet wrap-up', analysisConf.reasons),
  });

  // Standout performers - if we have All-Americans or record holders
  if ((allAmericans?.length > 0 || milestones?.records?.length > 0) && isHighStakes) {
    const standoutConf = calculateDynamicConfidence(0.5, context, { athleteFeature: true });
    const performers = [
      ...(allAmericans?.slice(0, 2).map(a => a.name) || []),
      ...(milestones?.records?.slice(0, 1).map(r => r.name) || []),
    ].slice(0, 3);

    segments.push({
      id: 'template-post-2b',
      name: 'Standout Performers',
      type: SEGMENT_TYPES.LIVE,
      duration: 45,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'fixed',
      notes: `Highlight standout performances: ${performers.join(', ')}`,
      confidence: standoutConf.confidence,
      confidenceLevel: standoutConf.confidenceLevel,
      category: 'post-show',
      reason: buildReasonString('Notable athletes worth highlighting', standoutConf.reasons),
    });
  }

  // Credits & Sign-Off - always include
  const creditsConf = calculateDynamicConfidence(0.85, context, {});
  segments.push({
    id: 'template-post-3',
    name: 'Credits & Sign-Off',
    type: SEGMENT_TYPES.VIDEO,
    duration: 30,
    scene: 'Graphics Fullscreen',
    graphic: null,
    timingMode: 'fixed',
    notes: 'Production credits and sign-off',
    confidence: creditsConf.confidence,
    confidenceLevel: creditsConf.confidenceLevel,
    category: 'post-show',
    reason: buildReasonString('Standard broadcast close', creditsConf.reasons),
  });

  return segments;
}

/**
 * Special segment suggestions based on roster analysis
 */
function getSpecialSegments(context) {
  const { teams, seniors, allAmericans, milestones, dateInfo, eventName, statsAnalysis } = context;
  const segments = [];

  // Senior recognition segments - enhanced with storylines and dynamic confidence
  if (seniors && seniors.length > 0) {
    // Check if any seniors have storylines (championship, final home meet, etc.)
    const seniorsWithStorylines = seniors.filter(s => s.hasStorylines);

    let notes = `Recognize seniors: ${seniors.slice(0, 3).map(s => s.name).join(', ')}`;
    if (seniors.length > 3) {
      notes += ` and ${seniors.length - 3} more`;
    }

    // Add storyline context if available
    if (seniorsWithStorylines.length > 0) {
      const topStoryline = seniorsWithStorylines[0].storylines[0];
      notes += `. ${topStoryline.description}`;
    }

    // Dynamic confidence based on senior count and storylines
    const seniorBaseConf = Math.min(0.65 + (seniors.length * 0.03), 0.85);
    const seniorConf = calculateDynamicConfidence(
      seniorsWithStorylines.length > 0 ? seniorBaseConf + 0.1 : seniorBaseConf,
      context,
      { seniorFeature: true }
    );

    segments.push({
      id: 'template-special-seniors',
      name: 'Senior Recognition',
      type: SEGMENT_TYPES.LIVE,
      duration: 60,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'manual',
      notes,
      confidence: seniorConf.confidence,
      confidenceLevel: seniorConf.confidenceLevel,
      category: 'special',
      reason: buildReasonString(
        `${seniors.length} senior(s) competing${seniorsWithStorylines.length > 0 ? ' with notable storylines' : ''}`,
        seniorConf.reasons
      ),
      athleteContext: seniors,
    });
  }

  // All-American feature - enhanced with honor details and dynamic confidence
  if (allAmericans && allAmericans.length > 0) {
    const topAllAmericans = allAmericans.slice(0, 3);
    const honorSummary = topAllAmericans.map(a => {
      const recentHonor = a.mostRecent;
      return recentHonor
        ? `${a.name} (${recentHonor.year} ${recentHonor.event || 'All-American'})`
        : a.name;
    }).join(', ');

    // Dynamic confidence: more All-Americans = higher confidence
    const aaBaseConf = Math.min(0.55 + (allAmericans.length * 0.05), 0.85);
    const aaConf = calculateDynamicConfidence(aaBaseConf, context, { athleteFeature: true });

    segments.push({
      id: 'template-special-all-americans',
      name: 'All-American Spotlight',
      type: SEGMENT_TYPES.LIVE,
      duration: 45,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'fixed',
      notes: `Feature All-Americans: ${honorSummary}`,
      confidence: aaConf.confidence,
      confidenceLevel: aaConf.confidenceLevel,
      category: 'special',
      reason: buildReasonString(`${allAmericans.length} All-American(s) competing`, aaConf.reasons),
      athleteContext: allAmericans,
    });
  }

  // Record holders feature - with context-aware confidence
  if (milestones?.records && milestones.records.length > 0) {
    const recordHolders = milestones.records.slice(0, 2);
    const recordSummary = recordHolders.map(r => {
      const topRecord = r.recordMilestones[0];
      return `${r.name} (${topRecord.description || topRecord.type})`;
    }).join(', ');

    // Higher confidence for championship meets where records matter more
    const recordBaseConf = dateInfo?.seasonPhase === 'championship' ? 0.7 : 0.55;
    const recordConf = calculateDynamicConfidence(recordBaseConf, context, { athleteFeature: true });

    segments.push({
      id: 'template-special-records',
      name: 'Record Holder Feature',
      type: SEGMENT_TYPES.LIVE,
      duration: 30,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'fixed',
      notes: `Record holders competing: ${recordSummary}`,
      confidence: recordConf.confidence,
      confidenceLevel: recordConf.confidenceLevel,
      category: 'special',
      reason: buildReasonString(`${milestones.records.length} record holder(s) in the meet`, recordConf.reasons),
      athleteContext: recordHolders,
    });
  }

  // Milestone watch segment (athletes approaching milestones)
  if (milestones?.upcoming && milestones.upcoming.length > 0) {
    const approachingMilestones = milestones.upcoming.slice(0, 2);
    const milestoneSummary = approachingMilestones.map(a => {
      const topMilestone = a.upcomingMilestones[0];
      return `${a.name}: ${topMilestone.description || topMilestone.type}`;
    }).join('; ');

    // Dynamic confidence based on milestone significance
    const milestoneBaseConf = 0.5 + (approachingMilestones.length * 0.05);
    const milestoneConf = calculateDynamicConfidence(milestoneBaseConf, context, { athleteFeature: true });

    segments.push({
      id: 'template-special-milestones',
      name: 'Milestone Watch',
      type: SEGMENT_TYPES.LIVE,
      duration: 30,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'fixed',
      notes: `Athletes approaching milestones: ${milestoneSummary}`,
      confidence: milestoneConf.confidence,
      confidenceLevel: milestoneConf.confidenceLevel,
      category: 'special',
      reason: buildReasonString(
        `${milestones.upcoming.length} athlete(s) approaching career milestones`,
        milestoneConf.reasons
      ),
      athleteContext: approachingMilestones,
    });
  }

  // Rivalry/matchup history segment - for known rivalries or close teams
  if (statsAnalysis?.matchupNotes?.length > 0 && teams?.length >= 2) {
    const isCloseMatchup = statsAnalysis.matchupNotes.some(
      n => n.includes('Close matchup') || n.includes('Very close')
    );

    if (isCloseMatchup || dateInfo?.seasonPhase === 'championship') {
      const matchupConf = calculateDynamicConfidence(0.5, context, { requiresStats: true });

      segments.push({
        id: 'template-special-matchup',
        name: 'Rivalry & History',
        type: SEGMENT_TYPES.LIVE,
        duration: 45,
        scene: 'Talent Camera',
        graphic: { graphicId: 'scoreboard', params: {} },
        timingMode: 'fixed',
        notes: `Discuss ${teams[0]?.name} vs ${teams[1]?.name} history and rivalry. ${statsAnalysis.matchupNotes[0]}`,
        confidence: matchupConf.confidence,
        confidenceLevel: matchupConf.confidenceLevel,
        category: 'special',
        reason: buildReasonString('Close matchup - rivalry context adds value', matchupConf.reasons),
      });
    }
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
 * Parse meet date string into structured date info
 * Handles formats like "January 17, 2026" or "Jan 17, 2026"
 */
function parseMeetDate(meetDateStr) {
  if (!meetDateStr) return null;

  try {
    const date = new Date(meetDateStr);
    if (isNaN(date.getTime())) return null;

    const month = date.getMonth(); // 0-11
    const dayOfWeek = date.getDay(); // 0=Sunday
    const dayOfMonth = date.getDate();

    // Determine season context (NCAA gymnastics season is typically Jan-April)
    let seasonPhase = 'regular';
    if (month === 0 && dayOfMonth <= 15) {
      seasonPhase = 'early'; // Early January - season opener territory
    } else if (month === 2 && dayOfMonth >= 15) {
      seasonPhase = 'late'; // Late March - conference/NCAA championship territory
    } else if (month >= 3) {
      seasonPhase = 'championship'; // April - NCAA championships
    }

    return {
      date,
      month,
      dayOfWeek,
      dayOfMonth,
      year: date.getFullYear(),
      seasonPhase,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6, // Fri, Sat, Sun
      formatted: meetDateStr,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Extract seniors (year 4) from team roster data
 */
function extractSeniors(teamDataMap, teams) {
  const seniors = [];

  teams.forEach(team => {
    const teamData = teamDataMap?.[`team${team.slot}`];
    const roster = teamData?.roster || [];

    roster.forEach(athlete => {
      if (athlete.year === 4) {
        seniors.push({
          name: athlete.fullName || `${athlete.firstName} ${athlete.lastName}`,
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          team: team.name,
          teamSlot: team.slot,
          hometown: athlete.hometown,
          headshotUrl: athlete.headshotUrl,
        });
      }
    });
  });

  return seniors;
}

/**
 * Analyze team statistics for matchup context
 */
function analyzeTeamStats(competitionConfig, teams) {
  const analysis = {
    teamStats: [],
    matchupNotes: [],
    favorite: null,
    margin: null,
  };

  teams.forEach((team, index) => {
    const slot = team.slot;
    const avg = parseFloat(competitionConfig?.[`team${slot}Ave`]) || 0;
    const high = parseFloat(competitionConfig?.[`team${slot}High`]) || 0;
    const tricode = competitionConfig?.[`team${slot}Tricode`] || '';

    analysis.teamStats.push({
      name: team.name,
      slot,
      tricode,
      seasonAverage: avg,
      seasonHigh: high,
      hasStats: avg > 0,
    });
  });

  // Determine favorite if stats available for both teams in a dual meet
  if (analysis.teamStats.length === 2) {
    const [team1, team2] = analysis.teamStats;
    if (team1.hasStats && team2.hasStats) {
      const diff = team1.seasonAverage - team2.seasonAverage;
      if (Math.abs(diff) >= 1.0) {
        analysis.favorite = diff > 0 ? team1.name : team2.name;
        analysis.margin = Math.abs(diff).toFixed(3);
        analysis.matchupNotes.push(
          `${analysis.favorite} favored by ~${analysis.margin} points based on season averages`
        );
      } else if (Math.abs(diff) >= 0.5) {
        analysis.matchupNotes.push('Close matchup expected - teams within 1 point average');
      } else {
        analysis.matchupNotes.push('Very close matchup - teams nearly even on paper');
      }
    }
  }

  return analysis;
}

/**
 * Count athletes by class year
 */
function countByClassYear(teamDataMap, teams) {
  const counts = {
    freshmen: 0,  // year 1
    sophomores: 0, // year 2
    juniors: 0,   // year 3
    seniors: 0,   // year 4
    byTeam: {},
  };

  teams.forEach(team => {
    const teamData = teamDataMap?.[`team${team.slot}`];
    const roster = teamData?.roster || [];
    const teamCounts = { freshmen: 0, sophomores: 0, juniors: 0, seniors: 0 };

    roster.forEach(athlete => {
      switch (athlete.year) {
        case 1: counts.freshmen++; teamCounts.freshmen++; break;
        case 2: counts.sophomores++; teamCounts.sophomores++; break;
        case 3: counts.juniors++; teamCounts.juniors++; break;
        case 4: counts.seniors++; teamCounts.seniors++; break;
      }
    });

    counts.byTeam[team.name] = teamCounts;
  });

  return counts;
}

/**
 * Query All-Americans from athlete honors data
 *
 * All-American status is stored in teamsDatabase/honors/{athlete-name-lowercase}
 * Structure: { name, team, honors: [{ year, type, event }] }
 *
 * Example honors types:
 * - "First Team All-American"
 * - "Second Team All-American"
 * - "All-American"
 * - "All-Conference"
 *
 * @param {Object} db - Firebase database reference
 * @param {Array} teams - Teams in the competition
 * @returns {Promise<Array>} All-Americans competing in this meet
 */
async function queryAllAmericans(db, teams) {
  const allAmericans = [];

  if (!db) return allAmericans;

  try {
    // Check if honors database exists
    const honorsSnapshot = await db.ref('teamsDatabase/honors').once('value');
    const honorsData = honorsSnapshot.val();

    if (!honorsData) {
      // Honors database not yet populated - this is expected for now
      // Future: integrate with Virtius API or manual data entry
      return allAmericans;
    }

    // Build a set of athlete names from competing teams for quick lookup
    const competingAthletes = new Map();
    teams.forEach(team => {
      const roster = team.roster || [];
      roster.forEach(athlete => {
        const key = athlete.fullName?.toLowerCase() ||
          `${athlete.firstName} ${athlete.lastName}`.toLowerCase();
        competingAthletes.set(key, { ...athlete, team: team.name, teamSlot: team.slot });
      });
    });

    // Find All-Americans among competing athletes
    Object.entries(honorsData).forEach(([key, honorData]) => {
      if (competingAthletes.has(key)) {
        const athlete = competingAthletes.get(key);
        const allAmericanHonors = (honorData.honors || []).filter(h =>
          h.type?.toLowerCase().includes('all-american')
        );

        if (allAmericanHonors.length > 0) {
          allAmericans.push({
            name: athlete.fullName || `${athlete.firstName} ${athlete.lastName}`,
            firstName: athlete.firstName,
            lastName: athlete.lastName,
            team: athlete.team,
            teamSlot: athlete.teamSlot,
            honors: allAmericanHonors,
            honorCount: allAmericanHonors.length,
            // Most recent All-American honor
            mostRecent: allAmericanHonors.sort((a, b) =>
              (b.year || 0) - (a.year || 0)
            )[0],
          });
        }
      }
    });

    // Sort by honor count (most decorated first)
    return allAmericans.sort((a, b) => b.honorCount - a.honorCount);
  } catch (error) {
    console.warn('[AISuggestionService] Error querying All-Americans:', error.message);
    return allAmericans;
  }
}

/**
 * Query athlete milestones based on career statistics
 *
 * Milestones are stored in teamsDatabase/milestones/{athlete-name-lowercase}
 * Structure: { name, team, milestones: [{ type, value, date, description }] }
 *
 * Example milestone types:
 * - "career_routines" - Total career routines competed
 * - "career_10s" - Number of perfect 10.0 scores
 * - "career_high_aa" - Career high all-around score
 * - "event_record" - School/conference/NCAA record on an event
 * - "100_club" - Scored 100+ career routines
 *
 * @param {Object} db - Firebase database reference
 * @param {Array} teams - Teams in the competition
 * @returns {Promise<Object>} Milestone data for competing athletes
 */
async function queryMilestones(db, teams) {
  const milestones = {
    athletes: [],       // Athletes with notable milestones
    upcoming: [],       // Athletes approaching milestones (e.g., 99 career routines)
    records: [],        // Record holders competing
  };

  if (!db) return milestones;

  try {
    // Check if milestones database exists
    const milestonesSnapshot = await db.ref('teamsDatabase/milestones').once('value');
    const milestonesData = milestonesSnapshot.val();

    if (!milestonesData) {
      // Milestones database not yet populated - this is expected for now
      // Future: compute from historical meet data or integrate with external API
      return milestones;
    }

    // Build a set of athlete names from competing teams
    const competingAthletes = new Map();
    teams.forEach(team => {
      const roster = team.roster || [];
      roster.forEach(athlete => {
        const key = athlete.fullName?.toLowerCase() ||
          `${athlete.firstName} ${athlete.lastName}`.toLowerCase();
        competingAthletes.set(key, { ...athlete, team: team.name, teamSlot: team.slot });
      });
    });

    // Find milestones for competing athletes
    Object.entries(milestonesData).forEach(([key, milestoneData]) => {
      if (competingAthletes.has(key)) {
        const athlete = competingAthletes.get(key);
        const athleteMilestones = milestoneData.milestones || [];

        if (athleteMilestones.length > 0) {
          const athleteEntry = {
            name: athlete.fullName || `${athlete.firstName} ${athlete.lastName}`,
            firstName: athlete.firstName,
            lastName: athlete.lastName,
            team: athlete.team,
            teamSlot: athlete.teamSlot,
            milestones: athleteMilestones,
          };

          // Categorize milestones
          const recordMilestones = athleteMilestones.filter(m =>
            m.type === 'event_record' || m.type === 'school_record' || m.type === 'conference_record'
          );

          const upcomingMilestones = athleteMilestones.filter(m =>
            m.type === 'approaching' || m.approaching === true
          );

          if (recordMilestones.length > 0) {
            milestones.records.push({
              ...athleteEntry,
              recordMilestones,
            });
          }

          if (upcomingMilestones.length > 0) {
            milestones.upcoming.push({
              ...athleteEntry,
              upcomingMilestones,
            });
          }

          milestones.athletes.push(athleteEntry);
        }
      }
    });

    return milestones;
  } catch (error) {
    console.warn('[AISuggestionService] Error querying milestones:', error.message);
    return milestones;
  }
}

/**
 * Compute potential milestones for seniors
 *
 * For seniors in their final season, compute potential story angles:
 * - Final home meet (if at home venue)
 * - Final conference championship
 * - Final NCAA championship appearance
 *
 * @param {Array} seniors - List of seniors from extractSeniors()
 * @param {Object} context - Competition context
 * @returns {Array} Enhanced senior data with potential storylines
 */
function computeSeniorMilestones(seniors, context) {
  const { dateInfo, venue, location, eventName } = context;
  const enhancedSeniors = [];

  seniors.forEach(senior => {
    const storylines = [];

    // Check if this is a championship meet
    const eventNameLower = eventName?.toLowerCase() || '';
    const isConferenceChamp = eventNameLower.includes('championship') &&
      (eventNameLower.includes('conference') || eventNameLower.includes('pac-12') ||
       eventNameLower.includes('big ten') || eventNameLower.includes('sec') ||
       eventNameLower.includes('big 12') || eventNameLower.includes('ncga'));
    const isNCAA = eventNameLower.includes('ncaa');
    const isNationals = eventNameLower.includes('national');

    if (isNCAA || isNationals) {
      storylines.push({
        type: 'final_nationals',
        description: `Final NCAA/National Championship appearance for ${senior.firstName}`,
        significance: 'high',
      });
    } else if (isConferenceChamp) {
      storylines.push({
        type: 'final_conference',
        description: `Final conference championship for ${senior.firstName}`,
        significance: 'high',
      });
    }

    // Check if late season (potential last regular season home meet)
    if (dateInfo?.seasonPhase === 'late' && dateInfo?.isWeekend) {
      storylines.push({
        type: 'potential_final_home',
        description: `Could be final home meet for ${senior.firstName}`,
        significance: 'medium',
      });
    }

    enhancedSeniors.push({
      ...senior,
      storylines,
      hasStorylines: storylines.length > 0,
    });
  });

  // Sort by those with storylines first, then alphabetically
  return enhancedSeniors.sort((a, b) => {
    if (a.hasStorylines !== b.hasStorylines) {
      return b.hasStorylines ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Build context object from competition config and team data
 *
 * @param {Object} competitionConfig - Competition configuration from Firebase
 * @param {Object} teamsData - Teams database data
 * @param {Object} teamDataFromComp - Competition-specific team data with rosters
 * @param {Object} db - Firebase database reference (optional, for async queries)
 * @returns {Promise<Object>|Object} Context object (async if db provided)
 */
async function buildContext(competitionConfig, teamsData, teamDataFromComp, db = null) {
  const { gender, teamCount } = parseCompetitionType(competitionConfig?.compType);

  // Extract team info from config
  const teams = [];
  for (let i = 1; i <= 6; i++) {
    const teamKey = competitionConfig?.[`team${i}Key`];
    const teamName = competitionConfig?.[`team${i}Name`];

    if (teamName) {
      // Use competition's teamData which has richer roster info
      const compTeamData = teamDataFromComp?.[`team${i}`] || {};
      const fallbackTeamData = teamsData?.[teamKey] || {};

      teams.push({
        slot: i,
        key: teamKey,
        name: teamName,
        logo: competitionConfig?.[`team${i}Logo`],
        // Prefer competition teamData roster, fallback to teamsDatabase
        roster: compTeamData.roster || fallbackTeamData.roster || [],
        coaches: competitionConfig?.[`team${i}Coaches`]?.split('\n').filter(Boolean) || [],
        rankings: compTeamData.rankings || {},
      });
    }
  }

  // Parse meet date for date-based suggestions
  const dateInfo = parseMeetDate(competitionConfig?.meetDate);

  // Extract seniors from team roster data (uses competition's teamData)
  const seniors = extractSeniors(teamDataFromComp, teams);

  // Analyze team statistics
  const statsAnalysis = analyzeTeamStats(competitionConfig, teams);

  // Count athletes by class year
  const classCounts = countByClassYear(teamDataFromComp, teams);

  // Build base context
  const baseContext = {
    compId: competitionConfig?.compId,
    eventName: competitionConfig?.eventName,
    meetDate: competitionConfig?.meetDate,
    dateInfo,
    venue: competitionConfig?.venue,
    location: competitionConfig?.location,
    gender,
    teamCount: teams.length || teamCount,
    teams,
    team1Name: teams[0]?.name || 'Team 1',
    team2Name: teams[1]?.name || 'Team 2',
    // Class year analysis
    classCounts,
    // Team statistics
    statsAnalysis,
  };

  // Query All-Americans and milestones if database available
  let allAmericans = [];
  let milestones = { athletes: [], upcoming: [], records: [] };

  if (db) {
    // Run queries in parallel
    const [allAmericansResult, milestonesResult] = await Promise.all([
      queryAllAmericans(db, teams),
      queryMilestones(db, teams),
    ]);
    allAmericans = allAmericansResult;
    milestones = milestonesResult;
  }

  // Compute senior storylines
  const seniorsWithStorylines = computeSeniorMilestones(seniors, baseContext);

  return {
    ...baseContext,
    // Roster analysis with enhanced data
    seniors: seniorsWithStorylines,
    allAmericans,
    milestones,
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

    // Fetch teams database for roster info (fallback)
    const teamsSnapshot = await db.ref('teamsDatabase/teams').once('value');
    const teamsData = teamsSnapshot.val() || {};

    // Fetch competition's teamData which has richer roster info (includes year, rankings, etc.)
    const teamDataSnapshot = await db.ref(`competitions/${compId}/teamData`).once('value');
    const teamDataFromComp = teamDataSnapshot.val() || {};

    // Build context with full metadata analysis (pass db for All-American/milestone queries)
    const context = await buildContext(competitionConfig, teamsData, teamDataFromComp, db);

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
        teams: context.teams.map(t => ({
          name: t.name,
          rosterSize: t.roster?.length || 0,
          rankings: t.rankings || {},
        })),
        // Enhanced metadata from Task 44
        dateInfo: context.dateInfo ? {
          formatted: context.dateInfo.formatted,
          seasonPhase: context.dateInfo.seasonPhase,
          isWeekend: context.dateInfo.isWeekend,
        } : null,
        venue: context.venue,
        location: context.location,
        statsAnalysis: {
          teamStats: context.statsAnalysis.teamStats,
          matchupNotes: context.statsAnalysis.matchupNotes,
          favorite: context.statsAnalysis.favorite,
        },
        // Roster analysis from Task 45
        seniors: context.seniors.map(s => ({
          name: s.name,
          team: s.team,
          hasStorylines: s.hasStorylines,
          storylines: s.storylines || [],
        })),
        allAmericans: context.allAmericans.map(a => ({
          name: a.name,
          team: a.team,
          honorCount: a.honorCount,
          mostRecent: a.mostRecent,
        })),
        milestones: {
          athleteCount: context.milestones?.athletes?.length || 0,
          upcomingCount: context.milestones?.upcoming?.length || 0,
          recordHolders: context.milestones?.records?.length || 0,
        },
        classCounts: context.classCounts,
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
  CONFIDENCE_FACTORS,
  MENS_EVENTS,
  WOMENS_EVENTS,
  // Expose helper functions for testing
  calculateDynamicConfidence,
  getConfidenceLevel,
  buildReasonString,
};

export default aiSuggestionService;

export {
  generateSuggestions,
  getSuggestionsByCategory,
  getSuggestionCount,
  SEGMENT_TYPES,
  CONFIDENCE,
  CONFIDENCE_FACTORS,
  MENS_EVENTS,
  WOMENS_EVENTS,
  calculateDynamicConfidence,
  getConfidenceLevel,
  buildReasonString,
};
