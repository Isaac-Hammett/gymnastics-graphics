import { useCallback, useMemo } from 'react';
import { useShow } from '../context/ShowContext';

/**
 * Hook that provides camera health state and helper functions.
 *
 * Returns camera health array from context along with helper functions
 * to check individual camera health status.
 *
 * @returns {Object} Camera health state and helpers
 *
 * @example
 * const { cameraHealth, isHealthy, getCameraStatus } = useCameraHealth();
 * // cameraHealth = [{cameraId: 'cam-1', status: 'healthy', bitrate: 5000000, ...}, ...]
 * // isHealthy('cam-1') = true
 * // getCameraStatus('cam-1') = 'healthy'
 */
export function useCameraHealth() {
  const { cameraHealth } = useShow();

  /**
   * Check if a camera is healthy (status is 'healthy')
   * @param {string} cameraId - The camera ID to check
   * @returns {boolean} True if camera is healthy, false otherwise
   */
  const isHealthy = useCallback((cameraId) => {
    const camera = cameraHealth.find(cam => cam.cameraId === cameraId);
    return camera?.status === 'healthy';
  }, [cameraHealth]);

  /**
   * Get the health status for a specific camera
   * @param {string} cameraId - The camera ID to check
   * @returns {string|null} The camera status ('healthy', 'degraded', 'reconnecting', 'offline', 'unknown') or null if not found
   */
  const getCameraStatus = useCallback((cameraId) => {
    const camera = cameraHealth.find(cam => cam.cameraId === cameraId);
    return camera?.status || null;
  }, [cameraHealth]);

  /**
   * Get full health data for a specific camera
   * @param {string} cameraId - The camera ID to get health data for
   * @returns {Object|null} The camera health object or null if not found
   */
  const getCameraHealth = useCallback((cameraId) => {
    return cameraHealth.find(cam => cam.cameraId === cameraId) || null;
  }, [cameraHealth]);

  /**
   * Get all cameras with a specific health status
   * @param {string} status - The status to filter by ('healthy', 'degraded', 'reconnecting', 'offline', 'unknown')
   * @returns {Array} Array of camera health objects with the specified status
   */
  const getCamerasByStatus = useCallback((status) => {
    return cameraHealth.filter(cam => cam.status === status);
  }, [cameraHealth]);

  /**
   * Get all healthy cameras
   * @returns {Array} Array of camera health objects that are healthy
   */
  const healthyCameras = useMemo(() => {
    return cameraHealth.filter(cam => cam.status === 'healthy');
  }, [cameraHealth]);

  /**
   * Get all unhealthy cameras (not 'healthy' status)
   * @returns {Array} Array of camera health objects that are not healthy
   */
  const unhealthyCameras = useMemo(() => {
    return cameraHealth.filter(cam => cam.status !== 'healthy');
  }, [cameraHealth]);

  /**
   * Get count of cameras by status
   * @returns {Object} Object with status counts { healthy: n, degraded: n, reconnecting: n, offline: n, unknown: n }
   */
  const statusCounts = useMemo(() => {
    const counts = {
      healthy: 0,
      degraded: 0,
      reconnecting: 0,
      offline: 0,
      unknown: 0
    };
    cameraHealth.forEach(cam => {
      if (counts.hasOwnProperty(cam.status)) {
        counts[cam.status]++;
      }
    });
    return counts;
  }, [cameraHealth]);

  return {
    /**
     * Array of all camera health objects
     * @type {Array<{cameraId: string, status: string, bitrate?: number, packetLoss?: number, ...}>}
     */
    cameraHealth,

    /**
     * Check if a camera is healthy
     * @type {function(string): boolean}
     */
    isHealthy,

    /**
     * Get status for a specific camera
     * @type {function(string): string|null}
     */
    getCameraStatus,

    /**
     * Get full health data for a specific camera
     * @type {function(string): Object|null}
     */
    getCameraHealth,

    /**
     * Get all cameras with a specific status
     * @type {function(string): Array}
     */
    getCamerasByStatus,

    /**
     * Array of healthy cameras
     * @type {Array}
     */
    healthyCameras,

    /**
     * Array of unhealthy cameras
     * @type {Array}
     */
    unhealthyCameras,

    /**
     * Count of cameras by status
     * @type {{healthy: number, degraded: number, reconnecting: number, offline: number, unknown: number}}
     */
    statusCounts
  };
}

export default useCameraHealth;
