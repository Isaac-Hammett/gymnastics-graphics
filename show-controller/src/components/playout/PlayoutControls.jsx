import { useState, useCallback } from 'react';
import {
  PauseIcon,
  PlayIcon,
  ForwardIcon,
  VideoCameraIcon,
  StopIcon,
  ArrowUturnLeftIcon,
  QuestionMarkCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';

/**
 * PlayoutControls — Persistent override control bar at bottom of playout panel
 *
 * Actions:
 * - Pause/Resume (Space) — toggle pause state
 * - Skip (S) — skip current clip, advance to next
 * - Force Camera (1-6) — dropdown to override with specific camera
 * - Stop Playout — exits playout mode entirely
 * - Release Override (Esc) — release any override, return to autonomous mode
 * - Shortcuts (?) — open keyboard shortcuts panel
 *
 * Visual state:
 * - Amber border during override
 * - Green border during autonomous
 *
 * Props:
 * - isPaused: boolean — whether playout is currently paused
 * - isOverride: boolean — whether an override is active
 * - cameraStates: Array<{ cameraNumber, apparatus, state }> — available cameras
 * - onPause: () => void — toggle pause
 * - onSkip: () => void — skip current clip
 * - onForceCamera: (cameraNumber: number) => void — force camera override
 * - onStopPlayout: () => void — stop playout entirely
 * - onReleaseOverride: () => void — release override
 * - onShowShortcuts: () => void — open shortcuts panel
 */
export default function PlayoutControls({
  isPaused = false,
  isOverride = false,
  cameraStates = [],
  onPause,
  onSkip,
  onForceCamera,
  onStopPlayout,
  onReleaseOverride,
  onShowShortcuts,
}) {
  const [cameraDropdownOpen, setCameraDropdownOpen] = useState(false);

  const handleCameraSelect = useCallback((cameraNumber) => {
    onForceCamera?.(cameraNumber);
    setCameraDropdownOpen(false);
  }, [onForceCamera]);

  // Close dropdown when clicking outside
  const handleDropdownBlur = useCallback((e) => {
    // Check if the related target is within the dropdown
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setCameraDropdownOpen(false);
    }
  }, []);

  return (
    <div
      className={`bg-zinc-800 rounded-xl p-3 border ${
        isOverride ? 'border-amber-500/50' : 'border-green-500/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left group: Pause, Skip, Force Camera */}
        <div className="flex items-center gap-2">
          {/* Pause/Resume button */}
          <button
            onClick={onPause}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isPaused
                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
                : 'bg-zinc-700 text-white hover:bg-zinc-600 border border-zinc-600'
            }`}
            title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
          >
            {isPaused ? (
              <>
                <PlayIcon className="w-4 h-4" />
                <span>Resume</span>
                <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-zinc-800 rounded border border-zinc-600">
                  Space
                </kbd>
              </>
            ) : (
              <>
                <PauseIcon className="w-4 h-4" />
                <span>Pause</span>
                <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-zinc-800 rounded border border-zinc-600">
                  Space
                </kbd>
              </>
            )}
          </button>

          {/* Skip button */}
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-700 text-white hover:bg-zinc-600 border border-zinc-600 transition-colors"
            title="Skip Current (S)"
          >
            <ForwardIcon className="w-4 h-4" />
            <span>Skip</span>
            <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-zinc-800 rounded border border-zinc-600">
              S
            </kbd>
          </button>

          {/* Force Camera dropdown */}
          <div className="relative" onBlur={handleDropdownBlur}>
            <button
              onClick={() => setCameraDropdownOpen(!cameraDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isOverride
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                  : 'bg-zinc-700 text-white hover:bg-zinc-600 border border-zinc-600'
              }`}
              title="Force Camera (1-6)"
            >
              <VideoCameraIcon className="w-4 h-4" />
              <span>Force Camera</span>
              <ChevronDownIcon className="w-3 h-3" />
            </button>

            {/* Dropdown menu */}
            {cameraDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50">
                <div className="p-1">
                  {cameraStates.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-zinc-500">
                      No cameras available
                    </div>
                  ) : (
                    cameraStates.map(({ cameraNumber, apparatus }) => (
                      <button
                        key={cameraNumber}
                        onClick={() => handleCameraSelect(cameraNumber)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-zinc-700 rounded transition-colors"
                      >
                        <kbd className="px-1.5 py-0.5 text-xs bg-zinc-800 rounded border border-zinc-600">
                          {cameraNumber}
                        </kbd>
                        <span>{apparatus || `Camera ${cameraNumber}`}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right group: Stop, Release Override, Shortcuts */}
        <div className="flex items-center gap-2">
          {/* Stop Playout button */}
          <button
            onClick={onStopPlayout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
            title="Stop Playout"
          >
            <StopIcon className="w-4 h-4" />
            <span>Stop</span>
          </button>

          {/* Release Override button - only visible during override */}
          {isOverride && (
            <button
              onClick={onReleaseOverride}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
              title="Release Override (Esc)"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
              <span>Release</span>
              <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-zinc-800 rounded border border-zinc-600">
                Esc
              </kbd>
            </button>
          )}

          {/* Shortcuts button */}
          <button
            onClick={onShowShortcuts}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-zinc-700 text-white hover:bg-zinc-600 border border-zinc-600 transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <QuestionMarkCircleIcon className="w-4 h-4" />
            <kbd className="px-1.5 py-0.5 text-xs bg-zinc-800 rounded border border-zinc-600">
              ?
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
