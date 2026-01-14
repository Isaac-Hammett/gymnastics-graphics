/**
 * Config Loader with Firebase Fallback
 *
 * Provides a unified interface for loading show configuration.
 * Supports two modes:
 * 1. Production mode: Load from Firebase when a competition is active
 * 2. Local mode: Load from local show-config.json file
 *
 * Firebase production config takes priority when an active competition is set.
 * Falls back to local config if Firebase data is unavailable or no competition is active.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import productionConfigService from './productionConfigService.js';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to local show-config.json
const LOCAL_CONFIG_PATH = path.join(__dirname, '../config/show-config.json');

// Module state
let activeCompetitionId = null;

/**
 * Set the active competition ID
 * When set, loadShowConfig() will attempt to load from Firebase first
 * @param {string} competitionId - The competition ID to activate
 */
function setActiveCompetition(competitionId) {
  const previousId = activeCompetitionId;
  activeCompetitionId = competitionId;
  console.log(`[ConfigLoader] Active competition changed: ${previousId || 'none'} -> ${competitionId || 'none'}`);
}

/**
 * Get the currently active competition ID
 * @returns {string|null} The active competition ID or null if none
 */
function getActiveCompetition() {
  return activeCompetitionId;
}

/**
 * Clear the active competition
 * After clearing, loadShowConfig() will always load from local file
 */
function clearActiveCompetition() {
  const previousId = activeCompetitionId;
  activeCompetitionId = null;
  console.log(`[ConfigLoader] Active competition cleared (was: ${previousId || 'none'})`);
}

/**
 * Load show configuration from local file
 * @returns {Object|null} The show config or null if file doesn't exist
 */
function loadLocalConfig() {
  try {
    if (!fs.existsSync(LOCAL_CONFIG_PATH)) {
      console.warn('[ConfigLoader] Local config file not found:', LOCAL_CONFIG_PATH);
      return null;
    }

    const configData = fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8');
    const config = JSON.parse(configData);
    console.log(`[ConfigLoader] Loaded local config: "${config.showName || 'Unnamed'}" with ${config.segments?.length || 0} segments`);
    return config;
  } catch (error) {
    console.error('[ConfigLoader] Failed to load local config:', error.message);
    return null;
  }
}

/**
 * Load show configuration from Firebase for a competition
 * @param {string} competitionId - The competition ID
 * @returns {Promise<Object|null>} The show config or null if not found
 */
async function loadFirebaseConfig(competitionId) {
  if (!productionConfigService.isAvailable()) {
    console.warn('[ConfigLoader] Firebase not available, cannot load production config');
    return null;
  }

  try {
    const productionConfig = await productionConfigService.getProductionConfig(competitionId);

    if (!productionConfig) {
      console.log(`[ConfigLoader] No production config found for competition: ${competitionId}`);
      return null;
    }

    // Build show config from production config
    // Production config stores cameras, rundown, settings separately
    const showConfig = {
      showName: productionConfig.rundown?.showName || `Competition ${competitionId}`,
      competitionId: competitionId,
      source: 'firebase',

      // Cameras from production config
      cameras: productionConfig.cameras || [],

      // Segments from rundown
      segments: productionConfig.rundown?.segments || [],

      // Server/audio/graphics config from settings
      nimbleServer: productionConfig.settings?.nimbleServer || null,
      audioConfig: productionConfig.settings?.audioConfig || null,
      graphicsOverlay: productionConfig.settings?.graphicsOverlay || null,
      transitions: productionConfig.settings?.transitions || null
    };

    console.log(`[ConfigLoader] Loaded Firebase config for "${competitionId}": ${showConfig.cameras.length} cameras, ${showConfig.segments.length} segments`);
    return showConfig;
  } catch (error) {
    console.error(`[ConfigLoader] Failed to load Firebase config for ${competitionId}:`, error.message);
    return null;
  }
}

/**
 * Load show configuration with fallback behavior
 *
 * Loading priority:
 * 1. If activeCompetitionId is set, try Firebase first
 * 2. If Firebase fails or returns null, fall back to local config
 * 3. If no activeCompetitionId, load from local config directly
 *
 * @returns {Promise<Object>} The show config (may be null if all sources fail)
 */
async function loadShowConfig() {
  // If no active competition, load local config directly
  if (!activeCompetitionId) {
    console.log('[ConfigLoader] No active competition, loading local config');
    const localConfig = loadLocalConfig();
    if (localConfig) {
      localConfig.source = 'local';
    }
    return localConfig;
  }

  // Try Firebase first for active competition
  console.log(`[ConfigLoader] Loading config for active competition: ${activeCompetitionId}`);
  const firebaseConfig = await loadFirebaseConfig(activeCompetitionId);

  if (firebaseConfig) {
    return firebaseConfig;
  }

  // Fall back to local config if Firebase fails
  console.log('[ConfigLoader] Firebase config unavailable, falling back to local config');
  const localConfig = loadLocalConfig();
  if (localConfig) {
    localConfig.source = 'local-fallback';
    localConfig.competitionId = activeCompetitionId; // Preserve the competition ID
  }
  return localConfig;
}

/**
 * Check if config is loaded from Firebase (production mode)
 * @param {Object} config - The loaded config object
 * @returns {boolean} True if config was loaded from Firebase
 */
function isFirebaseConfig(config) {
  return config?.source === 'firebase';
}

/**
 * Check if config is loaded from local file
 * @param {Object} config - The loaded config object
 * @returns {boolean} True if config was loaded from local file
 */
function isLocalConfig(config) {
  return config?.source === 'local' || config?.source === 'local-fallback';
}

/**
 * Get the config source description
 * @param {Object} config - The loaded config object
 * @returns {string} Description of the config source
 */
function getConfigSource(config) {
  if (!config) {
    return 'none';
  }
  switch (config.source) {
    case 'firebase':
      return `Firebase (competition: ${config.competitionId})`;
    case 'local-fallback':
      return `Local file (fallback for competition: ${config.competitionId})`;
    case 'local':
    default:
      return 'Local file';
  }
}

// ============================================================================
// Exports
// ============================================================================

const configLoader = {
  // Competition management
  setActiveCompetition,
  getActiveCompetition,
  clearActiveCompetition,

  // Config loading
  loadShowConfig,
  loadLocalConfig,
  loadFirebaseConfig,

  // Helpers
  isFirebaseConfig,
  isLocalConfig,
  getConfigSource,

  // Constants
  LOCAL_CONFIG_PATH
};

export default configLoader;

export {
  setActiveCompetition,
  getActiveCompetition,
  clearActiveCompetition,
  loadShowConfig,
  loadLocalConfig,
  loadFirebaseConfig,
  isFirebaseConfig,
  isLocalConfig,
  getConfigSource,
  LOCAL_CONFIG_PATH
};
