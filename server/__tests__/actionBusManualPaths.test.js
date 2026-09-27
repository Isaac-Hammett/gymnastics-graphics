/**
 * Manual and rundown paths on the action bus (ISA2-281)
 *
 * The rundown engine, the producer's scene buttons, and GraphicsControl all
 * run through bus.execute. These tests check the OBS call order, the payload
 * written, the sender on `action:executed`, and that rehearsal mode and the
 * catalog rules still hold.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';

import { MockOBSWebSocket } from './helpers/mockOBS.js';
import { createFakeDb } from './helpers/fakeFirebaseDb.js';
import { ActionBus, ACTION_ERRORS } from '../lib/actionBus.js';
import { buildGraphicPayload, buildManualGraphicPayload, manualGraphicType } from '../lib/graphicPayload.js';
import { TimesheetEngine, SEGMENT_TYPES, TRANSITION_TYPES } from '../lib/timesheetEngine.js';

const COMP_ID = 'ecac-2026-agent-test';
const GRAPHIC_PATH = `competitions/${COMP_ID}/currentGraphic`;

class FakeConnectionManager extends EventEmitter {
  constructor(connection) { super(); this.connection = connection; }
  getConnection(compId) { return compId === COMP_ID ? this.connection : null; }
}

function setup() {
  const db = createFakeDb();
  db._seed(`competitions/${COMP_ID}/config`, {
    compType: 'womens-dual', eventName: 'ECAC Test Meet', meetTheme: '',
    team1Name: 'Navy', team1Key: 'navy-womens', team2Name: 'Army', team2Key: 'army-womens',
  });
  const obs = new MockOBSWebSocket();
  const manager = new FakeConnectionManager(obs);
  const bus = new ActionBus({
    compId: COMP_ID, firebase: db, obsConnectionManager: manager,
    sceneConfirmTimeoutMs: 150, obsCallTimeoutMs: 150,
  });
  const executed = [];
  bus.on('executed', r => executed.push(r));
  return { db, obs, manager, bus, executed };
}

describe('bus: uncatalogued trusted callers', () => {
  let ctx;
  beforeEach(() => { ctx = setup(); });

  it('rejects an unlisted scene unless the caller is trusted', async () => {
    const ack = await ctx.bus.execute({ actionId: 'scene:Rundown Only', sender: 'xavier' });
    assert.equal(ack.error, ACTION_ERRORS.UNKNOWN_ACTION);
    assert.equal(ctx.obs.getCallCount('SetCurrentProgramScene'), 0);
  });

  it('runs an unlisted scene for a trusted caller, transition first', async () => {
    ctx.obs.addScene('Rundown Only');
    const ack = await ctx.bus.execute({
      actionId: 'scene:Rundown Only', sender: 'rundown', uncatalogued: true,
      params: { transition: { type: TRANSITION_TYPES.FADE, durationMs: 500 } },
    });
    assert.equal(ack.ok, true);
    const methods = ctx.obs._callHistory.map(c => c.method);
    const order = ['SetCurrentSceneTransitionDuration', 'SetCurrentSceneTransition', 'SetCurrentProgramScene']
      .map(m => methods.indexOf(m));
    assert.ok(order.every(i => i >= 0), `missing calls in ${methods}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.equal(ctx.executed.at(-1).sender, 'rundown');
  });

  it('writes the same payload as buildGraphicPayload, with the segment ID', async () => {
    const ack = await ctx.bus.execute({
      actionId: 'graphic:team-coaches', sender: 'rundown', uncatalogued: true, includeDetails: true,
      params: { graphicParams: { teamSlot: 2 }, segmentId: 'seg-9' },
    });
    assert.equal(ack.ok, true);
    const expected = await buildGraphicPayload({
      db: ctx.db, compId: COMP_ID, graphicId: 'team-coaches',
      graphicParams: { teamSlot: 2 }, segmentId: 'seg-9', timestamp: ack.details.payload.timestamp,
    });
    assert.deepEqual(ack.details.payload, expected);
    assert.equal(ctx.db._writes.at(-1).path, GRAPHIC_PATH);
  });
});

describe('manual graphic payload', () => {
  it('maps button IDs to the renderer types GraphicsControl used', () => {
    assert.equal(manualGraphicType('floor'), 'event-frame');
    assert.equal(manualGraphicType('leaderboard-fx'), 'virtius-leaderboard');
    assert.equal(manualGraphicType('team2-roster'), 'team-roster');
    assert.equal(manualGraphicType('logos'), 'logos');
  });

  it('carries frame title, leaderboard fields, and ten team slots', async () => {
    const { db } = setup();
    const lb = await buildManualGraphicPayload({
      db, compId: COMP_ID, graphicId: 'leaderboard-fx',
      leaderboardEvent: 'fx', leaderboardGender: 'womens',
    });
    assert.equal(lb.graphic, 'virtius-leaderboard');
    assert.equal(lb.graphicId, 'leaderboard-fx');
    assert.equal(lb.data.leaderboardEvent, 'fx');
    assert.equal(lb.data.leaderboardGender, 'womens');
    assert.equal(lb.data.compType, 'womens-dual');
    assert.equal(lb.data.team10Name, '');
    assert.equal('segmentId' in lb, false);

    const frame = await buildManualGraphicPayload({
      db, compId: COMP_ID, graphicId: 'floor', frameTitle: 'Floor Exercise',
    });
    assert.equal(frame.graphic, 'event-frame');
    assert.equal(frame.data.frameTitle, 'Floor Exercise');
  });

  it('bus manual send and clear write currentGraphic and ack', async () => {
    const { db, bus, executed } = setup();
    const send = await bus.execute({
      actionId: 'graphic:team1-roster', sender: 'producer',
      params: { manual: true },
    });
    assert.equal(send.ok, true);
    assert.equal(db._writes.at(-1).value.graphic, 'team-roster');
    assert.equal(db._writes.at(-1).value.data.teamSlot, undefined);

    const clear = await bus.execute({ actionId: 'graphic:clear', sender: 'producer', params: { manual: true } });
    assert.equal(clear.ok, true);
    assert.equal(db._writes.at(-1).value.graphic, 'clear');
    assert.deepEqual(executed.map(e => e.sender), ['producer', 'producer']);
  });
});

describe('TimesheetEngine on the bus', () => {
  let ctx;
  let engine;
  beforeEach(() => {
    ctx = setup();
    engine = new TimesheetEngine({
      compId: COMP_ID, obsConnectionManager: ctx.manager, firebase: ctx.db, actionBus: ctx.bus,
      showConfig: { segments: [] },
    });
  });

  it('switches scenes as sender "rundown" and emits sceneChanged', async () => {
    ctx.obs.addScene('Single - Camera 1');
    const changed = [];
    engine.on('sceneChanged', e => changed.push(e));
    await engine._applyTransitionAndSwitchScene(
      { id: 's1', obsScene: 'Single - Camera 1' }, { type: TRANSITION_TYPES.CUT, durationMs: 0 }
    );
    assert.equal(ctx.obs.wasCalledWith('SetCurrentProgramScene', { sceneName: 'Single - Camera 1' }), true);
    assert.equal(ctx.executed.at(-1).sender, 'rundown');
    assert.equal(ctx.executed.at(-1).actionId, 'scene:Single - Camera 1');
    assert.equal(changed.length, 1);
  });

  it('fires graphics as sender "rundown" and emits graphicTriggered', async () => {
    const fired = [];
    engine.on('graphicTriggered', e => fired.push(e));
    await engine._triggerGraphic({
      id: 's2', type: SEGMENT_TYPES.GRAPHIC, graphic: { graphicId: 'team-coaches', params: { teamSlot: 1 } },
    });
    assert.equal(ctx.executed.at(-1).sender, 'rundown');
    assert.equal(ctx.db._writes.at(-1).value.segmentId, 's2');
    assert.equal(fired[0].graphicId, 'team-coaches');
  });

  it('reports a failed scene switch as an engine error', async () => {
    const errors = [];
    engine.on('error', e => errors.push(e));
    ctx.obs.injectErrorOnMethod('SetCurrentProgramScene', new Error('boom'));
    await engine._applyTransitionAndSwitchScene(
      { id: 's1', obsScene: 'Nope' }, { type: TRANSITION_TYPES.CUT, durationMs: 0 }
    );
    assert.equal(errors[0]?.type, 'obs_scene_switch');
  });

  it('skips the bus in rehearsal mode', async () => {
    engine.setRehearsalMode?.(true);
    engine._isRehearsalMode = true;
    await engine._applyTransitionAndSwitchScene({ id: 's1', obsScene: 'X' }, { type: 'cut' });
    await engine._triggerGraphic({ id: 's2', graphic: 'team-coaches' });
    assert.equal(ctx.executed.length, 0);
  });

  it('overrideScene works without the legacy this.obs connection', async () => {
    assert.equal(engine.obs, null);
    ctx.obs.addScene('BRB');
    const ok = await engine.overrideScene('BRB', 'tester');
    assert.equal(ok, true);
    assert.equal(ctx.executed.at(-1).sender, 'producer');
  });

  it('overrideCamera finds the camera in Firebase and switches its scene', async () => {
    ctx.db._seed(`competitions/${COMP_ID}/production/cameras`, {
      cam1: { id: 'cam1', name: 'Camera 1' },
    });
    ctx.obs.addScene('Single - Camera 1');
    const ok = await engine.overrideCamera('cam1', 'tester');
    assert.equal(ok, true);
    assert.equal(ctx.executed.at(-1).actionId, 'scene:Single - Camera 1');
  });
});
