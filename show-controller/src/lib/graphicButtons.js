// Graphics button definitions shared across the app

export const graphicButtons = {
  preMeet: [
    { id: 'logos', label: 'Team Logos', number: 1 },
    { id: 'event-bar', label: 'Event Info', number: 2 },
    { id: 'warm-up', label: 'Warm Up', number: 3 },
    { id: 'hosts', label: 'Hosts', number: 4 },
    { id: 'team1-stats', label: 'Team 1 Stats', number: 5 },
    { id: 'team1-coaches', label: 'Team 1 Coaches', number: 6 },
    { id: 'team2-stats', label: 'Team 2 Stats', number: 7 },
    { id: 'team2-coaches', label: 'Team 2 Coaches', number: 8 },
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
  'event-frame': 'Event Frame'
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

export const transparentGraphics = ['event-bar', 'warm-up', 'hosts', 'team1-stats', 'team1-coaches', 'team2-stats', 'team2-coaches', ...eventFrameIds];

export function getApparatusButtons(compType) {
  const isMens = compType?.startsWith('mens');
  return isMens ? graphicButtons.mensApparatus : graphicButtons.womensApparatus;
}

export function isMensCompetition(compType) {
  return compType?.startsWith('mens');
}
