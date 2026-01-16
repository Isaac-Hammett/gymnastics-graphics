#!/usr/bin/env node

/**
 * MCP-26: Test firebase_delete removes data (dev only)
 *
 * Steps:
 * 1. Call firebase_set(project='dev', path='mcp-tests/test-26', data={temp:true})
 * 2. Call firebase_delete(project='dev', path='mcp-tests/test-26')
 * 3. Call firebase_get to verify path no longer exists
 * 4. Verify exists: false in response
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const results = [];
function log(message) {
  console.log(message);
}

function assert(condition, message) {
  results.push({ condition, message });
  if (condition) {
    log(`  ✓ ${message}`);
  } else {
    log(`  ✗ ${message}`);
  }
}

async function main() {
  log('\n=== MCP-26: Test firebase_delete removes data (dev only) ===\n');

  // Connect to MCP server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js'],
    cwd: process.cwd()
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  log('Connected to MCP server\n');

  try {
    // Step 1: Create test data with firebase_set
    log('Step 1: Creating test data with firebase_set...');
    const setResult = await client.callTool({
      name: 'firebase_set',
      arguments: {
        project: 'dev',
        path: 'mcp-tests/test-26',
        data: { temp: true }
      }
    });

    const setResponse = JSON.parse(setResult.content[0].text);
    log(`  Set response: ${JSON.stringify(setResponse, null, 2)}`);

    const setSuccess = setResponse.success === true;
    assert(setSuccess, 'test data created successfully');

    if (!setSuccess) {
      log('\nFailed to create test data, cannot continue test');
      await client.close();
      process.exit(1);
    }

    // Verify data exists before delete
    log('\nVerifying data exists before delete...');
    const preDeleteCheck = await client.callTool({
      name: 'firebase_get',
      arguments: {
        project: 'dev',
        path: 'mcp-tests/test-26'
      }
    });
    const preDeleteResponse = JSON.parse(preDeleteCheck.content[0].text);
    log(`  Pre-delete check: exists=${preDeleteResponse.exists}`);
    assert(preDeleteResponse.exists === true, 'data exists before delete');

    // Step 2: Call firebase_delete
    log('\nStep 2: Calling firebase_delete...');
    const deleteResult = await client.callTool({
      name: 'firebase_delete',
      arguments: {
        project: 'dev',
        path: 'mcp-tests/test-26'
      }
    });

    const deleteResponse = JSON.parse(deleteResult.content[0].text);
    log(`  Delete response: ${JSON.stringify(deleteResponse, null, 2)}`);

    // Verify delete response structure
    assert(deleteResponse.success === true, 'delete response includes success: true');
    assert(deleteResponse.path === 'mcp-tests/test-26', 'delete response has correct path');
    assert(deleteResponse.project === 'dev', 'delete response has correct project');
    assert(typeof deleteResponse.message === 'string', 'delete response has message');

    // Step 3 & 4: Call firebase_get to verify path no longer exists
    log('\nStep 3 & 4: Verifying path no longer exists...');
    const getResult = await client.callTool({
      name: 'firebase_get',
      arguments: {
        project: 'dev',
        path: 'mcp-tests/test-26'
      }
    });

    const getResponse = JSON.parse(getResult.content[0].text);
    log(`  Get response: ${JSON.stringify(getResponse, null, 2)}`);

    assert(getResponse.exists === false, 'exists is false after delete');
    assert(getResponse.data === null, 'data is null after delete');

    // Summary
    log('\n=== Verification Results ===');
    const passed = results.filter(r => r.condition).length;
    const failed = results.filter(r => !r.condition).length;
    log(`Passed: ${passed}, Failed: ${failed}`);

    if (failed === 0) {
      log('\n✓ MCP-26 PASSED - firebase_delete successfully removes data');
    } else {
      log('\n✗ MCP-26 FAILED - Some assertions did not pass');
      process.exitCode = 1;
    }

  } catch (error) {
    log(`\nError during test: ${error.message}`);
    console.error(error);
    process.exitCode = 1;
  }

  await client.close();
}

main().catch(console.error);
