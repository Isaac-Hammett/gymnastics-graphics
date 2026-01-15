/**
 * Netlify Serverless Function: Stop Coordinator
 *
 * Stops the coordinator EC2 instance to save costs.
 * Called from the frontend when a user wants to shut down the system.
 *
 * Required Environment Variables (set in Netlify):
 * - COORDINATOR_AWS_ACCESS_KEY_ID: IAM user access key
 * - COORDINATOR_AWS_SECRET_ACCESS_KEY: IAM user secret key
 * - COORDINATOR_AWS_REGION: AWS region (default: us-east-1)
 * - COORDINATOR_INSTANCE_ID: EC2 instance ID to stop
 *
 * @module stop-coordinator
 */

import { EC2Client, StopInstancesCommand, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

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
    console.error('[stop-coordinator] Failed to describe instance:', error.message);
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
        message: 'Use POST request to stop coordinator'
      })
    };
  }

  // Check required environment variables
  const instanceId = process.env.COORDINATOR_INSTANCE_ID;

  if (!instanceId) {
    console.error('[stop-coordinator] COORDINATOR_INSTANCE_ID not configured');
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
    console.error('[stop-coordinator] AWS credentials not configured');
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
    console.log(`[stop-coordinator] Current state: ${currentState.state}`);

    // Handle already stopped state
    if (currentState.state === 'stopped') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Coordinator is already stopped',
          state: 'stopped'
        })
      };
    }

    // Handle stopping state (already in progress)
    if (currentState.state === 'stopping') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Coordinator is already stopping',
          state: 'stopping'
        })
      };
    }

    // Handle pending state (still starting up)
    if (currentState.state === 'pending') {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Coordinator is still starting up. Please wait for it to finish before stopping.',
          state: 'pending',
          retryAfterSeconds: 60
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

    // Stop the instance (should be 'running' state)
    console.log(`[stop-coordinator] Stopping instance ${instanceId}`);

    const stopCommand = new StopInstancesCommand({
      InstanceIds: [instanceId]
    });

    const stopResponse = await ec2.send(stopCommand);

    const stoppingInstance = stopResponse.StoppingInstances?.[0];
    const previousState = stoppingInstance?.PreviousState?.Name;
    const newState = stoppingInstance?.CurrentState?.Name;

    console.log(`[stop-coordinator] Instance stopping: ${previousState} -> ${newState}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Coordinator is shutting down',
        state: newState || 'stopping',
        previousState: previousState,
        instanceId: instanceId,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[stop-coordinator] Error:', error.message);

    // Handle specific AWS errors
    if (error.name === 'UnauthorizedOperation' || error.Code === 'UnauthorizedOperation') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Authorization failed',
          message: 'IAM user does not have permission to stop the coordinator'
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
