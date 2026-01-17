/**
 * Comprehensive tests for OBS State Sync service
 *
 * Tests:
 * 1. Module loading and exports
 * 2. Initial state structure
 * 3. Event handler registration
 * 4. Connection events (connect, disconnect, error)
 * 5. Scene events (list changed, current scene changed, items)
 * 6. Input events (created, removed, settings changed)
 * 7. Audio events (volume, mute, monitor type)
 * 8. Transition events
 * 9. Stream/Recording events
 * 10. Studio mode events
 * 11. Scene categorization
 * 12. Broadcast functionality
 * 13. Error handling
 */

import { describe, it, beforeEach, before } from 'node:test';
import assert from 'node:assert';
import { MockOBSWebSocket, createMockSocketIO, createMockFirebase } from './helpers/mockOBS.js';
import { OBSStateSync, getOBSStateSync, SCENE_CATEGORY } from '../lib/obsStateSync.js';

describe('OBS State Sync Module', async () => {

  describe('Module Exports', () => {
    it('should export OBSStateSync class', () => {
      assert.ok(OBSStateSync, 'OBSStateSync class should be exported');
      assert.strictEqual(typeof OBSStateSync, 'function', 'OBSStateSync should be a class/function');
    });

    it('should export getOBSStateSync factory function', () => {
      assert.ok(getOBSStateSync, 'getOBSStateSync should be exported');
      assert.strictEqual(typeof getOBSStateSync, 'function', 'getOBSStateSync should be a function');
    });

    it('should export SCENE_CATEGORY constants', () => {
      assert.ok(SCENE_CATEGORY, 'SCENE_CATEGORY should be exported');
      assert.strictEqual(SCENE_CATEGORY.GENERATED_SINGLE, 'generated-single');
      assert.strictEqual(SCENE_CATEGORY.GENERATED_MULTI, 'generated-multi');
      assert.strictEqual(SCENE_CATEGORY.STATIC, 'static');
      assert.strictEqual(SCENE_CATEGORY.GRAPHICS, 'graphics');
      assert.strictEqual(SCENE_CATEGORY.MANUAL, 'manual');
    });
  });

  describe('Initial State', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
    });

    it('should have correct initial state structure', () => {
      const state = stateSync.getState();

      assert.strictEqual(state.connected, false, 'Should not be connected initially');
      assert.strictEqual(state.lastSync, null, 'lastSync should be null');
      assert.strictEqual(state.connectionError, null, 'connectionError should be null');
      assert.ok(Array.isArray(state.scenes), 'scenes should be an array');
      assert.ok(Array.isArray(state.inputs), 'inputs should be an array');
      assert.ok(Array.isArray(state.audioSources), 'audioSources should be an array');
      assert.ok(Array.isArray(state.transitions), 'transitions should be an array');
      assert.strictEqual(state.currentScene, null, 'currentScene should be null');
      assert.strictEqual(state.currentTransition, null, 'currentTransition should be null');
      assert.strictEqual(state.studioModeEnabled, false, 'studioModeEnabled should be false');
    });

    it('should have correct streaming state structure', () => {
      const state = stateSync.getState();

      assert.ok(state.streaming, 'streaming object should exist');
      assert.strictEqual(state.streaming.active, false, 'streaming.active should be false');
      assert.strictEqual(state.streaming.timecode, null, 'streaming.timecode should be null');
      assert.strictEqual(state.streaming.duration, null, 'streaming.duration should be null');
    });

    it('should have correct recording state structure', () => {
      const state = stateSync.getState();

      assert.ok(state.recording, 'recording object should exist');
      assert.strictEqual(state.recording.active, false, 'recording.active should be false');
      assert.strictEqual(state.recording.paused, false, 'recording.paused should be false');
    });

    it('should have correct videoSettings structure', () => {
      const state = stateSync.getState();

      assert.ok(state.videoSettings, 'videoSettings object should exist');
      assert.strictEqual(state.videoSettings.baseWidth, null);
      assert.strictEqual(state.videoSettings.baseHeight, null);
      assert.strictEqual(state.videoSettings.outputWidth, null);
      assert.strictEqual(state.videoSettings.outputHeight, null);
    });
  });

  describe('Event Handler Registration', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
    });

    it('should register event handlers when registerEventHandlers is called', () => {
      // Track which events have listeners
      const registeredEvents = [];
      const originalOn = mockObs.on.bind(mockObs);
      mockObs.on = (event, handler) => {
        registeredEvents.push(event);
        return originalOn(event, handler);
      };

      stateSync.registerEventHandlers();

      // Check key events are registered
      assert.ok(registeredEvents.includes('ConnectionClosed'), 'Should register ConnectionClosed');
      assert.ok(registeredEvents.includes('ConnectionError'), 'Should register ConnectionError');
      assert.ok(registeredEvents.includes('Identified'), 'Should register Identified');
      assert.ok(registeredEvents.includes('SceneListChanged'), 'Should register SceneListChanged');
      assert.ok(registeredEvents.includes('CurrentProgramSceneChanged'), 'Should register CurrentProgramSceneChanged');
      assert.ok(registeredEvents.includes('InputCreated'), 'Should register InputCreated');
      assert.ok(registeredEvents.includes('InputVolumeChanged'), 'Should register InputVolumeChanged');
      assert.ok(registeredEvents.includes('StreamStateChanged'), 'Should register StreamStateChanged');
    });

    it('should not register handlers if no OBS instance provided', () => {
      const stateSyncNoObs = new OBSStateSync(null, mockIo, null);
      // Should not throw
      stateSyncNoObs.registerEventHandlers();
    });
  });

  describe('Connection Events', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
    });

    it('should update state on connection (Identified event)', async () => {
      // Simulate OBS connection
      mockObs.emit('Identified', { negotiatedRpcVersion: 1 });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const state = stateSync.getState();
      assert.strictEqual(state.connected, true, 'Should be connected');
      assert.strictEqual(state.connectionError, null, 'connectionError should be cleared');
      assert.ok(state.lastSync, 'lastSync should be set');
    });

    it('should broadcast obs:connected on connection', async () => {
      mockObs.emit('Identified', { negotiatedRpcVersion: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.ok(mockIo.wasEventEmitted('obs:connected'), 'Should emit obs:connected');
      const event = mockIo.getEventsOfType('obs:connected')[0];
      assert.strictEqual(event.data.connected, true);
    });

    it('should update state on connection closed', async () => {
      // First connect
      mockObs.emit('Identified', {});
      await new Promise(resolve => setTimeout(resolve, 10));

      // Then disconnect
      mockObs.emit('ConnectionClosed');
      await new Promise(resolve => setTimeout(resolve, 10));

      const state = stateSync.getState();
      assert.strictEqual(state.connected, false, 'Should not be connected');
      assert.strictEqual(state.connectionError, 'Connection closed');
    });

    it('should broadcast obs:disconnected on connection closed', async () => {
      mockObs.emit('ConnectionClosed');
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.ok(mockIo.wasEventEmitted('obs:disconnected'), 'Should emit obs:disconnected');
    });

    it('should handle connection error', async () => {
      // Catch the error event that gets re-emitted
      stateSync.on('error', () => {}); // Prevent unhandled error

      const error = new Error('WebSocket connection failed');
      mockObs.emit('ConnectionError', error);
      await new Promise(resolve => setTimeout(resolve, 10));

      const state = stateSync.getState();
      assert.strictEqual(state.connected, false);
      assert.ok(state.connectionError.includes('WebSocket connection failed'));
    });

    it('should broadcast obs:error on connection error', async () => {
      // Catch the error event that gets re-emitted
      stateSync.on('error', () => {}); // Prevent unhandled error

      mockObs.emit('ConnectionError', new Error('Test error'));
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.ok(mockIo.wasEventEmitted('obs:error'), 'Should emit obs:error');
    });

    it('should emit internal events on connection state changes', async () => {
      let connectedEmitted = false;
      let disconnectedEmitted = false;

      stateSync.on('connected', () => { connectedEmitted = true; });
      stateSync.on('disconnected', () => { disconnectedEmitted = true; });

      mockObs.emit('Identified', {});
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(connectedEmitted, 'Should emit connected event');

      mockObs.emit('ConnectionClosed');
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(disconnectedEmitted, 'Should emit disconnected event');
    });
  });

  describe('Scene Events', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
    });

    it('should handle CurrentProgramSceneChanged', async () => {
      mockObs.emit('CurrentProgramSceneChanged', { sceneName: 'Test Scene' });
      await new Promise(resolve => setTimeout(resolve, 10));

      const state = stateSync.getState();
      assert.strictEqual(state.currentScene, 'Test Scene');
      assert.ok(state.lastSync, 'lastSync should be updated');
    });

    it('should broadcast obs:currentSceneChanged with category', async () => {
      mockObs.emit('CurrentProgramSceneChanged', { sceneName: 'Single - Camera 1' });
      await new Promise(resolve => setTimeout(resolve, 10));

      const events = mockIo.getEventsOfType('obs:currentSceneChanged');
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].data.sceneName, 'Single - Camera 1');
      assert.strictEqual(events[0].data.category, 'generated-single');
    });

    it('should broadcast obs:sceneListChanged', async () => {
      mockObs.emit('SceneListChanged', { scenes: [] });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.ok(mockIo.wasEventEmitted('obs:sceneListChanged'));
    });

    it('should broadcast scene item events', async () => {
      mockObs.emit('SceneItemCreated', { sceneName: 'Test', sourceName: 'Source1', sceneItemId: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(mockIo.wasEventEmitted('obs:sceneItemCreated'));

      mockObs.emit('SceneItemRemoved', { sceneName: 'Test', sourceName: 'Source1', sceneItemId: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(mockIo.wasEventEmitted('obs:sceneItemRemoved'));

      mockObs.emit('SceneItemEnableStateChanged', { sceneItemId: 1, sceneItemEnabled: false });
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(mockIo.wasEventEmitted('obs:sceneItemEnableStateChanged'));
    });
  });

  describe('Input Events', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
    });

    it('should broadcast obs:inputCreated', async () => {
      mockObs.emit('InputCreated', { inputName: 'New Input', inputKind: 'browser_source' });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.ok(mockIo.wasEventEmitted('obs:inputCreated'));
    });

    it('should remove input from state on InputRemoved', async () => {
      // Add an input to state first
      stateSync.state.inputs = [{ inputName: 'Test Input' }];

      mockObs.emit('InputRemoved', { inputName: 'Test Input' });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.inputs.length, 0);
      assert.ok(mockIo.wasEventEmitted('obs:inputRemoved'));
    });

    it('should update input name on InputNameChanged', async () => {
      stateSync.state.inputs = [{ inputName: 'Old Name' }];

      mockObs.emit('InputNameChanged', { oldInputName: 'Old Name', inputName: 'New Name' });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.inputs[0].inputName, 'New Name');
    });
  });

  describe('Audio Events', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
      // Add test audio source
      stateSync.state.audioSources = [{ inputName: 'Mic', volumeDb: 0, muted: false }];
    });

    it('should update volume on InputVolumeChanged', async () => {
      mockObs.emit('InputVolumeChanged', {
        inputName: 'Mic',
        inputVolumeDb: -6,
        inputVolumeMul: 0.5
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      const audio = stateSync.state.audioSources.find(a => a.inputName === 'Mic');
      assert.strictEqual(audio.volumeDb, -6);
      assert.strictEqual(audio.volumeMul, 0.5);
    });

    it('should broadcast obs:volumeChanged', async () => {
      mockObs.emit('InputVolumeChanged', {
        inputName: 'Mic',
        inputVolumeDb: -6,
        inputVolumeMul: 0.5
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      const events = mockIo.getEventsOfType('obs:volumeChanged');
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].data.inputName, 'Mic');
      assert.strictEqual(events[0].data.volumeDb, -6);
    });

    it('should update mute state on InputMuteStateChanged', async () => {
      mockObs.emit('InputMuteStateChanged', { inputName: 'Mic', inputMuted: true });
      await new Promise(resolve => setTimeout(resolve, 10));

      const audio = stateSync.state.audioSources.find(a => a.inputName === 'Mic');
      assert.strictEqual(audio.muted, true);
    });

    it('should broadcast obs:muteChanged', async () => {
      mockObs.emit('InputMuteStateChanged', { inputName: 'Mic', inputMuted: true });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.ok(mockIo.wasEventEmitted('obs:muteChanged'));
    });

    it('should handle InputAudioMonitorTypeChanged', async () => {
      mockObs.emit('InputAudioMonitorTypeChanged', {
        inputName: 'Mic',
        monitorType: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      const audio = stateSync.state.audioSources.find(a => a.inputName === 'Mic');
      assert.strictEqual(audio.monitorType, 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT');
    });
  });

  describe('Transition Events', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
    });

    it('should broadcast transition started/ended', async () => {
      mockObs.emit('SceneTransitionStarted', { transitionName: 'Fade' });
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(mockIo.wasEventEmitted('obs:transitionStarted'));

      mockObs.emit('SceneTransitionEnded', { transitionName: 'Fade' });
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(mockIo.wasEventEmitted('obs:transitionEnded'));
    });

    it('should update current transition on CurrentSceneTransitionChanged', async () => {
      mockObs.emit('CurrentSceneTransitionChanged', { transitionName: 'Cut' });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.currentTransition, 'Cut');
    });

    it('should update transition duration on CurrentSceneTransitionDurationChanged', async () => {
      mockObs.emit('CurrentSceneTransitionDurationChanged', { transitionDuration: 500 });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.currentTransitionDuration, 500);
    });
  });

  describe('Stream/Recording Events', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
    });

    it('should update streaming state on StreamStateChanged', async () => {
      mockObs.emit('StreamStateChanged', {
        outputActive: true,
        outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED',
        outputTimecode: '00:00:10.000',
        outputDuration: 10000
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.streaming.active, true);
      assert.strictEqual(stateSync.state.streaming.timecode, '00:00:10.000');
    });

    it('should clear streaming state when stopped', async () => {
      // Start streaming first
      stateSync.state.streaming = { active: true, timecode: '00:05:00.000', duration: 300000 };

      mockObs.emit('StreamStateChanged', {
        outputActive: false,
        outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.streaming.active, false);
      assert.strictEqual(stateSync.state.streaming.timecode, null);
    });

    it('should update recording state on RecordStateChanged', async () => {
      mockObs.emit('RecordStateChanged', {
        outputActive: true,
        outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED',
        outputPath: '/recordings/test.mkv'
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.recording.active, true);
      assert.strictEqual(stateSync.state.recording.path, '/recordings/test.mkv');
    });

    it('should broadcast obs:streamStateChanged', async () => {
      mockObs.emit('StreamStateChanged', { outputActive: true, outputState: 'STARTED' });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.ok(mockIo.wasEventEmitted('obs:streamStateChanged'));
    });
  });

  describe('Studio Mode Events', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
    });

    it('should update studio mode state on StudioModeStateChanged', async () => {
      mockObs.emit('StudioModeStateChanged', { studioModeEnabled: true });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.studioModeEnabled, true);
    });

    it('should update preview scene on CurrentPreviewSceneChanged', async () => {
      mockObs.emit('CurrentPreviewSceneChanged', { sceneName: 'Preview Scene' });
      await new Promise(resolve => setTimeout(resolve, 10));

      assert.strictEqual(stateSync.state.previewScene, 'Preview Scene');
    });

    it('should broadcast obs:previewSceneChanged with category', async () => {
      mockObs.emit('CurrentPreviewSceneChanged', { sceneName: 'Dual - Cam1/Cam2' });
      await new Promise(resolve => setTimeout(resolve, 10));

      const events = mockIo.getEventsOfType('obs:previewSceneChanged');
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].data.category, 'generated-multi');
    });
  });

  describe('Scene Categorization', () => {
    let stateSync;

    beforeEach(() => {
      stateSync = new OBSStateSync(null, null, null);
    });

    it('should categorize single camera scenes correctly', () => {
      assert.strictEqual(stateSync.categorizeScene('Single - Camera 1'), 'generated-single');
      assert.strictEqual(stateSync.categorizeScene('single - Cam A'), 'generated-single');
    });

    it('should categorize multi camera scenes correctly', () => {
      assert.strictEqual(stateSync.categorizeScene('Dual - Cam1/Cam2'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('dual - A/B'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('Triple - 1/2/3'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('Quad - A/B/C/D'), 'generated-multi');
    });

    it('should categorize static scenes correctly', () => {
      assert.strictEqual(stateSync.categorizeScene('Starting Soon'), 'static');
      assert.strictEqual(stateSync.categorizeScene('BRB'), 'static');
      assert.strictEqual(stateSync.categorizeScene('Be Right Back'), 'static');
      assert.strictEqual(stateSync.categorizeScene('Thanks for Watching'), 'static');
    });

    it('should categorize graphics scenes correctly', () => {
      assert.strictEqual(stateSync.categorizeScene('Graphics Fullscreen'), 'graphics');
    });

    it('should categorize unknown scenes as manual', () => {
      assert.strictEqual(stateSync.categorizeScene('My Custom Scene'), 'manual');
      assert.strictEqual(stateSync.categorizeScene('Test'), 'manual');
      assert.strictEqual(stateSync.categorizeScene(''), 'manual');
      assert.strictEqual(stateSync.categorizeScene(null), 'manual');
    });
  });

  describe('Broadcast Functionality', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
    });

    it('should emit to Socket.io when broadcasting', () => {
      stateSync.broadcast('test:event', { foo: 'bar' });

      const events = mockIo.getEventsOfType('test:event');
      assert.strictEqual(events.length, 1);
      assert.deepStrictEqual(events[0].data, { foo: 'bar' });
    });

    it('should emit internal broadcast event', () => {
      let receivedEvent = null;
      stateSync.on('broadcast', (data) => { receivedEvent = data; });

      stateSync.broadcast('test:event', { foo: 'bar' });

      assert.ok(receivedEvent);
      assert.strictEqual(receivedEvent.event, 'test:event');
      assert.deepStrictEqual(receivedEvent.data, { foo: 'bar' });
    });

    it('should not throw if Socket.io is null', () => {
      const stateSyncNoIo = new OBSStateSync(mockObs, null, null);
      // Should not throw
      stateSyncNoIo.broadcast('test:event', {});
    });
  });

  describe('Lifecycle', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
    });

    it('should track initialization state', () => {
      assert.strictEqual(stateSync.isInitialized(), false);
    });

    it('should emit shutdown event on shutdown', async () => {
      let shutdownEmitted = false;
      stateSync.on('shutdown', () => { shutdownEmitted = true; });

      await stateSync.shutdown();

      assert.ok(shutdownEmitted);
      assert.strictEqual(stateSync.isInitialized(), false);
    });
  });

  describe('getState() immutability', () => {
    let stateSync;

    beforeEach(() => {
      stateSync = new OBSStateSync(null, null, null);
    });

    it('should return a copy of state, not the original', () => {
      const state1 = stateSync.getState();
      state1.currentScene = 'Modified';

      const state2 = stateSync.getState();
      assert.notStrictEqual(state2.currentScene, 'Modified');
    });
  });
});

// Run tests and report
console.log('Running OBS State Sync Tests...\n');
