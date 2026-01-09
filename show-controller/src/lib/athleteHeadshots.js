// Athlete headshot lookup table
// Maps athlete name (lowercase) to Virtius media URL
// Organized by team for easier management

const athleteHeadshots = {
  // Navy
  'aaron stein': 'https://media.virti.us/upload/images/athlete/bVREzuzMfJF5Pi3INKuss',
  'aaron zorgo': 'https://media.virti.us/upload/images/athlete/RNYnjPd8T8bVwuAqicvdA',
  'benjamin thurlow lam': 'https://media.virti.us/upload/images/athlete/ThZW7XIbg2YbyXJ2EnD7H',
  'benjamin venters': 'https://media.virti.us/upload/images/athlete/r-oKniK7q45of_qtKATRp',
  'boone washburn': 'https://media.virti.us/upload/images/athlete/ZQ3tK20Awuf-PB6Xr2tlo',
  'brian solomon': 'https://media.virti.us/upload/images/athlete/zxKpzPO1WD1wuCTqu7yPR',
  'cody phillips': 'https://media.virti.us/upload/images/athlete/CBgJfcoBg99i_6dyApgPK',
  'colby prince': 'https://media.virti.us/upload/images/athlete/G7njrXwnxJ-EEKmGfPNFE',
  'daniel gurevich': 'https://media.virti.us/upload/images/athlete/kkZkc2xI9W89c57kITtbt',
  'danilo viciana': 'https://media.virti.us/upload/images/athlete/cSSPoHA9GXaHtV75aV61n',
  'garrett lawless': 'https://media.virti.us/upload/images/athlete/YbATup9pdxGJULqPmjenU',
  'jonah soltz': 'https://media.virti.us/upload/images/athlete/7Wp4vRjGrChEPu8Mwd_sq',
  'julian galvez': 'https://media.virti.us/upload/images/athlete/5Fmj6ulMKyhrDvUwIKBvm',
  'justin lozano': 'https://media.virti.us/upload/images/athlete/X8uS5pYTvziEg7UctRMTL',
  'kody tokunaga': 'https://media.virti.us/upload/images/athlete/7T-wvjPMsWIpiGClmVOgS',
  'matthew petros': 'https://media.virti.us/upload/images/athlete/Cf_PyziTQlB1O82sDBiww',
  'matthew zeigler': 'https://media.virti.us/upload/images/athlete/a3culpWPBE-_iMG44An6d',
  'mckinley michel': 'https://media.virti.us/upload/images/athlete/Zzm1XxWflm3d6afQPPZFg',
  'michael romo': 'https://media.virti.us/upload/images/athlete/m9Ujh6AViDf4uUUIFKaPQ',
  'payton guillory': 'https://media.virti.us/upload/images/athlete/Ic6oFPMimFW7FMuJtNxMw',
  'saran alexander': 'https://media.virti.us/upload/images/athlete/TrNnHtfYrH5BozHozZzvL',
  'sean armstrong': 'https://media.virti.us/upload/images/athlete/SCrZqcbmFrPnJqOSu77bG',

  // Add more athletes organized by team as needed
};

// Team roster metadata - tracks which athletes belong to which team
// This helps the Media Manager show roster completeness
export const teamRosters = {
  'navy': [
    'Aaron Stein',
    'Aaron Zorgo',
    'Benjamin Thurlow Lam',
    'Benjamin Venters',
    'Boone Washburn',
    'Brian Solomon',
    'Cody Phillips',
    'Colby Prince',
    'Daniel Gurevich',
    'Danilo Viciana',
    'Garrett Lawless',
    'Jonah Soltz',
    'Julian Galvez',
    'Justin Lozano',
    'Kody Tokunaga',
    'Matthew Petros',
    'Matthew Zeigler',
    'McKinley Michel',
    'Michael Romo',
    'Nathan Bunten',
    'Payton Guillory',
    'Saran Alexander',
    'Sean Armstrong',
  ],
  // Add more team rosters as needed
};

/**
 * Normalize an athlete name for flexible matching
 */
function normalizeAthleteName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
    .replace(/\s+/g, ' ')      // Collapse multiple spaces
    .trim();
}

/**
 * Look up athlete headshot URL by name
 * @param {string} athleteName - The athlete's full name (case-insensitive)
 * @returns {string} The headshot URL or empty string if not found
 */
export function getAthleteHeadshot(athleteName) {
  if (!athleteName) return '';

  // Try exact match first (case-insensitive)
  const lowered = athleteName.toLowerCase().trim();
  if (athleteHeadshots[lowered]) return athleteHeadshots[lowered];

  // Try normalized match
  const normalized = normalizeAthleteName(athleteName);
  if (athleteHeadshots[normalized]) return athleteHeadshots[normalized];

  // Try matching against normalized versions of all keys
  for (const [key, url] of Object.entries(athleteHeadshots)) {
    if (normalizeAthleteName(key) === normalized) {
      return url;
    }
  }

  return '';
}

/**
 * Check if we have a headshot for this athlete
 * @param {string} athleteName - The athlete's full name (case-insensitive)
 * @returns {boolean}
 */
export function hasAthleteHeadshot(athleteName) {
  return getAthleteHeadshot(athleteName) !== '';
}

/**
 * Get all athletes for a team
 * @param {string} teamName - The team name (case-insensitive)
 * @returns {Array<{name: string, hasHeadshot: boolean, headshotUrl: string}>}
 */
export function getTeamRoster(teamName) {
  if (!teamName) return [];
  const normalized = teamName.toLowerCase().trim();
  const roster = teamRosters[normalized] || [];

  return roster.map(name => ({
    name,
    hasHeadshot: hasAthleteHeadshot(name),
    headshotUrl: getAthleteHeadshot(name),
  }));
}

/**
 * Get roster completeness stats for a team
 * @param {string} teamName - The team name (case-insensitive)
 * @returns {{total: number, withHeadshots: number, percentage: number}}
 */
export function getTeamRosterStats(teamName) {
  const roster = getTeamRoster(teamName);
  const withHeadshots = roster.filter(a => a.hasHeadshot).length;
  return {
    total: roster.length,
    withHeadshots,
    percentage: roster.length > 0 ? Math.round((withHeadshots / roster.length) * 100) : 0,
  };
}

/**
 * Get list of all teams that have rosters defined
 * @returns {string[]}
 */
export function getTeamsWithRosters() {
  return Object.keys(teamRosters);
}

export default athleteHeadshots;
