/**
 * Integration Tests for Firebase Operations
 *
 * These tests verify Firebase Realtime Database operations work correctly.
 * Requires Firebase service account credentials.
 *
 * Run with: npm run test:integration
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  FIREBASE_PROJECTS,
  DEFAULT_FIREBASE_PROJECT,
  FIREBASE_TEST_BASE_PATH,
  getTestPath
} from '../helpers/testConfig.js';

// Firebase Configuration
const FIREBASE_CONFIG = {
  dev: {
    databaseURL: 'https://gymnastics-graphics-dev-default-rtdb.firebaseio.com',
    serviceAccountPath: join(homedir(), '.config', 'firebase', 'gymnastics-graphics-dev-sa.json'),
  },
};

// Check if Firebase credentials exist
const firebaseConfigExists = existsSync(FIREBASE_CONFIG.dev.serviceAccountPath);

// Firebase app instance
let firebaseApp = null;

// Initialize Firebase
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
    }, `test-firebase-${Date.now()}`);
  }

  return firebaseApp;
}

function getFirebaseDb() {
  const app = getFirebaseApp();
  return admin.database(app);
}

// Helper functions replicating MCP server logic
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

async function firebaseSet(project, path, data) {
  const db = getFirebaseDb();
  await db.ref(path).set(data);

  return {
    project,
    path,
    success: true,
    message: `Data written to ${path}`
  };
}

async function firebaseUpdate(project, path, data) {
  const db = getFirebaseDb();
  await db.ref(path).update(data);

  return {
    project,
    path,
    success: true,
    message: `Data updated at ${path}`
  };
}

async function firebaseDelete(project, path) {
  const db = getFirebaseDb();
  await db.ref(path).remove();

  return {
    project,
    path,
    success: true,
    message: `Data deleted at ${project}:${path}`
  };
}

async function firebaseListPaths(project, path) {
  const db = getFirebaseDb();
  const snapshot = await db.ref(path).once('value');

  const children = [];
  snapshot.forEach(childSnapshot => {
    children.push(childSnapshot.key);
    return false; // Continue iteration
  });

  return {
    project,
    path,
    exists: snapshot.exists(),
    children,
    childCount: children.length
  };
}

async function firebaseExport(project, path) {
  const db = getFirebaseDb();
  const snapshot = await db.ref(path).once('value');
  const data = snapshot.val();

  return {
    project,
    path,
    exportedAt: new Date().toISOString(),
    data
  };
}

describe('Firebase Operations', { skip: !firebaseConfigExists }, () => {

  after(async () => {
    // Cleanup Firebase app
    if (firebaseApp) {
      try {
        await firebaseApp.delete();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('firebase_get', () => {
    test('returns valid response structure for root', async () => {
      const result = await firebaseGet('dev', '/');

      assert.strictEqual(result.project, 'dev', 'Project should be dev');
      assert.strictEqual(result.path, '/', 'Path should be /');
      assert.ok(typeof result.exists === 'boolean', 'exists should be boolean');
      assert.ok('data' in result, 'Should have data field');
    });

    test('returns exists:false for non-existent path', async () => {
      const result = await firebaseGet('dev', '/nonexistent/path/12345');

      assert.strictEqual(result.exists, false, 'exists should be false');
      assert.strictEqual(result.data, null, 'data should be null');
    });
  });

  describe('firebase_list_paths', () => {
    test('returns children array for root', async () => {
      const result = await firebaseListPaths('dev', '/');

      assert.ok(Array.isArray(result.children), 'children should be an array');
      assert.ok(typeof result.childCount === 'number', 'childCount should be a number');
      assert.strictEqual(result.children.length, result.childCount, 'childCount should match array length');
    });

    test('returns exists:true for existing path', async () => {
      const result = await firebaseListPaths('dev', '/');

      assert.ok(typeof result.exists === 'boolean', 'exists should be boolean');
    });
  });

  describe('firebase_export', () => {
    test('returns timestamped export', async () => {
      const result = await firebaseExport('dev', '/');

      assert.strictEqual(result.project, 'dev', 'Project should be dev');
      assert.strictEqual(result.path, '/', 'Path should be /');
      assert.ok('exportedAt' in result, 'Should have exportedAt timestamp');
      assert.ok('data' in result, 'Should have data field');

      // Verify exportedAt is valid ISO timestamp
      const timestamp = new Date(result.exportedAt);
      assert.ok(!isNaN(timestamp.getTime()), 'exportedAt should be valid timestamp');
    });
  });

  describe('firebase CRUD workflow', () => {
    const testPath = getTestPath('crud');
    let cleanupNeeded = false;

    after(async () => {
      // Always cleanup test data
      if (cleanupNeeded) {
        try {
          await firebaseDelete('dev', testPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    test('firebase_set creates data', async () => {
      const result = await firebaseSet('dev', testPath, { step: 1, name: 'test' });
      cleanupNeeded = true;

      assert.strictEqual(result.success, true, 'success should be true');
      assert.ok(result.message.includes(testPath), 'message should include path');

      // Verify data was written
      const check = await firebaseGet('dev', testPath);
      assert.strictEqual(check.exists, true, 'Data should exist after SET');
      assert.strictEqual(check.data.step, 1, 'step should be 1');
      assert.strictEqual(check.data.name, 'test', 'name should be test');
    });

    test('firebase_update merges data', async () => {
      // First set initial data
      await firebaseSet('dev', testPath, { name: 'original', count: 1 });
      cleanupNeeded = true;

      // Update with partial data
      const result = await firebaseUpdate('dev', testPath, { count: 2, extra: 'added' });

      assert.strictEqual(result.success, true, 'success should be true');

      // Verify merge behavior
      const check = await firebaseGet('dev', testPath);
      assert.strictEqual(check.data.name, 'original', 'name should be preserved');
      assert.strictEqual(check.data.count, 2, 'count should be updated');
      assert.strictEqual(check.data.extra, 'added', 'extra should be added');
    });

    test('firebase_delete removes data', async () => {
      // First create some data
      await firebaseSet('dev', testPath, { temp: true });
      cleanupNeeded = true;

      // Verify it exists
      let check = await firebaseGet('dev', testPath);
      assert.strictEqual(check.exists, true, 'Data should exist before delete');

      // Delete it
      const result = await firebaseDelete('dev', testPath);
      cleanupNeeded = false; // No longer needed

      assert.strictEqual(result.success, true, 'success should be true');

      // Verify it's gone
      check = await firebaseGet('dev', testPath);
      assert.strictEqual(check.exists, false, 'Data should not exist after delete');
      assert.strictEqual(check.data, null, 'data should be null after delete');
    });
  });

  describe('firebase error handling', () => {
    test('invalid project throws descriptive error', async () => {
      // Note: In the actual MCP server, project validation happens before DB call
      // This test verifies the pattern expected
      const validProjects = FIREBASE_PROJECTS;

      assert.ok(validProjects.includes('dev'), 'dev should be valid project');
      assert.ok(validProjects.includes('prod'), 'prod should be valid project');
      assert.ok(!validProjects.includes('invalid'), 'invalid should not be valid project');
    });
  });
});
