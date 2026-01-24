/**
 * AI Context Analyzer for Rundown Editor (Phase 12)
 *
 * Analyzes competition metadata, roster data, and dates to provide
 * intelligent segment suggestions for rundown planning.
 *
 * Task 87: AI context analysis - Analyze competition metadata, roster, dates
 */

// ============================================
// DATE ANALYSIS
// ============================================

/**
 * Get relevant holidays and special dates around a competition date
 * @param {Date|string} competitionDate - The date of the competition
 * @returns {Array<{name: string, date: Date, daysAway: number}>}
 */
export function getHolidaysNearDate(competitionDate) {
  const date = new Date(competitionDate);
  const year = date.getFullYear();
  const holidays = [];

  // Define holidays for analysis (US-centric for NCAA gymnastics)
  const holidayDefinitions = [
    { name: "New Year's Day", month: 0, day: 1 },
    { name: "Valentine's Day", month: 1, day: 14 },
    { name: "St. Patrick's Day", month: 2, day: 17 },
    { name: "Easter", getDate: (y) => calculateEaster(y) }, // Dynamic
    { name: "Mother's Day", getDate: (y) => getNthDayOfMonth(y, 4, 0, 2) }, // 2nd Sunday of May
    { name: "Memorial Day", getDate: (y) => getLastDayOfMonth(y, 4, 1) }, // Last Monday of May
    { name: "Independence Day", month: 6, day: 4 },
    { name: "Labor Day", getDate: (y) => getNthDayOfMonth(y, 8, 1, 1) }, // 1st Monday of Sept
    { name: "Halloween", month: 9, day: 31 },
    { name: "Veterans Day", month: 10, day: 11 },
    { name: "Thanksgiving", getDate: (y) => getNthDayOfMonth(y, 10, 4, 4) }, // 4th Thursday of Nov
    { name: "Christmas Eve", month: 11, day: 24 },
    { name: "Christmas Day", month: 11, day: 25 },
    { name: "New Year's Eve", month: 11, day: 31 },
    // NCAA Gymnastics specific
    { name: "NCAA Regionals", month: 3, day: 4 }, // Approximate - first weekend of April
    { name: "NCAA Championships", month: 3, day: 18 }, // Approximate - mid-April
    { name: "Senior Night Season", month: 2, day: 1 }, // March is typically senior night season
  ];

  for (const holiday of holidayDefinitions) {
    let holidayDate;
    if (holiday.getDate) {
      holidayDate = holiday.getDate(year);
    } else {
      holidayDate = new Date(year, holiday.month, holiday.day);
    }

    const daysAway = Math.round((holidayDate - date) / (1000 * 60 * 60 * 24));

    // Include holidays within 7 days of competition
    if (Math.abs(daysAway) <= 7) {
      holidays.push({
        name: holiday.name,
        date: holidayDate,
        daysAway,
      });
    }
  }

  return holidays.sort((a, b) => Math.abs(a.daysAway) - Math.abs(b.daysAway));
}

/**
 * Calculate Easter Sunday for a given year (Western/Gregorian)
 */
function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/**
 * Get the Nth occurrence of a day in a month
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {number} dayOfWeek - 0 = Sunday, 1 = Monday, etc.
 * @param {number} n - 1st, 2nd, 3rd, etc.
 */
function getNthDayOfMonth(year, month, dayOfWeek, n) {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  let day = 1 + ((dayOfWeek - firstDayOfWeek + 7) % 7) + (n - 1) * 7;
  return new Date(year, month, day);
}

/**
 * Get the last occurrence of a day in a month
 */
function getLastDayOfMonth(year, month, dayOfWeek) {
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastDay.getDay();
  const diff = (lastDayOfWeek - dayOfWeek + 7) % 7;
  return new Date(year, month + 1, -diff);
}

/**
 * Determine if this is likely a season opener
 * @param {Date|string} date - Competition date
 * @param {Array} schedule - Team's schedule (optional)
 */
export function isSeasonOpener(date, schedule = null) {
  const compDate = new Date(date);
  const month = compDate.getMonth();

  // NCAA gymnastics season typically starts in early January
  // Season openers are usually in first 2 weeks of January
  if (month === 0 && compDate.getDate() <= 21) {
    return { likely: true, confidence: 0.7 };
  }

  // If we have schedule data, check if this is the first meet
  if (schedule && schedule.length > 0) {
    const sortedSchedule = [...schedule].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstMeet = sortedSchedule[0];
    if (firstMeet && Math.abs(new Date(firstMeet.date) - compDate) < 2 * 24 * 60 * 60 * 1000) {
      return { likely: true, confidence: 0.95 };
    }
  }

  return { likely: false, confidence: 0 };
}

