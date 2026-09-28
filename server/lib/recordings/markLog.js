/**
 * Marking mode for recorded-source shows (ISA2-297)
 *
 * Builds recordings/<name>/events.jsonl by hand while the video plays. The final
 * Virtius export gives the expected athlete order per apparatus; one mark says
 * "the next expected athlete on this event just got the green light" (greenLight)
 * or "just had a score posted" (scorePosted). The score and the running team
 * total come from the JSON, so the producer only supplies the time.
 *
 * Every line a mark writes carries { markId }, so a mark can be undone by
 * removing its lines and marking state survives a coordinator restart. Rows
 * without a markId (the synthetic rebuild) never count as marks.
 */

import fs from 'fs';
import path from 'path';
import { loadVirtiusFinal, loadEvents, recordingDir } from './recordingPackage.js';

const COUNTING_SCORES = 4;
const KINDS = ['greenLight', 'scorePosted'];

const eventsPath = (name) => path.join(recordingDir(name), 'events.jsonl');
const round3 = (n) => Number(n.toFixed(3));

/** { EVENT: [{ team, rotation, order, athlete:{id,name}, score, exhibition }] } in meet order. */
export function expectedOrder(virtiusFinal) {
  const byEvent = {};
  for (const team of virtiusFinal?.meet?.teams || []) {
    for (const ev of team.events || []) {
      for (const g of ev.gymnasts || []) {
        (byEvent[ev.event_name] ||= []).push({
          team: team.tricode,
          rotation: ev.rotation || 0,
          order: g.order || 0,
          athlete: { id: String(g.gymnast_id), name: g.full_name },
          score: g.final_score != null && g.final_score !== '' ? Number(g.final_score) : null,
          exhibition: g.type === 0
        });
      }
    }
  }
  for (const list of Object.values(byEvent)) {
    list.sort((a, b) => a.rotation - b.rotation || a.order - b.order);
  }
  return byEvent;
}

const isMark = (row) => row && row.markId && KINDS.includes(row.type);

/** Mark counts per event, from the rows already in the log. */
function markCounts(rows) {
  const counts = {};
  for (const row of rows.filter(isMark)) {
    const c = (counts[row.event] ||= { greenLight: 0, scorePosted: 0 });
    c[row.type] += 1;
  }
  return counts;
}

/** Running team total from the scores marked so far (top 4 per event, no exhibitions). */
function teamTotalAfter(order, rows, team, event, extra) {
  const scored = {};
  const add = (ev, entry) => {
    if (entry.team !== team || entry.exhibition || entry.score == null) return;
    (scored[ev] ||= []).push(entry.score);
  };
  const seen = {};
  for (const row of rows.filter(r => isMark(r) && r.type === 'scorePosted')) {
    const idx = (seen[row.event] = (seen[row.event] ?? -1) + 1);
    add(row.event, order[row.event]?.[idx] || {});
  }
  if (extra) add(event, extra);
  return round3(Object.values(scored).reduce((sum, scores) =>
    sum + scores.sort((a, b) => b - a).slice(0, COUNTING_SCORES).reduce((a, b) => a + b, 0), 0));
}

/** Expected next athlete per event, mark totals and whether the file is the synthetic rebuild. */
export function getMarkState(name) {
  const order = expectedOrder(loadVirtiusFinal(name));
  const rows = loadEvents(name);
  const counts = markCounts(rows);
  const events = Object.keys(order).map(event => {
    const c = counts[event] || { greenLight: 0, scorePosted: 0 };
    const list = order[event];
    return {
      event,
      total: list.length,
      greenLights: c.greenLight,
      scores: c.scorePosted,
      nextGreen: list[c.greenLight] || null,
      nextScore: list[c.scorePosted] || null
    };
  });
  const markIds = [...new Set(rows.filter(isMark).map(r => r.markId))];
  return {
    recording: name,
    synthetic: rows.some(r => r.type === 'meta' && r.synthetic === true),
    marks: markIds.length,
    events
  };
}

const writeRows = (name, rows) =>
  fs.writeFileSync(eventsPath(name), rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));

/**
 * Mark the next expected athlete on an event.
 * @param {string} name - recording
 * @param {{kind:'greenLight'|'scorePosted', event:string, tVideoMs:number}} mark
 * @returns {{markId:string, lines:Object[]}}
 */
export function appendMark(name, { kind, event, tVideoMs }) {
  if (!KINDS.includes(kind)) throw new Error(`kind must be one of ${KINDS.join(', ')}`);
  if (!Number.isFinite(Number(tVideoMs))) throw new Error('tVideoMs required');
  const order = expectedOrder(loadVirtiusFinal(name));
  const list = order[event];
  if (!list) throw new Error(`Unknown event "${event}"`);
  const rows = loadEvents(name);
  const idx = (markCounts(rows)[event] || {})[kind] || 0;
  const next = list[idx];
  if (!next) throw new Error(`No athlete left to mark on ${event}`);
  if (kind === 'scorePosted' && next.score == null) throw new Error(`${next.athlete.name} has no score in the Virtius export`);

  const markId = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const line = { tVideoMs: Math.round(Number(tVideoMs)), type: kind, event, team: next.team, athlete: next.athlete, markId };
  if (kind === 'scorePosted') {
    line.score = next.score;
    line.teamTotal = teamTotalAfter(order, rows, next.team, event, next);
  }
  fs.appendFileSync(eventsPath(name), JSON.stringify(line) + '\n');
  return { markId, lines: [line] };
}

/** Remove the most recent mark (by file order). Returns the removed lines. */
export function undoLastMark(name) {
  const rows = loadEvents(name);
  const last = [...rows].reverse().find(isMark);
  if (!last) throw new Error('Nothing to undo');
  writeRows(name, rows.filter(r => r.markId !== last.markId));
  return { markId: last.markId, lines: rows.filter(r => r.markId === last.markId) };
}

/**
 * Replace the synthetic rebuild with an empty measured log (header only). The
 * synthetic file is kept as events.synthetic.jsonl.
 */
export function startMeasuredLog(name) {
  const rows = loadEvents(name);
  if (rows.length && !rows.some(r => r.type === 'meta' && r.synthetic === true)) {
    throw new Error('events.jsonl is already a measured log');
  }
  if (rows.length) fs.copyFileSync(eventsPath(name), path.join(recordingDir(name), 'events.synthetic.jsonl'));
  writeRows(name, [{
    type: 'meta', synthetic: false, recording: name,
    note: 'Measured by hand in marking mode (ISA2-297). tVideoMs is ms into the video.'
  }]);
}
