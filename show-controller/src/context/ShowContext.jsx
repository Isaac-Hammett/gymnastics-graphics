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
    overrideCamera
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
