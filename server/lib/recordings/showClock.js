/**
 * ShowClock (ISA2-296)
 *
 * One per competition in recorded-source mode. The clock's position is video
 * time: milliseconds into the recording's program.mp4. Play, pause, seek and
 * rate drive, together:
 *  - the OBS media cursor of `Recorded Program` (ISA2-295), at position + mediaOffsetMs
 *  - every attached source (RecordedEventSource), which reads clock.now() on
 *    tick and rebuilds its state on seek
 *  - applyLayout(obs, pkg, tMs) whenever the position crosses a layout switch
 *
 * The video is the master while playing: tick() reads the OBS cursor and
 * re-anchors the clock when they drift apart by more than driftToleranceMs.
 * OBS's ffmpeg source only seeks to keyframes (ECAC's are ~6 s apart), so a
 * seek plays forward from the keyframe to the target with the clock held.
 * Every OBS call has a timeout; OBS failures are recorded in status().lastError
 * and never stop the clock.
 */

import { EventEmitter } from 'events';
import { layoutEntryAt } from './recordingPackage.js';

export const RECORDED_MEDIA_INPUT = 'Recorded Program';
const MEDIA = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_';
const NOT_LOADED = new Set(['OBS_MEDIA_STATE_NONE', 'OBS_MEDIA_STATE_STOPPED', 'OBS_MEDIA_STATE_ENDED', 'OBS_MEDIA_STATE_ERROR']);
export const MIN_RATE = 0.1;
export const MAX_RATE = 2; // OBS ffmpeg source speed_percent tops out at 200
const SEEK_TOLERANCE_MS = 250;
const defaultSleep = (ms) => new Promise(r => setTimeout(r, ms));

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms); })
  ]).finally(() => clearTimeout(timer));
}

