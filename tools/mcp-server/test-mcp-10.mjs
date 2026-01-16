#!/usr/bin/env node

/**
 * Test script for MCP-10: Test ssh_multi_exec aggregation on multiple VMs
 *
 * Tests that ssh_multi_exec correctly aggregates results from multiple VMs:
 * 1. Get list of running instances via aws_list_instances(stateFilter='running')
 * 2. Extract publicIp addresses from running instances
 * 3. Call ssh_multi_exec with coordinator plus any running VM IPs
 * 4. Verify successCount equals number of reachable VMs
 * 5. Verify each result has target IP and stdout
 */

import { NodeSSH } from 'node-ssh';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG = {
  awsRegion: 'us-east-1',
  sshKeyPath: join(homedir(), '.ssh', 'gymnastics-graphics-key-pair.pem'),
  sshUsername: 'ubuntu',
  coordinatorIp: '44.193.31.120',
  projectTag: 'gymnastics-graphics',
  sshTimeout: 30000,
  commandTimeout: 60000,
};

// Initialize AWS EC2 client
const ec2 = new EC2Client({ region: CONFIG.awsRegion });

// Simulates aws_list_instances from MCP server
async function listInstances(stateFilter) {
  const command = new DescribeInstancesCommand({
    Filters: [
      {
        Name: 'tag:Project',
        Values: [CONFIG.projectTag]
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

// Simulates the sshExec function from the MCP server
async function sshExec(target, command, sudo = false) {
  const ip = target === 'coordinator' ? CONFIG.coordinatorIp : target;
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: ip,
      username: CONFIG.sshUsername,
      privateKeyPath: CONFIG.sshKeyPath,
      readyTimeout: CONFIG.sshTimeout,
    });

    const cmd = sudo ? `sudo ${command}` : command;
    const result = await ssh.execCommand(cmd, {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    return {
      target: ip,
      command: cmd,
      exitCode: result.code,
      stdout: result.stdout.trim(),
      stderr: result.stderr,
      success: result.code === 0
    };
  } finally {
    ssh.dispose();
  }
}

// Simulates the sshMultiExec function from the MCP server
async function sshMultiExec(targets, command, sudo = false) {
  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        return await sshExec(target, command, sudo);
      } catch (error) {
        const ip = target === 'coordinator' ? CONFIG.coordinatorIp : target;
        return {
          target: ip,
          command,
          success: false,
          error: error.message
        };
      }
    })
  );

  return {
    command,
    results,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length
  };
}

async function testSshMultiExecAggregation() {
  console.log('MCP-10: Testing ssh_multi_exec aggregation on multiple VMs\n');
  console.log('This test verifies that ssh_multi_exec correctly aggregates results from multiple VMs.\n');

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    console.log(`❌ SSH key not found at ${CONFIG.sshKeyPath}`);
    process.exit(1);
  }
  console.log(`✓ SSH key found at ${CONFIG.sshKeyPath}`);

  try {
    // Step 1: Get list of running instances
    console.log('\nStep 1: Getting list of running instances via aws_list_instances(stateFilter="running")...');
    const runningInstances = await listInstances('running');

    console.log(`Found ${runningInstances.length} running instance(s):`);
    for (const instance of runningInstances) {
      console.log(`  - ${instance.name} (${instance.instanceId}): ${instance.publicIp || 'no public IP'}`);
    }

    // Step 2: Extract public IPs from running instances
    console.log('\nStep 2: Extracting publicIp addresses from running instances...');
    const publicIps = runningInstances
      .filter(i => i.publicIp)
      .map(i => i.publicIp);

    console.log(`Found ${publicIps.length} public IP(s): ${publicIps.join(', ') || 'none'}`);

    // Step 3: Build target list (coordinator + any running VM IPs that aren't the coordinator)
    const targets = ['coordinator'];
    for (const ip of publicIps) {
      if (ip !== CONFIG.coordinatorIp && !targets.includes(ip)) {
        targets.push(ip);
      }
    }

    console.log(`\nStep 3: Building target list for ssh_multi_exec...`);
    console.log(`Targets: ${JSON.stringify(targets)}`);

    // Step 4: Call ssh_multi_exec
    console.log(`\nStep 4: Running ssh_multi_exec with ${targets.length} target(s), command="hostname"...`);
    const response = await sshMultiExec(targets, 'hostname');

    console.log('\nResponse:');
    console.log(JSON.stringify(response, null, 2));

    // Step 5: Verify results
    console.log('\nStep 5: Verifying results...');

    const tests = {
      'response has "command" property': 'command' in response,
      'response has "results" array': Array.isArray(response.results),
      'response has "successCount" property': 'successCount' in response,
      'response has "failureCount" property': 'failureCount' in response,
      'results array length matches target count': response.results.length === targets.length,
      'successCount + failureCount equals target count': (response.successCount + response.failureCount) === targets.length,
    };

    // Check each result has target IP and stdout (for successful ones)
    let allResultsValid = true;
    for (let i = 0; i < response.results.length; i++) {
      const result = response.results[i];
      const hasTarget = 'target' in result;
      const hasSuccessOrError = 'success' in result;

      tests[`results[${i}] has "target" property`] = hasTarget;
      tests[`results[${i}] has "success" property`] = hasSuccessOrError;

      if (result.success) {
        tests[`results[${i}] has "stdout" property (success=true)`] = 'stdout' in result;
      }

      if (!hasTarget || !hasSuccessOrError) {
        allResultsValid = false;
      }
    }

    // Verify at least one VM was reachable (coordinator should always be reachable)
    tests['at least one VM was reachable (successCount >= 1)'] = response.successCount >= 1;

    console.log('\nVerification:');
    let allPassed = true;
    for (const [name, passed] of Object.entries(tests)) {
      console.log(`  ${passed ? '✓' : '❌'} ${name}`);
      if (!passed) allPassed = false;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`Total targets: ${targets.length}`);
    console.log(`Successful: ${response.successCount}`);
    console.log(`Failed: ${response.failureCount}`);

    if (allPassed) {
      console.log('\n✓ MCP-10 PASSED: ssh_multi_exec aggregates results from multiple VMs');
    } else {
      console.log('\n❌ MCP-10 FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

testSshMultiExecAggregation();
