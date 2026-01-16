/**
 * Test MCP-20: SSH command latency
 *
 * This test verifies that SSH commands complete within acceptable latency
 * by running 'echo test' 3 times and measuring response times.
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

// Replicate sshExec from MCP server with timing
async function sshExecWithTiming(target, command) {
  const ip = target === 'coordinator' ? CONFIG.coordinatorIp : target;
  const ssh = new NodeSSH();

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    throw new Error(`SSH key not found at ${CONFIG.sshKeyPath}`);
  }

  const startTime = Date.now();

  await ssh.connect({
    host: ip,
    username: CONFIG.sshUsername,
    privateKeyPath: CONFIG.sshKeyPath,
    readyTimeout: CONFIG.sshTimeout,
  });

  try {
    const result = await ssh.execCommand(command, {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    return {
      target: ip,
      command,
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      success: result.code === 0,
      latencyMs,
      latencySeconds: latencyMs / 1000
    };
  } finally {
    ssh.dispose();
  }
}

async function runTest() {
  console.log('=== MCP-20 Test: SSH command latency ===\n');

  const results = [];
  const MAX_LATENCY_SECONDS = 5;
  const NUM_CALLS = 3;

  try {
    // Step 1: Call ssh_exec(target='coordinator', command='echo test') 3 times
    console.log(`Step 1: Calling ssh_exec(command='echo test') ${NUM_CALLS} times...\n`);

    for (let i = 1; i <= NUM_CALLS; i++) {
      console.log(`       Call ${i}/${NUM_CALLS}...`);
      const result = await sshExecWithTiming('coordinator', 'echo test');
      results.push(result);
      console.log(`       Completed in ${result.latencySeconds.toFixed(3)}s (success: ${result.success})`);
    }

    // Step 2: Record response time for each call
    console.log('\nStep 2: Response times recorded:');
    console.log('       ┌───────┬────────────┬─────────┐');
    console.log('       │ Call  │ Latency    │ Status  │');
    console.log('       ├───────┼────────────┼─────────┤');
    results.forEach((r, i) => {
      const latencyStr = `${r.latencySeconds.toFixed(3)}s`.padEnd(10);
      const statusStr = r.success ? 'PASS' : 'FAIL';
      console.log(`       │ ${(i + 1).toString().padEnd(5)} │ ${latencyStr} │ ${statusStr.padEnd(7)} │`);
    });
    console.log('       └───────┴────────────┴─────────┘');

    // Step 3: Verify all calls complete successfully
    console.log('\nStep 3: Verifying all calls completed successfully...');
    const allSuccessful = results.every(r => r.success);
    console.log(`       All calls successful: ${allSuccessful ? 'PASS' : 'FAIL'}`);

    // Step 4: Verify average latency is under 5 seconds per command
    console.log('\nStep 4: Verifying average latency is under 5 seconds...');
    const totalLatency = results.reduce((sum, r) => sum + r.latencySeconds, 0);
    const avgLatency = totalLatency / results.length;
    const minLatency = Math.min(...results.map(r => r.latencySeconds));
    const maxLatency = Math.max(...results.map(r => r.latencySeconds));

    console.log(`       Min latency:     ${minLatency.toFixed(3)}s`);
    console.log(`       Max latency:     ${maxLatency.toFixed(3)}s`);
    console.log(`       Average latency: ${avgLatency.toFixed(3)}s`);
    console.log(`       Threshold:       ${MAX_LATENCY_SECONDS}s`);

    const latencyOk = avgLatency < MAX_LATENCY_SECONDS;
    console.log(`       Average under ${MAX_LATENCY_SECONDS}s: ${latencyOk ? 'PASS' : 'FAIL'}`);

    // Summary
    console.log('\n=== Latency Summary ===');
    console.log(JSON.stringify({
      calls: NUM_CALLS,
      latencies: results.map(r => r.latencySeconds),
      minLatency: parseFloat(minLatency.toFixed(3)),
      maxLatency: parseFloat(maxLatency.toFixed(3)),
      avgLatency: parseFloat(avgLatency.toFixed(3)),
      threshold: MAX_LATENCY_SECONDS,
      allSuccessful,
      withinThreshold: latencyOk
    }, null, 2));

    // Final result
    console.log('\n=== Test Result ===');
    const passed = allSuccessful && latencyOk;
    console.log(`MCP-20: ${passed ? 'PASSED' : 'FAILED'}`);

    if (passed) {
      console.log(`SSH commands complete within acceptable latency (avg: ${avgLatency.toFixed(3)}s < ${MAX_LATENCY_SECONDS}s)`);
    }

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
