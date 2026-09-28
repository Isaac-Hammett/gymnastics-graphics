/**
 * Gymnastics sport pack tests (ISA2-338, SS-02)
 *
 * Reproduces the race math in docs/PRD-Show-Schema/design.md section 9 and
 * Appendix A from recordings/ecac-2026/virtius-final.json with no live
 * dependency: team-event scores from lineup sums, standings after every
 * rotation of a progressive replay, needs, margins, and reachability.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pack, { init } from '../lib/shakespeare/packs/gymnastics/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const FEED = JSON.parse(fs.readFileSync(path.join(REPO, 'recordings/ecac-2026/virtius-final.json'), 'utf8'));
const EVENTS = pack.replayEvents(FEED);

/** Replay every synthetic event except those `skip` rejects. */
function replay(skip = () => false, feed = FEED, events = EVENTS) {
  let { state } = init({ compId: 'ecac-2026-agent-test' }, feed);
  for (const e of events) if (!skip(e)) state = pack.applyEvent(state, e).state;
  return state;
}

/** Replay up to (not including) the first event matching `stop`. */
function replayUntil(stop) {
  let { state } = init({}, FEED);
  for (const e of EVENTS) {
    if (stop(e)) break;
    state = pack.applyEvent(state, e).state;
  }
  return state;
}

const athleteNamed = (state, name) => Object.values(state.actors).find(a => a.displayName.endsWith(name)).id;
const unitOf = (state, name, locus) => Object.values(state.units).find(u => u.actorId === athleteNamed(state, name) && u.locus === locus);
const isScoreOf = (e, name, event) => e.type === 'scorePosted' && e.event === event && e.athlete.name.endsWith(name);

describe('describe(): format read from the feed', () => {
  it('reads six loci, six rotations, four up four count from the ECAC feed', () => {
    const ctx = pack.describe({}, FEED);
    assert.equal(ctx.packId, 'gymnastics');
    assert.deepEqual(ctx.format.loci, ['FX', 'PH', 'SR', 'VT', 'PB', 'HB']);
    assert.equal(ctx.format.rotations, 6);
    assert.equal(ctx.format.lineupSize, 4);
    assert.equal(ctx.format.countingScores, 4);
    assert.equal(ctx.format.countingSource, 'feed');
    assert.equal(ctx.counting.checked, 36);
    assert.equal(ctx.format.scoreScale.max, undefined, 'men are uncapped');
    // Schedule from each event's rotation field (six teams).
    assert.equal(ctx.format.scheduleSource, 'feed');
    assert.deepEqual(ctx.schedule.GRN, { 1: 'PB', 2: 'HB', 3: 'FX', 4: 'PH', 5: 'SR', 6: 'VT' });
    assert.deepEqual(ctx.schedule['W&M'], { 1: 'PH', 2: 'SR', 3: 'VT', 4: 'PB', 5: 'HB', 6: 'FX' });
    assert.equal(ctx.teams.find(t => t.id === 'ARMY').home, true);
  });

  it('defaults women to six up five count with a 10.0 maximum when the feed cannot say', () => {
    const ctx = pack.describe({ compType: 'womens-quad' }, { meet: { teams: [] } });
    assert.equal(ctx.format.lineupSize, 6);
    assert.equal(ctx.format.countingScores, 5);
    assert.equal(ctx.format.countingSource, 'default');
    assert.equal(ctx.format.scoreScale.max, 10);
    assert.deepEqual(ctx.format.loci, ['VT', 'UB', 'BB', 'FX']);
  });
});

