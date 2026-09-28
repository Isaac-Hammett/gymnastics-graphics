/**
 * Xavier decision log tests (ISA2-279): one record per recommendation set,
 * with the producer's outcome (took / dismissed / other / expired).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';

import { XavierDecisionLog, XavierService, MockProvider } from '../lib/xavier/index.js';

const COMP = 'ecac-2026-agent-test';

function setup() {
  const service = new EventEmitter();
  const bus = new EventEmitter();
  const store = new Map();
  let n = 0;
  let t = 1000;
  const log = new XavierDecisionLog({
    compId: COMP, service, getBus: () => bus, now: () => t,
    getContext: () => ({ clockMs: 42000, runKey: 'r1', runLabel: 'rec' }),
    write: async (r) => { const id = `id${++n}`; store.set(id, structuredClone(r)); return id; },
    update: async (id, patch) => { Object.assign(store.get(id), patch); },
    log: () => {}
  });
  log.start();
  const publish = (version, probs = [0.8, 0.1]) => service.emit('recommendations', {
    compId: COMP, stateVersion: version, trigger: 'Score posted', latencyMs: 120, model: 'jev', at: t,
    holdProbability: 0.1,
    recommendations: probs.map((p, i) => ({
      recommendationId: `${COMP}:${version}:a${i}`, rank: i + 1, actionId: `scene:S${i}`, label: `S${i}`, probability: p
    }))
  }, { state: { s: version }, questions: { q: 1 }, answers: { a: 1 } });
  const settle = () => new Promise(r => setImmediate(r));
  return { service, bus, store, log, publish, settle, tick: (ms) => { t += ms; } };
}

describe('XavierDecisionLog', () => {
  let c;
  beforeEach(() => { c = setup(); });

  it('writes one full record per recommendation set', async () => {
    c.publish(1);
    await c.settle();
    const r = c.store.get('id1');
    assert.equal(r.stateVersion, 1);
    assert.equal(r.clockMs, 42000);
    assert.deepEqual(r.stateSnapshot, { s: 1 });
    assert.equal(r.provider, 'jev');
    assert.equal(r.latencyMs, 120);
    assert.equal(r.recommended.length, 2);
    assert.equal(r.confidence, 0.8);
    assert.match(r.runId, /^rec-/);
  });

  it('took: a recommended action ran, with ack and response time', async () => {
    c.publish(1);
    c.tick(1500);
    c.bus.emit('executed', { actionId: 'scene:S0', sender: 'xavier-suggest', recommendationId: `${COMP}:1:a0`, ok: true });
    await c.settle();
    assert.deepEqual(c.store.get('id1').outcome, { type: 'took', actionId: 'scene:S0', ackOk: true, responseMs: 1500 });
  });

  it('took with a refused ack records ackOk false and the guardrail', async () => {
    c.publish(1);
    c.bus.emit('executed', { actionId: 'scene:S0', sender: 'xavier-suggest', recommendationId: `${COMP}:1:a0`, ok: false, guardrail: { rule: 'min-hold', reason: 'too soon' } });
    await c.settle();
    const r = c.store.get('id1');
    assert.equal(r.outcome.type, 'took');
    assert.equal(r.outcome.ackOk, false);
    assert.equal(r.guardrails[0].rule, 'min-hold');
  });

  it('an auto run is a took flagged auto; a refused auto run leaves the set open', async () => {
    c.publish(1);
    c.bus.emit('executed', { actionId: 'scene:S0', sender: 'xavier-auto', recommendationId: `${COMP}:1:a0`, ok: false, guardrail: { rule: 'x' } });
    c.bus.emit('executed', { actionId: 'scene:S1', sender: 'xavier-auto', recommendationId: `${COMP}:1:a1`, ok: true });
    await c.settle();
    assert.equal(c.store.get('id1').outcome.auto, true);
    assert.equal(c.store.get('id1').guardrails.length, 1);
  });

  it('dismissed only once every card is dismissed', async () => {
    c.publish(1);
    c.service.emit('dismissed', { recommendationId: `${COMP}:1:a0`, remaining: 1 });
    await c.settle();
    assert.equal(c.store.get('id1').outcome, undefined);
    c.service.emit('dismissed', { recommendationId: `${COMP}:1:a1`, remaining: 0 });
    await c.settle();
    assert.equal(c.store.get('id1').outcome.type, 'dismissed');
  });

  it('other: a non-recommended producer command, or a human change the bus did not make', async () => {
    c.publish(1);
    c.bus.emit('executed', { actionId: 'scene:Other', sender: 'producer', recommendationId: null, ok: true });
    c.publish(2);
    c.bus.emit('humanAction', { kind: 'graphic', graphicId: 'team-roster' });
    await c.settle();
    assert.equal(c.store.get('id1').outcome.type, 'other');
    assert.equal(c.store.get('id1').outcome.actionId, 'scene:Other');
    assert.equal(c.store.get('id2').outcome.type, 'other');
    assert.equal(c.store.get('id2').outcome.actionId, 'graphic:team-roster');
  });

  it('a human change to a recommended scene counts as took', async () => {
    c.publish(1);
    c.bus.emit('humanAction', { kind: 'scene', sceneName: 'S1' });
    await c.settle();
    assert.equal(c.store.get('id1').outcome.type, 'took');
  });

  it('expired: replaced by a newer set, or Xavier stopped, with no response', async () => {
    c.publish(1);
    c.publish(2);
    c.service.emit('stopped', {});
    await c.settle();
    assert.equal(c.store.get('id1').outcome.type, 'expired');
    assert.equal(c.store.get('id1').outcome.responseMs, null);
    assert.equal(c.store.get('id2').outcome.type, 'expired');
  });

  it('an empty set is not logged, and nothing else closes twice', async () => {
    c.publish(1, []);
    await c.settle();
    assert.equal(c.store.size, 0);
  });
});

describe('XavierService detail for the log', () => {
  it('publishes state, questions and answers to listeners, not to the room payload', async () => {
    const pub = { hasSnapshot: true, stateVersion: 3, events: {}, standings: {}, meetStatus: 'live', rotation: 1 };
    const cs = Object.assign(new EventEmitter(), { getPublicState: () => pub });
    const svc = new XavierService({
      compId: COMP, competitionState: cs, provider: new MockProvider({}), log: () => {},
      getActions: async () => [{ id: 'scene:A', label: 'A' }]
    });
    let seen;
    svc.on('recommendations', (payload, detail) => { seen = { payload, detail }; });
    await svc._evaluateOnce();
    assert.ok(seen.detail.state && seen.detail.questions.next_action && seen.detail.answers.next_action);
    assert.equal(seen.payload.state, undefined);
  });
});
