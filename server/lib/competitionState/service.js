/**
 * Competition State Service (ISA2-274)
 *
 * One per competition. Feeds a source's inputs through the pure reducer,
 * keeps the current state, and emits typed events to the competition room for
 * debugging and for Xavier (steps 4+).
 *
 * Socket events (room `competition:<compId>`):
 *   competitionState:event   one typed event { type, t, confidence, evidence[], ... }
 *   competitionState:update  { compId, stateVersion, state }  after any state change;
 *                            { ..., reset: true, t } when a source seeks (ISA2-296)
 */

import { EventEmitter } from 'events';
import { createInitialState, reduce } from './reducer.js';

const MAX_RECENT_EVENTS = 200;

export class CompetitionStateService extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.compId
   * @param {Object} [options.io] - socket.io server
   * @param {boolean} [options.emitInitial] - emit events for scores already present in the first snapshot
   */
  constructor({ compId, io = null, emitInitial = false } = {}) {
    super();
    if (!compId) throw new Error('compId is required');
    this.compId = compId;
    this._io = io;
    this._emitInitial = emitInitial;
    this._state = createInitialState();
    this._recent = [];
    this._source = null;
    this._lastError = null;
    this._onInput = (input) => this.ingest(input);
    this._onReset = ({ t, state }) => this.reset(state, t);
    this._onError = (err) => {
      this._lastError = { message: err.message, at: Date.now() };
      console.error(`[CompetitionState:${compId}] source error: ${err.message}`);
    };
  }

  /** Attach and start a source, replacing any current one. */
  attach(source) {
    this.detach();
    this._source = source;
    source.on('input', this._onInput);
    source.on('error', this._onError);
    source.on('reset', this._onReset);
    source.start();
  }

  detach() {
    if (!this._source) return;
    this._source.stop();
    this._source.off('input', this._onInput);
    this._source.off('error', this._onError);
    this._source.off('reset', this._onReset);
    this._source = null;
  }

  /**
   * Replace the state with one a source rebuilt (a recorded seek). No typed
   * events are emitted for the jump; stateVersion keeps increasing.
   */
  reset(state, t = null) {
    const stateVersion = Math.max(this._state.stateVersion, state.stateVersion) + 1;
    this._state = { ...state, stateVersion };
    this._recent = [];
    const pub = this.getPublicState();
    this.emit('reset', { t, state: pub });
    this.emit('update', pub);
    this._io?.to(`competition:${this.compId}`).emit('competitionState:update', {
      compId: this.compId, stateVersion, state: pub, reset: true, t
    });
  }

  /** Reduce one input and publish the result. Returns the emitted events. */
  ingest(input) {
    const before = this._state.stateVersion;
    const { state, events } = reduce(this._state, input, { emitInitial: this._emitInitial });
    this._state = state;

    for (const event of events) {
      this._recent.push(event);
      if (this._recent.length > MAX_RECENT_EVENTS) this._recent.shift();
      this.emit('event', event);
      this._io?.to(`competition:${this.compId}`).emit('competitionState:event', { compId: this.compId, ...event });
    }
    if (state.stateVersion !== before) {
      this.emit('update', this.getPublicState());
      this._io?.to(`competition:${this.compId}`).emit('competitionState:update', {
        compId: this.compId, stateVersion: state.stateVersion, state: this.getPublicState()
      });
    }
    return events;
  }

  /** State without the reducer's private diff maps. */
  getPublicState() {
    const { _scores, _totals, _digest, ...pub } = this._state;
    return pub;
  }

  getSnapshot() {
    return {
      compId: this.compId,
      running: !!this._source,
      lastError: this._lastError,
      state: this.getPublicState(),
      recentEvents: [...this._recent]
    };
  }

  stop() {
    this.detach();
  }
}

const services = new Map();

export function getOrCreateCompetitionState(compId, options = {}) {
  let svc = services.get(compId);
  if (!svc) {
    svc = new CompetitionStateService({ ...options, compId });
    services.set(compId, svc);
  }
  return svc;
}

export function getCompetitionState(compId) {
  return services.get(compId) || null;
}

export function removeCompetitionState(compId) {
  const svc = services.get(compId);
  if (svc) svc.stop();
  services.delete(compId);
}
