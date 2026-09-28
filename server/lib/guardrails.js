/**
 * Guardrails (ISA2-273)
 *
 * Rules the action bus checks before it runs a command, whoever sent it: a
 * producer's click, the rundown engine, or Xavier. Enforcement is on by
 * default. A refused command comes back as `{ok: false, guardrail: {rule,
 * reason}}` and never reaches OBS or Firebase.
 *
 * Each rule is `check(action, ctx) -> {allow, rule, reason}` (sync or async).
 * `ctx` carries the sender, the rule's params, what the bus last saw on air,
 * when the program scene last changed, an OBS call helper, and the routine
 * state (null until the competition state service, ISA2-274, supplies it).
 *
 * The producer's override always wins: a human command with `force: true`
 * runs even when rules deny it, and the override is logged with the rules it
 * overrode. Xavier senders can never force.
 *
 * Config: `competitions/{compId}/config/xavier/guardrails` as
 * `{enabled, rules: {ruleName: {enabled, ...params}}}`. Missing config means
 * the defaults: all four rules on, minShotHoldMs at 3000.
 *
 * @module guardrails
 */

import { getGraphicsRegistry, resolveDb } from './graphicPayload.js';

export const GUARDRAIL_CONFIG_PATH = (compId) => `competitions/${compId}/config/xavier/guardrails`;

/** Defaults when Firebase has no config (or only part of one). */
export const DEFAULT_GUARDRAIL_CONFIG = Object.freeze({
  enabled: true,
  rules: Object.freeze({
    minShotHoldMs: Object.freeze({ enabled: true, holdMs: 3000 }),
    noCutDuringRoutine: Object.freeze({ enabled: true, minConfidence: 0.8 }),
    noGraphicStacking: Object.freeze({ enabled: true }),
    cameraMustHaveSignal: Object.freeze({
      enabled: true,
      noSignalStates: Object.freeze([
        'OBS_MEDIA_STATE_NONE',
        'OBS_MEDIA_STATE_STOPPED',
        'OBS_MEDIA_STATE_ENDED',
        'OBS_MEDIA_STATE_ERROR',
      ]),
    }),
  }),
});

// Inputs whose signal OBS can report through GetMediaInputStatus (SRT/RTMP
// camera feeds and file playback are both ffmpeg_source on the VMs).
const MEDIA_INPUT_KINDS = new Set(['ffmpeg_source', 'vlc_source']);

// The whole signal check is bounded; an OBS that does not answer in time
// counts as "unsure", and unsure allows the cut.
const DEFAULT_SIGNAL_CHECK_TIMEOUT_MS = 1500;

const ROUTINE_IN_PROGRESS = new Set(['in_progress', 'inProgress', 'performing', 'live']);

/**
 * Is this sender Xavier ('xavier', 'xavier-suggest', 'xavier-auto', ...)?
 * Xavier senders can never force past a guardrail.
 * @param {string} sender
 * @returns {boolean}
 */
export function isXavierSender(sender) {
  return /^xavier(\b|-|$)/i.test(String(sender || ''));
}

/**
 * Merge a Firebase config onto the defaults. Unknown keys pass through as
 * rule params; a rule missing from Firebase keeps its default.
 * @param {Object|null} raw
 * @returns {{enabled: boolean, rules: Object}}
 */
export function resolveGuardrailConfig(raw) {
  const rules = {};
  for (const [name, defaults] of Object.entries(DEFAULT_GUARDRAIL_CONFIG.rules)) {
    const override = raw?.rules?.[name];
    rules[name] = {
      ...defaults,
      ...(override && typeof override === 'object' ? override : {}),
      enabled: override?.enabled ?? defaults.enabled,
    };
  }
  return {
    enabled: raw?.enabled ?? DEFAULT_GUARDRAIL_CONFIG.enabled,
    rules,
  };
}

const allow = (rule) => ({ allow: true, rule, reason: null });
const deny = (rule, reason) => ({ allow: false, rule, reason });

/** The program scene the bus last saw, or null. */
function programSceneOf(ctx) {
  return ctx.observed?.programScene?.sceneName || null;
}

/** A scene action whose target is already on program changes nothing. */
function isNoOpCut(action, ctx) {
  return action.params?.sceneName === programSceneOf(ctx);
}

/**
 * Registry category for a graphic ID, per-team IDs included
 * ("team2-roster" -> "team-roster", "logos-team2" -> "logos").
 */
export function graphicCategory(graphicId, registry = getGraphicsRegistry()) {
  if (!graphicId || graphicId === 'clear') return null;
  const graphics = registry?.graphics || {};
  const candidates = [
    graphicId,
    graphicId.replace(/^team\d+-/, 'team-'),
    graphicId.replace(/-team\d+$/, ''),
  ];
  for (const id of candidates) {
    if (graphics[id]) return graphics[id].category || null;
  }
  return null;
}

