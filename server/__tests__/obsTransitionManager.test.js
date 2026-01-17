/**
 * OBS Transition Manager Tests
 *
 * Comprehensive test suite for obsTransitionManager.js
 * Uses mockOBS.js for OBS WebSocket mocking
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OBSTransitionManager } from '../lib/obsTransitionManager.js';
import { MockOBSWebSocket } from './helpers/mockOBS.js';

describe('OBSTransitionManager', () => {
  let obs;
  let stateSync;
  let transitionManager;

  beforeEach(() => {
    // Create fresh mock OBS instance
    obs = new MockOBSWebSocket();

    // Add some test transitions
    obs.addTransition('Fade', 'fade_transition', {});
    obs.addTransition('Cut', 'cut_transition', {});
    obs.addTransition('Stinger', 'obs_stinger_transition', { path: '/path/to/stinger.webm' });

    // Create mock state sync with cached transitions
    stateSync = {
      getState: () => ({
        connected: true,
        transitions: [
          { transitionName: 'Fade', transitionKind: 'fade_transition' },
          { transitionName: 'Cut', transitionKind: 'cut_transition' },
          { transitionName: 'Stinger', transitionKind: 'obs_stinger_transition' }
        ]
      })
    };

    // Create transition manager instance
    transitionManager = new OBSTransitionManager(obs, stateSync);

    // Clear call history
    obs.clearHistory();
  });

  describe('Module exports', () => {
    it('should export OBSTransitionManager class', () => {
      assert.ok(OBSTransitionManager);
      assert.equal(typeof OBSTransitionManager, 'function');
      assert.ok(transitionManager instanceof OBSTransitionManager);
    });
  });

  describe('getTransitions', () => {
    it('should return cached transitions from stateSync', () => {
      const transitions = transitionManager.getTransitions();

      assert.ok(Array.isArray(transitions));
      assert.equal(transitions.length, 3);
      assert.equal(transitions[0].transitionName, 'Fade');
      assert.equal(transitions[0].transitionKind, 'fade_transition');
      assert.equal(transitions[1].transitionName, 'Cut');
      assert.equal(transitions[2].transitionName, 'Stinger');
    });

    it('should return empty array when no transitions in state', () => {
      stateSync.getState = () => ({ transitions: [] });

      const transitions = transitionManager.getTransitions();

      assert.deepEqual(transitions, []);
    });

    it('should return empty array when transitions is undefined', () => {
      stateSync.getState = () => ({});

      const transitions = transitionManager.getTransitions();

      assert.deepEqual(transitions, []);
    });

    it('should not make OBS calls when getting cached transitions', () => {
      transitionManager.getTransitions();

      // Verify no OBS calls were made
      const calls = obs._callHistory;
      assert.equal(calls.length, 0);
    });
  });

  describe('getCurrentTransition', () => {
    it('should return current transition with name, duration, and kind', async () => {
      const result = await transitionManager.getCurrentTransition();

      assert.ok(result);
      assert.equal(typeof result.name, 'string');
      assert.equal(typeof result.duration, 'number');
      assert.equal(typeof result.kind, 'string');
      assert.equal(result.name, 'Fade');
      assert.equal(result.duration, 300);
      assert.equal(result.kind, 'fade_transition');

      // Verify OBS call
      const calls = obs.getCallsTo('GetSceneTransitionList');
      assert.equal(calls.length, 1);
    });

    it('should fetch fresh data from OBS', async () => {
      obs.clearHistory();

      await transitionManager.getCurrentTransition();

      // Should call OBS, not rely on cache
      const calls = obs.getCallsTo('GetSceneTransitionList');
      assert.equal(calls.length, 1);
    });

    it('should return correct data types', async () => {
      const result = await transitionManager.getCurrentTransition();

      assert.equal(typeof result.name, 'string');
      assert.equal(typeof result.duration, 'number');
      assert.equal(typeof result.kind, 'string');
    });

    it('should handle OBS connection errors', async () => {
      const error = new Error('Connection closed');
      obs.injectErrorOnMethod('GetSceneTransitionList', error);

      await assert.rejects(
        async () => await transitionManager.getCurrentTransition(),
        { message: 'Connection closed' }
      );
    });

    it('should handle unknown transition kind gracefully', async () => {
      // Clear cached transitions
      stateSync.getState = () => ({ transitions: [] });

      const result = await transitionManager.getCurrentTransition();

      assert.equal(result.kind, 'unknown');
    });
  });

  describe('setCurrentTransition', () => {
    it('should set transition successfully', async () => {
      const result = await transitionManager.setCurrentTransition('Cut');

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetCurrentSceneTransition');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.transitionName, 'Cut');
    });

    it('should throw error when transitionName is missing', async () => {
      await assert.rejects(
        async () => await transitionManager.setCurrentTransition(''),
        { message: 'Transition name is required' }
      );
    });

    it('should throw error when transitionName is null', async () => {
      await assert.rejects(
        async () => await transitionManager.setCurrentTransition(null),
        { message: 'Transition name is required' }
      );
    });

    it('should handle unknown transition error from OBS', async () => {
      const error = new Error('Transition not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('SetCurrentSceneTransition', error);

      await assert.rejects(
        async () => await transitionManager.setCurrentTransition('Unknown'),
        { message: 'Transition not found: Unknown' }
      );
    });

    it('should handle OBS errors gracefully', async () => {
      const error = new Error('Request failed');
      obs.injectErrorOnMethod('SetCurrentSceneTransition', error);

      await assert.rejects(
        async () => await transitionManager.setCurrentTransition('Fade'),
        { message: 'Request failed' }
      );
    });

    it('should accept any valid transition name', async () => {
      const result = await transitionManager.setCurrentTransition('Stinger');

      assert.equal(result.success, true);

      const calls = obs.getCallsTo('SetCurrentSceneTransition');
      assert.equal(calls[0].params.transitionName, 'Stinger');
    });
  });

  describe('setTransitionDuration', () => {
    it('should set duration successfully', async () => {
      const result = await transitionManager.setTransitionDuration(500);

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetCurrentSceneTransitionDuration');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.transitionDuration, 500);
    });

    it('should throw error when duration is not a number', async () => {
      await assert.rejects(
        async () => await transitionManager.setTransitionDuration('500'),
        { message: 'Duration must be a positive number' }
      );
    });

    it('should throw error when duration is zero', async () => {
      await assert.rejects(
        async () => await transitionManager.setTransitionDuration(0),
        { message: 'Duration must be a positive number' }
      );
    });

    it('should throw error when duration is negative', async () => {
      await assert.rejects(
        async () => await transitionManager.setTransitionDuration(-100),
        { message: 'Duration must be a positive number' }
      );
    });

    it('should handle OBS errors when setting duration', async () => {
      const error = new Error('Request failed');
      obs.injectErrorOnMethod('SetCurrentSceneTransitionDuration', error);

      await assert.rejects(
        async () => await transitionManager.setTransitionDuration(300),
        { message: 'Request failed' }
      );
    });

    it('should accept large duration values', async () => {
      const result = await transitionManager.setTransitionDuration(5000);

      assert.equal(result.success, true);

      const calls = obs.getCallsTo('SetCurrentSceneTransitionDuration');
      assert.equal(calls[0].params.transitionDuration, 5000);
    });

    it('should accept small duration values', async () => {
      const result = await transitionManager.setTransitionDuration(50);

      assert.equal(result.success, true);

      const calls = obs.getCallsTo('SetCurrentSceneTransitionDuration');
      assert.equal(calls[0].params.transitionDuration, 50);
    });
  });

  describe('getTransitionSettings', () => {
    it('should return settings for valid transition', async () => {
      const result = await transitionManager.getTransitionSettings('Fade');

      assert.ok(result);
      assert.equal(result.transitionName, 'Fade');
      assert.equal(result.kind, 'fade_transition');
      assert.ok(result.settings);
      assert.equal(typeof result.settings, 'object');
    });

    it('should throw error when transitionName is missing', async () => {
      await assert.rejects(
        async () => await transitionManager.getTransitionSettings(''),
        { message: 'Transition name is required' }
      );
    });

    it('should throw error when transitionName is null', async () => {
      await assert.rejects(
        async () => await transitionManager.getTransitionSettings(null),
        { message: 'Transition name is required' }
      );
    });

    it('should return unknown kind for unlisted transition', async () => {
      const result = await transitionManager.getTransitionSettings('CustomTransition');

      assert.equal(result.kind, 'unknown');
    });

    it('should return settings object structure', async () => {
      const result = await transitionManager.getTransitionSettings('Stinger');

      assert.ok(result.transitionName);
      assert.ok(result.kind);
      assert.ok(result.settings);
      assert.equal(typeof result.settings, 'object');
    });
  });

  describe('setTransitionSettings', () => {
    it('should update settings successfully', async () => {
      const settings = { path: '/new/path.webm', timing: 500 };
      const result = await transitionManager.setTransitionSettings('Stinger', settings);

      assert.equal(result.success, true);

      // Verify OBS call
      const calls = obs.getCallsTo('SetCurrentSceneTransitionSettings');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].params.transitionName, 'Stinger');
      assert.deepEqual(calls[0].params.transitionSettings, settings);
      assert.equal(calls[0].params.overlay, true);
    });

    it('should throw error when transitionName is missing', async () => {
      await assert.rejects(
        async () => await transitionManager.setTransitionSettings('', {}),
        { message: 'Transition name is required' }
      );
    });

    it('should throw error when settings is missing', async () => {
      await assert.rejects(
        async () => await transitionManager.setTransitionSettings('Fade', null),
        { message: 'Settings must be an object' }
      );
    });

    it('should throw error when settings is not an object', async () => {
      await assert.rejects(
        async () => await transitionManager.setTransitionSettings('Fade', 'invalid'),
        { message: 'Settings must be an object' }
      );
    });

    it('should handle OBS errors when setting settings', async () => {
      const error = new Error('Transition not found: Unknown');
      error.code = 600;
      obs.injectErrorOnMethod('SetCurrentSceneTransitionSettings', error);

      await assert.rejects(
        async () => await transitionManager.setTransitionSettings('Unknown', {}),
        { message: 'Transition not found: Unknown' }
      );
    });

    it('should accept empty settings object', async () => {
      const result = await transitionManager.setTransitionSettings('Fade', {});

      assert.equal(result.success, true);

      const calls = obs.getCallsTo('SetCurrentSceneTransitionSettings');
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].params.transitionSettings, {});
    });

    it('should use overlay mode for merging settings', async () => {
      await transitionManager.setTransitionSettings('Stinger', { path: '/test.webm' });

      const calls = obs.getCallsTo('SetCurrentSceneTransitionSettings');
      assert.equal(calls[0].params.overlay, true);
    });
  });

  describe('Error handling', () => {
    it('should handle connection errors gracefully', async () => {
      obs.injectErrorOnMethod('GetSceneTransitionList', new Error('Connection closed'));

      await assert.rejects(
        async () => await transitionManager.getCurrentTransition(),
        { message: 'Connection closed' }
      );
    });

    it('should handle timeout errors', async () => {
      obs.injectErrorOnMethod('SetCurrentSceneTransition', new Error('Request timeout'));

      await assert.rejects(
        async () => await transitionManager.setCurrentTransition('Fade'),
        { message: 'Request timeout' }
      );
    });

    it('should handle network errors during operations', async () => {
      obs.injectErrorOnMethod('SetCurrentSceneTransitionDuration', new Error('Network error'));

      await assert.rejects(
        async () => await transitionManager.setTransitionDuration(300),
        { message: 'Network error' }
      );
    });
  });

  describe('Integration', () => {
    it('should handle complete workflow: get current, set transition, set duration, verify', async () => {
      // Get current transition
      const current = await transitionManager.getCurrentTransition();
      assert.equal(current.name, 'Fade');
      assert.equal(current.duration, 300);

      // Set new transition
      const setResult = await transitionManager.setCurrentTransition('Cut');
      assert.equal(setResult.success, true);

      // Set new duration
      const durationResult = await transitionManager.setTransitionDuration(500);
      assert.equal(durationResult.success, true);

      // Verify all calls were made
      assert.equal(obs.getCallsTo('GetSceneTransitionList').length, 1);
      assert.equal(obs.getCallsTo('SetCurrentSceneTransition').length, 1);
      assert.equal(obs.getCallsTo('SetCurrentSceneTransitionDuration').length, 1);
    });

    it('should work with empty state sync', () => {
      stateSync.getState = () => ({ transitions: [] });

      const transitions = transitionManager.getTransitions();

      assert.deepEqual(transitions, [], 'Should return empty array');
    });

    it('should handle null state gracefully', () => {
      const nullStateSync = {
        getState: () => null
      };
      const manager = new OBSTransitionManager(obs, nullStateSync);

      assert.throws(() => manager.getTransitions());
    });

    it('should handle missing transitions property in state', () => {
      stateSync.getState = () => ({ connected: true });

      const transitions = transitionManager.getTransitions();

      assert.deepEqual(transitions, []);
    });

    it('should maintain state consistency across multiple operations', async () => {
      // Perform multiple operations
      await transitionManager.setCurrentTransition('Fade');
      await transitionManager.setTransitionDuration(250);
      await transitionManager.setCurrentTransition('Cut');
      await transitionManager.setTransitionDuration(100);

      // Verify all calls were made in order
      const transitionCalls = obs.getCallsTo('SetCurrentSceneTransition');
      const durationCalls = obs.getCallsTo('SetCurrentSceneTransitionDuration');

      assert.equal(transitionCalls.length, 2);
      assert.equal(durationCalls.length, 2);

      assert.equal(transitionCalls[0].params.transitionName, 'Fade');
      assert.equal(durationCalls[0].params.transitionDuration, 250);
      assert.equal(transitionCalls[1].params.transitionName, 'Cut');
      assert.equal(durationCalls[1].params.transitionDuration, 100);
    });

    it('should handle rapid transition changes', async () => {
      await transitionManager.setCurrentTransition('Fade');
      await transitionManager.setCurrentTransition('Cut');
      await transitionManager.setCurrentTransition('Stinger');

      const calls = obs.getCallsTo('SetCurrentSceneTransition');
      assert.equal(calls.length, 3);
      assert.equal(calls[0].params.transitionName, 'Fade');
      assert.equal(calls[1].params.transitionName, 'Cut');
      assert.equal(calls[2].params.transitionName, 'Stinger');
    });

    it('should handle settings update workflow', async () => {
      // Get settings
      const settings = await transitionManager.getTransitionSettings('Stinger');
      assert.ok(settings);

      // Update settings
      const updateResult = await transitionManager.setTransitionSettings('Stinger', {
        path: '/new/stinger.webm',
        timing: 600
      });
      assert.equal(updateResult.success, true);

      // Verify OBS call was made
      const calls = obs.getCallsTo('SetCurrentSceneTransitionSettings');
      assert.equal(calls.length, 1);
    });

    it('should cache transitions list without repeated OBS calls', () => {
      transitionManager.getTransitions();
      transitionManager.getTransitions();
      transitionManager.getTransitions();

      // Should not make any OBS calls for cached data
      const calls = obs._callHistory;
      assert.equal(calls.length, 0);
    });
  });
});
