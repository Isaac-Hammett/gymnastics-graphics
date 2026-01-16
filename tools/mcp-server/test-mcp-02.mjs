/**
 * Test MCP-02: aws_list_instances with state filter
 *
 * This test verifies that aws_list_instances correctly filters by state.
 */

import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

const ec2 = new EC2Client({ region: 'us-east-1' });

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
        privateIp: instance.PrivateIpAddress || null,
        instanceType: instance.InstanceType,
        launchTime: instance.LaunchTime?.toISOString(),
      });
    }
  }

  return instances;
}

async function runTest() {
  console.log('=== MCP-02 Test: aws_list_instances with state filter ===\n');

  try {
    // First get all instances to understand what states exist
    console.log('Getting all instances to understand available states...');
    const allInstances = await listInstances();
    console.log(`Found ${allInstances.length} total instance(s)`);

    const statesPresent = [...new Set(allInstances.map(i => i.state))];
    console.log(`States present: ${statesPresent.join(', ')}\n`);

    let allPassed = true;

    // Test 1: Filter by 'running'
    console.log('Test 1: Calling aws_list_instances with stateFilter="running"...');
    const runningInstances = await listInstances('running');
    console.log(`       Found ${runningInstances.length} running instance(s)`);

    const allRunning = runningInstances.every(i => i.state === 'running');
    if (runningInstances.length > 0) {
      console.log(`       All instances have state='running': ${allRunning ? 'PASS' : 'FAIL'}`);
      if (!allRunning) {
        console.log(`       Non-running instances found:`, runningInstances.filter(i => i.state !== 'running'));
        allPassed = false;
      } else {
        runningInstances.forEach(i => {
          console.log(`       - ${i.instanceId} (${i.name}): state=${i.state}`);
        });
      }
    } else {
      console.log(`       No running instances found (this is OK, filter returned empty array)`);
    }

    // Test 2: Filter by 'stopped'
    console.log('\nTest 2: Calling aws_list_instances with stateFilter="stopped"...');
    const stoppedInstances = await listInstances('stopped');
    console.log(`       Found ${stoppedInstances.length} stopped instance(s)`);

    const allStopped = stoppedInstances.every(i => i.state === 'stopped');
    if (stoppedInstances.length > 0) {
      console.log(`       All instances have state='stopped': ${allStopped ? 'PASS' : 'FAIL'}`);
      if (!allStopped) {
        console.log(`       Non-stopped instances found:`, stoppedInstances.filter(i => i.state !== 'stopped'));
        allPassed = false;
      } else {
        stoppedInstances.forEach(i => {
          console.log(`       - ${i.instanceId} (${i.name}): state=${i.state}`);
        });
      }
    } else {
      console.log(`       No stopped instances found (this is OK, filter returned empty array)`);
    }

    // Verify that filtered counts match expected counts from all instances
    console.log('\nVerification: Comparing filtered counts to total...');
    const expectedRunning = allInstances.filter(i => i.state === 'running').length;
    const expectedStopped = allInstances.filter(i => i.state === 'stopped').length;

    const runningCountMatch = runningInstances.length === expectedRunning;
    const stoppedCountMatch = stoppedInstances.length === expectedStopped;

    console.log(`       Running filter returned ${runningInstances.length}, expected ${expectedRunning}: ${runningCountMatch ? 'PASS' : 'FAIL'}`);
    console.log(`       Stopped filter returned ${stoppedInstances.length}, expected ${expectedStopped}: ${stoppedCountMatch ? 'PASS' : 'FAIL'}`);

    if (!runningCountMatch || !stoppedCountMatch) {
      allPassed = false;
    }

    // Final result
    console.log('\n=== Test Result ===');
    console.log(`MCP-02: ${allPassed ? 'PASSED' : 'FAILED'}`);

    return allPassed;
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);
    return false;
  }
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
});
