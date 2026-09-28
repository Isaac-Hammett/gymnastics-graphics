/**
 * RecordedEventSource (ISA2-296)
 *
 * A competition-state source (see competitionState/sources.js) that replays a
 * recorded meet against a clock. It emits 'input' with { t, snapshot } or
 * { t, signal }, exactly the shapes LiveVirtiusSource emits, so the state
 * service and Xavier see the same inputs they would see live.
 *
 * Two kinds of recording:
 *  - events.jsonl ({ tVideoMs, type: greenLight|scorePosted|teamTotal, event,
 *    athlete, team, score }). Scores and totals are applied to a Virtius-shaped
 *    snapshot (lineups from virtius-final.json, scores blanked) and published
 *    on a poll grid (every pollIntervalMs of video time), the way Virtius polls
 *    would surface them. Every other type becomes a signal at its own time.
 *  - raw poll logs ({ t, snapshot|signal }, written by LiveVirtiusSource).
 *
 * All times on the emitted inputs are video time: entry time + offsetMs.
 *
 * seek(t) rebuilds state at t from the nearest checkpoint (a fold of the pure
 * reducer, no events emitted) and emits 'reset' with { t, state }; replay then
 * continues from the first entry after t.
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import { createInitialState, reduce } from '../competitionState/reducer.js';

export const DEFAULT_POLL_MS = 15000;
const CHECKPOINT_EVERY = 25;
const COUNTING_SCORES = 4;

const normalizeName = (name) => String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Virtius-shaped snapshot with the final export's lineups and every score and
 * total blanked. Only the fields the reducer reads are kept.
 */
export function buildSnapshotTemplate(virtiusFinal) {
  const meet = virtiusFinal?.meet || virtiusFinal || {};
  return {
    meet: {
      name: meet.name || null,
      meet_id: meet.meet_id || null,
      teams: (meet.teams || []).map(team => ({
        team_id: team.team_id ?? null,
        tricode: team.tricode,
        name: team.name,
        final_score: '',
        events: (team.events || []).map(ev => ({
          event_name: ev.event_name,
          rotation: ev.rotation ?? null,
          event_score: '',
          gymnasts: (ev.gymnasts || []).map(g => ({
            gymnast_id: g.gymnast_id,
            full_name: g.full_name,
            first_name: g.first_name,
            last_name: g.last_name,
            order: g.order,
            type: g.type,
            final_score: ''
          }))
        }))
      }))
    }
  };
}

const teamKey = (team) => team.tricode || team.name;

function findTeam(snapshot, key) {
  return snapshot.meet.teams.find(t => teamKey(t) === key || t.name === key) || null;
}

function findGymnast(team, eventName, athlete) {
  const ev = team.events.find(e => e.event_name === eventName);
  if (!ev) return null;
  const id = athlete && typeof athlete === 'object' ? athlete.id : null;
  const name = normalizeName(typeof athlete === 'object' ? athlete?.name : athlete);
  return ev.gymnasts.find(g =>
    (id != null && String(g.gymnast_id) === String(id)) || (name && normalizeName(g.full_name) === name)) || null;
}

const fmt = (n) => n.toFixed(3);

/** Running team total: sum over events of the top COUNTING_SCORES posted scores; exhibition (type 0) never counts. */
function runningTotal(team) {
  let total = 0;
  for (const ev of team.events) {
    const scores = ev.gymnasts.filter(g => g.type !== 0)
      .map(g => parseFloat(g.final_score)).filter(Number.isFinite).sort((a, b) => b - a);
    const eventTotal = scores.slice(0, COUNTING_SCORES).reduce((a, b) => a + b, 0);
    ev.event_score = scores.length ? fmt(eventTotal) : '';
    total += eventTotal;
  }
  return total;
}

/** Apply one scorePosted/teamTotal entry to a working snapshot. Returns true if it changed. */
function applyToSnapshot(snapshot, entry) {
  const team = findTeam(snapshot, entry.team);
  if (!team) return false;
  if (entry.type === 'scorePosted') {
    const g = findGymnast(team, entry.event, entry.athlete);
    if (!g) return false;
    const score = entry.score == null || entry.score === '' ? '' : fmt(Number(entry.score));
    if (g.final_score === score) return false;
    g.final_score = score;
    runningTotal(team);
    // Marked logs (ISA2-297) carry the running team total on the score line itself.
    if (entry.teamTotal != null && entry.teamTotal !== '') team.final_score = fmt(Number(entry.teamTotal));
    return true;
  }
  if (entry.type === 'teamTotal') {
    const total = entry.score == null || entry.score === '' ? '' : fmt(Number(entry.score));
    if (team.final_score === total) return false;
    team.final_score = total;
    return true;
  }
  return false;
}

