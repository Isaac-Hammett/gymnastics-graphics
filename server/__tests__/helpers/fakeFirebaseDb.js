/**
 * Fake Firebase Admin database handle for tests.
 *
 * Unlike createMockFirebase() in mockOBS.js, this one stores a nested tree, so
 * writing `competitions/c1/config` makes `competitions/c1/config/team1Key`
 * readable — which the graphic payload builder relies on. It also supports
 * `.on('value')` / `.off('value')`, which the action bus uses to observe
 * currentGraphic.
 *
 * Supported per ref: once('value'), set, update, remove, on('value'), off.
 */

function splitPath(path) {
  return String(path).split('/').filter(Boolean);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function createFakeDb(initialData = {}) {
  let root = clone(initialData) || {};

  // path -> Set<callback>
  const listeners = new Map();

  const readPath = (segments) => {
    let node = root;
    for (const segment of segments) {
      if (node == null || typeof node !== 'object') return null;
      node = node[segment];
    }
    return node === undefined ? null : node;
  };

  const writePath = (segments, value) => {
    if (segments.length === 0) {
      root = clone(value) ?? {};
      return;
    }
    let node = root;
    for (const segment of segments.slice(0, -1)) {
      if (node[segment] == null || typeof node[segment] !== 'object') {
        node[segment] = {};
      }
      node = node[segment];
    }
    const leaf = segments[segments.length - 1];
    if (value === null) {
      delete node[leaf];
    } else {
      node[leaf] = clone(value);
    }
  };

  const snapshotFor = (path) => {
    const value = readPath(splitPath(path));
    return {
      val: () => clone(value),
      exists: () => value !== null && value !== undefined,
      key: splitPath(path).slice(-1)[0] || null,
    };
  };

  // Notify listeners on this path and on every ancestor, the way Firebase does.
  const notify = (path) => {
    const changed = splitPath(path);
    for (const [listenerPath, callbacks] of listeners) {
      const target = splitPath(listenerPath);
      const affected =
        target.length <= changed.length
          ? target.every((segment, i) => segment === changed[i])
          : changed.every((segment, i) => segment === target[i]);
      if (!affected) continue;
      for (const callback of [...callbacks]) callback(snapshotFor(listenerPath));
    }
  };

  const failures = new Map(); // path -> Error thrown on set

  const db = {
    ref(path) {
      const segments = splitPath(path);
      return {
        path,
        async once() {
          return snapshotFor(path);
        },
        async set(value) {
          if (failures.has(path)) throw failures.get(path);
          db._writes.push({ path, value: clone(value) });
          writePath(segments, value);
          notify(path);
        },
        async update(updates) {
          if (failures.has(path)) throw failures.get(path);
          const current = readPath(segments) || {};
          writePath(segments, { ...current, ...updates });
          notify(path);
        },
        async remove() {
          writePath(segments, null);
          notify(path);
        },
        on(eventType, callback) {
          if (eventType !== 'value') return callback;
          if (!listeners.has(path)) listeners.set(path, new Set());
          listeners.get(path).add(callback);
          // Firebase fires immediately with the current value.
          callback(snapshotFor(path));
          return callback;
        },
        off(eventType, callback) {
          const set = listeners.get(path);
          if (!set) return;
          if (callback) set.delete(callback);
          else set.clear();
        },
      };
    },

    // ---- test helpers --------------------------------------------------------
    _writes: [],
    _seed(path, value) {
      writePath(splitPath(path), value);
      return db;
    },
    _read(path) {
      return clone(readPath(splitPath(path)));
    },
    _failOnSet(path, error) {
      failures.set(path, error);
    },
    _clearWrites() {
      db._writes.length = 0;
    },
    _listenerCount(path) {
      return listeners.get(path)?.size || 0;
    },
  };

  return db;
}

export default createFakeDb;
