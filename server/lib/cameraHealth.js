/**
 * Camera Health Monitor Module
 *
 * Polls Nimble Streamer stats API to monitor camera health status.
 * Emits events when camera health changes for real-time UI updates.
 */

import { EventEmitter } from 'events';

// Health status constants
const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  RECONNECTING: 'reconnecting',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown'
};

// Default thresholds for health evaluation
const DEFAULT_THRESHOLDS = {
  minBitrate: 500000,        // 500 kbps minimum
  maxPacketLoss: 5,          // 5% packet loss threshold for degraded
  criticalPacketLoss: 15,    // 15% packet loss threshold for reconnecting
  reconnectWindowMs: 10000,  // 10 second window to consider reconnecting vs offline
  healthyStreakMs: 5000      // 5 seconds of good stats to return to healthy
};

/**
 * CameraHealthMonitor - Monitors camera health via Nimble stats API
 *
 * Events emitted:
 * - 'cameraHealth': Emitted on each poll with array of all camera statuses
 * - 'cameraStatusChanged': Emitted when a camera's status changes
 * - 'error': Emitted when polling encounters an error
 */
class CameraHealthMonitor extends EventEmitter {
  /**
   * Create a new CameraHealthMonitor
   * @param {Object} config - Configuration object
   * @param {Object} config.nimbleServer - Nimble server settings
   * @param {string} config.nimbleServer.host - Nimble server hostname
   * @param {number} config.nimbleServer.statsPort - Stats API port
   * @param {number} config.nimbleServer.pollIntervalMs - Polling interval
   * @param {Object[]} config.cameras - Array of camera configurations
   */
  constructor(config) {
    super();

    this.nimbleServer = config.nimbleServer || {
      host: 'localhost',
      statsPort: 8086,
      pollIntervalMs: 2000
    };

    this.cameras = config.cameras || [];
    this.pollInterval = this.nimbleServer.pollIntervalMs || 2000;

    // Internal state
    this._pollTimer = null;
    this._isRunning = false;
    this._cameraStates = new Map();
    this._lastStatusChange = new Map();

    // Initialize camera states
    this._initializeCameraStates();
  }

  /**
   * Initialize camera states from config
   * @private
   */
  _initializeCameraStates() {
    this.cameras.forEach(camera => {
      this._cameraStates.set(camera.id, {
        cameraId: camera.id,
        cameraName: camera.name,
        srtPort: camera.srtPort,
        status: HEALTH_STATUS.UNKNOWN,
        bitrate: 0,
        packetLoss: 0,
        lastSeen: null,
        lastHealthy: null,
        consecutiveFailures: 0,
        stats: null
      });
      this._lastStatusChange.set(camera.id, Date.now());
    });
  }

