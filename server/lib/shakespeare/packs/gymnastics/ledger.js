/**
 * Gymnastics sport pack: units, ledger state, and the counting rule (ISA2-338).
 *
 * State is a plain object, never mutated in place:
 *   { version, context, units: { [unitId]: Unit }, unitOrder: string[],
 *     actors: { [actorId]: Actor }, rotation, final, feedTotals }
 * Unit scores are points on the outside; every sum is done in thousandths.
 */

import { locusFromApiName } from './apparatus.js';
import { athleteActorId } from './feed.js';
import { fromMilli, toMilli, topSum } from './score.js';

export function unitId(rotation, locus, teamId, order) {
  return `u:${rotation}:${locus}:${teamId}:${order}`;
}

function roleOf(type) {
  if (type === 1) return 'lineup';
  if (type === 0) return 'individual';
  return 'unknown';
}

/**
 * units(context, lineups) -> Unit[] for every scheduled team-rotation.
 * Where the lineup is unknown, `lineupSize` slot units with no actor stand in.
 */
export function units(context, lineups = []) {
  const out = [];
  const { lineupSize } = context.format;
  for (const [teamId, rotations] of Object.entries(context.schedule || {})) {
    for (const [r, locus] of Object.entries(rotations)) {
      const rotation = Number(r);
      const lineup = lineups.find(l => l.teamId === teamId && l.locus === locus && (l.rotation == null || l.rotation === rotation));
      if (lineup && lineup.athletes.length) {
        const used = new Set();
        lineup.athletes.forEach((a, i) => {
          let order = a.order ?? i + 1;
          while (used.has(order)) order += 100;
          used.add(order);
          out.push(makeUnit({ rotation, locus, teamId, order, actorId: athleteActorId(a.gymnastId), lineupRole: roleOf(a.type), confidence: 0.9, source: 'feed' }));
        });
      } else {
        for (let order = 1; order <= lineupSize; order++) {
          out.push(makeUnit({ rotation, locus, teamId, order, actorId: null, lineupRole: 'lineup', confidence: 0.4, source: 'slot' }));
        }
      }
    }
  }
  return out;
}

function makeUnit({ rotation, locus, teamId, order, actorId, lineupRole, confidence, source }) {
  return {
    id: unitId(rotation, locus, teamId, order),
    rotation, locus, teamId, actorId, order, lineupRole,
    status: 'scheduled',
    window: { source },
    confidence,
    evidence: [],
    polarityHints: []
  };
}

/** Actors from the context's teams and the lineups' athletes. */
export function actorsFrom(context, lineups = [], priors = {}) {
  const actors = {};
  for (const t of context.teams || []) {
    actors[t.id] = { id: t.id, kind: 'team', displayName: t.name, priors: priors[t.id] || {}, flags: t.home ? ['home'] : [], provenance: {} };
  }
  for (const l of lineups) {
    for (const a of l.athletes) {
      const id = athleteActorId(a.gymnastId);
      if (actors[id]) continue;
      actors[id] = {
        id, kind: 'athlete', teamId: l.teamId, displayName: a.name,
        nameKey: String(a.name || '').toLowerCase().replace(/\s+/g, ' ').trim(),
        priors: priors[id] || {}, flags: [], provenance: {}
      };
    }
  }
  return actors;
}

