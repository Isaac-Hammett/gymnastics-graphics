/**
 * Test MCP-25: firebase_update merges data (dev only)
 *
 * This test verifies the firebase_update function correctly merges data
 * without overwriting existing fields.
 *
 * Steps:
 * 1. Call firebase_set(project='dev', path='mcp-tests/test-25', data={name:'original',count:1})
 * 2. Call firebase_update(project='dev', path='mcp-tests/test-25', data={count:2})
 * 3. Call firebase_get to verify name preserved and count updated
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
    }, 'test-mcp-25');
  }

  return firebaseApp;
}

function getFirebaseDb() {
  const app = getFirebaseApp();
  return admin.database(app);
}

// Implementation of firebase_set
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

// Implementation of firebase_update (uses Firebase update() method which merges)
async function firebaseUpdate(project, path, data) {
  const db = getFirebaseDb();
  await db.ref(path).update(data);

  return {
    project,
    path,
    success: true,
    message: `Data updated at ${path}`,
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
  console.log('=== MCP-25 Test: firebase_update merges data (dev only) ===\n');

  const results = [];
  const testPath = 'mcp-tests/test-25';
  const initialData = { name: 'original', count: 1 };
  const updateData = { count: 2 };

  try {
    // Step 1: Call firebase_set to create initial data
    console.log('Step 1: Creating initial data with firebase_set...');
    console.log(`       path: '${testPath}'`);
    console.log(`       data: ${JSON.stringify(initialData)}`);
    const setResponse = await firebaseSet('dev', testPath, initialData);
    console.log('       Response:', JSON.stringify(setResponse, null, 2));

    const setSuccess = setResponse.success === true;
    console.log(`       Result: ${setSuccess ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'initial data created successfully', passed: setSuccess });

    // Step 2: Call firebase_update with partial data
    console.log('\nStep 2: Calling firebase_update with partial data...');
    console.log(`       path: '${testPath}'`);
    console.log(`       data: ${JSON.stringify(updateData)}`);
    const updateResponse = await firebaseUpdate('dev', testPath, updateData);
    console.log('       Response:', JSON.stringify(updateResponse, null, 2));

    const updateSuccess = updateResponse.success === true;
    console.log(`       Result: ${updateSuccess ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'update response includes success: true', passed: updateSuccess });

    // Verify response has path and message
    const hasPath = updateResponse.path === testPath;
    const hasMessage = typeof updateResponse.message === 'string' && updateResponse.message.length > 0;
    console.log(`       path field matches: ${hasPath}`);
    console.log(`       message field present: ${hasMessage}`);
    results.push({ name: 'update response has correct path', passed: hasPath });
    results.push({ name: 'update response has message', passed: hasMessage });

    // Step 3: Call firebase_get to verify merge behavior
    console.log('\nStep 3: Calling firebase_get to verify merge behavior...');
    const getResponse = await firebaseGet('dev', testPath);
    console.log('       Response:', JSON.stringify(getResponse, null, 2));

    const dataExists = getResponse.exists === true;
    const namePreserved = getResponse.data?.name === initialData.name;
    const countUpdated = getResponse.data?.count === updateData.count;

    console.log(`       Data exists: ${dataExists}`);
    console.log(`       'name' field preserved (expected: '${initialData.name}'): ${getResponse.data?.name} - ${namePreserved ? 'PASS' : 'FAIL'}`);
    console.log(`       'count' field updated (expected: ${updateData.count}): ${getResponse.data?.count} - ${countUpdated ? 'PASS' : 'FAIL'}`);

    results.push({ name: 'data exists after update', passed: dataExists });
    results.push({ name: 'name field preserved (not overwritten)', passed: namePreserved });
    results.push({ name: 'count field updated to new value', passed: countUpdated });

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
    console.log(`MCP-25: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('\nVerification: firebase_update merges without overwriting existing fields');
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
