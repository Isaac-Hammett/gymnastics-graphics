/**
 * Competition State Reducer (ISA2-274)
 *
 * Pure functions: (state, input) -> { state, events }. No I/O, no timers, no
 * clock reads; time comes from the input's `t`.
 *
 * Ported from the browser overlays:
 *  - poll diffing (new score / correction / removed score): overlays/team-bug.html processApiData
 *  - detectNowCompeting: overlays/team-bug.html
 *  - rotation + bye detection: overlays/rotation-slate-auto.html detectRotation
 *    (rotation fields on each Virtius event; teams with no event in a rotation
 *    are on a bye and must not hold the rotation back — BUG-005)
 *
 * The Virtius JSON has no green-light, routine-end, On Air or timestamp
 * fields, so "up" and "in progress" are inferred from score changes and every
 * typed event carries { confidence, evidence[] }.
 *
 * Inputs: { t, snapshot }  a raw Virtius session JSON ({ meet: { teams } })
 *         { t, signal }    { type: 'greenLight'|'routineEnded', event, team,
 *                          source?, confidence? } or any other type, stored in state.signals
 */

export const CONFIDENCE = {
  SCORE_POSTED: 0.95,
  SCORE_CORRECTED: 0.95,
  TEAM_TOTAL: 0.95,
  ROTATION: 0.9,
  GREEN_LIGHT_RECORDED: 0.9,
  ROUTINE_ENDED_RECORDED: 0.9,
  UP_AFTER_PREVIOUS_SCORE: 0.6,
  UP_FIRST_ATHLETE: 0.4
};

// Stale-poll handling: each poll with no change trims inferred confidence; a
// long gap between polls trims everything.
export const STALE = {
  PER_UNCHANGED_POLL: 0.05,
  MAX_UNCHANGED_PENALTY: 0.4,
  GAP_MS: 60000,
  GAP_FACTOR: 0.8
};

export const EVENT_TYPES = [
  'athleteUp', 'greenLight', 'routineEnded', 'scorePosted',
  'scoreCorrected', 'rotationChanged', 'teamTotalChanged'
];

const EVENT_CODES = {
  FLOOR: 'FX', HORSE: 'PH', RINGS: 'SR', VAULT: 'VT', PBARS: 'PB', BAR: 'HB',
  BARS: 'UB', BEAM: 'BB'
};

// ---------------------------------------------------------------------------
// Snapshot normalization
// ---------------------------------------------------------------------------

