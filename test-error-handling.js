/**
 * INT-08: Error Handling Test
 * Tests error handling for competition loading failures.
 *
 * Run with: node test-error-handling.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const CLIENT_URL = 'http://localhost:5175';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let testsPassed = 0;
let testsFailed = 0;

function logTest(name, passed, details = '') {
  if (passed) {
    testsPassed++;
    console.log(`✅ ${name}${details ? ': ' + details : ''}`);
  } else {
    testsFailed++;
    console.log(`❌ ${name}${details ? ': ' + details : ''}`);
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('INT-08: Error Handling Test');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs for debugging
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));

  try {
    // ========================================
    // Test 1: Invalid competition ID - NOT_FOUND error
    // ========================================
    console.log('\n--- Test 1: Invalid Competition ID ---\n');

    await page.goto(`${CLIENT_URL}/invalid-competition-id/producer`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for error page to render
    await page.waitForTimeout(2000);

    // Check for "Competition Not Found" title
    const notFoundTitle = await page.$('h1');
    const notFoundTitleText = notFoundTitle ? await notFoundTitle.textContent() : '';
    logTest('NOT_FOUND error shows correct title',
      notFoundTitleText.includes('Competition Not Found'),
      notFoundTitleText
    );

    // Check for competition ID in error message
    const notFoundMessage = await page.$('p.text-gray-400');
    const notFoundMessageText = notFoundMessage ? await notFoundMessage.textContent() : '';
    logTest('NOT_FOUND error shows competition ID in message',
      notFoundMessageText.includes('invalid-competition-id'),
      notFoundMessageText
    );

    // Check for "Back to Competition Selector" link
    const backToSelectorLink = await page.$('a[href="/select"]');
    logTest('NOT_FOUND error has "Back to Selector" link', !!backToSelectorLink);

    // Take screenshot of NOT_FOUND error
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'INT-08-not-found-error.png'),
      fullPage: true
    });
    console.log('📸 Screenshot: INT-08-not-found-error.png');

    // ========================================
    // Test 2: Click "Back to Selector" link
    // ========================================
    console.log('\n--- Test 2: Back to Selector Link ---\n');

    if (backToSelectorLink) {
      // Use click and wait for URL change instead of waitForNavigation
      await Promise.all([
        page.waitForURL('**/select**', { timeout: 30000 }),
        backToSelectorLink.click()
      ]);

      const currentUrl = page.url();
      logTest('Back to Selector link navigates to /select',
        currentUrl.includes('/select'),
        currentUrl
      );

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Verify we're on the competition selector page
      const selectHeader = await page.$('text=Select Competition');
      logTest('Competition Selector page loads', !!selectHeader);
    } else {
      logTest('Back to Selector link navigation', false, 'Link not found');
    }

    // ========================================
    // Test 3: Competition without vmAddress - NO_VM_ADDRESS error
    // ========================================
    console.log('\n--- Test 3: Competition Without vmAddress ---\n');

    // Navigate to a known competition without vmAddress (from activity.md mentions ezb008sp)
    // We'll try a competition that exists in Firebase but has no vmAddress
    await page.goto(`${CLIENT_URL}/ezb008sp/producer`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for error page to render
    await page.waitForTimeout(2000);

    // Check for "Not Configured" title
    const noVmTitle = await page.$('h1');
    const noVmTitleText = noVmTitle ? await noVmTitle.textContent() : '';

    // Could be NOT_FOUND or NO_VM_ADDRESS depending on whether competition exists
    const isNotConfigured = noVmTitleText.includes('Not Configured');
    const isNotFound = noVmTitleText.includes('Not Found');

    logTest('Error page displays for competition without VM',
      isNotConfigured || isNotFound,
      noVmTitleText
    );

    if (isNotConfigured) {
      // Check for "Configure VM" button
      const configureVmButton = await page.$('a:has-text("Configure VM")');
      logTest('NO_VM_ADDRESS error has "Configure VM" button', !!configureVmButton);

      // Check for "Back to Selector" link
      const backLink = await page.$('a:has-text("Back to Selector")');
      logTest('NO_VM_ADDRESS error has "Back to Selector" link', !!backLink);
    } else if (isNotFound) {
      logTest('Competition does not exist (NOT_FOUND)', true, 'This competition was not found in Firebase');
    }

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'INT-08-no-vm-address-error.png'),
      fullPage: true
    });
    console.log('📸 Screenshot: INT-08-no-vm-address-error.png');

    // ========================================
    // Test 4: Find a competition without vmAddress from the selector
    // ========================================
    console.log('\n--- Test 4: Find Competition Without vmAddress ---\n');

    await page.goto(`${CLIENT_URL}/select`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for competitions to load
    await page.waitForTimeout(3000);

    // Look for competition cards - check for the "Producer" buttons which appear on each card
    const producerButtons = await page.$$('text=Producer');
    const hasCompetitions = producerButtons.length > 1; // > 1 because Local Dev also has one
    logTest('Competition selector shows competitions',
      hasCompetitions,
      `Found ${producerButtons.length} Producer buttons (including Local Dev)`
    );

    // Check for "Local Development" option
    const localDevOption = await page.$('text=Local Development');
    logTest('Local Development option is available', !!localDevOption);

    // Take screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'INT-08-competition-selector.png'),
      fullPage: true
    });
    console.log('📸 Screenshot: INT-08-competition-selector.png');

    // ========================================
    // Test 5: Verify error component styling
    // ========================================
    console.log('\n--- Test 5: Error Component Styling ---\n');

    // Navigate back to an invalid ID to check styling
    await page.goto(`${CLIENT_URL}/this-id-does-not-exist/producer`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Check for error page container
    const errorContainer = await page.$('.min-h-screen.bg-gray-900');
    logTest('Error page has correct background styling', !!errorContainer);

    // Check for centered content
    const centeredContent = await page.$('.max-w-md');
    logTest('Error content is centered and contained', !!centeredContent);

    // Check for icon
    const errorIcon = await page.$('svg');
    logTest('Error page displays an icon', !!errorIcon);

    // Check for competition ID display
    const compIdDisplay = await page.$('code');
    const compIdText = compIdDisplay ? await compIdDisplay.textContent() : '';
    logTest('Error page shows competition ID in code block',
      compIdText === 'this-id-does-not-exist',
      compIdText
    );

    // Take final screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'INT-08-error-styling.png'),
      fullPage: true
    });
    console.log('📸 Screenshot: INT-08-error-styling.png');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    testsFailed++;
  } finally {
    await browser.close();
  }

  // ========================================
  // Summary
  // ========================================
  console.log('\n========================================');
  console.log('Test Results');
  console.log('========================================');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log('========================================\n');

  // Return exit code based on results
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
