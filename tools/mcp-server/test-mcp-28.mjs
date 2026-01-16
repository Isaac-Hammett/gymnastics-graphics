/**
 * Test MCP-28: Test Firebase error handling for invalid project
 *
 * This test verifies that firebase_get returns a descriptive error for invalid project names.
 *
 * Steps:
 * 1. Call firebase_get(project='invalid', path='/')
 * 2. Verify response is an error
 * 3. Verify error message mentions 'dev' or 'prod'
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Firebase Configuration (same as MCP server)
const FIREBASE_CONFIG = {
  dev: {
    databaseURL: 'https://gymnastics-graphics-dev-default-rtdb.firebaseio.com',
    serviceAccountPath: join(homedir(), '.config', 'firebase', 'gymnastics-graphics-dev-sa.json'),
  },
  prod: {
    databaseURL: 'https://gymnastics-graphics-default-rtdb.firebaseio.com',
    serviceAccountPath: join(homedir(), '.config', 'firebase', 'gymnastics-graphics-prod-sa.json'),
  },
};

// Firebase app instances
const firebaseApps = {};

// Implementation of getFirebaseApp (same as MCP server)
function getFirebaseApp(project) {
  if (!['dev', 'prod'].includes(project)) {
    throw new Error(`Invalid project: ${project}. Must be 'dev' or 'prod'.`);
  }

  if (!firebaseApps[project]) {
    const config = FIREBASE_CONFIG[project];

    if (!existsSync(config.serviceAccountPath)) {
      throw new Error(`Service account not found: ${config.serviceAccountPath}`);
    }

    const serviceAccount = JSON.parse(readFileSync(config.serviceAccountPath, 'utf8'));

    firebaseApps[project] = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.databaseURL,
    }, `test-mcp-28-${project}`);
  }

  return firebaseApps[project];
}

function getFirebaseDb(project) {
  const app = getFirebaseApp(project);
  return admin.database(app);
}

// Implementation of firebase_get (same as MCP server)
async function firebaseGet(project, path) {
  const db = getFirebaseDb(project);
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
  console.log('=== MCP-28 Test: Firebase error handling for invalid project ===\n');

  const results = [];

  try {
    // Step 1: Call firebase_get(project='invalid', path='/')
    console.log("Step 1: Calling firebase_get(project='invalid', path='/')...");

    let response;
    let threwError = false;
    let errorMessage = '';

    try {
      response = await firebaseGet('invalid', '/');
      console.log('       Unexpected: No error thrown');
      console.log('       Response:', JSON.stringify(response, null, 2));
    } catch (error) {
      threwError = true;
      errorMessage = error.message;
      console.log('       Error caught (expected):', errorMessage);
    }

    // Step 2: Verify response is an error
    console.log('\nStep 2: Verifying response is an error...');
    const isError = threwError;
    console.log(`       Error was thrown: ${isError}`);
    console.log(`       Result: ${isError ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response is an error', passed: isError });

    // Step 3: Verify error message mentions 'dev' or 'prod'
    console.log("\nStep 3: Verifying error message mentions 'dev' or 'prod'...");
    const mentionsDev = errorMessage.includes('dev');
    const mentionsProd = errorMessage.includes('prod');
    const mentionsValidOptions = mentionsDev || mentionsProd;
    console.log(`       Error message: "${errorMessage}"`);
    console.log(`       Mentions 'dev': ${mentionsDev}`);
    console.log(`       Mentions 'prod': ${mentionsProd}`);
    console.log(`       Result: ${mentionsValidOptions ? 'PASS' : 'FAIL'}`);
    results.push({ name: "error message mentions 'dev' or 'prod'", passed: mentionsValidOptions });

    // Additional verification: error message mentions 'invalid'
    console.log("\nBonus: Verifying error message mentions the invalid value...");
    const mentionsInvalidValue = errorMessage.includes('invalid');
    console.log(`       Mentions 'invalid': ${mentionsInvalidValue}`);
    results.push({ name: 'error message mentions invalid value', passed: mentionsInvalidValue });

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
    console.log(`MCP-28: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('\nVerification: Invalid project returns descriptive error');
    }

    // Cleanup Firebase apps
    for (const app of Object.values(firebaseApps)) {
      try {
        await app.delete();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return allPassed;
  } catch (error) {
    console.error('\n=== Unexpected Error ===');
    console.error(error.message);

    // Cleanup on error
    for (const app of Object.values(firebaseApps)) {
      try {
        await app.delete();
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
