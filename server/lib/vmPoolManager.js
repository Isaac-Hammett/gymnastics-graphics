/**
 * VM Pool Manager
 *
 * Manages a pool of AWS EC2 instances for gymnastics graphics streaming.
 * Syncs VM state between AWS and Firebase for real-time updates.
 *
 * Firebase path structure:
 *   vmPool/
 *     config/           - Pool configuration (warmCount, maxInstances, etc.)
 *     vms/{vmId}/       - Individual VM state
 *       instanceId      - EC2 instance ID
 *       name            - VM display name
 *       status          - Pool status (available, assigned, in_use, stopped, starting, error)
 *       publicIp        - Current public IP
 *       assignedTo      - Competition ID if assigned
 *       services        - Service health status
 *       lastHealthCheck - Last health check timestamp
 *       lastStateChange - Last state change timestamp
 *
 * @module vmPoolManager
 */

import { EventEmitter } from 'events';
import admin from 'firebase-admin';
import { getAWSService } from './awsService.js';

// VM Status enum
export const VM_STATUS = {
  AVAILABLE: 'available',     // Ready for assignment, services running
  ASSIGNED: 'assigned',       // Linked to a competition
  IN_USE: 'in_use',           // Competition actively streaming
  STOPPED: 'stopped',         // Cold standby, not running
  STARTING: 'starting',       // EC2 instance starting up
  STOPPING: 'stopping',       // EC2 instance stopping
  ERROR: 'error'              // Health check failed, needs attention
};

// Default pool configuration
const DEFAULT_POOL_CONFIG = {
  warmCount: 2,           // VMs always running, ready for immediate assignment
  coldCount: 3,           // VMs stopped, started on demand
  maxInstances: 5,        // Maximum total VMs in pool
  healthCheckIntervalMs: 30000,  // Health check interval (30 seconds)
  idleTimeoutMinutes: 60, // Auto-stop after idle timeout
  servicePort: 3003       // Port for service health checks
};

/**
 * VM Pool Manager class
 * Manages the lifecycle and state of VMs in the pool
 */
class VMPoolManager extends EventEmitter {
  constructor() {
    super();

    this._db = null;
    this._aws = null;
    this._poolConfig = { ...DEFAULT_POOL_CONFIG };
    this._vms = new Map();  // Local cache of VM state
    this._initialized = false;
    this._healthCheckInterval = null;

    console.log('[VMPoolManager] Instance created');
  }