/**
 * Determine if this is likely a senior meet
 * @param {Object} competition - Competition metadata
 * @param {Date|string} date - Competition date
 */
export function isSeniorMeet(competition, date = null) {
  const eventName = (competition?.eventName || competition?.name || '').toLowerCase();

  // Check explicit naming
  if (eventName.includes('senior') || eventName.includes('sr.') || eventName.includes('sr ')) {
    return { likely: true, confidence: 0.95, reason: 'Event name includes senior' };
  }

  // Check date - senior meets typically in late Feb/early March
  if (date) {
    const compDate = new Date(date);
    const month = compDate.getMonth();
    // February or early March
    if (month === 1 || (month === 2 && compDate.getDate() <= 15)) {
      return { likely: true, confidence: 0.5, reason: 'Date is during typical senior meet window' };
    }
  }

  return { likely: false, confidence: 0 };
}

/**
 * Determine if this is a rivalry meet
 * @param {Object} competition - Competition with team names
 */
export function isRivalryMeet(competition) {
  const rivalries = [
    // Pac-12 / Big 10 / SEC rivalries
    ['UCLA', 'USC'],
    ['UCLA', 'Stanford'],
    ['Utah', 'BYU'],
    ['Michigan', 'Michigan State'],
    ['Ohio State', 'Michigan'],
    ['LSU', 'Alabama'],
    ['LSU', 'Florida'],
    ['Georgia', 'Alabama'],
    ['Florida', 'Georgia'],
    ['Oklahoma', 'Oklahoma State'],
    ['Oklahoma', 'Denver'],
    // Men's rivalries
    ['Penn State', 'Michigan'],
    ['Oklahoma', 'Stanford'],
    ['Illinois', 'Michigan'],
  ];

  const teamNames = [];
  for (let i = 1; i <= 6; i++) {
    const teamName = competition[`team${i}Name`] || competition?.teams?.[i]?.name;
    if (teamName) teamNames.push(teamName.toLowerCase());
  }

  for (const [team1, team2] of rivalries) {
    const t1 = team1.toLowerCase();
    const t2 = team2.toLowerCase();
    if (teamNames.some(t => t.includes(t1)) && teamNames.some(t => t.includes(t2))) {
      return {
        likely: true,
        confidence: 0.9,
        teams: [team1, team2],
        reason: `Rivalry matchup: ${team1} vs ${team2}`,
      };
    }
  }

  return { likely: false, confidence: 0 };
}

/**
 * Determine if this is a championship meet
 * @param {Object} competition - Competition metadata
 */
export function isChampionshipMeet(competition) {
  const eventName = (competition?.eventName || competition?.name || '').toLowerCase();

  const championshipKeywords = [
    'championship', 'championships', 'ncaa', 'regional', 'regionals',
    'conference', 'big ten', 'big 10', 'pac-12', 'pac 12', 'sec ',
    'big 12', 'big twelve', 'national', 'final', 'finals',
  ];

  for (const keyword of championshipKeywords) {
    if (eventName.includes(keyword)) {
      return {
        likely: true,
        confidence: 0.9,
        type: keyword.includes('ncaa') ? 'ncaa' :
              keyword.includes('regional') ? 'regional' :
              keyword.includes('conference') || ['big ten', 'pac-12', 'sec', 'big 12'].some(c => keyword.includes(c)) ? 'conference' :
              'other',
        reason: `Event name includes "${keyword}"`,
      };
    }
  }

  return { likely: false, confidence: 0 };
}

// ============================================
// ROSTER ANALYSIS
// ============================================

/**
 * Identify seniors on a roster
 * @param {Array} roster - Array of athlete objects with year field
 */
export function identifySeniors(roster) {
  if (!roster || !Array.isArray(roster)) return [];

  // Year 4 or 5 (5th year seniors/grad students)
  return roster.filter(athlete => {
    const year = athlete.year || athlete.school_year;
    return year === 4 || year === 5 ||
           (typeof year === 'string' && (year.toLowerCase().includes('sr') || year.toLowerCase().includes('gr')));
  }).map(athlete => ({
    ...athlete,
    fullName: athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim(),
  }));
}

/**
 * Look for athletes with notable achievements in their profile
 * This is a heuristic check - real implementation would need achievement database
 * @param {Array} roster - Array of athlete objects
 * @param {Object} options - Options for what to look for
 */
