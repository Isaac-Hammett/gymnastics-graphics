/**
 * Guardrails Tests (ISA2-273)
 *
 * Each rule: allow, deny, and a human `force` override. Then config (defaults,
 * Firebase, a rule switched off per competition) and enforcement on the action
 * bus: a refused command never reaches OBS or Firebase, is broadcast as
 * `action:refused`, and Xavier can never force.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';

import { MockOBSWebSocket } from './helpers/mockOBS.js';
import { createFakeDb } from './helpers/fakeFirebaseDb.js';
import { ActionBus, ACTION_ERRORS } from '../lib/actionBus.js';
import {
  Guardrails,
  DEFAULT_GUARDRAIL_CONFIG,
  GUARDRAIL_CONFIG_PATH,
  evaluateGuardrails,
  graphicCategory,
  isXavierSender,
  resolveGuardrailConfig,
} from '../lib/guardrails.js';

const COMP_ID = 'ecac-2026-agent-test';
const NOW = 1_000_000;

const scene = (sceneName) => ({ id: `scene:${sceneName}`, kind: 'scene', params: { sceneName } });
const graphic = (graphicId) => ({ id: `graphic:${graphicId}`, kind: 'graphic', params: { graphicId } });

/** Config with only the named rule on, so each test sees one rule. */
function only(ruleName, params = {}) {
  const rules = {};
  for (const name of Object.keys(DEFAULT_GUARDRAIL_CONFIG.rules)) {
    rules[name] = { enabled: name === ruleName, ...(name === ruleName ? params : {}) };
  }
  return resolveGuardrailConfig({ enabled: true, rules });
}

/** An obsCall over a scene -> items map and an input -> mediaState map. */
function fakeObsCall(scenes, mediaStates) {
  return async (name, args) => {
    if (name === 'GetSceneItemList') return { sceneItems: scenes[args.sceneName] || [] };
    if (name === 'GetMediaInputStatus') return { mediaState: mediaStates[args.inputName] };
    return {};
  };
}

const onProgram = (sceneName) => ({ programScene: { sceneName, at: NOW - 100 }, currentGraphic: null });

// -----------------------------------------------------------------------------

describe('guardrail helpers', () => {
  it('recognises every Xavier sender', () => {
    assert.equal(isXavierSender('xavier'), true);
    assert.equal(isXavierSender('xavier-suggest'), true);
    assert.equal(isXavierSender('xavier-auto'), true);
    assert.equal(isXavierSender('producer'), false);
    assert.equal(isXavierSender('rundown'), false);
    assert.equal(isXavierSender(undefined), false);
  });

  it('maps per-team graphic IDs to their registry category', () => {
    assert.equal(graphicCategory('team2-roster'), 'full-screen-cards');
    assert.equal(graphicCategory('team1-coaches'), 'lower-thirds');
    assert.equal(graphicCategory('leaderboard-fx'), 'full-screen-cards');
    assert.equal(graphicCategory('clear'), null);
    assert.equal(graphicCategory('my-custom-thing'), null);
  });
});

describe('minShotHoldMs', () => {
  const config = only('minShotHoldMs', { holdMs: 3000 });

  it('allows a cut once the shot has been held long enough', async () => {
    const v = await evaluateGuardrails(scene('Cam 2'), {
      sender: 'xavier-auto', now: NOW, lastProgramChangeAt: NOW - 3500, observed: onProgram('Cam 1'),
    }, config);
    assert.equal(v.allow, true);
  });

  it('allows when the bus has never seen a program change', async () => {
    const v = await evaluateGuardrails(scene('Cam 2'), { sender: 'producer', now: NOW }, config);
    assert.equal(v.allow, true);
  });

  it('denies a cut within the hold time, for any sender', async () => {
    for (const sender of ['producer', 'rundown', 'xavier-suggest']) {
      const v = await evaluateGuardrails(scene('Cam 2'), {
        sender, now: NOW, lastProgramChangeAt: NOW - 1000, observed: onProgram('Cam 1'),
      }, config);
      assert.equal(v.allow, false, sender);
      assert.equal(v.rule, 'minShotHoldMs');
      assert.match(v.reason, /1000ms.*3000ms/);
    }
  });

  it('lets a human force through and reports what it overrode', async () => {
    const v = await evaluateGuardrails(scene('Cam 2'), {
      sender: 'producer', force: true, now: NOW, lastProgramChangeAt: NOW - 1000, observed: onProgram('Cam 1'),
    }, config);
    assert.equal(v.allow, true);
    assert.deepEqual(v.overridden.map(o => o.rule), ['minShotHoldMs']);
  });

  it('ignores force from Xavier', async () => {
    const v = await evaluateGuardrails(scene('Cam 2'), {
      sender: 'xavier-auto', force: true, now: NOW, lastProgramChangeAt: NOW - 1000,
    }, config);
    assert.equal(v.allow, false);
  });
});

