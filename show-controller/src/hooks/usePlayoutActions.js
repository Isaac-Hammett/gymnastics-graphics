import { useCallback } from 'react';
import { useShow } from '../context/ShowContext';

/**
 * usePlayoutActions - Socket-based action dispatchers for playout
 *
 * This hook provides all actions that modify playout state via socket events.
 * Actions are sent to the coordinator's playoutEngine which manages state
 * server-side and broadcasts updates to all connected clients.
 *
 * Refactored in Stage B from local state mutations to socket emissions.
 */

/**
 * @returns {Object} Action dispatchers
 */
export default function usePlayoutActions() {
  const { socket } = useShow();

  /**
   * Skip the specified clip
   * @param {string} draftId - The draft_id of the clip to skip
   */
  const skipClip = useCallback((draftId) => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot skip clip');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:skipClip', { draftId });
    socket.emit('playout:skipClip', { draftId });
  }, [socket]);

  /**
   * Force a specific camera to be shown (override mode)
   * @param {number} cameraNumber - Camera number (1-4)
   */
  const forceCamera = useCallback((cameraNumber) => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot force camera');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:forceCamera', { cameraNumber });
    socket.emit('playout:forceCamera', { cameraNumber });
  }, [socket]);

  /**
   * Release the current override and return to the mode that was active before
   */
  const releaseOverride = useCallback(() => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot release override');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:releaseOverride');
    socket.emit('playout:releaseOverride');
  }, [socket]);

  /**
   * Pause playout (clips stop advancing)
   */
  const pausePlayout = useCallback(() => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot pause playout');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:pause');
    socket.emit('playout:pause');
  }, [socket]);

  /**
   * Resume playout from pause
   */
  const resumePlayout = useCallback(() => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot resume playout');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:resume');
    socket.emit('playout:resume');
  }, [socket]);

  /**
   * Stop playout completely
   */
  const stopPlayout = useCallback(() => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot stop playout');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:stop');
    socket.emit('playout:stop');
  }, [socket]);

  /**
   * Start playout (activates the engine)
   * @param {string} [sessionKey] - Optional session key for Clip Engine API
   */
  const startPlayout = useCallback((sessionKey) => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot start playout');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:start', { sessionKey });
    socket.emit('playout:start', { sessionKey });
  }, [socket]);

  /**
   * Flag a moment for replay
   * @param {Object} moment - Moment configuration
   * @param {string} moment.draftId - The clip's draft_id
   * @param {number} moment.seekStart - Start time in seconds
   * @param {number} moment.seekEnd - End time in seconds
   * @param {number} moment.speed - Playback speed (0.25, 0.5, 1.0)
   * @param {boolean} moment.playNow - If true, play immediately after current clip
   */
  const flagMoment = useCallback(({ draftId, seekStart, seekEnd, speed = 1.0, playNow = false }) => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot flag moment');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:flagMoment', { draftId, seekStart, seekEnd, speed, playNow });
    socket.emit('playout:flagMoment', { draftId, seekStart, seekEnd, speed, playNow });
  }, [socket]);

  /**
   * Add a clip back to the queue (e.g., re-queue a skipped or shown-live clip)
   * @param {string} draftId - The draft_id of the clip to add
   */
  const addToQueue = useCallback((draftId) => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot add to queue');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:addToQueue', { draftId });
    socket.emit('playout:addToQueue', { draftId });
  }, [socket]);

  /**
   * Retry a failed clip
   * @param {string} draftId - The draft_id of the clip to retry
   */
  const retryClip = useCallback((draftId) => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot retry clip');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:retryClip', { draftId });
    socket.emit('playout:retryClip', { draftId });
  }, [socket]);

  /**
   * Retry all failed clips
   */
  const retryAllFailed = useCallback(() => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot retry all failed');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:retryAllFailed');
    socket.emit('playout:retryAllFailed');
  }, [socket]);

  /**
   * Fetch new clips from Clip Engine
   * In Stage B, this triggers a real API call to the Clip Engine via the server
   */
  const fetchClips = useCallback(() => {
    if (!socket) {
      console.warn('[usePlayoutActions] No socket connection, cannot fetch clips');
      return;
    }
    console.log('[usePlayoutActions] Emitting playout:fetchClips');
    socket.emit('playout:fetchClips');
  }, [socket]);

  return {
    skipClip,
    forceCamera,
    releaseOverride,
    pausePlayout,
    resumePlayout,
    stopPlayout,
    startPlayout,
    flagMoment,
    addToQueue,
    retryClip,
    retryAllFailed,
    fetchClips
  };
}
