/**
 * Test MCP-04: ssh_exec basic command on coordinator
 *
 * This test verifies that ssh_exec can connect to the coordinator
 * and execute a basic 'echo hello' command.
 */

import { NodeSSH } from 'node-ssh';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Configuration (same as MCP server)
const CONFIG = {
  sshKeyPath: join(homedir(), '.ssh', 'gymnastics-graphics-key-pair.pem'),
  sshUsername: 'ubuntu',
  coordinatorIp: '44.193.31.120',
  sshTimeout: 30000,
  commandTimeout: 60000,
};

// Replicate sshExec from MCP server
async function sshExec(target, command, sudo = false) {
  const ip = target === 'coordinator' ? CONFIG.coordinatorIp : target;
  const ssh = new NodeSSH();

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    throw new Error(`SSH key not found at ${CONFIG.sshKeyPath}`);
  }

  await ssh.connect({
    host: ip,
    username: CONFIG.sshUsername,
    privateKeyPath: CONFIG.sshKeyPath,
    readyTimeout: CONFIG.sshTimeout,
  });

  try {
    const cmd = sudo ? `sudo ${command}` : command;
    const result = await ssh.execCommand(cmd, {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    return {
      target: ip,
      command: cmd,
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      success: result.code === 0
    };
  } finally {
    ssh.dispose();
  }
}

async function runTest() {
  console.log('=== MCP-04 Test: ssh_exec basic command on coordinator ===\n');

  try {
    // Step 1: Call ssh_exec with target='coordinator', command='echo hello'
    console.log('Step 1: Calling ssh_exec with target="coordinator", command="echo hello"...');
    const result = await sshExec('coordinator', 'echo hello');

    console.log('\nSSH Response:');
    console.log(JSON.stringify(result, null, 2));

    // Step 2: Verify response has required fields
    console.log('\nStep 2: Verifying response structure...');
    const requiredFields = ['target', 'command', 'exitCode', 'stdout', 'stderr', 'success'];
    const hasAllFields = requiredFields.every(field => field in result);

    console.log(`       Has target: ${'target' in result ? 'PASS' : 'FAIL'}`);
    console.log(`       Has command: ${'command' in result ? 'PASS' : 'FAIL'}`);
    console.log(`       Has exitCode: ${'exitCode' in result ? 'PASS' : 'FAIL'}`);
    console.log(`       Has stdout: ${'stdout' in result ? 'PASS' : 'FAIL'}`);
    console.log(`       Has stderr: ${'stderr' in result ? 'PASS' : 'FAIL'}`);
    console.log(`       Has success: ${'success' in result ? 'PASS' : 'FAIL'}`);
    console.log(`       All fields present: ${hasAllFields ? 'PASS' : 'FAIL'}`);

    // Step 3: Verify exitCode is 0
    console.log('\nStep 3: Verifying exitCode is 0...');
    const exitCodeZero = result.exitCode === 0;
    console.log(`       exitCode: ${result.exitCode} - ${exitCodeZero ? 'PASS' : 'FAIL'}`);

    // Step 4: Verify stdout contains 'hello'
    console.log('\nStep 4: Verifying stdout contains "hello"...');
    const stdoutContainsHello = result.stdout.includes('hello');
    console.log(`       stdout: "${result.stdout.trim()}" - ${stdoutContainsHello ? 'PASS' : 'FAIL'}`);

    // Step 5: Verify success is true
    console.log('\nStep 5: Verifying success is true...');
    const successIsTrue = result.success === true;
    console.log(`       success: ${result.success} - ${successIsTrue ? 'PASS' : 'FAIL'}`);

    // Final result
    console.log('\n=== Test Result ===');
    const passed = hasAllFields && exitCodeZero && stdoutContainsHello && successIsTrue;
    console.log(`MCP-04: ${passed ? 'PASSED' : 'FAILED'}`);

    return passed;
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);
    console.error('\nThis test requires:');
    console.error('1. SSH key at ~/.ssh/gymnastics-graphics-key-pair.pem');
    console.error('2. Coordinator VM (44.193.31.120) to be running and reachable');
    return false;
  }
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
});
