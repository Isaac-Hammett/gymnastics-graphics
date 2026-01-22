import { useState, useEffect, useCallback } from 'react';
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';

/**
 * Monitor type constants matching OBS WebSocket API
 */
const MONITOR_TYPES = {
  OBS_MONITORING_TYPE_NONE: 'None',
  OBS_MONITORING_TYPE_MONITOR_ONLY: 'Monitor Only',
  OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT: 'Monitor and Output'
};

/**
 * VUMeter - Real-time audio level meter with color coding
 *
 * Color zones:
 * - Green: Normal levels (below -12dB)
 * - Yellow: Hot levels (-12dB to -6dB)
 * - Red: Clipping danger (above -6dB)
 */
function VUMeter({ levelDb, muted }) {
  // Convert dB to percentage (0dB = 100%, -60dB = 0%)
  // Using -60dB as floor since that's typical for audio meters
  const percent = muted ? 0 : Math.max(0, Math.min(100, ((levelDb + 60) / 60) * 100));

  // Determine color based on level
  const getColor = () => {
    if (muted) return 'bg-gray-600';
    if (levelDb >= -6) return 'bg-red-500';      // Clipping danger
    if (levelDb >= -12) return 'bg-yellow-500';  // Hot
    return 'bg-green-500';                        // Normal
  };

  return (
    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${getColor()} transition-all duration-75`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * StereoVUMeter - Dual-channel VU meter for stereo sources
 */
function StereoVUMeter({ channels, muted }) {
  // channels format: [{peak, rms}, {peak, rms}] for L/R
  const leftChannel = channels?.[0];
  const rightChannel = channels?.[1] || leftChannel; // Fallback to mono

  const levelToDb = (mul) => {
    if (!mul || mul <= 0) return -60;
    return Math.max(-60, 20 * Math.log10(mul));
  };

  const leftDb = levelToDb(leftChannel?.peak);
  const rightDb = levelToDb(rightChannel?.peak);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-3">L</span>
        <div className="flex-1">
          <VUMeter levelDb={leftDb} muted={muted} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-3">R</span>
        <div className="flex-1">
          <VUMeter levelDb={rightDb} muted={muted} />
        </div>
      </div>
    </div>
  );
}

/**
 * AudioMixer - Display and control audio sources with volume sliders, mute toggles, and monitor types
 *
 * Features:
 * - Volume sliders (-60dB to 0dB)
 * - Mute toggles
 * - Monitor type dropdown
 * - Real-time VU meters (Phase 2)
 * - Debounced volume updates to prevent flooding
 */
export default function AudioMixer() {
  const {
    obsState,
    obsConnected,
    setVolume,
    setMute,
    setMonitorType,
    audioLevels,
    subscribeAudioLevels,
    unsubscribeAudioLevels
  } = useOBS();
  const audioSources = obsState?.audioSources || [];

  // Debounce state for volume changes
  const [pendingVolumeChanges, setPendingVolumeChanges] = useState({});

  // Subscribe to audio levels when component mounts and we're connected
  useEffect(() => {
    if (obsConnected && subscribeAudioLevels) {
      subscribeAudioLevels();
      return () => {
        if (unsubscribeAudioLevels) {
          unsubscribeAudioLevels();
        }
      };
    }
  }, [obsConnected, subscribeAudioLevels, unsubscribeAudioLevels]);

  // Debounce volume changes (500ms)
  useEffect(() => {
    const timeoutIds = {};

    Object.entries(pendingVolumeChanges).forEach(([inputName, volumeDb]) => {
      timeoutIds[inputName] = setTimeout(() => {
        setVolume(inputName, volumeDb);
        setPendingVolumeChanges(prev => {
          const next = { ...prev };
          delete next[inputName];
          return next;
        });
      }, 500);
    });

    return () => {
      Object.values(timeoutIds).forEach(clearTimeout);
    };
  }, [pendingVolumeChanges, setVolume]);

  // Handle volume slider change (local state update for responsiveness)
  const handleVolumeChange = useCallback((inputName, volumeDb) => {
    setPendingVolumeChanges(prev => ({
      ...prev,
      [inputName]: parseFloat(volumeDb)
    }));
  }, []);

  // Handle mute toggle
  const handleMuteToggle = useCallback((inputName, currentMuted) => {
    setMute(inputName, !currentMuted);
  }, [setMute]);

  // Handle monitor type change
  const handleMonitorTypeChange = useCallback((inputName, monitorType) => {
    console.log('AudioMixer: Setting monitor type', inputName, monitorType);
    setMonitorType(inputName, monitorType);
  }, [setMonitorType]);

  // Not connected state
  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
        <p>Connect to OBS to access audio mixer</p>
      </div>
    );
  }

  // Empty state
  if (audioSources.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        <SpeakerWaveIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h3 className="text-xl font-semibold text-white mb-2">No Audio Sources</h3>
        <p>No audio sources found in OBS. Add audio sources to your scenes to control them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Audio Mixer</h3>
        <div className="text-sm text-gray-400">
          {audioSources.length} source{audioSources.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-3">
        {audioSources.map((source) => (
          <AudioSourceControl
            key={source.inputName}
            source={source}
            pendingVolume={pendingVolumeChanges[source.inputName]}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onMonitorTypeChange={handleMonitorTypeChange}
            levelData={audioLevels.get(source.inputName)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * AudioSourceControl - Individual audio source control with volume slider, mute, monitor type, and VU meter
 */
function AudioSourceControl({
  source,
  pendingVolume,
  onVolumeChange,
  onMuteToggle,
  onMonitorTypeChange,
  levelData
}) {
  const inputName = source.inputName;
  const volumeDb = pendingVolume ?? source.volumeDb ?? -60;
  const volumeMul = source.volumeMul ?? 0;
  const muted = source.muted ?? false;
  const monitorType = source.monitorType ?? 'OBS_MONITORING_TYPE_NONE';

  // Convert dB to percentage for display
  const volumePercent = Math.round(volumeMul * 100);

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium truncate">{inputName}</div>
          <div className="text-xs text-gray-400">
            {volumeDb.toFixed(1)} dB ({volumePercent}%)
          </div>
        </div>

        {/* Mute Toggle */}
        <button
          onClick={() => onMuteToggle(inputName, muted)}
          className={`p-2 rounded transition-colors ${
            muted
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
          }`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <SpeakerXMarkIcon className="w-5 h-5" />
          ) : (
            <SpeakerWaveIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Volume Slider */}
      <div className="mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-10">-60</span>
          <div className="flex-1">
            <input
              type="range"
              min="-60"
              max="0"
              step="1"
              value={volumeDb}
              onChange={(e) => onVolumeChange(inputName, e.target.value)}
              disabled={muted}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: muted
                  ? '#4B5563'
                  : `linear-gradient(to right, ${
                      volumeDb >= -6 ? '#EF4444' : volumeDb >= -18 ? '#EAB308' : '#10B981'
                    } 0%, ${
                      volumeDb >= -6 ? '#EF4444' : volumeDb >= -18 ? '#EAB308' : '#10B981'
                    } ${((volumeDb + 60) / 60) * 100}%, #4B5563 ${((volumeDb + 60) / 60) * 100}%, #4B5563 100%)`
              }}
            />
          </div>
          <span className="text-xs text-gray-400 w-8">0</span>
        </div>
      </div>

      {/* Real-time VU Meter */}
      <div className="mb-3">
        {levelData?.channels ? (
          <StereoVUMeter channels={levelData.channels} muted={muted} />
        ) : (
          // Fallback: Show simple meter based on levelDb if available, or static bar
          <VUMeter levelDb={levelData?.levelDb ?? -60} muted={muted} />
        )}
      </div>

      {/* Monitor Type Dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 whitespace-nowrap">Monitor:</label>
        <select
          value={monitorType}
          onChange={(e) => onMonitorTypeChange(inputName, e.target.value)}
          className="flex-1 px-2 py-1 bg-gray-800 text-white text-xs rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
        >
          {Object.entries(MONITOR_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
