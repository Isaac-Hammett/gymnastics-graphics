// Graphics button definitions shared across the app
// NOTE: This file now derives from graphicsRegistry.js as the single source of truth

import {
  GRAPHICS,
  getAllGraphics,
  getGraphicsByCategory,
  getGraphicsForCompetition,
  isTransparentGraphic as registryIsTransparentGraphic,
} from './graphicsRegistry';

/**
 * Generate pre-meet buttons dynamically based on team count
 * @param {number} teamCount - Number of teams in the competition
 * @param {Object} teamNames - Optional object mapping team numbers to names (e.g., { 1: 'Michigan', 2: 'Ohio State' })
 * @returns {Array} Array of button definitions
 */
export function getPreMeetButtons(teamCount = 2, teamNames = {}) {
  // Build teamNames object from teamCount if not provided
  const names = { ...teamNames };
  for (let i = 1; i <= teamCount; i++) {
    if (!names[i]) names[i] = `Team ${i}`;
  }

  // Get pre-meet graphics from registry
  const preMeetGraphics = getGraphicsForCompetition(null, names, 'pre-meet');

  // Map to button format expected by existing code
  let buttonNum = 1;
  return preMeetGraphics.map(g => ({
    id: g.id,
    label: g.label,
    number: buttonNum++,
    ...(g.team ? { team: g.team } : {}),
  }));
}

// Static pre-meet buttons (for backwards compatibility, defaults to 2 teams)
export const graphicButtons = {
  preMeet: getPreMeetButtons(2),
  frameOverlays: getGraphicsByCategory('frame-overlays').map((g, i) => ({
    id: g.id,
    label: g.label,
    number: 21 + i,
  })),
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
  stream: getGraphicsByCategory('stream').map((g, i) => ({
    id: g.id,
    label: g.label,
    number: 19 + i,
  })),
  inMeet: getGraphicsByCategory('in-meet').map((g, i) => ({
    id: g.id,
    label: g.label,
    number: 27 + i,
  })),
};

// Derive graphicNames from registry
export const graphicNames = Object.fromEntries([
  ['clear', 'None'],
  ...getAllGraphics().map(g => [g.id, g.label]),
  // Add team-specific entries for backwards compatibility
  ...Array.from({ length: 6 }, (_, i) => [
    [`team${i + 1}-stats`, `Team ${i + 1} Stats`],
    [`team${i + 1}-coaches`, `Team ${i + 1} Coaches`],
  ]).flat(),
]);

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

// Delegate to registry for transparent graphic check
export function isTransparentGraphic(graphicId) {
  return registryIsTransparentGraphic(graphicId);
}

// Keep transparentGraphics array for backwards compatibility (derived from registry)
export const transparentGraphics = getAllGraphics()
  .filter(g => g.transparent)
  .map(g => g.id)
  .concat(
    // Add team-specific graphics
    Array.from({ length: 6 }, (_, i) => [`team${i + 1}-stats`, `team${i + 1}-coaches`]).flat()
  );

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

  // Get leaderboard graphics from registry filtered by gender
  const leaderboards = getGraphicsByCategory('leaderboards')
    .filter(g => g.gender === 'both' || (isMens && g.gender === 'mens') || (!isMens && g.gender === 'womens'))
    .map(g => ({
      id: g.id,
      label: g.label,
      event: g.params?.leaderboardEvent?.default || g.id.replace('leaderboard-', ''),
    }));

  return leaderboards;
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

  // Get apparatus summary graphics from registry filtered by gender
  const apparatusSummaries = getGraphicsByCategory('event-summary')
    .filter(g => g.id.startsWith('summary-') && !g.id.match(/^summary-r\d+$/))
    .filter(g => g.gender === 'both' || (isMens && g.gender === 'mens') || (!isMens && g.gender === 'womens'))
    .map(g => ({
      id: g.id,
      label: g.label,
      apparatus: g.params?.summaryApparatus?.default || g.id.replace('summary-', ''),
    }));

  return apparatusSummaries;
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
