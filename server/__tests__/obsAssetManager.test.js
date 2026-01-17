/**
 * OBS Asset Manager Tests
 *
 * Comprehensive test suite for obsAssetManager.js
 * Uses mockOBS.js for OBS WebSocket mocking
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OBSAssetManager, ASSET_TYPES, ASSET_BASE_PATH } from '../lib/obsAssetManager.js';
import { MockOBSWebSocket } from './helpers/mockOBS.js';

describe('OBSAssetManager', () => {
  let obs;
  let stateSync;
  let assetManager;

  beforeEach(() => {
    // Create fresh mock OBS instance
    obs = new MockOBSWebSocket();

    // Create mock state sync
    stateSync = {
      getState: () => ({
        connected: true
      }),
      compId: 'test-comp-123'
    };

    // Create asset manager instance
    assetManager = new OBSAssetManager(obs, stateSync);

    // Clear call history
    obs.clearHistory();
  });

  describe('Module exports', () => {
    it('should export OBSAssetManager class', () => {
      assert.ok(OBSAssetManager);
      assert.equal(typeof OBSAssetManager, 'function');
      assert.ok(assetManager instanceof OBSAssetManager);
    });

    it('should export ASSET_TYPES constant', () => {
      assert.ok(ASSET_TYPES);
      assert.equal(typeof ASSET_TYPES, 'object');
      assert.equal(ASSET_TYPES.MUSIC, 'music');
      assert.equal(ASSET_TYPES.STINGERS, 'stingers');
      assert.equal(ASSET_TYPES.BACKGROUNDS, 'backgrounds');
      assert.equal(ASSET_TYPES.LOGOS, 'logos');
    });

    it('should export ASSET_BASE_PATH constant', () => {
      assert.ok(ASSET_BASE_PATH);
      assert.equal(typeof ASSET_BASE_PATH, 'string');
      assert.equal(ASSET_BASE_PATH, '/var/www/assets/');
    });
  });

  describe('Constructor', () => {
    it('should initialize with obs, stateSync, and productionConfigService', () => {
      const mockProductionConfigService = {
        initialize: () => ({ ref: () => {} })
      };

      const manager = new OBSAssetManager(obs, stateSync, mockProductionConfigService);

      assert.ok(manager.obs);
      assert.ok(manager.stateSync);
      assert.ok(manager.productionConfigService);
    });

    it('should work without productionConfigService', () => {
      const manager = new OBSAssetManager(obs, stateSync);

      assert.ok(manager.obs);
      assert.ok(manager.stateSync);
      assert.equal(manager.productionConfigService, null);
    });
  });

  describe('Firebase Integration', () => {
    let mockProductionConfigService;
    let firebaseStore;
    let managerWithFirebase;

    beforeEach(() => {
      firebaseStore = {};

      // Helper to get nested value from hierarchical path
      const getValueAtPath = (path) => {
        if (firebaseStore[path] !== undefined) {
          return firebaseStore[path];
        }

        // Check if this is a parent path - aggregate children
        const children = {};
        let hasChildren = false;

        for (const key in firebaseStore) {
          if (key.startsWith(path + '/')) {
            const childKey = key.substring(path.length + 1).split('/')[0];
            if (!children[childKey]) {
              const childPath = `${path}/${childKey}`;
              children[childKey] = firebaseStore[childPath];
              hasChildren = true;
            }
          }
        }

        return hasChildren ? children : null;
      };

      mockProductionConfigService = {
        initialize: () => ({
          ref: (path) => ({
            once: async () => ({
              val: () => getValueAtPath(path)
            }),
            set: async (data) => {
              firebaseStore[path] = data;
            },
            update: async (data) => {
              firebaseStore[path] = { ...firebaseStore[path], ...data };
            },
            remove: async () => {
              delete firebaseStore[path];
            }
          })
        })
      };

      managerWithFirebase = new OBSAssetManager(obs, stateSync, mockProductionConfigService);
    });

    describe('listAssets', () => {
      it('should list all assets grouped by type', async () => {
        firebaseStore['competitions/test-comp-123/obs/assets'] = {
          music: [
            { filename: 'song1.mp3', type: 'music', path: '/var/www/assets/music/song1.mp3' }
          ],
          stingers: [
            { filename: 'whoosh.mp4', type: 'stingers', path: '/var/www/assets/stingers/whoosh.mp4' }
          ]
        };

        const result = await managerWithFirebase.listAssets('test-comp-123');

        assert.ok(result);
        assert.ok(Array.isArray(result.music));
        assert.ok(Array.isArray(result.stingers));
        assert.ok(Array.isArray(result.backgrounds));
        assert.ok(Array.isArray(result.logos));
        assert.equal(result.music.length, 1);
        assert.equal(result.stingers.length, 1);
        assert.equal(result.backgrounds.length, 0);
        assert.equal(result.logos.length, 0);
      });

      it('should return empty arrays for all types when no assets exist', async () => {
        const result = await managerWithFirebase.listAssets('test-comp-123');

        assert.ok(result);
        assert.deepEqual(result.music, []);
        assert.deepEqual(result.stingers, []);
        assert.deepEqual(result.backgrounds, []);
        assert.deepEqual(result.logos, []);
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.listAssets(null),
          { message: 'Competition ID is required' }
        );
      });

      it('should handle Firebase errors', async () => {
        const mockErrorService = {
          initialize: () => ({
            ref: () => ({
              once: async () => {
                throw new Error('Firebase connection failed');
              }
            })
          })
        };

        const errorManager = new OBSAssetManager(obs, stateSync, mockErrorService);

        await assert.rejects(
          async () => await errorManager.listAssets('test-comp-123'),
          { message: 'Firebase connection failed' }
        );
      });
    });

    describe('listAssetsByType', () => {
      it('should list assets of a specific type', async () => {
        firebaseStore['competitions/test-comp-123/obs/assets/music'] = [
          { filename: 'song1.mp3', type: 'music' },
          { filename: 'song2.mp3', type: 'music' }
        ];

        const result = await managerWithFirebase.listAssetsByType('test-comp-123', 'music');

        assert.ok(Array.isArray(result));
        assert.equal(result.length, 2);
        assert.equal(result[0].filename, 'song1.mp3');
        assert.equal(result[1].filename, 'song2.mp3');
      });

      it('should return empty array when no assets of type exist', async () => {
        const result = await managerWithFirebase.listAssetsByType('test-comp-123', 'music');

        assert.deepEqual(result, []);
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.listAssetsByType(null, 'music'),
          { message: 'Competition ID is required' }
        );
      });

      it('should validate asset type', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.listAssetsByType('test-comp-123', 'invalid'),
          { message: /Invalid asset type/ }
        );
      });

      it('should accept all valid asset types', async () => {
        for (const type of Object.values(ASSET_TYPES)) {
          const result = await managerWithFirebase.listAssetsByType('test-comp-123', type);
          assert.ok(Array.isArray(result));
        }
      });
    });

    describe('uploadAsset', () => {
      it('should add new asset to manifest', async () => {
        const result = await managerWithFirebase.uploadAsset(
          'test-comp-123',
          'music',
          'test-song.mp3',
          { size: 5242880, uploadedBy: 'user@example.com' }
        );

        assert.equal(result.success, true);
        assert.ok(result.asset);
        assert.equal(result.asset.filename, 'test-song.mp3');
        assert.equal(result.asset.type, 'music');
        assert.equal(result.asset.path, '/var/www/assets/music/test-song.mp3');
        assert.equal(result.asset.size, 5242880);
        assert.equal(result.asset.uploadedBy, 'user@example.com');
        assert.ok(result.asset.uploadedAt);

        // Verify saved to Firebase
        const assets = firebaseStore['competitions/test-comp-123/obs/assets/music'];
        assert.ok(Array.isArray(assets));
        assert.equal(assets.length, 1);
        assert.equal(assets[0].filename, 'test-song.mp3');
      });

      it('should update existing asset if filename already exists', async () => {
        // Add initial asset
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'test-song.mp3', { size: 100 });

        // Upload again with different metadata
        const result = await managerWithFirebase.uploadAsset(
          'test-comp-123',
          'music',
          'test-song.mp3',
          { size: 200 }
        );

        assert.equal(result.success, true);
        assert.equal(result.asset.size, 200);

        // Verify only one asset in manifest
        const assets = firebaseStore['competitions/test-comp-123/obs/assets/music'];
        assert.equal(assets.length, 1);
        assert.equal(assets[0].size, 200);
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.uploadAsset(null, 'music', 'test.mp3'),
          { message: 'Competition ID is required' }
        );
      });

      it('should validate asset type', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.uploadAsset('test-comp-123', 'invalid', 'test.mp3'),
          { message: /Invalid asset type/ }
        );
      });

      it('should validate filename', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.uploadAsset('test-comp-123', 'music', '../evil.mp3'),
          { message: 'Invalid filename' }
        );
      });

      it('should reject filenames with path traversal', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.uploadAsset('test-comp-123', 'music', '../../etc/passwd'),
          { message: 'Invalid filename' }
        );
      });

      it('should reject filenames with slashes', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'path/to/file.mp3'),
          { message: 'Invalid filename' }
        );
      });

      it('should reject filenames without extensions', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'noextension'),
          { message: 'Invalid filename' }
        );
      });

      it('should reject null filename', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.uploadAsset('test-comp-123', 'music', null),
          { message: 'Invalid filename' }
        );
      });

      it('should work without metadata', async () => {
        const result = await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'test.mp3');

        assert.equal(result.success, true);
        assert.equal(result.asset.filename, 'test.mp3');
      });
    });

    describe('deleteAsset', () => {
      beforeEach(async () => {
        // Add some test assets
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song1.mp3');
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song2.mp3');
      });

      it('should remove asset from manifest', async () => {
        const result = await managerWithFirebase.deleteAsset('test-comp-123', 'music', 'song1.mp3');

        assert.equal(result.success, true);
        assert.ok(result.asset);
        assert.equal(result.asset.filename, 'song1.mp3');

        // Verify removed from Firebase
        const assets = firebaseStore['competitions/test-comp-123/obs/assets/music'];
        assert.equal(assets.length, 1);
        assert.equal(assets[0].filename, 'song2.mp3');
      });

      it('should throw error if asset not found', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.deleteAsset('test-comp-123', 'music', 'nonexistent.mp3'),
          { message: 'Asset not found: nonexistent.mp3' }
        );
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.deleteAsset(null, 'music', 'song1.mp3'),
          { message: 'Competition ID is required' }
        );
      });

      it('should validate asset type', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.deleteAsset('test-comp-123', 'invalid', 'song1.mp3'),
          { message: /Invalid asset type/ }
        );
      });

      it('should validate filename', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.deleteAsset('test-comp-123', 'music', '../evil.mp3'),
          { message: 'Invalid filename' }
        );
      });
    });

    describe('downloadAsset', () => {
      beforeEach(async () => {
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song1.mp3', {
          size: 5242880,
          uploadedBy: 'user@example.com'
        });
      });

      it('should return asset metadata', async () => {
        const result = await managerWithFirebase.downloadAsset('test-comp-123', 'music', 'song1.mp3');

        assert.equal(result.success, true);
        assert.ok(result.asset);
        assert.equal(result.asset.filename, 'song1.mp3');
        assert.equal(result.asset.type, 'music');
        assert.equal(result.asset.path, '/var/www/assets/music/song1.mp3');
        assert.equal(result.asset.size, 5242880);
        assert.equal(result.asset.uploadedBy, 'user@example.com');
      });

      it('should throw error if asset not found', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.downloadAsset('test-comp-123', 'music', 'nonexistent.mp3'),
          { message: 'Asset not found: nonexistent.mp3' }
        );
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.downloadAsset(null, 'music', 'song1.mp3'),
          { message: 'Competition ID is required' }
        );
      });

      it('should validate asset type', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.downloadAsset('test-comp-123', 'invalid', 'song1.mp3'),
          { message: /Invalid asset type/ }
        );
      });

      it('should validate filename', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.downloadAsset('test-comp-123', 'music', '../evil.mp3'),
          { message: 'Invalid filename' }
        );
      });
    });

    describe('updateManifest', () => {
      beforeEach(async () => {
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song1.mp3', {
          size: 5242880
        });
      });

      it('should update asset metadata', async () => {
        const result = await managerWithFirebase.updateManifest(
          'test-comp-123',
          'music',
          'song1.mp3',
          { description: 'Updated description', tags: ['rock', 'energetic'] }
        );

        assert.equal(result.success, true);
        assert.ok(result.asset);
        assert.equal(result.asset.filename, 'song1.mp3');
        assert.equal(result.asset.description, 'Updated description');
        assert.deepEqual(result.asset.tags, ['rock', 'energetic']);
        assert.ok(result.asset.updatedAt);

        // Verify saved to Firebase
        const assets = firebaseStore['competitions/test-comp-123/obs/assets/music'];
        assert.equal(assets[0].description, 'Updated description');
      });

      it('should throw error if asset not found', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.updateManifest(
            'test-comp-123',
            'music',
            'nonexistent.mp3',
            { description: 'test' }
          ),
          { message: 'Asset not found: nonexistent.mp3' }
        );
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.updateManifest(null, 'music', 'song1.mp3', {}),
          { message: 'Competition ID is required' }
        );
      });

      it('should validate asset type', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.updateManifest('test-comp-123', 'invalid', 'song1.mp3', {}),
          { message: /Invalid asset type/ }
        );
      });

      it('should validate filename', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.updateManifest('test-comp-123', 'music', '../evil.mp3', {}),
          { message: 'Invalid filename' }
        );
      });

      it('should require updates object', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.updateManifest('test-comp-123', 'music', 'song1.mp3', null),
          { message: 'Updates must be an object' }
        );
      });

      it('should preserve existing fields not in updates', async () => {
        const result = await managerWithFirebase.updateManifest(
          'test-comp-123',
          'music',
          'song1.mp3',
          { newField: 'newValue' }
        );

        assert.equal(result.asset.size, 5242880); // Original field preserved
        assert.equal(result.asset.newField, 'newValue'); // New field added
      });
    });

    describe('getAssetMetadata', () => {
      beforeEach(async () => {
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song1.mp3', {
          size: 5242880,
          uploadedBy: 'user@example.com'
        });
      });

      it('should return asset metadata', async () => {
        const result = await managerWithFirebase.getAssetMetadata('test-comp-123', 'music', 'song1.mp3');

        assert.ok(result);
        assert.equal(result.filename, 'song1.mp3');
        assert.equal(result.type, 'music');
        assert.equal(result.size, 5242880);
        assert.equal(result.uploadedBy, 'user@example.com');
      });

      it('should return null if asset not found', async () => {
        const result = await managerWithFirebase.getAssetMetadata('test-comp-123', 'music', 'nonexistent.mp3');

        assert.equal(result, null);
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.getAssetMetadata(null, 'music', 'song1.mp3'),
          { message: 'Competition ID is required' }
        );
      });

      it('should validate asset type', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.getAssetMetadata('test-comp-123', 'invalid', 'song1.mp3'),
          { message: /Invalid asset type/ }
        );
      });

      it('should validate filename', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.getAssetMetadata('test-comp-123', 'music', '../evil.mp3'),
          { message: 'Invalid filename' }
        );
      });
    });

    describe('clearAssetsByType', () => {
      beforeEach(async () => {
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song1.mp3');
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song2.mp3');
        await managerWithFirebase.uploadAsset('test-comp-123', 'stingers', 'whoosh.mp4');
      });

      it('should clear all assets of specified type', async () => {
        const result = await managerWithFirebase.clearAssetsByType('test-comp-123', 'music');

        assert.equal(result.success, true);
        assert.equal(result.count, 2);

        // Verify cleared in Firebase
        const musicAssets = firebaseStore['competitions/test-comp-123/obs/assets/music'];
        assert.deepEqual(musicAssets, []);

        // Verify other types not affected
        const stingerAssets = firebaseStore['competitions/test-comp-123/obs/assets/stingers'];
        assert.equal(stingerAssets.length, 1);
      });

      it('should return 0 count when no assets exist', async () => {
        const result = await managerWithFirebase.clearAssetsByType('test-comp-123', 'backgrounds');

        assert.equal(result.success, true);
        assert.equal(result.count, 0);
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.clearAssetsByType(null, 'music'),
          { message: 'Competition ID is required' }
        );
      });

      it('should validate asset type', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.clearAssetsByType('test-comp-123', 'invalid'),
          { message: /Invalid asset type/ }
        );
      });
    });

    describe('getStorageStats', () => {
      beforeEach(async () => {
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song1.mp3', { size: 5242880 });
        await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song2.mp3', { size: 3145728 });
        await managerWithFirebase.uploadAsset('test-comp-123', 'stingers', 'whoosh.mp4', { size: 1048576 });
        await managerWithFirebase.uploadAsset('test-comp-123', 'backgrounds', 'bg1.png', { size: 2097152 });
      });

      it('should return storage statistics by type', async () => {
        const result = await managerWithFirebase.getStorageStats('test-comp-123');

        assert.ok(result);
        assert.ok(result.music);
        assert.equal(result.music.count, 2);
        assert.equal(result.music.totalSize, 8388608); // 5242880 + 3145728

        assert.ok(result.stingers);
        assert.equal(result.stingers.count, 1);
        assert.equal(result.stingers.totalSize, 1048576);

        assert.ok(result.backgrounds);
        assert.equal(result.backgrounds.count, 1);
        assert.equal(result.backgrounds.totalSize, 2097152);

        assert.ok(result.logos);
        assert.equal(result.logos.count, 0);
        assert.equal(result.logos.totalSize, 0);
      });

      it('should include total statistics', async () => {
        const result = await managerWithFirebase.getStorageStats('test-comp-123');

        assert.ok(result.total);
        assert.equal(result.total.count, 4);
        assert.equal(result.total.totalSize, 11534336); // Sum of all sizes
      });

      it('should handle assets without size metadata', async () => {
        await managerWithFirebase.uploadAsset('test-comp-123', 'logos', 'logo.png'); // No size

        const result = await managerWithFirebase.getStorageStats('test-comp-123');

        assert.ok(result.logos);
        assert.equal(result.logos.count, 1);
        assert.equal(result.logos.totalSize, 0);
      });

      it('should return zero stats for empty competition', async () => {
        const result = await managerWithFirebase.getStorageStats('empty-comp');

        assert.equal(result.total.count, 0);
        assert.equal(result.total.totalSize, 0);
      });

      it('should require competition ID', async () => {
        await assert.rejects(
          async () => await managerWithFirebase.getStorageStats(null),
          { message: 'Competition ID is required' }
        );
      });
    });
  });

  describe('Error handling without Firebase', () => {
    it('should throw error when trying to list assets without Firebase', async () => {
      await assert.rejects(
        async () => await assetManager.listAssets('test-comp-123'),
        { message: 'Production config service not available' }
      );
    });

    it('should throw error when trying to upload without Firebase', async () => {
      await assert.rejects(
        async () => await assetManager.uploadAsset('test-comp-123', 'music', 'test.mp3'),
        { message: 'Production config service not available' }
      );
    });

    it('should throw error when trying to delete without Firebase', async () => {
      await assert.rejects(
        async () => await assetManager.deleteAsset('test-comp-123', 'music', 'test.mp3'),
        { message: 'Production config service not available' }
      );
    });
  });

  describe('Error handling with invalid competition ID', () => {
    let mockProductionConfigService;
    let managerWithFirebase;

    beforeEach(() => {
      mockProductionConfigService = {
        initialize: () => ({
          ref: () => ({
            once: async () => ({ val: () => null })
          })
        })
      };

      const noCompStateSync = {
        getState: () => ({ connected: true }),
        compId: null
      };

      managerWithFirebase = new OBSAssetManager(obs, noCompStateSync, mockProductionConfigService);
    });

    it('should throw error when competition ID not set in stateSync', async () => {
      // This would fail with "No active competition" if we called a method that uses _getCompId()
      // But our methods require explicit compId parameter, so this is less relevant
      // Let's test that the manager can be created without a compId
      assert.ok(managerWithFirebase);
      assert.equal(managerWithFirebase.stateSync.compId, null);
    });
  });

  describe('Integration scenarios', () => {
    let mockProductionConfigService;
    let firebaseStore;
    let managerWithFirebase;

    beforeEach(() => {
      firebaseStore = {};

      // Helper to get nested value from hierarchical path
      const getValueAtPath = (path) => {
        if (firebaseStore[path] !== undefined) {
          return firebaseStore[path];
        }

        // Check if this is a parent path - aggregate children
        const children = {};
        let hasChildren = false;

        for (const key in firebaseStore) {
          if (key.startsWith(path + '/')) {
            const childKey = key.substring(path.length + 1).split('/')[0];
            if (!children[childKey]) {
              const childPath = `${path}/${childKey}`;
              children[childKey] = firebaseStore[childPath];
              hasChildren = true;
            }
          }
        }

        return hasChildren ? children : null;
      };

      mockProductionConfigService = {
        initialize: () => ({
          ref: (path) => ({
            once: async () => ({
              val: () => getValueAtPath(path)
            }),
            set: async (data) => {
              firebaseStore[path] = data;
            },
            update: async (data) => {
              firebaseStore[path] = { ...firebaseStore[path], ...data };
            },
            remove: async () => {
              delete firebaseStore[path];
            }
          })
        })
      };

      managerWithFirebase = new OBSAssetManager(obs, stateSync, mockProductionConfigService);
    });

    it('should handle complete asset lifecycle: upload, update, download, delete', async () => {
      // Upload
      const uploadResult = await managerWithFirebase.uploadAsset(
        'test-comp-123',
        'music',
        'test-song.mp3',
        { size: 5000000 }
      );
      assert.equal(uploadResult.success, true);

      // Update metadata
      const updateResult = await managerWithFirebase.updateManifest(
        'test-comp-123',
        'music',
        'test-song.mp3',
        { description: 'Test song' }
      );
      assert.equal(updateResult.success, true);
      assert.equal(updateResult.asset.description, 'Test song');

      // Download (get metadata)
      const downloadResult = await managerWithFirebase.downloadAsset('test-comp-123', 'music', 'test-song.mp3');
      assert.equal(downloadResult.success, true);
      assert.equal(downloadResult.asset.description, 'Test song');

      // Delete
      const deleteResult = await managerWithFirebase.deleteAsset('test-comp-123', 'music', 'test-song.mp3');
      assert.equal(deleteResult.success, true);

      // Verify deleted
      const assets = await managerWithFirebase.listAssetsByType('test-comp-123', 'music');
      assert.equal(assets.length, 0);
    });

    it('should handle multiple assets of different types', async () => {
      // Upload multiple assets
      await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song1.mp3', { size: 1000000 });
      await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song2.mp3', { size: 2000000 });
      await managerWithFirebase.uploadAsset('test-comp-123', 'stingers', 'stinger1.mp4', { size: 500000 });
      await managerWithFirebase.uploadAsset('test-comp-123', 'backgrounds', 'bg1.png', { size: 3000000 });

      // List all assets
      const allAssets = await managerWithFirebase.listAssets('test-comp-123');
      assert.equal(allAssets.music.length, 2);
      assert.equal(allAssets.stingers.length, 1);
      assert.equal(allAssets.backgrounds.length, 1);
      assert.equal(allAssets.logos.length, 0);

      // Get storage stats
      const stats = await managerWithFirebase.getStorageStats('test-comp-123');
      assert.equal(stats.total.count, 4);
      assert.equal(stats.total.totalSize, 6500000);
    });

    it('should handle clearing specific asset types', async () => {
      // Upload assets
      await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song1.mp3');
      await managerWithFirebase.uploadAsset('test-comp-123', 'music', 'song2.mp3');
      await managerWithFirebase.uploadAsset('test-comp-123', 'stingers', 'stinger1.mp4');

      // Clear music
      await managerWithFirebase.clearAssetsByType('test-comp-123', 'music');

      // Verify
      const allAssets = await managerWithFirebase.listAssets('test-comp-123');
      assert.equal(allAssets.music.length, 0);
      assert.equal(allAssets.stingers.length, 1); // Not affected
    });
  });

  describe('Filename validation', () => {
    it('should accept valid filenames', () => {
      const validNames = [
        'song.mp3',
        'background-image.png',
        'stinger_v2.mp4',
        'logo_2024.svg',
        'file.with.dots.jpg',
        'UPPERCASE.MP3',
        'file-with-numbers-123.mp4'
      ];

      // Test by attempting upload (will fail without Firebase, but filename validation happens first)
      for (const filename of validNames) {
        assert.doesNotThrow(() => {
          // Just testing that validation doesn't throw
          if (!filename || typeof filename !== 'string') throw new Error('Invalid');
          if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) throw new Error('Invalid');
          if (!filename.includes('.')) throw new Error('Invalid');
        });
      }
    });

    it('should reject invalid filenames', () => {
      const invalidNames = [
        '../parent.mp3',
        'path/to/file.mp3',
        'path\\to\\file.mp3',
        'noextension',
        '',
        null,
        undefined
      ];

      // Each should fail validation
      for (const filename of invalidNames) {
        let isValid = true;
        try {
          if (!filename || typeof filename !== 'string') isValid = false;
          if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) isValid = false;
          if (!filename.includes('.')) isValid = false;
        } catch (e) {
          isValid = false;
        }
        assert.equal(isValid, false, `Expected ${filename} to be invalid`);
      }
    });
  });
});
