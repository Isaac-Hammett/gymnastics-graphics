/**
 * Graphics Registry - Single Source of Truth
 *
 * This file contains the complete definition of all graphics in the system.
 * Each graphic is defined once with its identity, constraints, rendering info,
 * and parameter schema.
 *
 * Schema Reference:
 * {
 *   id: 'graphic-id',           // Unique identifier (must match button id)
 *   label: 'Display Name',      // Display name in UI
 *   labelTemplate: '{teamName} Display',  // Optional: dynamic substitution
 *   category: 'pre-meet',       // Category for grouping
 *   keywords: ['search', 'terms'],  // For smart recommendations
 *   gender: 'both',             // 'mens' | 'womens' | 'both'
 *   minTeams: 1,                // Optional: minimum teams required
 *   maxTeams: 6,                // Optional: maximum teams supported
 *   renderer: 'overlay',        // 'overlay' (overlays/*.html) | 'output' (output.html)
 *   file: 'filename.html',      // File path or graphic name
 *   transparent: true,          // For OBS background handling
 *   perTeam: false,             // If true, generates team1-, team2-, etc.
 *   params: {                   // Parameter schema
 *     paramName: {
 *       type: 'string',         // string | number | enum | boolean
 *       source: 'competition',  // Auto-fill from competition config
 *       required: true,
 *       options: ['a', 'b'],    // For enum type
 *       default: 'a',           // Default value
 *       dependsOn: { otherParam: 'value' },  // Conditional visibility
 *     },
 *   },
 * }
 *
 * Categories:
 * - pre-meet: Shown before competition starts
 * - in-meet: Used during competition
 * - event-frames: Event title frames
 * - frame-overlays: Camera layout frames
 * - leaderboards: Score leaderboards
 * - event-summary: Rotation/apparatus summaries
 * - stream: Stream start/end screens
 *
 * Parameter Sources:
 * - competition: Auto-filled from competition config (team logos, names, etc.)
 * - user: Requires user input (default if no source specified)
 */

/**
 * Complete registry of all graphics
 * @type {Object.<string, GraphicDefinition>}
 */
