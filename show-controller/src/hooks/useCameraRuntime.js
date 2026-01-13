import { useCallback, useMemo } from 'react';
import { useShow } from '../context/ShowContext';

/**
 * Hook that provides camera runtime state and helper functions.
 *
 * Returns camera runtime state array from context along with helper functions
 * to query apparatus assignments, mismatches, and verification status.
 *
 * @returns {Object} Camera runtime state, helpers, and actions
 *
 * @example
 * const { cameraRuntimeState, getCameraForApparatus, getMismatches, reassign, verify } = useCameraRuntime();
 * // cameraRuntimeState = [{cameraId: 'cam-1', expectedApparatus: ['VT'], currentApparatus: ['VT'], verified: true, ...}, ...]
 * // getCameraForApparatus('VT') = {cameraId: 'cam-1', ...}
 * // getMismatches() = [{cameraId: 'cam-2', expected: ['FX'], current: ['PH']}, ...]
 */
export function useCameraRuntime() {
  const {
    cameraRuntimeState,
    reassignApparatus,
    verifyCamera,
    resetVerifications
  } = useShow();

  /**
   * Get the camera currently covering a specific apparatus
   * @param {string} apparatus - The apparatus code (FX, PH, SR, VT, PB, HB)
   * @returns {Object|null} The camera runtime state object or null if not found
   */
  const getCameraForApparatus = useCallback((apparatus) => {
    return cameraRuntimeState.find(cam =>
      cam.currentApparatus && cam.currentApparatus.includes(apparatus)
    ) || null;
  }, [cameraRuntimeState]);

  /**
   * Get all cameras covering a specific apparatus
   * @param {string} apparatus - The apparatus code (FX, PH, SR, VT, PB, HB)
   * @returns {Array} Array of camera runtime state objects covering the apparatus
   */
  const getAllCamerasForApparatus = useCallback((apparatus) => {
    return cameraRuntimeState.filter(cam =>
      cam.currentApparatus && cam.currentApparatus.includes(apparatus)
    );
  }, [cameraRuntimeState]);

  /**
   * Get all cameras with apparatus mismatches (currentApparatus != expectedApparatus)
   * @returns {Array} Array of mismatch objects with cameraId, expected, and current
   */
  const getMismatches = useCallback(() => {
    return cameraRuntimeState
      .filter(cam => {
        const expected = cam.expectedApparatus || [];
        const current = cam.currentApparatus || [];
        // Check if arrays are different (not same elements)
        if (expected.length !== current.length) return true;
        const sortedExpected = [...expected].sort();
        const sortedCurrent = [...current].sort();
        return !sortedExpected.every((val, idx) => val === sortedCurrent[idx]);
      })
      .map(cam => ({
        cameraId: cam.cameraId,
        cameraName: cam.name,
        expected: cam.expectedApparatus || [],
        current: cam.currentApparatus || []
      }));
  }, [cameraRuntimeState]);

  /**
   * Get all unverified cameras
   * @returns {Array} Array of camera runtime state objects that are not verified
   */
  const getUnverified = useCallback(() => {
    return cameraRuntimeState.filter(cam => !cam.verified);
  }, [cameraRuntimeState]);

  /**
   * Get all verified cameras
   * @returns {Array} Array of camera runtime state objects that are verified
   */
  const getVerified = useCallback(() => {
    return cameraRuntimeState.filter(cam => cam.verified);
  }, [cameraRuntimeState]);

  /**
   * Check if a specific camera has an apparatus mismatch
   * @param {string} cameraId - The camera ID to check
   * @returns {boolean} True if camera has a mismatch
   */
  const hasMismatch = useCallback((cameraId) => {
    const cam = cameraRuntimeState.find(c => c.cameraId === cameraId);
    if (!cam) return false;
    const expected = cam.expectedApparatus || [];
    const current = cam.currentApparatus || [];
    if (expected.length !== current.length) return true;
    const sortedExpected = [...expected].sort();
    const sortedCurrent = [...current].sort();
    return !sortedExpected.every((val, idx) => val === sortedCurrent[idx]);
  }, [cameraRuntimeState]);

  /**
   * Check if a specific camera is verified
   * @param {string} cameraId - The camera ID to check
   * @returns {boolean} True if camera is verified
   */
  const isVerified = useCallback((cameraId) => {
    const cam = cameraRuntimeState.find(c => c.cameraId === cameraId);
    return cam?.verified || false;
  }, [cameraRuntimeState]);

  /**
   * Get runtime state for a specific camera
   * @param {string} cameraId - The camera ID to get state for
   * @returns {Object|null} The camera runtime state object or null if not found
   */
  const getCameraState = useCallback((cameraId) => {
    return cameraRuntimeState.find(cam => cam.cameraId === cameraId) || null;
  }, [cameraRuntimeState]);

  /**
   * Reassign apparatus to a camera
   * @param {string} cameraId - The camera ID to reassign
   * @param {string[]} apparatus - Array of apparatus codes to assign
   * @param {string} [assignedBy='producer'] - Who is making the reassignment
   */
  const reassign = useCallback((cameraId, apparatus, assignedBy = 'producer') => {
    reassignApparatus(cameraId, apparatus, assignedBy);
  }, [reassignApparatus]);

  /**
   * Mark a camera as verified
   * @param {string} cameraId - The camera ID to verify
   * @param {string} [verifiedBy='producer'] - Who is verifying the camera
   */
  const verify = useCallback((cameraId, verifiedBy = 'producer') => {
    verifyCamera(cameraId, verifiedBy);
  }, [verifyCamera]);

  /**
   * Memoized list of cameras with mismatches
   */
  const mismatches = useMemo(() => getMismatches(), [getMismatches]);

  /**
   * Memoized list of unverified cameras
   */
  const unverifiedCameras = useMemo(() => getUnverified(), [getUnverified]);

  /**
   * Memoized list of verified cameras
   */
  const verifiedCameras = useMemo(() => getVerified(), [getVerified]);

  /**
   * Memoized count of mismatches and verification status
   */
  const statusCounts = useMemo(() => ({
    total: cameraRuntimeState.length,
    verified: cameraRuntimeState.filter(c => c.verified).length,
    unverified: cameraRuntimeState.filter(c => !c.verified).length,
    mismatches: getMismatches().length
  }), [cameraRuntimeState, getMismatches]);

  return {
    /**
     * Array of all camera runtime state objects
     * @type {Array<{cameraId: string, name: string, expectedApparatus: string[], currentApparatus: string[], verified: boolean, ...}>}
     */
    cameraRuntimeState,

    /**
     * Get camera covering a specific apparatus
     * @type {function(string): Object|null}
     */
    getCameraForApparatus,

    /**
     * Get all cameras covering a specific apparatus
     * @type {function(string): Array}
     */
    getAllCamerasForApparatus,

    /**
     * Get all cameras with apparatus mismatches
     * @type {function(): Array}
     */
    getMismatches,

    /**
     * Get all unverified cameras
     * @type {function(): Array}
     */
    getUnverified,

    /**
     * Get all verified cameras
     * @type {function(): Array}
     */
    getVerified,

    /**
     * Check if a camera has an apparatus mismatch
     * @type {function(string): boolean}
     */
    hasMismatch,

    /**
     * Check if a camera is verified
     * @type {function(string): boolean}
     */
    isVerified,

    /**
     * Get runtime state for a specific camera
     * @type {function(string): Object|null}
     */
    getCameraState,

    /**
     * Reassign apparatus to a camera
     * @type {function(string, string[], string): void}
     */
    reassign,

    /**
     * Mark a camera as verified
     * @type {function(string, string): void}
     */
    verify,

    /**
     * Reset all camera verifications
     * @type {function(): void}
     */
    resetVerifications,

    /**
     * Memoized array of cameras with mismatches
     * @type {Array}
     */
    mismatches,

    /**
     * Memoized array of unverified cameras
     * @type {Array}
     */
    unverifiedCameras,

    /**
     * Memoized array of verified cameras
     * @type {Array}
     */
    verifiedCameras,

    /**
     * Count of cameras by status
     * @type {{total: number, verified: number, unverified: number, mismatches: number}}
     */
    statusCounts
  };
}

export default useCameraRuntime;
