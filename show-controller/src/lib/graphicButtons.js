// Graphics button definitions shared across the app

/**
 * Generate pre-meet buttons dynamically based on team count
 * @param {number} teamCount - Number of teams in the competition
 * @param {Object} teamNames - Optional object mapping team numbers to names (e.g., { 1: 'Michigan', 2: 'Ohio State' })
 * @returns {Array} Array of button definitions
 */
export function getPreMeetButtons(teamCount = 2, teamNames = {}) {
  const buttons = [
    { id: 'logos', label: 'Team Logos', number: 1 },
    { id: 'event-bar', label: 'Event Info', number: 2 },
    { id: 'warm-up', label: 'Warm Up', number: 3 },
    { id: 'hosts', label: 'Hosts', number: 4 },
  ];

  // Add team stats and coaches for each team
  let buttonNum = 5;
  for (let i = 1; i <= teamCount; i++) {
    const teamLabel = teamNames[i] || `Team ${i}`;
    buttons.push({ id: `team${i}-stats`, label: `${teamLabel} Stats`, number: buttonNum++, team: i });
    buttons.push({ id: `team${i}-coaches`, label: `${teamLabel} Coaches`, number: buttonNum++, team: i });
  }

  return buttons;
}

// Static pre-meet buttons (for backwards compatibility, defaults to 2 teams)
export const graphicButtons = {
  preMeet: getPreMeetButtons(2),
  frameOverlays: [
    { id: 'frame-quad', label: 'Quad View', number: 21 },
    { id: 'frame-tri-center', label: 'Tri Center', number: 22 },
    { id: 'frame-tri-wide', label: 'Tri Wide', number: 23 },
    { id: 'frame-team-header', label: 'Team Header', number: 24 },
    { id: 'frame-single', label: 'Single', number: 25 },
  ],
  mensApparatus: [
    { id: 'floor', label: 'Floor Exercise', title: 'FLOOR EXERCISE', number: 8 },
    { id: 'pommel', label: 'Pommel Horse', title: 'POMMEL HORSE', number: 9 },
    { id: 'rings', label: 'Still Rings', title: 'STILL RINGS', number: 10 },
    { id: 'vault', label: 'Vault', title: 'VAULT', number: 11 },
    { id: 'pbars', label: 'Parallel Bars', title: 'PARALLEL BARS', number: 12 },
    { id: 'hbar', label: 'High Bar', title: 'HORIZONTAL BAR', number: 13 },
    { id: 'allaround', label: 'All Around', title: 'ALL AROUND', number: 14 },
    { id: 'final', label: 'Final Scores', title: 'FINAL SCORES', number: 15 },
    { id: 'order', label: 'Comp Order', title: 'COMPETITION ORDER', number: 16 },
    { id: 'lineups', label: 'Lineups', title: 'NEXT EVENT LINEUPS', number: 17 },
    { id: 'summary', label: 'Summary', title: 'EVENT SUMMARY', number: 18 },
  ],
  womensApparatus: [
    { id: 'vault', label: 'Vault', title: 'VAULT', number: 8 },
    { id: 'ubars', label: 'Uneven Bars', title: 'UNEVEN BARS', number: 9 },
    { id: 'beam', label: 'Balance Beam', title: 'BALANCE BEAM', number: 10 },
    { id: 'floor', label: 'Floor Exercise', title: 'FLOOR EXERCISE', number: 11 },
    { id: 'allaround', label: 'All Around', title: 'ALL AROUND', number: 12 },
    { id: 'final', label: 'Final Scores', title: 'FINAL SCORES', number: 13 },
    { id: 'order', label: 'Comp Order', title: 'COMPETITION ORDER', number: 14 },
    { id: 'lineups', label: 'Lineups', title: 'NEXT EVENT LINEUPS', number: 15 },
    { id: 'summary', label: 'Summary', title: 'EVENT SUMMARY', number: 16 },
  ],
  stream: [
    { id: 'stream-starting', label: 'Starting Soon', number: 19 },
    { id: 'stream-thanks', label: 'Thanks', number: 20 },
  ],
};

