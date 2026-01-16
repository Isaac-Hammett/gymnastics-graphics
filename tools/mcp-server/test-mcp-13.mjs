/**
 * Test MCP-13: Test error handling for invalid AWS instance ID
 *
 * This test verifies that aws_start_instance properly handles
 * invalid instance IDs and returns a descriptive error.
 */

import {
  EC2Client,
  StartInstancesCommand,
} from '@aws-sdk/client-ec2';

// Configuration (same as MCP server)
const CONFIG = {
  awsRegion: 'us-east-1',
};

// Initialize AWS EC2 client
const ec2 = new EC2Client({ region: CONFIG.awsRegion });

// Replicate startInstance from MCP server
async function startInstance(instanceId) {
  const command = new StartInstancesCommand({
    InstanceIds: [instanceId]
  });

  const response = await ec2.send(command);
  const stateChange = response.StartingInstances?.[0];

  return {
    instanceId,
    previousState: stateChange?.PreviousState?.Name,
    currentState: stateChange?.CurrentState?.Name,
    message: `Instance ${instanceId} is starting. It will take 1-2 minutes to be fully available.`
  };
}

// Wrapper that handles errors like the MCP server does
async function awsStartInstance(instanceId) {
  try {
    return await startInstance(instanceId);
  } catch (error) {
    return {
      error: error.message,
      tool: 'aws_start_instance',
      args: { instanceId }
    };
  }
}

async function runTest() {
  console.log('=== MCP-13 Test: Error handling for invalid AWS instance ID ===\n');

  const results = {
    hasError: false,
    errorMentionsInvalid: false,
    noUnhandledException: true
  };

  const invalidInstanceId = 'i-invalid123456789';

  // Step 1: Call aws_start_instance with invalid instanceId
  console.log(`Step 1: Calling aws_start_instance with instanceId='${invalidInstanceId}'...`);
  console.log('        (This should return an error from AWS)\n');

  let response;
  try {
    response = await awsStartInstance(invalidInstanceId);
    console.log('Response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    // If we reach here, the error wasn't handled properly
    console.error('\n=== CRITICAL: Unhandled exception ===');
    console.error(error.message);
    results.noUnhandledException = false;
  }

  if (results.noUnhandledException && response) {
    // Step 2: Verify response contains error
    console.log('\nStep 2: Verifying response contains error...');
    results.hasError = 'error' in response && response.error !== '';
    console.log(`        Has error field: ${results.hasError ? 'PASS' : 'FAIL'}`);

    if (results.hasError) {
      console.log(`        Error message: "${response.error}"`);
    }

    // Step 3: Verify error message mentions invalid instance
    console.log('\nStep 3: Verifying error message mentions invalid instance...');
    if (results.hasError) {
      // AWS typically returns errors like:
      // - "InvalidInstanceID.NotFound"
      // - "InvalidInstanceID.Malformed"
      // - "The instance ID 'i-invalid123456789' does not exist"
      const invalidTerms = [
        'invalid',
        'not found',
        'notfound',
        'does not exist',
        'malformed',
        'InvalidInstanceID',
        'i-invalid123456789'
      ];

      results.errorMentionsInvalid = invalidTerms.some(term =>
        response.error.toLowerCase().includes(term.toLowerCase())
      );
      console.log(`        Error mentions invalid instance: ${results.errorMentionsInvalid ? 'PASS' : 'FAIL'}`);

      if (!results.errorMentionsInvalid) {
        console.log(`        (Looking for: ${invalidTerms.join(', ')})`);
      }
    }
  }

  // Final result
  console.log('\n=== Verification Results ===');
  console.log(`- No unhandled exception: ${results.noUnhandledException ? 'PASS' : 'FAIL'}`);
  console.log(`- Response contains error: ${results.hasError ? 'PASS' : 'FAIL'}`);
  console.log(`- Error message mentions invalid instance: ${results.errorMentionsInvalid ? 'PASS' : 'FAIL'}`);

  const passed = results.noUnhandledException && results.hasError && results.errorMentionsInvalid;
  console.log(`\n=== MCP-13: ${passed ? 'PASSED' : 'FAILED'} ===`);
  console.log('Verification: Invalid instance ID returns AWS error gracefully');

  return passed;
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(error => {
  // If we reach here, the test itself crashed
  console.error('\n=== CRITICAL FAILURE ===');
  console.error('Test crashed:');
  console.error(error.message);
  process.exit(1);
});
