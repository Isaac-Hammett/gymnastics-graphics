/**
 * Xavier service (ISA2-275). One per competition.
 *
 * On every competition-state update, plus about once a second while any
 * routine is in_progress, asks the decision provider (Jev) three kinds of
 * question about the current state:
 *   next_action                 choice over the available action IDs + 'hold'
 *   routine_in_progress_{EV}    noul, one per event
 *   athlete_matches_{EV}        noul, one per event
 * and emits `xavier:recommendations` to the competition room. Jev returns
 * typed values, not text; the trigger text is written here from state.
 *
 * At most one request is in flight. A reply whose state version has moved on
 * is dropped and the newest state is evaluated next. If the provider is
 * unavailable no recommendations are emitted; `xavier:status` says why.
 */

import { EventEmitter } from 'events';
import { isValidAnswer } from './DecisionProvider.js';

export const HOLD = 'hold';
const MAX_OPTIONS = 255;
const MAX_RECOMMENDATIONS = 3;

const titleCase = (s) => String(s || '').toLowerCase().replace(/^\w/, c => c.toUpperCase());
const lastName = (name) => String(name || '').trim().split(/\s+/).slice(-1)[0];
const evKey = (ev) => String(ev.code || ev.name).replace(/[^A-Za-z0-9]/g, '');

/** Trigger text written from a competition-state event; Jev returns no text. */
export function triggerText(event) {
  if (!event) return null;
  const ev = titleCase(event.event);
  const who = event.athlete?.name ? lastName(event.athlete.name) : null;
  switch (event.type) {
    case 'scorePosted': return `Score posted: ${ev}, ${who} ${event.score}`;
    case 'scoreCorrected': return `Score ${event.removed ? 'removed' : 'corrected'}: ${ev}, ${who} ${event.previousScore} to ${event.score}`;
    case 'athleteUp': return `Athlete up: ${ev}, ${who}`;
    case 'greenLight': return `Green light: ${ev}, ${who || event.team}`;
    case 'routineEnded': return `Routine ended: ${ev}, ${who || event.team}`;
    case 'rotationChanged': return `Rotation ${event.rotation}${event.isFinal ? ' (final)' : ''} started`;
    case 'teamTotalChanged': return `Team total: ${event.team} ${event.total}`;
    default: return event.type;
  }
}

export class XavierService extends EventEmitter {
  /**
   * @param {Object} o
   * @param {string} o.compId
   * @param {Object} o.io - socket.io server (optional)
   * @param {Object} o.competitionState - emits 'update' and 'event'; has getPublicState()
   * @param {Function} o.getActions - async () => [{ id, label, ... }] available right now
   * @param {Object} o.provider - DecisionProvider
   * @param {number} [o.tickMs]
   */
  constructor({ compId, io = null, competitionState, getActions, provider, tickMs = 1000, now = Date.now, log = console.log } = {}) {
    super();
    if (!compId) throw new Error('compId is required');
    this.compId = compId;
    this._io = io;
    this._cs = competitionState;
    this._getActions = getActions || (async () => []);
    this._provider = provider;
    this._tickMs = tickMs;
    this._now = now;
    this._log = log;
    this._inFlight = false;
    this._dirty = false;
    this._timer = null;
    this._lastEvent = null;
    this._last = null;
    this._status = { ok: true, reason: null };
    this._onUpdate = () => this.request();
    this._onEvent = (e) => { this._lastEvent = e; };
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._cs.on('event', this._onEvent);
    this._cs.on('update', this._onUpdate);
    this._timer = setInterval(() => this._tick(), this._tickMs);
    this._timer.unref?.();
    this.request();
  }

