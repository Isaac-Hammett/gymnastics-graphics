import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useShow } from './ShowContext';

const OBSContext = createContext(null);

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
  studioModeEnabled: false,
  connectionError: null
};

export function OBSProvider({ children }) {
  // Get socket from ShowContext
  const { socket, connected } = useShow();

  // State
  const [obsState, setObsState] = useState(INITIAL_OBS_STATE);
  const [obsConnected, setObsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

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
      setObsConnected(state?.connected ?? false);
      setConnectionError(state?.connectionError ?? null);
    };

    const handleConnected = (data) => {
      console.log('OBSContext: OBS connected', data);
      setObsConnected(true);
      setConnectionError(null);
    };

    const handleDisconnected = (data) => {
      console.log('OBSContext: OBS disconnected', data);
      setObsConnected(false);
      if (data?.error) {
        setConnectionError(data.error);
      }
    };

    const handleSceneChanged = (sceneName) => {
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
        streaming: data.streaming
      }));
    };

    const handleRecordingStateChanged = (data) => {
      console.log('OBSContext: Recording state changed', data);
      setObsState(prev => ({
        ...prev,
        recording: data.recording
      }));
    };

    const handleTransitionChanged = (data) => {
      console.log('OBSContext: Transition changed', data);
      setObsState(prev => ({
        ...prev,
        currentTransition: data.transitionName
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

    // Subscribe to all OBS events
    // Note: Event names must match server emissions in server/lib/obsStateSync.js
    socket.on('obs:stateUpdated', handleStateUpdate);
    socket.on('obs:connected', handleConnected);
    socket.on('obs:disconnected', handleDisconnected);
    socket.on('sceneChanged', handleSceneChanged);
    socket.on('obs:previewSceneChanged', handlePreviewSceneChanged);
    socket.on('obs:streamStateChanged', handleStreamingStateChanged);
    socket.on('obs:recordStateChanged', handleRecordingStateChanged);
    socket.on('obs:currentTransitionChanged', handleTransitionChanged);
    socket.on('obs:error', handleError);
    socket.on('obs:screenshotCaptured', handleScreenshotCaptured);

    // Request initial state
    socket.emit('obs:refreshState');

    return () => {
      console.log('OBSContext: Cleaning up event listeners');
      socket.off('obs:stateUpdated', handleStateUpdate);
      socket.off('obs:connected', handleConnected);
      socket.off('obs:disconnected', handleDisconnected);
      socket.off('sceneChanged', handleSceneChanged);
      socket.off('obs:previewSceneChanged', handlePreviewSceneChanged);
      socket.off('obs:streamStateChanged', handleStreamingStateChanged);
      socket.off('obs:recordStateChanged', handleRecordingStateChanged);
      socket.off('obs:currentTransitionChanged', handleTransitionChanged);
      socket.off('obs:error', handleError);
      socket.off('obs:screenshotCaptured', handleScreenshotCaptured);
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

  const setVolume = useCallback((inputName, volumeDb) => {
    console.log('OBSContext: Setting volume', inputName, volumeDb);
    socket?.emit('obs:setVolume', { inputName, volumeDb });
  }, [socket]);

  const setMute = useCallback((inputName, muted) => {
    console.log('OBSContext: Setting mute', inputName, muted);
    socket?.emit('obs:setMute', { inputName, muted });
  }, [socket]);

  const loadPreset = useCallback((presetId) => {
    console.log('OBSContext: Loading preset', presetId);
    socket?.emit('obs:loadPreset', { presetId });
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

  // Audio monitoring
  const setMonitorType = useCallback((inputName, monitorType) => {
    console.log('OBSContext: Set monitor type', inputName, monitorType);
    socket?.emit('obs:setMonitorType', { inputName, monitorType });
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

    // Audio actions
    setVolume,
    setMute,

    // Preset actions
    loadPreset,

    // Streaming actions
    startStream,
    stopStream,
    startRecording,
    stopRecording,

    // Studio mode actions
    enableStudioMode,
    disableStudioMode,

    // Scene CRUD actions
    createScene,
    deleteScene,
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

    // Audio monitoring
    setMonitorType,

    // Screenshot capture
    takeScreenshot,

    // Connection actions
    refreshState,
    connectOBS,
    disconnectOBS
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
