import { useState, useEffect } from 'react';
import { VideoCameraIcon } from '@heroicons/react/24/solid';

/**
 * CameraStatusPanel — Shows real-time state of all cameras
 * Replaces Quick Camera Switch panel when playout is active.
 *
 * Props (from usePlayoutState):
 * - cameraStates: Array of { cameraNumber, apparatus, state, startedAt, athleteName }
 * - forceCamera: (cameraNumber) => void — action from usePlayoutActions
 * - overrideState: { active, type, cameraNumber } — current override state
 *
 * Camera states:
 * - idle: Gray dot — no activity
 * - recording: Green dot — routine in progress (being recorded)
 * - live: Red dot — currently being shown on stream
 * - recording-live: Red dot with green ring — recording AND shown live
 */

// Apparatus colors per PRD (EVS color-coding pattern)
const APPARATUS_COLORS = {
  VT: 'bg-red-500',
  UB: 'bg-purple-500',
  BB: 'bg-blue-500',
  FX: 'bg-green-500',
  PH: 'bg-orange-500',
  SR: 'bg-teal-500',
  PB: 'bg-indigo-500',
  HB: 'bg-amber-500',
};

const APPARATUS_TEXT_COLORS = {
  VT: 'text-red-400',
  UB: 'text-purple-400',
  BB: 'text-blue-400',
  FX: 'text-green-400',
  PH: 'text-orange-400',
  SR: 'text-teal-400',
  PB: 'text-indigo-400',
  HB: 'text-amber-400',
};

export default function CameraStatusPanel({
  cameraStates = [],
  forceCamera,
  overrideState = {},
}) {
  return (
    <div className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <VideoCameraIcon className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-white uppercase tracking-wide">
          Cameras
        </span>
      </div>

      {/* Camera grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cameraStates.map((camera) => (
          <CameraCard
            key={camera.cameraNumber}
            camera={camera}
            onForceCamera={forceCamera}
            isActiveOverride={
              overrideState.active &&
              overrideState.type === 'camera' &&
              overrideState.cameraNumber === camera.cameraNumber
            }
          />
        ))}
      </div>

      {/* Empty state */}
      {cameraStates.length === 0 && (
        <div className="text-center py-6 text-zinc-500 text-sm">
          No cameras configured
        </div>
      )}
    </div>
  );
}

/**
 * CameraCard — Individual camera status card
 */
function CameraCard({ camera, onForceCamera, isActiveOverride }) {
  const { cameraNumber, apparatus, state, startedAt, athleteName } = camera;
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for recording/recording-live states
  useEffect(() => {
    if ((state === 'recording' || state === 'recording-live') && startedAt) {
      // Initial elapsed time
      setElapsedTime(Math.floor((Date.now() - startedAt) / 1000));

      // Update every second
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [state, startedAt]);

  // Format elapsed time as M:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get state label
  const getStateLabel = () => {
    switch (state) {
      case 'idle':
        return 'Idle';
      case 'recording':
        return 'Recording';
      case 'live':
        return 'LIVE';
      case 'recording-live':
        return 'LIVE';
      default:
        return 'Unknown';
    }
  };

  // Button tooltip
  const getButtonTooltip = () => {
    if (isActiveOverride) {
      return `Camera ${cameraNumber} (Active Override)`;
    }
    if (state === 'recording' || state === 'recording-live') {
      return `Force Camera ${cameraNumber} (Recording)`;
    }
    return `Force Camera ${cameraNumber}`;
  };

  // Apparatus color classes
  const apparatusColorClass = apparatus ? APPARATUS_TEXT_COLORS[apparatus] : 'text-zinc-400';

  // Is camera currently showing (live or recording-live or override active)
  const isLive = state === 'live' || state === 'recording-live' || isActiveOverride;

  return (
    <div
      className={`bg-zinc-900 rounded-lg p-3 border ${
        isActiveOverride
          ? 'border-amber-500/50 ring-1 ring-amber-500/30'
          : isLive
          ? 'border-red-500/30'
          : 'border-zinc-700/50'
      }`}
    >
      {/* Apparatus label */}
      <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${apparatusColorClass}`}>
        {apparatus || 'Unassigned'}
      </div>

      {/* Camera number */}
      <div className="text-zinc-400 text-xs mb-2">
        Camera {cameraNumber}
      </div>

      {/* State indicator */}
      <div className="flex items-center gap-1.5 mb-2">
        <CameraStateDot state={state} />
        <span
          className={`text-xs font-medium ${
            state === 'live' || state === 'recording-live'
              ? 'text-red-400'
              : state === 'recording'
              ? 'text-green-400'
              : 'text-zinc-500'
          }`}
        >
          {getStateLabel()}
        </span>
      </div>

      {/* Timer (shown for recording/recording-live) */}
      {(state === 'recording' || state === 'recording-live') && (
        <div className="text-white text-sm font-mono mb-2">
          {formatTime(elapsedTime)}
        </div>
      )}

      {/* Force Camera button */}
      <button
        onClick={() => onForceCamera?.(cameraNumber)}
        disabled={isActiveOverride}
        title={getButtonTooltip()}
        className={`w-full text-xs font-medium px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 ${
          isActiveOverride
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-600'
        }`}
      >
        {/* Show recording indicator dot on button if camera is recording */}
        {(state === 'recording' || state === 'recording-live') && !isActiveOverride && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        )}
        {isActiveOverride ? 'Active' : 'Force'}
        <span className="text-zinc-500">[{cameraNumber}]</span>
      </button>
    </div>
  );
}

/**
 * CameraStateDot — Visual state indicator
 * - Gray dot = idle
 * - Green dot = recording
 * - Red dot = live
 * - Red dot with green ring = recording-live
 */
function CameraStateDot({ state }) {
  switch (state) {
    case 'idle':
      return <span className="w-2 h-2 rounded-full bg-zinc-500" />;
    case 'recording':
      return <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />;
    case 'live':
      return <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
    case 'recording-live':
      return (
        <span className="relative flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="absolute w-3.5 h-3.5 rounded-full border-2 border-green-500 animate-pulse" />
        </span>
      );
    default:
      return <span className="w-2 h-2 rounded-full bg-zinc-600" />;
  }
}
