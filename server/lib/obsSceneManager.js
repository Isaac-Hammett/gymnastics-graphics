/**
 * OBS Scene Manager
 *
 * CRUD operations for OBS scenes - distinct from obsSceneGenerator.js which auto-generates scenes.
 * This module provides manual scene management capabilities:
 * - Create empty scenes
 * - Duplicate scenes with all items
 * - Rename scenes
 * - Delete scenes
 * - Reorder scenes (client-side)
 *
 * Works with OBSStateSync for cached state access to avoid redundant OBS calls.
 *
 * @module obsSceneManager
 */

/**
 * OBS Scene Manager class
 * Provides CRUD operations for scenes
 */
export class OBSSceneManager {
  constructor(obs, stateSync) {
    this.obs = obs;           // OBS WebSocket instance
    this.stateSync = stateSync; // OBSStateSync instance for cached state
  }

  /**
   * Get all scenes from cached state
   * @returns {Array} Array of scene objects from cache
   */
  getScenes() {
    const state = this.stateSync.getState();
    return state.scenes || [];
  }

  /**
   * Get single scene with item details
   * Fetches fresh scene items from OBS
   * @param {string} sceneName - Name of the scene to fetch
   * @returns {Promise<Object|null>} Scene object with items, or null if not found
   */
  async getScene(sceneName) {
    const scenes = this.getScenes();
    const scene = scenes.find(s => s.sceneName === sceneName);
    if (!scene) {
      return null;
    }

    try {
      // Fetch fresh scene items from OBS
      const { sceneItems } = await this.obs.call('GetSceneItemList', { sceneName });
      return {
        ...scene,
        items: sceneItems
      };
    } catch (error) {
      console.error(`[OBSSceneManager] Failed to get scene items for ${sceneName}:`, error.message);
      throw error;
    }
  }

  /**
   * Create new empty scene
   * @param {string} sceneName - Name for the new scene
   * @returns {Promise<Object>} Created scene info
   */
  async createScene(sceneName) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    try {
      await this.obs.call('CreateScene', { sceneName });
      console.log(`[OBSSceneManager] Created scene: ${sceneName}`);

      return {
        name: sceneName,
        items: []
      };
    } catch (error) {
      console.error(`[OBSSceneManager] Failed to create scene ${sceneName}:`, error.message);
      throw error;
    }
  }

  /**
   * Duplicate scene with all its items
   * @param {string} sourceName - Name of the source scene to duplicate
   * @param {string} newName - Name for the new duplicated scene
   * @returns {Promise<Object>} Duplication result info
   */
  async duplicateScene(sourceName, newName) {
    if (!sourceName || !newName) {
      throw new Error('Source name and new name are required');
    }

    if (sourceName === newName) {
      throw new Error('Source and destination scene names must be different');
    }

    try {
      // First create the new scene
      await this.obs.call('CreateScene', { sceneName: newName });

      // Get items from source scene
      const { sceneItems } = await this.obs.call('GetSceneItemList', { sceneName: sourceName });

      // Copy each item to new scene (in reverse order to maintain visual order)
      // OBS adds items to the top of the stack, so reversing maintains the original order
      for (const item of sceneItems.reverse()) {
        await this.obs.call('CreateSceneItem', {
          sceneName: newName,
          sourceName: item.sourceName,
          sceneItemEnabled: item.sceneItemEnabled
        });
      }

      console.log(`[OBSSceneManager] Duplicated scene: ${sourceName} -> ${newName} (${sceneItems.length} items)`);

      return {
        name: newName,
        copiedFrom: sourceName,
        itemCount: sceneItems.length
      };
    } catch (error) {
      console.error(`[OBSSceneManager] Failed to duplicate scene ${sourceName}:`, error.message);
      throw error;
    }
  }

  /**
   * Rename a scene
   * @param {string} oldName - Current scene name
   * @param {string} newName - New scene name
   * @returns {Promise<Object>} Rename result info
   */
  async renameScene(oldName, newName) {
    if (!oldName || !newName) {
      throw new Error('Old name and new name are required');
    }

    if (oldName === newName) {
      throw new Error('Old and new scene names must be different');
    }

    try {
      await this.obs.call('SetSceneName', {
        sceneName: oldName,
        newSceneName: newName
      });

      console.log(`[OBSSceneManager] Renamed scene: ${oldName} -> ${newName}`);

      return {
        oldName,
        newName
      };
    } catch (error) {
      console.error(`[OBSSceneManager] Failed to rename scene ${oldName}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a scene
   * @param {string} sceneName - Name of the scene to delete
   * @returns {Promise<Object>} Deletion result info
   */
  async deleteScene(sceneName) {
    if (!sceneName) {
      throw new Error('Scene name is required');
    }

    try {
      await this.obs.call('RemoveScene', { sceneName });
      console.log(`[OBSSceneManager] Deleted scene: ${sceneName}`);

      return {
        deleted: sceneName
      };
    } catch (error) {
      console.error(`[OBSSceneManager] Failed to delete scene ${sceneName}:`, error.message);
      throw error;
    }
  }

  /**
   * Reorder scenes
   * Note: OBS WebSocket v5 doesn't have a direct reorder API.
   * This validates the order matches existing scenes and returns it for client-side use.
   * Actual visual reordering in OBS Studio must be done manually or through scene recreation.
   *
   * @param {Array<string>} sceneOrder - Array of scene names in desired order
   * @returns {Promise<Object>} Result with validated order
   */
  async reorderScenes(sceneOrder) {
    if (!Array.isArray(sceneOrder)) {
      throw new Error('Scene order must be an array');
    }

    // Validate that all scenes in the order exist
    const currentScenes = this.getScenes().map(s => s.sceneName);
    const allMatch = sceneOrder.every(s => currentScenes.includes(s));

    if (!allMatch) {
      throw new Error('Scene order contains unknown scenes');
    }

    console.log(`[OBSSceneManager] Validated scene order: ${sceneOrder.length} scenes`);

    // Return the requested order (for client-side UI reordering)
    return {
      order: sceneOrder,
      note: 'Scene visual order managed client-side - OBS WebSocket v5 does not support direct scene reordering'
    };
  }
}

export default OBSSceneManager;
