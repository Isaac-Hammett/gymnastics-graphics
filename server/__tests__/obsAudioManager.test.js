/**
 * OBS Audio Manager Tests
 *
 * Comprehensive test suite for obsAudioManager.js
 * Uses mockOBS.js for OBS WebSocket mocking
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OBSAudioManager, DEFAULT_PRESETS } from '../lib/obsAudioManager.js';
import { MockOBSWebSocket } from './helpers/mockOBS.js';

describe('OBSAudioManager', () => {
  let obs;
  let stateSync;
  let audioManager;

  beforeEach(() => {
    // Create fresh mock OBS instance
    obs = new MockOBSWebSocket();

    // Add some test audio sources
    obs.addAudioSource('Microphone', -10, false, 'OBS_MONITORING_TYPE_NONE');
    obs.addAudioSource('Desktop Audio', 0, false, 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT');
    obs.addAudioSource('Music', -20, true, 'OBS_MONITORING_TYPE_MONITOR_ONLY');

    // Create mock state sync with cached audio sources
    stateSync = {
      getState: () => ({
        connected: true,
        audioSources: [
          { inputName: 'Microphone', volumeDb: -10, volumeMul: 0.316, muted: false, monitorType: 'OBS_MONITORING_TYPE_NONE' },
          { inputName: 'Desktop Audio', volumeDb: 0, volumeMul: 1.0, muted: false, monitorType: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT' },
          { inputName: 'Music', volumeDb: -20, volumeMul: 0.1, muted: true, monitorType: 'OBS_MONITORING_TYPE_MONITOR_ONLY' }
        ]
      })
    };

    // Create audio manager instance
    audioManager = new OBSAudioManager(obs, stateSync);

    // Clear call history
    obs.clearHistory();
  });

  describe('Module exports', () => {
    it('should export OBSAudioManager class', () => {
      assert.ok(OBSAudioManager);
      assert.equal(typeof OBSAudioManager, 'function');
      assert.ok(audioManager instanceof OBSAudioManager);
    });
  });

  describe('getAudioSources', () => {
    it('should return cached audio sources from stateSync', () => {
      const sources = audioManager.getAudioSources();

      assert.ok(Array.isArray(sources));
      assert.equal(sources.length, 3);
      assert.equal(sources[0].inputName, 'Microphone');
      assert.equal(sources[0].volumeDb, -10);
      assert.equal(sources[0].muted, false);
      assert.equal(sources[1].inputName, 'Desktop Audio');
      assert.equal(sources[1].volumeDb, 0);
      assert.equal(sources[2].inputName, 'Music');
      assert.equal(sources[2].muted, true);
    });

    it('should return empty array when no audio sources in state', () => {
      stateSync.getState = () => ({ audioSources: [] });

      const sources = audioManager.getAudioSources();

      assert.deepEqual(sources, []);
    });

    it('should return empty array when audioSources is undefined', () => {
      stateSync.getState = () => ({});

      const sources = audioManager.getAudioSources();

      assert.deepEqual(sources, []);
    });
  });

  describe('getVolume', () => {
    it('should return volume data for existing input', async () => {
      const result = await audioManager.getVolume('Microphone');

      assert.ok(result);
      assert.equal(typeof result.volumeDb, 'number');
      assert.equal(typeof result.volumeMul, 'number');
      assert.equal(result.volumeDb, -10);

      // Verify OBS call
      const calls = obs.getCallsTo('GetInputVolume');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Microphone');
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await audioManager.getVolume(''),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when inputName is null', async () => {
      await assert.rejects(
        async () => await audioManager.getVolume(null),
        { message: 'Input name is required' }
      );
    });

    it('should handle OBS errors when getting volume', async () => {
      const error = new Error('Input not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('GetInputVolume', error);

      await assert.rejects(
        async () => await audioManager.getVolume('Unknown'),
        { message: 'Input not found: Unknown' }
      );
    });
  });

  describe('setVolume', () => {
    it('should set volume by decibels', async () => {
      const result = await audioManager.setVolume('Microphone', -5);

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputVolume');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Microphone');
      assert.equal(calls[0].params.inputVolumeDb, -5);
      assert.equal(calls[0].params.inputVolumeMul, undefined);
    });

    it('should set volume by multiplier', async () => {
      const result = await audioManager.setVolume('Microphone', undefined, 0.5);

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputVolume');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Microphone');
      assert.equal(calls[0].params.inputVolumeDb, undefined);
      assert.equal(calls[0].params.inputVolumeMul, 0.5);
    });

    it('should set volume with both dB and multiplier', async () => {
      const result = await audioManager.setVolume('Microphone', -10, 0.316);

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputVolume');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputVolumeDb, -10);
      assert.equal(calls[0].params.inputVolumeMul, 0.316);
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await audioManager.setVolume('', -5),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when neither volumeDb nor volumeMul provided', async () => {
      await assert.rejects(
        async () => await audioManager.setVolume('Microphone'),
        { message: 'Either volumeDb or volumeMul is required' }
      );
    });

    it('should handle OBS errors when setting volume', async () => {
      const error = new Error('Input not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('SetInputVolume', error);

      await assert.rejects(
        async () => await audioManager.setVolume('Unknown', -5),
        { message: 'Input not found: Unknown' }
      );
    });
  });

  describe('getMute', () => {
    it('should return mute state for existing input', async () => {
      const result = await audioManager.getMute('Music');

      assert.ok(result);
      assert.equal(typeof result.muted, 'boolean');
      assert.equal(result.muted, true);

      // Verify OBS call
      const calls = obs.getCallsTo('GetInputMute');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Music');
    });

    it('should return false for unmuted input', async () => {
      const result = await audioManager.getMute('Microphone');

      assert.equal(result.muted, false);
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await audioManager.getMute(''),
        { message: 'Input name is required' }
      );
    });

    it('should handle OBS errors when getting mute state', async () => {
      const error = new Error('Input not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('GetInputMute', error);

      await assert.rejects(
        async () => await audioManager.getMute('Unknown'),
        { message: 'Input not found: Unknown' }
      );
    });
  });

  describe('setMute', () => {
    it('should mute an input', async () => {
      const result = await audioManager.setMute('Microphone', true);

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputMute');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Microphone');
      assert.equal(calls[0].params.inputMuted, true);
    });

    it('should unmute an input', async () => {
      const result = await audioManager.setMute('Music', false);

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputMute');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Music');
      assert.equal(calls[0].params.inputMuted, false);
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await audioManager.setMute('', true),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when muted is not boolean', async () => {
      await assert.rejects(
        async () => await audioManager.setMute('Microphone', 'true'),
        { message: 'Muted must be a boolean' }
      );
    });

    it('should handle OBS errors when setting mute state', async () => {
      const error = new Error('Input not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('SetInputMute', error);

      await assert.rejects(
        async () => await audioManager.setMute('Unknown', true),
        { message: 'Input not found: Unknown' }
      );
    });
  });

  describe('getMonitorType', () => {
    it('should return monitor type for existing input', async () => {
      const result = await audioManager.getMonitorType('Desktop Audio');

      assert.ok(result);
      assert.equal(typeof result.monitorType, 'string');
      assert.equal(result.monitorType, 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT');

      // Verify OBS call
      const calls = obs.getCallsTo('GetInputAudioMonitorType');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Desktop Audio');
    });

    it('should return NONE for input with no monitoring', async () => {
      const result = await audioManager.getMonitorType('Microphone');

      assert.equal(result.monitorType, 'OBS_MONITORING_TYPE_NONE');
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await audioManager.getMonitorType(''),
        { message: 'Input name is required' }
      );
    });

    it('should handle OBS errors when getting monitor type', async () => {
      const error = new Error('Input not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('GetInputAudioMonitorType', error);

      await assert.rejects(
        async () => await audioManager.getMonitorType('Unknown'),
        { message: 'Input not found: Unknown' }
      );
    });
  });

  describe('setMonitorType', () => {
    it('should set monitor type to NONE', async () => {
      const result = await audioManager.setMonitorType('Desktop Audio', 'OBS_MONITORING_TYPE_NONE');

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputAudioMonitorType');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Desktop Audio');
      assert.equal(calls[0].params.monitorType, 'OBS_MONITORING_TYPE_NONE');
    });

    it('should set monitor type to MONITOR_ONLY', async () => {
      const result = await audioManager.setMonitorType('Microphone', 'OBS_MONITORING_TYPE_MONITOR_ONLY');

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputAudioMonitorType');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.monitorType, 'OBS_MONITORING_TYPE_MONITOR_ONLY');
    });

    it('should set monitor type to MONITOR_AND_OUTPUT', async () => {
      const result = await audioManager.setMonitorType('Microphone', 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT');

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputAudioMonitorType');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.monitorType, 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT');
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await audioManager.setMonitorType('', 'OBS_MONITORING_TYPE_NONE'),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when monitorType is missing', async () => {
      await assert.rejects(
        async () => await audioManager.setMonitorType('Microphone', ''),
        { message: 'Monitor type is required' }
      );
    });

    it('should throw error for invalid monitor type', async () => {
      await assert.rejects(
        async () => await audioManager.setMonitorType('Microphone', 'INVALID_TYPE'),
        { message: /Invalid monitor type/ }
      );
    });

    it('should handle OBS errors when setting monitor type', async () => {
      const error = new Error('Input not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('SetInputAudioMonitorType', error);

      await assert.rejects(
        async () => await audioManager.setMonitorType('Unknown', 'OBS_MONITORING_TYPE_NONE'),
        { message: 'Input not found: Unknown' }
      );
    });
  });

  describe('Error handling', () => {
    it('should handle OBS connection errors gracefully', async () => {
      obs.injectErrorOnMethod('GetInputVolume', new Error('Connection closed'));

      await assert.rejects(
        async () => await audioManager.getVolume('Microphone'),
        { message: 'Connection closed' }
      );
    });

    it('should handle OBS timeout errors', async () => {
      obs.injectErrorOnMethod('SetInputMute', new Error('Request timeout'));

      await assert.rejects(
        async () => await audioManager.setMute('Microphone', true),
        { message: 'Request timeout' }
      );
    });

    it('should handle network errors during operations', async () => {
      obs.injectErrorOnMethod('SetInputAudioMonitorType', new Error('Network error'));

      await assert.rejects(
        async () => await audioManager.setMonitorType('Microphone', 'OBS_MONITORING_TYPE_NONE'),
        { message: 'Network error' }
      );
    });
  });

  describe('Integration', () => {
    it('should work with empty state sync', () => {
      stateSync.getState = () => ({ audioSources: [] });

      const sources = audioManager.getAudioSources();

      assert.deepEqual(sources, []);
    });

    it('should handle null state gracefully', () => {
      const nullStateSync = {
        getState: () => null
      };
      const manager = new OBSAudioManager(obs, nullStateSync);

      assert.throws(() => manager.getAudioSources());
    });

    it('should handle missing audioSources property in state', () => {
      stateSync.getState = () => ({ connected: true });

      const sources = audioManager.getAudioSources();

      assert.deepEqual(sources, []);
    });

    it('should handle complete workflow: get volume, set volume, get mute, set mute, get monitor, set monitor', async () => {
      // Get volume
      const volumeResult = await audioManager.getVolume('Microphone');
      assert.equal(volumeResult.volumeDb, -10);

      // Set volume
      const setVolumeResult = await audioManager.setVolume('Microphone', -15);
      assert.equal(setVolumeResult.success, true);

      // Get mute
      const muteResult = await audioManager.getMute('Microphone');
      assert.equal(muteResult.muted, false);

      // Set mute
      const setMuteResult = await audioManager.setMute('Microphone', true);
      assert.equal(setMuteResult.success, true);

      // Get monitor type
      const monitorResult = await audioManager.getMonitorType('Microphone');
      assert.equal(monitorResult.monitorType, 'OBS_MONITORING_TYPE_NONE');

      // Set monitor type
      const setMonitorResult = await audioManager.setMonitorType('Microphone', 'OBS_MONITORING_TYPE_MONITOR_ONLY');
      assert.equal(setMonitorResult.success, true);

      // Verify all calls were made
      assert.equal(obs.getCallsTo('GetInputVolume').length, 1);
      assert.equal(obs.getCallsTo('SetInputVolume').length, 1);
      assert.equal(obs.getCallsTo('GetInputMute').length, 1);
      assert.equal(obs.getCallsTo('SetInputMute').length, 1);
      assert.equal(obs.getCallsTo('GetInputAudioMonitorType').length, 1);
      assert.equal(obs.getCallsTo('SetInputAudioMonitorType').length, 1);
    });

    it('should handle rapid volume changes', async () => {
      await audioManager.setVolume('Microphone', -10);
      await audioManager.setVolume('Microphone', -5);
      await audioManager.setVolume('Microphone', 0);

      const calls = obs.getCallsTo('SetInputVolume');
      assert.equal(calls.length, 3);
      assert.equal(calls[0].params.inputVolumeDb, -10);
      assert.equal(calls[1].params.inputVolumeDb, -5);
      assert.equal(calls[2].params.inputVolumeDb, 0);
    });

    it('should handle multiple audio sources independently', async () => {
      // Set volume for different sources
      await audioManager.setVolume('Microphone', -5);
      await audioManager.setVolume('Desktop Audio', -10);
      await audioManager.setVolume('Music', -15);

      // Set mute for different sources
      await audioManager.setMute('Microphone', true);
      await audioManager.setMute('Desktop Audio', false);

      // Verify all calls were made
      assert.equal(obs.getCallsTo('SetInputVolume').length, 3);
      assert.equal(obs.getCallsTo('SetInputMute').length, 2);
    });
  });

  describe('Audio Presets', () => {
    let mockProductionConfigService;
    let mockDatabase;
    let firebaseStore;
    let audioManagerWithFirebase;

    beforeEach(() => {
      // Create in-memory Firebase store
      firebaseStore = {};

      // Mock Firebase database
      mockDatabase = {
        ref: (path) => ({
          set: async (data) => {
            firebaseStore[path] = data;
          },
          once: async (eventType) => {
            const value = firebaseStore[path];

            // If path ends with /presets (listing path), return object of all presets
            if (path.endsWith('/presets') && !value) {
              const presets = {};
              Object.keys(firebaseStore).forEach(key => {
                if (key.startsWith(path + '/')) {
                  const presetId = key.substring(path.length + 1);
                  presets[presetId] = firebaseStore[key];
                }
              });
              return { val: () => Object.keys(presets).length > 0 ? presets : null };
            }

            return { val: () => value || null };
          },
          remove: async () => {
            delete firebaseStore[path];
          }
        })
      };

      // Mock production config service
      mockProductionConfigService = {
        initialize: () => mockDatabase
      };

      // Create audio manager with Firebase support
      audioManagerWithFirebase = new OBSAudioManager(obs, stateSync, mockProductionConfigService);
    });

    describe('DEFAULT_PRESETS', () => {
      it('should export DEFAULT_PRESETS constant', () => {
        assert.ok(DEFAULT_PRESETS);
        assert.equal(typeof DEFAULT_PRESETS, 'object');
      });

      it('should have commentary-focus preset', () => {
        assert.ok(DEFAULT_PRESETS['default-commentary-focus']);
        assert.equal(DEFAULT_PRESETS['default-commentary-focus'].name, 'Commentary Focus');
        assert.ok(Array.isArray(DEFAULT_PRESETS['default-commentary-focus'].sources));
      });

      it('should have venue-focus preset', () => {
        assert.ok(DEFAULT_PRESETS['default-venue-focus']);
        assert.equal(DEFAULT_PRESETS['default-venue-focus'].name, 'Venue Focus');
      });

      it('should have music-bed preset', () => {
        assert.ok(DEFAULT_PRESETS['default-music-bed']);
        assert.equal(DEFAULT_PRESETS['default-music-bed'].name, 'Music Bed');
      });

      it('should have all-muted preset', () => {
        assert.ok(DEFAULT_PRESETS['default-all-muted']);
        assert.equal(DEFAULT_PRESETS['default-all-muted'].name, 'All Muted');
      });

      it('should have break-music preset', () => {
        assert.ok(DEFAULT_PRESETS['default-break-music']);
        assert.equal(DEFAULT_PRESETS['default-break-music'].name, 'Break Music');
      });

      it('should have valid structure for all presets', () => {
        Object.values(DEFAULT_PRESETS).forEach(preset => {
          assert.ok(preset.id, 'Preset should have id');
          assert.ok(preset.name, 'Preset should have name');
          assert.ok(preset.description, 'Preset should have description');
          assert.ok(Array.isArray(preset.sources), 'Preset should have sources array');

          preset.sources.forEach(source => {
            assert.ok(source.inputName, 'Source should have inputName');
            assert.ok(typeof source.volumeDb === 'number', 'Source should have volumeDb number');
            assert.ok(typeof source.muted === 'boolean', 'Source should have muted boolean');
          });
        });
      });
    });

    describe('savePreset', () => {
      it('should save preset to Firebase', async () => {
        const preset = {
          id: 'custom-preset-1',
          name: 'Custom Preset',
          description: 'My custom audio preset',
          sources: [
            { inputName: 'Microphone', volumeDb: -8, muted: false }
          ]
        };

        const result = await audioManagerWithFirebase.savePreset('comp123', preset);

        assert.equal(result, true);
        assert.ok(firebaseStore['competitions/comp123/obs/presets/custom-preset-1']);
        assert.equal(firebaseStore['competitions/comp123/obs/presets/custom-preset-1'].name, 'Custom Preset');
        assert.ok(firebaseStore['competitions/comp123/obs/presets/custom-preset-1'].createdAt);
      });

      it('should throw error when compId is missing', async () => {
        const preset = { id: 'test', name: 'Test', sources: [] };

        await assert.rejects(
          async () => await audioManagerWithFirebase.savePreset('', preset),
          { message: 'Competition ID is required' }
        );
      });

      it('should throw error when preset is missing', async () => {
        await assert.rejects(
          async () => await audioManagerWithFirebase.savePreset('comp123', null),
          { message: 'Preset must be an object' }
        );
      });

      it('should throw error when preset id is missing', async () => {
        const preset = { name: 'Test', sources: [] };

        await assert.rejects(
          async () => await audioManagerWithFirebase.savePreset('comp123', preset),
          { message: 'Preset must have an id' }
        );
      });

      it('should throw error when preset name is missing', async () => {
        const preset = { id: 'test', sources: [] };

        await assert.rejects(
          async () => await audioManagerWithFirebase.savePreset('comp123', preset),
          { message: 'Preset must have a name' }
        );
      });

      it('should throw error when preset sources is not an array', async () => {
        const preset = { id: 'test', name: 'Test' };

        await assert.rejects(
          async () => await audioManagerWithFirebase.savePreset('comp123', preset),
          { message: 'Preset must have a sources array' }
        );
      });

      it('should throw error when production config service is not available', async () => {
        const preset = { id: 'test', name: 'Test', sources: [] };

        await assert.rejects(
          async () => await audioManager.savePreset('comp123', preset),
          { message: 'Production config service not available' }
        );
      });
    });

    describe('loadPreset', () => {
      it('should load preset from Firebase', async () => {
        const preset = {
          id: 'custom-preset-1',
          name: 'Custom Preset',
          description: 'My custom audio preset',
          sources: [
            { inputName: 'Microphone', volumeDb: -8, muted: false }
          ],
          createdAt: new Date().toISOString()
        };

        // Save preset first
        await audioManagerWithFirebase.savePreset('comp123', preset);

        // Load it back
        const loaded = await audioManagerWithFirebase.loadPreset('comp123', 'custom-preset-1');

        assert.ok(loaded);
        assert.equal(loaded.id, 'custom-preset-1');
        assert.equal(loaded.name, 'Custom Preset');
        assert.equal(loaded.description, 'My custom audio preset');
        assert.equal(loaded.sources.length, 1);
        assert.equal(loaded.sources[0].inputName, 'Microphone');
      });

      it('should return null when preset is not found', async () => {
        const loaded = await audioManagerWithFirebase.loadPreset('comp123', 'nonexistent');

        assert.equal(loaded, null);
      });

      it('should throw error when compId is missing', async () => {
        await assert.rejects(
          async () => await audioManagerWithFirebase.loadPreset('', 'preset-1'),
          { message: 'Competition ID is required' }
        );
      });

      it('should throw error when presetId is missing', async () => {
        await assert.rejects(
          async () => await audioManagerWithFirebase.loadPreset('comp123', ''),
          { message: 'Preset ID is required' }
        );
      });

      it('should throw error when production config service is not available', async () => {
        await assert.rejects(
          async () => await audioManager.loadPreset('comp123', 'preset-1'),
          { message: 'Production config service not available' }
        );
      });
    });

    describe('applyPreset', () => {
      it('should apply preset to all sources', async () => {
        const preset = {
          id: 'test-preset',
          name: 'Test Preset',
          sources: [
            { inputName: 'Microphone', volumeDb: -8, muted: false },
            { inputName: 'Desktop Audio', volumeDb: -12, muted: true }
          ]
        };

        obs.clearHistory();

        const result = await audioManagerWithFirebase.applyPreset(preset);

        assert.equal(result.applied, 2);
        assert.equal(result.errors.length, 0);

        // Verify OBS calls
        const volumeCalls = obs.getCallsTo('SetInputVolume');
        const muteCalls = obs.getCallsTo('SetInputMute');

        assert.equal(volumeCalls.length, 2);
        assert.equal(muteCalls.length, 2);
      });

      it('should handle missing sources gracefully', async () => {
        const preset = {
          id: 'test-preset',
          name: 'Test Preset',
          sources: [
            { inputName: 'Microphone', volumeDb: -8, muted: false },
            { inputName: 'NonexistentSource', volumeDb: -12, muted: true }
          ]
        };

        // Don't inject error - just let OBS handle the missing source
        // The mock will still succeed, but in real OBS it would fail
        // For testing purposes, we'll manually create a failing mock that only fails for specific input
        const originalCall = obs.call.bind(obs);
        obs.call = async function(method, params) {
          if (method === 'SetInputVolume' && params.inputName === 'NonexistentSource') {
            throw new Error('Input not found: NonexistentSource');
          }
          return originalCall(method, params);
        };

        const result = await audioManagerWithFirebase.applyPreset(preset);

        assert.equal(result.applied, 1);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].inputName, 'NonexistentSource');

        // Restore original call method
        obs.call = originalCall;
      });

      it('should throw error when preset is missing', async () => {
        await assert.rejects(
          async () => await audioManagerWithFirebase.applyPreset(null),
          { message: 'Preset must be an object' }
        );
      });

      it('should throw error when preset sources is not an array', async () => {
        const preset = { id: 'test', name: 'Test' };

        await assert.rejects(
          async () => await audioManagerWithFirebase.applyPreset(preset),
          { message: 'Preset must have a sources array' }
        );
      });

      it('should apply only volume when muted is undefined', async () => {
        const preset = {
          id: 'test-preset',
          name: 'Test Preset',
          sources: [
            { inputName: 'Microphone', volumeDb: -8 } // No muted property
          ]
        };

        obs.clearHistory();

        const result = await audioManagerWithFirebase.applyPreset(preset);

        assert.equal(result.applied, 1);

        // Verify only volume call was made
        const volumeCalls = obs.getCallsTo('SetInputVolume');
        const muteCalls = obs.getCallsTo('SetInputMute');

        assert.equal(volumeCalls.length, 1);
        assert.equal(muteCalls.length, 0);
      });
    });

    describe('deletePreset', () => {
      it('should delete preset from Firebase', async () => {
        const preset = {
          id: 'custom-preset-1',
          name: 'Custom Preset',
          sources: []
        };

        // Save preset first
        await audioManagerWithFirebase.savePreset('comp123', preset);
        assert.ok(firebaseStore['competitions/comp123/obs/presets/custom-preset-1']);

        // Delete it
        const result = await audioManagerWithFirebase.deletePreset('comp123', 'custom-preset-1');

        assert.equal(result, true);
        assert.equal(firebaseStore['competitions/comp123/obs/presets/custom-preset-1'], undefined);
      });

      it('should throw error when trying to delete default preset', async () => {
        await assert.rejects(
          async () => await audioManagerWithFirebase.deletePreset('comp123', 'default-commentary-focus'),
          { message: 'Cannot delete default presets' }
        );
      });

      it('should throw error when compId is missing', async () => {
        await assert.rejects(
          async () => await audioManagerWithFirebase.deletePreset('', 'preset-1'),
          { message: 'Competition ID is required' }
        );
      });

      it('should throw error when presetId is missing', async () => {
        await assert.rejects(
          async () => await audioManagerWithFirebase.deletePreset('comp123', ''),
          { message: 'Preset ID is required' }
        );
      });

      it('should throw error when production config service is not available', async () => {
        await assert.rejects(
          async () => await audioManager.deletePreset('comp123', 'preset-1'),
          { message: 'Production config service not available' }
        );
      });
    });

    describe('listPresets', () => {
      it('should return default presets when no user presets exist', async () => {
        const presets = await audioManagerWithFirebase.listPresets('comp123');

        assert.ok(Array.isArray(presets));
        assert.equal(presets.length, 5); // 5 default presets

        const defaultNames = presets.map(p => p.id);
        assert.ok(defaultNames.includes('default-commentary-focus'));
        assert.ok(defaultNames.includes('default-venue-focus'));
        assert.ok(defaultNames.includes('default-music-bed'));
        assert.ok(defaultNames.includes('default-all-muted'));
        assert.ok(defaultNames.includes('default-break-music'));
      });

      it('should return default presets plus user presets', async () => {
        // Save some user presets
        await audioManagerWithFirebase.savePreset('comp123', {
          id: 'custom-1',
          name: 'Custom 1',
          sources: []
        });
        await audioManagerWithFirebase.savePreset('comp123', {
          id: 'custom-2',
          name: 'Custom 2',
          sources: []
        });

        const presets = await audioManagerWithFirebase.listPresets('comp123');

        assert.equal(presets.length, 7); // 5 default + 2 custom

        const presetIds = presets.map(p => p.id);
        assert.ok(presetIds.includes('default-commentary-focus'));
        assert.ok(presetIds.includes('custom-1'));
        assert.ok(presetIds.includes('custom-2'));
      });

      it('should throw error when compId is missing', async () => {
        await assert.rejects(
          async () => await audioManagerWithFirebase.listPresets(''),
          { message: 'Competition ID is required' }
        );
      });

      it('should throw error when production config service is not available', async () => {
        await assert.rejects(
          async () => await audioManager.listPresets('comp123'),
          { message: 'Production config service not available' }
        );
      });
    });
  });
});
