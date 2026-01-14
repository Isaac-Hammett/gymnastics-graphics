/**
 * INT-07: Legacy Route Redirect Test
 *
 * Tests that legacy routes (/producer, /talent) redirect correctly
 * to /select with the redirect query parameter
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5175';

async function testLegacyRouteRedirects() {
  console.log('=== INT-07: Legacy Route Redirect Test ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  async function test(name, testFn) {
    try {
      await testFn();
      results.passed++;
      results.tests.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name, passed: false, error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  // Test 1: /producer redirects to /select?redirect=/producer
  await test('Legacy /producer redirects to /select?redirect=/producer', async () => {
    await page.goto(`${BASE_URL}/producer`, { waitUntil: 'networkidle' });
    const url = page.url();
    if (!url.includes('/select')) {
      throw new Error(`Expected URL to contain /select, got: ${url}`);
    }
    if (!url.includes('redirect=/producer') && !url.includes('redirect=%2Fproducer')) {
      throw new Error(`Expected URL to contain redirect=/producer, got: ${url}`);
    }
  });

  // Test 2: Verify selector page shows redirect path indicator
  await test('Selector shows redirect path indicator', async () => {
    const indicator = await page.$('text=→ /producer');
    if (!indicator) {
      throw new Error('Redirect path indicator (→ /producer) not found');
    }
  });

  // Test 3: Click Local Development and verify redirect to /local/producer
  await test('Selecting Local Development navigates to /local/producer', async () => {
    // Find the first Producer button (which is in the Local Development section)
    await page.getByRole('button', { name: 'Producer' }).first().click();
    await page.waitForURL('**/local/producer', { timeout: 5000 });
    const url = page.url();
    if (!url.endsWith('/local/producer')) {
      throw new Error(`Expected URL to end with /local/producer, got: ${url}`);
    }
  });

  // Test 4: Verify we're on the producer page
  await test('Producer page loads correctly', async () => {
    await page.waitForSelector('text=Local Development', { timeout: 5000 });
    // Should show CompetitionHeader with Local Development
    const header = await page.$('text=Local Development');
    if (!header) {
      throw new Error('Local Development header not found');
    }
  });

  // Test 5: /talent redirects to /select?redirect=/talent
  await test('Legacy /talent redirects to /select?redirect=/talent', async () => {
    await page.goto(`${BASE_URL}/talent`, { waitUntil: 'networkidle' });
    const url = page.url();
    if (!url.includes('/select')) {
      throw new Error(`Expected URL to contain /select, got: ${url}`);
    }
    if (!url.includes('redirect=/talent') && !url.includes('redirect=%2Ftalent')) {
      throw new Error(`Expected URL to contain redirect=/talent, got: ${url}`);
    }
  });

  // Test 6: Verify selector page shows redirect path indicator for talent
  await test('Selector shows redirect path indicator for talent', async () => {
    const indicator = await page.$('text=→ /talent');
    if (!indicator) {
      throw new Error('Redirect path indicator (→ /talent) not found');
    }
  });

  // Test 7: Click Local Development and verify redirect to /local/talent
  await test('Selecting Local Development navigates to /local/talent', async () => {
    // Find the first Talent button (which is in the Local Development section)
    await page.getByRole('button', { name: 'Talent' }).first().click();
    await page.waitForURL('**/local/talent', { timeout: 5000 });
    const url = page.url();
    if (!url.endsWith('/local/talent')) {
      throw new Error(`Expected URL to end with /local/talent, got: ${url}`);
    }
  });

  // Test 8: /show-producer redirects to /select?redirect=/producer
  await test('Legacy /show-producer redirects to /select?redirect=/producer', async () => {
    await page.goto(`${BASE_URL}/show-producer`, { waitUntil: 'networkidle' });
    const url = page.url();
    if (!url.includes('/select')) {
      throw new Error(`Expected URL to contain /select, got: ${url}`);
    }
    if (!url.includes('redirect=/producer') && !url.includes('redirect=%2Fproducer')) {
      throw new Error(`Expected URL to contain redirect=/producer, got: ${url}`);
    }
  });

  // Test 9: /camera-setup redirects to /select?redirect=/camera-setup
  await test('Legacy /camera-setup redirects to /select?redirect=/camera-setup', async () => {
    await page.goto(`${BASE_URL}/camera-setup`, { waitUntil: 'networkidle' });
    const url = page.url();
    if (!url.includes('/select')) {
      throw new Error(`Expected URL to contain /select, got: ${url}`);
    }
    if (!url.includes('redirect=/camera-setup') && !url.includes('redirect=%2Fcamera-setup')) {
      throw new Error(`Expected URL to contain redirect=/camera-setup, got: ${url}`);
    }
  });

  // Take screenshot of final state
  await page.goto(`${BASE_URL}/producer`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'screenshots/INT-07-legacy-redirect.png', fullPage: true });
  console.log('\nScreenshot saved: screenshots/INT-07-legacy-redirect.png');

  await browser.close();

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${results.passed}/${results.passed + results.failed}`);
  console.log(`Failed: ${results.failed}/${results.passed + results.failed}`);

  return results.failed === 0;
}

testLegacyRouteRedirects()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
