/**
 * Action Bus Tests (ISA2-272)
 *
 * Covers catalog building, the scene and graphic executors, the ack shape,
 * OBS confirmation, failure reporting, guardrails, and observation of human
 * actions. OBS is the shared MockOBSWebSocket; Firebase reads come from a
 * fixture tree rather than a mocked client.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';

import { MockOBSWebSocket } from './helpers/mockOBS.js';
import { createFakeDb } from './helpers/fakeFirebaseDb.js';
import {
  ActionBus,
  ACTION_ERRORS,
  ACTION_KINDS,
  isGraphicAvailable,
  parseCompType,
  perTeamGraphicId,
} from '../lib/actionBus.js';
import { buildGraphicPayload, buildClearPayload } from '../lib/graphicPayload.js';

const COMP_ID = 'ecac-2026-agent-test';
const GRAPHIC_PATH = `competitions/${COMP_ID}/currentGraphic`;

/** An obsConnectionManager stand-in that hands out one connection. */
class FakeConnectionManager extends EventEmitter {
  constructor(connection) {
    super();
    this.connection = connection || null;
  }
  getConnection(compId) {
    return compId === COMP_ID ? this.connection : null;
  }
  /** Forward an OBS event the way the real manager does. */
  forward(eventName, data, compId = COMP_ID) {
    this.emit('obsEvent', { compId, eventName, data });
  }
}

/** Socket.io stand-in that records room broadcasts. */
function createFakeIo() {
  const broadcasts = [];
  return {
    broadcasts,
    to(room) {
      return {
        emit(event, data) {
          broadcasts.push({ room, event, data });
        },
      };
    },
  };
}

function seedCompetition(db, overrides = {}) {
  db._seed(`competitions/${COMP_ID}/config`, {
    compType: 'womens-dual',
    eventName: 'ECAC Test Meet',
    meetDate: '2026-09-27',
    venue: 'Test Arena',
    location: 'Testville',
    hosts: 'Isaac',
    virtiusSessionId: 'vs-1',
    meetTheme: '',
    team1Name: 'Navy',
    team1Logo: 'navy.png',
    team1Key: 'navy-womens',
    team2Name: 'Army',
    team2Logo: 'army.png',
    team2Key: 'army-womens',
    ...overrides,
  });
  return db;
}

function makeBus({ db, obs, io, guardrails } = {}) {
  const manager = new FakeConnectionManager(obs === null ? null : obs || new MockOBSWebSocket());
  const bus = new ActionBus({
    compId: COMP_ID,
    firebase: db,
    io,
    obsConnectionManager: manager,
    guardrails,
    sceneConfirmTimeoutMs: 150,
    obsCallTimeoutMs: 150,
  });
  return { bus, manager, obs: manager.connection };
}

describe('ActionBus helpers', () => {
  it('parses competition types into gender and team count', () => {
    assert.deepEqual(parseCompType('womens-dual'), { gender: 'womens', teamCount: 2 });
    assert.deepEqual(parseCompType('mens-quad'), { gender: 'mens', teamCount: 4 });
    assert.deepEqual(parseCompType('womens-7'), { gender: 'womens', teamCount: 7 });
    assert.deepEqual(parseCompType(undefined), { gender: 'womens', teamCount: 2 });
  });

  it('filters graphics by gender and team count', () => {
    assert.equal(isGraphicAvailable({ gender: 'both' }, 'mens', 2), true);
    assert.equal(isGraphicAvailable({ gender: 'mens' }, 'womens', 2), false);
    assert.equal(isGraphicAvailable({ gender: 'both', minTeams: 4 }, 'mens', 2), false);
    assert.equal(isGraphicAvailable({ gender: 'both', minTeams: 4, maxTeams: 7 }, 'mens', 4), true);
    assert.equal(isGraphicAvailable({ gender: 'both', maxTeams: 2 }, 'mens', 3), false);
  });

  it('builds per-team graphic IDs by stripping the registry prefix', () => {
    assert.equal(perTeamGraphicId('team-roster', 2), 'team2-roster');
    assert.equal(perTeamGraphicId('team-coaches', 1), 'team1-coaches');
    assert.equal(perTeamGraphicId('logos', 3), 'logos-team3');
  });
});

