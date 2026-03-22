import { useCallback } from 'react';

/**
 * usePlayoutActions - Action dispatchers for playout state mutations
 *
 * This hook provides all actions that modify playout state.
 * The same interface will be used in Stage B with socket-based state.
 *
 * Actions add entries to the event log for debugging and display.
 */

// Mock new clips for fetchClips action
const MOCK_NEW_CLIPS = [
  {
    draft_id: 'new-clip-001',
    clip_url: 'https://7f611de901ab5b1fb66ea466991895a9.r2.cloudflarestorage.com/virtius-input/clips/mock-new-001/output.mp4',
    athlete_name: 'New Athlete One',
    athlete_id: 'NewAth001',
    team_name: 'University of Bridgeport',
    team_id: 'KEL-OCerXB7ImLfvYDFWB',
    apparatus: 'FX',
    rotation: 4,
    order: 0,
    score: 9.85,
    duration: 38.5,
    gender: 'womens',
    in_point: 1773610000.000,
    out_point: 1773610038.500,
    competition_name: 'Bridgeport / Yale / SCSU',
    source_video_id: 'SRT4-BRIDGEPORT-FX',
    exported_at: new Date().toISOString()
  },
  {
    draft_id: 'new-clip-002',
    clip_url: 'https://7f611de901ab5b1fb66ea466991895a9.r2.cloudflarestorage.com/virtius-input/clips/mock-new-002/output.mp4',
    athlete_name: 'New Athlete Two',
    athlete_id: 'NewAth002',
    team_name: 'Yale University',
    team_id: 'Rr5ssT6uVw7xYzAaB890C',
    apparatus: 'FX',
    rotation: 4,
    order: 1,
    score: null,
    duration: 40.2,
    gender: 'womens',
    in_point: 1773610050.000,
    out_point: 1773610090.200,
    competition_name: 'Bridgeport / Yale / SCSU',
    source_video_id: 'SRT4-YALE-FX',
    exported_at: new Date().toISOString()
  },
  {
    draft_id: 'new-clip-003',
    clip_url: 'https://7f611de901ab5b1fb66ea466991895a9.r2.cloudflarestorage.com/virtius-input/clips/mock-new-003/output.mp4',
    athlete_name: 'New Athlete Three',
    athlete_id: 'NewAth003',
    team_name: 'Southern Connecticut State University',
    team_id: 'w_-B5txLajZyUHY0YCQIL',
    apparatus: 'FX',
    rotation: 4,
    order: 2,
    score: 9.65,
    duration: 37.8,
    gender: 'womens',
    in_point: 1773610100.000,
    out_point: 1773610137.800,
    competition_name: 'Bridgeport / Yale / SCSU',
    source_video_id: 'SRT4-SCSU-FX',
    exported_at: new Date().toISOString()
  }
];

/**
 * @param {Object} playoutState - State and setters from usePlayoutState
 * @returns {Object} Action dispatchers
 */
