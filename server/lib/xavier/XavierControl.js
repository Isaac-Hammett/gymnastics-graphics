/**
 * Xavier control levels (ISA2-277). One per competition.
 *
 * Config lives at `competitions/{compId}/config/xavier`:
 *   { mode: off|suggest|auto|full,
 *     thresholds: { scene: 0.92, graphic: 0.8 },   per action type
 *     cooldownMs: 10000,                            quiet time after a producer action
 *     pendingMs: 1000 }                             how long an auto action waits before it runs
 * (`config/xavier/guardrails` next to it belongs to guardrails.js.)
 *
 * The levels:
 *   off      the service is stopped
 *   suggest  the widget only
 *   auto     the top recommendation runs, sender 'xavier-auto', when its
 *            probability clears the threshold for its action type; below it,
 *            it stays a suggestion
 *   full     the top recommendation always runs (unless Xavier would rather hold)
 *
 * The producer's override always wins: any non-Xavier command on the action
 * bus, or a change the bus sees that it did not make, cancels a pending Xavier
 * action and starts the cooldown. Guardrails apply to every Xavier action; a
 * refusal is logged and broadcast, and the same recommendation is never tried
 * again (Xavier can never force).
 *
 * Every execution attempt becomes a decision record (`outcome: 'auto'` when it
 * ran), passed to `onDecision` for the decision log and broadcast as `xavier:auto`.
 */

import { EventEmitter } from 'events';
import { resolveDb } from '../graphicPayload.js';
import { isXavierSender } from '../guardrails.js';

export const XAVIER_MODES = ['off', 'suggest', 'auto', 'full'];
export const AUTO_SENDER = 'xavier-auto';
export const XAVIER_CONFIG_PATH = (compId) => `competitions/${compId}/config/xavier`;
export const DEFAULT_XAVIER_CONFIG = Object.freeze({
  mode: 'off',
  thresholds: Object.freeze({ scene: 0.92, graphic: 0.8 }),
  cooldownMs: 10000,
  pendingMs: 1000,
});
const MAX_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_PENDING_MS = 30 * 1000;
const MAX_RECENT = 20;

const isProb = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isMs = (v, max) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;

/** 'scene:Cam FX' -> 'scene', 'graphic:team1-roster' -> 'graphic'. */
export function actionKind(actionId) {
  const m = /^(scene|graphic):/.exec(String(actionId || ''));
  return m ? m[1] : null;
}

/**
 * Merge a raw config onto the defaults. Invalid fields keep their default and
 * are listed in `errors`, so a bad write never turns auto on by accident.
 * @param {Object|null} raw
 * @returns {{config: Object, errors: string[]}}
 */
export function validateXavierConfig(raw) {
  const d = DEFAULT_XAVIER_CONFIG;
  const errors = [];
  const src = raw && typeof raw === 'object' ? raw : {};
  let mode = d.mode;
  if (src.mode !== undefined) {
    if (XAVIER_MODES.includes(src.mode)) mode = src.mode;
    else errors.push(`mode must be one of ${XAVIER_MODES.join('|')}`);
  }
  const thresholds = { ...d.thresholds };
  if (src.thresholds !== undefined) {
    if (!src.thresholds || typeof src.thresholds !== 'object') errors.push('thresholds must be an object');
    else {
      for (const [kind, v] of Object.entries(src.thresholds)) {
        if (isProb(v)) thresholds[kind] = v;
        else errors.push(`thresholds.${kind} must be a number from 0 to 1`);
      }
    }
  }
  let cooldownMs = d.cooldownMs;
  if (src.cooldownMs !== undefined) {
    if (isMs(src.cooldownMs, MAX_COOLDOWN_MS)) cooldownMs = src.cooldownMs;
    else errors.push(`cooldownMs must be 0 to ${MAX_COOLDOWN_MS}`);
  }
  let pendingMs = d.pendingMs;
  if (src.pendingMs !== undefined) {
    if (isMs(src.pendingMs, MAX_PENDING_MS)) pendingMs = src.pendingMs;
    else errors.push(`pendingMs must be 0 to ${MAX_PENDING_MS}`);
  }
  return { config: { mode, thresholds, cooldownMs, pendingMs }, errors };
}

