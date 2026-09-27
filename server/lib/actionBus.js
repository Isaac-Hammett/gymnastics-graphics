/**
 * Action Bus
 *
 * One command path for scene and graphic actions, with stable IDs and an
 * acknowledgement for every command. Built for the Xavier AI producer
 * prototype (ISA2-272), but the bus is not Xavier-specific: any client can
 * send `action:execute` and get back a clear yes or no.
 *
 * Responsibilities
 *  - **Catalog.** One `{id, kind, label, category, params}` entry per thing
 *    the producer can do right now: `scene:{sceneName}` from OBS's scene list
 *    plus the scenes the rundown references, and `graphic:{registryId}` /
 *    `graphic:clear` from stage/graphics-registry.json filtered by the
 *    competition's gender and team count.
 *  - **Executor.** Scenes go through obsConnectionManager.getConnection(compId)
 *    and are confirmed against OBS's `CurrentProgramSceneChanged`. Graphics are
 *    written server-side through graphicPayload.buildGraphicPayload, the same
 *    function the rundown engine uses.
 *  - **Observation.** The bus watches `CurrentProgramSceneChanged` and
 *    `competitions/{compId}/currentGraphic` so guardrails and the decision log
 *    know what the producer did, without rerouting the producer's own actions.
 *
 * Out of scope (follow-up): moving the rundown engine, the ProducerView scene
 * buttons, and GraphicsControl onto the bus.
 *
 * @module actionBus
 */

import { EventEmitter } from 'events';
import {
  buildGraphicPayload,
  buildClearPayload,
  getGraphicsRegistry,
  resolveDb,
} from './graphicPayload.js';

/** Action kinds the bus understands. */
export const ACTION_KINDS = {
  SCENE: 'scene',
  GRAPHIC: 'graphic',
};

/** Error codes returned in the ack's `error` field. */
export const ACTION_ERRORS = {
  NO_ACTION_ID: 'no_action_id',
  UNKNOWN_ACTION: 'unknown_action',
  OBS_NOT_CONNECTED: 'obs_not_connected',
  OBS_CALL_FAILED: 'obs_call_failed',
  OBS_TIMEOUT: 'obs_timeout',
  NOT_CONFIRMED: 'not_confirmed',
  FIREBASE_UNAVAILABLE: 'firebase_unavailable',
  FIREBASE_TIMEOUT: 'firebase_timeout',
  FIREBASE_WRITE_FAILED: 'firebase_write_failed',
  GUARDRAIL: 'guardrail',
};

const DEFAULT_OBS_CALL_TIMEOUT_MS = 5000;
const DEFAULT_SCENE_CONFIRM_TIMEOUT_MS = 4000;
// Firebase Admin without valid credentials never settles a read, so every
// Firebase call on the socket path is bounded (the coordinator rule).
const DEFAULT_FIREBASE_TIMEOUT_MS = 6000;

// How long after a bus write an observed change is still attributed to the bus
// rather than to a human at the controls.
const ATTRIBUTION_WINDOW_MS = 3000;

const COMP_TYPE_TEAM_COUNTS = {
  dual: 2, tri: 3, quad: 4, '5': 5, '6': 6, '7': 7,
};

/**
 * Parse a competition type into gender and team count.
 * Mirrors parseCompetitionType in rtnStatsService.js.
 * @param {string} compType - e.g. "womens-dual", "mens-6"
 * @returns {{gender: string, teamCount: number}}
 */
export function parseCompType(compType) {
  if (!compType) return { gender: 'womens', teamCount: 2 };
  const parts = String(compType).toLowerCase().split('-');
  const gender = parts[0] === 'mens' ? 'mens' : 'womens';
  const teamCount = (parts[1] && COMP_TYPE_TEAM_COUNTS[parts[1]]) || 2;
  return { gender, teamCount };
}

/**
 * Reject after `ms` unless `promise` settles first.
 * Keeps slow OBS calls off the socket path (see the coordinator rules).
 */