  /**
   * Fetch stats from Nimble Streamer stats API
   * @returns {Promise<Object>} Stats response from Nimble
   */
  async fetchNimbleStats() {
    const { host, statsPort } = this.nimbleServer;
    const url = `http://${host}:${statsPort}/manage/srt_receiver_stats`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`Nimble stats API returned ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Re-throw with more context
      if (error.name === 'AbortError') {
        throw new Error(`Nimble stats API timeout (${host}:${statsPort})`);
      }
      throw new Error(`Failed to fetch Nimble stats: ${error.message}`);
    }
  }

  /**
   * Evaluate health status from stats data
   * @param {Object} stats - Stats object for a single stream
   * @param {Object} camera - Camera configuration
   * @param {Object} previousState - Previous camera state
   * @returns {Object} Evaluated health state
   */
  evaluateHealth(stats, camera, previousState) {
    const thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...(camera.healthThresholds || {})
    };

    const now = Date.now();

    // No stats means offline or unknown
    if (!stats) {
      const timeSinceLastSeen = previousState.lastSeen
        ? now - previousState.lastSeen
        : Infinity;

      // If we recently had stats, consider it reconnecting
      if (timeSinceLastSeen < thresholds.reconnectWindowMs) {
        return {
          status: HEALTH_STATUS.RECONNECTING,
          bitrate: 0,
          packetLoss: 0,
          lastSeen: previousState.lastSeen,
          lastHealthy: previousState.lastHealthy,
          consecutiveFailures: previousState.consecutiveFailures + 1,
          stats: null
        };
      }

      // Otherwise offline
      return {
        status: HEALTH_STATUS.OFFLINE,
        bitrate: 0,
        packetLoss: 0,
        lastSeen: previousState.lastSeen,
        lastHealthy: previousState.lastHealthy,
        consecutiveFailures: previousState.consecutiveFailures + 1,
        stats: null
      };
    }

    // Extract relevant stats
    const bitrate = stats.bitrate || stats.recv_rate || 0;
    const packetLoss = stats.packet_loss || stats.pktRcvLoss || 0;
    const lossPercent = stats.loss_percent ||
      (stats.pktRecv > 0 ? (packetLoss / stats.pktRecv) * 100 : 0);

    let status = HEALTH_STATUS.HEALTHY;

    // Check bitrate threshold
    if (bitrate < thresholds.minBitrate) {
      status = HEALTH_STATUS.DEGRADED;
    }

    // Check packet loss thresholds
    if (lossPercent >= thresholds.criticalPacketLoss) {
      status = HEALTH_STATUS.RECONNECTING;
    } else if (lossPercent >= thresholds.maxPacketLoss) {
      status = HEALTH_STATUS.DEGRADED;
    }

    // If we were reconnecting/offline and now have stats, check if we should
    // return to healthy or stay degraded for stability
    if (previousState.status === HEALTH_STATUS.RECONNECTING ||
        previousState.status === HEALTH_STATUS.OFFLINE) {
      if (status === HEALTH_STATUS.HEALTHY) {
        const timeSinceStatusChange = now - (this._lastStatusChange.get(camera.id) || 0);
        if (timeSinceStatusChange < thresholds.healthyStreakMs) {
          status = HEALTH_STATUS.DEGRADED; // Don't immediately return to healthy
        }
      }
    }

    return {
      status,
      bitrate,
      packetLoss: lossPercent,
      lastSeen: now,
      lastHealthy: status === HEALTH_STATUS.HEALTHY ? now : previousState.lastHealthy,
      consecutiveFailures: status === HEALTH_STATUS.HEALTHY ? 0 : previousState.consecutiveFailures,
      stats: {
        bitrate,
        packetLoss: lossPercent,
        rtt: stats.rtt || stats.msRTT || 0,
        jitter: stats.jitter || stats.msBuf || 0,
        packetsReceived: stats.pktRecv || 0,
        packetsLost: packetLoss,
        raw: stats
      }
    };
  }

  /**
   * Match stats to cameras by SRT port
   * @param {Object} nimbleStats - Stats response from Nimble
   * @returns {Map<string, Object>} Map of cameraId to stats
   */
  _matchStatsToCameras(nimbleStats) {
    const statsMap = new Map();

    // Handle different Nimble stats response formats
    const streams = nimbleStats.srt_receiver_stats ||
                   nimbleStats.streams ||
                   nimbleStats ||
                   [];

    // Convert to array if needed
    const streamArray = Array.isArray(streams) ? streams : Object.values(streams);

    // Match each camera to its stats by SRT port
    this.cameras.forEach(camera => {
      if (!camera.srtPort) {
        statsMap.set(camera.id, null);
        return;
      }

      // Find stats for this camera's SRT port
      const cameraStats = streamArray.find(stream => {
        const streamPort = stream.port || stream.local_port || stream.srt_port;
        return streamPort === camera.srtPort;
      });

      statsMap.set(camera.id, cameraStats || null);
    });

    return statsMap;
  }

  /**
   * Poll camera health - main polling function
   */
  async pollHealth() {
    if (!this._isRunning) return;

    let nimbleStats = null;

    try {
      nimbleStats = await this.fetchNimbleStats();
    } catch (error) {
      this.emit('error', error);
      // Continue with null stats - cameras will be marked as reconnecting/offline
    }

    const statsMap = nimbleStats ? this._matchStatsToCameras(nimbleStats) : new Map();
    const healthStatuses = [];
    const statusChanges = [];

    // Evaluate health for each camera
    this.cameras.forEach(camera => {
      const previousState = this._cameraStates.get(camera.id);
      const stats = statsMap.get(camera.id);

      const healthEval = this.evaluateHealth(stats, camera, previousState);

      // Update state
      const newState = {
        cameraId: camera.id,
        cameraName: camera.name,
        srtPort: camera.srtPort,
        ...healthEval
      };

      // Check for status change
      if (previousState.status !== newState.status) {
        this._lastStatusChange.set(camera.id, Date.now());
        statusChanges.push({
          cameraId: camera.id,
          cameraName: camera.name,
          previousStatus: previousState.status,
          newStatus: newState.status,
          timestamp: Date.now()
        });
      }

      this._cameraStates.set(camera.id, newState);
      healthStatuses.push(newState);
    });

    // Emit events
    this.emit('cameraHealth', healthStatuses);

    statusChanges.forEach(change => {
      this.emit('cameraStatusChanged', change);
    });

    return healthStatuses;
  }

  /**
   * Start the health monitoring loop
   */
  start() {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;

    // Initial poll
    this.pollHealth();

    // Set up polling interval
    this._pollTimer = setInterval(() => {
      this.pollHealth();
    }, this.pollInterval);

    this.emit('started');
  }

  /**
   * Stop the health monitoring loop
   */
  stop() {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;

    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    this.emit('stopped');
  }

  /**
   * Get current health status for all cameras
   * @returns {Object[]} Array of camera health statuses
   */
  getAllHealth() {
    return Array.from(this._cameraStates.values());
  }

  /**
   * Get health status for a specific camera
   * @param {string} cameraId - Camera ID
   * @returns {Object|null} Camera health status or null if not found
   */
  getCameraHealth(cameraId) {
    return this._cameraStates.get(cameraId) || null;
  }

  /**
   * Check if a camera is healthy
   * @param {string} cameraId - Camera ID
   * @returns {boolean} True if camera is healthy
   */
  isHealthy(cameraId) {
    const state = this._cameraStates.get(cameraId);
    return state && state.status === HEALTH_STATUS.HEALTHY;
  }

  /**
   * Get all healthy cameras
   * @returns {Object[]} Array of healthy camera states
   */
  getHealthyCameras() {
    return this.getAllHealth().filter(c => c.status === HEALTH_STATUS.HEALTHY);
  }

  /**
   * Get all unhealthy cameras
   * @returns {Object[]} Array of unhealthy camera states
   */
  getUnhealthyCameras() {
    return this.getAllHealth().filter(c => c.status !== HEALTH_STATUS.HEALTHY);
  }

  /**
   * Update configuration (e.g., after hot reload)
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    const wasRunning = this._isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.nimbleServer = config.nimbleServer || this.nimbleServer;
    this.cameras = config.cameras || [];
    this.pollInterval = this.nimbleServer.pollIntervalMs || 2000;

    // Re-initialize camera states, preserving existing state where possible
    const oldStates = new Map(this._cameraStates);
    this._cameraStates.clear();

    this.cameras.forEach(camera => {
      const oldState = oldStates.get(camera.id);
      if (oldState) {
        this._cameraStates.set(camera.id, {
          ...oldState,
          cameraName: camera.name,
          srtPort: camera.srtPort
        });
      } else {
        this._cameraStates.set(camera.id, {
          cameraId: camera.id,
          cameraName: camera.name,
          srtPort: camera.srtPort,
          status: HEALTH_STATUS.UNKNOWN,
          bitrate: 0,
          packetLoss: 0,
          lastSeen: null,
          lastHealthy: null,
          consecutiveFailures: 0,
          stats: null
        });
        this._lastStatusChange.set(camera.id, Date.now());
      }
    });

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Check if monitor is currently running
   * @returns {boolean} True if running
   */
  isRunning() {
    return this._isRunning;
  }
}

// Export
export { CameraHealthMonitor, HEALTH_STATUS, DEFAULT_THRESHOLDS };
export default CameraHealthMonitor;
