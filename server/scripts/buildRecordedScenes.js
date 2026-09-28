/**
 * Build OBS playback scenes for a recorded meet (recorded-source mode, Step 7b).
 *
 * Creates, idempotently, on the OBS instance behind an obs-websocket-style
 * client (anything with `call(requestType, data)`):
 *   - `Recorded Program`  one ffmpeg media source pointing at the VM path, paused on load
 *   - `Multi View`        scene showing the full recorded frame
 *   - `Cam FX|PH|SR|VT|PB|HB`  one scene per event, cropping that event's tile
 *
 * Crops follow the layout timeline in the recording's meta.json (ISA2-294).
 * `applyLayout(obs, pkg, tMs)` re-crops every Cam scene for the layout active at
 * `tMs`; the show clock (ISA2-296) calls it when it crosses a layout switch.
 * Scenes are ordinary OBS scenes, so the action bus catalog lists them as
 * `scene:Cam FX` with no extra registration.
 *
 * The coordinator drives this through the `recorded:*` socket events, using
 * obsConnectionManager.getConnection(compId). Run directly it connects to
 * OBS_URL (default ws://127.0.0.1:4455) with OBS_WEBSOCKET_PASSWORD.
 */

import { loadRecordingPackage } from '../lib/recordings/recordingPackage.js';

export const RECORDED_SOURCE_NAME = 'Recorded Program';
export const MULTI_VIEW_SCENE = 'Multi View';
export const DEFAULT_RECORDING = 'ecac-2026';
export const DEFAULT_VM_ROOT = '/home/ubuntu/recordings';

// Virtius event name (used in meta.json tiles) -> broadcast abbreviation.
export const EVENT_ABBREVIATIONS = {
  FLOOR: 'FX',
  HORSE: 'PH',
  RINGS: 'SR',
  VAULT: 'VT',
  PBARS: 'PB',
  BAR: 'HB',
};

export const camSceneName = (event) => `Cam ${EVENT_ABBREVIATIONS[event]}`;
export const vmVideoPath = (recording = DEFAULT_RECORDING, root = DEFAULT_VM_ROOT) =>
  `${root}/${recording}/program.mp4`;

const isNotFound = (error) => error?.code === 600 || /not found|does not exist/i.test(error?.message || '');

async function getSceneItemId(obs, sceneName, sourceName) {
  try {
    const res = await obs.call('GetSceneItemId', { sceneName, sourceName });
    return res.sceneItemId;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * Transform that shows `rect` (source pixels) scaled to fill the canvas.
 * A null rect means the full frame. Crop is expressed in the source's own
 * pixels, so meta.json coordinates are rescaled if the media source reports a
 * different size than the recording's nominal width/height.
 */
export function buildTransform({ rect, meta, sourceWidth, sourceHeight, canvasWidth, canvasHeight }) {
  const sx = sourceWidth && meta.width ? sourceWidth / meta.width : 1;
  const sy = sourceHeight && meta.height ? sourceHeight / meta.height : 1;
  const srcW = sourceWidth || meta.width;
  const srcH = sourceHeight || meta.height;
  const left = rect ? Math.round(rect.x * sx) : 0;
  const top = rect ? Math.round(rect.y * sy) : 0;
  const right = rect ? Math.max(0, srcW - Math.round((rect.x + rect.w) * sx)) : 0;
  const bottom = rect ? Math.max(0, srcH - Math.round((rect.y + rect.h) * sy)) : 0;
  return {
    positionX: canvasWidth / 2,
    positionY: canvasHeight / 2,
    alignment: 0, // center
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsAlignment: 0,
    boundsWidth: canvasWidth,
    boundsHeight: canvasHeight,
    cropLeft: left,
    cropTop: top,
    cropRight: right,
    cropBottom: bottom,
  };
}

async function ensureScene(obs, sceneName, existingScenes, actions) {
  if (existingScenes.has(sceneName)) return;
  await obs.call('CreateScene', { sceneName });
  existingScenes.add(sceneName);
  actions.push(`created scene ${sceneName}`);
}

async function ensureSceneItem(obs, sceneName, actions) {
  const existing = await getSceneItemId(obs, sceneName, RECORDED_SOURCE_NAME);
  if (existing != null) return existing;
  const res = await obs.call('CreateSceneItem', { sceneName, sourceName: RECORDED_SOURCE_NAME });
  actions.push(`added ${RECORDED_SOURCE_NAME} to ${sceneName}`);
  return res.sceneItemId;
}

async function ensureTransform(obs, sceneName, sceneItemId, desired, actions) {
  const { sceneItemTransform: current } = await obs.call('GetSceneItemTransform', { sceneName, sceneItemId });
  const same = Object.entries(desired).every(([key, value]) =>
    typeof value === 'number' ? Math.abs((current[key] ?? NaN) - value) < 0.5 : current[key] === value);
  if (same) return false;
  await obs.call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: desired });
  return true;
}

/**
 * Create the media source and scenes if missing. Running it twice changes
 * nothing the second time (`actions` comes back empty).
 * @returns {Promise<{actions: string[], scenes: string[]}>}
 */
