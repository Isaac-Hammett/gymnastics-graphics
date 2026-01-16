/**
 * Test MCP-29: Test full Firebase CRUD workflow (dev only)
 *
 * This test verifies the complete Create-Read-Update-Delete workflow
 * for Firebase operations using the dev environment.
 *
 * Steps:
 * 1. SET: firebase_set(project='dev', path='mcp-tests/crud-test', data={step:1})
 * 2. GET: firebase_get and verify step:1
 * 3. UPDATE: firebase_update with {step:2, extra:'added'}
 * 4. GET: verify step:2 and extra:'added'
 * 5. DELETE: firebase_delete the test path
 * 6. GET: verify exists:false
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
    }, 'test-mcp-29');
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

// Implementation of firebase_get
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

// Implementation of firebase_update
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

// Implementation of firebase_delete
async function firebaseDelete(project, path) {
  const db = getFirebaseDb();
  await db.ref(path).remove();

  return {
    project,
    path,
    success: true,
    message: `Data deleted at ${project}:${path}`,
  };
}

async function runTest() {
  console.log('=== MCP-29 Test: Full Firebase CRUD Workflow (dev only) ===\n');

  const results = [];
  const testPath = 'mcp-tests/crud-test';

  try {
    // ==================== STEP 1: CREATE ====================
    console.log('Step 1: SET - Creating initial data...');
    console.log(`       firebase_set(project='dev', path='${testPath}', data={step:1})`);

    const setResponse = await firebaseSet('dev', testPath, { step: 1 });
    console.log('       Response:', JSON.stringify(setResponse, null, 2));

    const setSuccess = setResponse.success === true;
    console.log(`       Result: ${setSuccess ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'SET: firebase_set returns success:true', passed: setSuccess });

    // ==================== STEP 2: READ (verify create) ====================
    console.log('\nStep 2: GET - Verifying data was created...');
    console.log(`       firebase_get(project='dev', path='${testPath}')`);

    const getResponse1 = await firebaseGet('dev', testPath);
    console.log('       Response:', JSON.stringify(getResponse1, null, 2));

    const existsAfterCreate = getResponse1.exists === true;
    const stepIs1 = getResponse1.data?.step === 1;
    console.log(`       exists: ${existsAfterCreate ? 'PASS' : 'FAIL'}`);
    console.log(`       step === 1: ${stepIs1 ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'GET: data exists after SET', passed: existsAfterCreate });
    results.push({ name: 'GET: step value is 1', passed: stepIs1 });

    // ==================== STEP 3: UPDATE ====================
    console.log('\nStep 3: UPDATE - Merging additional data...');
    console.log(`       firebase_update(project='dev', path='${testPath}', data={step:2, extra:'added'})`);

    const updateResponse = await firebaseUpdate('dev', testPath, { step: 2, extra: 'added' });
    console.log('       Response:', JSON.stringify(updateResponse, null, 2));

    const updateSuccess = updateResponse.success === true;
    console.log(`       Result: ${updateSuccess ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'UPDATE: firebase_update returns success:true', passed: updateSuccess });

    // ==================== STEP 4: READ (verify update) ====================
    console.log('\nStep 4: GET - Verifying update was applied...');
    console.log(`       firebase_get(project='dev', path='${testPath}')`);

    const getResponse2 = await firebaseGet('dev', testPath);
    console.log('       Response:', JSON.stringify(getResponse2, null, 2));

    const existsAfterUpdate = getResponse2.exists === true;
    const stepIs2 = getResponse2.data?.step === 2;
    const hasExtra = getResponse2.data?.extra === 'added';
    console.log(`       exists: ${existsAfterUpdate ? 'PASS' : 'FAIL'}`);
    console.log(`       step === 2: ${stepIs2 ? 'PASS' : 'FAIL'}`);
    console.log(`       extra === 'added': ${hasExtra ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'GET: data exists after UPDATE', passed: existsAfterUpdate });
    results.push({ name: 'GET: step updated to 2', passed: stepIs2 });
    results.push({ name: 'GET: extra field added', passed: hasExtra });

    // ==================== STEP 5: DELETE ====================
    console.log('\nStep 5: DELETE - Removing test data...');
    console.log(`       firebase_delete(project='dev', path='${testPath}')`);

    const deleteResponse = await firebaseDelete('dev', testPath);
    console.log('       Response:', JSON.stringify(deleteResponse, null, 2));

    const deleteSuccess = deleteResponse.success === true;
    console.log(`       Result: ${deleteSuccess ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'DELETE: firebase_delete returns success:true', passed: deleteSuccess });

    // ==================== STEP 6: READ (verify delete) ====================
    console.log('\nStep 6: GET - Verifying data was deleted...');
    console.log(`       firebase_get(project='dev', path='${testPath}')`);

    const getResponse3 = await firebaseGet('dev', testPath);
    console.log('       Response:', JSON.stringify(getResponse3, null, 2));

    const notExistsAfterDelete = getResponse3.exists === false;
    const dataIsNull = getResponse3.data === null;
    console.log(`       exists === false: ${notExistsAfterDelete ? 'PASS' : 'FAIL'}`);
    console.log(`       data === null: ${dataIsNull ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'GET: exists is false after DELETE', passed: notExistsAfterDelete });
    results.push({ name: 'GET: data is null after DELETE', passed: dataIsNull });

    // ==================== VERIFICATION SUMMARY ====================
    console.log('\n=== Verification Results ===');
    let allPassed = true;
    for (const r of results) {
      const status = r.passed ? 'PASS' : 'FAIL';
      console.log(`- ${r.name}: ${status}`);
      if (!r.passed) allPassed = false;
    }

    // CRUD Summary
    console.log('\n=== CRUD Workflow Summary ===');
    const createPassed = results.slice(0, 3).every(r => r.passed);
    const updatePassed = results.slice(3, 7).every(r => r.passed);
    const deletePassed = results.slice(7).every(r => r.passed);
    console.log(`CREATE (SET + GET verify): ${createPassed ? 'PASS' : 'FAIL'}`);
    console.log(`UPDATE (UPDATE + GET verify): ${updatePassed ? 'PASS' : 'FAIL'}`);
    console.log(`DELETE (DELETE + GET verify): ${deletePassed ? 'PASS' : 'FAIL'}`);

    // Final result
    console.log('\n=== Test Result ===');
    console.log(`MCP-29: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('\nVerification: Complete CRUD workflow succeeds on dev Firebase');
    }

    // Cleanup Firebase app
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
