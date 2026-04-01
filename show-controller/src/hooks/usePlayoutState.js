import { useState, useEffect, useMemo, useCallback } from 'react';
import { useShow } from '../context/ShowContext';

/**
 * usePlayoutState - Socket-based playout state from coordinator
 *
 * Connects to the coordinator via Socket.io and receives playout state
 * broadcasts. State is managed server-side by playoutEngine.js.
 *
 * State shapes follow PRD Section 5: Firebase currentGraphic data shapes.
 * This hook was refactored in Stage B from mock data to real socket state.
 */

// Clip status enum matching PRD lifecycle (exported for use by components)
const CLIP_STATUS = {
  PENDING: 'pending',      // Clip exists but not ready (e.g., still encoding)
  QUEUED: 'queued',        // Ready to play, in the queue
  PLAYING: 'playing',      // Currently playing
  PLAYED: 'played',        // Finished successfully
  SHOWN_LIVE: 'shown-live', // Was shown live, auto-skipped
  SKIPPED: 'skipped',      // Manually skipped by producer
  FAILED: 'failed',        // Error loading clip
  STALLED: 'stalled'       // Started but got stuck
};

// Camera states matching PRD
const CAMERA_STATE = {
  IDLE: 'idle',            // No activity on this camera
  RECORDING: 'recording',  // Routine in progress, being recorded
  LIVE: 'live',            // Currently being shown on stream
  RECORDING_LIVE: 'recording-live' // Recording AND shown live simultaneously
};

// Preload states matching PRD
const PRELOAD_STATE = {
  NONE: 'none',            // No clip is being preloaded
  PRELOADING: 'preloading', // Next clip URL is being loaded
  PRELOAD_READY: 'preload-ready', // Next clip is fully buffered
  PRELOAD_FAILED: 'preload-failed' // Preload failed
};

// Playout modes matching PRD
const PLAYOUT_MODE = {
  CLIP: 'CLIP',
  LIVE: 'LIVE',
  MOMENT_REPLAY: 'MOMENT_REPLAY',
  FALLBACK: 'FALLBACK',
  BREAK: 'BREAK',
  OVERRIDE: 'OVERRIDE',
  PAUSED: 'PAUSED'
};

// Initial state when no server connection or engine not active
const INITIAL_STATE = {
  isPlayoutActive: false,
  engineState: 'stopped',
  currentMode: PLAYOUT_MODE.FALLBACK,
  clips: [],
  currentClip: null,
  nextClip: null,
  clipQueue: {
    all: [],
    queued: [],
    playing: [],
    played: [],
    shownLive: [],
    skipped: [],
    failed: [],
    stalled: [],
    pending: []
  },
  cameraStates: [
    { cameraNumber: 1, apparatus: 'VT', state: CAMERA_STATE.IDLE, startedAt: null, athleteName: null },
    { cameraNumber: 2, apparatus: 'UB', state: CAMERA_STATE.IDLE, startedAt: null, athleteName: null },
    { cameraNumber: 3, apparatus: 'BB', state: CAMERA_STATE.IDLE, startedAt: null, athleteName: null },
    { cameraNumber: 4, apparatus: 'FX', state: CAMERA_STATE.IDLE, startedAt: null, athleteName: null }
  ],
  overrideState: {
    active: false,
    type: null,
    cameraNumber: null,
    startedAt: null
  },
  preloadState: {
    state: PRELOAD_STATE.NONE,
    clipId: null,
    progress: 0
  },
  coordinatorHeartbeat: {
    lastSeen: null,
    connected: false
  },
  clipApiFetch: {
    lastFetchAt: null,
    result: null,
    totalClips: 0
  },
  momentReplay: null,
  momentReplayQueue: [],
  eventLog: [],
  lastApiError: null
};

