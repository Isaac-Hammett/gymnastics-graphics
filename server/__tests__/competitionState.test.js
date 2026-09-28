/**
 * Competition State Tests (ISA2-274)
 *
 * Reducer against the ECAC final Virtius JSON and synthetic progressive
 * snapshots; sources; service emission to the competition room.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  reduce, createInitialState, detectRotation, detectNowCompeting, detectByes,
  diffScores, normalizeSnapshot, CONFIDENCE, EVENT_TYPES,
  CompetitionStateService, LiveVirtiusSource, RecordedEventSource
} from '../lib/competitionState/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ECAC = JSON.parse(fs.readFileSync(path.join(here, '../../recordings/ecac-2026/virtius-final.json'), 'utf8'));

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Small builder: teams = { KEY: { total, events: { NAME: { rotation, scores: [score|null,...] } } } } */
function snap(teams) {
  return {
    meet: {
      teams: Object.entries(teams).map(([key, t]) => ({
        tricode: key, name: key, final_score: t.total ?? null,
        events: Object.entries(t.events).map(([name, e]) => ({
          event_name: name, rotation: e.rotation,
          gymnasts: (e.scores || []).map((s, i) => ({
            gymnast_id: `${key}-${name}-${i + 1}`, full_name: `${key} ${name} ${i + 1}`, order: i + 1, final_score: s
          }))
        }))
      }))
    }
  };
}

/** Copy of the ECAC final with every score after the first `n` (in team/event order) blanked. */
function maskedEcac(keepPerEvent, { rotationsUpTo = 99 } = {}) {
  const d = clone(ECAC);
  d.meet.teams.forEach(t => {
    t.final_score = null;
    t.events.forEach(e => e.gymnasts.forEach((g, i) => {
      if (e.rotation > rotationsUpTo || i >= keepPerEvent) g.final_score = null;
    }));
  });
  return d;
}

describe('normalizeSnapshot', () => {
  it('handles the ECAC final: 6 teams x 6 events', () => {
    const { teams } = normalizeSnapshot(ECAC);
    assert.equal(teams.length, 6);
    assert.ok(teams.every(t => t.events.length === 6));
    assert.equal(teams[0].key, 'NAVY');
    assert.equal(teams[0].events[0].code, 'FX');
  });
});

describe('reducer on the ECAC final JSON', () => {
  const { state, events } = reduce(createInitialState(), { t: 1000, snapshot: ECAC });

  it('first snapshot is a quiet baseline (no score events for scores already there)', () => {
    assert.deepEqual(events, []);
    assert.equal(state.stateVersion, 1);
  });

  it('reports the meet as final', () => {
    assert.equal(state.rotation.isFinal, true);
    assert.equal(state.rotation.total, 6);
    assert.deepEqual(state.rotation.byes, []);
  });

  it('standings are ranked by team total and match Virtius place', () => {
    assert.equal(state.standings.length, 6);
    const totals = state.standings.map(s => parseFloat(s.total));
    assert.deepEqual(totals, [...totals].sort((a, b) => b - a));
    const navy = state.standings.find(s => s.team === 'NAVY');
    const virtiusNavy = ECAC.meet.teams.find(t => t.tricode === 'NAVY');
    assert.equal(navy.rank, virtiusNavy.place);
    assert.equal(state.teamTotals.NAVY.total, '312.200');
  });

  it('every event x team is idle with a lastScore and a full lineup', () => {
    for (const ev of Object.values(state.events)) {
      assert.equal(Object.keys(ev.teams).length, 6);
      for (const ts of Object.values(ev.teams)) {
        assert.equal(ts.routineStatus, 'idle');
        assert.equal(ts.athleteUp, null);
        assert.ok(ts.lastScore);
        assert.ok(ts.lineup.length >= 1);
      }
    }
  });

  it('emitInitial reports every existing score as scorePosted with 0.95', () => {
    const r = reduce(createInitialState(), { t: 1, snapshot: ECAC }, { emitInitial: true });
    const posted = r.events.filter(e => e.type === 'scorePosted');
    const expected = ECAC.meet.teams.flatMap(t => t.events.flatMap(e => e.gymnasts.filter(g => g.final_score != null)));
    assert.equal(posted.length, expected.length);
    assert.ok(posted.every(e => e.confidence === CONFIDENCE.SCORE_POSTED && e.evidence.length > 0));
  });

  it('does not mutate its input state', () => {
    const s0 = createInitialState();
    const frozen = JSON.stringify(s0);
    reduce(s0, { t: 1, snapshot: ECAC });
    assert.equal(JSON.stringify(s0), frozen);
  });
});

