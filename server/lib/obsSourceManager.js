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
 * - Managing scene items (add, remove, transform, enable, lock, reorder)
 *
 * Works with OBSStateSync for cached state access to avoid redundant OBS calls.
 *
 * @module obsSourceManager
 */

/**
 * Transform presets for common layout configurations
 * Used for positioning sources in scenes (fullscreen, dual, quad, triple layouts)
 */
export const TRANSFORM_PRESETS = {
  fullscreen: {
    positionX: 0,
    positionY: 0,
    scaleX: 1,
    scaleY: 1,
    width: 1920,
    height: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 1920,
    boundsHeight: 1080
  },
  dualLeft: {
    positionX: 0,
    positionY: 0,
    scaleX: 0.5,
    scaleY: 1,
    width: 960,
    height: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 1080
  },
  dualRight: {
    positionX: 960,
    positionY: 0,
    scaleX: 0.5,
    scaleY: 1,
    width: 960,
    height: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 1080
  },
  quadTopLeft: {
    positionX: 0,
    positionY: 0,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 960,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 540
  },
  quadTopRight: {
    positionX: 960,
    positionY: 0,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 960,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 540
  },
  quadBottomLeft: {
    positionX: 0,
    positionY: 540,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 960,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 540
  },
  quadBottomRight: {
    positionX: 960,
    positionY: 540,
    scaleX: 0.5,
    scaleY: 0.5,
    width: 960,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 960,
    boundsHeight: 540
  },
  tripleMain: {
    positionX: 0,
    positionY: 0,
    scaleX: 0.6667,
    scaleY: 1,
    width: 1280,
    height: 1080,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 1280,
    boundsHeight: 1080
  },
  tripleTopRight: {
    positionX: 1280,
    positionY: 0,
    scaleX: 0.3333,
    scaleY: 0.5,
    width: 640,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 640,
    boundsHeight: 540
  },
  tripleBottomRight: {
    positionX: 1280,
    positionY: 540,
    scaleX: 0.3333,
    scaleY: 0.5,
    width: 640,
    height: 540,
    boundsType: 'OBS_BOUNDS_SCALE_INNER',
    boundsWidth: 640,
    boundsHeight: 540
  }
};

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

  // ============================================================================
  // Scene Item Management
  // ============================================================================

  /**
   * Get all scene items in a scene with their transforms
   * @param {string} sceneName - Name of the scene
   * @returns {Promise<Array>} Array of scene items with transform data
   */
  async getSceneItems(sceneName) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    try {
      const response = await this.obs.call('GetSceneItemList', { sceneName });
      const items = response.sceneItems || [];

      // Fetch transform data for each item
      const itemsWithTransforms = await Promise.all(
        items.map(async (item) => {
          try {
            const transformResponse = await this.obs.call('GetSceneItemTransform', {
              sceneName,
              sceneItemId: item.sceneItemId
            });
            return {
              ...item,
              transform: transformResponse.sceneItemTransform
            };
          } catch (error) {
            console.warn(`[OBSSourceManager] Failed to get transform for item ${item.sceneItemId}:`, error.message);
            return item;
          }
        })
      );

      console.log(`[OBSSourceManager] Retrieved ${itemsWithTransforms.length} items from scene: ${sceneName}`);
      return itemsWithTransforms;
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to get scene items for ${sceneName}:`, error.message);
      throw error;
    }
  }

  /**
   * Add a source to a scene with optional transform
   * @param {string} sceneName - Name of the scene to add source to
   * @param {string} sourceName - Name of the source/input to add
   * @param {Object} transform - Optional transform settings (position, scale, etc)
   * @returns {Promise<Object>} Created scene item info with sceneItemId
   */
  async addSourceToScene(sceneName, sourceName, transform = null) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    if (!sourceName) {
      throw new Error('Source name is required');
    }

    try {
      // Add source to scene
      const response = await this.obs.call('CreateSceneItem', {
        sceneName,
        sourceName
      });

      const sceneItemId = response.sceneItemId;
      console.log(`[OBSSourceManager] Added source "${sourceName}" to scene "${sceneName}" (item ID: ${sceneItemId})`);

      // Apply transform if provided
      if (transform) {
        await this.obs.call('SetSceneItemTransform', {
          sceneName,
          sceneItemId,
          sceneItemTransform: transform
        });
        console.log(`[OBSSourceManager] Applied transform to scene item ${sceneItemId}`);
      }

      return {
        sceneName,
        sourceName,
        sceneItemId,
        transform
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to add source "${sourceName}" to scene "${sceneName}":`, error.message);
      throw error;
    }
  }

  /**
   * Remove a source from a scene
   * @param {string} sceneName - Name of the scene
   * @param {number} sceneItemId - ID of the scene item to remove
   * @returns {Promise<Object>} Removal result info
   */
  async removeSourceFromScene(sceneName, sceneItemId) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    if (sceneItemId === undefined || sceneItemId === null) {
      throw new Error('Scene item ID is required');
    }

    try {
      await this.obs.call('RemoveSceneItem', {
        sceneName,
        sceneItemId
      });

      console.log(`[OBSSourceManager] Removed scene item ${sceneItemId} from scene: ${sceneName}`);

      return {
        sceneName,
        sceneItemId,
        removed: true
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to remove scene item ${sceneItemId} from scene ${sceneName}:`, error.message);
      throw error;
    }
  }

  /**
   * Update scene item transform (position, scale, bounds, etc)
   * @param {string} sceneName - Name of the scene
   * @param {number} sceneItemId - ID of the scene item
   * @param {Object} transform - Transform properties to update
   * @returns {Promise<Object>} Update result info
   */
  async updateSceneItemTransform(sceneName, sceneItemId, transform) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    if (sceneItemId === undefined || sceneItemId === null) {
      throw new Error('Scene item ID is required');
    }

    if (!transform || typeof transform !== 'object') {
      throw new Error('Transform must be an object');
    }

    try {
      await this.obs.call('SetSceneItemTransform', {
        sceneName,
        sceneItemId,
        sceneItemTransform: transform
      });

      console.log(`[OBSSourceManager] Updated transform for scene item ${sceneItemId} in scene: ${sceneName}`);

      return {
        sceneName,
        sceneItemId,
        transform,
        updated: true
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to update transform for scene item ${sceneItemId}:`, error.message);
      throw error;
    }
  }

  /**
   * Set scene item enabled/visible state
   * @param {string} sceneName - Name of the scene
   * @param {number} sceneItemId - ID of the scene item
   * @param {boolean} enabled - Whether the item should be visible
   * @returns {Promise<Object>} Update result info
   */
  async setSceneItemEnabled(sceneName, sceneItemId, enabled) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    if (sceneItemId === undefined || sceneItemId === null) {
      throw new Error('Scene item ID is required');
    }

    if (typeof enabled !== 'boolean') {
      throw new Error('Enabled must be a boolean');
    }

    try {
      await this.obs.call('SetSceneItemEnabled', {
        sceneName,
        sceneItemId,
        sceneItemEnabled: enabled
      });

      console.log(`[OBSSourceManager] Set scene item ${sceneItemId} enabled=${enabled} in scene: ${sceneName}`);

      return {
        sceneName,
        sceneItemId,
        enabled,
        updated: true
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to set enabled state for scene item ${sceneItemId}:`, error.message);
      throw error;
    }
  }

  /**
   * Set scene item locked state
   * @param {string} sceneName - Name of the scene
   * @param {number} sceneItemId - ID of the scene item
   * @param {boolean} locked - Whether the item should be locked
   * @returns {Promise<Object>} Update result info
   */
  async setSceneItemLocked(sceneName, sceneItemId, locked) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    if (sceneItemId === undefined || sceneItemId === null) {
      throw new Error('Scene item ID is required');
    }

    if (typeof locked !== 'boolean') {
      throw new Error('Locked must be a boolean');
    }

    try {
      await this.obs.call('SetSceneItemLocked', {
        sceneName,
        sceneItemId,
        sceneItemLocked: locked
      });

      console.log(`[OBSSourceManager] Set scene item ${sceneItemId} locked=${locked} in scene: ${sceneName}`);

      return {
        sceneName,
        sceneItemId,
        locked,
        updated: true
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to set locked state for scene item ${sceneItemId}:`, error.message);
      throw error;
    }
  }

  /**
   * Reorder scene items by setting their indices
   * @param {string} sceneName - Name of the scene
   * @param {Array<{sceneItemId: number, index: number}>} itemOrder - Array of items with their desired indices
   * @returns {Promise<Object>} Reorder result info
   */
  async reorderSceneItems(sceneName, itemOrder) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    if (!Array.isArray(itemOrder)) {
      throw new Error('Item order must be an array');
    }

    if (itemOrder.length === 0) {
      return {
        sceneName,
        reordered: 0
      };
    }

    try {
      // Sort by desired index to apply in correct order
      const sortedOrder = [...itemOrder].sort((a, b) => a.index - b.index);

      // Apply new indices
      for (const item of sortedOrder) {
        if (item.sceneItemId === undefined || item.sceneItemId === null) {
          throw new Error('Each item must have a sceneItemId');
        }
        if (item.index === undefined || item.index === null) {
          throw new Error('Each item must have an index');
        }

        await this.obs.call('SetSceneItemIndex', {
          sceneName,
          sceneItemId: item.sceneItemId,
          sceneItemIndex: item.index
        });
      }

      console.log(`[OBSSourceManager] Reordered ${itemOrder.length} items in scene: ${sceneName}`);

      return {
        sceneName,
        reordered: itemOrder.length
      };
    } catch (error) {
      console.error(`[OBSSourceManager] Failed to reorder scene items in ${sceneName}:`, error.message);
      throw error;
    }
  }
}

export default OBSSourceManager;
