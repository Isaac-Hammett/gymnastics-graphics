/**
 * Xavier control levels tests (ISA2-277)
 *
 * Config: read, validated, changed live. Auto executes above the threshold and
 * only suggests below it, per action type; Full executes; a producer action
 * cancels a pending Xavier action and starts the cooldown; a guardrail refusal
 * stops an auto action (on a real ActionBus with guardrails).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';

import { MockOBSWebSocket } from './helpers/mockOBS.js';
import { createFakeDb } from './helpers/fakeFirebaseDb.js';
import { ActionBus } from '../lib/actionBus.js';
import { Guardrails } from '../lib/guardrails.js';
import {
  XavierControl, validateXavierConfig, actionKind, DEFAULT_XAVIER_CONFIG, XAVIER_CONFIG_PATH, AUTO_SENDER
} from '../lib/xavier/index.js';

const COMP_ID = 'ecac-2026-agent-test';

/** Timers the test runs by hand. */
function manualTimers() {
  const pending = new Map();
  let next = 1;
  return {
    setTimer: (fn) => { const id = next++; pending.set(id, fn); return id; },
    clearTimer: (id) => { pending.delete(id); },
    count: () => pending.size,
    async flush() {
      const fns = [...pending.values()];
      pending.clear();
      for (const fn of fns) await fn();
    }
  };
}

class FakeService extends EventEmitter {
  constructor() { super(); this.started = false; }
  start() { this.started = true; }
  stop() { this.started = false; }
}

class FakeBus extends EventEmitter {
  constructor() { super(); this.calls = []; this.ack = { ok: true, error: null, guardrail: null }; this.observed = { programScene: null, currentGraphic: null }; }
  getObserved() { return this.observed; }
  async execute(req) {
    this.calls.push(req);
    const ack = { actionId: req.actionId, ...this.ack };
    this.emit('executed', { ...ack, sender: req.sender, recommendationId: req.recommendationId });
    return ack;
  }
}

function recs(actionId, probability, { holdProbability = 0.05, version = 1 } = {}) {
  return {
    compId: COMP_ID, stateVersion: version, holdProbability, trigger: 'Score posted',
    recommendations: [{ recommendationId: `${COMP_ID}:${version}:${actionId}`, rank: 1, actionId, label: actionId, probability }]
  };
}

function setup(config = {}, { bus = new FakeBus(), clock = { t: 1_000_000 } } = {}) {
  const timers = manualTimers();
  const service = new FakeService();
  const decisions = [];
  const ctl = new XavierControl({
    compId: COMP_ID, service, getBus: () => bus, config,
    onDecision: (r) => decisions.push(r), now: () => clock.t,
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, log: () => {}
  });
  ctl.start();
  return { ctl, bus, service, timers, decisions, clock };
}

describe('xavier config', () => {
  it('defaults: off, scene 0.92, graphic 0.8, cooldown 10 s', () => {
    const { config, errors } = validateXavierConfig(null);
    assert.deepEqual(errors, []);
    assert.equal(config.mode, 'off');
    assert.deepEqual(config.thresholds, { scene: 0.92, graphic: 0.8 });
    assert.equal(config.cooldownMs, 10000);
    assert.equal(DEFAULT_XAVIER_CONFIG.mode, 'off');
  });

  it('rejects bad fields and keeps their defaults', () => {
    const { config, errors } = validateXavierConfig({ mode: 'yolo', thresholds: { scene: 2, graphic: 0.5 }, cooldownMs: -1 });
    assert.equal(config.mode, 'off', 'a bad mode never turns auto on');
    assert.deepEqual(config.thresholds, { scene: 0.92, graphic: 0.5 });
    assert.equal(config.cooldownMs, 10000);
    assert.equal(errors.length, 3);
  });

  it('actionKind maps IDs to action types', () => {
    assert.equal(actionKind('scene:Cam FX'), 'scene');
    assert.equal(actionKind('graphic:team1-roster'), 'graphic');
    assert.equal(actionKind('graphic:clear'), 'graphic');
    assert.equal(actionKind('hold'), null);
  });

  it('reads config from Firebase, follows live changes, and the mode toggle writes it', async () => {
    const db = createFakeDb();
    db._seed(XAVIER_CONFIG_PATH(COMP_ID), { mode: 'auto', thresholds: { scene: 0.95, graphic: 0.7 }, cooldownMs: 5000 });
    const service = new FakeService();
    const ctl = new XavierControl({ compId: COMP_ID, service, firebase: db, getBus: () => null, log: () => {} });
    ctl.start();
    await new Promise(r => setImmediate(r));
    assert.equal(ctl.getConfig().mode, 'auto');
    assert.equal(ctl.getConfig().thresholds.graphic, 0.7);
    assert.equal(ctl.getConfig().cooldownMs, 5000);
    assert.equal(service.started, true, 'auto runs the service');

    const res = await ctl.setMode('suggest');
    assert.equal(res.ok, true);
    assert.equal(res.persisted, true);
    assert.equal((await db.ref(`${XAVIER_CONFIG_PATH(COMP_ID)}/mode`).once('value')).val(), 'suggest');
    assert.equal(ctl.getConfig().mode, 'suggest');

    await ctl.setMode('off');
    assert.equal(service.started, false, 'off stops the service');
    assert.deepEqual(await ctl.setMode('turbo'), { ok: false, error: 'invalid_mode' });
    ctl.stop();
  });
});

