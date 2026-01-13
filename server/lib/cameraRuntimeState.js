/**
 * Camera Runtime State Manager
 *
 * Manages runtime state for cameras including apparatus assignments,
 * verification status, and mismatch detection.
 *
 * Runtime state differs from config in that it reflects the current
 * real-world situation (what apparatus each camera is actually pointing at)
 * rather than the expected/configured state.
 */

import { EventEmitter } from 'events';

/**
 * CameraRuntimeState - Manages camera apparatus assignments at runtime
 *
 * Events emitted:
 * - 'apparatusReassigned': When a camera's apparatus is manually reassigned
 * - 'cameraVerified': When a camera is marked as verified by producer
 * - 'mismatchDetected': When currentApparatus differs from expectedApparatus
 * - 'stateChanged': General state change event
 */
class CameraRuntimeState extends EventEmitter {
  /**
   * Create a new CameraRuntimeState manager
   * @param {Object} config - Configuration object
   * @param {Object[]} config.cameras - Array of camera configurations
   */
  constructor(config) {
    super();

    this.cameras = config.cameras || [];
    this._runtimeStates = new Map();

    // Initialize runtime state from config
    this._initializeFromConfig();
  }

  /**
   * Initialize runtime state from camera config
   * @private
   */
  _initializeFromConfig() {
    this.cameras.forEach(camera => {
      this._runtimeStates.set(camera.id, {
        cameraId: camera.id,
        cameraName: camera.name,
        expectedApparatus: [...(camera.expectedApparatus || [])],
        currentApparatus: [...(camera.expectedApparatus || [])], // Start matching expected
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        lastReassignedAt: null,
        reassignedBy: null,
        notes: ''
      });
    });
  }

  /**
   * Get runtime state for all cameras
   * @returns {Object[]} Array of camera runtime states
   */
  getAllState() {
    return Array.from(this._runtimeStates.values());
  }

  /**
   * Get runtime state for a specific camera
   * @param {string} cameraId - Camera ID
   * @returns {Object|null} Camera runtime state or null if not found
   */
  getCameraState(cameraId) {
    return this._runtimeStates.get(cameraId) || null;
  }

  /**
   * Reassign apparatus to a camera
   * Updates the currentApparatus field to reflect where the camera is actually pointing
   * @param {string} cameraId - Camera ID
   * @param {string[]} apparatus - Array of apparatus codes the camera is now covering
   * @param {string} [assignedBy] - Optional identifier of who made the assignment
   * @returns {Object|null} Updated camera state or null if camera not found
   */
  reassignApparatus(cameraId, apparatus, assignedBy = null) {
    const state = this._runtimeStates.get(cameraId);
    if (!state) {
      return null;
    }

    const previousApparatus = [...state.currentApparatus];
    const now = Date.now();

    // Update state
    state.currentApparatus = [...apparatus];
    state.lastReassignedAt = now;
    state.reassignedBy = assignedBy;
    // Reset verification when apparatus changes
    state.verified = false;
    state.verifiedAt = null;
    state.verifiedBy = null;

    // Check for mismatch
    const hasMismatch = !this._arraysEqual(state.expectedApparatus, state.currentApparatus);

    // Emit events
    this.emit('apparatusReassigned', {
      cameraId,
      cameraName: state.cameraName,
      previousApparatus,
      newApparatus: apparatus,
      expectedApparatus: state.expectedApparatus,
      hasMismatch,
      assignedBy,
      timestamp: now
    });

    if (hasMismatch) {
      this.emit('mismatchDetected', {
        cameraId,
        cameraName: state.cameraName,
        expectedApparatus: state.expectedApparatus,
        currentApparatus: state.currentApparatus,
        timestamp: now
      });
    }

    this.emit('stateChanged', {
      type: 'apparatusReassigned',
      cameraId,
      state: { ...state }
    });

    return { ...state };
  }

  /**
   * Mark a camera as verified (producer confirms camera is correctly positioned)
   * @param {string} cameraId - Camera ID
   * @param {string} [verifiedBy] - Optional identifier of who verified
   * @returns {Object|null} Updated camera state or null if camera not found
   */
  verifyCamera(cameraId, verifiedBy = null) {
    const state = this._runtimeStates.get(cameraId);
    if (!state) {
      return null;
    }

    const now = Date.now();

    state.verified = true;
    state.verifiedAt = now;
    state.verifiedBy = verifiedBy;

    this.emit('cameraVerified', {
      cameraId,
      cameraName: state.cameraName,
      currentApparatus: state.currentApparatus,
      expectedApparatus: state.expectedApparatus,
      verifiedBy,
      timestamp: now
    });

    this.emit('stateChanged', {
      type: 'cameraVerified',
      cameraId,
      state: { ...state }
    });

    return { ...state };
  }

  /**
   * Unverify a camera (e.g., when producer suspects camera moved)
   * @param {string} cameraId - Camera ID
   * @returns {Object|null} Updated camera state or null if camera not found
   */
  unverifyCamera(cameraId) {
    const state = this._runtimeStates.get(cameraId);
    if (!state) {
      return null;
    }

    state.verified = false;
    state.verifiedAt = null;
    state.verifiedBy = null;

    this.emit('stateChanged', {
      type: 'cameraUnverified',
      cameraId,
      state: { ...state }
    });

    return { ...state };
  }