function withTimeout(promise, ms, code) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Timed out after ${ms}ms`);
      error.code = code;
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The action bus for one competition.
 *
 * Events emitted:
 *  - 'executed'    { actionId, ok, sender, recommendationId, ... } after every command
 *  - 'observed'    { kind, source, ... } whenever the program scene or currentGraphic changes
 *  - 'catalog'     the catalog, whenever it is rebuilt
 */
export class ActionBus extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.compId - Competition ID (required)
   * @param {Object} [options.firebase] - Firebase Admin database handle or app
   * @param {Object} [options.io] - Socket.io server, for room broadcasts
   * @param {Object} [options.obsConnectionManager] - Per-competition OBS connections
   * @param {Function[]} [options.guardrails] - Guardrail predicates (see addGuardrail)
   * @param {number} [options.obsCallTimeoutMs]
   * @param {number} [options.sceneConfirmTimeoutMs]
   * @param {number} [options.firebaseTimeoutMs]
   */
  constructor(options = {}) {
    super();

    if (!options.compId) {
      throw new Error('compId is required to create an ActionBus');
    }

    this.compId = options.compId;
    this.firebase = options.firebase || null;
    this.io = options.io || null;
    this.obsConnectionManager = options.obsConnectionManager || null;

    this.obsCallTimeoutMs = options.obsCallTimeoutMs ?? DEFAULT_OBS_CALL_TIMEOUT_MS;
    this.sceneConfirmTimeoutMs = options.sceneConfirmTimeoutMs ?? DEFAULT_SCENE_CONFIRM_TIMEOUT_MS;
    this.firebaseTimeoutMs = options.firebaseTimeoutMs ?? DEFAULT_FIREBASE_TIMEOUT_MS;

    this._guardrails = [...(options.guardrails || [])];

    /** @type {{actions: Object[], byId: Map<string, Object>}|null} */
    this._catalog = null;

    // What the bus last saw happen, whoever caused it.
    this._observed = {
      programScene: null,       // { sceneName, at, source }
      currentGraphic: null,     // { graphicId, at, source }
    };

    // Recent bus writes, used to tell a bus action from a human one.
    this._recentSceneWrite = null;   // { sceneName, at }
    this._recentGraphicWrite = null; // { graphicId, at }

    this._observing = false;
    this._onObsEvent = null;
    this._graphicRef = null;
    this._graphicListener = null;

    this.logPrefix = `[ActionBus:${this.compId}]`;
  }

  // ---------------------------------------------------------------------------
  // Guardrails
  // ---------------------------------------------------------------------------

  /**
   * Add a guardrail. Each guardrail is called with
   * `{action, sender, recommendationId, observed}` before the action runs and
   * returns `null` to allow it, or `{rule, reason}` to block it.
   *
   * The bus ships with none; policy lives with the suggestion engine.
   * @param {Function} fn
   */
  addGuardrail(fn) {
    if (typeof fn === 'function') this._guardrails.push(fn);
  }

  /** Replace all guardrails. @param {Function[]} fns */
  setGuardrails(fns) {
    this._guardrails = [...(fns || [])].filter(fn => typeof fn === 'function');
  }

  /**
   * @returns {{rule: string, reason: string}|null} The first guardrail that blocks.
   * @private
   */
  _checkGuardrails(context) {
    for (const guardrail of this._guardrails) {
      let verdict = null;
      try {
        verdict = guardrail(context);
      } catch (error) {
        console.warn(`${this.logPrefix} Guardrail threw, treating as allow: ${error.message}`);
        continue;
      }
      if (verdict) {
        return {
          rule: verdict.rule || 'guardrail',
          reason: verdict.reason || 'Blocked by guardrail',
        };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Catalog
  // ---------------------------------------------------------------------------

  /**
   * Build (or rebuild) the action catalog for this competition.
   * Never throws: an unreachable OBS or Firebase narrows the catalog and is
   * reported in `warnings`.
   * @returns {Promise<Object>} `{compId, generatedAt, obsConnected, actions, warnings}`
   */
  async buildCatalog() {
    const warnings = [];
    const actions = [];

    const config = await this._readConfig(warnings);
    const { gender, teamCount } = parseCompType(config?.compType);

    // --- Scenes -------------------------------------------------------------
    const obsScenes = await this._readObsScenes(warnings);
    const rundownScenes = await this._readRundownScenes(warnings);

    const sceneSources = new Map();
    for (const sceneName of obsScenes) sceneSources.set(sceneName, 'obs');
    for (const sceneName of rundownScenes) {
      sceneSources.set(sceneName, sceneSources.has(sceneName) ? 'both' : 'rundown');
    }

    for (const [sceneName, source] of sceneSources) {
      actions.push({
        id: `${ACTION_KINDS.SCENE}:${sceneName}`,
        kind: ACTION_KINDS.SCENE,
        label: sceneName,
        category: 'scenes',
        params: { sceneName, source },
      });
    }

    // --- Graphics -----------------------------------------------------------
    actions.push({
      id: `${ACTION_KINDS.GRAPHIC}:clear`,
      kind: ACTION_KINDS.GRAPHIC,
      label: 'Clear Graphic',
      category: 'graphics',
      params: { graphicId: 'clear' },
    });

    const registry = getGraphicsRegistry();
    if (!registry?.graphics) {
      warnings.push('graphics registry unavailable; catalog has no graphic actions');
    } else {
      for (const [registryId, entry] of Object.entries(registry.graphics)) {
        if (!isGraphicAvailable(entry, gender, teamCount)) continue;

        if (entry.perTeam) {
          for (let slot = 1; slot <= teamCount; slot++) {
            const teamName = config?.[`team${slot}Name`] || `Team ${slot}`;
            actions.push({
              id: `${ACTION_KINDS.GRAPHIC}:${perTeamGraphicId(registryId, slot)}`,
              kind: ACTION_KINDS.GRAPHIC,
              label: entry.labelTemplate
                ? entry.labelTemplate.replace('{teamName}', teamName)
                : `${teamName} ${entry.label}`,
              category: entry.category || 'graphics',
              params: {
                graphicId: perTeamGraphicId(registryId, slot),
                registryId,
                teamSlot: slot,
              },
            });
          }
        } else {
          actions.push({
            id: `${ACTION_KINDS.GRAPHIC}:${registryId}`,
            kind: ACTION_KINDS.GRAPHIC,
            label: entry.label || registryId,
            category: entry.category || 'graphics',
            params: { graphicId: registryId, registryId },
          });
        }
      }
    }

    const catalog = {
      compId: this.compId,
      generatedAt: new Date().toISOString(),
      obsConnected: Boolean(this._getObsConnection()),
      gender,
      teamCount,
      actions,
      warnings,
    };

    this._catalog = { ...catalog, byId: new Map(actions.map(a => [a.id, a])) };
    this.emit('catalog', catalog);
    return catalog;
  }

  /**
   * The catalog as last built, or null if buildCatalog has not run.
   * @returns {Object|null}
   */
  getCatalog() {
    if (!this._catalog) return null;
    const { byId, ...catalog } = this._catalog;
    return catalog;
  }

  /**
   * Look up one action by ID in the last built catalog.
   * @param {string} actionId
   * @returns {Object|null}
   */
  getAction(actionId) {
    return this._catalog?.byId.get(actionId) || null;
  }

  // ---------------------------------------------------------------------------
  // Executor
  // ---------------------------------------------------------------------------

  /**
   * Execute one action and acknowledge it.
   *
   * Never throws: every failure comes back as `{ok: false, error}` so the
   * caller (a socket ack, or Xavier) always gets a clear yes or no.
   *
   * @param {Object} request
   * @param {string} request.actionId - e.g. "scene:Single - Camera 1", "graphic:team2-roster"
   * @param {string} [request.sender] - Who asked (a client role, or "xavier")
   * @param {string} [request.recommendationId] - Links the action to a suggestion
   * @returns {Promise<{ok: boolean, actionId: string, error: string|null, guardrail: Object|null}>}
   */
  async execute({ actionId, sender = 'unknown', recommendationId = null } = {}) {
    if (!actionId) {
      return this._ack({ actionId: null, sender, recommendationId, ok: false, error: ACTION_ERRORS.NO_ACTION_ID });
    }

    // The catalog is the ID namespace, so build it on first use.
    if (!this._catalog) {
      await this.buildCatalog();
    }

    let action = this.getAction(actionId);
    if (!action) {
      // A scene may have been added in OBS since the last build; rebuild once.
      await this.buildCatalog();
      action = this.getAction(actionId);
    }
    if (!action) {
      return this._ack({ actionId, sender, recommendationId, ok: false, error: ACTION_ERRORS.UNKNOWN_ACTION });
    }

    const guardrail = this._checkGuardrails({
      action,
      sender,
      recommendationId,
      observed: this.getObserved(),
    });
    if (guardrail) {
      console.log(`${this.logPrefix} Guardrail "${guardrail.rule}" blocked ${actionId} from ${sender}`);
      return this._ack({
        actionId, sender, recommendationId, ok: false,
        error: ACTION_ERRORS.GUARDRAIL, guardrail, kind: action.kind,
      });
    }

    let result;
    if (action.kind === ACTION_KINDS.SCENE) {
      result = await this._executeScene(action);
    } else if (action.kind === ACTION_KINDS.GRAPHIC) {
      result = await this._executeGraphic(action);
    } else {
      result = { ok: false, error: ACTION_ERRORS.UNKNOWN_ACTION };
    }

    return this._ack({ actionId, sender, recommendationId, kind: action.kind, ...result });
  }

  /**
   * Switch the OBS program scene and confirm it against CurrentProgramSceneChanged.
   * @private
   */
  async _executeScene(action) {
    const { sceneName } = action.params;
    const obs = this._getObsConnection();
    if (!obs) {
      return { ok: false, error: ACTION_ERRORS.OBS_NOT_CONNECTED };
    }

    // OBS emits no event when the scene is already live, so confirm up front.
    try {
      const current = await withTimeout(
        obs.call('GetCurrentProgramScene'), this.obsCallTimeoutMs, ACTION_ERRORS.OBS_TIMEOUT
      );
      if (current?.currentProgramSceneName === sceneName) {
        this._recentSceneWrite = { sceneName, at: Date.now() };
        return { ok: true, error: null, confirmed: true, alreadyActive: true, sceneName };
      }
    } catch (error) {
      // A failed pre-check is not fatal; fall through to the switch itself.
      console.warn(`${this.logPrefix} GetCurrentProgramScene failed: ${error.message}`);
    }

    // Arm the confirmation listener BEFORE the call so a fast OBS cannot
    // deliver CurrentProgramSceneChanged before anyone is listening.
    const confirmation = this._waitForSceneChange(sceneName);
    this._recentSceneWrite = { sceneName, at: Date.now() };

    try {
      await withTimeout(
        obs.call('SetCurrentProgramScene', { sceneName }),
        this.obsCallTimeoutMs,
        ACTION_ERRORS.OBS_TIMEOUT
      );
    } catch (error) {
      confirmation.cancel();
      const code = error.code === ACTION_ERRORS.OBS_TIMEOUT
        ? ACTION_ERRORS.OBS_TIMEOUT
        : ACTION_ERRORS.OBS_CALL_FAILED;
      console.error(`${this.logPrefix} SetCurrentProgramScene("${sceneName}") failed: ${error.message}`);
      return { ok: false, error: code, message: error.message, sceneName };
    }

    const confirmed = await confirmation.promise;
    if (!confirmed) {
      return { ok: false, error: ACTION_ERRORS.NOT_CONFIRMED, confirmed: false, sceneName };
    }
    return { ok: true, error: null, confirmed: true, sceneName };
  }

  /**
   * Resolve true when OBS reports the program scene is now `sceneName`,
   * false on timeout. Listens both on the connection (where obs-websocket-js
   * emits) and on the connection manager's forwarded `obsEvent`.
   * @private
   */
  _waitForSceneChange(sceneName) {
    const obs = this._getObsConnection();
    const manager = this.obsConnectionManager;
    let settle;
    let timer;

    const promise = new Promise((resolve) => {
      let done = false;
      settle = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (obs?.off) obs.off('CurrentProgramSceneChanged', onDirect);
        if (manager?.off) manager.off('obsEvent', onForwarded);
        resolve(value);
      };

      const onDirect = (data) => {
        if (data?.sceneName === sceneName) settle(true);
      };
      const onForwarded = ({ compId, eventName, data }) => {
        if (compId !== this.compId) return;
        if (eventName !== 'CurrentProgramSceneChanged') return;
        if (data?.sceneName === sceneName) settle(true);
      };

      if (obs?.on) obs.on('CurrentProgramSceneChanged', onDirect);
      if (manager?.on) manager.on('obsEvent', onForwarded);

      timer = setTimeout(() => {
        console.warn(`${this.logPrefix} No CurrentProgramSceneChanged for "${sceneName}" within ${this.sceneConfirmTimeoutMs}ms`);
        settle(false);
      }, this.sceneConfirmTimeoutMs);
    });

    return { promise, cancel: () => settle(false) };
  }

  /**
   * Write a graphic (or the clear payload) to currentGraphic, using the same
   * payload builder the rundown engine uses.
   * @private
   */
  async _executeGraphic(action) {
    const db = resolveDb(this.firebase);
    if (!db) {
      return { ok: false, error: ACTION_ERRORS.FIREBASE_UNAVAILABLE };
    }

    const { graphicId } = action.params;
    const graphicParams = action.params.teamSlot ? { teamSlot: action.params.teamSlot } : {};

    let payload;
    try {
      // The builder reads config, sponsors, and the theme; bound the lot so a
      // credential-less or unreachable Firebase still produces an ack.
      payload = graphicId === 'clear'
        ? buildClearPayload()
        : await withTimeout(
          buildGraphicPayload({
            db,
            compId: this.compId,
            graphicId,
            graphicParams,
            segmentId: null,
            logPrefix: this.logPrefix,
          }),
          this.firebaseTimeoutMs,
          ACTION_ERRORS.FIREBASE_TIMEOUT
        );
    } catch (error) {
      console.error(`${this.logPrefix} Payload build failed for "${graphicId}": ${error.message}`);
      return {
        ok: false,
        error: error.code === ACTION_ERRORS.FIREBASE_TIMEOUT
          ? ACTION_ERRORS.FIREBASE_TIMEOUT
          : ACTION_ERRORS.FIREBASE_WRITE_FAILED,
        message: error.message,
        graphicId,
      };
    }

    this._recentGraphicWrite = { graphicId, at: Date.now() };

    try {
      await withTimeout(
        db.ref(`competitions/${this.compId}/currentGraphic`).set(payload),
        this.firebaseTimeoutMs,
        ACTION_ERRORS.FIREBASE_TIMEOUT
      );
    } catch (error) {
      console.error(`${this.logPrefix} currentGraphic write failed: ${error.message}`);
      return {
        ok: false,
        error: error.code === ACTION_ERRORS.FIREBASE_TIMEOUT
          ? ACTION_ERRORS.FIREBASE_TIMEOUT
          : ACTION_ERRORS.FIREBASE_WRITE_FAILED,
        message: error.message,
        graphicId,
      };
    }

    return { ok: true, error: null, confirmed: true, graphicId, payload };
  }

  /**
   * Finish one command: log it, broadcast `action:executed`, emit 'executed',
   * and return the ack.
   * @private
   */
  _ack({ actionId, sender, recommendationId, ok, error = null, guardrail = null, kind = null, ...details }) {
    const ack = {
      ok,
      actionId,
      error: error || null,
      guardrail: guardrail || null,
    };

    const record = {
      ...ack,
      kind,
      sender,
      recommendationId: recommendationId || null,
      at: Date.now(),
      ...details,
    };

    this.emit('executed', record);
    if (this.io) {
      // `payload` is large and already on its way to output.html via Firebase.
      const { payload, ...broadcast } = record;
      this.io.to(`competition:${this.compId}`).emit('action:executed', broadcast);
    }

    return ack;
  }

  // ---------------------------------------------------------------------------
  // Observation — watch what the producer does, do not reroute it
  // ---------------------------------------------------------------------------

  /**
   * Start watching the program scene and currentGraphic. Idempotent.
   */
  startObserving() {
    if (this._observing) return;
    this._observing = true;

    if (this.obsConnectionManager?.on) {
      this._onObsEvent = ({ compId, eventName, data }) => {
        if (compId !== this.compId) return;
        if (eventName !== 'CurrentProgramSceneChanged') return;
        this._recordObservation('scene', {
          sceneName: data?.sceneName || null,
        }, this._recentSceneWrite, w => w.sceneName === data?.sceneName);
      };
      this.obsConnectionManager.on('obsEvent', this._onObsEvent);
    }

    const db = resolveDb(this.firebase);
    if (db) {
      this._graphicRef = db.ref(`competitions/${this.compId}/currentGraphic`);
      this._graphicListener = (snapshot) => {
        const value = snapshot?.val?.() ?? null;
        const graphicId = value?.graphicId || value?.graphic || null;
        this._recordObservation('graphic', {
          graphicId,
          renderer: value?.renderer || null,
        }, this._recentGraphicWrite, w => w.graphicId === graphicId);
      };
      this._graphicRef.on('value', this._graphicListener);
    }

    console.log(`${this.logPrefix} Observing program scene and currentGraphic`);
  }

  /** Stop watching. Safe to call when not observing. */
  stopObserving() {
    if (this._onObsEvent && this.obsConnectionManager?.off) {
      this.obsConnectionManager.off('obsEvent', this._onObsEvent);
    }
    this._onObsEvent = null;

    if (this._graphicRef && this._graphicListener) {
      this._graphicRef.off('value', this._graphicListener);
    }
    this._graphicRef = null;
    this._graphicListener = null;

    this._observing = false;
  }

  /**
   * Record a change and attribute it to the bus or to a human.
   * @private
   */
  _recordObservation(kind, fields, recentWrite, matches) {
    const at = Date.now();
    const fromBus = Boolean(
      recentWrite && (at - recentWrite.at) <= ATTRIBUTION_WINDOW_MS && matches(recentWrite)
    );
    const observation = { kind, ...fields, at, source: fromBus ? 'bus' : 'human' };

    if (kind === 'scene') this._observed.programScene = observation;
    if (kind === 'graphic') this._observed.currentGraphic = observation;

    this.emit('observed', observation);
    if (!fromBus) this.emit('humanAction', observation);
  }

  /**
   * What the bus last saw on air, and who it thinks did it.
   * @returns {{programScene: Object|null, currentGraphic: Object|null}}
   */
  getObserved() {
    return {
      programScene: this._observed.programScene ? { ...this._observed.programScene } : null,
      currentGraphic: this._observed.currentGraphic ? { ...this._observed.currentGraphic } : null,
    };
  }

  /** Release listeners. Call when the competition's session ends. */
  shutdown() {
    this.stopObserving();
    this.removeAllListeners();
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  /** @private */
  _getObsConnection() {
    if (!this.obsConnectionManager?.getConnection) return null;
    return this.obsConnectionManager.getConnection(this.compId) || null;
  }

  /** @private */
  async _readConfig(warnings) {
    const db = resolveDb(this.firebase);
    if (!db) {
      warnings.push('Firebase unavailable; graphic filtering fell back to a womens dual');
      return null;
    }
    try {
      const snapshot = await withTimeout(
        db.ref(`competitions/${this.compId}/config`).once('value'),
        this.firebaseTimeoutMs,
        ACTION_ERRORS.FIREBASE_TIMEOUT
      );
      return snapshot.val();
    } catch (error) {
      warnings.push(`could not read competition config: ${error.message}`);
      return null;
    }
  }

  /** @private @returns {Promise<string[]>} */
  async _readObsScenes(warnings) {
    const obs = this._getObsConnection();
    if (!obs) {
      warnings.push('OBS not connected; scene actions come from the rundown only');
      return [];
    }
    try {
      const result = await withTimeout(
        obs.call('GetSceneList'), this.obsCallTimeoutMs, ACTION_ERRORS.OBS_TIMEOUT
      );
      return (result?.scenes || []).map(s => s.sceneName).filter(Boolean);
    } catch (error) {
      warnings.push(`GetSceneList failed: ${error.message}`);
      return [];
    }
  }

  /** @private @returns {Promise<string[]>} */
  async _readRundownScenes(warnings) {
    const db = resolveDb(this.firebase);
    if (!db) return [];
    try {
      const snapshot = await withTimeout(
        db.ref(`competitions/${this.compId}/rundown/segments`).once('value'),
        this.firebaseTimeoutMs,
        ACTION_ERRORS.FIREBASE_TIMEOUT
      );
      const segments = snapshot.val();
      if (!segments) return [];
      const list = Array.isArray(segments) ? segments : Object.values(segments);
      return [...new Set(list.map(s => s?.obsScene).filter(Boolean))];
    } catch (error) {
      warnings.push(`could not read rundown segments: ${error.message}`);
      return [];
    }
  }
}

/**
 * Is this registry entry usable for the current gender and team count?
 * @param {Object} entry - Registry entry
 * @param {string} gender - "mens" or "womens"
 * @param {number} teamCount
 * @returns {boolean}
 */
export function isGraphicAvailable(entry, gender, teamCount) {
  if (!entry) return false;
  if (entry.gender && entry.gender !== 'both' && entry.gender !== gender) return false;
  if (entry.minTeams != null && teamCount < entry.minTeams) return false;
  if (entry.maxTeams != null && teamCount > entry.maxTeams) return false;
  return true;
}

/**
 * The graphic ID for slot N of a perTeam registry entry:
 * "team-roster" + 2 -> "team2-roster". Entries without the "team-" prefix get
 * the slot appended ("logos" -> "logos-team2") so IDs stay unique.
 * @param {string} registryId
 * @param {number} slot
 * @returns {string}
 */
export function perTeamGraphicId(registryId, slot) {
  if (registryId.startsWith('team-')) {
    return `team${slot}-${registryId.slice('team-'.length)}`;
  }
  return `${registryId}-team${slot}`;
}

// -----------------------------------------------------------------------------
// Per-competition singletons (same shape as getOrCreatePlayoutEngine)
// -----------------------------------------------------------------------------

const actionBuses = new Map();

/**
 * Get or create the ActionBus for a competition. Starts observing on creation.
 * @param {string} compId
 * @param {Object} [options] - Passed to the constructor on first call
 * @returns {ActionBus}
 */
export function getOrCreateActionBus(compId, options = {}) {
  if (!compId) {
    throw new Error('compId is required to get or create an ActionBus');
  }
  const existing = actionBuses.get(compId);
  if (existing) return existing;

  console.log(`[ActionBus] Creating bus for competition: ${compId}`);
  const bus = new ActionBus({ ...options, compId });
  bus.startObserving();
  actionBuses.set(compId, bus);
  return bus;
}

/**
 * Get the existing ActionBus for a competition, without creating one.
 * @param {string} compId
 * @returns {ActionBus|null}
 */
export function getActionBus(compId) {
  return actionBuses.get(compId) || null;
}

/** All live buses, keyed by compId. @returns {Map<string, ActionBus>} */
export function getAllActionBuses() {
  return actionBuses;
}

/**
 * Shut down and forget a competition's bus.
 * @param {string} compId
 */
export function disposeActionBus(compId) {
  const bus = actionBuses.get(compId);
  if (!bus) return;
  bus.shutdown();
  actionBuses.delete(compId);
}

export default ActionBus;
