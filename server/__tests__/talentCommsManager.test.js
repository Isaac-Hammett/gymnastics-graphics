/**
 * Talent Communications Manager Tests
 *
 * Comprehensive test suite for talentCommsManager.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TalentCommsManager, COMMS_METHODS, VDO_NINJA_BASE_URL } from '../lib/talentCommsManager.js';

describe('TalentCommsManager', () => {
  let mockProductionConfigService;
  let mockDatabase;
  let firebaseStore;
  let manager;

  beforeEach(() => {
    // Create fresh Firebase store
    firebaseStore = {};

    // Create mock database
    mockDatabase = {
      ref: (path) => ({
        set: async (data) => {
          firebaseStore[path] = data;
          return {};
        },
        once: async (eventType) => ({
          val: () => firebaseStore[path] || null,
          exists: () => !!firebaseStore[path]
        }),
        update: async (data) => {
          firebaseStore[path] = { ...firebaseStore[path], ...data };
          return {};
        },
        remove: async () => {
          delete firebaseStore[path];
          return {};
        }
      })
    };

    // Create mock production config service
    mockProductionConfigService = {
      initialize: () => mockDatabase
    };

    // Create manager instance
    manager = new TalentCommsManager(mockProductionConfigService);
  });

  describe('Module exports', () => {
    it('should export TalentCommsManager class', () => {
      assert.ok(TalentCommsManager);
      assert.equal(typeof TalentCommsManager, 'function');
      assert.ok(manager instanceof TalentCommsManager);
    });

    it('should export COMMS_METHODS constant', () => {
      assert.ok(COMMS_METHODS);
      assert.equal(typeof COMMS_METHODS, 'object');
      assert.equal(COMMS_METHODS.VDO_NINJA, 'vdo-ninja');
      assert.equal(COMMS_METHODS.DISCORD, 'discord');
    });

    it('should export VDO_NINJA_BASE_URL constant', () => {
      assert.ok(VDO_NINJA_BASE_URL);
      assert.equal(typeof VDO_NINJA_BASE_URL, 'string');
      assert.equal(VDO_NINJA_BASE_URL, 'https://vdo.ninja');
    });
  });

  describe('Constructor', () => {
    it('should initialize with productionConfigService', () => {
      const mgr = new TalentCommsManager(mockProductionConfigService);
      assert.ok(mgr.productionConfigService);
    });

    it('should work without productionConfigService', () => {
      const mgr = new TalentCommsManager();
      assert.equal(mgr.productionConfigService, null);
    });

    it('should store the provided service', () => {
      const mgr = new TalentCommsManager(mockProductionConfigService);
      assert.equal(mgr.productionConfigService, mockProductionConfigService);
    });
  });

  describe('generateRoomId', () => {
    it('should generate a room ID with gym prefix', () => {
      const roomId = manager.generateRoomId();
      assert.ok(roomId);
      assert.ok(roomId.startsWith('gym_'));
    });

    it('should generate unique room IDs', () => {
      const roomId1 = manager.generateRoomId();
      const roomId2 = manager.generateRoomId();
      assert.notEqual(roomId1, roomId2);
    });

    it('should generate room IDs of consistent format', () => {
      const roomId = manager.generateRoomId();
      // VDO.Ninja requires alphanumeric only - using underscore instead of hyphen
      assert.match(roomId, /^gym_[a-f0-9]{12}$/);
    });

    it('should generate VDO.Ninja-compatible room IDs (alphanumeric + underscore only)', () => {
      const roomId = manager.generateRoomId();
      // VDO.Ninja only allows alphanumeric characters - hyphens get replaced with underscores
      // So we use underscores from the start to avoid mismatches
      assert.match(roomId, /^[a-z0-9_]+$/);
    });

    it('should generate multiple unique IDs in succession', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(manager.generateRoomId());
      }
      assert.equal(ids.size, 100); // All should be unique
    });
  });

  describe('generateVdoNinjaUrls', () => {
    it('should generate all required URL types', () => {
      const roomId = 'test-room-123';
      const password = 'test-password';
      const urls = manager.generateVdoNinjaUrls(roomId, password);

      assert.ok(urls.directorUrl);
      assert.ok(urls.obsSceneUrl);
      assert.ok(urls.talentUrls['talent-1']);
      assert.ok(urls.talentUrls['talent-2']);
      assert.ok(urls.obsViewUrls['talent-1']);
      assert.ok(urls.obsViewUrls['talent-2']);
    });

    it('should include room ID in all URLs', () => {
      const roomId = 'test-room-123';
      const urls = manager.generateVdoNinjaUrls(roomId);

      assert.ok(urls.directorUrl.includes(roomId));
      assert.ok(urls.obsSceneUrl.includes(roomId));
      assert.ok(urls.talentUrls['talent-1'].includes(roomId));
      assert.ok(urls.talentUrls['talent-2'].includes(roomId));
      assert.ok(urls.obsViewUrls['talent-1'].includes(roomId));
      assert.ok(urls.obsViewUrls['talent-2'].includes(roomId));
    });

    it('should include password in director URL', () => {
      const roomId = 'test-room-123';
      const password = 'test-password';
      const urls = manager.generateVdoNinjaUrls(roomId, password);

      assert.ok(urls.directorUrl.includes(`password=${password}`));
    });

    it('should format director URL correctly', () => {
      const roomId = 'test-room-123';
      const password = 'test-password';
      const urls = manager.generateVdoNinjaUrls(roomId, password);

      assert.equal(urls.directorUrl, `${VDO_NINJA_BASE_URL}/?director=${roomId}&password=${password}`);
    });

    it('should format obsScene URL correctly', () => {
      const roomId = 'test-room-123';
      const password = 'test-password';
      const urls = manager.generateVdoNinjaUrls(roomId, password);
      // obsSceneUrl includes hash derived from password
      assert.ok(urls.obsSceneUrl.startsWith(`${VDO_NINJA_BASE_URL}/?view=${roomId}&scene&hash=`));
    });

    it('should format talent URLs correctly (for talent to join and push)', () => {
      const roomId = 'test-room-123';
      const password = 'test-password';
      const urls = manager.generateVdoNinjaUrls(roomId, password);

      // Talent URLs are for talent to join the room and push their video
      assert.ok(urls.talentUrls['talent-1'].includes(`room=${roomId}`));
      assert.ok(urls.talentUrls['talent-1'].includes('push=talent1'));
      assert.ok(urls.talentUrls['talent-1'].includes('hash='));
      assert.ok(urls.talentUrls['talent-2'].includes(`room=${roomId}`));
      assert.ok(urls.talentUrls['talent-2'].includes('push=talent2'));
    });

    it('should format OBS view URLs correctly (for OBS to view talent feeds)', () => {
      const roomId = 'test-room-123';
      const password = 'test-password';
      const urls = manager.generateVdoNinjaUrls(roomId, password);

      // OBS view URLs are for OBS browser sources to view individual talent feeds
      assert.equal(urls.obsViewUrls['talent-1'], `${VDO_NINJA_BASE_URL}/?view=talent1&solo&room=${roomId}&password=${password}`);
      assert.equal(urls.obsViewUrls['talent-2'], `${VDO_NINJA_BASE_URL}/?view=talent2&solo&room=${roomId}&password=${password}`);
    });

    it('should generate password if not provided', () => {
      const roomId = 'test-room-123';
      const urls = manager.generateVdoNinjaUrls(roomId);

      assert.ok(urls.directorUrl.includes('password='));
    });

    it('should require room ID', () => {
      assert.throws(
        () => manager.generateVdoNinjaUrls(null),
        { message: 'Room ID is required' }
      );
    });
  });

  describe('setupTalentComms', () => {
    it('should create initial talent comms configuration', async () => {
      const result = await manager.setupTalentComms('test-comp-123');

      assert.ok(result);
      assert.equal(result.method, 'vdo-ninja');
      assert.ok(result.vdoNinja); // VDO.Ninja config is nested
      assert.ok(result.vdoNinja.roomId);
      assert.ok(result.generatedAt);
    });

    it('should save configuration to Firebase', async () => {
      await manager.setupTalentComms('test-comp-123');

      const config = firebaseStore['competitions/test-comp-123/config/talentComms'];
      assert.ok(config);
      assert.equal(config.method, 'vdo-ninja');
    });

    it('should generate all required URLs', async () => {
      const result = await manager.setupTalentComms('test-comp-123');

      assert.ok(result.vdoNinja.directorUrl);
      assert.ok(result.vdoNinja.obsSceneUrl);
      assert.ok(result.vdoNinja.talentUrls['talent-1']);
      assert.ok(result.vdoNinja.talentUrls['talent-2']);
      assert.ok(result.vdoNinja.obsViewUrls['talent-1']);
      assert.ok(result.vdoNinja.obsViewUrls['talent-2']);
    });

    it('should overwrite existing configuration', async () => {
      // Create initial config
      await manager.setupTalentComms('test-comp-123');
      const firstRoomId = firebaseStore['competitions/test-comp-123/config/talentComms'].vdoNinja.roomId;

      // Setup again
      await manager.setupTalentComms('test-comp-123');
      const secondRoomId = firebaseStore['competitions/test-comp-123/config/talentComms'].vdoNinja.roomId;

      // Room IDs should be different
      assert.notEqual(firstRoomId, secondRoomId);
    });

    it('should require competition ID', async () => {
      await assert.rejects(
        async () => await manager.setupTalentComms(null),
        { message: 'Competition ID is required' }
      );
    });

    it('should validate method parameter', async () => {
      await assert.rejects(
        async () => await manager.setupTalentComms('test-comp-123', 'invalid-method'),
        { message: /Invalid method/ }
      );
    });

    it('should accept vdo-ninja method', async () => {
      const result = await manager.setupTalentComms('test-comp-123', 'vdo-ninja');
      assert.equal(result.method, 'vdo-ninja');
    });

    it('should accept discord method', async () => {
      const result = await manager.setupTalentComms('test-comp-123', 'discord');
      assert.equal(result.method, 'discord');
    });

    it('should default to vdo-ninja method', async () => {
      const result = await manager.setupTalentComms('test-comp-123');
      assert.equal(result.method, 'vdo-ninja');
    });

    it('should set timestamps correctly', async () => {
      const result = await manager.setupTalentComms('test-comp-123');

      assert.ok(result.generatedAt);
      assert.ok(result.vdoNinja.generatedAt);

      // Should be valid ISO timestamps
      assert.ok(new Date(result.generatedAt).toISOString());
      assert.ok(new Date(result.vdoNinja.generatedAt).toISOString());
    });
  });

  describe('regenerateUrls', () => {
    beforeEach(async () => {
      // Setup initial config
      await manager.setupTalentComms('test-comp-123');
    });

    it('should regenerate URLs with new room ID', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalRoomId = originalConfig.vdoNinja.roomId;

      const result = await manager.regenerateUrls('test-comp-123');

      assert.notEqual(result.vdoNinja.roomId, originalRoomId);
    });

    it('should preserve the method', async () => {
      const result = await manager.regenerateUrls('test-comp-123');
      assert.equal(result.method, 'vdo-ninja');
    });

    it('should update the generatedAt timestamp', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalTimestamp = originalConfig.vdoNinja.generatedAt;

      // Wait a tiny bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await manager.regenerateUrls('test-comp-123');

      assert.notEqual(result.vdoNinja.generatedAt, originalTimestamp);
    });

    it('should preserve the generatedAt timestamp at top level', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalGeneratedAt = originalConfig.generatedAt;

      const result = await manager.regenerateUrls('test-comp-123');

      assert.equal(result.generatedAt, originalGeneratedAt);
    });

    it('should save updated config to Firebase', async () => {
      const result = await manager.regenerateUrls('test-comp-123');

      const config = firebaseStore['competitions/test-comp-123/config/talentComms'];
      assert.equal(config.vdoNinja.roomId, result.vdoNinja.roomId);
    });

    it('should require competition ID', async () => {
      await assert.rejects(
        async () => await manager.regenerateUrls(null),
        { message: 'Competition ID is required' }
      );
    });

    it('should throw error if config does not exist', async () => {
      await assert.rejects(
        async () => await manager.regenerateUrls('non-existent-comp'),
        { message: 'Talent comms not configured for this competition' }
      );
    });

    it('should generate new URLs with obsViewUrls', async () => {
      const result = await manager.regenerateUrls('test-comp-123');

      assert.ok(result.vdoNinja.obsViewUrls['talent-1']);
      assert.ok(result.vdoNinja.obsViewUrls['talent-2']);
    });
  });

  describe('getTalentComms', () => {
    it('should retrieve existing configuration', async () => {
      await manager.setupTalentComms('test-comp-123');

      const result = await manager.getTalentComms('test-comp-123');

      assert.ok(result);
      assert.equal(result.method, 'vdo-ninja');
      assert.ok(result.vdoNinja.roomId);
    });

    it('should return null if configuration does not exist', async () => {
      const result = await manager.getTalentComms('non-existent-comp');
      assert.equal(result, null);
    });

    it('should require competition ID', async () => {
      await assert.rejects(
        async () => await manager.getTalentComms(null),
        { message: 'Competition ID is required' }
      );
    });

    it('should return complete configuration with all fields', async () => {
      await manager.setupTalentComms('test-comp-123');

      const result = await manager.getTalentComms('test-comp-123');

      assert.ok(result.method);
      assert.ok(result.vdoNinja.roomId);
      assert.ok(result.vdoNinja.directorUrl);
      assert.ok(result.vdoNinja.talentUrls);
      assert.ok(result.vdoNinja.obsViewUrls);
      assert.ok(result.generatedAt);
    });
  });

  describe('updateMethod', () => {
    beforeEach(async () => {
      await manager.setupTalentComms('test-comp-123', 'vdo-ninja');
    });

    it('should switch from vdo-ninja to discord', async () => {
      const result = await manager.updateMethod('test-comp-123', 'discord');
      assert.equal(result.method, 'discord');
    });

    it('should switch from discord to vdo-ninja', async () => {
      await manager.setupTalentComms('test-comp-456', 'discord');

      const result = await manager.updateMethod('test-comp-456', 'vdo-ninja');
      assert.equal(result.method, 'vdo-ninja');
    });

    it('should clear vdoNinja config when switching to discord', async () => {
      const result = await manager.updateMethod('test-comp-123', 'discord');

      // When switching to discord, vdoNinja is not included
      assert.ok(!result.vdoNinja);
      assert.ok(result.discord);
    });

    it('should return existing config if method is the same', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];

      const result = await manager.updateMethod('test-comp-123', 'vdo-ninja');

      assert.equal(result.vdoNinja.roomId, originalConfig.vdoNinja.roomId);
    });

    it('should preserve generatedAt timestamp', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalGeneratedAt = originalConfig.generatedAt;

      const result = await manager.updateMethod('test-comp-123', 'discord');

      assert.equal(result.generatedAt, originalGeneratedAt);
    });

    it('should require competition ID', async () => {
      await assert.rejects(
        async () => await manager.updateMethod(null, 'discord'),
        { message: 'Competition ID is required' }
      );
    });

    it('should validate method parameter', async () => {
      await assert.rejects(
        async () => await manager.updateMethod('test-comp-123', 'invalid'),
        { message: /Invalid method/ }
      );
    });

    it('should throw error if config does not exist', async () => {
      await assert.rejects(
        async () => await manager.updateMethod('non-existent-comp', 'discord'),
        { message: 'Talent comms not configured for this competition' }
      );
    });

    it('should save updated config to Firebase', async () => {
      await manager.updateMethod('test-comp-123', 'discord');

      const config = firebaseStore['competitions/test-comp-123/config/talentComms'];
      assert.equal(config.method, 'discord');
    });
  });

  describe('deleteTalentComms', () => {
    beforeEach(async () => {
      await manager.setupTalentComms('test-comp-123');
    });

    it('should delete existing configuration', async () => {
      const result = await manager.deleteTalentComms('test-comp-123');

      assert.equal(result.success, true);
    });

    it('should remove configuration from Firebase', async () => {
      await manager.deleteTalentComms('test-comp-123');

      const config = firebaseStore['competitions/test-comp-123/config/talentComms'];
      assert.equal(config, undefined);
    });

    it('should require competition ID', async () => {
      await assert.rejects(
        async () => await manager.deleteTalentComms(null),
        { message: 'Competition ID is required' }
      );
    });

    it('should throw error if config does not exist', async () => {
      await assert.rejects(
        async () => await manager.deleteTalentComms('non-existent-comp'),
        { message: 'Talent comms not configured for this competition' }
      );
    });
  });

  describe('Error handling', () => {
    it('should throw error when trying to setup without Firebase', async () => {
      const managerWithoutFirebase = new TalentCommsManager();

      await assert.rejects(
        async () => await managerWithoutFirebase.setupTalentComms('test-comp-123'),
        { message: 'Production config service not available' }
      );
    });

    it('should throw error when trying to regenerate without Firebase', async () => {
      const managerWithoutFirebase = new TalentCommsManager();

      await assert.rejects(
        async () => await managerWithoutFirebase.regenerateUrls('test-comp-123'),
        { message: 'Production config service not available' }
      );
    });

    it('should throw error when trying to get config without Firebase', async () => {
      const managerWithoutFirebase = new TalentCommsManager();

      await assert.rejects(
        async () => await managerWithoutFirebase.getTalentComms('test-comp-123'),
        { message: 'Production config service not available' }
      );
    });

    it('should handle Firebase errors during setup', async () => {
      const mockErrorService = {
        initialize: () => ({
          ref: () => ({
            set: async () => {
              throw new Error('Firebase write failed');
            }
          })
        })
      };

      const errorManager = new TalentCommsManager(mockErrorService);

      await assert.rejects(
        async () => await errorManager.setupTalentComms('test-comp-123'),
        { message: 'Firebase write failed' }
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete lifecycle: setup, regenerate, get, delete', async () => {
      // Setup
      const setupResult = await manager.setupTalentComms('test-comp-123');
      assert.equal(setupResult.method, 'vdo-ninja');
      const originalRoomId = setupResult.vdoNinja.roomId;

      // Regenerate
      const regenResult = await manager.regenerateUrls('test-comp-123');
      assert.notEqual(regenResult.vdoNinja.roomId, originalRoomId);

      // Get
      const getResult = await manager.getTalentComms('test-comp-123');
      assert.equal(getResult.vdoNinja.roomId, regenResult.vdoNinja.roomId);

      // Delete
      const deleteResult = await manager.deleteTalentComms('test-comp-123');
      assert.equal(deleteResult.success, true);

      // Verify deleted
      const afterDelete = await manager.getTalentComms('test-comp-123');
      assert.equal(afterDelete, null);
    });

    it('should handle method switching workflow', async () => {
      // Setup with vdo-ninja
      await manager.setupTalentComms('test-comp-123', 'vdo-ninja');

      let config = await manager.getTalentComms('test-comp-123');
      assert.equal(config.method, 'vdo-ninja');
      assert.ok(config.vdoNinja.directorUrl);

      // Switch to discord
      await manager.updateMethod('test-comp-123', 'discord');

      config = await manager.getTalentComms('test-comp-123');
      assert.equal(config.method, 'discord');

      // Switch back to vdo-ninja
      await manager.updateMethod('test-comp-123', 'vdo-ninja');

      config = await manager.getTalentComms('test-comp-123');
      assert.equal(config.method, 'vdo-ninja');
      assert.ok(config.vdoNinja.directorUrl);
    });

    it('should handle multiple competitions independently', async () => {
      // Setup for two competitions
      await manager.setupTalentComms('comp-1');
      await manager.setupTalentComms('comp-2');

      const config1 = await manager.getTalentComms('comp-1');
      const config2 = await manager.getTalentComms('comp-2');

      // Should have different room IDs
      assert.notEqual(config1.vdoNinja.roomId, config2.vdoNinja.roomId);

      // Regenerate one shouldn't affect the other
      await manager.regenerateUrls('comp-1');

      const newConfig1 = await manager.getTalentComms('comp-1');
      const unchangedConfig2 = await manager.getTalentComms('comp-2');

      assert.notEqual(newConfig1.vdoNinja.roomId, config1.vdoNinja.roomId);
      assert.equal(unchangedConfig2.vdoNinja.roomId, config2.vdoNinja.roomId);
    });

    it('should handle multiple regenerations', async () => {
      await manager.setupTalentComms('test-comp-123');

      const roomIds = new Set();

      // Regenerate multiple times
      for (let i = 0; i < 5; i++) {
        const result = await manager.regenerateUrls('test-comp-123');
        roomIds.add(result.vdoNinja.roomId);
      }

      // All room IDs should be unique
      assert.equal(roomIds.size, 5);
    });
  });
});
