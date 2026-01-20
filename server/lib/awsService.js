/**
 * AWS EC2 Service Module
 *
 * Provides AWS EC2 operations for VM pool management including:
 * - Instance listing with tag filters
 * - Start/stop/reboot/terminate instances
 * - Launch new instances from AMI
 * - Instance status and health checks
 *
 * @module awsService
 */

import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  RebootInstancesCommand,
  TerminateInstancesCommand,
  RunInstancesCommand,
  DescribeInstanceStatusCommand,
  CreateTagsCommand,
  waitUntilInstanceRunning,
  waitUntilInstanceStopped
} from '@aws-sdk/client-ec2';
import { EventEmitter } from 'events';

// AWS resource configuration from environment or defaults
const AWS_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  vpcId: process.env.AWS_VPC_ID || 'vpc-09ba9c02e2c976cf5',
  securityGroupId: process.env.AWS_SECURITY_GROUP_ID || 'sg-025f1ac53cccb756b',
  keyPairName: process.env.AWS_KEY_PAIR_NAME || 'gymnastics-graphics-key-pair',
  amiId: process.env.AWS_AMI_ID || 'ami-070ce58462b2b9213', // gymnastics-vm-v2.2
  defaultInstanceType: process.env.AWS_INSTANCE_TYPE || 't3.large'
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000
};

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
const getBackoffDelay = (attempt) => {
  const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
};

/**
 * AWS EC2 Service class for VM management
 * Extends EventEmitter for operation event broadcasting
 */