describe('noCutDuringRoutine', () => {
  const config = only('noCutDuringRoutine');
  const routine = { status: 'in_progress', confidence: 0.95, event: 'FX', athlete: 'Jane Doe', sceneNames: ['Cam FX', 'Cam FX Wide'] };

  it('allows a cut when no routine is in progress', async () => {
    const v = await evaluateGuardrails(scene('Cam VT'), {
      sender: 'xavier-auto', routine: { status: 'idle', confidence: 0.99 }, observed: onProgram('Cam FX'),
    }, config);
    assert.equal(v.allow, true);
  });

  it('allows the cut when unsure (no state, or low confidence)', async () => {
    const none = await evaluateGuardrails(scene('Cam VT'), { sender: 'xavier-auto', routine: null }, config);
    const low = await evaluateGuardrails(scene('Cam VT'), {
      sender: 'xavier-auto', routine: { ...routine, confidence: 0.5 },
    }, config);
    const missing = await evaluateGuardrails(scene('Cam VT'), {
      sender: 'xavier-auto', routine: { status: 'in_progress' },
    }, config);
    assert.equal(none.allow, true);
    assert.equal(low.allow, true);
    assert.equal(missing.allow, true);
  });

  it("allows a cut between the routine's own event shots", async () => {
    const v = await evaluateGuardrails(scene('Cam FX Wide'), {
      sender: 'xavier-auto', routine, observed: onProgram('Cam FX'),
    }, config);
    assert.equal(v.allow, true);
  });

  it('denies cutting away from a routine in progress', async () => {
    const v = await evaluateGuardrails(scene('Cam VT'), {
      sender: 'rundown', routine, observed: onProgram('Cam FX'),
    }, config);
    assert.equal(v.allow, false);
    assert.equal(v.rule, 'noCutDuringRoutine');
    assert.match(v.reason, /Jane Doe on FX/);
  });

  it('lets a human force through', async () => {
    const v = await evaluateGuardrails(scene('Cam VT'), {
      sender: 'producer', force: true, routine, observed: onProgram('Cam FX'),
    }, config);
    assert.equal(v.allow, true);
    assert.deepEqual(v.overridden.map(o => o.rule), ['noCutDuringRoutine']);
  });
});

