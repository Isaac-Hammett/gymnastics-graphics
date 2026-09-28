/**
 * Socket identity (ISA2-331): roles from Firebase ID tokens, and shakespeare:*
 * reaching only producer and talent sockets.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOCKET_ROLES,
  extractToken,
  resolveSocketIdentity,
  attachSocketIdentity,
  createTalentAssignmentLookup,
  emitShakespeare,
  verifiedRoom,
} from '../lib/socketIdentity.js';
import { createFakeDb } from './helpers/fakeFirebaseDb.js';

const COMP = 'comp-1';

const fakeDb = createFakeDb({
  competitions: {
    [COMP]: {
      commentary: {
        t1: { role: 'color', status: 'confirmed' },
        t2: { role: 'pbp', status: 'invited' },
      },
    },
  },
  talentRoster: {
    t1: { name: 'Talent One', email: 'Talent.One@example.com' },
    t2: { name: 'Talent Two', email: 'two@example.com' },
  },
});

const TOKENS = {
  'tok-producer': { uid: 'u-prod', email: 'producer@example.com' },
  'tok-talent': { uid: 'u-t1', email: 'talent.one@example.com' },
  'tok-invited': { uid: 'u-t2', email: 'two@example.com' },
};

const deps = {
  verifyIdToken: async (token) => {
    if (TOKENS[token]) return TOKENS[token];
    throw new Error('auth/argument-error');
  },
  hasConfirmedAssignment: createTalentAssignmentLookup(() => fakeDb),
  timeoutMs: 200,
};

/** Minimal socket.io server + socket double with room routing. */
function createMockIo() {
  const sockets = [];
  const io = {
    sockets,
    to(room) {
      return {
        emit(event, payload) {
          for (const s of sockets) if (s.rooms.has(room)) s.received.push({ event, payload });
        },
      };
    },
  };
  return io;
}

function createMockSocket(io, { token, compId = COMP, clientType } = {}) {
  const socket = {
    id: `s${io.sockets.length}`,
    handshake: {
      auth: { ...(token ? { token } : {}), ...(clientType ? { clientType } : {}) },
      query: compId ? { compId } : {},
      headers: {},
    },
    data: {},
    rooms: new Set(),
    received: [],
    disconnected: false,
    join(room) { this.rooms.add(room); },
    emit(event, payload) { this.received.push({ event, payload }); },
  };
  // Mirror the coordinator: every competition socket is in the competition room.
  if (compId) socket.rooms.add(`competition:${compId}`);
  io.sockets.push(socket);
  return socket;
}

describe('extractToken', () => {
  test('reads auth.token, then a Bearer header, never the query', () => {
    assert.equal(extractToken({ auth: { token: 'abc' } }), 'abc');
    assert.equal(extractToken({ headers: { authorization: 'Bearer xyz' } }), 'xyz');
    assert.equal(extractToken({ query: { token: 'q' } }), null);
    assert.equal(extractToken({}), null);
  });
});

describe('resolveSocketIdentity', () => {
  test('valid token for an account without an assignment -> producer', async () => {
    const id = await resolveSocketIdentity({ auth: { token: 'tok-producer' }, query: { compId: COMP } }, deps);
    assert.deepEqual(id, { role: SOCKET_ROLES.PRODUCER, uid: 'u-prod', email: 'producer@example.com' });
  });

  test('valid token whose email has a confirmed assignment -> talent (case-insensitive)', async () => {
    const id = await resolveSocketIdentity({ auth: { token: 'tok-talent' }, query: { compId: COMP } }, deps);
    assert.equal(id.role, SOCKET_ROLES.TALENT);
  });

  test('an assignment that is only invited does not make talent', async () => {
    const id = await resolveSocketIdentity({ auth: { token: 'tok-invited' }, query: { compId: COMP } }, deps);
    assert.equal(id.role, SOCKET_ROLES.PRODUCER);
  });

  test('confirmed talent on a different competition is not talent here', async () => {
    const id = await resolveSocketIdentity({ auth: { token: 'tok-talent' }, query: { compId: 'other' } }, deps);
    assert.equal(id.role, SOCKET_ROLES.PRODUCER);
  });

  test('invalid token -> anonymous', async () => {
    const id = await resolveSocketIdentity({ auth: { token: 'forged' }, query: { compId: COMP } }, deps);
    assert.deepEqual(id, { role: SOCKET_ROLES.ANONYMOUS, uid: null, email: null });
  });

  test('invalid token claiming to be a renderer -> anonymous', async () => {
    const id = await resolveSocketIdentity({ auth: { token: 'forged', clientType: 'renderer' }, query: {} }, deps);
    assert.equal(id.role, SOCKET_ROLES.ANONYMOUS);
  });

  test('no token -> anonymous; no token with clientType renderer -> renderer', async () => {
    assert.equal((await resolveSocketIdentity({ query: { compId: COMP } }, deps)).role, SOCKET_ROLES.ANONYMOUS);
    assert.equal((await resolveSocketIdentity({ auth: { clientType: 'renderer' }, query: {} }, deps)).role, SOCKET_ROLES.RENDERER);
  });

  test('a verifyIdToken that hangs times out to anonymous', async () => {
    const hanging = { ...deps, verifyIdToken: () => new Promise(() => {}), timeoutMs: 20 };
    const id = await resolveSocketIdentity({ auth: { token: 'tok-producer' }, query: { compId: COMP } }, hanging);
    assert.equal(id.role, SOCKET_ROLES.ANONYMOUS);
  });

  test('a failing assignment lookup falls back to producer, not talent', async () => {
    const failing = { ...deps, hasConfirmedAssignment: async () => { throw new Error('firebase down'); } };
    const id = await resolveSocketIdentity({ auth: { token: 'tok-talent' }, query: { compId: COMP } }, failing);
    assert.equal(id.role, SOCKET_ROLES.PRODUCER);
  });
});

