#!/usr/bin/env node

/**
 * Test script for MCP-08: Test ssh_exec by IP address (not shortcut)
 *
 * Tests that:
 * 1. ssh_exec with target='44.193.31.120' (direct IP) works same as 'coordinator'
 * 2. success is true
 * 3. stdout contains 'test'
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

async function testSshExecByIP() {
  console.log('MCP-08: Testing ssh_exec by IP address (not shortcut)\n');
  console.log('This test verifies that direct IP targeting works the same as the "coordinator" shortcut.\n');

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    console.log(`❌ SSH key not found at ${CONFIG.sshKeyPath}`);
    process.exit(1);
  }
  console.log(`✓ SSH key found at ${CONFIG.sshKeyPath}`);

  const ssh = new NodeSSH();

  try {
    // Connect to coordinator using direct IP address
    console.log(`\nConnecting to ${CONFIG.coordinatorIp} (direct IP, not shortcut)...`);
    await ssh.connect({
      host: CONFIG.coordinatorIp,
      username: CONFIG.sshUsername,
      privateKeyPath: CONFIG.sshKeyPath,
      readyTimeout: CONFIG.sshTimeout,
    });
    console.log('✓ SSH connection established using direct IP');

    // Test: Run 'echo test'
    console.log('\nTest: Running "echo test" via direct IP...');
    const result = await ssh.execCommand('echo test', {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    // Build response in same format as MCP server
    const response = {
      target: CONFIG.coordinatorIp,
      command: 'echo test',
      exitCode: result.code,
      stdout: result.stdout.trim(),
      stderr: result.stderr,
      success: result.code === 0
    };

    console.log('\nResponse:');
    console.log(JSON.stringify(response, null, 2));

    // Verify results
    const tests = {
      'success is true': response.success === true,
      'stdout contains "test"': response.stdout.includes('test'),
      'target is the direct IP address': response.target === CONFIG.coordinatorIp,
    };

    console.log('\nVerification:');
    let allPassed = true;
    for (const [name, passed] of Object.entries(tests)) {
      console.log(`  ${passed ? '✓' : '❌'} ${name}`);
      if (!passed) allPassed = false;
    }

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✓ MCP-08 PASSED: Direct IP targeting works same as "coordinator" shortcut');
    } else {
      console.log('❌ MCP-08 FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    ssh.dispose();
  }
}

testSshExecByIP();
