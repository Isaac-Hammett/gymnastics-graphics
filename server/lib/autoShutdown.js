/**
 * Auto-Shutdown Service
 *
 * Tracks activity and initiates graceful shutdown when idle timeout is reached.
 * Designed for coordinator instances to save costs when not in use.
 *
 * Features:
 * - Activity tracking (updated on API/socket requests)
 * - Configurable idle timeout via AUTO_SHUTDOWN_MINUTES env var
 * - Graceful shutdown: close sockets, stop polling, then stop EC2 instance
 * - Firebase audit logging of shutdown events
 * - Shutdown cancellation via activity
 *
 * @module autoShutdown
 */

import { EventEmitter } from 'events';
import admin from 'firebase-admin';

// Default configuration
const DEFAULT_CONFIG = {
  idleTimeoutMinutes: parseInt(process.env.AUTO_SHUTDOWN_MINUTES, 10) || 120,
  checkIntervalSeconds: 60,
  shutdownDelaySeconds: 30,  // Allow cancellation before actual shutdown
  enabled: process.env.COORDINATOR_MODE === 'true'
};

/**
 * Auto-Shutdown Service class
 * Monitors activity and initiates shutdown on idle timeout
 */
class AutoShutdownService extends EventEmitter {
  constructor(config = {}) {
    super();

    this._config = { ...DEFAULT_CONFIG, ...config };
    this._lastActivityTimestamp = Date.now();
    this._checkInterval = null;
    this._shutdownTimeout = null;
    this._shutdownPending = false;
    this._db = null;
    this._io = null;
    this._awsService = null;
    this._stopCallback = null;
    this._isInitialized = false;

    console.log(`[AutoShutdown] Instance created (enabled: ${this._config.enabled}, timeout: ${this._config.idleTimeoutMinutes}min)`);
  }

  /**
   * Initialize the auto-shutdown service
   * @param {Object} options - Initialization options
   * @param {Object} options.io - Socket.io instance for broadcasting
   * @param {Object} options.awsService - AWS service for stopping instance
   * @param {Function} options.stopCallback - Callback to perform graceful shutdown
   */
  async initialize(options = {}) {
    if (this._isInitialized) {
      console.log('[AutoShutdown] Already initialized');
      return;
    }

    console.log('[AutoShutdown] Initializing...');

    this._io = options.io || null;
    this._awsService = options.awsService || null;
    this._stopCallback = options.stopCallback || null;

    // Initialize Firebase for audit logging
    try {
      if (admin.apps.length === 0) {
        const databaseURL = process.env.FIREBASE_DATABASE_URL ||
          'https://gymnastics-graphics-default-rtdb.firebaseio.com';

        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL
        });
      }

