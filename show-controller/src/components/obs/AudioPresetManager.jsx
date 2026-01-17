import { useState, useEffect } from 'react';
import {
  PlayIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';

/**
 * AudioPresetManager - Manage and load audio presets
 *
 * Features:
 * - List all saved presets (default + user-created)
 * - One-click load/apply preset
 * - Save current mix as new preset
 * - Delete user presets
 * - Show loading states
 */
export default function AudioPresetManager() {
  const { obsState, obsConnected, loadPreset } = useOBS();

  // State
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [loadingPresetId, setLoadingPresetId] = useState(null);

  // Fetch presets on mount
  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/obs/audio/presets');
      if (!response.ok) {
        throw new Error(`Failed to fetch presets: ${response.statusText}`);
      }
      const data = await response.json();
      setPresets(data.presets || []);
    } catch (err) {
      console.error('Error fetching presets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load/apply preset
  const handleLoadPreset = async (presetId) => {
    setLoadingPresetId(presetId);
    setError(null);

    try {
      const response = await fetch(`/api/obs/audio/presets/${presetId}`, {
        method: 'PUT'
      });

      if (!response.ok) {
        throw new Error(`Failed to load preset: ${response.statusText}`);
      }

      // Also emit socket event for real-time update
      loadPreset(presetId);

      // Show success briefly
      setTimeout(() => setLoadingPresetId(null), 1000);
    } catch (err) {
      console.error('Error loading preset:', err);
      setError(err.message);
      setLoadingPresetId(null);
    }
  };

  // Delete preset
  const handleDeletePreset = async (presetId, presetName) => {
    if (!confirm(`Delete preset "${presetName}"?`)) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/obs/audio/presets/${presetId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete preset: ${response.statusText}`);
      }

      // Refresh presets list
      await fetchPresets();
    } catch (err) {
      console.error('Error deleting preset:', err);
      setError(err.message);
    }
  };

  // Open save modal
  const handleOpenSaveModal = () => {
    if (!obsConnected) {
      setError('Connect to OBS first');
      return;
    }
    setShowSaveModal(true);
  };

  // Save current mix as new preset
  const handleSavePreset = async (name, description) => {
    setError(null);

    try {
      // Get current audio sources from obsState
      const audioSources = obsState?.audioSources || [];

      if (audioSources.length === 0) {
        throw new Error('No audio sources to save');
      }

      // Format sources for API
      const sources = audioSources.reduce((acc, source) => {
        acc[source.inputName] = {
          volumeDb: source.volumeDb,
          muted: source.muted,
          monitorType: source.monitorType
        };
        return acc;
      }, {});

      const response = await fetch('/api/obs/audio/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, sources })
      });

      if (!response.ok) {
        throw new Error(`Failed to save preset: ${response.statusText}`);
      }

      // Close modal and refresh presets
      setShowSaveModal(false);
      await fetchPresets();
    } catch (err) {
      console.error('Error saving preset:', err);
      setError(err.message);
    }
  };

  // Not connected state
  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
        <p>Connect to OBS to manage audio presets</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Audio Presets</h3>
        <button
          onClick={handleOpenSaveModal}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Save Current Mix
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500 rounded-lg text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">
          <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p className="text-sm">Loading presets...</p>
        </div>
      ) : (
        <>
          {/* Presets Grid */}
          {presets.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>No presets saved yet</p>
              <p className="text-sm mt-2">Save your current audio mix to create a preset</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {presets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isLoading={loadingPresetId === preset.id}
                  onLoad={() => handleLoadPreset(preset.id)}
                  onDelete={() => handleDeletePreset(preset.id, preset.name)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Save Preset Modal */}
      {showSaveModal && (
        <SavePresetModal
          onSave={handleSavePreset}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}

/**
 * PresetCard - Individual preset card with load and delete actions
 */
function PresetCard({ preset, isLoading, onLoad, onDelete }) {
  const isDefault = preset.isDefault ?? false;
  const sourceCount = Object.keys(preset.sources || {}).length;

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium truncate">{preset.name}</div>
          {preset.description && (
            <div className="text-xs text-gray-400 mt-1">{preset.description}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {sourceCount} source{sourceCount !== 1 ? 's' : ''}
          </div>
        </div>

        {isDefault && (
          <span className="px-2 py-0.5 bg-blue-600/20 border border-blue-600 text-blue-300 text-xs font-semibold rounded">
            Default
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        {/* Load Button */}
        <button
          onClick={onLoad}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:text-purple-400 text-white text-sm font-medium rounded transition-colors"
        >
          {isLoading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <PlayIcon className="w-4 h-4" />
              Apply
            </>
          )}
        </button>

        {/* Delete Button (only for non-default presets) */}
        {!isDefault && (
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
            title="Delete preset"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * SavePresetModal - Modal for saving current audio mix as a preset
 */
function SavePresetModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a preset name');
      return;
    }

    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Save Audio Preset</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Preset Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Competition Standard"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this audio preset..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
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
                  Save Preset
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