describe('Done when 1: all 36 ECAC team-event scores from lineup sums', () => {
  it('reproduces every event_score from type: 1 scores only', () => {
    const state = replay();
    const computed = pack.teamEventScores(state);
    assert.equal(computed.length, 36);
    let checked = 0;
    for (const team of FEED.meet.teams) {
      for (const ev of team.events) {
        const row = computed.find(c => c.teamId === team.tricode && c.rotation === ev.rotation);
        assert.ok(row, `${team.tricode} R${ev.rotation}`);
        assert.equal(row.score, Number(ev.event_score), `${team.tricode} ${ev.event_name} R${ev.rotation}`);
        assert.equal(row.complete, true);
        checked++;
      }
    }
    assert.equal(checked, 36);
  });

  it("does not count Hinson's 12.30 on Greenville rings in rotation five", () => {
    const state = replay();
    const row = pack.teamEventScores(state).find(c => c.teamId === 'GRN' && c.rotation === 5);
    assert.equal(row.locus, 'SR');
    assert.equal(row.score, 48.35);
    const hinson = unitOf(state, 'Hinson', 'SR');
    assert.equal(hinson.lineupRole, 'individual');
    assert.equal(hinson.result.score, 12.3);
    assert.equal(hinson.result.counts, false);
    const cruz = unitOf(state, 'Cruz', 'SR');
    assert.equal(cruz.result.score, 11.2);
    assert.equal(cruz.result.counts, true);
  });

  it('drops the lowest lineup score under six up five count', () => {
    const g = (id, order, score, type = 1) => ({ gymnast_id: id, full_name: `A ${id}`, order, type, final_score: score });
    const feed = {
      meet: {
        sex: 'women',
        teams: [{
          tricode: 'AAA', name: 'A', team_order: 1, final_score: '49.250',
          events: [{ event_name: 'VAULT', rotation: 1, event_score: '49.250', gymnasts: [
            g(1, 1, '9.800'), g(2, 2, '9.850'), g(3, 3, '9.100'), g(4, 4, '9.900'), g(5, 5, '9.850'), g(6, 6, '9.850'), g(7, 7, '9.950', 0)
          ] }]
        }]
      }
    };
    const ctx = pack.describe({}, feed);
    assert.equal(ctx.format.lineupSize, 6);
    assert.equal(ctx.format.countingScores, 5);
    assert.equal(ctx.format.countingSource, 'feed');
    let { state } = init({}, feed);
    for (const e of pack.replayEvents(feed)) state = pack.applyEvent(state, e).state;
    assert.equal(pack.standings(state)[0].total, 49.25);
    const low = Object.values(state.units).find(u => u.actorId === 'ath:3');
    assert.equal(low.result.counts, false);
  });
});

