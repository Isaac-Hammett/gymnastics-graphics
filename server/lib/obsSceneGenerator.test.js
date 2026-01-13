/**
 * Unit test for OBS Scene Generator - generateAllScenes orchestration
 * Verifies correct scene count for n cameras
 */

import { OBSSceneGenerator } from './obsSceneGenerator.js';

// Mock OBS WebSocket connection
const createMockObs = () => {
  const existingScenes = new Set();
  const existingInputs = new Set();

  return {
    call: async (method, params = {}) => {
      switch (method) {
        case 'GetSceneList':
          return { scenes: Array.from(existingScenes).map(name => ({ sceneName: name })) };

        case 'CreateScene':
          if (existingScenes.has(params.sceneName)) {
            const error = new Error('Scene already exists');
            error.code = 601;
            throw error;
          }
          existingScenes.add(params.sceneName);
          return {};

        case 'GetInputSettings':
          if (!existingInputs.has(params.inputName)) {
            throw new Error('Input not found');
          }
          return { inputSettings: {} };

        case 'CreateInput':
          existingInputs.add(params.inputName);
          return {};

        case 'CreateSceneItem':
          return { sceneItemId: Math.floor(Math.random() * 1000) };

        case 'SetSceneItemTransform':
          return {};

        case 'SetSceneItemIndex':
          return {};

        case 'RemoveScene':
          existingScenes.delete(params.sceneName);
          return {};

        default:
          return {};
      }
    }
  };
};

/**
 * Calculate expected scene count for n cameras
 * Formula:
 * - Static scenes: 3 (Starting Soon, BRB, Thanks)
 * - Single: n
 * - Dual: C(n,2) = n*(n-1)/2
 * - Triple: C(n,3) = n*(n-1)*(n-2)/6 (if n >= 3)
 * - Quad: C(n,4) = n*(n-1)*(n-2)*(n-3)/24 (if n >= 4)
 * - Graphics Fullscreen: 1
 */
function calculateExpectedSceneCount(numCameras) {
  let count = 3; // Static scenes
  count += numCameras; // Single scenes
  count += 1; // Graphics Fullscreen

  // Dual combinations: C(n,2)
  if (numCameras >= 2) {
    count += (numCameras * (numCameras - 1)) / 2;
  }

  // Triple combinations: C(n,3)
  if (numCameras >= 3) {
    count += (numCameras * (numCameras - 1) * (numCameras - 2)) / 6;
  }

  // Quad combinations: C(n,4)
  if (numCameras >= 4) {
    count += (numCameras * (numCameras - 1) * (numCameras - 2) * (numCameras - 3)) / 24;
  }

  return count;
}

/**
 * Create test cameras
 */
function createTestCameras(count) {
  const cameras = [];
  for (let i = 1; i <= count; i++) {
    cameras.push({
      id: `cam-${i}`,
      name: `Camera ${i}`,
      srtPort: 9000 + i,
      srtUrl: `srt://localhost:${9000 + i}`,
      expectedApparatus: [`Apparatus${i}`]
    });
  }
  return cameras;
}

/**
 * Run test for specific camera count
 */
async function testCameraCount(numCameras) {
  const mockObs = createMockObs();
  const cameras = createTestCameras(numCameras);

  const config = {
    cameras,
    graphicsOverlay: {
      url: 'http://localhost:5173/graphics',
      queryParams: { theme: 'dark' }
    }
  };

  const generator = new OBSSceneGenerator(mockObs, config);
  const results = await generator.generateAllScenes();

  const expectedCount = calculateExpectedSceneCount(numCameras);
  const actualCount = results.summary.created;

  return {
    numCameras,
    expected: expectedCount,
    actual: actualCount,
    passed: actualCount === expectedCount,
    details: {
      created: results.created.length,
      skipped: results.skipped.length,
      failed: results.failed.length
    },
    breakdown: {
      static: results.created.filter(r => r.type === 'static').length,
      single: results.created.filter(r => r.type === 'single').length,
      dual: results.created.filter(r => r.type === 'dual').length,
      triple: results.created.filter(r => r.type === 'triple').length,
      quad: results.created.filter(r => r.type === 'quad').length,
      graphics: results.created.filter(r => r.type === 'graphics').length
    }
  };
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('OBS Scene Generator - generateAllScenes Unit Test');
  console.log('='.repeat(60));
  console.log();

  const testCases = [1, 2, 3, 4, 5, 6];
  let allPassed = true;

  for (const numCameras of testCases) {
    const result = await testCameraCount(numCameras);

    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${numCameras} cameras:`);
    console.log(`  Expected: ${result.expected} scenes`);
    console.log(`  Actual:   ${result.actual} scenes`);
    console.log(`  Breakdown: static=${result.breakdown.static}, single=${result.breakdown.single}, ` +
                `dual=${result.breakdown.dual}, triple=${result.breakdown.triple}, ` +
                `quad=${result.breakdown.quad}, graphics=${result.breakdown.graphics}`);
    console.log();

    if (!result.passed) {
      allPassed = false;
    }
  }

  console.log('='.repeat(60));
  console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  console.log();

  // Expected scene counts summary
  console.log('Expected scene count formula:');
  console.log('  n=1: 3 + 1 + 0 + 0 + 0 + 1 = 5 scenes');
  console.log('  n=2: 3 + 2 + 1 + 0 + 0 + 1 = 7 scenes');
  console.log('  n=3: 3 + 3 + 3 + 1 + 0 + 1 = 11 scenes');
  console.log('  n=4: 3 + 4 + 6 + 4 + 1 + 1 = 19 scenes');
  console.log('  n=5: 3 + 5 + 10 + 10 + 5 + 1 = 34 scenes');
  console.log('  n=6: 3 + 6 + 15 + 20 + 15 + 1 = 60 scenes');

  return allPassed;
}

// Run tests
runTests().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
