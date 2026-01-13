/**
 * INT-03: Full Show Flow Test
 *
 * Tests the complete show flow:
 * 1. Load test show config with cameras
 * 2. Start show via socket event
 * 3. Verify segment advances
 * 4. Test camera quick-switch
 * 5. Test override logging
 * 6. Stop show and verify history
 */

const { io } = require('socket.io-client');
const { chromium } = require('playwright');
const path = require('path');

const SERVER_URL = 'http://localhost:3003';
const CLIENT_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Test results collector
const results = {
  passed: [],
  failed: [],
  errors: []
};

function log(msg) {
  console.log(`[TEST] ${msg}`);
}

function pass(test) {
  log(`✅ PASS: ${test}`);
  results.passed.push(test);
}

function fail(test, reason) {
  log(`❌ FAIL: ${test} - ${reason}`);
  results.failed.push({ test, reason });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJSON(url) {
  const response = await fetch(url);
  return response.json();
}

async function runTests() {
  log('Starting INT-03: Full Show Flow Test');
  log('====================================\n');

  let socket = null;
  let browser = null;

  try {
    // Step 1: Load test show config with cameras
    log('Step 1: Verify show config with cameras');
    const config = await fetchJSON(`${SERVER_URL}/api/config`);

    if (config.cameras && config.cameras.length >= 4) {
      pass(`Config has ${config.cameras.length} cameras configured`);
    } else {
      fail('Config cameras', `Expected >= 4 cameras, got ${config.cameras?.length || 0}`);
    }

    if (config.segments && config.segments.length > 0) {
      pass(`Config has ${config.segments.length} segments`);
    } else {
      fail('Config segments', 'No segments found');
    }

    // Check camera health endpoint
    const cameraHealth = await fetchJSON(`${SERVER_URL}/api/cameras/health`);
    if (Array.isArray(cameraHealth)) {
      pass(`Camera health endpoint returns ${cameraHealth.length} cameras`);
    } else {
      fail('Camera health', 'Endpoint did not return array');
    }

    // Check camera runtime endpoint
    const cameraRuntime = await fetchJSON(`${SERVER_URL}/api/cameras/runtime`);
    if (Array.isArray(cameraRuntime)) {
      pass(`Camera runtime endpoint returns ${cameraRuntime.length} cameras`);
    } else {
      fail('Camera runtime', 'Endpoint did not return array');
    }

    // Step 2: Connect socket and start show
    log('\nStep 2: Start show via socket event');

    socket = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 5000
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
      socket.on('connect', () => {
        clearTimeout(timeout);
        pass('Socket connected');
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Get initial timesheet state
    let timesheetState = await fetchJSON(`${SERVER_URL}/api/timesheet/state`);
    if (timesheetState.state === 'stopped') {
      pass('Timesheet initially stopped');
    } else {
      log(`Timesheet state: ${timesheetState.state}`);
    }

    // Start the show
    log('Emitting startTimesheetShow event...');
    socket.emit('startTimesheetShow');
    await sleep(1500);

    timesheetState = await fetchJSON(`${SERVER_URL}/api/timesheet/state`);
    if (timesheetState.isRunning) {
      pass('Show started successfully');
    } else {
      fail('Start show', `Show not running, state: ${timesheetState.state}`);
    }

    // Verify current segment
    if (timesheetState.currentSegment) {
      pass(`Current segment: ${timesheetState.currentSegment.id} (${timesheetState.currentSegment.type})`);
    } else {
      fail('Current segment', 'No current segment after start');
    }

    // Step 3: Verify segment advances
    log('\nStep 3: Test segment advancement');

    const initialSegmentId = timesheetState.currentSegment?.id;

    // Advance to next segment
    socket.emit('advanceSegment', { advancedBy: 'INT-03-test' });
    await sleep(1000);

    timesheetState = await fetchJSON(`${SERVER_URL}/api/timesheet/state`);
    const newSegmentId = timesheetState.currentSegment?.id;

    if (newSegmentId && newSegmentId !== initialSegmentId) {
      pass(`Segment advanced from ${initialSegmentId} to ${newSegmentId}`);
    } else {
      fail('Advance segment', 'Segment did not change after advance');
    }

    // Test previous segment
    socket.emit('previousSegment', { triggeredBy: 'INT-03-test' });
    await sleep(1000);

    timesheetState = await fetchJSON(`${SERVER_URL}/api/timesheet/state`);
    if (timesheetState.currentSegment?.id === initialSegmentId) {
      pass('Previous segment works correctly');
    } else {
      log(`Note: Previous returned to segment ${timesheetState.currentSegment?.id}`);
    }

    // Step 4: Test camera quick-switch
    log('\nStep 4: Test camera override');

    // Get first camera from config
    const firstCamera = config.cameras[0];
    if (firstCamera) {
      socket.emit('overrideCamera', {
        cameraId: firstCamera.id,
        triggeredBy: 'INT-03-test'
      });
      await sleep(500);
      pass(`Camera override emitted for ${firstCamera.name}`);
    } else {
      fail('Camera override', 'No cameras in config');
    }

    // Step 5: Test override logging
    log('\nStep 5: Verify override logging');

    const overrides = await fetchJSON(`${SERVER_URL}/api/timesheet/overrides`);
    if (Array.isArray(overrides) && overrides.length > 0) {
      pass(`Override log has ${overrides.length} entries`);

      // Check for our test overrides
      const hasAdvance = overrides.some(o => o.type === 'advance');
      const hasPrevious = overrides.some(o => o.type === 'previous');
      const hasCameraOverride = overrides.some(o => o.type === 'cameraOverride');

      if (hasAdvance) pass('Advance override logged');
      if (hasPrevious) pass('Previous override logged');
      if (hasCameraOverride) pass('Camera override logged');
    } else {
      fail('Override log', 'No overrides recorded');
    }

    // Advance a couple more times to test flow
    socket.emit('advanceSegment', { advancedBy: 'INT-03-test' });
    await sleep(500);
    socket.emit('advanceSegment', { advancedBy: 'INT-03-test' });
    await sleep(500);

    // Take screenshot of producer view during running show
    log('\nTaking screenshot of producer view...');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${CLIENT_URL}/producer`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000); // Wait for socket updates

    const screenshotPath = path.join(SCREENSHOT_DIR, 'INT-03-show-flow.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    pass(`Screenshot saved to ${screenshotPath}`);
    await browser.close();
    browser = null;

    // Step 6: Stop show and verify history
    log('\nStep 6: Stop show and verify history');

    socket.emit('stopTimesheetShow');
    await sleep(1000);

    timesheetState = await fetchJSON(`${SERVER_URL}/api/timesheet/state`);
    if (timesheetState.state === 'stopped') {
      pass('Show stopped successfully');
    } else {
      fail('Stop show', `Show state: ${timesheetState.state}`);
    }

    // Check history
    const history = await fetchJSON(`${SERVER_URL}/api/timesheet/history`);
    if (Array.isArray(history) && history.length > 0) {
      pass(`Segment history has ${history.length} entries`);
    } else {
      log('Note: Segment history may be empty if show was stopped early');
    }

    // Final override count
    const finalOverrides = await fetchJSON(`${SERVER_URL}/api/timesheet/overrides`);
    log(`Total overrides recorded: ${finalOverrides.length}`);

  } catch (error) {
    results.errors.push(error.message);
    log(`\n❌ ERROR: ${error.message}`);
    console.error(error);
  } finally {
    // Cleanup
    if (socket) {
      socket.disconnect();
    }
    if (browser) {
      await browser.close();
    }
  }

  // Summary
  log('\n====================================');
  log('TEST SUMMARY');
  log('====================================');
  log(`Passed: ${results.passed.length}`);
  log(`Failed: ${results.failed.length}`);
  log(`Errors: ${results.errors.length}`);

  if (results.failed.length > 0) {
    log('\nFailed tests:');
    results.failed.forEach(f => log(`  - ${f.test}: ${f.reason}`));
  }

  if (results.errors.length > 0) {
    log('\nErrors:');
    results.errors.forEach(e => log(`  - ${e}`));
  }

  const success = results.failed.length === 0 && results.errors.length === 0;
  log(`\nOverall: ${success ? '✅ PASS' : '❌ FAIL'}`);

  return success;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
