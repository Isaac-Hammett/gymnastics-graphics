/**
 * StingerConfig Component (PRD-OBS-11)
 *
 * Configuration panel for OBS stinger transitions.
 * Allows users to:
 * - Set stinger file path
 * - Configure transition point (when scene fully covers)
 * - Select audio fade style
 */

import { useState, useEffect } from 'react';
import { useOBS } from '../../context/OBSContext';

// Audio fade styles supported by OBS
const AUDIO_FADE_STYLES = [
  { value: 'fade_out', label: 'Fade Out' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'none', label: 'No Audio' }
];

// Common stinger paths on the VM
const ASSET_BASE_PATH = '/var/www/assets/stingers/';

export default function StingerConfig({ transitionName, onClose }) {
  const {
    getTransitionSettings,
    setTransitionSettings,
    obsConnected
  } = useOBS();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Stinger settings
  const [path, setPath] = useState('');
  const [transitionPoint, setTransitionPoint] = useState(1500);
  const [audioFadeStyle, setAudioFadeStyle] = useState('crossfade');
  const [audioMonitorType, setAudioMonitorType] = useState(0); // 0=none, 1=monitor_and_output, 2=monitor_only

  // Load current settings on mount
  useEffect(() => {
    if (!obsConnected || !transitionName) return;

    const loadSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getTransitionSettings(transitionName);
        if (response.transitionSettings) {
          const settings = response.transitionSettings;
          setPath(settings.path || '');
          setTransitionPoint(settings.transition_point || 1500);
          setAudioFadeStyle(settings.audio_fade_style || 'crossfade');
          setAudioMonitorType(settings.audio_monitor_type || 0);
        }
      } catch (err) {
        console.error('Failed to load stinger settings:', err);
        setError('Failed to load current settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [obsConnected, transitionName, getTransitionSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await setTransitionSettings(transitionName, {
        path,
        transition_point: transitionPoint,
        tp_type: 'time', // Use time-based transition point
        audio_fade_style: audioFadeStyle,
        audio_monitor_type: audioMonitorType
      });
      if (onClose) onClose();
    } catch (err) {
      console.error('Failed to save stinger settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTransitionPointChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      setTransitionPoint(value);
    }
  };

  // Quick transition point presets
  const transitionPointPresets = [
    { label: '500ms', value: 500 },
    { label: '1s', value: 1000 },
    { label: '1.5s', value: 1500 },
    { label: '2s', value: 2000 }
  ];

  if (loading) {
    return (
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="text-center text-gray-400 py-4">
          Loading stinger settings...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium">Stinger Settings</h4>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Stinger File Path */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Stinger File Path
        </label>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder={`${ASSET_BASE_PATH}transition.webm`}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Path to video file on the VM (e.g., {ASSET_BASE_PATH}stinger.webm)
        </p>
      </div>

      {/* Transition Point */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Transition Point
          <span className="text-gray-500 ml-1">(milliseconds)</span>
        </label>
        <div className="flex items-center gap-3 mb-2">
          <input
            type="number"
            value={transitionPoint}
            onChange={handleTransitionPointChange}
            min="0"
            max="10000"
            step="100"
            className="w-32 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
          />
          <span className="text-gray-400">ms</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {transitionPointPresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setTransitionPoint(preset.value)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                transitionPoint === preset.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Time when the stinger fully covers the screen (scene switch happens here)
        </p>
      </div>

      {/* Audio Fade Style */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Audio Fade Style
        </label>
        <select
          value={audioFadeStyle}
          onChange={(e) => setAudioFadeStyle(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          {AUDIO_FADE_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          How audio transitions between scenes during the stinger
        </p>
      </div>

      {/* Preview placeholder */}
      <div className="bg-gray-800 rounded-lg p-4 text-center">
        <div className="text-gray-500 text-sm mb-2">Preview</div>
        {path ? (
          <div className="text-gray-400 text-xs">
            <span className="text-purple-400">File:</span> {path.split('/').pop()}
            <br />
            <span className="text-purple-400">Switch at:</span> {transitionPoint}ms
            <br />
            <span className="text-purple-400">Audio:</span> {AUDIO_FADE_STYLES.find(s => s.value === audioFadeStyle)?.label}
          </div>
        ) : (
          <div className="text-gray-500 text-xs">
            No stinger file configured
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !path}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
