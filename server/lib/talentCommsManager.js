/**
 * Talent Communications Manager
 *
 * Manages talent communication systems for production (VDO.Ninja, Discord, etc.)
 * Provides capabilities for:
 * - Generating unique room IDs and passwords
 * - Creating VDO.Ninja URLs (director, OBS scene, talent)
 * - Setting up talent comms configuration in Firebase
 * - Regenerating URLs when needed
 * - Switching between communication methods
 *
 * @module talentCommsManager
 */

import crypto from 'crypto';

/**
 * Supported communication methods
 */
export const COMMS_METHODS = {
  VDO_NINJA: 'vdo-ninja',
  DISCORD: 'discord'
};

/**
 * VDO.Ninja base URL
 */
export const VDO_NINJA_BASE_URL = 'https://vdo.ninja';

/**
 * VDO.Ninja salt for password hashing (domain-specific)
 */
const VDO_NINJA_SALT = 'vdo.ninja';

/**
 * Generate a unique room ID
 * @private
 * @returns {string} URL-safe room ID
 */
function generateRoomId() {
  const randomBytes = crypto.randomBytes(6);
  // VDO.Ninja only allows alphanumeric characters - hyphens get replaced with underscores
  const roomId = `gym_${randomBytes.toString('hex')}`;
  return roomId;
}

/**
 * Generate a secure password
 * @private
 * @returns {string} Secure password
 */
function generatePassword() {
  const randomBytes = crypto.randomBytes(12);
  return randomBytes.toString('base64url');
}

/**
 * Generate VDO.Ninja hash from password
 * VDO.Ninja uses SHA-256 hash of (password + salt), truncated to 4 hex chars
 * @private
 * @param {string} password - Room password
 * @returns {string} 4-character hex hash for use in URLs
 */
function generateVdoNinjaHash(password) {
  const hash = crypto.createHash('sha256').update(password + VDO_NINJA_SALT).digest('hex');
  // VDO.Ninja uses first 4 hex characters (2 bytes)
  return hash.slice(0, 4);
}

/**
 * Talent Communications Manager class
 * Provides talent comms configuration and management
 */
