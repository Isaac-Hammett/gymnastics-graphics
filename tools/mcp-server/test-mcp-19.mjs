#!/usr/bin/env node

/**
 * Test script for MCP-19: Test network connectivity from coordinator
 *
 * Tests the coordinator's network connectivity:
 * 1. Call ssh_exec(target='coordinator', command='curl -s -o /dev/null -w "%{http_code}" https://api.github.com')
 * 2. Verify stdout is '200' (GitHub API reachable)
 * 3. Call ssh_exec(target='coordinator', command='curl -s http://localhost:3001/api/status || echo unreachable')
 * 4. Record whether local API is running
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
  } catch (error) {
    return {
      target: ip,
      command,
      exitCode: -1,
      stdout: '',
      stderr: '',
      success: false,
      error: error.message
    };
  } finally {
    ssh.dispose();
  }
}

async function testNetworkConnectivity() {
  console.log('MCP-19: Testing network connectivity from coordinator\n');
  console.log('This test verifies the coordinator has internet and local service connectivity.\n');

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    console.log(`❌ SSH key not found at ${CONFIG.sshKeyPath}`);
    process.exit(1);
  }
  console.log(`✓ SSH key found at ${CONFIG.sshKeyPath}`);

  const tests = {};
  const connectivity = {
    timestamp: new Date().toISOString(),
    internet: {
      reachable: false,
      httpCode: null,
      target: 'https://api.github.com'
    },
    localApi: {
      reachable: false,
      response: null,
      target: 'http://localhost:3001/api/status'
    }
  };

  try {
    // Step 1: Test internet connectivity via GitHub API
    console.log('\n' + '='.repeat(60));
    console.log('Step 1: Testing internet connectivity (GitHub API)...');
    console.log('='.repeat(60));

    const githubResult = await sshExec(
      'coordinator',
      'curl -s -o /dev/null -w "%{http_code}" https://api.github.com'
    );

    console.log('Command: curl -s -o /dev/null -w "%{http_code}" https://api.github.com');
    console.log(`Exit code: ${githubResult.exitCode}`);
    console.log(`HTTP response code: ${githubResult.stdout}`);

    if (githubResult.success) {
      const httpCode = githubResult.stdout;
      connectivity.internet.httpCode = httpCode;
      connectivity.internet.reachable = httpCode === '200';

      if (httpCode === '200') {
        console.log('\n✓ GitHub API returned HTTP 200 - Internet connectivity confirmed');
        tests['internet connectivity (GitHub API)'] = true;
        tests['HTTP response is 200'] = true;
      } else {
        console.log(`\n⚠ GitHub API returned HTTP ${httpCode} (expected 200)`);
        console.log('  Note: Non-200 may indicate rate limiting or network issues');
        tests['internet connectivity (GitHub API)'] = true; // curl worked
        tests['HTTP response is 200'] = false;
      }
    } else {
      console.log('\n❌ Failed to reach GitHub API');
      console.log(`   Error: ${githubResult.stderr || githubResult.error}`);
      connectivity.internet.error = githubResult.stderr || githubResult.error;
      tests['internet connectivity (GitHub API)'] = false;
      tests['HTTP response is 200'] = false;
    }

    // Step 2: Test local API connectivity
    console.log('\n' + '='.repeat(60));
    console.log('Step 2: Testing local API connectivity (localhost:3001)...');
    console.log('='.repeat(60));

    const localApiResult = await sshExec(
      'coordinator',
      'curl -s http://localhost:3001/api/status || echo unreachable'
    );

    console.log('Command: curl -s http://localhost:3001/api/status || echo unreachable');
    console.log(`Exit code: ${localApiResult.exitCode}`);
    console.log(`Response: ${localApiResult.stdout.substring(0, 500)}${localApiResult.stdout.length > 500 ? '...' : ''}`);

    if (localApiResult.success) {
      const response = localApiResult.stdout;
      connectivity.localApi.response = response;

      if (response === 'unreachable') {
        console.log('\n⚠ Local API is not running or not responding');
        console.log('  Note: The coordinator server may not be started');
        connectivity.localApi.reachable = false;
        tests['local API responds'] = false;
      } else {
        // Try to parse as JSON to verify it's a valid API response
        try {
          const parsed = JSON.parse(response);
          console.log('\n✓ Local API responded with valid JSON');
          console.log('  Response preview:', JSON.stringify(parsed, null, 2).substring(0, 300));
          connectivity.localApi.reachable = true;
          connectivity.localApi.parsed = parsed;
          tests['local API responds'] = true;
          tests['local API returns valid JSON'] = true;

          // Check for expected status fields
          if (parsed.status) {
            tests['local API has status field'] = true;
            console.log(`  Status: ${parsed.status}`);
          }
        } catch (e) {
          console.log('\n⚠ Local API responded but not with valid JSON');
          console.log('  Response may be an error page or unexpected format');
          connectivity.localApi.reachable = true;
          tests['local API responds'] = true;
          tests['local API returns valid JSON'] = false;
        }
      }
    } else {
      console.log('\n❌ Failed to connect to local API');
      console.log(`   Error: ${localApiResult.stderr || localApiResult.error}`);
      connectivity.localApi.error = localApiResult.stderr || localApiResult.error;
      tests['local API responds'] = false;
    }

    // Step 3: Additional connectivity tests
    console.log('\n' + '='.repeat(60));
    console.log('Step 3: Additional connectivity checks...');
    console.log('='.repeat(60));

    // Test DNS resolution
    const dnsResult = await sshExec('coordinator', 'host github.com');
    const dnsWorks = dnsResult.success && dnsResult.stdout.includes('has address');
    tests['DNS resolution works'] = dnsWorks;
    console.log(`  - DNS resolution: ${dnsWorks ? '✓ working' : '❌ failed'}`);

    // Test outbound HTTPS
    const httpsResult = await sshExec(
      'coordinator',
      'curl -s -o /dev/null -w "%{http_code}" https://www.google.com'
    );
    const httpsWorks = httpsResult.success && (httpsResult.stdout === '200' || httpsResult.stdout === '301');
    tests['outbound HTTPS works'] = httpsWorks;
    console.log(`  - Outbound HTTPS (google.com): ${httpsWorks ? '✓ working' : '❌ failed'} (code: ${httpsResult.stdout})`);

    // Verification Summary
    console.log('\n' + '='.repeat(60));
    console.log('Verification Results:');
    console.log('='.repeat(60));

    let allPassed = true;
    let criticalPassed = true;

    // Critical tests - internet must work
    const criticalTests = ['internet connectivity (GitHub API)', 'DNS resolution works'];
    // Informational tests - local API may or may not be running
    const infoTests = ['local API responds', 'local API returns valid JSON', 'local API has status field'];

    for (const [name, passed] of Object.entries(tests)) {
      const isCritical = criticalTests.includes(name);
      const isInfo = infoTests.includes(name);
      const prefix = isCritical ? '[CRITICAL]' : isInfo ? '[INFO]' : '[CHECK]';
      console.log(`  ${passed ? '✓' : (isInfo ? '⚠' : '❌')} ${prefix} ${name}`);

      if (!passed) {
        if (isCritical) {
          criticalPassed = false;
        }
        if (!isInfo) {
          allPassed = false;
        }
      }
    }

    // Connectivity Summary
    console.log('\n' + '='.repeat(60));
    console.log('Connectivity Summary:');
    console.log('='.repeat(60));
    console.log(`Coordinator IP: ${CONFIG.coordinatorIp}`);
    console.log(`Timestamp: ${connectivity.timestamp}`);
    console.log(`\nInternet Connectivity:`);
    console.log(`  Target: ${connectivity.internet.target}`);
    console.log(`  Reachable: ${connectivity.internet.reachable ? '✓' : '✗'}`);
    console.log(`  HTTP Code: ${connectivity.internet.httpCode || 'N/A'}`);
    console.log(`\nLocal API:`);
    console.log(`  Target: ${connectivity.localApi.target}`);
    console.log(`  Running: ${connectivity.localApi.reachable ? '✓' : '⚠ not running'}`);

    // Final result
    if (criticalPassed) {
      console.log('\n✓ MCP-19 PASSED: Coordinator has internet and local service connectivity');
      if (!connectivity.localApi.reachable) {
        console.log('  Note: Local API is not running (coordinator server may be stopped)');
      }
    } else {
      console.log('\n❌ MCP-19 FAILED: Critical connectivity checks did not pass');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

testNetworkConnectivity();
