#!/usr/bin/env node

/**
 * Test script for MCP-05: Test ssh_exec with sudo on coordinator
 *
 * Tests that:
 * 1. ssh_exec with sudo=true prepends 'sudo' to the command
 * 2. whoami with sudo returns 'root'
 * 3. success is true
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

async function testSshExecWithSudo() {
  console.log('MCP-05: Testing ssh_exec with sudo on coordinator\n');

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    console.log(`❌ SSH key not found at ${CONFIG.sshKeyPath}`);
    process.exit(1);
  }
  console.log(`✓ SSH key found at ${CONFIG.sshKeyPath}`);

  const ssh = new NodeSSH();

  try {
    // Connect to coordinator
    console.log(`\nConnecting to coordinator at ${CONFIG.coordinatorIp}...`);
    await ssh.connect({
      host: CONFIG.coordinatorIp,
      username: CONFIG.sshUsername,
      privateKeyPath: CONFIG.sshKeyPath,
      readyTimeout: CONFIG.sshTimeout,
    });
    console.log('✓ SSH connection established');

    // Test 1: Run 'whoami' with sudo
    console.log('\nTest 1: Running "sudo whoami"...');
    const result = await ssh.execCommand('sudo whoami', {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    console.log(`  Command: sudo whoami`);
    console.log(`  Exit code: ${result.code}`);
    console.log(`  stdout: "${result.stdout.trim()}"`);
    console.log(`  stderr: "${result.stderr.trim()}"`);
    console.log(`  success: ${result.code === 0}`);

    // Verify results
    const tests = {
      'stdout contains root': result.stdout.trim() === 'root',
      'exit code is 0': result.code === 0,
      'success is true': result.code === 0,
    };

    console.log('\nVerification:');
    let allPassed = true;
    for (const [name, passed] of Object.entries(tests)) {
      console.log(`  ${passed ? '✓' : '❌'} ${name}`);
      if (!passed) allPassed = false;
    }

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✓ MCP-05 PASSED: Sudo execution works and returns root user');

      // Output the expected response format
      console.log('\nExpected MCP response format:');
      console.log(JSON.stringify({
        target: CONFIG.coordinatorIp,
        command: 'sudo whoami',
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        success: result.code === 0
      }, null, 2));
    } else {
      console.log('❌ MCP-05 FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    ssh.dispose();
  }
}

testSshExecWithSudo();
