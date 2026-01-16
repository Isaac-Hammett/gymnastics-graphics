/**
 * Test MCP-14: Test error handling for failed SSH command
 *
 * This test verifies that ssh_exec properly handles:
 * 1. Commands that return non-zero exit codes
 * 2. Commands that don't exist (command not found errors)
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

// Replicate sshExec from MCP server with proper error handling
async function sshExec(target, command, sudo = false) {
  const ip = target === 'coordinator' ? CONFIG.coordinatorIp : target;
  const ssh = new NodeSSH();

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    return {
      target: ip,
      command: command,
      exitCode: -1,
      stdout: '',
      stderr: '',
      success: false,
      error: `SSH key not found at ${CONFIG.sshKeyPath}`
    };
  }

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
      stdout: result.stdout,
      stderr: result.stderr,
      success: result.code === 0
    };
  } catch (error) {
    // Return error response instead of throwing
    return {
      target: ip,
      command: command,
      exitCode: -1,
      stdout: '',
      stderr: '',
      success: false,
      error: error.message || 'Connection failed'
    };
  } finally {
    ssh.dispose();
  }
}

async function runTest() {
  console.log('=== MCP-14 Test: Error handling for failed SSH command ===\n');

  const results = {
    // Test 1: exit 1
    exit1ExitCodeIs1: false,
    exit1SuccessIsFalse: false,
    // Test 2: nonexistent command
    nonexistentExitCodeNonZero: false,
    nonexistentStderrHasError: false
  };

  // Test 1: Call ssh_exec with command='exit 1'
  console.log('Test 1: Calling ssh_exec with target="coordinator", command="exit 1"...\n');

  const result1 = await sshExec('coordinator', 'exit 1');

  console.log('SSH Response:');
  console.log(JSON.stringify(result1, null, 2));

  // Step 2: Verify exitCode is 1
  console.log('\nStep 2: Verifying exitCode is 1...');
  results.exit1ExitCodeIs1 = result1.exitCode === 1;
  console.log(`        exitCode is 1: ${results.exit1ExitCodeIs1 ? 'PASS' : 'FAIL'} (got: ${result1.exitCode})`);

  // Step 3: Verify success is false
  console.log('\nStep 3: Verifying success is false...');
  results.exit1SuccessIsFalse = result1.success === false;
  console.log(`        success is false: ${results.exit1SuccessIsFalse ? 'PASS' : 'FAIL'} (got: ${result1.success})`);

  // Test 2: Call ssh_exec with nonexistent command
  console.log('\n' + '='.repeat(60));
  console.log('\nTest 2: Calling ssh_exec with command="nonexistent-command-xyz123"...\n');

  const result2 = await sshExec('coordinator', 'nonexistent-command-xyz123');

  console.log('SSH Response:');
  console.log(JSON.stringify(result2, null, 2));

  // Step 5: Verify exitCode is non-zero
  console.log('\nStep 5: Verifying exitCode is non-zero...');
  results.nonexistentExitCodeNonZero = result2.exitCode !== 0;
  console.log(`        exitCode is non-zero: ${results.nonexistentExitCodeNonZero ? 'PASS' : 'FAIL'} (got: ${result2.exitCode})`);

  // Step 6: Verify stderr contains error about command not found
  console.log('\nStep 6: Verifying stderr contains error about command not found...');

  // Check for common "command not found" patterns
  const notFoundPatterns = ['not found', 'command not found', 'No such file', 'not recognized'];
  const stderrLower = (result2.stderr || '').toLowerCase();
  results.nonexistentStderrHasError = notFoundPatterns.some(pattern =>
    stderrLower.includes(pattern.toLowerCase())
  );

  console.log(`        stderr contains "not found" or similar: ${results.nonexistentStderrHasError ? 'PASS' : 'FAIL'}`);
  if (result2.stderr) {
    console.log(`        stderr: "${result2.stderr}"`);
  }

  // Final result
  console.log('\n' + '='.repeat(60));
  console.log('=== Verification Results ===');
  console.log('Test 1 (exit 1):');
  console.log(`  - exitCode is 1: ${results.exit1ExitCodeIs1 ? 'PASS' : 'FAIL'}`);
  console.log(`  - success is false: ${results.exit1SuccessIsFalse ? 'PASS' : 'FAIL'}`);
  console.log('Test 2 (nonexistent command):');
  console.log(`  - exitCode is non-zero: ${results.nonexistentExitCodeNonZero ? 'PASS' : 'FAIL'}`);
  console.log(`  - stderr contains "command not found": ${results.nonexistentStderrHasError ? 'PASS' : 'FAIL'}`);

  const passed = results.exit1ExitCodeIs1 &&
                 results.exit1SuccessIsFalse &&
                 results.nonexistentExitCodeNonZero &&
                 results.nonexistentStderrHasError;

  console.log(`\n=== MCP-14: ${passed ? 'PASSED' : 'FAILED'} ===`);
  console.log('Verification: Failed commands return proper exit codes and success=false');

  return passed;
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(error => {
  console.error('\n=== CRITICAL FAILURE ===');
  console.error('Test crashed instead of handling error gracefully:');
  console.error(error.message);
  process.exit(1);
});
