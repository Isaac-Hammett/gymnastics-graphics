/**
 * OBS Audio Manager
 *
 * Handles audio source management including volume, mute, and monitor controls.
 * Provides capabilities for:
 * - Getting/setting volume (dB and multiplier)
 * - Getting/setting mute state
 * - Getting/setting monitor type
 * - Accessing cached audio sources
 *
 * Works with OBSStateSync for cached state access to avoid redundant OBS calls.
 *
 * @module obsAudioManager
 */

/**
 * OBS Audio Manager class
 * Provides audio control operations for inputs/sources
 */
export class OBSAudioManager {
  constructor(obs, stateSync) {
    this.obs = obs;           // OBS WebSocket instance
    this.stateSync = stateSync; // OBSStateSync instance for cached state
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
}

export default OBSAudioManager;
