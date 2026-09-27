import { useState, useCallback, useEffect, useRef } from 'react';
import { getServerUrl } from '../lib/serverUrl';

// Shown when the status endpoint can't be reached (e.g. the EC2 instance is
// stopped between meets). The browser can't start EC2 itself.
const UNREACHABLE_MESSAGE =
  "Can't reach the coordinator. If the server is stopped, start it from AWS, then click Check Again.";

/**
 * Coordinator status states
 */
export const COORDINATOR_STATUS = {
  ONLINE: 'online',      // EC2 running AND app responding
  OFFLINE: 'offline',    // EC2 stopped
  STARTING: 'starting',  // EC2 pending or running but app not ready
  STOPPING: 'stopping',  // EC2 stopping
  UNKNOWN: 'unknown',    // Initial state or error
};

/**
 * useCoordinator - Hook for managing coordinator EC2 instance state
 *
 * Checks coordinator status via the coordinator's own /api/coordinator/status
 * endpoint. The old Netlify wake/stop functions no longer exist, so wake()
 * re-checks status (polling for up to 2 minutes) rather than starting EC2.
 *
 * @returns {Object} Coordinator state and actions
 */
export function useCoordinator() {
  const [status, setStatus] = useState(COORDINATOR_STATUS.UNKNOWN);
  const [appReady, setAppReady] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
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
   * Check coordinator status via the coordinator's status endpoint
   * @returns {Promise<Object>} Status response
   */
  const checkStatus = useCallback(async () => {
    try {
      let response;
      try {
        response = await fetch(`${getServerUrl()}/api/coordinator/status`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        // Network error or timeout: the coordinator is down or unreachable
        throw new Error(UNREACHABLE_MESSAGE);
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Determine status based on EC2 state and app readiness
      let newStatus;
      if (data.state === 'stopped') {
        newStatus = COORDINATOR_STATUS.OFFLINE;
        setIsStopping(false);
      } else if (data.state === 'stopping') {
        newStatus = COORDINATOR_STATUS.STOPPING;
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
        firebase: data.firebase ?? data.connections?.firebase,
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
   * "Wake": re-check status now, then keep polling for up to 2 minutes.
   * The browser can't start a stopped EC2 instance; this picks up a server
   * that was just started from AWS.
   * @returns {Promise<Object>} Wake response
   */
  const wake = useCallback(async () => {
    if (isWaking) {
      return { success: false, error: 'Already checking' };
    }

    setIsWaking(true);
    setError(null);

    const result = await checkStatus();
    if (result.status === COORDINATOR_STATUS.ONLINE) {
      setIsWaking(false);
      return { success: true, alreadyRunning: true };
    }

    startPolling();
    return { success: true };
  }, [isWaking, checkStatus]);

  /**
   * Stopping the coordinator from the browser is not supported: the old
   * Netlify stop function is gone. Stop the EC2 instance from AWS instead.
   * @returns {Promise<Object>} Stop response
   */
  const stop = useCallback(async () => {
    const message = 'Stopping the coordinator from the app is not supported. Stop the EC2 instance from AWS.';
    setError(message);
    return { success: false, error: message };
  }, []);

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
    isStopping,
    error,
    details,

    // Actions
    checkStatus,
    wake,
    stop,
    stopPolling,

    // Computed
    isAvailable,
    estimatedTimeRemaining,

    // Re-export status constants
    COORDINATOR_STATUS,
  };
}

export default useCoordinator;
