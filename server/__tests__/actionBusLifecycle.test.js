/**
 * Action Bus lifecycle and coverage tests (ISA2-302)
 *
 * Covers disposal when a competition goes idle (listeners released, no
 * MaxListeners warning across 12 competitions), the handle the rundown engine
 * holds, custom graphics in the catalog, prebuilt payloads for trusted
 * senders, and the bounded Firebase read used by socket handlers.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';

import { createFakeDb } from './helpers/fakeFirebaseDb.js';
import {
  getOrCreateActionBus,
  getActionBus,
  getAllActionBuses,
  disposeActionBus,
  releaseActionBusIfIdle,
  actionBusHandle,
} from '../lib/actionBus.js';
import { onceValue } from '../lib/firebaseRead.js';

const COMP_ID = 'ecac-2026-agent-test';
const COMP_IDS = Array.from({ length: 12 }, (_, i) => `lifecycle-comp-${i + 1}`);
const graphicPath = (compId) => `competitions/${compId}/currentGraphic`;

/** A connection that accepts calls but emits nothing itself. */
function silentObs(startScene = 'Starting Soon') {
  return {
    current: startScene,
    async call(method, params) {
      if (method === 'GetCurrentProgramScene') return { currentProgramSceneName: this.current };
      if (method === 'GetSceneList') return { scenes: [{ sceneName: 'Starting Soon' }, { sceneName: 'BRB' }] };
      if (method === 'SetCurrentProgramScene') this.current = params.sceneName;
      return {};
    },
    on() {}, off() {},
  };
}

/** One manager for every competition, as in the coordinator. */
class SharedManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
  }
  getConnection(compId) {
    return this.connections.get(compId) || null;
  }
  forward(compId, eventName, data) {
    this.emit('obsEvent', { compId, eventName, data });
  }
}

function captureWarnings() {
  const warnings = [];
  const onWarning = (w) => warnings.push(w);
  process.on('warning', onWarning);
  return {
    warnings,
    async stop() {
      // process warnings are emitted on the next tick
      await new Promise(resolve => setImmediate(resolve));
      process.off('warning', onWarning);
      return warnings.filter(w => w.name === 'MaxListenersExceededWarning');
    },
  };
}

afterEach(() => {
  for (const compId of [...getAllActionBuses().keys()]) disposeActionBus(compId);
});

describe('ActionBus disposal', () => {
  it('releases obsEvent and currentGraphic listeners across 12 competitions without a MaxListeners warning', async () => {
    const capture = captureWarnings();
    const manager = new SharedManager();
    const db = createFakeDb();

    for (const compId of COMP_IDS) {
      manager.connections.set(compId, silentObs());
      getOrCreateActionBus(compId, { firebase: db, obsConnectionManager: manager, guardrailRules: null });
    }

    // One shared listener however many competitions are live.
    assert.equal(manager.listenerCount('obsEvent'), 1);
    for (const compId of COMP_IDS) assert.equal(db._listenerCount(graphicPath(compId)), 1);

    // Every competition confirms a scene switch concurrently through the
    // forwarded event, and each sees only its own.
    const pending = COMP_IDS.map(compId => getActionBus(compId).execute({
      actionId: 'scene:BRB', sender: 'producer', uncatalogued: true,
    }));
    await new Promise(resolve => setTimeout(resolve, 10));
    for (const compId of COMP_IDS) manager.forward(compId, 'CurrentProgramSceneChanged', { sceneName: 'BRB' });
    const acks = await Promise.all(pending);
    assert.ok(acks.every(a => a.ok), JSON.stringify(acks.filter(a => !a.ok)));
    for (const compId of COMP_IDS) {
      assert.equal(getActionBus(compId).getObserved().programScene.sceneName, 'BRB');
    }

    // Each competition's last client leaves.
    for (const compId of COMP_IDS) {
      assert.equal(releaseActionBusIfIdle(compId, { clientsRemaining: 0, busy: false }), true);
      assert.equal(getActionBus(compId), null);
      assert.equal(db._listenerCount(graphicPath(compId)), 0, `${compId} currentGraphic listener released`);
    }
    assert.equal(manager.listenerCount('obsEvent'), 0, 'obsEvent listener released');

    assert.deepEqual(await capture.stop(), []);
  });

  it('survives connect/disconnect churn without accumulating listeners', async () => {
    const capture = captureWarnings();
    const manager = new SharedManager();
    const db = createFakeDb();

    for (let round = 0; round < 3; round++) {
      for (const compId of COMP_IDS) {
        getOrCreateActionBus(compId, { firebase: db, obsConnectionManager: manager, guardrailRules: null });
      }
      for (const compId of COMP_IDS) releaseActionBusIfIdle(compId);
    }

    assert.equal(manager.listenerCount('obsEvent'), 0);
    assert.equal(getAllActionBuses().size, 0);
    assert.deepEqual(await capture.stop(), []);
  });

  it('keeps the bus while clients remain or a rundown is running', () => {
    const manager = new SharedManager();
    getOrCreateActionBus(COMP_ID, { firebase: createFakeDb(), obsConnectionManager: manager, guardrailRules: null });

    assert.equal(releaseActionBusIfIdle(COMP_ID, { clientsRemaining: 2 }), false);
    assert.equal(releaseActionBusIfIdle(COMP_ID, { clientsRemaining: 0, busy: true }), false);
    assert.ok(getActionBus(COMP_ID));
    assert.equal(manager.listenerCount('obsEvent'), 1);

    assert.equal(releaseActionBusIfIdle(COMP_ID), true);
    assert.equal(releaseActionBusIfIdle(COMP_ID), false, 'nothing left to release');
  });

  it('gives the rundown engine a handle that outlives disposal', async () => {
    const db = createFakeDb();
    const options = { firebase: db, guardrailRules: null };
    const first = getOrCreateActionBus(COMP_ID, options);
    const handle = actionBusHandle(COMP_ID, options);

    disposeActionBus(COMP_ID);
    const ack = await handle.execute({ actionId: 'graphic:clear', sender: 'rundown', uncatalogued: true });

    assert.equal(ack.ok, true);
    const second = getActionBus(COMP_ID);
    assert.ok(second && second !== first, 'a fresh bus was created on demand');
    assert.equal(db.ref(graphicPath(COMP_ID)) && (await db.ref(graphicPath(COMP_ID)).once()).val().graphic, 'clear');
  });
});