describe('noGraphicStacking', () => {
  const config = only('noGraphicStacking');
  const onAir = (graphicId) => ({ programScene: null, currentGraphic: { graphicId } });

  it('allows a graphic when nothing is on air, a clear, or a same-category swap', async () => {
    const empty = await evaluateGuardrails(graphic('team1-coaches'), { sender: 'xavier-auto', observed: onAir(null) }, config);
    const cleared = await evaluateGuardrails(graphic('team1-coaches'), { sender: 'xavier-auto', observed: onAir('clear') }, config);
    const clear = await evaluateGuardrails(graphic('clear'), { sender: 'xavier-auto', observed: onAir('team1-roster') }, config);
    const swap = await evaluateGuardrails(graphic('team2-roster'), { sender: 'xavier-auto', observed: onAir('team1-roster') }, config);
    assert.equal(empty.allow, true);
    assert.equal(cleared.allow, true);
    assert.equal(clear.allow, true);
    assert.equal(swap.allow, true);
  });

  it('denies a graphic of a different category on top of an on-air one', async () => {
    const v = await evaluateGuardrails(graphic('team1-coaches'), {
      sender: 'xavier-suggest', observed: onAir('team2-roster'),
    }, config);
    assert.equal(v.allow, false);
    assert.equal(v.rule, 'noGraphicStacking');
    assert.match(v.reason, /full-screen-cards.*lower-thirds/);
  });

  it('lets a human force through', async () => {
    const v = await evaluateGuardrails(graphic('team1-coaches'), {
      sender: 'producer', force: true, observed: onAir('team2-roster'),
    }, config);
    assert.equal(v.allow, true);
    assert.deepEqual(v.overridden.map(o => o.rule), ['noGraphicStacking']);
  });
});

describe('cameraMustHaveSignal', () => {
  const config = only('cameraMustHaveSignal');
  const scenes = {
    'Cam 1': [{ sourceName: 'Camera 1 SRT', inputKind: 'ffmpeg_source', sceneItemEnabled: true }],
    'Cam 2': [
      { sourceName: 'Frame', inputKind: 'browser_source', sceneItemEnabled: true },
      { sourceName: 'Camera 2 SRT', inputKind: 'ffmpeg_source', sceneItemEnabled: true },
    ],
    'Cam 2 Hidden': [{ sourceName: 'Camera 2 SRT', inputKind: 'ffmpeg_source', sceneItemEnabled: false }],
    'Nested': [{ sourceName: 'Cam 2', sourceType: 'OBS_SOURCE_TYPE_SCENE', sceneItemEnabled: true }],
  };
  const obsCall = fakeObsCall(scenes, {
    'Camera 1 SRT': 'OBS_MEDIA_STATE_PLAYING',
    'Camera 2 SRT': 'OBS_MEDIA_STATE_ERROR',
  });

  it('allows a scene whose camera is playing, or whose dead camera is hidden', async () => {
    assert.equal((await evaluateGuardrails(scene('Cam 1'), { sender: 'xavier-auto', obsCall }, config)).allow, true);
    assert.equal((await evaluateGuardrails(scene('Cam 2 Hidden'), { sender: 'xavier-auto', obsCall }, config)).allow, true);
  });

  it('denies a scene whose camera has no signal, nested scenes included', async () => {
    for (const name of ['Cam 2', 'Nested']) {
      const v = await evaluateGuardrails(scene(name), { sender: 'producer', obsCall }, config);
      assert.equal(v.allow, false, name);
      assert.equal(v.rule, 'cameraMustHaveSignal');
      assert.match(v.reason, /Camera 2 SRT.*OBS_MEDIA_STATE_ERROR/);
    }
  });

  it('allows when OBS cannot answer (unsure)', async () => {
    const broken = async () => { throw new Error('socket closed'); };
    const v = await evaluateGuardrails(scene('Cam 2'), { sender: 'xavier-auto', obsCall: broken }, config);
    assert.equal(v.allow, true);
    const noObs = await evaluateGuardrails(scene('Cam 2'), { sender: 'xavier-auto', obsCall: null }, config);
    assert.equal(noObs.allow, true);
  });

  it('lets a human force through', async () => {
    const v = await evaluateGuardrails(scene('Cam 2'), { sender: 'producer', force: true, obsCall }, config);
    assert.equal(v.allow, true);
    assert.deepEqual(v.overridden.map(o => o.rule), ['cameraMustHaveSignal']);
  });
});