describe('auto above threshold', () => {
  it('executes a graphic above its threshold, with sender xavier-auto, and logs outcome auto', async () => {
    const { ctl, bus, timers, decisions } = setup({ mode: 'auto' });
    const d = ctl.handleRecommendations(recs('graphic:team1-roster', 0.85));
    assert.equal(d.execute, true);
    assert.equal(ctl.getState().pending.actionId, 'graphic:team1-roster');
    await timers.flush();
    assert.equal(bus.calls.length, 1);
    assert.equal(bus.calls[0].sender, AUTO_SENDER);
    assert.equal(bus.calls[0].force, undefined, 'never forces');
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].outcome, 'auto');
    assert.equal(decisions[0].confidence, 0.85);
    assert.equal(decisions[0].threshold, 0.8);
    assert.equal(ctl.getState().recent[0].outcome, 'auto');
  });

  it('only suggests below the threshold, per action type', async () => {
    const { ctl, bus, timers } = setup({ mode: 'auto' });
    // 0.85 clears the graphic bar (0.8) but not the scene bar (0.92).
    const scene = ctl.handleRecommendations(recs('scene:Cam PH', 0.85));
    assert.equal(scene.execute, false);
    assert.equal(scene.reason, 'below threshold');
    const graphic = ctl.handleRecommendations(recs('graphic:team1-roster', 0.75, { version: 2 }));
    assert.equal(graphic.execute, false);
    await timers.flush();
    assert.equal(bus.calls.length, 0);

    const sceneHigh = ctl.handleRecommendations(recs('scene:Cam PH', 0.95, { version: 3 }));
    assert.equal(sceneHigh.execute, true);
    await timers.flush();
    assert.deepEqual(bus.calls.map(c => c.actionId), ['scene:Cam PH']);
  });

  it('suggest and off never execute', async () => {
    for (const mode of ['suggest', 'off']) {
      const { ctl, bus, timers } = setup({ mode });
      assert.equal(ctl.handleRecommendations(recs('graphic:team1-roster', 0.99)).execute, false);
      await timers.flush();
      assert.equal(bus.calls.length, 0, mode);
    }
  });

  it('does not run the same recommendation twice, or an action already on air', async () => {
    const { ctl, bus, timers } = setup({ mode: 'auto' });
    ctl.handleRecommendations(recs('graphic:team1-roster', 0.9));
    await timers.flush();
    assert.equal(ctl.handleRecommendations(recs('graphic:team1-roster', 0.9)).reason, 'already handled');
    bus.observed = { programScene: { sceneName: 'Cam FX' }, currentGraphic: null };
    assert.equal(ctl.handleRecommendations(recs('scene:Cam FX', 0.99, { version: 2 })).reason, 'already on air');
    assert.equal(bus.calls.length, 1);
  });
});

describe('full', () => {
  it('executes what it recommends, even below the auto thresholds', async () => {
    const { ctl, bus, timers, decisions } = setup({ mode: 'full' });
    assert.equal(ctl.handleRecommendations(recs('scene:Cam PH', 0.4, { holdProbability: 0.1 })).execute, true);
    await timers.flush();
    assert.equal(bus.calls[0].actionId, 'scene:Cam PH');
    assert.equal(decisions[0].outcome, 'auto');
    assert.equal(decisions[0].mode, 'full');
  });

  it('holds when hold is more likely than any action', async () => {
    const { ctl } = setup({ mode: 'full' });
    assert.equal(ctl.handleRecommendations(recs('scene:Cam PH', 0.2, { holdProbability: 0.7 })).reason, 'hold is more likely');
  });
});

