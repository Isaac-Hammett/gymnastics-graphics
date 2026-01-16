/**
 * Test MCP-22: firebase_get handles non-existent path
 *
 * This test verifies firebase_get returns exists:false for missing paths.
 *
 * Steps:
 * 1. Call firebase_get(project='dev', path='/nonexistent/path/12345')
 * 2. Verify response includes exists: false
 * 3. Verify response includes data: null
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
    }, 'test-mcp-22');
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
  console.log('=== MCP-22 Test: firebase_get handles non-existent path ===\n');

  const results = [];
  const testPath = '/nonexistent/path/12345';

  try {
    // Step 1: Call firebase_get(project='dev', path='/nonexistent/path/12345')
    console.log(`Step 1: Calling firebase_get(project='dev', path='${testPath}')...`);
    const response = await firebaseGet('dev', testPath);
    console.log('       Response received successfully');
    console.log(`       Response: ${JSON.stringify(response, null, 2)}\n`);

    // Step 2: Verify response includes exists: false
    console.log('Step 2: Verifying response includes exists: false...');
    const existsFalse = response.exists === false;
    console.log(`       exists field: ${response.exists}`);
    console.log(`       Result: ${existsFalse ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes exists: false', passed: existsFalse });

    // Step 3: Verify response includes data: null
    console.log('\nStep 3: Verifying response includes data: null...');
    const dataNull = response.data === null;
    console.log(`       data field: ${response.data}`);
    console.log(`       Result: ${dataNull ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes data: null', passed: dataNull });

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
    console.log(`MCP-22: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('\nVerification: firebase_get returns exists:false for missing paths');
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
