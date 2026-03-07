/**
 * Production Checklist Items Definition
 *
 * 75 items across 4 phases and 14 categories.
 * 14 auto-validated items (system checks state automatically).
 * 61 manual items (producer checks off manually).
 *
 * All items appear for all competition types in MVP.
 * Dynamic behavior is in the validators (they check N teams based on comp type),
 * not in item visibility. Item filtering by comp type is deferred to Phase 2 (templates).
 *
 * Reference: docs/PRD-Production-Checklist/checklist-items-definition.md
 */

export const CHECKLIST_PHASES = [
  {
    id: 'setup',
    name: 'Setup (5+ Days Out)',
    shortName: 'Setup',
    categories: [
      {
        id: 'competition-config',
        name: 'Competition Config',
        items: [
          { id: 'event-name', name: 'Event name configured', type: 'auto', validator: 'event-name', fixLink: '/' },
          { id: 'meet-date', name: 'Meet date configured', type: 'auto', validator: 'meet-date', fixLink: '/' },
          { id: 'venue-configured', name: 'Venue configured', type: 'auto', validator: 'venue-configured', fixLink: '/' },
          { id: 'teams-configured', name: 'Teams configured with names & logos', type: 'auto', validator: 'teams-configured', fixLink: '/' },
          { id: 'rosters-loaded', name: 'Rosters loaded for all teams', type: 'auto', validator: 'rosters-loaded', fixLink: '/media-manager' },
          { id: 'headshots-uploaded', name: 'Headshots uploaded & current (>80%)', type: 'auto', validator: 'headshots-uploaded', fixLink: '/media-manager' },
          { id: 'theme-configured', name: 'Meet theme configured', type: 'auto', validator: 'theme-configured', fixLink: '/themes' },
        ],
      },
      {
        id: 'session-setup',
        name: 'Session Setup',
        items: [
          { id: 'session-created', name: 'Session created in Virtius', type: 'manual' },
          { id: 'session-configured', name: 'Session configured with teams, times, public, judges', type: 'manual' },
          { id: 'session-front-page', name: 'Session placed on Virtius front page', type: 'manual' },
        ],
      },
      {
        id: 'communications',
        name: 'Communications',
        items: [
          { id: 'pre-meet-email', name: 'Pre-meet email sent to coaches', type: 'manual' },
          { id: 'camera-op-contact', name: 'Camera op contact info received', type: 'manual', autoAssist: 'camera-op-primary' },
          { id: 'talent-contacted', name: 'Commentary talent contacted & confirmed', type: 'manual', autoAssist: 'head-coach' },
          { id: 'streaming-plan-confirmed', name: 'Streaming plan confirmed with school', type: 'manual' },
          { id: 'ops-group-chat', name: 'Group chat created with ops team & camera crew', type: 'manual' },
          { id: 'talent-group-chat', name: 'Talent text group chat created with producer', type: 'manual' },
        ],
      },
      {
        id: 'graphics-deliverables',
        name: 'Graphics & Deliverables',
        items: [
          { id: 'meet-graphics-received', name: 'Meet graphics received from school', type: 'manual' },
          { id: 'show-timeline-received', name: 'Show timeline received', type: 'manual' },
          { id: 'sponsorships-received', name: 'Sponsorships & sponsor requirements received', type: 'manual' },
          { id: 'animated-background', name: 'Custom animated background created', type: 'manual' },
          { id: 'graphics-approved', name: 'Graphics approved by school/team', type: 'manual' },
        ],
      },
      {
        id: 'internal-scheduling',
        name: 'Internal Scheduling',
        items: [
          { id: 'calendar-event', name: 'Event added to team calendar', type: 'manual' },
          { id: 'venue-ops-scheduled', name: 'Venue ops bring-up scheduled', type: 'manual' },
          { id: 'commentator-bringup', name: 'Commentator bring-up scheduled', type: 'manual' },
          { id: 'dry-run-scheduled', name: 'Internal dry run scheduled', type: 'manual' },
        ],
      },
    ],
  },
  {
    id: 'pre-production',
    name: 'Pre-Production (2-4 Days Out)',
    shortName: 'Pre-Prod',
    categories: [
      {
        id: 'camera-ops',
        name: 'Camera Ops',
        items: [
          { id: 'camera-config-added', name: 'Camera config added to system', type: 'manual' },
          { id: 'larix-qr-created', name: 'Larix QR codes / links created', type: 'manual' },
          { id: 'qr-codes-sent', name: 'QR codes / camera links sent to camera ops', type: 'manual' },
          { id: 'larix-premium-confirmed', name: 'Larix premium confirmed on all game day cameras', type: 'manual' },
          { id: 'larix-connection-tested', name: 'Camera connection tested via Larix link/QR code', type: 'manual' },
          { id: 'camera-op-briefed', name: 'Camera op briefed on procedures & reference angles', type: 'manual' },
        ],
      },
      {
        id: 'youtube-streaming',
        name: 'YouTube / Streaming',
        items: [
          { id: 'youtube-stream-created', name: 'YouTube stream page created with countdown', type: 'manual' },
          { id: 'youtube-title-description', name: 'YouTube title & description updated', type: 'manual' },
          { id: 'youtube-streaming-software', name: 'YouTube stream set to "Streaming software" mode', type: 'manual' },
          { id: 'youtube-registered-24hr', name: 'YouTube account registered 24hr in advance for streaming', type: 'manual' },
          { id: 'youtube-thumbnail', name: 'Meet graphic thumbnail added to YouTube stream', type: 'manual' },
          { id: 'youtube-public', name: 'YouTube stream made public', type: 'manual' },
          { id: 'stream-embedded-virtius', name: 'Production stream embedded in Virtius session', type: 'manual' },
        ],
      },
      {
        id: 'talent',
        name: 'Talent',
        items: [
          { id: 'talent-locked-in', name: 'Talent locked in & recorded', type: 'manual' },
          { id: 'talent-usb-mic', name: 'Talent has USB microphone confirmed', type: 'manual' },
          { id: 'talent-bandwidth', name: 'Talent bandwidth measurements recorded', type: 'manual' },
          { id: 'discord-channel-created', name: 'Discord channel created & invites sent to talent', type: 'manual' },
          { id: 'show-plan-reviewed', name: 'Show plan reviewed internally', type: 'manual' },
          { id: 'show-plan-sent', name: 'Show plan sent to talent', type: 'manual' },
          { id: 'talent-checkins-scheduled', name: 'Game day & pre-game check-ins scheduled with talent', type: 'manual' },
        ],
      },
      {
        id: 'rundown',
        name: 'Rundown',
        items: [
          { id: 'rundown-created', name: 'Rundown created with segments', type: 'auto', validator: 'rundown-created', fixLink: '/{compId}/rundown' },
          { id: 'segments-named', name: 'Rundown segments named', type: 'auto', validator: 'segments-named', fixLink: '/{compId}/rundown' },
          { id: 'graphics-assigned', name: 'Graphics assigned to segments', type: 'auto', validator: 'graphics-assigned', fixLink: '/{compId}/rundown' },
        ],
      },
    ],
  },
  {
    id: 'day-of-2hr',
    name: 'Day Of (2 Hours Before)',
    shortName: '2hr Before',
    categories: [
      {
        id: 'vm-infrastructure',
        name: 'VM / Infrastructure',
        items: [
          { id: 'vm-assigned', name: 'VM assigned to competition', type: 'auto', validator: 'vm-assigned', fixLink: '/_admin/vm-pool' },
          { id: 'vm-online', name: 'VM online & accessible', type: 'auto', validator: 'vm-online', fixLink: '/_admin/vm-pool' },
          { id: 'haivision-enabled', name: 'Haivision gateway enabled', type: 'manual' },
          { id: 'socket-connected', name: 'Show controller connected to coordinator', type: 'auto', validator: 'socket-connected', fixLink: '/_admin/vm-pool' },
        ],
      },
      {
        id: 'obs-configuration',
        name: 'OBS Configuration',
        items: [
          { id: 'obs-connected', name: 'OBS connected to coordinator', type: 'auto', validator: 'obs-connected', fixLink: '/{compId}/obs-manager' },
          { id: 'stream-key-confirmed', name: 'Stream key confirmed in OBS', type: 'manual' },
          { id: 'obs-stream-settings', name: 'OBS stream settings confirmed (1080p60, 7k kbps)', type: 'manual' },
          { id: 'stinger-transition', name: 'Stinger transition point set to 14 frames', type: 'manual' },
          { id: 'scenes-sources-confirmed', name: 'All scenes & sources visually confirmed on VM', type: 'manual' },
          { id: 'animated-bg-confirmed', name: 'Animated background confirmed in OBS', type: 'manual' },
          { id: 'background-music', name: 'Background music audible in Stream Starting Soon scene', type: 'manual' },
          { id: 'audio-sources-configured', name: 'Audio sources configured (camera audio, muting)', type: 'manual' },
        ],
      },
      {
        id: 'camera-ops-day-of',
        name: 'Camera Ops - Day Of',
        items: [
          { id: 'larix-ports-confirmed', name: 'Larix ports confirmed on game day cameras', type: 'manual' },
          { id: 'camera-locations-marked', name: 'Camera locations reviewed & marked on-site', type: 'manual' },
          { id: 'equipment-check', name: 'Equipment check complete (battery, backup, tripod)', type: 'manual' },
          { id: 'camera-bandwidth', name: 'Bandwidth measured for primary camera & WiFi confirmed', type: 'manual' },
          { id: 'larix-hardening', name: 'Larix hardening & settings lockdown complete', type: 'manual' },
          { id: 'camera-stream-tested', name: 'Camera stream started & configuration verified', type: 'manual' },
        ],
      },
      {
        id: 'session-day-of',
        name: 'Session - Day Of',
        items: [
          { id: 'session-live-mode', name: 'Virtius session set to LIVE mode', type: 'manual' },
          { id: 'lineups-added', name: 'Lineups added for all teams', type: 'manual' },
        ],
      },
    ],
  },
  {
    id: 'day-of-1hr',
    name: 'Day Of (1 Hour Before)',
    shortName: '1hr Before',
    categories: [
      {
        id: 'discord-talent-audio',
        name: 'Discord / Talent Audio',
        items: [
          { id: 'discord-streamer-mode', name: 'Discord streamer mode enabled', type: 'manual' },
          { id: 'discord-call-started', name: 'Discord call started with talent', type: 'manual' },
          { id: 'talent-audio-confirmed', name: 'Talent audio inputs/outputs confirmed in Discord', type: 'manual' },
          { id: 'obs-projector-shared', name: 'OBS windowed projector shared to talent via Discord', type: 'manual' },
          { id: 'discord-audio-captured', name: 'Discord audio source captured in OBS', type: 'manual' },
          { id: 'talent-audio-levels', name: 'Talent audio level balanced over camera audio', type: 'manual' },
          { id: 'talent-dry-run', name: 'Dry run completed with talent (intro, rules, protocols)', type: 'manual' },
        ],
      },
    ],
  },
];

/**
 * Get all items across all phases as a flat array.
 */
export function getAllItems() {
  const items = [];
  for (const phase of CHECKLIST_PHASES) {
    for (const category of phase.categories) {
      for (const item of category.items) {
        items.push({ ...item, phaseId: phase.id, categoryId: category.id });
      }
    }
  }
  return items;
}

/**
 * Get an item by its ID.
 */
export function getItemById(itemId) {
  for (const phase of CHECKLIST_PHASES) {
    for (const category of phase.categories) {
      for (const item of category.items) {
        if (item.id === itemId) return item;
      }
    }
  }
  return null;
}

/**
 * Count items by type.
 */
export function getItemCounts() {
  const all = getAllItems();
  return {
    total: all.length,
    auto: all.filter(i => i.type === 'auto').length,
    manual: all.filter(i => i.type === 'manual').length,
  };
}
