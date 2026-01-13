/**
 * Camera Fallback Manager
 *
 * Manages camera fallback logic when a camera goes offline or becomes unhealthy.
 * Implements fallback priority: configured fallback > same apparatus > any healthy camera.
 * Never shows a dead feed - falls back to BRB if all cameras fail.
 */

import { EventEmitter } from 'events';

// Fallback configuration
const FALLBACK_CONFIG = {
  maxFallbackDepth: 2,        // Maximum number of fallbacks to chain
  brbSceneName: 'BRB',        // Scene to switch to if all cameras fail
  cooldownMs: 5000,           // Minimum time before switching fallback again
};

/**
 * CameraFallbackManager - Manages automatic camera fallbacks
 *
 * Events emitted:
 * - 'fallbackActivated': When a fallback camera is switched to
 * - 'fallbackCleared': When a camera recovers and fallback is no longer needed
 * - 'fallbackUnavailable': When no fallback could be found (switching to BRB)
 * - 'fallbackChainExhausted': When max fallback depth is reached
 */
class CameraFallbackManager extends EventEmitter {
  /**
   * Create a new CameraFallbackManager
   * @param {Object} options - Configuration options
   * @param {Object[]} options.cameras - Array of camera configurations
   * @param {Object} options.cameraHealthMonitor - CameraHealthMonitor instance
   * @param {Object} options.cameraRuntimeState - CameraRuntimeState instance
   * @param {Function} options.switchScene - Function to switch OBS scene
   */
  constructor(options = {}) {
    super();

    this.cameras = options.cameras || [];
    this.healthMonitor = options.cameraHealthMonitor || null;
    this.runtimeState = options.cameraRuntimeState || null;
    this.switchScene = options.switchScene || null;

    // Active fallbacks: Map<originalCameraId, fallbackInfo>
    this._activeFallbacks = new Map();

    // Track last fallback time per camera to prevent rapid switching
    this._lastFallbackTime = new Map();

    // Bind methods
    this.handleCameraFailure = this.handleCameraFailure.bind(this);
    this.clearFallback = this.clearFallback.bind(this);
  }

  /**
   * Handle a camera failure and find/activate appropriate fallback
   * @param {string} cameraId - ID of the failed camera
   * @param {Object} currentSegment - Current segment being played (optional)
   * @returns {Object} Result of fallback attempt
   */
  handleCameraFailure(cameraId, currentSegment = null) {
    const camera = this._getCameraById(cameraId);
    if (!camera) {
      return { success: false, error: 'Camera not found', cameraId };
    }

    // Check if we're in cooldown period
    const lastFallback = this._lastFallbackTime.get(cameraId);
    const now = Date.now();
    if (lastFallback && (now - lastFallback) < FALLBACK_CONFIG.cooldownMs) {
      return {
        success: false,
        error: 'Fallback cooldown active',
        cameraId,
        cooldownRemainingMs: FALLBACK_CONFIG.cooldownMs - (now - lastFallback)
      };
    }

    // Check fallback depth
    const currentDepth = this._getFallbackDepth(cameraId);
    if (currentDepth >= FALLBACK_CONFIG.maxFallbackDepth) {
      this.emit('fallbackChainExhausted', {
        cameraId,
        depth: currentDepth,
        timestamp: now
      });

      // Switch to BRB as last resort
      return this._switchToBRB(cameraId, 'Max fallback depth reached');
    }

    // Find the best fallback
    const fallback = this.findBestFallback(cameraId, currentSegment);

    if (!fallback) {
      return this._switchToBRB(cameraId, 'No fallback available');
    }

    // Activate the fallback
    return this.switchToFallback(cameraId, fallback.cameraId, fallback.reason);
  }