export default function usePlayoutActions(playoutState) {
  const {
    clips,
    setClips,
    setCurrentMode,
    setOverrideState,
    setMomentReplay,
    setEventLog,
    CLIP_STATUS,
    PLAYOUT_MODE
  } = playoutState;

  // Helper to add event log entry
  const addLogEntry = useCallback((type, message) => {
    setEventLog(prev => [
      ...prev,
      {
        id: Date.now(),
        timestamp: Date.now(),
        type,
        message
      }
    ]);
  }, [setEventLog]);

  /**
   * Skip the specified clip
   * @param {string} draftId - The draft_id of the clip to skip
   */
  const skipClip = useCallback((draftId) => {
    setClips(prev => prev.map(clip => {
      if (clip.draft_id === draftId) {
        return { ...clip, status: CLIP_STATUS.SKIPPED };
      }
      return clip;
    }));
    addLogEntry('action', `Skipped clip: ${draftId.slice(0, 8)}...`);
  }, [setClips, addLogEntry, CLIP_STATUS]);

  /**
   * Force a specific camera to be shown (override mode)
   * @param {number} cameraNumber - Camera number (1-4)
   */
  const forceCamera = useCallback((cameraNumber) => {
    setOverrideState({
      active: true,
      type: 'camera',
      cameraNumber,
      startedAt: Date.now()
    });
    setCurrentMode(PLAYOUT_MODE.OVERRIDE);
    addLogEntry('override', `Forced camera ${cameraNumber}`);
  }, [setOverrideState, setCurrentMode, addLogEntry, PLAYOUT_MODE]);

  /**
   * Release the current override and return to normal playout
   */
  const releaseOverride = useCallback(() => {
    setOverrideState({
      active: false,
      type: null,
      cameraNumber: null,
      startedAt: null
    });
    setCurrentMode(PLAYOUT_MODE.CLIP);
    addLogEntry('override', 'Released override, returning to clip mode');
  }, [setOverrideState, setCurrentMode, addLogEntry, PLAYOUT_MODE]);

  /**
   * Pause playout (clips stop advancing)
   */
  const pausePlayout = useCallback(() => {
    setCurrentMode(PLAYOUT_MODE.PAUSED);
    addLogEntry('system', 'Playout paused');
  }, [setCurrentMode, addLogEntry, PLAYOUT_MODE]);

  /**
   * Resume playout from pause
   */
  const resumePlayout = useCallback(() => {
    setCurrentMode(PLAYOUT_MODE.CLIP);
    addLogEntry('system', 'Playout resumed');
  }, [setCurrentMode, addLogEntry, PLAYOUT_MODE]);

  /**
   * Stop playout completely
   */
  const stopPlayout = useCallback(() => {
    setCurrentMode(PLAYOUT_MODE.FALLBACK);
    setOverrideState({
      active: false,
      type: null,
      cameraNumber: null,
      startedAt: null
    });
    addLogEntry('system', 'Playout stopped');
  }, [setCurrentMode, setOverrideState, addLogEntry, PLAYOUT_MODE]);

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
    const clip = clips.find(c => c.draft_id === draftId);
    const athleteName = clip?.athlete_name || 'Unknown';
    const duration = (seekEnd - seekStart) / speed;

    const momentData = {
      draftId,
      seekStart,
      seekEnd,
      speed,
      duration,
      athleteName,
      queuedAt: Date.now(),
      playNow
    };

    if (playNow) {
      setMomentReplay(momentData);
      addLogEntry('moment', `Queued moment replay: ${athleteName} (${duration.toFixed(1)}s at ${speed}x) - Play Now`);
    } else {
      // Save only - in Stage B this would save to a moments collection
      addLogEntry('moment', `Saved moment: ${athleteName} (${seekStart.toFixed(1)}s - ${seekEnd.toFixed(1)}s at ${speed}x)`);
    }
  }, [clips, setMomentReplay, addLogEntry]);

  /**
   * Add a clip back to the queue (e.g., re-queue a skipped or shown-live clip)
   * @param {string} draftId - The draft_id of the clip to add
   */
  const addToQueue = useCallback((draftId) => {
    setClips(prev => prev.map(clip => {
      if (clip.draft_id === draftId) {
        return { ...clip, status: CLIP_STATUS.QUEUED };
      }
      return clip;
    }));
    const clip = clips.find(c => c.draft_id === draftId);
    addLogEntry('action', `Added to queue: ${clip?.athlete_name || draftId.slice(0, 8)}`);
  }, [clips, setClips, addLogEntry, CLIP_STATUS]);

  /**
   * Retry a failed clip
   * @param {string} draftId - The draft_id of the clip to retry
   */
  const retryClip = useCallback((draftId) => {
    setClips(prev => prev.map(clip => {
      if (clip.draft_id === draftId) {
        return { ...clip, status: CLIP_STATUS.QUEUED };
      }
      return clip;
    }));
    const clip = clips.find(c => c.draft_id === draftId);
    addLogEntry('action', `Retrying clip: ${clip?.athlete_name || draftId.slice(0, 8)}`);
  }, [clips, setClips, addLogEntry, CLIP_STATUS]);

  /**
   * Retry all failed clips
   */
  const retryAllFailed = useCallback(() => {
    let count = 0;
    setClips(prev => prev.map(clip => {
      if (clip.status === CLIP_STATUS.FAILED) {
        count++;
        return { ...clip, status: CLIP_STATUS.QUEUED };
      }
      return clip;
    }));
    addLogEntry('action', `Retrying ${count} failed clip${count !== 1 ? 's' : ''}`);
  }, [setClips, addLogEntry, CLIP_STATUS]);

  /**
   * Fetch new clips from Clip Engine (mock: adds 2-3 new clips)
   * In Stage B, this triggers a real API call to the Clip Engine
   */
  const fetchClips = useCallback(() => {
    // Simulate network delay
    addLogEntry('system', 'Fetching new clips from Clip Engine...');

    // In mock mode, immediately add the new clips
    setTimeout(() => {
      // Pick 2-3 random clips from mock data
      const numClips = 2 + Math.floor(Math.random() * 2); // 2 or 3
      const newClips = MOCK_NEW_CLIPS.slice(0, numClips).map(clip => ({
        ...clip,
        // Ensure unique IDs on each fetch
        draft_id: `${clip.draft_id}-${Date.now()}`,
        status: CLIP_STATUS.QUEUED,
        shown_live: false,
        elapsed: null,
        scoreRevealed: false
      }));

      setClips(prev => [...prev, ...newClips]);
      addLogEntry('clip', `Loaded ${numClips} new clip${numClips !== 1 ? 's' : ''} from Clip Engine`);
    }, 500);
  }, [setClips, addLogEntry, CLIP_STATUS]);

  return {
    skipClip,
    forceCamera,
    releaseOverride,
    pausePlayout,
    resumePlayout,
    stopPlayout,
    flagMoment,
    addToQueue,
    retryClip,
    retryAllFailed,
    fetchClips
  };
}
