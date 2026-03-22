import { useState, useMemo } from 'react';
import fixtureData from '../../../docs/PRD-Clip-Integration/fixtures/sample-response.json';

/**
 * usePlayoutState - Mock playout state for Stage A development
 *
 * This hook will be REPLACED with socket-based state in Stage B.
 * It provides the same interface that Stage B will implement.
 *
 * State shapes follow PRD Section 5: Firebase currentGraphic data shapes
 */

// Clip status enum matching PRD lifecycle
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

// Mock team logos from known Virtius media URLs
const TEAM_LOGOS = {
  'University of Bridgeport': 'https://media.virti.us/upload/images/team/bridgeport-logo.png',
  'Yale University': 'https://media.virti.us/upload/images/team/yale-logo.png',
  'Southern Connecticut State University': 'https://media.virti.us/upload/images/team/scsu-logo.png'
};

// Initialize clips from fixture with status and shown_live enrichment
function initializeClipsFromFixture(rawClips) {
  // Indices of clips to mark as shown_live (for testing Shown Live tab)
  const shownLiveIndices = [2, 7, 15];

  return rawClips.map((clip, index) => {
    // Determine initial status
    let status = CLIP_STATUS.QUEUED;
    let shownLive = false;

    // Mark first clip as playing
    if (index === 0) {
      status = CLIP_STATUS.PLAYING;
    }
    // Mark some clips as shown_live (as if they were broadcast before clip was ready)
    else if (shownLiveIndices.includes(index)) {
      status = CLIP_STATUS.SHOWN_LIVE;
      shownLive = true;
    }
    // Mark one clip as failed for testing retry flow
    else if (index === 5) {
      status = CLIP_STATUS.FAILED;
    }
    // Mark one as pending (still encoding)
    else if (index === 22) {
      status = CLIP_STATUS.PENDING;
    }

    return {
      ...clip,
      // Add team logo based on team name
      teamLogo: TEAM_LOGOS[clip.team_name] || null,
      // Add clip status
      status,
      // Add shown_live flag (enriched by coordinator in Stage B)
      shown_live: shownLive,
      // Elapsed time for playing clip
      elapsed: status === CLIP_STATUS.PLAYING ? 0 : null,
      // Score reveal triggered flag
      scoreRevealed: false
    };
  });
}

// Initialize camera states (4 cameras)
function initializeCameraStates() {
  const now = Date.now();

  return [
    {
      cameraNumber: 1,
      apparatus: 'VT',
      state: CAMERA_STATE.RECORDING,
      startedAt: now - 15000,  // Started 15 seconds ago
      athleteName: 'Recording routine...'
    },
    {
      cameraNumber: 2,
      apparatus: 'UB',
      state: CAMERA_STATE.IDLE,
      startedAt: null,
      athleteName: null
    },
    {
      cameraNumber: 3,
      apparatus: 'BB',
      state: CAMERA_STATE.RECORDING,
      startedAt: now - 45000,  // Started 45 seconds ago
      athleteName: 'Recording routine...'
    },
    {
      cameraNumber: 4,
      apparatus: 'FX',
      state: CAMERA_STATE.IDLE,
      startedAt: null,
      athleteName: null
    }
  ];
}

export default function usePlayoutState() {
  // Core playout state
  const [isPlayoutActive, setIsPlayoutActive] = useState(true);
  const [currentMode, setCurrentMode] = useState(PLAYOUT_MODE.CLIP);

  // Clip queue state - initialized from fixture
  const [clips, setClips] = useState(() => initializeClipsFromFixture(fixtureData.clips));

  // Camera states
  const [cameraStates, setCameraStates] = useState(() => initializeCameraStates());

  // Override state (when producer forces a specific camera/mode)
  const [overrideState, setOverrideState] = useState({
    active: false,
    type: null,           // 'camera' | 'pause' | null
    cameraNumber: null,   // Which camera is forced (1-4)
    startedAt: null       // When override started
  });

  // Preload state for next clip
  const [preloadState, setPreloadState] = useState({
    state: PRELOAD_STATE.NONE,
    clipId: null,
    progress: 0           // 0-100 for progress bar
  });

  // Coordinator heartbeat (for connection health indicator)
  const [coordinatorHeartbeat, setCoordinatorHeartbeat] = useState({
    lastSeen: Date.now(),
    connected: true,
    latency: 45           // ms
  });

  // Moment replay state (for when a replay is queued/playing)
  const [momentReplay, setMomentReplay] = useState(null);

  // Event log for debugging and display
  const [eventLog, setEventLog] = useState([
    {
      id: 1,
      timestamp: Date.now() - 60000,
      type: 'system',
      message: 'Playout started'
    },
    {
      id: 2,
      timestamp: Date.now() - 30000,
      type: 'clip',
      message: 'Loaded 23 clips from Clip Engine'
    }
  ]);

  // Derived state: current playing clip
  const currentClip = useMemo(() => {
    return clips.find(c => c.status === CLIP_STATUS.PLAYING) || null;
  }, [clips]);

  // Derived state: next clip in queue (for preloading)
  const nextClip = useMemo(() => {
    if (!currentClip) return null;
    const currentIndex = clips.findIndex(c => c.draft_id === currentClip.draft_id);
    // Find next queued clip after current
    for (let i = currentIndex + 1; i < clips.length; i++) {
      if (clips[i].status === CLIP_STATUS.QUEUED) {
        return clips[i];
      }
    }
    return null;
  }, [clips, currentClip]);

  // Derived state: clip queue organized by status
  const clipQueue = useMemo(() => {
    return {
      all: clips,
      queued: clips.filter(c => c.status === CLIP_STATUS.QUEUED),
      playing: clips.filter(c => c.status === CLIP_STATUS.PLAYING),
      played: clips.filter(c => c.status === CLIP_STATUS.PLAYED),
      shownLive: clips.filter(c => c.status === CLIP_STATUS.SHOWN_LIVE || c.shown_live),
      skipped: clips.filter(c => c.status === CLIP_STATUS.SKIPPED),
      failed: clips.filter(c => c.status === CLIP_STATUS.FAILED),
      stalled: clips.filter(c => c.status === CLIP_STATUS.STALLED),
      pending: clips.filter(c => c.status === CLIP_STATUS.PENDING)
    };
  }, [clips]);

  // Derived: nextClipUrl for currentGraphic data shape
  const nextClipUrl = useMemo(() => {
    return nextClip?.clip_url || null;
  }, [nextClip]);

  return {
    // Core state
    isPlayoutActive,
    setIsPlayoutActive,
    currentMode,
    setCurrentMode,

    // Clips
    clips,
    setClips,
    currentClip,
    nextClip,
    nextClipUrl,
    clipQueue,

    // Cameras
    cameraStates,
    setCameraStates,

    // Override
    overrideState,
    setOverrideState,

    // Preload
    preloadState,
    setPreloadState,

    // Coordinator health
    coordinatorHeartbeat,
    setCoordinatorHeartbeat,

    // Moment replay
    momentReplay,
    setMomentReplay,

    // Event log
    eventLog,
    setEventLog,

    // Constants for external use
    CLIP_STATUS,
    CAMERA_STATE,
    PRELOAD_STATE,
    PLAYOUT_MODE
  };
}
