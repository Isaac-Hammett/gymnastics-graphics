/**
 * Playout Engine Module
 *
 * Manages clip-based playout flow for gymnastics productions:
 * - Clip queue management with priority stack evaluation
 * - Mode state machine (CLIP, LIVE, MOMENT_REPLAY, FALLBACK, BREAK, OVERRIDE, PAUSED)
 * - Auto-advance on clip completion (via Firebase write-back from output.html)
 * - Heartbeat writer (5s interval) for health monitoring
 * - Queue persistence to Firebase for recovery after coordinator restart
 * - Event logging for post-meet analysis
 *
 * Firebase paths used:
 *   competitions/{compId}/config/sessionKey — Clip Engine session key
 *   competitions/{compId}/production/currentGraphic — What output.html renders
 *   competitions/{compId}/production/playoutState — Engine state (mode, overrides)
 *   competitions/{compId}/production/clipQueue — Persisted queue (recovery)
 *   competitions/{compId}/production/clipStatus/{draftId} — Write-back from output.html
 *   competitions/{compId}/production/engineHeartbeat — { timestamp, mode } every 5s
 *
 * @module playoutEngine
 */

import { EventEmitter } from 'events';
import { fetchClips, fetchNewClips } from './clipService.js';

// ============================================================================
// Constants
// ============================================================================

// Playout modes (state machine states)
export const PLAYOUT_MODE = {
  CLIP: 'CLIP',
  LIVE: 'LIVE',
  MOMENT_REPLAY: 'MOMENT_REPLAY',
  FALLBACK: 'FALLBACK',
  BREAK: 'BREAK',
  OVERRIDE: 'OVERRIDE',
  PAUSED: 'PAUSED'
};

// Clip lifecycle status
export const CLIP_STATUS = {
  PENDING: 'pending',      // Still encoding / not ready
  QUEUED: 'queued',        // Ready to play
  PLAYING: 'playing',      // Currently playing
  PLAYED: 'played',        // Finished successfully
  SHOWN_LIVE: 'shown-live', // Was shown live, auto-skipped
  SKIPPED: 'skipped',      // Manually skipped
  FAILED: 'failed',        // Error loading
  STALLED: 'stalled'       // Started but got stuck
};

// Camera states
export const CAMERA_STATE = {
  IDLE: 'idle',
  RECORDING: 'recording',
  LIVE: 'live',
  RECORDING_LIVE: 'recording-live'
};

// Preload states
export const PRELOAD_STATE = {
  NONE: 'none',
  PRELOADING: 'preloading',
  PRELOAD_READY: 'preload-ready',
  PRELOAD_FAILED: 'preload-failed'
};

// Engine states
const ENGINE_STATE = {
  STOPPED: 'stopped',
  RUNNING: 'running',
  PAUSED: 'paused'
};

// Timing constants (from PRD)
const HEARTBEAT_INTERVAL_MS = 5000;      // 5 seconds
const CLIP_POLL_INTERVAL_MS = 15000;     // 15 seconds
const CLIP_STATUS_CLEANUP_DELAY_MS = 500; // Delay before cleaning up clipStatus

// ============================================================================
// PlayoutEngine Class
// ============================================================================

/**
 * PlayoutEngine - Manages clip-based playout flow
 *
 * Events emitted:
 * - 'started': Engine started for a competition
 * - 'stopped': Engine stopped
 * - 'stateChanged': Engine state changed (running/paused/stopped)
 * - 'modeChanged': Playout mode changed (CLIP/LIVE/FALLBACK/etc)
 * - 'clipAdvanced': Moved to next clip
 * - 'queueUpdated': Clip queue changed (new clips, status changes)
 * - 'error': Error occurred
 * - 'heartbeat': Heartbeat written
 */
