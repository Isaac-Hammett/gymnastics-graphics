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
 * - 'showStopped': Emitted when show ends
 * - 'holdMaxReached': Emitted when hold segment exceeds maxDuration
 * - 'overrideRecorded': Emitted when a manual override is logged
 * - 'stateChanged': Emitted when engine state changes
 */
class TimesheetEngine extends EventEmitter {
  /**
   * Create a new TimesheetEngine
   * @param {Object} options - Configuration options
   * @param {Object} options.showConfig - Show configuration with segments
   * @param {Object} options.obs - OBS WebSocket controller (optional)
   * @param {Object} options.firebase - Firebase controller for graphics (optional)
   * @param {Object} options.io - Socket.io server for broadcasting (optional)
   */
  constructor(options = {}) {
    super();

    this.showConfig = options.showConfig || { segments: [] };
    this.obs = options.obs || null;
    this.firebase = options.firebase || null;
    this.io = options.io || null;

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

    // Check for hold segment max duration
    if (this._currentSegment?.type === SEGMENT_TYPES.HOLD) {
      const maxDurationMs = (this._currentSegment.maxDuration || 0) * 1000;
      if (maxDurationMs > 0 && elapsedMs >= maxDurationMs) {
        this.emit('holdMaxReached', {
          segmentId: this._currentSegment.id,
          elapsedMs,
          maxDurationMs
        });
      }
    }

    // Check for auto-advance (handled in P4-03)
    // This is intentionally left for the next task
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

    // Determine transition type based on segment types
    const transition = this._getTransition(previousSegment, segment);
    this._lastTransitionType = transition.type;

    // Apply transition and switch scene
    await this._applyTransitionAndSwitchScene(segment, transition);

    // Handle segment-type specific actions
    await this._handleSegmentTypeActions(segment);

    // Apply audio overrides if defined
    await this._applyAudioOverrides(segment);

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
    if (!this.obs || !segment.obsScene) {
      return;
    }

    try {
      if (transition.type === TRANSITION_TYPES.FADE && transition.durationMs > 0) {
        // Use SetCurrentSceneTransitionDuration and then switch
        await this.obs.call('SetCurrentSceneTransitionDuration', {
          transitionDuration: transition.durationMs
        });
        await this.obs.call('SetCurrentSceneTransition', {
          transitionName: 'Fade'
        });
      } else if (transition.type === TRANSITION_TYPES.STINGER) {
        // Use stinger transition if configured
        await this.obs.call('SetCurrentSceneTransition', {
          transitionName: transition.transitionName || 'Stinger'
        });
      } else {
        // Cut transition (instant)
        await this.obs.call('SetCurrentSceneTransition', {
          transitionName: 'Cut'
        });
      }

      // Switch to the scene
      await this.obs.call('SetCurrentProgramScene', {
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
        if (segment.videoFile && this.obs) {
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

    const graphicData = {
      graphic: segment.graphic,
      data: segment.graphicData || {},
      segmentId: segment.id,
      timestamp: Date.now()
    };

    // Try Firebase first if available
    if (this.firebase) {
      try {
        await this.firebase.database().ref('graphics/current').set(graphicData);
      } catch (error) {
        this.emit('error', {
          type: 'firebase_graphic',
          message: `Failed to trigger graphic via Firebase: ${error.message}`,
          segmentId: segment.id
        });
      }
    }

    // Also broadcast via socket.io
    if (this.io) {
      this.io.emit('triggerGraphic', graphicData);
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
    if (!this.obs || !segment.videoFile) return;

    const sourceName = segment.videoSource || 'Video Player';

    try {
      // Get current settings
      const { inputSettings } = await this.obs.call('GetInputSettings', {
        inputName: sourceName
      });

      // Update with new file path
      await this.obs.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: {
          ...inputSettings,
          local_file: segment.videoFile,
          is_local_file: true
        }
      });

      // Restart the media source to play from beginning
      await this.obs.call('TriggerMediaInputAction', {
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
   * Apply audio overrides for a segment
   * @param {Object} segment - Current segment
   * @private
   */
  async _applyAudioOverrides(segment) {
    if (!this.obs || !segment.audio) return;

    const audioConfig = this.showConfig.audioConfig || {};

    try {
      // Apply venue audio volume
      if (segment.audio.venueVolume !== undefined && audioConfig.venue?.sourceName) {
        await this.obs.call('SetInputVolume', {
          inputName: audioConfig.venue.sourceName,
          inputVolumeDb: this._volumeToDb(segment.audio.venueVolume)
        });
      }

      // Apply commentary audio volume
      if (segment.audio.commentaryVolume !== undefined && audioConfig.commentary?.sourceName) {
        await this.obs.call('SetInputVolume', {
          inputName: audioConfig.commentary.sourceName,
          inputVolumeDb: this._volumeToDb(segment.audio.commentaryVolume)
        });
      }

      // Apply mute states
      if (segment.audio.muteVenue !== undefined && audioConfig.venue?.sourceName) {
        await this.obs.call('SetInputMute', {
          inputName: audioConfig.venue.sourceName,
          inputMuted: segment.audio.muteVenue
        });
      }

      if (segment.audio.muteCommentary !== undefined && audioConfig.commentary?.sourceName) {
        await this.obs.call('SetInputMute', {
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
    return {
      state: this._state,
      isRunning: this._isRunning,
      currentSegmentIndex: this._currentSegmentIndex,
      currentSegment: this._currentSegment ? { ...this._currentSegment } : null,
      nextSegment: this.nextSegment ? { ...this.nextSegment } : null,
      previousSegment: this.previousSegment ? { ...this.previousSegment } : null,
      segmentElapsedMs: this.segmentElapsedMs,
      segmentRemainingMs: this.segmentRemainingMs,
      segmentProgress: this.segmentProgress,
      showElapsedMs: this.showElapsedMs,
      showStartTime: this._showStartTime,
      segmentCount: this.segments.length,
      historyCount: this._history.length,
      overrideCount: this._overrides.length
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

    this.showConfig = showConfig;

    // If running, try to maintain position by segment ID
    if (wasRunning && currentSegmentId) {
      const newIndex = this.segments.findIndex(s => s.id === currentSegmentId);
      if (newIndex >= 0) {
        this._currentSegmentIndex = newIndex;
        this._currentSegment = this.segments[newIndex];
      }
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
}

// Export
export { TimesheetEngine, SEGMENT_TYPES, ENGINE_STATE, TRANSITION_TYPES };
export default TimesheetEngine;
