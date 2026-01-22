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

      assert.ok(urls.director);
      assert.ok(urls.obsScene);
      assert.ok(urls.talent1);
      assert.ok(urls.talent2);
    });

    it('should include room ID in all URLs', () => {
      const roomId = 'test-room-123';
      const urls = manager.generateVdoNinjaUrls(roomId);

      assert.ok(urls.director.includes(roomId));
      assert.ok(urls.obsScene.includes(roomId));
      assert.ok(urls.talent1.includes(roomId));
      assert.ok(urls.talent2.includes(roomId));
    });

    it('should include password in director URL', () => {
      const roomId = 'test-room-123';
      const password = 'test-password';
      const urls = manager.generateVdoNinjaUrls(roomId, password);

      assert.ok(urls.director.includes(`password=${password}`));
    });

    it('should format director URL correctly', () => {
      const roomId = 'test-room-123';
      const password = 'test-password';
      const urls = manager.generateVdoNinjaUrls(roomId, password);

      assert.equal(urls.director, `${VDO_NINJA_BASE_URL}/?director=${roomId}&password=${password}`);
    });

    it('should format obsScene URL correctly', () => {
      const roomId = 'test-room-123';
      const urls = manager.generateVdoNinjaUrls(roomId);

      assert.equal(urls.obsScene, `${VDO_NINJA_BASE_URL}/?view=${roomId}&scene`);
    });

    it('should format talent URLs correctly', () => {
      const roomId = 'test-room-123';
      const urls = manager.generateVdoNinjaUrls(roomId);

      assert.equal(urls.talent1, `${VDO_NINJA_BASE_URL}/?room=${roomId}&push=talent1`);
      assert.equal(urls.talent2, `${VDO_NINJA_BASE_URL}/?room=${roomId}&push=talent2`);
    });

    it('should generate password if not provided', () => {
      const roomId = 'test-room-123';
      const urls = manager.generateVdoNinjaUrls(roomId);

      assert.ok(urls.director.includes('password='));
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
      assert.ok(result.roomId);
      assert.ok(result.password);
      assert.ok(result.urls);
      assert.ok(result.createdAt);
      assert.ok(result.updatedAt);
    });

    it('should save configuration to Firebase', async () => {
      await manager.setupTalentComms('test-comp-123');

      const config = firebaseStore['competitions/test-comp-123/config/talentComms'];
      assert.ok(config);
      assert.equal(config.method, 'vdo-ninja');
    });

    it('should generate all required URLs', async () => {
      const result = await manager.setupTalentComms('test-comp-123');

      assert.ok(result.urls.director);
      assert.ok(result.urls.obsScene);
      assert.ok(result.urls.talent1);
      assert.ok(result.urls.talent2);
    });

    it('should overwrite existing configuration', async () => {
      // Create initial config
      await manager.setupTalentComms('test-comp-123');
      const firstRoomId = firebaseStore['competitions/test-comp-123/config/talentComms'].roomId;

      // Setup again
      await manager.setupTalentComms('test-comp-123');
      const secondRoomId = firebaseStore['competitions/test-comp-123/config/talentComms'].roomId;

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

      assert.ok(result.createdAt);
      assert.ok(result.updatedAt);

      // Should be valid ISO timestamps
      assert.ok(new Date(result.createdAt).toISOString());
      assert.ok(new Date(result.updatedAt).toISOString());
    });
  });

  describe('regenerateUrls', () => {
    beforeEach(async () => {
      // Setup initial config
      await manager.setupTalentComms('test-comp-123');
    });

    it('should regenerate URLs with new room ID', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalRoomId = originalConfig.roomId;

      const result = await manager.regenerateUrls('test-comp-123');

      assert.notEqual(result.roomId, originalRoomId);
    });

    it('should preserve the method', async () => {
      const result = await manager.regenerateUrls('test-comp-123');
      assert.equal(result.method, 'vdo-ninja');
    });

    it('should update the updatedAt timestamp', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalTimestamp = originalConfig.updatedAt;

      // Wait a tiny bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await manager.regenerateUrls('test-comp-123');

      assert.notEqual(result.updatedAt, originalTimestamp);
    });

    it('should preserve the createdAt timestamp', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalCreatedAt = originalConfig.createdAt;

      const result = await manager.regenerateUrls('test-comp-123');

      assert.equal(result.createdAt, originalCreatedAt);
    });

    it('should save updated config to Firebase', async () => {
      const result = await manager.regenerateUrls('test-comp-123');

      const config = firebaseStore['competitions/test-comp-123/config/talentComms'];
      assert.equal(config.roomId, result.roomId);
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

    it('should generate new password', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalPassword = originalConfig.password;

      const result = await manager.regenerateUrls('test-comp-123');

      assert.notEqual(result.password, originalPassword);
    });
  });

  describe('getTalentComms', () => {
    it('should retrieve existing configuration', async () => {
      await manager.setupTalentComms('test-comp-123');

      const result = await manager.getTalentComms('test-comp-123');

      assert.ok(result);
      assert.equal(result.method, 'vdo-ninja');
      assert.ok(result.roomId);
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
      assert.ok(result.roomId);
      assert.ok(result.password);
      assert.ok(result.urls);
      assert.ok(result.createdAt);
      assert.ok(result.updatedAt);
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

    it('should generate new room ID when switching methods', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalRoomId = originalConfig.roomId;

      const result = await manager.updateMethod('test-comp-123', 'discord');

      assert.notEqual(result.roomId, originalRoomId);
    });

    it('should return existing config if method is the same', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];

      const result = await manager.updateMethod('test-comp-123', 'vdo-ninja');

      assert.equal(result.roomId, originalConfig.roomId);
    });

    it('should preserve createdAt timestamp', async () => {
      const originalConfig = firebaseStore['competitions/test-comp-123/config/talentComms'];
      const originalCreatedAt = originalConfig.createdAt;

      const result = await manager.updateMethod('test-comp-123', 'discord');

      assert.equal(result.createdAt, originalCreatedAt);
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
      const originalRoomId = setupResult.roomId;

      // Regenerate
      const regenResult = await manager.regenerateUrls('test-comp-123');
      assert.notEqual(regenResult.roomId, originalRoomId);

      // Get
      const getResult = await manager.getTalentComms('test-comp-123');
      assert.equal(getResult.roomId, regenResult.roomId);

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
      assert.ok(config.urls.director);

      // Switch to discord
      await manager.updateMethod('test-comp-123', 'discord');

      config = await manager.getTalentComms('test-comp-123');
      assert.equal(config.method, 'discord');

      // Switch back to vdo-ninja
      await manager.updateMethod('test-comp-123', 'vdo-ninja');

      config = await manager.getTalentComms('test-comp-123');
      assert.equal(config.method, 'vdo-ninja');
      assert.ok(config.urls.director);
    });

    it('should handle multiple competitions independently', async () => {
      // Setup for two competitions
      await manager.setupTalentComms('comp-1');
      await manager.setupTalentComms('comp-2');

      const config1 = await manager.getTalentComms('comp-1');
      const config2 = await manager.getTalentComms('comp-2');

      // Should have different room IDs
      assert.notEqual(config1.roomId, config2.roomId);

      // Regenerate one shouldn't affect the other
      await manager.regenerateUrls('comp-1');

      const newConfig1 = await manager.getTalentComms('comp-1');
      const unchangedConfig2 = await manager.getTalentComms('comp-2');

      assert.notEqual(newConfig1.roomId, config1.roomId);
      assert.equal(unchangedConfig2.roomId, config2.roomId);
    });

    it('should handle multiple regenerations', async () => {
      await manager.setupTalentComms('test-comp-123');

      const roomIds = new Set();

      // Regenerate multiple times
      for (let i = 0; i < 5; i++) {
        const result = await manager.regenerateUrls('test-comp-123');
        roomIds.add(result.roomId);
      }

      // All room IDs should be unique
      assert.equal(roomIds.size, 5);
    });
  });
});
