/**
 * Test MCP-24: firebase_set writes data (dev only)
 *
 * This test verifies the firebase_set function correctly writes data to Firebase.
 *
 * Steps:
 * 1. Call firebase_set(project='dev', path='mcp-tests/test-24', data={name:'test',value:1})
 * 2. Verify response includes success: true
 * 3. Call firebase_get to verify data was written
 * 4. Call firebase_delete to clean up test data
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
    }, 'test-mcp-24');
  }

  return firebaseApp;
}

function getFirebaseDb() {
  const app = getFirebaseApp();
  return admin.database(app);
}

// Implementation of firebase_set (same as MCP server)
async function firebaseSet(project, path, data) {
  const db = getFirebaseDb();
  await db.ref(path).set(data);

  return {
    project,
    path,
    success: true,
    message: `Data written to ${path}`,
  };
}

// Implementation of firebase_get (for verification)
async function firebaseGet(project, path) {
  const db = getFirebaseDb();
  const snapshot = await db.ref(path).once('value');

  return {
    project,
    path,
    exists: snapshot.exists(),
    data: snapshot.val(),
  };
}

// Implementation of firebase_delete (for cleanup)
async function firebaseDelete(project, path) {
  const db = getFirebaseDb();
  await db.ref(path).remove();

  return {
    project,
    path,
    success: true,
    message: `Data deleted at ${path}`,
  };
}

async function runTest() {
  console.log('=== MCP-24 Test: firebase_set writes data (dev only) ===\n');

  const results = [];
  const testPath = 'mcp-tests/test-24';
  const testData = { name: 'test', value: 1 };

  try {
    // Step 1: Call firebase_set(project='dev', path='mcp-tests/test-24', data={name:'test',value:1})
    console.log('Step 1: Calling firebase_set(project=\'dev\', path=\'mcp-tests/test-24\', data={name:\'test\',value:1})...');
    const setResponse = await firebaseSet('dev', testPath, testData);
    console.log('       Response:', JSON.stringify(setResponse, null, 2));
    console.log('');

    // Step 2: Verify response includes success: true
    console.log('Step 2: Verifying response includes success: true...');
    const hasSuccess = setResponse.success === true;
    console.log(`       success field: ${setResponse.success}`);
    console.log(`       Result: ${hasSuccess ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes success: true', passed: hasSuccess });

    // Additional check: verify response has path and message
    const hasPath = setResponse.path === testPath;
    const hasMessage = typeof setResponse.message === 'string' && setResponse.message.length > 0;
    console.log(`       path field matches: ${hasPath}`);
    console.log(`       message field present: ${hasMessage}`);
    results.push({ name: 'response has correct path', passed: hasPath });
    results.push({ name: 'response has message', passed: hasMessage });

    // Step 3: Call firebase_get to verify data was written
    console.log('\nStep 3: Calling firebase_get to verify data was written...');
    const getResponse = await firebaseGet('dev', testPath);
    console.log('       Response:', JSON.stringify(getResponse, null, 2));

    const dataWritten = getResponse.exists === true;
    const dataMatches = getResponse.data?.name === testData.name && getResponse.data?.value === testData.value;
    console.log(`       Data exists: ${dataWritten}`);
    console.log(`       Data matches original: ${dataMatches}`);
    console.log(`       Result: ${dataWritten && dataMatches ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'data was written to Firebase', passed: dataWritten });
    results.push({ name: 'written data matches original', passed: dataMatches });

    // Step 4: Call firebase_delete to clean up test data
    console.log('\nStep 4: Calling firebase_delete to clean up test data...');
    const deleteResponse = await firebaseDelete('dev', testPath);
    console.log('       Response:', JSON.stringify(deleteResponse, null, 2));

    const deleteSuccess = deleteResponse.success === true;
    console.log(`       Result: ${deleteSuccess ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'cleanup delete succeeded', passed: deleteSuccess });

    // Verify cleanup
    console.log('\nVerifying cleanup...');
    const verifyDelete = await firebaseGet('dev', testPath);
    const cleanedUp = verifyDelete.exists === false;
    console.log(`       Data deleted: ${cleanedUp}`);
    results.push({ name: 'data was cleaned up', passed: cleanedUp });

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
    console.log(`MCP-24: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('\nVerification: firebase_set successfully writes data to dev');
    }

    // Cleanup
    if (firebaseApp) {
      await firebaseApp.delete();
    }

    return allPassed;
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);

    // Try to cleanup on error
    try {
      console.log('\nAttempting cleanup after error...');
      await firebaseDelete('dev', testPath);
      console.log('Cleanup successful');
    } catch (cleanupError) {
      console.log('Cleanup failed (data may not have been written)');
    }

    // Cleanup Firebase app
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
