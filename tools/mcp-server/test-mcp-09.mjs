#!/usr/bin/env node

/**
 * Test script for MCP-09: Test ssh_multi_exec on single target
 *
 * Tests that ssh_multi_exec works correctly with a single target:
 * 1. Call ssh_multi_exec with targets=['coordinator'], command='hostname'
 * 2. Verify response has: command, results array, successCount, failureCount
 * 3. Verify results[0] has target and success=true
 * 4. Verify successCount is 1, failureCount is 0
 */

import { NodeSSH } from 'node-ssh';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG = {
  sshKeyPath: join(homedir(), '.ssh', 'gymnastics-graphics-key-pair.pem'),
  sshUsername: 'ubuntu',
  coordinatorIp: '44.193.31.120',
  sshTimeout: 30000,
  commandTimeout: 60000,
};

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

async function testSshMultiExecSingleTarget() {
  console.log('MCP-09: Testing ssh_multi_exec on single target\n');
  console.log('This test verifies that ssh_multi_exec works correctly with a single target.\n');

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    console.log(`❌ SSH key not found at ${CONFIG.sshKeyPath}`);
    process.exit(1);
  }
  console.log(`✓ SSH key found at ${CONFIG.sshKeyPath}`);

  try {
    // Test: Run 'hostname' on single target using multi_exec
    console.log('\nTest: Running ssh_multi_exec with targets=["coordinator"], command="hostname"...');
    const response = await sshMultiExec(['coordinator'], 'hostname');

    console.log('\nResponse:');
    console.log(JSON.stringify(response, null, 2));

    // Verify results
    const tests = {
      'response has "command" property': 'command' in response,
      'response has "results" array': Array.isArray(response.results),
      'response has "successCount" property': 'successCount' in response,
      'response has "failureCount" property': 'failureCount' in response,
      'results[0] has "target" property': response.results[0] && 'target' in response.results[0],
      'results[0] has "success" property': response.results[0] && 'success' in response.results[0],
      'results[0].success is true': response.results[0]?.success === true,
      'successCount is 1': response.successCount === 1,
      'failureCount is 0': response.failureCount === 0,
    };

    console.log('\nVerification:');
    let allPassed = true;
    for (const [name, passed] of Object.entries(tests)) {
      console.log(`  ${passed ? '✓' : '❌'} ${name}`);
      if (!passed) allPassed = false;
    }

    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✓ MCP-09 PASSED: ssh_multi_exec works correctly with single target');
    } else {
      console.log('❌ MCP-09 FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

testSshMultiExecSingleTarget();