export function identifyNotableAthletes(roster, options = {}) {
  if (!roster || !Array.isArray(roster)) return [];

  const notable = [];

  for (const athlete of roster) {
    const fullName = athlete.fullName || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim();
    const notes = [];

    // Check for seniors (always notable)
    const year = athlete.year || athlete.school_year;
    if (year === 4 || year === 5) {
      notes.push('Senior');
    }

    // Look for achievements in athlete data (if available)
    if (athlete.achievements) {
      if (athlete.achievements.includes('All-American') || athlete.achievements.includes('AA')) {
        notes.push('All-American');
      }
      if (athlete.achievements.includes('National Champion')) {
        notes.push('National Champion');
      }
    }

    // Look for hometown stories (local athlete)
    if (options.venueLocation && athlete.hometown) {
      const hometown = athlete.hometown.toLowerCase();
      const venue = options.venueLocation.toLowerCase();
      if (hometown.includes(venue) || venue.includes(hometown.split(',')[0])) {
        notes.push('Hometown athlete');
      }
    }

    if (notes.length > 0) {
      notable.push({
        fullName,
        athlete,
        notes,
      });
    }
  }

  return notable;
}

/**
 * Get roster summary for a team
 * @param {Object} teamData - Team data object with roster array
 */
export function getRosterSummary(teamData) {
  if (!teamData?.roster) {
    return {
      total: 0,
      seniors: [],
      byYear: {},
      hasHeadshots: 0,
    };
  }

  const roster = teamData.roster;
  const seniors = identifySeniors(roster);
  const byYear = {};

  for (const athlete of roster) {
    const year = athlete.year || athlete.school_year || 'Unknown';
    byYear[year] = (byYear[year] || 0) + 1;
  }

  return {
    total: roster.length,
    seniors,
    seniorCount: seniors.length,
    byYear,
    hasHeadshots: roster.filter(a => a.headshotUrl).length,
    headshotCoverage: roster.length > 0
      ? Math.round((roster.filter(a => a.headshotUrl).length / roster.length) * 100)
      : 0,
  };
}

// ============================================
// COMPETITION ANALYSIS
// ============================================

/**
 * Analyze competition type and format
 * @param {Object} competition - Competition config object
 */
export function analyzeCompetitionFormat(competition) {
  const compType = competition?.compType || competition?.type || '';
  const analysis = {
    gender: 'unknown',
    teamCount: 0,
    format: 'unknown',
    events: [],
  };

  // Determine gender
  if (compType.includes('womens') || compType.includes('women')) {
    analysis.gender = 'womens';
    analysis.events = ['VT', 'UB', 'BB', 'FX']; // Olympic order
  } else if (compType.includes('mens') || compType.includes('men')) {
    analysis.gender = 'mens';
    analysis.events = ['FX', 'PH', 'SR', 'VT', 'PB', 'HB']; // Olympic order
  }

  // Determine team count and format
  if (compType.includes('dual')) {
    analysis.teamCount = 2;
    analysis.format = 'dual';
  } else if (compType.includes('tri')) {
    analysis.teamCount = 3;
    analysis.format = 'tri';
  } else if (compType.includes('quad')) {
    analysis.teamCount = 4;
    analysis.format = 'quad';
  } else if (compType.includes('5') || compType.includes('five')) {
    analysis.teamCount = 5;
    analysis.format = 'multi';
  } else if (compType.includes('6') || compType.includes('six')) {
    analysis.teamCount = 6;
    analysis.format = 'multi';
  }

  // Calculate rotations
  analysis.rotations = analysis.gender === 'womens' ? 4 : 6;

  return analysis;
}

/**
 * Get all teams from competition config
 * @param {Object} competition - Competition config
 * @returns {Array<{slot: number, name: string, logo: string}>}
 */
