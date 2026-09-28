/**
 * Competition state sources (ISA2-274)
 *
 * A source emits 'input' with { t, snapshot } or { t, signal }, and 'error'
 * with an Error. Sources never reduce; the service does.
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import { fetchVirtiusSession } from '../scoringIngestionService.js';

const DEFAULT_POLL_MS = 15000;

/**
 * Polls a live Virtius session. Polls never overlap: the next one is scheduled
 * after the previous settles. A failed poll emits 'error' and polling continues.
 * Optionally appends every raw poll to a JSONL file ({t, snapshot} per line),
 * which RecordedEventSource can replay.
 */
export class LiveVirtiusSource extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.sessionId
   * @param {number} [options.pollIntervalMs]
   * @param {string} [options.logPath] - JSONL file to append raw polls to
   * @param {Function} [options.fetchSession] - (sessionId) => Promise<json>; default hits Virtius
   * @param {Function} [options.now]
   */
  constructor({ sessionId, pollIntervalMs = DEFAULT_POLL_MS, logPath = null, fetchSession = fetchVirtiusSession, now = Date.now } = {}) {
    super();
    this.sessionId = sessionId;
    this.pollIntervalMs = pollIntervalMs;
    this.logPath = logPath;
    this._fetch = fetchSession;
    this._now = now;
    this._timer = null;
    this._running = false;
  }

  get running() {
    return this._running;
  }

  start() {
    if (this._running) return;
    if (!this.sessionId) throw new Error('LiveVirtiusSource requires a sessionId');
    this._running = true;
    this._loop();
  }

  stop() {
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  }

  async pollOnce() {
    try {
      const snapshot = await this._fetch(this.sessionId);
      const input = { t: this._now(), snapshot };
      if (this.logPath) {
        fs.appendFile(this.logPath, JSON.stringify(input) + '\n', (err) => {
          if (err) this.emit('error', new Error(`poll log write failed: ${err.message}`));
        });
      }
      this.emit('input', input);
    } catch (error) {
      this.emit('error', error);
    }
  }

  async _loop() {
    if (!this._running) return;
    await this.pollOnce();
    if (!this._running) return;
    this._timer = setTimeout(() => this._loop(), this.pollIntervalMs);
  }
}

/**
 * Replays recorded inputs on a shared clock. `clock.now()` returns the current
 * position in the same timeline as the entries' `t` (see step 7). Entries are
 * emitted in order once the clock reaches their `t`.
 */
export class RecordedEventSource extends EventEmitter {
  /**
   * @param {Object} options
   * @param {Array<{t:number,snapshot?:Object,signal?:Object}>} options.entries
   * @param {{now:()=>number}} [options.clock] - default: wall clock from start(), 1x
   * @param {number} [options.tickMs]
   */
  constructor({ entries = [], clock = null, tickMs = 250 } = {}) {
    super();
    this.entries = [...entries].sort((a, b) => a.t - b.t);
    this.clock = clock;
    this.tickMs = tickMs;
    this._cursor = 0;
    this._interval = null;
  }

  /** Load a JSONL file written by LiveVirtiusSource (one {t, snapshot|signal} per line). */
  static fromJsonl(filePath, options = {}) {
    const entries = fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    return new RecordedEventSource({ ...options, entries });
  }

  get done() {
    return this._cursor >= this.entries.length;
  }

  start() {
    if (this._interval) return;
    if (!this.clock) {
      const t0 = this.entries[0]?.t ?? 0;
      const started = Date.now();
      this.clock = { now: () => t0 + (Date.now() - started) };
    }
    this._interval = setInterval(() => this.tick(), this.tickMs);
    this.tick();
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  /** Emit every entry the clock has reached. Returns how many were emitted. */
  tick() {
    const now = this.clock.now();
    let n = 0;
    while (this._cursor < this.entries.length && this.entries[this._cursor].t <= now) {
      this.emit('input', this.entries[this._cursor++]);
      n++;
    }
    if (this.done) this.stop();
    return n;
  }

  /** Emit everything immediately, ignoring the clock (tests, fast-forward). */
  drain() {
    while (this._cursor < this.entries.length) {
      this.emit('input', this.entries[this._cursor++]);
    }
    this.stop();
  }
}
