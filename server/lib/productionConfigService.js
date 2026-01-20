/**
 * Production Config Service
 *
 * Provides Firebase-backed storage for production configuration data.
 * This service manages cameras, rundown, settings, overrides, and history
 * for each competition's production setup.
 *
 * Firebase path structure:
 *   competitions/{compId}/production/
 *     cameras/     - Object keyed by camera ID
 *     rundown/     - Rundown configuration with segments
 *     settings/    - Production settings (transitions, audio, etc.)
 *     overrides/   - Array of producer override actions
 *     history/     - Array of segment history records
 */

import admin from 'firebase-admin';

// Firebase Admin SDK configuration
// Uses GOOGLE_APPLICATION_CREDENTIALS environment variable for authentication
// or falls back to default credentials in GCP environments

let db = null;
let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * Safe to call multiple times - will only initialize once
 */
function initializeFirebase() {
  if (initialized) {
    return db;
  }

  try {
    // Check if already initialized (in case of multiple imports)
    if (admin.apps.length === 0) {
      // Initialize with environment-based credentials
      // In production, set GOOGLE_APPLICATION_CREDENTIALS to service account path
      // In development, you can use the emulator or a service account
      const databaseURL = process.env.FIREBASE_DATABASE_URL ||
        'https://gymnastics-graphics-default-rtdb.firebaseio.com';

      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL
      });

      console.log('[ProductionConfigService] Firebase Admin SDK initialized');
    }

    db = admin.database();
    initialized = true;
    return db;
  } catch (error) {
    console.error('[ProductionConfigService] Failed to initialize Firebase Admin SDK:', error.message);
    // Don't throw - allow module to load even without Firebase
    // Methods will return null/empty values when Firebase is unavailable
    return null;
  }
}

/**
 * Get the database reference, initializing if needed
 */
function getDb() {
  if (!db) {
    initializeFirebase();
  }
  return db;
}

/**
 * Check if Firebase is available
 */
function isAvailable() {
  return getDb() !== null;
}

/**
 * Get the full production config for a competition
 * @param {string} competitionId - The competition ID
 * @returns {Promise<Object|null>} Production config or null if not found
 */
async function getProductionConfig(competitionId) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return null;
  }

  try {
    const snapshot = await database.ref(`competitions/${competitionId}/production`).once('value');
    const data = snapshot.val();

    if (!data) {
      return null;
    }

    // Convert cameras object to array if present
    return {
      ...data,
      cameras: data.cameras ? objectToArray(data.cameras) : [],
      overrides: data.overrides || [],
      history: data.history || []
    };
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to get production config for ${competitionId}:`, error.message);
    return null;
  }
}

/**
 * Get cameras for a competition (converted from object to array)
 * @param {string} competitionId - The competition ID
 * @returns {Promise<Array>} Array of camera objects
 */
async function getCameras(competitionId) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return [];
  }

  try {
    const snapshot = await database.ref(`competitions/${competitionId}/production/cameras`).once('value');
    const camerasObj = snapshot.val();

    if (!camerasObj) {
      return [];
    }

    return objectToArray(camerasObj);
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to get cameras for ${competitionId}:`, error.message);
    return [];
  }
}

/**
 * Save cameras for a competition (converted from array to object)
 * @param {string} competitionId - The competition ID
 * @param {Array} cameras - Array of camera objects (must have 'id' field)
 * @returns {Promise<boolean>} Success status
 */
async function saveCameras(competitionId, cameras) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return false;
  }

  try {
    const camerasObj = arrayToObject(cameras, 'id');
    await database.ref(`competitions/${competitionId}/production/cameras`).set(camerasObj);
    console.log(`[ProductionConfigService] Saved ${cameras.length} cameras for ${competitionId}`);
    return true;
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to save cameras for ${competitionId}:`, error.message);
    return false;
  }
}

/**
 * Get rundown for a competition
 * @param {string} competitionId - The competition ID
 * @returns {Promise<Object|null>} Rundown object or null if not found
 */
async function getRundown(competitionId) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return null;
  }

  try {
    const snapshot = await database.ref(`competitions/${competitionId}/production/rundown`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to get rundown for ${competitionId}:`, error.message);
    return null;
  }
}

/**
 * Save rundown for a competition (adds lastModified timestamp)
 * @param {string} competitionId - The competition ID
 * @param {Object} rundown - Rundown configuration object
 * @returns {Promise<boolean>} Success status
 */
async function saveRundown(competitionId, rundown) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return false;
  }

  try {
    const rundownWithTimestamp = {
      ...rundown,
      lastModified: new Date().toISOString()
    };
    await database.ref(`competitions/${competitionId}/production/rundown`).set(rundownWithTimestamp);
    console.log(`[ProductionConfigService] Saved rundown for ${competitionId}`);
    return true;
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to save rundown for ${competitionId}:`, error.message);
    return false;
  }
}

/**
 * Get settings for a competition
 * @param {string} competitionId - The competition ID
 * @returns {Promise<Object|null>} Settings object or null if not found
 */
async function getSettings(competitionId) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return null;
  }

  try {
    const snapshot = await database.ref(`competitions/${competitionId}/production/settings`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to get settings for ${competitionId}:`, error.message);
    return null;
  }
}

