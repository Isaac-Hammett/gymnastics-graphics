/**
 * OBS State Sync Service
 *
 * Comprehensive OBS state synchronization service that:
 * - Maintains real-time state cache of OBS connection
 * - Listens to all OBS WebSocket events
 * - Broadcasts state changes via Socket.io
 * - Persists state to Firebase for recovery
 * - Categorizes scenes by type (generated, static, graphics, manual)
 *
 * @module obsStateSync
 */

import { EventEmitter } from 'events';
import admin from 'firebase-admin';

/**
 * Scene category types
 */
export const SCENE_CATEGORY = {
  GENERATED_SINGLE: 'generated-single',
  GENERATED_MULTI: 'generated-multi',
  STATIC: 'static',
  GRAPHICS: 'graphics',
  MANUAL: 'manual',
  TEMPLATE: 'template'
};

/**
 * OBS State Sync Service
 * Extends EventEmitter to emit state change events for internal listeners
 */
class OBSStateSync extends EventEmitter {
  constructor(obs, io, productionConfigService) {
    super();

    // Store dependencies
    this.obs = obs;
    this.io = io;
    this.configService = productionConfigService;

    // Initialize state cache
    this.state = this.getInitialState();

    // Competition ID for Firebase paths
    this.competitionId = null;

    // Firebase database reference
    this._db = null;

    // Initialization flag
    this._isInitialized = false;

    // Template scenes list (loaded from Firebase)
    this.templateScenes = [];

    console.log('[OBSStateSync] Instance created');
  }

  /**
   * Get initial/default state structure
   * @returns {Object} Default state object
   */
  getInitialState() {
    return {
      connected: false,
      lastSync: null,
      connectionError: null,
      scenes: [],
      inputs: [],
      audioSources: [],
      transitions: [],
      currentScene: null,
      currentTransition: null,
      currentTransitionDuration: 0,
      studioModeEnabled: false,
      previewScene: null,
      streaming: {
        active: false,
        timecode: null,
        duration: null
      },
      recording: {
        active: false,
        timecode: null,
        duration: null,
        paused: false
      },
      videoSettings: {
        baseWidth: null,
        baseHeight: null,
        outputWidth: null,
        outputHeight: null,
        fpsNumerator: null,
        fpsDenominator: null
      }
    };
  }

  /**
   * Initialize the service
   * Loads cached state from Firebase and registers OBS event handlers
   * @param {string} compId - Competition ID for Firebase path
   */
  async initialize(compId) {
    if (this._isInitialized) {
      console.log('[OBSStateSync] Already initialized');
      return;
    }

    console.log(`[OBSStateSync] Initializing for competition: ${compId}`);

    this.competitionId = compId;

    try {
      // Initialize Firebase if not already done
      if (admin.apps.length === 0) {
        const databaseURL = process.env.FIREBASE_DATABASE_URL ||
          'https://gymnastics-graphics-default-rtdb.firebaseio.com';

        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL
        });
      }

      this._db = admin.database();

      // Load cached state from Firebase
      await this._loadCachedState();

      // Load template scenes from Firebase
      await this._loadTemplateScenes();

      // Register all OBS WebSocket event handlers
      this.registerEventHandlers();

      // Handle case where OBS was already connected before handlers were registered
      if (this.obs && this.obs.identified) {
        console.log('[OBSStateSync] OBS already connected, triggering initial state refresh');
        this.state.connected = true;
        this.state.connectionError = null;
        this.refreshFullState().catch(err => {
          console.error('[OBSStateSync] Error refreshing state after late initialization:', err);
        });
      }

      this._isInitialized = true;