describe('producer override', () => {
  it('a producer action cancels a pending Xavier action and starts the cooldown', async () => {
    const { ctl, bus, timers, decisions, clock } = setup({ mode: 'auto', cooldownMs: 10000 });
    ctl.handleRecommendations(recs('graphic:team1-roster', 0.9));
    assert.ok(ctl.getState().pending);

    await bus.execute({ actionId: 'scene:Cam FX', sender: 'producer' });
    assert.equal(ctl.getState().pending, null);
    assert.equal(decisions[0].outcome, 'cancelled');
    assert.match(decisions[0].reason, /producer override/);
    assert.equal(ctl.getState().cooldownUntil, clock.t + 10000);
    await timers.flush();
    assert.deepEqual(bus.calls.map(c => c.sender), ['producer'], 'the Xavier action never ran');

    // During the cooldown Xavier only suggests.
    clock.t += 5000;
    assert.equal(ctl.handleRecommendations(recs('scene:Cam PH', 0.99, { version: 2 })).reason, 'cooldown');
    // After it, auto resumes.
    clock.t += 5001;
    assert.equal(ctl.handleRecommendations(recs('scene:Cam PH', 0.99, { version: 3 })).execute, true);
  });

  it('a change the bus did not make (a cut in OBS) counts as a producer action', () => {
    const { ctl, bus } = setup({ mode: 'auto' });
    ctl.handleRecommendations(recs('graphic:team1-roster', 0.9));
    bus.emit('humanAction', { kind: 'scene', sceneName: 'Cam FX', source: 'human' });
    assert.equal(ctl.getState().pending, null);
    assert.ok(ctl.inCooldown());
  });

  it("Xavier's own commands (Take, auto) do not start the cooldown", async () => {
    const { ctl, bus } = setup({ mode: 'auto' });
    await bus.execute({ actionId: 'graphic:team1-roster', sender: 'xavier-suggest' });
    assert.equal(ctl.inCooldown(), false);
  });

  it('dropping to Suggest or Off cancels a pending action', async () => {
    const { ctl, bus, timers, decisions } = setup({ mode: 'auto' });
    ctl.handleRecommendations(recs('graphic:team1-roster', 0.9));
    await ctl.setMode('suggest');
    await timers.flush();
    assert.equal(bus.calls.length, 0);
    assert.equal(decisions[0].outcome, 'cancelled');
    assert.equal(decisions[0].reason, 'mode suggest');
  });
});

describe('guardrails stop auto actions (real ActionBus)', () => {
  class FakeConnectionManager extends EventEmitter {
    constructor(connection) { super(); this.connection = connection; }
    getConnection(compId) { return compId === COMP_ID ? this.connection : null; }
  }
  let db;
  beforeEach(() => {
    db = createFakeDb();
    db._seed(`competitions/${COMP_ID}/config`, { compType: 'womens-dual', team1Name: 'Navy', team2Name: 'Army' });
  });

  function realBus() {
    const bus = new ActionBus({
      compId: COMP_ID, firebase: db, obsConnectionManager: new FakeConnectionManager(new MockOBSWebSocket()),
      guardrailRules: new Guardrails({ compId: COMP_ID, firebase: db }),
      sceneConfirmTimeoutMs: 150, obsCallTimeoutMs: 150,
    });
    bus.startObserving();
    return bus;
  }

  it('fires a graphic above threshold through the bus and currentGraphic changes', async () => {
    const bus = realBus();
    await bus.buildCatalog();
    const { ctl, timers, decisions } = setup({ mode: 'auto' }, { bus });
    ctl.handleRecommendations(recs('graphic:team1-roster', 0.9));
    await timers.flush();
    assert.equal(decisions[0].outcome, 'auto', JSON.stringify(decisions[0]));
    const onAir = (await db.ref(`competitions/${COMP_ID}/currentGraphic`).once('value')).val();
    assert.equal(onAir.graphicId || onAir.graphic, 'team1-roster');
    bus.shutdown();
  });

  it('a refusal is logged as refused, is not retried, and never forces', async () => {
    const bus = realBus();
    await bus.buildCatalog();
    // Hold a shot: the producer just cut, so minShotHoldMs refuses any cut for 3 s.
    await bus.execute({ actionId: 'scene:BRB', sender: 'producer' });
    const { ctl, timers, decisions } = setup({ mode: 'full', cooldownMs: 0 }, { bus });
    const refused = [];
    bus.on('refused', r => refused.push(r));

    ctl.handleRecommendations(recs('scene:Starting Soon', 0.99));
    await timers.flush();
    assert.equal(decisions.at(-1).outcome, 'refused');
    assert.equal(decisions.at(-1).guardrail.rule, 'minShotHoldMs');
    assert.equal(refused.length, 1);
    assert.equal(refused[0].sender, AUTO_SENDER);

    // The same recommendation again: not retried.
    assert.equal(ctl.handleRecommendations(recs('scene:Starting Soon', 0.99)).reason, 'already handled');
    await timers.flush();
    assert.equal(refused.length, 1);
    assert.equal(ctl.getState().recent[0].outcome, 'refused');
    bus.shutdown();
  });
});