describe('guardrail config', () => {
  it('uses the defaults when config is missing: all four on, hold 3000ms', () => {
    const config = resolveGuardrailConfig(null);
    assert.equal(config.enabled, true);
    assert.deepEqual(Object.keys(config.rules).sort(),
      ['cameraMustHaveSignal', 'minShotHoldMs', 'noCutDuringRoutine', 'noGraphicStacking']);
    for (const rule of Object.values(config.rules)) assert.equal(rule.enabled, true);
    assert.equal(config.rules.minShotHoldMs.holdMs, 3000);
  });

  it('reads config from Firebase and switches a rule off per competition', async () => {
    const db = createFakeDb();
    const rules = new Guardrails({ compId: COMP_ID, firebase: db });
    rules.start();
    assert.equal(rules.getConfig().source, 'defaults');

    const ctx = { sender: 'xavier-auto', now: NOW, lastProgramChangeAt: NOW - 1000 };
    assert.equal((await rules.check(scene('BRB'), ctx)).allow, false, 'defaults enforce the hold');

    await db.ref(GUARDRAIL_CONFIG_PATH(COMP_ID)).set({ enabled: true, rules: { minShotHoldMs: { enabled: false } } });
    const config = rules.getConfig();
    assert.equal(config.source, 'firebase');
    assert.equal(config.rules.minShotHoldMs.enabled, false);
    assert.equal(config.rules.noGraphicStacking.enabled, true, 'other rules keep their defaults');
    assert.equal((await rules.check(scene('BRB'), ctx)).allow, true, 'a switched-off rule no longer refuses');

    // A different hold time is a param, not a code change.
    await db.ref(GUARDRAIL_CONFIG_PATH(COMP_ID)).set({ rules: { minShotHoldMs: { holdMs: 500 } } });
    assert.equal(rules.getConfig().rules.minShotHoldMs.holdMs, 500);
    assert.equal((await rules.check(scene('BRB'), ctx)).allow, true);

    // enabled: false switches every rule off for the competition.
    await db.ref(GUARDRAIL_CONFIG_PATH(COMP_ID)).set({ enabled: false });
    assert.equal((await rules.check(graphic('team1-coaches'), {
      sender: 'xavier-auto', observed: { currentGraphic: { graphicId: 'team2-roster' } },
    })).allow, true);
    rules.stop();
  });
});

// -----------------------------------------------------------------------------
// Enforcement on the action bus
// -----------------------------------------------------------------------------

class FakeConnectionManager extends EventEmitter {
  constructor(connection) { super(); this.connection = connection; }
  getConnection(compId) { return compId === COMP_ID ? this.connection : null; }
}

function createFakeIo() {
  const broadcasts = [];
  return { broadcasts, to: (room) => ({ emit: (event, data) => broadcasts.push({ room, event, data }) }) };
}

function makeBus({ db, config } = {}) {
  const obs = new MockOBSWebSocket();
  const io = createFakeIo();
  const manager = new FakeConnectionManager(obs);
  const guardrailRules = new Guardrails({ compId: COMP_ID, firebase: db, config });
  const bus = new ActionBus({
    compId: COMP_ID, firebase: db, io, obsConnectionManager: manager, guardrailRules,
    sceneConfirmTimeoutMs: 150, obsCallTimeoutMs: 150,
  });
  return { bus, obs, io, manager };
}

