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

  useEffect(() => {
    const socketUrl = import.meta.env.PROD
      ? window.location.origin
      : 'http://localhost:3003';

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
    clearGraphic
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
