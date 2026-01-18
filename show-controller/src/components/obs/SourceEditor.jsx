import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ArrowPathIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';
import { useShow } from '../../context/ShowContext';

/**
 * Transform presets matching SceneEditor.jsx
 */
const TRANSFORM_PRESETS = {
  fullscreen: {
    name: 'Fullscreen',
    positionX: 0,
    positionY: 0,
    boundsWidth: 1920,
    boundsHeight: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  dualLeft: {
    name: 'Dual Left',
    positionX: 0,
    positionY: 0,
    boundsWidth: 960,
    boundsHeight: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  dualRight: {
    name: 'Dual Right',
    positionX: 960,
    positionY: 0,
    boundsWidth: 960,
    boundsHeight: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  quadTopLeft: {
    name: 'Quad TL',
    positionX: 0,
    positionY: 0,
    boundsWidth: 960,
    boundsHeight: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  quadTopRight: {
    name: 'Quad TR',
    positionX: 960,
    positionY: 0,
    boundsWidth: 960,
    boundsHeight: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  quadBottomLeft: {
    name: 'Quad BL',
    positionX: 0,
    positionY: 540,
    boundsWidth: 960,
    boundsHeight: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  quadBottomRight: {
    name: 'Quad BR',
    positionX: 960,
    positionY: 540,
    boundsWidth: 960,
    boundsHeight: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  tripleMain: {
    name: 'Triple Main',
    positionX: 0,
    positionY: 0,
    boundsWidth: 1280,
    boundsHeight: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  tripleTopRight: {
    name: 'Triple TR',
    positionX: 1280,
    positionY: 0,
    boundsWidth: 640,
    boundsHeight: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  },
  tripleBottomRight: {
    name: 'Triple BR',
    positionX: 1280,
    positionY: 540,
    boundsWidth: 640,
    boundsHeight: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER'
  }
};

/**
 * Input type specific settings configuration
 */
const INPUT_SETTINGS_CONFIG = {
  ffmpeg_source: {
    name: 'SRT/Media Source',
    fields: [
      {
        key: 'input',
        label: 'Source URL/Path',
        type: 'text',
        placeholder: 'srt://... or file path'
      },
      {
        key: 'buffering_mb',
        label: 'Buffer (MB)',
        type: 'number',
        min: 0,
        max: 64
      },
      {
        key: 'reconnect_delay_sec',
        label: 'Reconnect Delay (sec)',
        type: 'number',
        min: 1,
        max: 60
      },
      {
        key: 'is_local_file',
        label: 'Local File',
        type: 'checkbox'
      },
      {
        key: 'looping',
        label: 'Loop Playback',
        type: 'checkbox'
      },
      {
        key: 'restart_on_activate',
        label: 'Restart on Activate',
        type: 'checkbox'
      }
    ]
  },
  browser_source: {
    name: 'Browser Source',
    fields: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://...'
      },
      {
        key: 'width',
        label: 'Width',
        type: 'number',
        min: 1,
        max: 4096
      },
      {
        key: 'height',
        label: 'Height',
        type: 'number',
        min: 1,
        max: 4096
      },
      {
        key: 'fps',
        label: 'FPS',
        type: 'number',
        min: 1,
        max: 60
      },
      {
        key: 'reroute_audio',
        label: 'Reroute Audio',
        type: 'checkbox'
      },
      {
        key: 'shutdown',
        label: 'Shutdown when hidden',
        type: 'checkbox'
      }
    ]
  },
  image_source: {
    name: 'Image Source',
    fields: [
      {
        key: 'file',
        label: 'File Path',
        type: 'text',
        placeholder: '/path/to/image.png'
      },
      {
        key: 'unload',
        label: 'Unload when hidden',
        type: 'checkbox'
      }
    ]
  },
  vlc_source: {
    name: 'VLC Source',
    fields: [
      {
        key: 'playlist',
        label: 'Playlist Items',
        type: 'textarea',
        placeholder: 'One URL/path per line'
      },
      {
        key: 'loop',
        label: 'Loop Playlist',
        type: 'checkbox'
      },
      {
        key: 'shuffle',
        label: 'Shuffle',
        type: 'checkbox'
      }
    ]
  },
  color_source: {
    name: 'Color Source',
    fields: [
      {
        key: 'color',
        label: 'Color',
        type: 'color'
      },
      {
        key: 'width',
        label: 'Width',
        type: 'number',
        min: 1,
        max: 4096
      },
      {
        key: 'height',
        label: 'Height',
        type: 'number',
        min: 1,
        max: 4096
      }
    ]
  }
};

/**
 * SourceEditor - Edit source settings and transform properties
 *
 * Props:
 * - source: Scene item object containing source info
 * - sceneName: Name of the scene containing this source
 * - onClose: Callback when editor is closed
 * - onUpdate: Callback when source is updated successfully
 */
export default function SourceEditor({ source, sceneName, onClose, onUpdate }) {
  const { obsConnected } = useOBS();
  const { socketUrl } = useShow();

  // Source information (handle multiple property name formats)
  const sourceName = source?.sourceName || source?.inputName || source?.name;
  const inputKind = source?.inputKind || source?.kind;
  const itemId = source?.sceneItemId || source?.id;

  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({});
  const [transform, setTransform] = useState({
    positionX: 0,
    positionY: 0,
    scaleX: 1.0,
    scaleY: 1.0,
    cropLeft: 0,
    cropRight: 0,
    cropTop: 0,
    cropBottom: 0
  });

  // Load current settings on mount
  useEffect(() => {
    if (!sourceName) return;

    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch current input settings
        const response = await fetch(`${socketUrl}/api/obs/inputs/${encodeURIComponent(sourceName)}`);
        if (response.ok) {
          const data = await response.json();
          setSettings(data.inputSettings || {});
        } else {
          // Fall back to empty settings if API fails
          setSettings({});
        }

        // Load transform from source object
        const sourceTransform = source?.transform || source?.sceneItemTransform || {};
        setTransform({
          positionX: sourceTransform.positionX ?? sourceTransform.x ?? 0,
          positionY: sourceTransform.positionY ?? sourceTransform.y ?? 0,
          scaleX: sourceTransform.scaleX ?? sourceTransform.scale?.x ?? 1.0,
          scaleY: sourceTransform.scaleY ?? sourceTransform.scale?.y ?? 1.0,
          cropLeft: sourceTransform.cropLeft ?? sourceTransform.crop?.left ?? 0,
          cropRight: sourceTransform.cropRight ?? sourceTransform.crop?.right ?? 0,
          cropTop: sourceTransform.cropTop ?? sourceTransform.crop?.top ?? 0,
          cropBottom: sourceTransform.cropBottom ?? sourceTransform.crop?.bottom ?? 0
        });
      } catch (err) {
        console.error('Error loading source settings:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [sourceName, source]);

  // Get settings config for this input kind
  const settingsConfig = INPUT_SETTINGS_CONFIG[inputKind];

  // Handle settings field change
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle transform field change
  const handleTransformChange = (key, value) => {
    setTransform(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  // Apply transform preset
  const applyTransformPreset = (presetKey) => {
    const preset = TRANSFORM_PRESETS[presetKey];
    if (!preset) return;

    setTransform(prev => ({
      ...prev,
      positionX: preset.positionX,
      positionY: preset.positionY,
      boundsWidth: preset.boundsWidth,
      boundsHeight: preset.boundsHeight,
      boundsType: preset.boundsType
    }));
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Update input settings
      const settingsResponse = await fetch(`${socketUrl}/api/obs/inputs/${encodeURIComponent(sourceName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputSettings: settings })
      });
      if (!settingsResponse.ok) throw new Error('Failed to update source settings');

      // Update scene item transform
      const transformResponse = await fetch(
        `${socketUrl}/api/obs/scenes/${encodeURIComponent(sceneName)}/items/${itemId}/transform`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transform })
        }
      );
      if (!transformResponse.ok) throw new Error('Failed to update transform');

      console.log('Source updated:', { sourceName, settings, transform });

      // Call onUpdate callback
      if (onUpdate) {
        onUpdate();
      }

      // Close editor
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error saving source:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
  };

  if (!obsConnected) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4">
          <div className="text-center text-gray-400 py-12">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <p>Connect to OBS to edit sources</p>
          </div>
        </div>
      </div>
    );
  }

  if (!source || !sourceName) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4">
          <div className="text-center text-gray-400 py-12">
            <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <p>No source selected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleCancel}
    >
      <div
        className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white font-semibold text-lg">Edit Source</h3>
            <p className="text-gray-400 text-sm">{sourceName}</p>
            {inputKind && (
              <p className="text-gray-500 text-xs mt-1">Type: {inputKind}</p>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-400">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">
            <ArrowPathIcon className="w-12 h-12 mx-auto mb-4 animate-spin" />
            <p>Loading source settings...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Source Settings */}
            <div className="space-y-4">
              <h4 className="text-white font-medium">
                {settingsConfig?.name || 'Source Settings'}
              </h4>

              {settingsConfig ? (
                <div className="space-y-4">
                  {settingsConfig.fields.map((field) => (
                    <SettingsField
                      key={field.key}
                      field={field}
                      value={settings[field.key]}
                      onChange={(value) => handleSettingChange(field.key, value)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">
                  No editable settings for this source type
                </div>
              )}
            </div>

            {/* Right Column: Transform Controls and Presets */}
            <div className="space-y-4">
              {/* Transform Controls */}
              <div>
                <h4 className="text-white font-medium mb-4">Transform</h4>
                <div className="space-y-3">
                  {/* Position */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Position X
                      </label>
                      <input
                        type="number"
                        value={transform.positionX}
                        onChange={(e) => handleTransformChange('positionX', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Position Y
                      </label>
                      <input
                        type="number"
                        value={transform.positionY}
                        onChange={(e) => handleTransformChange('positionY', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Scale */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Scale X
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={transform.scaleX}
                        onChange={(e) => handleTransformChange('scaleX', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Scale Y
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={transform.scaleY}
                        onChange={(e) => handleTransformChange('scaleY', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Crop */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Crop Left
                      </label>
                      <input
                        type="number"
                        value={transform.cropLeft}
                        onChange={(e) => handleTransformChange('cropLeft', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Crop Right
                      </label>
                      <input
                        type="number"
                        value={transform.cropRight}
                        onChange={(e) => handleTransformChange('cropRight', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Crop Top
                      </label>
                      <input
                        type="number"
                        value={transform.cropTop}
                        onChange={(e) => handleTransformChange('cropTop', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Crop Bottom
                      </label>
                      <input
                        type="number"
                        value={transform.cropBottom}
                        onChange={(e) => handleTransformChange('cropBottom', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preset Layout Buttons */}
              <div>
                <h4 className="text-white font-medium mb-4">Layout Presets</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TRANSFORM_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyTransformPreset(key)}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors text-left"
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-xs text-gray-400">
                        {preset.boundsWidth}x{preset.boundsHeight}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-700">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * SettingsField - Renders a single settings field based on type
 */
function SettingsField({ field, value, onChange }) {
  const handleChange = (e) => {
    if (field.type === 'checkbox') {
      onChange(e.target.checked);
    } else if (field.type === 'number') {
      onChange(parseFloat(e.target.value) || 0);
    } else {
      onChange(e.target.value);
    }
  };

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">
        {field.label}
      </label>

      {field.type === 'text' && (
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          placeholder={field.placeholder}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          value={value ?? ''}
          onChange={handleChange}
          min={field.min}
          max={field.max}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
        />
      )}

      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value ?? false}
            onChange={handleChange}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800"
          />
          <span className="text-sm text-gray-300">Enable</span>
        </label>
      )}

      {field.type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={handleChange}
          placeholder={field.placeholder}
          rows={4}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
        />
      )}

      {field.type === 'color' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value || '#000000'}
            onChange={handleChange}
            className="w-12 h-10 rounded border border-gray-600 bg-gray-700 cursor-pointer"
          />
          <input
            type="text"
            value={value || '#000000'}
            onChange={handleChange}
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
