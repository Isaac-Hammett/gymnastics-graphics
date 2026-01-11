/**
 * URL Builder for Virtius Graphics Engine
 * Generates properly formatted URLs for all graphics overlays
 *
 * Production: https://virtiusgraphicsenginev001.netlify.app
 * Local: Uses window.location.origin
 */

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
  allaround: 'ALL AROUND',
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
 * @returns {string} Complete URL
 */
export function buildLogosURL({ teams, teamCount, baseUrl }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  for (let i = 1; i <= teamCount; i++) {
    const logo = teams[`team${i}Logo`];
    if (logo) {
      params.set(`team${i}Logo`, logo);
    }
  }

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
 * @returns {string} Complete URL
 */
export function buildEventBarURL({ team1Logo, venue, eventName, location, baseUrl }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (team1Logo) params.set('team1Logo', team1Logo);
  if (venue) params.set('venue', venue);
  if (eventName) params.set('eventName', eventName);
  if (location) params.set('location', location);

  return `${base}/overlays/event-bar.html?${params.toString()}`;
}

/**
 * Build URL for Hosts graphic
 * @param {Object} options
 * @param {string} options.hosts - Hosts (newline or pipe separated)
 * @param {string} [options.baseUrl] - Override base URL
 * @returns {string} Complete URL
 */
export function buildHostsURL({ hosts, baseUrl }) {
  const base = baseUrl || getBaseURL();
  // Convert newlines to pipes for URL
  const hostsFormatted = hosts?.split('\n').join('|') || '';
  return `${base}/overlays/hosts.html?hosts=${encode(hostsFormatted)}`;
}

/**
 * Build URL for Team Stats graphic
 * @param {Object} options
 * @param {string} options.teamName - Team name
 * @param {string} options.logo - Team logo URL
 * @param {string} options.ave - Average score
 * @param {string} options.high - High score
 * @param {string} [options.baseUrl] - Override base URL
 * @returns {string} Complete URL
 */
export function buildTeamStatsURL({ teamName, logo, ave, high, baseUrl }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  if (teamName) params.set('teamName', teamName);
  if (logo) params.set('logo', logo);
  if (ave) params.set('ave', ave);
  if (high) params.set('high', high);

  return `${base}/overlays/team-stats.html?${params.toString()}`;
}

/**
 * Build URL for Coaches graphic
 * @param {Object} options
 * @param {string} options.logo - Team logo URL
 * @param {string} options.coaches - Coaches (newline or pipe separated)
 * @param {string} [options.baseUrl] - Override base URL
 * @returns {string} Complete URL
 */
export function buildCoachesURL({ logo, coaches, baseUrl }) {
  const base = baseUrl || getBaseURL();
  // Convert newlines to pipes for URL
  const coachesFormatted = coaches?.split('\n').join('|') || '';
  const params = new URLSearchParams();

  if (logo) params.set('logo', logo);
  if (coachesFormatted) params.set('coaches', coachesFormatted);

  return `${base}/overlays/coaches.html?${params.toString()}`;
}

/**
 * Build URL for Event Frame graphic
 * @param {Object} options
 * @param {string} options.eventId - Event ID (floor, vault, etc.)
 * @param {string} options.logo - Team logo URL
 * @param {string} [options.baseUrl] - Override base URL
 * @returns {string} Complete URL
 */
export function buildEventFrameURL({ eventId, logo, baseUrl }) {
  const base = baseUrl || getBaseURL();
  const title = EVENT_TITLES[eventId] || eventId?.toUpperCase() || '';
  const params = new URLSearchParams();

  if (title) params.set('title', title);
  if (logo) params.set('logo', logo);

  return `${base}/overlays/event-frame.html?${params.toString()}`;
}

/**
 * Build URL for Stream graphic (Starting/Thanks)
 * @param {Object} options
 * @param {string} options.type - 'starting' or 'thanks'
 * @param {string} options.logo - Team logo URL
 * @param {string} options.eventName - Event/meet name
 * @param {string} options.meetDate - Date of the meet
 * @param {string} [options.baseUrl] - Override base URL
 * @returns {string} Complete URL
 */
export function buildStreamURL({ type, logo, eventName, meetDate, baseUrl }) {
  const base = baseUrl || getBaseURL();
  const title = type === 'starting' ? 'STREAM STARTING SOON' : 'THANKS FOR WATCHING';
  const params = new URLSearchParams();

  params.set('title', title);
  if (logo) params.set('logo', logo);
  if (eventName) params.set('eventName', eventName);
  if (meetDate) params.set('meetDate', meetDate);

  return `${base}/overlays/stream.html?${params.toString()}`;
}

/**
 * Generate URL for any graphic based on ID
 * @param {string} graphicId - Graphic identifier
 * @param {Object} formData - Form data with team info, event details, etc.
 * @param {number} teamCount - Number of teams in competition
 * @param {string} [baseUrl] - Override base URL
 * @returns {string} Complete URL or empty string if unknown graphic
 */
export function generateGraphicURL(graphicId, formData, teamCount, baseUrl) {
  const base = baseUrl || getBaseURL();

  // Helper to get team logo with placeholder fallback
  const getTeamLogo = (teamNum) => {
    const colors = ['00274C/FFCB05', 'BB0000/FFFFFF', '003087/FFFFFF', '228B22/FFFFFF', '800080/FFFFFF', 'FF8C00/FFFFFF'];
    return formData[`team${teamNum}Logo`] || `https://via.placeholder.com/200/${colors[(teamNum - 1) % colors.length]}?text=T${teamNum}`;
  };

  // Handle dynamic team stats/coaches graphics
  const teamStatsMatch = graphicId.match(/^team(\d+)-stats$/);
  if (teamStatsMatch) {
    const num = parseInt(teamStatsMatch[1]);
    return buildTeamStatsURL({
      teamName: formData[`team${num}Name`],
      logo: getTeamLogo(num),
      ave: formData[`team${num}Ave`],
      high: formData[`team${num}High`],
      baseUrl: base,
    });
  }

  const teamCoachesMatch = graphicId.match(/^team(\d+)-coaches$/);
  if (teamCoachesMatch) {
    const num = parseInt(teamCoachesMatch[1]);
    return buildCoachesURL({
      logo: getTeamLogo(num),
      coaches: formData[`team${num}Coaches`],
      baseUrl: base,
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
      });

    case 'event-bar':
      return buildEventBarURL({
        team1Logo: getTeamLogo(1),
        venue: formData.venue,
        eventName: formData.eventName,
        location: formData.location,
        baseUrl: base,
      });

    case 'hosts':
      return buildHostsURL({
        hosts: formData.hosts,
        baseUrl: base,
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
      });

    case 'starting':
      return buildStreamURL({
        type: 'starting',
        logo: getTeamLogo(1),
        eventName: formData.eventName,
        meetDate: formData.meetDate,
        baseUrl: base,
      });

    case 'thanks':
      return buildStreamURL({
        type: 'thanks',
        logo: getTeamLogo(1),
        eventName: formData.eventName,
        meetDate: formData.meetDate,
        baseUrl: base,
      });

    default:
      return '';
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
  return GRAPHIC_PATHS[graphicId] || `${graphicId}.html`;
}

export default {
  getBaseURL,
  buildLogosURL,
  buildEventBarURL,
  buildHostsURL,
  buildTeamStatsURL,
  buildCoachesURL,
  buildEventFrameURL,
  buildStreamURL,
  generateGraphicURL,
  copyToClipboard,
  getGraphicPath,
};