export class ShowClock extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} [options.compId]
   * @param {Object} [options.pkg] - loaded recording package (meta for layouts and duration)
   * @param {Function} [options.getObs] - () => obs client with call(), or null when not connected
   * @param {Function} [options.applyLayout] - (obs, pkg, tMs) => Promise
   * @param {number} [options.mediaOffsetMs] - OBS cursor = position + mediaOffsetMs
   * @param {string} [options.mediaInputName]
   * @param {Function} [options.now] - wall clock, ms
   * @param {number} [options.tickMs] - 0 = no timer (tests tick by hand)
   * @param {number} [options.syncEveryMs] - how often tick() reads the OBS cursor while playing
   * @param {Function} [options.sleep] - (ms) => Promise, for the seek catch-up poll
   */
  constructor({
    compId = null, pkg = null, getObs = () => null, applyLayout = null,
    mediaOffsetMs = 0, mediaInputName = RECORDED_MEDIA_INPUT, now = Date.now,
    durationMs = pkg?.meta?.durationMs ?? Infinity,
    tickMs = 250, syncEveryMs = 2000, driftToleranceMs = 750, obsTimeoutMs = 4000, sleep = defaultSleep
  } = {}) {
    super();
    this.compId = compId;
    this.pkg = pkg;
    this.getObs = getObs;
    this.applyLayoutFn = applyLayout;
    this.mediaOffsetMs = mediaOffsetMs;
    this.mediaInputName = mediaInputName;
    this.durationMs = durationMs;
    this.tickMs = tickMs;
    this.syncEveryMs = syncEveryMs;
    this.driftToleranceMs = driftToleranceMs;
    this.obsTimeoutMs = obsTimeoutMs;
    this._now = now;
    this._sleep = sleep;

    this.playing = false;
    this.rate = 1;
    this._anchorPos = 0;
    this._anchorWall = now();
    this.sources = [];
    this._timer = null;
    this._lastSyncWall = 0;
    this._layoutFrom = undefined;
    this._layoutBusy = null;
    this.layout = null;
    this.obsCursorMs = null;
    this.driftMs = null;
    this.lastError = null;
  }

  /** Position in video ms. */
  now() {
    const elapsed = this.playing ? (this._now() - this._anchorWall) * this.rate : 0;
    return Math.max(0, Math.min(this.durationMs, this._anchorPos + elapsed));
  }

  _reanchor(pos = this.now()) {
    this._anchorPos = Math.max(0, Math.min(this.durationMs, pos));
    this._anchorWall = this._now();
  }

  /** Attach a source; it reads this clock and is rebuilt on every seek. */
  addSource(source) {
    source.clock = this;
    this.sources.push(source);
    return source;
  }

  status() {
    return {
      compId: this.compId,
      recording: this.pkg?.name ?? null,
      positionMs: Math.round(this.now()),
      durationMs: Number.isFinite(this.durationMs) ? this.durationMs : null,
      playing: this.playing,
      rate: this.rate,
      layout: this.layout,
      mediaOffsetMs: this.mediaOffsetMs,
      sourceOffsetsMs: this.sources.map(s => s.offsetMs ?? 0),
      obsConnected: !!this.getObs(),
      obsCursorMs: this.obsCursorMs,
      driftMs: this.driftMs,
      lastError: this.lastError
    };
  }

  _emitStatus() {
    this.emit('status', this.status());
  }

  async _obs(requestType, data) {
    const obs = this.getObs();
    if (!obs) return null;
    try {
      return await withTimeout(obs.call(requestType, data), this.obsTimeoutMs, requestType);
    } catch (error) {
      this.lastError = { message: `${requestType}: ${error.message}`, at: this._now() };
      return null;
    }
  }

  _media(action) {
    return this._obs('TriggerMediaInputAction', { inputName: this.mediaInputName, mediaAction: MEDIA + action });
  }

  /**
   * Put the OBS cursor at the clock's position, then match play/pause. OBS
   * lands on the keyframe before the target, so play forward until the cursor
   * reaches it. The clock holds still meanwhile and resumes from where the
   * video actually is.
   */
  async _syncObsToClock() {
    if (!this.getObs()) return;
    const resume = this.playing;
    this._reanchor();
    this.playing = false;
    const target = Math.round(this._anchorPos + this.mediaOffsetMs);

    const before = await this._obs('GetMediaInputStatus', { inputName: this.mediaInputName });
    if (before && NOT_LOADED.has(before.mediaState)) await this._media('RESTART');
    await this._obs('SetMediaInputCursor', { inputName: this.mediaInputName, mediaCursor: target });
    let s = await this.readObsCursor();
    if (s && target - s.mediaCursor > SEEK_TOLERANCE_MS) {
      await this._media('PLAY');
      const deadline = this._now() + (target - s.mediaCursor) / this.rate + 3000;
      while (s && s.mediaCursor < target - 50 && this._now() < deadline) {
        await this._sleep(50);
        s = await this.readObsCursor();
      }
      if (!s || target - s.mediaCursor > SEEK_TOLERANCE_MS) {
        this.lastError = { message: `seek catch-up stopped short of ${target} ms (cursor ${s?.mediaCursor ?? 'unknown'})`, at: this._now() };
      }
    }

    if (resume) {
      await this._media('PLAY');
      const videoPos = s ? s.mediaCursor - this.mediaOffsetMs : this._anchorPos;
      this._reanchor(Math.max(this._anchorPos, videoPos));
      this.playing = true;
    } else {
      await this._media('PAUSE');
      this._reanchor(this._anchorPos);
    }
    await this.readObsCursor();
  }

  /** Read the OBS cursor and record the drift from the clock. */
  async readObsCursor() {
    const status = await this._obs('GetMediaInputStatus', { inputName: this.mediaInputName });
    if (!status || status.mediaCursor == null) return null;
    this.obsCursorMs = status.mediaCursor;
    this.driftMs = Math.round(status.mediaCursor - this.mediaOffsetMs - this.now());
    return status;
  }

  _startTimer() {
    if (this._timer || !(this.tickMs > 0)) return;
    this._timer = setInterval(() => { this.tick().catch(() => {}); }, this.tickMs);
    this._timer.unref?.();
  }

  _stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  _tickSources() {
    for (const s of this.sources) s.tick?.();
  }

  async play() {
    if (this.now() >= this.durationMs) return this.status();
    this._reanchor();
    const s = await this.readObsCursor();
    this.playing = true;
    if (s && !NOT_LOADED.has(s.mediaState) && Math.abs(this.driftMs) <= this.driftToleranceMs) {
      await this._media('PLAY');
      this._reanchor(this._anchorPos);
    } else {
      await this._syncObsToClock();
    }
    this._startTimer();
    this._lastSyncWall = this._now();
    this._emitStatus();
    return this.status();
  }

  async pause() {
    this._reanchor();
    this.playing = false;
    this._stopTimer();
    this._tickSources();
    await this._media('PAUSE');
    const s = await this.readObsCursor();
    if (s && Math.abs(this.driftMs) > this.driftToleranceMs) await this._syncObsToClock();
    await this.checkLayout();
    this._emitStatus();
    return this.status();
  }

  async seek(tMs) {
    const t = Math.max(0, Math.min(this.durationMs, Number(tMs) || 0));
    this._reanchor(t);
    for (const s of this.sources) s.seek?.(t);
    await this._syncObsToClock();
    this._lastSyncWall = this._now();
    await this.checkLayout();
    this._emitStatus();
    return this.status();
  }

  async setRate(rate) {
    const r = Number(rate);
    if (!Number.isFinite(r) || r < MIN_RATE || r > MAX_RATE) {
      throw new Error(`rate must be between ${MIN_RATE} and ${MAX_RATE}`);
    }
    this._reanchor();
    this.rate = r;
    // Changing ffmpeg source settings can reopen the media, so re-seek after.
    await this._obs('SetInputSettings', { inputName: this.mediaInputName, inputSettings: { speed_percent: Math.round(r * 100) } });
    await this._syncObsToClock();
    this._lastSyncWall = this._now();
    this._emitStatus();
    return this.status();
  }

  /** Change the video offset (OBS cursor = position + offset) and re-seek OBS. */
  async setMediaOffset(offsetMs) {
    this.mediaOffsetMs = Number(offsetMs) || 0;
    await this._syncObsToClock();
    this._emitStatus();
    return this.status();
  }

  /**
   * While playing: follow the video when it drifts, feed the sources, switch
   * layouts, stop at the end.
   */
  async tick() {
    if (this.playing && this._now() - this._lastSyncWall >= this.syncEveryMs) {
      this._lastSyncWall = this._now();
      const status = await this.readObsCursor();
      if (status && status.mediaState === 'OBS_MEDIA_STATE_PLAYING' && Math.abs(this.driftMs) > this.driftToleranceMs) {
        this._reanchor(status.mediaCursor - this.mediaOffsetMs);
        this.driftMs = 0;
      }
      this._emitStatus();
    }
    this._tickSources();
    await this.checkLayout();
    if (this.playing && this.now() >= this.durationMs) await this.pause();
  }

  /** Call applyLayout when the position is in a different layout entry than last applied. */
  async checkLayout() {
    if (!this.pkg?.meta) return;
    const entry = layoutEntryAt(this.pkg.meta, this.now());
    const from = entry?.fromMs ?? null;
    if (from === this._layoutFrom) return;
    if (this._layoutBusy) return this._layoutBusy;
    this._layoutFrom = from;
    this.layout = entry ? { layout: entry.layout, fromMs: entry.fromMs } : null;
    const obs = this.getObs();
    if (!obs || !this.applyLayoutFn) return;
    const t = this.now();
    this._layoutBusy = withTimeout(Promise.resolve(this.applyLayoutFn(obs, this.pkg, t)), this.obsTimeoutMs * 3, 'applyLayout')
      .then(result => { this.emit('layout', { t, ...result }); })
      .catch(error => {
        // Not retried until the next layout switch or seek, so a missing scene can't flood OBS.
        this.lastError = { message: `applyLayout: ${error.message}`, at: this._now() };
      })
      .finally(() => { this._layoutBusy = null; });
    return this._layoutBusy;
  }

  dispose() {
    this._stopTimer();
    this.playing = false;
    for (const s of this.sources) s.stop?.();
    this.sources = [];
    this.removeAllListeners();
  }
}
