/**
 * OBS Audio Manager
 *
 * Handles audio source management including volume, mute, and monitor controls.
 * Provides capabilities for:
 * - Getting/setting volume (dB and multiplier)
 * - Getting/setting mute state
 * - Getting/setting monitor type
 * - Accessing cached audio sources
 * - Audio presets (save/load/apply/delete)
 *
 * Works with OBSStateSync for cached state access to avoid redundant OBS calls.
 *
 * @module obsAudioManager
 */

/**
 * Default audio presets for common scenarios
 * Used as starting templates and available across all competitions
 */
export const DEFAULT_PRESETS = {
  'default-commentary-focus': {
    id: 'default-commentary-focus',
    name: 'Commentary Focus',
    description: 'Commentary loud, venue ambient soft',
    sources: [
      { inputName: 'Commentary', volumeDb: -6, muted: false },
      { inputName: 'Venue', volumeDb: -18, muted: false },
      { inputName: 'Music', volumeDb: -96, muted: true }
    ]
  },
  'default-venue-focus': {
    id: 'default-venue-focus',
    name: 'Venue Focus',
    description: 'Venue ambient loud, commentary soft',
    sources: [
      { inputName: 'Commentary', volumeDb: -18, muted: false },
      { inputName: 'Venue', volumeDb: -6, muted: false },
      { inputName: 'Music', volumeDb: -96, muted: true }
    ]
  },
  'default-music-bed': {
    id: 'default-music-bed',
    name: 'Music Bed',
    description: 'Music moderate, others muted',
    sources: [
      { inputName: 'Music', volumeDb: -12, muted: false },
      { inputName: 'Commentary', volumeDb: -96, muted: true },
      { inputName: 'Venue', volumeDb: -96, muted: true }
    ]
  },
  'default-all-muted': {
    id: 'default-all-muted',
    name: 'All Muted',
    description: 'All audio sources muted',
    sources: [
      { inputName: 'Commentary', volumeDb: -96, muted: true },
      { inputName: 'Venue', volumeDb: -96, muted: true },
      { inputName: 'Music', volumeDb: -96, muted: true }
    ]
  },
  'default-break-music': {
    id: 'default-break-music',
    name: 'Break Music',
    description: 'Music at full volume, others muted',
    sources: [
      { inputName: 'Music', volumeDb: 0, muted: false },
      { inputName: 'Commentary', volumeDb: -96, muted: true },
      { inputName: 'Venue', volumeDb: -96, muted: true }
    ]
  }
};

/**
 * OBS Audio Manager class
 * Provides audio control operations for inputs/sources
 */
export class OBSAudioManager {
  constructor(obs, stateSync, productionConfigService = null) {
    this.obs = obs;           // OBS WebSocket instance
    this.stateSync = stateSync; // OBSStateSync instance for cached state
    this.productionConfigService = productionConfigService; // Firebase service for preset storage
  }

  /**
   * Get all audio sources from cached state
   * @returns {Array} Audio sources with volume/mute info
   */
  getAudioSources() {
    const state = this.stateSync.getState();
    return state.audioSources || [];
  }

