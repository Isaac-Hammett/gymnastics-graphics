/**
 * Gymnastics sport pack: reading the Virtius feed (ISA2-338).
 *
 * describe() turns competition config plus one Virtius snapshot into the
 * pack's Context: loci, rotation schedule, lineup size, and counting rule.
 * lineupsFromFeed() and replayEvents() read lineups and scores out of a
 * snapshot for units() and for replaying a finished meet.
 *
 * Facts relied on (design.md 7.2): lineup membership is Virtius `type: 1`,
 * `type: 0` is an individual who never counts; each event's `rotation` field
 * gives the schedule (teams with no event in a rotation are on a bye).
 */

import { CODE_DEFAULTS, OLYMPIC_ORDER, codeFromString, locusFromApiName, vocabulary } from './apparatus.js';
import { toMilli } from './score.js';

const DEFAULT_LADDER = [
  { outcomeType: 'team_title', weight: 1.0 },
  { outcomeType: 'team_place', weight: 0.6 },
  { outcomeType: 'aa_title', weight: 0.6 },
  { outcomeType: 'aa_place', weight: 0.3 },
  { outcomeType: 'event_title', weight: 0.4 },
  { outcomeType: 'team_high', weight: 0.3 }
];

function meetOf(feed) {
  return feed?.meet || feed || {};
}

/** Same key the state service (competitionState/reducer.js) uses for a team. */
export function teamKey(team, idx = 0) {
  return team.tricode || team.short_name || team.name || `team${idx + 1}`;
}

export function athleteActorId(gymnastId) {
  return `ath:${gymnastId}`;
}

