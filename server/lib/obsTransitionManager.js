/**
 * OBS Transition Manager
 *
 * Handles transition management for scene switching.
 * Provides capabilities for:
 * - Getting/setting current transition
 * - Getting/setting transition duration
 * - Getting/setting transition-specific settings
 * - Accessing cached transitions list
 *
 * Works with OBSStateSync for cached state access to avoid redundant OBS calls.
 *
 * @module obsTransitionManager
 */

/**
 * OBS Transition Manager class
 * Provides transition control operations
 */
export class OBSTransitionManager {
  constructor(obs, stateSync) {
    this.obs = obs;           // OBS WebSocket instance
    this.stateSync = stateSync; // OBSStateSync instance for cached state
  }

  /**
   * Get all transitions from cached state
   * @returns {Array} Transitions array with name and kind
   */
  getTransitions() {
    const state = this.stateSync.getState();
    return state.transitions || [];
  }

  /**
   * Get current transition with name and duration
   * Fetches fresh data from OBS to get current settings
   * @returns {Promise<{name: string, duration: number, kind: string}>}
   */
  async getCurrentTransition() {
    try {
      const response = await this.obs.call('GetSceneTransitionList');
      console.log(`[OBSTransitionManager] Retrieved current transition: ${response.currentSceneTransitionName} (${response.currentSceneTransitionDuration}ms)`);

      return {
        name: response.currentSceneTransitionName,
        duration: response.currentSceneTransitionDuration,
        kind: this._getTransitionKind(response.currentSceneTransitionName)
      };
    } catch (error) {
      console.error(`[OBSTransitionManager] Failed to get current transition:`, error.message);
      throw error;
    }
  }

  /**
   * Set the current transition
   * @param {string} transitionName - Name of the transition to set
   * @returns {Promise<{success: boolean}>}
   */
  async setCurrentTransition(transitionName) {
    if (!transitionName) {
      throw new Error('Transition name is required');
    }

    try {
      await this.obs.call('SetCurrentSceneTransition', { transitionName });
      console.log(`[OBSTransitionManager] Set current transition: ${transitionName}`);

      return { success: true };
    } catch (error) {
      console.error(`[OBSTransitionManager] Failed to set current transition ${transitionName}:`, error.message);
      throw error;
    }
  }

  /**
   * Set transition duration in milliseconds
   * @param {number} duration - Duration in milliseconds (must be > 0)
   * @returns {Promise<{success: boolean}>}
   */
  async setTransitionDuration(duration) {
    if (typeof duration !== 'number' || duration <= 0) {
      throw new Error('Duration must be a positive number');
    }

    try {
      await this.obs.call('SetCurrentSceneTransitionDuration', {
        transitionDuration: duration
      });

      console.log(`[OBSTransitionManager] Set transition duration: ${duration}ms`);

      return { success: true };
    } catch (error) {
      console.error(`[OBSTransitionManager] Failed to set transition duration:`, error.message);
      throw error;
    }
  }

  /**
   * Get transition-specific settings
   * @param {string} transitionName - Name of the transition
   * @returns {Promise<Object>} Transition settings object with kind and settings
   */
  async getTransitionSettings(transitionName) {
    if (!transitionName) {
      throw new Error('Transition name is required');
    }

    try {
      // Get transition kind first
      const kind = this._getTransitionKind(transitionName);

      console.log(`[OBSTransitionManager] Retrieved settings for transition: ${transitionName} (${kind})`);

      return {
        transitionName,
        kind,
        settings: {}  // Settings structure varies by transition type
      };
    } catch (error) {
      console.error(`[OBSTransitionManager] Failed to get settings for transition ${transitionName}:`, error.message);
      throw error;
    }
  }

  /**
   * Set transition-specific settings
   * @param {string} transitionName - Name of the transition
   * @param {Object} settings - Settings object for the transition
   * @returns {Promise<{success: boolean}>}
   */
  async setTransitionSettings(transitionName, settings) {
    if (!transitionName) {
      throw new Error('Transition name is required');
    }

    if (!settings || typeof settings !== 'object') {
      throw new Error('Settings must be an object');
    }

    try {
      await this.obs.call('SetCurrentSceneTransitionSettings', {
        transitionName,
        transitionSettings: settings,
        overlay: true  // Overlay means merge with existing settings
      });

      console.log(`[OBSTransitionManager] Set settings for transition ${transitionName}`);

      return { success: true };
    } catch (error) {
      console.error(`[OBSTransitionManager] Failed to set settings for transition ${transitionName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get transition kind from cached transitions
   * @private
   * @param {string} transitionName - Name of the transition
   * @returns {string} Transition kind or 'unknown'
   */
  _getTransitionKind(transitionName) {
    const transitions = this.getTransitions();
    const transition = transitions.find(t => t.transitionName === transitionName);
    return transition ? transition.transitionKind : 'unknown';
  }
}

export default OBSTransitionManager;