describe('progressive ECAC snapshots', () => {
  it('start of meet: everyone in rotation 1 has their first athlete up at 0.4; other events idle', () => {
    const { state } = reduce(createInitialState(), { t: 0, snapshot: maskedEcac(0) });
    assert.equal(state.rotation.current, 1);
    assert.equal(state.rotation.isFinal, false);
    const r1 = Object.values(state.events).flatMap(ev => Object.values(ev.teams).map(ts => ({ ev, ts })));
    const up = r1.filter(x => x.ts.athleteUp);
    assert.equal(up.length, 6); // one event per team in rotation 1
    up.forEach(x => {
      assert.equal(x.ts.athleteUp.confidence, CONFIDENCE.UP_FIRST_ATHLETE);
      assert.equal(x.ts.routineStatus, 'up');
      assert.equal(x.ts.athleteUp.order, 1);
    });
  });

  it('scores appearing produce scorePosted (0.95) and athleteUp (0.6) for the next athlete', () => {
    let r = reduce(createInitialState(), { t: 0, snapshot: maskedEcac(0) });
    r = reduce(r.state, { t: 15000, snapshot: maskedEcac(1, { rotationsUpTo: 1 }) });
    const posted = r.events.filter(e => e.type === 'scorePosted');
    const ups = r.events.filter(e => e.type === 'athleteUp');
    assert.equal(posted.length, 6);
    assert.ok(posted.every(e => e.confidence === 0.95));
    assert.equal(ups.length, 6);
    assert.ok(ups.every(e => e.confidence === CONFIDENCE.UP_AFTER_PREVIOUS_SCORE && e.athlete.order === 2));
    const first = Object.values(r.state.events).flatMap(e => Object.values(e.teams)).find(ts => ts.athleteUp);
    assert.equal(first.routineStatus, 'scored');
  });

  it('a full rotation of scores advances the rotation to 2', () => {
    let r = reduce(createInitialState(), { t: 0, snapshot: maskedEcac(0) });
    r = reduce(r.state, { t: 1, snapshot: maskedEcac(99, { rotationsUpTo: 1 }) });
    assert.equal(r.state.rotation.current, 2);
    const changed = r.events.find(e => e.type === 'rotationChanged');
    assert.equal(changed.rotation, 2);
    assert.equal(changed.previousRotation, 1);
    assert.ok(changed.confidence > 0 && changed.evidence.length > 0);
  });
});

describe('poll diffing', () => {
  const base = snap({ A: { total: null, events: { FLOOR: { rotation: 1, scores: [null, null, null] } } } });

  it('new score, correction, and removed score', () => {
    const s1 = snap({ A: { total: '9.100', events: { FLOOR: { rotation: 1, scores: ['9.100', null, null] } } } });
    const s2 = snap({ A: { total: '9.300', events: { FLOOR: { rotation: 1, scores: ['9.300', null, null] } } } });
    const s3 = snap({ A: { total: '9.300', events: { FLOOR: { rotation: 1, scores: [null, null, null] } } } });

    let r = reduce(createInitialState(), { t: 0, snapshot: base });
    r = reduce(r.state, { t: 15000, snapshot: s1 });
    assert.deepEqual(r.events.map(e => e.type).sort(), ['athleteUp', 'scorePosted', 'teamTotalChanged']);

    r = reduce(r.state, { t: 30000, snapshot: s2 });
    const corr = r.events.find(e => e.type === 'scoreCorrected');
    assert.equal(corr.previousScore, '9.100');
    assert.equal(corr.score, '9.300');
    assert.equal(corr.removed, false);
    assert.ok(!r.events.some(e => e.type === 'scorePosted'));

    r = reduce(r.state, { t: 45000, snapshot: s3 });
    const rem = r.events.find(e => e.type === 'scoreCorrected');
    assert.equal(rem.removed, true);
    assert.equal(rem.score, null);
  });

  it('diffScores is pure and keyed by team|event|gymnast', () => {
    const prev = { 'A|FLOOR|A-FLOOR-1': '9.100' };
    const { teams } = normalizeSnapshot(snap({ A: { events: { FLOOR: { rotation: 1, scores: ['9.100', '8.000'] } } } }));
    const changes = diffScores(prev, teams);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].kind, 'new');
  });

  it('unchanged poll produces no events and does not bump stateVersion', () => {
    const s1 = snap({ A: { total: '9.100', events: { FLOOR: { rotation: 1, scores: ['9.100', null] } } } });
    let r = reduce(createInitialState(), { t: 0, snapshot: s1 });
    const v = r.state.stateVersion;
    r = reduce(r.state, { t: 15000, snapshot: s1 });
    assert.deepEqual(r.events, []);
    assert.equal(r.state.stateVersion, v);
    assert.equal(r.state.freshness.unchangedPolls, 1);
  });

  it('stale polls lower the confidence of inferred "up"', () => {
    const s1 = snap({ A: { total: null, events: { FLOOR: { rotation: 1, scores: ['9.1', null, null] } } } });
    let r = reduce(createInitialState(), { t: 0, snapshot: s1 });
    const fresh = r.state.events.FLOOR.teams.A.athleteUp.confidence;
    for (let i = 1; i <= 4; i++) r = reduce(r.state, { t: i * 15000, snapshot: s1 });
    const stale = r.state.events.FLOOR.teams.A.athleteUp.confidence;
    assert.ok(stale < fresh, `${stale} < ${fresh}`);
  });

  it('a long gap between polls lowers score confidence', () => {
    const s0 = snap({ A: { events: { FLOOR: { rotation: 1, scores: [null, null] } } } });
    const s1 = snap({ A: { events: { FLOOR: { rotation: 1, scores: ['9.0', null] } } } });
    let r = reduce(createInitialState(), { t: 0, snapshot: s0 });
    r = reduce(r.state, { t: 5 * 60000, snapshot: s1 });
    assert.ok(r.events.find(e => e.type === 'scorePosted').confidence < CONFIDENCE.SCORE_POSTED);
  });
});

