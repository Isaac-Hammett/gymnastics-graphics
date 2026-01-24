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
  const { teams, seniors, allAmericans, milestones, dateInfo, eventName } = context;
  const segments = [];

  // Senior recognition segments - enhanced with storylines
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

    segments.push({
      id: 'template-special-seniors',
      name: 'Senior Recognition',
      type: SEGMENT_TYPES.LIVE,
      duration: 60,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'manual',
      notes,
      confidence: seniorsWithStorylines.length > 0 ? 0.9 : 0.8,
      confidenceLevel: CONFIDENCE.HIGH,
      category: 'special',
      reason: `${seniors.length} senior(s) competing${seniorsWithStorylines.length > 0 ? ' with notable storylines' : ''}`,
      athleteContext: seniors,
    });
  }

  // All-American feature - enhanced with honor details
  if (allAmericans && allAmericans.length > 0) {
    const topAllAmericans = allAmericans.slice(0, 3);
    const honorSummary = topAllAmericans.map(a => {
      const recentHonor = a.mostRecent;
      return recentHonor
        ? `${a.name} (${recentHonor.year} ${recentHonor.event || 'All-American'})`
        : a.name;
    }).join(', ');

    segments.push({
      id: 'template-special-all-americans',
      name: 'All-American Spotlight',
      type: SEGMENT_TYPES.LIVE,
      duration: 45,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'fixed',
      notes: `Feature All-Americans: ${honorSummary}`,
      confidence: 0.75,
      confidenceLevel: CONFIDENCE.MEDIUM,
      category: 'special',
      reason: `${allAmericans.length} All-American(s) competing`,
      athleteContext: allAmericans,
    });
  }

  // Record holders feature
  if (milestones?.records && milestones.records.length > 0) {
    const recordHolders = milestones.records.slice(0, 2);
    const recordSummary = recordHolders.map(r => {
      const topRecord = r.recordMilestones[0];
      return `${r.name} (${topRecord.description || topRecord.type})`;
    }).join(', ');

    segments.push({
      id: 'template-special-records',
      name: 'Record Holder Feature',
      type: SEGMENT_TYPES.LIVE,
      duration: 30,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'fixed',
      notes: `Record holders competing: ${recordSummary}`,
      confidence: 0.65,
      confidenceLevel: CONFIDENCE.MEDIUM,
      category: 'special',
      reason: `${milestones.records.length} record holder(s) in the meet`,
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

    segments.push({
      id: 'template-special-milestones',
      name: 'Milestone Watch',
      type: SEGMENT_TYPES.LIVE,
      duration: 30,
      scene: 'Talent Camera',
      graphic: { graphicId: 'athlete-feature', params: {} },
      timingMode: 'fixed',
      notes: `Athletes approaching milestones: ${milestoneSummary}`,
      confidence: 0.6,
      confidenceLevel: CONFIDENCE.MEDIUM,
      category: 'special',
      reason: `${milestones.upcoming.length} athlete(s) approaching career milestones`,
      athleteContext: approachingMilestones,
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
