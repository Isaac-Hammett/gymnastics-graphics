import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useShow } from './ShowContext';

const OBSContext = createContext(null);

// Local storage key for auto-load preference
const AUTO_LOAD_TEMPLATE_KEY = 'obs-auto-load-template';

// Initial state values
const INITIAL_OBS_STATE = {
  connected: false,
  scenes: [],
  currentScene: null,
  previewScene: null,
  inputs: [],
  audioSources: [],
  transitions: [],
  currentTransition: null,
  streaming: false,
  recording: false,
  recordingPaused: false,
  studioModeEnabled: false,
  connectionError: null,
  // PRD-OBS-06: Stream & Recording state
  streamSettings: null,
  streamStatus: null,
  recordingStatus: null
};

// Initial audio levels state (PRD-OBS-04: Real-time Audio Levels)
const INITIAL_AUDIO_LEVELS = new Map();

export function OBSProvider({ children }) {
  // Get socket from ShowContext
  const { socket, connected } = useShow();

  // State - obsConnected is derived from obsState.connected (set by obs:stateUpdated event)
  const [obsState, setObsState] = useState(INITIAL_OBS_STATE);
  const [connectionError, setConnectionError] = useState(null);

  // PRD-OBS-04: Real-time audio levels state
  const [audioLevels, setAudioLevels] = useState(INITIAL_AUDIO_LEVELS);

  // PRD-OBS-04 Phase 1.5: Audio presets state
  const [presets, setPresets] = useState([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetApplying, setPresetApplying] = useState(null); // presetId being applied

  // PRD-OBS-11: Template auto-loading state
  const [autoLoadEnabled, setAutoLoadEnabled] = useState(() => {
    const stored = localStorage.getItem(AUTO_LOAD_TEMPLATE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [autoAppliedTemplate, setAutoAppliedTemplate] = useState(null);
  const hasAttemptedAutoApply = useRef(false);

  // obsConnected comes from obsState which is updated directly by obs:stateUpdated
  // This ensures OBSManager sees the connected state immediately when the event fires
  const obsConnected = obsState?.connected ?? false;

  // Subscribe to socket events
  useEffect(() => {
    if (!socket || !connected) {
      console.log('OBSContext: Socket not available or not connected');
      return;
    }

    console.log('OBSContext: Setting up OBS event listeners');

    const handleStateUpdate = (state) => {
      console.log('OBSContext: State update received', state);
      setObsState(state);
      setConnectionError(state?.connectionError ?? null);
    };

    const handleConnected = (data) => {
      console.log('OBSContext: OBS connected', data);
      setObsState(prev => ({ ...prev, connected: true }));
      setConnectionError(null);
    };

    const handleDisconnected = (data) => {
      console.log('OBSContext: OBS disconnected', data);
      setObsState(prev => ({ ...prev, connected: false }));
      if (data?.error) {
        setConnectionError(data.error);
      }
    };

    const handleSceneChanged = (data) => {
      const sceneName = data?.sceneName || data;
      console.log('OBSContext: Scene changed to', sceneName);
      setObsState(prev => ({
        ...prev,
        currentScene: sceneName
      }));
    };

    const handlePreviewSceneChanged = (data) => {
      console.log('OBSContext: Preview scene changed', data);
      setObsState(prev => ({
        ...prev,
        previewScene: data.sceneName
      }));
    };

    const handleStreamingStateChanged = (data) => {
      console.log('OBSContext: Streaming state changed', data);
      setObsState(prev => ({
        ...prev,
        streaming: data.active
      }));
    };

    const handleRecordingStateChanged = (data) => {
      console.log('OBSContext: Recording state changed', data);
      setObsState(prev => ({
        ...prev,
        recording: data.active
      }));
    };

    const handleTransitionChanged = (data) => {
      console.log('OBSContext: Transition changed', data);
      setObsState(prev => ({
        ...prev,
        currentTransition: data.transitionName
      }));
    };

    // PRD-OBS-05: Handle transitions list response
    const handleTransitionsList = (data) => {
      console.log('OBSContext: Transitions list received', data);
      setObsState(prev => ({
        ...prev,
        transitions: data.transitions || [],
        currentTransition: data.currentTransition,
        transitionDuration: data.transitionDuration
      }));
    };

    const handleError = (data) => {
      console.error('OBSContext: Error received', data);
      setConnectionError(data?.message || 'Unknown OBS error');
      setTimeout(() => setConnectionError(null), 5000);
    };

    const handleScreenshotCaptured = (data) => {
      console.log('OBSContext: Screenshot captured', data.sceneName, data.timestamp);
      // Download the screenshot as a file
      if (data.imageData) {
        const link = document.createElement('a');
        link.href = data.imageData;
        link.download = `screenshot-${data.sceneName}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };

    // PRD-OBS-06: Stream settings response handler
    const handleStreamSettings = (data) => {
      console.log('OBSContext: Stream settings received', data);
      setObsState(prev => ({
        ...prev,
        streamSettings: data
      }));
    };

    // PRD-OBS-06: Stream status response handler
    const handleStreamStatus = (data) => {
      console.log('OBSContext: Stream status received', data);
      setObsState(prev => ({
        ...prev,
        streamStatus: data,
        streaming: data.active
      }));
    };

    // PRD-OBS-06: Recording status response handler
    const handleRecordingStatus = (data) => {
      console.log('OBSContext: Recording status received', data);
      setObsState(prev => ({
        ...prev,
        recordingStatus: data,
        recording: data.active,
        recordingPaused: data.paused
      }));
    };

    // PRD-OBS-06: Stream started confirmation
    const handleStreamStarted = () => {
      console.log('OBSContext: Stream started');
      setObsState(prev => ({
        ...prev,
        streaming: true
      }));
    };

    // PRD-OBS-06: Stream stopped confirmation
    const handleStreamStopped = () => {
      console.log('OBSContext: Stream stopped');
      setObsState(prev => ({
        ...prev,
        streaming: false,
        streamStatus: null
      }));
    };

    // PRD-OBS-06: Recording started confirmation
    const handleRecordingStarted = () => {
      console.log('OBSContext: Recording started');
      setObsState(prev => ({
        ...prev,
        recording: true,
        recordingPaused: false
      }));
    };

    // PRD-OBS-06: Recording stopped confirmation
    const handleRecordingStopped = (data) => {
      console.log('OBSContext: Recording stopped', data?.path);
      setObsState(prev => ({
        ...prev,
        recording: false,
        recordingPaused: false,
        recordingStatus: null
      }));
    };

    // PRD-OBS-06: Recording paused confirmation
    const handleRecordingPaused = () => {
      console.log('OBSContext: Recording paused');
      setObsState(prev => ({
        ...prev,
        recordingPaused: true
      }));
    };

    // PRD-OBS-06: Recording resumed confirmation
    const handleRecordingResumed = () => {
      console.log('OBSContext: Recording resumed');
      setObsState(prev => ({
        ...prev,
        recordingPaused: false
      }));
    };

    // PRD-OBS-04: Real-time audio levels handler
    const handleAudioLevels = (data) => {
      // Transform array of inputs into a Map keyed by inputName
      setAudioLevels(new Map(
        data.inputs.map(input => [input.inputName, input])
      ));
    };

    // PRD-OBS-04 Phase 1.5: Audio preset event handlers
    const handlePresetsList = (data) => {
      console.log('OBSContext: Presets list received', data.presets?.length || 0);
      setPresets(data.presets || []);
      setPresetsLoading(false);
    };

    const handlePresetApplied = (data) => {
      console.log('OBSContext: Preset applied', data.presetName, `(${data.applied}/${data.total})`);
      setPresetApplying(null);
      if (data.errors && data.errors.length > 0) {
        console.warn('OBSContext: Some sources failed:', data.errors);
      }
    };

    const handlePresetSaved = (data) => {
      console.log('OBSContext: Preset saved', data.preset?.name);
      // Refresh presets list
      socket.emit('obs:listPresets');
    };

    const handlePresetDeleted = (data) => {
      console.log('OBSContext: Preset deleted', data.presetId);
      // Remove from local state
      setPresets(prev => prev.filter(p => p.id !== data.presetId));
    };

    // PRD-OBS-11: Studio mode state changed handler
    const handleStudioModeChanged = (data) => {
      console.log('OBSContext: Studio mode changed', data);
      setObsState(prev => ({
        ...prev,
        studioModeEnabled: data.studioModeEnabled
      }));
    };

    // PRD-OBS-11: Template auto-applied notification
    const handleTemplateAutoApplied = (data) => {
      console.log('OBSContext: Template auto-applied', data);
      setAutoAppliedTemplate(data.templateId);
    };

    // Subscribe to all OBS events
    // Note: Event names must match server emissions in server/lib/obsStateSync.js
    socket.on('obs:stateUpdated', handleStateUpdate);
    socket.on('obs:connected', handleConnected);
    socket.on('obs:disconnected', handleDisconnected);
    socket.on('obs:currentSceneChanged', handleSceneChanged);
    socket.on('obs:previewSceneChanged', handlePreviewSceneChanged);
    socket.on('obs:streamStateChanged', handleStreamingStateChanged);
    socket.on('obs:recordStateChanged', handleRecordingStateChanged);
    socket.on('obs:currentTransitionChanged', handleTransitionChanged);
    socket.on('obs:transitionsList', handleTransitionsList);
    socket.on('obs:error', handleError);
    socket.on('obs:screenshotCaptured', handleScreenshotCaptured);
    // PRD-OBS-06: Stream & Recording events
    socket.on('obs:streamSettings', handleStreamSettings);
    socket.on('obs:streamStatus', handleStreamStatus);
    socket.on('obs:recordingStatus', handleRecordingStatus);
    socket.on('obs:streamStarted', handleStreamStarted);
    socket.on('obs:streamStopped', handleStreamStopped);
    socket.on('obs:recordingStarted', handleRecordingStarted);
    socket.on('obs:recordingStopped', handleRecordingStopped);
    socket.on('obs:recordingPaused', handleRecordingPaused);
    socket.on('obs:recordingResumed', handleRecordingResumed);
    // PRD-OBS-04: Real-time audio levels
    socket.on('obs:audioLevels', handleAudioLevels);
    // PRD-OBS-04 Phase 1.5: Audio preset events
    socket.on('obs:presetsList', handlePresetsList);
    socket.on('obs:presetApplied', handlePresetApplied);
    socket.on('obs:presetSaved', handlePresetSaved);
    socket.on('obs:presetDeleted', handlePresetDeleted);
    // PRD-OBS-11: Studio mode events
    socket.on('obs:studioModeChanged', handleStudioModeChanged);
    // PRD-OBS-11: Template auto-applied notification
    socket.on('obs:templateAutoApplied', handleTemplateAutoApplied);

    // Request initial state
    socket.emit('obs:refreshState');

    return () => {
      console.log('OBSContext: Cleaning up event listeners');
      socket.off('obs:stateUpdated', handleStateUpdate);
      socket.off('obs:connected', handleConnected);
      socket.off('obs:disconnected', handleDisconnected);
      socket.off('obs:currentSceneChanged', handleSceneChanged);
      socket.off('obs:previewSceneChanged', handlePreviewSceneChanged);
      socket.off('obs:streamStateChanged', handleStreamingStateChanged);
      socket.off('obs:recordStateChanged', handleRecordingStateChanged);
      socket.off('obs:currentTransitionChanged', handleTransitionChanged);
      socket.off('obs:transitionsList', handleTransitionsList);
      socket.off('obs:error', handleError);
      socket.off('obs:screenshotCaptured', handleScreenshotCaptured);
      // PRD-OBS-06: Stream & Recording events cleanup
      socket.off('obs:streamSettings', handleStreamSettings);
      socket.off('obs:streamStatus', handleStreamStatus);
      socket.off('obs:recordingStatus', handleRecordingStatus);
      socket.off('obs:streamStarted', handleStreamStarted);
      socket.off('obs:streamStopped', handleStreamStopped);
      socket.off('obs:recordingStarted', handleRecordingStarted);
      socket.off('obs:recordingStopped', handleRecordingStopped);
      socket.off('obs:recordingPaused', handleRecordingPaused);
      socket.off('obs:recordingResumed', handleRecordingResumed);
      // PRD-OBS-04: Real-time audio levels cleanup
      socket.off('obs:audioLevels', handleAudioLevels);
      // PRD-OBS-04 Phase 1.5: Audio preset events cleanup
      socket.off('obs:presetsList', handlePresetsList);
      socket.off('obs:presetApplied', handlePresetApplied);
      socket.off('obs:presetSaved', handlePresetSaved);
      socket.off('obs:presetDeleted', handlePresetDeleted);
      // PRD-OBS-11: Studio mode events cleanup
      socket.off('obs:studioModeChanged', handleStudioModeChanged);
      // PRD-OBS-11: Template auto-applied cleanup
      socket.off('obs:templateAutoApplied', handleTemplateAutoApplied);
    };
  }, [socket, connected]);

  // Action callbacks
  const switchScene = useCallback((sceneName) => {
    console.log('OBSContext: Switching scene to', sceneName);
    socket?.emit('switchScene', { sceneName });
  }, [socket]);

  const setPreviewScene = useCallback((sceneName) => {
    console.log('OBSContext: Setting preview scene to', sceneName);
    socket?.emit('obs:setPreviewScene', { sceneName });
  }, [socket]);

  const transitionToProgram = useCallback(() => {
    console.log('OBSContext: Transitioning preview to program');
    socket?.emit('obs:transitionToProgram');
  }, [socket]);

  const setTransition = useCallback((transitionName, duration) => {
    console.log('OBSContext: Setting transition', transitionName, duration);
    socket?.emit('obs:setTransition', { transitionName, duration });
  }, [socket]);

  // PRD-OBS-05: Transition Management
  const setCurrentTransition = useCallback((transitionName) => {
    console.log('OBSContext: Setting current transition', transitionName);
    socket?.emit('obs:setCurrentTransition', { transitionName });
  }, [socket]);

  const setTransitionDuration = useCallback((transitionDuration) => {
    console.log('OBSContext: Setting transition duration', transitionDuration);
    socket?.emit('obs:setTransitionDuration', { transitionDuration });
  }, [socket]);

  const getTransitions = useCallback(() => {
    console.log('OBSContext: Getting transitions');
    socket?.emit('obs:getTransitions');
  }, [socket]);

  const setTransitionSettings = useCallback((transitionName, transitionSettings) => {
    console.log('OBSContext: Setting transition settings', transitionName, transitionSettings);
    socket?.emit('obs:setTransitionSettings', { transitionName, transitionSettings });
  }, [socket]);

  // PRD-OBS-11: Get transition settings (for stinger configuration)
  const getTransitionSettings = useCallback((transitionName) => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }
      console.log('OBSContext: Getting transition settings for', transitionName);
      socket.emit('obs:getTransitionSettings', { transitionName }, (response) => {
        if (response.error) {
          console.error('OBSContext: Failed to get transition settings:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('OBSContext: Received transition settings:', response);
          resolve(response);
        }
      });
    });
  }, [socket]);

  const setVolume = useCallback((inputName, volumeDb) => {
    console.log('OBSContext: Setting volume', inputName, volumeDb);
    socket?.emit('obs:setVolume', { inputName, volumeDb });
  }, [socket]);

  const setMute = useCallback((inputName, muted) => {
    console.log('OBSContext: Setting mute', inputName, muted);
    socket?.emit('obs:setMute', { inputName, muted });
  }, [socket]);

  // Apply an audio preset (corrected event name for Phase 1.5)
  const applyPreset = useCallback((presetId) => {
    console.log('OBSContext: Applying preset', presetId);
    socket?.emit('obs:applyPreset', { presetId });
  }, [socket]);

  // Alias for backwards compatibility
  const loadPreset = applyPreset;

  // List all audio presets (default + user-created)
  const listPresets = useCallback(() => {
    console.log('OBSContext: Listing presets');
    socket?.emit('obs:listPresets');
  }, [socket]);

  // Save current audio mix as a new preset
  const savePreset = useCallback((name, description, sources) => {
    console.log('OBSContext: Saving preset', name);
    socket?.emit('obs:savePreset', { name, description, sources });
  }, [socket]);

  // Delete a user-created preset
  const deletePreset = useCallback((presetId) => {
    console.log('OBSContext: Deleting preset', presetId);
    socket?.emit('obs:deletePreset', { presetId });
  }, [socket]);

  const startStream = useCallback(() => {
    console.log('OBSContext: Starting stream');
    socket?.emit('obs:startStream');
  }, [socket]);

  const stopStream = useCallback(() => {
    console.log('OBSContext: Stopping stream');
    socket?.emit('obs:stopStream');
  }, [socket]);

  const startRecording = useCallback(() => {
    console.log('OBSContext: Starting recording');
    socket?.emit('obs:startRecording');
  }, [socket]);

  const stopRecording = useCallback(() => {
    console.log('OBSContext: Stopping recording');
    socket?.emit('obs:stopRecording');
  }, [socket]);

  // PRD-OBS-06: Additional stream/recording controls
  const getStreamSettings = useCallback(() => {
    console.log('OBSContext: Getting stream settings');
    socket?.emit('obs:getStreamSettings');
  }, [socket]);

  const setStreamSettings = useCallback((serviceType, settings) => {
    console.log('OBSContext: Setting stream settings', serviceType, settings);
    socket?.emit('obs:setStreamSettings', { serviceType, settings });
  }, [socket]);

  const getStreamStatus = useCallback(() => {
    console.log('OBSContext: Getting stream status');
    socket?.emit('obs:getStreamStatus');
  }, [socket]);

  const pauseRecording = useCallback(() => {
    console.log('OBSContext: Pausing recording');
    socket?.emit('obs:pauseRecording');
  }, [socket]);

  const resumeRecording = useCallback(() => {
    console.log('OBSContext: Resuming recording');
    socket?.emit('obs:resumeRecording');
  }, [socket]);

  const getRecordingStatus = useCallback(() => {
    console.log('OBSContext: Getting recording status');
    socket?.emit('obs:getRecordingStatus');
  }, [socket]);

  const enableStudioMode = useCallback(() => {
    console.log('OBSContext: Enabling studio mode');
    socket?.emit('obs:enableStudioMode');
  }, [socket]);

  const disableStudioMode = useCallback(() => {
    console.log('OBSContext: Disabling studio mode');
    socket?.emit('obs:disableStudioMode');
  }, [socket]);

  const createScene = useCallback((sceneName, templateId = null) => {
    console.log('OBSContext: Creating scene', sceneName, templateId ? `from template ${templateId}` : '(blank)');
    socket?.emit('obs:createScene', { sceneName, templateId });
  }, [socket]);

  const deleteScene = useCallback((sceneName) => {
    console.log('OBSContext: Deleting scene', sceneName);
    socket?.emit('obs:deleteScene', { sceneName });
  }, [socket]);

  const deleteAllScenes = useCallback(() => {
    console.log('OBSContext: Deleting all scenes');
    socket?.emit('obs:deleteAllScenes');
  }, [socket]);

  const duplicateScene = useCallback((sceneName, newSceneName) => {
    console.log('OBSContext: Duplicating scene', sceneName, 'to', newSceneName);
    socket?.emit('obs:duplicateScene', { sceneName, newSceneName });
  }, [socket]);

  const renameScene = useCallback((sceneName, newSceneName) => {
    console.log('OBSContext: Renaming scene', sceneName, 'to', newSceneName);
    socket?.emit('obs:renameScene', { sceneName, newSceneName });
  }, [socket]);

  const reorderScenes = useCallback((sceneNames) => {
    console.log('OBSContext: Reordering scenes', sceneNames);
    socket?.emit('obs:reorderScenes', { sceneNames });
  }, [socket]);

  // Scene item actions
  const toggleItemVisibility = useCallback((sceneName, sceneItemId, enabled) => {
    console.log('OBSContext: Toggle item visibility', sceneName, sceneItemId, enabled);
    socket?.emit('obs:toggleItemVisibility', { sceneName, sceneItemId, enabled });
  }, [socket]);

  const toggleItemLock = useCallback((sceneName, sceneItemId, locked) => {
    console.log('OBSContext: Toggle item lock', sceneName, sceneItemId, locked);
    socket?.emit('obs:toggleItemLock', { sceneName, sceneItemId, locked });
  }, [socket]);

  const deleteSceneItem = useCallback((sceneName, sceneItemId) => {
    console.log('OBSContext: Delete scene item', sceneName, sceneItemId);
    socket?.emit('obs:deleteSceneItem', { sceneName, sceneItemId });
  }, [socket]);

  const reorderSceneItems = useCallback((sceneName, sceneItemId, newIndex) => {
    console.log('OBSContext: Reorder scene items', sceneName, sceneItemId, newIndex);
    socket?.emit('obs:reorderSceneItems', { sceneName, sceneItemId, newIndex });
  }, [socket]);

  const applyTransformPreset = useCallback((sceneName, sceneItemId, transform) => {
    console.log('OBSContext: Apply transform preset', sceneName, sceneItemId, transform);
    socket?.emit('obs:applyTransformPreset', { sceneName, sceneItemId, transform });
  }, [socket]);

  const addSourceToScene = useCallback((sceneName, sourceName) => {
    console.log('OBSContext: Add source to scene', sceneName, sourceName);
    socket?.emit('obs:addSourceToScene', { sceneName, sourceName });
  }, [socket]);

  // Create a new input/source and optionally add it to a scene
  const createInput = useCallback((inputName, inputKind, inputSettings, sceneName = null) => {
    console.log('OBSContext: Creating input', inputName, inputKind, inputSettings, sceneName ? `in scene ${sceneName}` : '');
    socket?.emit('obs:createInput', { inputName, inputKind, inputSettings, sceneName });
  }, [socket]);

  // Remove an input entirely from OBS (PRD-OBS-03: Source Management)
  const removeInput = useCallback((inputName) => {
    console.log('OBSContext: Removing input', inputName);
    socket?.emit('obs:removeInput', { inputName });
  }, [socket]);

  // Update input settings (PRD-OBS-03: Source Management)
  const updateInputSettings = useCallback((inputName, inputSettings) => {
    console.log('OBSContext: Updating input settings', inputName, inputSettings);
    socket?.emit('obs:updateInputSettings', { inputName, inputSettings });
  }, [socket]);

  // Get input settings (for SourceEditor to load current values)
  const getInputSettings = useCallback((inputName) => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }
      console.log('OBSContext: Getting input settings for', inputName);
      socket.emit('obs:getInputSettings', { inputName }, (response) => {
        if (response.error) {
          console.error('OBSContext: Failed to get input settings:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('OBSContext: Received input settings:', response);
          resolve(response);
        }
      });
    });
  }, [socket]);

  // Set scene item transform (PRD-OBS-03: Source Management)
  const setSceneItemTransform = useCallback((sceneName, sceneItemId, transform) => {
    console.log('OBSContext: Setting scene item transform', sceneName, sceneItemId, transform);
    socket?.emit('obs:setSceneItemTransform', { sceneName, sceneItemId, transform });
  }, [socket]);

  // Audio monitoring
  const setMonitorType = useCallback((inputName, monitorType) => {
    console.log('OBSContext: Set monitor type', inputName, monitorType);
    socket?.emit('obs:setMonitorType', { inputName, monitorType });
  }, [socket]);

  // PRD-OBS-04: Audio level subscription (for real-time VU meters)
  const subscribeAudioLevels = useCallback(() => {
    console.log('OBSContext: Subscribing to audio levels');
    socket?.emit('obs:subscribeAudioLevels', { enabled: true });
  }, [socket]);

  const unsubscribeAudioLevels = useCallback(() => {
    console.log('OBSContext: Unsubscribing from audio levels');
    socket?.emit('obs:subscribeAudioLevels', { enabled: false });
    // Clear audio levels when unsubscribing
    setAudioLevels(new Map());
  }, [socket]);

  // Screenshot capture
  const takeScreenshot = useCallback(() => {
    console.log('OBSContext: Taking screenshot');
    socket?.emit('obs:takeScreenshot');
  }, [socket]);

  const refreshState = useCallback(() => {
    console.log('OBSContext: Refreshing state');
    socket?.emit('obs:refreshState');
  }, [socket]);

  const connectOBS = useCallback((config) => {
    console.log('OBSContext: Connecting to OBS', config);
    socket?.emit('obs:connect', config);
  }, [socket]);

  const disconnectOBS = useCallback(() => {
    console.log('OBSContext: Disconnecting from OBS');
    socket?.emit('obs:disconnect');
  }, [socket]);

  // PRD-OBS-11: Toggle auto-load template preference
  const setAutoLoadTemplateEnabled = useCallback((enabled) => {
    setAutoLoadEnabled(enabled);
    localStorage.setItem(AUTO_LOAD_TEMPLATE_KEY, String(enabled));
    console.log('OBSContext: Auto-load template', enabled ? 'enabled' : 'disabled');
  }, []);

  // PRD-OBS-11: Get default template for a meet type
  const getDefaultTemplate = useCallback((meetType) => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }
      console.log('OBSContext: Getting default template for', meetType);
      socket.emit('obs:getDefaultTemplate', { meetType }, (response) => {
        if (response.error) {
          console.error('OBSContext: Failed to get default template:', response.error);
          reject(new Error(response.error));
        } else {
          console.log('OBSContext: Default template result:', response.template?.name || 'none');
          resolve(response.template);
        }
      });
    });
  }, [socket]);

  // PRD-OBS-11: Reset auto-apply state (called when entering a new competition)
  const resetAutoApplyState = useCallback(() => {
    hasAttemptedAutoApply.current = false;
    setAutoAppliedTemplate(null);
  }, []);

  const value = {
    // State
    obsState,
    obsConnected,
    connectionError,

    // Scene actions
    switchScene,
    setPreviewScene,
    transitionToProgram,

    // Transition actions
    setTransition,
    setCurrentTransition,
    setTransitionDuration,
    getTransitions,
    setTransitionSettings,
    getTransitionSettings,

    // Audio actions
    setVolume,
    setMute,

    // Preset actions (PRD-OBS-04 Phase 1.5)
    loadPreset,
    applyPreset,
    listPresets,
    savePreset,
    deletePreset,
    presets,
    presetsLoading,
    presetApplying,

    // Streaming actions
    startStream,
    stopStream,
    getStreamSettings,
    setStreamSettings,
    getStreamStatus,

    // Recording actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getRecordingStatus,

    // Studio mode actions
    enableStudioMode,
    disableStudioMode,

    // Scene CRUD actions
    createScene,
    deleteScene,
    deleteAllScenes,
    duplicateScene,
    renameScene,
    reorderScenes,

    // Scene item actions
    toggleItemVisibility,
    toggleItemLock,
    deleteSceneItem,
    reorderSceneItems,
    applyTransformPreset,
    addSourceToScene,
    createInput,
    removeInput,
    updateInputSettings,
    getInputSettings,
    setSceneItemTransform,

    // Audio monitoring
    setMonitorType,

    // PRD-OBS-04: Real-time audio levels
    audioLevels,
    subscribeAudioLevels,
    unsubscribeAudioLevels,

    // Screenshot capture
    takeScreenshot,

    // Connection actions
    refreshState,
    connectOBS,
    disconnectOBS,

    // PRD-OBS-11: Template auto-loading
    autoLoadEnabled,
    setAutoLoadTemplateEnabled,
    autoAppliedTemplate,
    getDefaultTemplate,
    resetAutoApplyState
  };

  return (
    <OBSContext.Provider value={value}>
      {children}
    </OBSContext.Provider>
  );
}

export function useOBS() {
  const context = useContext(OBSContext);
  if (!context) {
    throw new Error('useOBS must be used within an OBSProvider');
  }
  return context;
}

export { OBSContext };