export class TalentCommsManager {
  constructor(productionConfigService = null) {
    this.productionConfigService = productionConfigService;
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
   * Generate a unique room ID
   * @returns {string} URL-safe room ID
   */
  generateRoomId() {
    return generateRoomId();
  }

  /**
   * Generate VDO.Ninja URLs for a room
   * @param {string} roomId - Room ID
   * @param {string} password - Room password
   * @returns {Object} Object containing directorUrl, obsSceneUrl, and talentUrls (PRD-compliant)
   */
  generateVdoNinjaUrls(roomId, password = null) {
    if (!roomId) {
      throw new Error('Room ID is required');
    }

    const pwd = password || generatePassword();
    // Generate hash from password for talent URLs (allows joining without exposing password)
    const hash = generateVdoNinjaHash(pwd);

    return {
      directorUrl: `${VDO_NINJA_BASE_URL}/?director=${roomId}&password=${pwd}`,
      obsSceneUrl: `${VDO_NINJA_BASE_URL}/?view=${roomId}&scene&hash=${hash}`,
      // URLs for talent to JOIN the room (push their video)
      talentUrls: {
        'talent-1': `${VDO_NINJA_BASE_URL}/?room=${roomId}&hash=${hash}&push=talent1`,
        'talent-2': `${VDO_NINJA_BASE_URL}/?room=${roomId}&hash=${hash}&push=talent2`
      },
      // URLs for OBS to VIEW individual talent feeds (for browser sources)
      obsViewUrls: {
        'talent-1': `${VDO_NINJA_BASE_URL}/?view=talent1&solo&room=${roomId}&password=${pwd}`,
        'talent-2': `${VDO_NINJA_BASE_URL}/?view=talent2&solo&room=${roomId}&password=${pwd}`
      }
    };
  }

  /**
   * Setup talent communications for a competition
   * Creates initial config or overwrites existing
   * @param {string} compId - Competition ID
   * @param {string} method - Communication method (default: 'vdo-ninja')
   * @returns {Promise<Object>} Created configuration (PRD-compliant)
   */
  async setupTalentComms(compId, method = COMMS_METHODS.VDO_NINJA) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    // Validate method
    const validMethods = Object.values(COMMS_METHODS);
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid method. Must be one of: ${validMethods.join(', ')}`);
    }

    try {
      const database = this._getDatabase();

      // Generate room ID and password
      const roomId = this.generateRoomId();
      const password = generatePassword();

      // Create config object following PRD schema
      const config = {
        method,
        generatedAt: new Date().toISOString()
      };

      // Add VDO.Ninja config if that method is selected
      if (method === COMMS_METHODS.VDO_NINJA) {
        const vdoUrls = this.generateVdoNinjaUrls(roomId, password);
        config.vdoNinja = {
          roomId,
          ...vdoUrls,
          generatedAt: new Date().toISOString()
        };
      }

      // Add Discord config placeholder if that method is selected
      if (method === COMMS_METHODS.DISCORD) {
        config.discord = {
          guildId: null,
          channelId: null,
          channelUrl: null,
          channelName: null
        };
      }

      // Save to Firebase
      await database.ref(`competitions/${compId}/config/talentComms`).set(config);

      console.log(`[TalentCommsManager] Setup talent comms for competition ${compId} using ${method}`);

      return config;
    } catch (error) {
      console.error(`[TalentCommsManager] Failed to setup talent comms for ${compId}:`, error.message);
      throw error;
    }
  }

  /**
   * Regenerate URLs for existing talent comms
   * Creates new room ID and URLs while preserving method
   * @param {string} compId - Competition ID
   * @returns {Promise<Object>} Updated configuration (PRD-compliant)
   */
  async regenerateUrls(compId) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    try {
      const database = this._getDatabase();

      // Get existing config
      const snapshot = await database.ref(`competitions/${compId}/config/talentComms`).once('value');
      const existingConfig = snapshot.val();

      if (!existingConfig) {
        throw new Error('Talent comms not configured for this competition');
      }

      // Generate new room ID and password
      const roomId = this.generateRoomId();
      const password = generatePassword();

      // Update config following PRD schema
      const updatedConfig = {
        method: existingConfig.method,
        generatedAt: existingConfig.generatedAt || new Date().toISOString()
      };

      // Regenerate VDO.Ninja URLs if that method is selected
      if (existingConfig.method === COMMS_METHODS.VDO_NINJA) {
        const vdoUrls = this.generateVdoNinjaUrls(roomId, password);
        updatedConfig.vdoNinja = {
          roomId,
          ...vdoUrls,
          generatedAt: new Date().toISOString()
        };
      }

      // Preserve Discord config if that method is selected
      if (existingConfig.method === COMMS_METHODS.DISCORD) {
        updatedConfig.discord = existingConfig.discord || {
          guildId: null,
          channelId: null,
          channelUrl: null,
          channelName: null
        };
      }

      // Save to Firebase
      await database.ref(`competitions/${compId}/config/talentComms`).set(updatedConfig);

      console.log(`[TalentCommsManager] Regenerated URLs for competition ${compId}`);

      return updatedConfig;
    } catch (error) {
      console.error(`[TalentCommsManager] Failed to regenerate URLs for ${compId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get talent communications configuration
   * @param {string} compId - Competition ID
   * @returns {Promise<Object|null>} Configuration or null if not found
   */
  async getTalentComms(compId) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    try {
      const database = this._getDatabase();

      const snapshot = await database.ref(`competitions/${compId}/config/talentComms`).once('value');
      const config = snapshot.val();

      if (!config) {
        console.log(`[TalentCommsManager] No talent comms configured for competition ${compId}`);
        return null;
      }

      console.log(`[TalentCommsManager] Retrieved talent comms config for competition ${compId}`);

      return config;
    } catch (error) {
      console.error(`[TalentCommsManager] Failed to get talent comms for ${compId}:`, error.message);
      throw error;
    }
  }

  /**
   * Update communication method
   * Switches between vdo-ninja and discord, regenerating config
   * @param {string} compId - Competition ID
   * @param {string} method - New communication method
   * @returns {Promise<Object>} Updated configuration (PRD-compliant)
   */
  async updateMethod(compId, method) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    // Validate method
    const validMethods = Object.values(COMMS_METHODS);
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid method. Must be one of: ${validMethods.join(', ')}`);
    }

    try {
      const database = this._getDatabase();

      // Get existing config
      const snapshot = await database.ref(`competitions/${compId}/config/talentComms`).once('value');
      const existingConfig = snapshot.val();

      if (!existingConfig) {
        throw new Error('Talent comms not configured for this competition');
      }

      // If method is the same, just return existing config
      if (existingConfig.method === method) {
        console.log(`[TalentCommsManager] Method already set to ${method} for competition ${compId}`);
        return existingConfig;
      }

      // Generate new config with new method following PRD schema
      const updatedConfig = {
        method,
        generatedAt: existingConfig.generatedAt || new Date().toISOString()
      };

      // Generate VDO.Ninja config if switching to that method
      if (method === COMMS_METHODS.VDO_NINJA) {
        const roomId = this.generateRoomId();
        const password = generatePassword();
        const vdoUrls = this.generateVdoNinjaUrls(roomId, password);
        updatedConfig.vdoNinja = {
          roomId,
          ...vdoUrls,
          generatedAt: new Date().toISOString()
        };
      }

      // Add Discord config placeholder if switching to that method
      if (method === COMMS_METHODS.DISCORD) {
        updatedConfig.discord = existingConfig.discord || {
          guildId: null,
          channelId: null,
          channelUrl: null,
          channelName: null
        };
      }

      // Save to Firebase
      await database.ref(`competitions/${compId}/config/talentComms`).set(updatedConfig);

      console.log(`[TalentCommsManager] Updated method to ${method} for competition ${compId}`);

      return updatedConfig;
    } catch (error) {
      console.error(`[TalentCommsManager] Failed to update method for ${compId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete talent communications configuration
   * @param {string} compId - Competition ID
   * @returns {Promise<Object>} Result
   */
  async deleteTalentComms(compId) {
    if (!compId) {
      throw new Error('Competition ID is required');
    }

    try {
      const database = this._getDatabase();

      // Check if config exists
      const snapshot = await database.ref(`competitions/${compId}/config/talentComms`).once('value');
      if (!snapshot.val()) {
        throw new Error('Talent comms not configured for this competition');
      }

      // Delete from Firebase
      await database.ref(`competitions/${compId}/config/talentComms`).remove();

      console.log(`[TalentCommsManager] Deleted talent comms for competition ${compId}`);

      return {
        success: true
      };
    } catch (error) {
      console.error(`[TalentCommsManager] Failed to delete talent comms for ${compId}:`, error.message);
      throw error;
    }
  }
}

export default TalentCommsManager;
