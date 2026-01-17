/**
 * OBS Stream Manager
 *
 * Handles stream configuration and control.
 * Provides capabilities for:
 * - Getting/setting stream service settings
 * - Starting/stopping streams
 * - Getting stream status and statistics
 * - Encrypting stream keys for Firebase storage
 *
 * Works with OBSStateSync for cached state access to avoid redundant OBS calls.
 *
 * @module obsStreamManager
 */

import crypto from 'crypto';

// Encryption key should be set via environment variable
// In production, this would be managed via AWS Secrets Manager or similar
const ENCRYPTION_KEY = process.env.STREAM_KEY_ENCRYPTION_KEY || 'gymnastics-graphics-default-key-32b';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a stream key for secure storage
 * @param {string} plainKey - The plain text stream key
 * @returns {string} Encrypted and base64 encoded value
 */
export function encryptStreamKey(plainKey) {
  if (!plainKey) return null;

  // Create a 32-byte key from the encryption key (for AES-256)
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plainKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Prepend IV for decryption
  return iv.toString('base64') + ':' + encrypted;
}

/**
 * Decrypt a stream key from storage
 * @param {string} encryptedKey - The encrypted and base64 encoded value
 * @returns {string} Decrypted plain text stream key
 */
export function decryptStreamKey(encryptedKey) {
  if (!encryptedKey) return null;

  const parts = encryptedKey.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted key format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = parts[1];

  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Mask a stream key for display (show only last 4 chars)
 * @param {string} key - The stream key (plain or encrypted)
 * @returns {string} Masked key like "****abc123"
 */
export function maskStreamKey(key) {
  if (!key) return '****';
  if (key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

/**
 * OBS Stream Manager class
 * Provides stream control operations
 */
export class OBSStreamManager {
  constructor(obs, stateSync, productionConfigService = null) {
    this.obs = obs;           // OBS WebSocket instance
    this.stateSync = stateSync; // OBSStateSync instance for cached state
    this.productionConfigService = productionConfigService; // Firebase service
  }

  /**
   * Get stream settings from OBS
   * @returns {Promise<Object>} Stream service settings (key masked)
   */
  async getStreamSettings() {
    try {
      const response = await this.obs.call('GetStreamServiceSettings');
      console.log(`[OBSStreamManager] Retrieved stream settings (service type: ${response.streamServiceType})`);

      // Mask the stream key in the response
      const settings = { ...response.streamServiceSettings };
      if (settings.key) {
        settings.key = maskStreamKey(settings.key);
      }

      return {
        serviceType: response.streamServiceType,
        settings
      };
    } catch (error) {
      console.error(`[OBSStreamManager] Failed to get stream settings:`, error.message);
      throw error;
    }
  }

  /**
   * Set stream settings in OBS
   * @param {Object} settings - Stream settings object with serviceType and settings
   * @param {boolean} storeEncrypted - Whether to store encrypted key in Firebase
   * @returns {Promise<{success: boolean}>}
   */
  async setStreamSettings(settings, storeEncrypted = true) {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Settings must be an object');
    }

    if (!settings.serviceType) {
      throw new Error('Service type is required');
    }

    try {
      // Build stream service settings
      const streamServiceSettings = { ...settings.settings };

      await this.obs.call('SetStreamServiceSettings', {
        streamServiceType: settings.serviceType,
        streamServiceSettings
      });

      console.log(`[OBSStreamManager] Set stream settings (service type: ${settings.serviceType})`);

      // Store encrypted key in Firebase if requested and we have the service
      if (storeEncrypted && settings.settings?.key && this.productionConfigService) {
        try {
          await this._saveStreamKeyToFirebase(settings.settings.key);
        } catch (fbError) {
          console.warn(`[OBSStreamManager] Failed to save encrypted key to Firebase:`, fbError.message);
          // Don't throw - OBS settings were updated successfully
        }
      }

      return { success: true };
    } catch (error) {
      console.error(`[OBSStreamManager] Failed to set stream settings:`, error.message);
      throw error;
    }
  }

  /**
   * Start streaming
   * @returns {Promise<{success: boolean}>}
   */
  async startStream() {
    try {
      await this.obs.call('StartStream');
      console.log(`[OBSStreamManager] Started streaming`);

      return { success: true };
    } catch (error) {
      console.error(`[OBSStreamManager] Failed to start stream:`, error.message);
      throw error;
    }
  }

  /**
   * Stop streaming
   * @returns {Promise<{success: boolean}>}
   */
  async stopStream() {
    try {
      await this.obs.call('StopStream');
      console.log(`[OBSStreamManager] Stopped streaming`);

      return { success: true };
    } catch (error) {
      console.error(`[OBSStreamManager] Failed to stop stream:`, error.message);
      throw error;
    }
  }

  /**
   * Get stream status and statistics
   * @returns {Promise<Object>} Stream status with timing and stats
   */
  async getStreamStatus() {
    try {
      const response = await this.obs.call('GetStreamStatus');
      console.log(`[OBSStreamManager] Retrieved stream status (active: ${response.outputActive})`);

      return {
        active: response.outputActive,
        reconnecting: response.outputReconnecting || false,
        timecode: response.outputTimecode || '00:00:00.000',
        duration: response.outputDuration || 0,
        bytes: response.outputBytes || 0,
        skippedFrames: response.outputSkippedFrames || 0,
        totalFrames: response.outputTotalFrames || 0
      };
    } catch (error) {
      console.error(`[OBSStreamManager] Failed to get stream status:`, error.message);
      throw error;
    }
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
   * Save encrypted stream key to Firebase
   * @private
   * @param {string} plainKey - The plain text stream key
   * @returns {Promise<boolean>}
   */
  async _saveStreamKeyToFirebase(plainKey) {
    const database = this._getDatabase();
    const compId = this._getCompId();

    const encryptedKey = encryptStreamKey(plainKey);
    const streamConfig = {
      streamKeyEncrypted: encryptedKey,
      lastUpdated: new Date().toISOString()
    };

    await database.ref(`competitions/${compId}/obs/streamConfig`).update(streamConfig);
    console.log(`[OBSStreamManager] Saved encrypted stream key to Firebase for competition ${compId}`);

    return true;
  }

  /**
   * Load stream key from Firebase (decrypted)
   * @returns {Promise<string|null>} Decrypted stream key or null
   */
  async loadStreamKeyFromFirebase() {
    try {
      const database = this._getDatabase();
      const compId = this._getCompId();

      const snapshot = await database.ref(`competitions/${compId}/obs/streamConfig`).once('value');
      const config = snapshot.val();

      if (!config || !config.streamKeyEncrypted) {
        console.log(`[OBSStreamManager] No stream key found in Firebase for competition ${compId}`);
        return null;
      }

      const decryptedKey = decryptStreamKey(config.streamKeyEncrypted);
      console.log(`[OBSStreamManager] Loaded stream key from Firebase for competition ${compId}`);

      return decryptedKey;
    } catch (error) {
      console.error(`[OBSStreamManager] Failed to load stream key from Firebase:`, error.message);
      throw error;
    }
  }

  /**
   * Delete stream key from Firebase
   * @returns {Promise<boolean>}
   */
  async deleteStreamKeyFromFirebase() {
    try {
      const database = this._getDatabase();
      const compId = this._getCompId();

      await database.ref(`competitions/${compId}/obs/streamConfig/streamKeyEncrypted`).remove();
      console.log(`[OBSStreamManager] Deleted stream key from Firebase for competition ${compId}`);

      return true;
    } catch (error) {
      console.error(`[OBSStreamManager] Failed to delete stream key from Firebase:`, error.message);
      throw error;
    }
  }
}

export default OBSStreamManager;
