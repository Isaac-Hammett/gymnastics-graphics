/**
 * Bounded Firebase Admin reads.
 *
 * Firebase Admin without valid credentials (or with a dead connection) never
 * settles a `once('value')`, so a socket handler that awaits one hangs forever
 * and its ack never fires. Every read on the socket path goes through here
 * (ISA2-302), with the same bound the action bus uses.
 *
 * @module firebaseRead
 */

export const DEFAULT_FIREBASE_READ_TIMEOUT_MS = 6000;

/**
 * `ref.once('value')`, rejected with `error.code === 'firebase_timeout'` if it
 * has not settled within `timeoutMs`.
 * @param {Object} ref - Firebase Admin reference
 * @param {number} [timeoutMs]
 * @returns {Promise<Object>} The snapshot
 */
export function onceValue(ref, timeoutMs = DEFAULT_FIREBASE_READ_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Firebase read of ${ref?.key ?? 'ref'} timed out after ${timeoutMs}ms`);
      error.code = 'firebase_timeout';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([ref.once('value'), timeout]).finally(() => clearTimeout(timer));
}

export default onceValue;
