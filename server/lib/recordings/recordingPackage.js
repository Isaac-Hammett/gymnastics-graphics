/**
 * Recording Package Loader
 *
 * Loads a recorded-source package for a meet: the layout timeline (meta.json),
 * the final Virtius results export (virtius-final.json), and any recorded
 * timestamped meet log (events.jsonl; ISA2-296 replays it on the show clock).
 *
 * Layout on disk, per recording (e.g. recordings/ecac-2026/):
 *   program.mp4        — source video (not read here; local-only, gitignored)
 *   meta.json           — { width, height, fps, durationMs, layoutTimeline }
 *   virtius-final.json  — { meet: { ... event_results, teams } }
 *   events.jsonl        — { tVideoMs, type, event, team, athlete, score } per line (optional;
 *                         ECAC's is rebuilt by lib/recordings/rebuildEventLog.js)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECORDINGS_ROOT = path.join(__dirname, '../../../recordings');

/**
 * List available recording names (subdirectories of recordings/).
 * @returns {string[]}
 */
export function listRecordings() {
  if (!fs.existsSync(RECORDINGS_ROOT)) return [];
  return fs.readdirSync(RECORDINGS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

/**
 * Load a recording's layout timeline metadata (meta.json).
 * @param {string} name — recording directory name, e.g. "ecac-2026"
 * @returns {Object|null} parsed meta.json, or null if missing
 */
export function loadMeta(name) {
  const metaPath = path.join(RECORDINGS_ROOT, name, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
}

/**
 * Load a recording's final Virtius results export (virtius-final.json).
 * @param {string} name — recording directory name
 * @returns {Object|null} parsed virtius-final.json, or null if missing
 */
export function loadVirtiusFinal(name) {
  const virtiusPath = path.join(RECORDINGS_ROOT, name, 'virtius-final.json');
  if (!fs.existsSync(virtiusPath)) return null;
  return JSON.parse(fs.readFileSync(virtiusPath, 'utf8'));
}

/**
 * Load a recording's playout events log (events.jsonl), one JSON object per line.
 * Returns an empty array if the file doesn't exist.
 * @param {string} name — recording directory name
 * @returns {Object[]}
 */
export function loadEvents(name) {
  const eventsPath = path.join(RECORDINGS_ROOT, name, 'events.jsonl');
  if (!fs.existsSync(eventsPath)) return [];
  const raw = fs.readFileSync(eventsPath, 'utf8');
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line));
}

/**
 * Find the layout timeline entry active at a given time.
 * @param {Object} meta — parsed meta.json (as returned by loadMeta)
 * @param {number} tMs — time in the recording, in milliseconds
 * @returns {Object|null} the timeline entry, or null if meta/timeline is missing
 */
export function layoutEntryAt(meta, tMs) {
  const timeline = meta && meta.layoutTimeline;
  if (!Array.isArray(timeline) || timeline.length === 0) return null;

  let active = null;
  for (const entry of timeline) {
    if (entry.fromMs <= tMs) {
      active = entry;
    } else {
      break;
    }
  }
  return active;
}

/**
 * Load the full package for a recording: meta, Virtius results, and events,
 * plus a tileFor(event, tMs) lookup bound to this recording's layout timeline.
 * @param {string} name — recording directory name
 * @returns {{
 *   name: string,
 *   meta: Object|null,
 *   virtiusFinal: Object|null,
 *   events: Object[],
 *   tileFor: (event: string, tMs: number) => {x: number, y: number, w: number, h: number}|null
 * }}
 */
export function loadRecordingPackage(name) {
  const meta = loadMeta(name);
  return {
    name,
    meta,
    virtiusFinal: loadVirtiusFinal(name),
    events: loadEvents(name),
    tileFor(event, tMs) {
      const entry = layoutEntryAt(meta, tMs);
      if (!entry || !entry.tiles) return null;
      return entry.tiles[event] || null;
    },
  };
}
