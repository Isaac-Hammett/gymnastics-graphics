/**
 * Timesheet Engine Module
 *
 * Drives show flow based on segment timing, handling auto-advance,
 * manual overrides, and producer controls.
 * Emits events for real-time UI updates and segment transitions.
 */

import { EventEmitter } from 'events';

// Segment types
const SEGMENT_TYPES = {
  STATIC: 'static',     // Static graphics/video
  LIVE: 'live',         // Live camera feed
  MULTI: 'multi',       // Multi-camera view
  HOLD: 'hold',         // Hold for producer decision
  BREAK: 'break',       // Commercial/intermission break
  VIDEO: 'video',       // Pre-recorded video
  GRAPHIC: 'graphic'    // Graphics overlay
};

// Engine states
const ENGINE_STATE = {
  STOPPED: 'stopped',
  RUNNING: 'running',
  PAUSED: 'paused'
};

// Transition types
const TRANSITION_TYPES = {
  CUT: 'cut',
  FADE: 'fade',
  STINGER: 'stinger'
};

/**
 * TimesheetEngine - Drives show flow based on segment timing
 *
 * Events emitted:
 * - 'tick': Emitted every second with elapsed/remaining time
 * - 'segmentActivated': Emitted when a segment becomes active
 * - 'segmentCompleted': Emitted when a segment finishes
 * - 'showStarted': Emitted when show begins
 * - 'showStopped': Emitted when show ends (manual stop or natural completion)
 * - 'showComplete': Emitted when show ends naturally (all segments finished)
 * - 'holdMaxReached': Emitted when hold segment exceeds maxDuration
 * - 'overrideRecorded': Emitted when a manual override is logged
 * - 'stateChanged': Emitted when engine state changes
 * - 'audioCueTriggered': Emitted when an audio cue starts (Phase F)
 */
class TimesheetEngine extends EventEmitter {
  /**
   * Create a new TimesheetEngine
   * @param {Object} options - Configuration options
   * @param {string} options.compId - Competition ID for multi-competition support
   * @param {Object} options.obsConnectionManager - OBS connection manager for per-competition OBS connections
   * @param {Object} options.showConfig - Show configuration with segments
   * @param {Object} options.obs - OBS WebSocket controller (optional, legacy - prefer obsConnectionManager)
   * @param {Object} options.firebase - Firebase database (from productionConfigService.getDb()) or Firebase Admin app (optional)
   * @param {Object} options.io - Socket.io server for broadcasting (optional)
   * @param {boolean} options.isRehearsalMode - Whether to run in rehearsal mode (skips OBS/graphics, default false)
   */
  constructor(options = {}) {
    super();

    // Multi-competition support
    this.compId = options.compId || null;
    this.obsConnectionManager = options.obsConnectionManager || null;

    this.showConfig = options.showConfig || { segments: [] };
    this.obs = options.obs || null;
    this.firebase = options.firebase || null;
    this.io = options.io || null;

    // Rehearsal mode - when enabled, OBS scene changes and graphics firing are skipped
    this._isRehearsalMode = options.isRehearsalMode || false;

    // Core state
    this._state = ENGINE_STATE.STOPPED;
    this._isRunning = false;
    this._currentSegmentIndex = -1;
    this._currentSegment = null;
    this._segmentStartTime = null;
    this._segmentElapsedMs = 0;

    // Tick timer
    this._tickTimer = null;
    this._tickIntervalMs = 1000; // 1 second tick

    // History tracking
    this._history = [];
    this._overrides = [];

    // Show timing
    this._showStartTime = null;
    this._showElapsedMs = 0;

    // Track last transition for context
    this._lastTransitionType = null;

    // Track if holdMaxReached has been emitted for current segment
    this._holdMaxReachedEmitted = false;

    // Track if current segment was deleted during hot reload (Task 35)
    // When true, the current segment no longer exists in the rundown
    // The engine stays on the stale segment until manual advance
    this._currentSegmentDeleted = false;
    this._deletedSegmentOriginalIndex = -1; // Remember position for next advance
  }

  /**
   * Get segments from show config
   * @returns {Object[]} Array of segments
   */
  get segments() {
    return this.showConfig.segments || [];
  }

  /**
   * Get current engine state
   * @returns {string} Current state (stopped, running, paused)
   */
  get state() {
    return this._state;
  }

  /**
   * Check if engine is running
   * @returns {boolean} True if running
   */
  get isRunning() {
    return this._isRunning;
  }

  /**
   * Check if engine is in rehearsal mode
   * @returns {boolean} True if in rehearsal mode
   */
  get isRehearsalMode() {
    return this._isRehearsalMode;
  }

  /**
   * Get current segment index
   * @returns {number} Current segment index (-1 if not started)
   */
  get currentSegmentIndex() {
    return this._currentSegmentIndex;
  }

  /**
   * Get current segment object
   * @returns {Object|null} Current segment or null
   */
  get currentSegment() {
    return this._currentSegment;
  }

  /**
   * Get next segment (if any)
   * @returns {Object|null} Next segment or null
   */
  get nextSegment() {
    const nextIndex = this._currentSegmentIndex + 1;
    return nextIndex < this.segments.length ? this.segments[nextIndex] : null;
  }

  /**
   * Get previous segment (if any)
   * @returns {Object|null} Previous segment or null
   */
  get previousSegment() {
    const prevIndex = this._currentSegmentIndex - 1;
    return prevIndex >= 0 ? this.segments[prevIndex] : null;
  }

