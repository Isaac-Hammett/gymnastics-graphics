#!/usr/bin/env node

/**
 * Test script for MCP-11: Test ssh_upload_file and ssh_download_file roundtrip
 *
 * Tests that file upload and download via SSH/SCP preserves content integrity:
 * 1. Create a local test file with unique content in /tmp/claude/
 * 2. Call ssh_upload_file to upload to /tmp/mcp-test-file.txt on coordinator
 * 3. Verify upload response has success=true
 * 4. Call ssh_exec to cat the uploaded file
 * 5. Verify file contents match original
 * 6. Call ssh_download_file to download to different local path
 * 7. Verify download response has success=true
 * 8. Verify downloaded content matches original
 */

import { NodeSSH } from 'node-ssh';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG = {
  sshKeyPath: join(homedir(), '.ssh', 'gymnastics-graphics-key-pair.pem'),
  sshUsername: 'ubuntu',
  coordinatorIp: '44.193.31.120',
  sshTimeout: 30000,
  commandTimeout: 60000,
};

// Local paths for test files
const LOCAL_DIR = '/tmp/claude';
const TIMESTAMP = Date.now();
const LOCAL_UPLOAD_PATH = join(LOCAL_DIR, `mcp-test-upload-${TIMESTAMP}.txt`);
const LOCAL_DOWNLOAD_PATH = join(LOCAL_DIR, `mcp-test-download-${TIMESTAMP}.txt`);
const REMOTE_PATH = '/tmp/mcp-test-file.txt';

// Unique test content
const TEST_CONTENT = `MCP-11 Test File
Timestamp: ${TIMESTAMP}
Random: ${Math.random().toString(36).substring(7)}
This file tests ssh_upload_file and ssh_download_file roundtrip.
Gymnastics Graphics MCP Server Test
`;

// Simulates ssh_upload_file from MCP server
async function sshUploadFile(target, localPath, remotePath) {
  const ip = target === 'coordinator' ? CONFIG.coordinatorIp : target;
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: ip,
      username: CONFIG.sshUsername,
      privateKeyPath: CONFIG.sshKeyPath,
      readyTimeout: CONFIG.sshTimeout,
    });

    await ssh.putFile(localPath, remotePath);
    return {
      target: ip,
      localPath,
      remotePath,
      success: true,
      message: `File uploaded successfully to ${ip}:${remotePath}`
    };
  } catch (error) {
    return {
      target: ip,
      localPath,
      remotePath,
      success: false,
      error: error.message
    };
  } finally {
    ssh.dispose();
  }
}

// Simulates ssh_download_file from MCP server
async function sshDownloadFile(target, remotePath, localPath) {
  const ip = target === 'coordinator' ? CONFIG.coordinatorIp : target;
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: ip,
      username: CONFIG.sshUsername,
      privateKeyPath: CONFIG.sshKeyPath,
      readyTimeout: CONFIG.sshTimeout,
    });

    await ssh.getFile(localPath, remotePath);
    return {
      target: ip,
      remotePath,
      localPath,
      success: true,
      message: `File downloaded successfully to ${localPath}`
    };
  } catch (error) {
    return {
      target: ip,
      remotePath,
      localPath,
      success: false,
      error: error.message
    };
  } finally {
    ssh.dispose();
  }
}

// Simulates ssh_exec from MCP server
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
      stdout: result.stdout,
      stderr: result.stderr,
      success: result.code === 0
    };
  } finally {
    ssh.dispose();
  }
}

// Cleanup function
function cleanup() {
  try {
    if (existsSync(LOCAL_UPLOAD_PATH)) {
      unlinkSync(LOCAL_UPLOAD_PATH);
      console.log(`  Cleaned up: ${LOCAL_UPLOAD_PATH}`);
    }
    if (existsSync(LOCAL_DOWNLOAD_PATH)) {
      unlinkSync(LOCAL_DOWNLOAD_PATH);
      console.log(`  Cleaned up: ${LOCAL_DOWNLOAD_PATH}`);
    }
  } catch (e) {
    console.log(`  Cleanup warning: ${e.message}`);
  }
}

