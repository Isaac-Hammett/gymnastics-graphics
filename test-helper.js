/**
 * Playwright Test Helper for Show Control System
 * Run with: node ralph-wigg/test-helper.js <command> [args]
 *
 * Commands:
 *   screenshot <url> <filename>  - Take screenshot of URL
 *   check <url>                  - Check if URL loads without errors
 *   console <url>                - Get console logs from URL
 *   health                       - Check server health endpoints
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

async function takeScreenshot(url, filename) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const filepath = path.join(SCREENSHOT_DIR, `${filename}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`Screenshot saved: ${filepath}`);
    return { success: true, path: filepath };
  } catch (error) {
    console.error(`Screenshot failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

async function checkUrl(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const status = response?.status() || 0;

    console.log(JSON.stringify({
      success: status >= 200 && status < 400 && errors.length === 0,
      url,
      status,
      errors,
      title: await page.title()
    }, null, 2));

    return { success: status >= 200 && status < 400, status, errors };
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      url,
      error: error.message,
      errors
    }, null, 2));
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

async function getConsoleLogs(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'error', text: err.message }));

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    // Wait a bit for any async logs
    await page.waitForTimeout(2000);

    console.log(JSON.stringify({ url, logs }, null, 2));
    return { success: true, logs };
  } catch (error) {
    console.log(JSON.stringify({ url, error: error.message, logs }, null, 2));
    return { success: false, error: error.message, logs };
  } finally {
    await browser.close();
  }
}

async function checkHealth() {
  const endpoints = [
    // Core endpoints
    { name: 'Server Status', url: 'http://localhost:3003/api/status' },
    { name: 'OBS Scenes', url: 'http://localhost:3003/api/scenes' },
    { name: 'Show Config', url: 'http://localhost:3003/api/config' },
    { name: 'Config Validate', url: 'http://localhost:3003/api/config/validate' },
    // Camera endpoints (P2-04)
    { name: 'Cameras Health', url: 'http://localhost:3003/api/cameras/health' },
    { name: 'Cameras Runtime', url: 'http://localhost:3003/api/cameras/runtime' },
    { name: 'Cameras Fallbacks', url: 'http://localhost:3003/api/cameras/fallbacks' },
    // Scene generation endpoints (P3-03)
    { name: 'Scenes Preview', url: 'http://localhost:3003/api/scenes/preview' },
    // Timesheet endpoints (P4-06)
    { name: 'Timesheet State', url: 'http://localhost:3003/api/timesheet/state' },
    { name: 'Timesheet Overrides', url: 'http://localhost:3003/api/timesheet/overrides' },
    { name: 'Timesheet History', url: 'http://localhost:3003/api/timesheet/history' },
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, { timeout: 5000 });
      const data = await response.json().catch(() => null);
      results.push({
        name: endpoint.name,
        url: endpoint.url,
        status: response.status,
        success: response.ok,
        data: data ? 'OK' : 'Parse error'
      });
    } catch (error) {
      results.push({
        name: endpoint.name,
        url: endpoint.url,
        success: false,
        error: error.message
      });
    }
  }

  console.log(JSON.stringify({ health: results }, null, 2));
  return results;
}

// CLI handler
const [,, command, ...args] = process.argv;

(async () => {
  switch (command) {
    case 'screenshot':
      if (args.length < 2) {
        console.error('Usage: screenshot <url> <filename>');
        process.exit(1);
      }
      await takeScreenshot(args[0], args[1]);
      break;

    case 'check':
      if (args.length < 1) {
        console.error('Usage: check <url>');
        process.exit(1);
      }
      const result = await checkUrl(args[0]);
      process.exit(result.success ? 0 : 1);
      break;

    case 'console':
      if (args.length < 1) {
        console.error('Usage: console <url>');
        process.exit(1);
      }
      await getConsoleLogs(args[0]);
      break;

    case 'health':
      await checkHealth();
      break;

    default:
      console.log(`
Playwright Test Helper for Show Control System

Commands:
  screenshot <url> <filename>  - Take screenshot of URL
  check <url>                  - Check if URL loads without errors
  console <url>                - Get console logs from URL
  health                       - Check server health endpoints

Examples:
  node ralph-wigg/test-helper.js screenshot http://localhost:5173 homepage
  node ralph-wigg/test-helper.js check http://localhost:3001/api/status
  node ralph-wigg/test-helper.js health
      `);
  }
})();
