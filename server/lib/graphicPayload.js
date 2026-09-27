/**
 * Graphic Payload Builder
 *
 * Single source of truth for the payload written to
 * `competitions/{compId}/currentGraphic`. Extracted verbatim from
 * timesheetEngine._triggerGraphic so the rundown engine and the action bus
 * (ISA2-272) write byte-identical payloads for the same graphic.
 *
 * The builder is pure with respect to Firebase: it only reads. Writing the
 * payload, broadcasting it over socket.io, and emitting engine events stay
 * with the caller.
 *
 * @module graphicPayload
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { resolveTheme } from './themeResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path: server/lib -> stage/graphics-registry.json
const GRAPHICS_REGISTRY_PATH = path.join(__dirname, '../../stage/graphics-registry.json');

let graphicsRegistry = null;
try {
  const registryContent = readFileSync(GRAPHICS_REGISTRY_PATH, 'utf8');
  graphicsRegistry = JSON.parse(registryContent);
} catch (error) {
  console.warn('[GraphicPayload] Could not load graphics registry:', error.message);
  console.warn('[GraphicPayload] Stage renderer routing will default to "output"');
}

/**
 * The parsed stage/graphics-registry.json, or null when it could not be read.
 * @returns {Object|null}
 */
export function getGraphicsRegistry() {
  return graphicsRegistry;
}

/**
 * Look up a graphic by ID from the registry
 * @param {string} graphicId - The graphic ID to look up
 * @returns {Object|null} The graphic entry or null if not found
 */
export function getGraphicById(graphicId) {
  if (!graphicsRegistry?.graphics) return null;
  return graphicsRegistry.graphics[graphicId] || null;
}

/**
 * Strip a per-team prefix so "team2-roster" resolves to the "team-roster" entry.
 * @param {string} graphicId
 * @returns {string}
 */
export function baseGraphicId(graphicId) {
  return graphicId.replace(/^team\d+-/, 'team-');
}

/**
 * Normalize either a Firebase Admin app or a database handle to a database handle.
 * @param {Object|null} firebase
 * @returns {Object|null}
 */
export function resolveDb(firebase) {
  if (!firebase) return null;
  return typeof firebase.ref === 'function' ? firebase : firebase.database();
}

/**
 * Build the `currentGraphic` payload for a graphic.
 *
 * @param {Object} options
 * @param {Object|null} options.db - Firebase Admin database handle (or app; normalized)
 * @param {string|null} options.compId - Competition ID
 * @param {string} options.graphicId - Graphic ID, e.g. "team2-roster" or "custom-abc"
 * @param {Object} [options.graphicParams] - Per-invocation params merged over config data
 * @param {string|null} [options.segmentId] - Rundown segment ID, when triggered by a segment.
 *   Passed through unchanged (including `undefined`) so the rundown payload is byte-identical.
 * @param {string} [options.logPrefix] - Log prefix, e.g. "[Timesheet:comp-1]"
 * @param {number} [options.timestamp] - Payload timestamp (defaults to Date.now())
 * @returns {Promise<Object>} The payload to write to currentGraphic
 */
