/**
 * OBS Stream Manager Tests
 *
 * Comprehensive test suite for obsStreamManager.js
 * Uses mockOBS.js for OBS WebSocket mocking
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OBSStreamManager, encryptStreamKey, decryptStreamKey, maskStreamKey } from '../lib/obsStreamManager.js';
import { MockOBSWebSocket } from './helpers/mockOBS.js';

describe('OBSStreamManager', () => {
  let obs;
  let stateSync;
  let streamManager;

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

    // Create stream manager instance
    streamManager = new OBSStreamManager(obs, stateSync);

    // Clear call history
    obs.clearHistory();
  });

  describe('Module exports', () => {
    it('should export OBSStreamManager class', () => {
      assert.ok(OBSStreamManager);
      assert.equal(typeof OBSStreamManager, 'function');
      assert.ok(streamManager instanceof OBSStreamManager);
    });

    it('should export encryption functions', () => {
      assert.ok(encryptStreamKey);
      assert.equal(typeof encryptStreamKey, 'function');
      assert.ok(decryptStreamKey);
      assert.equal(typeof decryptStreamKey, 'function');
      assert.ok(maskStreamKey);
      assert.equal(typeof maskStreamKey, 'function');
    });
  });

  describe('Encryption utilities', () => {
    describe('encryptStreamKey', () => {
      it('should encrypt a stream key', () => {
        const plainKey = 'my-secret-stream-key-12345';
        const encrypted = encryptStreamKey(plainKey);

        assert.ok(encrypted);
        assert.equal(typeof encrypted, 'string');
        assert.notEqual(encrypted, plainKey);
        assert.ok(encrypted.includes(':'), 'Should contain IV separator');
      });

      it('should return different ciphertext each time due to random IV', () => {
        const plainKey = 'my-secret-stream-key-12345';
        const encrypted1 = encryptStreamKey(plainKey);
        const encrypted2 = encryptStreamKey(plainKey);

        assert.notEqual(encrypted1, encrypted2, 'Each encryption should produce different result');
      });

      it('should handle null input', () => {
        const result = encryptStreamKey(null);
        assert.equal(result, null);
      });

      it('should handle empty string input', () => {
        const result = encryptStreamKey('');
        assert.equal(result, null);
      });
    });

    describe('decryptStreamKey', () => {
      it('should decrypt an encrypted key', () => {
        const plainKey = 'my-secret-stream-key-12345';
        const encrypted = encryptStreamKey(plainKey);
        const decrypted = decryptStreamKey(encrypted);

        assert.equal(decrypted, plainKey);
      });

      it('should handle invalid format', () => {
        assert.throws(() => {
          decryptStreamKey('invalid-format-no-separator');
        }, { message: 'Invalid encrypted key format' });
      });

      it('should handle null input', () => {
        const result = decryptStreamKey(null);
        assert.equal(result, null);
      });

      it('should handle empty string input', () => {
        const result = decryptStreamKey('');
        assert.equal(result, null);
      });
    });

    describe('maskStreamKey', () => {
      it('should mask most of the key, leaving last 4 chars', () => {
        const key = 'abcdefgh1234';
        const masked = maskStreamKey(key);

        assert.equal(masked, '****1234');
      });

      it('should handle short keys', () => {
        const key = 'abc';
        const masked = maskStreamKey(key);

        assert.equal(masked, '****');
      });

      it('should handle null input', () => {
        const masked = maskStreamKey(null);
        assert.equal(masked, '****');
      });

      it('should handle empty string', () => {
        const masked = maskStreamKey('');
        assert.equal(masked, '****');
      });
    });
  });

  describe('getStreamSettings', () => {
    it('should return stream settings with masked key', async () => {
      const result = await streamManager.getStreamSettings();

      assert.ok(result);
      assert.ok(result.serviceType);
      assert.ok(result.settings);
      assert.equal(typeof result.serviceType, 'string');
      assert.equal(typeof result.settings, 'object');

      // Key should be masked
      assert.ok(result.settings.key);
      assert.ok(result.settings.key.startsWith('****'));

      // Verify OBS call
      const calls = obs.getCallsTo('GetStreamServiceSettings');
      assert.equal(calls.length, 1);
    });

    it('should return service type', async () => {
      const result = await streamManager.getStreamSettings();

      assert.equal(result.serviceType, 'rtmp_common');
    });

    it('should handle OBS errors', async () => {
      const error = new Error('Failed to get stream settings');
      obs.injectErrorOnMethod('GetStreamServiceSettings', error);

      await assert.rejects(
        async () => await streamManager.getStreamSettings(),
        { message: 'Failed to get stream settings' }
      );
    });

    it('should handle empty settings', async () => {
      // Configure OBS to return minimal settings
      obs.setStreamSettings('rtmp_custom', {});

      const result = await streamManager.getStreamSettings();

      assert.ok(result);
      assert.equal(result.serviceType, 'rtmp_custom');
      assert.equal(typeof result.settings, 'object');
    });
  });

  describe('setStreamSettings', () => {
    it('should set stream settings in OBS', async () => {
      const settings = {
        serviceType: 'rtmp_custom',
        settings: {
          server: 'rtmp://my-server.com/live',
          key: 'new-stream-key-xyz789'
        }
      };

      const result = await streamManager.setStreamSettings(settings, false);

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetStreamServiceSettings');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.streamServiceType, 'rtmp_custom');
      assert.equal(calls[0].params.streamServiceSettings.server, 'rtmp://my-server.com/live');
      assert.equal(calls[0].params.streamServiceSettings.key, 'new-stream-key-xyz789');
    });

    it('should require settings object', async () => {
      await assert.rejects(
        async () => await streamManager.setStreamSettings(null),
        { message: 'Settings must be an object' }
      );
    });

    it('should require service type', async () => {
      const settings = {
        settings: {
          server: 'rtmp://my-server.com/live',
          key: 'test-key'
        }
      };

      await assert.rejects(
        async () => await streamManager.setStreamSettings(settings),
        { message: 'Service type is required' }
      );
    });

    it('should save encrypted key to Firebase when storeEncrypted is true', async () => {
      // Create mock Firebase
      const firebaseStore = {};
      const mockProductionConfigService = {
        initialize: () => ({
          ref: (path) => ({
            update: async (data) => {
              firebaseStore[path] = { ...firebaseStore[path], ...data };
            }
          })
        })
      };

      const managerWithFirebase = new OBSStreamManager(obs, stateSync, mockProductionConfigService);

      const settings = {
        serviceType: 'rtmp_custom',
        settings: {
          server: 'rtmp://my-server.com/live',
          key: 'secret-key-abc123'
        }
      };

      obs.clearHistory();

      const result = await managerWithFirebase.setStreamSettings(settings, true);

      assert.equal(result.success, true);

      // Verify Firebase save
      assert.ok(firebaseStore['competitions/test-comp-123/obs/streamConfig']);
      assert.ok(firebaseStore['competitions/test-comp-123/obs/streamConfig'].streamKeyEncrypted);
      assert.ok(firebaseStore['competitions/test-comp-123/obs/streamConfig'].lastUpdated);
    });

    it('should not save to Firebase when storeEncrypted is false', async () => {
      const firebaseStore = {};
      const mockProductionConfigService = {
        initialize: () => ({
          ref: (path) => ({
            update: async (data) => {
              firebaseStore[path] = data;
            }
          })
        })
      };

      const managerWithFirebase = new OBSStreamManager(obs, stateSync, mockProductionConfigService);

      const settings = {
        serviceType: 'rtmp_custom',
        settings: {
          server: 'rtmp://my-server.com/live',
          key: 'secret-key-abc123'
        }
      };

      const result = await managerWithFirebase.setStreamSettings(settings, false);

      assert.equal(result.success, true);

      // Verify Firebase was not touched
      assert.equal(Object.keys(firebaseStore).length, 0);
    });

    it('should handle OBS errors', async () => {
      const error = new Error('Failed to set stream settings');
      obs.injectErrorOnMethod('SetStreamServiceSettings', error);

      const settings = {
        serviceType: 'rtmp_custom',
        settings: {
          server: 'rtmp://my-server.com/live',
          key: 'test-key'
        }
      };

      await assert.rejects(
        async () => await streamManager.setStreamSettings(settings),
        { message: 'Failed to set stream settings' }
      );
    });
  });

  describe('startStream', () => {
    it('should start streaming', async () => {
      const result = await streamManager.startStream();

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('StartStream');
      assert.equal(calls.length, 1);
    });

    it('should handle OBS errors', async () => {
      const error = new Error('Failed to start stream');
      obs.injectErrorOnMethod('StartStream', error);

      await assert.rejects(
        async () => await streamManager.startStream(),
        { message: 'Failed to start stream' }
      );
    });

    it('should return success', async () => {
      const result = await streamManager.startStream();

      assert.ok(result);
      assert.equal(result.success, true);
    });

    it('should call correct OBS method', async () => {
      obs.clearHistory();

      await streamManager.startStream();

      const calls = obs.getCallsTo('StartStream');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, 'StartStream');
    });
  });

  describe('stopStream', () => {
    it('should stop streaming', async () => {
      const result = await streamManager.stopStream();

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('StopStream');
      assert.equal(calls.length, 1);
    });

    it('should handle OBS errors', async () => {
      const error = new Error('Failed to stop stream');
      obs.injectErrorOnMethod('StopStream', error);

      await assert.rejects(
        async () => await streamManager.stopStream(),
        { message: 'Failed to stop stream' }
      );
    });

    it('should return success', async () => {
      const result = await streamManager.stopStream();

      assert.ok(result);
      assert.equal(result.success, true);
    });

    it('should call correct OBS method', async () => {
      obs.clearHistory();

      await streamManager.stopStream();

      const calls = obs.getCallsTo('StopStream');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, 'StopStream');
    });
  });

  describe('getStreamStatus', () => {
    it('should return stream status when streaming', async () => {
      // Start stream first
      await obs.call('StartStream');

      const result = await streamManager.getStreamStatus();

      assert.ok(result);
      assert.equal(result.active, true);
      assert.equal(typeof result.reconnecting, 'boolean');
      assert.equal(typeof result.timecode, 'string');
      assert.equal(typeof result.duration, 'number');
      assert.equal(typeof result.bytes, 'number');

      // Verify OBS call
      const calls = obs.getCallsTo('GetStreamStatus');
      assert.equal(calls.length, 1);
    });

    it('should return stream status when not streaming', async () => {
      const result = await streamManager.getStreamStatus();

      assert.ok(result);
      assert.equal(result.active, false);
      assert.equal(result.reconnecting, false);
      assert.equal(result.timecode, '00:00:00.000');
      assert.equal(result.duration, 0);
      assert.equal(result.bytes, 0);
    });

    it('should include all statistics fields', async () => {
      await obs.call('StartStream');

      const result = await streamManager.getStreamStatus();

      assert.ok('active' in result);
      assert.ok('reconnecting' in result);
      assert.ok('timecode' in result);
      assert.ok('duration' in result);
      assert.ok('bytes' in result);
      assert.ok('skippedFrames' in result);
      assert.ok('totalFrames' in result);
    });

    it('should handle OBS errors', async () => {
      const error = new Error('Failed to get stream status');
      obs.injectErrorOnMethod('GetStreamStatus', error);

      await assert.rejects(
        async () => await streamManager.getStreamStatus(),
        { message: 'Failed to get stream status' }
      );
    });

    it('should handle missing fields', async () => {
      // Mock will return some default values
      const result = await streamManager.getStreamStatus();

      // Should have default values for missing fields
      assert.equal(typeof result.skippedFrames, 'number');
      assert.equal(typeof result.totalFrames, 'number');
    });
  });

  describe('Firebase Integration', () => {
    let mockProductionConfigService;
    let firebaseStore;
    let managerWithFirebase;

    beforeEach(() => {
      firebaseStore = {};

      mockProductionConfigService = {
        initialize: () => ({
          ref: (path) => ({
            once: async () => ({
              val: () => firebaseStore[path] || null
            }),
            update: async (data) => {
              firebaseStore[path] = { ...firebaseStore[path], ...data };
            },
            remove: async () => {
              delete firebaseStore[path];
            }
          })
        })
      };

      managerWithFirebase = new OBSStreamManager(obs, stateSync, mockProductionConfigService);
    });

    describe('loadStreamKeyFromFirebase', () => {
      it('should load and decrypt key', async () => {
        const plainKey = 'my-secret-stream-key-12345';
        const encrypted = encryptStreamKey(plainKey);

        firebaseStore['competitions/test-comp-123/obs/streamConfig'] = {
          streamKeyEncrypted: encrypted,
          lastUpdated: new Date().toISOString()
        };

        const loaded = await managerWithFirebase.loadStreamKeyFromFirebase();

        assert.equal(loaded, plainKey);
      });

      it('should return null when no key exists', async () => {
        const loaded = await managerWithFirebase.loadStreamKeyFromFirebase();

        assert.equal(loaded, null);
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

        const errorManager = new OBSStreamManager(obs, stateSync, mockErrorService);

        await assert.rejects(
          async () => await errorManager.loadStreamKeyFromFirebase(),
          { message: 'Firebase connection failed' }
        );
      });
    });

    describe('deleteStreamKeyFromFirebase', () => {
      it('should delete the key', async () => {
        const plainKey = 'my-secret-stream-key-12345';
        const encrypted = encryptStreamKey(plainKey);

        firebaseStore['competitions/test-comp-123/obs/streamConfig'] = {
          streamKeyEncrypted: encrypted,
          lastUpdated: new Date().toISOString()
        };

        const result = await managerWithFirebase.deleteStreamKeyFromFirebase();

        assert.equal(result, true);
        assert.equal(firebaseStore['competitions/test-comp-123/obs/streamConfig/streamKeyEncrypted'], undefined);
      });
    });

    describe('_saveStreamKeyToFirebase', () => {
      it('should encrypt and save', async () => {
        const plainKey = 'my-secret-stream-key-12345';

        await managerWithFirebase._saveStreamKeyToFirebase(plainKey);

        assert.ok(firebaseStore['competitions/test-comp-123/obs/streamConfig']);
        assert.ok(firebaseStore['competitions/test-comp-123/obs/streamConfig'].streamKeyEncrypted);
        assert.ok(firebaseStore['competitions/test-comp-123/obs/streamConfig'].lastUpdated);

        // Verify we can decrypt it back
        const decrypted = decryptStreamKey(
          firebaseStore['competitions/test-comp-123/obs/streamConfig'].streamKeyEncrypted
        );
        assert.equal(decrypted, plainKey);
      });
    });

    it('should require productionConfigService for Firebase operations', async () => {
      await assert.rejects(
        async () => await streamManager.loadStreamKeyFromFirebase(),
        { message: 'Production config service not available' }
      );
    });

    it('should require active competition', async () => {
      const noCompStateSync = {
        getState: () => ({ connected: true }),
        compId: null
      };

      const noCompManager = new OBSStreamManager(obs, noCompStateSync, mockProductionConfigService);

      await assert.rejects(
        async () => await noCompManager.loadStreamKeyFromFirebase(),
        { message: 'No active competition' }
      );
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors', async () => {
      obs.injectErrorOnMethod('GetStreamStatus', new Error('Connection closed'));

      await assert.rejects(
        async () => await streamManager.getStreamStatus(),
        { message: 'Connection closed' }
      );
    });

    it('should handle timeout errors', async () => {
      obs.injectErrorOnMethod('StartStream', new Error('Request timeout'));

      await assert.rejects(
        async () => await streamManager.startStream(),
        { message: 'Request timeout' }
      );
    });

    it('should handle network errors during operations', async () => {
      obs.injectErrorOnMethod('SetStreamServiceSettings', new Error('Network error'));

      const settings = {
        serviceType: 'rtmp_custom',
        settings: { server: 'rtmp://test.com', key: 'test' }
      };

      await assert.rejects(
        async () => await streamManager.setStreamSettings(settings),
        { message: 'Network error' }
      );
    });
  });

  describe('Integration', () => {
    it('should work with empty state', async () => {
      const emptyStateSync = {
        getState: () => ({}),
        compId: 'test-comp'
      };

      const manager = new OBSStreamManager(obs, emptyStateSync);

      // Should still be able to call methods
      const result = await manager.getStreamSettings();
      assert.ok(result);
    });

    it('should handle null stateSync gracefully', async () => {
      const nullStateSync = null;

      const manager = new OBSStreamManager(obs, nullStateSync);

      // Should still be able to call OBS methods
      const result = await manager.getStreamSettings();
      assert.ok(result);
    });

    it('should complete stream workflow: set settings, start, status, stop', async () => {
      // Set stream settings
      const settings = {
        serviceType: 'rtmp_custom',
        settings: {
          server: 'rtmp://my-server.com/live',
          key: 'stream-key-xyz'
        }
      };
      const setResult = await streamManager.setStreamSettings(settings, false);
      assert.equal(setResult.success, true);

      // Start stream
      const startResult = await streamManager.startStream();
      assert.equal(startResult.success, true);

      // Get status
      const status = await streamManager.getStreamStatus();
      assert.equal(status.active, true);

      // Stop stream
      const stopResult = await streamManager.stopStream();
      assert.equal(stopResult.success, true);

      // Verify final status
      const finalStatus = await streamManager.getStreamStatus();
      assert.equal(finalStatus.active, false);

      // Verify all calls were made
      assert.equal(obs.getCallsTo('SetStreamServiceSettings').length, 1);
      assert.equal(obs.getCallsTo('StartStream').length, 1);
      assert.equal(obs.getCallsTo('GetStreamStatus').length, 2);
      assert.equal(obs.getCallsTo('StopStream').length, 1);
    });

    it('should handle rapid start/stop operations', async () => {
      await streamManager.startStream();
      await streamManager.stopStream();
      await streamManager.startStream();
      await streamManager.stopStream();

      const calls = obs.getCallsTo('StartStream');
      assert.equal(calls.length, 2);

      const stopCalls = obs.getCallsTo('StopStream');
      assert.equal(stopCalls.length, 2);
    });
  });
});
