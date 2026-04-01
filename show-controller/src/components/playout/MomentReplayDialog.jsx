import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FlagIcon,
  PlayIcon,
  BookmarkIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';

/**
 * MomentReplayDialog — Modal for flagging and configuring moment replays
 *
 * Features:
 * - Clip time display showing when the flag was set
 * - Replay window adjustment (±1s increments, clamped to clip bounds)
 * - Mini timeline visualization
 * - Speed presets: 0.25x, 0.5x, 1x (toggle buttons)
 * - Audio mute toggle (default muted, persists for session)
 * - Play Now / Save Only / Cancel buttons
 * - Flagged moments list for current clip
 * - Dialog stays open if clip ends
 *
 * Props:
 * - isOpen: boolean — whether dialog is visible
 * - onClose: () => void — close dialog
 * - clip: object — current clip being flagged { athlete_name, apparatus, duration, draft_id }
 * - flagTime: number — time in seconds when flag was triggered
 * - flaggedMoments: Array<{ id, seekStart, seekEnd, speed, action }> — moments already flagged for this clip
 * - onPlayNow: (moment) => void — queue moment for immediate playback after clip
 * - onSaveOnly: (moment) => void — save to highlights pool
 * - onRemoveMoment: (momentId) => void — remove a previously flagged moment
 * - audioMuted: boolean — current session mute state
 * - onAudioMutedChange: (muted: boolean) => void — update session mute state
 */

// Default window size (±4 seconds from flag time per PRD)
const DEFAULT_WINDOW_SIZE = 4;

// Session storage key for mute preference
const MUTE_STORAGE_KEY = 'momentReplay_audioMuted';