      console.log('[OBSStateSync] Initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('[OBSStateSync] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Load cached state from Firebase
   * @private
   */
  async _loadCachedState() {
    if (!this._db || !this.competitionId) {
      console.warn('[OBSStateSync] Cannot load cached state - no database or competition ID');
      return;
    }

    try {
      const snapshot = await this._db
        .ref(`competitions/${this.competitionId}/obs/state`)
        .once('value');

      const cachedState = snapshot.val();

      if (cachedState) {
        // Merge cached state with initial state (preserving structure)
        this.state = {
          ...this.getInitialState(),
          ...cachedState,
          // Reset connection state on load
          connected: false,
          lastSync: cachedState.lastSync || null
        };

        console.log('[OBSStateSync] Loaded cached state from Firebase');
      } else {
        console.log('[OBSStateSync] No cached state found, using initial state');
      }
    } catch (error) {
      console.error('[OBSStateSync] Failed to load cached state:', error.message);
      // Continue with initial state
    }
  }

  /**
   * Load template scenes list from Firebase
   * @private
   */
  async _loadTemplateScenes() {
    if (!this._db || !this.competitionId) {
      console.warn('[OBSStateSync] Cannot load template scenes - no database or competition ID');
      return;
    }

    try {
      const snapshot = await this._db
        .ref(`competitions/${this.competitionId}/obs/templateScenes`)
        .once('value');

      const templateScenes = snapshot.val();

      if (templateScenes && Array.isArray(templateScenes)) {
        this.templateScenes = templateScenes;
        console.log(`[OBSStateSync] Loaded ${this.templateScenes.length} template scenes from Firebase`);
      } else {
        this.templateScenes = [];
        console.log('[OBSStateSync] No template scenes found, using empty list');
      }
    } catch (error) {
      console.error('[OBSStateSync] Failed to load template scenes:', error.message);
      this.templateScenes = [];
    }
  }

  /**
   * Add a scene to the template scenes list
   * @param {string} sceneName - Name of the scene to add
   */
  async addTemplateScene(sceneName) {
    if (!sceneName || this.templateScenes.includes(sceneName)) {
      return;
    }

    this.templateScenes.push(sceneName);

    // Save to Firebase
    if (this._db && this.competitionId) {
      try {
        await this._db
          .ref(`competitions/${this.competitionId}/obs/templateScenes`)
          .set(this.templateScenes);
        console.log(`[OBSStateSync] Added template scene: ${sceneName}`);
      } catch (error) {
        console.error('[OBSStateSync] Failed to save template scene:', error.message);
      }
    }
  }

  /**
   * Remove a scene from the template scenes list
   * @param {string} sceneName - Name of the scene to remove
   */
  async removeTemplateScene(sceneName) {
    const index = this.templateScenes.indexOf(sceneName);
    if (index === -1) {
      return;
    }

    this.templateScenes.splice(index, 1);

    // Save to Firebase
    if (this._db && this.competitionId) {
      try {
        await this._db
          .ref(`competitions/${this.competitionId}/obs/templateScenes`)
          .set(this.templateScenes);
        console.log(`[OBSStateSync] Removed template scene: ${sceneName}`);
      } catch (error) {
        console.error('[OBSStateSync] Failed to save template scenes:', error.message);
      }
    }
  }

  /**
   * Register all OBS WebSocket event handlers
   * Wire up listeners for all OBS events we care about
   */
  registerEventHandlers() {
    if (!this.obs) {
      console.warn('[OBSStateSync] No OBS instance provided, skipping event handlers');
      return;
    }

    console.log('[OBSStateSync] Registering OBS event handlers...');

    // Connection events
    this.obs.on('ConnectionClosed', this.onConnectionClosed.bind(this));
    this.obs.on('ConnectionError', this.onConnectionError.bind(this));
    this.obs.on('Identified', this.onConnected.bind(this));

    // Scene events
    this.obs.on('SceneListChanged', this.onSceneListChanged.bind(this));
    this.obs.on('CurrentProgramSceneChanged', this.onCurrentProgramSceneChanged.bind(this));
    this.obs.on('SceneItemListReindexed', this.onSceneItemListReindexed.bind(this));
    this.obs.on('SceneItemCreated', this.onSceneItemCreated.bind(this));
    this.obs.on('SceneItemRemoved', this.onSceneItemRemoved.bind(this));
    this.obs.on('SceneItemEnableStateChanged', this.onSceneItemEnableStateChanged.bind(this));
    this.obs.on('SceneItemTransformChanged', this.onSceneItemTransformChanged.bind(this));

    // Input events
    this.obs.on('InputCreated', this.onInputCreated.bind(this));
    this.obs.on('InputRemoved', this.onInputRemoved.bind(this));
    this.obs.on('InputNameChanged', this.onInputNameChanged.bind(this));
    this.obs.on('InputSettingsChanged', this.onInputSettingsChanged.bind(this));

    // Audio events
    this.obs.on('InputVolumeChanged', this.onInputVolumeChanged.bind(this));
    this.obs.on('InputMuteStateChanged', this.onInputMuteStateChanged.bind(this));
    this.obs.on('InputAudioMonitorTypeChanged', this.onInputAudioMonitorTypeChanged.bind(this));

    // Transition events
    this.obs.on('SceneTransitionStarted', this.onSceneTransitionStarted.bind(this));
    this.obs.on('SceneTransitionEnded', this.onSceneTransitionEnded.bind(this));
    this.obs.on('CurrentSceneTransitionChanged', this.onCurrentSceneTransitionChanged.bind(this));
    this.obs.on('CurrentSceneTransitionDurationChanged', this.onCurrentSceneTransitionDurationChanged.bind(this));

    // Stream/Recording events
    this.obs.on('StreamStateChanged', this.onStreamStateChanged.bind(this));
    this.obs.on('RecordStateChanged', this.onRecordStateChanged.bind(this));

    // Studio mode events
    this.obs.on('StudioModeStateChanged', this.onStudioModeStateChanged.bind(this));
    this.obs.on('CurrentPreviewSceneChanged', this.onCurrentPreviewSceneChanged.bind(this));

    console.log('[OBSStateSync] Event handlers registered');
  }

  // ============================================================================
  // Connection Event Handlers
  // ============================================================================

  /**
   * Handle OBS connection established
   */
  async onConnected(data) {
    console.log('[OBSStateSync] OBS connected (Identified)');

    this.state.connected = true;
    this.state.connectionError = null;
    this.state.lastSync = new Date().toISOString();

    // Trigger full state refresh
    await this.refreshFullState();

    this.broadcast('obs:connected', { connected: true });
    this.emit('connected');
  }

  /**
   * Handle OBS connection closed
   */
  async onConnectionClosed() {
    console.log('[OBSStateSync] OBS connection closed');

    // Clear all OBS-specific state to prevent stale data
    this.state.connected = false;
    this.state.connectionError = 'Connection closed';
    this.state.scenes = [];
    this.state.inputs = [];
    this.state.audioSources = [];
    this.state.transitions = [];
    this.state.currentScene = null;
    this.state.currentProgramScene = null;

    // Save state to persist disconnected status
    await this._saveState().catch(err => {
      console.error('[OBSStateSync] Failed to save state on disconnect:', err.message);
    });

    // Broadcast disconnected event
    this.broadcast('obs:disconnected', {
      connected: false,
      error: 'Connection closed'
    });

    // Broadcast full state update so clients clear their scene lists
    this.broadcast('obs:stateUpdated', this.state);

    this.emit('disconnected');
  }

  /**
   * Handle OBS connection error
   */
  async onConnectionError(error) {
    console.error('[OBSStateSync] OBS connection error:', error);

    this.state.connected = false;
    this.state.connectionError = error.message || 'Connection error';

    // Save state to persist error status
    await this._saveState().catch(err => {
      console.error('[OBSStateSync] Failed to save state on error:', err.message);
    });

    this.broadcast('obs:error', {
      connected: false,
      error: this.state.connectionError
    });

    this.emit('error', error);
  }

  // ============================================================================
  // Scene Event Handlers
  // ============================================================================

  /**
   * Handle scene list changed (scenes added/removed/reordered)
   */
  async onSceneListChanged(data) {
    console.log('[OBSStateSync] Scene list changed');

    // Trigger scene list refresh
    await this.refreshScenes();

    this.broadcast('obs:sceneListChanged', data);
    this.emit('sceneListChanged', data);
  }

  /**
   * Handle current program scene changed
   */
  async onCurrentProgramSceneChanged(data) {
    const sceneName = data.sceneName;
    console.log(`[OBSStateSync] Current scene changed to: ${sceneName}`);

    this.state.currentScene = sceneName;
    this.state.lastSync = new Date().toISOString();

    // Save state after scene change
    await this._saveState().catch(err => {
      console.error('[OBSStateSync] Failed to save state on scene change:', err.message);
    });

    this.broadcast('obs:currentSceneChanged', {
      sceneName,
      category: this.categorizeScene(sceneName)
    });

    this.emit('currentSceneChanged', { sceneName });
  }

  /**
   * Handle scene item list reindexed (items reordered)
   */
  onSceneItemListReindexed(data) {
    console.log(`[OBSStateSync] Scene items reindexed in: ${data.sceneName}`);

    this.broadcast('obs:sceneItemListReindexed', data);
    this.emit('sceneItemListReindexed', data);
  }

  /**
   * Handle scene item created
   */
  onSceneItemCreated(data) {
    console.log(`[OBSStateSync] Scene item created in ${data.sceneName}: ${data.sourceName}`);

    this.broadcast('obs:sceneItemCreated', data);
    this.emit('sceneItemCreated', data);
  }

  /**
   * Handle scene item removed
   */
  onSceneItemRemoved(data) {
    console.log(`[OBSStateSync] Scene item removed from ${data.sceneName}: ${data.sourceName}`);

    this.broadcast('obs:sceneItemRemoved', data);
    this.emit('sceneItemRemoved', data);
  }

  /**
   * Handle scene item visibility changed
   */
  onSceneItemEnableStateChanged(data) {
    console.log(`[OBSStateSync] Scene item visibility changed: ${data.sceneItemId} enabled=${data.sceneItemEnabled}`);

    this.broadcast('obs:sceneItemEnableStateChanged', data);
    this.emit('sceneItemEnableStateChanged', data);
  }

  /**
   * Handle scene item transform changed (position, scale, crop, etc.)
   */
  onSceneItemTransformChanged(data) {
    console.log(`[OBSStateSync] Scene item transform changed: ${data.sceneItemId}`);

    this.broadcast('obs:sceneItemTransformChanged', data);
    this.emit('sceneItemTransformChanged', data);
  }

  // ============================================================================
  // Input Event Handlers
  // ============================================================================

  /**
   * Handle input (source) created
   */
  async onInputCreated(data) {
    console.log(`[OBSStateSync] Input created: ${data.inputName} (${data.inputKind})`);

    // Trigger input list refresh
    await this.refreshInputs();

    this.broadcast('obs:inputCreated', data);
    this.emit('inputCreated', data);
  }

  /**
   * Handle input removed
   */
  async onInputRemoved(data) {
    console.log(`[OBSStateSync] Input removed: ${data.inputName}`);

    // Remove from state cache
    this.state.inputs = this.state.inputs.filter(input => input.inputName !== data.inputName);

    this.broadcast('obs:inputRemoved', data);
    this.emit('inputRemoved', data);
  }

  /**
   * Handle input name changed
   */
  onInputNameChanged(data) {
    console.log(`[OBSStateSync] Input renamed: ${data.oldInputName} -> ${data.inputName}`);

    // Update name in state cache
    const input = this.state.inputs.find(i => i.inputName === data.oldInputName);
    if (input) {
      input.inputName = data.inputName;
    }

    this.broadcast('obs:inputNameChanged', data);
    this.emit('inputNameChanged', data);
  }

  /**
   * Handle input settings changed
   */
  onInputSettingsChanged(data) {
    console.log(`[OBSStateSync] Input settings changed: ${data.inputName}`);

    this.broadcast('obs:inputSettingsChanged', data);
    this.emit('inputSettingsChanged', data);
  }

  // ============================================================================
  // Audio Event Handlers
  // ============================================================================

  /**
   * Handle input volume changed
   */
  onInputVolumeChanged(data) {
    const { inputName, inputVolumeDb, inputVolumeMul } = data;

    // Update audio source in state
    const audioSource = this.state.audioSources.find(s => s.inputName === inputName);
    if (audioSource) {
      audioSource.volumeDb = inputVolumeDb;
      audioSource.volumeMul = inputVolumeMul;
    }

    this.broadcast('obs:volumeChanged', {
      inputName,
      volumeDb: inputVolumeDb,
      volumeMul: inputVolumeMul
    });

    this.emit('volumeChanged', { inputName, volumeDb: inputVolumeDb });
  }

  /**
   * Handle input mute state changed
   */
  onInputMuteStateChanged(data) {
    const { inputName, inputMuted } = data;
    console.log(`[OBSStateSync] Mute state changed: ${inputName} muted=${inputMuted}`);

    // Update audio source in state
    const audioSource = this.state.audioSources.find(s => s.inputName === inputName);
    if (audioSource) {
      audioSource.muted = inputMuted;
    }

    this.broadcast('obs:muteChanged', {
      inputName,
      muted: inputMuted
    });

    this.emit('muteChanged', { inputName, muted: inputMuted });
  }

  /**
   * Handle input audio monitor type changed
   */
  onInputAudioMonitorTypeChanged(data) {
    const { inputName, monitorType } = data;
    console.log(`[OBSStateSync] Monitor type changed: ${inputName} monitorType=${monitorType}`);

    // Update audio source in state
    const audioSource = this.state.audioSources.find(s => s.inputName === inputName);
    if (audioSource) {
      audioSource.monitorType = monitorType;
    }

    this.broadcast('obs:monitorTypeChanged', {
      inputName,
      monitorType
    });

    this.emit('monitorTypeChanged', { inputName, monitorType });
  }

  // ============================================================================
  // Transition Event Handlers
  // ============================================================================

  /**
   * Handle scene transition started
   */
  onSceneTransitionStarted(data) {
    console.log(`[OBSStateSync] Transition started: ${data.transitionName}`);

    this.broadcast('obs:transitionStarted', data);
    this.emit('transitionStarted', data);
  }

  /**
   * Handle scene transition ended
   */
  onSceneTransitionEnded(data) {
    console.log(`[OBSStateSync] Transition ended: ${data.transitionName}`);

    this.broadcast('obs:transitionEnded', data);
    this.emit('transitionEnded', data);
  }

  /**
   * Handle current scene transition changed
   */
  onCurrentSceneTransitionChanged(data) {
    const { transitionName } = data;
    console.log(`[OBSStateSync] Current transition changed to: ${transitionName}`);

    this.state.currentTransition = transitionName;

    this.broadcast('obs:currentTransitionChanged', { transitionName });
    this.emit('currentTransitionChanged', { transitionName });
  }

  /**
   * Handle current scene transition duration changed
   */
  onCurrentSceneTransitionDurationChanged(data) {
    const { transitionDuration } = data;
    console.log(`[OBSStateSync] Transition duration changed to: ${transitionDuration}ms`);

    this.state.currentTransitionDuration = transitionDuration;

    this.broadcast('obs:transitionDurationChanged', { transitionDuration });
    this.emit('transitionDurationChanged', { transitionDuration });
  }

  // ============================================================================
  // Stream/Recording Event Handlers
  // ============================================================================

  /**
   * Handle stream state changed
   */
  onStreamStateChanged(data) {
    const { outputActive, outputState } = data;
    console.log(`[OBSStateSync] Stream state changed: ${outputState} (active=${outputActive})`);

    this.state.streaming.active = outputActive;

    if (outputActive) {
      // Stream started/running
      this.state.streaming.timecode = data.outputTimecode || null;
      this.state.streaming.duration = data.outputDuration || null;
    } else {
      // Stream stopped
      this.state.streaming.timecode = null;
      this.state.streaming.duration = null;
    }

    this.broadcast('obs:streamStateChanged', {
      active: outputActive,
      state: outputState,
      timecode: this.state.streaming.timecode,
      duration: this.state.streaming.duration
    });

    this.emit('streamStateChanged', this.state.streaming);
  }

  /**
   * Handle recording state changed
   */
  onRecordStateChanged(data) {
    const { outputActive, outputState, outputPath } = data;
    console.log(`[OBSStateSync] Recording state changed: ${outputState} (active=${outputActive})`);

    this.state.recording.active = outputActive;

    if (outputActive) {
      // Recording started/running
      this.state.recording.timecode = data.outputTimecode || null;
      this.state.recording.duration = data.outputDuration || null;
      this.state.recording.path = outputPath || null;
    } else {
      // Recording stopped
      this.state.recording.timecode = null;
      this.state.recording.duration = null;
    }

    this.broadcast('obs:recordStateChanged', {
      active: outputActive,
      state: outputState,
      timecode: this.state.recording.timecode,
      duration: this.state.recording.duration,
      path: this.state.recording.path
    });

    this.emit('recordStateChanged', this.state.recording);
  }

  // ============================================================================
  // Studio Mode Event Handlers
  // ============================================================================

  /**
   * Handle studio mode state changed
   */
  onStudioModeStateChanged(data) {
    const { studioModeEnabled } = data;
    console.log(`[OBSStateSync] Studio mode changed: ${studioModeEnabled}`);

    this.state.studioModeEnabled = studioModeEnabled;

    this.broadcast('obs:studioModeChanged', { studioModeEnabled });
    this.emit('studioModeChanged', { studioModeEnabled });
  }

  /**
   * Handle current preview scene changed (in studio mode)
   */
  onCurrentPreviewSceneChanged(data) {
    const { sceneName } = data;
    console.log(`[OBSStateSync] Preview scene changed to: ${sceneName}`);

    this.state.previewScene = sceneName;

    this.broadcast('obs:previewSceneChanged', {
      sceneName,
      category: this.categorizeScene(sceneName)
    });

    this.emit('previewSceneChanged', { sceneName });
  }

  // ============================================================================
  // Scene Categorization
  // ============================================================================

  /**
   * Categorize a scene by its name
   * @param {string} sceneName - Scene name to categorize
   * @returns {string} Scene category (SCENE_CATEGORY constant)
   */
  categorizeScene(sceneName) {
    if (!sceneName) {
      return SCENE_CATEGORY.MANUAL;
    }

    // Check if scene is in templateScenes list (from Firebase)
    if (this.templateScenes && this.templateScenes.includes(sceneName)) {
      return SCENE_CATEGORY.TEMPLATE;
    }

    const name = sceneName.toLowerCase();

    // Generated single-camera scenes
    // Template patterns: "Full Screen - Camera X", "Replay - Camera X"
    // Legacy patterns: "Single - Camera X"
    if (name.startsWith('full screen - ') ||
        name.startsWith('replay - ') ||
        name.startsWith('single - ')) {
      return SCENE_CATEGORY.GENERATED_SINGLE;
    }

    // Generated multi-camera scenes
    // Template patterns: "Dual View - ...", "Triple View - ...", "Quad View"
    // Legacy patterns: "Dual - ...", "Triple - ...", "Quad - ..."
    if (name.startsWith('dual view') ||
        name.startsWith('triple view') ||
        name.startsWith('quad view') ||
        name === 'quad view' ||
        name.startsWith('dual - ') ||
        name.startsWith('triple - ') ||
        name.startsWith('quad - ')) {
      return SCENE_CATEGORY.GENERATED_MULTI;
    }

    // Static production scenes
    // Template patterns: "Stream Starting Soon", "End Stream"
    // Legacy patterns: "Starting Soon", "BRB", "Thanks for Watching", "Be Right Back"
    const staticScenes = ['starting soon', 'brb', 'thanks for watching', 'be right back', 'end stream'];
    if (staticScenes.some(s => name.includes(s))) {
      return SCENE_CATEGORY.STATIC;
    }

    // Graphics-only scenes
    // Template pattern: "Web-graphics-only-no-video"
    // Legacy pattern: "Graphics Fullscreen"
    if (name.includes('graphics fullscreen') ||
        name.includes('web-graphics-only') ||
        name.includes('graphics-only')) {
      return SCENE_CATEGORY.GRAPHICS;
    }

    // Everything else is manual
    return SCENE_CATEGORY.MANUAL;
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current state
   * @returns {Object} Current state object
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Broadcast state change via Socket.io and EventEmitter
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcast(event, data) {
    // Emit to internal EventEmitter listeners
    this.emit('broadcast', { event, data });

    // Broadcast to Socket.io clients
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  /**
   * Save current state to Firebase
   * @private
   */
  async _saveState() {
    if (!this._db || !this.competitionId) {
      console.warn('[OBSStateSync] Cannot save state - no database or competition ID');
      return;
    }

    try {
      // Update lastSync timestamp before saving
      this.state.lastSync = new Date().toISOString();

      // Save to Firebase
      await this._db
        .ref(`competitions/${this.competitionId}/obs/state`)
        .set(this.state);

      console.log('[OBSStateSync] State saved to Firebase');
    } catch (error) {
      console.error('[OBSStateSync] Failed to save state to Firebase:', error.message);
      throw error;
    }
  }

  /**
   * Refresh full state from OBS
   * @returns {Promise<Object>} Full state object
   */
  async refreshFullState() {
    if (!this.obs || !this.state.connected) {
      console.warn('[OBSStateSync] Cannot refresh state - not connected to OBS');
      return this.state;
    }

    console.log('[OBSStateSync] Refreshing full state from OBS...');

    try {
      // Fetch all state in parallel
      const [
        scenes,
        inputs,
        transitions,
        streamStatus,
        recordStatus,
        videoSettings,
        studioMode
      ] = await Promise.all([
        this.fetchScenes(),
        this.fetchInputs(),
        this.fetchTransitions(),
        this.obs.call('GetStreamStatus'),
        this.obs.call('GetRecordStatus'),
        this.obs.call('GetVideoSettings'),
        this.obs.call('GetStudioModeEnabled')
      ]);

      // Update state with fetched data
      this.state.scenes = scenes;
      this.state.inputs = inputs;
      this.state.audioSources = this.extractAudioSources(inputs);
      this.state.transitions = transitions.transitions;
      this.state.currentTransition = transitions.currentTransition;
      this.state.currentTransitionDuration = transitions.currentTransitionDuration;

      // Update current scene
      const currentSceneResponse = await this.obs.call('GetCurrentProgramScene');
      this.state.currentScene = currentSceneResponse.currentProgramSceneName;

      // Update stream status
      this.state.streaming = this.mapStreamStatus(streamStatus);

      // Update record status
      this.state.recording = this.mapRecordStatus(recordStatus);

      // Update video settings
      this.state.videoSettings = {
        baseWidth: videoSettings.baseWidth,
        baseHeight: videoSettings.baseHeight,
        outputWidth: videoSettings.outputWidth,
        outputHeight: videoSettings.outputHeight,
        fpsNumerator: videoSettings.fpsNumerator,
        fpsDenominator: videoSettings.fpsDenominator
      };

      // Update studio mode
      this.state.studioModeEnabled = studioMode.studioModeEnabled;
      if (studioMode.studioModeEnabled) {
        const previewSceneResponse = await this.obs.call('GetCurrentPreviewScene');
        this.state.previewScene = previewSceneResponse.currentPreviewSceneName;
      } else {
        this.state.previewScene = null;
      }

      // Update last sync timestamp
      this.state.lastSync = new Date().toISOString();

      console.log('[OBSStateSync] Full state refresh complete');

      // Save state to Firebase
      await this._saveState();

      // Broadcast state update
      this.broadcast('obs:stateUpdated', this.state);

      return this.state;
    } catch (error) {
      console.error('[OBSStateSync] Failed to refresh full state:', error.message);
      throw error;
    }
  }

  /**
   * Fetch scenes list with items from OBS
   * @private
   * @returns {Promise<Array>} Array of scene objects
   */
  async fetchScenes() {
    const sceneListResponse = await this.obs.call('GetSceneList');
    const scenes = [];

    // Fetch scene items for each scene in parallel
    const sceneItemPromises = sceneListResponse.scenes.map(async (scene) => {
      const sceneItemsResponse = await this.obs.call('GetSceneItemList', {
        sceneName: scene.sceneName
      });

      return {
        sceneName: scene.sceneName,
        sceneIndex: scene.sceneIndex,
        items: sceneItemsResponse.sceneItems,
        category: this.categorizeScene(scene.sceneName)
      };
    });

    const scenesWithItems = await Promise.all(sceneItemPromises);
    return scenesWithItems;
  }

  /**
   * Fetch inputs list from OBS
   * @private
   * @returns {Promise<Array>} Array of input objects
   */
  async fetchInputs() {
    const inputListResponse = await this.obs.call('GetInputList');
    return inputListResponse.inputs;
  }

  /**
   * Fetch transitions list from OBS
   * @private
   * @returns {Promise<Object>} Transitions object with current transition info
   */
  async fetchTransitions() {
    const transitionListResponse = await this.obs.call('GetSceneTransitionList');
    return {
      transitions: transitionListResponse.transitions,
      currentTransition: transitionListResponse.currentSceneTransitionName,
      currentTransitionDuration: transitionListResponse.currentSceneTransitionDuration
    };
  }

  /**
   * Extract audio sources from inputs list
   * @private
   * @param {Array} inputs - Array of input objects
   * @returns {Array} Array of audio source objects
   */
  extractAudioSources(inputs) {
    // Audio-capable input kinds
    const audioKinds = [
      'wasapi_input_capture',
      'wasapi_output_capture',
      'coreaudio_input_capture',
      'coreaudio_output_capture',
      'pulse_input_capture',
      'pulse_output_capture',
      'alsa_input_capture',
      'ffmpeg_source', // Can have audio
      'browser_source' // Can have audio
    ];

    const audioSources = [];

    for (const input of inputs) {
      if (audioKinds.includes(input.inputKind)) {
        audioSources.push({
          inputName: input.inputName,
          inputKind: input.inputKind,
          volumeDb: 0, // Will be updated by volume events
          volumeMul: 1,
          muted: false
        });
      }
    }

    return audioSources;
  }

  /**
   * Map OBS stream status response to state format
   * @private
   * @param {Object} response - OBS GetStreamStatus response
   * @returns {Object} Stream status object
   */
  mapStreamStatus(response) {
    return {
      active: response.outputActive,
      timecode: response.outputActive ? response.outputTimecode : null,
      duration: response.outputActive ? response.outputDuration : null
    };
  }

  /**
   * Map OBS record status response to state format
   * @private
   * @param {Object} response - OBS GetRecordStatus response
   * @returns {Object} Record status object
   */
  mapRecordStatus(response) {
    return {
      active: response.outputActive,
      paused: response.outputPaused || false,
      timecode: response.outputActive ? response.outputTimecode : null,
      duration: response.outputActive ? response.outputDuration : null
    };
  }

  /**
   * Refresh scenes list from OBS
   * @returns {Promise<Array>} Array of scene objects
   */
  async refreshScenes() {
    if (!this.obs || !this.state.connected) {
      console.warn('[OBSStateSync] Cannot refresh scenes - not connected to OBS');
      return this.state.scenes;
    }

    console.log('[OBSStateSync] Refreshing scenes...');

    try {
      this.state.scenes = await this.fetchScenes();
      this.state.lastSync = new Date().toISOString();
      console.log(`[OBSStateSync] Scenes refreshed: ${this.state.scenes.length} scenes`);
      return this.state.scenes;
    } catch (error) {
      console.error('[OBSStateSync] Failed to refresh scenes:', error.message);
      throw error;
    }
  }

  /**
   * Refresh inputs list from OBS
   * @returns {Promise<Array>} Array of input objects
   */
  async refreshInputs() {
    if (!this.obs || !this.state.connected) {
      console.warn('[OBSStateSync] Cannot refresh inputs - not connected to OBS');
      return this.state.inputs;
    }

    console.log('[OBSStateSync] Refreshing inputs...');

    try {
      this.state.inputs = await this.fetchInputs();
      this.state.audioSources = this.extractAudioSources(this.state.inputs);
      this.state.lastSync = new Date().toISOString();
      console.log(`[OBSStateSync] Inputs refreshed: ${this.state.inputs.length} inputs`);
      return this.state.inputs;
    } catch (error) {
      console.error('[OBSStateSync] Failed to refresh inputs:', error.message);
      throw error;
    }
  }

  /**
   * Start periodic state synchronization
   * @param {number} intervalMs - Sync interval in milliseconds (default: 30000)
   */
  startPeriodicSync(intervalMs = 30000) {
    if (this._syncInterval) {
      console.warn('[OBSStateSync] Periodic sync already running');
      return;
    }

    console.log(`[OBSStateSync] Starting periodic sync (interval: ${intervalMs}ms)`);

    this._syncInterval = setInterval(async () => {
      if (this.state.connected) {
        try {
          await this.refreshFullState();
        } catch (error) {
          console.error('[OBSStateSync] Periodic sync failed:', error.message);
        }
      }
    }, intervalMs);
  }

  /**
   * Stop periodic state synchronization
   */
  stopPeriodicSync() {
    if (!this._syncInterval) {
      console.warn('[OBSStateSync] No periodic sync running');
      return;
    }

    console.log('[OBSStateSync] Stopping periodic sync');
    clearInterval(this._syncInterval);
    this._syncInterval = null;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Check if the service is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._isInitialized;
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    console.log('[OBSStateSync] Shutting down...');

    // Stop periodic sync
    this.stopPeriodicSync();

    // Save final state to Firebase
    await this._saveState();

    // Remove all OBS event listeners
    if (this.obs) {
      this.obs.removeAllListeners();
    }

    this._isInitialized = false;

    this.emit('shutdown');
    console.log('[OBSStateSync] Shutdown complete');
  }

  // ============================================================================
  // Preview and Studio Mode Methods
  // ============================================================================

  /**
   * Take a screenshot of a scene or the current program scene
   * @param {string} sceneName - Optional scene name. If omitted, uses current program scene
   * @param {Object} options - Screenshot options
   * @param {string} options.imageFormat - Image format ('png' or 'jpg'). Default: 'png'
   * @param {number} options.imageWidth - Image width in pixels. Optional.
   * @param {number} options.imageHeight - Image height in pixels. Optional.
   * @returns {Promise<string>} Base64-encoded image data
   */
  async takeScreenshot(sceneName = null, options = {}) {
    if (!this.obs || !this.state.connected) {
      throw new Error('Cannot take screenshot - not connected to OBS');
    }

    try {
      const targetScene = sceneName || this.state.currentScene;

      if (!targetScene) {
        throw new Error('No scene specified and no current scene available');
      }

      const params = {
        sourceName: targetScene,
        imageFormat: options.imageFormat || 'png'
      };

      // Add optional dimensions if provided
      if (options.imageWidth) params.imageWidth = options.imageWidth;
      if (options.imageHeight) params.imageHeight = options.imageHeight;

      const response = await this.obs.call('GetSourceScreenshot', params);

      console.log(`[OBSStateSync] Screenshot captured for scene: ${targetScene}`);

      return response.imageData;
    } catch (error) {
      console.error('[OBSStateSync] Failed to take screenshot:', error.message);
      throw error;
    }
  }

  /**
   * Get studio mode status
   * @returns {Promise<Object>} Studio mode status { studioModeEnabled: boolean }
   */
  async getStudioModeStatus() {
    if (!this.obs || !this.state.connected) {
      throw new Error('Cannot get studio mode status - not connected to OBS');
    }

    try {
      const response = await this.obs.call('GetStudioModeEnabled');
      console.log(`[OBSStateSync] Studio mode status: ${response.studioModeEnabled}`);
      return response;
    } catch (error) {
      console.error('[OBSStateSync] Failed to get studio mode status:', error.message);
      throw error;
    }
  }

  /**
   * Set studio mode enabled or disabled
   * @param {boolean} enabled - Whether to enable studio mode
   * @returns {Promise<void>}
   */
  async setStudioMode(enabled) {
    if (!this.obs || !this.state.connected) {
      throw new Error('Cannot set studio mode - not connected to OBS');
    }

    try {
      await this.obs.call('SetStudioModeEnabled', { studioModeEnabled: enabled });
      console.log(`[OBSStateSync] Studio mode ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('[OBSStateSync] Failed to set studio mode:', error.message);
      throw error;
    }
  }

  /**
   * Set the current preview scene (only works when studio mode is enabled)
   * @param {string} sceneName - Name of the scene to set as preview
   * @returns {Promise<void>}
   */
  async setPreviewScene(sceneName) {
    if (!this.obs || !this.state.connected) {
      throw new Error('Cannot set preview scene - not connected to OBS');
    }

    if (!this.state.studioModeEnabled) {
      throw new Error('Cannot set preview scene - studio mode is not enabled');
    }

    try {
      await this.obs.call('SetCurrentPreviewScene', { sceneName });
      console.log(`[OBSStateSync] Preview scene set to: ${sceneName}`);
    } catch (error) {
      console.error('[OBSStateSync] Failed to set preview scene:', error.message);
      throw error;
    }
  }

  /**
   * Execute a transition from preview to program (only works when studio mode is enabled)
   * @returns {Promise<void>}
   */
  async executeTransition() {
    if (!this.obs || !this.state.connected) {
      throw new Error('Cannot execute transition - not connected to OBS');
    }

    if (!this.state.studioModeEnabled) {
      throw new Error('Cannot execute transition - studio mode is not enabled');
    }

    try {
      await this.obs.call('TriggerStudioModeTransition');
      console.log('[OBSStateSync] Studio mode transition executed');
    } catch (error) {
      console.error('[OBSStateSync] Failed to execute transition:', error.message);
      throw error;
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance = null;

/**
 * Get or create the OBS State Sync singleton
 * @param {Object} obs - OBS WebSocket instance
 * @param {Object} io - Socket.io server instance
 * @param {Object} productionConfigService - Production config service
 * @returns {OBSStateSync} The singleton instance
 */
export function getOBSStateSync(obs, io, productionConfigService) {
  if (!instance) {
    instance = new OBSStateSync(obs, io, productionConfigService);
  }
  return instance;
}

// Export class for testing
export { OBSStateSync };

// Default export is the singleton getter
export default getOBSStateSync;