describe('guardrails on the action bus', () => {
  let db;
  beforeEach(() => {
    db = createFakeDb();
    db._seed(`competitions/${COMP_ID}/config`, { compType: 'womens-dual', team1Name: 'Navy', team2Name: 'Army' });
  });

  it('refuses a cut inside the hold time for every sender, without touching OBS', async () => {
    const { bus, obs, io } = makeBus({ db });
    await bus.buildCatalog();

    const first = await bus.execute({ actionId: 'scene:BRB', sender: 'producer' });
    assert.equal(first.ok, true);

    for (const sender of ['producer', 'rundown', 'xavier-suggest', 'xavier-auto']) {
      const ack = await bus.execute({ actionId: 'scene:Starting Soon', sender, uncatalogued: sender === 'rundown' });
      assert.equal(ack.ok, false, sender);
      assert.equal(ack.error, ACTION_ERRORS.GUARDRAIL);
      assert.equal(ack.guardrail.rule, 'minShotHoldMs');
      assert.match(ack.guardrail.reason, /hold it at least 3000ms/);
    }
    assert.equal(obs.getCallCount('SetCurrentProgramScene'), 1, 'only the first cut reached OBS');
    const current = await obs.call('GetCurrentProgramScene');
    assert.equal(current.currentProgramSceneName, 'BRB');

    const refused = io.broadcasts.filter(b => b.event === 'action:refused');
    assert.equal(refused.length, 4);
    assert.equal(refused[0].room, `competition:${COMP_ID}`);
    assert.equal(refused[0].data.guardrail.rule, 'minShotHoldMs');
  });

  it('lets a human force the same cut through and logs the override', async () => {
    const { bus, obs } = makeBus({ db });
    await bus.buildCatalog();
    const overrides = [];
    bus.on('guardrailOverride', o => overrides.push(o));

    await bus.execute({ actionId: 'scene:BRB', sender: 'producer' });
    const ack = await bus.execute({ actionId: 'scene:Starting Soon', sender: 'producer', force: true });
    assert.equal(ack.ok, true);
    assert.deepEqual(ack.guardrailOverride.map(o => o.rule), ['minShotHoldMs']);
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0].sender, 'producer');
    assert.equal(overrides[0].overridden[0].rule, 'minShotHoldMs');
    assert.equal((await obs.call('GetCurrentProgramScene')).currentProgramSceneName, 'Starting Soon');
  });

  it('never lets a refused Xavier command reach OBS, even with force set', async () => {
    const { bus, obs } = makeBus({ db });
    await bus.buildCatalog();
    await bus.execute({ actionId: 'scene:BRB', sender: 'producer' });
    const before = obs.getCallCount('SetCurrentProgramScene');

    for (const sender of ['xavier', 'xavier-suggest', 'xavier-auto']) {
      const ack = await bus.execute({ actionId: 'scene:Starting Soon', sender, force: true });
      assert.equal(ack.ok, false, sender);
      assert.equal(ack.guardrail.rule, 'minShotHoldMs');
      assert.equal(ack.guardrailOverride, undefined);
    }
    assert.equal(obs.getCallCount('SetCurrentProgramScene'), before);
    assert.equal(obs.getCallCount('SetCurrentSceneTransition'), 0);
  });

  it('never writes a refused graphic to Firebase', async () => {
    const { bus } = makeBus({ db });
    bus.startObserving();
    await bus.buildCatalog();

    const roster = await bus.execute({ actionId: 'graphic:team2-roster', sender: 'producer' });
    assert.equal(roster.ok, true);
    const onAir = (await db.ref(`competitions/${COMP_ID}/currentGraphic`).once('value')).val();

    const ack = await bus.execute({ actionId: 'graphic:team1-coaches', sender: 'xavier-auto', force: true });
    assert.equal(ack.ok, false);
    assert.equal(ack.guardrail.rule, 'noGraphicStacking');
    const after = (await db.ref(`competitions/${COMP_ID}/currentGraphic`).once('value')).val();
    assert.deepEqual(after, onAir, 'currentGraphic unchanged');
    bus.stopObserving();
  });

  it('counts a human cut made outside the bus toward the hold time', async () => {
    const { bus, manager } = makeBus({ db });
    bus.startObserving();
    await bus.buildCatalog();
    manager.emit('obsEvent', { compId: COMP_ID, eventName: 'CurrentProgramSceneChanged', data: { sceneName: 'BRB' } });

    const ack = await bus.execute({ actionId: 'scene:Starting Soon', sender: 'xavier-auto' });
    assert.equal(ack.guardrail?.rule, 'minShotHoldMs');
    bus.stopObserving();
  });

  it('runs the cut when the competition switched the rule off', async () => {
    const { bus } = makeBus({ db, config: { rules: { minShotHoldMs: { enabled: false } } } });
    await bus.buildCatalog();
    await bus.execute({ actionId: 'scene:BRB', sender: 'producer' });
    const ack = await bus.execute({ actionId: 'scene:Starting Soon', sender: 'xavier-auto' });
    assert.equal(ack.ok, true);
  });
});
