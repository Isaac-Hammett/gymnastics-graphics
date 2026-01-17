/**
 * OBS Asset Manager
 *
 * Manages media assets stored on OBS VMs for use in production graphics.
 * Provides capabilities for:
 * - Listing assets by type (music, stingers, backgrounds, logos)
 * - Uploading new assets to VMs
 * - Deleting assets from VMs
 * - Downloading assets from VMs
 * - Managing asset manifests in Firebase
 *
 * Note: This module manages the manifest and validates operations.
 * Actual file transfers are performed by the coordinator infrastructure
 * using SSH/SCP via MCP tools.
 *
 * @module obsAssetManager
 */

/**
 * Supported asset types
 */
export const ASSET_TYPES = {
  MUSIC: 'music',
  STINGERS: 'stingers',
  BACKGROUNDS: 'backgrounds',
  LOGOS: 'logos'
};

/**
 * Base path for assets on VMs
 */
export const ASSET_BASE_PATH = '/var/www/assets/';

/**
 * Validate asset filename
 * @private
 * @param {string} filename - Filename to validate
 * @returns {boolean} True if valid
 */
function isValidFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // No path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Must have extension
  if (!filename.includes('.')) {
    return false;
  }

  // Reasonable length
  if (filename.length > 255) {
    return false;
  }

  return true;
}

/**
 * OBS Asset Manager class
 * Provides asset management operations
 */
export class OBSAssetManager {
  constructor(obs, stateSync, productionConfigService = null) {
    this.obs = obs;           // OBS WebSocket instance
    this.stateSync = stateSync; // OBSStateSync instance for cached state
    this.productionConfigService = productionConfigService; // Firebase service for manifest storage
  }

  /**
   * Get Firebase database reference
   * @private
   * @returns {Object} Firebase database reference
   */
  _getDatabase() {
    if (!this.productionConfigService) {
      throw new Error('Production config service not available');
    }

    const db = this.productionConfigService.initialize();
    if (!db) {
      throw new Error('Firebase database not available');
    }

    return db;
  }

  /**
   * Get the current competition ID from stateSync
   * @private
   * @returns {string} Competition ID
   */
  _getCompId() {
    if (!this.stateSync || !this.stateSync.compId) {
      throw new Error('No active competition');
    }
    return this.stateSync.compId;
  }

