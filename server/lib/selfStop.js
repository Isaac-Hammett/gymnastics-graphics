/**
 * Self-Stop Service
 *
 * Allows an EC2 instance to stop itself using AWS SDK.
 * Used by the auto-shutdown service to gracefully stop the coordinator
 * after idle timeout.
 *
 * Features:
 * - Get own instance ID from EC2 metadata service
 * - Stop self via EC2 StopInstances API
 * - 30-second delay before stop (allows cancellation)
 * - Firebase audit logging
 * - Graceful handling when not running on EC2 or missing IAM permissions
 *
 * @module selfStop
 */

import { EventEmitter } from 'events';
import { EC2Client, StopInstancesCommand } from '@aws-sdk/client-ec2';
import admin from 'firebase-admin';

// EC2 Instance Metadata Service (IMDS) configuration
const IMDS_BASE_URL = 'http://169.254.169.254';
const IMDS_TOKEN_URL = `${IMDS_BASE_URL}/latest/api/token`;
const IMDS_INSTANCE_ID_URL = `${IMDS_BASE_URL}/latest/meta-data/instance-id`;

// Default configuration
const DEFAULT_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  shutdownDelaySeconds: 30,
  enabled: process.env.COORDINATOR_MODE === 'true'
};

/**
 * Self-Stop Service class
 * Provides EC2 self-stop capability with delay and cancellation
 */
class SelfStopService extends EventEmitter {
  constructor(config = {}) {
    super();

    this._config = { ...DEFAULT_CONFIG, ...config };
    this._instanceId = null;
    this._isEC2Instance = null;
    this._stopTimeout = null;
    this._stopPending = false;
    this._db = null;
    this._io = null;
    this._ec2 = null;
    this._isInitialized = false;

    console.log(`[SelfStop] Instance created (enabled: ${this._config.enabled})`);
  }

  /**
   * Initialize the self-stop service
   * @param {Object} options - Initialization options
   * @param {Object} options.io - Socket.io instance for broadcasting
   */
  async initialize(options = {}) {
    if (this._isInitialized) {
      console.log('[SelfStop] Already initialized');
      return;
    }

    console.log('[SelfStop] Initializing...');

    this._io = options.io || null;

    // Initialize EC2 client
    this._ec2 = new EC2Client({
      region: this._config.region
    });

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
      console.warn('[SelfStop] Firebase not available for audit logging:', error.message);
    }

    // Detect if running on EC2 and get instance ID
    await this._detectEC2Environment();

