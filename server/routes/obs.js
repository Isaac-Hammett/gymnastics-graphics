/**
 * OBS Scene CRUD API Routes
 *
 * Provides RESTful endpoints for managing OBS scenes, sources, audio, transitions, streaming, assets, templates, talent communications, and preview system:
 * - Scene CRUD operations
 * - Input/Source CRUD operations
 * - Scene item management (add, remove, transform, enable, lock, reorder)
 * - Audio management (volume, mute, monitor, presets)
 * - Transition management (list, set, duration, settings)
 * - Stream configuration (settings, start, stop, status)
 * - Asset management (list, upload, delete, download, manifest)
 * - Template management (list, get, create, apply, update, delete)
 * - Talent communications (setup, regenerate, status, method switching)
 * - Preview system (screenshots, studio mode, preview/program transitions)
 *
 * @module routes/obs
 */

import { OBSSceneManager } from '../lib/obsSceneManager.js';
import { OBSSourceManager } from '../lib/obsSourceManager.js';
import { OBSAudioManager } from '../lib/obsAudioManager.js';
import { OBSTransitionManager } from '../lib/obsTransitionManager.js';
import { OBSStreamManager } from '../lib/obsStreamManager.js';
import { OBSAssetManager } from '../lib/obsAssetManager.js';
import { OBSTemplateManager } from '../lib/obsTemplateManager.js';
import { TalentCommsManager } from '../lib/talentCommsManager.js';
import { getOBSConnectionManager } from '../lib/obsConnectionManager.js';
import configLoader from '../lib/configLoader.js';
import productionConfigService from '../lib/productionConfigService.js';
import multer from 'multer';

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

  // ============================================================================
  // Audio Management Endpoints
  // ============================================================================

  /**
   * GET /api/obs/audio - List all audio sources
   */
  app.get('/api/obs/audio', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/audio - Fetching all audio sources');
      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);
      const sources = audioManager.getAudioSources();
      res.json({ sources });
    } catch (error) {
      console.error('[OBS Routes] Error fetching audio sources:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/audio/presets - List all audio presets
   * NOTE: This route MUST be defined BEFORE /api/obs/audio/:inputName
   *       Otherwise Express will match "presets" as an inputName parameter
   */
  app.get('/api/obs/audio/presets', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      console.log(`[OBS Routes] GET /api/obs/audio/presets - Listing presets for competition ${compId}`);

      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);
      const presets = await audioManager.listPresets(compId);

      res.json({ presets });
    } catch (error) {
      console.error('[OBS Routes] Error listing audio presets:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/audio/presets - Save current mix as preset
   * Body: { id, name, description, sources: [{inputName, volumeDb, muted}] }
   * NOTE: This route MUST be defined BEFORE /api/obs/audio/:inputName
   */
  app.post('/api/obs/audio/presets', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const preset = req.body;

      if (!preset || typeof preset !== 'object') {
        return res.status(400).json({ error: 'Preset object is required' });
      }

      if (!preset.id) {
        return res.status(400).json({ error: 'Preset id is required' });
      }

      if (!preset.name) {
        return res.status(400).json({ error: 'Preset name is required' });
      }

      if (!Array.isArray(preset.sources)) {
        return res.status(400).json({ error: 'Preset sources array is required' });
      }

      console.log(`[OBS Routes] POST /api/obs/audio/presets - Saving preset "${preset.name}" for competition ${compId}`);

      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);
      await audioManager.savePreset(compId, preset);

      res.status(201).json({
        success: true,
        preset: {
          id: preset.id,
          name: preset.name
        }
      });
    } catch (error) {
      console.error('[OBS Routes] Error saving audio preset:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/audio/:inputName - Get single audio source details
   */
  app.get('/api/obs/audio/:inputName', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { inputName } = req.params;
      console.log(`[OBS Routes] GET /api/obs/audio/${inputName} - Fetching audio source details`);

      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);

      // Get volume and mute state
      const volume = await audioManager.getVolume(inputName);
      const muteState = await audioManager.getMute(inputName);
      const monitorType = await audioManager.getMonitorType(inputName);

      res.json({
        inputName,
        ...volume,
        ...muteState,
        ...monitorType
      });
    } catch (error) {
      console.error(`[OBS Routes] Error fetching audio source ${req.params.inputName}:`, error.message);
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/audio/:inputName/volume - Set volume for audio source
   * Body: { volumeDb }
   */
  app.put('/api/obs/audio/:inputName/volume', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { inputName } = req.params;
      const { volumeDb } = req.body;

      if (volumeDb === undefined) {
        return res.status(400).json({ error: 'volumeDb is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/audio/${inputName}/volume - Setting volume to ${volumeDb} dB`);

      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);
      const result = await audioManager.setVolume(inputName, volumeDb);

      res.json({
        success: result.success,
        inputName,
        volumeDb
      });
    } catch (error) {
      console.error(`[OBS Routes] Error setting volume for ${req.params.inputName}:`, error.message);
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/audio/:inputName/mute - Set mute state for audio source
   * Body: { muted }
   */
  app.put('/api/obs/audio/:inputName/mute', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { inputName } = req.params;
      const { muted } = req.body;

      if (typeof muted !== 'boolean') {
        return res.status(400).json({ error: 'muted must be a boolean' });
      }

      console.log(`[OBS Routes] PUT /api/obs/audio/${inputName}/mute - Setting mute to ${muted}`);

      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);
      const result = await audioManager.setMute(inputName, muted);

      res.json({
        success: result.success,
        inputName,
        muted
      });
    } catch (error) {
      console.error(`[OBS Routes] Error setting mute for ${req.params.inputName}:`, error.message);
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/audio/:inputName/monitor - Set monitor type for audio source
   * Body: { monitorType }
   */
  app.put('/api/obs/audio/:inputName/monitor', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { inputName } = req.params;
      const { monitorType } = req.body;

      if (!monitorType) {
        return res.status(400).json({ error: 'monitorType is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/audio/${inputName}/monitor - Setting monitor type to ${monitorType}`);

      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);
      const result = await audioManager.setMonitorType(inputName, monitorType);

      res.json({
        success: result.success,
        inputName,
        monitorType
      });
    } catch (error) {
      console.error(`[OBS Routes] Error setting monitor type for ${req.params.inputName}:`, error.message);
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/audio/presets/:presetId - Load and apply preset
   */
  app.put('/api/obs/audio/presets/:presetId', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { presetId } = req.params;
      console.log(`[OBS Routes] PUT /api/obs/audio/presets/${presetId} - Loading and applying preset for competition ${compId}`);

      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);

      // Load preset
      const preset = await audioManager.loadPreset(compId, presetId);
      if (!preset) {
        return res.status(404).json({ error: `Preset not found: ${presetId}` });
      }

      // Apply preset
      const result = await audioManager.applyPreset(preset);

      res.json({
        success: true,
        preset: {
          id: preset.id,
          name: preset.name
        },
        applied: result.applied,
        errors: result.errors
      });
    } catch (error) {
      console.error(`[OBS Routes] Error applying audio preset ${req.params.presetId}:`, error.message);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/obs/audio/presets/:presetId - Delete preset
   */
  app.delete('/api/obs/audio/presets/:presetId', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { presetId } = req.params;
      console.log(`[OBS Routes] DELETE /api/obs/audio/presets/${presetId} - Deleting preset for competition ${compId}`);

      const audioManager = new OBSAudioManager(obs, obsStateSync, productionConfigService);
      await audioManager.deletePreset(compId, presetId);

      res.json({
        success: true,
        deleted: presetId
      });
    } catch (error) {
      console.error(`[OBS Routes] Error deleting audio preset ${req.params.presetId}:`, error.message);
      if (error.message.includes('Cannot delete default presets')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Transition Management Endpoints
  // ============================================================================

  /**
   * GET /api/obs/transitions - List all transitions
   */
  app.get('/api/obs/transitions', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/transitions - Fetching all transitions');
      const transitionManager = new OBSTransitionManager(obs, obsStateSync);
      const transitions = transitionManager.getTransitions();
      res.json({ transitions });
    } catch (error) {
      console.error('[OBS Routes] Error fetching transitions:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/transitions/current - Get current transition
   */
  app.get('/api/obs/transitions/current', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/transitions/current - Fetching current transition');
      const transitionManager = new OBSTransitionManager(obs, obsStateSync);
      const current = await transitionManager.getCurrentTransition();
      res.json(current);
    } catch (error) {
      console.error('[OBS Routes] Error fetching current transition:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/transitions/current - Set default transition
   * Body: { transitionName }
   */
  app.put('/api/obs/transitions/current', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { transitionName } = req.body;

      if (!transitionName) {
        return res.status(400).json({ error: 'transitionName is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/transitions/current - Setting transition to ${transitionName}`);

      const transitionManager = new OBSTransitionManager(obs, obsStateSync);
      const result = await transitionManager.setCurrentTransition(transitionName);

      res.json({
        success: result.success,
        transitionName
      });
    } catch (error) {
      console.error(`[OBS Routes] Error setting current transition:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/transitions/duration - Set transition duration
   * Body: { duration }
   */
  app.put('/api/obs/transitions/duration', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { duration } = req.body;

      if (duration === undefined || typeof duration !== 'number' || duration <= 0) {
        return res.status(400).json({ error: 'duration must be a positive number' });
      }

      console.log(`[OBS Routes] PUT /api/obs/transitions/duration - Setting duration to ${duration}ms`);

      const transitionManager = new OBSTransitionManager(obs, obsStateSync);
      const result = await transitionManager.setTransitionDuration(duration);

      res.json({
        success: result.success,
        duration
      });
    } catch (error) {
      console.error(`[OBS Routes] Error setting transition duration:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/transitions/:name/settings - Get transition settings
   */
  app.get('/api/obs/transitions/:name/settings', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { name } = req.params;
      console.log(`[OBS Routes] GET /api/obs/transitions/${name}/settings - Fetching transition settings`);

      const transitionManager = new OBSTransitionManager(obs, obsStateSync);
      const settings = await transitionManager.getTransitionSettings(name);

      res.json(settings);
    } catch (error) {
      console.error(`[OBS Routes] Error fetching transition settings for ${req.params.name}:`, error.message);
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/transitions/:name/settings - Update transition settings
   * Body: { settings }
   */
  app.put('/api/obs/transitions/:name/settings', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { name } = req.params;
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'settings object is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/transitions/${name}/settings - Updating transition settings`);

      const transitionManager = new OBSTransitionManager(obs, obsStateSync);
      const result = await transitionManager.setTransitionSettings(name, settings);

      res.json({
        success: result.success,
        transitionName: name
      });
    } catch (error) {
      console.error(`[OBS Routes] Error updating transition settings for ${req.params.name}:`, error.message);
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/transitions/stinger - Upload stinger file (placeholder)
   * Note: Returns 501 Not Implemented - requires file upload infrastructure
   */
  app.post('/api/obs/transitions/stinger', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] POST /api/obs/transitions/stinger - Stinger upload not yet implemented');

      res.status(501).json({
        error: 'Not Implemented',
        message: 'Stinger upload requires file upload infrastructure (multer/multipart support). This endpoint is reserved for future implementation.'
      });
    } catch (error) {
      console.error('[OBS Routes] Error in stinger upload endpoint:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Stream Configuration Endpoints
  // ============================================================================

  /**
   * GET /api/obs/stream/settings - Get stream service settings
   */
  app.get('/api/obs/stream/settings', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/stream/settings - Fetching stream settings');
      const streamManager = new OBSStreamManager(obs, obsStateSync, productionConfigService);
      const settings = await streamManager.getStreamSettings();
      res.json(settings);
    } catch (error) {
      console.error('[OBS Routes] Error fetching stream settings:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/stream/settings - Update stream service settings
   * Body: { serviceType, settings: { server, key, etc } }
   */
  app.put('/api/obs/stream/settings', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { serviceType, settings } = req.body;

      if (!serviceType) {
        return res.status(400).json({ error: 'serviceType is required' });
      }

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'settings object is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/stream/settings - Updating stream settings (service: ${serviceType})`);

      const streamManager = new OBSStreamManager(obs, obsStateSync, productionConfigService);
      const result = await streamManager.setStreamSettings({ serviceType, settings });

      res.json({
        success: result.success,
        serviceType
      });
    } catch (error) {
      console.error('[OBS Routes] Error updating stream settings:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/stream/start - Start streaming
   */
  app.post('/api/obs/stream/start', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] POST /api/obs/stream/start - Starting stream');

      const streamManager = new OBSStreamManager(obs, obsStateSync, productionConfigService);
      const result = await streamManager.startStream();

      res.json({
        success: result.success,
        message: 'Stream started'
      });
    } catch (error) {
      console.error('[OBS Routes] Error starting stream:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/stream/stop - Stop streaming
   */
  app.post('/api/obs/stream/stop', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] POST /api/obs/stream/stop - Stopping stream');

      const streamManager = new OBSStreamManager(obs, obsStateSync, productionConfigService);
      const result = await streamManager.stopStream();

      res.json({
        success: result.success,
        message: 'Stream stopped'
      });
    } catch (error) {
      console.error('[OBS Routes] Error stopping stream:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/stream/status - Get stream status and statistics
   */
  app.get('/api/obs/stream/status', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/stream/status - Fetching stream status');
      const streamManager = new OBSStreamManager(obs, obsStateSync, productionConfigService);
      const status = await streamManager.getStreamStatus();
      res.json(status);
    } catch (error) {
      console.error('[OBS Routes] Error fetching stream status:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Asset Management Endpoints
  // ============================================================================

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB max (largest supported asset type - stingers)
    },
    fileFilter: (req, file, cb) => {
      const { type } = req.body;
      const ext = file.originalname.split('.').pop().toLowerCase();

      // File size limits and allowed extensions by type
      const limits = {
        music: { maxSize: 50 * 1024 * 1024, exts: ['mp3', 'wav', 'flac', 'm4a', 'ogg'] },
        stingers: { maxSize: 100 * 1024 * 1024, exts: ['mp4', 'mov', 'webm'] },
        backgrounds: { maxSize: 20 * 1024 * 1024, exts: ['jpg', 'jpeg', 'png', 'webp'] },
        logos: { maxSize: 10 * 1024 * 1024, exts: ['png', 'svg', 'webp'] }
      };

      if (!type || !limits[type]) {
        return cb(new Error('Invalid asset type'), false);
      }

      if (!limits[type].exts.includes(ext)) {
        return cb(new Error(`Invalid file type for ${type}. Allowed: ${limits[type].exts.join(', ')}`), false);
      }

      cb(null, true);
    }
  });

  /**
   * GET /api/obs/assets - List all assets
   */
  app.get('/api/obs/assets', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      console.log(`[OBS Routes] GET /api/obs/assets - Listing all assets for competition ${compId}`);

      const assetManager = new OBSAssetManager(obs, obsStateSync, productionConfigService);
      const assets = await assetManager.listAssets(compId);

      res.json({ assets });
    } catch (error) {
      console.error('[OBS Routes] Error listing assets:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/assets/:type - List assets by type
   */
  app.get('/api/obs/assets/:type', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { type } = req.params;
      console.log(`[OBS Routes] GET /api/obs/assets/${type} - Listing ${type} assets for competition ${compId}`);

      const assetManager = new OBSAssetManager(obs, obsStateSync, productionConfigService);
      const assets = await assetManager.listAssetsByType(compId, type);

      res.json({ assets });
    } catch (error) {
      console.error(`[OBS Routes] Error listing assets for type ${req.params.type}:`, error.message);
      if (error.message.includes('Invalid asset type')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/assets/upload - Upload asset file
   * Multipart form data: file, type, metadata
   */
  app.post('/api/obs/assets/upload', upload.single('file'), async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { type } = req.body;
      if (!type) {
        return res.status(400).json({ error: 'Asset type is required' });
      }

      const filename = req.file.originalname;

      // Validate file size against type-specific limits
      const limits = {
        music: 50 * 1024 * 1024,
        stingers: 100 * 1024 * 1024,
        backgrounds: 20 * 1024 * 1024,
        logos: 10 * 1024 * 1024
      };

      if (req.file.size > limits[type]) {
        return res.status(400).json({
          error: `File size exceeds limit for ${type} (max ${limits[type] / 1024 / 1024}MB)`
        });
      }

      console.log(`[OBS Routes] POST /api/obs/assets/upload - Uploading ${filename} (${type}) for competition ${compId}`);

      const assetManager = new OBSAssetManager(obs, obsStateSync, productionConfigService);

      // Add to manifest
      const metadata = {
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedBy: req.body.uploadedBy || 'system'
      };

      const result = await assetManager.uploadAsset(compId, type, filename, metadata);

      res.status(201).json({
        success: true,
        asset: result.asset,
        note: 'File stored in manifest. Use MCP ssh_upload_file to transfer file to VMs.'
      });
    } catch (error) {
      console.error('[OBS Routes] Error uploading asset:', error.message);
      if (error.message.includes('Invalid asset type') || error.message.includes('Invalid filename')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/obs/assets/:type/:filename - Delete asset
   */
  app.delete('/api/obs/assets/:type/:filename', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { type, filename } = req.params;

      console.log(`[OBS Routes] DELETE /api/obs/assets/${type}/${filename} - Deleting asset for competition ${compId}`);

      const assetManager = new OBSAssetManager(obs, obsStateSync, productionConfigService);
      const result = await assetManager.deleteAsset(compId, type, filename);

      res.json({
        success: true,
        deleted: result.asset,
        note: 'Asset removed from manifest. Use MCP ssh_exec to delete file from VMs.'
      });
    } catch (error) {
      console.error(`[OBS Routes] Error deleting asset ${req.params.filename}:`, error.message);
      if (error.message.includes('Invalid asset type') || error.message.includes('Invalid filename')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/assets/:type/:filename/download - Get asset metadata
   */
  app.get('/api/obs/assets/:type/:filename/download', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { type, filename } = req.params;

      console.log(`[OBS Routes] GET /api/obs/assets/${type}/${filename}/download - Getting asset metadata for competition ${compId}`);

      const assetManager = new OBSAssetManager(obs, obsStateSync, productionConfigService);
      const result = await assetManager.downloadAsset(compId, type, filename);

      res.json({
        success: true,
        asset: result.asset,
        note: 'Use MCP ssh_download_file to retrieve file from VMs.'
      });
    } catch (error) {
      console.error(`[OBS Routes] Error getting asset ${req.params.filename}:`, error.message);
      if (error.message.includes('Invalid asset type') || error.message.includes('Invalid filename')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/assets/pack/install - Install asset pack (placeholder)
   */
  app.post('/api/obs/assets/pack/install', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] POST /api/obs/assets/pack/install - Asset pack installation not yet implemented');

      res.status(501).json({
        error: 'Not Implemented',
        message: 'Asset pack installation requires infrastructure for bulk file transfers and validation. This endpoint is reserved for future implementation.'
      });
    } catch (error) {
      console.error('[OBS Routes] Error in asset pack installation endpoint:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Template Management Endpoints
  // ============================================================================

  /**
   * GET /api/obs/templates - List all available templates
   */
  app.get('/api/obs/templates', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/templates - Listing all templates');

      const templateManager = new OBSTemplateManager(obs, obsStateSync, productionConfigService);
      const templates = await templateManager.listTemplates();

      res.json({ templates });
    } catch (error) {
      console.error('[OBS Routes] Error listing templates:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/templates/:id - Get template details
   */
  app.get('/api/obs/templates/:id', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { id } = req.params;
      console.log(`[OBS Routes] GET /api/obs/templates/${id} - Fetching template details`);

      const templateManager = new OBSTemplateManager(obs, obsStateSync, productionConfigService);
      const template = await templateManager.getTemplate(id);

      if (!template) {
        return res.status(404).json({ error: `Template not found: ${id}` });
      }

      res.json(template);
    } catch (error) {
      console.error(`[OBS Routes] Error fetching template ${req.params.id}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/templates - Create template from current OBS state
   * Body: { name, description, meetTypes, createdBy, version }
   */
  app.post('/api/obs/templates', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { name, description, meetTypes = [], createdBy, version } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Template name is required' });
      }

      if (!description) {
        return res.status(400).json({ error: 'Template description is required' });
      }

      console.log(`[OBS Routes] POST /api/obs/templates - Creating template "${name}" from current OBS state`);

      const templateManager = new OBSTemplateManager(obs, obsStateSync, productionConfigService);
      const template = await templateManager.createTemplate(name, description, meetTypes, {
        createdBy,
        version
      });

      res.status(201).json({
        success: true,
        template
      });
    } catch (error) {
      console.error('[OBS Routes] Error creating template:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/templates/:id/apply - Apply template to current OBS
   * Body: { context: { cameras, assets, config } } - optional, server auto-populates from competition config
   */
  app.post('/api/obs/templates/:id/apply', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { id } = req.params;
      const { context: userContext = {} } = req.body;

      console.log(`[OBS Routes] POST /api/obs/templates/${id}/apply - Applying template with auto-populated context`);

      // Get per-competition OBS connection instead of global obs instance
      const obsConnManager = getOBSConnectionManager();
      const compObs = obsConnManager.getConnection(compId);

      if (!compObs) {
        return res.status(503).json({
          error: 'OBS not connected for this competition. Please check the VM is running and OBS is connected.'
        });
      }

      // Auto-populate context from competition config
      const database = productionConfigService.initialize();

      // Fetch competition config for cameras, assets, etc.
      const configSnapshot = await database.ref(`competitions/${compId}/config`).once('value');
      const compConfig = configSnapshot.val() || {};

      // Fetch talent comms configuration
      const talentCommsManager = new TalentCommsManager(productionConfigService);
      let talentComms = null;
      try {
        talentComms = await talentCommsManager.getTalentComms(compId);
      } catch (err) {
        console.warn(`[OBS Routes] Could not fetch talent comms for ${compId}:`, err.message);
      }

      // Build full context with all template variables
      const fullContext = {
        // Allow user context to override auto-populated values
        ...userContext,

        // Camera SRT URLs (placeholder - needs VM camera config)
        cameras: {
          cameraA: { srtUrl: compConfig.cameraA?.srtUrl || '' },
          cameraB: { srtUrl: compConfig.cameraB?.srtUrl || '' },
          ...userContext.cameras
        },

        // Talent comms URLs from VDO.Ninja config
        talentComms: talentComms?.vdoNinja ? {
          talent1Url: talentComms.vdoNinja.talentUrls?.['talent-1'] || '',
          talent2Url: talentComms.vdoNinja.talentUrls?.['talent-2'] || '',
          obsSceneUrl: talentComms.vdoNinja.obsSceneUrl || ''
        } : {
          talent1Url: '',
          talent2Url: '',
          obsSceneUrl: ''
        },

        // Graphics overlay URL
        graphicsOverlay: {
          url: `https://commentarygraphic.com/output.html?compId=${compId}&graphic=all`
        },

        // Overlay URLs based on competition ID
        overlays: {
          streamStarting: `https://commentarygraphic.com/overlays/stream-starting.html?compId=${compId}`,
          streamEnding: `https://commentarygraphic.com/overlays/stream-ending.html?compId=${compId}`,
          dualFrame: `https://commentarygraphic.com/overlays/dual-frame.html?compId=${compId}`,
          ...userContext.overlays
        },

        // Replay URLs (placeholder - needs replay service config)
        replay: {
          camera1Url: compConfig.replay?.camera1Url || '',
          camera2Url: compConfig.replay?.camera2Url || '',
          ...userContext.replay
        },

        // Asset paths (placeholder - needs asset manifest)
        assets: {
          backgroundVideo: compConfig.assets?.backgroundVideo || '',
          backgroundMusic: compConfig.assets?.backgroundMusic || '',
          ...userContext.assets
        }
      };

      console.log(`[OBS Routes] Context populated - talentComms: ${talentComms ? 'available' : 'not configured'}, graphicsOverlay: ${fullContext.graphicsOverlay.url}`);

      const templateManager = new OBSTemplateManager(compObs, obsStateSync, productionConfigService);
      const result = await templateManager.applyTemplate(id, fullContext);

      // Build success message
      const messageParts = [];
      if (result.scenesCreated > 0) messageParts.push(`${result.scenesCreated} scenes`);
      if (result.inputsCreated > 0) messageParts.push(`${result.inputsCreated} inputs`);
      if (result.transitionsConfigured > 0) messageParts.push(`${result.transitionsConfigured} transitions`);

      const hasErrors = result.errors && result.errors.length > 0;
      let message;
      if (messageParts.length === 0) {
        message = hasErrors
          ? `Template applied with ${result.errors.length} errors`
          : 'Template applied (no changes needed)';
      } else {
        message = hasErrors
          ? `Template applied with warnings: ${messageParts.join(', ')} created. ${result.errors.length} items skipped.`
          : `Template applied: ${messageParts.join(', ')} created`;
      }

      res.json({
        success: !hasErrors || messageParts.length > 0,
        result,
        message
      });
    } catch (error) {
      console.error(`[OBS Routes] Error applying template ${req.params.id}:`, error.message);

      // Map error messages to error codes
      let errorCode = 'TEMPLATE_APPLY_ERROR';
      let statusCode = 500;

      if (error.message.includes('not found')) {
        errorCode = 'TEMPLATE_NOT_FOUND';
        statusCode = 404;
      } else if (error.message.includes('legacy format')) {
        errorCode = 'INVALID_TEMPLATE_FORMAT';
        statusCode = 400;
      } else if (error.message.includes('no scenes defined') || error.message.includes('empty scenes array')) {
        errorCode = 'INVALID_TEMPLATE_STRUCTURE';
        statusCode = 400;
      } else if (error.message.includes('missing required sceneName')) {
        errorCode = 'INVALID_SCENE_FORMAT';
        statusCode = 400;
      } else if (error.message.includes('requirements not met')) {
        errorCode = 'TEMPLATE_REQUIREMENTS_NOT_MET';
        statusCode = 400;
      } else if (error.message.includes('Socket not identified') || error.message.includes('not connected')) {
        errorCode = 'OBS_CONNECTION_ERROR';
        statusCode = 503;
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        errorCode
      });
    }
  });

  /**
   * PUT /api/obs/templates/:id - Update template metadata
   * Body: { name, description, meetTypes }
   */
  app.put('/api/obs/templates/:id', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { id } = req.params;
      const { name, description, meetTypes } = req.body;

      console.log(`[OBS Routes] PUT /api/obs/templates/${id} - Updating template metadata`);

      const templateManager = new OBSTemplateManager(obs, obsStateSync, productionConfigService);

      // Get existing template
      const template = await templateManager.getTemplate(id);
      if (!template) {
        return res.status(404).json({ error: `Template not found: ${id}` });
      }

      // Update metadata fields
      if (name !== undefined) template.name = name;
      if (description !== undefined) template.description = description;
      if (meetTypes !== undefined) template.meetTypes = meetTypes;
      template.updatedAt = new Date().toISOString();

      // Save updated template
      const database = productionConfigService.initialize();
      await database.ref(`templates/obs/${id}`).set(template);

      console.log(`[OBS Routes] Template ${id} metadata updated`);

      res.json({
        success: true,
        template
      });
    } catch (error) {
      console.error(`[OBS Routes] Error updating template ${req.params.id}:`, error.message);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/obs/templates/:id - Delete template
   */
  app.delete('/api/obs/templates/:id', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { id } = req.params;
      console.log(`[OBS Routes] DELETE /api/obs/templates/${id} - Deleting template`);

      const templateManager = new OBSTemplateManager(obs, obsStateSync, productionConfigService);
      await templateManager.deleteTemplate(id);

      res.json({
        success: true,
        deleted: id
      });
    } catch (error) {
      console.error(`[OBS Routes] Error deleting template ${req.params.id}:`, error.message);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Talent Communications Endpoints
  // ============================================================================

  /**
   * GET /api/obs/talent-comms - Get current talent communications configuration
   */
  app.get('/api/obs/talent-comms', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      console.log(`[OBS Routes] GET /api/obs/talent-comms - Fetching talent comms config for competition ${compId}`);

      const talentCommsManager = new TalentCommsManager(productionConfigService);
      const config = await talentCommsManager.getTalentComms(compId);

      if (!config) {
        return res.json({
          configured: false,
          message: 'Talent communications not configured for this competition'
        });
      }

      res.json({
        configured: true,
        config
      });
    } catch (error) {
      console.error('[OBS Routes] Error fetching talent comms:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/talent-comms/setup - Setup talent communications with VDO.Ninja or Discord
   * Body: { method: 'vdo-ninja' | 'discord' }
   */
  app.post('/api/obs/talent-comms/setup', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { method = 'vdo-ninja' } = req.body;

      console.log(`[OBS Routes] POST /api/obs/talent-comms/setup - Setting up talent comms for competition ${compId} using ${method}`);

      const talentCommsManager = new TalentCommsManager(productionConfigService);
      const config = await talentCommsManager.setupTalentComms(compId, method);

      res.status(201).json({
        success: true,
        config
      });
    } catch (error) {
      console.error('[OBS Routes] Error setting up talent comms:', error.message);
      if (error.message.includes('Invalid method')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/talent-comms/regenerate - Regenerate VDO.Ninja URLs
   * Creates new room ID and URLs while preserving the method
   */
  app.post('/api/obs/talent-comms/regenerate', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      console.log(`[OBS Routes] POST /api/obs/talent-comms/regenerate - Regenerating URLs for competition ${compId}`);

      const talentCommsManager = new TalentCommsManager(productionConfigService);
      const config = await talentCommsManager.regenerateUrls(compId);

      res.json({
        success: true,
        config
      });
    } catch (error) {
      console.error('[OBS Routes] Error regenerating talent comms URLs:', error.message);
      if (error.message.includes('not configured')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/talent-comms/method - Switch communication method
   * Body: { method: 'vdo-ninja' | 'discord' }
   *
   * DISCORD FALLBACK:
   * When switching to Discord, you'll need to set up an SSH tunnel from your VMs to Discord:
   * 1. Install Discord on production VMs
   * 2. Create a dedicated voice channel for talent comms
   * 3. Configure screen share settings for OBS capture
   * 4. Use SSH tunnel for secure connection: ssh -L 6667:discord.com:6667 user@vm-ip
   */
  app.put('/api/obs/talent-comms/method', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      const { method } = req.body;

      if (!method) {
        return res.status(400).json({ error: 'Method is required (vdo-ninja or discord)' });
      }

      console.log(`[OBS Routes] PUT /api/obs/talent-comms/method - Switching to ${method} for competition ${compId}`);

      const talentCommsManager = new TalentCommsManager(productionConfigService);
      const config = await talentCommsManager.updateMethod(compId, method);

      res.json({
        success: true,
        config
      });
    } catch (error) {
      console.error('[OBS Routes] Error updating talent comms method:', error.message);
      if (error.message.includes('Invalid method')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('not configured')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/talent-comms/status - Get talent communications status
   * Returns basic connection information and configuration status
   */
  app.get('/api/obs/talent-comms/status', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      console.log(`[OBS Routes] GET /api/obs/talent-comms/status - Checking status for competition ${compId}`);

      const talentCommsManager = new TalentCommsManager(productionConfigService);
      const config = await talentCommsManager.getTalentComms(compId);

      if (!config) {
        return res.json({
          configured: false,
          status: 'not_configured',
          message: 'Talent communications not configured for this competition'
        });
      }

      // Basic status information
      const status = {
        configured: true,
        status: 'ready',
        method: config.method,
        roomId: config.roomId,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        urls: config.urls
      };

      res.json(status);
    } catch (error) {
      console.error('[OBS Routes] Error fetching talent comms status:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/obs/talent-comms - Delete talent communications configuration
   */
  app.delete('/api/obs/talent-comms', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const compId = configLoader.getActiveCompetition();
      if (!compId) {
        return res.status(400).json({ error: 'No active competition. Activate a competition first.' });
      }

      console.log(`[OBS Routes] DELETE /api/obs/talent-comms - Deleting talent comms config for competition ${compId}`);

      const talentCommsManager = new TalentCommsManager(productionConfigService);
      const result = await talentCommsManager.deleteTalentComms(compId);

      res.json({
        success: result.success,
        message: 'Talent communications configuration deleted'
      });
    } catch (error) {
      console.error('[OBS Routes] Error deleting talent comms:', error.message);
      if (error.message.includes('not configured')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Preview System Endpoints
  // ============================================================================

  /**
   * GET /api/obs/preview/screenshot - Take screenshot of current output
   * Query params: imageFormat (png|jpg), imageWidth, imageHeight
   */
  app.get('/api/obs/preview/screenshot', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { imageFormat = 'png', imageWidth, imageHeight } = req.query;

      const options = {
        imageFormat
      };

      if (imageWidth) options.imageWidth = parseInt(imageWidth, 10);
      if (imageHeight) options.imageHeight = parseInt(imageHeight, 10);

      console.log(`[OBS Routes] GET /api/obs/preview/screenshot - Taking screenshot of current output (format: ${imageFormat})`);

      const imageData = await obsStateSync.takeScreenshot(null, options);

      res.json({
        success: true,
        imageData,
        format: imageFormat
      });
    } catch (error) {
      console.error('[OBS Routes] Error taking screenshot:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/preview/screenshot/:sceneName - Take screenshot of specific scene
   * Query params: imageFormat (png|jpg), imageWidth, imageHeight
   */
  app.get('/api/obs/preview/screenshot/:sceneName', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.params;
      const { imageFormat = 'png', imageWidth, imageHeight } = req.query;

      const options = {
        imageFormat
      };

      if (imageWidth) options.imageWidth = parseInt(imageWidth, 10);
      if (imageHeight) options.imageHeight = parseInt(imageHeight, 10);

      console.log(`[OBS Routes] GET /api/obs/preview/screenshot/${sceneName} - Taking screenshot of scene (format: ${imageFormat})`);

      const imageData = await obsStateSync.takeScreenshot(sceneName, options);

      res.json({
        success: true,
        sceneName,
        imageData,
        format: imageFormat
      });
    } catch (error) {
      console.error(`[OBS Routes] Error taking screenshot of scene ${req.params.sceneName}:`, error.message);
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/obs/studio-mode - Get studio mode status
   */
  app.get('/api/obs/studio-mode', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] GET /api/obs/studio-mode - Getting studio mode status');

      const status = await obsStateSync.getStudioModeStatus();

      res.json({
        success: true,
        ...status
      });
    } catch (error) {
      console.error('[OBS Routes] Error getting studio mode status:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/studio-mode - Enable or disable studio mode
   * Body: { enabled: boolean }
   */
  app.put('/api/obs/studio-mode', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
      }

      console.log(`[OBS Routes] PUT /api/obs/studio-mode - Setting studio mode to ${enabled}`);

      await obsStateSync.setStudioMode(enabled);

      res.json({
        success: true,
        studioModeEnabled: enabled
      });
    } catch (error) {
      console.error('[OBS Routes] Error setting studio mode:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/obs/studio-mode/preview - Set preview scene (requires studio mode enabled)
   * Body: { sceneName: string }
   */
  app.put('/api/obs/studio-mode/preview', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      const { sceneName } = req.body;

      if (!sceneName) {
        return res.status(400).json({ error: 'sceneName is required' });
      }

      console.log(`[OBS Routes] PUT /api/obs/studio-mode/preview - Setting preview scene to ${sceneName}`);

      await obsStateSync.setPreviewScene(sceneName);

      res.json({
        success: true,
        previewScene: sceneName
      });
    } catch (error) {
      console.error('[OBS Routes] Error setting preview scene:', error.message);
      if (error.message.includes('studio mode is not enabled')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/obs/studio-mode/transition - Execute transition from preview to program
   * Requires studio mode enabled
   */
  app.post('/api/obs/studio-mode/transition', async (req, res) => {
    try {
      const obsStateSync = getStateSync();
      if (!obsStateSync || !obsStateSync.isInitialized()) {
        return res.status(503).json({ error: 'OBS State Sync not initialized. Activate a competition first.' });
      }

      console.log('[OBS Routes] POST /api/obs/studio-mode/transition - Executing transition from preview to program');

      await obsStateSync.executeTransition();

      res.json({
        success: true,
        message: 'Transition executed successfully'
      });
    } catch (error) {
      console.error('[OBS Routes] Error executing transition:', error.message);
      if (error.message.includes('studio mode is not enabled')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[OBS Routes] Scene CRUD, Source Management, Audio Management, Transition Management, Stream Configuration, Asset Management, Template Management, Talent Communications, and Preview System endpoints mounted at server startup');
}

export default setupOBSRoutes;