  /**
   * Validate asset type
   * @private
   * @param {string} type - Asset type to validate
   * @throws {Error} If type is invalid
   */
  _validateAssetType(type) {
    const validTypes = Object.values(ASSET_TYPES);
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid asset type. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  /**
   * List all assets for a competition from Firebase manifest
   * @param {string} compId - Competition ID
   * @returns {Promise<Object>} Assets grouped by type
   */
  async listAssets(compId) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    try {
      const database = this._getDatabase();
      const snapshot = await database.ref(`competitions/${compId}/obs/assets`).once('value');
      const assets = snapshot.val() || {};

      console.log(`[OBSAssetManager] Listed assets for competition ${compId}`);

      // Ensure all types are present
      const result = {};
      for (const type of Object.values(ASSET_TYPES)) {
        result[type] = assets[type] || [];
      }

      return result;
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to list assets for ${compId}:`, error.message);
      throw error;
    }
  }

  /**
   * List assets of a specific type from Firebase manifest
   * @param {string} compId - Competition ID
   * @param {string} type - Asset type
   * @returns {Promise<Array>} Array of assets of the specified type
   */
  async listAssetsByType(compId, type) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    this._validateAssetType(type);

    try {
      const database = this._getDatabase();
      const snapshot = await database.ref(`competitions/${compId}/obs/assets/${type}`).once('value');
      const assets = snapshot.val() || [];

      console.log(`[OBSAssetManager] Listed ${assets.length} ${type} assets for competition ${compId}`);

      return assets;
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to list ${type} assets for ${compId}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload an asset (adds to Firebase manifest)
   * Note: Actual file upload is performed by coordinator via SSH
   * @param {string} compId - Competition ID
   * @param {string} type - Asset type
   * @param {string} filename - Filename
   * @param {Object} metadata - Additional metadata (size, uploadedBy, etc)
   * @returns {Promise<Object>} Upload result with path and metadata
   */
  async uploadAsset(compId, type, filename, metadata = {}) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    this._validateAssetType(type);

    if (!isValidFilename(filename)) {
      throw new Error('Invalid filename');
    }

    try {
      const database = this._getDatabase();

      // Get current assets
      const snapshot = await database.ref(`competitions/${compId}/obs/assets/${type}`).once('value');
      const assets = snapshot.val() || [];

      // Check if file already exists
      const existingIndex = assets.findIndex(a => a.filename === filename);

      // Create asset entry
      const assetEntry = {
        filename,
        type,
        path: `${ASSET_BASE_PATH}${type}/${filename}`,
        uploadedAt: new Date().toISOString(),
        ...metadata
      };

      // Update or add
      if (existingIndex >= 0) {
        assets[existingIndex] = assetEntry;
        console.log(`[OBSAssetManager] Updated asset ${filename} in manifest for competition ${compId}`);
      } else {
        assets.push(assetEntry);
        console.log(`[OBSAssetManager] Added asset ${filename} to manifest for competition ${compId}`);
      }

      // Save to Firebase
      await database.ref(`competitions/${compId}/obs/assets/${type}`).set(assets);

      return {
        success: true,
        asset: assetEntry
      };
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to upload asset ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete an asset (removes from Firebase manifest)
   * Note: Actual file deletion is performed by coordinator via SSH
   * @param {string} compId - Competition ID
   * @param {string} type - Asset type
   * @param {string} filename - Filename to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteAsset(compId, type, filename) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    this._validateAssetType(type);

    if (!isValidFilename(filename)) {
      throw new Error('Invalid filename');
    }

    try {
      const database = this._getDatabase();

      // Get current assets
      const snapshot = await database.ref(`competitions/${compId}/obs/assets/${type}`).once('value');
      const assets = snapshot.val() || [];

      // Find and remove asset
      const index = assets.findIndex(a => a.filename === filename);
      if (index === -1) {
        throw new Error(`Asset not found: ${filename}`);
      }

      const removedAsset = assets.splice(index, 1)[0];

      // Save updated list to Firebase
      await database.ref(`competitions/${compId}/obs/assets/${type}`).set(assets);

      console.log(`[OBSAssetManager] Deleted asset ${filename} from manifest for competition ${compId}`);

      return {
        success: true,
        asset: removedAsset
      };
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to delete asset ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Download an asset (retrieves metadata from Firebase)
   * Note: Actual file download is performed by coordinator via SSH
   * @param {string} compId - Competition ID
   * @param {string} type - Asset type
   * @param {string} filename - Filename to download
   * @returns {Promise<Object>} Asset metadata including path
   */
  async downloadAsset(compId, type, filename) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    this._validateAssetType(type);

    if (!isValidFilename(filename)) {
      throw new Error('Invalid filename');
    }

    try {
      const database = this._getDatabase();

      // Get current assets
      const snapshot = await database.ref(`competitions/${compId}/obs/assets/${type}`).once('value');
      const assets = snapshot.val() || [];

      // Find asset
      const asset = assets.find(a => a.filename === filename);
      if (!asset) {
        throw new Error(`Asset not found: ${filename}`);
      }

      console.log(`[OBSAssetManager] Retrieved asset info for ${filename} from competition ${compId}`);

      return {
        success: true,
        asset
      };
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to download asset ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Update asset manifest entry in Firebase
   * @param {string} compId - Competition ID
   * @param {string} type - Asset type
   * @param {string} filename - Filename
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated asset
   */
  async updateManifest(compId, type, filename, updates) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    this._validateAssetType(type);

    if (!isValidFilename(filename)) {
      throw new Error('Invalid filename');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }

    try {
      const database = this._getDatabase();

      // Get current assets
      const snapshot = await database.ref(`competitions/${compId}/obs/assets/${type}`).once('value');
      const assets = snapshot.val() || [];

      // Find asset
      const index = assets.findIndex(a => a.filename === filename);
      if (index === -1) {
        throw new Error(`Asset not found: ${filename}`);
      }

      // Update asset
      assets[index] = {
        ...assets[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Save to Firebase
      await database.ref(`competitions/${compId}/obs/assets/${type}`).set(assets);

      console.log(`[OBSAssetManager] Updated manifest for ${filename} in competition ${compId}`);

      return {
        success: true,
        asset: assets[index]
      };
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to update manifest for ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Get asset metadata from manifest
   * @param {string} compId - Competition ID
   * @param {string} type - Asset type
   * @param {string} filename - Filename
   * @returns {Promise<Object|null>} Asset metadata or null if not found
   */
  async getAssetMetadata(compId, type, filename) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    this._validateAssetType(type);

    if (!isValidFilename(filename)) {
      throw new Error('Invalid filename');
    }

    try {
      const database = this._getDatabase();

      const snapshot = await database.ref(`competitions/${compId}/obs/assets/${type}`).once('value');
      const assets = snapshot.val() || [];

      const asset = assets.find(a => a.filename === filename);

      if (!asset) {
        console.log(`[OBSAssetManager] Asset ${filename} not found in manifest for competition ${compId}`);
        return null;
      }

      console.log(`[OBSAssetManager] Retrieved metadata for ${filename} from competition ${compId}`);

      return asset;
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to get metadata for ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Clear all assets of a type from manifest
   * @param {string} compId - Competition ID
   * @param {string} type - Asset type
   * @returns {Promise<Object>} Result with count cleared
   */
  async clearAssetsByType(compId, type) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    this._validateAssetType(type);

    try {
      const database = this._getDatabase();

      // Get current count
      const snapshot = await database.ref(`competitions/${compId}/obs/assets/${type}`).once('value');
      const assets = snapshot.val() || [];
      const count = assets.length;

      // Clear the type
      await database.ref(`competitions/${compId}/obs/assets/${type}`).set([]);

      console.log(`[OBSAssetManager] Cleared ${count} ${type} assets for competition ${compId}`);

      return {
        success: true,
        count
      };
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to clear ${type} assets for ${compId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get storage statistics for assets
   * @param {string} compId - Competition ID
   * @returns {Promise<Object>} Storage statistics by type
   */
  async getStorageStats(compId) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    try {
      const allAssets = await this.listAssets(compId);

      const stats = {};
      let totalSize = 0;
      let totalCount = 0;

      for (const [type, assets] of Object.entries(allAssets)) {
        const typeSize = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
        stats[type] = {
          count: assets.length,
          totalSize: typeSize
        };
        totalSize += typeSize;
        totalCount += assets.length;
      }

      stats.total = {
        count: totalCount,
        totalSize
      };

      console.log(`[OBSAssetManager] Retrieved storage stats for competition ${compId}`);

      return stats;
    } catch (error) {
      console.error(`[OBSAssetManager] Failed to get storage stats for ${compId}:`, error.message);
      throw error;
    }
  }
}

export default OBSAssetManager;