describe('ActionBus catalog', () => {
  let db;

  beforeEach(() => {
    db = seedCompetition(createFakeDb());
  });

  it('includes OBS scenes, rundown scenes, and marks the overlap', async () => {
    const obs = new MockOBSWebSocket();
    obs.addScene('Rundown Only');
    db._seed(`competitions/${COMP_ID}/rundown/segments`, [
      { id: 's1', obsScene: 'Rundown Only' },
      { id: 's2', obsScene: 'Not In OBS' },
      { id: 's3' },
    ]);

    const { bus } = makeBus({ db, obs });
    const catalog = await bus.buildCatalog();

    const scenes = catalog.actions.filter(a => a.kind === ACTION_KINDS.SCENE);
    const byId = new Map(scenes.map(a => [a.id, a]));

    assert.equal(catalog.obsConnected, true);
    assert.ok(scenes.length > 1, 'expected several scene actions');
    assert.equal(byId.get('scene:Rundown Only').params.source, 'both');
    assert.equal(byId.get('scene:Not In OBS').params.source, 'rundown');
    assert.equal(byId.get('scene:Starting Soon').params.source, 'obs');

    // Stable shape on every action.
    for (const action of catalog.actions) {
      assert.deepEqual(Object.keys(action).sort(), ['category', 'id', 'kind', 'label', 'params']);
    }
  });

  it('always offers graphic:clear', async () => {
    const { bus } = makeBus({ db });
    const catalog = await bus.buildCatalog();
    const clear = catalog.actions.find(a => a.id === 'graphic:clear');
    assert.ok(clear, 'graphic:clear missing');
    assert.equal(clear.kind, ACTION_KINDS.GRAPHIC);
    assert.equal(clear.params.graphicId, 'clear');
  });

  it('filters graphics by the competition gender and team count', async () => {
    const { bus } = makeBus({ db }); // womens-dual
    const womensDual = await bus.buildCatalog();
    const ids = new Set(womensDual.actions.map(a => a.id));

    // frame-quad requires minTeams 4; a dual must not offer it.
    assert.equal(ids.has('graphic:frame-quad'), false);
    // Mens-only apparatus graphics must not show up for a womens meet, and the
    // womens ones must.
    assert.equal(ids.has('graphic:leaderboard-ph'), false, 'pommel horse is mens-only');
    assert.equal(ids.has('graphic:summary-hb'), false, 'high bar is mens-only');
    assert.equal(ids.has('graphic:leaderboard-ub'), true, 'uneven bars is womens');

    db._seed(`competitions/${COMP_ID}/config/compType`, 'mens-quad');
    const mensQuad = await bus.buildCatalog();
    const quadIds = new Set(mensQuad.actions.map(a => a.id));
    assert.equal(quadIds.has('graphic:frame-quad'), true);
    assert.equal(quadIds.has('graphic:leaderboard-ph'), true, 'pommel horse returns for a mens meet');
    assert.equal(quadIds.has('graphic:leaderboard-ub'), false, 'uneven bars is womens-only');
    assert.equal(quadIds.has('graphic:team4-roster'), true, 'four slots in a quad');
    assert.equal(mensQuad.gender, 'mens');
    assert.equal(mensQuad.teamCount, 4);
  });

  it('expands perTeam graphics to one action per team slot, with team names', async () => {
    const { bus } = makeBus({ db });
    const catalog = await bus.buildCatalog();
    const byId = new Map(catalog.actions.map(a => [a.id, a]));

    assert.ok(byId.has('graphic:team1-roster'));
    assert.ok(byId.has('graphic:team2-roster'));
    assert.equal(byId.has('graphic:team3-roster'), false, 'a dual has only two slots');
    assert.equal(byId.get('graphic:team1-roster').label, 'Navy Roster');
    assert.equal(byId.get('graphic:team2-roster').label, 'Army Roster');
    assert.equal(byId.get('graphic:team2-roster').params.teamSlot, 2);
    assert.equal(byId.get('graphic:team2-roster').params.registryId, 'team-roster');
    // The un-expanded registry ID is not an action.
    assert.equal(byId.has('graphic:team-roster'), false);
  });

  it('warns instead of failing when OBS is not connected', async () => {
    const { bus } = makeBus({ db, obs: null });
    const catalog = await bus.buildCatalog();

    assert.equal(catalog.obsConnected, false);
    assert.equal(catalog.actions.some(a => a.kind === ACTION_KINDS.SCENE), false);
    assert.ok(catalog.warnings.some(w => w.includes('OBS not connected')));
    // Graphics still work without OBS.
    assert.ok(catalog.actions.some(a => a.kind === ACTION_KINDS.GRAPHIC));
  });

  it('reports a GetSceneList failure as a warning', async () => {
    const obs = new MockOBSWebSocket();
    obs.injectErrorOnMethod('GetSceneList', new Error('boom'));
    const { bus } = makeBus({ db, obs });
    const catalog = await bus.buildCatalog();
    assert.ok(catalog.warnings.some(w => w.includes('GetSceneList failed: boom')));
  });
});

