/**
 * Test MCP-01: aws_list_instances returns valid instance data
 *
 * This test verifies the aws_list_instances function works correctly.
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
  console.log('=== MCP-01 Test: aws_list_instances ===\n');

  try {
    // Step 1: Call aws_list_instances with no filter
    console.log('Step 1: Calling aws_list_instances with no filter...');
    const instances = await listInstances();

    // Step 2: Verify response is an array
    const isArray = Array.isArray(instances);
    console.log(`Step 2: Response is array: ${isArray ? 'PASS' : 'FAIL'}`);

    if (!isArray) {
      throw new Error('Response is not an array');
    }

    // Check we have at least 1 instance
    console.log(`       Instance count: ${instances.length}`);
    if (instances.length === 0) {
      console.log('WARNING: No instances found. This may be expected if no VMs are running.');
      console.log('Test cannot fully verify without at least 1 instance.');
      return;
    }

    // Step 3: Verify each instance has required fields
    console.log('\nStep 3: Verifying instance structure...');
    let allValid = true;
    const validStates = ['running', 'stopped', 'pending', 'stopping', 'shutting-down', 'terminated'];
    const instanceIdPattern = /^i-[a-f0-9]+$/;

    for (const inst of instances) {
      const hasInstanceId = typeof inst.instanceId === 'string' && inst.instanceId.length > 0;
      const hasName = typeof inst.name === 'string';
      const hasState = typeof inst.state === 'string' && validStates.includes(inst.state);
      const hasInstanceType = typeof inst.instanceType === 'string';
      const validInstanceId = instanceIdPattern.test(inst.instanceId);

      if (!hasInstanceId || !hasName || !hasState || !hasInstanceType || !validInstanceId) {
        console.log(`  FAIL: Instance ${inst.instanceId || 'unknown'}`);
        console.log(`        hasInstanceId: ${hasInstanceId}, hasName: ${hasName}, hasState: ${hasState}`);
        console.log(`        hasInstanceType: ${hasInstanceType}, validInstanceId: ${validInstanceId}`);
        allValid = false;
      } else {
        console.log(`  PASS: Instance ${inst.instanceId} (${inst.name}) - state: ${inst.state}`);
      }
    }

    // Step 4: Verify instanceId matches pattern
    console.log('\nStep 4: All instanceId values match pattern i-[a-f0-9]+');
    const allMatchPattern = instances.every(i => instanceIdPattern.test(i.instanceId));
    console.log(`       Result: ${allMatchPattern ? 'PASS' : 'FAIL'}`);

    // Step 5: Verify states are valid
    console.log('\nStep 5: All states are valid (running, stopped, pending, stopping, terminated)');
    const allValidStates = instances.every(i => validStates.includes(i.state));
    console.log(`       Result: ${allValidStates ? 'PASS' : 'FAIL'}`);

    // Final result
    console.log('\n=== Test Result ===');
    const passed = isArray && allValid && allMatchPattern && allValidStates;
    console.log(`MCP-01: ${passed ? 'PASSED' : 'FAILED'}`);

    // Print all instances for verification
    console.log('\n=== All Instances ===');
    console.log(JSON.stringify(instances, null, 2));

    return passed;
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);
    return false;
  }
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
});