describe('detectNowCompeting', () => {
  it('returns the next unscored athlete only in an event that is partly scored', () => {
    const { teams } = normalizeSnapshot(snap({
      A: { events: { FLOOR: { rotation: 1, scores: ['9', '9'] }, HORSE: { rotation: 2, scores: ['8', null, null] } } }
    }));
    const r = detectNowCompeting(teams[0]);
    assert.equal(r.event.name, 'HORSE');
    assert.equal(r.athlete.order, 2);
  });

  it('returns null between rotations', () => {
    const { teams } = normalizeSnapshot(snap({ A: { events: { FLOOR: { rotation: 1, scores: ['9', '9'] }, HORSE: { rotation: 2, scores: [null, null] } } } }));
    assert.equal(detectNowCompeting(teams[0]), null);
  });
});

describe('rotation and byes (5+ team meets)', () => {
  // 5 teams, 6 events: each rotation exactly one team has no event (bye).
  const five = (scoresFor) => {
    const teams = {};
    ['A', 'B', 'C', 'D', 'E'].forEach((k, ti) => {
      teams[k] = { total: null, events: {} };
      for (let r = 1; r <= 6; r++) {
        if (((r - 1) % 5) === ti && r <= 5) continue; // team ti byes in rotation ti+1
        teams[k].events[`EV${r}`] = { rotation: r, scores: scoresFor(k, r) };
      }
    });
    return snap(teams);
  };

  it('detects the bye team and does not let it hold the rotation back (BUG-005)', () => {
    const s = five((k, r) => (r === 1 ? ['9', '9'] : [null, null]));
    const { teams } = normalizeSnapshot(s);
    assert.deepEqual(detectByes(teams, 1), ['A']);
    const rot = detectRotation(teams);
    assert.equal(rot.current, 2); // rotation 1 fully scored by the 4 teams that compete; A's bye doesn't block
    assert.deepEqual(rot.byes, ['B']);
  });

  it('bye team has no athleteUp and is flagged bye', () => {
    const s = five(() => [null, null]);
    const { state } = reduce(createInitialState(), { t: 0, snapshot: s });
    assert.equal(state.rotation.current, 1);
    assert.deepEqual(state.rotation.byes, ['A']);
    const upTeams = Object.values(state.events).flatMap(e => Object.entries(e.teams).filter(([, ts]) => ts.athleteUp).map(([k]) => k));
    assert.ok(!upTeams.includes('A') || state.events.EV1.teams.A === undefined);
  });

  it('final when every competing event is scored', () => {
    const s = five(() => ['9', '9']);
    const { state } = reduce(createInitialState(), { t: 0, snapshot: s });
    assert.equal(state.rotation.isFinal, true);
  });
});

