/**
 * Xavier decision service tests (ISA2-275)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';

import {
  JevProvider, MockProvider, XavierService, isValidAnswer, triggerText, buildRequest, HOLD
} from '../lib/xavier/index.js';
import { CompetitionStateService } from '../lib/competitionState/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ECAC = JSON.parse(fs.readFileSync(path.join(here, '../../recordings/ecac-2026/virtius-final.json'), 'utf8'));

const QUESTIONS = {
  next_action: { type: 'choice', instructions: 'x', criteria: { hold: 'wait', 'graphic:a': 'A', 'graphic:b': 'B' } },
  routine_in_progress_FX: { type: 'noul', instructions: 'y', criteria: { true: 't', false: 'f' } }
};
const JEV_BODY = {
  model: 'jev-1.13.0',
  answers: {
    next_action: { type: 'choice', choice: 'graphic:a', confidence: 0.8, probabilities: { hold: 0.1, 'graphic:a': 0.6, 'graphic:b': 0.3 } },
    routine_in_progress_FX: { type: 'noul', noul: 0.9 }
  }
};
const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });

describe('provider contract', () => {
  it('JevProvider (fetch mocked) and MockProvider return the same shape', async () => {
    let seen;
    const jev = new JevProvider({
      apiKey: 'k', fetchImpl: async (url, init) => { seen = { url, init }; return okResponse(JEV_BODY); }
    });
    const mock = new MockProvider({ answers: JEV_BODY.answers });
    const a = await jev.evaluate({ state: { s: 1 }, questions: QUESTIONS });
    const b = await mock.evaluate({ state: { s: 1 }, questions: QUESTIONS });

    for (const r of [a, b]) {
      assert.deepEqual(Object.keys(r).sort().slice(0, 3), ['answers', 'latencyMs', 'model']);
      assert.equal(typeof r.latencyMs, 'number');
      assert.equal(typeof r.model, 'string');
      assert.deepEqual(Object.keys(r.answers).sort(), Object.keys(QUESTIONS).sort());
      for (const ans of Object.values(r.answers)) assert.ok(isValidAnswer(ans));
    }
    assert.equal(seen.url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(seen.init.headers.Authorization, 'Bearer k');
    const sent = JSON.parse(seen.init.body);
    assert.equal(sent.model, 'jev-latest');
    assert.deepEqual(sent.questions, QUESTIONS);
  });

  it('MockProvider fills neutral defaults for unknown questions', async () => {
    const r = await new MockProvider().evaluate({ state: {}, questions: QUESTIONS });
    for (const ans of Object.values(r.answers)) assert.ok(isValidAnswer(ans));
  });

  it('JevProvider retries 429 and 529 with exponential backoff, then succeeds', async () => {
    const statuses = [429, 529, 200];
    const delays = [];
    const jev = new JevProvider({
      apiKey: 'k', baseDelayMs: 100, sleepFn: async (ms) => { delays.push(ms); },
      fetchImpl: async () => { const s = statuses.shift(); return s === 200 ? okResponse(JEV_BODY) : { ok: false, status: s }; }
    });
    await jev.evaluate({ state: {}, questions: QUESTIONS });
    assert.deepEqual(delays, [100, 200]);
  });

  it('JevProvider gives up after maxRetries and does not retry other errors', async () => {
    let calls = 0;
    const jev = new JevProvider({ apiKey: 'k', maxRetries: 2, sleepFn: async () => {}, fetchImpl: async () => { calls++; return { ok: false, status: 429 }; } });
    await assert.rejects(jev.evaluate({ state: {}, questions: QUESTIONS }), { code: 'http_error' });
    assert.equal(calls, 3);
    calls = 0;
    const bad = new JevProvider({ apiKey: 'k', sleepFn: async () => {}, fetchImpl: async () => { calls++; return { ok: false, status: 401 }; } });
    await assert.rejects(bad.evaluate({ state: {}, questions: QUESTIONS }), { code: 'unauthorized' });
    assert.equal(calls, 1);
  });

  it('JevProvider without a key throws no_api_key and never calls fetch', async () => {
    let called = false;
    const jev = new JevProvider({ apiKey: '', fetchImpl: async () => { called = true; } });
    await assert.rejects(jev.evaluate({ state: {}, questions: QUESTIONS }), { code: 'no_api_key' });
    assert.equal(called, false);
  });
});

/** Fake competition state: EventEmitter with a mutable public state. */
function fakeCs(over = {}) {
  const cs = new EventEmitter();
  cs.pub = {
    stateVersion: 1, hasSnapshot: true, meetStatus: null, rotation: { current: 1 }, standings: [],
    events: { FLOOR: { name: 'FLOOR', code: 'FX', rotation: 1, teams: { NAVY: {
      routineStatus: 'up', athleteUp: { name: 'A B', order: 1, confidence: 0.4 }, lastScore: null,
      lineup: [{ order: 1, name: 'A B', score: null }], bye: false } } } },
    ...over
  };
  cs.getPublicState = () => cs.pub;
  return cs;
}
const ACTIONS = [{ id: 'graphic:a', label: 'A' }, { id: 'graphic:b', label: 'B' }, { id: 'graphic:c', label: 'C' }, { id: 'graphic:d', label: 'D' }];
const silent = () => {};

