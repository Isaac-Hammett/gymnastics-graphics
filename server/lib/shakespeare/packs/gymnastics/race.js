/**
 * Gymnastics sport pack: outcomes and deterministic race math (ISA2-338).
 * design.md 7.4: margins, needs, reachability. No probabilities here; the
 * value model (project) passes them into reachability() for dead_by_projection.
 *
 * Caps and floors are per actor and per locus:
 *   practical cap   = max(season high, meet high on the locus) + capMargin
 *   practical floor = prior mean - fallPenalty - sd
 *   no priors       = format.capFallback / format.floorFallback (RTN season
 *                     extremes on the locus; a number or { [locus]: number })
 *   mathematical    = the rule maximum (women's 10.0) and the scale minimum;
 *                     men's scores are uncapped, so there is no mathematical flavor.
 */

import {
  actorMilli, actorUnits, allAroundCandidates, isLineup, isScored, meetHighMilli, scoredMilli,
  teamEventMilli, teamEventUnits, teamIds, teamMilli, teamRotations, unitList
} from './ledger.js';
import { fromMilli, toMilli, topSum } from './score.js';

const PLACE_TYPES = new Set(['team_title', 'team_place', 'aa_title', 'aa_place', 'event_title']);

function perLocus(v, locus) {
  return v != null && typeof v === 'object' ? v[locus] : v;
}

function priorOf(state, unit) {
  return unit.actorId ? state.actors?.[unit.actorId]?.priors?.[unit.locus] : null;
}

export function capMilli(state, unit, flavor = 'practical') {
  const f = state.context.format;
  const max = f.scoreScale?.max;
  if (flavor === 'mathematical') {
    if (max == null) throw new Error('mathematical reachability needs a rule maximum (women only)');
    return toMilli(max);
  }
  const high = priorOf(state, unit)?.high ?? perLocus(f.capFallback, unit.locus);
  const cap = Math.max(toMilli(high) ?? 0, meetHighMilli(state, unit.locus) ?? 0) + (toMilli(f.capMargin) ?? 0);
  return max != null ? Math.min(cap, toMilli(max)) : cap;
}

export function floorMilli(state, unit, flavor = 'practical') {
  const f = state.context.format;
  const min = toMilli(f.scoreScale?.min ?? 0);
  if (flavor === 'mathematical') return min;
  const p = priorOf(state, unit);
  const floor = p?.mean != null
    ? toMilli(p.mean) - toMilli(f.fallPenalty ?? 0) - toMilli(p.sd ?? f.sd ?? 0)
    : toMilli(perLocus(f.floorFallback, unit.locus));
  return Math.max(min, floor);
}

function projectedMilli(state, unit) {
  const mean = priorOf(state, unit)?.mean;
  if (mean != null) return toMilli(mean);
  // No priors: the midpoint of the practical band.
  return Math.round((capMilli(state, unit) + floorMilli(state, unit)) / 2);
}