/**
 * Turn an events.jsonl log into the input stream a live Virtius poller plus a
 * signal feed would have produced.
 * @returns {Array<{t:number, snapshot?:Object, signal?:Object}>} sorted by t
 */
export function logToInputs(log, { template, pollIntervalMs = DEFAULT_POLL_MS, offsetMs = 0, endMs = null } = {}) {
  if (!template) throw new Error('logToInputs needs a snapshot template (virtius-final.json)');
  const entries = log
    .filter(e => e && e.type && e.type !== 'meta' && Number.isFinite(Number(e.tVideoMs)))
    .map((e, i) => ({ ...e, t: Number(e.tVideoMs) + offsetMs, i }))
    .sort((a, b) => a.t - b.t || a.i - b.i);
  const scoreEntries = entries.filter(e => e.type === 'scorePosted' || e.type === 'teamTotal');

  const signals = entries
    .filter(e => e.type !== 'scorePosted' && e.type !== 'teamTotal')
    .map(e => {
      const { tVideoMs, t, i, ...signal } = e;
      return { t, signal: { source: 'recorded-log', ...signal } };
    });

  const firstT = entries.length ? entries[0].t : 0;
  const lastT = entries.length ? entries[entries.length - 1].t : 0;
  const start = Math.min(0, Math.floor(firstT / pollIntervalMs) * pollIntervalMs);
  const end = Math.max(endMs ?? 0, lastT + pollIntervalMs);

  const working = JSON.parse(JSON.stringify(template));
  let published = JSON.parse(JSON.stringify(working));
  let dirty = false;
  let k = 0;
  const polls = [];
  for (let pollT = start; pollT <= end; pollT += pollIntervalMs) {
    while (k < scoreEntries.length && scoreEntries[k].t <= pollT) {
      if (applyToSnapshot(working, scoreEntries[k])) dirty = true;
      k++;
    }
    if (dirty) {
      published = JSON.parse(JSON.stringify(working));
      dirty = false;
    }
    // Unchanged polls share the same (never mutated) snapshot object.
    polls.push({ t: pollT, snapshot: published });
  }

  // At equal times the poll lands first, so a green light after a score
  // confirms the athlete the score made "up".
  return [...polls.map((p, i) => ({ ...p, _o: 0, _i: i })), ...signals.map((s, i) => ({ ...s, _o: 1, _i: i }))]
    .sort((a, b) => a.t - b.t || a._o - b._o || a._i - b._i)
    .map(({ _o, _i, ...input }) => input);
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

const isEventLog = (rows) => rows.some(r => r && (r.tVideoMs != null || r.type === 'meta'));

export class RecordedEventSource extends EventEmitter {
  /**
   * @param {Object} options
   * @param {Array} [options.entries] - raw inputs { t, snapshot|signal }
   * @param {Array} [options.log] - events.jsonl rows; needs virtiusFinal or template
   * @param {Object} [options.virtiusFinal] - final Virtius export, for lineups
   * @param {Object} [options.template] - prebuilt snapshot template
   * @param {{now:()=>number}} [options.clock] - default: wall clock from start(), 1x
   * @param {number} [options.offsetMs] - added to every entry time to line it up with the video
   * @param {number} [options.pollIntervalMs] - poll grid for events.jsonl replay
   * @param {number} [options.endMs] - keep polling to here (video duration)
   * @param {number} [options.tickMs] - own tick interval; 0 = only when ticked externally
   * @param {Object} [options.reduceOptions] - passed to reduce() when rebuilding on seek
   */
  constructor({
    entries = [], log = null, virtiusFinal = null, template = null, clock = null,
    offsetMs = 0, pollIntervalMs = DEFAULT_POLL_MS, endMs = null, tickMs = 250, reduceOptions = {}
  } = {}) {
    super();
    this._raw = log ? null : entries;
    this._log = log;
    this._template = template || (virtiusFinal ? buildSnapshotTemplate(virtiusFinal) : null);
    this.pollIntervalMs = pollIntervalMs;
    this.endMs = endMs;
    this.clock = clock;
    this.tickMs = tickMs;
    this.reduceOptions = reduceOptions;
    this._cursor = 0;
    this._interval = null;
    this._build(offsetMs);
  }

  /** Load a JSONL file: either an events.jsonl log or a LiveVirtiusSource poll log. */
  static fromJsonl(filePath, options = {}) {
    const rows = readJsonl(filePath);
    return isEventLog(rows)
      ? new RecordedEventSource({ ...options, log: rows })
      : new RecordedEventSource({ ...options, entries: rows });
  }

  /** From a loaded recording package (recordingPackage.loadRecordingPackage). */
  static fromPackage(pkg, options = {}) {
    if (!pkg?.virtiusFinal) throw new Error(`Recording "${pkg?.name}" has no virtius-final.json`);
    return new RecordedEventSource({
      endMs: pkg.meta?.durationMs ?? null,
      ...options,
      log: pkg.events || [],
      virtiusFinal: pkg.virtiusFinal
    });
  }

  _build(offsetMs) {
    this.offsetMs = offsetMs;
    this.entries = this._log
      ? logToInputs(this._log, { template: this._template, pollIntervalMs: this.pollIntervalMs, offsetMs, endMs: this.endMs })
      : [...this._raw].map(e => ({ ...e, t: e.t + offsetMs })).sort((a, b) => a.t - b.t);
    this._checkpoints = null;
  }

  /** Swap in a new events.jsonl log (marking mode) and rebuild state at the clock's position. */
  setLog(log) {
    this._log = log;
    this._build(this.offsetMs);
    if (this.clock) this.seek(this.clock.now());
  }

  /** Change the log-to-video offset and rebuild state at the clock's position. */
  setOffset(offsetMs) {
    this._build(Number(offsetMs) || 0);
    if (this.clock) this.seek(this.clock.now());
  }

  get done() {
    return this._cursor >= this.entries.length;
  }

  get running() {
    return !!this._interval;
  }

  start() {
    if (this._interval) return;
    if (!this.clock) {
      const t0 = this.entries[0]?.t ?? 0;
      const started = Date.now();
      this.clock = { now: () => t0 + (Date.now() - started) };
    }
    if (this.tickMs > 0) {
      this._interval = setInterval(() => this.tick(), this.tickMs);
      this._interval.unref?.();
    }
    this.tick();
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  /** Emit every entry the clock has reached. Returns how many were emitted. */
  tick() {
    if (!this.clock) return 0;
    const now = this.clock.now();
    let n = 0;
    while (this._cursor < this.entries.length && this.entries[this._cursor].t <= now) {
      this.emit('input', this.entries[this._cursor++]);
      n++;
    }
    return n;
  }

  /** Emit everything immediately, ignoring the clock (tests, fast-forward). */
  drain() {
    while (this._cursor < this.entries.length) {
      this.emit('input', this.entries[this._cursor++]);
    }
    this.stop();
  }

  /** Index of the first entry with t > tMs (= how many entries a playthrough to tMs has applied). */
  indexAfter(tMs) {
    let lo = 0;
    let hi = this.entries.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.entries[mid].t <= tMs) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  _ensureCheckpoints() {
    if (this._checkpoints) return;
    const cps = [createInitialState()];
    let state = cps[0];
    for (let i = 0; i < this.entries.length; i++) {
      state = reduce(state, this.entries[i], this.reduceOptions).state;
      if ((i + 1) % CHECKPOINT_EVERY === 0) cps.push(state);
    }
    this._checkpoints = cps;
  }

  /** Reducer state after every entry up to tMs, from the nearest checkpoint. */
  stateAt(tMs) {
    this._ensureCheckpoints();
    const n = this.indexAfter(tMs);
    const c = Math.floor(n / CHECKPOINT_EVERY);
    let state = this._checkpoints[c];
    for (let i = c * CHECKPOINT_EVERY; i < n; i++) {
      state = reduce(state, this.entries[i], this.reduceOptions).state;
    }
    return state;
  }

  /** Jump to tMs: rebuild state there and continue replay after it. Emits 'reset'. */
  seek(tMs) {
    const state = this.stateAt(tMs);
    this._cursor = this.indexAfter(tMs);
    this.emit('reset', { t: tMs, state });
    return state;
  }
}
