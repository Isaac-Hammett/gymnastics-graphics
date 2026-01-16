#!/usr/bin/env node

/**
 * MCP-07: Test ssh_exec service status on coordinator
 *
 * This test verifies that ssh_exec can check service status on the coordinator.
 *
 * Tests:
 * 1. systemctl is-active pm2-ubuntu (with sudo) - returns active/inactive
 * 2. pm2 list --no-color - shows process information
 */

import { NodeSSH } from 'node-ssh';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG = {
  coordinatorIp: '44.193.31.120',
  sshKeyPath: join(homedir(), '.ssh', 'gymnastics-graphics-key-pair.pem'),
  sshUsername: 'ubuntu',
};

async function runTest() {
  const ssh = new NodeSSH();

  console.log('MCP-07: Test ssh_exec service status on coordinator\n');
  console.log('Connecting to coordinator at', CONFIG.coordinatorIp, '...\n');

  await ssh.connect({
    host: CONFIG.coordinatorIp,
    username: CONFIG.sshUsername,
    privateKeyPath: CONFIG.sshKeyPath,
    readyTimeout: 30000,
  });

  let allPassed = true;

  // Test 1: Check systemctl is-active pm2-ubuntu
  console.log('Test 1: systemctl is-active pm2-ubuntu || echo inactive');
  console.log('=' .repeat(60));
  const result1 = await ssh.execCommand('sudo systemctl is-active pm2-ubuntu || echo inactive');
  console.log('stdout:', result1.stdout);
  console.log('stderr:', result1.stderr);
  console.log('exitCode:', result1.code);

  // Verify: Response contains status information (active or inactive)
  const hasStatusInfo = result1.stdout.includes('active') || result1.stdout.includes('inactive');
  console.log('\nVerification: Response contains status information:', hasStatusInfo ? 'PASSED' : 'FAILED');
  if (!hasStatusInfo) allPassed = false;

  console.log('\n');

  // Test 2: Check pm2 list
  console.log('Test 2: pm2 list --no-color');
  console.log('=' .repeat(60));
  const result2 = await ssh.execCommand('pm2 list --no-color');
  console.log('stdout:', result2.stdout);
  console.log('stderr:', result2.stderr);
  console.log('exitCode:', result2.code);

  // Verify: stdout contains process information or indicates no processes
  // PM2 output typically includes table headers like 'id', 'name', 'status' or 'PM2 Runtime' or 'no processes'
  const hasProcessInfo = result2.stdout.includes('id') ||
                         result2.stdout.includes('name') ||
                         result2.stdout.includes('status') ||
                         result2.stdout.includes('online') ||
                         result2.stdout.includes('stopped') ||
                         result2.stdout.toLowerCase().includes('no process');
  console.log('\nVerification: stdout contains process information:', hasProcessInfo ? 'PASSED' : 'FAILED');
  if (!hasProcessInfo) allPassed = false;

  ssh.dispose();

  console.log('\n' + '=' .repeat(60));
  console.log('Overall Result:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  console.log('=' .repeat(60));

  process.exit(allPassed ? 0 : 1);
}

runTest().catch(error => {
  console.error('Test failed with error:', error.message);
  process.exit(1);
});
