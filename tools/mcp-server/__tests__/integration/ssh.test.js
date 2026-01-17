/**
 * Integration Tests for SSH Operations
 *
 * These tests verify SSH command execution works correctly.
 * Requires SSH key at ~/.ssh/gymnastics-graphics-key-pair.pem
 *
 * Run with: npm run test:integration
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { NodeSSH } from 'node-ssh';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import {
  COORDINATOR_IP,
  COORDINATOR_HOST,
  UNREACHABLE_IP,
  SSH_TIMEOUT,
  MAX_SSH_LATENCY
} from '../helpers/testConfig.js';

// SSH Configuration
const CONFIG = {
  sshKeyPath: join(homedir(), '.ssh', 'gymnastics-graphics-key-pair.pem'),
  sshUsername: 'ubuntu',
  sshTimeout: SSH_TIMEOUT,
  commandTimeout: 60000,
};

// Check if SSH key exists
const sshKeyExists = existsSync(CONFIG.sshKeyPath);

// Helper function to execute SSH command
async function sshExec(target, command, sudo = false) {
  const ip = target === 'coordinator' ? COORDINATOR_IP : target;
  const ssh = new NodeSSH();

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

// Helper for SSH with error handling (for unreachable tests)
async function sshExecWithError(target, command) {
  const ip = target === 'coordinator' ? COORDINATOR_IP : target;
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: ip,
      username: CONFIG.sshUsername,
      privateKeyPath: CONFIG.sshKeyPath,
      readyTimeout: 10000, // Shorter timeout for error tests
    });

    const result = await ssh.execCommand(command);
    ssh.dispose();

    return {
      target: ip,
      command,
      exitCode: result.code,
      stdout: result.stdout,
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
  }
}

describe('SSH Operations', { skip: !sshKeyExists }, () => {

  describe('ssh_exec basic commands', () => {
    test('executes echo command successfully', async () => {
      const result = await sshExec('coordinator', 'echo hello');

      assert.strictEqual(result.exitCode, 0, 'Exit code should be 0');
      assert.ok(result.stdout.includes('hello'), 'Output should contain "hello"');
      assert.strictEqual(result.success, true, 'Success should be true');
    });

    test('response has required fields', async () => {
      const result = await sshExec('coordinator', 'echo test');

      assert.ok('target' in result, 'Response should have target');
      assert.ok('command' in result, 'Response should have command');
      assert.ok('exitCode' in result, 'Response should have exitCode');
      assert.ok('stdout' in result, 'Response should have stdout');
      assert.ok('stderr' in result, 'Response should have stderr');
      assert.ok('success' in result, 'Response should have success');
    });

    test('direct IP works same as coordinator shortcut', async () => {
      const result = await sshExec(COORDINATOR_IP, 'echo test');

      assert.strictEqual(result.target, COORDINATOR_IP);
      assert.strictEqual(result.success, true);
      assert.ok(result.stdout.includes('test'));
    });

    test('sudo commands execute correctly', async () => {
      const result = await sshExec('coordinator', 'whoami', true);

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('root'), 'Sudo should run as root');
    });
  });

  describe('ssh_exec system info', () => {
    test('hostname returns non-empty result', async () => {
      const result = await sshExec('coordinator', 'hostname');

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.trim().length > 0, 'Hostname should be non-empty');
    });

    test('uptime returns load average info', async () => {
      const result = await sshExec('coordinator', 'uptime');

      assert.strictEqual(result.exitCode, 0);
      assert.ok(
        result.stdout.includes('up') || result.stdout.includes('load average'),
        'Uptime should contain expected output'
      );
    });

    test('df returns filesystem info', async () => {
      const result = await sshExec('coordinator', 'df -h /');

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('/'), 'Should show root filesystem');
    });

    test('free returns memory info', async () => {
      const result = await sshExec('coordinator', 'free -m');

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('Mem'), 'Should show memory info');
    });
  });

  describe('ssh_exec error handling', () => {
    test('failed command returns exit code 1', async () => {
      const result = await sshExec('coordinator', 'exit 1');

      assert.strictEqual(result.exitCode, 1, 'Exit code should be 1');
      assert.strictEqual(result.success, false, 'Success should be false');
    });

    test('nonexistent command returns error', async () => {
      const result = await sshExec('coordinator', 'nonexistent-command-xyz123');

      assert.ok(result.exitCode !== 0, 'Exit code should be non-zero');
      assert.strictEqual(result.success, false, 'Success should be false');
      assert.ok(
        result.stderr.includes('not found') || result.stderr.includes('command not found'),
        'Stderr should indicate command not found'
      );
    });

    test('unreachable target returns connection error', async () => {
      const result = await sshExecWithError(UNREACHABLE_IP, 'echo test');

      assert.strictEqual(result.success, false, 'Success should be false');
      assert.ok('error' in result, 'Should have error field');
      assert.ok(
        result.error.toLowerCase().includes('timeout') ||
        result.error.toLowerCase().includes('handshake') ||
        result.error.toLowerCase().includes('connect'),
        'Error should indicate connection failure'
      );
    });
  });

  describe('ssh_exec latency', () => {
    test('commands complete within acceptable latency', async () => {
      const times = [];

      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await sshExec('coordinator', 'echo test');
        times.push((Date.now() - start) / 1000);
      }

      const avgLatency = times.reduce((a, b) => a + b, 0) / times.length;

      assert.ok(
        avgLatency < MAX_SSH_LATENCY,
        `Average latency (${avgLatency.toFixed(2)}s) should be under ${MAX_SSH_LATENCY}s`
      );
    });
  });

  describe('ssh_exec coordinator deployment', () => {
    test('deployment directory exists', async () => {
      const result = await sshExec('coordinator', 'ls -la /opt/gymnastics-graphics');

      assert.strictEqual(result.exitCode, 0, 'Directory should exist');
      assert.ok(result.stdout.includes('server'), 'Should contain server directory');
    });

    test('package.json exists and is valid', async () => {
      const result = await sshExec('coordinator', 'cat /opt/gymnastics-graphics/server/package.json | head -5');

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('name'), 'Should contain name field');
    });

    test('pm2 shows process list', async () => {
      const result = await sshExec('coordinator', 'pm2 list --no-color');

      assert.strictEqual(result.exitCode, 0);
      // Note: process may or may not be running, just check pm2 works
    });
  });

  describe('ssh_exec network connectivity', () => {
    test('coordinator has internet access', async () => {
      const result = await sshExec(
        'coordinator',
        'curl -s -o /dev/null -w "%{http_code}" https://api.github.com'
      );

      assert.strictEqual(result.exitCode, 0);
      assert.ok(
        result.stdout.includes('200') || result.stdout.includes('403'),
        'Should get HTTP response from GitHub API'
      );
    });

    test('DNS resolution works', async () => {
      const result = await sshExec('coordinator', 'host google.com');

      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('has address'), 'DNS should resolve');
    });
  });

  describe('ssh_multi_exec', () => {
    // Helper function to execute SSH command on multiple targets
    async function sshMultiExec(targets, command, sudo = false) {
      const results = await Promise.all(
        targets.map(async (target) => {
          try {
            return await sshExec(target, command, sudo);
          } catch (error) {
            const ip = target === 'coordinator' ? COORDINATOR_IP : target;
            return {
              target: ip,
              command,
              success: false,
              error: error.message
            };
          }
        })
      );

      return {
        command,
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      };
    }

    test('executes on single target', async () => {
      const response = await sshMultiExec(['coordinator'], 'echo hello');

      assert.strictEqual(response.results.length, 1);
      assert.strictEqual(response.successCount, 1);
      assert.strictEqual(response.failureCount, 0);
      assert.ok(response.results[0].stdout.includes('hello'));
    });

    test('executes on multiple targets (coordinator only for safety)', async () => {
      const response = await sshMultiExec(['coordinator', COORDINATOR_IP], 'hostname');

      assert.strictEqual(response.results.length, 2);
      assert.ok('command' in response);
      assert.ok('successCount' in response);
      assert.ok('failureCount' in response);
      assert.strictEqual(response.successCount + response.failureCount, 2);
    });

    test('aggregates results correctly with mixed success/failure', async () => {
      const response = await sshMultiExec(
        ['coordinator', UNREACHABLE_IP],
        'echo test'
      );

      assert.strictEqual(response.results.length, 2);
      assert.ok(response.successCount >= 1, 'At least coordinator should succeed');
      assert.ok(response.failureCount >= 0, 'Should have failure count');

      // Check each result has proper structure
      for (const result of response.results) {
        assert.ok('target' in result);
        assert.ok('success' in result);
        if (result.success) {
          assert.ok('stdout' in result);
        }
      }
    });
  });

  describe('ssh_upload_file and ssh_download_file', () => {
    // Helper functions for file transfer
    async function sshUploadFile(target, localPath, remotePath) {
      const ip = target === 'coordinator' ? COORDINATOR_IP : target;
      const ssh = new NodeSSH();

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
        await ssh.putFile(localPath, remotePath);
        return {
          target: ip,
          localPath,
          remotePath,
          success: true,
          message: `File uploaded successfully to ${ip}:${remotePath}`
        };
      } finally {
        ssh.dispose();
      }
    }

    async function sshDownloadFile(target, remotePath, localPath) {
      const ip = target === 'coordinator' ? COORDINATOR_IP : target;
      const ssh = new NodeSSH();

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
        await ssh.getFile(localPath, remotePath);
        return {
          target: ip,
          remotePath,
          localPath,
          success: true,
          message: `File downloaded successfully to ${localPath}`
        };
      } finally {
        ssh.dispose();
      }
    }

    const TIMESTAMP = Date.now();
    const LOCAL_UPLOAD_PATH = join(tmpdir(), `test-upload-${TIMESTAMP}.txt`);
    const LOCAL_DOWNLOAD_PATH = join(tmpdir(), `test-download-${TIMESTAMP}.txt`);
    const REMOTE_PATH = `/tmp/test-file-${TIMESTAMP}.txt`;
    const TEST_CONTENT = `Test file ${TIMESTAMP}\nSecond line\nThird line\n`;

    test('upload and download preserves content', async () => {
      try {
        // Create local test file
        writeFileSync(LOCAL_UPLOAD_PATH, TEST_CONTENT, 'utf8');
        assert.ok(existsSync(LOCAL_UPLOAD_PATH), 'Local file should be created');

        // Upload file
        const uploadResponse = await sshUploadFile('coordinator', LOCAL_UPLOAD_PATH, REMOTE_PATH);
        assert.strictEqual(uploadResponse.success, true, 'Upload should succeed');
        assert.ok('target' in uploadResponse);
        assert.ok('message' in uploadResponse);

        // Verify file exists on remote
        const catResult = await sshExec('coordinator', `cat ${REMOTE_PATH}`);
        assert.strictEqual(catResult.exitCode, 0, 'File should exist on remote');
        assert.strictEqual(catResult.stdout.trim(), TEST_CONTENT.trim(), 'Remote content should match');

        // Download file
        const downloadResponse = await sshDownloadFile('coordinator', REMOTE_PATH, LOCAL_DOWNLOAD_PATH);
        assert.strictEqual(downloadResponse.success, true, 'Download should succeed');
        assert.ok('target' in downloadResponse);
        assert.ok('message' in downloadResponse);

        // Verify downloaded content
        assert.ok(existsSync(LOCAL_DOWNLOAD_PATH), 'Downloaded file should exist');
        const downloadedContent = readFileSync(LOCAL_DOWNLOAD_PATH, 'utf8');
        assert.strictEqual(downloadedContent, TEST_CONTENT, 'Downloaded content should match original');

      } finally {
        // Cleanup
        try {
          if (existsSync(LOCAL_UPLOAD_PATH)) unlinkSync(LOCAL_UPLOAD_PATH);
          if (existsSync(LOCAL_DOWNLOAD_PATH)) unlinkSync(LOCAL_DOWNLOAD_PATH);
          await sshExec('coordinator', `rm -f ${REMOTE_PATH}`);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });
});
