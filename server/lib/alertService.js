/**
 * Alert Service
 *
 * Centralized alert system for the show controller.
 * Handles creating, resolving, and acknowledging alerts.
 * Alerts are stored in Firebase and broadcast via socket events.
 *
 * @module alertService
 */

import { EventEmitter } from 'events';
import admin from 'firebase-admin';

/**
 * Alert levels - determines visual treatment and urgency
 */
export const ALERT_LEVEL = {
  CRITICAL: 'critical',  // Red banner, alarm sound - immediate action required
  WARNING: 'warning',    // Yellow panel, chime - attention needed
  INFO: 'info'           // Toast notification - informational
};

/**
 * Alert categories - groups alerts by source/type
 */
export const ALERT_CATEGORY = {
  VM: 'vm',           // VM health issues (unreachable, starting, stopping)
  SERVICE: 'service', // Service health (OBS, Node, NoMachine)
  CAMERA: 'camera',   // Camera health and fallback issues
  OBS: 'obs',         // OBS-specific issues (disconnection, scene problems)
  TALENT: 'talent'    // Talent view issues (connection, graphics)
};

// Auto-resolve configuration by category
const DEFAULT_AUTO_RESOLVE_CONFIG = {
  [ALERT_CATEGORY.VM]: true,
  [ALERT_CATEGORY.SERVICE]: true,
  [ALERT_CATEGORY.CAMERA]: true,
  [ALERT_CATEGORY.OBS]: true,
  [ALERT_CATEGORY.TALENT]: true
};

// Default configuration
const DEFAULT_CONFIG = {
  autoResolveEnabled: true,
  infoAutoDismissMs: 10000,  // Auto-dismiss info alerts after 10 seconds
  maxAlertsPerCompetition: 100  // Limit stored alerts per competition
};

/**
 * Alert Service class
 * Manages alerts with Firebase persistence and socket broadcasting
 */
class AlertService extends EventEmitter {
  constructor(config = {}) {
    super();

    this._config = { ...DEFAULT_CONFIG, ...config };
    this._autoResolveConfig = { ...DEFAULT_AUTO_RESOLVE_CONFIG };
    this._db = null;
    this._isInitialized = false;
    this._alertCounters = new Map();  // Track alert IDs per competition

    console.log('[AlertService] Instance created');
  }

  /**
   * Initialize the alert service
   * Sets up Firebase connection
   */
  async initialize() {
    if (this._isInitialized) {
      console.log('[AlertService] Already initialized');
      return;
    }

    console.log('[AlertService] Initializing...');

    try {
      // Initialize Firebase Admin if not already done
      if (admin.apps.length === 0) {
        const databaseURL = process.env.FIREBASE_DATABASE_URL ||
          'https://gymnastics-graphics-default-rtdb.firebaseio.com';

        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL
        });
      }

      this._db = admin.database();
      this._isInitialized = true;

