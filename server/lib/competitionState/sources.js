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

// The recorded replay source lives with the other recorded-source pieces
// (ISA2-296); re-exported here so both import paths work.
export { RecordedEventSource } from '../recordings/recordedEventSource.js';