// -----------------------------------------------------------------------------
// The four rules
// -----------------------------------------------------------------------------

export const RULES = {
  /** Hold each shot for a minimum time, measured from the last program change. */
  minShotHoldMs: {
    kind: 'scene',
    check(action, ctx) {
      const holdMs = Number(ctx.params.holdMs ?? 3000);
      const last = ctx.lastProgramChangeAt;
      if (!last || isNoOpCut(action, ctx)) return allow('minShotHoldMs');
      const heldMs = ctx.now - last;
      if (heldMs >= holdMs) return allow('minShotHoldMs');
      return deny('minShotHoldMs',
        `Current shot has been on program ${heldMs}ms; hold it at least ${holdMs}ms`);
    },
  },

  /**
   * Never cut away from an event whose routine is in progress. Uses the
   * routine status and its confidence; unsure (no state, no confidence, or
   * confidence below minConfidence) allows the cut.
   */
  noCutDuringRoutine: {
    kind: 'scene',
    check(action, ctx) {
      const routine = ctx.routine;
      if (!routine || !ROUTINE_IN_PROGRESS.has(routine.status)) return allow('noCutDuringRoutine');
      const confidence = Number(routine.confidence);
      const minConfidence = Number(ctx.params.minConfidence ?? 0.8);
      if (!Number.isFinite(confidence) || confidence < minConfidence) return allow('noCutDuringRoutine');
      if (isNoOpCut(action, ctx)) return allow('noCutDuringRoutine');
      // Cutting between shots of the routine's own event is not cutting away.
      const eventScenes = routine.sceneNames || [];
      if (eventScenes.includes(action.params?.sceneName)) return allow('noCutDuringRoutine');
      const who = [routine.athlete, routine.event].filter(Boolean).join(' on ') || 'a routine';
      return deny('noCutDuringRoutine',
        `${who} is in progress (confidence ${confidence.toFixed(2)}); cutting away is not allowed`);
    },
  },

  /** Don't stack graphics: an on-air graphic only gives way to one of its own category. */
  noGraphicStacking: {
    kind: 'graphic',
    check(action, ctx) {
      const incoming = action.params?.graphicId;
      const current = ctx.observed?.currentGraphic?.graphicId;
      if (!incoming || incoming === 'clear' || !current || current === 'clear' || current === incoming) {
        return allow('noGraphicStacking');
      }
      const registry = ctx.registry || getGraphicsRegistry();
      const currentCategory = graphicCategory(current, registry);
      const incomingCategory = graphicCategory(incoming, registry);
      // Unknown categories (custom graphics) are unsure: allow.
      if (!currentCategory || !incomingCategory || currentCategory === incomingCategory) {
        return allow('noGraphicStacking');
      }
      return deny('noGraphicStacking',
        `"${current}" (${currentCategory}) is on air; clear it before sending "${incoming}" (${incomingCategory})`);
    },
  },

  /**
   * Never cut to a scene whose camera input has no signal. Checks every
   * enabled media input in the scene (and nested scenes) with
   * GetMediaInputStatus. OBS errors or a timeout count as unsure and allow.
   */
  cameraMustHaveSignal: {
    kind: 'scene',
    async check(action, ctx) {
      const sceneName = action.params?.sceneName;
      if (!sceneName || !ctx.obsCall || isNoOpCut(action, ctx)) return allow('cameraMustHaveSignal');
      const noSignal = new Set(ctx.params.noSignalStates || []);
      let dead;
      try {
        dead = await withTimeout(
          findDeadInput(ctx.obsCall, sceneName, noSignal, new Set()),
          ctx.params.timeoutMs ?? DEFAULT_SIGNAL_CHECK_TIMEOUT_MS
        );
      } catch (error) {
        return { ...allow('cameraMustHaveSignal'), unsure: error.message };
      }
      if (!dead) return allow('cameraMustHaveSignal');
      return deny('cameraMustHaveSignal',
        `Input "${dead.inputName}" in scene "${sceneName}" has no signal (${dead.mediaState})`);
    },
  },
};

/** Cheap rules first; the OBS round trips go last. */
const RULE_ORDER = ['minShotHoldMs', 'noCutDuringRoutine', 'noGraphicStacking', 'cameraMustHaveSignal'];