describe('Done when 2: needs and margins reproduce section 9', () => {
  // Each need treats every other routine as final: replay everything except
  // the routine in question (and, for rotation-four and -five needs, later rotations).
  it('Mays needs more than 12.85 to win the title and more than 12.70 to pass Army', () => {
    const state = replay(e => isScoreOf(e, 'Mays', 'VAULT'));
    const mays = unitOf(state, 'Mays', 'VT');
    const title = pack.need('o:team_title', mays, state);
    assert.equal(title.value, 12.85);
    assert.equal(title.target, 'NAVY');
    assert.equal(title.strict, true);
    assert.equal(title.status, 'open');
    assert.ok(title.assumptions.some(a => a.unitId.includes(':HB:NAVY:') && a.treatedAs === 'final'));
    assert.equal(pack.need('o:team_title', mays, state, 'ARMY').value, 12.7);

    // Same number live, from a strict prefix of the replay (Navy and Army were done).
    const live = replayUntil(e => isScoreOf(e, 'Mays', 'VAULT'));
    assert.equal(pack.need('o:team_title', unitOf(live, 'Mays', 'VT'), live).value, 12.85);
  });

  it('Washburn needs more than 13.00 for Navy to pass Army for second', () => {
    const state = replay(e => isScoreOf(e, 'Washburn', 'BAR'));
    const u = unitOf(state, 'Washburn', 'HB');
    const r = pack.need('o:team_place:2', u, state);
    assert.equal(r.target, 'ARMY');
    assert.equal(r.value, 13);
    assert.equal(pack.need('o:team_title', u, state, 'ARMY').value, 13);
  });

  it('Hinson needs more than 13.05 to win the all-around', () => {
    const state = replay(e => isScoreOf(e, 'Hinson', 'VAULT'));
    const r = pack.need('o:aa_title', unitOf(state, 'Hinson', 'VT'), state);
    assert.equal(r.target, athleteNamed(state, 'Solomon'));
    assert.equal(r.value, 13.05);
  });

  it('Tully needs more than 13.40 for third in the all-around (14.35 to catch Solomon)', () => {
    const state = replay(e => isScoreOf(e, 'Tully', 'FLOOR'));
    const u = unitOf(state, 'Tully', 'FX');
    const third = pack.need('o:aa_place:3', u, state);
    assert.equal(third.target, athleteNamed(state, 'Soltz'));
    assert.equal(third.value, 13.4);
    assert.equal(pack.need('o:aa_title', u, state, athleteNamed(state, 'Solomon')).value, 14.35);
  });

  it('Petros needs more than 13.25 for the high bar lead', () => {
    const state = replayUntil(e => isScoreOf(e, 'Petros', 'BAR'));
    const r = pack.need('o:event_title:HB', unitOf(state, 'Petros', 'HB'), state);
    assert.equal(r.target, athleteNamed(state, 'Tiedemann'));
    assert.equal(r.value, 13.25);
  });

  it('Clapper needs more than 14.00 for vault', () => {
    const state = replay(e => isScoreOf(e, 'Clapper', 'VAULT'));
    const r = pack.need('o:event_title:VT', unitOf(state, 'Clapper', 'VT'), state);
    assert.equal(r.target, athleteNamed(state, 'Jones'));
    assert.equal(r.value, 14);
  });

  it('earlier needs: Roth 13.40 / 14.40 in rotation four, Petros 13.20 in rotation five', () => {
    const r4 = replay(e => isScoreOf(e, 'Roth', 'HORSE') || (e.rotation != null && e.rotation > 4));
    const roth = unitOf(r4, 'Roth', 'PH');
    assert.equal(pack.need('o:team_title', roth, r4, 'ARMY').value, 13.4);
    assert.equal(pack.need('o:team_title', roth, r4, 'NAVY').value, 14.4);
    const r5 = replay(e => isScoreOf(e, 'Petros', 'PBARS') || (e.rotation != null && e.rotation > 5));
    assert.equal(pack.need('o:team_title', unitOf(r5, 'Petros', 'PB'), r5, 'ARMY').value, 13.2);
  });

  it('an individual cannot move the team total', () => {
    const state = replay(e => isScoreOf(e, 'Solomon', 'BAR'));
    const u = unitOf(state, 'Solomon', 'HB');
    assert.equal(u.lineupRole, 'individual');
    assert.equal(pack.need('o:team_title', u, state).status, 'not_counting');
  });

  it('final margins: Navy over Army 0.150, Greenville over Navy 1.000', () => {
    const state = replay();
    assert.deepEqual(pack.margin('o:team_place:2', state), { leader: 'NAVY', second: 'ARMY', value: 0.15 });
    assert.deepEqual(pack.margin('o:team_title', state), { leader: 'GRN', second: 'NAVY', value: 1 });
  });

  it("settle(): Mays's need settles yes on his 13.85", () => {
    let state = replay(e => isScoreOf(e, 'Mays', 'VAULT'));
    const n = pack.need('o:team_title', unitOf(state, 'Mays', 'VT'), state);
    const prop = { id: 'p1', unitId: n.unitId, outcomeId: n.outcomeId, number: { type: 'need', value: n.value }, settler: { evidenceType: 'scorePosted', minConfidence: 0.9 } };
    const res = pack.applyEvent(state, EVENTS.find(e => isScoreOf(e, 'Mays', 'VAULT')));
    const s = pack.settle(prop, res.event);
    assert.equal(s.settled, true);
    assert.equal(s.result.value, 'yes');
    assert.equal(s.result.score, 13.85);
    assert.equal(pack.settle(prop, { ...res.event, unitId: 'other' }).settled, false);
    assert.equal(pack.settle(prop, { ...res.event, confidence: 0.5 }).settled, false);
  });
});