      console.log('[AlertService] Initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('[AlertService] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate a unique alert ID
   * @param {string} competitionId - Competition ID
   * @returns {string} Unique alert ID
   */
  _generateAlertId(competitionId) {
    const counter = (this._alertCounters.get(competitionId) || 0) + 1;
    this._alertCounters.set(competitionId, counter);
    const timestamp = Date.now();
    return `alert_${timestamp}_${counter}`;
  }

  /**
   * Create a new alert
   * @param {string} competitionId - Competition ID the alert belongs to
   * @param {Object} alertData - Alert data
   * @param {string} alertData.level - Alert level (ALERT_LEVEL)
   * @param {string} alertData.category - Alert category (ALERT_CATEGORY)
   * @param {string} alertData.title - Short alert title
   * @param {string} alertData.message - Detailed alert message
   * @param {Object} [alertData.metadata] - Additional context data
   * @param {string} [alertData.sourceId] - Source identifier for auto-resolution
   * @returns {Promise<Object>} Created alert object
   */
  async createAlert(competitionId, alertData) {
    if (!this._isInitialized) {
      console.warn('[AlertService] Not initialized, cannot create alert');
      return null;
    }

    const { level, category, title, message, metadata = {}, sourceId = null } = alertData;

    // Validate required fields
    if (!level || !category || !title || !message) {
      throw new Error('Alert requires level, category, title, and message');
    }

    // Validate level and category
    if (!Object.values(ALERT_LEVEL).includes(level)) {
      throw new Error(`Invalid alert level: ${level}`);
    }
    if (!Object.values(ALERT_CATEGORY).includes(category)) {
      throw new Error(`Invalid alert category: ${category}`);
    }

    const alertId = this._generateAlertId(competitionId);
    const now = new Date().toISOString();

    const alert = {
      id: alertId,
      competitionId,
      level,
      category,
      title,
      message,
      metadata,
      sourceId,
      createdAt: now,
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolved: false,
      resolvedAt: null,
      resolvedBy: null,
      autoResolved: false
    };

    try {
      // Store alert in Firebase
      await this._db.ref(`alerts/${competitionId}/${alertId}`).set(alert);

      console.log(`[AlertService] Alert created: ${alertId} (${level}/${category}) - ${title}`);

      // Emit event for socket broadcasting
      this.emit('alertCreated', { competitionId, alert });

      // Schedule auto-dismiss for info alerts
      if (level === ALERT_LEVEL.INFO && this._config.infoAutoDismissMs > 0) {
        setTimeout(() => {
          this.resolveAlert(competitionId, alertId, 'system', true).catch(err => {
            console.error(`[AlertService] Auto-dismiss failed for ${alertId}:`, err.message);
          });
        }, this._config.infoAutoDismissMs);
      }

      return alert;
    } catch (error) {
      console.error(`[AlertService] Failed to create alert:`, error.message);
      throw error;
    }
  }

  /**
   * Resolve an alert
   * @param {string} competitionId - Competition ID
   * @param {string} alertId - Alert ID to resolve
   * @param {string} [resolvedBy='system'] - Who resolved the alert
   * @param {boolean} [autoResolved=false] - Whether this was auto-resolved
   * @returns {Promise<Object>} Updated alert object
   */
  async resolveAlert(competitionId, alertId, resolvedBy = 'system', autoResolved = false) {
    if (!this._isInitialized) {
      console.warn('[AlertService] Not initialized, cannot resolve alert');
      return null;
    }

    const now = new Date().toISOString();

    try {
      const alertRef = this._db.ref(`alerts/${competitionId}/${alertId}`);
      const snapshot = await alertRef.once('value');
      const alert = snapshot.val();

      if (!alert) {
        console.warn(`[AlertService] Alert not found: ${alertId}`);
        return null;
      }

      if (alert.resolved) {
        console.log(`[AlertService] Alert already resolved: ${alertId}`);
        return alert;
      }

      const updates = {
        resolved: true,
        resolvedAt: now,
        resolvedBy,
        autoResolved
      };

      await alertRef.update(updates);

      const updatedAlert = { ...alert, ...updates };

      console.log(`[AlertService] Alert resolved: ${alertId} by ${resolvedBy} (auto: ${autoResolved})`);

      // Emit event for socket broadcasting
      this.emit('alertResolved', { competitionId, alertId, alert: updatedAlert });

      return updatedAlert;
    } catch (error) {
      console.error(`[AlertService] Failed to resolve alert ${alertId}:`, error.message);
      throw error;
    }
  }

  /**
   * Resolve all alerts matching a source ID (for auto-resolution on recovery)
   * @param {string} competitionId - Competition ID
   * @param {string} sourceId - Source identifier
   * @param {string} [resolvedBy='system'] - Who resolved the alerts
   * @returns {Promise<number>} Number of alerts resolved
   */
  async resolveBySourceId(competitionId, sourceId, resolvedBy = 'system') {
    if (!this._isInitialized || !sourceId) {
      return 0;
    }

    try {
      const alertsRef = this._db.ref(`alerts/${competitionId}`);
      const snapshot = await alertsRef.once('value');
      const alerts = snapshot.val() || {};

      let resolvedCount = 0;

      for (const [alertId, alert] of Object.entries(alerts)) {
        if (alert.sourceId === sourceId && !alert.resolved) {
          await this.resolveAlert(competitionId, alertId, resolvedBy, true);
          resolvedCount++;
        }
      }

      if (resolvedCount > 0) {
        console.log(`[AlertService] Auto-resolved ${resolvedCount} alerts for sourceId: ${sourceId}`);
      }

      return resolvedCount;
    } catch (error) {
      console.error(`[AlertService] Failed to resolve by sourceId ${sourceId}:`, error.message);
      return 0;
    }
  }

  /**
   * Acknowledge an alert (mark as seen, but not resolved)
   * @param {string} competitionId - Competition ID
   * @param {string} alertId - Alert ID to acknowledge
   * @param {string} [acknowledgedBy='producer'] - Who acknowledged the alert
   * @returns {Promise<Object>} Updated alert object
   */
  async acknowledgeAlert(competitionId, alertId, acknowledgedBy = 'producer') {
    if (!this._isInitialized) {
      console.warn('[AlertService] Not initialized, cannot acknowledge alert');
      return null;
    }

    const now = new Date().toISOString();

    try {
      const alertRef = this._db.ref(`alerts/${competitionId}/${alertId}`);
      const snapshot = await alertRef.once('value');
      const alert = snapshot.val();

      if (!alert) {
        console.warn(`[AlertService] Alert not found: ${alertId}`);
        return null;
      }

      if (alert.acknowledged) {
        console.log(`[AlertService] Alert already acknowledged: ${alertId}`);
        return alert;
      }

      const updates = {
        acknowledged: true,
        acknowledgedAt: now,
        acknowledgedBy
      };

      await alertRef.update(updates);

      const updatedAlert = { ...alert, ...updates };

      console.log(`[AlertService] Alert acknowledged: ${alertId} by ${acknowledgedBy}`);

      // Emit event for socket broadcasting
      this.emit('alertAcknowledged', { competitionId, alertId, alert: updatedAlert });

      return updatedAlert;
    } catch (error) {
      console.error(`[AlertService] Failed to acknowledge alert ${alertId}:`, error.message);
      throw error;
    }
  }

  /**
   * Acknowledge all unacknowledged alerts for a competition
   * @param {string} competitionId - Competition ID
   * @param {string} [acknowledgedBy='producer'] - Who acknowledged the alerts
   * @returns {Promise<number>} Number of alerts acknowledged
   */
  async acknowledgeAll(competitionId, acknowledgedBy = 'producer') {
    if (!this._isInitialized) {
      return 0;
    }

    try {
      const alerts = await this.getActiveAlerts(competitionId);
      let acknowledgedCount = 0;

      for (const alert of alerts) {
        if (!alert.acknowledged) {
          await this.acknowledgeAlert(competitionId, alert.id, acknowledgedBy);
          acknowledgedCount++;
        }
      }

      if (acknowledgedCount > 0) {
        console.log(`[AlertService] Acknowledged ${acknowledgedCount} alerts for ${competitionId}`);
      }

      return acknowledgedCount;
    } catch (error) {
      console.error(`[AlertService] Failed to acknowledge all:`, error.message);
      return 0;
    }
  }

  /**
   * Get all active (unresolved) alerts for a competition
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Array>} Array of active alerts
   */
  async getActiveAlerts(competitionId) {
    if (!this._isInitialized) {
      return [];
    }

    try {
      const alertsRef = this._db.ref(`alerts/${competitionId}`);
      const snapshot = await alertsRef.once('value');
      const alerts = snapshot.val() || {};

      // Filter to unresolved alerts and convert to array
      const activeAlerts = Object.values(alerts)
        .filter(alert => !alert.resolved)
        .sort((a, b) => {
          // Sort by level (critical first), then by timestamp (newest first)
          const levelOrder = { critical: 0, warning: 1, info: 2 };
          const levelDiff = levelOrder[a.level] - levelOrder[b.level];
          if (levelDiff !== 0) return levelDiff;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

      return activeAlerts;
    } catch (error) {
      console.error(`[AlertService] Failed to get active alerts:`, error.message);
      return [];
    }
  }

  /**
   * Get all alerts for a competition (including resolved)
   * @param {string} competitionId - Competition ID
   * @param {Object} [options] - Query options
   * @param {boolean} [options.includeResolved=true] - Include resolved alerts
   * @param {number} [options.limit=100] - Maximum number of alerts to return
   * @returns {Promise<Array>} Array of alerts
   */
  async getAllAlerts(competitionId, options = {}) {
    if (!this._isInitialized) {
      return [];
    }

    const { includeResolved = true, limit = 100 } = options;

    try {
      const alertsRef = this._db.ref(`alerts/${competitionId}`);
      const snapshot = await alertsRef.once('value');
      const alerts = snapshot.val() || {};

      let alertArray = Object.values(alerts);

      if (!includeResolved) {
        alertArray = alertArray.filter(alert => !alert.resolved);
      }

      // Sort by timestamp (newest first)
      alertArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply limit
      return alertArray.slice(0, limit);
    } catch (error) {
      console.error(`[AlertService] Failed to get all alerts:`, error.message);
      return [];
    }
  }

  /**
   * Get alert counts for a competition
   * @param {string} competitionId - Competition ID
   * @returns {Promise<Object>} Alert counts by level
   */
  async getAlertCounts(competitionId) {
    const activeAlerts = await this.getActiveAlerts(competitionId);

    const counts = {
      total: activeAlerts.length,
      critical: 0,
      warning: 0,
      info: 0,
      unacknowledged: 0,
      unacknowledgedCritical: 0
    };

    for (const alert of activeAlerts) {
      counts[alert.level]++;
      if (!alert.acknowledged) {
        counts.unacknowledged++;
        if (alert.level === ALERT_LEVEL.CRITICAL) {
          counts.unacknowledgedCritical++;
        }
      }
    }

    return counts;
  }

  /**
   * Clear all resolved alerts older than a specified age
   * @param {string} competitionId - Competition ID
   * @param {number} [maxAgeMs=86400000] - Maximum age in ms (default 24 hours)
   * @returns {Promise<number>} Number of alerts cleared
   */
  async clearOldResolvedAlerts(competitionId, maxAgeMs = 86400000) {
    if (!this._isInitialized) {
      return 0;
    }

    const cutoffTime = new Date(Date.now() - maxAgeMs).toISOString();

    try {
      const alertsRef = this._db.ref(`alerts/${competitionId}`);
      const snapshot = await alertsRef.once('value');
      const alerts = snapshot.val() || {};

      let clearedCount = 0;

      for (const [alertId, alert] of Object.entries(alerts)) {
        if (alert.resolved && alert.resolvedAt < cutoffTime) {
          await this._db.ref(`alerts/${competitionId}/${alertId}`).remove();
          clearedCount++;
        }
      }

      if (clearedCount > 0) {
        console.log(`[AlertService] Cleared ${clearedCount} old alerts for ${competitionId}`);
      }

      return clearedCount;
    } catch (error) {
      console.error(`[AlertService] Failed to clear old alerts:`, error.message);
      return 0;
    }
  }

  /**
   * Check if auto-resolve is enabled for a category
   * @param {string} category - Alert category
   * @returns {boolean} Whether auto-resolve is enabled
   */
  isAutoResolveEnabled(category) {
    return this._config.autoResolveEnabled && this._autoResolveConfig[category] !== false;
  }

  /**
   * Update auto-resolve configuration for a category
   * @param {string} category - Alert category
   * @param {boolean} enabled - Whether to enable auto-resolve
   */
  setAutoResolve(category, enabled) {
    if (Object.values(ALERT_CATEGORY).includes(category)) {
      this._autoResolveConfig[category] = enabled;
      console.log(`[AlertService] Auto-resolve for ${category}: ${enabled}`);
    }
  }

  /**
   * Update service configuration
   * @param {Object} config - Configuration updates
   */
  updateConfig(config) {
    this._config = { ...this._config, ...config };
    console.log('[AlertService] Config updated');
    this.emit('configUpdated', this._config);
  }

  /**
   * Check if the service is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._isInitialized;
  }

  /**
   * Shutdown the alert service
   */
  async shutdown() {
    console.log('[AlertService] Shutting down...');

    this._alertCounters.clear();
    this._isInitialized = false;

    this.emit('shutdown');
    console.log('[AlertService] Shutdown complete');
  }
}

// Singleton instance
let alertServiceInstance = null;

/**
 * Get or create the alert service singleton
 * @param {Object} config - Optional configuration override
 * @returns {AlertService} The alert service instance
 */
export function getAlertService(config = {}) {
  if (!alertServiceInstance) {
    alertServiceInstance = new AlertService(config);
  }
  return alertServiceInstance;
}

// Export class for testing
export { AlertService };

// Default export is the singleton getter
export default getAlertService;