class AWSService extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = { ...AWS_CONFIG, ...config };

    // Initialize EC2 client
    // Uses environment credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // or IAM role if running on AWS infrastructure
    this.ec2 = new EC2Client({
      region: this.config.region
    });

    this._initialized = true;
    console.log(`[AWSService] Initialized for region ${this.config.region}`);
  }

  /**
   * Execute an EC2 command with retry logic for transient failures
   * @param {Function} commandFn - Async function that executes the command
   * @param {string} operationName - Name of operation for logging
   * @returns {Promise<any>} Command result
   */
  async _executeWithRetry(commandFn, operationName) {
    let lastError;

    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const result = await commandFn();
        if (attempt > 0) {
          console.log(`[AWSService] ${operationName} succeeded on retry ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this._isRetryableError(error);

        if (!isRetryable || attempt >= RETRY_CONFIG.maxRetries - 1) {
          console.error(`[AWSService] ${operationName} failed:`, error.message);
          throw error;
        }

        const delay = getBackoffDelay(attempt);
        console.warn(`[AWSService] ${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
        await sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} True if error is retryable
   */
  _isRetryableError(error) {
    const retryableCodes = [
      'RequestLimitExceeded',
      'Throttling',
      'ServiceUnavailable',
      'InternalError',
      'NetworkingError',
      'TimeoutError'
    ];

    return retryableCodes.includes(error.name) ||
           retryableCodes.includes(error.code) ||
           error.message?.includes('ECONNRESET') ||
           error.message?.includes('socket hang up');
  }

  /**
   * Describe instances with optional tag filters
   * @param {Object} options - Filter options
   * @param {string[]} options.instanceIds - Specific instance IDs to describe
   * @param {Object} options.tags - Tag key-value pairs to filter by
   * @param {string[]} options.states - Instance states to filter by
   * @returns {Promise<Object[]>} Array of instance info objects
   */
  async describeInstances(options = {}) {
    const { instanceIds, tags, states } = options;

    const filters = [];

    // Add tag filters
    if (tags) {
      for (const [key, value] of Object.entries(tags)) {
        filters.push({
          Name: `tag:${key}`,
          Values: Array.isArray(value) ? value : [value]
        });
      }
    }

    // Add state filter
    if (states && states.length > 0) {
      filters.push({
        Name: 'instance-state-name',
        Values: states
      });
    }

    const params = {};

    if (instanceIds && instanceIds.length > 0) {
      params.InstanceIds = instanceIds;
    }

    if (filters.length > 0) {
      params.Filters = filters;
    }

    return this._executeWithRetry(async () => {
      console.log(`[AWSService] Describing instances:`, JSON.stringify(params));

      const command = new DescribeInstancesCommand(params);
      const response = await this.ec2.send(command);

      const instances = [];

      for (const reservation of (response.Reservations || [])) {
        for (const instance of (reservation.Instances || [])) {
          instances.push(this._formatInstanceInfo(instance));
        }
      }

      console.log(`[AWSService] Found ${instances.length} instances`);
      this.emit('instancesDescribed', { count: instances.length });

      return instances;
    }, 'describeInstances');
  }

  /**
   * Get detailed info for a single instance
   * @param {string} instanceId - EC2 instance ID
   * @returns {Promise<Object|null>} Instance info or null if not found
   */
  async getInstanceStatus(instanceId) {
    const instances = await this.describeInstances({ instanceIds: [instanceId] });
    return instances.length > 0 ? instances[0] : null;
  }

  /**
   * Start one or more EC2 instances
   * @param {string|string[]} instanceIds - Instance ID(s) to start
   * @returns {Promise<Object>} Start result with instance states
   */
  async startInstance(instanceIds) {
    const ids = Array.isArray(instanceIds) ? instanceIds : [instanceIds];

    return this._executeWithRetry(async () => {
      console.log(`[AWSService] Starting instances: ${ids.join(', ')}`);

      const command = new StartInstancesCommand({
        InstanceIds: ids
      });

      const response = await this.ec2.send(command);

      const result = {
        startingInstances: (response.StartingInstances || []).map(si => ({
          instanceId: si.InstanceId,
          previousState: si.PreviousState?.Name,
          currentState: si.CurrentState?.Name
        }))
      };

      console.log(`[AWSService] Start command sent for ${ids.length} instances`);
      this.emit('instanceStarting', { instanceIds: ids });

      return result;
    }, 'startInstance');
  }

  /**
   * Stop one or more EC2 instances
   * @param {string|string[]} instanceIds - Instance ID(s) to stop
   * @param {boolean} force - Force stop (not graceful shutdown)
   * @returns {Promise<Object>} Stop result with instance states
   */
  async stopInstance(instanceIds, force = false) {
    const ids = Array.isArray(instanceIds) ? instanceIds : [instanceIds];

    return this._executeWithRetry(async () => {
      console.log(`[AWSService] Stopping instances: ${ids.join(', ')} (force: ${force})`);

      const command = new StopInstancesCommand({
        InstanceIds: ids,
        Force: force
      });

      const response = await this.ec2.send(command);

      const result = {
        stoppingInstances: (response.StoppingInstances || []).map(si => ({
          instanceId: si.InstanceId,
          previousState: si.PreviousState?.Name,
          currentState: si.CurrentState?.Name
        }))
      };

      console.log(`[AWSService] Stop command sent for ${ids.length} instances`);
      this.emit('instanceStopping', { instanceIds: ids });

      return result;
    }, 'stopInstance');
  }

  /**
   * Reboot one or more EC2 instances
   * @param {string|string[]} instanceIds - Instance ID(s) to reboot
   * @returns {Promise<void>}
   */
  async rebootInstance(instanceIds) {
    const ids = Array.isArray(instanceIds) ? instanceIds : [instanceIds];

    return this._executeWithRetry(async () => {
      console.log(`[AWSService] Rebooting instances: ${ids.join(', ')}`);

      const command = new RebootInstancesCommand({
        InstanceIds: ids
      });

      await this.ec2.send(command);

      console.log(`[AWSService] Reboot command sent for ${ids.length} instances`);
      this.emit('instanceRebooting', { instanceIds: ids });
    }, 'rebootInstance');
  }

  /**
   * Terminate one or more EC2 instances
   * @param {string|string[]} instanceIds - Instance ID(s) to terminate
   * @returns {Promise<Object>} Termination result with instance states
   */
  async terminateInstance(instanceIds) {
    const ids = Array.isArray(instanceIds) ? instanceIds : [instanceIds];

    return this._executeWithRetry(async () => {
      console.log(`[AWSService] Terminating instances: ${ids.join(', ')}`);

      const command = new TerminateInstancesCommand({
        InstanceIds: ids
      });

      const response = await this.ec2.send(command);

      const result = {
        terminatingInstances: (response.TerminatingInstances || []).map(ti => ({
          instanceId: ti.InstanceId,
          previousState: ti.PreviousState?.Name,
          currentState: ti.CurrentState?.Name
        }))
      };

      console.log(`[AWSService] Terminate command sent for ${ids.length} instances`);
      this.emit('instanceTerminating', { instanceIds: ids });

      return result;
    }, 'terminateInstance');
  }

  /**
   * Launch a new EC2 instance from AMI
   * @param {Object} options - Launch configuration
   * @param {string} options.name - Instance name tag
   * @param {string} options.instanceType - EC2 instance type
   * @param {string} options.amiId - AMI ID (defaults to config)
   * @param {Object} options.tags - Additional tags
   * @returns {Promise<Object>} Launched instance info
   */
  async launchInstance(options = {}) {
    const {
      name = `gymnastics-vm-${Date.now()}`,
      instanceType = this.config.defaultInstanceType,
      amiId = this.config.amiId,
      tags = {}
    } = options;

    return this._executeWithRetry(async () => {
      console.log(`[AWSService] Launching instance: ${name} (${instanceType})`);

      // Build tag specifications
      const tagSpecs = [
        {
          ResourceType: 'instance',
          Tags: [
            { Key: 'Name', Value: name },
            { Key: 'Project', Value: 'gymnastics-graphics' },
            { Key: 'ManagedBy', Value: 'vm-pool-manager' },
            ...Object.entries(tags).map(([Key, Value]) => ({ Key, Value: String(Value) }))
          ]
        }
      ];

      const command = new RunInstancesCommand({
        ImageId: amiId,
        InstanceType: instanceType,
        MinCount: 1,
        MaxCount: 1,
        KeyName: this.config.keyPairName,
        SecurityGroupIds: [this.config.securityGroupId],
        TagSpecifications: tagSpecs
      });

      const response = await this.ec2.send(command);

      const instance = response.Instances?.[0];
      if (!instance) {
        throw new Error('No instance returned from launch command');
      }

      const result = this._formatInstanceInfo(instance);

      console.log(`[AWSService] Launched instance ${result.instanceId}`);
      this.emit('instanceLaunched', result);

      return result;
    }, 'launchInstance');
  }

  /**
   * Add or update tags on instances
   * @param {string|string[]} instanceIds - Instance ID(s) to tag
   * @param {Object} tags - Tags to add/update
   * @returns {Promise<void>}
   */
  async createTags(instanceIds, tags) {
    const ids = Array.isArray(instanceIds) ? instanceIds : [instanceIds];

    return this._executeWithRetry(async () => {
      console.log(`[AWSService] Creating tags on instances: ${ids.join(', ')}`);

      const command = new CreateTagsCommand({
        Resources: ids,
        Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value: String(Value) }))
      });

      await this.ec2.send(command);

      console.log(`[AWSService] Tags created on ${ids.length} instances`);
    }, 'createTags');
  }

  /**
   * Wait for instance to reach running state
   * @param {string} instanceId - Instance ID to wait for
   * @param {number} timeoutSeconds - Maximum wait time in seconds
   * @returns {Promise<Object>} Instance info when running
   */
  async waitForInstanceRunning(instanceId, timeoutSeconds = 300) {
    console.log(`[AWSService] Waiting for instance ${instanceId} to be running (timeout: ${timeoutSeconds}s)`);

    try {
      await waitUntilInstanceRunning(
        {
          client: this.ec2,
          maxWaitTime: timeoutSeconds,
          minDelay: 5,
          maxDelay: 15
        },
        { InstanceIds: [instanceId] }
      );

      // Get final instance info
      const info = await this.getInstanceStatus(instanceId);

      console.log(`[AWSService] Instance ${instanceId} is now running`);
      this.emit('instanceRunning', info);

      return info;
    } catch (error) {
      console.error(`[AWSService] Timeout waiting for instance ${instanceId} to be running:`, error.message);
      throw new Error(`Instance ${instanceId} did not reach running state within ${timeoutSeconds} seconds`);
    }
  }

  /**
   * Wait for instance to reach stopped state
   * @param {string} instanceId - Instance ID to wait for
   * @param {number} timeoutSeconds - Maximum wait time in seconds
   * @returns {Promise<Object>} Instance info when stopped
   */
  async waitForInstanceStopped(instanceId, timeoutSeconds = 300) {
    console.log(`[AWSService] Waiting for instance ${instanceId} to be stopped (timeout: ${timeoutSeconds}s)`);

    try {
      await waitUntilInstanceStopped(
        {
          client: this.ec2,
          maxWaitTime: timeoutSeconds,
          minDelay: 5,
          maxDelay: 15
        },
        { InstanceIds: [instanceId] }
      );

      // Get final instance info
      const info = await this.getInstanceStatus(instanceId);

      console.log(`[AWSService] Instance ${instanceId} is now stopped`);
      this.emit('instanceStopped', info);

      return info;
    } catch (error) {
      console.error(`[AWSService] Timeout waiting for instance ${instanceId} to be stopped:`, error.message);
      throw new Error(`Instance ${instanceId} did not reach stopped state within ${timeoutSeconds} seconds`);
    }
  }

  /**
   * Check if services are ready on an instance
   * @param {string} publicIp - Instance public IP
   * @param {number} port - Service port (default 3003)
   * @param {number} timeoutMs - Request timeout in milliseconds
   * @returns {Promise<Object>} Service status
   */
  async checkInstanceServices(publicIp, port = 3003, timeoutMs = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`http://${publicIp}:${port}/api/status`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          nodeServer: true,
          obsConnected: data.obsConnected || false,
          healthy: true
        };
      }

      return { nodeServer: false, obsConnected: false, healthy: false };
    } catch (error) {
      return {
        nodeServer: false,
        obsConnected: false,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Wait for services to be ready on an instance
   * @param {string} publicIp - Instance public IP
   * @param {Object} options - Wait options
   * @param {number} options.port - Service port
   * @param {number} options.timeoutSeconds - Maximum wait time
   * @param {number} options.intervalMs - Check interval
   * @returns {Promise<boolean>} True if services ready, false if timeout
   */
  async waitForServicesReady(publicIp, options = {}) {
    const {
      port = 3003,
      timeoutSeconds = 120,
      intervalMs = 5000
    } = options;

    console.log(`[AWSService] Waiting for services at ${publicIp}:${port} (timeout: ${timeoutSeconds}s)`);

    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkInstanceServices(publicIp, port);

      if (status.healthy) {
        console.log(`[AWSService] Services ready at ${publicIp}:${port}`);
        this.emit('servicesReady', { publicIp, port, status });
        return true;
      }

      await sleep(intervalMs);
    }

    console.warn(`[AWSService] Services at ${publicIp}:${port} did not become ready within ${timeoutSeconds}s`);
    return false;
  }

  /**
   * Format raw EC2 instance data into a consistent info object
   * @param {Object} instance - Raw EC2 instance object
   * @returns {Object} Formatted instance info
   */
  _formatInstanceInfo(instance) {
    // Extract name tag
    const nameTag = instance.Tags?.find(t => t.Key === 'Name');

    return {
      instanceId: instance.InstanceId,
      name: nameTag?.Value || instance.InstanceId,
      state: instance.State?.Name || 'unknown',
      stateCode: instance.State?.Code,
      publicIp: instance.PublicIpAddress || null,
      privateIp: instance.PrivateIpAddress || null,
      publicDns: instance.PublicDnsName || null,
      privateDns: instance.PrivateDnsName || null,
      instanceType: instance.InstanceType,
      launchTime: instance.LaunchTime,
      availabilityZone: instance.Placement?.AvailabilityZone,
      subnetId: instance.SubnetId,
      vpcId: instance.VpcId,
      tags: instance.Tags?.reduce((acc, t) => {
        acc[t.Key] = t.Value;
        return acc;
      }, {}) || {}
    };
  }

  /**
   * Get current AWS configuration
   * @returns {Object} Current config
   */
  getConfig() {
    return { ...this.config };
  }
}

// Singleton instance
let awsServiceInstance = null;

/**
 * Get or create the AWS service singleton
 * @param {Object} config - Optional configuration override
 * @returns {AWSService} The AWS service instance
 */
export function getAWSService(config = {}) {
  if (!awsServiceInstance) {
    awsServiceInstance = new AWSService(config);
  }
  return awsServiceInstance;
}

// Export class for testing
export { AWSService };

// Default export is the singleton getter
export default getAWSService;
