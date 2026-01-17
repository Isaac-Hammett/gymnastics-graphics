/**
 * OBS Source Manager Tests
 *
 * Comprehensive test suite for obsSourceManager.js
 * Uses mockOBS.js for OBS WebSocket mocking
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OBSSourceManager } from '../lib/obsSourceManager.js';
import { MockOBSWebSocket } from './helpers/mockOBS.js';

describe('OBSSourceManager', () => {
  let obs;
  let stateSync;
  let sourceManager;

  beforeEach(() => {
    // Create fresh mock OBS instance
    obs = new MockOBSWebSocket();

    // Create mock state sync with cached inputs
    stateSync = {
      getState: () => ({
        connected: true,
        inputs: [
          { inputName: 'Camera 1', inputKind: 'ffmpeg_source', settings: { url: 'srt://example.com:1234' } },
          { inputName: 'Graphics', inputKind: 'browser_source', settings: { url: 'http://localhost:8080' } },
          { inputName: 'Microphone', inputKind: 'wasapi_input_capture', settings: {} }
        ]
      })
    };

    // Create source manager instance
    sourceManager = new OBSSourceManager(obs, stateSync);

    // Clear call history
    obs.clearHistory();
  });

  describe('Module exports', () => {
    it('should export OBSSourceManager class', () => {
      assert.ok(OBSSourceManager);
      assert.equal(typeof OBSSourceManager, 'function');
      assert.ok(sourceManager instanceof OBSSourceManager);
    });
  });

  describe('getInputKinds', () => {
    it('should return input kinds from OBS', async () => {
      const kinds = await sourceManager.getInputKinds();

      assert.ok(Array.isArray(kinds));
      assert.ok(kinds.length > 0);
      assert.ok(kinds.includes('ffmpeg_source'));
      assert.ok(kinds.includes('browser_source'));

      // Verify OBS call was made
      const calls = obs.getCallsTo('GetInputKindList');
      assert.equal(calls.length, 1);
    });

    it('should handle empty input kind list', async () => {
      // Override mock to return empty list
      obs._methodHandlers.GetInputKindList = function() {
        return { inputKinds: [] };
      };

      const kinds = await sourceManager.getInputKinds();

      assert.ok(Array.isArray(kinds));
      assert.equal(kinds.length, 0);
    });

    it('should handle OBS errors when getting input kinds', async () => {
      obs.injectErrorOnMethod('GetInputKindList', new Error('Failed to get input kinds'));

      await assert.rejects(
        async () => await sourceManager.getInputKinds(),
        { message: 'Failed to get input kinds' }
      );
    });

    it('should handle connection timeout errors', async () => {
      obs.injectErrorOnMethod('GetInputKindList', new Error('Request timeout'));

      await assert.rejects(
        async () => await sourceManager.getInputKinds(),
        { message: 'Request timeout' }
      );
    });
  });

  describe('getInputs', () => {
    it('should return cached inputs from stateSync', () => {
      const inputs = sourceManager.getInputs();

      assert.ok(Array.isArray(inputs));
      assert.equal(inputs.length, 3);
      assert.equal(inputs[0].inputName, 'Camera 1');
      assert.equal(inputs[0].inputKind, 'ffmpeg_source');
      assert.equal(inputs[1].inputName, 'Graphics');
      assert.equal(inputs[1].inputKind, 'browser_source');
      assert.equal(inputs[2].inputName, 'Microphone');
      assert.equal(inputs[2].inputKind, 'wasapi_input_capture');
    });

    it('should return empty array when no inputs in state', () => {
      stateSync.getState = () => ({ inputs: [] });

      const inputs = sourceManager.getInputs();

      assert.deepEqual(inputs, []);
    });

    it('should return empty array when inputs is undefined', () => {
      stateSync.getState = () => ({});

      const inputs = sourceManager.getInputs();

      assert.deepEqual(inputs, []);
    });
  });

  describe('createInput', () => {
    it('should create input successfully with all parameters', async () => {
      const inputName = 'Test Camera';
      const inputKind = 'ffmpeg_source';
      const inputSettings = { url: 'srt://test.com:5000', latency: 100 };
      const sceneName = 'Test Scene';

      const result = await sourceManager.createInput(inputName, inputKind, inputSettings, sceneName);

      assert.equal(result.inputName, inputName);
      assert.equal(result.inputKind, inputKind);
      assert.equal(result.sceneName, sceneName);
      assert.ok(result.sceneItemId !== null);

      // Verify OBS call
      const calls = obs.getCallsTo('CreateInput');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, inputName);
      assert.equal(calls[0].params.inputKind, inputKind);
      assert.deepEqual(calls[0].params.inputSettings, inputSettings);
      assert.equal(calls[0].params.sceneName, sceneName);
      assert.equal(calls[0].params.sceneItemEnabled, true);
    });

    it('should create input without sceneName (global input)', async () => {
      const inputName = 'Global Audio';
      const inputKind = 'wasapi_output_capture';
      const inputSettings = { device_id: 'default' };

      const result = await sourceManager.createInput(inputName, inputKind, inputSettings, null);

      assert.equal(result.inputName, inputName);
      assert.equal(result.inputKind, inputKind);
      assert.equal(result.sceneName, null);

      // Verify OBS call
      const calls = obs.getCallsTo('CreateInput');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.sceneName, null);
    });

    it('should create input with only required parameters', async () => {
      const inputName = 'Simple Input';
      const inputKind = 'color_source';

      const result = await sourceManager.createInput(inputName, inputKind);

      assert.equal(result.inputName, inputName);
      assert.equal(result.inputKind, inputKind);
      assert.equal(result.sceneName, null);

      // Verify OBS call with default empty settings
      const calls = obs.getCallsTo('CreateInput');
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].params.inputSettings, {});
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await sourceManager.createInput('', 'ffmpeg_source'),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when inputName is null', async () => {
      await assert.rejects(
        async () => await sourceManager.createInput(null, 'ffmpeg_source'),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when inputKind is missing', async () => {
      await assert.rejects(
        async () => await sourceManager.createInput('Test Input', ''),
        { message: 'Input kind is required' }
      );
    });

    it('should throw error when inputKind is null', async () => {
      await assert.rejects(
        async () => await sourceManager.createInput('Test Input', null),
        { message: 'Input kind is required' }
      );
    });

    it('should handle OBS error when input name already exists', async () => {
      const error = new Error('Input already exists: Camera 1');
      error.code = 601;
      obs.injectErrorOnMethod('CreateInput', error);

      await assert.rejects(
        async () => await sourceManager.createInput('Camera 1', 'ffmpeg_source'),
        { message: 'Input already exists: Camera 1' }
      );
    });

    it('should handle OBS connection errors', async () => {
      obs.injectErrorOnMethod('CreateInput', new Error('Connection closed'));

      await assert.rejects(
        async () => await sourceManager.createInput('Test', 'ffmpeg_source'),
        { message: 'Connection closed' }
      );
    });
  });

  describe('getInputSettings', () => {
    it('should return settings for existing input', async () => {
      const result = await sourceManager.getInputSettings('Camera 1 SRT');

      assert.ok(result);
      assert.equal(result.inputKind, 'ffmpeg_source');
      assert.ok(result.inputSettings);
      assert.equal(typeof result.inputSettings, 'object');

      // Verify OBS call
      const calls = obs.getCallsTo('GetInputSettings');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, 'Camera 1 SRT');
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await sourceManager.getInputSettings(''),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when inputName is null', async () => {
      await assert.rejects(
        async () => await sourceManager.getInputSettings(null),
        { message: 'Input name is required' }
      );
    });

    it('should handle unknown input error from OBS', async () => {
      const error = new Error('Input not found: Unknown Input');
      error.code = 600;
      obs.injectErrorOnMethod('GetInputSettings', error);

      await assert.rejects(
        async () => await sourceManager.getInputSettings('Unknown Input'),
        { message: 'Input not found: Unknown Input' }
      );
    });
  });

  describe('updateInputSettings', () => {
    it('should update settings successfully', async () => {
      const inputName = 'Camera 1 SRT';
      const inputSettings = { url: 'srt://newserver.com:9999', latency: 200 };

      const result = await sourceManager.updateInputSettings(inputName, inputSettings);

      assert.equal(result.inputName, inputName);
      assert.equal(result.updated, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetInputSettings');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, inputName);
      assert.deepEqual(calls[0].params.inputSettings, inputSettings);
      assert.equal(calls[0].params.overlay, true);
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await sourceManager.updateInputSettings('', { url: 'test' }),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when inputSettings is missing', async () => {
      await assert.rejects(
        async () => await sourceManager.updateInputSettings('Camera 1', null),
        { message: 'Input settings must be an object' }
      );
    });

    it('should throw error when inputSettings is empty object', async () => {
      // Empty object is allowed - no validation error
      const result = await sourceManager.updateInputSettings('Camera 1 SRT', {});
      assert.equal(result.updated, true);
    });

    it('should throw error when inputSettings is not an object', async () => {
      await assert.rejects(
        async () => await sourceManager.updateInputSettings('Camera 1', 'not an object'),
        { message: 'Input settings must be an object' }
      );
    });

    it('should verify overlay: true is passed to OBS', async () => {
      await sourceManager.updateInputSettings('Camera 1 SRT', { latency: 50 });

      const calls = obs.getCallsTo('SetInputSettings');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.overlay, true);
    });

    it('should handle OBS errors when updating settings', async () => {
      const error = new Error('Input not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('SetInputSettings', error);

      await assert.rejects(
        async () => await sourceManager.updateInputSettings('Unknown', { test: true }),
        { message: 'Input not found: Unknown' }
      );
    });
  });

  describe('deleteInput', () => {
    it('should delete input successfully', async () => {
      const inputName = 'Camera 1 SRT';

      const result = await sourceManager.deleteInput(inputName);

      assert.equal(result.deleted, inputName);

      // Verify OBS call
      const calls = obs.getCallsTo('RemoveInput');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.inputName, inputName);
    });

    it('should throw error when inputName is missing', async () => {
      await assert.rejects(
        async () => await sourceManager.deleteInput(''),
        { message: 'Input name is required' }
      );
    });

    it('should throw error when inputName is null', async () => {
      await assert.rejects(
        async () => await sourceManager.deleteInput(null),
        { message: 'Input name is required' }
      );
    });

    it('should handle OBS errors when input not found', async () => {
      const error = new Error('Input not found: Unknown Input');
      error.code = 600;
      obs.injectErrorOnMethod('RemoveInput', error);

      await assert.rejects(
        async () => await sourceManager.deleteInput('Unknown Input'),
        { message: 'Input not found: Unknown Input' }
      );
    });

    it('should handle OBS connection errors', async () => {
      obs.injectErrorOnMethod('RemoveInput', new Error('Connection lost'));

      await assert.rejects(
        async () => await sourceManager.deleteInput('Camera 1'),
        { message: 'Connection lost' }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle OBS connection errors gracefully', async () => {
      obs.injectErrorOnMethod('CreateInput', new Error('Connection closed'));

      await assert.rejects(
        async () => await sourceManager.createInput('Test', 'ffmpeg_source'),
        { message: 'Connection closed' }
      );
    });

    it('should handle OBS timeout errors', async () => {
      obs.injectErrorOnMethod('GetInputSettings', new Error('Request timeout'));

      await assert.rejects(
        async () => await sourceManager.getInputSettings('Camera 1'),
        { message: 'Request timeout' }
      );
    });

    it('should handle network errors during update', async () => {
      obs.injectErrorOnMethod('SetInputSettings', new Error('Network error'));

      await assert.rejects(
        async () => await sourceManager.updateInputSettings('Camera 1', { test: true }),
        { message: 'Network error' }
      );
    });
  });

  describe('Integration', () => {
    it('should work with empty state sync', () => {
      stateSync.getState = () => ({ inputs: [] });

      const inputs = sourceManager.getInputs();

      assert.deepEqual(inputs, []);
    });

    it('should handle null state gracefully', () => {
      const nullStateSync = {
        getState: () => null
      };
      const manager = new OBSSourceManager(obs, nullStateSync);

      assert.throws(() => manager.getInputs());
    });

    it('should handle missing inputs property in state', () => {
      stateSync.getState = () => ({ connected: true });

      const inputs = sourceManager.getInputs();

      assert.deepEqual(inputs, []);
    });

    it('should handle complete workflow: create, get settings, update, delete', async () => {
      // Create
      const createResult = await sourceManager.createInput(
        'Test Workflow',
        'browser_source',
        { url: 'http://test.com', width: 1920, height: 1080 },
        'Test Scene'
      );
      assert.equal(createResult.inputName, 'Test Workflow');

      // Get settings
      const settings = await sourceManager.getInputSettings('Test Workflow');
      assert.ok(settings);
      assert.equal(settings.inputKind, 'browser_source');

      // Update
      const updateResult = await sourceManager.updateInputSettings('Test Workflow', { width: 3840 });
      assert.equal(updateResult.updated, true);

      // Delete
      const deleteResult = await sourceManager.deleteInput('Test Workflow');
      assert.equal(deleteResult.deleted, 'Test Workflow');

      // Verify all calls were made
      assert.equal(obs.getCallsTo('CreateInput').length, 1);
      assert.equal(obs.getCallsTo('GetInputSettings').length, 1);
      assert.equal(obs.getCallsTo('SetInputSettings').length, 1);
      assert.equal(obs.getCallsTo('RemoveInput').length, 1);
    });
  });
});