export class XavierControl extends EventEmitter {
  /**
   * @param {Object} o
   * @param {string} o.compId
   * @param {Object} o.service - XavierService (emits 'recommendations'; start/stop)
   * @param {Function} o.getBus - () => the competition's ActionBus (resolved per call)
   * @param {Object} [o.firebase] - Firebase Admin handle; config is watched and mode is written here
   * @param {Object} [o.io]
   * @param {Object} [o.config] - Raw config to start from (tests, or no Firebase)
   * @param {Function} [o.onDecision] - (record) => void, for the decision log
   */
  constructor({
    compId, service, getBus, firebase = null, io = null, config = null, onDecision = null,
    now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, log = console.log,
  } = {}) {
    super();
    if (!compId) throw new Error('compId is required');
    this.compId = compId;
    this._service = service;
    this._getBus = getBus || (() => null);
    this._firebase = firebase;
    this._io = io;
    this._onDecision = onDecision;
    this._now = now;
    this._setTimer = setTimer;
    this._clearTimer = clearTimer;
    this._log = log;

    const { config: cfg, errors } = validateXavierConfig(config);
    this._config = cfg;
    this._configErrors = errors;
    this._cooldownUntil = 0;
    this._pending = null;       // { record, timer }
    this._handled = new Set();  // recommendationIds already acted on (never retried)
    this._recent = [];
    this._bus = null;
    this._ref = null;
    this._listener = null;

    this._onRecommendations = (payload) => this.handleRecommendations(payload);
    this._onExecuted = (rec) => { if (!isXavierSender(rec?.sender)) this.producerAction(`command ${rec?.actionId} from ${rec?.sender}`); };
    this._onHuman = (obs) => this.producerAction(`${obs?.kind} changed outside the bus`);
    service?.on?.('recommendations', this._onRecommendations);
  }

  /** Watch the config in Firebase and apply the current mode. */
  start() {
    this._service?.off?.('recommendations', this._onRecommendations);
    this._service?.on?.('recommendations', this._onRecommendations);
    this.attachBus();
    this._applyMode();
    const db = resolveDb(this._firebase);
    if (!db || this._ref) return;
    this._ref = db.ref(XAVIER_CONFIG_PATH(this.compId));
    this._listener = (snap) => this.setConfig(snap?.val?.() ?? null);
    this._ref.on('value', this._listener, (err) => {
      this._log(`[XavierControl:${this.compId}] config listener failed, keeping current config: ${err.message}`);
    });
  }

  stop() {
    if (this._ref && this._listener) this._ref.off('value', this._listener);
    this._ref = null;
    this._listener = null;
    this.cancelPending('stopped');
    this._service?.off?.('recommendations', this._onRecommendations);
    this._detachBus();
  }

  /** Listen to the live bus for producer actions; re-attaches if the bus was recreated. */
  attachBus() {
    const bus = this._getBus();
    if (!bus || bus === this._bus) return bus;
    this._detachBus();
    this._bus = bus;
    bus.on('executed', this._onExecuted);
    bus.on('humanAction', this._onHuman);
    return bus;
  }

  _detachBus() {
    this._bus?.off?.('executed', this._onExecuted);
    this._bus?.off?.('humanAction', this._onHuman);
    this._bus = null;
  }

  getConfig() {
    return { ...this._config, thresholds: { ...this._config.thresholds } };
  }

  getState() {
    const now = this._now();
    return {
      compId: this.compId,
      ...this.getConfig(),
      configErrors: [...this._configErrors],
      cooldownUntil: this._cooldownUntil > now ? this._cooldownUntil : null,
      pending: this._pending ? { ...this._pending.record } : null,
      recent: this._recent.map(r => ({ ...r })),
    };
  }

  /** Apply a raw config (from Firebase). Invalid fields keep their defaults. */
  setConfig(raw) {
    const { config, errors } = validateXavierConfig(raw);
    if (errors.length) this._log(`[XavierControl:${this.compId}] config: ${errors.join('; ')}`);
    this._config = config;
    this._configErrors = errors;
    this._applyMode();
    this._broadcastState();
  }

  /**
   * The widget's mode toggle. Applies at once and persists to Firebase.
   * @returns {Promise<{ok: boolean, error?: string, state?: Object}>}
   */
  async setMode(mode) {
    if (!XAVIER_MODES.includes(mode)) return { ok: false, error: 'invalid_mode' };
    this._config = { ...this._config, mode };
    this._applyMode();
    this._broadcastState();
    const db = resolveDb(this._firebase);
    if (db) {
      try {
        await Promise.race([
          db.ref(`${XAVIER_CONFIG_PATH(this.compId)}/mode`).set(mode),
          new Promise((_, reject) => setTimeout(() => reject(new Error('firebase write timed out')), 5000).unref?.()),
        ]);
      } catch (err) {
        this._log(`[XavierControl:${this.compId}] mode write failed (applied locally): ${err.message}`);
        return { ok: true, persisted: false, state: this.getState() };
      }
    }
    return { ok: true, persisted: !!db, state: this.getState() };
  }

  _applyMode() {
    const { mode } = this._config;
    if (mode !== 'auto' && mode !== 'full') this.cancelPending(`mode ${mode}`);
    if (mode === 'off') this._service?.stop?.();
    else this._service?.start?.();
  }

  /** The producer did something: cancel any pending Xavier action and start the cooldown. */
  producerAction(reason = 'producer action') {
    this._cooldownUntil = this._now() + this._config.cooldownMs;
    this.cancelPending(`producer override: ${reason}`);
    this._broadcastState();
  }

  cancelPending(reason) {
    if (!this._pending) return false;
    const { record, timer } = this._pending;
    this._clearTimer(timer);
    this._pending = null;
    this._finish({ ...record, outcome: 'cancelled', reason });
    return true;
  }

  inCooldown() {
    return this._now() < this._cooldownUntil;
  }