  /**
   * Get elapsed time for current segment in milliseconds
   * @returns {number} Elapsed milliseconds
   */
  get segmentElapsedMs() {
    if (!this._segmentStartTime) return 0;
    return Date.now() - this._segmentStartTime;
  }

  /**
   * Get remaining time for current segment in milliseconds
   * @returns {number|null} Remaining milliseconds or null if untimed
   */
  get segmentRemainingMs() {
    if (!this._currentSegment || !this._currentSegment.duration) {
      return null; // Untimed segment
    }
    const durationMs = this._currentSegment.duration * 1000;
    const remaining = durationMs - this.segmentElapsedMs;
    return Math.max(0, remaining);
  }

  /**
   * Get segment progress (0-1)
   * @returns {number|null} Progress fraction or null if untimed
   */
  get segmentProgress() {
    if (!this._currentSegment || !this._currentSegment.duration) {
      return null;
    }
    const durationMs = this._currentSegment.duration * 1000;
    return Math.min(1, this.segmentElapsedMs / durationMs);
  }

  /**
   * Get show elapsed time in milliseconds
   * @returns {number} Show elapsed milliseconds
   */
  get showElapsedMs() {
    if (!this._showStartTime) return 0;
    return Date.now() - this._showStartTime;
  }

  /**
   * Get segment history
   * @returns {Object[]} Array of history entries
   */
  get history() {
    return [...this._history];
  }

  /**
   * Get override log
   * @returns {Object[]} Array of override entries
   */
  get overrides() {
    return [...this._overrides];
  }

  /**
   * Start the show from the first segment
   */
  async start() {
    if (this._isRunning) {
      return;
    }

    if (this.segments.length === 0) {
      this.emit('error', new Error('No segments defined in show config'));
      return;
    }

    this._isRunning = true;
    this._state = ENGINE_STATE.RUNNING;
    this._showStartTime = Date.now();
    this._history = [];
    this._overrides = [];

    // Start tick timer
    this._startTick();

    // Activate first segment
    await this._activateSegment(0, 'start');

    this.emit('showStarted', {
      timestamp: Date.now(),
      segmentCount: this.segments.length
    });

    this.emit('stateChanged', {
      previousState: ENGINE_STATE.STOPPED,
      newState: ENGINE_STATE.RUNNING
    });
  }

  /**
   * Stop the show
   */
  stop() {
    if (!this._isRunning) {
      return;
    }

    // Record final segment in history
    if (this._currentSegment) {
      this._recordHistory('completed');
    }

    this._isRunning = false;
    this._state = ENGINE_STATE.STOPPED;
    this._stopTick();

    const showDurationMs = Date.now() - this._showStartTime;

    this.emit('showStopped', {
      timestamp: Date.now(),
      showDurationMs,
      segmentsCompleted: this._history.length,
      overrideCount: this._overrides.length
    });

    this.emit('stateChanged', {
      previousState: ENGINE_STATE.RUNNING,
      newState: ENGINE_STATE.STOPPED
    });

    // Reset state
    this._currentSegmentIndex = -1;
    this._currentSegment = null;
    this._segmentStartTime = null;
    this._showStartTime = null;
  }

  /**
   * Pause the show (stops tick but preserves state)
   */
  pause() {
    if (!this._isRunning || this._state === ENGINE_STATE.PAUSED) {
      return;
    }

    this._state = ENGINE_STATE.PAUSED;
    this._segmentElapsedMs = this.segmentElapsedMs; // Capture current elapsed
    this._stopTick();

    this.emit('stateChanged', {
      previousState: ENGINE_STATE.RUNNING,
      newState: ENGINE_STATE.PAUSED
    });
  }

  /**
   * Resume the show from paused state
   */
  resume() {
    if (this._state !== ENGINE_STATE.PAUSED) {
      return;
    }

    this._state = ENGINE_STATE.RUNNING;
    // Adjust start time to account for pause
    this._segmentStartTime = Date.now() - this._segmentElapsedMs;
    this._startTick();

    this.emit('stateChanged', {
      previousState: ENGINE_STATE.PAUSED,
      newState: ENGINE_STATE.RUNNING
    });
  }

  /**
   * Start the tick timer
   * @private
   */
  _startTick() {
    if (this._tickTimer) {
      return;
    }

    this._tickTimer = setInterval(() => {
      this._tick();
    }, this._tickIntervalMs);
  }