    this._isInitialized = true;
    console.log('[SelfStop] Initialized successfully');
    this.emit('initialized', { isEC2: this._isEC2Instance, instanceId: this._instanceId });
  }

  /**
   * Detect if running on EC2 and retrieve instance ID from IMDS
   * @private
   */
  async _detectEC2Environment() {
    try {
      // First, get an IMDS token (IMDSv2 requires token-based auth)
      const tokenResponse = await fetch(IMDS_TOKEN_URL, {
        method: 'PUT',
        headers: {
          'X-aws-ec2-metadata-token-ttl-seconds': '21600'
        },
        signal: AbortSignal.timeout(2000)
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token request failed: ${tokenResponse.status}`);
      }

      const token = await tokenResponse.text();

      // Now get the instance ID using the token
      const instanceIdResponse = await fetch(IMDS_INSTANCE_ID_URL, {
        headers: {
          'X-aws-ec2-metadata-token': token
        },
        signal: AbortSignal.timeout(2000)
      });

      if (!instanceIdResponse.ok) {
        throw new Error(`Instance ID request failed: ${instanceIdResponse.status}`);
      }

      this._instanceId = await instanceIdResponse.text();
      this._isEC2Instance = true;

      console.log(`[SelfStop] Running on EC2 instance: ${this._instanceId}`);
    } catch (error) {
      // Not running on EC2 or IMDS not available
      this._isEC2Instance = false;
      this._instanceId = null;
      console.log(`[SelfStop] Not running on EC2 or IMDS unavailable: ${error.message}`);
    }
  }

  /**
   * Get the current instance ID
   * @returns {string|null} Instance ID or null if not on EC2
   */
  getInstanceId() {
    return this._instanceId;
  }

  /**
   * Check if running on EC2
   * @returns {boolean|null} True if on EC2, false if not, null if not yet checked
   */
  isEC2Instance() {
    return this._isEC2Instance;
  }

  /**
   * Check if stop is currently pending
   * @returns {boolean}
   */
  isStopPending() {
    return this._stopPending;
  }

  /**
   * Initiate self-stop with delay
   * @param {Object} options - Stop options
   * @param {string} options.reason - Reason for stop
   * @param {number} options.idleMinutes - How long the instance was idle
   * @returns {Promise<Object>} Result with success status and message
   */
  async stopSelf(options = {}) {
    const { reason = 'Manual stop', idleMinutes = 0 } = options;

    if (!this._config.enabled) {
      console.log('[SelfStop] Self-stop disabled (COORDINATOR_MODE not true)');
      return {
        success: false,
        message: 'Self-stop is disabled',
        reason: 'COORDINATOR_MODE not enabled'
      };
    }

    if (!this._isEC2Instance) {
      console.log('[SelfStop] Cannot self-stop: not running on EC2');
      return {
        success: false,
        message: 'Cannot self-stop: not running on EC2 instance',
        reason: 'Not on EC2'
      };
    }

    if (this._stopPending) {
      console.log('[SelfStop] Stop already pending');
      return {
        success: false,
        message: 'Stop already pending',
        secondsRemaining: this._getSecondsRemaining()
      };
    }

    this._stopPending = true;
    const delaySeconds = this._config.shutdownDelaySeconds;

    console.log(`[SelfStop] Initiating self-stop in ${delaySeconds}s - ${reason}`);

    // Broadcast to all connected clients
    if (this._io) {
      this._io.emit('shutdownPending', {
        reason,
        secondsRemaining: delaySeconds,
        instanceId: this._instanceId,
        timestamp: new Date().toISOString()
      });
    }

    this.emit('stopPending', {
      reason,
      secondsRemaining: delaySeconds,
      instanceId: this._instanceId
    });

    // Store start time for remaining calculation
    this._stopStartTime = Date.now();

    // Set timeout for actual stop
    this._stopTimeout = setTimeout(async () => {
      await this._executeStop(reason, idleMinutes);
    }, delaySeconds * 1000);

    return {
      success: true,
      message: `Self-stop initiated, will execute in ${delaySeconds} seconds`,
      secondsRemaining: delaySeconds,
      instanceId: this._instanceId
    };
  }

  /**
   * Cancel a pending self-stop
   * @param {string} reason - Reason for cancellation
   * @returns {Object} Cancellation result
   */
  cancelStop(reason = 'Manual cancellation') {
    if (!this._stopPending) {
      return {
        success: false,
        message: 'No stop pending'
      };
    }

    console.log(`[SelfStop] Stop cancelled - ${reason}`);

    if (this._stopTimeout) {
      clearTimeout(this._stopTimeout);
      this._stopTimeout = null;
    }

    this._stopPending = false;
    this._stopStartTime = null;

    // Broadcast cancellation
    if (this._io) {
      this._io.emit('shutdownCancelled', {
        reason,
        timestamp: new Date().toISOString()
      });
    }

    this.emit('stopCancelled', { reason });

    return {
      success: true,
      message: 'Self-stop cancelled',
      reason
    };
  }

  /**
   * Get seconds remaining until stop (if pending)
   * @returns {number|null} Seconds remaining or null if not pending
   * @private
   */
  _getSecondsRemaining() {
    if (!this._stopPending || !this._stopStartTime) {
      return null;
    }

    const elapsed = (Date.now() - this._stopStartTime) / 1000;
    const remaining = Math.max(0, this._config.shutdownDelaySeconds - elapsed);
    return Math.ceil(remaining);
  }

  /**
   * Execute the actual EC2 stop
   * @param {string} reason - Reason for stop
   * @param {number} idleMinutes - Idle time in minutes
   * @private
   */
  async _executeStop(reason, idleMinutes) {
    console.log(`[SelfStop] Executing self-stop - ${reason}`);

    const shutdownRecord = {
      timestamp: new Date().toISOString(),
      reason,
      idleMinutes,
      instanceId: this._instanceId
    };

    // Log to Firebase for audit
    await this._logShutdownEvent(shutdownRecord);

    // Broadcast final shutdown event
    if (this._io) {
      this._io.emit('shutdownExecuting', shutdownRecord);
    }

    this.emit('stopExecuting', shutdownRecord);

    // Attempt to stop the EC2 instance
    try {
      const command = new StopInstancesCommand({
        InstanceIds: [this._instanceId]
      });

      const response = await this._ec2.send(command);

      const stoppingInstances = response.StoppingInstances || [];
      const result = stoppingInstances[0];

      console.log(`[SelfStop] Stop command sent successfully`);
      console.log(`[SelfStop] Previous state: ${result?.PreviousState?.Name}, Current state: ${result?.CurrentState?.Name}`);

      this.emit('stopComplete', {
        ...shutdownRecord,
        previousState: result?.PreviousState?.Name,
        currentState: result?.CurrentState?.Name
      });

    } catch (error) {
      console.error(`[SelfStop] Failed to stop instance:`, error.message);

      // Handle specific AWS errors
      if (error.name === 'UnauthorizedOperation' || error.Code === 'UnauthorizedOperation') {
        console.error('[SelfStop] IAM permissions insufficient for ec2:StopInstances');
        this.emit('stopFailed', {
          ...shutdownRecord,
          error: 'IAM permissions insufficient',
          errorCode: 'UnauthorizedOperation'
        });
      } else {
        this.emit('stopFailed', {
          ...shutdownRecord,
          error: error.message,
          errorCode: error.name || error.Code
        });
      }
    }

    this._stopPending = false;
    this._stopTimeout = null;
    this._stopStartTime = null;
  }

  /**
   * Log shutdown event to Firebase for audit
   * @param {Object} record - Shutdown record
   * @private
   */
  async _logShutdownEvent(record) {
    if (!this._db) {
      console.warn('[SelfStop] Cannot log shutdown - Firebase not available');
      return;
    }

    try {
      const logRef = this._db.ref('coordinator/shutdownHistory').push();
      await logRef.set({
        ...record,
        type: 'selfStop'
      });
      console.log('[SelfStop] Shutdown logged to Firebase');
    } catch (error) {
      console.error('[SelfStop] Failed to log shutdown:', error.message);
    }
  }

  /**
   * Get current status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enabled: this._config.enabled,
      isEC2Instance: this._isEC2Instance,
      instanceId: this._instanceId,
      stopPending: this._stopPending,
      secondsRemaining: this._getSecondsRemaining(),
      shutdownDelaySeconds: this._config.shutdownDelaySeconds,
      region: this._config.region
    };
  }

  /**
   * Shutdown the self-stop service
   */
  async shutdown() {
    console.log('[SelfStop] Shutting down service...');

    if (this._stopTimeout) {
      clearTimeout(this._stopTimeout);
      this._stopTimeout = null;
    }

    this._stopPending = false;
    this._isInitialized = false;

    this.emit('shutdown');
    console.log('[SelfStop] Service shutdown complete');
  }
}

// Singleton instance
let selfStopInstance = null;

/**
 * Get or create the self-stop service singleton
 * @param {Object} config - Optional configuration override
 * @returns {SelfStopService} The self-stop service instance
 */
export function getSelfStopService(config = {}) {
  if (!selfStopInstance) {
    selfStopInstance = new SelfStopService(config);
  }
  return selfStopInstance;
}

// Export class for testing
export { SelfStopService };

// Default export is the singleton getter
export default getSelfStopService;