export async function buildGraphicPayload({
  db: dbOrApp,
  compId,
  graphicId,
  graphicParams = {},
  segmentId,
  logPrefix = '[GraphicPayload]',
  timestamp,
} = {}) {
  const db = resolveDb(dbOrApp);

  // Build data object - start with segment params, then load competition config
  let data = graphicParams;

  // If we have Firebase and compId, load the competition config to get team data
  if (db && compId) {
    try {
      const configSnapshot = await db.ref(`competitions/${compId}/config`).once('value');
      const config = configSnapshot.val();

      if (config) {
        // Build complete data object from competition config (same as GraphicsControl.sendGraphic)
        data = {
          eventName: config.eventName || '',
          meetDate: config.meetDate || '',
          venue: config.venue || '',
          location: config.location || '',
          hosts: config.hosts || '',
          virtiusSessionId: config.virtiusSessionId || '',
          // Meet theme for themed graphics (PRD Who To Watch: Issue #14)
          meetTheme: config.meetTheme || '',
          // Team 1-6 data
          ...Object.fromEntries(
            [1, 2, 3, 4, 5, 6].flatMap(i => [
              [`team${i}Name`, config[`team${i}Name`] || ''],
              [`team${i}Logo`, config[`team${i}Logo`] || ''],
              [`team${i}Ave`, config[`team${i}Ave`] || ''],
              [`team${i}High`, config[`team${i}High`] || ''],
              [`team${i}Con`, config[`team${i}Con`] || ''],
              [`team${i}Coaches`, config[`team${i}Coaches`] || ''],
            ])
          ),
          // Merge any segment-specific params on top (e.g., teamSlot)
          ...graphicParams,
        };

        // Handle sponsor graphics - fetch sponsor data from home team
        if (graphicId.startsWith('sponsors-')) {
          // Get team key from config (team1Key is already in correct format like "navy-mens")
          const teamKey = config.team1Key;
          if (teamKey) {
            try {
              let sponsorsData = null;
              let resolvedKey = teamKey;

              // Try exact key first
              const sponsorsSnapshot = await db.ref(`teamsDatabase/sponsors/${teamKey}`).once('value');
              sponsorsData = sponsorsSnapshot.val();

              // Fallback: try normalized key (strip special chars like &)
              // team1Key may contain characters that differ from the sponsors key
              if (!sponsorsData) {
                const normalizedKey = teamKey.replace(/[&]+/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
                if (normalizedKey !== teamKey) {
                  const fallbackSnapshot = await db.ref(`teamsDatabase/sponsors/${normalizedKey}`).once('value');
                  sponsorsData = fallbackSnapshot.val();
                  if (sponsorsData) {
                    resolvedKey = normalizedKey;
                    console.log(`${logPrefix} Sponsors found via normalized key "${normalizedKey}" (original: "${teamKey}")`);
                  }
                }
              }

              if (sponsorsData) {
                // Convert sponsors object to array, sorted by order, limited to 8
                // Include all adjustment fields (scale, offset, crop) so overlays render consistently
                const sponsorsArray = Object.entries(sponsorsData)
                  .map(([key, sponsor]) => ({
                    name: sponsor.name,
                    url: sponsor.logoUrl || sponsor.url,  // Handle both field names
                    order: sponsor.order ?? 0,
                    ...(sponsor.scale != null && sponsor.scale !== 100 ? { scale: sponsor.scale } : {}),
                    ...(sponsor.offsetX ? { offsetX: sponsor.offsetX } : {}),
                    ...(sponsor.offsetY ? { offsetY: sponsor.offsetY } : {}),
                    ...(sponsor.cropX != null ? { cropX: sponsor.cropX } : {}),
                    ...(sponsor.cropY != null ? { cropY: sponsor.cropY } : {}),
                    ...(sponsor.cropW != null ? { cropW: sponsor.cropW } : {}),
                    ...(sponsor.cropH != null ? { cropH: sponsor.cropH } : {}),
                  }))
                  .filter(s => s.name && s.url)  // Only include sponsors with both name and url
                  .sort((a, b) => a.order - b.order)
                  .slice(0, 8)  // Max 8 sponsors
                  .map(({ order, ...rest }) => rest);  // Remove order field for output

                data.sponsors = JSON.stringify(sponsorsArray);
                console.log(`${logPrefix} Loaded ${sponsorsArray.length} sponsors for team "${resolvedKey}"`);
              } else {
                data.sponsors = '[]';
                console.log(`${logPrefix} No sponsors found for team "${teamKey}"`);
              }
            } catch (sponsorError) {
              console.warn(`${logPrefix} Failed to load sponsors: ${sponsorError.message}`);
              data.sponsors = '[]';
            }
          } else {
            data.sponsors = '[]';
            console.log(`${logPrefix} No team1Key in config, cannot load sponsors`);
          }
        }
      }
    } catch (error) {
      console.warn(`${logPrefix} Failed to load competition config for graphic: ${error.message}`);
    }
  }

  // Handle custom graphics - load URL from Firebase customGraphics collection
  if (graphicId.startsWith('custom-') && db && compId) {
    const customKey = graphicId.replace('custom-', '');
    try {
      const customSnapshot = await db.ref(`competitions/${compId}/customGraphics/${customKey}`).once('value');
      const customGraphic = customSnapshot.val();
      if (customGraphic) {
        data.customUrl = customGraphic.url;
        data.customLabel = customGraphic.label;
      }
    } catch (error) {
      console.warn(`${logPrefix} Failed to load custom graphic: ${error.message}`);
    }
  }

  // Look up renderer from graphics registry (Phase 4: renderer routing)
  // Custom graphics always use 'output' renderer
  // For perTeam graphics (e.g., "team1-roster"), strip the number to find base ID ("team-roster")
  const baseId = baseGraphicId(graphicId);
  const registryEntry = graphicId.startsWith('custom-') ? null : (getGraphicById(graphicId) || getGraphicById(baseId));
  // Manifest 'overlay' maps to Firebase 'output' — both legacy paths use output.html
  const firebaseRenderer = registryEntry?.renderer === 'stage' ? 'stage' : 'output';

  const graphicData = {
    graphic: graphicId.startsWith('custom-') ? 'custom' : graphicId,
    graphicId: graphicId, // For button highlighting in GraphicsControl
    renderer: firebaseRenderer, // Phase 4: renderer routing
    data: data,
    segmentId: segmentId,
    timestamp: timestamp ?? Date.now()
  };

  // For stage engine graphics, resolve theme and build render spec
  if (firebaseRenderer === 'stage' && db && compId && registryEntry) {
    try {
      const meetTheme = data.meetTheme || '';

      // Resolve theme with per-graphic overrides
      const resolvedTheme = meetTheme ? await resolveTheme(db, meetTheme, graphicId) : null;

      // Build render spec for stage engine
      // Include skeleton, blocks, and theme data
      graphicData.skeleton = registryEntry.skeleton;
      let stageBlocks = registryEntry.defaultData?.blocks || registryEntry.blocks?.map(type => ({ type, data: {} })) || [];

      // For per-team roster graphics, fill in team-specific data
      const rosterMatch = graphicId.match(/^team(\d+)-roster$/);
      if (rosterMatch) {
        const teamNum = rosterMatch[1];
        const teamName = data?.[`team${teamNum}Name`] || `Team ${teamNum}`;
        // teamKey isn't in the data object — read from config
        let teamKey = '';
        try {
          const keySnap = await db.ref(`competitions/${compId}/config/team${teamNum}Key`).once('value');
          teamKey = keySnap.val() || '';
        } catch (e) { /* fallback to empty */ }
        stageBlocks = [
          { type: 'header-bar', data: { title: teamName } },
          { type: 'athlete-grid', data: { teamKey: teamKey } }
        ];
      }

      graphicData.blocks = stageBlocks;
      if (resolvedTheme) {
        graphicData.theme = resolvedTheme;
      }

      console.log(`${logPrefix} Stage graphic "${graphicId}" - skeleton: ${registryEntry.skeleton}, blocks: ${registryEntry.blocks?.join(', ') || 'none'}, theme: ${meetTheme || 'none'}`);
    } catch (error) {
      console.warn(`${logPrefix} Failed to resolve theme for stage graphic: ${error.message}`);
      // Continue without theme - stage engine will use fallback colors
    }
  }

  return graphicData;
}

const EVENT_FRAME_IDS = ['floor', 'pommel', 'rings', 'vault', 'pbars', 'hbar', 'ubars', 'beam', 'allaround', 'final'];

/**
 * The `graphic` type GraphicsControl.sendGraphic wrote for a button ID.
 * Event frames, leaderboards, and per-team rosters share one renderer each.
 * @param {string} graphicId
 * @returns {string}
 */
export function manualGraphicType(graphicId) {
  if (EVENT_FRAME_IDS.includes(graphicId)) return 'event-frame';
  if (graphicId.startsWith('leaderboard-')) return 'virtius-leaderboard';
  if (/^team\d+-roster$/.test(graphicId)) return 'team-roster';
  return graphicId;
}

/**
 * Build the payload a producer's button press writes, matching what
 * GraphicsControl.sendGraphic wrote client-side before ISA2-281: all ten team
 * slots, compType, frame title, leaderboard event and gender, event-calendar
 * fields, theme sponsors ahead of team sponsors, and the button-type `graphic`.
 * Stage renderer, blocks, and theme come from buildGraphicPayload.
 *
 * @param {Object} options
 * @param {Object} options.db
 * @param {string} options.compId
 * @param {string} options.graphicId
 * @param {string} [options.frameTitle]
 * @param {string} [options.leaderboardEvent]
 * @param {string} [options.leaderboardGender]
 * @param {string} [options.logPrefix]
 * @returns {Promise<Object>}
 */
export async function buildManualGraphicPayload({
  db: dbOrApp, compId, graphicId, frameTitle, leaderboardEvent, leaderboardGender,
  logPrefix = '[GraphicPayload]',
} = {}) {
  const db = resolveDb(dbOrApp);
  let config = null;
  try {
    config = (await db.ref(`competitions/${compId}/config`).once('value')).val();
  } catch (error) {
    console.warn(`${logPrefix} Failed to load competition config: ${error.message}`);
  }
  config = config || {};

  const extra = { compType: config.compType || '' };
  for (let i = 1; i <= 10; i++) {
    extra[`team${i}Name`] = config[`team${i}Name`] || '';
    extra[`team${i}Logo`] = config[`team${i}Logo`] || '';
    extra[`team${i}Ave`] = config[`team${i}Ave`] || '';
    extra[`team${i}High`] = config[`team${i}High`] || '';
    extra[`team${i}Con`] = config[`team${i}Con`] || '';
    extra[`team${i}Coaches`] = config[`team${i}Coaches`] || '';
  }
  if (frameTitle) extra.frameTitle = frameTitle;
  if (leaderboardEvent) {
    extra.leaderboardEvent = leaderboardEvent;
    extra.leaderboardGender = leaderboardGender;
  }
  if (graphicId === 'event-calendar') {
    extra.calendarTitle = config.calendarTitle || 'Event Calendar';
    extra.calendarEvents = config.calendarEvents || '[]';
    extra.calendarColumns = config.calendarColumns || 'auto';
  }

  const payload = await buildGraphicPayload({
    db, compId, graphicId, graphicParams: extra, segmentId: null, logPrefix,
  });
  payload.graphic = manualGraphicType(graphicId);
  delete payload.segmentId;

  // Event sponsors on the active theme win over team sponsors.
  if (graphicId.startsWith('sponsors-') && config.meetTheme) {
    try {
      const themeSponsors = (await db.ref(`themes/${config.meetTheme}/sponsors`).once('value')).val();
      if (Array.isArray(themeSponsors) && themeSponsors.length > 0) {
        payload.data.sponsors = JSON.stringify(themeSponsors.slice(0, 8).map(s => ({
          name: s.name || '',
          url: s.url || '',
          ...(s.scale != null && s.scale !== 100 ? { scale: s.scale } : {}),
          ...(s.offsetX ? { offsetX: s.offsetX } : {}),
          ...(s.offsetY ? { offsetY: s.offsetY } : {}),
          ...(s.cropX != null ? { cropX: s.cropX } : {}),
          ...(s.cropY != null ? { cropY: s.cropY } : {}),
          ...(s.cropW != null ? { cropW: s.cropW } : {}),
          ...(s.cropH != null ? { cropH: s.cropH } : {}),
        })));
      }
    } catch (error) {
      console.warn(`${logPrefix} Failed to load theme sponsors: ${error.message}`);
    }
  }
  return payload;
}

/**
 * The payload GraphicsControl writes when the producer clears the output.
 * Deliberately omits `renderer` — both engines clear on `graphic: 'clear'`.
 * @param {number} [timestamp]
 * @returns {Object}
 */
export function buildClearPayload(timestamp) {
  return {
    graphic: 'clear',
    data: {},
    timestamp: timestamp ?? Date.now()
  };
}

export default buildGraphicPayload;