export default function MomentReplayDialog({
  isOpen = false,
  onClose,
  clip = null,
  flagTime = 0,
  flaggedMoments = [],
  onPlayNow,
  onSaveOnly,
  onRemoveMoment,
  audioMuted: externalAudioMuted,
  onAudioMutedChange,
}) {
  // Local state for window adjustment
  const [seekStart, setSeekStart] = useState(0);
  const [seekEnd, setSeekEnd] = useState(0);
  const [speed, setSpeed] = useState(0.5);

  // Audio mute state (use external if provided, otherwise manage locally with session storage)
  const [localAudioMuted, setLocalAudioMuted] = useState(() => {
    if (typeof externalAudioMuted === 'boolean') return externalAudioMuted;
    // Check session storage for persistence
    const stored = sessionStorage.getItem(MUTE_STORAGE_KEY);
    return stored !== null ? stored === 'true' : true; // Default muted per PRD
  });

  const audioMuted = typeof externalAudioMuted === 'boolean' ? externalAudioMuted : localAudioMuted;

  const duration = clip?.duration || 0;

  // Minimum replay window size in seconds
  const MIN_WINDOW_SIZE = 2;

  // Initialize window based on flag time when dialog opens
  useEffect(() => {
    if (isOpen && flagTime !== undefined) {
      // Clamp window to clip bounds per PRD
      let start = Math.max(0, flagTime - DEFAULT_WINDOW_SIZE);
      let end = Math.min(duration, flagTime + DEFAULT_WINDOW_SIZE);
      // Enforce minimum window size
      if (end - start < MIN_WINDOW_SIZE && duration >= MIN_WINDOW_SIZE) {
        if (end >= duration) {
          start = Math.max(0, end - MIN_WINDOW_SIZE);
        } else {
          end = Math.min(duration, start + MIN_WINDOW_SIZE);
        }
      }
      setSeekStart(start);
      setSeekEnd(end);
      setSpeed(0.5); // Reset to default speed
    }
  }, [isOpen, flagTime, duration]);

  // Handle audio mute toggle
  const handleAudioMutedChange = useCallback((muted) => {
    if (onAudioMutedChange) {
      onAudioMutedChange(muted);
    } else {
      setLocalAudioMuted(muted);
      sessionStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    }
  }, [onAudioMutedChange]);

  // Adjust seek start (clamped)
  const adjustSeekStart = useCallback((delta) => {
    setSeekStart(prev => {
      const newVal = prev + delta;
      // Can't go below 0 or above seekEnd - 1
      return Math.max(0, Math.min(seekEnd - 1, newVal));
    });
  }, [seekEnd]);

  // Adjust seek end (clamped)
  const adjustSeekEnd = useCallback((delta) => {
    setSeekEnd(prev => {
      const newVal = prev + delta;
      // Can't go below seekStart + 1 or above duration
      return Math.max(seekStart + 1, Math.min(duration, newVal));
    });
  }, [seekStart, duration]);

  // Handle direct input for seek start
  const handleSeekStartChange = useCallback((value) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setSeekStart(Math.max(0, Math.min(seekEnd - 1, num)));
    }
  }, [seekEnd]);

  // Handle direct input for seek end
  const handleSeekEndChange = useCallback((value) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setSeekEnd(Math.max(seekStart + 1, Math.min(duration, num)));
    }
  }, [seekStart, duration]);

  // Format time as M:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Build moment object
  const buildMoment = useCallback(() => ({
    id: `moment-${Date.now()}`,
    clipId: clip?.draft_id,
    athleteName: clip?.athlete_name,
    apparatus: clip?.apparatus,
    flagTime,
    seekStart,
    seekEnd,
    speed,
    audioMuted,
    createdAt: Date.now(),
  }), [clip, flagTime, seekStart, seekEnd, speed, audioMuted]);

  // Handle Play Now
  const handlePlayNow = useCallback(() => {
    onPlayNow?.(buildMoment());
    onClose?.();
  }, [buildMoment, onPlayNow, onClose]);

  // Handle Save Only
  const handleSaveOnly = useCallback(() => {
    onSaveOnly?.(buildMoment());
    onClose?.();
  }, [buildMoment, onSaveOnly, onClose]);

  // Calculate timeline visualization percentages
  const timelinePercentages = useMemo(() => {
    if (duration === 0) return { start: 0, end: 100, flag: 50 };
    return {
      start: (seekStart / duration) * 100,
      end: (seekEnd / duration) * 100,
      flag: (flagTime / duration) * 100,
    };
  }, [seekStart, seekEnd, flagTime, duration]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="moment-replay-title"
    >
      <div className="bg-zinc-800 rounded-xl border border-zinc-700 shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlagIcon className="w-4 h-4 text-cyan-400" />
            <h2 id="moment-replay-title" className="text-sm font-semibold text-white uppercase tracking-wide">
              Moment Flagged
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors rounded hover:bg-zinc-700"
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Clip info */}
          <div className="text-sm">
            <span className="text-white font-medium">
              {truncateAthleteName(clip?.athlete_name)}
            </span>
            {clip?.apparatus && (
              <span className="text-zinc-400"> · {clip.apparatus}</span>
            )}
          </div>

          {/* Flag time display */}
          <div className="text-sm text-zinc-400">
            Clip time: <span className="text-white font-mono">{formatTime(flagTime)}</span>
          </div>

          {/* Replay window adjustment */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Replay Window</div>
            <div className="flex items-center gap-2">
              {/* Start time spinbox */}
              <div className="flex items-center gap-1">
                <TimeSpinbox
                  value={seekStart}
                  onChange={handleSeekStartChange}
                  onIncrement={() => adjustSeekStart(1)}
                  onDecrement={() => adjustSeekStart(-1)}
                  min={0}
                  max={seekEnd - 1}
                  formatTime={formatTime}
                />
              </div>
              <span className="text-zinc-500">to</span>
              {/* End time spinbox */}
              <div className="flex items-center gap-1">
                <TimeSpinbox
                  value={seekEnd}
                  onChange={handleSeekEndChange}
                  onIncrement={() => adjustSeekEnd(1)}
                  onDecrement={() => adjustSeekEnd(-1)}
                  min={seekStart + 1}
                  max={duration}
                  formatTime={formatTime}
                />
              </div>
              <span className="text-zinc-500 text-xs">(adjust ±1s)</span>
            </div>
          </div>

          {/* Mini timeline visualization */}
          <div className="space-y-1">
            <div className="h-6 bg-zinc-900 rounded relative overflow-hidden">
              {/* Full clip background */}
              <div className="absolute inset-0 bg-zinc-700/30" />

              {/* Selected range */}
              <div
                className="absolute top-0 bottom-0 bg-cyan-500/40"
                style={{
                  left: `${timelinePercentages.start}%`,
                  width: `${timelinePercentages.end - timelinePercentages.start}%`,
                }}
              />

              {/* Flag position marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-400"
                style={{ left: `${timelinePercentages.flag}%` }}
              />

              {/* Start/end markers */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white/60 rounded-l"
                style={{ left: `${timelinePercentages.start}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white/60 rounded-r"
                style={{ left: `calc(${timelinePercentages.end}% - 4px)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>0:00</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Speed presets */}
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Speed</div>
            <div className="flex items-center gap-2">
              {[0.25, 0.5, 1].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    speed === s
                      ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                      : 'bg-zinc-700 text-zinc-300 border border-zinc-600 hover:bg-zinc-600'
                  }`}
                >
                  {s}x
                </button>
              ))}

              {/* Audio toggle */}
              <div className="ml-auto">
                <button
                  onClick={() => handleAudioMutedChange(!audioMuted)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-sm rounded transition-colors ${
                    audioMuted
                      ? 'bg-zinc-700 text-zinc-400 border border-zinc-600 hover:bg-zinc-600'
                      : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                  }`}
                  title={audioMuted ? 'Unmute replay audio' : 'Mute replay audio'}
                >
                  {audioMuted ? (
                    <SpeakerXMarkIcon className="w-4 h-4" />
                  ) : (
                    <SpeakerWaveIcon className="w-4 h-4" />
                  )}
                  <span>{audioMuted ? 'Muted' : 'Audio'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePlayNow}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg border border-green-500/30 transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              Play Now
            </button>
            <button
              onClick={handleSaveOnly}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg border border-blue-500/30 transition-colors"
            >
              <BookmarkIcon className="w-4 h-4" />
              Save Only
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 rounded-lg border border-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Help text */}
          <div className="text-xs text-zinc-500 space-y-1">
            <p><strong>Play Now:</strong> Replay immediately after clip, before next</p>
            <p><strong>Save Only:</strong> Save to highlights pool for later use</p>
          </div>
        </div>

        {/* Flagged moments list (if any) */}
        {flaggedMoments.length > 0 && (
          <div className="px-4 pb-4 pt-2 border-t border-zinc-700">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
              Flagged Moments (this clip)
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {flaggedMoments.map((moment, index) => (
                <div
                  key={moment.id}
                  className="flex items-center justify-between bg-zinc-900 rounded px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{index + 1}.</span>
                    <span className="text-white font-mono">
                      {formatTime(moment.seekStart)}–{formatTime(moment.seekEnd)}
                    </span>
                    <span className="text-zinc-400">{moment.speed}x</span>
                    {moment.action === 'playNow' ? (
                      <span className="flex items-center gap-0.5 text-green-400">
                        <PlayIcon className="w-3 h-3" />
                        Play Now
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-blue-400">
                        <BookmarkIcon className="w-3 h-3" />
                        Saved
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveMoment?.(moment.id)}
                    className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Remove moment"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TimeSpinbox — Numeric input with up/down buttons for time adjustment
 */
function TimeSpinbox({ value, onChange, onIncrement, onDecrement, min, max, formatTime }) {
  const handleInputChange = (e) => {
    // Parse time input (M:SS format)
    const parts = e.target.value.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      onChange(mins * 60 + secs);
    } else if (parts.length === 1) {
      const secs = parseInt(parts[0], 10) || 0;
      onChange(secs);
    }
  };

  return (
    <div className="flex items-center">
      <input
        type="text"
        value={formatTime(value)}
        onChange={handleInputChange}
        className="w-14 px-2 py-1 text-sm font-mono text-white bg-zinc-900 border border-zinc-600 rounded-l focus:outline-none focus:border-cyan-500 text-center"
      />
      <div className="flex flex-col">
        <button
          onClick={onIncrement}
          disabled={value >= max}
          className="px-1 py-0.5 bg-zinc-700 border border-l-0 border-zinc-600 rounded-tr text-zinc-400 hover:bg-zinc-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUpIcon className="w-3 h-3" />
        </button>
        <button
          onClick={onDecrement}
          disabled={value <= min}
          className="px-1 py-0.5 bg-zinc-700 border border-l-0 border-t-0 border-zinc-600 rounded-br text-zinc-400 hover:bg-zinc-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDownIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Truncate athlete name with ellipsis after 20 characters
 */
function truncateAthleteName(name) {
  if (!name) return 'Unknown Athlete';
  if (name.length <= 20) return name;
  return name.substring(0, 17) + '...';
}
