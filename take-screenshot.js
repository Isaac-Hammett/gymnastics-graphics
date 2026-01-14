const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://example.com');
  await page.screenshot({ path: 'screenshots/test-screenshot.png' });
  await browser.close();
  console.log('Screenshot saved to screenshots/test-screenshot.png');
})();
