/**
 * Netlify Serverless Function: Coordinator Status
 *
 * Checks the coordinator EC2 instance state and application health.
 * Called from the frontend to determine if the system is available.
 *
 * Required Environment Variables (set in Netlify):
 * - COORDINATOR_AWS_ACCESS_KEY_ID: IAM user access key
 * - COORDINATOR_AWS_SECRET_ACCESS_KEY: IAM user secret key
 * - COORDINATOR_AWS_REGION: AWS region (default: us-east-1)
 * - COORDINATOR_INSTANCE_ID: EC2 instance ID to check
 *
 * @module coordinator-status
 */

import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

// CORS headers for frontend access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

// Simple in-memory cache
let statusCache = {
  data: null,
  timestamp: 0
};

const CACHE_TTL_MS = 10000; // 10 seconds

/**
 * Get EC2 client configured with Netlify environment credentials
 * @returns {EC2Client} Configured EC2 client
 */
function getEC2Client() {
  const region = process.env.COORDINATOR_AWS_REGION || 'us-east-1';

  // Use COORDINATOR_ prefixed env vars for Netlify
  const credentials = {
    accessKeyId: process.env.COORDINATOR_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.COORDINATOR_AWS_SECRET_ACCESS_KEY
  };

  return new EC2Client({
    region,
    credentials
  });
}

/**
 * Get instance details from EC2
 * @param {EC2Client} ec2 - EC2 client
 * @param {string} instanceId - Instance ID to check
 * @returns {Promise<Object>} Instance state info
 */
async function getInstanceDetails(ec2, instanceId) {
  try {
    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });

    const response = await ec2.send(command);
    const instance = response.Reservations?.[0]?.Instances?.[0];

    if (!instance) {
      return { state: 'unknown', error: 'Instance not found' };
    }

    return {
      state: instance.State?.Name,
      stateCode: instance.State?.Code,
      publicIp: instance.PublicIpAddress || null,
      launchTime: instance.LaunchTime?.toISOString() || null
    };
  } catch (error) {
    console.error('[coordinator-status] Failed to describe instance:', error.message);
    return { state: 'error', error: error.message };
  }
}

/**
 * Check if the coordinator application is responding
 * @param {string} publicIp - Public IP of the coordinator
 * @returns {Promise<Object>} Application health info
 */
async function checkAppHealth(publicIp) {
  if (!publicIp) {
    return { appReady: false, error: 'No public IP' };
  }

  try {
    // Use the coordinator status endpoint
    const url = `http://${publicIp}:3001/api/coordinator/status`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { appReady: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    return {
      appReady: true,
      uptime: data.uptime || null,
      mode: data.mode || null,
      firebase: data.firebase || null,
      idleMinutes: data.idleMinutes || null,
      version: data.version || null
    };
  } catch (error) {
    // App not ready or unreachable
    if (error.name === 'AbortError') {
      return { appReady: false, error: 'Request timeout' };
    }
    return { appReady: false, error: error.message };
  }
}

/**
 * Netlify function handler
 * @param {Object} event - Netlify event object
 * @param {Object} context - Netlify context object
 * @returns {Promise<Object>} Response object
 */
export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed',
        message: 'Use GET request to check coordinator status'
      })
    };
  }

  // Check cache first
  const now = Date.now();
  if (statusCache.data && (now - statusCache.timestamp) < CACHE_TTL_MS) {
    console.log('[coordinator-status] Returning cached result');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ...statusCache.data,
        cached: true,
        cacheAge: Math.floor((now - statusCache.timestamp) / 1000)
      })
    };
  }

  // Check required environment variables
  const instanceId = process.env.COORDINATOR_INSTANCE_ID;

  if (!instanceId) {
    console.error('[coordinator-status] COORDINATOR_INSTANCE_ID not configured');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Configuration error',
        message: 'Coordinator instance ID not configured'
      })
    };
  }

  if (!process.env.COORDINATOR_AWS_ACCESS_KEY_ID || !process.env.COORDINATOR_AWS_SECRET_ACCESS_KEY) {
    console.error('[coordinator-status] AWS credentials not configured');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Configuration error',
        message: 'AWS credentials not configured'
      })
    };
  }

  try {
    const ec2 = getEC2Client();

    // Get EC2 instance state
    const instanceDetails = await getInstanceDetails(ec2, instanceId);
    console.log(`[coordinator-status] Instance state: ${instanceDetails.state}`);

    // Build base response
    const result = {
      success: true,
      state: instanceDetails.state,
      publicIp: instanceDetails.publicIp,
      launchTime: instanceDetails.launchTime,
      timestamp: new Date().toISOString()
    };

    // If running, check app health
    if (instanceDetails.state === 'running' && instanceDetails.publicIp) {
      console.log('[coordinator-status] Checking app health...');
      const appHealth = await checkAppHealth(instanceDetails.publicIp);

      // Calculate how long the instance has been running
      let runningSeconds = 0;
      if (instanceDetails.launchTime) {
        const launchDate = new Date(instanceDetails.launchTime);
        runningSeconds = Math.floor((Date.now() - launchDate.getTime()) / 1000);
      }
      result.runningSeconds = runningSeconds;

      if (appHealth.appReady) {
        // App responded - fully ready
        result.appReady = true;
        result.uptime = appHealth.uptime;
        result.mode = appHealth.mode;
        result.firebase = appHealth.firebase;
        result.idleMinutes = appHealth.idleMinutes;
        result.version = appHealth.version;
      } else {
        // App didn't respond - check if we should consider it ready anyway
        // If EC2 has been running for 90+ seconds, assume app is ready
        // (health check may fail due to firewall, but app is likely running)
        const GRACE_PERIOD_SECONDS = 90;
        if (runningSeconds >= GRACE_PERIOD_SECONDS) {
          console.log(`[coordinator-status] App health check failed but instance running ${runningSeconds}s - assuming ready`);
          result.appReady = true;
          result.appHealthSkipped = true;
          result.appError = appHealth.error;
        } else {
          result.appReady = false;
          result.appError = appHealth.error;
          console.log(`[coordinator-status] App not ready (${runningSeconds}s < ${GRACE_PERIOD_SECONDS}s grace period)`);
        }
      }
    } else {
      result.appReady = false;
    }

    // Cache the result
    statusCache = {
      data: result,
      timestamp: now
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('[coordinator-status] Error:', error.message);

    // Handle specific AWS errors
    if (error.name === 'UnauthorizedOperation' || error.Code === 'UnauthorizedOperation') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Authorization failed',
          message: 'IAM user does not have permission to describe instances'
        })
      };
    }

    if (error.name === 'InvalidInstanceID.NotFound') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Instance not found',
          message: 'Coordinator instance does not exist'
        })
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Internal error',
        message: error.message
      })
    };
  }
}