describe('attachSocketIdentity', () => {
  test('socket is anonymous synchronously, before resolution', () => {
    const io = createMockIo();
    const socket = createMockSocket(io, { token: 'tok-producer' });
    const pending = attachSocketIdentity(socket, deps);
    assert.equal(socket.data.role, SOCKET_ROLES.ANONYMOUS);
    return pending;
  });

  test('producer and talent join the verified room; anonymous does not', async () => {
    const io = createMockIo();
    const producer = createMockSocket(io, { token: 'tok-producer' });
    const talent = createMockSocket(io, { token: 'tok-talent' });
    const anon = createMockSocket(io, { token: 'forged' });
    await Promise.all([producer, talent, anon].map((s) => attachSocketIdentity(s, deps)));
    assert.equal(producer.data.role, SOCKET_ROLES.PRODUCER);
    assert.equal(talent.data.role, SOCKET_ROLES.TALENT);
    assert.equal(anon.data.role, SOCKET_ROLES.ANONYMOUS);
    assert.ok(producer.rooms.has(verifiedRoom(COMP)));
    assert.ok(talent.rooms.has(verifiedRoom(COMP)));
    assert.ok(!anon.rooms.has(verifiedRoom(COMP)));
    // Anonymous sockets keep the competition room, so existing broadcasts still arrive.
    assert.ok(anon.rooms.has(`competition:${COMP}`));
  });
});

describe('emitShakespeare', () => {
  test('shakespeare:* reaches producer and talent, never anonymous or renderer', async () => {
    const io = createMockIo();
    const producer = createMockSocket(io, { token: 'tok-producer' });
    const talent = createMockSocket(io, { token: 'tok-talent' });
    const anonNoToken = createMockSocket(io, {});
    const anonForged = createMockSocket(io, { token: 'forged' });
    const renderer = createMockSocket(io, { clientType: 'renderer' });
    const otherComp = createMockSocket(io, { token: 'tok-producer', compId: 'other' });
    const all = [producer, talent, anonNoToken, anonForged, renderer, otherComp];
    await Promise.all(all.map((s) => attachSocketIdentity(s, deps)));
    all.forEach((s) => { s.received.length = 0; });

    emitShakespeare(io, COMP, 'shakespeare:beats', { beats: [{ id: 'b1', sensitive: true }] });

    const got = (s) => s.received.filter((r) => r.event.startsWith('shakespeare:')).length;
    assert.equal(got(producer), 1);
    assert.equal(got(talent), 1);
    assert.equal(got(anonNoToken), 0);
    assert.equal(got(anonForged), 0);
    assert.equal(got(renderer), 0);
    assert.equal(got(otherComp), 0);
  });

  test('refuses non-shakespeare events and a missing compId', () => {
    const io = createMockIo();
    assert.throws(() => emitShakespeare(io, COMP, 'stateUpdate', {}));
    assert.throws(() => emitShakespeare(io, null, 'shakespeare:beats', {}));
  });
});