  /**
   * Find the best fallback camera for a failed camera
   * Priority: configured fallback > same apparatus > any healthy camera
   * @param {string} cameraId - ID of the failed camera
   * @param {Object} currentSegment - Current segment (optional, for apparatus context)
   * @returns {Object|null} Fallback camera info or null if none found
   */
  findBestFallback(cameraId, currentSegment = null) {
    const camera = this._getCameraById(cameraId);
    if (!camera) return null;

    // Get healthy cameras (excluding the failed one and any in fallback chains)
    const healthyCameras = this._getHealthyCameras()
      .filter(c => c.cameraId !== cameraId)
      .filter(c => !this._isInFallbackChain(c.cameraId, cameraId));

    if (healthyCameras.length === 0) {
      return null;
    }

    // Priority 1: Configured fallback
    if (camera.fallbackCameraId) {
      const configuredFallback = healthyCameras.find(
        c => c.cameraId === camera.fallbackCameraId
      );
      if (configuredFallback) {
        return {
          cameraId: camera.fallbackCameraId,
          cameraName: configuredFallback.cameraName,
          reason: 'configured',
          priority: 1
        };
      }
    }

    // Priority 2: Same apparatus (if we have runtime state)
    if (this.runtimeState && currentSegment?.intendedApparatus?.length > 0) {
      const apparatus = currentSegment.intendedApparatus[0];
      const sameApparatusCameras = healthyCameras.filter(c => {
        const state = this.runtimeState.getCameraState(c.cameraId);
        return state && state.currentApparatus.includes(apparatus);
      });

      if (sameApparatusCameras.length > 0) {
        const fallback = sameApparatusCameras[0];
        return {
          cameraId: fallback.cameraId,
          cameraName: fallback.cameraName,
          reason: 'same_apparatus',
          apparatus,
          priority: 2
        };
      }
    }

    // Priority 3: Any healthy camera (prefer verified ones)
    if (this.runtimeState) {
      const verifiedCameras = healthyCameras.filter(c => {
        return this.runtimeState.isVerified(c.cameraId);
      });

      if (verifiedCameras.length > 0) {
        const fallback = verifiedCameras[0];
        return {
          cameraId: fallback.cameraId,
          cameraName: fallback.cameraName,
          reason: 'verified_healthy',
          priority: 3
        };
      }
    }

    // Priority 4: Any healthy camera
    const fallback = healthyCameras[0];
    return {
      cameraId: fallback.cameraId,
      cameraName: fallback.cameraName,
      reason: 'any_healthy',
      priority: 4
    };
  }

  /**
   * Switch to a fallback camera
   * @param {string} originalCameraId - ID of the failed camera
   * @param {string} fallbackCameraId - ID of the fallback camera
   * @param {string} reason - Reason for fallback
   * @returns {Object} Result of switch attempt
   */
  switchToFallback(originalCameraId, fallbackCameraId, reason = 'manual') {
    const now = Date.now();
    const fallbackCamera = this._getCameraById(fallbackCameraId);

    if (!fallbackCamera) {
      return { success: false, error: 'Fallback camera not found', fallbackCameraId };
    }

    // Record the fallback
    const fallbackInfo = {
      originalCameraId,
      originalCameraName: this._getCameraById(originalCameraId)?.name || originalCameraId,
      fallbackCameraId,
      fallbackCameraName: fallbackCamera.name,
      reason,
      activatedAt: now,
      depth: this._getFallbackDepth(originalCameraId) + 1
    };

    this._activeFallbacks.set(originalCameraId, fallbackInfo);
    this._lastFallbackTime.set(originalCameraId, now);

    // Switch OBS scene if switchScene function provided
    const sceneName = `Single - ${fallbackCamera.name}`;
    if (this.switchScene) {
      try {
        this.switchScene(sceneName);
      } catch (error) {
        // Log but don't fail - the fallback is still active
        console.error('Failed to switch OBS scene:', error);
      }
    }

    this.emit('fallbackActivated', {
      ...fallbackInfo,
      sceneName,
      timestamp: now
    });

    return {
      success: true,
      fallback: fallbackInfo,
      sceneName
    };
  }

  /**
   * Clear a fallback when the original camera recovers
   * @param {string} cameraId - ID of the camera that has recovered
   * @returns {Object} Result of clear operation
   */
  clearFallback(cameraId) {
    const fallbackInfo = this._activeFallbacks.get(cameraId);

    if (!fallbackInfo) {
      return { success: false, error: 'No active fallback for camera', cameraId };
    }

    this._activeFallbacks.delete(cameraId);

    // Optionally switch back to original camera
    const camera = this._getCameraById(cameraId);
    const sceneName = camera ? `Single - ${camera.name}` : null;

    if (sceneName && this.switchScene) {
      try {
        this.switchScene(sceneName);
      } catch (error) {
        console.error('Failed to switch back to original camera:', error);
      }
    }

    this.emit('fallbackCleared', {
      originalCameraId: cameraId,
      fallbackCameraId: fallbackInfo.fallbackCameraId,
      durationMs: Date.now() - fallbackInfo.activatedAt,
      sceneName,
      timestamp: Date.now()
    });

    return {
      success: true,
      cleared: fallbackInfo,
      sceneName
    };
  }

