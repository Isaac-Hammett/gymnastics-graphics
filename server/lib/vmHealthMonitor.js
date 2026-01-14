/**
 * VM Health Monitor
 *
 * Monitors the health of VMs in the pool by checking:
 * - VM /api/status endpoint for Node server health
 * - OBS WebSocket status via VM API
 *
 * Updates Firebase vmPool/{vmId}/services with health status.
 * Detects unreachable VMs and sets them to error status.
 *
 * @module vmHealthMonitor
 */

import { EventEmitter } from 'events';
import admin from 'firebase-admin';
import { getVMPoolManager, VM_STATUS } from './vmPoolManager.js';
import { getAlertService, ALERT_LEVEL, ALERT_CATEGORY } from './alertService.js';

// Health check configuration
const DEFAULT_CONFIG = {
  pollIntervalMs: 30000,      // 30 seconds between health checks
  requestTimeoutMs: 5000,     // 5 second timeout per request
  servicePort: 3003,          // Port for service health checks
  unhealthyThreshold: 3,      // Number of failed checks before marking error
  recoveryThreshold: 2        // Number of successful checks before clearing error
};

/**
 * VM Health Monitor class
 * Continuously monitors VM health and updates Firebase
 */
class VMHealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();

    this._config = { ...DEFAULT_CONFIG, ...config };
    this._db = null;
    this._poolManager = null;
    this._alertService = null;
    this._pollInterval = null;
    this._isRunning = false;
    this._failureCounts = new Map();  // Track consecutive failures per VM
    this._successCounts = new Map();  // Track consecutive successes per VM

    console.log('[VMHealthMonitor] Instance created');
  }

  /**
   * Initialize the health monitor
   * Sets up Firebase connection and starts polling loop
   */
  async initialize() {
    if (this._isRunning) {
      console.log('[VMHealthMonitor] Already running');
      return;
    }

    console.log('[VMHealthMonitor] Initializing...');

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
      this._poolManager = getVMPoolManager();
      this._alertService = getAlertService();

      // Initialize alert service if not already done
      if (!this._alertService.isInitialized()) {
        await this._alertService.initialize();
      }

      // Start health check polling loop
      this._startPolling();

      this._isRunning = true;
      console.log('[VMHealthMonitor] Initialized successfully');

      this.emit('initialized', { config: this._config });
    } catch (error) {
      console.error('[VMHealthMonitor] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Start the health check polling loop
   */
  _startPolling() {
    if (this._pollInterval) {
      return;
    }

    console.log(`[VMHealthMonitor] Starting polling (interval: ${this._config.pollIntervalMs}ms)`);

    // Run initial check
    this._runHealthChecks().catch(error => {
      console.error('[VMHealthMonitor] Initial health check failed:', error.message);
    });

    // Set up interval
    this._pollInterval = setInterval(() => {
      this._runHealthChecks().catch(error => {
        console.error('[VMHealthMonitor] Health check cycle failed:', error.message);
      });
    }, this._config.pollIntervalMs);
  }

  /**
   * Stop the health check polling loop
   */
  _stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
      console.log('[VMHealthMonitor] Polling stopped');
    }
  }

  /**
   * Run health checks on all VMs that should be checked
   */
  async _runHealthChecks() {
    if (!this._poolManager || !this._poolManager.isInitialized()) {
      console.log('[VMHealthMonitor] Pool manager not ready, skipping health check');
      return;
    }

    const poolStatus = this._poolManager.getPoolStatus();
    const vmsToCheck = poolStatus.vms.filter(vm =>
      // Only check VMs that are running (have a public IP and are in a running state)
      vm.publicIp && [
        VM_STATUS.AVAILABLE,
        VM_STATUS.ASSIGNED,
        VM_STATUS.IN_USE
      ].includes(vm.status)
    );

    console.log(`[VMHealthMonitor] Checking health of ${vmsToCheck.length} VMs`);

    const results = await Promise.all(
      vmsToCheck.map(vm => this.checkVMHealth(vm.vmId))
    );

    // Emit summary event
    const healthy = results.filter(r => r.healthy).length;
    const unhealthy = results.filter(r => !r.healthy).length;

    this.emit('healthCheckComplete', {
      total: vmsToCheck.length,
      healthy,
      unhealthy,
      results
    });
  }

  /**
   * Check health of a specific VM
   * @param {string} vmId - VM ID to check
   * @returns {Promise<Object>} Health check result
   */
  async checkVMHealth(vmId) {
    const vm = this._poolManager?.getVM(vmId);
    if (!vm) {
      return { vmId, healthy: false, error: 'VM not found' };
    }

    if (!vm.publicIp) {
      return { vmId, healthy: false, error: 'No public IP' };
    }

    const startTime = Date.now();

    try {
      // Check VM /api/status endpoint
      const services = await this._checkServices(vm.publicIp);
      const responseTime = Date.now() - startTime;

      const result = {
        vmId,
        instanceId: vm.instanceId,
        publicIp: vm.publicIp,
        healthy: services.nodeServer,
        services,
        responseTime,
        timestamp: new Date().toISOString()
      };

      // Update Firebase with health status
      await this._updateVMHealth(vmId, services, result.healthy);

      // Handle success/failure tracking
      if (result.healthy) {
        await this._handleHealthyVM(vmId, vm, result);
      } else {
        await this._handleUnhealthyVM(vmId, vm, result);
      }

      this.emit('vmHealthChecked', result);

      return result;
    } catch (error) {
      const result = {
        vmId,
        instanceId: vm.instanceId,
        publicIp: vm.publicIp,
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      // Update Firebase with error status
      await this._updateVMHealth(vmId, { nodeServer: false, obsConnected: false, error: error.message }, false);
      await this._handleUnhealthyVM(vmId, vm, result);

      this.emit('vmHealthChecked', result);

      return result;
    }
  }

  /**
   * Check services on a VM via /api/status endpoint
   * @param {string} publicIp - VM public IP address
   * @returns {Promise<Object>} Service status
   */
  async _checkServices(publicIp) {
    const url = `http://${publicIp}:${this._config.servicePort}/api/status`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this._config.requestTimeoutMs);

      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          nodeServer: true,
          obsConnected: data.obsConnected || false,
          uptime: data.uptime,
          version: data.version
        };
      }

      return {
        nodeServer: false,
        obsConnected: false,
        error: `HTTP ${response.status}`
      };
    } catch (error) {
      const errorMessage = error.name === 'AbortError'
        ? 'Request timeout'
        : error.message;

      return {
        nodeServer: false,
        obsConnected: false,
        error: errorMessage
      };
    }
  }

  /**
   * Update VM health status in Firebase
   * @param {string} vmId - VM ID
   * @param {Object} services - Service status object
   * @param {boolean} healthy - Overall health status
   */
  async _updateVMHealth(vmId, services, healthy) {
    if (!this._db) {
      return;
    }

    try {
      await this._db.ref(`vmPool/vms/${vmId}`).update({
        services,
        lastHealthCheck: new Date().toISOString()
      });
    } catch (error) {
      console.error(`[VMHealthMonitor] Failed to update health for VM ${vmId}:`, error.message);
    }
  }

  /**
   * Handle a healthy VM - track recovery and clear errors
   * @param {string} vmId - VM ID
   * @param {Object} vm - VM data
   * @param {Object} result - Health check result
   */
  async _handleHealthyVM(vmId, vm, result) {
    // Reset failure count
    this._failureCounts.set(vmId, 0);

    // Track consecutive successes
    const successCount = (this._successCounts.get(vmId) || 0) + 1;
    this._successCounts.set(vmId, successCount);

    // Auto-resolve any alerts for this VM when healthy
    if (vm.assignedTo && this._alertService) {
      // Resolve VM unreachable alerts
      await this._alertService.resolveBySourceId(vm.assignedTo, `vm-unreachable-${vmId}`, 'system');
      // Resolve OBS disconnected alerts
      await this._alertService.resolveBySourceId(vm.assignedTo, `obs-disconnected-${vmId}`, 'system');
      // Resolve node server down alerts
      await this._alertService.resolveBySourceId(vm.assignedTo, `node-down-${vmId}`, 'system');
    }

    // If VM was in error state and has recovered
    if (vm.status === VM_STATUS.ERROR && successCount >= this._config.recoveryThreshold) {
      console.log(`[VMHealthMonitor] VM ${vmId} has recovered (${successCount} successful checks)`);

      // Determine what state to restore to
      const newStatus = vm.assignedTo ? VM_STATUS.ASSIGNED : VM_STATUS.AVAILABLE;

      try {
        await this._db.ref(`vmPool/vms/${vmId}`).update({
          status: newStatus,
          errorReason: null,
          lastStateChange: new Date().toISOString()
        });

        this._successCounts.set(vmId, 0);

        this.emit('vmRecovered', {
          vmId,
          previousStatus: VM_STATUS.ERROR,
          newStatus,
          assignedTo: vm.assignedTo
        });
      } catch (error) {
        console.error(`[VMHealthMonitor] Failed to clear error for VM ${vmId}:`, error.message);
      }
    }
  }

  /**
   * Handle an unhealthy VM - track failures and set error status
   * @param {string} vmId - VM ID
   * @param {Object} vm - VM data
   * @param {Object} result - Health check result
   */
  async _handleUnhealthyVM(vmId, vm, result) {
    // Reset success count
    this._successCounts.set(vmId, 0);

    // Track consecutive failures
    const failureCount = (this._failureCounts.get(vmId) || 0) + 1;
    this._failureCounts.set(vmId, failureCount);

    console.log(`[VMHealthMonitor] VM ${vmId} health check failed (${failureCount}/${this._config.unhealthyThreshold}): ${result.error || 'services not healthy'}`);

    // If threshold reached, mark VM as error
    if (failureCount >= this._config.unhealthyThreshold && vm.status !== VM_STATUS.ERROR) {
      const reason = result.error || 'Health check failed';

      console.log(`[VMHealthMonitor] VM ${vmId} marked as ERROR: ${reason}`);

      try {
        await this._db.ref(`vmPool/vms/${vmId}`).update({
          status: VM_STATUS.ERROR,
          errorReason: reason,
          lastStateChange: new Date().toISOString()
        });

        const previousStatus = vm.status;

        this.emit('vmHealthChanged', {
          vmId,
          previousStatus,
          newStatus: VM_STATUS.ERROR,
          reason,
          assignedTo: vm.assignedTo
        });

        // Create alerts based on what failed - only for VMs assigned to competitions
        if (vm.assignedTo && this._alertService) {
          if (!result.services?.nodeServer) {
            // VM is completely unreachable - critical alert
            await this._alertService.createAlert(vm.assignedTo, {
              level: ALERT_LEVEL.CRITICAL,
              category: ALERT_CATEGORY.VM,
              title: 'VM Unreachable',
              message: `Production VM ${vm.name || vmId} is not responding. IP: ${vm.publicIp}. Reason: ${result.error || 'Node server not responding'}`,
              sourceId: `vm-unreachable-${vmId}`,
              metadata: {
                vmId,
                publicIp: vm.publicIp,
                reason: result.error
              }
            });

            this.emit('vmUnreachable', {
              vmId,
              publicIp: vm.publicIp,
              reason: result.error || 'Node server not responding'
            });
          } else if (!result.services?.obsConnected) {
            // Node is up but OBS is disconnected - critical alert
            await this._alertService.createAlert(vm.assignedTo, {
              level: ALERT_LEVEL.CRITICAL,
              category: ALERT_CATEGORY.OBS,
              title: 'OBS Disconnected',
              message: `OBS WebSocket disconnected on VM ${vm.name || vmId}. Streaming may be interrupted.`,
              sourceId: `obs-disconnected-${vmId}`,
              metadata: {
                vmId,
                publicIp: vm.publicIp
              }
            });

            this.emit('obsDisconnected', {
              vmId,
              publicIp: vm.publicIp
            });
          }
        } else {
          // Still emit events for VMs not assigned to competitions
          if (!result.services?.nodeServer) {
            this.emit('vmUnreachable', {
              vmId,
              publicIp: vm.publicIp,
              reason: result.error || 'Node server not responding'
            });
          }

          if (result.services?.nodeServer && !result.services?.obsConnected) {
            this.emit('obsDisconnected', {
              vmId,
              publicIp: vm.publicIp
            });
          }
        }
      } catch (error) {
        console.error(`[VMHealthMonitor] Failed to set error for VM ${vmId}:`, error.message);
      }
    }
  }

  /**
   * Create an info alert for idle timeout stop
   * Called when a VM is stopped due to idle timeout
   * @param {string} vmId - VM ID
   * @param {Object} vm - VM data
   */
  async createIdleTimeoutAlert(vmId, vm) {
    if (!vm.assignedTo || !this._alertService) {
      return;
    }

    try {
      await this._alertService.createAlert(vm.assignedTo, {
        level: ALERT_LEVEL.INFO,
        category: ALERT_CATEGORY.VM,
        title: 'VM Stopped (Idle)',
        message: `VM ${vm.name || vmId} was stopped due to idle timeout. Click to restart if needed.`,
        sourceId: `vm-idle-stop-${vmId}`,
        metadata: {
          vmId,
          publicIp: vm.publicIp,
          stoppedAt: new Date().toISOString()
        }
      });

      console.log(`[VMHealthMonitor] Created idle timeout alert for VM ${vmId}`);
    } catch (error) {
      console.error(`[VMHealthMonitor] Failed to create idle timeout alert:`, error.message);
    }
  }

  /**
   * Get current health status for all monitored VMs
   * @returns {Object} Health status summary
   */
  getHealthStatus() {
    if (!this._poolManager || !this._poolManager.isInitialized()) {
      return { initialized: false, vms: [] };
    }

    const poolStatus = this._poolManager.getPoolStatus();
    const vms = poolStatus.vms.map(vm => ({
      vmId: vm.vmId,
      status: vm.status,
      services: vm.services,
      lastHealthCheck: vm.lastHealthCheck,
      failureCount: this._failureCounts.get(vm.vmId) || 0,
      successCount: this._successCounts.get(vm.vmId) || 0
    }));

    return {
      initialized: this._isRunning,
      pollIntervalMs: this._config.pollIntervalMs,
      vms
    };
  }

  /**
   * Update configuration
   * @param {Object} config - New configuration values
   */
  updateConfig(config) {
    const oldInterval = this._config.pollIntervalMs;
    this._config = { ...this._config, ...config };

    // Restart polling if interval changed
    if (config.pollIntervalMs && config.pollIntervalMs !== oldInterval && this._isRunning) {
      this._stopPolling();
      this._startPolling();
    }

    console.log('[VMHealthMonitor] Config updated');
    this.emit('configUpdated', this._config);
  }

  /**
   * Force a health check for a specific VM (on-demand check)
   * @param {string} vmId - VM ID to check
   * @returns {Promise<Object>} Health check result
   */
  async forceHealthCheck(vmId) {
    console.log(`[VMHealthMonitor] Force health check for VM ${vmId}`);
    return this.checkVMHealth(vmId);
  }

  /**
   * Force health checks on all VMs
   * @returns {Promise<void>}
   */
  async forceHealthCheckAll() {
    console.log('[VMHealthMonitor] Force health check on all VMs');
    await this._runHealthChecks();
  }

  /**
   * Check if the health monitor is running
   * @returns {boolean}
   */
  isRunning() {
    return this._isRunning;
  }

  /**
   * Shutdown the health monitor
   */
  async shutdown() {
    console.log('[VMHealthMonitor] Shutting down...');

    this._stopPolling();
    this._failureCounts.clear();
    this._successCounts.clear();
    this._isRunning = false;

    this.emit('shutdown');
    console.log('[VMHealthMonitor] Shutdown complete');
  }
}

// Singleton instance
let vmHealthMonitorInstance = null;

/**
 * Get or create the VM health monitor singleton
 * @param {Object} config - Optional configuration override
 * @returns {VMHealthMonitor} The health monitor instance
 */
export function getVMHealthMonitor(config = {}) {
  if (!vmHealthMonitorInstance) {
    vmHealthMonitorInstance = new VMHealthMonitor(config);
  }
  return vmHealthMonitorInstance;
}

// Export class for testing
export { VMHealthMonitor };

// Default export is the singleton getter
export default getVMHealthMonitor;