  /**
   * Initialize the pool manager
   * Syncs AWS state with Firebase and sets up listeners
   */
  async initializePool() {
    if (this._initialized) {
      console.log('[VMPoolManager] Already initialized');
      return;
    }

    console.log('[VMPoolManager] Initializing pool...');

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
      this._aws = getAWSService();

      // Load or create pool config
      await this._loadPoolConfig();

      // Sync AWS state with Firebase
      await this._syncWithAWS();

      // Set up Firebase listener for real-time updates
      this._setupFirebaseListener();

      this._initialized = true;
      console.log('[VMPoolManager] Pool initialized successfully');

      this.emit('poolInitialized', {
        config: this._poolConfig,
        vmCount: this._vms.size
      });

      return { success: true, vmCount: this._vms.size };
    } catch (error) {
      console.error('[VMPoolManager] Failed to initialize pool:', error.message);
      this.emit('poolError', { error: error.message });
      throw error;
    }
  }

  /**
   * Load pool configuration from Firebase or create default
   */
  async _loadPoolConfig() {
    try {
      const snapshot = await this._db.ref('vmPool/config').once('value');
      const config = snapshot.val();

      if (config) {
        this._poolConfig = { ...DEFAULT_POOL_CONFIG, ...config };
        console.log('[VMPoolManager] Loaded pool config from Firebase');
      } else {
        // Write default config to Firebase
        await this._db.ref('vmPool/config').set(this._poolConfig);
        console.log('[VMPoolManager] Created default pool config in Firebase');
      }
    } catch (error) {
      console.error('[VMPoolManager] Failed to load pool config:', error.message);
      // Continue with default config
    }
  }

  /**
   * Sync AWS state with Firebase
   * Discovers instances tagged for this pool and updates Firebase
   */
  async _syncWithAWS() {
    console.log('[VMPoolManager] Syncing with AWS...');

    try {
      // Get all instances tagged for this project
      const instances = await this._aws.describeInstances({
        tags: {
          Project: 'gymnastics-graphics',
          ManagedBy: 'vm-pool-manager'
        }
      });

      console.log(`[VMPoolManager] Found ${instances.length} AWS instances`);

      // Get current Firebase VM state
      const snapshot = await this._db.ref('vmPool/vms').once('value');
      const firebaseVms = snapshot.val() || {};

      // Update Firebase with AWS state
      const updates = {};
      const processedInstanceIds = new Set();

      for (const instance of instances) {
        processedInstanceIds.add(instance.instanceId);

        // Determine VM ID (use instance ID or existing Firebase key)
        const vmId = this._getVmIdForInstance(instance.instanceId, firebaseVms);

        // Determine status based on EC2 state
        const status = this._mapEC2StateToStatus(instance.state, firebaseVms[vmId]);

        const vmData = {
          instanceId: instance.instanceId,
          name: instance.name || `VM-${instance.instanceId.slice(-6)}`,
          status,
          publicIp: instance.publicIp,
          privateIp: instance.privateIp,
          instanceType: instance.instanceType,
          availabilityZone: instance.availabilityZone,
          launchTime: instance.launchTime?.toISOString?.() || instance.launchTime,
          assignedTo: firebaseVms[vmId]?.assignedTo || null,
          services: firebaseVms[vmId]?.services || null,
          lastHealthCheck: firebaseVms[vmId]?.lastHealthCheck || null,
          lastStateChange: firebaseVms[vmId]?.lastStateChange || new Date().toISOString(),
          tags: instance.tags || {}
        };

        updates[`vmPool/vms/${vmId}`] = vmData;
        this._vms.set(vmId, vmData);
      }

      // Remove VMs from Firebase that no longer exist in AWS
      for (const [vmId, vm] of Object.entries(firebaseVms)) {
        if (!processedInstanceIds.has(vm.instanceId)) {
          console.log(`[VMPoolManager] Removing terminated VM ${vmId} from Firebase`);
          updates[`vmPool/vms/${vmId}`] = null;
          this._vms.delete(vmId);
        }
      }

      // Apply all updates to Firebase
      if (Object.keys(updates).length > 0) {
        await this._db.ref().update(updates);
        console.log(`[VMPoolManager] Synced ${Object.keys(updates).length} updates to Firebase`);
      }

      this.emit('poolSynced', { vmCount: this._vms.size });
    } catch (error) {
      console.error('[VMPoolManager] AWS sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Get VM ID for an instance, finding existing key or creating new one
   */
  _getVmIdForInstance(instanceId, firebaseVms) {
    // Check if this instance already has a Firebase entry
    for (const [vmId, vm] of Object.entries(firebaseVms)) {
      if (vm.instanceId === instanceId) {
        return vmId;
      }
    }

    // Generate a short ID from instance ID
    return `vm-${instanceId.slice(-8)}`;
  }

  /**
   * Map EC2 instance state to VM pool status
   */
  _mapEC2StateToStatus(ec2State, existingVm) {
    switch (ec2State) {
      case 'running':
        // If assigned, keep assigned status; otherwise available
        if (existingVm?.assignedTo) {
          return existingVm.status === VM_STATUS.IN_USE
            ? VM_STATUS.IN_USE
            : VM_STATUS.ASSIGNED;
        }
        return VM_STATUS.AVAILABLE;

      case 'stopped':
        return VM_STATUS.STOPPED;

      case 'pending':
      case 'shutting-down':
        return VM_STATUS.STARTING;

      case 'stopping':
        return VM_STATUS.STOPPING;

      case 'terminated':
        return VM_STATUS.ERROR;

      default:
        return existingVm?.status || VM_STATUS.ERROR;
    }
  }

  /**
   * Set up Firebase listener for real-time pool updates
   */
  _setupFirebaseListener() {
    this._db.ref('vmPool/vms').on('value', (snapshot) => {
      const vms = snapshot.val() || {};

      // Update local cache
      this._vms.clear();
      for (const [vmId, vm] of Object.entries(vms)) {
        this._vms.set(vmId, vm);
      }

      this.emit('poolUpdated', { vmCount: this._vms.size, vms });
    });

    // Listen for config changes
    this._db.ref('vmPool/config').on('value', (snapshot) => {
      const config = snapshot.val();
      if (config) {
        this._poolConfig = { ...DEFAULT_POOL_CONFIG, ...config };
        this.emit('configUpdated', this._poolConfig);
      }
    });

    console.log('[VMPoolManager] Firebase listeners set up');
  }

  /**
   * Get an available VM from the pool
   * @returns {Object|null} Available VM or null if none available
   */
  getAvailableVM() {
    for (const [vmId, vm] of this._vms) {
      if (vm.status === VM_STATUS.AVAILABLE) {
        return { vmId, ...vm };
      }
    }
    return null;
  }

  /**
   * Get all VMs matching a status
   * @param {string} status - Status to filter by
   * @returns {Array} Array of VMs with vmId included
   */
  getVMsByStatus(status) {
    const result = [];
    for (const [vmId, vm] of this._vms) {
      if (vm.status === status) {
        result.push({ vmId, ...vm });
      }
    }
    return result;
  }

  /**
   * Assign a VM to a competition
   * @param {string} competitionId - Competition to assign to
   * @param {string} preferredVmId - Optional specific VM to assign
   * @returns {Promise<Object>} Assignment result
   */
  async assignVM(competitionId, preferredVmId = null) {
    if (!this._initialized) {
      throw new Error('Pool manager not initialized');
    }

    console.log(`[VMPoolManager] Assigning VM for competition ${competitionId}`);

    // Find VM to assign
    let vmId, vm;

    if (preferredVmId) {
      vm = this._vms.get(preferredVmId);
      if (!vm) {
        throw new Error(`VM ${preferredVmId} not found`);
      }
      if (vm.status !== VM_STATUS.AVAILABLE) {
        throw new Error(`VM ${preferredVmId} is not available (status: ${vm.status})`);
      }
      vmId = preferredVmId;
    } else {
      const available = this.getAvailableVM();
      if (!available) {
        // Try to start a stopped VM
        const stopped = this.getVMsByStatus(VM_STATUS.STOPPED);
        if (stopped.length > 0) {
          console.log(`[VMPoolManager] No available VMs, starting stopped VM ${stopped[0].vmId}`);
          await this.startVM(stopped[0].vmId);
          throw new Error('No VMs currently available. A stopped VM is starting - please try again in 2-3 minutes.');
        }
        throw new Error('No VMs available in pool');
      }
      vmId = available.vmId;
      vm = available;
    }

    try {
      // Update VM state in Firebase
      const updates = {
        [`vmPool/vms/${vmId}/status`]: VM_STATUS.ASSIGNED,
        [`vmPool/vms/${vmId}/assignedTo`]: competitionId,
        [`vmPool/vms/${vmId}/lastStateChange`]: new Date().toISOString()
      };

      // Also update competition config with vmAddress
      if (vm.publicIp) {
        updates[`competitions/${competitionId}/config/vmAddress`] = `${vm.publicIp}:${this._poolConfig.servicePort}`;
      }

      await this._db.ref().update(updates);

      // Update local cache
      vm.status = VM_STATUS.ASSIGNED;
      vm.assignedTo = competitionId;
      this._vms.set(vmId, vm);

      console.log(`[VMPoolManager] Assigned VM ${vmId} to competition ${competitionId}`);

      const result = {
        success: true,
        vmId,
        instanceId: vm.instanceId,
        publicIp: vm.publicIp,
        vmAddress: `${vm.publicIp}:${this._poolConfig.servicePort}`,
        competitionId
      };

      this.emit('vmAssigned', result);

      return result;
    } catch (error) {
      console.error(`[VMPoolManager] Failed to assign VM ${vmId}:`, error.message);
      throw error;
    }
  }

  /**
   * Release a VM back to the pool
   * @param {string} competitionId - Competition to release VM from
   * @returns {Promise<Object>} Release result
   */
  async releaseVM(competitionId) {
    if (!this._initialized) {
      throw new Error('Pool manager not initialized');
    }

    console.log(`[VMPoolManager] Releasing VM for competition ${competitionId}`);

    // Find VM assigned to this competition
    let vmId = null;
    let vm = null;

    for (const [id, v] of this._vms) {
      if (v.assignedTo === competitionId) {
        vmId = id;
        vm = v;
        break;
      }
    }

    if (!vmId) {
      console.log(`[VMPoolManager] No VM found for competition ${competitionId}`);
      return { success: true, message: 'No VM was assigned to this competition' };
    }

    try {
      // Update VM state in Firebase
      const updates = {
        [`vmPool/vms/${vmId}/status`]: VM_STATUS.AVAILABLE,
        [`vmPool/vms/${vmId}/assignedTo`]: null,
        [`vmPool/vms/${vmId}/lastStateChange`]: new Date().toISOString()
      };

      // Clear vmAddress from competition config
      updates[`competitions/${competitionId}/config/vmAddress`] = null;

      await this._db.ref().update(updates);

      // Update local cache
      vm.status = VM_STATUS.AVAILABLE;
      vm.assignedTo = null;
      this._vms.set(vmId, vm);

      console.log(`[VMPoolManager] Released VM ${vmId} from competition ${competitionId}`);

      const result = {
        success: true,
        vmId,
        instanceId: vm.instanceId,
        competitionId
      };

      this.emit('vmReleased', result);

      return result;
    } catch (error) {
      console.error(`[VMPoolManager] Failed to release VM ${vmId}:`, error.message);
      throw error;
    }
  }

  /**
   * Start a stopped VM
   * @param {string} vmId - VM ID to start
   * @returns {Promise<Object>} Start result
   */
  async startVM(vmId) {
    if (!this._initialized) {
      throw new Error('Pool manager not initialized');
    }

    const vm = this._vms.get(vmId);
    if (!vm) {
      throw new Error(`VM ${vmId} not found`);
    }

    if (vm.status !== VM_STATUS.STOPPED) {
      throw new Error(`VM ${vmId} is not stopped (status: ${vm.status})`);
    }

    console.log(`[VMPoolManager] Starting VM ${vmId} (instance: ${vm.instanceId})`);

    try {
      // Update status to starting
      await this._db.ref(`vmPool/vms/${vmId}`).update({
        status: VM_STATUS.STARTING,
        lastStateChange: new Date().toISOString()
      });

      // Start EC2 instance
      await this._aws.startInstance(vm.instanceId);

      this.emit('vmStarting', { vmId, instanceId: vm.instanceId });

      // Wait for instance to be running (non-blocking continuation)
      this._waitForVMReady(vmId, vm.instanceId).catch(error => {
        console.error(`[VMPoolManager] VM ${vmId} failed to become ready:`, error.message);
      });

      return {
        success: true,
        vmId,
        instanceId: vm.instanceId,
        message: 'VM is starting. It will be available in 2-3 minutes.'
      };
    } catch (error) {
      console.error(`[VMPoolManager] Failed to start VM ${vmId}:`, error.message);

      // Update status to error
      await this._db.ref(`vmPool/vms/${vmId}`).update({
        status: VM_STATUS.ERROR,
        lastStateChange: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Wait for a VM to become ready after starting
   */
  async _waitForVMReady(vmId, instanceId) {
    try {
      // Wait for instance to be running
      const instanceInfo = await this._aws.waitForInstanceRunning(instanceId, 180);

      // Update VM with new IP
      await this._db.ref(`vmPool/vms/${vmId}`).update({
        publicIp: instanceInfo.publicIp,
        privateIp: instanceInfo.privateIp,
        lastStateChange: new Date().toISOString()
      });

      // Wait for services to be ready
      if (instanceInfo.publicIp) {
        const ready = await this._aws.waitForServicesReady(instanceInfo.publicIp, {
          port: this._poolConfig.servicePort,
          timeoutSeconds: 120
        });

        if (ready) {
          await this._db.ref(`vmPool/vms/${vmId}`).update({
            status: VM_STATUS.AVAILABLE,
            services: { nodeServer: true, obsConnected: false },
            lastHealthCheck: new Date().toISOString(),
            lastStateChange: new Date().toISOString()
          });

          console.log(`[VMPoolManager] VM ${vmId} is now available`);
          this.emit('vmReady', { vmId, instanceId, publicIp: instanceInfo.publicIp });
        } else {
          throw new Error('Services did not become ready');
        }
      }
    } catch (error) {
      console.error(`[VMPoolManager] VM ${vmId} startup failed:`, error.message);

      await this._db.ref(`vmPool/vms/${vmId}`).update({
        status: VM_STATUS.ERROR,
        lastStateChange: new Date().toISOString()
      });

      this.emit('vmError', { vmId, instanceId, error: error.message });
    }
  }

  /**
   * Stop a VM
   * @param {string} vmId - VM ID to stop
   * @returns {Promise<Object>} Stop result
   */
  async stopVM(vmId) {
    if (!this._initialized) {
      throw new Error('Pool manager not initialized');
    }

    const vm = this._vms.get(vmId);
    if (!vm) {
      throw new Error(`VM ${vmId} not found`);
    }

    if (vm.assignedTo) {
      throw new Error(`VM ${vmId} is assigned to competition ${vm.assignedTo}. Release it first.`);
    }

    if (![VM_STATUS.AVAILABLE, VM_STATUS.ERROR].includes(vm.status)) {
      throw new Error(`VM ${vmId} cannot be stopped (status: ${vm.status})`);
    }

    console.log(`[VMPoolManager] Stopping VM ${vmId} (instance: ${vm.instanceId})`);

    try {
      // Update status to stopping
      await this._db.ref(`vmPool/vms/${vmId}`).update({
        status: VM_STATUS.STOPPING,
        lastStateChange: new Date().toISOString()
      });

      // Stop EC2 instance
      await this._aws.stopInstance(vm.instanceId);

      this.emit('vmStopping', { vmId, instanceId: vm.instanceId });

      // Wait for stop to complete (non-blocking)
      this._waitForVMStopped(vmId, vm.instanceId).catch(error => {
        console.error(`[VMPoolManager] VM ${vmId} stop failed:`, error.message);
      });

      return {
        success: true,
        vmId,
        instanceId: vm.instanceId,
        message: 'VM is stopping.'
      };
    } catch (error) {
      console.error(`[VMPoolManager] Failed to stop VM ${vmId}:`, error.message);
      throw error;
    }
  }

  /**
   * Wait for a VM to stop
   */
  async _waitForVMStopped(vmId, instanceId) {
    try {
      await this._aws.waitForInstanceStopped(instanceId, 180);

      await this._db.ref(`vmPool/vms/${vmId}`).update({
        status: VM_STATUS.STOPPED,
        publicIp: null,
        services: null,
        lastStateChange: new Date().toISOString()
      });

      console.log(`[VMPoolManager] VM ${vmId} is now stopped`);
      this.emit('vmStopped', { vmId, instanceId });
    } catch (error) {
      console.error(`[VMPoolManager] VM ${vmId} stop wait failed:`, error.message);

      await this._db.ref(`vmPool/vms/${vmId}`).update({
        status: VM_STATUS.ERROR,
        lastStateChange: new Date().toISOString()
      });
    }
  }

  /**
   * Get full pool status
   * @returns {Object} Pool status with all VMs and counts
   */
  getPoolStatus() {
    const vms = [];
    const counts = {
      total: 0,
      available: 0,
      assigned: 0,
      inUse: 0,
      stopped: 0,
      starting: 0,
      stopping: 0,
      error: 0
    };

    for (const [vmId, vm] of this._vms) {
      vms.push({ vmId, ...vm });
      counts.total++;

      switch (vm.status) {
        case VM_STATUS.AVAILABLE:
          counts.available++;
          break;
        case VM_STATUS.ASSIGNED:
          counts.assigned++;
          break;
        case VM_STATUS.IN_USE:
          counts.inUse++;
          break;
        case VM_STATUS.STOPPED:
          counts.stopped++;
          break;
        case VM_STATUS.STARTING:
          counts.starting++;
          break;
        case VM_STATUS.STOPPING:
          counts.stopping++;
          break;
        case VM_STATUS.ERROR:
          counts.error++;
          break;
      }
    }

    return {
      config: this._poolConfig,
      counts,
      vms,
      initialized: this._initialized
    };
  }

  /**
   * Get status for a specific VM
   * @param {string} vmId - VM ID
   * @returns {Object|null} VM status or null if not found
   */
  getVM(vmId) {
    const vm = this._vms.get(vmId);
    return vm ? { vmId, ...vm } : null;
  }

  /**
   * Get VM assigned to a competition
   * @param {string} competitionId - Competition ID
   * @returns {Object|null} VM assigned to competition or null
   */
  getVMForCompetition(competitionId) {
    for (const [vmId, vm] of this._vms) {
      if (vm.assignedTo === competitionId) {
        return { vmId, ...vm };
      }
    }
    return null;
  }

  /**
   * Ensure minimum warm VMs are available
   * Starts stopped VMs if pool falls below warm threshold
   * @returns {Promise<Object>} Maintenance result
   */
  async ensureMinWarmVMs() {
    if (!this._initialized) {
      throw new Error('Pool manager not initialized');
    }

    const status = this.getPoolStatus();
    const warmVMs = status.counts.available + status.counts.assigned + status.counts.inUse;
    const stoppedVMs = this.getVMsByStatus(VM_STATUS.STOPPED);

    console.log(`[VMPoolManager] Warm VMs: ${warmVMs}/${this._poolConfig.warmCount}, Stopped: ${stoppedVMs.length}`);

    const toStart = [];

    // If we're below warm threshold and have stopped VMs
    if (warmVMs < this._poolConfig.warmCount && stoppedVMs.length > 0) {
      const needed = Math.min(
        this._poolConfig.warmCount - warmVMs,
        stoppedVMs.length
      );

      for (let i = 0; i < needed; i++) {
        toStart.push(stoppedVMs[i].vmId);
      }
    }

    // Start the VMs
    const results = [];
    for (const vmId of toStart) {
      try {
        await this.startVM(vmId);
        results.push({ vmId, success: true });
      } catch (error) {
        results.push({ vmId, success: false, error: error.message });
      }
    }

    const result = {
      warmVMsBefore: warmVMs,
      warmVMsTarget: this._poolConfig.warmCount,
      startedCount: results.filter(r => r.success).length,
      results
    };

    this.emit('poolMaintenance', result);

    return result;
  }

  /**
   * Update pool configuration
   * @param {Object} config - New configuration values
   * @returns {Promise<Object>} Updated config
   */
  async updatePoolConfig(config) {
    if (!this._initialized) {
      throw new Error('Pool manager not initialized');
    }

    const newConfig = { ...this._poolConfig, ...config };

    await this._db.ref('vmPool/config').set(newConfig);
    this._poolConfig = newConfig;

    console.log('[VMPoolManager] Pool config updated');
    this.emit('configUpdated', newConfig);

    return newConfig;
  }

  /**
   * Mark a VM as in use (competition actively streaming)
   * @param {string} vmId - VM ID
   * @returns {Promise<Object>} Update result
   */
  async markVMInUse(vmId) {
    const vm = this._vms.get(vmId);
    if (!vm) {
      throw new Error(`VM ${vmId} not found`);
    }

    if (vm.status !== VM_STATUS.ASSIGNED) {
      throw new Error(`VM ${vmId} is not assigned (status: ${vm.status})`);
    }

    await this._db.ref(`vmPool/vms/${vmId}`).update({
      status: VM_STATUS.IN_USE,
      lastStateChange: new Date().toISOString()
    });

    this.emit('vmInUse', { vmId, competitionId: vm.assignedTo });

    return { success: true, vmId, status: VM_STATUS.IN_USE };
  }

  /**
   * Update VM services status (from health check)
   * @param {string} vmId - VM ID
   * @param {Object} services - Service status object
   */
  async updateVMServices(vmId, services) {
    const vm = this._vms.get(vmId);
    if (!vm) {
      return;
    }

    await this._db.ref(`vmPool/vms/${vmId}`).update({
      services,
      lastHealthCheck: new Date().toISOString()
    });
  }

  /**
   * Set VM to error status
   * @param {string} vmId - VM ID
   * @param {string} reason - Error reason
   */
  async setVMError(vmId, reason) {
    const vm = this._vms.get(vmId);
    if (!vm) {
      return;
    }

    await this._db.ref(`vmPool/vms/${vmId}`).update({
      status: VM_STATUS.ERROR,
      errorReason: reason,
      lastStateChange: new Date().toISOString()
    });

    this.emit('vmError', { vmId, reason });
  }

  /**
   * Check if pool manager is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Shutdown pool manager
   * Removes Firebase listeners and clears state
   */
  async shutdown() {
    console.log('[VMPoolManager] Shutting down...');

    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }

    if (this._db) {
      this._db.ref('vmPool/vms').off();
      this._db.ref('vmPool/config').off();
    }

    this._vms.clear();
    this._initialized = false;

    this.emit('poolShutdown');
    console.log('[VMPoolManager] Shutdown complete');
  }
}

// Singleton instance
let vmPoolManagerInstance = null;

/**
 * Get or create the VM pool manager singleton
 * @returns {VMPoolManager} The pool manager instance
 */
export function getVMPoolManager() {
  if (!vmPoolManagerInstance) {
    vmPoolManagerInstance = new VMPoolManager();
  }
  return vmPoolManagerInstance;
}

// Export class for testing
export { VMPoolManager };

// Default export is the singleton getter
export default getVMPoolManager;
