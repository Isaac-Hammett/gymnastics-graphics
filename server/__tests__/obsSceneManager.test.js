/**
 * OBS Scene Manager Tests
 *
 * Comprehensive test suite for obsSceneManager.js
 * Uses mockOBS.js for OBS WebSocket mocking
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OBSSceneManager } from '../lib/obsSceneManager.js';
import { MockOBSWebSocket } from './helpers/mockOBS.js';

describe('OBSSceneManager', () => {
  let obs;
  let stateSync;
  let sceneManager;

  beforeEach(() => {
    // Create fresh mock OBS instance
    obs = new MockOBSWebSocket();

    // Create mock state sync with cached scenes
    stateSync = {
      getState: () => ({
        connected: true,
        scenes: [
          { sceneName: 'Starting Soon', sceneIndex: 0, items: [] },
          { sceneName: 'BRB', sceneIndex: 1, items: [] },
          { sceneName: 'Single - Camera 1', sceneIndex: 2, items: [
            { sceneItemId: 1, sourceName: 'Camera 1 SRT', sceneItemEnabled: true }
          ]}
        ]
      })
    };

    // Create scene manager instance
    sceneManager = new OBSSceneManager(obs, stateSync);

    // Clear call history
    obs.clearHistory();
  });

  describe('getScenes', () => {
    it('should return cached scenes from stateSync', () => {
      const scenes = sceneManager.getScenes();

      assert.equal(scenes.length, 3);
      assert.equal(scenes[0].sceneName, 'Starting Soon');
      assert.equal(scenes[1].sceneName, 'BRB');
      assert.equal(scenes[2].sceneName, 'Single - Camera 1');
    });

    it('should return empty array when no scenes in state', () => {
      stateSync.getState = () => ({ scenes: [] });

      const scenes = sceneManager.getScenes();

      assert.deepEqual(scenes, []);
    });

    it('should return empty array when scenes is undefined', () => {
      stateSync.getState = () => ({});

      const scenes = sceneManager.getScenes();

      assert.deepEqual(scenes, []);
    });
  });

  describe('getScene', () => {
    it('should return scene with items for known scene', async () => {
      const scene = await sceneManager.getScene('Single - Camera 1');

      assert.ok(scene);
      assert.equal(scene.sceneName, 'Single - Camera 1');
      assert.ok(scene.items);
      assert.ok(Array.isArray(scene.items));

      // Verify OBS call was made
      const calls = obs.getCallsTo('GetSceneItemList');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.sceneName, 'Single - Camera 1');
    });

    it('should return null for unknown scene', async () => {
      const scene = await sceneManager.getScene('Unknown Scene');

      assert.equal(scene, null);

      // Should not call OBS if scene not found in cache
      const calls = obs.getCallsTo('GetSceneItemList');
      assert.equal(calls.length, 0);
    });

    it('should throw error if OBS call fails', async () => {
      obs.injectErrorOnMethod('GetSceneItemList', new Error('OBS error'));

      await assert.rejects(
        async () => await sceneManager.getScene('Starting Soon'),
        { message: 'OBS error' }
      );
    });
  });

  describe('createScene', () => {
    it('should create new scene with valid name', async () => {
      const result = await sceneManager.createScene('New Scene');

      assert.equal(result.name, 'New Scene');
      assert.deepEqual(result.items, []);

      // Verify OBS call
      const calls = obs.getCallsTo('CreateScene');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.sceneName, 'New Scene');
    });

    it('should throw error if scene name is empty', async () => {
      await assert.rejects(
        async () => await sceneManager.createScene(''),
        { message: 'Scene name is required' }
      );
    });

    it('should throw error if scene name is null', async () => {
      await assert.rejects(
        async () => await sceneManager.createScene(null),
        { message: 'Scene name is required' }
      );
    });

    it('should throw error if scene name is undefined', async () => {
      await assert.rejects(
        async () => await sceneManager.createScene(undefined),
        { message: 'Scene name is required' }
      );
    });

    it('should throw error if scene already exists', async () => {
      const error = new Error('Scene already exists');
      error.code = 601;
      obs.injectErrorOnMethod('CreateScene', error);

      await assert.rejects(
        async () => await sceneManager.createScene('Duplicate'),
        { message: 'Scene already exists' }
      );
    });

    it('should throw error if OBS call fails', async () => {
      obs.injectErrorOnMethod('CreateScene', new Error('OBS connection lost'));

      await assert.rejects(
        async () => await sceneManager.createScene('Test'),
        { message: 'OBS connection lost' }
      );
    });
  });

  describe('duplicateScene', () => {
    it('should duplicate scene with all items', async () => {
      const result = await sceneManager.duplicateScene('Single - Camera 1', 'Single - Camera 1 Copy');

      assert.equal(result.name, 'Single - Camera 1 Copy');
      assert.equal(result.copiedFrom, 'Single - Camera 1');
      assert.equal(result.itemCount, 1);

      // Verify OBS calls: CreateScene + GetSceneItemList + CreateSceneItem
      const createCalls = obs.getCallsTo('CreateScene');
      assert.equal(createCalls.length, 1);
      assert.equal(createCalls[0].params.sceneName, 'Single - Camera 1 Copy');

      const listCalls = obs.getCallsTo('GetSceneItemList');
      assert.equal(listCalls.length, 1);
      assert.equal(listCalls[0].params.sceneName, 'Single - Camera 1');

      const itemCalls = obs.getCallsTo('CreateSceneItem');
      assert.equal(itemCalls.length, 1);
      assert.equal(itemCalls[0].params.sceneName, 'Single - Camera 1 Copy');
      assert.equal(itemCalls[0].params.sourceName, 'Camera 1 SRT');
    });

    it('should handle empty source scene', async () => {
      const result = await sceneManager.duplicateScene('BRB', 'BRB Copy');

      assert.equal(result.name, 'BRB Copy');
      assert.equal(result.itemCount, 0);

      // Should create scene but no items
      const createCalls = obs.getCallsTo('CreateScene');
      assert.equal(createCalls.length, 1);

      const itemCalls = obs.getCallsTo('CreateSceneItem');
      assert.equal(itemCalls.length, 0);
    });

    it('should throw error if source name is empty', async () => {
      await assert.rejects(
        async () => await sceneManager.duplicateScene('', 'New'),
        { message: 'Source name and new name are required' }
      );
    });

    it('should throw error if new name is empty', async () => {
      await assert.rejects(
        async () => await sceneManager.duplicateScene('BRB', ''),
        { message: 'Source name and new name are required' }
      );
    });

    it('should throw error if source and new names are the same', async () => {
      await assert.rejects(
        async () => await sceneManager.duplicateScene('BRB', 'BRB'),
        { message: 'Source and destination scene names must be different' }
      );
    });

    it('should throw error if source scene does not exist', async () => {
      const error = new Error('Scene not found');
      error.code = 600;
      obs.injectErrorOnMethod('GetSceneItemList', error);

      await assert.rejects(
        async () => await sceneManager.duplicateScene('Unknown', 'Copy'),
        { message: 'Scene not found' }
      );
    });

    it('should throw error if new scene name already exists', async () => {
      const error = new Error('Scene already exists');
      error.code = 601;
      obs.injectErrorOnMethod('CreateScene', error);

      await assert.rejects(
        async () => await sceneManager.duplicateScene('BRB', 'Starting Soon'),
        { message: 'Scene already exists' }
      );
    });
  });

  describe('renameScene', () => {
    it('should rename scene successfully', async () => {
      const result = await sceneManager.renameScene('BRB', 'Be Right Back');

      assert.equal(result.oldName, 'BRB');
      assert.equal(result.newName, 'Be Right Back');

      // Verify OBS call
      const calls = obs.getCallsTo('SetSceneName');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.sceneName, 'BRB');
      assert.equal(calls[0].params.newSceneName, 'Be Right Back');
    });

    it('should throw error if old name is empty', async () => {
      await assert.rejects(
        async () => await sceneManager.renameScene('', 'New'),
        { message: 'Old name and new name are required' }
      );
    });

    it('should throw error if new name is empty', async () => {
      await assert.rejects(
        async () => await sceneManager.renameScene('BRB', ''),
        { message: 'Old name and new name are required' }
      );
    });

    it('should throw error if old and new names are the same', async () => {
      await assert.rejects(
        async () => await sceneManager.renameScene('BRB', 'BRB'),
        { message: 'Old and new scene names must be different' }
      );
    });

    it('should throw error if scene does not exist', async () => {
      const error = new Error('Scene not found');
      error.code = 600;
      obs.injectErrorOnMethod('SetSceneName', error);

      await assert.rejects(
        async () => await sceneManager.renameScene('Unknown', 'New Name'),
        { message: 'Scene not found' }
      );
    });

    it('should throw error if new name conflicts with existing scene', async () => {
      const error = new Error('Scene name already in use');
      error.code = 602;
      obs.injectErrorOnMethod('SetSceneName', error);

      await assert.rejects(
        async () => await sceneManager.renameScene('BRB', 'Starting Soon'),
        { message: 'Scene name already in use' }
      );
    });
  });

  describe('deleteScene', () => {
    it('should delete scene successfully', async () => {
      const result = await sceneManager.deleteScene('BRB');

      assert.equal(result.deleted, 'BRB');

      // Verify OBS call
      const calls = obs.getCallsTo('RemoveScene');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.sceneName, 'BRB');
    });

    it('should throw error if scene name is empty', async () => {
      await assert.rejects(
        async () => await sceneManager.deleteScene(''),
        { message: 'Scene name is required' }
      );
    });

    it('should throw error if scene name is null', async () => {
      await assert.rejects(
        async () => await sceneManager.deleteScene(null),
        { message: 'Scene name is required' }
      );
    });

    it('should throw error if scene does not exist', async () => {
      const error = new Error('Scene not found');
      error.code = 600;
      obs.injectErrorOnMethod('RemoveScene', error);

      await assert.rejects(
        async () => await sceneManager.deleteScene('Unknown'),
        { message: 'Scene not found' }
      );
    });

    it('should throw error if OBS call fails', async () => {
      obs.injectErrorOnMethod('RemoveScene', new Error('Cannot delete current scene'));

      await assert.rejects(
        async () => await sceneManager.deleteScene('Starting Soon'),
        { message: 'Cannot delete current scene' }
      );
    });
  });

  describe('reorderScenes', () => {
    it('should validate scene order successfully', async () => {
      const order = ['BRB', 'Starting Soon', 'Single - Camera 1'];
      const result = await sceneManager.reorderScenes(order);

      assert.deepEqual(result.order, order);
      assert.ok(result.note.includes('client-side'));
    });

    it('should throw error if scene order is not an array', async () => {
      await assert.rejects(
        async () => await sceneManager.reorderScenes('not-an-array'),
        { message: 'Scene order must be an array' }
      );
    });

    it('should throw error if scene order contains unknown scene', async () => {
      const order = ['BRB', 'Unknown Scene', 'Starting Soon'];

      await assert.rejects(
        async () => await sceneManager.reorderScenes(order),
        { message: 'Scene order contains unknown scenes' }
      );
    });

    it('should accept empty scene order', async () => {
      const result = await sceneManager.reorderScenes([]);

      assert.deepEqual(result.order, []);
    });

    it('should accept partial scene order', async () => {
      const order = ['BRB'];
      const result = await sceneManager.reorderScenes(order);

      assert.deepEqual(result.order, order);
    });
  });

  describe('Error Handling', () => {
    it('should handle OBS connection errors gracefully', async () => {
      obs.injectErrorOnMethod('CreateScene', new Error('Connection closed'));

      await assert.rejects(
        async () => await sceneManager.createScene('Test'),
        { message: 'Connection closed' }
      );
    });

    it('should handle OBS timeout errors', async () => {
      obs.injectErrorOnMethod('GetSceneItemList', new Error('Request timeout'));

      await assert.rejects(
        async () => await sceneManager.getScene('Starting Soon'),
        { message: 'Request timeout' }
      );
    });

    it('should handle invalid scene names from OBS', async () => {
      const error = new Error('Invalid scene name');
      error.code = 603;
      obs.injectErrorOnMethod('CreateScene', error);

      await assert.rejects(
        async () => await sceneManager.createScene('Invalid/Scene:Name'),
        { message: 'Invalid scene name' }
      );
    });
  });

  describe('Integration', () => {
    it('should work with empty state sync', () => {
      stateSync.getState = () => ({ scenes: [] });

      const scenes = sceneManager.getScenes();

      assert.deepEqual(scenes, []);
    });

    it('should handle null stateSync gracefully', async () => {
      const nullStateSync = {
        getState: () => null
      };
      const manager = new OBSSceneManager(obs, nullStateSync);

      assert.throws(() => manager.getScenes());
    });

    it('should handle missing scenes property in state', () => {
      stateSync.getState = () => ({ connected: true });

      const scenes = sceneManager.getScenes();

      assert.deepEqual(scenes, []);
    });
  });
});
