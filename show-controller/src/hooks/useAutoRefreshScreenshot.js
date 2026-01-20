import { useState, useEffect, useRef, useCallback } from 'react';
import { useShow } from '../context/ShowContext';

/**
 * Auto-refresh screenshot via Socket.io
 * PRD-OBS-09: Preview System
 *
 * @param {Object} options - Screenshot options
 * @param {number} options.intervalMs - Refresh interval (default 2000)
 * @param {string} options.sceneName - Optional scene name (null = current program)
 * @param {number} options.imageWidth - Image width (default 640)
 * @param {number} options.imageHeight - Image height (default 360)
 * @param {string} options.imageFormat - Image format: 'jpg' or 'png' (default 'jpg')
 * @param {boolean} options.enabled - Whether auto-refresh is enabled (default true)
 */
export function useAutoRefreshScreenshot(options = {}) {
  const { socket, connected } = useShow();
  const {
    intervalMs = 2000,
    sceneName = null,
    imageWidth = 640,
    imageHeight = 360,
    imageFormat = 'jpg',
    enabled = true
  } = options;

  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);
  const requestPendingRef = useRef(false);

  // Request screenshot via socket
  const requestScreenshot = useCallback(() => {
    if (!socket || !connected || isPaused || !enabled || requestPendingRef.current) return;

    requestPendingRef.current = true;
    setLoading(prev => imageData === null ? true : prev); // Only show loading on first load

    socket.emit('obs:requestScreenshot', {
      sceneName,
      imageWidth,
      imageHeight,
      imageFormat
    });
  }, [socket, connected, isPaused, enabled, sceneName, imageWidth, imageHeight, imageFormat, imageData]);

  // Listen for screenshot responses
  useEffect(() => {
    if (!socket) return;

    const handleData = (data) => {
      requestPendingRef.current = false;
      if (data.success) {
        setImageData(data.imageData);
        setLastUpdated(new Date(data.timestamp));
        setError(null);
      }
      setLoading(false);
    };

    const handleError = (data) => {
      requestPendingRef.current = false;
      setError(data.error);
      setLoading(false);
    };

    socket.on('obs:screenshotData', handleData);
    socket.on('obs:screenshotError', handleError);

    return () => {
      socket.off('obs:screenshotData', handleData);
      socket.off('obs:screenshotError', handleError);
    };
  }, [socket]);

  // Pause when tab not visible
  useEffect(() => {
    const handleVisibility = () => {
      setIsPaused(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!enabled || !connected) return;

    // Initial request
    requestScreenshot();

    // Set up interval
    intervalRef.current = setInterval(requestScreenshot, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [requestScreenshot, intervalMs, enabled, connected]);

  // Manual refresh function
  const refresh = useCallback(() => {
    requestPendingRef.current = false; // Reset pending state
    requestScreenshot();
  }, [requestScreenshot]);

  return {
    imageData,
    loading,
    error,
    lastUpdated,
    isPaused,
    setIsPaused,
    refresh
  };
}
