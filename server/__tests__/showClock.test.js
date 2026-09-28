/**
 * ShowClock + RecordedEventSource (ISA2-296): video and meet state on one timeline.
 * Uses the real ECAC package (meta.json, virtius-final.json, events.jsonl), a fake
 * wall clock, and a fake OBS whose media cursor advances with that wall clock.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadRecordingPackage } from '../lib/recordings/recordingPackage.js';
import { RecordedEventSource } from '../lib/recordings/recordedEventSource.js';
import { rebuildEventLog, rotationWindows } from '../lib/recordings/rebuildEventLog.js';
import { loadRecordedShow, removeRecordedShow } from '../lib/recordings/recordedShow.js';
import { CompetitionStateService } from '../lib/competitionState/service.js';

const MIN = 60000;
const pkg = loadRecordingPackage('ecac-2026');

// Like the real ffmpeg source: a seek lands on the keyframe at or before the target.
function fakeObs(wall, { drift = 1, keyframeMs = 6000 } = {}) {
  const m = { state: 'OBS_MEDIA_STATE_PAUSED', cursor: 0, at: wall(), speed: 1, calls: [] };
  const pos = () => (m.state === 'OBS_MEDIA_STATE_PLAYING' ? m.cursor + (wall() - m.at) * m.speed * drift : m.cursor);
  const settle = () => { m.cursor = pos(); m.at = wall(); };
  return {
    m, pos,
    async call(req, data) {
      m.calls.push(req);
      switch (req) {
        case 'GetMediaInputStatus': return { mediaState: m.state, mediaCursor: Math.round(pos()), mediaDuration: pkg.meta.durationMs };
        case 'SetMediaInputCursor': settle(); m.cursor = Math.floor(data.mediaCursor / keyframeMs) * keyframeMs; return {};
        case 'SetInputSettings':
          // Worst case: OBS reopens the media and starts it from 0.
          settle(); m.speed = data.inputSettings.speed_percent / 100; m.cursor = 0; m.state = 'OBS_MEDIA_STATE_PLAYING'; return {};
        case 'TriggerMediaInputAction': {
          settle();
          const a = data.mediaAction;
          if (a.endsWith('RESTART')) { m.cursor = 0; m.state = 'OBS_MEDIA_STATE_PLAYING'; }
          else if (a.endsWith('PLAY')) m.state = 'OBS_MEDIA_STATE_PLAYING';
          else if (a.endsWith('PAUSE')) m.state = 'OBS_MEDIA_STATE_PAUSED';
          return {};
        }
        default: throw new Error(`unexpected ${req}`);
      }
    }
  };
}

const comparable = (state) => {
  const { stateVersion, _scores, _details, _lineups, _totals, _digest, ...rest } = state;
  return JSON.parse(JSON.stringify(rest));
};

function setup({ drift } = {}) {
  let wall = 1_000_000;
  const now = () => wall;
  const obs = fakeObs(now, { drift });
  const layouts = [];
  const svc = new CompetitionStateService({ compId: 'clock-test' });
  const show = loadRecordedShow('clock-test', {
    pkg, stateService: svc, getObs: () => obs, now, tickMs: 0, sourceTickMs: 0,
    sleep: async (ms) => { wall += ms; },
    applyLayout: async (_obs, _pkg, t) => { layouts.push(t); return { layout: 'x' }; }
  });
  const advance = async (ms, step = 250) => {
    for (let done = 0; done < ms; done += step) {
      wall += step;
      await show.clock.tick();
    }
  };
  return { show, svc, obs, layouts, advance, clock: show.clock, source: show.source };
}

function assertAligned({ clock, source, svc, obs }, label) {
  const t = clock.now();
  assert.ok(Math.abs(obs.pos() - t) <= 1000, `${label}: OBS cursor ${obs.pos()} vs clock ${t}`);
  assert.equal(source._cursor, source.indexAfter(t), `${label}: source emitted exactly the entries up to ${t}`);
  assert.deepEqual(comparable(svc.getPublicState()), comparable(source.stateAt(t)), `${label}: state matches a rebuild at ${t}`);
}

describe('rebuildEventLog', () => {
  it('finds six rotation windows and ends on the exported team totals', () => {
    const wins = rotationWindows(pkg.meta);
    assert.equal(wins.length, 6);
    assert.equal(wins[1].fromMs, 34 * MIN + 32000);
    const rows = rebuildEventLog(pkg.meta, pkg.virtiusFinal);
    assert.equal(rows[0].type, 'meta');
    assert.equal(rows[0].synthetic, true);
    const last = {};
    rows.filter(r => r.type === 'teamTotal').forEach(r => { last[r.team] = r.score; });
    for (const team of pkg.virtiusFinal.meet.teams) assert.equal(last[team.tricode], Number(team.final_score), team.tricode);
  });

  it('the committed events.jsonl is what the rebuilder writes', () => {
    assert.deepEqual(pkg.events, JSON.parse(JSON.stringify(rebuildEventLog(pkg.meta, pkg.virtiusFinal, { recording: 'ecac-2026' }))));
  });
});

describe('RecordedEventSource', () => {
  it('turns the log into Virtius-shaped polls on the poll grid plus greenLight signals', () => {
    const src = RecordedEventSource.fromPackage(pkg, { tickMs: 0 });
    const polls = src.entries.filter(e => e.snapshot);
    assert.ok(polls.every(p => p.t % 15000 === 0));
    assert.ok(src.entries.some(e => e.signal?.type === 'greenLight' && e.signal.source === 'recorded-log'));
    const final = polls[polls.length - 1].snapshot.meet.teams.find(t => t.tricode === 'NAVY');
    assert.equal(final.final_score, '312.200');
    assert.equal(final.events.find(e => e.event_name === 'FLOOR').gymnasts.find(g => g.order === 1).final_score, '13.350');
  });

  it('offsetMs shifts every entry onto the video timeline', () => {
    const a = RecordedEventSource.fromPackage(pkg, { tickMs: 0 });
    const b = RecordedEventSource.fromPackage(pkg, { tickMs: 0, offsetMs: 30000 });
    const ga = a.entries.find(e => e.signal?.type === 'greenLight');
    const gb = b.entries.find(e => e.signal?.type === 'greenLight');
    assert.equal(gb.t - ga.t, 30000);
    assert.equal(a.stateAt(40 * MIN).rotation.current, 2);
  });

  it('seeking rebuilds the same state as a straight playthrough, forward and back', () => {
    let t = 0;
    const straightSrc = RecordedEventSource.fromPackage(pkg, { tickMs: 0, clock: { now: () => t } });
    const straight = new CompetitionStateService({ compId: 'a' });
    straight.attach(straightSrc);

    const seekSrc = RecordedEventSource.fromPackage(pkg, { tickMs: 0, clock: { now: () => 0 } });
    const seeked = new CompetitionStateService({ compId: 'b' });
    seeked.attach(seekSrc);
    let seekEvents = 0;
    seeked.on('event', () => { seekEvents++; });

    // Seek far ahead first, then back, so backward seeks are covered too.
    seekSrc.seek(pkg.meta.durationMs);
    for (const target of [17 * MIN + 30000, 40 * MIN, 40 * MIN + 7000, 71 * MIN, 118 * MIN, pkg.meta.durationMs]) {
      for (; t < target; t += 1000) straightSrc.tick();
      t = target;
      straightSrc.tick();
      seekSrc.seek(pkg.meta.durationMs - target > 30 * MIN ? pkg.meta.durationMs : 0); // jump elsewhere first
      seekSrc.seek(target);
      assert.deepEqual(comparable(seeked.getPublicState()), comparable(straight.getPublicState()), `state at ${target}`);
    }
    assert.equal(seekEvents, 0, 'a seek emits no typed events');
    assert.equal(straight.getPublicState().rotation.isFinal, true);
    straight.stop(); seeked.stop();
  });
});

describe('ShowClock', () => {
  it('keeps OBS, the event source and the state service aligned through play, pause, seek back, seek forward and 2x', async () => {
    const ctx = setup();
    const { clock, obs, layouts, advance, svc } = ctx;
    await clock.seek(0);
    assertAligned(ctx, 'loaded');

    await clock.play();
    await advance(20 * MIN, 1000);
    assert.ok(Math.abs(clock.now() - 20 * MIN) <= 1000);
    assertAligned(ctx, 'play 20 min');
    assert.ok(svc.getPublicState().standings.length > 0, 'scores posted by 20:00');

    await clock.pause();
    const pausedAt = clock.now();
    await advance(MIN, 1000);
    assert.equal(clock.now(), pausedAt, 'paused clock does not move');
    assert.equal(obs.m.state, 'OBS_MEDIA_STATE_PAUSED');
    assertAligned(ctx, 'pause');

    await clock.seek(5 * MIN);
    assert.equal(clock.now(), 5 * MIN);
    assertAligned(ctx, 'seek back');
    assert.equal(svc.getPublicState().standings.length, 0, 'no scores at 5:00');

    await clock.seek(40 * MIN);
    assertAligned(ctx, 'seek forward');
    assert.equal(svc.getPublicState().rotation.current, 2);
    assert.ok(Math.abs(obs.pos() - 40 * MIN) <= 250, `OBS at ${obs.pos()} after seeking to 40:00 (keyframe catch-up)`);
    assert.equal(obs.m.state, 'OBS_MEDIA_STATE_PAUSED');
    assert.ok(layouts.some(t => t === 40 * MIN), 'applyLayout called for the 3x2 block at 40:00');

    await clock.play();
    await clock.setRate(2);
    assert.equal(obs.m.speed, 2);
    const before = clock.now();
    await advance(3 * MIN, 250);
    assert.ok(Math.abs(clock.now() - before - 6 * MIN) <= 1000, `2x: ${clock.now() - before}`);
    assertAligned(ctx, '2x');
    assert.ok(layouts.some(t => t >= 44 * MIN + 3000 && t < 44 * MIN + 5000), 'crossing 44:03 applied the next layout');

    await clock.pause();
    assertAligned(ctx, 'pause after 2x');
    assert.equal(clock.status().rate, 2);
    removeRecordedShow('clock-test');
  });

  it('follows the video when OBS drifts', async () => {
    const ctx = setup({ drift: 0.9 });
    await ctx.clock.seek(30 * MIN);
    await ctx.clock.play();
    await ctx.advance(MIN, 250);
    assert.ok(Math.abs(ctx.obs.pos() - ctx.clock.now()) <= 750 + 250, 'clock re-anchored to the video');
    assert.equal(ctx.source._cursor, ctx.source.indexAfter(ctx.clock.now()));
    removeRecordedShow('clock-test');
  });

  it('rejects rates OBS cannot play and runs without OBS', async () => {
    const svc = new CompetitionStateService({ compId: 'no-obs' });
    const show = loadRecordedShow('no-obs', { pkg, stateService: svc, tickMs: 0, sourceTickMs: 0 });
    await assert.rejects(show.clock.setRate(5));
    const status = await show.clock.seek(40 * MIN);
    assert.equal(status.obsConnected, false);
    assert.equal(status.positionMs, 40 * MIN);
    assert.equal(svc.getPublicState().rotation.current, 2);
    removeRecordedShow('no-obs');
  });
});
