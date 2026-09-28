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
  diffScores, normalizeSnapshot, unitRef, getState, CONFIDENCE, EVENT_TYPES,
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
    assert.deepEqual([...EVENT_TYPES].sort(), ['athleteUp', 'greenLight', 'lineupPosted', 'rotationChanged', 'routineEnded', 'scoreCorrected', 'scorePosted', 'teamTotalChanged']);
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

describe('Shakespeare requirements (ISA2-333)', () => {
  const CONFIG = {
    team1Key: 'navy-mens', team1Tricode: 'NAVY', team2Key: 'william-mary-mens', team2Tricode: 'W&M',
    team3Key: 'simpson-mens', team4Key: 'army-mens', team5Key: 'greenville-mens', team5Tricode: 'GRN',
    team6Key: 'springfield-mens'
  };

  function run(input, opts = {}) {
    const svc = new CompetitionStateService({ compId: 'c2', ...opts });
    const seen = [];
    svc.on('event', (e) => seen.push(e));
    svc.ingest({ t: 0, snapshot: maskedEcac(0) });
    svc.ingest({ t: 1000, snapshot: input });
    return { svc, seen };
  }

  it('team keys come from config.team{N}Key (tricode first, team_order fallback)', () => {
    const { normalizeSnapshot: norm } = { normalizeSnapshot };
    const teams = norm(ECAC, CONFIG).teams;
    const byKey = Object.fromEntries(teams.map(t => [t.key, t.teamKey]));
    assert.equal(byKey.NAVY, 'navy-mens');
    assert.equal(byKey.GRN, 'greenville-mens');
    assert.equal(byKey.SIM, 'simpson-mens'); // no tricode in config: matched by team_order 3
    assert.equal(byKey.SPR, 'springfield-mens');
  });

  it('reducer: unit ids and lineup roles for rotation six', () => {
    const teams = normalizeSnapshot(ECAC, CONFIG).teams;
    const grn = teams.find(t => t.key === 'GRN').events.find(e => e.name === 'VAULT');
    assert.equal(grn.rotation, 6);
    const rows = grn.gymnasts.map(g => [g.name.split(' ')[1], unitRef(teams.find(t => t.key === 'GRN'), grn, g), g.lineupRole]);
    assert.deepEqual(rows.map(r => [r[0], r[1].order, r[2]]),
      [['Avery', 1, 'lineup'], ['Hinson', 2, 'lineup'], ['Clapper', 3, 'lineup'], ['Mays', 4, 'lineup']]);
    assert.deepEqual(rows[0][1], { id: 'u:6:VT:greenville-mens:1', rotation: 6, locus: 'VT', teamKey: 'greenville-mens', order: 1 });

    const navy = teams.find(t => t.key === 'NAVY');
    const bar = navy.events.find(e => e.name === 'BAR');
    const solomon = bar.gymnasts.find(g => g.name === 'Brian Solomon');
    assert.equal(solomon.order, 5);
    assert.equal(solomon.lineupRole, 'individual');
    assert.equal(solomon.nameKey, 'brian solomon');
    assert.equal(solomon.gymnastId, '8' + solomon.gymnastId.slice(1));
    assert.equal(unitRef(navy, bar, solomon).id, 'u:6:HB:navy-mens:5');
  });

  it('every event carries t and a monotonically increasing stateVersion; emitter matches the room broadcast', () => {
    const sent = [];
    const io = { to: () => ({ emit: (name, p) => { if (name === 'competitionState:event') sent.push(p); } }) };
    const svc = new CompetitionStateService({ compId: 'c3', io, config: CONFIG });
    const seen = [];
    svc.on('event', (e) => seen.push(e));
    const src = new RecordedEventSource({
      entries: [
        { t: 0, snapshot: maskedEcac(0) },
        { t: 15000, snapshot: maskedEcac(1, { rotationsUpTo: 1 }) },
        { t: 30000, snapshot: maskedEcac(2, { rotationsUpTo: 1 }) },
        { t: 40000, signal: { type: 'greenLight', event: 'FLOOR', team: 'NAVY' } }
      ],
      clock: { now: () => 1e9 }
    });
    svc.attach(src);
    src.drain();
    assert.ok(seen.length > 0);
    assert.ok(seen.every(e => typeof e.t === 'number' && Number.isInteger(e.stateVersion)));
    const versions = seen.map(e => e.stateVersion);
    assert.deepEqual(versions, [...versions].sort((a, b) => a - b));
    assert.deepEqual(sent.map(({ compId, ...e }) => e), seen);
    assert.equal(svc.getState().stateVersion, svc.getSnapshot().state.stateVersion);
    assert.equal(getState('nope'), null);
  });

  it('emitter also delivers events from LiveVirtiusSource', async () => {
    const svc = new CompetitionStateService({ compId: 'c4', config: CONFIG });
    const seen = [];
    svc.on('event', (e) => seen.push(e));
    const snaps = [maskedEcac(0), maskedEcac(1, { rotationsUpTo: 1 })];
    let i = 0;
    const src = new LiveVirtiusSource({ sessionId: 's', fetchSession: async () => snaps[i++], now: () => 1000 * i, pollIntervalMs: 1e6 });
    src.on('input', (inp) => svc.ingest(inp));
    await src.pollOnce();
    await src.pollOnce();
    assert.ok(seen.some(e => e.type === 'scorePosted'));
    assert.ok(seen.every(e => e.t != null && e.stateVersion != null));
  });

  it('scorePosted carries d, e, nd, bonus, neutral, judges and the unit; lineupPosted fires on change', () => {
    const { seen } = run(maskedEcac(1, { rotationsUpTo: 1 }));
    const p = seen.find(e => e.type === 'scorePosted' && e.athlete.name === 'Daniel Gurevich');
    assert.equal(p.score, '13.350');
    assert.equal(p.d, 4.9);
    assert.equal(p.e, 8.55);
    assert.equal(p.neutral, 0.1);
    assert.equal(p.nd, 0.1);
    assert.equal(p.bonus, 0);
    assert.equal(p.judges.length, 2);
    assert.equal(p.unit.locus, 'FX');
    assert.equal(p.athlete.lineupRole, 'lineup');

    const svc = new CompetitionStateService({ compId: 'c5' });
    const lineups = [];
    svc.on('event', (e) => e.type === 'lineupPosted' && lineups.push(e));
    const s0 = clone(ECAC);
    s0.meet.teams.forEach(t => t.events.forEach(e => e.gymnasts.forEach(g => { g.final_score = null; })));
    svc.ingest({ t: 0, snapshot: s0 });
    assert.equal(lineups.length, 0); // quiet baseline
    const s1 = clone(s0);
    s1.meet.teams[0].events[0].gymnasts.pop();
    svc.ingest({ t: 1, snapshot: s1 });
    svc.ingest({ t: 2, snapshot: s1 });
    assert.equal(lineups.length, 1);
    assert.equal(lineups[0].changed, true);
    assert.equal(lineups[0].lineup.length, ECAC.meet.teams[0].events[0].gymnasts.length - 1);
  });

  it('scoreCorrected carries the previous components; teamTotalChanged lists counting units', () => {
    const a = maskedEcac(1, { rotationsUpTo: 1 });
    const b = clone(a);
    b.meet.teams[0].events[0].gymnasts[0].final_score = '13.400';
    b.meet.teams[0].events[0].gymnasts[0].e_score = '8.600';
    b.meet.teams[0].final_score = '13.400';
    const svc = new CompetitionStateService({ compId: 'c6', config: CONFIG });
    const seen = [];
    svc.on('event', (e) => seen.push(e));
    svc.ingest({ t: 0, snapshot: a });
    svc.ingest({ t: 1, snapshot: b });
    const c = seen.find(e => e.type === 'scoreCorrected');
    assert.equal(c.previousScore, '13.350');
    assert.equal(c.previous.e, 8.55);
    assert.equal(c.e, 8.6);
    const tt = seen.find(e => e.type === 'teamTotalChanged' && e.team === 'NAVY');
    assert.equal(tt.teamKey, 'navy-mens');
    assert.deepEqual(tt.countingUnits, ['u:1:FX:navy-mens:1']);
  });
});
