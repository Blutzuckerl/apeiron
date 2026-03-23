const { test } = require('@playwright/test');
const { expect } = require('./helpers');
const {
  ensureAuthenticatedAtOrigin,
  expectCoreDmUi,
  openLanAccessAsEinstein,
  readBasicLanQrPayload
} = require('./helpers/lan-mobile');

test.use({
  browserName: 'chromium',
  viewport: { width: 1366, height: 768 },
  ignoreHTTPSErrors: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
});

test.describe('Desktop LAN Simulation - Windows Chromium', () => {
  test('opens decoded LAN URL and validates desktop DM entry path', async ({ page }) => {
    await openLanAccessAsEinstein(page);

    const { decodedUrl, origin } = await readBasicLanQrPayload(page);
    expect(decodedUrl).not.toContain('localhost');

    const response = await page.goto(decodedUrl, { waitUntil: 'domcontentloaded' });
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }

    await ensureAuthenticatedAtOrigin(page, origin, '/app/home?thread=2');
    await expectCoreDmUi(page);

    await expect(page.locator('#dmNavRail')).toBeVisible();
    await expect(page.locator('main.app-shell')).toHaveScreenshot('desktop-win-home.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01
    });
  });
});