async function testFileTransferRoundtrip() {
  console.log('MCP-11: Testing ssh_upload_file and ssh_download_file roundtrip\n');
  console.log('This test verifies that file upload and download preserve content integrity.\n');

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    console.log(`❌ SSH key not found at ${CONFIG.sshKeyPath}`);
    process.exit(1);
  }
  console.log(`✓ SSH key found at ${CONFIG.sshKeyPath}`);

  const tests = {};
  let uploadResponse, execResponse, downloadResponse;

  try {
    // Step 1: Create local test file with unique content in /tmp/claude/
    console.log('\nStep 1: Creating local test file with unique content...');
    if (!existsSync(LOCAL_DIR)) {
      mkdirSync(LOCAL_DIR, { recursive: true });
      console.log(`  Created directory: ${LOCAL_DIR}`);
    }
    writeFileSync(LOCAL_UPLOAD_PATH, TEST_CONTENT, 'utf8');
    console.log(`  Created: ${LOCAL_UPLOAD_PATH}`);
    console.log(`  Content length: ${TEST_CONTENT.length} bytes`);
    console.log(`  Content preview: "${TEST_CONTENT.split('\n')[0]}..."`);

    tests['local test file created'] = existsSync(LOCAL_UPLOAD_PATH);

    // Step 2: Upload file to coordinator
    console.log('\nStep 2: Uploading file to coordinator via ssh_upload_file...');
    console.log(`  Local path: ${LOCAL_UPLOAD_PATH}`);
    console.log(`  Remote path: ${REMOTE_PATH}`);

    uploadResponse = await sshUploadFile('coordinator', LOCAL_UPLOAD_PATH, REMOTE_PATH);
    console.log('\nUpload Response:');
    console.log(JSON.stringify(uploadResponse, null, 2));

    tests['upload response has success=true'] = uploadResponse.success === true;
    tests['upload response has target'] = 'target' in uploadResponse;
    tests['upload response has localPath'] = 'localPath' in uploadResponse;
    tests['upload response has remotePath'] = 'remotePath' in uploadResponse;
    tests['upload response has message'] = 'message' in uploadResponse;

    if (!uploadResponse.success) {
      throw new Error(`Upload failed: ${uploadResponse.error}`);
    }

    // Step 3: Verify file exists on remote by cat'ing it
    console.log('\nStep 3: Verifying uploaded file contents via ssh_exec...');
    execResponse = await sshExec('coordinator', `cat ${REMOTE_PATH}`);
    console.log('\nExec Response:');
    console.log(JSON.stringify(execResponse, null, 2));

    tests['ssh_exec to cat file succeeded'] = execResponse.success === true;

    // Step 4: Verify file contents match original
    // Note: cat via SSH may strip trailing newlines, so we compare trimmed versions
    console.log('\nStep 4: Comparing uploaded content with original...');
    const remoteContent = execResponse.stdout;
    // SSH stdout often strips trailing newlines, so compare trimmed content
    const contentMatchesTrimmed = remoteContent.trim() === TEST_CONTENT.trim();
    tests['uploaded file contents match original (trimmed comparison)'] = contentMatchesTrimmed;
    console.log(`  Original length: ${TEST_CONTENT.length}`);
    console.log(`  Remote length: ${remoteContent.length}`);
    console.log(`  Contents match (trimmed): ${contentMatchesTrimmed}`);

    if (!contentMatchesTrimmed) {
      console.log('  Diff:');
      console.log(`    Expected: "${TEST_CONTENT.substring(0, 50)}..."`);
      console.log(`    Got:      "${remoteContent.substring(0, 50)}..."`);
    }

    // Step 5: Download file to different local path
    console.log('\nStep 5: Downloading file to different local path via ssh_download_file...');
    console.log(`  Remote path: ${REMOTE_PATH}`);
    console.log(`  Local path: ${LOCAL_DOWNLOAD_PATH}`);

    downloadResponse = await sshDownloadFile('coordinator', REMOTE_PATH, LOCAL_DOWNLOAD_PATH);
    console.log('\nDownload Response:');
    console.log(JSON.stringify(downloadResponse, null, 2));

    tests['download response has success=true'] = downloadResponse.success === true;
    tests['download response has target'] = 'target' in downloadResponse;
    tests['download response has remotePath'] = 'remotePath' in downloadResponse;
    tests['download response has localPath'] = 'localPath' in downloadResponse;
    tests['download response has message'] = 'message' in downloadResponse;

    if (!downloadResponse.success) {
      throw new Error(`Download failed: ${downloadResponse.error}`);
    }

    // Step 6: Verify downloaded file exists and contents match
    console.log('\nStep 6: Verifying downloaded file contents...');
    tests['downloaded file exists'] = existsSync(LOCAL_DOWNLOAD_PATH);

    if (existsSync(LOCAL_DOWNLOAD_PATH)) {
      const downloadedContent = readFileSync(LOCAL_DOWNLOAD_PATH, 'utf8');
      const downloadedMatches = downloadedContent === TEST_CONTENT;
      tests['downloaded file contents match original'] = downloadedMatches;
      console.log(`  Downloaded length: ${downloadedContent.length}`);
      console.log(`  Contents match original: ${downloadedMatches}`);
    }

    // Step 7: Clean up remote file
    console.log('\nStep 7: Cleaning up remote test file...');
    const cleanupResult = await sshExec('coordinator', `rm -f ${REMOTE_PATH}`);
    console.log(`  Remote cleanup: ${cleanupResult.success ? 'success' : 'failed'}`);

    // Print verification summary
    console.log('\n' + '='.repeat(60));
    console.log('Verification Results:');
    let allPassed = true;
    for (const [name, passed] of Object.entries(tests)) {
      console.log(`  ${passed ? '✓' : '❌'} ${name}`);
      if (!passed) allPassed = false;
    }

    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('✓ MCP-11 PASSED: File upload and download preserve content integrity');
    } else {
      console.log('❌ MCP-11 FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    console.log('\nStep 8: Cleaning up local test files...');
    cleanup();
  }
}

testFileTransferRoundtrip();