  stop() {
    this._started = false;
    this._cs?.off('event', this._onEvent);
    this._cs?.off('update', this._onUpdate);
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  getSnapshot() {
    return { compId: this.compId, running: !!this._started, status: this._status, last: this._last };
  }

  /** The producer dismissed one card. Drops it from the snapshot and tells the room. */
  dismiss(recommendationId) {
    if (!recommendationId || !this._last) return false;
    const before = this._last.recommendations.length;
    this._last = { ...this._last, recommendations: this._last.recommendations.filter(r => r.recommendationId !== recommendationId) };
    if (this._last.recommendations.length === before) return false;
    this._io?.to(`competition:${this.compId}`).emit('xavier:dismissed', { compId: this.compId, recommendationId });
    return true;
  }

  _tick() {
    const state = this._cs.getPublicState();
    const anyInProgress = Object.values(state.events || {}).some(ev =>
      Object.values(ev.teams || {}).some(t => t.routineStatus === 'in_progress'));
    if (anyInProgress) this.request();
  }

  /** Ask for an evaluation. Coalesces: at most one request in flight. */
  request() {
    if (this._inFlight) { this._dirty = true; return Promise.resolve(); }
    return this._run();
  }

  async _run() {
    this._inFlight = true;
    try {
      do {
        this._dirty = false;
        await this._evaluateOnce();
      } while (this._dirty && this._started !== false);
    } finally {
      this._inFlight = false;
    }
  }

  async _evaluateOnce() {
    const pub = this._cs.getPublicState();
    if (!pub.hasSnapshot) return;
    const version = pub.stateVersion;

    let actions = [];
    try { actions = (await this._getActions()) || []; } catch (err) {
      this._log(`[Xavier:${this.compId}] action list failed: ${err.message}`);
    }
    const ids = actions.map(a => a.id).filter(id => id !== HOLD).slice(0, MAX_OPTIONS - 1);
    const labels = new Map(actions.map(a => [a.id, a.label || a.id]));
    const trigger = triggerText(this._lastEvent);
    const { state, questions } = buildRequest(pub, actions, ids, trigger);

    let result;
    try {
      result = await this._provider.evaluate({ state, questions });
    } catch (err) {
      this._log(`[Xavier:${this.compId}] decision provider failed (${err.code || 'error'}): ${err.message}`);
      this._setStatus({ ok: false, reason: err.code || 'error', message: err.message });
      return;
    }
    const u = result.usage;
    const tokens = u ? ` inputTokens=${u.input_tokens ?? u.prompt_tokens ?? u.inputTokens ?? '?'} usage=${JSON.stringify(u)}` : '';
    this._log(`[Xavier:${this.compId}] ${result.model} latency=${result.latencyMs}ms${tokens} questions=${Object.keys(questions).length} stateVersion=${version}`);
    this.emit('latency', { compId: this.compId, latencyMs: result.latencyMs, model: result.model, stateVersion: version });

    if (this._cs.getPublicState().stateVersion !== version) {
      this._log(`[Xavier:${this.compId}] dropped stale reply for stateVersion ${version}`);
      this._dirty = true;
      this.emit('stale', { stateVersion: version });
      return;
    }

    const answers = result.answers || {};
    if (!isValidAnswer(answers.next_action)) {
      this._setStatus({ ok: false, reason: 'bad_response', message: 'next_action answer missing or malformed' });
      return;
    }
    this._setStatus({ ok: true, reason: null });

    const probs = answers.next_action.probabilities || {};
    const recommendations = Object.entries(probs)
      .filter(([id]) => id !== HOLD && labels.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_RECOMMENDATIONS)
      .map(([actionId, probability], i) => ({
        recommendationId: `${this.compId}:${version}:${actionId}`,
        rank: i + 1, actionId, label: labels.get(actionId), probability, trigger
      }));

    const flags = {};
    for (const [id, a] of Object.entries(answers)) {
      if (id !== 'next_action' && a?.type === 'noul') flags[id] = a.noul;
    }

    const payload = {
      compId: this.compId,
      stateVersion: version,
      recommendations,
      holdProbability: probs[HOLD] ?? null,
      confidence: answers.next_action.confidence ?? null,
      flags,
      trigger,
      latencyMs: result.latencyMs,
      model: result.model,
      at: this._now()
    };
    this._last = payload;
    this.emit('recommendations', payload);
    this._io?.to(`competition:${this.compId}`).emit('xavier:recommendations', payload);
  }

  _setStatus(status) {
    const changed = status.ok !== this._status.ok || status.reason !== this._status.reason;
    this._status = status;
    if (changed) {
      this.emit('status', { compId: this.compId, ...status });
      this._io?.to(`competition:${this.compId}`).emit('xavier:status', { compId: this.compId, ...status });
    }
  }
}

/** Build the Jev state and the three kinds of question from competition state. */
export function buildRequest(pub, actions, actionIds, trigger) {
  const events = {};
  const questions = {};
  for (const ev of Object.values(pub.events || {})) {
    const key = evKey(ev);
    events[key] = {
      name: ev.name,
      rotation: ev.rotation,
      teams: Object.fromEntries(Object.entries(ev.teams || {}).map(([team, t]) => [team, {
        routineStatus: t.routineStatus,
        athleteUp: t.athleteUp ? { name: t.athleteUp.name, order: t.athleteUp.order, confidence: t.athleteUp.confidence } : null,
        lastScore: t.lastScore ? { name: t.lastScore.name, score: t.lastScore.score } : null,
        lineup: t.lineup.map(g => ({ order: g.order, name: g.name, score: g.score })),
        bye: t.bye
      }]))
    };
    questions[`routine_in_progress_${key}`] = {
      type: 'noul',
      instructions: `Is a routine on ${ev.name} in progress right now (an athlete has started and the score has not posted)? Read events.${key}.teams for routineStatus and athleteUp.`,
      criteria: { true: 'An athlete is mid-routine on this event', false: 'No routine is underway on this event' }
    };
    questions[`athlete_matches_${key}`] = {
      type: 'noul',
      instructions: `Does the athlete up on ${ev.name} match the lineup order and the scores Virtius has posted? Compare events.${key}.teams[*].athleteUp against lineup and lastScore.`,
      criteria: { true: 'athleteUp is the next unscored athlete in the lineup', false: 'athleteUp does not fit the lineup or posted scores' }
    };
  }

  const criteria = { [HOLD]: 'Do nothing yet; wait for the next state change' };
  for (const a of actions) if (actionIds.includes(a.id)) criteria[a.id] = a.label || a.id;
  questions.next_action = {
    type: 'choice',
    instructions: 'What should the broadcast program do next, given the competition state and the trigger? Choose hold unless an action clearly fits.',
    criteria
  };

  const state = {
    trigger,
    stateVersion: pub.stateVersion,
    meetStatus: pub.meetStatus,
    rotation: pub.rotation,
    standings: pub.standings,
    events
  };
  return { state, questions };
}