async function findDeadInput(obsCall, sceneName, noSignal, visited) {
  if (visited.has(sceneName)) return null;
  visited.add(sceneName);
  const { sceneItems = [] } = (await obsCall('GetSceneItemList', { sceneName })) || {};
  for (const item of sceneItems) {
    if (item.sceneItemEnabled === false) continue;
    if (item.sourceType === 'OBS_SOURCE_TYPE_SCENE') {
      const nested = await findDeadInput(obsCall, item.sourceName, noSignal, visited);
      if (nested) return nested;
      continue;
    }
    if (!MEDIA_INPUT_KINDS.has(item.inputKind)) continue;
    const status = await obsCall('GetMediaInputStatus', { inputName: item.sourceName });
    if (status && noSignal.has(status.mediaState)) {
      return { inputName: item.sourceName, mediaState: status.mediaState };
    }
  }
  return null;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Run the enabled rules for one action.
 *
 * Without force, stops at the first denial. With a human force, runs every
 * rule so the override log names all of them.
 *
 * @param {Object} action - Catalog action `{id, kind, params}`
 * @param {Object} ctx - `{sender, force, observed, lastProgramChangeAt, routine, obsCall, now}`
 * @param {Object} config - Resolved config (resolveGuardrailConfig)
 * @returns {Promise<{allow: boolean, rule: string|null, reason: string|null, overridden: Object[]}>}
 */
export async function evaluateGuardrails(action, ctx, config = resolveGuardrailConfig(null)) {
  const force = Boolean(ctx.force) && !isXavierSender(ctx.sender);
  const denials = [];
  if (config.enabled !== false) {
    for (const name of RULE_ORDER) {
      const rule = RULES[name];
      const params = config.rules?.[name] || {};
      if (params.enabled === false || rule.kind !== action.kind) continue;
      let verdict;
      try {
        verdict = await rule.check(action, { ...ctx, now: ctx.now ?? Date.now(), params });
      } catch (error) {
        console.warn(`[Guardrails] ${name} threw, treating as allow: ${error.message}`);
        continue;
      }
      if (verdict && verdict.allow === false) {
        denials.push({ rule: verdict.rule || name, reason: verdict.reason || 'Blocked by guardrail' });
        if (!force) break;
      }
    }
  }
  if (denials.length === 0) return { allow: true, rule: null, reason: null, overridden: [] };
  if (force) return { allow: true, rule: null, reason: null, overridden: denials };
  return { allow: false, ...denials[0], overridden: [] };
}

/**
 * One competition's guardrails: its config (watched in Firebase) and the
 * routine state provider. The action bus calls `check` before every command.
 */
export class Guardrails {
  /**
   * @param {Object} options
   * @param {string} options.compId
   * @param {Object} [options.firebase] - Firebase Admin database handle or app
   * @param {Function} [options.routineStateProvider] - `() => {status, confidence,
   *   event, athlete, sceneNames}|null`; the state service (ISA2-274) plugs in here
   * @param {Object} [options.config] - Raw config to use instead of Firebase (tests)
   */
  constructor(options = {}) {
    this.compId = options.compId;
    this.firebase = options.firebase || null;
    this.routineStateProvider = options.routineStateProvider || null;
    this._raw = options.config ?? null;
    this._config = resolveGuardrailConfig(this._raw);
    this._ref = null;
    this._listener = null;
  }

  /** Watch the config in Firebase. Idempotent; without Firebase the defaults stand. */
  start() {
    if (this._ref) return;
    const db = resolveDb(this.firebase);
    if (!db) return;
    this._ref = db.ref(GUARDRAIL_CONFIG_PATH(this.compId));
    this._listener = (snapshot) => this.setConfig(snapshot?.val?.() ?? null);
    this._ref.on('value', this._listener, (error) => {
      console.warn(`[Guardrails:${this.compId}] Config listener failed, keeping defaults: ${error.message}`);
    });
  }

  stop() {
    if (this._ref && this._listener) this._ref.off('value', this._listener);
    this._ref = null;
    this._listener = null;
  }

  /** @param {Object|null} raw - Config as stored in Firebase */
  setConfig(raw) {
    this._raw = raw;
    this._config = resolveGuardrailConfig(raw);
  }

  /** @returns {{enabled: boolean, rules: Object, source: string}} */
  getConfig() {
    return { ...this._config, source: this._raw ? 'firebase' : 'defaults' };
  }

  /** Plug in the competition state service (ISA2-274). */
  setRoutineStateProvider(fn) {
    this.routineStateProvider = typeof fn === 'function' ? fn : null;
  }

  /**
   * @param {Object} action
   * @param {Object} ctx - `{sender, force, observed, lastProgramChangeAt, obsCall}`
   */
  async check(action, ctx = {}) {
    let routine = null;
    try {
      routine = this.routineStateProvider ? this.routineStateProvider() : null;
    } catch {
      routine = null;
    }
    return evaluateGuardrails(action, { routine, ...ctx }, this._config);
  }
}

export default Guardrails;