describe('ActionBus scene executor', () => {
  let db;

  beforeEach(() => {
    db = seedCompetition(createFakeDb());
  });

  it('switches the program scene and acks ok with confirmation', async () => {
    const { bus, obs } = makeBus({ db });
    await bus.buildCatalog();

    const ack = await bus.execute({ actionId: 'scene:BRB', sender: 'xavier', recommendationId: 'rec-1' });

    assert.deepEqual(Object.keys(ack).sort(), ['actionId', 'error', 'guardrail', 'ok']);
    assert.equal(ack.ok, true);
    assert.equal(ack.actionId, 'scene:BRB');
    assert.equal(ack.error, null);
    assert.equal(ack.guardrail, null);
    assert.equal(obs.wasCalledWith('SetCurrentProgramScene', { sceneName: 'BRB' }), true);
    assert.equal(obs._currentScene, 'BRB');
  });

  it('confirms through the connection manager forwarded event', async () => {
    // A connection that accepts the call but emits nothing itself: confirmation
    // has to arrive via obsConnectionManager's 'obsEvent'.
    const silentObs = {
      calls: [],
      async call(method, params) {
        this.calls.push({ method, params });
        if (method === 'GetCurrentProgramScene') return { currentProgramSceneName: 'Starting Soon' };
        if (method === 'GetSceneList') {
          return { scenes: [{ sceneName: 'Starting Soon' }, { sceneName: 'BRB' }] };
        }
        return {};
      },
      on() {}, off() {},
    };
    const { bus, manager } = makeBus({ db, obs: silentObs });
    await bus.buildCatalog();

    const pending = bus.execute({ actionId: 'scene:BRB', sender: 'xavier' });
    setTimeout(() => manager.forward('CurrentProgramSceneChanged', { sceneName: 'BRB' }), 10);

    const ack = await pending;
    assert.equal(ack.ok, true);
    assert.equal(ack.error, null);
  });

  it('acks ok when the scene is already live (OBS emits no event)', async () => {
    const { bus, obs } = makeBus({ db });
    await bus.buildCatalog();
    const currentScene = obs._currentScene;

    const executed = [];
    bus.on('executed', record => executed.push(record));

    const ack = await bus.execute({ actionId: `scene:${currentScene}`, sender: 'xavier' });

    assert.equal(ack.ok, true);
    assert.equal(executed[0].alreadyActive, true);
    assert.equal(obs.getCallCount('SetCurrentProgramScene'), 0, 'no need to switch');
  });

  it('reports obs_not_connected when there is no OBS connection', async () => {
    const { bus } = makeBus({ db, obs: null });
    // Seed a rundown scene so the action exists in the catalog without OBS.
    db._seed(`competitions/${COMP_ID}/rundown/segments`, [{ id: 's1', obsScene: 'BRB' }]);
    await bus.buildCatalog();

    const ack = await bus.execute({ actionId: 'scene:BRB', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.OBS_NOT_CONNECTED);
  });

  it('reports obs_call_failed when OBS rejects the switch', async () => {
    const obs = new MockOBSWebSocket();
    const { bus } = makeBus({ db, obs });
    await bus.buildCatalog();
    obs.injectErrorOnMethod('SetCurrentProgramScene', new Error('Scene not found: BRB'));

    const ack = await bus.execute({ actionId: 'scene:BRB', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.OBS_CALL_FAILED);
    assert.equal(ack.guardrail, null);
  });

  it('reports not_confirmed when OBS never announces the change', async () => {
    const silentObs = {
      async call(method) {
        if (method === 'GetCurrentProgramScene') return { currentProgramSceneName: 'Starting Soon' };
        if (method === 'GetSceneList') {
          return { scenes: [{ sceneName: 'Starting Soon' }, { sceneName: 'BRB' }] };
        }
        return {};
      },
      on() {}, off() {},
    };
    const { bus } = makeBus({ db, obs: silentObs });
    await bus.buildCatalog();

    const ack = await bus.execute({ actionId: 'scene:BRB', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.NOT_CONFIRMED);
  });

  it('reports obs_timeout when the OBS call hangs', async () => {
    const hangingObs = {
      async call(method) {
        if (method === 'GetSceneList') return { scenes: [{ sceneName: 'BRB' }] };
        return new Promise(() => {}); // never settles
      },
      on() {}, off() {},
    };
    const { bus } = makeBus({ db, obs: hangingObs });
    await bus.buildCatalog();

    const ack = await bus.execute({ actionId: 'scene:BRB', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.OBS_TIMEOUT);
  });
});

describe('ActionBus graphic executor', () => {
  let db;

  beforeEach(() => {
    db = seedCompetition(createFakeDb());
  });

  it('writes the same payload the payload builder produces', async () => {
    const { bus } = makeBus({ db });
    await bus.buildCatalog();

    const ack = await bus.execute({ actionId: 'graphic:team2-roster', sender: 'xavier' });
    assert.equal(ack.ok, true);
    assert.equal(ack.error, null);

    const written = db._read(GRAPHIC_PATH);
    const expected = await buildGraphicPayload({
      db,
      compId: COMP_ID,
      graphicId: 'team2-roster',
      graphicParams: { teamSlot: 2 },
      segmentId: null,
      timestamp: written.timestamp,
    });

    assert.deepEqual(written, JSON.parse(JSON.stringify(expected)));
    assert.equal(written.graphicId, 'team2-roster');
    assert.equal(written.renderer, 'stage');
    assert.equal(written.segmentId, null);
  });

  it('writes the clear payload for graphic:clear', async () => {
    const { bus } = makeBus({ db });
    await bus.buildCatalog();

    const ack = await bus.execute({ actionId: 'graphic:clear', sender: 'xavier' });
    assert.equal(ack.ok, true);

    const written = db._read(GRAPHIC_PATH);
    const expected = buildClearPayload(written.timestamp);
    assert.deepEqual(written, expected);
    assert.equal(written.renderer, undefined, 'clear deliberately omits renderer');
  });

  it('reports firebase_unavailable with no database handle', async () => {
    const { bus } = makeBus({ db: null });
    await bus.buildCatalog();

    const ack = await bus.execute({ actionId: 'graphic:clear', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.FIREBASE_UNAVAILABLE);
  });

  it('reports firebase_timeout instead of hanging when a read never settles', async () => {
    // Firebase Admin without valid credentials never settles a read.
    const hangingDb = { ref: () => ({ once: () => new Promise(() => {}), set: async () => {} }) };
    const { bus } = makeBus({ db: hangingDb });
    bus.firebaseTimeoutMs = 120;

    const catalog = await bus.buildCatalog();
    assert.ok(
      catalog.warnings.some(w => w.includes('could not read competition config')),
      'a hanging config read must surface as a warning'
    );

    const ack = await bus.execute({ actionId: 'graphic:leaderboard-aa', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.FIREBASE_TIMEOUT);
  });

  it('reports firebase_timeout when the write never settles', async () => {
    const { bus } = makeBus({ db });
    bus.firebaseTimeoutMs = 120;
    await bus.buildCatalog();
    db.ref = ((original) => (path) =>
      path.endsWith('currentGraphic')
        ? { set: () => new Promise(() => {}), once: async () => ({ val: () => null }) }
        : original(path))(db.ref.bind(db));

    const ack = await bus.execute({ actionId: 'graphic:clear', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.FIREBASE_TIMEOUT);
  });

  it('reports firebase_write_failed when the write throws', async () => {
    const { bus } = makeBus({ db });
    await bus.buildCatalog();
    db._failOnSet(GRAPHIC_PATH, new Error('permission denied'));

    const ack = await bus.execute({ actionId: 'graphic:clear', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.FIREBASE_WRITE_FAILED);
  });
});

describe('ActionBus ack, broadcast, and guardrails', () => {
  let db;

  beforeEach(() => {
    db = seedCompetition(createFakeDb());
  });

  it('rejects a missing or unknown action id with the same ack shape', async () => {
    const { bus } = makeBus({ db });

    const noId = await bus.execute({ sender: 'xavier' });
    assert.deepEqual(noId, { ok: false, actionId: null, error: ACTION_ERRORS.NO_ACTION_ID, guardrail: null });

    const unknown = await bus.execute({ actionId: 'scene:Does Not Exist', sender: 'xavier' });
    assert.deepEqual(unknown, {
      ok: false, actionId: 'scene:Does Not Exist', error: ACTION_ERRORS.UNKNOWN_ACTION, guardrail: null,
    });
  });

  it('rebuilds the catalog once for a scene added in OBS since the last build', async () => {
    const { bus, obs } = makeBus({ db });
    await bus.buildCatalog();
    obs.addScene('Late Addition');

    const ack = await bus.execute({ actionId: 'scene:Late Addition', sender: 'xavier' });
    assert.equal(ack.ok, true);
  });

  it('broadcasts action:executed to the competition room', async () => {
    const io = createFakeIo();
    const { bus } = makeBus({ db, io });
    await bus.buildCatalog();

    await bus.execute({ actionId: 'graphic:clear', sender: 'xavier', recommendationId: 'rec-7' });

    const broadcast = io.broadcasts.find(b => b.event === 'action:executed');
    assert.ok(broadcast, 'no action:executed broadcast');
    assert.equal(broadcast.room, `competition:${COMP_ID}`);
    assert.equal(broadcast.data.actionId, 'graphic:clear');
    assert.equal(broadcast.data.ok, true);
    assert.equal(broadcast.data.sender, 'xavier');
    assert.equal(broadcast.data.recommendationId, 'rec-7');
    assert.equal(broadcast.data.payload, undefined, 'payload stays off the wire');
  });

  it('blocks an action with a guardrail and reports the rule', async () => {
    const io = createFakeIo();
    const guardrail = ({ action, sender }) =>
      sender === 'xavier' && action.kind === ACTION_KINDS.SCENE
        ? { rule: 'no-scene-changes-from-xavier', reason: 'Suggest mode only' }
        : null;

    const { bus, obs } = makeBus({ db, io, guardrails: [guardrail] });
    await bus.buildCatalog();

    const ack = await bus.execute({ actionId: 'scene:BRB', sender: 'xavier' });
    assert.equal(ack.ok, false);
    assert.equal(ack.error, ACTION_ERRORS.GUARDRAIL);
    assert.deepEqual(ack.guardrail, { rule: 'no-scene-changes-from-xavier', reason: 'Suggest mode only' });
    assert.equal(obs.getCallCount('SetCurrentProgramScene'), 0, 'blocked actions never reach OBS');

    // A different sender is unaffected.
    const allowed = await bus.execute({ actionId: 'scene:BRB', sender: 'producer' });
    assert.equal(allowed.ok, true);
  });

  it('treats a throwing guardrail as an allow', async () => {
    const { bus } = makeBus({
      db,
      guardrails: [() => { throw new Error('bad guardrail'); }],
    });
    await bus.buildCatalog();
    const ack = await bus.execute({ actionId: 'graphic:clear', sender: 'xavier' });
    assert.equal(ack.ok, true);
  });
});

describe('ActionBus observation', () => {
  let db;

  beforeEach(() => {
    db = seedCompetition(createFakeDb());
  });

  it('records a human scene change without rerouting it', async () => {
    const { bus, manager, obs } = makeBus({ db });
    bus.startObserving();

    const humanActions = [];
    bus.on('humanAction', a => humanActions.push(a));

    // The producer switched scenes in OBS directly.
    manager.forward('CurrentProgramSceneChanged', { sceneName: 'BRB' });

    const observed = bus.getObserved();
    assert.equal(observed.programScene.sceneName, 'BRB');
    assert.equal(observed.programScene.source, 'human');
    assert.equal(humanActions.length, 1);
    assert.equal(obs.getCallCount('SetCurrentProgramScene'), 0, 'observation must not act');

    bus.stopObserving();
  });

  it('attributes a scene change it caused to the bus', async () => {
    const { bus, manager } = makeBus({ db });
    bus.startObserving();
    await bus.buildCatalog();

    const humanActions = [];
    bus.on('humanAction', a => humanActions.push(a));

    await bus.execute({ actionId: 'scene:BRB', sender: 'xavier' });
    // The mock emits on the connection; the real manager also forwards it.
    manager.forward('CurrentProgramSceneChanged', { sceneName: 'BRB' });

    assert.equal(bus.getObserved().programScene.source, 'bus');
    assert.equal(humanActions.length, 0);

    bus.stopObserving();
  });

  it('records currentGraphic changes made by someone else', async () => {
    const { bus } = makeBus({ db });
    bus.startObserving();

    const observations = [];
    bus.on('observed', o => observations.push(o));

    // GraphicsControl in the browser writes straight to Firebase today.
    await db.ref(GRAPHIC_PATH).set({ graphic: 'leaderboard-aa', graphicId: 'leaderboard-aa', timestamp: 1 });

    const observed = bus.getObserved().currentGraphic;
    assert.equal(observed.graphicId, 'leaderboard-aa');
    assert.equal(observed.source, 'human');
    assert.ok(observations.length >= 1);

    bus.stopObserving();
    assert.equal(db._listenerCount(GRAPHIC_PATH), 0, 'listener released on stopObserving');
  });

  it('attributes its own graphic write to the bus', async () => {
    const { bus } = makeBus({ db });
    bus.startObserving();
    await bus.buildCatalog();

    await bus.execute({ actionId: 'graphic:clear', sender: 'xavier' });

    assert.equal(bus.getObserved().currentGraphic.graphicId, 'clear');
    assert.equal(bus.getObserved().currentGraphic.source, 'bus');

    bus.stopObserving();
  });

  it('ignores OBS events for other competitions', () => {
    const { bus, manager } = makeBus({ db });
    bus.startObserving();
    manager.forward('CurrentProgramSceneChanged', { sceneName: 'Other Meet' }, 'some-other-comp');
    assert.equal(bus.getObserved().programScene, null);
    bus.stopObserving();
  });
});
