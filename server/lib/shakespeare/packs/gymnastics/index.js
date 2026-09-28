/**
 * Gymnastics sport pack (ISA2-338, design.md section 7.1).
 *
 * A plain module; nothing above it names an apparatus. Pure functions only:
 * no Firebase, no clock, no live feed.
 *
 *   describe(config, feedSample)             Context with format, schedule, teams
 *   units(context, lineups)                  Unit list (slot units where unknown)
 *   outcomes(context, state?)                Outcome roots and subjects
 *   applyEvent(state, event)                 { state, touched, event }
 *   reachability(outcome, state, opts)       per-subject reachability
 *   need(outcome, unit, state, target, opts) need number and its assumptions
 *   settle(proposition, event, state?)       settled or not, with confidence
 *   vocabulary                               names for templates
 *
 * project() (probabilities) belongs to the value-model ticket.
 */

import { vocabulary } from './apparatus.js';
import { describe, lineupsFromFeed, replayEvents } from './feed.js';
import {
  allAroundStandings, applyEvent, createState, eventStandings, standings, teamEventScores, units
} from './ledger.js';
import { currentOrder, margin, need, outcomeById, outcomes, reachability, settle } from './race.js';

/** Context and an empty ledger state from config and one Virtius snapshot. */
export function init(config, feedSample, { priors = {} } = {}) {
  const context = describe(config, feedSample);
  const state = createState(context, { lineups: lineupsFromFeed(feedSample), priors });
  return { context, state };
}

export const gymnasticsPack = {
  id: 'gymnastics',
  describe,
  units,
  outcomes,
  applyEvent,
  reachability,
  need,
  settle,
  vocabulary,
  // helpers for the engine and tests
  init,
  createState,
  lineupsFromFeed,
  replayEvents,
  standings,
  teamEventScores,
  allAroundStandings,
  eventStandings,
  currentOrder,
  margin,
  outcomeById
};

export {
  describe, units, outcomes, applyEvent, reachability, need, settle, vocabulary,
  createState, lineupsFromFeed, replayEvents, standings, teamEventScores,
  allAroundStandings, eventStandings, currentOrder, margin, outcomeById
};

export default gymnasticsPack;
