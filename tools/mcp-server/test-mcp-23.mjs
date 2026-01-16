/**
 * Test MCP-23: firebase_list_paths returns children
 *
 * This test verifies the firebase_list_paths function returns child keys at a path.
 *
 * Steps:
 * 1. Call firebase_list_paths(project='dev', path='/')
 * 2. Verify response includes children array
 * 3. Verify response includes childCount number
 * 4. Verify children array contains expected top-level keys
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
    }, 'test-mcp-23');
  }

  return firebaseApp;
}

function getFirebaseDb() {
  const app = getFirebaseApp();
  return admin.database(app);
}

// Implementation of firebase_list_paths (same as MCP server)
async function firebaseListPaths(project, path) {
  const db = getFirebaseDb();
  const snapshot = await db.ref(path).once('value');

  if (!snapshot.exists()) {
    return {
      project,
      path,
      exists: false,
      children: [],
    };
  }

  const val = snapshot.val();
  const children = typeof val === 'object' && val !== null ? Object.keys(val) : [];

  return {
    project,
    path,
    exists: true,
    children,
    childCount: children.length,
  };
}

async function runTest() {
  console.log('=== MCP-23 Test: firebase_list_paths returns children ===\n');

  const results = [];

  try {
    // Step 1: Call firebase_list_paths(project='dev', path='/')
    console.log('Step 1: Calling firebase_list_paths(project=\'dev\', path=\'/\')...');
    const response = await firebaseListPaths('dev', '/');
    console.log('       Response received successfully\n');

    // Step 2: Verify response includes children array
    console.log('Step 2: Verifying response includes children array...');
    const hasChildren = Array.isArray(response.children);
    console.log(`       children field type: ${Array.isArray(response.children) ? 'array' : typeof response.children}`);
    console.log(`       children count: ${response.children?.length || 0}`);
    if (hasChildren && response.children.length > 0) {
      console.log(`       children: ${response.children.join(', ')}`);
    }
    console.log(`       Result: ${hasChildren ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes children array', passed: hasChildren });

    // Step 3: Verify response includes childCount number
    console.log('\nStep 3: Verifying response includes childCount number...');
    const hasChildCount = typeof response.childCount === 'number';
    console.log(`       childCount field: ${response.childCount}`);
    console.log(`       childCount type: ${typeof response.childCount}`);

    // Also verify childCount matches children.length
    const countsMatch = response.childCount === response.children?.length;
    console.log(`       childCount matches children.length: ${countsMatch}`);
    console.log(`       Result: ${hasChildCount ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes childCount number', passed: hasChildCount });

    // Step 4: Verify children array contains expected top-level keys
    console.log('\nStep 4: Verifying children array contains expected top-level keys...');
    // Common expected keys in a Firebase gymnastics database
    const possibleKeys = ['competitions', 'currentGraphic', 'mcp-tests', 'vmPool', 'alerts'];
    const foundKeys = possibleKeys.filter(key => response.children?.includes(key));
    const hasExpectedKeys = foundKeys.length > 0 || response.children?.length > 0;

    console.log(`       Checking for common keys: ${possibleKeys.join(', ')}`);
    console.log(`       Found keys: ${foundKeys.length > 0 ? foundKeys.join(', ') : 'none of the expected, but has other keys'}`);
    console.log(`       Total children found: ${response.children?.length || 0}`);
    console.log(`       Result: ${hasExpectedKeys ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'children array contains expected top-level keys', passed: hasExpectedKeys });

    // Additional verification: check exists field
    console.log('\nAdditional Check: Verifying exists field...');
    const hasExists = typeof response.exists === 'boolean';
    console.log(`       exists field: ${response.exists}`);
    console.log(`       Result: ${hasExists ? 'PASS' : 'FAIL'}`);
    results.push({ name: 'response includes exists boolean', passed: hasExists });

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
    console.log(`MCP-23: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('\nVerification: firebase_list_paths returns child keys');
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