/**
 * Save settings for a competition
 * @param {string} competitionId - The competition ID
 * @param {Object} settings - Settings object
 * @returns {Promise<boolean>} Success status
 */
async function saveSettings(competitionId, settings) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return false;
  }

  try {
    await database.ref(`competitions/${competitionId}/production/settings`).set(settings);
    console.log(`[ProductionConfigService] Saved settings for ${competitionId}`);
    return true;
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to save settings for ${competitionId}:`, error.message);
    return false;
  }
}

/**
 * Append an override to the overrides array (adds timestamp)
 * @param {string} competitionId - The competition ID
 * @param {Object} override - Override object
 * @returns {Promise<boolean>} Success status
 */
async function appendOverride(competitionId, override) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return false;
  }

  try {
    const overrideWithTimestamp = {
      ...override,
      timestamp: override.timestamp || new Date().toISOString()
    };

    // Use push to add to the array
    await database.ref(`competitions/${competitionId}/production/overrides`).push(overrideWithTimestamp);
    return true;
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to append override for ${competitionId}:`, error.message);
    return false;
  }
}

/**
 * Get all overrides for a competition
 * @param {string} competitionId - The competition ID
 * @returns {Promise<Array>} Array of override objects
 */
async function getOverrides(competitionId) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return [];
  }

  try {
    const snapshot = await database.ref(`competitions/${competitionId}/production/overrides`).once('value');
    const data = snapshot.val();

    if (!data) {
      return [];
    }

    // Convert Firebase object to array (Firebase push creates object with generated keys)
    return Object.values(data);
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to get overrides for ${competitionId}:`, error.message);
    return [];
  }
}

/**
 * Get history for a competition
 * @param {string} competitionId - The competition ID
 * @returns {Promise<Array>} Array of history records
 */
async function getHistory(competitionId) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return [];
  }

  try {
    const snapshot = await database.ref(`competitions/${competitionId}/production/history`).once('value');
    const data = snapshot.val();

    if (!data) {
      return [];
    }

    // Convert Firebase object to array
    return Object.values(data);
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to get history for ${competitionId}:`, error.message);
    return [];
  }
}

/**
 * Append a history record
 * @param {string} competitionId - The competition ID
 * @param {Object} record - History record object
 * @returns {Promise<boolean>} Success status
 */
async function appendHistory(competitionId, record) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return false;
  }

  try {
    const recordWithTimestamp = {
      ...record,
      timestamp: record.timestamp || new Date().toISOString()
    };

    await database.ref(`competitions/${competitionId}/production/history`).push(recordWithTimestamp);
    return true;
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to append history for ${competitionId}:`, error.message);
    return false;
  }
}

/**
 * Clear all production data for a competition
 * @param {string} competitionId - The competition ID
 * @returns {Promise<boolean>} Success status
 */
async function clearProductionData(competitionId) {
  const database = getDb();
  if (!database) {
    console.warn('[ProductionConfigService] Firebase not available');
    return false;
  }

  try {
    await database.ref(`competitions/${competitionId}/production`).remove();
    console.log(`[ProductionConfigService] Cleared production data for ${competitionId}`);
    return true;
  } catch (error) {
    console.error(`[ProductionConfigService] Failed to clear production data for ${competitionId}:`, error.message);
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Firebase object to array
 * @param {Object} obj - Object with keys to convert
 * @returns {Array} Array of values with 'id' field added from key
 */
function objectToArray(obj) {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  return Object.entries(obj).map(([key, value]) => ({
    ...value,
    id: value.id || key // Preserve existing id or use key
  }));
}

/**
 * Convert array to Firebase object keyed by specified field
 * @param {Array} arr - Array to convert
 * @param {string} keyField - Field to use as object key
 * @returns {Object} Object keyed by keyField values
 */
function arrayToObject(arr, keyField = 'id') {
  if (!Array.isArray(arr)) {
    return {};
  }

  return arr.reduce((obj, item) => {
    const key = item[keyField];
    if (key) {
      obj[key] = item;
    }
    return obj;
  }, {});
}

// ============================================================================
// Singleton Export
// ============================================================================

const productionConfigService = {
  // Initialization
  initialize: initializeFirebase,
  isAvailable,
  getDb,

  // Production config
  getProductionConfig,

  // Cameras
  getCameras,
  saveCameras,

  // Rundown
  getRundown,
  saveRundown,

  // Settings
  getSettings,
  saveSettings,

  // Overrides
  appendOverride,
  getOverrides,

  // History
  getHistory,
  appendHistory,

  // Utilities
  clearProductionData,

  // Helper exports for testing
  objectToArray,
  arrayToObject
};

export default productionConfigService;

export {
  initializeFirebase,
  isAvailable,
  getDb,
  getProductionConfig,
  getCameras,
  saveCameras,
  getRundown,
  saveRundown,
  getSettings,
  saveSettings,
  appendOverride,
  getOverrides,
  getHistory,
  appendHistory,
  clearProductionData,
  objectToArray,
  arrayToObject
};
