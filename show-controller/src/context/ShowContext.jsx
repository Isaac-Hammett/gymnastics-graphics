import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const ShowContext = createContext(null);

export function ShowProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [state, setState] = useState({
    currentSegmentIndex: 0,
    currentSegment: null,
    nextSegment: null,
    isPlaying: false,
    isPaused: false,
    talentLocked: false,
    obsConnected: false,
    obsCurrentScene: null,
    obsIsStreaming: false,
    obsIsRecording: false,
    connectedClients: [],
    showProgress: { completed: 0, total: 0 },
    showConfig: null
  });
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);

  // Camera state
  const [cameraHealth, setCameraHealth] = useState([]);
  const [cameraRuntimeState, setCameraRuntimeState] = useState([]);
  const [activeFallbacks, setActiveFallbacks] = useState([]);

  // Timesheet state
  const [timesheetState, setTimesheetState] = useState({
    state: 'stopped',
    isRunning: false,
    isPaused: false,
    currentSegmentIndex: -1,
    currentSegment: null,
    nextSegment: null,
    segmentElapsedMs: 0,
    segmentRemainingMs: 0,
    segmentProgress: 0,
    showElapsedMs: 0,
    isHoldSegment: false,
    canAdvanceHold: false,
    holdRemainingMs: 0
  });
  const [overrideLog, setOverrideLog] = useState([]);

  useEffect(() => {
    // Use VITE_SOCKET_SERVER env var if set, otherwise fall back to origin (prod) or localhost (dev)
    const socketUrl = import.meta.env.VITE_SOCKET_SERVER
      || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3003');

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('connected', ({ clientId, state }) => {
      setClientId(clientId);
      setState(state);
    });

    newSocket.on('stateUpdate', (newState) => {
      setState(newState);
    });

    newSocket.on('timeUpdate', ({ elapsed }) => {
      setElapsed(elapsed);
    });

    newSocket.on('sceneChanged', (sceneName) => {
      setState(prev => ({ ...prev, obsCurrentScene: sceneName }));
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Camera health events
    newSocket.on('cameraHealth', (health) => {
      console.log('Camera health update:', health);
      setCameraHealth(health);
    });

    // Camera runtime state events
    newSocket.on('cameraRuntimeState', (runtimeState) => {
      console.log('Camera runtime state update:', runtimeState);
      setCameraRuntimeState(runtimeState);
    });

    // Camera status changed event (individual camera transitions)
    newSocket.on('cameraStatusChanged', ({ cameraId, previousStatus, currentStatus, health }) => {
      console.log(`Camera ${cameraId} status changed: ${previousStatus} -> ${currentStatus}`);
      // Update the specific camera in cameraHealth array
      setCameraHealth(prev => prev.map(cam =>
        cam.cameraId === cameraId ? { ...cam, status: currentStatus, ...health } : cam
      ));
    });

    // Fallback events
    newSocket.on('activeFallbacks', (fallbacks) => {
      console.log('Active fallbacks:', fallbacks);
      setActiveFallbacks(fallbacks);
    });

    newSocket.on('fallbackActivated', ({ originalCameraId, fallbackCameraId, reason }) => {
      console.log(`Fallback activated: ${originalCameraId} -> ${fallbackCameraId} (${reason})`);
      setActiveFallbacks(prev => [
        ...prev.filter(f => f.originalCameraId !== originalCameraId),
        { originalCameraId, fallbackCameraId, reason, activatedAt: Date.now() }
      ]);
    });

    newSocket.on('fallbackCleared', ({ cameraId }) => {
      console.log(`Fallback cleared for camera: ${cameraId}`);
      setActiveFallbacks(prev => prev.filter(f => f.originalCameraId !== cameraId));
    });

    newSocket.on('fallbackUnavailable', ({ cameraId, reason }) => {
      console.log(`No fallback available for camera ${cameraId}: ${reason}`);
    });

    newSocket.on('fallbackChainExhausted', ({ originalCameraId }) => {
      console.log(`Fallback chain exhausted for camera: ${originalCameraId}`);
    });

    // Camera apparatus events
    newSocket.on('apparatusReassigned', ({ cameraId, previousApparatus, currentApparatus, assignedBy }) => {
      console.log(`Camera ${cameraId} apparatus reassigned: ${previousApparatus} -> ${currentApparatus}`);
      setCameraRuntimeState(prev => prev.map(cam =>
        cam.cameraId === cameraId ? { ...cam, currentApparatus } : cam
      ));
    });

    newSocket.on('cameraVerified', ({ cameraId, verifiedBy, verifiedAt }) => {
      console.log(`Camera ${cameraId} verified by ${verifiedBy}`);
      setCameraRuntimeState(prev => prev.map(cam =>
        cam.cameraId === cameraId ? { ...cam, verified: true, verifiedBy, verifiedAt } : cam
      ));
    });

    newSocket.on('mismatchDetected', ({ cameraId, expected, current }) => {
      console.log(`Camera ${cameraId} mismatch: expected ${expected}, got ${current}`);
    });

    // Timesheet events
    newSocket.on('timesheetState', (state) => {
      console.log('Timesheet state:', state);
      setTimesheetState(state);
    });

    newSocket.on('timesheetTick', (tickData) => {
      setTimesheetState(prev => ({
        ...prev,
        segmentElapsedMs: tickData.segmentElapsedMs,
        segmentRemainingMs: tickData.segmentRemainingMs,
        segmentProgress: tickData.segmentProgress,
        showElapsedMs: tickData.showElapsedMs,
        isHoldSegment: tickData.isHoldSegment,
        canAdvanceHold: tickData.canAdvanceHold,
        holdRemainingMs: tickData.holdRemainingMs
      }));
    });

    newSocket.on('timesheetSegmentActivated', ({ segment, index, previousSegment }) => {
      console.log(`Timesheet segment activated: ${segment?.name} (index ${index})`);
      setTimesheetState(prev => ({
        ...prev,
        currentSegment: segment,
        currentSegmentIndex: index,
        segmentElapsedMs: 0,
        segmentRemainingMs: segment?.duration || 0,
        segmentProgress: 0
      }));
    });

    newSocket.on('timesheetSegmentCompleted', ({ segment, index, endReason }) => {
      console.log(`Timesheet segment completed: ${segment?.name} (${endReason})`);
    });

    newSocket.on('timesheetShowStarted', () => {
      console.log('Timesheet show started');
      setTimesheetState(prev => ({
        ...prev,
        state: 'running',
        isRunning: true,
        isPaused: false
      }));
    });

    newSocket.on('timesheetShowStopped', () => {
      console.log('Timesheet show stopped');
      setTimesheetState(prev => ({
        ...prev,
        state: 'stopped',
        isRunning: false,
        isPaused: false
      }));
    });

    newSocket.on('timesheetStateChanged', ({ state: engineState }) => {
      console.log(`Timesheet state changed: ${engineState}`);
      setTimesheetState(prev => ({
        ...prev,
        state: engineState,
        isRunning: engineState === 'running',
        isPaused: engineState === 'paused'
      }));
    });

    newSocket.on('timesheetHoldStarted', ({ segment, minDuration, maxDuration }) => {
      console.log(`Timesheet hold started: min ${minDuration}ms, max ${maxDuration}ms`);
      setTimesheetState(prev => ({
        ...prev,
        isHoldSegment: true,
        canAdvanceHold: false
      }));
    });

    newSocket.on('timesheetHoldMaxReached', ({ segment }) => {
      console.log(`Timesheet hold max reached: ${segment?.name}`);
    });

    newSocket.on('timesheetAutoAdvancing', ({ fromSegment, toSegment }) => {
      console.log(`Timesheet auto-advancing: ${fromSegment?.name} -> ${toSegment?.name}`);
    });

    newSocket.on('timesheetOverrideRecorded', (override) => {
      console.log('Timesheet override recorded:', override);
      setOverrideLog(prev => [...prev, override]);
    });

    newSocket.on('timesheetSceneChanged', ({ sceneName }) => {
      console.log(`Timesheet scene changed: ${sceneName}`);
    });

    newSocket.on('timesheetSceneOverridden', ({ sceneName, triggeredBy }) => {
      console.log(`Timesheet scene overridden: ${sceneName} by ${triggeredBy}`);
    });

    newSocket.on('timesheetCameraOverridden', ({ cameraId, sceneName, triggeredBy }) => {
      console.log(`Timesheet camera overridden: ${cameraId} (${sceneName}) by ${triggeredBy}`);
    });

    newSocket.on('timesheetGraphicTriggered', ({ graphic, segment }) => {
      console.log(`Timesheet graphic triggered: ${graphic}`);
    });

    newSocket.on('timesheetVideoStarted', ({ videoPath, segment }) => {
      console.log(`Timesheet video started: ${videoPath}`);
    });

    newSocket.on('timesheetBreakStarted', ({ segment }) => {
      console.log(`Timesheet break started: ${segment?.name}`);
    });

    newSocket.on('timesheetError', ({ message, type }) => {
      console.error(`Timesheet error (${type}): ${message}`);
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const identify = useCallback((role, name) => {
    socket?.emit('identify', { role, name });
  }, [socket]);

  const advance = useCallback(() => {
    socket?.emit('advance');
  }, [socket]);

  const previous = useCallback(() => {
    socket?.emit('previous');
  }, [socket]);

  const jumpTo = useCallback((segmentId) => {
    socket?.emit('jumpTo', { segmentId });
  }, [socket]);

  const overrideScene = useCallback((sceneName) => {
    socket?.emit('overrideScene', { sceneName });
  }, [socket]);

  const lockTalent = useCallback((locked) => {
    socket?.emit('lockTalent', { locked });
  }, [socket]);

  const togglePause = useCallback(() => {
    socket?.emit('togglePause');
  }, [socket]);

  const startShow = useCallback(() => {
    socket?.emit('startShow');
  }, [socket]);

  const resetShow = useCallback(() => {
    socket?.emit('resetShow');
  }, [socket]);

  const triggerGraphic = useCallback((graphic, data = {}) => {
    socket?.emit('triggerGraphic', { graphic, data });
  }, [socket]);

  const clearGraphic = useCallback(() => {
    socket?.emit('clearGraphic');
  }, [socket]);

  // Camera control functions
  const reassignApparatus = useCallback((cameraId, apparatus, assignedBy = 'producer') => {
    socket?.emit('reassignApparatus', { cameraId, apparatus, assignedBy });
  }, [socket]);

  const verifyCamera = useCallback((cameraId, verifiedBy = 'producer') => {
    socket?.emit('verifyCamera', { cameraId, verifiedBy });
  }, [socket]);

  const clearFallback = useCallback((cameraId) => {
    socket?.emit('clearFallback', { cameraId });
  }, [socket]);

  const resetVerifications = useCallback(() => {
    socket?.emit('resetVerifications');
  }, [socket]);

  const overrideCamera = useCallback((cameraId, triggeredBy = 'producer') => {
    socket?.emit('overrideCamera', { cameraId, triggeredBy });
  }, [socket]);

  // Timesheet control functions
  const startTimesheetShow = useCallback(() => {
    socket?.emit('startTimesheetShow');
  }, [socket]);

  const stopTimesheetShow = useCallback(() => {
    socket?.emit('stopTimesheetShow');
  }, [socket]);

  const advanceTimesheetSegment = useCallback((advancedBy = 'producer') => {
    socket?.emit('advanceSegment', { advancedBy });
  }, [socket]);

  const previousTimesheetSegment = useCallback((triggeredBy = 'producer') => {
    socket?.emit('previousSegment', { triggeredBy });
  }, [socket]);

  const goToTimesheetSegment = useCallback((segmentId, triggeredBy = 'producer') => {
    socket?.emit('goToSegment', { segmentId, triggeredBy });
  }, [socket]);

  const overrideTimesheetScene = useCallback((sceneName, triggeredBy = 'producer') => {
    socket?.emit('timesheetOverrideScene', { sceneName, triggeredBy });
  }, [socket]);

  const overrideTimesheetCamera = useCallback((cameraId, triggeredBy = 'producer') => {
    socket?.emit('overrideCamera', { cameraId, triggeredBy });
  }, [socket]);

  const getTimesheetOverrides = useCallback(() => {
    return overrideLog;
  }, [overrideLog]);

  const clearOverrideLog = useCallback(() => {
    setOverrideLog([]);
  }, []);

  const value = {
    socket,
    connected,
    clientId,
    state,
    elapsed,
    error,
    identify,
    advance,
    previous,
    jumpTo,
    overrideScene,
    lockTalent,
    togglePause,
    startShow,
    resetShow,
    triggerGraphic,
    clearGraphic,
    // Camera state
    cameraHealth,
    cameraRuntimeState,
    activeFallbacks,
    // Camera control functions
    reassignApparatus,
    verifyCamera,
    clearFallback,
    resetVerifications,
    overrideCamera,
    // Timesheet state
    timesheetState,
    overrideLog,
    // Timesheet control functions
    startTimesheetShow,
    stopTimesheetShow,
    advanceTimesheetSegment,
    previousTimesheetSegment,
    goToTimesheetSegment,
    overrideTimesheetScene,
    overrideTimesheetCamera,
    getTimesheetOverrides,
    clearOverrideLog
  };

  return (
    <ShowContext.Provider value={value}>
      {children}
    </ShowContext.Provider>
  );
}

export function useShow() {
  const context = useContext(ShowContext);
  if (!context) {
    throw new Error('useShow must be used within a ShowProvider');
  }
  return context;
}