export const graphicNames = {
  'clear': 'None',
  'logos': 'Team Logos',
  'event-bar': 'Event Info',
  'warm-up': 'Warm Up',
  'hosts': 'Hosts',
  'team1-stats': 'Team 1 Stats',
  'team1-coaches': 'Team 1 Coaches',
  'team2-stats': 'Team 2 Stats',
  'team2-coaches': 'Team 2 Coaches',
  'floor': 'Floor Exercise',
  'pommel': 'Pommel Horse',
  'rings': 'Still Rings',
  'vault': 'Vault',
  'pbars': 'Parallel Bars',
  'hbar': 'High Bar',
  'ubars': 'Uneven Bars',
  'beam': 'Balance Beam',
  'allaround': 'All Around',
  'final': 'Final Scores',
  'order': 'Competition Order',
  'lineups': 'Lineups',
  'summary': 'Event Summary',
  'stream-starting': 'Stream Starting',
  'stream-thanks': 'Thanks for Watching',
  'event-frame': 'Event Frame',
  'frame-quad': 'Quad View',
  'frame-tri-center': 'Tri Center',
  'frame-tri-wide': 'Tri Wide',
  'frame-team-header': 'Team Header',
  'frame-single': 'Single Frame'
};

export const teamCounts = {
  'mens-dual': 2,
  'womens-dual': 2,
  'mens-tri': 3,
  'womens-tri': 3,
  'mens-quad': 4,
  'womens-quad': 4,
  'mens-5': 5,
  'mens-6': 6,
};

export const competitionTypes = [
  { value: 'mens-dual', label: "Men's Dual Meet (2 teams)" },
  { value: 'mens-tri', label: "Men's Tri Meet (3 teams)" },
  { value: 'mens-quad', label: "Men's Quad Meet (4 teams)" },
  { value: 'mens-5', label: "Men's 5-Team Meet" },
  { value: 'mens-6', label: "Men's 6-Team Meet" },
  { value: 'womens-dual', label: "Women's Dual Meet (2 teams)" },
  { value: 'womens-tri', label: "Women's Tri Meet (3 teams)" },
  { value: 'womens-quad', label: "Women's Quad Meet (4 teams)" },
];

export const typeLabels = {
  'mens-dual': "Men's Dual",
  'mens-tri': "Men's Tri",
  'mens-quad': "Men's Quad",
  'mens-5': "Men's 5-Team",
  'mens-6': "Men's 6-Team",
  'womens-dual': "Women's Dual",
  'womens-tri': "Women's Tri",
  'womens-quad': "Women's Quad",
};

export const eventFrameIds = ['floor', 'pommel', 'rings', 'vault', 'pbars', 'hbar', 'ubars', 'beam', 'allaround', 'final', 'order', 'lineups', 'summary'];

// Base transparent graphics (without team-specific ones)
const baseTransparentGraphics = ['event-bar', 'warm-up', 'hosts', ...eventFrameIds];

// Frame overlays are transparent (used as OBS overlays)
const frameOverlayIds = ['frame-quad', 'frame-tri-center', 'frame-tri-wide', 'frame-team-header', 'frame-single'];

// Generate transparent graphics list for all possible teams (up to 6)
const teamTransparentGraphics = [];
for (let i = 1; i <= 6; i++) {
  teamTransparentGraphics.push(`team${i}-stats`, `team${i}-coaches`);
}

export const transparentGraphics = [...baseTransparentGraphics, ...frameOverlayIds, ...teamTransparentGraphics];

/**
 * Check if a graphic should have transparent background
 * @param {string} graphicId - The graphic ID to check
 * @returns {boolean} True if the graphic should be transparent
 */
export function isTransparentGraphic(graphicId) {
  return transparentGraphics.includes(graphicId) ||
         /^team\d+-(stats|coaches)$/.test(graphicId) ||
         /^frame-/.test(graphicId);
}