describe('ActionBus coverage', () => {
  function seed(db) {
    db._seed(`competitions/${COMP_ID}/config`, { compType: 'womens-dual', team1Name: 'Navy', team2Name: 'Army' });
    db._seed(`competitions/${COMP_ID}/customGraphics`, {
      '-Nabc': { label: 'Sponsor Reel', url: 'https://example.com/reel.html' },
      '-Ndef': { label: 'No URL yet' },
    });
    return db;
  }

  it('lists competitions/{id}/customGraphics as graphic:custom-* and fires them', async () => {
    const db = seed(createFakeDb());
    const bus = getOrCreateActionBus(COMP_ID, { firebase: db, guardrailRules: null });

    const catalog = await bus.buildCatalog();
    const custom = catalog.actions.filter(a => a.id.startsWith('graphic:custom-'));
    assert.deepEqual(custom.map(a => a.id), ['graphic:custom--Nabc']);
    assert.equal(custom[0].label, 'Sponsor Reel');
    assert.equal(custom[0].category, 'custom');
    assert.deepEqual(custom[0].params, { graphicId: 'custom--Nabc', customKey: '-Nabc' });

    // Xavier stays inside the catalog, and custom graphics are in it now.
    const ack = await bus.execute({ actionId: 'graphic:custom--Nabc', sender: 'xavier' });
    assert.equal(ack.ok, true, JSON.stringify(ack));
    const written = (await db.ref(graphicPath(COMP_ID)).once()).val();
    assert.equal(written.graphic, 'custom');
    assert.equal(written.graphicId, 'custom--Nabc');
    assert.equal(written.renderer, 'output');
    assert.equal(written.data.customUrl, 'https://example.com/reel.html');
    assert.equal(written.data.customLabel, 'Sponsor Reel');
  });

  it('writes a prebuilt payload for trusted senders only', async () => {
    const db = seed(createFakeDb());
    const bus = getOrCreateActionBus(COMP_ID, { firebase: db, guardrailRules: null });
    const payload = {
      graphic: 'rotation-slate',
      graphicId: 'rotation-slate-r2',
      renderer: 'output',
      data: { rotation: '2', layout: 'classic' },
    };

    const ack = await bus.execute({
      actionId: 'graphic:rotation-slate-r2', sender: 'producer', uncatalogued: true, params: { payload },
    });
    assert.equal(ack.ok, true);
    const written = (await db.ref(graphicPath(COMP_ID)).once()).val();
    assert.deepEqual({ ...written, timestamp: undefined }, { ...payload, timestamp: undefined });
    assert.equal(typeof written.timestamp, 'number');
    assert.equal(bus.getObserved().currentGraphic.source, 'bus');

    // A catalogued (untrusted) sender cannot smuggle a payload in.
    await bus.execute({
      actionId: 'graphic:clear', sender: 'xavier', params: { payload: { graphic: 'evil', data: {} } },
    });
    assert.equal((await db.ref(graphicPath(COMP_ID)).once()).val().graphic, 'clear');
  });
});

describe('onceValue', () => {
  it('resolves the snapshot when Firebase answers', async () => {
    const db = createFakeDb({ a: { b: 1 } });
    assert.equal((await onceValue(db.ref('a/b'))).val(), 1);
  });

  it('rejects with firebase_timeout when a read never settles', async () => {
    const hanging = { key: 'config', once: () => new Promise(() => {}) };
    await assert.rejects(onceValue(hanging, 30), (error) => {
      assert.equal(error.code, 'firebase_timeout');
      return true;
    });
  });
});
