/**
 * Test MCP-15: aws_start_instance and aws_stop_instance lifecycle
 *
 * DESTRUCTIVE: Only run on test instances. Incurs AWS charges.
 *
 * This test verifies the full VM lifecycle (start/stop) works correctly.
 * If no stopped instance is found, the test is skipped (marked as passed).
 */

import { EC2Client, DescribeInstancesCommand, StartInstancesCommand, StopInstancesCommand } from '@aws-sdk/client-ec2';

const ec2 = new EC2Client({ region: 'us-east-1' });

// How long to wait for instance state transitions (in ms)
const STATE_POLL_INTERVAL = 5000;
const MAX_STATE_WAIT = 120000; // 2 minutes max

async function listInstances(stateFilter) {
  const command = new DescribeInstancesCommand({
    Filters: [
      {
        Name: 'tag:Project',
        Values: ['gymnastics-graphics']
      },
      ...(stateFilter ? [{
        Name: 'instance-state-name',
        Values: [stateFilter]
      }] : [])
    ]
  });

  const response = await ec2.send(command);

  const instances = [];
  for (const reservation of response.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      const nameTag = instance.Tags?.find(t => t.Key === 'Name');
      instances.push({
        instanceId: instance.InstanceId,
        name: nameTag?.Value || 'unnamed',
        state: instance.State?.Name,
        publicIp: instance.PublicIpAddress || null,
        instanceType: instance.InstanceType,
      });
    }
  }

  return instances;
}

async function getInstanceState(instanceId) {
  const command = new DescribeInstancesCommand({
    InstanceIds: [instanceId]
  });

  const response = await ec2.send(command);
  const instance = response.Reservations?.[0]?.Instances?.[0];
  return instance?.State?.Name || 'unknown';
}

async function startInstance(instanceId) {
  const command = new StartInstancesCommand({
    InstanceIds: [instanceId]
  });

  const response = await ec2.send(command);
  const stateChange = response.StartingInstances?.[0];

  return {
    instanceId: stateChange?.InstanceId,
    previousState: stateChange?.PreviousState?.Name,
    currentState: stateChange?.CurrentState?.Name
  };
}

async function stopInstance(instanceId) {
  const command = new StopInstancesCommand({
    InstanceIds: [instanceId]
  });

  const response = await ec2.send(command);
  const stateChange = response.StoppingInstances?.[0];

  return {
    instanceId: stateChange?.InstanceId,
    previousState: stateChange?.PreviousState?.Name,
    currentState: stateChange?.CurrentState?.Name
  };
}

async function waitForState(instanceId, targetState, maxWait = MAX_STATE_WAIT) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const currentState = await getInstanceState(instanceId);
    console.log(`       Current state: ${currentState}`);

    if (currentState === targetState) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, STATE_POLL_INTERVAL));
  }

  return false;
}

async function runTest() {
  console.log('=== MCP-15 Test: aws_start_instance and aws_stop_instance lifecycle ===\n');
  console.log('NOTE: This test is DESTRUCTIVE and incurs AWS charges.\n');

  try {
    // Step 1: Find a stopped instance
    console.log('Step 1: Looking for a stopped instance...');
    const stoppedInstances = await listInstances('stopped');

    if (stoppedInstances.length === 0) {
      console.log('       No stopped instances found.');
      console.log('       According to task spec: "If no stopped instance, skip this test (mark as passed)"');
      console.log('\n=== Test Result ===');
      console.log('MCP-15: SKIPPED (no stopped instances available) - marking as PASSED per task spec');
      return true;
    }

    // Select first stopped instance (prefer template instances for safety)
    const templateInstance = stoppedInstances.find(i => i.name.includes('template'));
    const testInstance = templateInstance || stoppedInstances[0];

    console.log(`       Found ${stoppedInstances.length} stopped instance(s)`);
    console.log(`       Selected for test: ${testInstance.instanceId} (${testInstance.name})`);

    // Step 2: Start the instance
    console.log('\nStep 2: Starting instance...');
    const startResult = await startInstance(testInstance.instanceId);
    console.log(`       Response: ${JSON.stringify(startResult, null, 2)}`);

    // Verify start response structure
    const hasInstanceId = !!startResult.instanceId;
    const hasPreviousState = !!startResult.previousState;
    const hasCurrentState = !!startResult.currentState;

    console.log(`\n       Verifying response structure:`);
    console.log(`       - Has instanceId: ${hasInstanceId ? 'PASS' : 'FAIL'}`);
    console.log(`       - Has previousState: ${hasPreviousState ? 'PASS' : 'FAIL'}`);
    console.log(`       - Has currentState: ${hasCurrentState ? 'PASS' : 'FAIL'}`);

    if (!hasInstanceId || !hasPreviousState || !hasCurrentState) {
      console.log('\n=== Test Result ===');
      console.log('MCP-15: FAILED - Start response missing required fields');
      return false;
    }

    // Step 3: Wait for running state
    console.log('\nStep 3: Waiting for instance to reach "running" state...');
    const reachedRunning = await waitForState(testInstance.instanceId, 'running');

    if (!reachedRunning) {
      console.log('       WARNING: Instance did not reach running state within timeout');
      // Continue anyway to try to stop it
    } else {
      console.log('       Instance reached "running" state: PASS');
    }

    // Step 4: Stop the instance
    console.log('\nStep 4: Stopping instance...');
    const stopResult = await stopInstance(testInstance.instanceId);
    console.log(`       Response: ${JSON.stringify(stopResult, null, 2)}`);

    // Verify stop response structure
    const stopHasInstanceId = !!stopResult.instanceId;
    const stopHasPreviousState = !!stopResult.previousState;
    const stopHasCurrentState = !!stopResult.currentState;
    const indicatesStopping = stopResult.currentState === 'stopping' || stopResult.currentState === 'stopped';

    console.log(`\n       Verifying response structure:`);
    console.log(`       - Has instanceId: ${stopHasInstanceId ? 'PASS' : 'FAIL'}`);
    console.log(`       - Has previousState: ${stopHasPreviousState ? 'PASS' : 'FAIL'}`);
    console.log(`       - Has currentState: ${stopHasCurrentState ? 'PASS' : 'FAIL'}`);
    console.log(`       - Indicates stopping: ${indicatesStopping ? 'PASS' : 'FAIL'}`);

    // Final verification
    const allPassed = hasInstanceId && hasPreviousState && hasCurrentState &&
                      stopHasInstanceId && stopHasPreviousState && stopHasCurrentState &&
                      indicatesStopping && reachedRunning;

    console.log('\n=== Test Result ===');
    console.log(`MCP-15: ${allPassed ? 'PASSED' : 'FAILED'} - Instance lifecycle (start/stop) ${allPassed ? 'works correctly' : 'had issues'}`);

    return allPassed;
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);
    console.error(error.stack);
    return false;
  }
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
});