function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseScore(raw) {
  if (raw == null || raw === '') return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function hasScore(g) {
  return g.final_score != null && g.final_score !== '';
}

/**
 * Flatten a raw Virtius payload into the shapes the reducer works on.
 * Accepts { meet: { teams } } or { teams }.
 */
export function normalizeSnapshot(snapshot) {
  const meet = snapshot?.meet || snapshot || {};
  const teams = (meet.teams || []).map((team, idx) => {
    const key = team.tricode || team.short_name || team.name || `team${idx + 1}`;
    return {
      key,
      name: team.name || key,
      tricode: team.tricode || null,
      total: team.final_score,
      totalNum: parseScore(team.final_score),
      place: team.place ?? null,
      events: (team.events || []).map(ev => ({
        name: ev.event_name || ev.name || 'unknown',
        code: EVENT_CODES[ev.event_name] || ev.short_name || ev.event_name || null,
        rotation: ev.rotation ?? null,
        gymnasts: (ev.gymnasts || []).map(g => ({
          id: g.gymnast_id != null && g.gymnast_id !== ''
            ? String(g.gymnast_id)
            : `${key}|${normalizeName(g.full_name)}`,
          name: g.full_name || [g.first_name, g.last_name].filter(Boolean).join(' '),
          order: g.order ?? null,
          type: g.type ?? null,
          score: g.final_score == null || g.final_score === '' ? null : g.final_score,
          scoreNum: parseScore(g.final_score),
          scored: hasScore(g)
        }))
      }))
    };
  });
  return { teams, meetStatus: meet.status || null };
}

const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

// ---------------------------------------------------------------------------
// Rotation (port of detectRotation / detectRotationFromApiFields)
// ---------------------------------------------------------------------------

/**
 * @returns {{current:number,total:number,isFinal:boolean,byes:string[]}|null}
 */
export function detectRotation(teams) {
  if (!teams || teams.length === 0) return null;

  const rotations = teams.flatMap(t => t.events.map(e => e.rotation)).filter(r => r);
  const hasRotationFields = rotations.length > 0;
  const total = hasRotationFields
    ? Math.max(...rotations)
    : Math.max(0, ...teams.map(t => t.events.length));

  let result;
  if (hasRotationFields) {
    result = rotationFromFields(teams, total);
  } else {
    // Fallback: count completed events per team
    let minCompleted = total;
    teams.forEach(t => {
      const completed = t.events.filter(e =>
        e.gymnasts.length > 0 && e.gymnasts.every(g => g.scored)).length;
      minCompleted = Math.min(minCompleted, completed);
    });
    result = minCompleted === total
      ? { current: total, total, isFinal: true }
      : { current: minCompleted + 1, total, isFinal: false };
  }

  return { ...result, byes: detectByes(teams, result.current, hasRotationFields) };
}

function rotationFromFields(teams, total) {
  let maxRotationWithScores = 0;
  let allEventsComplete = true;

  teams.forEach(t => t.events.forEach(e => {
    if (!e.rotation) return;
    // An event with no gymnasts is a bye slot, not unfinished work (BUG-005).
    if (e.gymnasts.length === 0) return;
    const scored = e.gymnasts.filter(g => g.scored).length;
    if (scored > 0) maxRotationWithScores = Math.max(maxRotationWithScores, e.rotation);
    if (scored < e.gymnasts.length) allEventsComplete = false;
  }));

  if (allEventsComplete && maxRotationWithScores > 0) {
    return { current: total, total, isFinal: true };
  }

  if (maxRotationWithScores > 0 && maxRotationWithScores < total) {
    // Teams with no (or empty) event in that rotation are on a bye and don't block.
    const complete = teams.every(t => {
      const ev = t.events.find(e => e.rotation === maxRotationWithScores);
      if (!ev || ev.gymnasts.length === 0) return true;
      return ev.gymnasts.every(g => g.scored);
    });
    if (complete) return { current: maxRotationWithScores + 1, total, isFinal: false };
  }

  return { current: Math.max(1, maxRotationWithScores), total, isFinal: false };
}

/** Teams with no competing event in `rotation` (5+ team meets with 6 events). */
export function detectByes(teams, rotation, hasRotationFields = true) {
  if (!hasRotationFields) return [];
  return teams
    .filter(t => {
      const ev = t.events.find(e => e.rotation === rotation);
      return !ev || ev.gymnasts.length === 0;
    })
    .map(t => t.key);
}

// ---------------------------------------------------------------------------
// Now competing (port of detectNowCompeting)
// ---------------------------------------------------------------------------

/**
 * The next unscored athlete in the first event of `team` that has some scores
 * but not all. Same rule as the browser overlay.
 * @param {Object} team normalized team
 * @returns {{athlete:Object,event:Object}|null}
 */
export function detectNowCompeting(team) {
  if (!team || !team.events) return null;
  for (const event of team.events) {
    if (event.gymnasts.length === 0) continue;
    const sorted = [...event.gymnasts].sort(byOrder);
    const scored = sorted.filter(g => g.scored);
    const unscored = sorted.filter(g => !g.scored);
    if (scored.length > 0 && unscored.length > 0) {
      return { athlete: unscored[0], event };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Score diffing (port of processApiData)
// ---------------------------------------------------------------------------

function buildScoreMap(teams) {
  const map = {};
  teams.forEach(t => t.events.forEach(e => e.gymnasts.forEach(g => {
    map[`${t.key}|${e.name}|${g.id}`] = g.score;
  })));
  return map;
}

/**
 * @returns {Array<{kind:'new'|'correction'|'removed',team,event,gymnast,prev,curr}>}
 */
export function diffScores(prevScores, teams) {
  const changes = [];
  teams.forEach(t => t.events.forEach(e => e.gymnasts.forEach(g => {
    const prev = prevScores[`${t.key}|${e.name}|${g.id}`];
    const had = prev != null;
    if (g.score != null && prev !== g.score) {
      changes.push({ kind: had ? 'correction' : 'new', team: t, event: e, gymnast: g, prev: had ? prev : null, curr: g.score });
    } else if (g.score == null && had) {
      changes.push({ kind: 'removed', team: t, event: e, gymnast: g, prev, curr: null });
    }
  })));
  return changes;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function createInitialState() {
  return {
    stateVersion: 0,
    updatedAt: null,
    hasSnapshot: false,
    meetStatus: null,
    events: {},          // EVENT -> { name, code, rotation, teams: { TEAM -> per-team state } }
    teamTotals: {},      // TEAM -> { name, total, totalNum }
    standings: [],       // [{ rank, team, name, total }]
    rotation: null,      // { current, total, isFinal, byes }
    signals: {},         // vision / recorded-log signals, latest per type (step 9)
    freshness: { lastPollT: null, lastChangeT: null, unchangedPolls: 0 },
    _scores: {},
    _totals: {},
    _digest: null
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function staleFactors(state, t) {
  const f = state.freshness;
  const unchangedPenalty = Math.min(STALE.MAX_UNCHANGED_PENALTY, f.unchangedPolls * STALE.PER_UNCHANGED_POLL);
  const gap = f.lastPollT != null && t != null && t - f.lastPollT > STALE.GAP_MS ? STALE.GAP_FACTOR : 1;
  return { inferred: gap * (1 - unchangedPenalty), fact: gap };
}

const round = (n) => Math.round(n * 1000) / 1000;

function makeEvent(type, t, fields, confidence, evidence) {
  return { type, t, ...fields, confidence: round(confidence), evidence };
}

function computeStandings(teams) {
  const rows = teams
    .filter(t => t.totalNum != null)
    .map(t => ({ team: t.key, name: t.name, total: t.total, totalNum: t.totalNum }))
    .sort((a, b) => b.totalNum - a.totalNum);
  let rank = 0;
  let last = null;
  return rows.map((r, i) => {
    if (r.totalNum !== last) { rank = i + 1; last = r.totalNum; }
    return { rank, team: r.team, name: r.name, total: r.total };
  });
}

const athleteRef = (g) => ({ id: g.id, name: g.name, order: g.order });

/**
 * Apply one input. Never mutates `state`.
 * @returns {{state:Object, events:Object[]}}
 */
export function reduce(prevState, input, opts = {}) {
  const state = clone(prevState || createInitialState());
  const t = input?.t ?? null;
  const events = [];

  if (input?.signal) {
    applySignal(state, t, input.signal, events);
  } else if (input?.snapshot) {
    applySnapshot(state, t, input.snapshot, events, opts);
  }

  if (events.length > 0) {
    state.stateVersion += 1;
    state.updatedAt = t;
    events.forEach(e => { e.stateVersion = state.stateVersion; });
  }
  return { state, events };
}

function applySnapshot(state, t, snapshot, events, opts) {
  const { teams, meetStatus } = normalizeSnapshot(snapshot);
  const isBaseline = !state.hasSnapshot;
  const quiet = isBaseline && !opts.emitInitial;
  const stale = staleFactors(state, t);
  const digest = JSON.stringify(teams);

  // --- score diff ---
  const changes = diffScores(state._scores, teams);
  const postedTeamEvents = new Set();
  if (!quiet) {
    for (const c of changes) {
      const base = { event: c.event.name, eventCode: c.event.code, team: c.team.key, athlete: athleteRef(c.gymnast) };
      if (c.kind === 'new') {
        postedTeamEvents.add(`${c.event.name}|${c.team.key}`);
        events.push(makeEvent('scorePosted', t, { ...base, score: c.curr }, CONFIDENCE.SCORE_POSTED * stale.fact,
          [{ kind: 'virtius-score-appeared', value: c.curr }]));
      } else {
        events.push(makeEvent('scoreCorrected', t, { ...base, score: c.curr, previousScore: c.prev, removed: c.kind === 'removed' },
          CONFIDENCE.SCORE_CORRECTED * stale.fact,
          [{ kind: c.kind === 'removed' ? 'virtius-score-removed' : 'virtius-score-changed', from: c.prev, to: c.curr }]));
      }
    }
  }

  // --- team totals + standings ---
  const newTotals = {};
  teams.forEach(tm => { newTotals[tm.key] = tm.total; });
  if (!quiet) {
    for (const tm of teams) {
      const prev = state._totals[tm.key];
      if (state.hasSnapshot && tm.total !== prev && tm.total != null) {
        events.push(makeEvent('teamTotalChanged', t,
          { team: tm.key, total: tm.total, previousTotal: prev ?? null },
          CONFIDENCE.TEAM_TOTAL * stale.fact, [{ kind: 'virtius-team-total', from: prev ?? null, to: tm.total }]));
      }
    }
  }
  state.teamTotals = Object.fromEntries(teams.map(tm => [tm.key, { name: tm.name, total: tm.total, totalNum: tm.totalNum }]));
  state.standings = computeStandings(teams);

  // --- rotation ---
  const rotation = detectRotation(teams);
  const prevRotation = state.rotation;
  if (!quiet && rotation && prevRotation &&
      (rotation.current !== prevRotation.current || rotation.isFinal !== prevRotation.isFinal)) {
    events.push(makeEvent('rotationChanged', t,
      { rotation: rotation.current, total: rotation.total, isFinal: rotation.isFinal, byes: rotation.byes,
        previousRotation: prevRotation.current },
      CONFIDENCE.ROTATION * stale.fact, [{ kind: 'virtius-rotation-fields', from: prevRotation.current, to: rotation.current }]));
  }
  state.rotation = rotation;

  // --- per event / per team ---
  const nextEvents = {};
  for (const tm of teams) {
    for (const ev of tm.events) {
      const evState = nextEvents[ev.name] || (nextEvents[ev.name] = { name: ev.name, code: ev.code, rotation: ev.rotation, teams: {} });
      const prevTeamState = state.events[ev.name]?.teams?.[tm.key] || null;
      const ts = computeTeamEvent(tm, ev, rotation, stale, prevTeamState, postedTeamEvents.has(`${ev.name}|${tm.key}`));
      evState.teams[tm.key] = ts;

      const prevId = prevTeamState?.athleteUp?.id ?? null;
      const currId = ts.athleteUp?.id ?? null;
      if (!quiet && currId && currId !== prevId) {
        events.push(makeEvent('athleteUp', t,
          { event: ev.name, eventCode: ev.code, team: tm.key, athlete: athleteRef(ts.athleteUp), routineStatus: ts.routineStatus },
          ts.athleteUp.confidence, ts.athleteUp.evidence));
      }
    }
  }
  state.events = nextEvents;

  // --- bookkeeping ---
  state._scores = buildScoreMap(teams);
  state._totals = newTotals;
  state._digest = digest;
  state.meetStatus = meetStatus;

  // Change detection runs on the input, not on derived confidences (which move with staleness).
  if (isBaseline || digest !== state._digest) {
    state.freshness.lastChangeT = t;
    state.freshness.unchangedPolls = 0;
  } else {
    state.freshness.unchangedPolls += 1;
  }
  state.freshness.lastPollT = t;
  state.hasSnapshot = true;

  // Quiet baseline still bumps the version once so consumers see a first state.
  if (isBaseline && events.length === 0) {
    state.stateVersion += 1;
    state.updatedAt = t;
  }
}

function computeTeamEvent(team, ev, rotation, stale, prev, justScored) {
  const lineup = [...ev.gymnasts].sort(byOrder).map(g => ({
    id: g.id, name: g.name, order: g.order, score: g.score, type: g.type
  }));
  const sorted = [...ev.gymnasts].sort(byOrder);
  const scored = sorted.filter(g => g.scored);
  const unscored = sorted.filter(g => !g.scored);
  const lastScored = [...scored].sort((a, b) => (b.order || 0) - (a.order || 0))[0] || null;
  const lastScore = lastScored
    ? { athleteId: lastScored.id, name: lastScored.name, score: lastScored.score }
    : null;

  let athleteUp = null;
  if (unscored.length > 0) {
    const next = unscored[0];
    if (scored.length > 0) {
      athleteUp = {
        id: next.id, name: next.name, team: team.key, order: next.order,
        confidence: round(CONFIDENCE.UP_AFTER_PREVIOUS_SCORE * stale.inferred),
        evidence: [{ kind: 'lineup-order-after-previous-score', previous: lastScored.name }]
      };
    } else if (rotation && ev.rotation === rotation.current && !rotation.isFinal) {
      athleteUp = {
        id: next.id, name: next.name, team: team.key, order: next.order,
        confidence: round(CONFIDENCE.UP_FIRST_ATHLETE * stale.inferred),
        evidence: [{ kind: 'first-in-lineup-current-rotation', rotation: ev.rotation }]
      };
    }
  }

  // Carry a recorded/vision confirmation forward while the same athlete is up.
  let routineStatus = athleteUp ? 'up' : 'idle';
  if (prev?.athleteUp && athleteUp && prev.athleteUp.id === athleteUp.id) {
    if (prev.routineStatus === 'in_progress') routineStatus = 'in_progress';
    if (prev.athleteUp.confirmed) {
      athleteUp.confirmed = true;
      athleteUp.confidence = Math.max(athleteUp.confidence, prev.athleteUp.confidence);
      athleteUp.evidence = prev.athleteUp.evidence;
    }
  }
  if (justScored) routineStatus = 'scored';

  return { routineStatus, athleteUp, lastScore, lineup, bye: !!rotation?.byes?.includes(team.key) };
}

function applySignal(state, t, signal, events) {
  const type = signal.type;
  const target = state.events[signal.event]?.teams?.[signal.team] || null;

  if ((type === 'greenLight' || type === 'routineEnded') && target) {
    const isGreen = type === 'greenLight';
    const confidence = signal.confidence ?? (isGreen ? CONFIDENCE.GREEN_LIGHT_RECORDED : CONFIDENCE.ROUTINE_ENDED_RECORDED);
    const evidence = [{ kind: `${signal.source || 'recorded-log'}-${type}`, t }];
    if (isGreen && target.athleteUp) {
      target.routineStatus = 'in_progress';
      target.athleteUp.confirmed = true;
      target.athleteUp.confidence = Math.max(target.athleteUp.confidence, confidence);
      target.athleteUp.evidence = evidence;
    } else if (!isGreen) {
      // Routine finished; the score has not necessarily posted yet.
      target.routineStatus = 'in_progress';
      target.routineEndedAt = t;
    }
    events.push(makeEvent(type, t, {
      event: signal.event, eventCode: state.events[signal.event].code, team: signal.team,
      athlete: target.athleteUp ? { id: target.athleteUp.id, name: target.athleteUp.name, order: target.athleteUp.order } : null
    }, confidence, evidence));
  }

  // Everything else (vision, On Air, etc.) is stored for later steps.
  state.signals[type] = { ...signal, t };
  if (events.length === 0) {
    state.stateVersion += 1;
    state.updatedAt = t;
  }
}