export function createState(context, { lineups = [], priors = {} } = {}) {
  const list = units(context, lineups);
  return {
    version: 0,
    context,
    units: Object.fromEntries(list.map(u => [u.id, u])),
    unitOrder: list.map(u => u.id),
    actors: actorsFrom(context, lineups, priors),
    rotation: null,
    final: false,
    feedTotals: {}
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function unitList(state) {
  return state.unitOrder.map(id => state.units[id]);
}

export function isScored(u) {
  return u.result != null && u.result.score != null && u.status !== 'scratched';
}

/** Lineup units count toward the team; individuals never do (design 7.2). */
export function isLineup(u) {
  return u.lineupRole === 'lineup';
}

export function teamEventUnits(state, teamId, rotation) {
  return unitList(state).filter(u => u.teamId === teamId && u.rotation === rotation);
}

/**
 * Team-event total in thousandths: the top `countingScores` of the lineup
 * values. `valueOf(unit)` returns thousandths or null (excluded); by default
 * the posted score.
 */
export function teamEventMilli(state, teamId, rotation, valueOf = scoredMilli) {
  const vals = teamEventUnits(state, teamId, rotation).filter(isLineup).map(valueOf).filter(v => v != null);
  return topSum(vals, state.context.format.countingScores);
}

export function scoredMilli(u) {
  return isScored(u) ? toMilli(u.result.score) : null;
}

export function teamIds(state) {
  return Object.keys(state.context.schedule || {});
}

export function teamRotations(state, teamId) {
  return Object.keys(state.context.schedule[teamId] || {}).map(Number).sort((a, b) => a - b);
}

export function teamMilli(state, teamId, valueOf = scoredMilli) {
  return teamRotations(state, teamId).reduce((s, r) => s + teamEventMilli(state, teamId, r, valueOf), 0);
}

function rank(rows) {
  rows.sort((a, b) => b.milli - a.milli);
  let last = null;
  let place = 0;
  rows.forEach((row, i) => {
    if (row.milli !== last) { place = i + 1; last = row.milli; }
    row.rank = place;
  });
  return rows;
}

/** Team standings as of the state: [{ teamId, total, rank }]. */
export function standings(state) {
  return rank(teamIds(state).map(teamId => ({ teamId, milli: teamMilli(state, teamId) })))
    .map(r => ({ teamId: r.teamId, total: fromMilli(r.milli), rank: r.rank }));
}

/** Every team-event score: [{ teamId, rotation, locus, score, complete }]. */
export function teamEventScores(state) {
  const out = [];
  for (const teamId of teamIds(state)) {
    for (const r of teamRotations(state, teamId)) {
      const lineup = teamEventUnits(state, teamId, r).filter(isLineup);
      out.push({
        teamId, rotation: r, locus: state.context.schedule[teamId][r],
        score: fromMilli(teamEventMilli(state, teamId, r)),
        complete: lineup.length > 0 && lineup.every(isScored)
      });
    }
  }
  return out;
}

/** Actor ids with a unit on every locus: the all-around field (design 7.2). */
export function allAroundCandidates(state) {
  const loci = state.context.format.loci;
  const byActor = {};
  for (const u of unitList(state)) {
    if (!u.actorId) continue;
    (byActor[u.actorId] ||= new Set()).add(u.locus);
  }
  return Object.entries(byActor).filter(([, set]) => loci.every(l => set.has(l))).map(([id]) => id);
}

/** Units of one athlete, one per locus (the first when an athlete repeats a locus). */
export function actorUnits(state, actorId) {
  const seen = new Set();
  return unitList(state).filter(u => {
    if (u.actorId !== actorId || seen.has(u.locus)) return false;
    seen.add(u.locus);
    return true;
  });
}

export function actorMilli(state, actorId, valueOf = scoredMilli) {
  return actorUnits(state, actorId).reduce((s, u) => s + (valueOf(u) ?? 0), 0);
}

/** All-around standings among athletes entered on every locus. */
export function allAroundStandings(state) {
  return rank(allAroundCandidates(state).map(actorId => ({ actorId, milli: actorMilli(state, actorId) })))
    .map(r => ({ actorId: r.actorId, total: fromMilli(r.milli), rank: r.rank }));
}

/** Event standings on one locus, lineup and individual alike. */
export function eventStandings(state, locus) {
  return rank(unitList(state).filter(u => u.locus === locus && u.actorId && isScored(u))
    .map(u => ({ actorId: u.actorId, unitId: u.id, milli: toMilli(u.result.score) })))
    .map(r => ({ actorId: r.actorId, unitId: r.unitId, score: fromMilli(r.milli), rank: r.rank }));
}

/** Highest posted score on a locus so far, in thousandths (null before any). */
export function meetHighMilli(state, locus) {
  const vals = unitList(state).filter(u => u.locus === locus && isScored(u)).map(scoredMilli);
  return vals.length ? Math.max(...vals) : null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function findUnit(state, event) {
  const locus = locusFromApiName(event.eventCode) || locusFromApiName(event.event);
  const teamId = event.team;
  if (!locus || !teamId) return { locus, teamId, unit: null };
  const actorId = event.athlete?.id != null ? athleteActorId(event.athlete.id) : null;
  const candidates = unitList(state).filter(u => u.teamId === teamId && u.locus === locus
    && (event.rotation == null || u.rotation === Number(event.rotation)));
  let unit = actorId ? candidates.find(u => u.actorId === actorId) : null;
  if (!unit && actorId) {
    const order = event.athlete?.order;
    unit = candidates.find(u => !u.actorId && u.order === order) || null;
  }
  return { locus, teamId, actorId, unit };
}

function rotationFor(state, teamId, locus) {
  const entry = Object.entries(state.context.schedule[teamId] || {}).find(([, l]) => l === locus);
  return entry ? Number(entry[0]) : null;
}

/** Re-mark which lineup scores count in one team-event (top N; ties broken by order). */
function markCounting(units, state, teamId, rotation) {
  const n = state.context.format.countingScores;
  const lineup = Object.values(units).filter(u => u.teamId === teamId && u.rotation === rotation && isLineup(u) && isScored(u))
    .sort((a, b) => toMilli(b.result.score) - toMilli(a.result.score) || a.order - b.order);
  const counted = new Set(lineup.slice(0, n).map(u => u.id));
  for (const u of Object.values(units)) {
    if (u.teamId !== teamId || u.rotation !== rotation || !isScored(u)) continue;
    const counts = counted.has(u.id);
    if (u.result.counts !== counts) units[u.id] = { ...u, result: { ...u.result, counts } };
  }
}

function touchedOutcomes(state, unit) {
  const ids = ['o:team_title'];
  const n = teamIds(state).length;
  for (let k = 2; k <= n; k++) ids.push(`o:team_place:${k}`);
  ids.push(`o:team_high:${unit.teamId}`);
  if (unit.actorId) {
    ids.push(`o:event_title:${unit.locus}`);
    if (allAroundCandidates(state).includes(unit.actorId)) {
      ids.push('o:aa_title');
      for (let k = 2; k <= 3; k++) ids.push(`o:aa_place:${k}`);
    }
  }
  return ids;
}

/**
 * applyEvent(state, event) -> { state, touched: { units, outcomes }, event }
 * Accepts the state service's typed events (competitionState/reducer.js):
 * scorePosted, scoreCorrected, athleteUp, greenLight, routineEnded,
 * rotationChanged, teamTotalChanged, plus meetFinal. The returned event
 * carries the resolved `unitId` for settlers.
 */
export function applyEvent(state, event) {
  const next = { ...state, version: state.version + 1 };
  const touched = { units: [], outcomes: [] };
  const type = event?.type;

  if (type === 'scorePosted' || type === 'scoreCorrected' || type === 'athleteUp' || type === 'greenLight') {
    let { unit, locus, teamId, actorId } = findUnit(state, event);
    const unitsCopy = { ...state.units };
    let unitOrder = state.unitOrder;
    if (!unit && locus && teamId && (type === 'scorePosted' || type === 'scoreCorrected')) {
      // Not on the listed lineup: an individual (or a lineup the feed never listed).
      const rotation = event.rotation != null ? Number(event.rotation) : rotationFor(state, teamId, locus);
      if (rotation == null) return { state, touched, event };
      let order = event.athlete?.order ?? 99;
      while (unitsCopy[unitId(rotation, locus, teamId, order)]) order += 100;
      unit = makeUnit({ rotation, locus, teamId, order, actorId, lineupRole: 'unknown', confidence: 0.6, source: 'event' });
      unitOrder = [...unitOrder, unit.id];
    }
    if (!unit) return { state: next, touched, event };
    if (!unit.actorId && actorId) unit = { ...unit, actorId };

    if (type === 'athleteUp' || type === 'greenLight') {
      if (unit.status === 'scheduled' || unit.status === 'up') {
        unit = { ...unit, status: type === 'greenLight' ? 'in_progress' : 'up', evidence: [...unit.evidence, event.t] };
      }
    } else if (type === 'scoreCorrected' && event.removed) {
      unit = { ...unit, status: 'scheduled', result: undefined, evidence: [...unit.evidence, event.t] };
    } else {
      const score = fromMilli(toMilli(event.score));
      unit = {
        ...unit,
        status: type === 'scoreCorrected' ? 'corrected' : 'scored',
        window: { ...unit.window, scorePostedT: event.t },
        result: { ...(unit.result || {}), score, counts: false },
        confidence: event.confidence ?? unit.confidence,
        evidence: [...unit.evidence, event.t]
      };
    }
    unitsCopy[unit.id] = unit;
    next.units = unitsCopy;
    next.unitOrder = unitOrder;
    if (actorId && !next.actors[actorId]) {
      next.actors = { ...next.actors, [actorId]: { id: actorId, kind: 'athlete', teamId, displayName: event.athlete?.name || actorId, priors: {}, flags: [], provenance: {} } };
    }
    markCounting(unitsCopy, next, unit.teamId, unit.rotation);
    touched.units.push(unit.id);
    if (type === 'scorePosted' || type === 'scoreCorrected') touched.outcomes = touchedOutcomes(next, unit);
    return { state: next, touched, event: { ...event, unitId: unit.id } };
  }

  if (type === 'rotationChanged') {
    next.rotation = event.rotation ?? event.current ?? state.rotation;
  } else if (type === 'teamTotalChanged') {
    next.feedTotals = { ...state.feedTotals, [event.team]: event.total ?? event.score };
  } else if (type === 'meetFinal') {
    next.final = true;
    touched.outcomes = ['*'];
  }
  return { state: next, touched, event };
}
