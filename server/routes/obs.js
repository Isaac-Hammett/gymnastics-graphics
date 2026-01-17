/**
 * OBS Scene CRUD API Routes
 *
 * Provides RESTful endpoints for managing OBS scenes:
 * - List all scenes
 * - Get single scene details
 * - Create new scene
 * - Duplicate scene
 * - Rename scene
 * - Delete scene
 * - Reorder scenes (client-side)
 *
 * @module routes/obs
 */

import { OBSSceneManager } from '../lib/obsSceneManager.js';

/**
 * Setup OBS routes
 * @param {Express.Application} app - Express app instance
 * @param {OBSWebSocket} obs - OBS WebSocket instance
 * @param {OBSStateSync} obsStateSync - OBS state sync instance
 */
export function setupOBSRoutes(app, obs, obsStateSync) {
  // Instantiate the scene manager
  const sceneManager = new OBSSceneManager(obs, obsStateSync);

  /**
   * GET /api/obs/scenes - List all scenes with items
   */
  app.get('/api/obs/scenes', async (req, res) => {
    try {
      console.log('[OBS Routes] GET /api/obs/scenes - Fetching all scenes');
      const scenes = sceneManager.getScenes();
      res.json({ scenes });
    } catch (error) {
      console.error('[OBS Routes] Error fetching scenes:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/scenes/:sceneName - Single scene details
   */
  app.get('/api/obs/scenes/:sceneName', async (req, res) => {
    try {
      const { sceneName } = req.params;
      console.log(`[OBS Routes] GET /api/obs/scenes/${sceneName} - Fetching scene details`);

      const scene = await sceneManager.getScene(sceneName);

      if (!scene) {
        return res.status(404).json({ error: `Scene not found: ${sceneName}` });
      }

      res.json(scene);
    } catch (error) {
      console.error(`[OBS Routes] Error fetching scene ${req.params.sceneName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/scenes - Create new scene
   */
  app.post('/api/obs/scenes', async (req, res) => {
    try {
      const { sceneName } = req.body;

      if (!sceneName) {
        return res.status(400).json({ error: 'Scene name is required' });
      }

      console.log(`[OBS Routes] POST /api/obs/scenes - Creating scene: ${sceneName}`);

      const scene = await sceneManager.createScene(sceneName);

      res.status(201).json({
        success: true,
        scene: sceneName,
        details: scene
      });
    } catch (error) {
      console.error('[OBS Routes] Error creating scene:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/scenes/:sceneName/duplicate - Duplicate scene
   */
  app.post('/api/obs/scenes/:sceneName/duplicate', async (req, res) => {
    try {
      const { sceneName } = req.params;
      const { newName } = req.body;

      if (!newName) {
        return res.status(400).json({ error: 'New scene name is required' });
      }

      console.log(`[OBS Routes] POST /api/obs/scenes/${sceneName}/duplicate - Duplicating to: ${newName}`);

      const result = await sceneManager.duplicateScene(sceneName, newName);

      res.status(201).json({
        success: true,
        scene: newName,
        details: result
      });
    } catch (error) {
      console.error(`[OBS Routes] Error duplicating scene ${req.params.sceneName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/scenes/:sceneName - Rename scene
   */
  app.put('/api/obs/scenes/:sceneName', async (req, res) => {
    try {
      const { sceneName } = req.params;
      const { newName } = req.body;

      if (!newName) {
        return res.status(400).json({ error: 'New scene name is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/scenes/${sceneName} - Renaming to: ${newName}`);

      const result = await sceneManager.renameScene(sceneName, newName);

      res.json({
        success: true,
        oldName: result.oldName,
        newName: result.newName
      });
    } catch (error) {
      console.error(`[OBS Routes] Error renaming scene ${req.params.sceneName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/scenes/reorder - Reorder scenes
   * Note: This validates the order and returns it for client-side use.
   * OBS WebSocket v5 doesn't support direct visual reordering.
   */
  app.put('/api/obs/scenes/reorder', async (req, res) => {
    try {
      const { sceneOrder } = req.body;

      if (!sceneOrder || !Array.isArray(sceneOrder)) {
        return res.status(400).json({ error: 'Scene order array is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/scenes/reorder - Reordering ${sceneOrder.length} scenes`);

      const result = await sceneManager.reorderScenes(sceneOrder);

      res.json({
        success: true,
        order: result.order,
        note: result.note
      });
    } catch (error) {
      console.error('[OBS Routes] Error reordering scenes:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/obs/scenes/:sceneName - Delete scene
   */
  app.delete('/api/obs/scenes/:sceneName', async (req, res) => {
    try {
      const { sceneName } = req.params;

      console.log(`[OBS Routes] DELETE /api/obs/scenes/${sceneName} - Deleting scene`);

      const result = await sceneManager.deleteScene(sceneName);

      res.json({
        success: true,
        deleted: result.deleted
      });
    } catch (error) {
      console.error(`[OBS Routes] Error deleting scene ${req.params.sceneName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[OBS Routes] Scene CRUD endpoints mounted');
}

export default setupOBSRoutes;