  /**
   * Reset all verifications (e.g., at start of show or after break)
   */
  resetAllVerifications() {
    this._runtimeStates.forEach((state, cameraId) => {
      state.verified = false;
      state.verifiedAt = null;
      state.verifiedBy = null;
    });

    this.emit('stateChanged', {
      type: 'allVerificationsReset',
      timestamp: Date.now()
    });
  }

  /**
   * Get the camera currently assigned to cover a specific apparatus
   * @param {string} apparatus - Apparatus code (e.g., 'FX', 'PH')
   * @returns {Object|null} Camera runtime state or null if no camera covers this apparatus
   */
  getCameraForApparatus(apparatus) {
    for (const state of this._runtimeStates.values()) {
      if (state.currentApparatus.includes(apparatus)) {
        return { ...state };
      }
    }
    return null;
  }

  /**
   * Get all cameras assigned to cover a specific apparatus
   * (useful when multiple cameras might cover same apparatus)
   * @param {string} apparatus - Apparatus code
   * @returns {Object[]} Array of camera states covering this apparatus
   */
  getAllCamerasForApparatus(apparatus) {
    const cameras = [];
    for (const state of this._runtimeStates.values()) {
      if (state.currentApparatus.includes(apparatus)) {
        cameras.push({ ...state });
      }
    }
    return cameras;
  }

  /**
   * Get all cameras with mismatched apparatus (current != expected)
   * @returns {Object[]} Array of camera states with mismatches
   */
  getMismatches() {
    const mismatches = [];
    for (const state of this._runtimeStates.values()) {
      if (!this._arraysEqual(state.expectedApparatus, state.currentApparatus)) {
        mismatches.push({
          ...state,
          mismatchDetails: {
            expected: state.expectedApparatus,
            current: state.currentApparatus,
            missing: state.expectedApparatus.filter(a => !state.currentApparatus.includes(a)),
            unexpected: state.currentApparatus.filter(a => !state.expectedApparatus.includes(a))
          }
        });
      }
    }
    return mismatches;
  }

  /**
   * Get all unverified cameras
   * @returns {Object[]} Array of unverified camera states
   */
  getUnverified() {
    const unverified = [];
    for (const state of this._runtimeStates.values()) {
      if (!state.verified) {
        unverified.push({ ...state });
      }
    }
    return unverified;
  }

  /**
   * Get all verified cameras
   * @returns {Object[]} Array of verified camera states
   */
  getVerified() {
    const verified = [];
    for (const state of this._runtimeStates.values()) {
      if (state.verified) {
        verified.push({ ...state });
      }
    }
    return verified;
  }

  /**
   * Check if a specific camera has a mismatch
   * @param {string} cameraId - Camera ID
   * @returns {boolean} True if camera has apparatus mismatch
   */
  hasMismatch(cameraId) {
    const state = this._runtimeStates.get(cameraId);
    if (!state) {
      return false;
    }
    return !this._arraysEqual(state.expectedApparatus, state.currentApparatus);
  }

  /**
   * Check if a specific camera is verified
   * @param {string} cameraId - Camera ID
   * @returns {boolean} True if camera is verified
   */
  isVerified(cameraId) {
    const state = this._runtimeStates.get(cameraId);
    return state ? state.verified : false;
  }

  /**
   * Set a note on a camera (for producer comments)
   * @param {string} cameraId - Camera ID
   * @param {string} note - Note text
   * @returns {Object|null} Updated camera state or null if not found
   */
  setNote(cameraId, note) {
    const state = this._runtimeStates.get(cameraId);
    if (!state) {
      return null;
    }

    state.notes = note;

    this.emit('stateChanged', {
      type: 'noteUpdated',
      cameraId,
      state: { ...state }
    });

    return { ...state };
  }

  /**
   * Update configuration (e.g., after hot reload)
   * Preserves runtime state where possible
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    const oldStates = new Map(this._runtimeStates);
    this._runtimeStates.clear();

    const newCameras = config.cameras || [];

    newCameras.forEach(camera => {
      const oldState = oldStates.get(camera.id);

      if (oldState) {
        // Preserve runtime state, update config-derived fields
        this._runtimeStates.set(camera.id, {
          ...oldState,
          cameraName: camera.name,
          expectedApparatus: [...(camera.expectedApparatus || [])],
          // Note: currentApparatus is preserved from runtime
        });
      } else {
        // New camera - initialize fresh
        this._runtimeStates.set(camera.id, {
          cameraId: camera.id,
          cameraName: camera.name,
          expectedApparatus: [...(camera.expectedApparatus || [])],
          currentApparatus: [...(camera.expectedApparatus || [])],
          verified: false,
          verifiedAt: null,
          verifiedBy: null,
          lastReassignedAt: null,
          reassignedBy: null,
          notes: ''
        });
      }
    });

    this.cameras = newCameras;

    this.emit('stateChanged', {
      type: 'configUpdated',
      timestamp: Date.now()
    });
  }

  /**
   * Reset all runtime state to match config (e.g., for new show)
   */
  resetToConfig() {
    this._runtimeStates.clear();
    this._initializeFromConfig();

    this.emit('stateChanged', {
      type: 'resetToConfig',
      timestamp: Date.now()
    });
  }

  /**
   * Compare two arrays for equality (order-independent)
   * @private
   * @param {string[]} arr1
   * @param {string[]} arr2
   * @returns {boolean}
   */
  _arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
  }
}

// Export
export { CameraRuntimeState };
export default CameraRuntimeState;