export function getTeamsFromCompetition(competition) {
  const teams = [];

  for (let i = 1; i <= 6; i++) {
    const name = competition[`team${i}Name`] || competition?.teams?.[i]?.name;
    if (name) {
      teams.push({
        slot: i,
        name,
        logo: competition[`team${i}Logo`] || competition?.teams?.[i]?.logo || '',
      });
    }
  }

  return teams;
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Perform full AI context analysis for a competition
 * This is the main entry point for Task 87
 *
 * @param {Object} params
 * @param {Object} params.competition - Competition config from Firebase
 * @param {Object} params.teamData - Team data from Firebase (RTN enriched)
 * @param {Date|string} params.date - Competition date (optional, defaults to today)
 * @returns {Object} Full context analysis
 */
export function analyzeCompetitionContext({ competition, teamData, date }) {
  const competitionDate = date ? new Date(date) : new Date();

  // Basic competition analysis
  const format = analyzeCompetitionFormat(competition);
  const teams = getTeamsFromCompetition(competition);

  // Date-based analysis
  const holidays = getHolidaysNearDate(competitionDate);
  const seasonOpener = isSeasonOpener(competitionDate);
  const seniorMeet = isSeniorMeet(competition, competitionDate);
  const rivalry = isRivalryMeet(competition);
  const championship = isChampionshipMeet(competition);

  // Team/roster analysis
  const teamAnalysis = {};
  let allSeniors = [];
  let allNotable = [];

  for (const team of teams) {
    const data = teamData?.[`team${team.slot}`];
    if (data) {
      const summary = getRosterSummary(data);
      teamAnalysis[`team${team.slot}`] = {
        name: team.name,
        ...summary,
        coaches: data.coaches || [],
        rankings: data.rankings || null,
        stats: data.stats || null,
      };

      // Collect seniors across all teams
      for (const senior of summary.seniors) {
        allSeniors.push({
          ...senior,
          team: team.name,
          teamSlot: team.slot,
        });
      }

      // Identify notable athletes
      const notable = identifyNotableAthletes(data.roster, {
        venueLocation: competition?.venueLocation,
      });
      for (const athlete of notable) {
        allNotable.push({
          ...athlete,
          team: team.name,
          teamSlot: team.slot,
        });
      }
    }
  }

  // Build context summary
  const context = {
    // Metadata
    competitionId: competition?.id || null,
    eventName: competition?.eventName || competition?.name || 'Unknown Event',
    date: competitionDate.toISOString(),

    // Format analysis
    format,
    teams,

    // Special event detection
    specialEvents: {
      holidays: holidays.length > 0 ? holidays : null,
      isSeasonOpener: seasonOpener.likely,
      seasonOpenerConfidence: seasonOpener.confidence,
      isSeniorMeet: seniorMeet.likely,
      seniorMeetConfidence: seniorMeet.confidence,
      seniorMeetReason: seniorMeet.reason,
      isRivalry: rivalry.likely,
      rivalryConfidence: rivalry.confidence,
      rivalryTeams: rivalry.teams,
      rivalryReason: rivalry.reason,
      isChampionship: championship.likely,
      championshipType: championship.type,
      championshipConfidence: championship.confidence,
    },

    // Roster analysis
    teamAnalysis,
    allSeniors,
    allNotable,
    seniorCount: allSeniors.length,

    // Suggestion triggers (for Tasks 88-91)
    triggers: buildSuggestionTriggers({
      format,
      holidays,
      seasonOpener,
      seniorMeet,
      rivalry,
      championship,
      allSeniors,
      allNotable,
      teams,
    }),
  };

  return context;
}

/**
 * Build suggestion triggers based on analysis
 * These triggers will be used by Tasks 88-91 to generate segment suggestions
 */
function buildSuggestionTriggers({
  format,
  holidays,
  seasonOpener,
  seniorMeet,
  rivalry,
  championship,
  allSeniors,
  allNotable,
  teams,
}) {
  const triggers = [];

  // Holiday triggers
  for (const holiday of holidays) {
    if (Math.abs(holiday.daysAway) <= 3) {
      triggers.push({
        type: 'holiday',
        name: holiday.name,
        priority: holiday.daysAway === 0 ? 'high' : 'medium',
        data: holiday,
      });
    }
  }

  // Season opener trigger
  if (seasonOpener.likely) {
    triggers.push({
      type: 'season_opener',
      priority: 'high',
      confidence: seasonOpener.confidence,
    });
  }

  // Senior meet trigger
  if (seniorMeet.likely) {
    triggers.push({
      type: 'senior_meet',
      priority: 'high',
      confidence: seniorMeet.confidence,
      seniors: allSeniors,
      seniorCount: allSeniors.length,
    });
  }

  // Rivalry trigger
  if (rivalry.likely) {
    triggers.push({
      type: 'rivalry',
      priority: 'high',
      confidence: rivalry.confidence,
      teams: rivalry.teams,
    });
  }

  // Championship trigger
  if (championship.likely) {
    triggers.push({
      type: 'championship',
      priority: 'high',
      confidence: championship.confidence,
      championshipType: championship.type,
    });
  }

  // Notable athlete triggers
  for (const notable of allNotable) {
    if (notable.notes.includes('All-American')) {
      triggers.push({
        type: 'all_american',
        priority: 'medium',
        athlete: notable.fullName,
        team: notable.team,
      });
    }
    if (notable.notes.includes('Hometown athlete')) {
      triggers.push({
        type: 'hometown',
        priority: 'low',
        athlete: notable.fullName,
        team: notable.team,
      });
    }
  }

  // Team count triggers
  if (teams.length >= 4) {
    triggers.push({
      type: 'multi_team',
      priority: 'low',
      teamCount: teams.length,
    });
  }

  return triggers;
}

export default analyzeCompetitionContext;
