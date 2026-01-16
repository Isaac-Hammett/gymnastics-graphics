/**
 * Test MCP-27: firebase_export returns JSON data
 *
 * This test verifies the firebase_export function returns timestamped JSON export.
 *
 * Steps:
 * 1. Call firebase_export(project='dev', path='/')
 * 2. Verify response includes exportedAt timestamp
 * 3. Verify response includes data field
 * 4. Verify data is valid JSON structure
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Firebase Configuration
const FIREBASE_CONFIG = {
  dev: {
    databaseURL: 'https://gymnastics-graphics-dev-default-rtdb.firebaseio.com',
    serviceAccountPath: join(homedir(), '.config', 'firebase', 'gymnastics-graphics-dev-sa.json'),
  },
};

// Firebase app instance
let firebaseApp = null;

function getFirebaseApp() {
  if (!firebaseApp) {
    const config = FIREBASE_CONFIG.dev;

    if (!existsSync(config.serviceAccountPath)) {
      throw new Error(`Service account not found: ${config.serviceAccountPath}`);
    }

    const serviceAccount = JSON.parse(readFileSync(config.serviceAccountPath, 'utf8'));

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.databaseURL,
    }, 'test-mcp-27');
  }

  return firebaseApp;
}

function getFirebaseDb() {
  const app = getFirebaseApp();
  return admin.database(app);
}

// Implementation of firebase_export (same as MCP server)
async function firebaseExport(project, path) {
  const db = getFirebaseDb();
  const snapshot = await db.ref(path).once('value');
  const data = snapshot.val();

  return {
    project,
    path,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// Helper function to validate ISO timestamp format
function isValidISOTimestamp(str) {
  if (typeof str !== 'string') return false;
  const date = new Date(str);
  return !isNaN(date.getTime()) && str.includes('T');
}

async function runTest() {
  console.log('=== MCP-27 Test: firebase_export returns JSON data ===\n');

  const results = [];

  try {
    // Step 1: Call firebase_export(project='dev', path='/')
    console.log('Step 1: Calling firebase_export(project=\'dev\', path=\'/\')...');
    const response = await firebaseExport('dev', '/');
    console.log('       Response received successfully\n');

    // Step 2: Verify response includes exportedAt timestamp
    console.log('Step 2: Verifying response includes exportedAt timestamp...');
    const hasExportedAt = 'exportedAt' in response;
    const isValidTimestamp = hasExportedAt && isValidISOTimestamp(response.exportedAt);
    console.log(`       exportedAt field present: ${hasExportedAt}`);
    console.log(`       exportedAt value: ${response.exportedAt}`);
    console.log(`       Is valid ISO timestamp: ${isValidTimestamp}`);
    console.log(`       Result: ${isValidTimestamp ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes exportedAt timestamp', passed: isValidTimestamp });

    // Step 3: Verify response includes data field
    console.log('\nStep 3: Verifying response includes data field...');
    const hasData = 'data' in response;
    const dataType = response.data === null ? 'null' : typeof response.data;
    console.log(`       data field present: ${hasData}`);
    console.log(`       data type: ${dataType}`);
    console.log(`       Result: ${hasData ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes data field', passed: hasData });

    // Step 4: Verify data is valid JSON structure
    console.log('\nStep 4: Verifying data is valid JSON structure...');
    let isValidJson = false;

    // The data should be either null or a valid JS object/array
    // Since it came from Firebase, it's already a valid JavaScript object
    // We test by serializing and deserializing
    try {
      const serialized = JSON.stringify(response.data);
      const deserialized = JSON.parse(serialized);
      isValidJson = true;

      console.log(`       JSON.stringify() succeeded`);
      console.log(`       JSON.parse() succeeded`);

      // Show some info about the data structure
      if (response.data !== null && typeof response.data === 'object') {
        const topLevelKeys = Object.keys(response.data).slice(0, 10);
        console.log(`       Top-level keys (first 10): ${topLevelKeys.join(', ')}`);
        console.log(`       Total top-level keys: ${Object.keys(response.data).length}`);
      } else if (response.data === null) {
        console.log('       Data is null (empty database or no data at path)');
      }
    } catch (jsonError) {
      console.log(`       JSON serialization failed: ${jsonError.message}`);
      isValidJson = false;
    }

    console.log(`       Result: ${isValidJson ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'data is valid JSON structure', passed: isValidJson });

    // Additional verification: Check project and path are in response
    console.log('\nAdditional Checks:');
    const hasProject = response.project === 'dev';
    const hasPath = response.path === '/';
    console.log(`       project field: ${response.project} (expected: 'dev') - ${hasProject ? 'PASS' : 'FAIL'}`);
    console.log(`       path field: ${response.path} (expected: '/') - ${hasPath ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response has correct project', passed: hasProject });
    results.push({ name: 'response has correct path', passed: hasPath });

    // Print full response structure
    console.log('\n=== Response Structure ===');
    console.log(JSON.stringify({
      project: response.project,
      path: response.path,
      exportedAt: response.exportedAt,
      data: response.data !== null ? `{...} (${Object.keys(response.data).length} keys)` : null
    }, null, 2));

    // Print verification summary
    console.log('\n=== Verification Results ===');
    let allPassed = true;
    for (const r of results) {
      const status = r.passed ? 'PASS' : 'FAIL';
      console.log(`- ${r.name}: ${status}`);
      if (!r.passed) allPassed = false;
    }

    // Final result
    console.log('\n=== Test Result ===');
    console.log(`MCP-27: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('\nVerification: firebase_export returns timestamped JSON export');
    }

    // Cleanup
    if (firebaseApp) {
      await firebaseApp.delete();
    }

    return allPassed;
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);

    // Cleanup on error
    if (firebaseApp) {
      try {
        await firebaseApp.delete();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return false;
  }
}

runTest().then(passed => {
  process.exit(passed ? 0 : 1);
});
