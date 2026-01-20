// @ts-check
import { test, expect } from '@playwright/test';

/**
 * PRD-OBS-03: Source Management E2E Tests
 *
 * These tests verify the source management functionality in the OBS Manager.
 * They run against production at https://commentarygraphic.com/{compId}/obs-manager
 *
 * Test coverage:
 * - TEST-35: Browser source URL editing
 * - TEST-36: SRT/Media source URL editing
 * - Transform editing (position, scale, crop)
 * - Transform presets
 * - Source visibility and lock controls
 * - Delete input functionality
 *
 * Prerequisites:
 * - A competition must be running with OBS connected
 * - The competition ID is passed via BASE_COMP_ID env var or defaults to test comp
 */

const COMP_ID = process.env.BASE_COMP_ID || '8kyf0rnl';
const BASE_URL = process.env.BASE_URL || 'https://commentarygraphic.com';
const OBS_MANAGER_URL = `${BASE_URL}/${COMP_ID}/obs-manager`;

// Test timeouts
const LONG_TIMEOUT = 30000;
const SHORT_TIMEOUT = 10000;

test.describe('OBS Manager - Source Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to OBS Manager
    await page.goto(OBS_MANAGER_URL);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Wait for OBS connection (green banner with "OBS Connected")
    // If not connected, tests will verify the disconnected state gracefully
    try {
      await page.waitForSelector('text=OBS Connected', { timeout: SHORT_TIMEOUT });
    } catch {
      console.log('OBS not connected - some tests may be skipped');
    }
  });

  test.describe('Page Structure', () => {
    test('should load OBS Manager page', async ({ page }) => {
      // Verify page header
      await expect(page.locator('h1')).toContainText('OBS Manager');

      // Verify tabs are present
      await expect(page.getByRole('button', { name: 'Scenes' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sources' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Audio' })).toBeVisible();
    });

    test('should show connection status', async ({ page }) => {
      // Should show either connected or disconnected status
      const connectedBanner = page.locator('text=OBS Connected');
      const disconnectedBanner = page.locator('text=OBS Disconnected');

      const isConnected = await connectedBanner.isVisible();
      const isDisconnected = await disconnectedBanner.isVisible();

      expect(isConnected || isDisconnected).toBeTruthy();
    });

    test('should switch to Sources tab', async ({ page }) => {
      // Click on Sources tab
      await page.getByRole('button', { name: 'Sources' }).click();

      // Should show source list or "No Sources" message
      const sourceList = page.locator('text=Input Sources');
      const noSources = page.locator('text=No Sources');

      await expect(sourceList.or(noSources)).toBeVisible({ timeout: SHORT_TIMEOUT });
    });
  });

  test.describe('Source List', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to Sources tab
      await page.getByRole('button', { name: 'Sources' }).click();
    });

    test('should display grouped sources by type', async ({ page }) => {
      // Wait for sources to load
      await page.waitForTimeout(2000);

      // Check if sources are present
      const sourceCount = page.locator('.bg-gray-700.rounded-lg');
      const count = await sourceCount.count();

      if (count > 0) {
        // Verify edit buttons are present for each source
        const editButtons = page.getByRole('button', { name: 'Edit' });
        await expect(editButtons.first()).toBeVisible();
      } else {
        // No sources case
        await expect(page.locator('text=No Sources')).toBeVisible();
      }
    });

    test('should show source type labels', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Check for common source type labels
      const possibleLabels = [
        'SRT/Media Sources',
        'Browser Sources',
        'Image Sources',
        'VLC Sources',
        'Color Sources'
      ];

      let hasAtLeastOneType = false;
      for (const label of possibleLabels) {
        if (await page.locator(`text=${label}`).isVisible()) {
          hasAtLeastOneType = true;
          break;
        }
      }

      // Either we have sources with types, or no sources at all
      const noSources = await page.locator('text=No Sources').isVisible();
      expect(hasAtLeastOneType || noSources).toBeTruthy();
    });
  });

  test.describe('Source Editor Modal', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to Sources tab
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);
    });

    test('should open source editor when clicking Edit', async ({ page }) => {
      // Find and click the first Edit button
      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();

        // Wait for modal to appear
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Modal should have Source name displayed
        await expect(page.locator('.text-gray-400.text-sm')).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should close editor with X button', async ({ page }) => {
      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Click X button to close
        await page.locator('button >> svg[class*="w-6 h-6"]').first().click();

        // Modal should be closed
        await expect(page.locator('text=Edit Source')).not.toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should close editor with Cancel button', async ({ page }) => {
      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Click Cancel button
        await page.getByRole('button', { name: 'Cancel' }).click();

        // Modal should be closed
        await expect(page.locator('text=Edit Source')).not.toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should close editor by clicking backdrop', async ({ page }) => {
      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Click on the backdrop (the black overlay)
        await page.locator('.fixed.inset-0.bg-black\\/50').click({ position: { x: 10, y: 10 } });

        // Modal should be closed
        await expect(page.locator('text=Edit Source')).not.toBeVisible();
      } else {
        test.skip();
      }
    });
  });

  test.describe('TEST-35: Browser Source Editing', () => {
    test('should edit browser source URL', async ({ page }) => {
      // Switch to Sources tab
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      // Look for a browser source
      const browserSourceSection = page.locator('text=Browser Sources');

      if (await browserSourceSection.isVisible()) {
        // Click Edit on the first browser source
        const browserSourceContainer = browserSourceSection.locator('..').locator('..');
        const editButton = browserSourceContainer.getByRole('button', { name: 'Edit' }).first();

        if (await editButton.isVisible()) {
          await editButton.click();

          // Wait for modal
          await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

          // Verify browser source settings are shown
          await expect(page.locator('text=Browser Source')).toBeVisible();
          await expect(page.locator('label:has-text("URL")')).toBeVisible();

          // Find the URL input field
          const urlInput = page.locator('input[placeholder="https://..."]');

          if (await urlInput.isVisible()) {
            // Store original value
            const originalValue = await urlInput.inputValue();

            // Modify the URL (add a test query param)
            const testUrl = originalValue.includes('?')
              ? `${originalValue}&test=1`
              : `${originalValue}?test=1`;

            await urlInput.fill(testUrl);

            // Click Save
            await page.getByRole('button', { name: 'Save Changes' }).click();

            // Wait for modal to close (indicating success)
            await expect(page.locator('text=Edit Source')).not.toBeVisible({ timeout: SHORT_TIMEOUT });

            // Reopen and verify change was applied
            await editButton.click();
            await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

            const newValue = await urlInput.inputValue();
            expect(newValue).toContain('test=1');

            // Clean up: restore original value
            await urlInput.fill(originalValue);
            await page.getByRole('button', { name: 'Save Changes' }).click();
          }
        }
      } else {
        console.log('No browser sources found - skipping test');
        test.skip();
      }
    });

    test('should edit browser source dimensions', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const browserSourceSection = page.locator('text=Browser Sources');

      if (await browserSourceSection.isVisible()) {
        const browserSourceContainer = browserSourceSection.locator('..').locator('..');
        const editButton = browserSourceContainer.getByRole('button', { name: 'Edit' }).first();

        if (await editButton.isVisible()) {
          await editButton.click();
          await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

          // Find width and height inputs
          const widthLabel = page.locator('label:has-text("Width")');
          const heightLabel = page.locator('label:has-text("Height")');

          if (await widthLabel.isVisible() && await heightLabel.isVisible()) {
            // Width and height controls are present
            await expect(widthLabel).toBeVisible();
            await expect(heightLabel).toBeVisible();

            // Close modal
            await page.getByRole('button', { name: 'Cancel' }).click();
          }
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('TEST-36: SRT/Media Source Editing', () => {
    test('should edit SRT source URL', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      // Look for SRT/Media sources
      const srtSourceSection = page.locator('text=SRT/Media Sources');

      if (await srtSourceSection.isVisible()) {
        const srtSourceContainer = srtSourceSection.locator('..').locator('..');
        const editButton = srtSourceContainer.getByRole('button', { name: 'Edit' }).first();

        if (await editButton.isVisible()) {
          await editButton.click();
          await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

          // Verify SRT/Media source settings
          await expect(page.locator('text=SRT/Media Source')).toBeVisible();
          await expect(page.locator('label:has-text("Source URL/Path")')).toBeVisible();

          // Find the source URL input
          const urlInput = page.locator('input[placeholder="srt://... or file path"]');

          if (await urlInput.isVisible()) {
            // Verify input is editable
            const originalValue = await urlInput.inputValue();
            await urlInput.fill('srt://test.local:10001');
            await urlInput.fill(originalValue); // Restore

            // Close without saving
            await page.getByRole('button', { name: 'Cancel' }).click();
          }
        }
      } else {
        console.log('No SRT/Media sources found - skipping test');
        test.skip();
      }
    });

    test('should show SRT buffering settings', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const srtSourceSection = page.locator('text=SRT/Media Sources');

      if (await srtSourceSection.isVisible()) {
        const srtSourceContainer = srtSourceSection.locator('..').locator('..');
        const editButton = srtSourceContainer.getByRole('button', { name: 'Edit' }).first();

        if (await editButton.isVisible()) {
          await editButton.click();
          await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

          // Verify buffering settings are present
          await expect(page.locator('label:has-text("Buffer (MB)")')).toBeVisible();
          await expect(page.locator('label:has-text("Reconnect Delay")')).toBeVisible();

          await page.getByRole('button', { name: 'Cancel' }).click();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Transform Controls', () => {
    test('should display transform controls in editor', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Verify transform section
        await expect(page.locator('h4:has-text("Transform")')).toBeVisible();

        // Verify position controls
        await expect(page.locator('label:has-text("Position X")')).toBeVisible();
        await expect(page.locator('label:has-text("Position Y")')).toBeVisible();

        // Verify scale controls
        await expect(page.locator('label:has-text("Scale X")')).toBeVisible();
        await expect(page.locator('label:has-text("Scale Y")')).toBeVisible();

        // Verify crop controls
        await expect(page.locator('label:has-text("Crop Left")')).toBeVisible();
        await expect(page.locator('label:has-text("Crop Right")')).toBeVisible();
        await expect(page.locator('label:has-text("Crop Top")')).toBeVisible();
        await expect(page.locator('label:has-text("Crop Bottom")')).toBeVisible();

        await page.getByRole('button', { name: 'Cancel' }).click();
      } else {
        test.skip();
      }
    });

    test('should edit position values', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Find position X input (first number input after "Position X" label)
        const posXInput = page.locator('label:has-text("Position X")').locator('..').locator('input[type="number"]');

        if (await posXInput.isVisible()) {
          const originalValue = await posXInput.inputValue();

          // Change position
          await posXInput.fill('100');
          expect(await posXInput.inputValue()).toBe('100');

          // Restore and cancel
          await posXInput.fill(originalValue);
          await page.getByRole('button', { name: 'Cancel' }).click();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Transform Presets', () => {
    test('should display transform presets', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Verify presets section
        await expect(page.locator('h4:has-text("Layout Presets")')).toBeVisible();

        // Verify common presets are present
        await expect(page.locator('text=Fullscreen')).toBeVisible();
        await expect(page.locator('text=Dual Left')).toBeVisible();
        await expect(page.locator('text=Dual Right')).toBeVisible();

        await page.getByRole('button', { name: 'Cancel' }).click();
      } else {
        test.skip();
      }
    });

    test('should apply fullscreen preset', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Click Fullscreen preset
        await page.locator('button:has-text("Fullscreen")').click();

        // Verify position was set to 0,0
        const posXInput = page.locator('label:has-text("Position X")').locator('..').locator('input[type="number"]');
        const posYInput = page.locator('label:has-text("Position Y")').locator('..').locator('input[type="number"]');

        expect(await posXInput.inputValue()).toBe('0');
        expect(await posYInput.inputValue()).toBe('0');

        await page.getByRole('button', { name: 'Cancel' }).click();
      } else {
        test.skip();
      }
    });

    test('should apply dual layout presets', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Test Dual Right preset (position X should be 960)
        await page.locator('button:has-text("Dual Right")').click();

        const posXInput = page.locator('label:has-text("Position X")').locator('..').locator('input[type="number"]');
        expect(await posXInput.inputValue()).toBe('960');

        // Test Dual Left preset (position X should be 0)
        await page.locator('button:has-text("Dual Left")').click();
        expect(await posXInput.inputValue()).toBe('0');

        await page.getByRole('button', { name: 'Cancel' }).click();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Delete Input', () => {
    test('should show delete button in editor', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Verify delete button is present
        await expect(page.getByRole('button', { name: 'Delete Input' })).toBeVisible();

        await page.getByRole('button', { name: 'Cancel' }).click();
      } else {
        test.skip();
      }
    });

    test('should show delete confirmation dialog', async ({ page }) => {
      await page.getByRole('button', { name: 'Sources' }).click();
      await page.waitForTimeout(2000);

      const editButton = page.getByRole('button', { name: 'Edit' }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.locator('text=Edit Source')).toBeVisible({ timeout: SHORT_TIMEOUT });

        // Click delete button
        await page.getByRole('button', { name: 'Delete Input' }).first().click();

        // Verify confirmation dialog appears
        await expect(page.locator('h3:has-text("Delete Input")')).toBeVisible();
        await expect(page.locator('text=This will remove the input from OBS entirely')).toBeVisible();

        // Verify cancel button in dialog
        const cancelButtons = page.getByRole('button', { name: 'Cancel' });
        await expect(cancelButtons.last()).toBeVisible();

        // Cancel the delete
        await cancelButtons.last().click();

        // Confirmation should be closed, but editor still open
        await expect(page.locator('h3:has-text("Delete Input")')).not.toBeVisible();
        await expect(page.locator('text=Edit Source')).toBeVisible();

        await page.getByRole('button', { name: 'Cancel' }).first().click();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Scene Editor - Source Controls', () => {
    test('should navigate to scene editor', async ({ page }) => {
      // Ensure we're on Scenes tab
      await page.getByRole('button', { name: 'Scenes' }).click();
      await page.waitForTimeout(2000);

      // Look for a scene to click on
      const sceneItem = page.locator('.bg-gray-700.rounded-lg').first();

      if (await sceneItem.isVisible()) {
        // Click on scene name to edit
        await sceneItem.locator('button:has-text("Edit")').first().click();

        // Should see scene editor
        await expect(page.locator('text=Sources').first()).toBeVisible({ timeout: SHORT_TIMEOUT });
      } else {
        test.skip();
      }
    });
  });

  test.describe('Error States', () => {
    test('should show error when OBS disconnected', async ({ page }) => {
      // If OBS is disconnected, verify appropriate UI
      const disconnectedBanner = page.locator('text=OBS Disconnected');

      if (await disconnectedBanner.isVisible()) {
        // Stream controls should be disabled
        const startStreamButton = page.getByRole('button', { name: 'Start Stream' });
        if (await startStreamButton.isVisible()) {
          await expect(startStreamButton).toBeDisabled();
        }
      }
    });

    test('should show connect to OBS message in editor when disconnected', async ({ page }) => {
      const disconnectedBanner = page.locator('text=OBS Disconnected');

      if (await disconnectedBanner.isVisible()) {
        // Try to open a source editor - should show connection required message
        await page.getByRole('button', { name: 'Sources' }).click();
        await page.waitForTimeout(1000);

        // Sources list should indicate no connection
        const noSources = page.locator('text=No Sources');
        const connectMessage = page.locator('text=Connect to OBS');

        // Either shows "No Sources" or connection message
        expect(await noSources.isVisible() || await connectMessage.isVisible()).toBeTruthy();
      }
    });
  });
});

// Utility test to check production connectivity
test.describe('Production Connectivity', () => {
  test('should reach OBS Manager page', async ({ page }) => {
    await page.goto(OBS_MANAGER_URL);
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    await expect(page).toHaveTitle(/Commentary/);

    // Take a screenshot for debugging
    await page.screenshot({ path: 'e2e-results/obs-manager-loaded.png', fullPage: true });
  });
});
