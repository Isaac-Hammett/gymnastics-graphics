/**
 * Mock OBS WebSocket for testing
 *
 * Provides a comprehensive mock of obs-websocket-js that:
 * - Tracks all method calls for verification
 * - Simulates realistic OBS state
 * - Supports event emission for testing event handlers
 * - Can be configured to throw errors for error handling tests
 */

import { EventEmitter } from 'events';

/**
 * Mock OBS WebSocket class
 * Extends EventEmitter to support event-based testing
 */
export class MockOBSWebSocket extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.options = {
      autoConnect: options.autoConnect ?? true,
      simulateLatency: options.simulateLatency ?? 0,
      ...options
    };

    // Internal state
    this._connected = false;
    this._scenes = new Map();
    this._inputs = new Map();
    this._audioSources = new Map();
    this._transitions = new Map();
    this._currentScene = null;
    this._currentTransition = 'Fade';
    this._transitionDuration = 300;
    this._studioModeEnabled = false;
    this._previewScene = null;
    this._streaming = false;
    this._recording = false;
    this._streamServiceType = 'rtmp_common';
    this._streamServiceSettings = {
      server: 'rtmp://a.rtmp.youtube.com/live2',
      key: 'test-stream-key-abc123'
    };

    // Call tracking for assertions
    this._callHistory = [];
    this._eventHistory = [];

    // Error injection
    this._errorOnNextCall = null;
    this._errorOnMethod = new Map();

    // Initialize default state
    this._initializeDefaultState();
  }

  /**
   * Initialize default OBS state
   */
  _initializeDefaultState() {
    // Default scenes
    this._scenes.set('Starting Soon', {
      sceneName: 'Starting Soon',
      sceneIndex: 0,
      items: []
    });
    this._scenes.set('BRB', {
      sceneName: 'BRB',
      sceneIndex: 1,
      items: []
    });
    this._scenes.set('Single - Camera 1', {
      sceneName: 'Single - Camera 1',
      sceneIndex: 2,
      items: [
        { sceneItemId: 1, sourceName: 'Camera 1 SRT', sceneItemEnabled: true }
      ]
    });

    // Default inputs (including audio sources)
    this._inputs.set('Camera 1 SRT', {
      inputName: 'Camera 1 SRT',
      inputKind: 'ffmpeg_source',
      settings: { url: 'srt://example.com:1234' }
    });
    this._inputs.set('Microphone', {
      inputName: 'Microphone',
      inputKind: 'wasapi_input_capture',
      settings: {}
    });

    // Default transitions
    this._transitions.set('Fade', { transitionName: 'Fade', transitionKind: 'fade_transition' });
    this._transitions.set('Cut', { transitionName: 'Cut', transitionKind: 'cut_transition' });

    // Set current scene
    this._currentScene = 'Starting Soon';
  }

  /**
   * Simulate connection to OBS
   */
  async connect(url, password) {
    this._recordCall('connect', { url, password });

    if (this._errorOnMethod.has('connect')) {
      throw this._errorOnMethod.get('connect');
    }

    await this._simulateLatency();
    this._connected = true;

    // Emit Identified event (OBS 5.x connection success)
    setImmediate(() => {
      this.emit('Identified', { negotiatedRpcVersion: 1 });
    });

    return { negotiatedRpcVersion: 1 };
  }

  /**
   * Disconnect from OBS
   */
  async disconnect() {
    this._recordCall('disconnect', {});
    this._connected = false;

    setImmediate(() => {
      this.emit('ConnectionClosed');
    });
  }

  /**
   * Main call method - routes to appropriate handler
   */
  async call(method, params = {}) {
    this._recordCall(method, params);

    // Check for injected errors
    if (this._errorOnNextCall) {
      const error = this._errorOnNextCall;
      this._errorOnNextCall = null;
      throw error;
    }

    if (this._errorOnMethod.has(method)) {
      throw this._errorOnMethod.get(method);
    }

    await this._simulateLatency();

    // Route to handler
    const handler = this._methodHandlers[method];
    if (handler) {
      return handler.call(this, params);
    }

    // Default: return empty object for unknown methods
    console.warn(`[MockOBS] Unknown method: ${method}`);
    return {};
  }

  /**
   * Method handlers
   */
  _methodHandlers = {
    // Scene methods
    GetSceneList: function() {
      const scenes = Array.from(this._scenes.values()).map(s => ({
        sceneName: s.sceneName,
        sceneIndex: s.sceneIndex
      }));
      return {
        currentProgramSceneName: this._currentScene,
        currentPreviewSceneName: this._previewScene,
        scenes
      };
    },

    GetCurrentProgramScene: function() {
      return { currentProgramSceneName: this._currentScene };
    },

    SetCurrentProgramScene: function(params) {
      const { sceneName } = params;
      if (!this._scenes.has(sceneName)) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      const oldScene = this._currentScene;
      this._currentScene = sceneName;

      setImmediate(() => {
        this.emit('CurrentProgramSceneChanged', { sceneName });
      });

      return {};
    },

    CreateScene: function(params) {
      const { sceneName } = params;
      if (this._scenes.has(sceneName)) {
        const error = new Error(`Scene already exists: ${sceneName}`);
        error.code = 601;
        throw error;
      }
      this._scenes.set(sceneName, {
        sceneName,
        sceneIndex: this._scenes.size,
        items: []
      });

      setImmediate(() => {
        this.emit('SceneListChanged', { scenes: this.call('GetSceneList').scenes });
      });

      return {};
    },

    RemoveScene: function(params) {
      const { sceneName } = params;
      if (!this._scenes.has(sceneName)) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      this._scenes.delete(sceneName);

      setImmediate(() => {
        this.emit('SceneListChanged', { scenes: this.call('GetSceneList').scenes });
      });

      return {};
    },

    SetSceneName: function(params) {
      const { sceneName, newSceneName } = params;
      if (!this._scenes.has(sceneName)) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      if (this._scenes.has(newSceneName)) {
        const error = new Error(`Scene name already in use: ${newSceneName}`);
        error.code = 602;
        throw error;
      }
      const scene = this._scenes.get(sceneName);
      this._scenes.delete(sceneName);
      scene.sceneName = newSceneName;
      this._scenes.set(newSceneName, scene);

      // Update current scene if it was renamed
      if (this._currentScene === sceneName) {
        this._currentScene = newSceneName;
      }

      setImmediate(() => {
        this.emit('SceneListChanged', { scenes: this.call('GetSceneList').scenes });
      });

      return {};
    },

    GetSceneItemList: function(params) {
      const { sceneName } = params;
      const scene = this._scenes.get(sceneName);
      if (!scene) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      return { sceneItems: scene.items };
    },

    // Input methods
    GetInputList: function() {
      return {
        inputs: Array.from(this._inputs.values())
      };
    },

    GetInputSettings: function(params) {
      const { inputName } = params;
      const input = this._inputs.get(inputName);
      if (!input) {
        const error = new Error(`Input not found: ${inputName}`);
        error.code = 600;
        throw error;
      }
      return {
        inputSettings: input.settings || {},
        inputKind: input.inputKind
      };
    },

    CreateInput: function(params) {
      const { inputName, inputKind, inputSettings, sceneName } = params;
      if (this._inputs.has(inputName)) {
        const error = new Error(`Input already exists: ${inputName}`);
        error.code = 601;
        throw error;
      }
      this._inputs.set(inputName, {
        inputName,
        inputKind,
        settings: inputSettings || {}
      });

      setImmediate(() => {
        this.emit('InputCreated', { inputName, inputKind });
      });

      return { sceneItemId: Math.floor(Math.random() * 10000) };
    },

    SetInputSettings: function(params) {
      const { inputName, inputSettings } = params;
      const input = this._inputs.get(inputName);
      if (!input) {
        const error = new Error(`Input not found: ${inputName}`);
        error.code = 600;
        throw error;
      }
      input.settings = { ...input.settings, ...inputSettings };

      setImmediate(() => {
        this.emit('InputSettingsChanged', { inputName, inputSettings });
      });

      return {};
    },

    RemoveInput: function(params) {
      const { inputName } = params;
      if (!this._inputs.has(inputName)) {
        const error = new Error(`Input not found: ${inputName}`);
        error.code = 600;
        throw error;
      }
      this._inputs.delete(inputName);

      setImmediate(() => {
        this.emit('InputRemoved', { inputName });
      });

      return {};
    },

    // Audio methods
    GetInputVolume: function(params) {
      const { inputName } = params;
      const audio = this._audioSources.get(inputName) || { volumeDb: 0, volumeMul: 1 };
      return {
        inputVolumeDb: audio.volumeDb,
        inputVolumeMul: audio.volumeMul
      };
    },

    SetInputVolume: function(params) {
      const { inputName, inputVolumeDb, inputVolumeMul } = params;
      const audio = this._audioSources.get(inputName) || {};
      if (inputVolumeDb !== undefined) audio.volumeDb = inputVolumeDb;
      if (inputVolumeMul !== undefined) audio.volumeMul = inputVolumeMul;
      this._audioSources.set(inputName, audio);

      setImmediate(() => {
        this.emit('InputVolumeChanged', { inputName, inputVolumeDb: audio.volumeDb, inputVolumeMul: audio.volumeMul });
      });

      return {};
    },

    GetInputMute: function(params) {
      const { inputName } = params;
      const audio = this._audioSources.get(inputName) || { muted: false };
      return { inputMuted: audio.muted };
    },

    SetInputMute: function(params) {
      const { inputName, inputMuted } = params;
      const audio = this._audioSources.get(inputName) || {};
      audio.muted = inputMuted;
      this._audioSources.set(inputName, audio);

      setImmediate(() => {
        this.emit('InputMuteStateChanged', { inputName, inputMuted });
      });

      return {};
    },

    GetInputAudioMonitorType: function(params) {
      const { inputName } = params;
      const audio = this._audioSources.get(inputName) || { monitorType: 'OBS_MONITORING_TYPE_NONE' };
      return { monitorType: audio.monitorType || 'OBS_MONITORING_TYPE_NONE' };
    },

    SetInputAudioMonitorType: function(params) {
      const { inputName, monitorType } = params;
      const audio = this._audioSources.get(inputName) || {};
      audio.monitorType = monitorType;
      this._audioSources.set(inputName, audio);

      setImmediate(() => {
        this.emit('InputAudioMonitorTypeChanged', { inputName, monitorType });
      });

      return {};
    },

    // Transition methods
    GetSceneTransitionList: function() {
      return {
        currentSceneTransitionName: this._currentTransition,
        currentSceneTransitionDuration: this._transitionDuration,
        transitions: Array.from(this._transitions.values())
      };
    },

    SetCurrentSceneTransition: function(params) {
      const { transitionName } = params;
      if (!this._transitions.has(transitionName)) {
        const error = new Error(`Transition not found: ${transitionName}`);
        error.code = 600;
        throw error;
      }
      this._currentTransition = transitionName;

      setImmediate(() => {
        this.emit('CurrentSceneTransitionChanged', { transitionName });
      });

      return {};
    },

    SetCurrentSceneTransitionDuration: function(params) {
      const { transitionDuration } = params;
      this._transitionDuration = transitionDuration;

      setImmediate(() => {
        this.emit('CurrentSceneTransitionDurationChanged', { transitionDuration });
      });

      return {};
    },

    GetTransitionKind: function(params) {
      const { transitionName } = params;
      const transition = this._transitions.get(transitionName);
      if (!transition) {
        const error = new Error(`Transition not found: ${transitionName}`);
        error.code = 600;
        throw error;
      }
      return {
        transitionKind: transition.transitionKind
      };
    },

    GetCurrentSceneTransitionCursor: function() {
      return {
        transitionCursor: 0.0  // 0.0 to 1.0, 0 when not transitioning
      };
    },

    SetCurrentSceneTransitionSettings: function(params) {
      const { transitionName, transitionSettings, overlay } = params;
      const transition = this._transitions.get(transitionName);
      if (!transition) {
        const error = new Error(`Transition not found: ${transitionName}`);
        error.code = 600;
        throw error;
      }

      // Store settings on the transition
      if (overlay) {
        transition.settings = { ...transition.settings, ...transitionSettings };
      } else {
        transition.settings = transitionSettings;
      }

      setImmediate(() => {
        this.emit('CurrentSceneTransitionChanged', { transitionName });
      });

      return {};
    },

    // Stream/Record methods
    GetStreamStatus: function() {
      return {
        outputActive: this._streaming,
        outputReconnecting: false,
        outputTimecode: this._streaming ? '00:05:30.000' : '00:00:00.000',
        outputDuration: this._streaming ? 330000 : 0,
        outputBytes: this._streaming ? 150000000 : 0
      };
    },

    GetStreamServiceSettings: function() {
      return {
        streamServiceType: this._streamServiceType || 'rtmp_common',
        streamServiceSettings: this._streamServiceSettings || {
          server: 'rtmp://a.rtmp.youtube.com/live2',
          key: 'test-stream-key-abc123'
        }
      };
    },

    SetStreamServiceSettings: function(params) {
      const { streamServiceType, streamServiceSettings } = params;
      this._streamServiceType = streamServiceType;
      this._streamServiceSettings = streamServiceSettings;
      return {};
    },

    StartStream: function() {
      this._streaming = true;

      setImmediate(() => {
        this.emit('StreamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' });
      });

      return {};
    },

    StopStream: function() {
      this._streaming = false;

      setImmediate(() => {
        this.emit('StreamStateChanged', { outputActive: false, outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED' });
      });

      return {};
    },

    GetRecordStatus: function() {
      return {
        outputActive: this._recording,
        outputPaused: false,
        outputTimecode: this._recording ? '00:10:00.000' : '00:00:00.000',
        outputDuration: this._recording ? 600000 : 0,
        outputBytes: this._recording ? 500000000 : 0
      };
    },

    StartRecord: function() {
      this._recording = true;

      setImmediate(() => {
        this.emit('RecordStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' });
      });

      return {};
    },

    StopRecord: function() {
      this._recording = false;

      setImmediate(() => {
        this.emit('RecordStateChanged', { outputActive: false, outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED' });
      });

      return {};
    },

    // Studio mode methods
    GetStudioModeEnabled: function() {
      return { studioModeEnabled: this._studioModeEnabled };
    },

    SetStudioModeEnabled: function(params) {
      const { studioModeEnabled } = params;
      this._studioModeEnabled = studioModeEnabled;

      setImmediate(() => {
        this.emit('StudioModeStateChanged', { studioModeEnabled });
      });

      return {};
    },

    GetCurrentPreviewScene: function() {
      return { currentPreviewSceneName: this._previewScene };
    },

    SetCurrentPreviewScene: function(params) {
      const { sceneName } = params;
      if (!this._scenes.has(sceneName)) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      this._previewScene = sceneName;

      setImmediate(() => {
        this.emit('CurrentPreviewSceneChanged', { sceneName });
      });

      return {};
    },

    // Scene item methods
    CreateSceneItem: function(params) {
      const { sceneName, sourceName } = params;
      const scene = this._scenes.get(sceneName);
      if (!scene) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      const sceneItemId = Math.floor(Math.random() * 10000);
      scene.items.push({ sceneItemId, sourceName, sceneItemEnabled: true });

      setImmediate(() => {
        this.emit('SceneItemCreated', { sceneName, sourceName, sceneItemId });
      });

      return { sceneItemId };
    },

    RemoveSceneItem: function(params) {
      const { sceneName, sceneItemId } = params;
      const scene = this._scenes.get(sceneName);
      if (!scene) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      const idx = scene.items.findIndex(i => i.sceneItemId === sceneItemId);
      if (idx === -1) {
        const error = new Error(`Scene item not found: ${sceneItemId}`);
        error.code = 600;
        throw error;
      }
      const [removed] = scene.items.splice(idx, 1);

      setImmediate(() => {
        this.emit('SceneItemRemoved', { sceneName, sourceName: removed.sourceName, sceneItemId });
      });

      return {};
    },

    SetSceneItemEnabled: function(params) {
      const { sceneName, sceneItemId, sceneItemEnabled } = params;
      const scene = this._scenes.get(sceneName);
      if (!scene) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      const item = scene.items.find(i => i.sceneItemId === sceneItemId);
      if (!item) {
        const error = new Error(`Scene item not found: ${sceneItemId}`);
        error.code = 600;
        throw error;
      }
      item.sceneItemEnabled = sceneItemEnabled;

      setImmediate(() => {
        this.emit('SceneItemEnableStateChanged', { sceneName, sceneItemId, sceneItemEnabled });
      });

      return {};
    },

    SetSceneItemTransform: function(params) {
      const { sceneName, sceneItemId, sceneItemTransform } = params;
      const scene = this._scenes.get(sceneName);
      if (!scene) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      const item = scene.items.find(i => i.sceneItemId === sceneItemId);
      if (!item) {
        const error = new Error(`Scene item not found: ${sceneItemId}`);
        error.code = 600;
        throw error;
      }
      item.transform = sceneItemTransform;

      setImmediate(() => {
        this.emit('SceneItemTransformChanged', { sceneName, sceneItemId, sceneItemTransform });
      });

      return {};
    },

    GetSceneItemTransform: function(params) {
      const { sceneName, sceneItemId } = params;
      const scene = this._scenes.get(sceneName);
      if (!scene) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      const item = scene.items.find(i => i.sceneItemId === sceneItemId);
      if (!item) {
        const error = new Error(`Scene item not found: ${sceneItemId}`);
        error.code = 600;
        throw error;
      }
      return {
        sceneItemTransform: item.transform || {
          positionX: 0,
          positionY: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          width: 1920,
          height: 1080,
          boundsType: 'OBS_BOUNDS_NONE',
          boundsWidth: 1920,
          boundsHeight: 1080
        }
      };
    },

    SetSceneItemLocked: function(params) {
      const { sceneName, sceneItemId, sceneItemLocked } = params;
      const scene = this._scenes.get(sceneName);
      if (!scene) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      const item = scene.items.find(i => i.sceneItemId === sceneItemId);
      if (!item) {
        const error = new Error(`Scene item not found: ${sceneItemId}`);
        error.code = 600;
        throw error;
      }
      item.sceneItemLocked = sceneItemLocked;

      setImmediate(() => {
        this.emit('SceneItemLockStateChanged', { sceneName, sceneItemId, sceneItemLocked });
      });

      return {};
    },

    SetSceneItemIndex: function(params) {
      const { sceneName, sceneItemId, sceneItemIndex } = params;
      const scene = this._scenes.get(sceneName);
      if (!scene) {
        const error = new Error(`Scene not found: ${sceneName}`);
        error.code = 600;
        throw error;
      }
      const itemIdx = scene.items.findIndex(i => i.sceneItemId === sceneItemId);
      if (itemIdx === -1) {
        const error = new Error(`Scene item not found: ${sceneItemId}`);
        error.code = 600;
        throw error;
      }
      // Move item to new position
      const [item] = scene.items.splice(itemIdx, 1);
      scene.items.splice(sceneItemIndex, 0, item);

      setImmediate(() => {
        this.emit('SceneItemListReindexed', { sceneName, sceneItems: scene.items });
      });

      return {};
    },

    // Video settings
    GetVideoSettings: function() {
      return {
        baseWidth: 1920,
        baseHeight: 1080,
        outputWidth: 1920,
        outputHeight: 1080,
        fpsNumerator: 30,
        fpsDenominator: 1
      };
    },

    // Input kinds
    GetInputKindList: function() {
      return {
        inputKinds: [
          'ffmpeg_source',
          'browser_source',
          'image_source',
          'color_source',
          'wasapi_input_capture',
          'wasapi_output_capture'
        ]
      };
    }
  };

  // ============================================================================
  // Test Utilities
  // ============================================================================

  /**
   * Record a method call for later verification
   */
  _recordCall(method, params) {
    this._callHistory.push({
      method,
      params,
      timestamp: Date.now()
    });
  }

  /**
   * Simulate network latency
   */
  async _simulateLatency() {
    if (this.options.simulateLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.simulateLatency));
    }
  }

  /**
   * Get all calls made to a specific method
   */
  getCallsTo(method) {
    return this._callHistory.filter(c => c.method === method);
  }

  /**
   * Get the last call made
   */
  getLastCall() {
    return this._callHistory[this._callHistory.length - 1];
  }

  /**
   * Check if a method was called with specific params
   */
  wasCalledWith(method, params) {
    return this._callHistory.some(c => {
      if (c.method !== method) return false;
      for (const [key, value] of Object.entries(params)) {
        if (c.params[key] !== value) return false;
      }
      return true;
    });
  }

  /**
   * Get call count for a method
   */
  getCallCount(method) {
    return this._callHistory.filter(c => c.method === method).length;
  }

  /**
   * Clear call history
   */
  clearHistory() {
    this._callHistory = [];
    this._eventHistory = [];
  }

  /**
   * Inject an error for the next call
   */
  injectErrorOnNextCall(error) {
    this._errorOnNextCall = error;
  }

  /**
   * Inject an error for a specific method
   */
  injectErrorOnMethod(method, error) {
    this._errorOnMethod.set(method, error);
  }

  /**
   * Clear error injection for a method
   */
  clearErrorOnMethod(method) {
    this._errorOnMethod.delete(method);
  }

  /**
   * Reset to initial state
   */
  reset() {
    this._connected = false;
    this._scenes.clear();
    this._inputs.clear();
    this._audioSources.clear();
    this._transitions.clear();
    this._currentScene = null;
    this._currentTransition = 'Fade';
    this._transitionDuration = 300;
    this._studioModeEnabled = false;
    this._previewScene = null;
    this._streaming = false;
    this._recording = false;
    this._streamServiceType = 'rtmp_common';
    this._streamServiceSettings = {
      server: 'rtmp://a.rtmp.youtube.com/live2',
      key: 'test-stream-key-abc123'
    };
    this._callHistory = [];
    this._eventHistory = [];
    this._errorOnNextCall = null;
    this._errorOnMethod.clear();
    this._initializeDefaultState();
  }

  /**
   * Add a custom scene
   */
  addScene(sceneName, items = []) {
    this._scenes.set(sceneName, {
      sceneName,
      sceneIndex: this._scenes.size,
      items
    });
  }

  /**
   * Add a custom input
   */
  addInput(inputName, inputKind, settings = {}) {
    this._inputs.set(inputName, { inputName, inputKind, settings });
  }

  /**
   * Add an audio source
   */
  addAudioSource(inputName, volumeDb = 0, muted = false, monitorType = 'OBS_MONITORING_TYPE_NONE') {
    this._audioSources.set(inputName, {
      volumeDb,
      volumeMul: Math.pow(10, volumeDb / 20),
      muted,
      monitorType
    });
  }

  /**
   * Add a transition
   */
  addTransition(transitionName, transitionKind, settings = {}) {
    this._transitions.set(transitionName, {
      transitionName,
      transitionKind,
      settings
    });
  }

  /**
   * Set connected state (for testing disconnect scenarios)
   */
  setConnected(connected) {
    this._connected = connected;
  }

  /**
   * Set stream service settings for testing
   */
  setStreamSettings(serviceType, settings) {
    this._streamServiceType = serviceType;
    this._streamServiceSettings = settings;
  }

  /**
   * Simulate a connection error
   */
  simulateConnectionError(message = 'Connection failed') {
    const error = new Error(message);
    setImmediate(() => {
      this.emit('ConnectionError', error);
    });
  }

  /**
   * Simulate connection closed
   */
  simulateConnectionClosed() {
    this._connected = false;
    setImmediate(() => {
      this.emit('ConnectionClosed');
    });
  }
}