/** Value of a unit under a treatment, in thousandths; null contributes nothing. */
function valueUnder(state, unit, treatment, flavor) {
  if (unit.status === 'scratched') return null;
  if (isScored(unit)) return scoredMilli(unit);
  switch (treatment) {
    case 'cap': return capMilli(state, unit, flavor);
    case 'floor': return floorMilli(state, unit, flavor);
    case 'projected': return projectedMilli(state, unit);
    default: return null; // 'pending': not yet scored, counts as nothing
  }
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

function weightFor(context, type) {
  return (context.ladder || []).find(l => l.outcomeType === type)?.weight ?? 0;
}

function teamHighThreshold(state, teamId) {
  const p = state?.actors?.[teamId]?.priors;
  return p?.total?.high ?? p?.high ?? null;
}

/**
 * outcomes(context, state?) -> Outcome[] (design.md 6.4). Athlete subjects
 * (all-around, event titles) need the state's units; without a state those
 * outcomes carry empty subject lists.
 */
export function outcomes(context, state = null) {
  const roots = new Set(context.outcomeRoots || []);
  const teams = Object.keys(context.schedule || {});
  const make = (id, type, subjects, params = {}) => ({
    id, type, subjects, params, prizeWeight: weightFor(context, type),
    reachability: {}, asOfVersion: state?.version ?? 0, confidence: 1, evidence: []
  });
  const out = [];
  if (roots.has('team_title')) out.push(make('o:team_title', 'team_title', teams, { place: 1 }));
  if (roots.has('team_place')) {
    for (let k = 2; k <= teams.length; k++) out.push(make(`o:team_place:${k}`, 'team_place', teams, { place: k }));
  }
  const aa = state ? allAroundCandidates(state) : [];
  if (roots.has('aa_title')) out.push(make('o:aa_title', 'aa_title', aa, { place: 1 }));
  if (roots.has('aa_place')) {
    for (let k = 2; k <= Math.min(3, aa.length); k++) out.push(make(`o:aa_place:${k}`, 'aa_place', aa, { place: k }));
  }
  if (roots.has('event_title')) {
    for (const locus of context.format.loci) {
      const subjects = state ? [...new Set(unitList(state).filter(u => u.locus === locus && u.actorId).map(u => u.actorId))] : [];
      out.push(make(`o:event_title:${locus}`, 'event_title', subjects, { place: 1, locus }));
    }
  }
  if (roots.has('team_high') && state) {
    for (const teamId of teams) {
      const threshold = teamHighThreshold(state, teamId);
      if (threshold != null) out.push(make(`o:team_high:${teamId}`, 'team_high', [teamId], { threshold }));
    }
  }
  return out;
}

/** Rebuild an outcome from its id, for callers that hold only the id. */
export function outcomeById(state, id) {
  return outcomes({ ...state.context, outcomeRoots: ['team_title', 'team_place', 'aa_title', 'aa_place', 'event_title', 'team_high'] }, state)
    .find(o => o.id === id) || null;
}

function resolveOutcome(state, outcome) {
  return typeof outcome === 'string' ? outcomeById(state, outcome) : outcome;
}

function eventUnitOf(state, actorId, locus) {
  return unitList(state).find(u => u.actorId === actorId && u.locus === locus) || null;
}

/** A subject's total in thousandths under a treatment of its unscored units. */
function subjectMilli(state, outcome, subject, treatment, flavor) {
  const val = u => valueUnder(state, u, treatment, flavor);
  if (outcome.type === 'team_title' || outcome.type === 'team_place' || outcome.type === 'team_high') {
    return teamMilli(state, subject, val);
  }
  if (outcome.type === 'aa_title' || outcome.type === 'aa_place') return actorMilli(state, subject, val);
  if (outcome.type === 'event_title') {
    const u = eventUnitOf(state, subject, outcome.params.locus);
    return u ? (val(u) ?? 0) : 0;
  }
  throw new Error(`unknown outcome type ${outcome.type}`);
}

function subjectUnits(state, outcome, subject) {
  if (outcome.type.startsWith('team_')) return unitList(state).filter(u => u.teamId === subject && isLineup(u));
  if (outcome.type.startsWith('aa_')) return actorUnits(state, subject);
  const u = eventUnitOf(state, subject, outcome.params.locus);
  return u ? [u] : [];
}

function outcomeDone(state, outcome) {
  return state.final || outcome.subjects.every(s => subjectUnits(state, outcome, s).every(u => isScored(u) || u.status === 'scratched'));
}

/** Current totals of every subject (posted scores only), highest first. */
export function currentOrder(state, outcome) {
  const o = resolveOutcome(state, outcome);
  return o.subjects.map(s => ({ subject: s, milli: subjectMilli(state, o, s, 'pending') }))
    .sort((a, b) => b.milli - a.milli)
    .map(r => ({ subject: r.subject, total: fromMilli(r.milli) }));
}

/**
 * margin(outcome, state) -> { leader, second, value } on posted scores: for a
 * title the leader over second; for place k the kth over the (k+1)th.
 */
export function margin(outcome, state) {
  const o = resolveOutcome(state, outcome);
  if (!PLACE_TYPES.has(o.type)) return null;
  const order = currentOrder(state, o);
  const k = o.params.place || 1;
  if (order.length < k + 1) return null;
  const a = order[k - 1];
  const b = order[k];
  return { leader: a.subject, second: b.subject, value: fromMilli(toMilli(a.total) - toMilli(b.total)) };
}

/**
 * reachability(outcome, state, opts) -> { [subject]: 'live'|'clinched'|'eliminated'|'dead_by_projection'|'settled' }
 * opts.flavor: 'practical' (default, both codes) or 'mathematical' (women's 10.0).
 * opts.probabilities: { [subject]: P } from the value model; P < 0.02 while
 * still reachable is dead_by_projection.
 */
export function reachability(outcome, state, opts = {}) {
  const o = resolveOutcome(state, outcome);
  const flavor = opts.flavor || 'practical';
  const out = {};
  if (outcomeDone(state, o)) {
    for (const s of o.subjects) out[s] = 'settled';
    return out;
  }
  const bounds = Object.fromEntries(o.subjects.map(s => [s, {
    lo: subjectMilli(state, o, s, 'floor', flavor),
    hi: subjectMilli(state, o, s, 'cap', flavor)
  }]));

  for (const s of o.subjects) {
    const { lo, hi } = bounds[s];
    let status;
    if (o.type === 'team_high') {
      const t = toMilli(o.params.threshold);
      status = lo > t ? 'clinched' : hi > t ? 'live' : 'eliminated';
    } else {
      const k = o.params.place || 1;
      const others = o.subjects.filter(x => x !== s).map(x => bounds[x]);
      // Best place: only opponents certain to finish above. Worst: every
      // opponent that could finish level or above.
      const best = 1 + others.filter(b => b.lo > hi).length;
      const worst = 1 + others.filter(b => b.hi >= lo).length;
      status = best === k && worst === k ? 'clinched' : (best <= k && k <= worst ? 'live' : 'eliminated');
    }
    const p = opts.probabilities?.[s];
    if (status === 'live' && p != null && p < 0.02) status = 'dead_by_projection';
    out[s] = status;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Needs
// ---------------------------------------------------------------------------

/**
 * need(outcome, unit, state, target?, opts?) -> the score the unit must beat.
 *
 * The subject is the unit's team (team outcomes) or athlete (all-around and
 * event outcomes). `target` is the subject to pass; without one, the need is
 * for the outcome's place (the title: pass everyone). The result is strict:
 * the routine must score MORE than `value` (equal ties).
 *
 * opts.others: treatment of every other unscored unit, 'pending' (default:
 *   standings as they are), 'projected', 'cap' (need to clinch), or 'floor'.
 * opts.assume: { [unitId]: treatment } per-unit overrides.
 *
 * Returns { outcomeId, unitId, subject, target, value, strict, status,
 *   cap, assumptions: [{ unitId, treatedAs }] } where status is 'open',
 *   'already' (passes the target even with nothing), 'out_of_reach' (above the
 *   unit's practical cap), or 'not_counting' (the unit cannot move the total).
 */
export function need(outcome, unit, state, target = null, opts = {}) {
  const o = resolveOutcome(state, outcome);
  const u = typeof unit === 'string' ? state.units[unit] : unit;
  if (!o || !u) throw new Error('need() requires a known outcome and unit');
  const treatment = opts.others || 'pending';
  const treatOf = x => opts.assume?.[x.id] || treatment;
  const val = x => (x.id === u.id ? null : valueUnder(state, x, treatOf(x), opts.flavor));
  const isTeam = o.type.startsWith('team_');
  const subject = isTeam ? u.teamId : u.actorId;
  const base = { outcomeId: o.id, unitId: u.id, subject, strict: true };

  if (isTeam && !isLineup(u)) return { ...base, target, value: null, status: 'not_counting', assumptions: [] };

  // Target total to exceed.
  let targets;
  if (target) targets = [target];
  else if (o.type === 'team_high') targets = [];
  else {
    const k = o.params.place || 1;
    const opp = o.subjects.filter(s => s !== subject)
      .map(s => ({ s, m: totalOf(state, o, s, val) }));
    targets = opp.length ? [opp.sort((a, b) => b.m - a.m)[Math.min(k, opp.length) - 1].s] : [];
  }
  const T = o.type === 'team_high' && !target
    ? toMilli(o.params.threshold)
    : (targets.length ? totalOf(state, o, targets[0], val) : 0);

  // Everything the subject has without this unit, and what the unit adds.
  let rest;
  let already;
  if (isTeam) {
    const n = state.context.format.countingScores;
    const otherRotations = teamRotations(state, subject).filter(r => r !== u.rotation)
      .reduce((s, r) => s + teamEventMilli(state, subject, r, val), 0);
    const mates = teamEventUnits(state, subject, u.rotation).filter(x => isLineup(x) && x.id !== u.id).map(val).filter(v => v != null);
    rest = otherRotations + topSum(mates, n - 1);
    already = otherRotations + topSum(mates, n) > T;
  } else if (o.type.startsWith('aa_')) {
    rest = actorMilli(state, subject, val);
    already = rest > T;
  } else {
    rest = 0;
    already = false;
  }
  const y = T - rest;
  const cap = capMilli(state, u);
  const status = already ? 'already' : (y >= cap ? 'out_of_reach' : 'open');

  return {
    ...base,
    target: targets[0] || null,
    value: fromMilli(y),
    status,
    cap: fromMilli(cap),
    assumptions: assumptionsFor(state, o, u, [subject, ...targets], treatOf)
  };
}

function totalOf(state, o, subject, val) {
  if (o.type.startsWith('team_')) return teamMilli(state, subject, val);
  if (o.type.startsWith('aa_')) return actorMilli(state, subject, val);
  const x = eventUnitOf(state, subject, o.params.locus);
  return x ? (val(x) ?? 0) : 0;
}

/**
 * Parallel-locus conditionality: units of the involved subjects in the unit's
 * rotation (scored ones treated as final), plus any unscored unit elsewhere.
 */
function assumptionsFor(state, o, u, subjects, treatOf) {
  const out = [];
  for (const s of new Set(subjects)) {
    for (const x of subjectUnits(state, o, s)) {
      if (x.id === u.id || x.status === 'scratched') continue;
      if (isScored(x)) { if (x.rotation === u.rotation) out.push({ unitId: x.id, treatedAs: 'final' }); }
      else out.push({ unitId: x.id, treatedAs: treatOf(x) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Settlers
// ---------------------------------------------------------------------------

/**
 * settle(proposition, event, state?) -> { settled, confidence, result? }
 * Unit propositions (need, over_under) settle on the unit's scorePosted and
 * re-settle on scoreCorrected with `correctionOf`. Outcome propositions
 * (margin) settle on their settler's evidence type when a state is given.
 */
export function settle(proposition, event, state = null) {
  const settler = proposition.settler || { evidenceType: 'scorePosted', minConfidence: 0.9 };
  const confidence = event.confidence ?? 1;
  const no = { settled: false, confidence };
  const kind = proposition.number?.type;

  if (proposition.unitId && (kind === 'need' || kind === 'over_under')) {
    if (event.unitId !== proposition.unitId) return no;
    if (event.type !== settler.evidenceType && event.type !== 'scoreCorrected') return no;
    if (event.type === 'scoreCorrected' && event.removed) return no;
    if (confidence < (settler.minConfidence ?? 0)) return no;
    const score = fromMilli(toMilli(event.score));
    const passed = toMilli(score) > toMilli(proposition.number.value);
    return {
      settled: true,
      confidence,
      result: {
        value: passed ? 'yes' : 'no',
        score,
        settledBy: event.t,
        settledT: event.t,
        ...(event.type === 'scoreCorrected' && proposition.result ? { correctionOf: String(proposition.result.settledBy) } : {})
      }
    };
  }

  if (kind === 'margin' && state && proposition.outcomeId && event.type === settler.evidenceType) {
    if (confidence < (settler.minConfidence ?? 0)) return no;
    const m = margin(proposition.outcomeId, state);
    return m ? { settled: true, confidence, result: { value: m.value, leader: m.leader, second: m.second, settledBy: event.t, settledT: event.t } } : no;
  }

  if (event.type === 'humanFlag' && event.propositionId === proposition.id) {
    return { settled: true, confidence, result: { value: event.value, settledBy: event.t, settledT: event.t } };
  }
  return no;
}