export default function usePlayoutState() {
  const { socket } = useShow();

  // Core state from server
  const [serverState, setServerState] = useState(INITIAL_STATE);

  // Local override for setIsPlayoutActive (allows UI to toggle before server confirms)
  const [localPlayoutOverride, setLocalPlayoutOverride] = useState(null);

  // Handle playout:stateUpdate events from coordinator
  useEffect(() => {
    if (!socket) return;

    const handleStateUpdate = (state) => {
      console.log('[usePlayoutState] Received playout:stateUpdate', {
        compId: state.compId,
        isPlayoutActive: state.isPlayoutActive,
        engineState: state.engineState,
        currentMode: state.currentMode,
        clipsCount: state.clips?.length || 0
      });

      // Transform server state to match our interface
      setServerState({
        isPlayoutActive: state.isPlayoutActive ?? false,
        engineState: state.engineState ?? 'stopped',
        currentMode: state.currentMode ?? PLAYOUT_MODE.FALLBACK,
        clips: state.clips ?? [],
        currentClip: state.currentClip ?? null,
        nextClip: state.nextClip ?? null,
        clipQueue: state.clipQueue ?? INITIAL_STATE.clipQueue,
        cameraStates: state.cameraStates ?? INITIAL_STATE.cameraStates,
        overrideState: state.overrideState ?? INITIAL_STATE.overrideState,
        preloadState: state.preloadState ?? INITIAL_STATE.preloadState,
        coordinatorHeartbeat: state.coordinatorHeartbeat ?? { lastSeen: Date.now(), connected: true },
        clipApiFetch: state.clipApiFetch ?? INITIAL_STATE.clipApiFetch,
        momentReplay: state.momentReplay ?? null,
        momentReplayQueue: state.momentReplayQueue ?? [],
        eventLog: state.eventLog ?? [],
        lastApiError: state.lastApiError ?? null
      });

      // Clear local override when server confirms state
      setLocalPlayoutOverride(null);
    };

    const handleModeChange = (data) => {
      console.log('[usePlayoutState] Received playout:modeChange', data);
      setServerState(prev => ({
        ...prev,
        currentMode: data.mode ?? prev.currentMode
      }));
    };

    const handleQueueUpdate = (data) => {
      console.log('[usePlayoutState] Received playout:clipQueueUpdate', {
        clipsCount: data.clips?.length || 0
      });
      setServerState(prev => ({
        ...prev,
        clips: data.clips ?? prev.clips,
        clipQueue: data.clipQueue ?? prev.clipQueue,
        currentClip: data.currentClip ?? prev.currentClip,
        nextClip: data.nextClip ?? prev.nextClip
      }));
    };

    const handleError = (error) => {
      console.error('[usePlayoutState] Received playout:error', error);
      setServerState(prev => ({
        ...prev,
        lastApiError: error.message ?? 'Unknown error'
      }));
    };

    // Register event listeners
    socket.on('playout:stateUpdate', handleStateUpdate);
    socket.on('playout:modeChange', handleModeChange);
    socket.on('playout:clipQueueUpdate', handleQueueUpdate);
    socket.on('playout:error', handleError);

    // Request initial state when socket connects
    socket.emit('playout:getState');

    return () => {
      socket.off('playout:stateUpdate', handleStateUpdate);
      socket.off('playout:modeChange', handleModeChange);
      socket.off('playout:clipQueueUpdate', handleQueueUpdate);
      socket.off('playout:error', handleError);
    };
  }, [socket]);

  // Effective isPlayoutActive (local override takes precedence for UI responsiveness)
  const isPlayoutActive = localPlayoutOverride !== null
    ? localPlayoutOverride
    : serverState.isPlayoutActive;

  // setIsPlayoutActive - sets local override and will emit socket event via usePlayoutActions
  const setIsPlayoutActive = useCallback((value) => {
    setLocalPlayoutOverride(value);
  }, []);

  // Derived state: next clip URL for preloading
  const nextClipUrl = useMemo(() => {
    return serverState.nextClip?.clip_url || null;
  }, [serverState.nextClip]);

  // These setters are provided for compatibility but are no-ops in socket mode
  // (state is controlled by server; actions should use usePlayoutActions)
  const noopSetter = useCallback(() => {
    console.warn('[usePlayoutState] State setters are no-ops in socket mode. Use usePlayoutActions instead.');
  }, []);

  return {
    // Core state
    isPlayoutActive,
    setIsPlayoutActive,
    currentMode: serverState.currentMode,
    setCurrentMode: noopSetter, // No-op: use socket actions

    // Clips
    clips: serverState.clips,
    setClips: noopSetter, // No-op: use socket actions
    currentClip: serverState.currentClip,
    nextClip: serverState.nextClip,
    nextClipUrl,
    clipQueue: serverState.clipQueue,

    // Cameras
    cameraStates: serverState.cameraStates,
    setCameraStates: noopSetter, // No-op: server-managed

    // Override
    overrideState: serverState.overrideState,
    setOverrideState: noopSetter, // No-op: use socket actions

    // Preload
    preloadState: serverState.preloadState,
    setPreloadState: noopSetter, // No-op: server-managed

    // Coordinator health
    coordinatorHeartbeat: serverState.coordinatorHeartbeat,
    setCoordinatorHeartbeat: noopSetter, // No-op: server-managed

    // Clip API polling health
    clipApiFetch: serverState.clipApiFetch,

    // Moment replay
    momentReplay: serverState.momentReplay,
    setMomentReplay: noopSetter, // No-op: use socket actions

    // Event log
    eventLog: serverState.eventLog,
    setEventLog: noopSetter, // No-op: server-managed

    // API error state
    lastApiError: serverState.lastApiError,

    // Constants for external use
    CLIP_STATUS,
    CAMERA_STATE,
    PRELOAD_STATE,
    PLAYOUT_MODE
  };
}
