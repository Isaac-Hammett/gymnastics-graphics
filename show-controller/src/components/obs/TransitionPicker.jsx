/**
 * TransitionPicker Component (PRD-OBS-05)
 *
 * UI for selecting and configuring OBS scene transitions.
 * Allows users to:
 * - View available transitions
 * - Select the current/default transition
 * - Set transition duration
 */

import { useState, useEffect } from 'react';
import { useOBS } from '../../context/OBSContext';

export default function TransitionPicker() {
  const {
    obsState,
    obsConnected,
    setCurrentTransition,
    setTransitionDuration,
    getTransitions
  } = useOBS();

  const [duration, setDuration] = useState(300);
  const [isUpdating, setIsUpdating] = useState(false);

  // Extract transition data from obsState
  const transitions = obsState?.transitions || [];
  const currentTransition = obsState?.currentTransition || '';
  const currentDuration = obsState?.transitionDuration || 300;

  // Sync local duration state with server state
  useEffect(() => {
    setDuration(currentDuration);
  }, [currentDuration]);

  // Request transitions on mount if connected
  useEffect(() => {
    if (obsConnected) {
      getTransitions();
    }
  }, [obsConnected, getTransitions]);

  const handleTransitionChange = async (e) => {
    const transitionName = e.target.value;
    if (!transitionName || transitionName === currentTransition) return;

    setIsUpdating(true);
    try {
      setCurrentTransition(transitionName);
    } finally {
      // Allow time for state to update
      setTimeout(() => setIsUpdating(false), 500);
    }
  };

  const handleDurationChange = (e) => {
    const newDuration = parseInt(e.target.value, 10);
    if (!isNaN(newDuration) && newDuration >= 0) {
      setDuration(newDuration);
    }
  };

  const handleDurationBlur = () => {
    if (duration !== currentDuration && duration > 0) {
      setIsUpdating(true);
      setTransitionDuration(duration);
      setTimeout(() => setIsUpdating(false), 500);
    }
  };

  const handleDurationKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  // Quick duration presets
  const durationPresets = [
    { label: '250ms', value: 250 },
    { label: '500ms', value: 500 },
    { label: '750ms', value: 750 },
    { label: '1s', value: 1000 }
  ];

  const handlePresetClick = (presetValue) => {
    setDuration(presetValue);
    if (presetValue !== currentDuration) {
      setIsUpdating(true);
      setTransitionDuration(presetValue);
      setTimeout(() => setIsUpdating(false), 500);
    }
  };

  // Get human-readable transition kind
  const getTransitionDescription = (kind) => {
    const descriptions = {
      'cut_transition': 'Instant switch',
      'fade_transition': 'Fade between scenes',
      'swipe_transition': 'Swipe effect',
      'slide_transition': 'Slide effect',
      'stinger_transition': 'Custom video transition',
      'fade_to_color_transition': 'Fade to color'
    };
    return descriptions[kind] || kind || 'Transition';
  };

  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <h3 className="text-xl font-semibold text-white mb-2">Transitions</h3>
        <p>Connect to OBS to manage transitions</p>
      </div>
    );
  }

  if (transitions.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        <h3 className="text-xl font-semibold text-white mb-2">Transitions</h3>
        <p>Loading transitions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Transitions</h3>
        <span className="text-sm text-gray-400">
          {transitions.length} transition{transitions.length !== 1 ? 's' : ''} available
        </span>
      </div>

      {/* Current Transition Selector */}
      <div className="bg-gray-700 rounded-lg p-4">
        <label className="block text-sm text-gray-400 mb-2">Current Transition</label>
        <select
          value={currentTransition}
          onChange={handleTransitionChange}
          disabled={isUpdating}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
        >
          {transitions.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Duration Control */}
      <div className="bg-gray-700 rounded-lg p-4">
        <label className="block text-sm text-gray-400 mb-2">
          Transition Duration
          <span className="text-gray-500 ml-1">(milliseconds)</span>
        </label>

        <div className="flex items-center gap-3 mb-3">
          <input
            type="number"
            value={duration}
            onChange={handleDurationChange}
            onBlur={handleDurationBlur}
            onKeyDown={handleDurationKeyDown}
            min="0"
            max="5000"
            step="50"
            disabled={isUpdating}
            className="w-32 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <span className="text-gray-400">ms</span>
        </div>

        {/* Duration Presets */}
        <div className="flex flex-wrap gap-2">
          {durationPresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handlePresetClick(preset.value)}
              disabled={isUpdating}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                duration === preset.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              } disabled:opacity-50`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Available Transitions List */}
      <div className="space-y-2">
        <h4 className="text-gray-300 font-medium text-sm uppercase tracking-wider">
          Available Transitions
        </h4>
        <div className="space-y-2">
          {transitions.map((transition) => (
            <div
              key={transition.name}
              onClick={() => {
                if (transition.name !== currentTransition && !isUpdating) {
                  setCurrentTransition(transition.name);
                }
              }}
              className={`bg-gray-700 rounded-lg p-4 flex items-center justify-between cursor-pointer transition-colors ${
                transition.name === currentTransition
                  ? 'ring-2 ring-purple-500 bg-gray-600'
                  : 'hover:bg-gray-600'
              } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{transition.name}</span>
                  {transition.name === currentTransition && (
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-gray-400 text-sm">
                  {getTransitionDescription(transition.kind)}
                </div>
              </div>

              {transition.configurable && (
                <span className="text-gray-500 text-xs">Configurable</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Updating indicator */}
      {isUpdating && (
        <div className="text-center text-gray-400 text-sm">
          Updating...
        </div>
      )}
    </div>
  );
}
