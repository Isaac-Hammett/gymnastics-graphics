/**
 * Rebuild an events.jsonl for a recording from its final Virtius export (ISA2-296).
 *
 * The ECAC recording has no timestamped Virtius log, only the final results.
 * This spreads each rotation's routines evenly across that rotation's window
 * in the video and writes, per athlete in lineup order:
 *   greenLight   when the routine starts
 *   scorePosted  when the score lands
 *   teamTotal    the team's running total right after it
 * The first line is a { type: 'meta', synthetic: true } header.
 *
 * Timings inside a rotation are SYNTHETIC (even spacing), not read off the
 * video; only the rotation windows come from the measured layout timeline.
 * Replace the file with a measured log when one exists (ISA2-297).
 *
 * Rotation windows: the k-th stable '3x2' layout entry starts rotation k, and
 * the next 'leaderboard' entry after it ends the rotation (ECAC shows the
 * standings between rotations).
 *
 * CLI: node lib/recordings/rebuildEventLog.js [recording]   (writes recordings/<name>/events.jsonl)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadMeta, loadVirtiusFinal } from './recordingPackage.js';

const COUNTING_SCORES = 4; // top 4 count; exhibition (type 0) never counts
const START_PAD_MS = 20000;    // first routine starts this long after the rotation opens
const END_PAD_MS = 60000;      // last score lands this long before the standings
const GREEN_AFTER_SLOT_MS = 5000;
const SCORE_AT_SLOT_FRACTION = 0.85;

/** [{ rotation, fromMs, toMs }] from the layout timeline. */
export function rotationWindows(meta) {
  const timeline = meta?.layoutTimeline || [];
  const windows = [];
  timeline.forEach((entry, i) => {
    if (entry.layout !== '3x2') return;
    const end = timeline.slice(i + 1).find(e => e.layout === 'leaderboard');
    if (!end) return;
    // Two 3x2 blocks before the same leaderboard belong to one rotation.
    if (windows.length && windows[windows.length - 1].toMs === end.fromMs) return;
    windows.push({ rotation: windows.length + 1, fromMs: entry.fromMs, toMs: end.fromMs });
  });
  return windows;
}

const fmt = (n) => n.toFixed(3);

export function rebuildEventLog(meta, virtiusFinal, { recording = null } = {}) {
  const teams = virtiusFinal?.meet?.teams || [];
  const rotations = Math.max(0, ...teams.flatMap(t => t.events.map(e => e.rotation || 0)));
  const windows = rotationWindows(meta);
  if (windows.length < rotations) {
    throw new Error(`layout timeline has ${windows.length} rotation windows, results need ${rotations}`);
  }

  const rows = [];
  const counted = {}; // team -> event -> [scores]
  const runningTotal = (team) => Object.values(counted[team] || {})
    .reduce((sum, scores) => sum + [...scores].sort((a, b) => b - a).slice(0, COUNTING_SCORES).reduce((a, b) => a + b, 0), 0);

  for (const win of windows.slice(0, rotations)) {
    const start = win.fromMs + START_PAD_MS;
    const span = win.toMs - END_PAD_MS - start;
    const perTeamEvent = [];
    for (const team of teams) {
      for (const ev of team.events) {
        if (ev.rotation !== win.rotation || !ev.gymnasts?.length) continue;
        const lineup = [...ev.gymnasts].sort((a, b) => (a.order || 0) - (b.order || 0));
        const slot = span / lineup.length;
        lineup.forEach((g, k) => {
          const slotStart = Math.round(start + k * slot);
          const athlete = { id: String(g.gymnast_id), name: g.full_name };
          perTeamEvent.push({ tVideoMs: slotStart + GREEN_AFTER_SLOT_MS, type: 'greenLight', event: ev.event_name, team: team.tricode, athlete });
          if (g.final_score != null && g.final_score !== '') {
            perTeamEvent.push({
              tVideoMs: Math.round(start + (k + SCORE_AT_SLOT_FRACTION) * slot), type: 'scorePosted',
              event: ev.event_name, team: team.tricode, athlete, score: Number(g.final_score),
              _exhibition: g.type === 0
            });
          }
        });
      }
    }
    perTeamEvent.sort((a, b) => a.tVideoMs - b.tVideoMs || (a.type === 'scorePosted' ? -1 : 1));
    for (const { _exhibition, ...row } of perTeamEvent) {
      rows.push(row);
      if (row.type !== 'scorePosted' || _exhibition) continue;
      ((counted[row.team] ||= {})[row.event] ||= []).push(row.score);
      rows.push({ tVideoMs: row.tVideoMs, type: 'teamTotal', team: row.team, score: Number(fmt(runningTotal(row.team))) });
    }
  }

  const header = {
    type: 'meta', synthetic: true, recording,
    note: 'Rebuilt from virtius-final.json. Rotation windows come from meta.json layoutTimeline; ' +
      'routine times inside a rotation are evenly spaced, not measured. tVideoMs is ms into program.mp4.',
    rotations: windows.slice(0, rotations)
  };
  return [header, ...rows];
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const recording = process.argv[2] || 'ecac-2026';
  const rows = rebuildEventLog(loadMeta(recording), loadVirtiusFinal(recording), { recording });
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const out = path.join(__dirname, '../../../recordings', recording, 'events.jsonl');
  fs.writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(`wrote ${rows.length} rows to ${out}`);
}
