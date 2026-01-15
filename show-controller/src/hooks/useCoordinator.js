import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Coordinator status states
 */
export const COORDINATOR_STATUS = {
  ONLINE: 'online',      // EC2 running AND app responding
  OFFLINE: 'offline',    // EC2 stopped
  STARTING: 'starting',  // EC2 pending or running but app not ready
  UNKNOWN: 'unknown',    // Initial state or error
};

/**
 * useCoordinator - Hook for managing coordinator EC2 instance state
 *
 * Checks coordinator status via Netlify serverless functions and provides
 * the ability to wake the coordinator when it's sleeping.
 *
 * @returns {Object} Coordinator state and actions
 */
export function useCoordinator() {
  const [status, setStatus] = useState(COORDINATOR_STATUS.UNKNOWN);
  const [appReady, setAppReady] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);

  // Polling interval ref
  const pollingRef = useRef(null);
  const pollingStartTime = useRef(null);

  // Maximum polling duration: 2 minutes
  const MAX_POLLING_MS = 2 * 60 * 1000;
  // Polling interval: 5 seconds
  const POLL_INTERVAL_MS = 5 * 1000;

  /**
   * Check coordinator status via Netlify function
   * @returns {Promise<Object>} Status response
   */
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch('/.netlify/functions/coordinator-status', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Determine status based on EC2 state and app readiness
      let newStatus;
      if (data.state === 'stopped') {
        newStatus = COORDINATOR_STATUS.OFFLINE;
      } else if (data.state === 'running' && data.appReady) {
        newStatus = COORDINATOR_STATUS.ONLINE;
      } else if (data.state === 'running' || data.state === 'pending') {
        newStatus = COORDINATOR_STATUS.STARTING;
      } else {
        newStatus = COORDINATOR_STATUS.UNKNOWN;
      }

      setStatus(newStatus);
      setAppReady(data.appReady || false);
      setDetails({
        state: data.state,
        publicIp: data.publicIp,
        uptime: data.uptime,
        idleMinutes: data.idleMinutes,
        launchTime: data.launchTime,
        firebase: data.firebase,
        cached: data.cached,
        timestamp: data.timestamp,
      });
      setError(null);

      return {
        success: true,
        status: newStatus,
        appReady: data.appReady || false,
        data,
      };
    } catch (err) {
      setError(err.message);
      // On error, set status to OFFLINE so user can try to wake
      // This prevents infinite "Checking system status..." state
      setStatus(COORDINATOR_STATUS.OFFLINE);
      return {
        success: false,
        error: err.message,
      };
    }
  }, []);

  /**
   * Wake the coordinator via Netlify function
   * @returns {Promise<Object>} Wake response
   */
  const wake = useCallback(async () => {
    if (isWaking) {
      return { success: false, error: 'Already waking' };
    }

    setIsWaking(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/wake-coordinator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to wake coordinator');
      }

      // If already running, update status immediately
      if (data.state === 'running') {
        setStatus(COORDINATOR_STATUS.ONLINE);
        setAppReady(true);
        setIsWaking(false);
        return { success: true, alreadyRunning: true };
      }

      // Start polling for readiness
      setStatus(COORDINATOR_STATUS.STARTING);
      startPolling();

      return {
        success: true,
        estimatedReadySeconds: data.estimatedReadySeconds || 60,
      };
    } catch (err) {
      setError(err.message);
      setIsWaking(false);
      return {
        success: false,
        error: err.message,
      };
    }
  }, [isWaking]);

  /**
   * Start polling for coordinator readiness
   */
  const startPolling = useCallback(() => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingStartTime.current = Date.now();

    pollingRef.current = setInterval(async () => {
      // Check if we've exceeded max polling time
      const elapsed = Date.now() - pollingStartTime.current;
      if (elapsed >= MAX_POLLING_MS) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setIsWaking(false);
        setError('Coordinator did not become ready within 2 minutes');
        return;
      }

      // Check status
      const result = await checkStatus();

      // If coordinator is now online, stop polling
      if (result.status === COORDINATOR_STATUS.ONLINE) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setIsWaking(false);
      }
    }, POLL_INTERVAL_MS);
  }, [checkStatus]);

  /**
   * Stop polling manually
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsWaking(false);
  }, []);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Initial status check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Computed: is the coordinator available for use
  const isAvailable = status === COORDINATOR_STATUS.ONLINE && appReady;

  // Computed: time remaining for polling (rough estimate)
  const estimatedTimeRemaining = isWaking && pollingStartTime.current
    ? Math.max(0, Math.ceil((MAX_POLLING_MS - (Date.now() - pollingStartTime.current)) / 1000))
    : null;

  return {
    // State
    status,
    appReady,
    isWaking,
    error,
    details,

    // Actions
    checkStatus,
    wake,
    stopPolling,

    // Computed
    isAvailable,
    estimatedTimeRemaining,

    // Re-export status constants
    COORDINATOR_STATUS,
  };
}

export default useCoordinator;