describe('Done when 3: reachability', () => {
  it('Simpson is cap-reachable for the title after every rotation through five, eliminated in six', () => {
    let { state } = init({}, FEED);
    let rotation = 0;
    const statusAfter = {};
    const inSix = [];
    for (const e of EVENTS) {
      if (e.type === 'rotationChanged' && rotation) statusAfter[rotation] = pack.reachability('o:team_title', state).SIM;
      if (e.type === 'rotationChanged') rotation = e.rotation;
      state = pack.applyEvent(state, e).state;
      if (rotation === 6 && e.type === 'scorePosted') inSix.push(pack.reachability('o:team_title', state).SIM);
    }
    assert.deepEqual(statusAfter, { 1: 'live', 2: 'live', 3: 'live', 4: 'live', 5: 'live' });
    assert.ok(inSix.includes('eliminated'), 'eliminated during rotation six');
    assert.equal(pack.reachability('o:team_title', state).SIM, 'settled');
  });

  it("William & Mary's fourth-place battle is live throughout rotation six", () => {
    let { state } = init({}, FEED);
    let rotation = 0;
    let seen = 0;
    for (const e of EVENTS) {
      if (e.type === 'rotationChanged') rotation = e.rotation;
      if (rotation === 6 && e.type === 'scorePosted' && e.team === 'W&M') {
        assert.equal(pack.reachability('o:team_place:4', state)['W&M'], 'live', `before ${e.athlete.name}`);
        seen++;
      }
      state = pack.applyEvent(state, e).state;
    }
    assert.equal(seen, 4);
  });

  it('Greenville clinches the title on Mays’s vault', () => {
    const before = replayUntil(e => isScoreOf(e, 'Mays', 'VAULT'));
    assert.equal(pack.reachability('o:team_title', before).GRN, 'live');
    const after = pack.applyEvent(before, EVENTS.find(e => isScoreOf(e, 'Mays', 'VAULT'))).state;
    assert.equal(pack.reachability('o:team_title', after).GRN, 'clinched');
  });

  it('dead_by_projection when the value model says P < 0.02', () => {
    const state = replayUntil(e => e.type === 'rotationChanged' && e.rotation === 4);
    const r = pack.reachability('o:team_title', state, { probabilities: { SIM: 0.001 } });
    assert.equal(r.SIM, 'dead_by_projection');
  });

  it('mathematical flavor is women only; men have no score ceiling', () => {
    const state = replayUntil(e => e.type === 'rotationChanged' && e.rotation === 2);
    assert.throws(() => pack.reachability('o:team_title', state, { flavor: 'mathematical' }), /rule maximum/);
  });

  it('mathematical flavor uses the 10.0 rule maximum for women', () => {
    const g = (id, order, score) => ({ gymnast_id: id, full_name: `W ${id}`, order, type: 1, final_score: score });
    const lineup = (base, score) => [1, 2, 3, 4, 5, 6].map(i => g(base + i, i, score));
    const feed = { meet: { sex: 'women', teams: [
      { tricode: 'AAA', team_order: 1, events: [
        { event_name: 'VAULT', rotation: 1, event_score: '49.500', gymnasts: lineup(0, '9.900') },
        { event_name: 'BARS', rotation: 2, event_score: '', gymnasts: lineup(0, '') }] },
      { tricode: 'BBB', team_order: 2, events: [
        { event_name: 'BARS', rotation: 1, event_score: '42.500', gymnasts: lineup(10, '8.500') },
        { event_name: 'VAULT', rotation: 2, event_score: '', gymnasts: lineup(10, '') }] }
    ] } };
    let { state } = init({}, feed);
    for (const e of pack.replayEvents(feed)) state = pack.applyEvent(state, e).state;
    // BBB trails by 7.000: five counting 10.0s (50.0) against AAA's zero floor keeps it mathematically live.
    assert.equal(pack.reachability('o:team_title', state, { flavor: 'mathematical' }).BBB, 'live');
    // Practical: AAA's bars floor (9.0 x 5 = 45.0) leaves 94.5, beyond BBB's 42.5 + 50.0.
    assert.equal(pack.reachability('o:team_title', state).BBB, 'eliminated');
  });

  it('actor priors drive caps and floors when present', () => {
    const r5 = replayUntil(e => e.type === 'rotationChanged' && e.rotation === 6);
    // Priors tight enough that Simpson's pommel horse cannot close 13.1 on Army.
    const priors = {};
    for (const a of Object.values(r5.actors)) {
      if (a.kind !== 'athlete') continue;
      priors[a.id] = Object.fromEntries(r5.context.format.loci.map(l => [l, { mean: 12.5, high: 13.2, sd: 0.3, source: 'test', asOf: '2026-04-01' }]));
    }
    const withPriors = { ...r5, actors: Object.fromEntries(Object.entries(r5.actors).map(([id, a]) => [id, priors[id] ? { ...a, priors: priors[id] } : a])) };
    assert.equal(pack.reachability('o:team_title', r5).SIM, 'live');
    assert.equal(pack.reachability('o:team_title', withPriors).SIM, 'eliminated');
  });
});