function gymnastIdOf(g, tKey) {
  return g.gymnast_id != null && g.gymnast_id !== ''
    ? String(g.gymnast_id)
    : `${tKey}|${String(g.full_name || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

function hasScore(g) {
  return g.final_score != null && g.final_score !== '';
}

/**
 * Infer lineup size and counting rule from team-events whose lineup is fully
 * scored: the largest N for which the top N `type: 1` scores sum to
 * `event_score`. Returns null when the feed does not settle it.
 */
export function inferCounting(feed) {
  const checks = [];
  for (const team of meetOf(feed).teams || []) {
    for (const ev of team.events || []) {
      const gs = ev.gymnasts || [];
      if (!gs.length || gs.some(g => g.type == null)) continue;
      const lineup = gs.filter(g => Number(g.type) === 1);
      if (!lineup.length || !lineup.every(hasScore) || ev.event_score == null || ev.event_score === '') continue;
      const target = toMilli(ev.event_score);
      const sorted = lineup.map(g => toMilli(g.final_score)).sort((a, b) => b - a);
      let counting = null;
      for (let n = sorted.length; n >= 1; n--) {
        if (sorted.slice(0, n).reduce((s, v) => s + v, 0) === target) { counting = n; break; }
      }
      checks.push({ team: teamKey(team), event: ev.event_name, rotation: ev.rotation, lineupSize: lineup.length, counting });
    }
  }
  if (!checks.length || checks.some(c => c.counting == null)) return checks.length ? { consistent: false, checks } : null;
  const countings = new Set(checks.map(c => c.counting));
  if (countings.size !== 1) return { consistent: false, checks };
  const sizes = {};
  for (const c of checks) sizes[c.lineupSize] = (sizes[c.lineupSize] || 0) + 1;
  const lineupSize = Number(Object.entries(sizes).sort((a, b) => b[1] - a[1])[0][0]);
  return { consistent: true, lineupSize, countingScores: [...countings][0], checks };
}

/**
 * Rotation schedule: { [teamId]: { [rotation]: locus } }.
 * Read from each event's `rotation` field (required for five or more teams:
 * those schedules are never hard-coded). Without rotation fields and fewer
 * than five teams, every team works the Olympic order head-to-head.
 */
export function scheduleFromFeed(feed, code) {
  const teams = meetOf(feed).teams || [];
  const schedule = {};
  let hasRotationFields = false;
  teams.forEach((team, idx) => {
    const key = teamKey(team, idx);
    schedule[key] = {};
    for (const ev of team.events || []) {
      const locus = locusFromApiName(ev.event_name);
      if (!locus) continue;
      if (ev.rotation != null && ev.rotation !== '') {
        hasRotationFields = true;
        schedule[key][Number(ev.rotation)] = locus;
      }
    }
  });
  if (hasRotationFields) return { schedule, source: 'feed' };
  if (teams.length >= 5) return { schedule, source: 'unknown' };
  const order = OLYMPIC_ORDER[code];
  teams.forEach((team, idx) => {
    schedule[teamKey(team, idx)] = Object.fromEntries(order.map((l, i) => [i + 1, l]));
  });
  return { schedule, source: 'olympic_order' };
}

/**
 * describe(config, feedSample) -> Context (design.md 6.2) plus the pack's
 * `schedule`, `teams`, and `vocabulary`.
 *
 * config: { compId?, compType?, seasonPhase?, ladder?, format?: partial overrides }
 */
export function describe(config = {}, feedSample = null) {
  const meet = meetOf(feedSample);
  const code = codeFromString(config.compType) || codeFromString(config.code) || codeFromString(meet.sex) || 'men';
  const d = CODE_DEFAULTS[code];
  const { schedule, source: scheduleSource } = scheduleFromFeed(feedSample, code);

  const seen = new Set(Object.values(schedule).flatMap(r => Object.values(r)));
  const loci = seen.size ? OLYMPIC_ORDER[code].filter(l => seen.has(l)).concat([...seen].filter(l => !OLYMPIC_ORDER[code].includes(l))) : [...OLYMPIC_ORDER[code]];
  const rotationNums = Object.values(schedule).flatMap(r => Object.keys(r).map(Number));
  const rotations = rotationNums.length ? Math.max(...rotationNums) : loci.length;

  const counting = inferCounting(feedSample);
  const fromFeed = counting?.consistent;

  const format = {
    code,
    loci,
    rotations,
    lineupSize: fromFeed ? counting.lineupSize : d.lineupSize,
    countingScores: fromFeed ? counting.countingScores : d.countingScores,
    countingSource: fromFeed ? 'feed' : 'default',
    scoreScale: { ...d.scoreScale },
    capFallback: d.capFallback,
    floorFallback: d.floorFallback,
    capMargin: d.capMargin,
    fallPenalty: d.fallPenalty,
    sd: d.sd,
    scheduleSource,
    ...(config.format || {})
  };

  const teams = (meet.teams || []).map((t, idx) => ({
    id: teamKey(t, idx),
    name: t.name || teamKey(t, idx),
    tricode: t.tricode || null,
    virtiusId: t.team_id != null ? String(t.team_id) : null,
    home: Number(t.home_team) === 1,
    order: t.team_order ?? idx + 1
  }));

  const ladder = config.ladder || DEFAULT_LADDER;
  return {
    packId: 'gymnastics',
    compId: config.compId || (meet.meet_id != null ? String(meet.meet_id) : null),
    format,
    seasonPhase: config.seasonPhase || 'conference',
    outcomeRoots: [...new Set(ladder.map(l => l.outcomeType))],
    ladder,
    ladderSource: config.ladder ? 'brief' : 'default',
    providers: { priors: config.priors || [], live: config.live || 'virtius' },
    schedule,
    teams,
    counting: counting ? { consistent: counting.consistent, checked: counting.checks.length } : null,
    vocabulary
  };
}

/**
 * Lineups as the feed lists them:
 * [{ teamId, rotation, locus, athletes: [{ gymnastId, name, order, type }] }].
 */
export function lineupsFromFeed(feed) {
  const out = [];
  (meetOf(feed).teams || []).forEach((team, idx) => {
    const key = teamKey(team, idx);
    for (const ev of team.events || []) {
      const locus = locusFromApiName(ev.event_name);
      if (!locus) continue;
      out.push({
        teamId: key,
        rotation: ev.rotation != null ? Number(ev.rotation) : null,
        locus,
        athletes: (ev.gymnasts || []).map(g => ({
          gymnastId: gymnastIdOf(g, key),
          name: g.full_name || [g.first_name, g.last_name].filter(Boolean).join(' '),
          order: g.order ?? null,
          type: g.type == null ? null : Number(g.type)
        }))
      });
    }
  });
  return out;
}

/**
 * A finished (or partial) snapshot as synthetic typed events, in the shape the
 * state service emits: rotation by rotation, then running order, then team
 * order. A `rotationChanged` precedes each rotation; `meetFinal` ends a
 * complete meet. `t` is a sequence number.
 */
export function replayEvents(feed) {
  const teams = (meetOf(feed).teams || []).map((team, idx) => ({ team, key: teamKey(team, idx), idx }))
    .sort((a, b) => (a.team.team_order ?? a.idx) - (b.team.team_order ?? b.idx));
  const rotations = [...new Set(teams.flatMap(({ team }) => (team.events || []).map(e => Number(e.rotation))))]
    .filter(Number.isFinite).sort((a, b) => a - b);
  const events = [];
  let t = 0;
  let allScored = true;
  for (const r of rotations) {
    events.push({ type: 'rotationChanged', t: t++, rotation: r, confidence: 0.9, evidence: [] });
    const evs = teams.map(({ team, key }) => ({ key, ev: (team.events || []).find(e => Number(e.rotation) === r) }))
      .filter(x => x.ev);
    const maxOrder = Math.max(0, ...evs.flatMap(x => (x.ev.gymnasts || []).map(g => g.order || 0)));
    for (let o = 1; o <= maxOrder; o++) {
      for (const { key, ev } of evs) {
        for (const g of (ev.gymnasts || []).filter(g => (g.order || 0) === o)) {
          if (!hasScore(g)) { allScored = false; continue; }
          events.push({
            type: 'scorePosted',
            t: t++,
            event: ev.event_name,
            eventCode: locusFromApiName(ev.event_name),
            rotation: r,
            team: key,
            athlete: { id: gymnastIdOf(g, key), name: g.full_name, order: g.order },
            score: g.final_score,
            confidence: 0.95,
            evidence: [{ kind: 'replay', value: g.final_score }]
          });
        }
      }
    }
  }
  if (rotations.length && allScored) events.push({ type: 'meetFinal', t: t++, confidence: 0.95, evidence: [] });
  return events;
}
