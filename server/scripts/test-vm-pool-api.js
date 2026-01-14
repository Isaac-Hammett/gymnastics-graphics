#!/usr/bin/env node
/**
 * VM Pool API End-to-End Test Script
 *
 * Tests all VM pool management API endpoints to verify:
 * - Pool status retrieval
 * - VM start/stop operations
 * - VM assignment to competitions
 * - Release and re-assignment
 *
 * Run with: node server/scripts/test-vm-pool-api.js
 *
 * Requires server running on localhost:3003
 */

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3003';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

/**
 * Run a test case
 */
async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: 'passed' });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
    console.log(`✗ ${name}: ${error.message}`);
  }
}

/**
 * Skip a test with reason
 */
function skip(name, reason) {
  results.skipped++;
  results.tests.push({ name, status: 'skipped', reason });
  console.log(`○ ${name} (skipped: ${reason})`);
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Make an API request
 */
async function api(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));

  return { status: response.status, ok: response.ok, data };
}

// ============================================================
// Test Cases
// ============================================================

async function runTests() {
  console.log('\n========================================');
  console.log('VM Pool API End-to-End Tests');
  console.log('========================================\n');
  console.log(`Server URL: ${BASE_URL}\n`);

  // Check server is running
  try {
    const { ok } = await api('GET', '/api/status');
    if (!ok) throw new Error('Server not responding');
  } catch (error) {
    console.error(`\n❌ Server not running at ${BASE_URL}`);
    console.error('Start the server with: cd server && npm run dev\n');
    process.exit(1);
  }

  // ------------------------------------------------------------
  // Pool Status Tests
  // ------------------------------------------------------------
  console.log('\n--- Pool Status Tests ---\n');

  await test('GET /api/admin/vm-pool returns pool status', async () => {
    const { status, ok, data } = await api('GET', '/api/admin/vm-pool');
    assert(ok, `Expected 200 OK, got ${status}`);
    assert(typeof data.vms !== 'undefined', 'Response should have vms array');
    // When not initialized, returns 'config' and 'counts'. When initialized, returns 'poolConfig' and 'summary'
    assert(
      typeof data.config !== 'undefined' || typeof data.poolConfig !== 'undefined',
      'Response should have config or poolConfig'
    );
    assert(
      typeof data.counts !== 'undefined' || typeof data.summary !== 'undefined',
      'Response should have counts or summary'
    );
  });

  await test('GET /api/admin/vm-pool/config returns pool configuration', async () => {
    const { status, ok, data } = await api('GET', '/api/admin/vm-pool/config');
    assert(ok, `Expected 200 OK, got ${status}`);
    assert(typeof data.warmCount === 'number', 'Config should have warmCount');
    assert(typeof data.maxInstances === 'number', 'Config should have maxInstances');
    assert(typeof data.healthCheckIntervalMs === 'number', 'Config should have healthCheckIntervalMs');
  });

  // Get pool state for later tests
  let poolState;
  let isInitialized;
  await test('Pool state is valid structure', async () => {
    const { data } = await api('GET', '/api/admin/vm-pool');
    poolState = data;
    isInitialized = data.initialized !== false;
    assert(Array.isArray(poolState.vms), 'vms should be an array');
    // When not initialized, uses 'counts'. When initialized, uses 'summary'
    const countSource = poolState.summary || poolState.counts;
    assert(typeof countSource.total === 'number', 'counts/summary.total should be a number');
    assert(typeof countSource.available === 'number', 'counts/summary.available should be a number');
  });

  // ------------------------------------------------------------
  // Single VM Tests
  // ------------------------------------------------------------
  console.log('\n--- Single VM Tests ---\n');

  // Find a VM ID to test with (if any exist)
  const testVmId = poolState?.vms?.[0]?.vmId || 'test-vm-001';

  if (isInitialized) {
    await test('GET /api/admin/vm-pool/:vmId returns VM or 404', async () => {
      const { status, data } = await api('GET', `/api/admin/vm-pool/${testVmId}`);
      // Either returns the VM (200) or not found (404)
      assert(status === 200 || status === 404, `Expected 200 or 404, got ${status}`);
      if (status === 200) {
        assert(data.vmId === testVmId, 'VM ID should match');
        assert(typeof data.status !== 'undefined', 'VM should have status');
      }
    });
  } else {
    skip('GET /api/admin/vm-pool/:vmId', 'VM pool not initialized (no Firebase credentials)');
  }

  // ------------------------------------------------------------
  // VM Start/Stop Tests (requires AWS credentials)
  // ------------------------------------------------------------
  console.log('\n--- VM Start/Stop Tests ---\n');

  // Find a stopped VM to test start, or any VM for stop test
  const stoppedVm = poolState?.vms?.find(vm => vm.status === 'stopped');
  const runningVm = poolState?.vms?.find(vm =>
    vm.status === 'available' || vm.status === 'assigned'
  );

  if (stoppedVm) {
    // Don't actually start VMs in automated tests without explicit flag
    if (process.env.TEST_START_STOP === 'true') {
      await test(`POST /api/admin/vm-pool/${stoppedVm.vmId}/start starts VM`, async () => {
        const { status, ok, data } = await api('POST', `/api/admin/vm-pool/${stoppedVm.vmId}/start`);
        assert(ok, `Expected 200 OK, got ${status}: ${JSON.stringify(data)}`);
        assert(data.success, 'Response should indicate success');
      });
    } else {
      skip(`POST /api/admin/vm-pool/${stoppedVm.vmId}/start`,
        'Set TEST_START_STOP=true to test (incurs AWS costs)');
    }
  } else {
    skip('POST /api/admin/vm-pool/:vmId/start', 'No stopped VMs in pool');
  }

  if (runningVm) {
    if (process.env.TEST_START_STOP === 'true') {
      await test(`POST /api/admin/vm-pool/${runningVm.vmId}/stop stops VM`, async () => {
        const { status, ok, data } = await api('POST', `/api/admin/vm-pool/${runningVm.vmId}/stop`);
        assert(ok, `Expected 200 OK, got ${status}: ${JSON.stringify(data)}`);
        assert(data.success, 'Response should indicate success');
      });
    } else {
      skip(`POST /api/admin/vm-pool/${runningVm.vmId}/stop`,
        'Set TEST_START_STOP=true to test (incurs AWS costs)');
    }
  } else {
    skip('POST /api/admin/vm-pool/:vmId/stop', 'No running VMs in pool');
  }

  // ------------------------------------------------------------
  // Competition Assignment Tests
  // ------------------------------------------------------------
  console.log('\n--- Competition Assignment Tests ---\n');

  const testCompId = 'test-comp-' + Date.now();
  let assignedVmId = null;

  // Find an available VM for assignment test
  const availableVm = poolState?.vms?.find(vm => vm.status === 'available');

  if (availableVm) {
    await test(`POST /api/competitions/${testCompId}/vm/assign assigns VM`, async () => {
      const { status, ok, data } = await api('POST', `/api/competitions/${testCompId}/vm/assign`, {
        preferredVmId: availableVm.vmId
      });
      // Could fail if Firebase isn't available
      if (status === 500 && data.error?.includes('Firebase')) {
        throw new Error('Firebase credentials not configured');
      }
      assert(ok, `Expected 200 OK, got ${status}: ${JSON.stringify(data)}`);
      assert(data.success, 'Response should indicate success');
      assert(data.vmId, 'Response should include assigned vmId');
      assert(data.publicIp || data.publicIp === null, 'Response should include publicIp');
      assignedVmId = data.vmId;
    });
  } else {
    skip(`POST /api/competitions/${testCompId}/vm/assign`, 'No available VMs in pool');
  }

  if (isInitialized) {
    await test(`GET /api/competitions/${testCompId}/vm returns assigned VM`, async () => {
      const { status, ok, data } = await api('GET', `/api/competitions/${testCompId}/vm`);
      if (assignedVmId) {
        assert(ok, `Expected 200 OK, got ${status}`);
        assert(data.vmId === assignedVmId, 'VM ID should match assigned VM');
      } else {
        // No VM was assigned, should return null
        assert(ok, `Expected 200 OK, got ${status}`);
        assert(data.vm === null || data.vmId === null || !data.vmId, 'Should return null when no VM assigned');
      }
    });
  } else {
    skip(`GET /api/competitions/${testCompId}/vm`, 'VM pool not initialized (no Firebase credentials)');
  }

  if (assignedVmId) {
    await test(`POST /api/competitions/${testCompId}/vm/release releases VM`, async () => {
      const { status, ok, data } = await api('POST', `/api/competitions/${testCompId}/vm/release`);
      assert(ok, `Expected 200 OK, got ${status}: ${JSON.stringify(data)}`);
      assert(data.success, 'Response should indicate success');
    });

    // Verify release worked
    await test('VM is available after release', async () => {
      const { ok, data } = await api('GET', '/api/admin/vm-pool');
      assert(ok, 'Should get pool status');
      const releasedVm = data.vms.find(vm => vm.vmId === assignedVmId);
      if (releasedVm) {
        assert(releasedVm.status === 'available',
          `VM should be available after release, got ${releasedVm.status}`);
      }
    });
  } else {
    skip(`POST /api/competitions/${testCompId}/vm/release`, 'No VM was assigned');
    skip('VM is available after release', 'No VM was assigned');
  }

  // ------------------------------------------------------------
  // Pool Configuration Update Test
  // ------------------------------------------------------------
  console.log('\n--- Pool Configuration Tests ---\n');

  if (isInitialized) {
    await test('PUT /api/admin/vm-pool/config updates configuration', async () => {
      const { data: currentConfig } = await api('GET', '/api/admin/vm-pool/config');
      const originalWarmCount = currentConfig.warmCount;

      // Try to update config
      const { status, ok, data } = await api('PUT', '/api/admin/vm-pool/config', {
        warmCount: originalWarmCount  // Keep same to not change state
      });

      // This may fail without Firebase credentials
      if (status === 500 && data.error?.includes('Firebase')) {
        throw new Error('Firebase credentials not configured');
      }

      assert(ok, `Expected 200 OK, got ${status}: ${JSON.stringify(data)}`);
      assert(data.success || data.warmCount !== undefined, 'Response should indicate success or return config');
    });
  } else {
    skip('PUT /api/admin/vm-pool/config', 'VM pool not initialized (no Firebase credentials)');
  }

  // ------------------------------------------------------------
  // VM Launch/Terminate Tests (dangerous - skip in automated tests)
  // ------------------------------------------------------------
  console.log('\n--- VM Launch/Terminate Tests ---\n');

  if (process.env.TEST_LAUNCH_TERMINATE === 'true') {
    await test('POST /api/admin/vm-pool/launch creates new VM', async () => {
      const { status, ok, data } = await api('POST', '/api/admin/vm-pool/launch', {
        name: `test-vm-${Date.now()}`
      });
      assert(ok, `Expected 200 OK, got ${status}: ${JSON.stringify(data)}`);
      assert(data.success, 'Response should indicate success');
      assert(data.vmId, 'Response should include new vmId');
    });
  } else {
    skip('POST /api/admin/vm-pool/launch',
      'Set TEST_LAUNCH_TERMINATE=true to test (incurs AWS costs)');
  }

  skip('DELETE /api/admin/vm-pool/:vmId',
    'Skipping terminate test to avoid accidental VM destruction');

  // ------------------------------------------------------------
  // Results Summary
  // ------------------------------------------------------------
  console.log('\n========================================');
  console.log('Test Results Summary');
  console.log('========================================\n');
  console.log(`Passed:  ${results.passed}`);
  console.log(`Failed:  ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Total:   ${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }

  console.log('\n');

  // Return results for programmatic use
  return {
    success: results.failed === 0,
    ...results
  };
}

// Run tests
runTests()
  .then(results => {
    process.exit(results.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test runner error:', error.message);
    process.exit(1);
  });
