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

    // Legacy naming patterns (still supported for backwards compatibility)
    it('should categorize legacy single camera scenes correctly', () => {
      assert.strictEqual(stateSync.categorizeScene('Single - Camera 1'), 'generated-single');
      assert.strictEqual(stateSync.categorizeScene('single - Cam A'), 'generated-single');
    });

    it('should categorize legacy multi camera scenes correctly', () => {
      assert.strictEqual(stateSync.categorizeScene('Dual - Cam1/Cam2'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('dual - A/B'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('Triple - 1/2/3'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('Quad - A/B/C/D'), 'generated-multi');
    });

    // Template naming patterns (from production templates)
    it('should categorize Full Screen scenes as generated-single', () => {
      assert.strictEqual(stateSync.categorizeScene('Full Screen - Camera A'), 'generated-single');
      assert.strictEqual(stateSync.categorizeScene('Full Screen - Camera B'), 'generated-single');
      assert.strictEqual(stateSync.categorizeScene('full screen - camera c'), 'generated-single');
    });

    it('should categorize Dual View scenes as generated-multi', () => {
      // Dual meet style (left/right position)
      assert.strictEqual(stateSync.categorizeScene('Dual View - Camera A - Left'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('Dual View - Camera A - Right'), 'generated-multi');
      // Quad meet style (camera combinations)
      assert.strictEqual(stateSync.categorizeScene('Dual View - Camera A & Camera B'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('Dual View - Camera C & Camera D'), 'generated-multi');
    });

    it('should categorize Triple View scenes as generated-multi', () => {
      assert.strictEqual(stateSync.categorizeScene('Triple View - Camera A B C'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('Triple View - Camera A B D'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('triple view - cameras'), 'generated-multi');
    });

    it('should categorize Quad View scene as generated-multi', () => {
      assert.strictEqual(stateSync.categorizeScene('Quad View'), 'generated-multi');
      assert.strictEqual(stateSync.categorizeScene('quad view'), 'generated-multi');
    });

    it('should categorize Replay scenes as generated-single', () => {
      assert.strictEqual(stateSync.categorizeScene('Replay - Camera A'), 'generated-single');
      assert.strictEqual(stateSync.categorizeScene('Replay - Camera B'), 'generated-single');
      assert.strictEqual(stateSync.categorizeScene('replay - camera c'), 'generated-single');
    });

    it('should categorize static scenes correctly', () => {
      // Legacy patterns
      assert.strictEqual(stateSync.categorizeScene('Starting Soon'), 'static');
      assert.strictEqual(stateSync.categorizeScene('BRB'), 'static');
      assert.strictEqual(stateSync.categorizeScene('Be Right Back'), 'static');
      assert.strictEqual(stateSync.categorizeScene('Thanks for Watching'), 'static');
      // Template patterns
      assert.strictEqual(stateSync.categorizeScene('Stream Starting Soon'), 'static');
      assert.strictEqual(stateSync.categorizeScene('End Stream'), 'static');
    });

    it('should categorize graphics scenes correctly', () => {
      // Legacy pattern
      assert.strictEqual(stateSync.categorizeScene('Graphics Fullscreen'), 'graphics');
      // Template patterns
      assert.strictEqual(stateSync.categorizeScene('Web-graphics-only-no-video'), 'graphics');
      assert.strictEqual(stateSync.categorizeScene('web-graphics-only-no-video'), 'graphics');
      assert.strictEqual(stateSync.categorizeScene('Graphics-only'), 'graphics');
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

  describe('OBS-02: State Refresh and Caching', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
    });

    describe('refreshFullState()', () => {
      it('should return state without refreshing if not connected', async () => {
        stateSync.state.connected = false;
        const result = await stateSync.refreshFullState();

        assert.strictEqual(result, stateSync.state);
        assert.strictEqual(mockObs.getCallCount('GetSceneList'), 0);
      });

      it('should fetch all OBS state when connected', async () => {
        // Connect first
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        // Clear history after connection
        mockObs.clearHistory();
        mockIo.clearEvents();

        // Refresh state
        const result = await stateSync.refreshFullState();

        // Verify all OBS calls were made
        assert.ok(mockObs.getCallCount('GetSceneList') > 0, 'Should call GetSceneList');
        assert.ok(mockObs.getCallCount('GetInputList') > 0, 'Should call GetInputList');
        assert.ok(mockObs.getCallCount('GetSceneTransitionList') > 0, 'Should call GetSceneTransitionList');
        assert.ok(mockObs.getCallCount('GetStreamStatus') > 0, 'Should call GetStreamStatus');
        assert.ok(mockObs.getCallCount('GetRecordStatus') > 0, 'Should call GetRecordStatus');
        assert.ok(mockObs.getCallCount('GetVideoSettings') > 0, 'Should call GetVideoSettings');
        assert.ok(mockObs.getCallCount('GetStudioModeEnabled') > 0, 'Should call GetStudioModeEnabled');
      });

      it('should update state with fetched data', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        await stateSync.refreshFullState();

        const state = stateSync.getState();

        // Verify state was updated
        assert.ok(Array.isArray(state.scenes), 'scenes should be an array');
        assert.ok(state.scenes.length > 0, 'scenes should have data');
        assert.ok(Array.isArray(state.inputs), 'inputs should be an array');
        assert.ok(Array.isArray(state.transitions), 'transitions should be an array');
        assert.ok(state.lastSync, 'lastSync should be set');
        assert.ok(state.videoSettings.baseWidth, 'videoSettings should be populated');
      });

      it('should broadcast obs:stateUpdated after refresh', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        mockIo.clearEvents();
        await stateSync.refreshFullState();

        assert.ok(mockIo.wasEventEmitted('obs:stateUpdated'), 'Should broadcast obs:stateUpdated');
      });

      it('should handle errors gracefully', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        // Inject error on GetSceneList
        mockObs.injectErrorOnMethod('GetSceneList', new Error('OBS error'));

        await assert.rejects(
          async () => await stateSync.refreshFullState(),
          /OBS error/,
          'Should throw error on OBS failure'
        );

        mockObs.clearErrorOnMethod('GetSceneList');
      });
    });

    describe('fetchScenes()', () => {
      it('should fetch scenes with items and categories', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        const scenes = await stateSync.fetchScenes();

        assert.ok(Array.isArray(scenes), 'Should return array');
        assert.ok(scenes.length > 0, 'Should have scenes');

        // Check scene structure
        const scene = scenes[0];
        assert.ok(scene.sceneName, 'Scene should have name');
        assert.ok('sceneIndex' in scene, 'Scene should have index');
        assert.ok(Array.isArray(scene.items), 'Scene should have items array');
        assert.ok(scene.category, 'Scene should have category');
      });

      it('should categorize scenes correctly', async () => {
        // Add test scenes
        mockObs.addScene('Single - Camera A');
        mockObs.addScene('Dual - Cam1/Cam2');
        mockObs.addScene('Starting Soon');
        mockObs.addScene('Graphics Fullscreen');
        mockObs.addScene('Custom Scene');

        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        const scenes = await stateSync.fetchScenes();

        const singleScene = scenes.find(s => s.sceneName === 'Single - Camera A');
        const dualScene = scenes.find(s => s.sceneName === 'Dual - Cam1/Cam2');
        const staticScene = scenes.find(s => s.sceneName === 'Starting Soon');
        const graphicsScene = scenes.find(s => s.sceneName === 'Graphics Fullscreen');
        const customScene = scenes.find(s => s.sceneName === 'Custom Scene');

        assert.strictEqual(singleScene?.category, 'generated-single');
        assert.strictEqual(dualScene?.category, 'generated-multi');
        assert.strictEqual(staticScene?.category, 'static');
        assert.strictEqual(graphicsScene?.category, 'graphics');
        assert.strictEqual(customScene?.category, 'manual');
      });
    });

    describe('fetchInputs()', () => {
      it('should fetch inputs from OBS', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        const inputs = await stateSync.fetchInputs();

        assert.ok(Array.isArray(inputs), 'Should return array');
        assert.ok(inputs.length > 0, 'Should have inputs');
      });
    });

    describe('fetchTransitions()', () => {
      it('should fetch transitions with current transition info', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        const result = await stateSync.fetchTransitions();

        assert.ok(Array.isArray(result.transitions), 'Should have transitions array');
        assert.ok(result.currentTransition, 'Should have current transition');
        assert.ok(typeof result.currentTransitionDuration === 'number', 'Should have duration');
      });
    });

    describe('extractAudioSources()', () => {
      it('should filter audio-capable inputs', () => {
        const inputs = [
          { inputName: 'Mic', inputKind: 'wasapi_input_capture' },
          { inputName: 'Desktop Audio', inputKind: 'wasapi_output_capture' },
          { inputName: 'Camera', inputKind: 'ffmpeg_source' },
          { inputName: 'Browser', inputKind: 'browser_source' },
          { inputName: 'Image', inputKind: 'image_source' }, // Not audio
          { inputName: 'Color', inputKind: 'color_source' } // Not audio
        ];

        const audioSources = stateSync.extractAudioSources(inputs);

        assert.strictEqual(audioSources.length, 4, 'Should extract 4 audio sources');
        assert.ok(audioSources.find(a => a.inputName === 'Mic'), 'Should include Mic');
        assert.ok(audioSources.find(a => a.inputName === 'Desktop Audio'), 'Should include Desktop Audio');
        assert.ok(audioSources.find(a => a.inputName === 'Camera'), 'Should include Camera (ffmpeg)');
        assert.ok(audioSources.find(a => a.inputName === 'Browser'), 'Should include Browser');
        assert.ok(!audioSources.find(a => a.inputName === 'Image'), 'Should not include Image');
        assert.ok(!audioSources.find(a => a.inputName === 'Color'), 'Should not include Color');
      });

      it('should include default volume and mute values', () => {
        const inputs = [
          { inputName: 'Mic', inputKind: 'wasapi_input_capture' }
        ];

        const audioSources = stateSync.extractAudioSources(inputs);

        assert.strictEqual(audioSources[0].volumeDb, 0);
        assert.strictEqual(audioSources[0].volumeMul, 1);
        assert.strictEqual(audioSources[0].muted, false);
      });
    });

    describe('mapStreamStatus()', () => {
      it('should map active stream status', () => {
        const response = {
          outputActive: true,
          outputTimecode: '00:05:30.000',
          outputDuration: 330000
        };

        const result = stateSync.mapStreamStatus(response);

        assert.strictEqual(result.active, true);
        assert.strictEqual(result.timecode, '00:05:30.000');
        assert.strictEqual(result.duration, 330000);
      });

      it('should map inactive stream status', () => {
        const response = {
          outputActive: false,
          outputTimecode: '00:00:00.000',
          outputDuration: 0
        };

        const result = stateSync.mapStreamStatus(response);

        assert.strictEqual(result.active, false);
        assert.strictEqual(result.timecode, null);
        assert.strictEqual(result.duration, null);
      });
    });

    describe('mapRecordStatus()', () => {
      it('should map active recording status', () => {
        const response = {
          outputActive: true,
          outputPaused: false,
          outputTimecode: '00:10:00.000',
          outputDuration: 600000
        };

        const result = stateSync.mapRecordStatus(response);

        assert.strictEqual(result.active, true);
        assert.strictEqual(result.paused, false);
        assert.strictEqual(result.timecode, '00:10:00.000');
        assert.strictEqual(result.duration, 600000);
      });

      it('should map inactive recording status', () => {
        const response = {
          outputActive: false,
          outputTimecode: '00:00:00.000',
          outputDuration: 0
        };

        const result = stateSync.mapRecordStatus(response);

        assert.strictEqual(result.active, false);
        assert.strictEqual(result.timecode, null);
        assert.strictEqual(result.duration, null);
      });
    });

    describe('refreshScenes()', () => {
      it('should update state scenes', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        const result = await stateSync.refreshScenes();

        assert.ok(Array.isArray(result), 'Should return array');
        assert.strictEqual(result, stateSync.state.scenes, 'Should update state');
        assert.ok(stateSync.state.lastSync, 'Should update lastSync');
      });

      it('should return current state if not connected', async () => {
        stateSync.state.connected = false;
        const result = await stateSync.refreshScenes();

        assert.strictEqual(result, stateSync.state.scenes);
        assert.strictEqual(mockObs.getCallCount('GetSceneList'), 0);
      });
    });

    describe('refreshInputs()', () => {
      it('should update state inputs and audio sources', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 10));

        const result = await stateSync.refreshInputs();

        assert.ok(Array.isArray(result), 'Should return array');
        assert.strictEqual(result, stateSync.state.inputs, 'Should update state');
        assert.ok(Array.isArray(stateSync.state.audioSources), 'Should update audioSources');
        assert.ok(stateSync.state.lastSync, 'Should update lastSync');
      });

      it('should return current state if not connected', async () => {
        stateSync.state.connected = false;
        const result = await stateSync.refreshInputs();

        assert.strictEqual(result, stateSync.state.inputs);
        assert.strictEqual(mockObs.getCallCount('GetInputList'), 0);
      });
    });

    describe('Periodic Sync', () => {
      it('should start periodic sync', () => {
        stateSync.startPeriodicSync(1000);
        assert.ok(stateSync._syncInterval, 'Should set sync interval');
      });

      it('should not start if already running', () => {
        stateSync.startPeriodicSync(1000);
        const firstInterval = stateSync._syncInterval;

        stateSync.startPeriodicSync(1000);
        assert.strictEqual(stateSync._syncInterval, firstInterval, 'Should keep same interval');

        stateSync.stopPeriodicSync();
      });

      it('should stop periodic sync', () => {
        stateSync.startPeriodicSync(1000);
        stateSync.stopPeriodicSync();

        assert.strictEqual(stateSync._syncInterval, null, 'Should clear interval');
      });

      it('should call refreshFullState periodically when connected', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 50));

        mockObs.clearHistory();

        stateSync.startPeriodicSync(100);

        // Wait for at least one sync cycle
        await new Promise(resolve => setTimeout(resolve, 150));

        stateSync.stopPeriodicSync();

        // Should have called OBS methods during periodic sync
        assert.ok(mockObs.getCallCount('GetSceneList') > 0, 'Should sync periodically');
      });

      it('should stop periodic sync on shutdown', async () => {
        stateSync.startPeriodicSync(1000);
        assert.ok(stateSync._syncInterval, 'Sync should be running');

        await stateSync.shutdown();

        assert.strictEqual(stateSync._syncInterval, null, 'Should stop sync on shutdown');
      });
    });

    describe('Integration: onConnected', () => {
      it('should trigger full state refresh on connection', async () => {
        mockObs.clearHistory();

        await mockObs.connect();
        mockObs.emit('Identified', {});

        // Wait for connection and refresh
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify state refresh was triggered
        assert.ok(mockObs.getCallCount('GetSceneList') > 0, 'Should fetch scenes');
        assert.ok(mockObs.getCallCount('GetInputList') > 0, 'Should fetch inputs');

        const state = stateSync.getState();
        assert.ok(state.connected, 'Should be connected');
        assert.ok(state.lastSync, 'Should have lastSync timestamp');
      });
    });
  });

  describe('OBS-03: Firebase Persistence', () => {
    let stateSync, mockObs, mockIo, mockFirebase;

    beforeEach(() => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      mockFirebase = createMockFirebase();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();
    });

    describe('initialize() with Firebase', () => {
      it('should load cached state from Firebase on initialization', async () => {
        // Set up cached state in mock Firebase
        const cachedState = {
          connected: false,
          lastSync: '2024-01-15T10:00:00.000Z',
          currentScene: 'Single - Camera 1',
          scenes: [{ sceneName: 'Single - Camera 1', category: 'generated-single' }],
          inputs: [],
          audioSources: [],
          transitions: [],
          streaming: { active: false },
          recording: { active: false },
          videoSettings: {}
        };

        mockFirebase._setData('competitions/test-comp/obs/state', cachedState);

        // Mock Firebase into the stateSync instance
        stateSync._db = mockFirebase.database();
        stateSync.competitionId = 'test-comp';

        // Load cached state
        await stateSync._loadCachedState();

        const state = stateSync.getState();
        assert.strictEqual(state.currentScene, 'Single - Camera 1', 'Should load cached currentScene');
        assert.strictEqual(state.lastSync, '2024-01-15T10:00:00.000Z', 'Should load cached lastSync');
        assert.strictEqual(state.connected, false, 'Should reset connected to false on load');
      });

      it('should use initial state if no cached state exists', async () => {
        stateSync._db = mockFirebase.database();
        stateSync.competitionId = 'test-comp';

        await stateSync._loadCachedState();

        const state = stateSync.getState();
        assert.strictEqual(state.currentScene, null, 'Should use initial state');
        assert.strictEqual(state.lastSync, null);
      });

      it('should handle errors when loading cached state', async () => {
        // Create a mock database that throws an error
        const errorDb = {
          ref: () => ({
            once: async () => {
              throw new Error('Firebase read error');
            }
          })
        };

        stateSync._db = errorDb;
        stateSync.competitionId = 'test-comp';

        // Should not throw, just continue with initial state
        await stateSync._loadCachedState();

        const state = stateSync.getState();
        assert.strictEqual(state.currentScene, null, 'Should fall back to initial state');
      });
    });

    describe('_saveState()', () => {
      beforeEach(() => {
        stateSync._db = mockFirebase.database();
        stateSync.competitionId = 'test-comp';
      });

      it('should save state to Firebase at correct path', async () => {
        stateSync.state.currentScene = 'Test Scene';
        stateSync.state.connected = true;

        await stateSync._saveState();

        const savedState = mockFirebase._getData('competitions/test-comp/obs/state');
        assert.ok(savedState, 'State should be saved');
        assert.strictEqual(savedState.currentScene, 'Test Scene');
        assert.strictEqual(savedState.connected, true);
      });

      it('should update lastSync timestamp when saving', async () => {
        const beforeSave = new Date().toISOString();
        await stateSync._saveState();

        const savedState = mockFirebase._getData('competitions/test-comp/obs/state');
        assert.ok(savedState.lastSync, 'lastSync should be set');
        assert.ok(savedState.lastSync >= beforeSave, 'lastSync should be recent');
      });

      it('should not save if database is not initialized', async () => {
        stateSync._db = null;

        // Should not throw, just log warning
        await stateSync._saveState();

        const savedState = mockFirebase._getData('competitions/test-comp/obs/state');
        assert.strictEqual(savedState, undefined, 'Should not save without db');
      });

      it('should not save if competitionId is not set', async () => {
        stateSync.competitionId = null;

        await stateSync._saveState();

        const savedState = mockFirebase._getData('competitions/test-comp/obs/state');
        assert.strictEqual(savedState, undefined, 'Should not save without competitionId');
      });

      it('should throw error if Firebase set fails', async () => {
        const errorDb = {
          ref: () => ({
            set: async () => {
              throw new Error('Firebase write error');
            }
          })
        };

        stateSync._db = errorDb;

        await assert.rejects(
          async () => await stateSync._saveState(),
          /Firebase write error/,
          'Should throw error on Firebase failure'
        );
      });
    });

    describe('State persistence on events', () => {
      beforeEach(() => {
        stateSync._db = mockFirebase.database();
        stateSync.competitionId = 'test-comp';
      });

      it('should save state after full refresh', async () => {
        await mockObs.connect();
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 50));

        mockFirebase._clearData();

        await stateSync.refreshFullState();

        const savedState = mockFirebase._getData('competitions/test-comp/obs/state');
        assert.ok(savedState, 'State should be saved after refresh');
        assert.ok(savedState.lastSync, 'lastSync should be set');
      });

      it('should save state on connection closed', async () => {
        stateSync.state.connected = true;
        mockFirebase._clearData();

        await stateSync.onConnectionClosed();

        const savedState = mockFirebase._getData('competitions/test-comp/obs/state');
        assert.ok(savedState, 'State should be saved on disconnect');
        assert.strictEqual(savedState.connected, false);
        assert.strictEqual(savedState.connectionError, 'Connection closed');
      });

      it('should save state on connection error', async () => {
        mockFirebase._clearData();

        // Catch error event to prevent unhandled error
        stateSync.on('error', () => {});

        await stateSync.onConnectionError(new Error('Test connection error'));

        const savedState = mockFirebase._getData('competitions/test-comp/obs/state');
        assert.ok(savedState, 'State should be saved on error');
        assert.strictEqual(savedState.connected, false);
        assert.ok(savedState.connectionError.includes('Test connection error'));
      });

      it('should save state on current scene changed', async () => {
        mockFirebase._clearData();

        await stateSync.onCurrentProgramSceneChanged({ sceneName: 'New Scene' });

        const savedState = mockFirebase._getData('competitions/test-comp/obs/state');
        assert.ok(savedState, 'State should be saved on scene change');
        assert.strictEqual(savedState.currentScene, 'New Scene');
      });

      it('should handle save errors gracefully without crashing', async () => {
        const errorDb = {
          ref: () => ({
            set: async () => {
              throw new Error('Firebase write error');
            }
          })
        };

        stateSync._db = errorDb;

        // Should not throw, just log error
        await stateSync.onCurrentProgramSceneChanged({ sceneName: 'Test' });

        // State should still be updated locally
        assert.strictEqual(stateSync.state.currentScene, 'Test');
      });
    });

    describe('State recovery after reconnection', () => {
      beforeEach(() => {
        stateSync._db = mockFirebase.database();
        stateSync.competitionId = 'test-comp';
      });

      it('should refresh full state on reconnection', async () => {
        // Simulate disconnect
        stateSync.state.connected = false;

        await mockObs.connect();
        mockObs.clearHistory();

        // Simulate reconnection (Identified event triggers onConnected)
        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify full state refresh was called
        assert.ok(mockObs.getCallCount('GetSceneList') > 0, 'Should refresh scenes on reconnect');
        assert.ok(mockObs.getCallCount('GetInputList') > 0, 'Should refresh inputs on reconnect');
        assert.ok(stateSync.state.connected, 'Should be connected');
      });

      it('should broadcast state update after reconnection', async () => {
        await mockObs.connect();
        mockIo.clearEvents();

        mockObs.emit('Identified', {});
        await new Promise(resolve => setTimeout(resolve, 50));

        assert.ok(mockIo.wasEventEmitted('obs:connected'), 'Should broadcast connected');
        assert.ok(mockIo.wasEventEmitted('obs:stateUpdated'), 'Should broadcast state update');
      });
    });

    describe('Integration: Firebase path structure', () => {
      it('should use correct Firebase path pattern', async () => {
        stateSync._db = mockFirebase.database();
        stateSync.competitionId = 'pac12-2025';

        stateSync.state.currentScene = 'Test';
        await stateSync._saveState();

        // Verify path structure
        const savedState = mockFirebase._getData('competitions/pac12-2025/obs/state');
        assert.ok(savedState, 'Should save at competitions/{compId}/obs/state');
      });
    });
  });

  describe('OBS-23: Preview and Studio Mode', () => {
    let stateSync, mockObs, mockIo;

    beforeEach(async () => {
      mockObs = new MockOBSWebSocket();
      mockIo = createMockSocketIO();
      stateSync = new OBSStateSync(mockObs, mockIo, null);
      stateSync.registerEventHandlers();

      // Connect to OBS for these tests
      await mockObs.connect();
      mockObs.emit('Identified', {});
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    describe('takeScreenshot()', () => {
      it('should return base64 image for current scene when no sceneName provided', async () => {
        stateSync.state.currentScene = 'Starting Soon';

        const imageData = await stateSync.takeScreenshot();

        assert.ok(imageData, 'Should return image data');
        assert.ok(imageData.includes('base64'), 'Should be base64 encoded');
        assert.ok(mockObs.wasCalledWith('GetSourceScreenshot', { sourceName: 'Starting Soon' }), 'Should call GetSourceScreenshot with current scene');
      });

      it('should return base64 image for specific scene', async () => {
        const imageData = await stateSync.takeScreenshot('BRB');

        assert.ok(imageData, 'Should return image data');
        assert.ok(imageData.includes('base64'), 'Should be base64 encoded');
        assert.ok(mockObs.wasCalledWith('GetSourceScreenshot', { sourceName: 'BRB' }), 'Should call GetSourceScreenshot with specified scene');
      });

      it('should pass imageFormat option to OBS', async () => {
        await stateSync.takeScreenshot('BRB', { imageFormat: 'jpg' });

        const calls = mockObs.getCallsTo('GetSourceScreenshot');
        assert.strictEqual(calls[0].params.imageFormat, 'jpg');
      });

      it('should pass imageWidth and imageHeight options to OBS', async () => {
        await stateSync.takeScreenshot('BRB', {
          imageWidth: 1280,
          imageHeight: 720
        });

        const calls = mockObs.getCallsTo('GetSourceScreenshot');
        assert.strictEqual(calls[0].params.imageWidth, 1280);
        assert.strictEqual(calls[0].params.imageHeight, 720);
      });

      it('should default to png format if not specified', async () => {
        await stateSync.takeScreenshot('BRB');

        const calls = mockObs.getCallsTo('GetSourceScreenshot');
        assert.strictEqual(calls[0].params.imageFormat, 'png');
      });

      it('should throw error if not connected', async () => {
        stateSync.state.connected = false;

        await assert.rejects(
          async () => await stateSync.takeScreenshot(),
          /not connected to OBS/,
          'Should throw error when not connected'
        );
      });

      it('should throw error if no scene specified and no current scene', async () => {
        stateSync.state.currentScene = null;

        await assert.rejects(
          async () => await stateSync.takeScreenshot(),
          /No scene specified and no current scene available/,
          'Should throw error when no scene available'
        );
      });

      it('should handle OBS errors gracefully', async () => {
        mockObs.injectErrorOnMethod('GetSourceScreenshot', new Error('OBS screenshot failed'));

        await assert.rejects(
          async () => await stateSync.takeScreenshot('BRB'),
          /OBS screenshot failed/,
          'Should throw OBS error'
        );

        mockObs.clearErrorOnMethod('GetSourceScreenshot');
      });

      it('should throw error if scene does not exist', async () => {
        await assert.rejects(
          async () => await stateSync.takeScreenshot('NonExistentScene'),
          /Source not found/,
          'Should throw error for non-existent scene'
        );
      });
    });

    describe('getStudioModeStatus()', () => {
      it('should return enabled status when studio mode is on', async () => {
        mockObs._studioModeEnabled = true;

        const result = await stateSync.getStudioModeStatus();

        assert.ok(result, 'Should return result');
        assert.strictEqual(result.studioModeEnabled, true);
      });

      it('should return disabled status when studio mode is off', async () => {
        mockObs._studioModeEnabled = false;

        const result = await stateSync.getStudioModeStatus();

        assert.ok(result, 'Should return result');
        assert.strictEqual(result.studioModeEnabled, false);
      });

      it('should throw error if not connected', async () => {
        stateSync.state.connected = false;

        await assert.rejects(
          async () => await stateSync.getStudioModeStatus(),
          /not connected to OBS/,
          'Should throw error when not connected'
        );
      });

      it('should handle OBS errors gracefully', async () => {
        mockObs.injectErrorOnMethod('GetStudioModeEnabled', new Error('OBS error'));

        await assert.rejects(
          async () => await stateSync.getStudioModeStatus(),
          /OBS error/,
          'Should throw OBS error'
        );

        mockObs.clearErrorOnMethod('GetStudioModeEnabled');
      });
    });

    describe('setStudioMode()', () => {
      it('should enable studio mode', async () => {
        mockObs._studioModeEnabled = false;

        await stateSync.setStudioMode(true);

        assert.ok(mockObs.wasCalledWith('SetStudioModeEnabled', { studioModeEnabled: true }));
      });

      it('should disable studio mode', async () => {
        mockObs._studioModeEnabled = true;

        await stateSync.setStudioMode(false);

        assert.ok(mockObs.wasCalledWith('SetStudioModeEnabled', { studioModeEnabled: false }));
      });

      it('should emit StudioModeStateChanged event', async () => {
        mockIo.clearEvents();

        await stateSync.setStudioMode(true);

        // Wait for event emission
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(mockIo.wasEventEmitted('obs:studioModeChanged'), 'Should broadcast studio mode change');
      });

      it('should throw error if not connected', async () => {
        stateSync.state.connected = false;

        await assert.rejects(
          async () => await stateSync.setStudioMode(true),
          /not connected to OBS/,
          'Should throw error when not connected'
        );
      });

      it('should handle OBS errors gracefully', async () => {
        mockObs.injectErrorOnMethod('SetStudioModeEnabled', new Error('OBS error'));

        await assert.rejects(
          async () => await stateSync.setStudioMode(true),
          /OBS error/,
          'Should throw OBS error'
        );

        mockObs.clearErrorOnMethod('SetStudioModeEnabled');
      });
    });

    describe('setPreviewScene()', () => {
      beforeEach(async () => {
        // Enable studio mode for these tests
        mockObs._studioModeEnabled = true;
        stateSync.state.studioModeEnabled = true;
      });

      it('should set preview scene when studio mode enabled', async () => {
        await stateSync.setPreviewScene('BRB');

        assert.ok(mockObs.wasCalledWith('SetCurrentPreviewScene', { sceneName: 'BRB' }));
      });

      it('should emit CurrentPreviewSceneChanged event', async () => {
        mockIo.clearEvents();

        await stateSync.setPreviewScene('BRB');

        // Wait for event emission
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(mockIo.wasEventEmitted('obs:previewSceneChanged'), 'Should broadcast preview scene change');
      });

      it('should throw error if studio mode not enabled', async () => {
        stateSync.state.studioModeEnabled = false;

        await assert.rejects(
          async () => await stateSync.setPreviewScene('BRB'),
          /studio mode is not enabled/,
          'Should throw error when studio mode disabled'
        );
      });

      it('should throw error if not connected', async () => {
        stateSync.state.connected = false;

        await assert.rejects(
          async () => await stateSync.setPreviewScene('BRB'),
          /not connected to OBS/,
          'Should throw error when not connected'
        );
      });

      it('should throw error if scene does not exist', async () => {
        await assert.rejects(
          async () => await stateSync.setPreviewScene('NonExistentScene'),
          /Scene not found/,
          'Should throw error for non-existent scene'
        );
      });

      it('should handle OBS errors gracefully', async () => {
        mockObs.injectErrorOnMethod('SetCurrentPreviewScene', new Error('OBS error'));

        await assert.rejects(
          async () => await stateSync.setPreviewScene('BRB'),
          /OBS error/,
          'Should throw OBS error'
        );

        mockObs.clearErrorOnMethod('SetCurrentPreviewScene');
      });
    });

    describe('executeTransition()', () => {
      beforeEach(async () => {
        // Enable studio mode and set preview scene for these tests
        mockObs._studioModeEnabled = true;
        stateSync.state.studioModeEnabled = true;
        mockObs._currentScene = 'Starting Soon';
        mockObs._previewScene = 'BRB';
      });

      it('should execute transition when studio mode enabled', async () => {
        await stateSync.executeTransition();

        assert.ok(mockObs.getCallCount('TriggerStudioModeTransition') > 0, 'Should call TriggerStudioModeTransition');
      });

      it('should emit transition events', async () => {
        mockIo.clearEvents();

        await stateSync.executeTransition();

        // Wait for events to be emitted
        await new Promise(resolve => setTimeout(resolve, 50));

        assert.ok(mockIo.wasEventEmitted('obs:transitionStarted'), 'Should broadcast transition started');
        assert.ok(mockIo.wasEventEmitted('obs:transitionEnded'), 'Should broadcast transition ended');
      });

      it('should update current scene after transition', async () => {
        const initialScene = mockObs._currentScene;
        const previewScene = mockObs._previewScene;

        await stateSync.executeTransition();

        // Wait for transition to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        // The preview scene should now be the current scene
        assert.notStrictEqual(mockObs._currentScene, initialScene);
        assert.strictEqual(mockObs._currentScene, previewScene);
      });

      it('should throw error if studio mode not enabled', async () => {
        stateSync.state.studioModeEnabled = false;

        await assert.rejects(
          async () => await stateSync.executeTransition(),
          /studio mode is not enabled/,
          'Should throw error when studio mode disabled'
        );
      });

      it('should throw error if not connected', async () => {
        stateSync.state.connected = false;

        await assert.rejects(
          async () => await stateSync.executeTransition(),
          /not connected to OBS/,
          'Should throw error when not connected'
        );
      });

      it('should handle OBS errors gracefully', async () => {
        mockObs.injectErrorOnMethod('TriggerStudioModeTransition', new Error('OBS error'));

        await assert.rejects(
          async () => await stateSync.executeTransition(),
          /OBS error/,
          'Should throw OBS error'
        );

        mockObs.clearErrorOnMethod('TriggerStudioModeTransition');
      });
    });

    describe('Integration: Studio Mode Workflow', () => {
      it('should support full studio mode workflow', async () => {
        // Start with studio mode disabled
        mockObs._studioModeEnabled = false;
        stateSync.state.studioModeEnabled = false;

        // 1. Enable studio mode
        await stateSync.setStudioMode(true);
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.strictEqual(mockObs._studioModeEnabled, true);

        // Update state to match
        stateSync.state.studioModeEnabled = true;

        // 2. Set preview scene
        await stateSync.setPreviewScene('BRB');
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.strictEqual(mockObs._previewScene, 'BRB');

        // 3. Execute transition
        mockObs._currentScene = 'Starting Soon';
        await stateSync.executeTransition();
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(mockObs._currentScene, 'BRB');

        // 4. Disable studio mode
        await stateSync.setStudioMode(false);
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.strictEqual(mockObs._studioModeEnabled, false);
      });

      it('should take screenshots at any time regardless of studio mode', async () => {
        // With studio mode disabled
        mockObs._studioModeEnabled = false;
        let imageData = await stateSync.takeScreenshot('Starting Soon');
        assert.ok(imageData, 'Should take screenshot with studio mode disabled');

        // With studio mode enabled
        mockObs._studioModeEnabled = true;
        imageData = await stateSync.takeScreenshot('BRB');
        assert.ok(imageData, 'Should take screenshot with studio mode enabled');
      });
    });
  });
});

// Run tests and report
console.log('Running OBS State Sync Tests...\n');