      this._db = admin.database();
    } catch (error) {
      console.warn('[AutoShutdown] Firebase not available for audit logging:', error.message);
    }

    this._isInitialized = true;

    // Start idle check interval if enabled
    if (this._config.enabled) {
      this._startIdleCheck();
    }

    console.log('[AutoShutdown] Initialized successfully');
    this.emit('initialized');
  }

  /**
   * Start the idle check interval
   * @private
   */
  _startIdleCheck() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
    }

    const intervalMs = this._config.checkIntervalSeconds * 1000;

    this._checkInterval = setInterval(() => {
      this.checkIdleTimeout();
    }, intervalMs);

    console.log(`[AutoShutdown] Idle check started (every ${this._config.checkIntervalSeconds}s)`);
  }

  /**
   * Stop the idle check interval
   * @private
   */
  _stopIdleCheck() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
      console.log('[AutoShutdown] Idle check stopped');
    }
  }

  /**
   * Reset activity timestamp
   * Call this on every API/socket request
   */
  resetActivity() {
    const wasIdle = this._shutdownPending;
    this._lastActivityTimestamp = Date.now();

    // Cancel pending shutdown if activity detected
    if (wasIdle && this._shutdownTimeout) {
      this._cancelShutdown('Activity detected');
    }
  }

  /**
   * Get time since last activity in seconds
   * @returns {number} Idle time in seconds
   */
  getIdleTime() {
    return Math.floor((Date.now() - this._lastActivityTimestamp) / 1000);
  }

  /**
   * Get idle time in minutes
   * @returns {number} Idle time in minutes
   */
  getIdleMinutes() {
    return Math.floor(this.getIdleTime() / 60);
  }

  /**
   * Get last activity timestamp
   * @returns {number} Timestamp in milliseconds
   */
  getLastActivityTimestamp() {
    return this._lastActivityTimestamp;
  }

  /**
   * Check if idle timeout has been reached
   * If so, initiate graceful shutdown (unless active streams exist)
   */
  async checkIdleTimeout() {
    if (!this._config.enabled) {
      return;
    }

    const idleMinutes = this.getIdleMinutes();
    const timeoutMinutes = this._config.idleTimeoutMinutes;

    console.log(`[AutoShutdown] Idle check: ${idleMinutes}m / ${timeoutMinutes}m`);

    if (idleMinutes >= timeoutMinutes && !this._shutdownPending) {
      // Skip auto-shutdown if there are active streaming competitions
      const hasStreams = await this.hasActiveStreams();
      if (hasStreams) {
        console.log(`[AutoShutdown] Idle timeout reached but active streams detected - skipping shutdown`);
        return;
      }

      console.log(`[AutoShutdown] Idle timeout reached (${idleMinutes}m >= ${timeoutMinutes}m)`);
      this._initiateShutdown('Idle timeout reached');
    }
  }

  /**
   * Initiate graceful shutdown with delay
   * @param {string} reason - Reason for shutdown
   * @private
   */
  _initiateShutdown(reason) {
    if (this._shutdownPending) {
      console.log('[AutoShutdown] Shutdown already pending');
      return;
    }

    this._shutdownPending = true;
    const delaySeconds = this._config.shutdownDelaySeconds;

    console.log(`[AutoShutdown] Initiating shutdown in ${delaySeconds}s - ${reason}`);

    // Broadcast to all connected clients
    if (this._io) {
      this._io.emit('shutdownPending', {
        reason,
        secondsRemaining: delaySeconds,
        timestamp: new Date().toISOString()
      });
    }

    this.emit('shutdownPending', { reason, secondsRemaining: delaySeconds });

    // Set timeout for actual shutdown
    this._shutdownTimeout = setTimeout(async () => {
      await this._executeShutdown(reason);
    }, delaySeconds * 1000);
  }

  /**
   * Cancel a pending shutdown
   * @param {string} reason - Reason for cancellation
   * @private
   */
  _cancelShutdown(reason) {
    if (!this._shutdownPending) {
      return;
    }

    console.log(`[AutoShutdown] Shutdown cancelled - ${reason}`);

    if (this._shutdownTimeout) {
      clearTimeout(this._shutdownTimeout);
      this._shutdownTimeout = null;
    }

    this._shutdownPending = false;

    // Broadcast cancellation
    if (this._io) {
      this._io.emit('shutdownCancelled', {
        reason,
        timestamp: new Date().toISOString()
      });
    }

    this.emit('shutdownCancelled', { reason });
  }

  /**
   * Execute the actual shutdown process
   * @param {string} reason - Reason for shutdown
   * @private
   */
  async _executeShutdown(reason) {
    console.log(`[AutoShutdown] Executing shutdown - ${reason}`);

    const shutdownRecord = {
      timestamp: new Date().toISOString(),
      reason,
      idleMinutes: this.getIdleMinutes(),
      lastActivity: new Date(this._lastActivityTimestamp).toISOString()
    };

    // Log to Firebase for audit
    await this._logShutdownEvent(shutdownRecord);

    // Broadcast final shutdown event
    if (this._io) {
      this._io.emit('shutdownExecuting', shutdownRecord);
    }

    this.emit('shutdownExecuting', shutdownRecord);

    // Stop idle check
    this._stopIdleCheck();

    // Execute graceful shutdown callback (close sockets, stop polling, etc.)
    if (this._stopCallback) {
      try {
        console.log('[AutoShutdown] Executing stop callback...');
        await this._stopCallback();
      } catch (error) {
        console.error('[AutoShutdown] Stop callback error:', error.message);
      }
    }

    // Note: Actual EC2 stop is handled by selfStop.js module
    // This module just prepares for shutdown
    this.emit('shutdownComplete', shutdownRecord);
    console.log('[AutoShutdown] Shutdown preparation complete');
  }

  /**
   * Log shutdown event to Firebase for audit
   * @param {Object} record - Shutdown record
   * @private
   */
  async _logShutdownEvent(record) {
    if (!this._db) {
      console.warn('[AutoShutdown] Cannot log shutdown - Firebase not available');
      return;
    }

    try {
      const logRef = this._db.ref('coordinator/shutdownHistory').push();
      await logRef.set(record);
      console.log('[AutoShutdown] Shutdown logged to Firebase');
    } catch (error) {
      console.error('[AutoShutdown] Failed to log shutdown:', error.message);
    }
  }

  /**
   * Check if any competitions are actively streaming
   * Can be used to skip auto-shutdown during active shows
   * @returns {Promise<boolean>} True if any competition is streaming
   */
  async hasActiveStreams() {
    if (!this._db) {
      return false;
    }

    try {
      const snapshot = await this._db.ref('competitions').once('value');
      const competitions = snapshot.val() || {};

      for (const [compId, comp] of Object.entries(competitions)) {
        const production = comp.production;
        if (production && production.settings && production.settings.isStreaming) {
          console.log(`[AutoShutdown] Active stream found: ${compId}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[AutoShutdown] Failed to check active streams:', error.message);
      return false;
    }
  }

  /**
   * Manual keep-alive - resets activity and optionally cancels shutdown
   */
  keepAlive() {
    this.resetActivity();
    console.log('[AutoShutdown] Keep-alive received');
  }

  /**
   * Check if shutdown is currently pending
   * @returns {boolean}
   */
  isShutdownPending() {
    return this._shutdownPending;
  }

  /**
   * Get current status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enabled: this._config.enabled,
      idleTimeoutMinutes: this._config.idleTimeoutMinutes,
      idleSeconds: this.getIdleTime(),
      idleMinutes: this.getIdleMinutes(),
      lastActivity: new Date(this._lastActivityTimestamp).toISOString(),
      shutdownPending: this._shutdownPending,
      checkIntervalSeconds: this._config.checkIntervalSeconds
    };
  }

  /**
   * Update configuration
   * @param {Object} config - New configuration values
   */
  updateConfig(config) {
    const wasEnabled = this._config.enabled;
    this._config = { ...this._config, ...config };

    // Handle enabling/disabling
    if (this._config.enabled && !wasEnabled) {
      this._startIdleCheck();
    } else if (!this._config.enabled && wasEnabled) {
      this._stopIdleCheck();
      if (this._shutdownPending) {
        this._cancelShutdown('Auto-shutdown disabled');
      }
    }

    console.log('[AutoShutdown] Config updated:', this._config);
    this.emit('configUpdated', this._config);
  }

  /**
   * Check if service is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._isInitialized;
  }

  /**
   * Shutdown the auto-shutdown service
   */
  async shutdown() {
    console.log('[AutoShutdown] Shutting down service...');

    this._stopIdleCheck();

    if (this._shutdownTimeout) {
      clearTimeout(this._shutdownTimeout);
      this._shutdownTimeout = null;
    }

    this._shutdownPending = false;
    this._isInitialized = false;

    this.emit('shutdown');
    console.log('[AutoShutdown] Service shutdown complete');
  }
}

// Singleton instance
let autoShutdownInstance = null;

/**
 * Get or create the auto-shutdown service singleton
 * @param {Object} config - Optional configuration override
 * @returns {AutoShutdownService} The auto-shutdown service instance
 */
export function getAutoShutdownService(config = {}) {
  if (!autoShutdownInstance) {
    autoShutdownInstance = new AutoShutdownService(config);
  }
  return autoShutdownInstance;
}

// Export class for testing
export { AutoShutdownService };

// Default export is the singleton getter
export default getAutoShutdownService;