describe('XavierService', () => {
  it('asks the three question kinds and emits top 1-3 actions without hold, with trigger text', async () => {
    const cs = fakeCs();
    const emitted = [];
    const io = { to: (room) => ({ emit: (ev, p) => emitted.push({ room, ev, p }) }) };
    const provider = new MockProvider({ answers: {
      next_action: { type: 'choice', choice: 'hold', confidence: 0.5, probabilities: { hold: 0.5, 'graphic:a': 0.2, 'graphic:b': 0.15, 'graphic:c': 0.1, 'graphic:d': 0.05 } },
      routine_in_progress_FX: { type: 'noul', noul: 0.8 }
    } });
    const svc = new XavierService({ compId: 'c1', io, competitionState: cs, getActions: async () => ACTIONS, provider, log: silent });
    cs._lastEventSeed = null;
    svc._onEvent({ type: 'scorePosted', event: 'BEAM', athlete: { name: 'Jane Smith' }, score: '9.875' });
    await svc.request();

    const qs = Object.keys(provider.calls[0].questions).sort();
    assert.deepEqual(qs, ['athlete_matches_FX', 'next_action', 'routine_in_progress_FX']);
    assert.deepEqual(Object.keys(provider.calls[0].questions.next_action.criteria).sort(), ['graphic:a', 'graphic:b', 'graphic:c', 'graphic:d', 'hold']);

    const rec = emitted.find(e => e.ev === 'xavier:recommendations');
    assert.equal(rec.room, 'competition:c1');
    assert.deepEqual(rec.p.recommendations.map(r => r.actionId), ['graphic:a', 'graphic:b', 'graphic:c']);
    assert.ok(rec.p.recommendations.every(r => r.actionId !== HOLD));
    assert.equal(rec.p.recommendations[0].trigger, 'Score posted: Beam, Smith 9.875');
    assert.equal(rec.p.flags.routine_in_progress_FX, 0.8);
    assert.equal(rec.p.stateVersion, 1);

    // dismiss (ISA2-276): drops the card from the snapshot and tells the room
    const id = rec.p.recommendations[0].recommendationId;
    assert.equal(id, 'c1:1:graphic:a');
    assert.equal(svc.dismiss(id), true);
    assert.deepEqual(svc.getSnapshot().last.recommendations.map(r => r.actionId), ['graphic:b', 'graphic:c']);
    assert.deepEqual(emitted.find(e => e.ev === 'xavier:dismissed').p, { compId: 'c1', recommendationId: id });
    assert.equal(svc.dismiss(id), false);
  });

  it('keeps at most one request in flight and coalesces bursts into one follow-up', async () => {
    const cs = fakeCs();
    const provider = new MockProvider({ delayMs: 20 });
    let concurrent = 0, maxConcurrent = 0;
    const orig = provider.evaluate.bind(provider);
    provider.evaluate = async (a) => { concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent); try { return await orig(a); } finally { concurrent--; } };
    const svc = new XavierService({ compId: 'c1', competitionState: cs, getActions: async () => ACTIONS, provider, log: silent });

    const first = svc.request();
    for (let i = 0; i < 5; i++) svc.request();
    await first;
    assert.equal(maxConcurrent, 1);
    assert.equal(provider.calls.length, 2); // the running one + one coalesced follow-up
  });

  it('drops a stale reply when the state version moved on, then evaluates the newest state', async () => {
    const cs = fakeCs();
    const emitted = [];
    const io = { to: () => ({ emit: (ev, p) => emitted.push({ ev, p }) }) };
    const provider = new MockProvider({ delayMs: 20 });
    const svc = new XavierService({ compId: 'c1', io, competitionState: cs, getActions: async () => ACTIONS, provider, log: silent });
    const stale = [];
    svc.on('stale', (s) => stale.push(s));

    const run = svc.request();
    await new Promise(r => setTimeout(r, 5));
    cs.pub = { ...cs.pub, stateVersion: 2 }; // moves while request 1 is in flight
    await run;

    assert.deepEqual(stale, [{ stateVersion: 1 }]);
    const recs = emitted.filter(e => e.ev === 'xavier:recommendations');
    assert.equal(recs.length, 1);
    assert.equal(recs[0].p.stateVersion, 2); // v1 never emitted
    assert.equal(provider.calls.length, 2);
  });

  it('ticks about once a second only while a routine is in progress', async () => {
    const cs = fakeCs();
    const provider = new MockProvider();
    const svc = new XavierService({ compId: 'c1', competitionState: cs, getActions: async () => ACTIONS, provider, tickMs: 15, log: silent });
    svc.start();
    await new Promise(r => setTimeout(r, 80));
    assert.equal(provider.calls.length, 1); // initial only; routineStatus 'up'
    cs.pub.events.FLOOR.teams.NAVY.routineStatus = 'in_progress';
    await new Promise(r => setTimeout(r, 80));
    svc.stop();
    assert.ok(provider.calls.length >= 3, `calls=${provider.calls.length}`);
    const n = provider.calls.length;
    await new Promise(r => setTimeout(r, 50));
    assert.equal(provider.calls.length, n); // stopped
  });

  it('runs on every competition-state update', async () => {
    const cs = fakeCs();
    const provider = new MockProvider();
    const svc = new XavierService({ compId: 'c1', competitionState: cs, getActions: async () => ACTIONS, provider, tickMs: 100000, log: silent });
    svc.start();
    await new Promise(r => setTimeout(r, 10));
    cs.pub = { ...cs.pub, stateVersion: 2 };
    cs.emit('update', cs.pub);
    await new Promise(r => setTimeout(r, 10));
    svc.stop();
    assert.equal(provider.calls.length, 2);
  });

  it('emits no recommendations and reports why when the provider is unavailable', async () => {
    const cs = fakeCs();
    const emitted = [];
    const io = { to: () => ({ emit: (ev, p) => emitted.push({ ev, p }) }) };
    const svc = new XavierService({ compId: 'c1', io, competitionState: cs, getActions: async () => ACTIONS,
      provider: new JevProvider({ apiKey: '' }), log: silent });
    await svc.request();
    assert.equal(emitted.filter(e => e.ev === 'xavier:recommendations').length, 0);
    const status = emitted.find(e => e.ev === 'xavier:status');
    assert.equal(status.p.ok, false);
    assert.equal(status.p.reason, 'no_api_key');
  });

  it('logs per-call latency', async () => {
    const lines = [];
    const svc = new XavierService({ compId: 'c1', competitionState: fakeCs(), getActions: async () => ACTIONS,
      provider: new MockProvider({ latencyMs: 123, model: 'jev-x' }), log: (l) => lines.push(l) });
    await svc.request();
    assert.ok(lines.some(l => /jev-x latency=123ms/.test(l)));
  });
});

describe('request building from recorded ECAC state', () => {
  it('produces per-event noul questions and a choice over the actions', () => {
    const cs = new CompetitionStateService({ compId: 'ecac' });
    cs.ingest({ t: 1, snapshot: ECAC });
    const pub = cs.getPublicState();
    const { state, questions } = buildRequest(pub, ACTIONS, ACTIONS.map(a => a.id), null);
    const evCount = Object.keys(pub.events).length;
    assert.ok(evCount >= 1);
    assert.equal(Object.keys(questions).filter(k => k.startsWith('routine_in_progress_')).length, evCount);
    assert.equal(Object.keys(questions).filter(k => k.startsWith('athlete_matches_')).length, evCount);
    assert.equal(questions.next_action.type, 'choice');
    assert.ok(JSON.stringify(state).length < 100000);
  });

  it('triggerText covers the state events', () => {
    assert.equal(triggerText({ type: 'athleteUp', event: 'FLOOR', athlete: { name: 'A Smith' } }), 'Athlete up: Floor, Smith');
    assert.equal(triggerText(null), null);
  });
});
