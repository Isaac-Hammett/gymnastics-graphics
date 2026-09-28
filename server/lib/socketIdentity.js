/**
 * Socket identity (ISA2-331, design decision 10.6).
 *
 * Every socket gets `socket.data.role`, one of producer | talent | renderer |
 * anonymous. The client sends a Firebase ID token in the handshake
 * (`io(url, { auth: { token } })`); the coordinator verifies it with the Admin
 * SDK and resolves the role:
 *
 *   - valid token, email has a confirmed assignment in
 *     `competitions/{compId}/commentary` (matched through `talentRoster/{id}/email`) -> talent
 *   - any other valid token (an existing account)                                  -> producer
 *   - no valid token, handshake declares `clientType: 'renderer'`                  -> renderer
 *   - everything else, including an invalid or expired token                       -> anonymous
 *
 * Resolution runs in the background: the socket is anonymous until it settles,
 * so the connection handler never awaits it and every `socket.on(...)` still
 * registers before any `await` (BUG-021). Existing handlers ignore the role, so
 * anonymous sockets behave exactly as before.
 *
 * Producer and talent sockets join `competition:{compId}:verified`; the
 * Shakespeare engine emits through `emitShakespeare()`, which only targets that
 * room, so `shakespeare:*` never reaches renderer or anonymous sockets.
 *
 * The role is fixed at handshake. A socket.io client re-runs its `auth`
 * callback on every reconnect, so a refreshed token is picked up then.
 *
 * @module socketIdentity
 */

import { onceValue } from './firebaseRead.js';

export const SOCKET_ROLES = Object.freeze({
  PRODUCER: 'producer',
  TALENT: 'talent',
  RENDERER: 'renderer',
  ANONYMOUS: 'anonymous',
});

/** Roles allowed to receive beats, notes, and sensitive material. */
export const VERIFIED_ROLES = new Set([SOCKET_ROLES.PRODUCER, SOCKET_ROLES.TALENT]);

export const DEFAULT_IDENTITY_TIMEOUT_MS = 5000;

/** Room holding a competition's producer and talent sockets. */
export function verifiedRoom(compId) {
  return `competition:${compId}:verified`;
}

/**
 * Pull the ID token from a socket.io handshake. Prefers `auth.token`; accepts
 * an `Authorization: Bearer` header for non-browser clients. Query strings are
 * not read, so tokens never land in URL logs.
 */
export function extractToken(handshake = {}) {
  const fromAuth = handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim()) return fromAuth.trim();
  const header = handshake.headers?.authorization;
  if (typeof header === 'string') {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  return null;
}

function declaresRenderer(handshake = {}) {
  const type = handshake.auth?.clientType ?? handshake.query?.clientType;
  return type === SOCKET_ROLES.RENDERER;
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Build `(email, compId) => Promise<boolean>`: true when the email belongs to a
 * talentRoster entry whose assignment for compId has status 'confirmed'.
 * @param {() => Object|null} getDb - returns a Firebase Admin database handle
 */
export function createTalentAssignmentLookup(getDb, { timeoutMs = DEFAULT_IDENTITY_TIMEOUT_MS } = {}) {
  return async function hasConfirmedAssignment(email, compId) {
    const db = getDb();
    if (!db || !email || !compId) return false;
    const commentarySnap = await onceValue(db.ref(`competitions/${compId}/commentary`), timeoutMs);
    const commentary = commentarySnap.val() || {};
    const confirmedIds = Object.entries(commentary)
      .filter(([, assignment]) => assignment?.status === 'confirmed')
      .map(([talentId]) => talentId);
    const wanted = String(email).trim().toLowerCase();
    for (const talentId of confirmedIds) {
      const emailSnap = await onceValue(db.ref(`talentRoster/${talentId}/email`), timeoutMs);
      const talentEmail = emailSnap.val();
      if (typeof talentEmail === 'string' && talentEmail.trim().toLowerCase() === wanted) return true;
    }
    return false;
  };
}

/**
 * Resolve an identity from a handshake. Never throws.
 * @param {Object} handshake - socket.handshake
 * @param {Object} deps
 * @param {(token: string) => Promise<{uid: string, email?: string}>} deps.verifyIdToken
 * @param {(email: string, compId: string) => Promise<boolean>} deps.hasConfirmedAssignment
 * @param {number} [deps.timeoutMs]
 * @returns {Promise<{role: string, uid: string|null, email: string|null}>}
 */
export async function resolveSocketIdentity(handshake, { verifyIdToken, hasConfirmedAssignment, timeoutMs = DEFAULT_IDENTITY_TIMEOUT_MS } = {}) {
  const anonymous = { role: SOCKET_ROLES.ANONYMOUS, uid: null, email: null };
  const unverified = declaresRenderer(handshake)
    ? { ...anonymous, role: SOCKET_ROLES.RENDERER }
    : anonymous;

  const token = extractToken(handshake);
  if (!token || typeof verifyIdToken !== 'function') return unverified;

  let decoded;
  try {
    decoded = await withTimeout(Promise.resolve(verifyIdToken(token)), timeoutMs, 'verifyIdToken');
  } catch {
    return anonymous;
  }
  if (!decoded?.uid) return anonymous;

  const email = decoded.email || null;
  const compId = handshake?.query?.compId;
  if (email && compId && typeof hasConfirmedAssignment === 'function') {
    try {
      if (await hasConfirmedAssignment(email, compId)) {
        return { role: SOCKET_ROLES.TALENT, uid: decoded.uid, email };
      }
    } catch (error) {
      console.warn(`[SocketIdentity] Assignment lookup failed for ${compId}: ${error.message}`);
    }
  }
  return { role: SOCKET_ROLES.PRODUCER, uid: decoded.uid, email };
}

/**
 * Mark the socket anonymous synchronously, then resolve its identity in the
 * background. Producer and talent sockets with a compId join the verified
 * room. Do not await this before registering handlers.
 * @returns {Promise<string>} the resolved role
 */
export function attachSocketIdentity(socket, deps) {
  socket.data = socket.data || {};
  socket.data.role = SOCKET_ROLES.ANONYMOUS;
  socket.data.uid = null;
  socket.data.email = null;

  return resolveSocketIdentity(socket.handshake, deps).then((identity) => {
    if (socket.disconnected) return identity.role;
    socket.data.role = identity.role;
    socket.data.uid = identity.uid;
    socket.data.email = identity.email;
    const compId = socket.handshake?.query?.compId;
    if (compId && VERIFIED_ROLES.has(identity.role)) {
      socket.join(verifiedRoom(compId));
    }
    socket.emit('identity', { role: identity.role });
    return identity.role;
  });
}

/**
 * Emit a `shakespeare:*` event to the producer and talent sockets of one
 * competition. The only sanctioned way to send Shakespeare material.
 */
export function emitShakespeare(io, compId, event, payload) {
  if (typeof event !== 'string' || !event.startsWith('shakespeare:')) {
    throw new Error(`emitShakespeare only sends shakespeare:* events, got ${event}`);
  }
  if (!compId) throw new Error('emitShakespeare requires a compId');
  io.to(verifiedRoom(compId)).emit(event, payload);
}
