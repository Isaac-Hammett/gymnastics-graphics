/**
 * Routine state provider for the noCutDuringRoutine guardrail (ISA2-311).
 *
 * Reads a competition's CompetitionStateService (ISA2-274) and reports the
 * routine in progress, in the shape Guardrails.setRoutineStateProvider expects:
 * `{status, confidence, event, athlete, sceneNames}` or null.
 */

import { getCompetitionState } from './competitionState/index.js';

/** Scenes that show an event: the scene name contains the event's name or code as a word. */
export function scenesForEvent(sceneNames, event) {
  const words = [event?.name, event?.code].filter(Boolean).map(w => String(w).toLowerCase());
  if (words.length === 0) return [];
  return sceneNames.filter((scene) => {
    const tokens = String(scene).toLowerCase().split(/[^a-z0-9]+/);
    return words.some(w => tokens.includes(w));
  });
}

/**
 * The most confident in-progress routine in a public state, or the most
 * confident non-in-progress one is never returned (idle/up/scored mean allow).
 * @param {Object|null} state - CompetitionStateService.getPublicState()
 * @param {string[]} [sceneNames] - Program scenes known to the bus
 */
export function routineFromState(state, sceneNames = []) {
  let best = null;
  for (const event of Object.values(state?.events || {})) {
    for (const team of Object.values(event.teams || {})) {
      if (team?.routineStatus !== 'in_progress') continue;
      const confidence = Number(team.athleteUp?.confidence);
      if (best && !(confidence > best.confidence)) continue;
      best = {
        status: 'in_progress',
        confidence: Number.isFinite(confidence) ? confidence : null,
        event: event.name,
        athlete: team.athleteUp?.name || null,
        sceneNames: scenesForEvent(sceneNames, event),
      };
    }
  }
  return best;
}

/**
 * Provider for one competition. Looks the state service up on every call, so it
 * follows the service being created late or removed (removed -> null -> allow).
 * @param {string} compId
 * @param {Function} [getSceneNames] - `() => string[]`
 */
export function createRoutineStateProvider(compId, getSceneNames = () => []) {
  return () => {
    const service = getCompetitionState(compId);
    if (!service) return null;
    return routineFromState(service.getPublicState(), getSceneNames());
  };
}