  /**
   * Clear all active fallbacks
   */
  clearAllFallbacks() {
    const cleared = [];
    for (const [cameraId, fallbackInfo] of this._activeFallbacks.entries()) {
      cleared.push({
        originalCameraId: cameraId,
        ...fallbackInfo
      });
    }

    this._activeFallbacks.clear();
    this._lastFallbackTime.clear();

    this.emit('allFallbacksCleared', {
      cleared,
      count: cleared.length,
      timestamp: Date.now()
    });

    return { success: true, cleared };
  }

  /**
   * Get all active fallbacks
   * @returns {Object[]} Array of active fallback info
   */
  getActiveFallbacks() {
    return Array.from(this._activeFallbacks.entries()).map(([cameraId, info]) => ({
      ...info,
      originalCameraId: cameraId
    }));
  }

  /**
   * Get fallback info for a specific camera
   * @param {string} cameraId - Camera ID
   * @returns {Object|null} Fallback info or null
   */
  getFallbackFor(cameraId) {
    return this._activeFallbacks.get(cameraId) || null;
  }

  /**
   * Check if a camera has an active fallback
   * @param {string} cameraId - Camera ID
   * @returns {boolean} True if camera has active fallback
   */
  hasFallback(cameraId) {
    return this._activeFallbacks.has(cameraId);
  }

  /**
   * Check if a camera is being used as a fallback
   * @param {string} cameraId - Camera ID
   * @returns {boolean} True if camera is being used as fallback
   */
  isUsedAsFallback(cameraId) {
    for (const fallbackInfo of this._activeFallbacks.values()) {
      if (fallbackInfo.fallbackCameraId === cameraId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update configuration
   * @param {Object} options - New options
   */
  updateConfig(options) {
    if (options.cameras) {
      this.cameras = options.cameras;
    }
    if (options.cameraHealthMonitor) {
      this.healthMonitor = options.cameraHealthMonitor;
    }
    if (options.cameraRuntimeState) {
      this.runtimeState = options.cameraRuntimeState;
    }
    if (options.switchScene) {
      this.switchScene = options.switchScene;
    }
  }

  /**
   * Switch to BRB scene (last resort)
   * @private
   * @param {string} cameraId - Failed camera ID
   * @param {string} reason - Reason for BRB switch
   * @returns {Object} Result object
   */
  _switchToBRB(cameraId, reason) {
    const sceneName = FALLBACK_CONFIG.brbSceneName;

    if (this.switchScene) {
      try {
        this.switchScene(sceneName);
      } catch (error) {
        console.error('Failed to switch to BRB:', error);
      }
    }

    this.emit('fallbackUnavailable', {
      cameraId,
      reason,
      sceneName,
      timestamp: Date.now()
    });

    return {
      success: false,
      error: reason,
      sceneName,
      switchedToBRB: true
    };
  }

  /**
   * Get camera by ID
   * @private
   * @param {string} cameraId - Camera ID
   * @returns {Object|null} Camera config or null
   */
  _getCameraById(cameraId) {
    return this.cameras.find(c => c.id === cameraId) || null;
  }

  /**
   * Get healthy cameras from health monitor
   * @private
   * @returns {Object[]} Array of healthy camera states
   */
  _getHealthyCameras() {
    if (!this.healthMonitor) {
      // Without health monitor, assume all cameras are healthy
      return this.cameras.map(c => ({
        cameraId: c.id,
        cameraName: c.name,
        status: 'unknown'
      }));
    }

    return this.healthMonitor.getHealthyCameras();
  }

  /**
   * Get the current fallback depth for a camera chain
   * @private
   * @param {string} cameraId - Camera ID to check
   * @returns {number} Current depth in fallback chain
   */
  _getFallbackDepth(cameraId) {
    let depth = 0;
    let currentId = cameraId;
    const visited = new Set();

    while (this._activeFallbacks.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      depth++;
      currentId = this._activeFallbacks.get(currentId).fallbackCameraId;
    }

    return depth;
  }

  /**
   * Check if a camera is part of a fallback chain for another camera
   * @private
   * @param {string} cameraId - Camera to check
   * @param {string} forCameraId - Camera whose chain to check
   * @returns {boolean} True if cameraId is in forCameraId's fallback chain
   */
  _isInFallbackChain(cameraId, forCameraId) {
    let currentId = forCameraId;
    const visited = new Set();

    while (this._activeFallbacks.has(currentId) && !visited.has(currentId)) {
      visited.add(currentId);
      const fallback = this._activeFallbacks.get(currentId);
      if (fallback.fallbackCameraId === cameraId) {
        return true;
      }
      currentId = fallback.fallbackCameraId;
    }

    return false;
  }
}

// Export
export { CameraFallbackManager, FALLBACK_CONFIG };
export default CameraFallbackManager;