export async function buildRecordedScenes(obs, { recording = DEFAULT_RECORDING, videoPath, pkg } = {}) {
  const recorded = pkg || loadRecordingPackage(recording);
  if (!recorded.meta) throw new Error(`Recording "${recording}" has no meta.json`);
  const filePath = videoPath || vmVideoPath(recording);
  const actions = [];

  const { inputs } = await obs.call('GetInputList');
  const inputExists = inputs.some(i => i.inputName === RECORDED_SOURCE_NAME);
  if (!inputExists) {
    // The scene the input is created in is irrelevant; Multi View is created first for it.
    const { scenes } = await obs.call('GetSceneList');
    const sceneNames = new Set(scenes.map(s => s.sceneName));
    await ensureScene(obs, MULTI_VIEW_SCENE, sceneNames, actions);
    await obs.call('CreateInput', {
      sceneName: MULTI_VIEW_SCENE,
      inputName: RECORDED_SOURCE_NAME,
      inputKind: 'ffmpeg_source',
      inputSettings: {
        is_local_file: true,
        local_file: filePath,
        looping: false,
        close_when_inactive: false,
        restart_on_activate: false,
        hw_decode: false,
      },
      sceneItemEnabled: true,
    });
    actions.push(`created input ${RECORDED_SOURCE_NAME} -> ${filePath}`);
    // Paused on load. Best effort: OBS may refuse until the media has opened.
    try {
      await obs.call('TriggerMediaInputAction', {
        inputName: RECORDED_SOURCE_NAME,
        mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
      });
    } catch { /* stays as OBS loaded it */ }
  }

  const { scenes } = await obs.call('GetSceneList');
  const sceneNames = new Set(scenes.map(s => s.sceneName));
  const { baseWidth: canvasWidth, baseHeight: canvasHeight } = await obs.call('GetVideoSettings');

  const events = Object.keys(EVENT_ABBREVIATIONS);
  const wanted = [MULTI_VIEW_SCENE, ...events.map(camSceneName)];
  for (const sceneName of wanted) {
    await ensureScene(obs, sceneName, sceneNames, actions);
    const sceneItemId = await ensureSceneItem(obs, sceneName, actions);
    // Multi View is the full frame. Cam scenes start at the first layout that has tiles.
    const event = events.find(e => camSceneName(e) === sceneName);
    const rect = event ? firstTile(recorded.meta, event) : null;
    if (sceneName === MULTI_VIEW_SCENE || !(await hasCrop(obs, sceneName, sceneItemId))) {
      const { sceneItemTransform } = await obs.call('GetSceneItemTransform', { sceneName, sceneItemId });
      const desired = buildTransform({
        rect, meta: recorded.meta,
        sourceWidth: sceneItemTransform.sourceWidth, sourceHeight: sceneItemTransform.sourceHeight,
        canvasWidth, canvasHeight,
      });
      if (await ensureTransform(obs, sceneName, sceneItemId, desired, actions)) {
        actions.push(`set transform on ${sceneName}`);
      }
    }
  }
  return { actions, scenes: wanted };
}

function firstTile(meta, event) {
  for (const entry of meta.layoutTimeline || []) {
    if (entry.tiles?.[event]) return entry.tiles[event];
  }
  return null;
}

// A Cam scene that already has any crop was set by a previous run or by
// applyLayout; leave it alone so a re-run never fights the show clock.
async function hasCrop(obs, sceneName, sceneItemId) {
  const { sceneItemTransform: t } = await obs.call('GetSceneItemTransform', { sceneName, sceneItemId });
  return t.cropLeft + t.cropTop + t.cropRight + t.cropBottom > 0;
}

/**
 * Re-crop every Cam scene for the layout active at `tMs`.
 * Events with no tile in that layout are hidden in their scene; with no fixed
 * layout at all (the "other" window) every Cam scene shows the full frame.
 * @returns {Promise<{layout: string|null, fromMs: number|null, changed: string[]}>}
 */
export async function applyLayout(obs, pkg, tMs) {
  if (!pkg?.meta) throw new Error('applyLayout needs a loaded recording package');
  const entry = layoutEntryFor(pkg.meta, tMs);
  const { baseWidth: canvasWidth, baseHeight: canvasHeight } = await obs.call('GetVideoSettings');
  const changed = [];

  for (const event of Object.keys(EVENT_ABBREVIATIONS)) {
    const sceneName = camSceneName(event);
    const sceneItemId = await getSceneItemId(obs, sceneName, RECORDED_SOURCE_NAME);
    if (sceneItemId == null) throw new Error(`Scene "${sceneName}" is missing; run buildRecordedScenes first`);
    const noFixedLayout = !entry || Object.keys(entry.tiles || {}).length === 0;
    const rect = noFixedLayout ? null : (entry.tiles[event] || null);
    const hidden = !noFixedLayout && !rect;

    const { sceneItemTransform } = await obs.call('GetSceneItemTransform', { sceneName, sceneItemId });
    const desired = hidden ? null : buildTransform({
      rect, meta: pkg.meta,
      sourceWidth: sceneItemTransform.sourceWidth, sourceHeight: sceneItemTransform.sourceHeight,
      canvasWidth, canvasHeight,
    });
    if (desired && await ensureTransform(obs, sceneName, sceneItemId, desired, [])) changed.push(sceneName);

    const { sceneItemEnabled } = await obs.call('GetSceneItemEnabled', { sceneName, sceneItemId });
    if (sceneItemEnabled === hidden) {
      await obs.call('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: !hidden });
      if (!changed.includes(sceneName)) changed.push(sceneName);
    }
  }
  return { layout: entry?.layout ?? null, fromMs: entry?.fromMs ?? null, changed };
}

function layoutEntryFor(meta, tMs) {
  let active = null;
  for (const e of meta.layoutTimeline || []) {
    if (e.fromMs <= tMs) active = e; else break;
  }
  return active;
}

// CLI: node scripts/buildRecordedScenes.js [recording] [videoPath]
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: OBSWebSocket } = await import('obs-websocket-js');
  const obs = new OBSWebSocket();
  await obs.connect(process.env.OBS_URL || 'ws://127.0.0.1:4455', process.env.OBS_WEBSOCKET_PASSWORD || undefined);
  try {
    const result = await buildRecordedScenes(obs, { recording: process.argv[2] || DEFAULT_RECORDING, videoPath: process.argv[3] });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await obs.disconnect();
  }
}
