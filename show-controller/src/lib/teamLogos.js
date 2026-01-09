// Team logo lookup table
// Maps team name (lowercase) to Virtius media URL
// Add new teams as you discover them

const teamLogos = {
  // Men's teams
  'william & mary': 'https://media.virti.us/upload/images/team/MG4yA_-sLEqBckLyfy71-',
  'maryland': 'https://media.virti.us/upload/images/team/b3SmbX-UKRPk1HkzRPrD_',
  'george washington': 'https://media.virti.us/upload/images/team/R7CeYsmiyWvBNZKrG88UH',
  'gw': 'https://media.virti.us/upload/images/team/R7CeYsmiyWvBNZKrG88UH',
  'california': 'https://media.virti.us/upload/images/team/jfBUCDAAOrc9urkAN65iZ',
  'cal': 'https://media.virti.us/upload/images/team/jfBUCDAAOrc9urkAN65iZ',
  'illinois': 'https://media.virti.us/upload/images/team/t9wWLsOPF2bpVZHqjsogl',
  'navy': 'https://media.virti.us/upload/images/team/QtMgsTKjUwl0sEQwnlwNT',
  'springfield': 'https://media.virti.us/upload/images/team/B90OmKJn62sRjh404Y3eD',
  'stanford': 'https://media.virti.us/upload/images/team/TxEa6Awt5quagSXQIhqtk',
  'michigan': 'https://media.virti.us/upload/images/team/OlF6zJbX8C_3TY7v_vL5S',
  'simpson': 'https://media.virti.us/upload/images/team/5iJiCZuUmn0V7FPYx6-Oh',
  'greenville': 'https://media.virti.us/upload/images/team/ENm2b6qi96JA3DRXNyvt9',
  'penn state': 'https://media.virti.us/upload/images/team/6Ju2q59cmDgc7NU-VCdEg',
  'pennstate': 'https://media.virti.us/upload/images/team/6Ju2q59cmDgc7NU-VCdEg',
  'psu': 'https://media.virti.us/upload/images/team/6Ju2q59cmDgc7NU-VCdEg',
  'army': 'https://media.virti.us/upload/images/team/wmICCck438BshXvBlPHV_',

  // Add more teams here as needed
  // 'ohio state': 'https://media.virti.us/upload/images/team/...',
};

/**
 * Normalize a team name for flexible matching
 * Removes special chars, extra spaces, and handles common variations
 */
function normalizeTeamName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .replace(/\buniversity\b/g, '')
    .replace(/\bof\b/g, '')
    .trim();
}

/**
 * Look up team logo URL by team name
 * Handles variations in spelling, capitalization, and formatting
 * @param {string} teamName - The team name (case-insensitive)
 * @returns {string} The logo URL or empty string if not found
 */
export function getTeamLogo(teamName) {
  if (!teamName) return '';

  // Try exact match first (case-insensitive)
  const lowered = teamName.toLowerCase().trim();
  if (teamLogos[lowered]) return teamLogos[lowered];

  // Try normalized match (removes punctuation, "university", "of", etc.)
  const normalized = normalizeTeamName(teamName);
  if (teamLogos[normalized]) return teamLogos[normalized];

  // Try matching against normalized versions of all keys
  for (const [key, url] of Object.entries(teamLogos)) {
    if (normalizeTeamName(key) === normalized) {
      return url;
    }
  }

  // Try partial match - if input contains a team name or vice versa
  for (const [key, url] of Object.entries(teamLogos)) {
    const normalizedKey = normalizeTeamName(key);
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return url;
    }
  }

  return '';
}

/**
 * Check if we have a logo for this team
 * @param {string} teamName - The team name (case-insensitive)
 * @returns {boolean}
 */
export function hasTeamLogo(teamName) {
  return getTeamLogo(teamName) !== '';
}

export default teamLogos;
