#!/usr/bin/env node

/**
 * Test script for MCP-06: Test ssh_exec system info commands on coordinator
 *
 * Tests that:
 * 1. ssh_exec with command='hostname' returns non-empty stdout
 * 2. ssh_exec with command='uptime' returns stdout containing 'up' or 'load average'
 * 3. ssh_exec with command='df -h /' returns stdout containing filesystem info
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

async function testSshSystemInfo() {
  console.log('MCP-06: Testing ssh_exec system info commands on coordinator\n');

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    console.log(`❌ SSH key not found at ${CONFIG.sshKeyPath}`);
    process.exit(1);
  }
  console.log(`✓ SSH key found at ${CONFIG.sshKeyPath}`);

  const ssh = new NodeSSH();
  let allTestsPassed = true;

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

    // Test 1: hostname command
    console.log('\n' + '='.repeat(50));
    console.log('Test 1: Running "hostname"...');
    const hostnameResult = await ssh.execCommand('hostname', {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    console.log(`  Command: hostname`);
    console.log(`  Exit code: ${hostnameResult.code}`);
    console.log(`  stdout: "${hostnameResult.stdout.trim()}"`);
    console.log(`  success: ${hostnameResult.code === 0}`);

    const hostnameTests = {
      'stdout is non-empty': hostnameResult.stdout.trim().length > 0,
      'exit code is 0': hostnameResult.code === 0,
    };

    console.log('\nVerification:');
    for (const [name, passed] of Object.entries(hostnameTests)) {
      console.log(`  ${passed ? '✓' : '❌'} ${name}`);
      if (!passed) allTestsPassed = false;
    }

    // Test 2: uptime command
    console.log('\n' + '='.repeat(50));
    console.log('Test 2: Running "uptime"...');
    const uptimeResult = await ssh.execCommand('uptime', {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    console.log(`  Command: uptime`);
    console.log(`  Exit code: ${uptimeResult.code}`);
    console.log(`  stdout: "${uptimeResult.stdout.trim()}"`);
    console.log(`  success: ${uptimeResult.code === 0}`);

    const uptimeTests = {
      'stdout contains "up" or "load average"':
        uptimeResult.stdout.includes('up') || uptimeResult.stdout.includes('load average'),
      'exit code is 0': uptimeResult.code === 0,
    };

    console.log('\nVerification:');
    for (const [name, passed] of Object.entries(uptimeTests)) {
      console.log(`  ${passed ? '✓' : '❌'} ${name}`);
      if (!passed) allTestsPassed = false;
    }

    // Test 3: df -h / command
    console.log('\n' + '='.repeat(50));
    console.log('Test 3: Running "df -h /"...');
    const dfResult = await ssh.execCommand('df -h /', {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    console.log(`  Command: df -h /`);
    console.log(`  Exit code: ${dfResult.code}`);
    console.log(`  stdout:`);
    dfResult.stdout.split('\n').forEach(line => console.log(`    ${line}`));
    console.log(`  success: ${dfResult.code === 0}`);

    const dfTests = {
      'stdout contains filesystem info (Filesystem header)': dfResult.stdout.includes('Filesystem'),
      'stdout contains size info (G or M for gigabytes/megabytes)':
        dfResult.stdout.includes('G') || dfResult.stdout.includes('M'),
      'exit code is 0': dfResult.code === 0,
    };

    console.log('\nVerification:');
    for (const [name, passed] of Object.entries(dfTests)) {
      console.log(`  ${passed ? '✓' : '❌'} ${name}`);
      if (!passed) allTestsPassed = false;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
      console.log('✓ MCP-06 PASSED: System info commands return valid data');

      // Output the expected response format for each command
      console.log('\nExpected MCP response formats:');
      console.log('\n1. hostname:');
      console.log(JSON.stringify({
        target: CONFIG.coordinatorIp,
        command: 'hostname',
        exitCode: hostnameResult.code,
        stdout: hostnameResult.stdout,
        stderr: hostnameResult.stderr,
        success: hostnameResult.code === 0
      }, null, 2));

      console.log('\n2. uptime:');
      console.log(JSON.stringify({
        target: CONFIG.coordinatorIp,
        command: 'uptime',
        exitCode: uptimeResult.code,
        stdout: uptimeResult.stdout,
        stderr: uptimeResult.stderr,
        success: uptimeResult.code === 0
      }, null, 2));

      console.log('\n3. df -h /:');
      console.log(JSON.stringify({
        target: CONFIG.coordinatorIp,
        command: 'df -h /',
        exitCode: dfResult.code,
        stdout: dfResult.stdout,
        stderr: dfResult.stderr,
        success: dfResult.code === 0
      }, null, 2));
    } else {
      console.log('❌ MCP-06 FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    ssh.dispose();
  }
}

testSshSystemInfo();
