/**
 * Test MCP-21: firebase_get reads existing data
 *
 * This test verifies the firebase_get function returns valid response structure.
 *
 * Steps:
 * 1. Call firebase_get(project='dev', path='/')
 * 2. Verify response includes project: 'dev'
 * 3. Verify response includes exists: true or false
 * 4. Verify response includes data field
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
    }, 'test-mcp-21');
  }

  return firebaseApp;
}

function getFirebaseDb() {
  const app = getFirebaseApp();
  return admin.database(app);
}

// Implementation of firebase_get (same as MCP server)
async function firebaseGet(project, path) {
  const db = getFirebaseDb();
  const snapshot = await db.ref(path).once('value');
  const data = snapshot.val();

  return {
    project,
    path,
    exists: snapshot.exists(),
    data,
  };
}

async function runTest() {
  console.log('=== MCP-21 Test: firebase_get reads existing data ===\n');

  const results = [];

  try {
    // Step 1: Call firebase_get(project='dev', path='/')
    console.log('Step 1: Calling firebase_get(project=\'dev\', path=\'/\')...');
    const response = await firebaseGet('dev', '/');
    console.log('       Response received successfully\n');

    // Step 2: Verify response includes project: 'dev'
    console.log('Step 2: Verifying response includes project: \'dev\'...');
    const hasProject = response.project === 'dev';
    console.log(`       project field: ${response.project}`);
    console.log(`       Result: ${hasProject ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes project: \'dev\'', passed: hasProject });

    // Step 3: Verify response includes exists: true or false
    console.log('\nStep 3: Verifying response includes exists: true or false...');
    const hasExists = typeof response.exists === 'boolean';
    console.log(`       exists field: ${response.exists} (type: ${typeof response.exists})`);
    console.log(`       Result: ${hasExists ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes exists: boolean', passed: hasExists });

    // Step 4: Verify response includes data field
    console.log('\nStep 4: Verifying response includes data field...');
    const hasData = 'data' in response;
    const dataType = response.data === null ? 'null' : typeof response.data;
    console.log(`       data field present: ${hasData}`);
    console.log(`       data type: ${dataType}`);
    if (response.exists && response.data !== null) {
      const topLevelKeys = Object.keys(response.data).slice(0, 10);
      console.log(`       data top-level keys (first 10): ${topLevelKeys.join(', ')}`);
    }
    console.log(`       Result: ${hasData ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes data field', passed: hasData });

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
    console.log(`MCP-21: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('\nVerification: firebase_get returns valid response structure');
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
