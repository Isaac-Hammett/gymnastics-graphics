import { useCallback, useMemo } from 'react';
import { useShow } from '../context/ShowContext';

/**
 * Hook that provides timesheet state and control functions.
 *
 * Returns timesheet state from context along with helper functions
 * and actions for controlling the show flow.
 *
 * @returns {Object} Timesheet state, helpers, and actions
 *
 * @example
 * const { currentSegment, nextSegment, progress, advance, previous, jumpTo } = useTimesheet();
 * // currentSegment = {id: 'intro', name: 'Opening', type: 'static', ...}
 * // progress = 0.5 (50% through segment)
 * // advance() - advance to next segment
 */
export function useTimesheet() {
  const {
    timesheetState,
    overrideLog,
    startTimesheetShow,
    stopTimesheetShow,
    advanceTimesheetSegment,
    previousTimesheetSegment,
    goToTimesheetSegment,
    overrideTimesheetScene,
    overrideTimesheetCamera,
    clearOverrideLog,
    clearRundownModified,
    state
  } = useShow();

  /**
   * Current segment object
   * @type {Object|null}
   */
  const currentSegment = useMemo(() => {
    return timesheetState.currentSegment || null;
  }, [timesheetState.currentSegment]);

  /**
   * Next segment object (preview of upcoming segment)
   * @type {Object|null}
   */
  const nextSegment = useMemo(() => {
    return timesheetState.nextSegment || null;
  }, [timesheetState.nextSegment]);

  /**
   * Progress through current segment (0-1)
   * @type {number}
   */
  const progress = useMemo(() => {
    return timesheetState.segmentProgress || 0;
  }, [timesheetState.segmentProgress]);

  /**
   * Elapsed time in current segment (milliseconds)
   * @type {number}
   */
  const elapsed = useMemo(() => {
    return timesheetState.segmentElapsedMs || 0;
  }, [timesheetState.segmentElapsedMs]);

  /**
   * Remaining time in current segment (milliseconds)
   * @type {number}
   */
  const remaining = useMemo(() => {
    return timesheetState.segmentRemainingMs || 0;
  }, [timesheetState.segmentRemainingMs]);

  /**
   * Total show elapsed time (milliseconds)
   * @type {number}
   */
  const showElapsed = useMemo(() => {
    return timesheetState.showElapsedMs || 0;
  }, [timesheetState.showElapsedMs]);

  /**
   * Whether the timesheet is currently running
   * @type {boolean}
   */
  const isRunning = useMemo(() => {
    return timesheetState.isRunning || false;
  }, [timesheetState.isRunning]);

  /**
   * Whether the timesheet is currently paused
   * @type {boolean}
   */
  const isPaused = useMemo(() => {
    return timesheetState.isPaused || false;
  }, [timesheetState.isPaused]);

  /**
   * Whether the current segment is a hold segment
   * @type {boolean}
   */
  const isHoldSegment = useMemo(() => {
    return timesheetState.isHoldSegment || false;
  }, [timesheetState.isHoldSegment]);

  /**
   * Whether the hold segment can be advanced (minDuration met)
   * @type {boolean}
   */
  const canAdvanceHold = useMemo(() => {
    return timesheetState.canAdvanceHold || false;
  }, [timesheetState.canAdvanceHold]);

  /**
   * Time remaining until hold can be advanced (milliseconds)
   * @type {number}
   */
  const holdRemainingMs = useMemo(() => {
    return timesheetState.holdRemainingMs || 0;
  }, [timesheetState.holdRemainingMs]);

  /**
   * Current segment index
   * @type {number}
   */
  const currentIndex = useMemo(() => {
    return timesheetState.currentSegmentIndex ?? -1;
  }, [timesheetState.currentSegmentIndex]);

  /**
   * Engine state ('stopped', 'running', 'paused')
   * @type {string}
   */
  const engineState = useMemo(() => {
    return timesheetState.state || 'stopped';
  }, [timesheetState.state]);

  /**
   * Whether the rundown has been modified since loading
   * @type {boolean}
   */
  const rundownModified = useMemo(() => {
    return timesheetState.rundownModified || false;
  }, [timesheetState.rundownModified]);

  /**
   * Summary of rundown modifications (added, removed, modified segments)
   * @type {Object|null}
   */
  const rundownModifiedSummary = useMemo(() => {
    return timesheetState.rundownModifiedSummary || null;
  }, [timesheetState.rundownModifiedSummary]);

  /**
   * Format milliseconds as MM:SS
   * @param {number} ms - Time in milliseconds
   * @returns {string} Formatted time string
   */
  const formatTime = useCallback((ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Formatted elapsed time (MM:SS)
   * @type {string}
   */
  const elapsedFormatted = useMemo(() => {
    return formatTime(elapsed);
  }, [elapsed, formatTime]);

  /**
   * Formatted remaining time (MM:SS)
   * @type {string}
   */
  const remainingFormatted = useMemo(() => {
    return formatTime(remaining);
  }, [remaining, formatTime]);

  /**
   * Formatted show elapsed time (MM:SS)
   * @type {string}
   */
  const showElapsedFormatted = useMemo(() => {
    return formatTime(showElapsed);
  }, [showElapsed, formatTime]);

  /**
   * Start the timesheet show
   */
  const start = useCallback(() => {
    startTimesheetShow();
  }, [startTimesheetShow]);

  /**
   * Stop the timesheet show
   */
  const stop = useCallback(() => {
    stopTimesheetShow();
  }, [stopTimesheetShow]);

  /**
   * Advance to next segment
   * @param {string} [advancedBy='producer'] - Who is advancing
   */
  const advance = useCallback((advancedBy = 'producer') => {
    advanceTimesheetSegment(advancedBy);
  }, [advanceTimesheetSegment]);

  /**
   * Go to previous segment
   * @param {string} [triggeredBy='producer'] - Who is triggering
   */
  const previous = useCallback((triggeredBy = 'producer') => {
    previousTimesheetSegment(triggeredBy);
  }, [previousTimesheetSegment]);

  /**
   * Jump to a specific segment by ID
   * @param {string} segmentId - The segment ID to jump to
   * @param {string} [triggeredBy='producer'] - Who is triggering
   */
  const jumpTo = useCallback((segmentId, triggeredBy = 'producer') => {
    goToTimesheetSegment(segmentId, triggeredBy);
  }, [goToTimesheetSegment]);

  /**
   * Override the current OBS scene
   * @param {string} sceneName - The scene name to switch to
   * @param {string} [triggeredBy='producer'] - Who is triggering
   */
  const overrideScene = useCallback((sceneName, triggeredBy = 'producer') => {
    overrideTimesheetScene(sceneName, triggeredBy);
  }, [overrideTimesheetScene]);

  /**
   * Override to a specific camera's scene
   * @param {string} cameraId - The camera ID to switch to
   * @param {string} [triggeredBy='producer'] - Who is triggering
   */
  const overrideCamera = useCallback((cameraId, triggeredBy = 'producer') => {
    overrideTimesheetCamera(cameraId, triggeredBy);
  }, [overrideTimesheetCamera]);

  /**
   * Get all segments from timesheet state or legacy show config
   * Note: loadRundown puts segments at timesheetState.segments, legacy puts them at state.showConfig.segments
   * @type {Array}
   */
  const segments = useMemo(() => {
    return timesheetState?.segments || state?.showConfig?.segments || [];
  }, [timesheetState?.segments, state?.showConfig?.segments]);

  /**
   * Total segment count
   * @type {number}
   */
  const totalSegments = useMemo(() => {
    return segments.length;
  }, [segments]);

  /**
   * Check if we're at the first segment
   * @type {boolean}
   */
  const isFirstSegment = useMemo(() => {
    return currentIndex <= 0;
  }, [currentIndex]);

  /**
   * Check if we're at the last segment
   * @type {boolean}
   */
  const isLastSegment = useMemo(() => {
    return currentIndex >= totalSegments - 1;
  }, [currentIndex, totalSegments]);

  /**
   * Override log count
   * @type {number}
   */
  const overrideCount = useMemo(() => {
    return overrideLog.length;
  }, [overrideLog]);

  return {
    // State
    /**
     * Current segment object
     * @type {Object|null}
     */
    currentSegment,

    /**
     * Next segment object (preview)
     * @type {Object|null}
     */
    nextSegment,

    /**
     * Progress through current segment (0-1)
     * @type {number}
     */
    progress,

    /**
     * Elapsed time in current segment (ms)
     * @type {number}
     */
    elapsed,

    /**
     * Remaining time in current segment (ms)
     * @type {number}
     */
    remaining,

    /**
     * Total show elapsed time (ms)
     * @type {number}
     */
    showElapsed,

    /**
     * Formatted elapsed time (MM:SS)
     * @type {string}
     */
    elapsedFormatted,

    /**
     * Formatted remaining time (MM:SS)
     * @type {string}
     */
    remainingFormatted,

    /**
     * Formatted show elapsed time (MM:SS)
     * @type {string}
     */
    showElapsedFormatted,

    /**
     * Whether timesheet is running
     * @type {boolean}
     */
    isRunning,

    /**
     * Whether timesheet is paused
     * @type {boolean}
     */
    isPaused,

    /**
     * Whether current segment is a hold
     * @type {boolean}
     */
    isHoldSegment,

    /**
     * Whether hold can be advanced (minDuration met)
     * @type {boolean}
     */
    canAdvanceHold,

    /**
     * Time until hold can be advanced (ms)
     * @type {number}
     */
    holdRemainingMs,

    /**
     * Current segment index
     * @type {number}
     */
    currentIndex,

    /**
     * Engine state ('stopped', 'running', 'paused')
     * @type {string}
     */
    engineState,

    /**
     * All segments from config
     * @type {Array}
     */
    segments,

    /**
     * Total segment count
     * @type {number}
     */
    totalSegments,

    /**
     * Whether at first segment
     * @type {boolean}
     */
    isFirstSegment,

    /**
     * Whether at last segment
     * @type {boolean}
     */
    isLastSegment,

    /**
     * Override log array
     * @type {Array}
     */
    overrideLog,

    /**
     * Override count
     * @type {number}
     */
    overrideCount,

    /**
     * Full timesheet state object
     * @type {Object}
     */
    timesheetState,

    /**
     * Whether the rundown has been modified since loading
     * @type {boolean}
     */
    rundownModified,

    /**
     * Summary of rundown modifications (added, removed, modified, reordered segments)
     * @type {Object|null}
     */
    rundownModifiedSummary,

    // Actions
    /**
     * Start the timesheet show
     * @type {function(): void}
     */
    start,

    /**
     * Stop the timesheet show
     * @type {function(): void}
     */
    stop,

    /**
     * Advance to next segment
     * @type {function(string): void}
     */
    advance,

    /**
     * Go to previous segment
     * @type {function(string): void}
     */
    previous,

    /**
     * Jump to a specific segment by ID
     * @type {function(string, string): void}
     */
    jumpTo,

    /**
     * Override OBS scene
     * @type {function(string, string): void}
     */
    overrideScene,

    /**
     * Override to camera's scene
     * @type {function(string, string): void}
     */
    overrideCamera,

    /**
     * Clear override log
     * @type {function(): void}
     */
    clearOverrideLog,

    /**
     * Clear rundown modified state
     * @type {function(): void}
     */
    clearRundownModified,

    // Helpers
    /**
     * Format milliseconds as MM:SS
     * @type {function(number): string}
     */
    formatTime
  };
}

export default useTimesheet;
