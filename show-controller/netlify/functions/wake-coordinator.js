/**
 * Netlify Serverless Function: Wake Coordinator
 *
 * Starts the coordinator EC2 instance when the system is sleeping.
 * Called from the frontend when a user wants to wake up the system.
 *
 * Required Environment Variables (set in Netlify):
 * - COORDINATOR_AWS_ACCESS_KEY_ID: IAM user access key
 * - COORDINATOR_AWS_SECRET_ACCESS_KEY: IAM user secret key
 * - COORDINATOR_AWS_REGION: AWS region (default: us-east-1)
 * - COORDINATOR_INSTANCE_ID: EC2 instance ID to start
 *
 * @module wake-coordinator
 */

import { EC2Client, StartInstancesCommand, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

// CORS headers for frontend access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

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
 * Check current instance state
 * @param {EC2Client} ec2 - EC2 client
 * @param {string} instanceId - Instance ID to check
 * @returns {Promise<Object>} Instance state info
 */
async function getInstanceState(ec2, instanceId) {
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
      publicIp: instance.PublicIpAddress || null
    };
  } catch (error) {
    console.error('[wake-coordinator] Failed to describe instance:', error.message);
    return { state: 'error', error: error.message };
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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed',
        message: 'Use POST request to wake coordinator'
      })
    };
  }

  // Check required environment variables
  const instanceId = process.env.COORDINATOR_INSTANCE_ID;

  if (!instanceId) {
    console.error('[wake-coordinator] COORDINATOR_INSTANCE_ID not configured');
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
    console.error('[wake-coordinator] AWS credentials not configured');
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

    // Check current state first
    const currentState = await getInstanceState(ec2, instanceId);
    console.log(`[wake-coordinator] Current state: ${currentState.state}`);

    // Handle already running state
    if (currentState.state === 'running') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Coordinator is already running',
          state: 'running',
          publicIp: currentState.publicIp,
          estimatedReadySeconds: 0
        })
      };
    }

    // Handle pending state (already starting)
    if (currentState.state === 'pending') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Coordinator is already starting',
          state: 'pending',
          estimatedReadySeconds: 45
        })
      };
    }

    // Handle stopping state (wait for it to finish)
    if (currentState.state === 'stopping') {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Coordinator is currently stopping. Please wait and try again.',
          state: 'stopping',
          retryAfterSeconds: 30
        })
      };
    }

    // Handle terminated state
    if (currentState.state === 'terminated') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Instance terminated',
          message: 'Coordinator instance has been terminated. Contact administrator.'
        })
      };
    }

    // Start the instance (should be 'stopped' state)
    console.log(`[wake-coordinator] Starting instance ${instanceId}`);

    const startCommand = new StartInstancesCommand({
      InstanceIds: [instanceId]
    });

    const startResponse = await ec2.send(startCommand);

    const startingInstance = startResponse.StartingInstances?.[0];
    const previousState = startingInstance?.PreviousState?.Name;
    const newState = startingInstance?.CurrentState?.Name;

    console.log(`[wake-coordinator] Instance starting: ${previousState} -> ${newState}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Coordinator is starting up',
        state: newState || 'pending',
        previousState: previousState,
        instanceId: instanceId,
        estimatedReadySeconds: 60,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[wake-coordinator] Error:', error.message);

    // Handle specific AWS errors
    if (error.name === 'UnauthorizedOperation' || error.Code === 'UnauthorizedOperation') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Authorization failed',
          message: 'IAM user does not have permission to start the coordinator'
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
