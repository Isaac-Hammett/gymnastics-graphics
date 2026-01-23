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
 * Build URL for Frame Overlay graphics
 * @param {Object} options
 * @param {string} options.frameType - Frame type (quad, tri-center, tri-wide, team-header, single)
 * @param {Object} options.teams - Team data keyed by team number
 * @param {number} options.teamCount - Number of teams
 * @param {string} [options.baseUrl] - Override base URL
 * @returns {string} Complete URL
 */
export function buildFrameOverlayURL({ frameType, teams, teamCount, baseUrl }) {
  const base = baseUrl || getBaseURL();
  const params = new URLSearchParams();

  // Add team logos for frame overlays
  for (let i = 1; i <= teamCount; i++) {
    const logo = teams[`team${i}Logo`];
    if (logo) {
      params.set(`team${i}Logo`, logo);
    }
  }

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
 * @returns {string} Complete URL
 */
export function buildLeaderboardURL({ event, virtiusSessionId, gender, teams, teamCount, compId, baseUrl }) {
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

  return `${base}/output.html?graphic=virtius-leaderboard&${params.toString()}`;
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
 * @returns {string} Complete URL
 */
export function buildEventSummaryURL({ mode, rotation, apparatus, virtiusSessionId, compType, gender, teams, teamCount, theme, compId, baseUrl }) {
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

  return `${base}/output.html?${params.toString()}`;
}

/**
 * Generate URL for any graphic based on ID
 * @param {string} graphicId - Graphic identifier
 * @param {Object} formData - Form data with team info, event details, etc.
 * @param {number} teamCount - Number of teams in competition
 * @param {string} [baseUrl] - Override base URL
 * @param {Object} [options] - Additional options (compType, virtiusSessionId, etc.)
 * @returns {string} Complete URL or empty string if unknown graphic
 */
export function generateGraphicURL(graphicId, formData, teamCount, baseUrl, options = {}) {
  const base = baseUrl || getBaseURL();
  const { compType, virtiusSessionId, compId, summaryTheme } = options;

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

  // Handle frame overlay graphics
  const frameMatch = graphicId.match(/^frame-(quad|tri-center|tri-wide|team-header|single|dual)$/);
  if (frameMatch) {
    return buildFrameOverlayURL({
      frameType: frameMatch[1],
      teams: getTeamsData(),
      teamCount,
      baseUrl: base,
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

    case 'warm-up':
      // Warm-up graphic uses event-bar.html with warm-up title
      const warmUpParams = new URLSearchParams();
      warmUpParams.set('title', 'WARM UP');
      warmUpParams.set('team1Logo', getTeamLogo(1));
      if (formData.venue) warmUpParams.set('venue', formData.venue);
      return `${base}/overlays/warm-up.html?${warmUpParams.toString()}`;

    case 'replay':
      // Replay graphic - simple instant replay indicator
      const replayParams = new URLSearchParams();
      replayParams.set('team1Logo', getTeamLogo(1));
      return `${base}/overlays/replay.html?${replayParams.toString()}`;

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
 * @param {Object} [options] - Additional options
 * @returns {string|null} URL or null if graphic not found or not supported
 */
export function buildGraphicUrlFromRegistry(graphicId, formData, teamCount, options = {}) {
  const graphic = getGraphicById(graphicId);
  if (!graphic) return null;

  const base = options.baseUrl || getBaseURL();

  // Only handle simple overlay graphics for now
  // Complex graphics (leaderboards, event-summary) use dedicated builders
  if (graphic.renderer !== 'overlay') return null;

  const params = new URLSearchParams();

  // Build params from schema
  if (graphic.params) {
    for (const [paramKey, paramSchema] of Object.entries(graphic.params)) {
      let value = null;

      if (paramSchema.source === 'competition') {
        // Auto-fill from formData based on param name
        // Handle team-specific params like team1Logo
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
  buildEventFrameURL,
  buildStreamURL,
  buildFrameOverlayURL,
  buildLeaderboardURL,
  buildEventSummaryURL,
  generateGraphicURL,
  buildGraphicUrlFromRegistry,
  copyToClipboard,
  getGraphicPath,
};
