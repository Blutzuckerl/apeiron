const { test } = require('@playwright/test');
const {
  expect,
  loginAsEinstein,
  stabilizeVisualSnapshotUi
} = require('./helpers');

test.describe.serial('LAN Access Visual Regression', () => {
  test('renders secure origin QR card and copy links', async ({ page }) => {
    await stabilizeVisualSnapshotUi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/settings/lan-access' });

    await expect(page.getByTestId('lan-access-panel')).toBeVisible();
    await expect(page.getByTestId('lan-qr-basic-card')).toBeVisible();
    await expect(page.getByTestId('lan-basic-url').first()).toBeVisible();
    await expect(page.getByTestId('lan-qr-basic-target')).toBeVisible();

    await page.evaluate(() => {
      const replaceText = (selector, value) => {
        document.querySelectorAll(selector).forEach((node) => {
          node.textContent = value;
        });
      };
      replaceText('[data-testid="lan-basic-url"]', 'https://LAN_HOST:3443');
      replaceText('[data-testid="lan-full-url"]', 'https://LAN_HOST:3443');
      replaceText('[data-testid="lan-qr-basic-target"]', 'https://LAN_HOST:3443/login');
      replaceText('[data-testid="lan-healthz-url"]', 'https://LAN_HOST:3443/healthz');
      const status = document.querySelector('[data-testid="lan-access-status"]');
      if (status instanceof HTMLElement) {
        status.textContent = 'HTTPS aktiv (Port 3443). TURN aktiv. QR-Target: https://LAN_HOST:3443.';
      }
      const qr = document.querySelector('[data-testid="lan-qr-basic-image"]');
      if (qr instanceof HTMLImageElement) {
        qr.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="224" height="224"><rect width="224" height="224" fill="%23f2f2f2"/><rect x="24" y="24" width="176" height="176" fill="%23222"/></svg>';
      }
    });

    const shot = await page.getByTestId('lan-access-panel').screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
    expect(shot).toMatchSnapshot('lan-access-origin-qr.png');
  });
});