describe('Done when 4: progressive replay matches Appendix A after every rotation', () => {
  const APPENDIX_A = {
    1: [['NAVY', 54.45], ['ARMY', 54.05], ['GRN', 53.65], ['W&M', 50.4], ['SIM', 50.1], ['SPR', 47.15]],
    2: [['NAVY', 106.65], ['ARMY', 106.3], ['GRN', 103.8], ['SIM', 103.0], ['SPR', 100.7], ['W&M', 100.3]],
    3: [['NAVY', 157.35], ['ARMY', 157.2], ['GRN', 156.8], ['W&M', 154.3], ['SPR', 152.25], ['SIM', 150.2]],
    4: [['NAVY', 209.8], ['GRN', 209.5], ['ARMY', 208.8], ['W&M', 206.15], ['SPR', 203.7], ['SIM', 197.5]],
    5: [['ARMY', 263.0], ['NAVY', 261.0], ['SPR', 258.0], ['GRN', 257.85], ['W&M', 257.15], ['SIM', 249.9]],
    6: [['GRN', 313.2], ['NAVY', 312.2], ['ARMY', 312.05], ['W&M', 310.45], ['SPR', 308.1], ['SIM', 300.15]]
  };
  const AA_LEADER = { 1: 'Blank', 2: 'Blank', 3: 'Hinson', 4: 'Hinson', 5: 'Solomon', 6: 'Hinson' };

  it('replays scorePosted events by rotation and order', () => {
    assert.equal(EVENTS.filter(e => e.type === 'scorePosted').length, 153);
    let { state } = init({}, FEED);
    let rotation = 0;
    const check = r => {
      const got = pack.standings(state).map(s => [s.teamId, s.total]);
      assert.deepEqual(got, APPENDIX_A[r], `standings after rotation ${r}`);
      const aa = pack.allAroundStandings(state)[0];
      assert.ok(state.actors[aa.actorId].displayName.endsWith(AA_LEADER[r]), `all-around leader after rotation ${r}`);
    };
    for (const e of EVENTS) {
      if (e.type === 'rotationChanged' && rotation) check(rotation);
      if (e.type === 'rotationChanged') rotation = e.rotation;
      state = pack.applyEvent(state, e).state;
    }
    check(6);
    assert.equal(state.final, true);
    const aa = pack.allAroundStandings(state).map(a => [state.actors[a.actorId].displayName.split(' ').pop(), a.total]);
    assert.deepEqual(aa, [['Hinson', 78.75], ['Solomon', 78.1], ['Tully', 77.55], ['Soltz', 77.15], ['Blank', 76.5], ['Doiron', 71.15]]);
  });

  it('accepts the state service event shape (eventCode, string score, no rotation)', () => {
    let { state } = init({}, FEED);
    const res = pack.applyEvent(state, {
      type: 'scorePosted', t: 1, event: 'FLOOR', eventCode: 'FX', team: 'NAVY',
      athlete: { id: '8216', name: 'Daniel Gurevich', order: 1 }, score: '13.350', confidence: 0.95, evidence: []
    });
    assert.equal(res.event.unitId, 'u:1:FX:NAVY:1');
    assert.ok(res.touched.outcomes.includes('o:team_title'));
    state = res.state;
    assert.equal(pack.standings(state).find(s => s.teamId === 'NAVY').total, 13.35);
    state = pack.applyEvent(state, { type: 'scoreCorrected', t: 2, eventCode: 'FX', team: 'NAVY', athlete: { id: '8216', order: 1 }, score: '13.450', previousScore: '13.350' }).state;
    assert.equal(pack.standings(state).find(s => s.teamId === 'NAVY').total, 13.45);
    assert.equal(state.units['u:1:FX:NAVY:1'].status, 'corrected');
  });

  it('slot units stand in where the lineup is unknown and bind on the first score', () => {
    const ctx = pack.describe({}, FEED);
    const slots = pack.units(ctx, []);
    assert.equal(slots.length, 6 * 6 * 4);
    assert.ok(slots.every(u => u.actorId === null && u.lineupRole === 'lineup'));
    let state = pack.createState(ctx);
    state = pack.applyEvent(state, { type: 'scorePosted', t: 1, eventCode: 'VT', team: 'ARMY', athlete: { id: '8228', name: 'Jaden Blank', order: 1 }, score: 13.55 }).state;
    assert.equal(state.units['u:1:VT:ARMY:1'].actorId, 'ath:8228');
  });

  it('outcomes() lists the roots with subjects', () => {
    const state = replay();
    const os = pack.outcomes(state.context, state);
    const ids = os.map(o => o.id);
    for (const id of ['o:team_title', 'o:team_place:2', 'o:team_place:6', 'o:aa_title', 'o:aa_place:3', 'o:event_title:FX', 'o:event_title:HB']) {
      assert.ok(ids.includes(id), id);
    }
    assert.equal(os.find(o => o.id === 'o:team_title').prizeWeight, 1);
    assert.equal(os.find(o => o.id === 'o:aa_title').subjects.length, 6);
  });
});

