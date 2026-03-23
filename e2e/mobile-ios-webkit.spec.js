const { devices, test, webkit } = require('@playwright/test');
const { expect } = require('./helpers');
const {
  ensureAuthenticatedAtOrigin,
  expectCoreDmUi,
  expectTimelineScrollable,
  isBrowserInstalled,
  openLanAccessAsEinstein,
  readBasicLanQrPayload
} = require('./helpers/lan-mobile');

test.use({
  ...devices['iPhone 13'],
  browserName: 'webkit',
  ignoreHTTPSErrors: true
});

test.describe('Mobile LAN Simulation - iOS WebKit', () => {
  test.skip(!isBrowserInstalled(webkit), 'WebKit browser is not installed in this environment');

  test('decodes LAN QR, opens LAN URL, and validates login + composer + scroll on iOS viewport', async ({ page }) => {
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
    await composerInput.fill('Mobile iOS LAN smoke input');
    await expect(composerInput).toHaveValue('Mobile iOS LAN smoke input');

    await expectTimelineScrollable(page);

    const overflowStatus = await page.evaluate(() => {
      const composer = document.querySelector('[data-testid="dm-composer"]');
      if (!(composer instanceof HTMLElement)) {
        return null;
      }
      const rect = composer.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight
      };
    });

    expect(overflowStatus).not.toBeNull();
    expect(Number(overflowStatus.bottom || 0)).toBeLessThanOrEqual(Number(overflowStatus.viewportHeight || 0) + 1);

    if (String(process.env.PLAYWRIGHT_MOBILE_SKIP_SNAPSHOT || '') !== '1') {
      await expect(page.locator('main.app-shell')).toHaveScreenshot('mobile-ios-home.png', {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        maxDiffPixelRatio: 0.01
      });
    }
  });
});
