/**
 * Recorded show registry (ISA2-296)
 *
 * One recorded show per competition: a ShowClock driving the OBS media cursor
 * and a RecordedEventSource attached to the competition state service. Loading
 * again replaces the previous show.
 */

import { loadRecordingPackage } from './recordingPackage.js';
import { RecordedEventSource, DEFAULT_POLL_MS } from './recordedEventSource.js';
import { ShowClock } from './showClock.js';

const shows = new Map();

/**
 * @param {string} compId
 * @param {Object} options
 * @param {string} [options.recording] - recordings/<name>
 * @param {Object} [options.pkg] - preloaded package (tests)
 * @param {Object} options.stateService - CompetitionStateService to attach the source to
 * @param {Function} [options.getObs]
 * @param {Function} [options.applyLayout]
 * @param {number} [options.eventsOffsetMs] - log time + offset = video time
 * @param {number} [options.mediaOffsetMs] - OBS cursor = video time + offset
 * @param {number} [options.pollIntervalMs]
 * @param {Function} [options.onStatus] - called with clock status on every change
 */
export function loadRecordedShow(compId, {
  recording = 'ecac-2026', pkg = null, stateService, getObs, applyLayout,
  eventsOffsetMs = 0, mediaOffsetMs = 0, pollIntervalMs = DEFAULT_POLL_MS, onStatus = null,
  now, tickMs, sourceTickMs, sleep
} = {}) {
  removeRecordedShow(compId);
  const recorded = pkg || loadRecordingPackage(recording);
  if (!recorded.meta) throw new Error(`Recording "${recording}" has no meta.json`);

  const clock = new ShowClock({ compId, pkg: recorded, getObs, applyLayout, mediaOffsetMs, now, tickMs, sleep });
  const source = RecordedEventSource.fromPackage(recorded, {
    offsetMs: eventsOffsetMs, pollIntervalMs, tickMs: sourceTickMs
  });
  clock.addSource(source);
  if (onStatus) clock.on('status', onStatus);
  stateService?.attach(source);

  const show = { compId, recording: recorded.name, pkg: recorded, clock, source, stateService };
  shows.set(compId, show);
  return show;
}

export function getRecordedShow(compId) {
  return shows.get(compId) || null;
}

export function removeRecordedShow(compId) {
  const show = shows.get(compId);
  if (!show) return;
  if (show.stateService?._source === show.source) show.stateService.detach();
  show.clock.dispose();
  shows.delete(compId);
}
