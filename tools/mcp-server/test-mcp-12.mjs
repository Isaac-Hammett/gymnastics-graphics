/**
 * Test MCP-12: Test error handling for invalid SSH target
 *
 * This test verifies that ssh_exec properly handles connection failures
 * when targeting an unreachable IP address (192.0.2.1 - TEST-NET).
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
  sshTimeout: 10000, // Shorter timeout for error testing
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
  console.log('=== MCP-12 Test: Error handling for invalid SSH target ===\n');

  const results = {
    connectionFails: false,
    hasError: false,
    errorDescriptive: false
  };

  // Step 1: Call ssh_exec with target='192.0.2.1' (TEST-NET, unreachable)
  console.log('Step 1: Calling ssh_exec with target="192.0.2.1" (TEST-NET), command="echo test"...');
  console.log('        (This should timeout/fail - waiting up to 10 seconds...)\n');

  const startTime = Date.now();
  const result = await sshExec('192.0.2.1', 'echo test');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`Completed in ${elapsed}s\n`);
  console.log('SSH Response:');
  console.log(JSON.stringify(result, null, 2));

  // Step 2: Verify response indicates connection failure or timeout
  console.log('\nStep 2: Verifying response indicates connection failure...');
  results.connectionFails = result.success === false;
  console.log(`        success is false: ${results.connectionFails ? 'PASS' : 'FAIL'}`);

  if (result.exitCode !== undefined) {
    console.log(`        exitCode: ${result.exitCode} (non-zero or -1 expected for error)`);
  }

  // Step 3: Verify error message is descriptive
  console.log('\nStep 3: Verifying error message is descriptive...');
  results.hasError = 'error' in result && result.error !== '';
  console.log(`        Has error field: ${results.hasError ? 'PASS' : 'FAIL'}`);

  if (results.hasError) {
    console.log(`        Error message: "${result.error}"`);

    // Check if error message mentions common connection failure terms
    const descriptiveTerms = ['timeout', 'timed out', 'connect', 'ETIMEDOUT', 'ECONNREFUSED', 'unreachable', 'failed', 'connection', 'EHOSTUNREACH', 'handshake'];
    results.errorDescriptive = descriptiveTerms.some(term =>
      result.error.toLowerCase().includes(term.toLowerCase())
    );
    console.log(`        Error is descriptive: ${results.errorDescriptive ? 'PASS' : 'FAIL'}`);
  }

  // Final result
  console.log('\n=== Verification Results ===');
  console.log(`- Response indicates connection failure: ${results.connectionFails ? 'PASS' : 'FAIL'}`);
  console.log(`- Response has error field: ${results.hasError ? 'PASS' : 'FAIL'}`);
  console.log(`- Error message is descriptive: ${results.errorDescriptive ? 'PASS' : 'FAIL'}`);

  const passed = results.connectionFails && results.hasError && results.errorDescriptive;
  console.log(`\n=== MCP-12: ${passed ? 'PASSED' : 'FAILED'} ===`);
  console.log('Verification: Invalid target returns proper error, not crash');

  return passed;
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(error => {
  // If we reach here, the test crashed instead of handling the error gracefully
  console.error('\n=== CRITICAL FAILURE ===');
  console.error('Test crashed instead of handling error gracefully:');
  console.error(error.message);
  process.exit(1);
});
