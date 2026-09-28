/**
 * Xavier decision log (ISA2-279). One per competition.
 *
 * Every recommendation set the service publishes becomes one record at
 * `competitions/{compId}/xavier/decisions/{id}`:
 *   { ts, clockMs, runId, stateVersion, stateSnapshot, trigger, provider, model,
 *     latencyMs, questions, answers, recommended[], guardrails, confidence }
 * and, once the producer has responded, `outcome`:
 *   { type: took|dismissed|other|expired, actionId, ackOk, responseMs }
 *
 *   took       a recommended action ran (Take on the card, or the same action
 *              from any other control). `auto: true` when Xavier ran it itself.
 *   dismissed  every card in the set was dismissed
 *   other      the producer changed a scene or graphic some other way while the
 *              set was open (a bus command for an action not recommended, or a
 *              change the bus observed that it did not make: step 1's humanAction)
 *   expired    the set was replaced by a newer one, or Xavier stopped, with no response
 *
 * `confidence` is the top recommendation's probability; the take rate view
 * buckets on it. `stateSnapshot` is the state sent to the model, nothing more.
 * `guardrails` lists refusals the bus returned for actions from this set.
 */

import { isXavierSender } from '../guardrails.js';

export const DECISIONS_PATH = (compId) => `competitions/${compId}/xavier/decisions`;
export const OUTCOME_TYPES = ['took', 'dismissed', 'other', 'expired'];

export class XavierDecisionLog {
  /**
   * @param {Object} o
   * @param {string} o.compId
   * @param {Object} o.service - XavierService ('recommendations' (payload, detail), 'dismissed', 'stopped')
   * @param {Function} o.getBus - () => ActionBus ('executed', 'humanAction')
   * @param {Function} [o.write] - async (record) => id; called once per record
   * @param {Function} [o.update] - async (id, patch) => void
   * @param {Function} [o.getContext] - () => { clockMs, runKey, runLabel } (recorded-meet position)
   * @param {string} [o.provider]
   */
  constructor({ compId, service, getBus, write = null, update = null, getContext = null,
    provider = 'jev', now = Date.now, log = console.log } = {}) {
    if (!compId) throw new Error('compId is required');
    this.compId = compId;
    this._service = service;
    this._getBus = getBus || (() => null);
    this._write = write;
    this._update = update;
    this._getContext = getContext || (() => ({}));
    this._provider = provider;
    this._now = now;
    this._log = log;
    this._open = null;      // { id, record, ready:Promise }
    this._bus = null;
    this._runKey = undefined;
    this._runId = null;

    this._onRecs = (payload, detail) => this.record(payload, detail);
    this._onDismissed = (d) => this.dismissed(d);
    this._onStopped = () => this.close({ type: 'expired' });
    this._onExecuted = (rec) => this.executed(rec);
    this._onHuman = (obs) => this.human(obs);
  }

  start() {
    this._service?.on?.('recommendations', this._onRecs);
    this._service?.on?.('dismissed', this._onDismissed);
    this._service?.on?.('stopped', this._onStopped);
    this.attachBus();
  }

  stop() {
    this._service?.off?.('recommendations', this._onRecs);
    this._service?.off?.('dismissed', this._onDismissed);
    this._service?.off?.('stopped', this._onStopped);
    this.close({ type: 'expired' });
    this._detachBus();
  }

  attachBus() {
    const bus = this._getBus();
    if (!bus || bus === this._bus) return;
    this._detachBus();
    this._bus = bus;
    bus.on('executed', this._onExecuted);
    bus.on('humanAction', this._onHuman);
  }

  _detachBus() {
    this._bus?.off?.('executed', this._onExecuted);
    this._bus?.off?.('humanAction', this._onHuman);
    this._bus = null;
  }

  _runId_() {
    const ctx = this._getContext() || {};
    if (ctx.runKey !== this._runKey || !this._runId) {
      this._runKey = ctx.runKey;
      this._runId = `${ctx.runLabel || 'live'}-${this._now()}`;
    }
    return { runId: this._runId, clockMs: ctx.clockMs ?? null };
  }

  /** A recommendation set was published. Expires the previous open record and logs this one. */
  record(payload, detail = {}) {
    const recs = payload?.recommendations || [];
    this.close({ type: 'expired' });
    if (!recs.length) return null;
    this.attachBus();
    const { runId, clockMs } = this._runId_();
    const record = {
      ts: payload.at ?? this._now(),
      clockMs,
      runId,
      stateVersion: payload.stateVersion ?? null,
      stateSnapshot: detail.state ?? null,
      trigger: payload.trigger ?? null,
      provider: this._provider,
      model: payload.model ?? null,
      latencyMs: payload.latencyMs ?? null,
      questions: detail.questions ?? null,
      answers: detail.answers ?? null,
      recommended: recs.map(r => ({
        recommendationId: r.recommendationId, actionId: r.actionId, label: r.label ?? r.actionId,
        rank: r.rank, probability: r.probability
      })),
      holdProbability: payload.holdProbability ?? null,
      confidence: recs[0].probability ?? null,
      guardrails: [],
    };
    const open = { id: null, record, ready: null };
    open.ready = Promise.resolve(this._write ? this._write(record) : null)
      .then(id => { open.id = id ?? null; })
      .catch(err => this._log(`[XavierLog:${this.compId}] write failed: ${err.message}`));
    this._open = open;
    return record;
  }

  /** Put the outcome on the open record and close it. */
  close(outcome) {
    const open = this._open;
    if (!open) return null;
    this._open = null;
    const full = {
      type: outcome.type,
      actionId: outcome.actionId ?? null,
      ackOk: outcome.ackOk ?? null,
      responseMs: outcome.type === 'expired' ? null : Math.max(0, this._now() - open.record.ts),
      ...(outcome.auto ? { auto: true } : {}),
    };
    open.record.outcome = full;
    open.ready.then(() => {
      if (open.id && this._update) {
        return this._update(open.id, { outcome: full, guardrails: open.record.guardrails });
      }
      return null;
    }).catch(err => this._log(`[XavierLog:${this.compId}] outcome write failed: ${err.message}`));
    return full;
  }

  dismissed({ remaining } = {}) {
    if (this._open && !remaining) this.close({ type: 'dismissed' });
  }

  executed(rec) {
    const open = this._open;
    if (!open || !rec) return;
    const recommended = open.record.recommended.find(r =>
      (rec.recommendationId && r.recommendationId === rec.recommendationId) || r.actionId === rec.actionId);
    if (rec.guardrail) open.record.guardrails.push({ actionId: rec.actionId, sender: rec.sender, ...rec.guardrail });
    if (recommended && rec.sender === 'xavier-auto' && !rec.ok) {
      return; // Xavier's own auto run was refused: not a producer response, the set stays open
    }
    if (recommended) {
      this.close({ type: 'took', actionId: rec.actionId, ackOk: !!rec.ok, auto: rec.sender === 'xavier-auto' });
    } else if (!isXavierSender(rec.sender) && rec.ok) {
      this.close({ type: 'other', actionId: rec.actionId, ackOk: true });
    }
  }

  /** A scene or graphic changed and the bus did not make it. */
  human(obs) {
    if (!this._open || !obs) return;
    const actionId = obs.kind === 'scene' ? `scene:${obs.sceneName}` : obs.kind === 'graphic' ? `graphic:${obs.graphicId}` : null;
    const rec = this._open.record.recommended.find(r => r.actionId === actionId);
    if (rec) this.close({ type: 'took', actionId, ackOk: true });
    else this.close({ type: 'other', actionId, ackOk: true });
  }
}