export class PlayoutEngine extends EventEmitter {
  /**
   * Create a new PlayoutEngine
   * @param {Object} options - Configuration options
   * @param {string} options.compId - Competition ID
   * @param {Object} options.firebase - Firebase Admin database reference
   * @param {Object} options.io - Socket.io server for broadcasting
   * @param {Object} options.obsConnectionManager - OBS connection manager (optional)
   */
  constructor(options = {}) {
    super();

    this.compId = options.compId;
    this.firebase = options.firebase;
    this.io = options.io;
    this.obsConnectionManager = options.obsConnectionManager;

    // Core state
    this._state = ENGINE_STATE.STOPPED;
    this._mode = PLAYOUT_MODE.FALLBACK;
    this._sessionKey = null;

    // Clip queue (ordered array)
    this._clips = [];
    this._clipDraftIds = new Set(); // For deduplication

    // Current clip being played
    this._currentClip = null;
    this._clipStartTime = null;

    // Override state
    this._override = {
      active: false,
      type: null,      // 'camera' | 'pause' | null
      cameraNumber: null,
      startedAt: null
    };

    // Camera states (4 cameras for women's gymnastics)
    this._cameraStates = [
      { cameraNumber: 1, apparatus: 'VT', state: CAMERA_STATE.IDLE, startedAt: null, athleteName: null },
      { cameraNumber: 2, apparatus: 'UB', state: CAMERA_STATE.IDLE, startedAt: null, athleteName: null },
      { cameraNumber: 3, apparatus: 'BB', state: CAMERA_STATE.IDLE, startedAt: null, athleteName: null },
      { cameraNumber: 4, apparatus: 'FX', state: CAMERA_STATE.IDLE, startedAt: null, athleteName: null }
    ];

    // Moment replay queue (pending replays to play)
    this._momentReplayQueue = [];
    this._currentMomentReplay = null;

    // Preload state
    this._preloadState = {
      state: PRELOAD_STATE.NONE,
      clipId: null,
      progress: 0
    };

    // Event log (circular buffer, keep last 100 entries)
    this._eventLog = [];
    this._maxEventLogSize = 100;

    // Timers
    this._heartbeatTimer = null;
    this._clipPollTimer = null;
    this._clipStatusListener = null;

    // Track last API error for health indicator
    this._lastApiError = null;

    console.log(`[PlayoutEngine] Created for competition ${this.compId}`);
  }

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  get state() {
    return this._state;
  }

  get mode() {
    return this._mode;
  }

  get isRunning() {
    return this._state === ENGINE_STATE.RUNNING;
  }

  get currentClip() {
    return this._currentClip;
  }

  get clips() {
    return [...this._clips];
  }

  get clipQueue() {
    return {
      all: this._clips,
      queued: this._clips.filter(c => c.status === CLIP_STATUS.QUEUED),
      playing: this._clips.filter(c => c.status === CLIP_STATUS.PLAYING),
      played: this._clips.filter(c => c.status === CLIP_STATUS.PLAYED),
      shownLive: this._clips.filter(c => c.status === CLIP_STATUS.SHOWN_LIVE || c.shown_live),
      skipped: this._clips.filter(c => c.status === CLIP_STATUS.SKIPPED),
      failed: this._clips.filter(c => c.status === CLIP_STATUS.FAILED),
      stalled: this._clips.filter(c => c.status === CLIP_STATUS.STALLED),
      pending: this._clips.filter(c => c.status === CLIP_STATUS.PENDING)
    };
  }

  get cameraStates() {
    return [...this._cameraStates];
  }

  get overrideState() {
    return { ...this._override };
  }

  get preloadState() {
    return { ...this._preloadState };
  }

  get momentReplay() {
    return this._currentMomentReplay;
  }

  get eventLog() {
    return [...this._eventLog];
  }

