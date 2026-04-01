/**
 * URL Builder for Virtius Graphics Engine
 * Generates properly formatted URLs for all graphics overlays
 *
 * Production: https://commentarygraphic.com
 * Local: Uses window.location.origin
 */

import { getGraphicById, isTransparentGraphic as registryIsTransparent } from './graphicsRegistry';

/**
 * Get the base URL for graphics
 * Uses current origin for local development, can be overridden for production
 */
export function getBaseURL() {
  // In production this could be: 'https://virtiusgraphicsenginev001.netlify.app'
  // For local dev, use the current origin
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/**
 * Graphics path mapping
 * Maps internal graphic IDs to their HTML file paths
 */
const GRAPHIC_PATHS = {
  // PRE-MEET
  'logos': 'logos.html',
  'event-bar': 'event-bar.html',
  'warm-up': 'warm-up.html',
  'hosts': 'hosts.html',
  'team-stats': 'team-stats.html',
  'coaches': 'coaches.html',

  // EVENT FRAMES
  'event-frame': 'event-frame.html',

  // STREAM
  'stream': 'stream.html',
};

/**
 * Event titles mapping for event frames
 */
const EVENT_TITLES = {
  floor: 'FLOOR EXERCISE',
  pommel: 'POMMEL HORSE',
  rings: 'STILL RINGS',
  vault: 'VAULT',
  pbars: 'PARALLEL BARS',
  hbar: 'HORIZONTAL BAR',
  ubars: 'UNEVEN BARS',
  beam: 'BALANCE BEAM',
  allaround: 'ALL-AROUND',
  final: 'FINAL SCORES',
  order: 'COMPETITION ORDER',
  lineups: 'NEXT EVENT LINEUPS',
  summary: 'EVENT SUMMARY',
};

/**
 * Encode a URL parameter value safely
 * @param {string} value - Value to encode
 * @returns {string} Encoded value
 */
function encode(value) {
  return encodeURIComponent(value || '');
}

/**
 * Build URL for Team Logos graphic
 * @param {Object} options
 * @param {Object} options.teams - Team data keyed by team number (team1Name, team1Logo, etc.)
 * @param {number} options.teamCount - Number of teams to include
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildLogosURL({ teams, teamCount, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  for (let i = 1; i <= teamCount; i++) {
    const logo = teams[`team${i}Logo`];
    if (logo) {
      params.set(`team${i}Logo`, logo);
    }
  }

  if (meetTheme) params.set('meetTheme', meetTheme);
  return `${base}/overlays/logos.html?${params.toString()}`;
}

/**
 * Build URL for Event Bar graphic
 * @param {Object} options
 * @param {string} options.team1Logo - Team 1 logo URL
 * @param {string} options.venue - Venue name
 * @param {string} options.eventName - Event/meet name
 * @param {string} options.location - Location
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildEventBarURL({ team1Logo, venue, eventName, location, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (team1Logo) params.set('team1Logo', team1Logo);
  if (venue) params.set('venue', venue);
  if (eventName) params.set('eventName', eventName);
  if (location) params.set('location', location);
  if (meetTheme) params.set('meetTheme', meetTheme);

  return `${base}/overlays/event-bar.html?${params.toString()}`;
}

/**
 * Build URL for Hosts graphic
 * @param {Object} options
 * @param {string} options.hosts - Hosts (newline or pipe separated)
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildHostsURL({ hosts, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  // Convert newlines to pipes for URL
  const hostsFormatted = hosts?.split('\n').join('|') || '';
  let url = `${base}/overlays/hosts.html?hosts=${encode(hostsFormatted)}`;
  if (meetTheme) url += `&meetTheme=${encode(meetTheme)}`;
  return url;
}

/**
 * Build URL for Team Stats graphic
 * @param {Object} options
 * @param {string} options.teamName - Team name
 * @param {string} options.logo - Team logo URL
 * @param {string} [options.statLabel] - Label for the primary stat (e.g., 'AVG', 'NQS', 'HIGH')
 * @param {string} [options.statValue] - Value for the primary stat
 * @param {string} [options.ave] - Average score (backwards compat, used if statValue not set)
 * @param {string} options.high - High score
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildTeamStatsURL({ teamName, logo, statLabel, statValue, ave, high, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (teamName) params.set('teamName', teamName);
  if (logo) params.set('logo', logo);
  // Use statLabel/statValue if provided, otherwise fall back to 'AVG'/ave for backwards compat
  if (statLabel) params.set('statLabel', statLabel);
  if (statValue) params.set('statValue', statValue);
  if (!statValue && ave) params.set('ave', ave); // Backwards compat: overlay reads 'ave' if no statValue
  if (high) params.set('high', high);
  if (meetTheme) params.set('meetTheme', meetTheme);

  return `${base}/overlays/team-stats.html?${params.toString()}`;
}

/**
 * Build URL for Coaches graphic
 * @param {Object} options
 * @param {string} options.logo - Team logo URL
 * @param {string} options.coaches - Coaches (newline or pipe separated)
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildCoachesURL({ logo, coaches, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  // Convert newlines to pipes for URL
  const coachesFormatted = coaches?.split('\n').join('|') || '';
  const params = new URLSearchParams();

  if (logo) params.set('logo', logo);
  if (coachesFormatted) params.set('coaches', coachesFormatted);
  if (meetTheme) params.set('meetTheme', meetTheme);

  return `${base}/overlays/coaches.html?${params.toString()}`;
}

/**
 * Build URL for Team Roster graphic
 * @param {Object} options
 * @param {string} options.compId - Competition ID
 * @param {number} options.teamSlot - Team slot number (1-6)
 * @param {string} options.teamName - Team name (for preview)
 * @param {string} options.logo - Team logo URL (for preview)
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildTeamRosterURL({ compId, teamSlot, teamName, logo, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (compId) params.set('compId', compId);
  if (teamSlot) params.set('teamSlot', teamSlot);
  if (teamName) params.set('teamName', teamName);
  if (logo) params.set('logo', logo);
  if (meetTheme) params.set('meetTheme', meetTheme);

  return `${base}/overlays/team-roster.html?${params.toString()}`;
}

/**
 * Build URL for Event Frame graphic
 * @param {Object} options
 * @param {string} options.eventId - Event ID (floor, vault, etc.)
 * @param {string} options.logo - Team logo URL
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildEventFrameURL({ eventId, logo, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const title = EVENT_TITLES[eventId] || eventId?.toUpperCase() || '';
  const params = new URLSearchParams();

  if (title) params.set('title', title);
  if (logo) params.set('logo', logo);
  if (meetTheme) params.set('meetTheme', meetTheme);

  return `${base}/overlays/event-frame.html?${params.toString()}`;
}

/**
 * Build URL for Stream graphic (Starting/Thanks)
 * Supports multi-team logos: dual meets show Logo1 VS Logo2, 3+ teams show row of logos
 * @param {Object} options
 * @param {string} options.type - 'starting' or 'thanks'
 * @param {string} options.logo - Team 1 logo URL
 * @param {string} [options.logo2] - Team 2 logo URL
 * @param {string} [options.logo3] - Team 3 logo URL
 * @param {string} [options.logo4] - Team 4 logo URL
 * @param {string} [options.logo5] - Team 5 logo URL
 * @param {string} [options.logo6] - Team 6 logo URL
 * @param {string} [options.logo7] - Team 7 logo URL
 * @param {string} options.eventName - Event/meet name
 * @param {string} options.meetDate - Date of the meet
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildStreamURL({ type, logo, logo2, logo3, logo4, logo5, logo6, logo7, eventName, meetDate, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const title = type === 'starting' ? 'STREAM STARTING SOON' : 'THANKS FOR WATCHING';
  const params = new URLSearchParams();

  params.set('title', title);
  if (logo) params.set('logo', logo);
  if (logo2) params.set('logo2', logo2);
  if (logo3) params.set('logo3', logo3);
  if (logo4) params.set('logo4', logo4);
  if (logo5) params.set('logo5', logo5);
  if (logo6) params.set('logo6', logo6);
  if (logo7) params.set('logo7', logo7);
  if (eventName) params.set('eventName', eventName);
  if (meetDate) params.set('meetDate', meetDate);
  if (meetTheme) params.set('meetTheme', meetTheme);

  return `${base}/overlays/stream.html?${params.toString()}`;
}

/**
 * Build URL for Sponsors Thanks graphic (full-screen grid)
 * @param {Object} options
 * @param {string} options.logo - Team logo URL
 * @param {string} options.sponsorsJson - JSON array of sponsors [{name, url}, ...]
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildSponsorsThanksURL({ logo, sponsorsJson, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (logo) params.set('logo', logo);
  if (sponsorsJson) params.set('sponsors', sponsorsJson);
  if (meetTheme) params.set('meetTheme', meetTheme);

  return `${base}/overlays/sponsors-thanks.html?${params.toString()}`;
}

/**
 * Build URL for Sponsors Cycle graphic (full-screen cycling)
 * @param {Object} options
 * @param {string} options.logo - Team logo URL
 * @param {string} options.sponsorsJson - JSON array of sponsors [{name, url}, ...]
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildSponsorsCycleURL({ logo, sponsorsJson, baseUrl, meetTheme, lockedIndex, showBounds, showGuides, cycleDuration, excluded }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (logo) params.set('logo', logo);
  if (sponsorsJson) params.set('sponsors', sponsorsJson);
  if (meetTheme) params.set('meetTheme', meetTheme);
  if (lockedIndex != null && lockedIndex >= 0) params.set('lockedIndex', String(lockedIndex));
  if (cycleDuration != null && cycleDuration !== 3) params.set('cycleDuration', String(cycleDuration));
  if (excluded && excluded.length > 0) params.set('excluded', excluded.join(','));
  if (showBounds) params.set('showBounds', 'true');
  if (showGuides) params.set('showGuides', 'true');

  return `${base}/overlays/sponsors-cycle.html?${params.toString()}`;
}

/**
 * Build URL for Sponsors Bug graphic (corner bug overlay)
 * @param {Object} options
 * @param {string} options.sponsorsJson - JSON array of sponsors [{name, url}, ...]
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildSponsorsBugURL({ sponsorsJson, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (sponsorsJson) params.set('sponsors', sponsorsJson);
  if (meetTheme) params.set('meetTheme', meetTheme);

  return `${base}/overlays/sponsors-bug.html?${params.toString()}`;
}

/**
 * Build URL for Frame Overlay graphics
 * @param {Object} options
 * @param {string} options.frameType - Frame type (quad, tri-center, tri-wide, team-header, single)
 * @param {Object} options.teams - Team data keyed by team number
 * @param {number} options.teamCount - Number of teams
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildFrameOverlayURL({ frameType, teams, teamCount, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  // Add team logos for frame overlays
  for (let i = 1; i <= teamCount; i++) {
    const logo = teams[`team${i}Logo`];
    if (logo) {
      params.set(`team${i}Logo`, logo);
    }
  }

  if (meetTheme) params.set('meetTheme', meetTheme);
  return `${base}/overlays/frame-${frameType}.html?${params.toString()}`;
}

/**
 * Build URL for Leaderboard graphic
 * @param {Object} options
 * @param {string} options.event - Event ID (floor, vault, etc. or 'all-around')
 * @param {string} options.virtiusSessionId - Virtius session ID for live data
 * @param {string} options.gender - Gender ('mens' or 'womens') for column visibility
 * @param {Object} options.teams - Team data keyed by team number
 * @param {number} options.teamCount - Number of teams
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildLeaderboardURL({ event, virtiusSessionId, gender, teams, teamCount, compId, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  // Competition ID is required for leaderboards (needs live Virtius data)
  if (compId) params.set('comp', compId);
  // Use leaderboardEvent to match output.html renderer expectation
  if (event) params.set('leaderboardEvent', event);
  if (virtiusSessionId) params.set('virtiusSessionId', virtiusSessionId);
  if (gender) params.set('leaderboardGender', gender);

  // Add team data for display
  for (let i = 1; i <= teamCount; i++) {
    const name = teams[`team${i}Name`];
    const logo = teams[`team${i}Logo`];
    if (name) params.set(`team${i}Name`, name);
    if (logo) params.set(`team${i}Logo`, logo);
  }

  if (meetTheme) params.set('meetTheme', meetTheme);
  return `${base}/output.html?graphic=virtius-leaderboard&${params.toString()}`;
}

/**
 * Build URL for Combined AA Leaderboard graphic (merges two Virtius sessions)
 * @param {Object} options
 * @param {string} options.virtiusSessionId - First Virtius session ID
 * @param {string} options.virtiusSessionId2 - Second Virtius session ID
 * @param {string} options.gender - Gender ('mens' or 'womens') for column visibility
 * @param {Object} options.teams - Team data keyed by team number
 * @param {number} options.teamCount - Number of teams
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildCombinedAALeaderboardURL({ virtiusSessionId, virtiusSessionId2, gender, teams, teamCount, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (virtiusSessionId) params.set('virtiusSessionId', virtiusSessionId);
  if (virtiusSessionId2) params.set('virtiusSessionId2', virtiusSessionId2);
  if (gender) params.set('leaderboardGender', gender);

  // Add team data for display
  for (let i = 1; i <= teamCount; i++) {
    const name = teams[`team${i}Name`];
    const logo = teams[`team${i}Logo`];
    if (name) params.set(`team${i}Name`, name);
    if (logo) params.set(`team${i}Logo`, logo);
  }

  if (meetTheme) params.set('meetTheme', meetTheme);
  return `${base}/output.html?graphic=combined-aa-leaderboard&${params.toString()}`;
}

/**
 * Build URL for Event Summary graphic
 * @param {Object} options
 * @param {string} options.mode - 'rotation' or 'apparatus'
 * @param {number} [options.rotation] - Rotation number (1-6) if mode is 'rotation'
 * @param {string} [options.apparatus] - Apparatus ID (fx, ph, etc.) if mode is 'apparatus'
 * @param {string} options.virtiusSessionId - Virtius session ID for live data
 * @param {string} options.compType - Competition type for format determination
 * @param {string} options.gender - Gender ('mens' or 'womens')
 * @param {Object} options.teams - Team data keyed by team number
 * @param {number} options.teamCount - Number of teams
 * @param {string} [options.theme] - Summary theme ID
 * @param {string} [options.baseUrl] - Override base URL
 * @param {string} [options.meetTheme] - Meet theme ID for themed graphics
 * @returns {string} Complete URL
 */
export function buildEventSummaryURL({ mode, rotation, apparatus, virtiusSessionId, compType, gender, teams, teamCount, theme, compId, baseUrl, meetTheme }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  // Competition ID is required for event summary (needs live Virtius data)
  if (compId) params.set('comp', compId);
  params.set('graphic', 'event-summary');

  // Use virtiusSessionId to match output.html renderer expectation
  if (virtiusSessionId) params.set('virtiusSessionId', virtiusSessionId);
  if (theme) params.set('summaryTheme', theme);
  if (gender) params.set('summaryGender', gender);

  // Determine format based on competition type
  const isDual = compType?.includes('dual');

  if (mode === 'rotation') {
    params.set('summaryMode', 'rotation');
    params.set('summaryRotation', rotation);
    params.set('summaryFormat', isDual ? 'alternating' : 'rotation');
  } else if (mode === 'apparatus') {
    params.set('summaryMode', 'apparatus');
    params.set('summaryApparatus', apparatus);
    params.set('summaryFormat', 'head-to-head');
  }

  params.set('summaryNumTeams', teamCount);

  // Add team data
  for (let i = 1; i <= teamCount; i++) {
    const name = teams[`team${i}Name`];
    const logo = teams[`team${i}Logo`];
    if (name) params.set(`team${i}Name`, name);
    if (logo) params.set(`team${i}Logo`, logo);
  }

  if (meetTheme) params.set('meetTheme', meetTheme);
  return `${base}/output.html?${params.toString()}`;
}

/**
 * Generate URL for any graphic based on ID
 * @param {string} graphicId - Graphic identifier
 * @param {Object} formData - Form data with team info, event details, etc.
 * @param {number} teamCount - Number of teams in competition
 * @param {string} [baseUrl] - Override base URL
 * @param {Object} [options] - Additional options (compType, virtiusSessionId, meetTheme, etc.)
 * @returns {string} Complete URL or empty string if unknown graphic
 */
export function generateGraphicURL(graphicId, formData, teamCount, baseUrl, options = {}) {
  const base = baseUrl || getBaseURL();
  const { compType, virtiusSessionId, virtiusSessionId2, compId, summaryTheme, sponsors, meetTheme, meetThemeLogo, lockedIndex, showBounds, showGuides, cycleDuration, excluded } = options;

  // Helper to get team logo with placeholder fallback
  const getTeamLogo = (teamNum) => {
    const colors = ['00274C/FFCB05', 'BB0000/FFFFFF', '003087/FFFFFF', '228B22/FFFFFF', '800080/FFFFFF', 'FF8C00/FFFFFF'];
    return formData[`team${teamNum}Logo`] || `https://via.placeholder.com/200/${colors[(teamNum - 1) % colors.length]}?text=T${teamNum}`;
  };

  // Helper to get all team data
  const getTeamsData = () => {
    const teams = { ...formData };
    for (let i = 1; i <= teamCount; i++) {
      if (!teams[`team${i}Logo`]) {
        teams[`team${i}Logo`] = getTeamLogo(i);
      }
    }
    return teams;
  };

  // Handle dynamic team stats/coaches graphics
  const teamStatsMatch = graphicId.match(/^team(\d+)-stats$/);
  if (teamStatsMatch) {
    const num = parseInt(teamStatsMatch[1]);
    return buildTeamStatsURL({
      teamName: formData[`team${num}Name`],
      logo: getTeamLogo(num),
      statLabel: options.statLabel,
      statValue: options.statValue,
      ave: formData[`team${num}Ave`],
      high: formData[`team${num}High`],
      baseUrl: base,
      meetTheme,
    });
  }

  const teamCoachesMatch = graphicId.match(/^team(\d+)-coaches$/);
  if (teamCoachesMatch) {
    const num = parseInt(teamCoachesMatch[1]);
    return buildCoachesURL({
      logo: getTeamLogo(num),
      coaches: formData[`team${num}Coaches`],
      baseUrl: base,
      meetTheme,
    });
  }

  const teamRosterMatch = graphicId.match(/^team(\d+)-roster$/);
  if (teamRosterMatch) {
    const num = parseInt(teamRosterMatch[1]);
    return buildTeamRosterURL({
      compId,
      teamSlot: num,
      teamName: formData[`team${num}Name`],
      logo: getTeamLogo(num),
      baseUrl: base,
      meetTheme,
    });
  }

  // Handle Who to Watch lower-third graphics (team1-who-to-watch, team2-who-to-watch, etc.)
  const whoToWatchMatch = graphicId.match(/^team(\d+)-who-to-watch$/);
  if (whoToWatchMatch) {
    const num = parseInt(whoToWatchMatch[1]);
    const params = new URLSearchParams();
    if (formData.athleteName) params.set('athleteName', formData.athleteName);
    const logo = formData.logo || getTeamLogo(num);
    if (logo) params.set('logo', logo);
    if (formData.subtitle || formData.teamName) params.set('subtitle', formData.subtitle || formData.teamName || '');
    if (formData.statLabel) params.set('statLabel', formData.statLabel);
    if (formData.statValue) params.set('statValue', formData.statValue);
    if (formData.headshot) params.set('headshot', formData.headshot);
    if (meetTheme) params.set('meetTheme', meetTheme);
    return `${base}/overlays/who-to-watch.html?${params.toString()}`;
  }

  // Handle Who to Watch Title Card graphics (team1-who-to-watch-title, team2-who-to-watch-title, etc.)
  const whoToWatchTitleMatch = graphicId.match(/^team(\d+)-who-to-watch-title$/);
  if (whoToWatchTitleMatch) {
    const num = parseInt(whoToWatchTitleMatch[1]);
    const params = new URLSearchParams();
    if (formData.athleteName) params.set('athleteName', formData.athleteName);
    if (formData.teamName) params.set('teamName', formData.teamName);
    const logo = formData.logo || getTeamLogo(num);
    if (logo) params.set('logo', logo);
    if (formData.headline) params.set('headline', formData.headline);
    if (formData.body) params.set('body', formData.body);
    if (formData.imageUrl) params.set('imageUrl', formData.imageUrl);
    if (formData.imageMode) params.set('imageMode', formData.imageMode);
    if (formData.badge !== undefined && formData.badge !== 'WHO TO WATCH') params.set('badge', formData.badge);
    // Adjustment params — only include if non-default
    if (formData.nameFontSize && formData.nameFontSize !== 64) params.set('nameFontSize', formData.nameFontSize);
    if (formData.bodyFontSize && formData.bodyFontSize !== 30) params.set('bodyFontSize', formData.bodyFontSize);
    if (formData.headlineFontSize && formData.headlineFontSize !== 28) params.set('headlineFontSize', formData.headlineFontSize);
    if (formData.textOffsetY && formData.textOffsetY !== 0) params.set('textOffsetY', formData.textOffsetY);
    if (formData.imageScale && formData.imageScale !== 100) params.set('imageScale', formData.imageScale);
    if (formData.imageOffsetX && formData.imageOffsetX !== 0) params.set('imageOffsetX', formData.imageOffsetX);
    if (formData.imageOffsetY && formData.imageOffsetY !== 0) params.set('imageOffsetY', formData.imageOffsetY);
    if (meetTheme) params.set('meetTheme', meetTheme);
    return `${base}/overlays/who-to-watch-title.html?${params.toString()}`;
  }

  // Handle frame overlay graphics
  const frameMatch = graphicId.match(/^frame-(quad|tri-center|tri-wide-top|tri-wide|team-header|single|dual)$/);
  if (frameMatch) {
    return buildFrameOverlayURL({
      frameType: frameMatch[1],
      teams: getTeamsData(),
      teamCount,
      baseUrl: base,
      meetTheme,
    });
  }

  // Handle combined AA leaderboard (two session IDs)
  if (graphicId === 'combined-aa-leaderboard') {
    const gender = compType?.startsWith('mens') ? 'mens' : 'womens';
    return buildCombinedAALeaderboardURL({
      virtiusSessionId,
      virtiusSessionId2,
      gender,
      teams: getTeamsData(),
      teamCount,
      baseUrl: base,
      meetTheme,
    });
  }

  // Handle leaderboard graphics
  const leaderboardMatch = graphicId.match(/^leaderboard-(.+)$/);
  if (leaderboardMatch) {
    // eventCode is already the short code (fx, ph, sr, vt, pb, hb, ub, bb, aa)
    const eventCode = leaderboardMatch[1];
    const gender = compType?.startsWith('mens') ? 'mens' : 'womens';
    return buildLeaderboardURL({
      event: eventCode, // Pass short code directly - renderer expects fx, ph, etc.
      virtiusSessionId,
      gender,
      teams: getTeamsData(),
      teamCount,
      compId,
      baseUrl: base,
      meetTheme,
    });
  }

  // Handle event summary graphics
  const summaryRotationMatch = graphicId.match(/^summary-r(\d+)$/);
  if (summaryRotationMatch) {
    const rotation = parseInt(summaryRotationMatch[1]);
    const gender = compType?.startsWith('mens') ? 'mens' : 'womens';
    return buildEventSummaryURL({
      mode: 'rotation',
      rotation,
      virtiusSessionId,
      compType,
      gender,
      teams: getTeamsData(),
      teamCount,
      theme: summaryTheme,
      compId,
      baseUrl: base,
      meetTheme,
    });
  }

  const summaryApparatusMatch = graphicId.match(/^summary-(fx|ph|sr|vt|pb|hb|ub|bb)$/);
  if (summaryApparatusMatch) {
    const apparatus = summaryApparatusMatch[1];
    const gender = compType?.startsWith('mens') ? 'mens' : 'womens';
    return buildEventSummaryURL({
      mode: 'apparatus',
      apparatus,
      virtiusSessionId,
      compType,
      gender,
      teams: getTeamsData(),
      teamCount,
      theme: summaryTheme,
      compId,
      baseUrl: base,
      meetTheme,
    });
  }

  // Handle standard graphics
  switch (graphicId) {
    case 'logos':
      return buildLogosURL({
        teams: {
          ...formData,
          // Ensure all team logos have values (with fallbacks)
          ...Object.fromEntries(
            Array.from({ length: teamCount }, (_, i) => [
              `team${i + 1}Logo`,
              getTeamLogo(i + 1)
            ])
          ),
        },
        teamCount,
        baseUrl: base,
        meetTheme,
      });

    case 'event-bar':
      return buildEventBarURL({
        team1Logo: getTeamLogo(1),
        venue: formData.venue,
        eventName: formData.eventName,
        location: formData.location,
        baseUrl: base,
        meetTheme,
      });

    case 'warm-up':
      // Warm-up graphic uses warm-up.html
      const warmUpParams = new URLSearchParams();
      warmUpParams.set('title', 'WARM UP');
      warmUpParams.set('team1Logo', getTeamLogo(1));
      if (formData.venue) warmUpParams.set('venue', formData.venue);
      if (meetTheme) warmUpParams.set('meetTheme', meetTheme);
      return `${base}/overlays/warm-up.html?${warmUpParams.toString()}`;

    case 'replay':
      // Replay graphic - simple instant replay indicator
      const replayParams = new URLSearchParams();
      replayParams.set('team1Logo', getTeamLogo(1));
      if (meetTheme) replayParams.set('meetTheme', meetTheme);
      return `${base}/overlays/replay.html?${replayParams.toString()}`;

    case 'hosts':
      return buildHostsURL({
        hosts: formData.hosts,
        baseUrl: base,
        meetTheme,
      });

    case 'floor':
    case 'pommel':
    case 'rings':
    case 'vault':
    case 'pbars':
    case 'hbar':
    case 'ubars':
    case 'beam':
    case 'allaround':
    case 'final':
    case 'order':
    case 'lineups':
    case 'summary':
      return buildEventFrameURL({
        eventId: graphicId,
        logo: getTeamLogo(1),
        baseUrl: base,
        meetTheme,
      });

    case 'starting':
      return buildStreamURL({
        type: 'starting',
        logo: teamCount >= 1 ? getTeamLogo(1) : undefined,
        logo2: teamCount >= 2 ? getTeamLogo(2) : undefined,
        logo3: teamCount >= 3 ? getTeamLogo(3) : undefined,
        logo4: teamCount >= 4 ? getTeamLogo(4) : undefined,
        logo5: teamCount >= 5 ? getTeamLogo(5) : undefined,
        logo6: teamCount >= 6 ? getTeamLogo(6) : undefined,
        logo7: teamCount >= 7 ? getTeamLogo(7) : undefined,
        eventName: formData.eventName,
        meetDate: formData.meetDate,
        baseUrl: base,
        meetTheme,
      });

    case 'thanks':
      return buildStreamURL({
        type: 'thanks',
        logo: teamCount >= 1 ? getTeamLogo(1) : undefined,
        logo2: teamCount >= 2 ? getTeamLogo(2) : undefined,
        logo3: teamCount >= 3 ? getTeamLogo(3) : undefined,
        logo4: teamCount >= 4 ? getTeamLogo(4) : undefined,
        logo5: teamCount >= 5 ? getTeamLogo(5) : undefined,
        logo6: teamCount >= 6 ? getTeamLogo(6) : undefined,
        logo7: teamCount >= 7 ? getTeamLogo(7) : undefined,
        eventName: formData.eventName,
        meetDate: formData.meetDate,
        baseUrl: base,
        meetTheme,
      });

    case 'sponsors-thanks':
      return buildSponsorsThanksURL({
        logo: getTeamLogo(1),
        sponsorsJson: sponsors || '[]',
        baseUrl: base,
        meetTheme,
      });

    case 'sponsors-cycle':
      return buildSponsorsCycleURL({
        logo: getTeamLogo(1),
        sponsorsJson: sponsors || '[]',
        baseUrl: base,
        meetTheme,
        lockedIndex,
        showBounds,
        showGuides,
        cycleDuration,
        excluded,
      });

    case 'sponsors-bug':
      return buildSponsorsBugURL({
        sponsorsJson: sponsors || '[]',
        baseUrl: base,
        meetTheme,
      });

    case 'rotation-slate':
      // Rotation Slate - full screen with team logo, meet name, rotation number
      const rotationSlateParams = new URLSearchParams();
      rotationSlateParams.set('logo', (meetTheme && meetThemeLogo) ? meetThemeLogo : getTeamLogo(1));
      rotationSlateParams.set('meetName', formData.eventName || 'GYMNASTICS');
      rotationSlateParams.set('rotation', options.rotation || '1');
      if (options.layout && options.layout !== 'classic') rotationSlateParams.set('layout', options.layout);
      if (meetTheme) rotationSlateParams.set('meetTheme', meetTheme);
      return `${base}/overlays/rotation-slate.html?${rotationSlateParams.toString()}`;

    case 'rotation-slate-auto': {
      // Auto-updating Rotation Slate - reads current rotation from Virtius API
      const autoSlateParams = new URLSearchParams();
      if (options.compId) autoSlateParams.set('compId', options.compId);
      if (options.layout && options.layout !== 'classic') autoSlateParams.set('layout', options.layout);
      if (meetTheme) autoSlateParams.set('meetTheme', meetTheme);
      return `${base}/overlays/rotation-slate-auto.html?${autoSlateParams.toString()}`;
    }

    case 'event-calendar': {
      const calendarParams = new URLSearchParams();
      const calendarLogo = (meetTheme && meetThemeLogo) ? meetThemeLogo : formData.team1Logo || '';
      if (calendarLogo) calendarParams.set('logo', calendarLogo);
      if (formData.calendarTitle) calendarParams.set('title', formData.calendarTitle);
      if (formData.calendarEvents) calendarParams.set('events', formData.calendarEvents);
      if (formData.calendarColumns && formData.calendarColumns !== 'auto') calendarParams.set('columns', formData.calendarColumns);
      if (meetTheme) calendarParams.set('meetTheme', meetTheme);
      return `${base}/overlays/event-calendar.html?${calendarParams.toString()}`;
    }

    default: {
      // Fallback: try building URL from registry schema for overlay graphics
      const registryUrl = buildGraphicUrlFromRegistry(graphicId, formData, teamCount, {
        baseUrl: base,
        meetTheme,
      });
      if (registryUrl) return registryUrl;
      return '';
    }
  }
}

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  // Try modern clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }

  // Fallback for older browsers or non-secure contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}

/**
 * Get the file path for a graphic
 * @param {string} graphicId - Graphic identifier
 * @returns {string} HTML file path
 */
export function getGraphicPath(graphicId) {
  // Check registry first
  const graphic = getGraphicById(graphicId);
  if (graphic?.file) {
    return graphic.file;
  }
  // Fallback to old mapping
  return GRAPHIC_PATHS[graphicId] || `${graphicId}.html`;
}

/**
 * Build URL from registry schema (for simple overlay graphics)
 * This function uses the registry schema to build URLs for graphics that follow
 * the standard pattern: overlays/{file}?{params}
 *
 * Complex graphics (leaderboards, event-summary, etc.) still use their dedicated
 * builder functions as they have special logic.
 *
 * @param {string} graphicId - Graphic ID
 * @param {Object} formData - Form data with values
 * @param {number} teamCount - Number of teams
 * @param {Object} [options] - Additional options (including meetTheme)
 * @returns {string|null} URL or null if graphic not found or not supported
 */
export function buildGraphicUrlFromRegistry(graphicId, formData, teamCount, options = {}) {
  const graphic = getGraphicById(graphicId);
  if (!graphic) return null;

  const base = options.baseUrl || getBaseURL();
  const { meetTheme } = options;

  // Only handle simple overlay graphics for now
  // Complex graphics (leaderboards, event-summary) use dedicated builders
  if (graphic.renderer !== 'overlay') return null;

  const params = new URLSearchParams();

  // Build params from schema
  if (graphic.params) {
    for (const [paramKey, paramSchema] of Object.entries(graphic.params)) {
      let value = null;

      // Check formData first (works for competition-sourced AND user-provided params)
      if (paramKey in formData && formData[paramKey]) {
        value = formData[paramKey];
      } else if (paramSchema.source === 'competition') {
        // Auto-fill from formData based on param name
        if (paramKey in formData) {
          value = formData[paramKey];
        }
      } else if (paramSchema.default !== undefined) {
        // Use default value
        value = paramSchema.default;
      }

      if (value !== null && value !== undefined && value !== '') {
        params.set(paramKey, value);
      }
    }
  }

  // Add meetTheme if present
  if (meetTheme) {
    params.set('meetTheme', meetTheme);
  }

  const queryString = params.toString();
  const path = graphic.file.endsWith('.html')
    ? `overlays/${graphic.file}`
    : `overlays/${graphic.file}.html`;

  return queryString ? `${base}/${path}?${queryString}` : `${base}/${path}`;
}

/**
 * Check if a graphic is transparent based on registry
 * Re-exports the registry function for backwards compatibility
 */
export { registryIsTransparent as isTransparentGraphicFromRegistry };

export default {
  getBaseURL,
  buildLogosURL,
  buildEventBarURL,
  buildHostsURL,
  buildTeamStatsURL,
  buildCoachesURL,
  buildTeamRosterURL,
  buildEventFrameURL,
  buildStreamURL,
  buildSponsorsThanksURL,
  buildSponsorsCycleURL,
  buildSponsorsBugURL,
  buildFrameOverlayURL,
  buildLeaderboardURL,
  buildEventSummaryURL,
  generateGraphicURL,
  buildGraphicUrlFromRegistry,
  copyToClipboard,
  getGraphicPath,
};