  /**
   * Stop the tick timer
   * @private
   */
  _stopTick() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
  }

  /**
   * Tick handler - called every second
   * @private
   */
  _tick() {
    if (!this._isRunning || this._state !== ENGINE_STATE.RUNNING) {
      return;
    }

    const elapsedMs = this.segmentElapsedMs;
    const remainingMs = this.segmentRemainingMs;
    const progress = this.segmentProgress;

    // Emit tick event
    this.emit('tick', {
      timestamp: Date.now(),
      segmentId: this._currentSegment?.id,
      segmentIndex: this._currentSegmentIndex,
      elapsedMs,
      remainingMs,
      progress,
      showElapsedMs: this.showElapsedMs
    });

    // Check for hold segment max duration warning
    if (this._currentSegment?.type === SEGMENT_TYPES.HOLD) {
      const maxDurationMs = (this._currentSegment.maxDuration || 0) * 1000;
      if (maxDurationMs > 0 && elapsedMs >= maxDurationMs && !this._holdMaxReachedEmitted) {
        this._holdMaxReachedEmitted = true;
        this.emit('holdMaxReached', {
          segmentId: this._currentSegment.id,
          elapsedMs,
          maxDurationMs
        });
      }
    }

    // Check for auto-advance
    this._checkAutoAdvance(elapsedMs);
  }

  /**
   * Check if segment should auto-advance and trigger if appropriate
   * @param {number} elapsedMs - Current elapsed time in milliseconds
   * @private
   */
  _checkAutoAdvance(elapsedMs) {
    // No current segment or no more segments
    if (!this._currentSegment) return;
    const nextIndex = this._currentSegmentIndex + 1;
    if (nextIndex >= this.segments.length) return;

    // Hold segments NEVER auto-advance - producer must decide
    if (this._currentSegment.type === SEGMENT_TYPES.HOLD) {
      return;
    }

    // Check autoAdvance flag on segment (default true for timed segments)
    const autoAdvance = this._currentSegment.autoAdvance !== false;
    if (!autoAdvance) {
      return;
    }

    // Must have a duration to auto-advance
    const durationMs = (this._currentSegment.duration || 0) * 1000;
    if (durationMs <= 0) {
      return;
    }

    // Check if elapsed time has reached or exceeded duration
    if (elapsedMs >= durationMs) {
      this._autoAdvance();
    }
  }

  /**
   * Auto-advance to the next segment
   * @private
   */
  async _autoAdvance() {
    const nextIndex = this._currentSegmentIndex + 1;

    // Emit event before advancing
    this.emit('autoAdvancing', {
      fromSegmentId: this._currentSegment?.id,
      fromSegmentIndex: this._currentSegmentIndex,
      toSegmentIndex: nextIndex,
      timestamp: Date.now()
    });

    // Check if we've reached the end of the show
    if (nextIndex >= this.segments.length) {
      // Task 39: Show completed naturally - record final segment and stop
      // This ensures timing analytics are saved when show completes (not just manual stop)
      this._completeShow();
      return;
    }

    // Activate next segment
    await this._activateSegment(nextIndex, 'auto');
  }

  /**
   * Complete the show (all segments finished naturally)
   * Similar to stop() but specifically for natural completion
   * @private
   */
  _completeShow() {
    if (!this._isRunning) {
      return;
    }

    // Record final segment in history as completed naturally
    if (this._currentSegment) {
      this._recordHistory('auto_advanced');
    }

    this._isRunning = false;
    this._state = ENGINE_STATE.STOPPED;
    this._stopTick();

    const showDurationMs = Date.now() - this._showStartTime;

    // Emit showComplete for natural completion (allows UI to distinguish from manual stop)
    this.emit('showComplete', {
      timestamp: Date.now(),
      showDurationMs,
      segmentsCompleted: this._history.length,
      overrideCount: this._overrides.length,
      completedNaturally: true
    });

    // Also emit showStopped for compatibility with existing analytics handler
    this.emit('showStopped', {
      timestamp: Date.now(),
      showDurationMs,
      segmentsCompleted: this._history.length,
      overrideCount: this._overrides.length
    });

    this.emit('stateChanged', {
      previousState: ENGINE_STATE.RUNNING,
      newState: ENGINE_STATE.STOPPED
    });

    // Reset state
    this._currentSegmentIndex = -1;
    this._currentSegment = null;
    this._segmentStartTime = null;
    this._showStartTime = null;
  }

  /**
   * Check if hold segment has met minimum duration requirement
   * @returns {boolean} True if hold can be advanced
   */
  canAdvanceHold() {
    if (!this._currentSegment || this._currentSegment.type !== SEGMENT_TYPES.HOLD) {
      return true; // Not a hold segment, can always advance
    }

    const minDurationMs = (this._currentSegment.minDuration || 0) * 1000;
    const elapsedMs = this.segmentElapsedMs;

    return elapsedMs >= minDurationMs;
  }

  /**
   * Get remaining time before hold can be advanced
   * @returns {number} Milliseconds remaining before minDuration is met (0 if already met)
   */
  getHoldRemainingMs() {
    if (!this._currentSegment || this._currentSegment.type !== SEGMENT_TYPES.HOLD) {
      return 0;
    }

    const minDurationMs = (this._currentSegment.minDuration || 0) * 1000;
    const elapsedMs = this.segmentElapsedMs;

    return Math.max(0, minDurationMs - elapsedMs);
  }

  /**
   * Activate a segment by index
   * @param {number} index - Segment index to activate
   * @param {string} reason - Why this segment was activated (auto, manual, jump)
   * @private
   */
  async _activateSegment(index, reason = 'manual') {
    if (index < 0 || index >= this.segments.length) {
      return false;
    }

    // Record previous segment in history
    if (this._currentSegment) {
      this._recordHistory(reason === 'auto' ? 'auto_advanced' : 'advanced');
    }

    const previousSegment = this._currentSegment;
    const segment = this.segments[index];

    this._currentSegmentIndex = index;
    this._currentSegment = segment;
    this._segmentStartTime = Date.now();
    this._segmentElapsedMs = 0;
    this._holdMaxReachedEmitted = false;

    // Determine transition type based on segment types
    const transition = this._getTransition(previousSegment, segment);
    this._lastTransitionType = transition.type;

    // Apply transition and switch scene
    await this._applyTransitionAndSwitchScene(segment, transition);

    // Handle segment-type specific actions
    await this._handleSegmentTypeActions(segment);

    // Apply audio overrides if defined
    await this._applyAudioOverrides(segment);

    // Play audio cue if defined (Phase F: Task 64)
    await this._playAudioCue(segment);

    this.emit('segmentActivated', {
      timestamp: Date.now(),
      segmentIndex: index,
      segment: { ...segment },
      previousSegmentIndex: this._history.length > 0
        ? this._history[this._history.length - 1].segmentIndex
        : -1,
      transition: transition,
      reason
    });

    return true;
  }

  /**
   * Get the appropriate transition for segment change
   * @param {Object|null} fromSegment - Previous segment
   * @param {Object} toSegment - Next segment
   * @returns {Object} Transition config {type, durationMs}
   * @private
   */
  _getTransition(fromSegment, toSegment) {
    const transitions = this.showConfig.transitions || {};

    // Check for segment-specific transition
    if (toSegment.transition) {
      return {
        type: toSegment.transition.type || TRANSITION_TYPES.CUT,
        durationMs: toSegment.transition.durationMs || 0
      };
    }

    // Going to break
    if (toSegment.type === SEGMENT_TYPES.BREAK && transitions.toBreak) {
      return transitions.toBreak;
    }

    // Coming from break
    if (fromSegment?.type === SEGMENT_TYPES.BREAK && transitions.fromBreak) {
      return transitions.fromBreak;
    }

    // Default transition
    return transitions.default || { type: TRANSITION_TYPES.CUT, durationMs: 0 };
  }

  /**
   * Apply transition and switch OBS scene
   * @param {Object} segment - Segment to switch to
   * @param {Object} transition - Transition config
   * @private
   */
  async _applyTransitionAndSwitchScene(segment, transition) {
    if (!segment.obsScene) {
      return;
    }

    // In rehearsal mode, skip actual OBS scene changes but still emit event
    if (this._isRehearsalMode) {
      console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] REHEARSAL: Skipping scene change to "${segment.obsScene}"`);
      this.emit('sceneChanged', {
        sceneName: segment.obsScene,
        transition: transition,
        segmentId: segment.id,
        rehearsalMode: true
      });
      return;
    }

    // Get OBS connection - prefer per-competition connection via obsConnectionManager
    let obsConnection = null;
    if (this.obsConnectionManager && this.compId) {
      obsConnection = this.obsConnectionManager.getConnection(this.compId);
      if (!obsConnection) {
        this.emit('error', {
          type: 'obs_scene_switch',
          message: `No OBS connection found for competition ${this.compId}`,
          segmentId: segment.id
        });
        return;
      }
    } else if (this.obs) {
      // Fallback to legacy single OBS connection
      obsConnection = this.obs;
    } else {
      // No OBS connection available
      return;
    }

    try {
      if (transition.type === TRANSITION_TYPES.FADE && transition.durationMs > 0) {
        // Use SetCurrentSceneTransitionDuration and then switch
        await obsConnection.call('SetCurrentSceneTransitionDuration', {
          transitionDuration: transition.durationMs
        });
        await obsConnection.call('SetCurrentSceneTransition', {
          transitionName: 'Fade'
        });
      } else if (transition.type === TRANSITION_TYPES.STINGER) {
        // Use stinger transition if configured
        await obsConnection.call('SetCurrentSceneTransition', {
          transitionName: transition.transitionName || 'Stinger'
        });
      } else {
        // Cut transition (instant)
        await obsConnection.call('SetCurrentSceneTransition', {
          transitionName: 'Cut'
        });
      }

      // Switch to the scene
      await obsConnection.call('SetCurrentProgramScene', {
        sceneName: segment.obsScene
      });

      this.emit('sceneChanged', {
        sceneName: segment.obsScene,
        transition: transition,
        segmentId: segment.id
      });
    } catch (error) {
      this.emit('error', {
        type: 'obs_scene_switch',
        message: `Failed to switch to scene ${segment.obsScene}: ${error.message}`,
        segmentId: segment.id
      });
    }
  }

  /**
   * Handle segment-type specific actions
   * @param {Object} segment - Current segment
   * @private
   */
  async _handleSegmentTypeActions(segment) {
    switch (segment.type) {
      case SEGMENT_TYPES.STATIC:
        // Static scene, nothing special to do
        break;

      case SEGMENT_TYPES.LIVE:
      case SEGMENT_TYPES.MULTI:
        // Live camera feed - trigger any associated graphics
        if (segment.graphic) {
          await this._triggerGraphic(segment);
        }
        break;

      case SEGMENT_TYPES.HOLD:
        // Hold segment - emit hold started event
        this.emit('holdStarted', {
          segmentId: segment.id,
          minDuration: segment.minDuration || 0,
          maxDuration: segment.maxDuration || null
        });
        break;

      case SEGMENT_TYPES.BREAK:
        // Break segment - could trigger break graphics
        if (segment.graphic) {
          await this._triggerGraphic(segment);
        }
        this.emit('breakStarted', {
          segmentId: segment.id,
          duration: segment.duration || null
        });
        break;

      case SEGMENT_TYPES.VIDEO:
        // Video segment - set video file and play
        if (segment.videoFile) {
          await this._playVideo(segment);
        }
        break;

      case SEGMENT_TYPES.GRAPHIC:
        // Graphics segment - trigger the graphic
        await this._triggerGraphic(segment);
        break;

      default:
        // Unknown segment type, try to trigger graphic if present
        if (segment.graphic) {
          await this._triggerGraphic(segment);
        }
    }
  }

  /**
   * Trigger a graphic via Firebase or socket.io
   * @param {Object} segment - Segment with graphic configuration
   * @private
   */
  async _triggerGraphic(segment) {
    if (!segment.graphic) return;

    // In rehearsal mode, skip actual graphic firing but still emit event
    if (this._isRehearsalMode) {
      console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] REHEARSAL: Skipping graphic "${segment.graphic}"`);
      this.emit('graphicTriggered', {
        graphic: segment.graphic,
        data: segment.graphicData || {},
        segmentId: segment.id,
        timestamp: Date.now(),
        rehearsalMode: true
      });
      return;
    }

    const graphicData = {
      graphic: segment.graphic,
      data: segment.graphicData || {},
      segmentId: segment.id,
      timestamp: Date.now()
    };

    // Try Firebase first if available
    // this.firebase can be either the Firebase Admin database directly (from productionConfigService.getDb())
    // or the full Firebase Admin app (legacy). Handle both cases.
    if (this.firebase) {
      try {
        // If this.firebase has a ref() method, it's the database directly
        // If it has a database() method, it's the Firebase Admin app
        const db = typeof this.firebase.ref === 'function' ? this.firebase : this.firebase.database();

        // Use competition-specific path if compId is available, otherwise fallback to global path
        // output.html listens to: competitions/${competitionId}/currentGraphic
        const firebasePath = this.compId
          ? `competitions/${this.compId}/currentGraphic`
          : 'graphics/current';

        console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] Triggering graphic "${segment.graphic}" via Firebase at ${firebasePath}`);
        await db.ref(firebasePath).set(graphicData);
        console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] Graphic "${segment.graphic}" triggered successfully`);
      } catch (error) {
        console.error(`[Timesheet${this.compId ? ':' + this.compId : ''}] Firebase graphic trigger failed:`, error.message);
        this.emit('error', {
          type: 'firebase_graphic',
          message: `Failed to trigger graphic via Firebase: ${error.message}`,
          segmentId: segment.id
        });
      }
    } else {
      console.warn(`[Timesheet${this.compId ? ':' + this.compId : ''}] Firebase not available - graphic will only be broadcast via socket.io`);
    }

    // Also broadcast via socket.io
    if (this.io) {
      // Target competition-specific room if compId is available
      if (this.compId) {
        this.io.to(`competition:${this.compId}`).emit('triggerGraphic', graphicData);
      } else {
        // Fallback to global broadcast for legacy single-engine mode
        this.io.emit('triggerGraphic', graphicData);
      }
    }

    // Emit event for any listeners
    this.emit('graphicTriggered', graphicData);
  }

  /**
   * Play a video segment via OBS media source
   * @param {Object} segment - Segment with video configuration
   * @private
   */
  async _playVideo(segment) {
    if (!segment.videoFile) return;

    // Get OBS connection - prefer per-competition connection via obsConnectionManager
    let obsConnection = null;
    if (this.obsConnectionManager && this.compId) {
      obsConnection = this.obsConnectionManager.getConnection(this.compId);
      if (!obsConnection) {
        this.emit('error', {
          type: 'obs_video',
          message: `No OBS connection found for competition ${this.compId}`,
          segmentId: segment.id
        });
        return;
      }
    } else if (this.obs) {
      // Fallback to legacy single OBS connection
      obsConnection = this.obs;
    } else {
      // No OBS connection available
      return;
    }

    const sourceName = segment.videoSource || 'Video Player';

    try {
      // Get current settings
      const { inputSettings } = await obsConnection.call('GetInputSettings', {
        inputName: sourceName
      });

      // Update with new file path
      await obsConnection.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: {
          ...inputSettings,
          local_file: segment.videoFile,
          is_local_file: true
        }
      });

      // Restart the media source to play from beginning
      await obsConnection.call('TriggerMediaInputAction', {
        inputName: sourceName,
        mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'
      });

      this.emit('videoStarted', {
        segmentId: segment.id,
        videoFile: segment.videoFile,
        sourceName
      });
    } catch (error) {
      this.emit('error', {
        type: 'obs_video',
        message: `Failed to play video ${segment.videoFile}: ${error.message}`,
        segmentId: segment.id
      });
    }
  }

  /**
   * Play audio cue via OBS media source (Phase F: Task 64)
   * @param {Object} segment - Segment with audioCue configuration
   * @private
   */
  async _playAudioCue(segment) {
    if (!segment.audioCue || !segment.audioCue.songName) return;

    // In rehearsal mode, skip actual audio playback but still emit event
    if (this._isRehearsalMode) {
      console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] REHEARSAL: Skipping audio cue "${segment.audioCue.songName}"`);
      this.emit('audioCueTriggered', {
        segmentId: segment.id,
        audioCue: segment.audioCue,
        timestamp: Date.now(),
        rehearsalMode: true
      });
      return;
    }

    // Get OBS connection - prefer per-competition connection via obsConnectionManager
    let obsConnection = null;
    if (this.obsConnectionManager && this.compId) {
      obsConnection = this.obsConnectionManager.getConnection(this.compId);
      if (!obsConnection) {
        this.emit('error', {
          type: 'obs_audio_cue',
          message: `No OBS connection found for competition ${this.compId}`,
          segmentId: segment.id
        });
        return;
      }
    } else if (this.obs) {
      // Fallback to legacy single OBS connection
      obsConnection = this.obs;
    } else {
      // No OBS connection available
      return;
    }

    // Use configured audio source or default name
    const sourceName = this.showConfig.audioConfig?.musicSource?.sourceName || 'Music Player';
    const { songName, inPoint, outPoint } = segment.audioCue;

    try {
      // Get current settings
      const { inputSettings } = await obsConnection.call('GetInputSettings', {
        inputName: sourceName
      });

      // Build new settings with the song file
      // Song name is expected to be a file path or name that OBS can resolve
      const newSettings = {
        ...inputSettings,
        local_file: songName,
        is_local_file: true
      };

      // Update with new file path
      await obsConnection.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: newSettings
      });

      // Restart the media source to play from beginning
      await obsConnection.call('TriggerMediaInputAction', {
        inputName: sourceName,
        mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'
      });

      console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] Audio cue started: "${songName}" (in: ${inPoint || 'start'}, out: ${outPoint || 'end'})`);

      this.emit('audioCueTriggered', {
        segmentId: segment.id,
        audioCue: segment.audioCue,
        sourceName,
        timestamp: Date.now()
      });
    } catch (error) {
      this.emit('error', {
        type: 'obs_audio_cue',
        message: `Failed to play audio cue "${songName}": ${error.message}`,
        segmentId: segment.id
      });
    }
  }

  /**
   * Apply audio overrides for a segment
   * @param {Object} segment - Current segment
   * @private
   */
  async _applyAudioOverrides(segment) {
    if (!segment.audio) return;

    // Get OBS connection - prefer per-competition connection via obsConnectionManager
    let obsConnection = null;
    if (this.obsConnectionManager && this.compId) {
      obsConnection = this.obsConnectionManager.getConnection(this.compId);
      if (!obsConnection) {
        this.emit('error', {
          type: 'obs_audio',
          message: `No OBS connection found for competition ${this.compId}`,
          segmentId: segment.id
        });
        return;
      }
    } else if (this.obs) {
      // Fallback to legacy single OBS connection
      obsConnection = this.obs;
    } else {
      // No OBS connection available
      return;
    }

    const audioConfig = this.showConfig.audioConfig || {};

    try {
      // Apply venue audio volume
      if (segment.audio.venueVolume !== undefined && audioConfig.venue?.sourceName) {
        await obsConnection.call('SetInputVolume', {
          inputName: audioConfig.venue.sourceName,
          inputVolumeDb: this._volumeToDb(segment.audio.venueVolume)
        });
      }

      // Apply commentary audio volume
      if (segment.audio.commentaryVolume !== undefined && audioConfig.commentary?.sourceName) {
        await obsConnection.call('SetInputVolume', {
          inputName: audioConfig.commentary.sourceName,
          inputVolumeDb: this._volumeToDb(segment.audio.commentaryVolume)
        });
      }

      // Apply mute states
      if (segment.audio.muteVenue !== undefined && audioConfig.venue?.sourceName) {
        await obsConnection.call('SetInputMute', {
          inputName: audioConfig.venue.sourceName,
          inputMuted: segment.audio.muteVenue
        });
      }

      if (segment.audio.muteCommentary !== undefined && audioConfig.commentary?.sourceName) {
        await obsConnection.call('SetInputMute', {
          inputName: audioConfig.commentary.sourceName,
          inputMuted: segment.audio.muteCommentary
        });
      }

      this.emit('audioChanged', {
        segmentId: segment.id,
        audio: segment.audio
      });
    } catch (error) {
      this.emit('error', {
        type: 'obs_audio',
        message: `Failed to apply audio overrides: ${error.message}`,
        segmentId: segment.id
      });
    }
  }

  /**
   * Convert volume (0-1) to decibels
   * @param {number} volume - Volume from 0 to 1
   * @returns {number} Volume in decibels
   * @private
   */
  _volumeToDb(volume) {
    if (volume <= 0) return -100; // Essentially silent
    if (volume >= 1) return 0;    // Full volume
    // Convert linear to dB: 20 * log10(volume)
    return 20 * Math.log10(volume);
  }

  /**
   * Record segment in history
   * @param {string} endReason - Why segment ended
   * @private
   */
  _recordHistory(endReason) {
    if (!this._currentSegment) return;

    this._history.push({
      segmentId: this._currentSegment.id,
      segmentIndex: this._currentSegmentIndex,
      segmentName: this._currentSegment.name,
      startTime: this._segmentStartTime,
      endTime: Date.now(),
      durationMs: this.segmentElapsedMs,
      plannedDurationMs: this._currentSegment.duration
        ? this._currentSegment.duration * 1000
        : null,
      endReason
    });

    this.emit('segmentCompleted', {
      segmentId: this._currentSegment.id,
      segmentIndex: this._currentSegmentIndex,
      durationMs: this.segmentElapsedMs,
      endReason
    });
  }

  /**
   * Record an override action
   * @param {string} type - Override type
   * @param {Object} details - Override details
   * @private
   */
  _recordOverride(type, details) {
    const override = {
      timestamp: Date.now(),
      type,
      segmentId: this._currentSegment?.id,
      segmentIndex: this._currentSegmentIndex,
      showElapsedMs: this.showElapsedMs,
      ...details
    };

    this._overrides.push(override);

    this.emit('overrideRecorded', override);
  }

  /**
   * Get full timesheet state for clients
   * @returns {Object} Current timesheet state
   */
  getState() {
    const isHold = this._currentSegment?.type === SEGMENT_TYPES.HOLD;

    return {
      state: this._state,
      isRunning: this._isRunning,
      isRehearsalMode: this._isRehearsalMode,
      currentSegmentIndex: this._currentSegmentIndex,
      currentSegment: this._currentSegment ? { ...this._currentSegment } : null,
      nextSegment: this.nextSegment ? { ...this.nextSegment } : null,
      previousSegment: this.previousSegment ? { ...this.previousSegment } : null,
      segmentElapsedMs: this.segmentElapsedMs,
      segmentRemainingMs: this.segmentRemainingMs,
      segmentProgress: this.segmentProgress,
      showElapsedMs: this.showElapsedMs,
      showStartTime: this._showStartTime,
      // Include segments array so clients always have the correct rundown
      // Previously missing - caused SHOW PROGRESS to fall back to legacy showConfig.segments
      segments: this.segments,
      segmentCount: this.segments.length,
      historyCount: this._history.length,
      overrideCount: this._overrides.length,
      // Hold segment state
      isHoldSegment: isHold,
      canAdvanceHold: this.canAdvanceHold(),
      holdRemainingMs: isHold ? this.getHoldRemainingMs() : 0,
      // Deleted segment state (Task 35)
      currentSegmentDeleted: this._currentSegmentDeleted,
      deletedSegmentOriginalIndex: this._deletedSegmentOriginalIndex
    };
  }

  /**
   * Get override history
   * @returns {Object[]} Array of override entries
   */
  getOverrides() {
    return [...this._overrides];
  }

  /**
   * Get segment history
   * @returns {Object[]} Array of history entries
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Update show config (e.g., after hot reload)
   * @param {Object} showConfig - New show configuration
   */
  updateConfig(showConfig) {
    const wasRunning = this._isRunning;
    const currentSegmentId = this._currentSegment?.id;
    const previousIndex = this._currentSegmentIndex;

    this.showConfig = showConfig;

    // Reset deleted segment flag by default
    this._currentSegmentDeleted = false;
    this._deletedSegmentOriginalIndex = -1;

    // If running, try to maintain position by segment ID (Task 37: ID-based matching)
    if (wasRunning && currentSegmentId) {
      const newIndex = this.segments.findIndex(s => s.id === currentSegmentId);
      if (newIndex >= 0) {
        // Segment still exists - update to its new position
        const oldIndex = previousIndex;
        this._currentSegmentIndex = newIndex;
        this._currentSegment = this.segments[newIndex];

        // Log if the segment moved to a different position (Task 37)
        if (oldIndex !== newIndex) {
          console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] Current segment '${currentSegmentId}' moved from index ${oldIndex} to ${newIndex} - position updated`);
        }
      } else {
        // Current segment was deleted (Task 35)
        // Keep the stale segment data for display, but mark it as deleted
        this._currentSegmentDeleted = true;
        this._deletedSegmentOriginalIndex = previousIndex;

        console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] Current segment '${currentSegmentId}' was deleted from rundown. Staying on stale segment until manual advance.`);

        this.emit('currentSegmentDeleted', {
          segmentId: currentSegmentId,
          segmentName: this._currentSegment?.name,
          originalIndex: previousIndex,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Set rehearsal mode on or off
   * In rehearsal mode, OBS scene changes and graphics firing are skipped,
   * but timing proceeds normally for practice.
   * @param {boolean} enabled - Whether to enable rehearsal mode
   */
  setRehearsalMode(enabled) {
    const wasRehearsalMode = this._isRehearsalMode;
    this._isRehearsalMode = !!enabled;

    if (wasRehearsalMode !== this._isRehearsalMode) {
      this.emit('rehearsalModeChanged', {
        isRehearsalMode: this._isRehearsalMode,
        timestamp: Date.now()
      });

      console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] Rehearsal mode ${this._isRehearsalMode ? 'ENABLED' : 'DISABLED'}`);
    }
  }

  /**
   * Find segment index by ID
   * @param {string} segmentId - Segment ID to find
   * @returns {number} Segment index or -1 if not found
   */
  findSegmentIndex(segmentId) {
    return this.segments.findIndex(s => s.id === segmentId);
  }

  /**
   * Get segment by ID
   * @param {string} segmentId - Segment ID to find
   * @returns {Object|null} Segment or null if not found
   */
  getSegment(segmentId) {
    return this.segments.find(s => s.id === segmentId) || null;
  }

  // ============================================================
  // MANUAL CONTROLS AND OVERRIDES
  // ============================================================

  /**
   * Advance to the next segment (manual)
   * @param {string} [advancedBy] - Who triggered the advance (for logging)
   * @returns {boolean} True if advanced successfully
   */
  async advance(advancedBy) {
    if (!this._isRunning) {
      return false;
    }

    // Determine next index based on whether current segment was deleted (Task 35)
    let nextIndex;
    if (this._currentSegmentDeleted) {
      // Current segment was deleted - find next valid segment after original position
      // Use the deleted segment's original index to determine where to go next
      nextIndex = this._deletedSegmentOriginalIndex;
      // Ensure we're within bounds - if original position is beyond current segments,
      // go to last segment
      if (nextIndex >= this.segments.length) {
        nextIndex = this.segments.length - 1;
      }

      console.log(`[Timesheet${this.compId ? ':' + this.compId : ''}] Advancing from deleted segment - jumping to index ${nextIndex}`);

      // Clear the deleted flag since we're moving to a valid segment
      this._currentSegmentDeleted = false;
      this._deletedSegmentOriginalIndex = -1;
    } else {
      // Normal advance - go to next index
      nextIndex = this._currentSegmentIndex + 1;
    }

    if (nextIndex >= this.segments.length) {
      this.emit('error', {
        type: 'advance_failed',
        message: 'Cannot advance: already at last segment'
      });
      return false;
    }

    // For hold segments, check minDuration (skip this check if current segment was deleted)
    if (!this._currentSegmentDeleted && this._currentSegment?.type === SEGMENT_TYPES.HOLD && !this.canAdvanceHold()) {
      this.emit('error', {
        type: 'advance_blocked',
        message: `Cannot advance: hold segment requires ${this.getHoldRemainingMs()}ms more`,
        holdRemainingMs: this.getHoldRemainingMs()
      });
      return false;
    }

    // Record the override
    this._recordOverride('advance', {
      advancedBy,
      fromSegmentId: this._currentSegment?.id,
      fromSegmentIndex: this._currentSegmentIndex,
      toSegmentIndex: nextIndex,
      toSegmentId: this.segments[nextIndex]?.id,
      wasDeletedSegment: this._currentSegmentDeleted
    });

    // Activate next segment
    await this._activateSegment(nextIndex, 'manual');
    return true;
  }

  /**
   * Go to the previous segment (manual)
   * @param {string} [triggeredBy] - Who triggered the previous (for logging)
   * @returns {boolean} True if went back successfully
   */
  async previous(triggeredBy) {
    if (!this._isRunning) {
      return false;
    }

    const prevIndex = this._currentSegmentIndex - 1;
    if (prevIndex < 0) {
      this.emit('error', {
        type: 'previous_failed',
        message: 'Cannot go previous: already at first segment'
      });
      return false;
    }

    // Record the override
    this._recordOverride('previous', {
      triggeredBy,
      fromSegmentId: this._currentSegment?.id,
      fromSegmentIndex: this._currentSegmentIndex,
      toSegmentIndex: prevIndex,
      toSegmentId: this.segments[prevIndex]?.id
    });

    // Activate previous segment
    await this._activateSegment(prevIndex, 'manual');
    return true;
  }

  /**
   * Jump to a specific segment by ID
   * @param {string} segmentId - Segment ID to jump to
   * @param {string} [triggeredBy] - Who triggered the jump (for logging)
   * @returns {boolean} True if jumped successfully
   */
  async goToSegment(segmentId, triggeredBy) {
    if (!this._isRunning) {
      return false;
    }

    const targetIndex = this.findSegmentIndex(segmentId);
    if (targetIndex < 0) {
      this.emit('error', {
        type: 'jump_failed',
        message: `Cannot jump: segment '${segmentId}' not found`
      });
      return false;
    }

    if (targetIndex === this._currentSegmentIndex) {
      // Already at this segment, nothing to do
      return true;
    }

    // Record the override
    this._recordOverride('jump', {
      triggeredBy,
      fromSegmentId: this._currentSegment?.id,
      fromSegmentIndex: this._currentSegmentIndex,
      toSegmentIndex: targetIndex,
      toSegmentId: segmentId
    });

    // Activate target segment
    await this._activateSegment(targetIndex, 'jump');
    return true;
  }

  /**
   * Override to a specific OBS scene (outside of normal flow)
   * This does NOT change the current segment, only the displayed scene
   * @param {string} sceneName - OBS scene name to switch to
   * @param {string} [triggeredBy] - Who triggered the override (for logging)
   * @returns {boolean} True if scene switch succeeded
   */
  async overrideScene(sceneName, triggeredBy) {
    if (!this.obs) {
      this.emit('error', {
        type: 'override_scene_failed',
        message: 'Cannot override scene: OBS not connected'
      });
      return false;
    }

    try {
      // Switch to the scene using cut transition
      await this.obs.call('SetCurrentSceneTransition', {
        transitionName: 'Cut'
      });
      await this.obs.call('SetCurrentProgramScene', {
        sceneName: sceneName
      });

      // Record the override
      this._recordOverride('scene_override', {
        triggeredBy,
        sceneName,
        currentSegmentId: this._currentSegment?.id,
        currentSegmentScene: this._currentSegment?.obsScene
      });

      this.emit('sceneOverridden', {
        sceneName,
        segmentId: this._currentSegment?.id,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.emit('error', {
        type: 'override_scene_failed',
        message: `Failed to switch to scene '${sceneName}': ${error.message}`
      });
      return false;
    }
  }

  /**
   * Override to a specific camera's scene
   * Looks up the camera and switches to its single-camera scene
   * @param {string} cameraId - Camera ID to switch to
   * @param {string} [triggeredBy] - Who triggered the override (for logging)
   * @returns {boolean} True if camera switch succeeded
   */
  async overrideCamera(cameraId, triggeredBy) {
    if (!this.obs) {
      this.emit('error', {
        type: 'override_camera_failed',
        message: 'Cannot override camera: OBS not connected'
      });
      return false;
    }

    // Find the camera in config
    const cameras = this.showConfig.cameras || [];
    const camera = cameras.find(c => c.id === cameraId);

    if (!camera) {
      this.emit('error', {
        type: 'override_camera_failed',
        message: `Cannot override camera: camera '${cameraId}' not found`
      });
      return false;
    }

    // Determine scene name - use camera's scene or generate standard name
    const sceneName = camera.sceneName || `Single - ${camera.name}`;

    try {
      // Switch to the camera's scene using cut transition
      await this.obs.call('SetCurrentSceneTransition', {
        transitionName: 'Cut'
      });
      await this.obs.call('SetCurrentProgramScene', {
        sceneName: sceneName
      });

      // Record the override
      this._recordOverride('camera_override', {
        triggeredBy,
        cameraId,
        cameraName: camera.name,
        sceneName,
        currentSegmentId: this._currentSegment?.id,
        currentSegmentScene: this._currentSegment?.obsScene
      });

      this.emit('cameraOverridden', {
        cameraId,
        cameraName: camera.name,
        sceneName,
        segmentId: this._currentSegment?.id,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.emit('error', {
        type: 'override_camera_failed',
        message: `Failed to switch to camera '${cameraId}': ${error.message}`
      });
      return false;
    }
  }
}

// Export
export { TimesheetEngine, SEGMENT_TYPES, ENGINE_STATE, TRANSITION_TYPES };
export default TimesheetEngine;