  /**
   * Get volume for a specific input
   * @param {string} inputName - Name of the audio input
   * @returns {Promise<{volumeDb: number, volumeMul: number}>}
   */
  async getVolume(inputName) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    try {
      const response = await this.obs.call('GetInputVolume', { inputName });
      console.log(`[OBSAudioManager] Retrieved volume for input: ${inputName} (${response.inputVolumeDb} dB)`);

      return {
        volumeDb: response.inputVolumeDb,
        volumeMul: response.inputVolumeMul
      };
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to get volume for input ${inputName}:`, error.message);
      throw error;
    }
  }

  /**
   * Set volume for a specific input
   * @param {string} inputName - Name of the audio input
   * @param {number} volumeDb - Volume in decibels (optional)
   * @param {number} volumeMul - Volume multiplier (optional)
   * @returns {Promise<{success: boolean}>}
   */
  async setVolume(inputName, volumeDb, volumeMul) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    if (volumeDb === undefined && volumeMul === undefined) {
      throw new Error('Either volumeDb or volumeMul is required');
    }

    try {
      const params = { inputName };
      if (volumeDb !== undefined) params.inputVolumeDb = volumeDb;
      if (volumeMul !== undefined) params.inputVolumeMul = volumeMul;

      await this.obs.call('SetInputVolume', params);

      const volumeStr = volumeDb !== undefined ? `${volumeDb} dB` : `${volumeMul}x`;
      console.log(`[OBSAudioManager] Set volume for input ${inputName}: ${volumeStr}`);

      return { success: true };
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to set volume for input ${inputName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get mute state for a specific input
   * @param {string} inputName - Name of the audio input
   * @returns {Promise<{muted: boolean}>}
   */
  async getMute(inputName) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    try {
      const response = await this.obs.call('GetInputMute', { inputName });
      console.log(`[OBSAudioManager] Retrieved mute state for input: ${inputName} (${response.inputMuted ? 'muted' : 'unmuted'})`);

      return {
        muted: response.inputMuted
      };
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to get mute state for input ${inputName}:`, error.message);
      throw error;
    }
  }

  /**
   * Set mute state for a specific input
   * @param {string} inputName - Name of the audio input
   * @param {boolean} muted - Whether to mute
   * @returns {Promise<{success: boolean}>}
   */
  async setMute(inputName, muted) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    if (typeof muted !== 'boolean') {
      throw new Error('Muted must be a boolean');
    }

    try {
      await this.obs.call('SetInputMute', {
        inputName,
        inputMuted: muted
      });

      console.log(`[OBSAudioManager] Set input ${inputName} mute state: ${muted ? 'muted' : 'unmuted'}`);

      return { success: true };
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to set mute state for input ${inputName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get monitor type for a specific input
   * @param {string} inputName - Name of the audio input
   * @returns {Promise<{monitorType: string}>}
   */
  async getMonitorType(inputName) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    try {
      const response = await this.obs.call('GetInputAudioMonitorType', { inputName });
      console.log(`[OBSAudioManager] Retrieved monitor type for input: ${inputName} (${response.monitorType})`);

      return {
        monitorType: response.monitorType
      };
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to get monitor type for input ${inputName}:`, error.message);
      throw error;
    }
  }

  /**
   * Set monitor type for a specific input
   * @param {string} inputName - Name of the audio input
   * @param {string} monitorType - Monitor type (OBS_MONITORING_TYPE_NONE, OBS_MONITORING_TYPE_MONITOR_ONLY, OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT)
   * @returns {Promise<{success: boolean}>}
   */
  async setMonitorType(inputName, monitorType) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    if (!monitorType) {
      throw new Error('Monitor type is required');
    }

    // Validate monitor type
    const validTypes = [
      'OBS_MONITORING_TYPE_NONE',
      'OBS_MONITORING_TYPE_MONITOR_ONLY',
      'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
    ];

    if (!validTypes.includes(monitorType)) {
      throw new Error(`Invalid monitor type. Must be one of: ${validTypes.join(', ')}`);
    }

    try {
      await this.obs.call('SetInputAudioMonitorType', {
        inputName,
        monitorType
      });

      console.log(`[OBSAudioManager] Set monitor type for input ${inputName}: ${monitorType}`);

      return { success: true };
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to set monitor type for input ${inputName}:`, error.message);
      throw error;
    }
  }

  // ============================================================================
  // Audio Presets
  // ============================================================================

  /**
   * Get Firebase database reference
   * @private
   * @returns {Object} Firebase database reference
   */
  _getDatabase() {
    if (!this.productionConfigService) {
      throw new Error('Production config service not available');
    }

    // Initialize if needed
    const db = this.productionConfigService.initialize();
    if (!db) {
      throw new Error('Firebase database not available');
    }

    return db;
  }

  /**
   * Save an audio preset to Firebase
   * @param {string} compId - Competition ID
   * @param {Object} preset - Preset object with {id, name, description, sources: [{inputName, volumeDb, muted}]}
   * @returns {Promise<boolean>} Success status
   */
  async savePreset(compId, preset) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    if (!preset || typeof preset !== 'object') {
      throw new Error('Preset must be an object');
    }

    if (!preset.id) {
      throw new Error('Preset must have an id');
    }

    if (!preset.name) {
      throw new Error('Preset must have a name');
    }

    if (!Array.isArray(preset.sources)) {
      throw new Error('Preset must have a sources array');
    }

    try {
      const database = this._getDatabase();

      const presetWithTimestamp = {
        ...preset,
        createdAt: preset.createdAt || new Date().toISOString()
      };

      await database.ref(`competitions/${compId}/obs/presets/${preset.id}`).set(presetWithTimestamp);
      console.log(`[OBSAudioManager] Saved preset "${preset.name}" (${preset.id}) for competition ${compId}`);

      return true;
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to save preset ${preset.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Load an audio preset from Firebase
   * @param {string} compId - Competition ID
   * @param {string} presetId - Preset ID to load
   * @returns {Promise<Object|null>} Preset object or null if not found
   */
  async loadPreset(compId, presetId) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    if (!presetId) {
      throw new Error('Preset ID is required');
    }

    try {
      const database = this._getDatabase();

      const snapshot = await database.ref(`competitions/${compId}/obs/presets/${presetId}`).once('value');
      const preset = snapshot.val();

      if (!preset) {
        console.log(`[OBSAudioManager] Preset ${presetId} not found for competition ${compId}`);
        return null;
      }

      console.log(`[OBSAudioManager] Loaded preset "${preset.name}" (${presetId}) for competition ${compId}`);
      return preset;
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to load preset ${presetId}:`, error.message);
      throw error;
    }
  }

  /**
   * Apply an audio preset to OBS
   * @param {Object} preset - Preset object with sources array
   * @returns {Promise<{applied: number, errors: Array}>} Result with count and errors
   */
  async applyPreset(preset) {
    if (!preset || typeof preset !== 'object') {
      throw new Error('Preset must be an object');
    }

    if (!Array.isArray(preset.sources)) {
      throw new Error('Preset must have a sources array');
    }

    const errors = [];
    let applied = 0;

    console.log(`[OBSAudioManager] Applying preset "${preset.name || preset.id}"`);

    for (const source of preset.sources) {
      try {
        // Set volume if specified
        if (source.volumeDb !== undefined) {
          await this.setVolume(source.inputName, source.volumeDb);
        }

        // Set mute state if specified
        if (source.muted !== undefined) {
          await this.setMute(source.inputName, source.muted);
        }

        applied++;
      } catch (error) {
        console.warn(`[OBSAudioManager] Failed to apply preset setting for ${source.inputName}:`, error.message);
        errors.push({
          inputName: source.inputName,
          error: error.message
        });
      }
    }

    console.log(`[OBSAudioManager] Applied preset: ${applied}/${preset.sources.length} sources configured`);

    return {
      applied,
      errors
    };
  }

  /**
   * Delete an audio preset from Firebase
   * @param {string} compId - Competition ID
   * @param {string} presetId - Preset ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deletePreset(compId, presetId) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    if (!presetId) {
      throw new Error('Preset ID is required');
    }

    // Don't allow deleting default presets
    if (presetId.startsWith('default-')) {
      throw new Error('Cannot delete default presets');
    }

    try {
      const database = this._getDatabase();

      await database.ref(`competitions/${compId}/obs/presets/${presetId}`).remove();
      console.log(`[OBSAudioManager] Deleted preset ${presetId} for competition ${compId}`);

      return true;
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to delete preset ${presetId}:`, error.message);
      throw error;
    }
  }

  /**
   * List all audio presets for a competition (user presets + default presets)
   * @param {string} compId - Competition ID
   * @returns {Promise<Array>} Array of all available presets
   */
  async listPresets(compId) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    try {
      const database = this._getDatabase();

      // Get user presets from Firebase
      const snapshot = await database.ref(`competitions/${compId}/obs/presets`).once('value');
      const userPresetsObj = snapshot.val() || {};

      // Convert to array
      const userPresets = Object.values(userPresetsObj);

      // Combine with default presets
      const defaultPresets = Object.values(DEFAULT_PRESETS);
      const allPresets = [...defaultPresets, ...userPresets];

      console.log(`[OBSAudioManager] Listed ${allPresets.length} presets (${defaultPresets.length} default, ${userPresets.length} user) for competition ${compId}`);

      return allPresets;
    } catch (error) {
      console.error(`[OBSAudioManager] Failed to list presets for ${compId}:`, error.message);
      throw error;
    }
  }
}

export default OBSAudioManager;
