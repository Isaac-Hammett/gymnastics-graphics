import { useEffect, useRef, useCallback } from 'react';

/**
 * usePlayoutSimulation - Timer logic for Stage A mock playback
 *
 * This hook handles:
 * - setInterval advancing clip elapsed time for progress display
 * - Simulated score reveal trigger at Math.max(duration - 5, duration * 0.6)
 * - Simulated preloading state transitions (none → preloading → preload-ready)
 * - Auto-advance: clip ends → next clip (or → moment replay → next clip)
 * - Moment replay duration: (seekEnd - seekStart) / playbackRate
 * - Fallback mode entry when queue empties
 * - Timer cleanup in useEffect cleanup function
 *
 * @param {Object} playoutState - State and setters from usePlayoutState
 */
export default function usePlayoutSimulation(playoutState) {
  const {
    isPlayoutActive,
    currentMode,
    setCurrentMode,
    clips,
    setClips,
    currentClip,
    nextClip,
    momentReplay,
    setMomentReplay,
    preloadState,
    setPreloadState,
    setEventLog,
    CLIP_STATUS,
    PRELOAD_STATE,
    PLAYOUT_MODE
  } = playoutState;

  // Refs for interval management
  const clipTimerRef = useRef(null);
  const preloadTimerRef = useRef(null);
  const momentReplayTimerRef = useRef(null);

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
   * Advance to the next queued clip
   * Returns true if a next clip exists, false if queue is empty
   */
  const advanceToNextClip = useCallback(() => {
    if (!currentClip) return false;

    // Find the next queued clip
    let foundNext = false;
    let nextClipId = null;

    setClips(prev => {
      const currentIndex = prev.findIndex(c => c.draft_id === currentClip.draft_id);
      const updated = prev.map((clip, index) => {
        // Mark current clip as played
        if (clip.draft_id === currentClip.draft_id) {
          return { ...clip, status: CLIP_STATUS.PLAYED, elapsed: null };
        }
        // Find next queued clip and mark it as playing
        if (!foundNext && index > currentIndex && clip.status === CLIP_STATUS.QUEUED) {
          foundNext = true;
          nextClipId = clip.draft_id;
          return { ...clip, status: CLIP_STATUS.PLAYING, elapsed: 0, scoreRevealed: false };
        }
        return clip;
      });
      return updated;
    });

    if (foundNext) {
      addLogEntry('clip', `Now playing: ${nextClipId?.slice(0, 8)}...`);
      // Reset preload state for next cycle
      setPreloadState({
        state: PRELOAD_STATE.NONE,
        clipId: null,
        progress: 0
      });
    }

    return foundNext;
  }, [currentClip, setClips, setPreloadState, addLogEntry, CLIP_STATUS, PRELOAD_STATE]);

  /**
   * Main clip timer effect
   * Advances elapsed time, triggers score reveal, handles auto-advance
   */
  useEffect(() => {
    // Clear any existing timer
    if (clipTimerRef.current) {
      clearInterval(clipTimerRef.current);
      clipTimerRef.current = null;
    }

    // Only run timer when:
    // - Playout is active
    // - We're in CLIP mode (not paused, override, or moment replay)
    // - There's a current clip playing
    if (!isPlayoutActive || currentMode !== PLAYOUT_MODE.CLIP || !currentClip) {
      return;
    }

    const TICK_INTERVAL = 100; // 100ms for smooth progress updates

    clipTimerRef.current = setInterval(() => {
      setClips(prev => {
        return prev.map(clip => {
          if (clip.draft_id !== currentClip.draft_id || clip.status !== CLIP_STATUS.PLAYING) {
            return clip;
          }

          const newElapsed = (clip.elapsed || 0) + (TICK_INTERVAL / 1000);
          const duration = clip.duration || 30;

          // Calculate score reveal threshold: max(duration - 5, duration * 0.6)
          const scoreRevealThreshold = Math.max(duration - 5, duration * 0.6);

          // Check if we should trigger score reveal
          const shouldTriggerScoreReveal = !clip.scoreRevealed && newElapsed >= scoreRevealThreshold;

          // Check if clip has ended
          if (newElapsed >= duration) {
            // Will be handled by separate effect that checks for clip end
            return { ...clip, elapsed: duration, scoreRevealed: true };
          }

          return {
            ...clip,
            elapsed: newElapsed,
            scoreRevealed: clip.scoreRevealed || shouldTriggerScoreReveal
          };
        });
      });
    }, TICK_INTERVAL);

    return () => {
      if (clipTimerRef.current) {
        clearInterval(clipTimerRef.current);
        clipTimerRef.current = null;
      }
    };
  }, [isPlayoutActive, currentMode, currentClip?.draft_id, setClips, CLIP_STATUS, PLAYOUT_MODE]);

  /**
   * Score reveal logging effect
   * Logs when a score is revealed for debugging
   */
  useEffect(() => {
    if (currentClip?.scoreRevealed) {
      // Find clip to check if it was just revealed
      const clip = clips.find(c => c.draft_id === currentClip.draft_id);
      if (clip?.scoreRevealed && clip.score !== null) {
        // Log only once per clip (tracked by scoreRevealed flag)
        // In a real implementation, this would trigger the score graphic
      }
    }
  }, [currentClip?.scoreRevealed, currentClip?.draft_id, clips]);

  /**
   * Clip end detection and auto-advance effect
   */
  useEffect(() => {
    if (!currentClip || currentMode !== PLAYOUT_MODE.CLIP) return;

    const clip = clips.find(c => c.draft_id === currentClip.draft_id);
    if (!clip) return;

    const duration = clip.duration || 30;
    const elapsed = clip.elapsed || 0;

    // Check if clip has ended
    if (elapsed >= duration && clip.status === CLIP_STATUS.PLAYING) {
      // Check if there's a moment replay queued
      if (momentReplay && momentReplay.playNow) {
        // Start moment replay
        setCurrentMode(PLAYOUT_MODE.MOMENT_REPLAY);
        addLogEntry('moment', `Playing moment replay: ${momentReplay.athleteName}`);
        return;
      }

      // Otherwise, advance to next clip
      const hasNext = advanceToNextClip();

      if (!hasNext) {
        // Queue is empty, enter fallback mode
        setCurrentMode(PLAYOUT_MODE.FALLBACK);
        addLogEntry('system', 'Queue empty - entering fallback mode');
      }
    }
  }, [
    clips,
    currentClip?.draft_id,
    currentMode,
    momentReplay,
    setCurrentMode,
    advanceToNextClip,
    addLogEntry,
    CLIP_STATUS,
    PLAYOUT_MODE
  ]);

  /**
   * Moment replay timer effect
   * Plays moment replay for calculated duration, then advances to next clip
   */
  useEffect(() => {
    // Clear any existing timer
    if (momentReplayTimerRef.current) {
      clearTimeout(momentReplayTimerRef.current);
      momentReplayTimerRef.current = null;
    }

    // Only run when in moment replay mode
    if (currentMode !== PLAYOUT_MODE.MOMENT_REPLAY || !momentReplay) {
      return;
    }

    // Calculate replay duration: (seekEnd - seekStart) / playbackRate
    const replayDuration = momentReplay.duration * 1000; // Convert to milliseconds

    addLogEntry('moment', `Moment replay: ${(replayDuration / 1000).toFixed(1)}s at ${momentReplay.speed}x`);

    momentReplayTimerRef.current = setTimeout(() => {
      // Moment replay finished
      addLogEntry('moment', 'Moment replay finished');

      // Clear moment replay
      setMomentReplay(null);

      // Advance to next clip
      const hasNext = advanceToNextClip();

      if (hasNext) {
        setCurrentMode(PLAYOUT_MODE.CLIP);
      } else {
        // Queue is empty, enter fallback mode
        setCurrentMode(PLAYOUT_MODE.FALLBACK);
        addLogEntry('system', 'Queue empty after moment replay - entering fallback mode');
      }
    }, replayDuration);

    return () => {
      if (momentReplayTimerRef.current) {
        clearTimeout(momentReplayTimerRef.current);
        momentReplayTimerRef.current = null;
      }
    };
  }, [
    currentMode,
    momentReplay,
    setMomentReplay,
    setCurrentMode,
    advanceToNextClip,
    addLogEntry,
    PLAYOUT_MODE
  ]);

  /**
   * Preload simulation effect
   * Simulates preloading the next clip in the queue
   */
  useEffect(() => {
    // Clear any existing timer
    if (preloadTimerRef.current) {
      clearInterval(preloadTimerRef.current);
      preloadTimerRef.current = null;
    }

    // Only preload when:
    // - Playout is active
    // - We're in CLIP mode
    // - There's a current clip playing
    // - There's a next clip to preload
    // - We haven't already preloaded this clip
    if (
      !isPlayoutActive ||
      currentMode !== PLAYOUT_MODE.CLIP ||
      !currentClip ||
      !nextClip ||
      preloadState.clipId === nextClip.draft_id
    ) {
      return;
    }

    // Start preloading when clip is 30% through
    const duration = currentClip.duration || 30;
    const elapsed = currentClip.elapsed || 0;
    const preloadThreshold = duration * 0.3;

    if (elapsed < preloadThreshold) {
      return; // Not time to preload yet
    }

    // Start preload simulation
    setPreloadState({
      state: PRELOAD_STATE.PRELOADING,
      clipId: nextClip.draft_id,
      progress: 0
    });

    addLogEntry('preload', `Preloading: ${nextClip.athlete_name}`);

    // Simulate preload progress over 2 seconds
    let progress = 0;
    const PRELOAD_DURATION = 2000;
    const PRELOAD_TICK = 100;
    const progressIncrement = 100 / (PRELOAD_DURATION / PRELOAD_TICK);

    preloadTimerRef.current = setInterval(() => {
      progress += progressIncrement;

      if (progress >= 100) {
        // Preload complete
        setPreloadState(prev => ({
          ...prev,
          state: PRELOAD_STATE.PRELOAD_READY,
          progress: 100
        }));
        addLogEntry('preload', `Preload ready: ${nextClip.athlete_name}`);

        if (preloadTimerRef.current) {
          clearInterval(preloadTimerRef.current);
          preloadTimerRef.current = null;
        }
      } else {
        setPreloadState(prev => ({
          ...prev,
          progress: Math.min(progress, 100)
        }));
      }
    }, PRELOAD_TICK);

    return () => {
      if (preloadTimerRef.current) {
        clearInterval(preloadTimerRef.current);
        preloadTimerRef.current = null;
      }
    };
  }, [
    isPlayoutActive,
    currentMode,
    currentClip?.draft_id,
    currentClip?.elapsed,
    currentClip?.duration,
    nextClip?.draft_id,
    nextClip?.athlete_name,
    preloadState.clipId,
    setPreloadState,
    addLogEntry,
    PRELOAD_STATE,
    PLAYOUT_MODE
  ]);

  /**
   * Cleanup effect for all timers on unmount
   */
  useEffect(() => {
    return () => {
      if (clipTimerRef.current) {
        clearInterval(clipTimerRef.current);
      }
      if (preloadTimerRef.current) {
        clearInterval(preloadTimerRef.current);
      }
      if (momentReplayTimerRef.current) {
        clearTimeout(momentReplayTimerRef.current);
      }
    };
  }, []);

  // This hook doesn't return anything - it's purely for side effects
  // All state mutations happen through the playoutState setters
  return null;
}
