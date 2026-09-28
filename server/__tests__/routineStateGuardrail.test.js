/**
 * Routine state wired into noCutDuringRoutine (ISA2-311).
 * Drives a real CompetitionStateService and a real ActionBus with a fake OBS.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';

import { getOrCreateActionBus, disposeActionBus, getAllActionBuses } from '../lib/actionBus.js';
import { getOrCreateCompetitionState, removeCompetitionState } from '../lib/competitionState/index.js';
import { Guardrails } from '../lib/guardrails.js';
import { routineFromState, scenesForEvent } from '../lib/routineState.js';

const COMP = 'routine-guardrail-test';

const snapshot = () => ({
  meet: {
    teams: [{
      tricode: 'A', name: 'A', final_score: null,
      events: [{
        event_name: 'FLOOR', rotation: 1,
        gymnasts: [{ gymnast_id: 'a1', full_name: 'Jane Doe', order: 1, final_score: null }],
      }],
    }],
  },
});

function fakeObs() {
  const obs = new EventEmitter();
  obs.current = 'Cam FX';
  obs.call = async (method, params) => {
    if (method === 'GetCurrentProgramScene') return { currentProgramSceneName: obs.current };
    if (method === 'SetCurrentProgramScene') {
      obs.current = params.sceneName;
      setImmediate(() => manager.forward('CurrentProgramSceneChanged', { sceneName: params.sceneName }));
    }
    return {};
  };
  return obs;
}

const manager = Object.assign(new EventEmitter(), {
  conn: null,
  getConnection() { return this.conn; },
  forward(eventName, data) { this.emit('obsEvent', { compId: COMP, eventName, data }); },
});

function makeBus(rulesConfig = {}) {
  manager.conn = fakeObs();
  const guardrailRules = new Guardrails({
    compId: COMP,
    config: { rules: { minShotHoldMs: { enabled: false }, noGraphicStacking: { enabled: false }, cameraMustHaveSignal: { enabled: false }, ...rulesConfig } },
  });
  return getOrCreateActionBus(COMP, { obsConnectionManager: manager, guardrailRules });
}

const cut = (bus, sender, extra = {}) =>
  bus.execute({ actionId: 'scene:Cam VT', sender, uncatalogued: true, ...extra });

afterEach(() => {
  for (const id of [...getAllActionBuses().keys()]) disposeActionBus(id);
  removeCompetitionState(COMP);
});

describe('routine state provider', () => {
  it('is set on the bus guardrails and cleared on dispose', () => {
    const bus = makeBus();
    assert.equal(typeof bus.guardrailRules.routineStateProvider, 'function');
    disposeActionBus(COMP);
    assert.equal(bus.guardrailRules.routineStateProvider, null);
  });

  it('finds the in-progress routine and the scenes that show its event', () => {
    const svc = getOrCreateCompetitionState(COMP);
    svc.ingest({ t: 0, snapshot: snapshot() });
    assert.equal(routineFromState(svc.getPublicState()), null);
    svc.ingest({ t: 1, signal: { type: 'greenLight', event: 'FLOOR', team: 'A' } });
    const r = routineFromState(svc.getPublicState(), ['Cam FX', 'Cam VT']);
    assert.equal(r.status, 'in_progress');
    assert.equal(r.event, 'FLOOR');
    assert.equal(r.athlete, 'Jane Doe');
    assert.equal(r.confidence, 0.9);
    assert.deepEqual(r.sceneNames, ['Cam FX']);
    assert.deepEqual(scenesForEvent(['Cam FX', 'Cam VT', 'Floor Wide'], { name: 'FLOOR', code: 'FX' }), ['Cam FX', 'Floor Wide']);
  });
});

describe('noCutDuringRoutine through the bus', () => {
  it('refuses a cut away while in_progress, for every sender; allows after scored', async () => {
    const svc = getOrCreateCompetitionState(COMP);
    const bus = makeBus();
    svc.ingest({ t: 0, snapshot: snapshot() });

    // idle/up: allowed
    assert.equal((await cut(bus, 'producer')).ok, true);
    manager.conn.current = 'Cam FX';
    bus._observed.programScene = { sceneName: 'Cam FX', at: Date.now(), source: 'test' };

    svc.ingest({ t: 1, signal: { type: 'greenLight', event: 'FLOOR', team: 'A' } });
    for (const sender of ['producer', 'rundown', 'xavier-auto']) {
      const ack = await cut(bus, sender);
      assert.equal(ack.ok, false, sender);
      assert.equal(ack.guardrail.rule, 'noCutDuringRoutine', sender);
    }

    // human force goes through, Xavier's does not
    assert.equal((await cut(bus, 'producer', { force: true })).ok, true);
    manager.conn.current = 'Cam FX';
    bus._observed.programScene = { sceneName: 'Cam FX', at: Date.now(), source: 'test' };
    const xavier = await cut(bus, 'xavier-auto', { force: true });
    assert.equal(xavier.ok, false);
    assert.equal(xavier.guardrail.rule, 'noCutDuringRoutine');

    // scored: allowed again
    svc.ingest({ t: 2, snapshot: (() => { const s = snapshot(); s.meet.teams[0].events[0].gymnasts[0].final_score = '9.5'; return s; })() });
    assert.equal(svc.getPublicState().events.FLOOR.teams.A.routineStatus, 'scored');
    assert.equal((await cut(bus, 'xavier-auto')).ok, true);
  });

  it('allows the cut below the confidence threshold', async () => {
    const svc = getOrCreateCompetitionState(COMP);
    const bus = makeBus({ noCutDuringRoutine: { enabled: true, minConfidence: 0.95 } });
    svc.ingest({ t: 0, snapshot: snapshot() });
    svc.ingest({ t: 1, signal: { type: 'greenLight', event: 'FLOOR', team: 'A' } });
    bus._observed.programScene = { sceneName: 'Cam FX', at: Date.now(), source: 'test' };
    assert.equal((await cut(bus, 'producer')).ok, true);
  });
});