  /**
   * Decide whether a recommendation set should run. Returns the decision
   * (`{execute, reason, rec, threshold}`) without side effects.
   */
  decide(payload) {
    const { mode, thresholds } = this._config;
    const rec = payload?.recommendations?.[0];
    if (mode !== 'auto' && mode !== 'full') return { execute: false, reason: `mode ${mode}` };
    if (!rec) return { execute: false, reason: 'no recommendation' };
    const kind = actionKind(rec.actionId);
    const threshold = kind ? thresholds[kind] : undefined;
    const probability = Number(rec.probability) || 0;
    const base = { rec, kind, threshold: threshold ?? null, probability };
    if (!kind) return { ...base, execute: false, reason: 'unknown action type' };
    if (payload.holdProbability != null && payload.holdProbability >= probability) {
      return { ...base, execute: false, reason: 'hold is more likely' };
    }
    if (mode === 'auto' && !(typeof threshold === 'number' && probability >= threshold)) {
      return { ...base, execute: false, reason: 'below threshold' };
    }
    return { ...base, execute: true, reason: mode === 'full' ? 'full' : 'above threshold' };
  }

  /** Called with every `recommendations` payload from the service. */
  handleRecommendations(payload) {
    const d = this.decide(payload);
    if (!d.execute) return d;
    const { rec } = d;
    if (this._handled.has(rec.recommendationId)) return { ...d, execute: false, reason: 'already handled' };
    if (this.inCooldown()) return { ...d, execute: false, reason: 'cooldown' };
    const bus = this.attachBus();
    if (bus && isOnAir(rec.actionId, bus.getObserved?.())) return { ...d, execute: false, reason: 'already on air' };
    if (this._pending?.record.recommendationId === rec.recommendationId) return { ...d, execute: false, reason: 'already pending' };
    this.cancelPending('superseded');

    this._handled.add(rec.recommendationId);
    if (this._handled.size > 500) this._handled.delete(this._handled.values().next().value);
    const record = {
      recommendationId: rec.recommendationId,
      actionId: rec.actionId,
      label: rec.label || rec.actionId,
      kind: d.kind,
      confidence: d.probability,
      threshold: d.threshold,
      mode: this._config.mode,
      sender: AUTO_SENDER,
      trigger: rec.trigger ?? payload.trigger ?? null,
      stateVersion: payload.stateVersion ?? null,
      decidedAt: this._now(),
      runsAt: this._now() + this._config.pendingMs,
    };
    const timer = this._setTimer(() => this._run(record), this._config.pendingMs);
    timer?.unref?.();
    this._pending = { record, timer };
    this._broadcastState();
    return { ...d, pending: record };
  }

  async _run(record) {
    if (this._pending?.record.recommendationId !== record.recommendationId) return;
    this._pending = null;
    const { mode } = this._config;
    if (mode !== 'auto' && mode !== 'full') return this._finish({ ...record, outcome: 'cancelled', reason: `mode ${mode}` });
    if (this.inCooldown()) return this._finish({ ...record, outcome: 'cancelled', reason: 'cooldown' });
    const bus = this.attachBus();
    if (!bus) return this._finish({ ...record, outcome: 'failed', error: 'no_action_bus' });
    let ack;
    try {
      // Never force: guardrails decide, and a refusal is final for this recommendation.
      ack = await bus.execute({ actionId: record.actionId, sender: AUTO_SENDER, recommendationId: record.recommendationId });
    } catch (err) {
      ack = { ok: false, error: err.message, guardrail: null };
    }
    const outcome = ack?.ok ? 'auto' : (ack?.guardrail ? 'refused' : 'failed');
    return this._finish({ ...record, outcome, error: ack?.ok ? null : (ack?.error || null), guardrail: ack?.guardrail || null });
  }

  _finish(record) {
    const done = { ...record, at: this._now() };
    this._recent = [done, ...this._recent].slice(0, MAX_RECENT);
    if (done.outcome === 'refused') {
      this._log(`[XavierControl:${this.compId}] ${done.actionId} refused by guardrail ${done.guardrail?.rule}: ${done.guardrail?.reason}`);
    } else {
      this._log(`[XavierControl:${this.compId}] ${done.actionId} ${done.outcome}${done.reason ? ` (${done.reason})` : ''} confidence=${done.confidence}`);
    }
    try { this._onDecision?.(done); } catch (err) {
      this._log(`[XavierControl:${this.compId}] decision log failed: ${err.message}`);
    }
    this.emit('decision', done);
    this._io?.to(`competition:${this.compId}`).emit('xavier:auto', { compId: this.compId, ...done });
    this._broadcastState();
    return done;
  }

  _broadcastState() {
    const state = this.getState();
    this.emit('state', state);
    this._io?.to(`competition:${this.compId}`).emit('xavier:control', state);
  }
}

/** Whether an action is already what's on air, so running it would change nothing. */
function isOnAir(actionId, observed) {
  if (!observed) return false;
  const scene = observed.programScene?.sceneName;
  const graphic = observed.currentGraphic?.graphicId;
  return (scene && actionId === `scene:${scene}`) || (graphic && actionId === `graphic:${graphic}`);
}