export function getApparatusButtons(compType) {
  const isMens = compType?.startsWith('mens');
  return isMens ? graphicButtons.mensApparatus : graphicButtons.womensApparatus;
}

/**
 * Get leaderboard buttons for a competition type (gender-aware)
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @returns {Array} Array of leaderboard button definitions
 */
export function getLeaderboardButtons(compType) {
  const isMens = compType?.startsWith('mens');

  const mensLeaderboards = [
    { id: 'leaderboard-fx', label: 'FX Leaders', event: 'floor' },
    { id: 'leaderboard-ph', label: 'PH Leaders', event: 'pommel' },
    { id: 'leaderboard-sr', label: 'SR Leaders', event: 'rings' },
    { id: 'leaderboard-vt', label: 'VT Leaders', event: 'vault' },
    { id: 'leaderboard-pb', label: 'PB Leaders', event: 'pBars' },
    { id: 'leaderboard-hb', label: 'HB Leaders', event: 'hBar' },
  ];

  const womensLeaderboards = [
    { id: 'leaderboard-vt', label: 'VT Leaders', event: 'vault' },
    { id: 'leaderboard-ub', label: 'UB Leaders', event: 'bars' },
    { id: 'leaderboard-bb', label: 'BB Leaders', event: 'beam' },
    { id: 'leaderboard-fx', label: 'FX Leaders', event: 'floor' },
  ];

  const eventLeaderboards = isMens ? mensLeaderboards : womensLeaderboards;

  // Add AA Leaders (always available)
  return [
    ...eventLeaderboards,
    { id: 'leaderboard-aa', label: 'AA Leaders', event: 'all-around' },
  ];
}

/**
 * Get event summary rotation buttons for a competition type
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @returns {Array} Array of rotation button definitions (R1-R4 for women, R1-R6 for men)
 */
export function getEventSummaryRotationButtons(compType) {
  const rotationCount = getRotationCount(compType);
  const buttons = [];

  for (let i = 1; i <= rotationCount; i++) {
    buttons.push({
      id: `summary-r${i}`,
      label: `R${i}`,
      rotation: i,
    });
  }

  return buttons;
}

/**
 * Get event summary apparatus buttons for a competition type (gender-aware)
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @returns {Array} Array of apparatus button definitions
 */
export function getEventSummaryApparatusButtons(compType) {
  const isMens = compType?.startsWith('mens');

  const mensApparatus = [
    { id: 'summary-fx', label: 'FX', apparatus: 'fx' },
    { id: 'summary-ph', label: 'PH', apparatus: 'ph' },
    { id: 'summary-sr', label: 'SR', apparatus: 'sr' },
    { id: 'summary-vt', label: 'VT', apparatus: 'vt' },
    { id: 'summary-pb', label: 'PB', apparatus: 'pb' },
    { id: 'summary-hb', label: 'HB', apparatus: 'hb' },
  ];

  const womensApparatus = [
    { id: 'summary-vt', label: 'VT', apparatus: 'vt' },
    { id: 'summary-ub', label: 'UB', apparatus: 'ub' },
    { id: 'summary-bb', label: 'BB', apparatus: 'bb' },
    { id: 'summary-fx', label: 'FX', apparatus: 'fx' },
  ];

  return isMens ? mensApparatus : womensApparatus;
}

export function isMensCompetition(compType) {
  return compType?.startsWith('mens');
}

/**
 * Get the number of rotations for a competition type
 * Men's has 6 rotations, Women's has 4 rotations
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @returns {number} Number of rotations
 */
export function getRotationCount(compType) {
  const isMens = compType?.startsWith('mens');
  return isMens ? 6 : 4;
}

/**
 * Get the number of events for a competition type
 * Alias for getRotationCount for semantic clarity
 * @param {string} compType
 * @returns {number}
 */
export function getEventCount(compType) {
  return getRotationCount(compType);
}