describe('Done when 5: no apparatus name outside packs/gymnastics/', () => {
  const ROOT = path.join(REPO, 'server/lib/shakespeare');
  const PACK = path.join(ROOT, 'packs', 'gymnastics');
  const PATTERNS = [
    /\b(FLOOR|HORSE|RINGS|VAULT|PBARS|BAR|BARS|BEAM)\b/,
    /\b(FX|PH|SR|VT|PB|HB|UB|BB)\b/,
    /\b(floor exercise|pommel|still rings|rings|vault|parallel bars|p-bars|high bar|horizontal bar|uneven bars|balance beam|beam)\b/i
  ];
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });

  it('finds none in server/lib/shakespeare outside the pack', () => {
    const offenders = [];
    for (const file of walk(ROOT)) {
      if (file.startsWith(PACK + path.sep)) continue;
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (PATTERNS.some(re => re.test(line))) offenders.push(`${path.relative(REPO, file)}:${i + 1}: ${line.trim()}`);
      });
    }
    assert.deepEqual(offenders, []);
  });

  it('the patterns do match inside the pack (the grep works)', () => {
    const text = walk(PACK).map(f => fs.readFileSync(f, 'utf8')).join('\n');
    for (const re of PATTERNS) assert.ok(re.test(text), String(re));
  });
});
