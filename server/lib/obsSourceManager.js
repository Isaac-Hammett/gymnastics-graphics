/**
 * OBS Source Manager
 *
 * CRUD operations for OBS inputs/sources.
 * Provides management capabilities for:
 * - Creating inputs with settings
 * - Updating input settings
 * - Deleting inputs
 * - Getting input kinds (available types)
 * - Getting input settings
 *
 * Works with OBSStateSync for cached state access to avoid redundant OBS calls.
 *
 * @module obsSourceManager
 */

/**
 * OBS Source Manager class
 * Provides CRUD operations for inputs/sources
 */
export class OBSSourceManager {
  constructor(obs, stateSync) {
    this.obs = obs;           // OBS WebSocket instance
    this.stateSync = stateSync; // OBSStateSync instance for cached state
  }

  /**
   * Get available input kinds (types)
   * Returns list of all input types supported by OBS
   * @returns {Promise<Array>} Array of input kind objects
   */
  async getInputKinds() {
    try {
      const response = await this.obs.call('GetInputKindList');
      console.log(`[OBSSourceManager] Retrieved ${response.inputKinds.length} input kinds`);
      return response.inputKinds;
    } catch (error) {
      console.error('[OBSSourceManager] Failed to get input kinds:', error.message);
      throw error;
    }
  }

  /**
   * Get all inputs from cached state
   * @returns {Array} Array of input objects from cache
   */
  getInputs() {
    const state = this.stateSync.getState();
    return state.inputs || [];
  }

  /**
   * Create a new input (source)
   * @param {string} inputName - Name for the new input
   * @param {string} inputKind - Type of input (e.g., 'browser_source', 'ffmpeg_source')
   * @param {Object} inputSettings - Settings object for the input (default: {})
   * @param {string|null} sceneName - Scene to add input to, or null to create without adding to scene
   * @returns {Promise<Object>} Created input info
   */
  async createInput(inputName, inputKind, inputSettings = {}, sceneName = null) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    if (!inputKind) {
      throw new Error('Input kind is required');
    }

    try {
      const response = await this.obs.call('CreateInput', {
        sceneName,
        inputName,
        inputKind,
        inputSettings,
        sceneItemEnabled: true
      });

      console.log(`[OBSSourceManager] Created input: ${inputName} (${inputKind})${sceneName ? ` in scene ${sceneName}` : ''}`);

      return {
        inputName,
        inputKind,
        sceneItemId: response.sceneItemId || null,
        sceneName: sceneName || null
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to create input ${inputName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get settings for a specific input
   * @param {string} inputName - Name of the input
   * @returns {Promise<Object>} Object with inputKind and inputSettings
   */
  async getInputSettings(inputName) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    try {
      const response = await this.obs.call('GetInputSettings', { inputName });
      console.log(`[OBSSourceManager] Retrieved settings for input: ${inputName}`);

      return {
        inputKind: response.inputKind,
        inputSettings: response.inputSettings
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to get settings for input ${inputName}:`, error.message);
      throw error;
    }
  }

  /**
   * Update input settings (merges with existing settings)
   * @param {string} inputName - Name of the input to update
   * @param {Object} inputSettings - Settings to update/merge
   * @returns {Promise<Object>} Update result info
   */
  async updateInputSettings(inputName, inputSettings) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    if (!inputSettings || typeof inputSettings !== 'object') {
      throw new Error('Input settings must be an object');
    }

    try {
      await this.obs.call('SetInputSettings', {
        inputName,
        inputSettings,
        overlay: true // Merge with existing settings
      });

      console.log(`[OBSSourceManager] Updated settings for input: ${inputName}`);

      return {
        inputName,
        updated: true
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to update settings for input ${inputName}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete an input
   * @param {string} inputName - Name of the input to delete
   * @returns {Promise<Object>} Deletion result info
   */
  async deleteInput(inputName) {
    if (!inputName) {
      throw new Error('Input name is required');
    }

    try {
      await this.obs.call('RemoveInput', { inputName });
      console.log(`[OBSSourceManager] Deleted input: ${inputName}`);

      return {
        deleted: inputName
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to delete input ${inputName}:`, error.message);
      throw error;
    }
  }
}

export default OBSSourceManager;
