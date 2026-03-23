const { devices, test } = require('@playwright/test');
const { expect } = require('./helpers');
const {
  ensureAuthenticatedAtOrigin,
  expectCoreDmUi,
  expectTimelineScrollable,
  openLanAccessAsEinstein,
  readBasicLanQrPayload
} = require('./helpers/lan-mobile');

test.use({
  ...devices['Pixel 5'],
  browserName: 'chromium',
  ignoreHTTPSErrors: true
});

test.describe('Mobile LAN Simulation - Android Chromium', () => {
  test('decodes LAN QR, opens LAN URL, and validates login + DM core UI on mobile viewport', async ({ page }) => {
    await openLanAccessAsEinstein(page);

    const { decodedUrl, origin } = await readBasicLanQrPayload(page);
    expect(decodedUrl).not.toContain('localhost');

    const firstResponse = await page.goto(decodedUrl, { waitUntil: 'domcontentloaded' });
    if (firstResponse) {
      expect(firstResponse.status()).toBeLessThan(500);
    }

    await ensureAuthenticatedAtOrigin(page, origin, '/app/home?thread=2');
    await expectCoreDmUi(page);

    const composerInput = page.getByTestId('dm-composer-input');
    await composerInput.fill('Mobile Android LAN smoke input');
    await expect(composerInput).toHaveValue('Mobile Android LAN smoke input');

    await expectTimelineScrollable(page);

    if (String(process.env.PLAYWRIGHT_MOBILE_SKIP_SNAPSHOT || '') !== '1') {
      await expect(page.locator('main.app-shell')).toHaveScreenshot('mobile-home.png', {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        maxDiffPixelRatio: 0.01
      });
    }
  });
});