/**
 * Create a mock Socket.io server
 */
export function createMockSocketIO() {
  const emittedEvents = [];

  return {
    emit: (event, data) => {
      emittedEvents.push({ event, data, timestamp: Date.now() });
    },
    getEmittedEvents: () => emittedEvents,
    getEventsOfType: (event) => emittedEvents.filter(e => e.event === event),
    getLastEvent: () => emittedEvents[emittedEvents.length - 1],
    clearEvents: () => { emittedEvents.length = 0; },
    wasEventEmitted: (event) => emittedEvents.some(e => e.event === event)
  };
}

/**
 * Create a mock Firebase admin
 */
export function createMockFirebase() {
  const data = new Map();

  const mockRef = (path) => ({
    once: async (eventType) => ({
      val: () => data.get(path) || null,
      exists: () => data.has(path)
    }),
    set: async (value) => {
      data.set(path, value);
    },
    update: async (updates) => {
      const current = data.get(path) || {};
      data.set(path, { ...current, ...updates });
    },
    remove: async () => {
      data.delete(path);
    }
  });

  return {
    database: () => ({
      ref: mockRef
    }),
    apps: [],
    initializeApp: () => {},
    credential: {
      applicationDefault: () => ({})
    },
    _data: data, // For test inspection
    _setData: (path, value) => data.set(path, value),
    _getData: (path) => data.get(path),
    _clearData: () => data.clear()
  };
}

export default MockOBSWebSocket;
