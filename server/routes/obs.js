/**
 * OBS Scene CRUD API Routes
 *
 * Provides RESTful endpoints for managing OBS scenes and sources:
 * - Scene CRUD operations
 * - Input/Source CRUD operations
 * - Scene item management (add, remove, transform, enable, lock, reorder)
 *
 * @module routes/obs
 */

import { OBSSceneManager } from '../lib/obsSceneManager.js';
import { OBSSourceManager } from '../lib/obsSourceManager.js';

/**
 * Setup OBS routes
 * @param {Express.Application} app - Express app instance
 * @param {OBSWebSocket} obs - OBS WebSocket instance
 * @param {Function|OBSStateSync} obsStateSyncOrGetter - OBS state sync instance or getter function
 */
export function setupOBSRoutes(app, obs, obsStateSyncOrGetter) {
  // Helper to get current obsStateSync (handles both direct instance and getter function)
  const getStateSync = () => {
    return typeof obsStateSyncOrGetter === 'function'
      ? obsStateSyncOrGetter()
      : obsStateSyncOrGetter;
  };

  /**
   * GET /api/obs/scenes - List all scenes with items
   */
  app.get('/api/obs/scenes', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/scenes - Fetching all scenes');
      const sceneManager = new OBSSceneManager(obs, obsStateSync);
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
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.params;
      console.log(`[OBS Routes] GET /api/obs/scenes/${sceneName} - Fetching scene details`);

      const sceneManager = new OBSSceneManager(obs, obsStateSync);
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
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.body;

      if (!sceneName) {
        return res.status(400).json({ error: 'Scene name is required' });
      }

      console.log(`[OBS Routes] POST /api/obs/scenes - Creating scene: ${sceneName}`);

      const sceneManager = new OBSSceneManager(obs, obsStateSync);
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
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.params;
      const { newName } = req.body;

      if (!newName) {
        return res.status(400).json({ error: 'New scene name is required' });
      }

      console.log(`[OBS Routes] POST /api/obs/scenes/${sceneName}/duplicate - Duplicating to: ${newName}`);

      const sceneManager = new OBSSceneManager(obs, obsStateSync);
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
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.params;
      const { newName } = req.body;

      if (!newName) {
        return res.status(400).json({ error: 'New scene name is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/scenes/${sceneName} - Renaming to: ${newName}`);

      const sceneManager = new OBSSceneManager(obs, obsStateSync);
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
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneOrder } = req.body;

      if (!sceneOrder || !Array.isArray(sceneOrder)) {
        return res.status(400).json({ error: 'Scene order array is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/scenes/reorder - Reordering ${sceneOrder.length} scenes`);

      const sceneManager = new OBSSceneManager(obs, obsStateSync);
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
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.params;

      console.log(`[OBS Routes] DELETE /api/obs/scenes/${sceneName} - Deleting scene`);

      const sceneManager = new OBSSceneManager(obs, obsStateSync);
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

  // ============================================================================
  // Input/Source Management Endpoints
  // ============================================================================

  /**
   * GET /api/obs/inputs - List all inputs
   */
  app.get('/api/obs/inputs', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/inputs - Fetching all inputs');
      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const inputs = sourceManager.getInputs();
      res.json({ inputs });
    } catch (error) {
      console.error('[OBS Routes] Error fetching inputs:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/inputs/kinds - List available input types
   */
  app.get('/api/obs/inputs/kinds', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/inputs/kinds - Fetching input kinds');
      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const kinds = await sourceManager.getInputKinds();
      res.json({ kinds });
    } catch (error) {
      console.error('[OBS Routes] Error fetching input kinds:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/inputs - Create new input
   * Body: { inputName, inputKind, inputSettings?, sceneName? }
   */
  app.post('/api/obs/inputs', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { inputName, inputKind, inputSettings = {}, sceneName = null } = req.body;

      if (!inputName) {
        return res.status(400).json({ error: 'Input name is required' });
      }

      if (!inputKind) {
        return res.status(400).json({ error: 'Input kind is required' });
      }

      console.log(`[OBS Routes] POST /api/obs/inputs - Creating input: ${inputName} (${inputKind})`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.createInput(inputName, inputKind, inputSettings, sceneName);

      res.status(201).json({
        success: true,
        input: result
      });
    } catch (error) {
      console.error('[OBS Routes] Error creating input:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/inputs/:inputName - Get input settings
   */
  app.get('/api/obs/inputs/:inputName', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { inputName } = req.params;
      console.log(`[OBS Routes] GET /api/obs/inputs/${inputName} - Fetching input settings`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const settings = await sourceManager.getInputSettings(inputName);

      res.json(settings);
    } catch (error) {
      console.error(`[OBS Routes] Error fetching input ${req.params.inputName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/inputs/:inputName - Update input settings
   * Body: { inputSettings }
   */
  app.put('/api/obs/inputs/:inputName', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { inputName } = req.params;
      const { inputSettings } = req.body;

      if (!inputSettings || typeof inputSettings !== 'object') {
        return res.status(400).json({ error: 'Input settings object is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/inputs/${inputName} - Updating input settings`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.updateInputSettings(inputName, inputSettings);

      res.json({
        success: true,
        input: result
      });
    } catch (error) {
      console.error(`[OBS Routes] Error updating input ${req.params.inputName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/obs/inputs/:inputName - Delete input
   */
  app.delete('/api/obs/inputs/:inputName', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { inputName } = req.params;
      console.log(`[OBS Routes] DELETE /api/obs/inputs/${inputName} - Deleting input`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.deleteInput(inputName);

      res.json({
        success: true,
        deleted: result.deleted
      });
    } catch (error) {
      console.error(`[OBS Routes] Error deleting input ${req.params.inputName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Scene Item Management Endpoints
  // ============================================================================

  /**
   * GET /api/obs/scenes/:sceneName/items - Get all scene items
   */
  app.get('/api/obs/scenes/:sceneName/items', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.params;
      console.log(`[OBS Routes] GET /api/obs/scenes/${sceneName}/items - Fetching scene items`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const items = await sourceManager.getSceneItems(sceneName);

      res.json({ items });
    } catch (error) {
      console.error(`[OBS Routes] Error fetching scene items for ${req.params.sceneName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/scenes/:sceneName/items - Add source to scene
   * Body: { sourceName, transform? }
   */
  app.post('/api/obs/scenes/:sceneName/items', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.params;
      const { sourceName, transform = null } = req.body;

      if (!sourceName) {
        return res.status(400).json({ error: 'Source name is required' });
      }

      console.log(`[OBS Routes] POST /api/obs/scenes/${sceneName}/items - Adding source: ${sourceName}`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.addSourceToScene(sceneName, sourceName, transform);

      res.status(201).json({
        success: true,
        item: result
      });
    } catch (error) {
      console.error(`[OBS Routes] Error adding source to scene ${req.params.sceneName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/obs/scenes/:sceneName/items/:itemId - Remove item from scene
   */
  app.delete('/api/obs/scenes/:sceneName/items/:itemId', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName, itemId } = req.params;
      const sceneItemId = parseInt(itemId, 10);

      if (isNaN(sceneItemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      console.log(`[OBS Routes] DELETE /api/obs/scenes/${sceneName}/items/${sceneItemId} - Removing scene item`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.removeSourceFromScene(sceneName, sceneItemId);

      res.json({
        success: true,
        removed: result
      });
    } catch (error) {
      console.error(`[OBS Routes] Error removing scene item ${req.params.itemId}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/scenes/:sceneName/items/:itemId/transform - Update item transform
   * Body: { transform }
   */
  app.put('/api/obs/scenes/:sceneName/items/:itemId/transform', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName, itemId } = req.params;
      const sceneItemId = parseInt(itemId, 10);
      const { transform } = req.body;

      if (isNaN(sceneItemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      if (!transform || typeof transform !== 'object') {
        return res.status(400).json({ error: 'Transform object is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/scenes/${sceneName}/items/${sceneItemId}/transform - Updating transform`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.updateSceneItemTransform(sceneName, sceneItemId, transform);

      res.json({
        success: true,
        item: result
      });
    } catch (error) {
      console.error(`[OBS Routes] Error updating transform for item ${req.params.itemId}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/scenes/:sceneName/items/:itemId/enabled - Set item enabled state
   * Body: { enabled }
   */
  app.put('/api/obs/scenes/:sceneName/items/:itemId/enabled', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName, itemId } = req.params;
      const sceneItemId = parseInt(itemId, 10);
      const { enabled } = req.body;

      if (isNaN(sceneItemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Enabled must be a boolean' });
      }

      console.log(`[OBS Routes] PUT /api/obs/scenes/${sceneName}/items/${sceneItemId}/enabled - Setting enabled=${enabled}`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.setSceneItemEnabled(sceneName, sceneItemId, enabled);

      res.json({
        success: true,
        item: result
      });
    } catch (error) {
      console.error(`[OBS Routes] Error setting enabled state for item ${req.params.itemId}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/scenes/:sceneName/items/:itemId/locked - Set item locked state
   * Body: { locked }
   */
  app.put('/api/obs/scenes/:sceneName/items/:itemId/locked', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName, itemId } = req.params;
      const sceneItemId = parseInt(itemId, 10);
      const { locked } = req.body;

      if (isNaN(sceneItemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      if (typeof locked !== 'boolean') {
        return res.status(400).json({ error: 'Locked must be a boolean' });
      }

      console.log(`[OBS Routes] PUT /api/obs/scenes/${sceneName}/items/${sceneItemId}/locked - Setting locked=${locked}`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.setSceneItemLocked(sceneName, sceneItemId, locked);

      res.json({
        success: true,
        item: result
      });
    } catch (error) {
      console.error(`[OBS Routes] Error setting locked state for item ${req.params.itemId}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/scenes/:sceneName/items/reorder - Reorder scene items
   * Body: { itemOrder: [{sceneItemId, index}] }
   */
  app.put('/api/obs/scenes/:sceneName/items/reorder', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.params;
      const { itemOrder } = req.body;

      if (!itemOrder || !Array.isArray(itemOrder)) {
        return res.status(400).json({ error: 'Item order array is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/scenes/${sceneName}/items/reorder - Reordering ${itemOrder.length} items`);

      const sourceManager = new OBSSourceManager(obs, obsStateSync);
      const result = await sourceManager.reorderSceneItems(sceneName, itemOrder);

      res.json({
        success: true,
        reordered: result
      });
    } catch (error) {
      console.error(`[OBS Routes] Error reordering scene items in ${req.params.sceneName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[OBS Routes] Scene CRUD and Source Management endpoints mounted at server startup');
}

export default setupOBSRoutes;