export const GRAPHICS = {
  // ============================================================
  // PRE-MEET GRAPHICS
  // ============================================================

  'logos': {
    id: 'logos',
    label: 'Team Logos',
    category: 'pre-meet',
    keywords: ['logo', 'logos', 'team', 'teams', 'intro', 'introduction'],
    gender: 'both',
    minTeams: 1,
    maxTeams: 6,
    renderer: 'overlay',
    file: 'logos.html',
    transparent: false,
    params: {
      // Dynamic: team1Logo through team6Logo based on teamCount
    },
  },

  'event-bar': {
    id: 'event-bar',
    label: 'Event Info',
    category: 'pre-meet',
    keywords: ['event', 'info', 'bar', 'venue', 'location', 'meet'],
    gender: 'both',
    renderer: 'overlay',
    file: 'event-bar.html',
    transparent: true,
    params: {
      team1Logo: { type: 'string', source: 'competition', required: true },
      venue: { type: 'string', source: 'competition' },
      eventName: { type: 'string', source: 'competition' },
      location: { type: 'string', source: 'competition' },
    },
  },

  'warm-up': {
    id: 'warm-up',
    label: 'Warm Up',
    category: 'pre-meet',
    keywords: ['warm', 'warmup', 'warm-up', 'practice'],
    gender: 'both',
    renderer: 'overlay',
    file: 'warm-up.html',
    transparent: true,
    params: {
      team1Logo: { type: 'string', source: 'competition', required: true },
      venue: { type: 'string', source: 'competition' },
    },
  },

  'hosts': {
    id: 'hosts',
    label: 'Hosts',
    category: 'pre-meet',
    keywords: ['host', 'hosts', 'commentator', 'commentators', 'announcer', 'announcers'],
    gender: 'both',
    renderer: 'overlay',
    file: 'hosts.html',
    transparent: true,
    params: {
      hosts: { type: 'string', required: true, label: 'Hosts (one per line)' },
    },
  },

  'team-stats': {
    id: 'team-stats',
    label: 'Team Stats',
    labelTemplate: '{teamName} Stats',
    category: 'pre-meet',
    keywords: ['stats', 'statistics', 'average', 'high', 'score', 'team'],
    gender: 'both',
    renderer: 'overlay',
    file: 'team-stats.html',
    transparent: true,
    perTeam: true,
    params: {
      teamSlot: { type: 'number', min: 1, max: 6, required: true, label: 'Team' },
      teamName: { type: 'string', source: 'competition', required: true },
      logo: { type: 'string', source: 'competition', required: true },
      ave: { type: 'string', label: 'Average Score' },
      high: { type: 'string', label: 'High Score' },
    },
  },

  'team-coaches': {
    id: 'team-coaches',
    label: 'Team Coaches',
    labelTemplate: '{teamName} Coaches',
    category: 'pre-meet',
    keywords: ['coach', 'coaches', 'staff', 'head coach', 'assistant'],
    gender: 'both',
    renderer: 'overlay',
    file: 'coaches.html',
    transparent: true,
    perTeam: true,
    params: {
      teamSlot: { type: 'number', min: 1, max: 6, required: true, label: 'Team' },
      logo: { type: 'string', source: 'competition', required: true },
      coaches: { type: 'string', source: 'competition', label: 'Coaches (one per line)' },
    },
  },

  // ============================================================
  // IN-MEET GRAPHICS
  // ============================================================

  'replay': {
    id: 'replay',
    label: 'Replay',
    category: 'in-meet',
    keywords: ['replay', 'instant', 'instant replay', 'review'],
    gender: 'both',
    renderer: 'overlay',
    file: 'replay.html',
    transparent: true,
    params: {
      team1Logo: { type: 'string', source: 'competition', required: true },
    },
  },

  // ============================================================
  // EVENT FRAME GRAPHICS
  // ============================================================

  'floor': {
    id: 'floor',
    label: 'Floor Exercise',
    category: 'event-frames',
    keywords: ['floor', 'fx', 'floor exercise'],
    gender: 'both',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'FLOOR EXERCISE' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'pommel': {
    id: 'pommel',
    label: 'Pommel Horse',
    category: 'event-frames',
    keywords: ['pommel', 'ph', 'pommel horse', 'horse'],
    gender: 'mens',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'POMMEL HORSE' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'rings': {
    id: 'rings',
    label: 'Still Rings',
    category: 'event-frames',
    keywords: ['rings', 'sr', 'still rings'],
    gender: 'mens',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'STILL RINGS' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'vault': {
    id: 'vault',
    label: 'Vault',
    category: 'event-frames',
    keywords: ['vault', 'vt'],
    gender: 'both',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'VAULT' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'pbars': {
    id: 'pbars',
    label: 'Parallel Bars',
    category: 'event-frames',
    keywords: ['pbars', 'pb', 'parallel bars', 'parallel'],
    gender: 'mens',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'PARALLEL BARS' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'hbar': {
    id: 'hbar',
    label: 'High Bar',
    category: 'event-frames',
    keywords: ['hbar', 'hb', 'high bar', 'horizontal bar'],
    gender: 'mens',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'HORIZONTAL BAR' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'ubars': {
    id: 'ubars',
    label: 'Uneven Bars',
    category: 'event-frames',
    keywords: ['ubars', 'ub', 'uneven bars', 'bars'],
    gender: 'womens',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'UNEVEN BARS' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'beam': {
    id: 'beam',
    label: 'Balance Beam',
    category: 'event-frames',
    keywords: ['beam', 'bb', 'balance beam'],
    gender: 'womens',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'BALANCE BEAM' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'allaround': {
    id: 'allaround',
    label: 'All Around',
    category: 'event-frames',
    keywords: ['allaround', 'aa', 'all around', 'all-around'],
    gender: 'both',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'ALL AROUND' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'final': {
    id: 'final',
    label: 'Final Scores',
    category: 'event-frames',
    keywords: ['final', 'scores', 'final scores', 'results'],
    gender: 'both',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'FINAL SCORES' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'order': {
    id: 'order',
    label: 'Competition Order',
    category: 'event-frames',
    keywords: ['order', 'competition order', 'lineup order'],
    gender: 'both',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'COMPETITION ORDER' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'lineups': {
    id: 'lineups',
    label: 'Lineups',
    category: 'event-frames',
    keywords: ['lineups', 'lineup', 'next', 'next event'],
    gender: 'both',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'NEXT EVENT LINEUPS' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  'summary': {
    id: 'summary',
    label: 'Event Summary',
    category: 'event-frames',
    keywords: ['summary', 'event summary'],
    gender: 'both',
    renderer: 'overlay',
    file: 'event-frame.html',
    transparent: true,
    params: {
      title: { type: 'string', default: 'EVENT SUMMARY' },
      logo: { type: 'string', source: 'competition' },
    },
  },

  // ============================================================
  // FRAME OVERLAY GRAPHICS
  // ============================================================

  'frame-quad': {
    id: 'frame-quad',
    label: 'Quad View',
    category: 'frame-overlays',
    keywords: ['quad', 'four', '4', 'frame', 'overlay'],
    gender: 'both',
    minTeams: 4,
    maxTeams: 6,
    renderer: 'overlay',
    file: 'frame-quad.html',
    transparent: true,
    params: {
      // Dynamic: team1Logo through team4Logo
    },
  },

  'frame-tri-center': {
    id: 'frame-tri-center',
    label: 'Tri Center',
    category: 'frame-overlays',
    keywords: ['tri', 'three', '3', 'center', 'frame', 'overlay'],
    gender: 'both',
    minTeams: 3,
    maxTeams: 6,
    renderer: 'overlay',
    file: 'frame-tri-center.html',
    transparent: true,
    params: {
      // Dynamic: team1Logo through team3Logo
    },
  },

  'frame-tri-wide': {
    id: 'frame-tri-wide',
    label: 'Tri Wide',
    category: 'frame-overlays',
    keywords: ['tri', 'three', '3', 'wide', 'frame', 'overlay'],
    gender: 'both',
    minTeams: 3,
    maxTeams: 6,
    renderer: 'overlay',
    file: 'frame-tri-wide.html',
    transparent: true,
    params: {
      // Dynamic: team1Logo through team3Logo
    },
  },

  'frame-team-header': {
    id: 'frame-team-header',
    label: 'Team Header Dual',
    category: 'frame-overlays',
    keywords: ['dual', 'two', '2', 'header', 'team', 'frame', 'overlay'],
    gender: 'both',
    minTeams: 2,
    maxTeams: 6,
    renderer: 'overlay',
    file: 'frame-team-header.html',
    transparent: true,
    params: {
      // Dynamic: team1Logo, team2Logo
    },
  },

  'frame-single': {
    id: 'frame-single',
    label: 'Single',
    category: 'frame-overlays',
    keywords: ['single', 'one', '1', 'frame', 'overlay'],
    gender: 'both',
    minTeams: 1,
    maxTeams: 6,
    renderer: 'overlay',
    file: 'frame-single.html',
    transparent: true,
    params: {
      team1Logo: { type: 'string', source: 'competition' },
    },
  },

  'frame-dual': {
    id: 'frame-dual',
    label: 'Dual View',
    category: 'frame-overlays',
    keywords: ['dual', 'two', '2', 'view', 'frame', 'overlay'],
    gender: 'both',
    minTeams: 2,
    maxTeams: 6,
    renderer: 'overlay',
    file: 'frame-dual.html',
    transparent: true,
    params: {
      // Dynamic: team1Logo, team2Logo
    },
  },

  // ============================================================
  // LEADERBOARD GRAPHICS
  // ============================================================

  'leaderboard-fx': {
    id: 'leaderboard-fx',
    label: 'FX Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'floor', 'fx'],
    gender: 'both',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'fx' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'leaderboard-ph': {
    id: 'leaderboard-ph',
    label: 'PH Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'pommel', 'ph'],
    gender: 'mens',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'ph' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'leaderboard-sr': {
    id: 'leaderboard-sr',
    label: 'SR Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'rings', 'sr'],
    gender: 'mens',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'sr' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'leaderboard-vt': {
    id: 'leaderboard-vt',
    label: 'VT Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'vault', 'vt'],
    gender: 'both',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'vt' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'leaderboard-pb': {
    id: 'leaderboard-pb',
    label: 'PB Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'parallel', 'pbars', 'pb'],
    gender: 'mens',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'pb' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'leaderboard-hb': {
    id: 'leaderboard-hb',
    label: 'HB Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'high bar', 'hbar', 'hb'],
    gender: 'mens',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'hb' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'leaderboard-ub': {
    id: 'leaderboard-ub',
    label: 'UB Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'uneven', 'bars', 'ub'],
    gender: 'womens',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'ub' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'leaderboard-bb': {
    id: 'leaderboard-bb',
    label: 'BB Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'beam', 'balance', 'bb'],
    gender: 'womens',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'bb' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'leaderboard-aa': {
    id: 'leaderboard-aa',
    label: 'AA Leaders',
    category: 'leaderboards',
    keywords: ['leaderboard', 'leaders', 'all around', 'allaround', 'aa'],
    gender: 'both',
    renderer: 'output',
    file: 'virtius-leaderboard',
    transparent: false,
    params: {
      leaderboardEvent: { type: 'string', default: 'aa' },
      leaderboardGender: { type: 'string', source: 'competition' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  // ============================================================
  // EVENT SUMMARY GRAPHICS (Rotation-based)
  // ============================================================

  'summary-r1': {
    id: 'summary-r1',
    label: 'R1',
    category: 'event-summary',
    keywords: ['summary', 'rotation', 'r1', '1'],
    gender: 'both',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'rotation' },
      summaryRotation: { type: 'number', default: 1 },
      summaryFormat: { type: 'string', source: 'competition' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-r2': {
    id: 'summary-r2',
    label: 'R2',
    category: 'event-summary',
    keywords: ['summary', 'rotation', 'r2', '2'],
    gender: 'both',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'rotation' },
      summaryRotation: { type: 'number', default: 2 },
      summaryFormat: { type: 'string', source: 'competition' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-r3': {
    id: 'summary-r3',
    label: 'R3',
    category: 'event-summary',
    keywords: ['summary', 'rotation', 'r3', '3'],
    gender: 'both',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'rotation' },
      summaryRotation: { type: 'number', default: 3 },
      summaryFormat: { type: 'string', source: 'competition' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-r4': {
    id: 'summary-r4',
    label: 'R4',
    category: 'event-summary',
    keywords: ['summary', 'rotation', 'r4', '4'],
    gender: 'both',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'rotation' },
      summaryRotation: { type: 'number', default: 4 },
      summaryFormat: { type: 'string', source: 'competition' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-r5': {
    id: 'summary-r5',
    label: 'R5',
    category: 'event-summary',
    keywords: ['summary', 'rotation', 'r5', '5'],
    gender: 'mens',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'rotation' },
      summaryRotation: { type: 'number', default: 5 },
      summaryFormat: { type: 'string', source: 'competition' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-r6': {
    id: 'summary-r6',
    label: 'R6',
    category: 'event-summary',
    keywords: ['summary', 'rotation', 'r6', '6'],
    gender: 'mens',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'rotation' },
      summaryRotation: { type: 'number', default: 6 },
      summaryFormat: { type: 'string', source: 'competition' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  // ============================================================
  // EVENT SUMMARY GRAPHICS (Apparatus-based)
  // ============================================================

  'summary-fx': {
    id: 'summary-fx',
    label: 'FX',
    category: 'event-summary',
    keywords: ['summary', 'apparatus', 'floor', 'fx'],
    gender: 'both',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'apparatus' },
      summaryApparatus: { type: 'string', default: 'fx' },
      summaryFormat: { type: 'string', default: 'head-to-head' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-ph': {
    id: 'summary-ph',
    label: 'PH',
    category: 'event-summary',
    keywords: ['summary', 'apparatus', 'pommel', 'ph'],
    gender: 'mens',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'apparatus' },
      summaryApparatus: { type: 'string', default: 'ph' },
      summaryFormat: { type: 'string', default: 'head-to-head' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-sr': {
    id: 'summary-sr',
    label: 'SR',
    category: 'event-summary',
    keywords: ['summary', 'apparatus', 'rings', 'sr'],
    gender: 'mens',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'apparatus' },
      summaryApparatus: { type: 'string', default: 'sr' },
      summaryFormat: { type: 'string', default: 'head-to-head' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-vt': {
    id: 'summary-vt',
    label: 'VT',
    category: 'event-summary',
    keywords: ['summary', 'apparatus', 'vault', 'vt'],
    gender: 'both',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'apparatus' },
      summaryApparatus: { type: 'string', default: 'vt' },
      summaryFormat: { type: 'string', default: 'head-to-head' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-pb': {
    id: 'summary-pb',
    label: 'PB',
    category: 'event-summary',
    keywords: ['summary', 'apparatus', 'parallel', 'pbars', 'pb'],
    gender: 'mens',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'apparatus' },
      summaryApparatus: { type: 'string', default: 'pb' },
      summaryFormat: { type: 'string', default: 'head-to-head' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-hb': {
    id: 'summary-hb',
    label: 'HB',
    category: 'event-summary',
    keywords: ['summary', 'apparatus', 'high bar', 'hbar', 'hb'],
    gender: 'mens',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'apparatus' },
      summaryApparatus: { type: 'string', default: 'hb' },
      summaryFormat: { type: 'string', default: 'head-to-head' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-ub': {
    id: 'summary-ub',
    label: 'UB',
    category: 'event-summary',
    keywords: ['summary', 'apparatus', 'uneven', 'bars', 'ub'],
    gender: 'womens',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'apparatus' },
      summaryApparatus: { type: 'string', default: 'ub' },
      summaryFormat: { type: 'string', default: 'head-to-head' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  'summary-bb': {
    id: 'summary-bb',
    label: 'BB',
    category: 'event-summary',
    keywords: ['summary', 'apparatus', 'beam', 'balance', 'bb'],
    gender: 'womens',
    renderer: 'output',
    file: 'event-summary',
    transparent: false,
    params: {
      summaryMode: { type: 'string', default: 'apparatus' },
      summaryApparatus: { type: 'string', default: 'bb' },
      summaryFormat: { type: 'string', default: 'head-to-head' },
      summaryTheme: { type: 'enum', options: ['default', 'espn', 'nbc', 'btn', 'pac12', 'neon', 'classic', 'light'], default: 'default' },
      comp: { type: 'string', source: 'competition' },
    },
  },

  // ============================================================
  // STREAM GRAPHICS
  // ============================================================

  'stream-starting': {
    id: 'stream-starting',
    label: 'Starting Soon',
    category: 'stream',
    keywords: ['stream', 'starting', 'soon', 'begin', 'start'],
    gender: 'both',
    renderer: 'overlay',
    file: 'stream.html',
    transparent: false,
    params: {
      title: { type: 'string', default: 'STREAM STARTING SOON' },
      logo: { type: 'string', source: 'competition' },
      eventName: { type: 'string', source: 'competition' },
      meetDate: { type: 'string', source: 'competition' },
    },
  },

  'stream-thanks': {
    id: 'stream-thanks',
    label: 'Thanks',
    category: 'stream',
    keywords: ['stream', 'thanks', 'watching', 'end', 'goodbye'],
    gender: 'both',
    renderer: 'overlay',
    file: 'stream.html',
    transparent: false,
    params: {
      title: { type: 'string', default: 'THANKS FOR WATCHING' },
      logo: { type: 'string', source: 'competition' },
      eventName: { type: 'string', source: 'competition' },
      meetDate: { type: 'string', source: 'competition' },
    },
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get all graphics as a flat array
 * @returns {Array} Array of all graphic definitions
 */
export function getAllGraphics() {
  return Object.values(GRAPHICS);
}

/**
 * Get a single graphic by ID
 * @param {string} id - Graphic ID
 * @returns {Object|undefined} Graphic definition or undefined
 */
export function getGraphicById(id) {
  return GRAPHICS[id];
}

/**
 * Get graphics filtered by category
 * @param {string} category - Category name
 * @returns {Array} Array of graphic definitions in that category
 */
export function getGraphicsByCategory(category) {
  return getAllGraphics().filter(g => g.category === category);
}

/**
 * Get all unique categories
 * @returns {Array} Array of category names
 */
export function getCategories() {
  const categories = new Set(getAllGraphics().map(g => g.category));
  return Array.from(categories);
}

/**
 * Check if a graphic is available for a given competition type
 * @param {Object} graphic - Graphic definition
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @param {number} teamCount - Number of teams
 * @returns {boolean} True if graphic is available
 */
export function isGraphicAvailable(graphic, compType, teamCount) {
  // Check gender filter
  const isMens = compType?.startsWith('mens');
  if (graphic.gender === 'mens' && !isMens) return false;
  if (graphic.gender === 'womens' && isMens) return false;

  // Check team count constraints
  if (graphic.minTeams && teamCount < graphic.minTeams) return false;
  if (graphic.maxTeams && teamCount > graphic.maxTeams) return false;

  return true;
}

/**
 * Get graphics available for a specific competition, with dynamic labels
 * @param {string} compType - Competition type (e.g., 'womens-quad', 'mens-dual')
 * @param {Object} teamNames - Team names keyed by number (e.g., { 1: 'UCLA', 2: 'Oregon' })
 * @param {string} [category] - Optional category filter
 * @returns {Array} Array of graphic definitions with resolved labels
 */
export function getGraphicsForCompetition(compType, teamNames = {}, category = null) {
  const isMens = compType?.startsWith('mens');
  const teamCount = Object.keys(teamNames).length || 2;

  const results = [];

  for (const graphic of getAllGraphics()) {
    // Filter by category if specified
    if (category && graphic.category !== category) continue;

    // Check availability
    if (!isGraphicAvailable(graphic, compType, teamCount)) continue;

    // Handle perTeam graphics - expand to team1-*, team2-*, etc.
    if (graphic.perTeam) {
      for (let i = 1; i <= teamCount; i++) {
        const teamName = teamNames[i] || `Team ${i}`;
        const expandedId = `team${i}-${graphic.id.replace('team-', '')}`;
        const label = graphic.labelTemplate
          ? graphic.labelTemplate.replace('{teamName}', teamName)
          : `${teamName} ${graphic.label.replace('Team ', '')}`;

        results.push({
          ...graphic,
          id: expandedId,
          label,
          team: i,
        });
      }
    } else {
      // Regular graphic - just add with optional label substitution
      let label = graphic.label;
      if (graphic.labelTemplate) {
        // Replace any team name placeholders
        for (const [num, name] of Object.entries(teamNames)) {
          label = label.replace(`{team${num}Name}`, name);
        }
      }
      results.push({ ...graphic, label });
    }
  }

  return results;
}

/**
 * Get recommended graphic based on segment name
 * @param {string} segmentName - Name of the segment (e.g., "UCLA Coaches Introduction")
 * @param {string} compType - Competition type
 * @param {Object} teamNames - Team names keyed by number
 * @returns {Object|null} Best matching graphic with confidence score, or null
 */
export function getRecommendedGraphic(segmentName, compType, teamNames = {}) {
  if (!segmentName) return null;

  const normalizedName = segmentName.toLowerCase();
  const availableGraphics = getGraphicsForCompetition(compType, teamNames);

  let bestMatch = null;
  let bestScore = 0;

  for (const graphic of availableGraphics) {
    let score = 0;

    // Check keywords
    for (const keyword of graphic.keywords || []) {
      if (normalizedName.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }

    // Check label match
    if (normalizedName.includes(graphic.label.toLowerCase())) {
      score += 20;
    }

    // Check team name match for per-team graphics
    if (graphic.team) {
      const teamName = teamNames[graphic.team];
      if (teamName && normalizedName.includes(teamName.toLowerCase())) {
        score += 30;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = graphic;
    }
  }

  if (bestMatch && bestScore > 0) {
    // Calculate confidence (0-1)
    const confidence = Math.min(1, bestScore / 50);
    return { ...bestMatch, confidence };
  }

  return null;
}

/**
 * Check if a graphic should have a transparent background
 * @param {string} graphicId - Graphic ID
 * @returns {boolean} True if transparent
 */
export function isTransparentGraphic(graphicId) {
  // Handle team-specific graphics
  if (/^team\d+-(stats|coaches)$/.test(graphicId)) {
    return true;
  }

  const graphic = getGraphicById(graphicId);
  return graphic?.transparent ?? false;
}

export default {
  GRAPHICS,
  getAllGraphics,
  getGraphicById,
  getGraphicsByCategory,
  getCategories,
  isGraphicAvailable,
  getGraphicsForCompetition,
  getRecommendedGraphic,
  isTransparentGraphic,
};