describe('signals', () => {
  const s1 = snap({ A: { events: { FLOOR: { rotation: 1, scores: ['9', null, null] } } } });

  it('greenLight from a recorded log emits at 0.9, puts the routine in_progress and raises athlete confidence', () => {
    let r = reduce(createInitialState(), { t: 0, snapshot: s1 });
    r = reduce(r.state, { t: 100, signal: { type: 'greenLight', event: 'FLOOR', team: 'A' } });
    const ev = r.events[0];
    assert.equal(ev.type, 'greenLight');
    assert.equal(ev.confidence, CONFIDENCE.GREEN_LIGHT_RECORDED);
    assert.equal(r.state.events.FLOOR.teams.A.routineStatus, 'in_progress');
    assert.equal(r.state.events.FLOOR.teams.A.athleteUp.confidence, 0.9);
    // confirmation survives an unchanged poll
    r = reduce(r.state, { t: 15000, snapshot: s1 });
    assert.equal(r.state.events.FLOOR.teams.A.routineStatus, 'in_progress');
  });

  it('routineEnded emits, and unknown signals are stored under signals{}', () => {
    let r = reduce(createInitialState(), { t: 0, snapshot: s1 });
    r = reduce(r.state, { t: 1, signal: { type: 'routineEnded', event: 'FLOOR', team: 'A' } });
    assert.equal(r.events[0].type, 'routineEnded');
    r = reduce(r.state, { t: 2, signal: { type: 'vision:onAir', camera: 3 } });
    assert.equal(r.events.length, 0);
    assert.equal(r.state.signals['vision:onAir'].camera, 3);
  });

  it('every emitted type is a known typed event', () => {
    assert.deepEqual([...EVENT_TYPES].sort(), ['athleteUp', 'greenLight', 'rotationChanged', 'routineEnded', 'scoreCorrected', 'scorePosted', 'teamTotalChanged']);
  });
});

describe('sources', () => {
  it('LiveVirtiusSource polls, emits inputs, survives errors, and appends a replayable JSONL log', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    const logPath = path.join(dir, 'poll.jsonl');
    let n = 0;
    const src = new LiveVirtiusSource({
      sessionId: 'x', pollIntervalMs: 5, logPath, now: () => 1000 + n * 10,
      fetchSession: async () => {
        n++;
        if (n === 2) throw new Error('boom');
        return maskedEcac(n === 1 ? 0 : 1);
      }
    });
    const inputs = []; const errors = [];
    src.on('input', i => inputs.push(i));
    src.on('error', e => errors.push(e.message));
    src.start();
    await new Promise(r => setTimeout(r, 150));
    src.stop();
    assert.ok(inputs.length >= 2);
    assert.deepEqual(errors.slice(0, 1), ['boom']);
    await new Promise(r => setTimeout(r, 20));
    const replay = RecordedEventSource.fromJsonl(logPath);
    assert.equal(replay.entries.length, inputs.length);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('RecordedEventSource emits entries as the shared clock advances', () => {
    let now = 0;
    const src = new RecordedEventSource({ entries: [{ t: 10, snapshot: {} }, { t: 20, signal: { type: 'x' } }, { t: 30, snapshot: {} }], clock: { now: () => now } });
    const got = [];
    src.on('input', i => got.push(i.t));
    assert.equal(src.tick(), 0);
    now = 20;
    assert.equal(src.tick(), 2);
    now = 100;
    src.tick();
    assert.deepEqual(got, [10, 20, 30]);
    assert.ok(src.done);
  });
});

describe('CompetitionStateService', () => {
  function fakeIo() {
    const sent = [];
    return { sent, to: (room) => ({ emit: (name, payload) => sent.push({ room, name, payload }) }) };
  }

  it('emits typed events and state updates to the competition room, in order', () => {
    const io = fakeIo();
    const svc = new CompetitionStateService({ compId: 'c1', io });
    const src = new RecordedEventSource({
      entries: [
        { t: 0, snapshot: maskedEcac(0) },
        { t: 15000, snapshot: maskedEcac(1, { rotationsUpTo: 1 }) },
        { t: 20000, signal: { type: 'greenLight', event: 'FLOOR', team: 'NAVY' } }
      ],
      clock: { now: () => 1e9 }
    });
    svc.attach(src);
    src.drain();

    assert.ok(io.sent.every(m => m.room === 'competition:c1'));
    const names = new Set(io.sent.map(m => m.name));
    assert.ok(names.has('competitionState:event'));
    assert.ok(names.has('competitionState:update'));
    const types = io.sent.filter(m => m.name === 'competitionState:event').map(m => m.payload.type);
    assert.ok(types.includes('scorePosted') && types.includes('athleteUp') && types.includes('greenLight'));
    assert.ok(io.sent.filter(m => m.name === 'competitionState:event').every(m => typeof m.payload.confidence === 'number' && Array.isArray(m.payload.evidence)));

    const snapshot = svc.getSnapshot();
    assert.equal(snapshot.running, true);
    assert.ok(snapshot.recentEvents.length > 0);
    assert.equal(snapshot.state._scores, undefined);
    assert.ok(snapshot.state.stateVersion >= 3);
  });
});
