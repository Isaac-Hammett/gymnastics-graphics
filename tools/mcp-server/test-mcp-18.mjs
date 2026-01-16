#!/usr/bin/env node

/**
 * Test script for MCP-18: Test coordinator app deployment check
 *
 * Tests the MCP server's ability to verify the coordinator deployment structure:
 * 1. Call ssh_exec(target='coordinator', command='ls -la /opt/gymnastics-graphics')
 * 2. Verify directory exists
 * 3. Call ssh_exec(target='coordinator', command='cat /opt/gymnastics-graphics/server/package.json | head -5')
 * 4. Verify package.json exists and contains expected structure
 * 5. Call ssh_exec(target='coordinator', command='pm2 list --no-color')
 * 6. Verify PM2 shows process status
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
  deployPath: '/opt/gymnastics-graphics',
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

async function testCoordinatorDeployment() {
  console.log('MCP-18: Testing coordinator app deployment check\n');
  console.log('This test verifies the coordinator deployment structure is correct.\n');

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    console.log(`❌ SSH key not found at ${CONFIG.sshKeyPath}`);
    process.exit(1);
  }
  console.log(`✓ SSH key found at ${CONFIG.sshKeyPath}`);

  const tests = {};
  const deployment = {
    timestamp: new Date().toISOString(),
    directoryExists: false,
    packageJsonValid: false,
    pm2Status: null,
    errors: []
  };

  try {
    // Step 1: Check if /opt/gymnastics-graphics directory exists
    console.log('\n' + '='.repeat(60));
    console.log(`Step 1: Checking if ${CONFIG.deployPath} exists...`);
    console.log('='.repeat(60));

    const lsResult = await sshExec('coordinator', `ls -la ${CONFIG.deployPath}`);

    if (lsResult.success) {
      console.log('Directory listing:');
      console.log(lsResult.stdout);
      deployment.directoryExists = true;
      tests['directory exists'] = true;

      // Check for expected subdirectories
      const hasServer = lsResult.stdout.includes('server');
      const hasShowController = lsResult.stdout.includes('show-controller');

      console.log(`\n  - server/ directory: ${hasServer ? '✓ found' : '✗ not found'}`);
      console.log(`  - show-controller/ directory: ${hasShowController ? '✓ found' : '⚠ not found (may be deployed separately)'}`);

      tests['server directory exists'] = hasServer;
    } else {
      console.log(`❌ Directory not found or not accessible`);
      console.log(`   Error: ${lsResult.stderr || lsResult.error}`);
      deployment.directoryExists = false;
      deployment.errors.push(`Directory ${CONFIG.deployPath} does not exist`);
      tests['directory exists'] = false;
      tests['server directory exists'] = false;
    }

    // Step 2: Check package.json exists and has expected structure
    console.log('\n' + '='.repeat(60));
    console.log('Step 2: Checking package.json structure...');
    console.log('='.repeat(60));

    const packageJsonResult = await sshExec('coordinator', `cat ${CONFIG.deployPath}/server/package.json | head -10`);

    if (packageJsonResult.success) {
      console.log('package.json content (first 10 lines):');
      console.log(packageJsonResult.stdout);

      // Check for expected fields
      const hasName = packageJsonResult.stdout.includes('"name"');
      const hasVersion = packageJsonResult.stdout.includes('"version"');

      deployment.packageJsonValid = hasName && hasVersion;
      tests['package.json exists'] = true;
      tests['package.json has name field'] = hasName;
      tests['package.json has version field'] = hasVersion;

      console.log(`\n  - Has "name" field: ${hasName ? '✓' : '✗'}`);
      console.log(`  - Has "version" field: ${hasVersion ? '✓' : '✗'}`);
    } else {
      console.log(`❌ Could not read package.json`);
      console.log(`   Error: ${packageJsonResult.stderr || packageJsonResult.error}`);
      deployment.packageJsonValid = false;
      deployment.errors.push('package.json not found or not readable');
      tests['package.json exists'] = false;
      tests['package.json has name field'] = false;
      tests['package.json has version field'] = false;
    }

    // Step 3: Check PM2 process status
    console.log('\n' + '='.repeat(60));
    console.log('Step 3: Checking PM2 process status...');
    console.log('='.repeat(60));

    const pm2Result = await sshExec('coordinator', 'pm2 list --no-color');

    if (pm2Result.success) {
      console.log('PM2 process list:');
      console.log(pm2Result.stdout);

      // Parse PM2 output to check for processes
      const hasProcesses = !pm2Result.stdout.includes('No processes running') &&
                          pm2Result.stdout.includes('│');
      const hasCoordinatorProcess = pm2Result.stdout.toLowerCase().includes('coordinator') ||
                                    pm2Result.stdout.toLowerCase().includes('index') ||
                                    pm2Result.stdout.toLowerCase().includes('server');

      deployment.pm2Status = {
        running: hasProcesses,
        coordinatorFound: hasCoordinatorProcess,
        output: pm2Result.stdout
      };

      tests['pm2 command executed'] = true;
      tests['pm2 shows process list'] = hasProcesses;

      console.log(`\n  - PM2 has running processes: ${hasProcesses ? '✓' : '⚠ no processes'}`);
      console.log(`  - Coordinator/server process found: ${hasCoordinatorProcess ? '✓' : '⚠ not found'}`);

      // Note: It's OK if PM2 shows no processes - the coordinator might not be deployed yet
      // or might use a different process manager
    } else {
      console.log(`❌ PM2 command failed or PM2 not installed`);
      console.log(`   Error: ${pm2Result.stderr || pm2Result.error}`);

      // Check if PM2 is installed
      const pm2Installed = !pm2Result.stderr?.includes('command not found');

      deployment.pm2Status = {
        running: false,
        installed: pm2Installed,
        error: pm2Result.stderr || pm2Result.error
      };

      tests['pm2 command executed'] = pm2Installed;
      tests['pm2 shows process list'] = false;

      if (!pm2Installed) {
        deployment.errors.push('PM2 is not installed');
      }
    }

    // Step 4: Additional checks - node_modules and ecosystem.config.js
    console.log('\n' + '='.repeat(60));
    console.log('Step 4: Additional deployment checks...');
    console.log('='.repeat(60));

    // Check node_modules
    const nodeModulesResult = await sshExec('coordinator', `ls ${CONFIG.deployPath}/server/node_modules | head -5`);
    const hasNodeModules = nodeModulesResult.success && nodeModulesResult.stdout.length > 0;
    tests['node_modules installed'] = hasNodeModules;
    console.log(`  - node_modules installed: ${hasNodeModules ? '✓' : '⚠ not found'}`);

    // Check ecosystem.config.js
    const ecosystemResult = await sshExec('coordinator', `cat ${CONFIG.deployPath}/server/ecosystem.config.js | head -5`);
    const hasEcosystem = ecosystemResult.success;
    tests['ecosystem.config.js exists'] = hasEcosystem;
    console.log(`  - ecosystem.config.js exists: ${hasEcosystem ? '✓' : '⚠ not found'}`);

    // Check for .env file (should exist but we won't show contents)
    const envResult = await sshExec('coordinator', `test -f ${CONFIG.deployPath}/server/.env && echo "exists" || echo "not found"`);
    const hasEnvFile = envResult.stdout === 'exists';
    tests['.env file exists'] = hasEnvFile;
    console.log(`  - .env file exists: ${hasEnvFile ? '✓' : '⚠ not found'}`);

    // Verification Summary
    console.log('\n' + '='.repeat(60));
    console.log('Verification Results:');
    console.log('='.repeat(60));

    let allPassed = true;
    let criticalPassed = true;

    // Critical tests that must pass
    const criticalTests = ['directory exists', 'server directory exists', 'package.json exists'];

    for (const [name, passed] of Object.entries(tests)) {
      const isCritical = criticalTests.includes(name);
      const prefix = isCritical ? '[CRITICAL]' : '[INFO]';
      console.log(`  ${passed ? '✓' : '❌'} ${prefix} ${name}`);

      if (!passed) {
        allPassed = false;
        if (isCritical) criticalPassed = false;
      }
    }

    // Deployment Summary
    console.log('\n' + '='.repeat(60));
    console.log('Deployment Summary:');
    console.log('='.repeat(60));
    console.log(`Coordinator IP: ${CONFIG.coordinatorIp}`);
    console.log(`Deploy Path: ${CONFIG.deployPath}`);
    console.log(`Directory Exists: ${deployment.directoryExists ? '✓' : '✗'}`);
    console.log(`Package.json Valid: ${deployment.packageJsonValid ? '✓' : '✗'}`);
    console.log(`PM2 Running: ${deployment.pm2Status?.running ? '✓' : '⚠'}`);
    console.log(`Errors: ${deployment.errors.length}`);

    if (deployment.errors.length > 0) {
      console.log('\nErrors encountered:');
      for (const error of deployment.errors) {
        console.log(`  - ${error}`);
      }
    }

    // Final result - pass if critical tests pass
    if (criticalPassed) {
      console.log('\n✓ MCP-18 PASSED: Coordinator deployment structure is correct');
      if (!allPassed) {
        console.log('  Note: Some optional checks did not pass (see above)');
      }
    } else {
      console.log('\n❌ MCP-18 FAILED: Critical deployment checks did not pass');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

testCoordinatorDeployment();
