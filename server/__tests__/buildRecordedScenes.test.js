import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecordedScenes, applyLayout, buildTransform, RECORDED_SOURCE_NAME, MULTI_VIEW_SCENE,
} from '../scripts/buildRecordedScenes.js';
import { loadRecordingPackage } from '../lib/recordings/recordingPackage.js';

// Minimal in-memory obs-websocket.
function fakeObs() {
  const inputs = new Set();
  const scenes = new Map(); // scene -> Map(sourceName -> item)
  let nextId = 1;
  const notFound = () => Object.assign(new Error('not found'), { code: 600 });
  const item = (s, id) => [...scenes.get(s).values()].find(i => i.id === id);
  const calls = [];
  return {
    calls, scenes,
    async call(type, d = {}) {
      calls.push(type);
      switch (type) {
        case 'GetInputList': return { inputs: [...inputs].map(inputName => ({ inputName })) };
        case 'GetSceneList': return { scenes: [...scenes.keys()].map(sceneName => ({ sceneName })) };
        case 'GetVideoSettings': return { baseWidth: 1920, baseHeight: 1080 };
        case 'CreateScene': scenes.set(d.sceneName, new Map()); return {};
        case 'CreateInput': inputs.add(d.inputName); scenes.get(d.sceneName).set(d.inputName, newItem()); return {};
        case 'CreateSceneItem': { const i = newItem(); scenes.get(d.sceneName).set(d.sourceName, i); return { sceneItemId: i.id }; }
        case 'GetSceneItemId': { const i = scenes.get(d.sceneName)?.get(d.sourceName); if (!i) throw notFound(); return { sceneItemId: i.id }; }
        case 'GetSceneItemTransform': return { sceneItemTransform: { ...item(d.sceneName, d.sceneItemId).t } };
        case 'SetSceneItemTransform': Object.assign(item(d.sceneName, d.sceneItemId).t, d.sceneItemTransform); return {};
        case 'GetSceneItemEnabled': return { sceneItemEnabled: item(d.sceneName, d.sceneItemId).enabled };
        case 'SetSceneItemEnabled': item(d.sceneName, d.sceneItemId).enabled = d.sceneItemEnabled; return {};
        case 'TriggerMediaInputAction': return {};
        default: throw new Error(`unexpected ${type}`);
      }
    },
  };
  function newItem() {
    return { id: nextId++, enabled: true, t: { sourceWidth: 1280, sourceHeight: 720, cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0 } };
  }
}

const pkg = loadRecordingPackage('ecac-2026');

test('buildTransform crops a tile and scales it to the canvas', () => {
  const t = buildTransform({
    rect: { x: 0, y: 0, w: 582, h: 332 }, meta: { width: 1280, height: 720 },
    sourceWidth: 1280, sourceHeight: 720, canvasWidth: 1920, canvasHeight: 1080,
  });
  assert.equal(t.cropRight, 1280 - 582);
  assert.equal(t.cropBottom, 720 - 332);
  assert.equal(t.boundsWidth, 1920);
});

test('build creates source and scenes; second run changes nothing', async () => {
  const obs = fakeObs();
  const first = await buildRecordedScenes(obs, { pkg, videoPath: '/x/program.mp4' });
  assert.ok(first.actions.length > 0);
  assert.deepEqual([...obs.scenes.keys()].sort(),
    [MULTI_VIEW_SCENE, 'Cam FX', 'Cam HB', 'Cam PB', 'Cam PH', 'Cam SR', 'Cam VT'].sort());
  const fx = obs.scenes.get('Cam FX').get(RECORDED_SOURCE_NAME).t;
  assert.equal(fx.cropRight, 698);
  const second = await buildRecordedScenes(obs, { pkg, videoPath: '/x/program.mp4' });
  assert.deepEqual(second.actions, []);
});

test('applyLayout re-crops at a boundary and hides absent tiles', async () => {
  const obs = fakeObs();
  await buildRecordedScenes(obs, { pkg, videoPath: '/x/program.mp4' });
  const at = (s) => obs.scenes.get(s).get(RECORDED_SOURCE_NAME);

  await applyLayout(obs, pkg, 2_400_000);
  assert.equal(at('Cam FX').t.cropRight, 1280 - 582);
  assert.equal(at('Cam PH').enabled, true);

  const r = await applyLayout(obs, pkg, 4_800_000);
  assert.equal(r.layout, '2x2');
  assert.equal(at('Cam FX').t.cropLeft, 28);
  assert.equal(at('Cam FX').t.cropRight, 1280 - 638);
  assert.equal(at('Cam PH').enabled, false);

  const same = await applyLayout(obs, pkg, 4_900_000);
  assert.deepEqual(same.changed, []);
});