  get lastApiError() {
    return this._lastApiError;
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Start the playout engine for this competition
   * @param {string} sessionKey - Clip Engine session key (optional, will be fetched from Firebase if not provided)
   */
  async start(sessionKey = null) {
    if (this._state !== ENGINE_STATE.STOPPED) {
      console.log(`[PlayoutEngine] Already running for ${this.compId}`);
      return;
    }

    console.log(`[PlayoutEngine] Starting for ${this.compId}`);

    try {
      // Get session key from parameter or Firebase config
      this._sessionKey = sessionKey;
      if (!this._sessionKey && this.firebase) {
        const configRef = this.firebase.ref(`competitions/${this.compId}/config/sessionKey`);
        const snapshot = await configRef.once('value');
        this._sessionKey = snapshot.val();
      }

      if (!this._sessionKey) {
        console.warn(`[PlayoutEngine] No session key for ${this.compId}, starting in degraded mode (no clips)`);
        this._logEvent('warning', 'Started in degraded mode - no session key');
      }

      // Restore persisted queue if available
      await this._restoreQueue();

      // Fetch initial clips if we have a session key
      if (this._sessionKey) {
        await this._fetchClips();
      }

      // Set up clip status listener for write-backs from output.html
      this._setupClipStatusListener();

      // Start timers
      this._startHeartbeat();
      this._startClipPolling();

      // Update state
      this._state = ENGINE_STATE.RUNNING;
      this._evaluatePriorityStack();

      // Persist initial state
      await this._persistState();

      this.emit('started', { compId: this.compId, mode: this._mode });
      this._logEvent('system', 'Playout engine started');
      this._broadcastState();

      console.log(`[PlayoutEngine] Started for ${this.compId} with ${this._clips.length} clips`);
    } catch (error) {
      console.error(`[PlayoutEngine] Failed to start for ${this.compId}:`, error.message);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the playout engine
   */
  async stop() {
    if (this._state === ENGINE_STATE.STOPPED) {
      return;
    }

    console.log(`[PlayoutEngine] Stopping for ${this.compId}`);

    // Stop timers
    this._stopHeartbeat();
    this._stopClipPolling();
    this._removeClipStatusListener();

    // Mark current clip as skipped if playing
    if (this._currentClip) {
      this._updateClipStatus(this._currentClip.draft_id, CLIP_STATUS.SKIPPED);
      this._currentClip = null;
    }

    // Update state
    this._state = ENGINE_STATE.STOPPED;
    this._mode = PLAYOUT_MODE.FALLBACK;

    // Persist final state
    await this._persistState();

    this.emit('stopped', { compId: this.compId });
    this._logEvent('system', 'Playout engine stopped');
    this._broadcastState();
  }

  /**
   * Pause playout (keeps current clip visible but doesn't auto-advance)
   */
  pause() {
    if (this._state !== ENGINE_STATE.RUNNING) return;

    this._state = ENGINE_STATE.PAUSED;
    const previousMode = this._mode;
    this._mode = PLAYOUT_MODE.PAUSED;

    this.emit('stateChanged', { previousState: ENGINE_STATE.RUNNING, newState: ENGINE_STATE.PAUSED });
    this._logEvent('control', 'Playout paused');
    this._broadcastState();
  }

  /**
   * Resume playout from paused state
   */
  resume() {
    if (this._state !== ENGINE_STATE.PAUSED) return;

    this._state = ENGINE_STATE.RUNNING;
    this._evaluatePriorityStack();

    this.emit('stateChanged', { previousState: ENGINE_STATE.PAUSED, newState: ENGINE_STATE.RUNNING });
    this._logEvent('control', 'Playout resumed');
    this._broadcastState();
  }

  /**
   * Skip current clip and advance to next
   * @param {string} draftId - Draft ID of clip to skip (must match current)
   */
  skipClip(draftId) {
    if (!this._currentClip || this._currentClip.draft_id !== draftId) {
      console.warn(`[PlayoutEngine] Cannot skip clip ${draftId} - not current clip`);
      return;
    }

    this._updateClipStatus(draftId, CLIP_STATUS.SKIPPED);
    this._logEvent('control', `Skipped clip: ${this._currentClip.athlete_name}`);
    this._advanceToNextClip();
  }

  /**
   * Force a specific camera to be shown (override mode)
   * @param {number} cameraNumber - Camera number (1-4)
   */
  forceCamera(cameraNumber) {
    if (cameraNumber < 1 || cameraNumber > 4) {
      console.warn(`[PlayoutEngine] Invalid camera number: ${cameraNumber}`);
      return;
    }

    this._override = {
      active: true,
      type: 'camera',
      cameraNumber,
      startedAt: Date.now()
    };

    const previousMode = this._mode;
    this._mode = PLAYOUT_MODE.OVERRIDE;

    // Write live-camera graphic to Firebase
    const camera = this._cameraStates.find(c => c.cameraNumber === cameraNumber);
    this._writeCurrentGraphic({
      graphic: 'live-camera',
      data: { apparatus: camera?.apparatus || 'VT' }
    });

    this.emit('modeChanged', { previousMode, newMode: PLAYOUT_MODE.OVERRIDE });
    this._logEvent('control', `Forced camera ${cameraNumber} (${camera?.apparatus || 'unknown'})`);
    this._broadcastState();
  }

  /**
   * Release camera override and return to normal playout
   */
  releaseOverride() {
    if (!this._override.active) return;

    this._override = {
      active: false,
      type: null,
      cameraNumber: null,
      startedAt: null
    };

    this._logEvent('control', 'Released override');
    this._evaluatePriorityStack();
    this._broadcastState();
  }

  /**
   * Flag a moment for replay
   * @param {Object} moment - Moment replay config
   * @param {string} moment.draftId - Clip draft ID
   * @param {number} moment.seekStart - Start time in seconds
   * @param {number} moment.seekEnd - End time in seconds
   * @param {number} moment.speed - Playback speed (e.g., 0.5 for half speed)
   * @param {boolean} moment.playNow - If true, play immediately after current clip
   */
  flagMoment(moment) {
    const clip = this._clips.find(c => c.draft_id === moment.draftId);
    if (!clip) {
      console.warn(`[PlayoutEngine] Clip not found for moment replay: ${moment.draftId}`);
      return;
    }

    const momentReplay = {
      ...moment,
      clip_url: clip.clip_url,
      athlete_name: clip.athlete_name,
      team_name: clip.team_name,
      apparatus: clip.apparatus,
      flaggedAt: Date.now()
    };

    if (moment.playNow) {
      // Insert at front of queue
      this._momentReplayQueue.unshift(momentReplay);
      this._logEvent('moment', `Flagged moment (Play Now): ${clip.athlete_name} @ ${moment.seekStart}-${moment.seekEnd}s`);
    } else {
      // Add to end of queue (save for later)
      this._momentReplayQueue.push(momentReplay);
      this._logEvent('moment', `Flagged moment (Saved): ${clip.athlete_name} @ ${moment.seekStart}-${moment.seekEnd}s`);
    }

    this._broadcastState();
  }

  /**
   * Add a clip to the queue (e.g., for re-queuing a skipped/shown-live clip)
   * @param {string} draftId - Draft ID of clip to add
   */
  addToQueue(draftId) {
    const clip = this._clips.find(c => c.draft_id === draftId);
    if (!clip) {
      console.warn(`[PlayoutEngine] Clip not found: ${draftId}`);
      return;
    }

    if (clip.status === CLIP_STATUS.QUEUED || clip.status === CLIP_STATUS.PLAYING) {
      console.warn(`[PlayoutEngine] Clip already in queue: ${draftId}`);
      return;
    }

    this._updateClipStatus(draftId, CLIP_STATUS.QUEUED);
    this._logEvent('control', `Re-queued clip: ${clip.athlete_name}`);
    this._broadcastState();
  }

  /**
   * Retry a failed clip
   * @param {string} draftId - Draft ID of clip to retry
   */
  retryClip(draftId) {
    const clip = this._clips.find(c => c.draft_id === draftId);
    if (!clip) {
      console.warn(`[PlayoutEngine] Clip not found: ${draftId}`);
      return;
    }

    if (clip.status !== CLIP_STATUS.FAILED && clip.status !== CLIP_STATUS.STALLED) {
      console.warn(`[PlayoutEngine] Clip is not failed/stalled: ${draftId}`);
      return;
    }

    this._updateClipStatus(draftId, CLIP_STATUS.QUEUED);
    this._logEvent('control', `Retrying clip: ${clip.athlete_name}`);
    this._broadcastState();
  }

  /**
   * Retry all failed clips
   */
  retryAllFailed() {
    const failedClips = this._clips.filter(
      c => c.status === CLIP_STATUS.FAILED || c.status === CLIP_STATUS.STALLED
    );

    for (const clip of failedClips) {
      this._updateClipStatus(clip.draft_id, CLIP_STATUS.QUEUED);
    }

    if (failedClips.length > 0) {
      this._logEvent('control', `Retrying ${failedClips.length} failed clips`);
      this._broadcastState();
    }
  }

  /**
   * Manually trigger a clip fetch (useful for testing or forced refresh)
   */
  async fetchClips() {
    await this._fetchClips();
    this._broadcastState();
  }

  /**
   * Get the full playout state for broadcasting
   * @returns {Object} Full state object
   */
  getState() {
    return {
      compId: this.compId,
      isPlayoutActive: this._state !== ENGINE_STATE.STOPPED,
      engineState: this._state,
      currentMode: this._mode,
      clips: this._clips,
      clipQueue: this.clipQueue,
      currentClip: this._currentClip,
      nextClip: this._getNextQueuedClip(),
      cameraStates: this._cameraStates,
      overrideState: this._override,
      preloadState: this._preloadState,
      momentReplay: this._currentMomentReplay,
      momentReplayQueue: this._momentReplayQueue,
      eventLog: this._eventLog,
      lastApiError: this._lastApiError,
      coordinatorHeartbeat: {
        lastSeen: Date.now(),
        connected: true
      }
    };
  }

  // ==========================================================================
  // Private Methods - Clip Management
  // ==========================================================================

  /**
   * Fetch clips from Clip Engine API
   * @private
   */
  async _fetchClips() {
    if (!this._sessionKey) return;

    try {
      const result = await fetchNewClips(this._sessionKey, this._clipDraftIds);

      if (result.error) {
        this._lastApiError = result.error;
        this._logEvent('error', `API error: ${result.error}`);
        return;
      }

      this._lastApiError = null;

      if (result.newClips.length > 0) {
        // Add new clips with QUEUED status
        for (const clip of result.newClips) {
          this._clips.push({
            ...clip,
            status: CLIP_STATUS.QUEUED,
            shown_live: false,
            elapsed: null,
            scoreRevealed: false
          });
          this._clipDraftIds.add(clip.draft_id);
        }

        // Sort clips by rotation, then order
        this._clips.sort((a, b) => {
          if (a.rotation !== b.rotation) return (a.rotation || 0) - (b.rotation || 0);
          return (a.order || 0) - (b.order || 0);
        });

        // Persist queue
        await this._persistQueue();

        this._logEvent('clip', `Loaded ${result.newClips.length} new clips (${this._clips.length} total)`);
        this.emit('queueUpdated', { newClips: result.newClips, total: this._clips.length });

        // If we were in fallback mode and now have clips, evaluate priority stack
        if (this._mode === PLAYOUT_MODE.FALLBACK) {
          this._evaluatePriorityStack();
        }
      }
    } catch (error) {
      console.error(`[PlayoutEngine] Error fetching clips:`, error.message);
      this._lastApiError = error.message;
      this._logEvent('error', `Failed to fetch clips: ${error.message}`);
    }
  }

  /**
   * Update a clip's status
   * @private
   */
  _updateClipStatus(draftId, status) {
    const clip = this._clips.find(c => c.draft_id === draftId);
    if (clip) {
      clip.status = status;
      if (status === CLIP_STATUS.PLAYED || status === CLIP_STATUS.SKIPPED) {
        clip.elapsed = null;
      }
    }
  }

  /**
   * Get next queued clip
   * @private
   */
  _getNextQueuedClip() {
    return this._clips.find(c => c.status === CLIP_STATUS.QUEUED) || null;
  }

  /**
   * Advance to next clip in queue
   * @private
   */
  _advanceToNextClip() {
    // Mark current clip as played if not already
    if (this._currentClip && this._currentClip.status === CLIP_STATUS.PLAYING) {
      this._updateClipStatus(this._currentClip.draft_id, CLIP_STATUS.PLAYED);
    }

    // Check for moment replay first (priority)
    if (this._momentReplayQueue.length > 0) {
      this._playMomentReplay();
      return;
    }

    // Get next queued clip
    const nextClip = this._getNextQueuedClip();

    if (nextClip) {
      this._currentClip = nextClip;
      this._clipStartTime = Date.now();
      this._updateClipStatus(nextClip.draft_id, CLIP_STATUS.PLAYING);
      this._currentClip.elapsed = 0;

      const previousMode = this._mode;
      this._mode = PLAYOUT_MODE.CLIP;

      // Write clip-playback graphic to Firebase
      this._writeCurrentGraphic({
        graphic: 'clip-playback',
        data: {
          draftId: nextClip.draft_id,
          clipUrl: nextClip.clip_url,
          athleteName: nextClip.athlete_name,
          teamName: nextClip.team_name,
          teamLogo: nextClip.teamLogo || null,
          apparatus: nextClip.apparatus,
          score: nextClip.score,
          duration: nextClip.duration,
          thumbnailUrl: nextClip.thumbnail_url,
          nextClipUrl: this._getNextQueuedClip()?.clip_url || null
        }
      });

      this.emit('clipAdvanced', { clip: nextClip });
      this._logEvent('clip', `Playing: ${nextClip.athlete_name} (${nextClip.apparatus})`);
    } else {
      // No more clips - enter fallback mode
      this._currentClip = null;
      this._clipStartTime = null;

      const previousMode = this._mode;
      this._mode = PLAYOUT_MODE.FALLBACK;

      // Write fallback graphic to Firebase
      this._writeCurrentGraphic({
        graphic: 'fallback',
        data: {}
      });

      this.emit('modeChanged', { previousMode, newMode: PLAYOUT_MODE.FALLBACK });
      this._logEvent('system', 'Queue empty - entering fallback mode');
    }

    this._broadcastState();
  }

  /**
   * Play a moment replay
   * @private
   */
  _playMomentReplay() {
    const moment = this._momentReplayQueue.shift();
    if (!moment) return;

    this._currentMomentReplay = moment;
    const previousMode = this._mode;
    this._mode = PLAYOUT_MODE.MOMENT_REPLAY;

    // Write moment-replay graphic to Firebase
    this._writeCurrentGraphic({
      graphic: 'moment-replay',
      data: {
        draftId: moment.draftId,
        clipUrl: moment.clip_url,
        athleteName: moment.athlete_name,
        teamName: moment.team_name,
        apparatus: moment.apparatus,
        seekStart: moment.seekStart,
        seekEnd: moment.seekEnd,
        playbackRate: moment.speed,
        muted: true,
        nextClipUrl: this._getNextQueuedClip()?.clip_url || null
      }
    });

    this.emit('modeChanged', { previousMode, newMode: PLAYOUT_MODE.MOMENT_REPLAY });
    this._logEvent('moment', `Playing replay: ${moment.athlete_name} @ ${moment.seekStart}-${moment.seekEnd}s (${moment.speed}x)`);
    this._broadcastState();
  }

  // ==========================================================================
  // Private Methods - Priority Stack
  // ==========================================================================

  /**
   * Evaluate priority stack and determine what to show
   * Priority order: override > live routine > moment replay > queued clip > fallback
   * @private
   */
  _evaluatePriorityStack() {
    // 1. Override active - already handled by forceCamera/pause
    if (this._override.active) {
      return;
    }

    // 2. Check for live routine (recording camera)
    const liveCamera = this._cameraStates.find(c => c.state === CAMERA_STATE.LIVE);
    if (liveCamera) {
      const previousMode = this._mode;
      this._mode = PLAYOUT_MODE.LIVE;

      this._writeCurrentGraphic({
        graphic: 'live-camera',
        data: { apparatus: liveCamera.apparatus }
      });

      if (previousMode !== PLAYOUT_MODE.LIVE) {
        this.emit('modeChanged', { previousMode, newMode: PLAYOUT_MODE.LIVE });
        this._logEvent('live', `Live routine on ${liveCamera.apparatus}`);
      }
      this._broadcastState();
      return;
    }

    // 3. Check for pending moment replay
    if (this._momentReplayQueue.length > 0 && this._mode !== PLAYOUT_MODE.MOMENT_REPLAY) {
      this._playMomentReplay();
      return;
    }

    // 4. Play next queued clip
    if (this._getNextQueuedClip() && !this._currentClip) {
      this._advanceToNextClip();
      return;
    }

    // 5. If already playing a clip, continue
    if (this._currentClip) {
      return;
    }

    // 6. Fallback mode
    if (this._mode !== PLAYOUT_MODE.FALLBACK) {
      const previousMode = this._mode;
      this._mode = PLAYOUT_MODE.FALLBACK;

      this._writeCurrentGraphic({
        graphic: 'fallback',
        data: {}
      });

      this.emit('modeChanged', { previousMode, newMode: PLAYOUT_MODE.FALLBACK });
      this._logEvent('system', 'Entering fallback mode');
      this._broadcastState();
    }
  }

  // ==========================================================================
  // Private Methods - Firebase
  // ==========================================================================

  /**
   * Write currentGraphic to Firebase for output.html to render
   * @private
   */
  async _writeCurrentGraphic(graphic) {
    if (!this.firebase) return;

    try {
      const ref = this.firebase.ref(`competitions/${this.compId}/production/currentGraphic`);
      await ref.set({
        ...graphic,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`[PlayoutEngine] Error writing currentGraphic:`, error.message);
    }
  }

  /**
   * Persist playout state to Firebase (for recovery)
   * @private
   */
  async _persistState() {
    if (!this.firebase) return;

    try {
      const ref = this.firebase.ref(`competitions/${this.compId}/production/playoutState`);
      await ref.set({
        engineState: this._state,
        mode: this._mode,
        sessionKey: this._sessionKey,
        override: this._override,
        currentClipId: this._currentClip?.draft_id || null,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`[PlayoutEngine] Error persisting state:`, error.message);
    }
  }

  /**
   * Persist clip queue to Firebase (for recovery)
   * @private
   */
  async _persistQueue() {
    if (!this.firebase) return;

    try {
      const ref = this.firebase.ref(`competitions/${this.compId}/production/clipQueue`);
      // Only persist essential fields to avoid large writes
      const minimalClips = this._clips.map(c => ({
        draft_id: c.draft_id,
        status: c.status,
        shown_live: c.shown_live
      }));
      await ref.set({
        clips: minimalClips,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`[PlayoutEngine] Error persisting queue:`, error.message);
    }
  }

  /**
   * Restore clip queue from Firebase on startup
   * @private
   */
  async _restoreQueue() {
    if (!this.firebase) return;

    try {
      const ref = this.firebase.ref(`competitions/${this.compId}/production/clipQueue`);
      const snapshot = await ref.once('value');
      const data = snapshot.val();

      if (data && data.clips && Array.isArray(data.clips)) {
        // Restore status for known clips
        this._clipStatusRestore = new Map(
          data.clips.map(c => [c.draft_id, { status: c.status, shown_live: c.shown_live }])
        );
        console.log(`[PlayoutEngine] Will restore status for ${data.clips.length} clips`);
      }
    } catch (error) {
      console.error(`[PlayoutEngine] Error restoring queue:`, error.message);
    }
  }

  /**
   * Set up listener for clip status write-backs from output.html
   * @private
   */
  _setupClipStatusListener() {
    if (!this.firebase) return;

    const ref = this.firebase.ref(`competitions/${this.compId}/production/clipStatus`);

    this._clipStatusListener = ref.on('child_changed', async (snapshot) => {
      const draftId = snapshot.key;
      const status = snapshot.val();

      console.log(`[PlayoutEngine] Clip status update: ${draftId} -> ${status?.status || status}`);

      // Handle status from output.html
      const statusValue = status?.status || status;

      if (statusValue === 'ended' || statusValue === 'played') {
        // Clip finished playing - advance to next
        this._updateClipStatus(draftId, CLIP_STATUS.PLAYED);

        // Clean up the clipStatus entry after a short delay
        setTimeout(() => {
          ref.child(draftId).remove().catch(() => {});
        }, CLIP_STATUS_CLEANUP_DELAY_MS);

        // If this was the current clip or moment replay, advance
        if (this._currentClip?.draft_id === draftId) {
          this._advanceToNextClip();
        } else if (this._currentMomentReplay?.draftId === draftId) {
          this._currentMomentReplay = null;
          this._advanceToNextClip();
        }
      } else if (statusValue === 'stalled') {
        this._updateClipStatus(draftId, CLIP_STATUS.STALLED);
        this._logEvent('error', `Clip stalled: ${draftId}`);
        this._advanceToNextClip();
      } else if (statusValue === 'failed' || statusValue === 'error') {
        this._updateClipStatus(draftId, CLIP_STATUS.FAILED);
        this._logEvent('error', `Clip failed: ${draftId}`);
        this._advanceToNextClip();
      } else if (statusValue === 'score-revealed') {
        // Mark score as revealed
        const clip = this._clips.find(c => c.draft_id === draftId);
        if (clip) {
          clip.scoreRevealed = true;
        }
      }
    });

    // Also listen for new clipStatus entries (child_added)
    ref.on('child_added', (snapshot) => {
      const draftId = snapshot.key;
      const status = snapshot.val();

      // Same logic as child_changed
      const statusValue = status?.status || status;

      if (statusValue === 'ended' || statusValue === 'played') {
        this._updateClipStatus(draftId, CLIP_STATUS.PLAYED);
        setTimeout(() => {
          ref.child(draftId).remove().catch(() => {});
        }, CLIP_STATUS_CLEANUP_DELAY_MS);

        if (this._currentClip?.draft_id === draftId) {
          this._advanceToNextClip();
        } else if (this._currentMomentReplay?.draftId === draftId) {
          this._currentMomentReplay = null;
          this._advanceToNextClip();
        }
      }
    });

    console.log(`[PlayoutEngine] Listening for clip status at ${ref.toString()}`);
  }

  /**
   * Remove clip status listener
   * @private
   */
  _removeClipStatusListener() {
    if (!this.firebase || !this._clipStatusListener) return;

    const ref = this.firebase.ref(`competitions/${this.compId}/production/clipStatus`);
    ref.off('child_changed');
    ref.off('child_added');
    this._clipStatusListener = null;
  }

  // ==========================================================================
  // Private Methods - Heartbeat
  // ==========================================================================

  /**
   * Start heartbeat timer
   * @private
   */
  _startHeartbeat() {
    this._stopHeartbeat();

    this._heartbeatTimer = setInterval(() => {
      this._writeHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // Write initial heartbeat
    this._writeHeartbeat();
  }

  /**
   * Stop heartbeat timer
   * @private
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /**
   * Write heartbeat to Firebase
   * @private
   */
  async _writeHeartbeat() {
    if (!this.firebase) return;

    try {
      const ref = this.firebase.ref(`competitions/${this.compId}/production/engineHeartbeat`);
      await ref.set({
        timestamp: Date.now(),
        mode: this._mode
      });
      this.emit('heartbeat', { timestamp: Date.now(), mode: this._mode });
    } catch (error) {
      console.error(`[PlayoutEngine] Error writing heartbeat:`, error.message);
    }
  }

  // ==========================================================================
  // Private Methods - Clip Polling
  // ==========================================================================

  /**
   * Start clip polling timer
   * @private
   */
  _startClipPolling() {
    this._stopClipPolling();

    this._clipPollTimer = setInterval(async () => {
      await this._fetchClips();
    }, CLIP_POLL_INTERVAL_MS);
  }

  /**
   * Stop clip polling timer
   * @private
   */
  _stopClipPolling() {
    if (this._clipPollTimer) {
      clearInterval(this._clipPollTimer);
      this._clipPollTimer = null;
    }
  }

  // ==========================================================================
  // Private Methods - Event Logging
  // ==========================================================================

  /**
   * Log an event (circular buffer)
   * @private
   */
  _logEvent(type, message) {
    const event = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      type,
      message
    };

    this._eventLog.push(event);

    // Keep only last N events
    if (this._eventLog.length > this._maxEventLogSize) {
      this._eventLog.shift();
    }
  }

  // ==========================================================================
  // Private Methods - Broadcasting
  // ==========================================================================

  /**
   * Broadcast state to all connected clients via Socket.io
   * @private
   */
  _broadcastState() {
    if (!this.io) return;

    const state = this.getState();
    this.io.to(`competition:${this.compId}`).emit('playout:stateUpdate', state);
  }
}

// ============================================================================
// Singleton Manager
// ============================================================================

// Map of compId -> PlayoutEngine instances
const playoutEngines = new Map();

/**
 * Get or create a playout engine for a competition
 * @param {string} compId - Competition ID
 * @param {Object} options - Options for creating new engine
 * @returns {PlayoutEngine}
 */
export function getPlayoutEngine(compId, options = {}) {
  if (!playoutEngines.has(compId)) {
    const engine = new PlayoutEngine({ compId, ...options });
    playoutEngines.set(compId, engine);
  }
  return playoutEngines.get(compId);
}

/**
 * Remove a playout engine (e.g., when competition ends)
 * @param {string} compId - Competition ID
 */
export function removePlayoutEngine(compId) {
  const engine = playoutEngines.get(compId);
  if (engine) {
    engine.stop();
    playoutEngines.delete(compId);
  }
}

/**
 * Get all active playout engines
 * @returns {Map<string, PlayoutEngine>}
 */
export function getAllPlayoutEngines() {
  return playoutEngines;
}
