const { test } = require('@playwright/test');
const { expect } = require('./helpers');
const {
  decodeQrDataUrl,
  openLanAccessAsEinstein,
  readBasicLanQrPayload
} = require('./helpers/lan-mobile');

test.describe('LAN QR Scan', () => {
  test('shows a decodable QR that matches the displayed LAN basic link exactly', async ({ page }) => {
    await openLanAccessAsEinstein(page);

    const basicCard = page.getByTestId('lan-qr-basic-card');
    const basicImage = page.getByTestId('lan-qr-basic-image');
    const basicTarget = page.getByTestId('lan-qr-basic-target');

    await expect(basicCard).toBeVisible();
    await expect(basicImage).toBeVisible();
    await expect(basicTarget).toBeVisible();

    const { expectedLoginUrl, decodedUrl } = await readBasicLanQrPayload(page);
    expect(decodedUrl).toBe(expectedLoginUrl);
    expect(decodedUrl).toMatch(/^https?:\/\//i);
    expect(decodedUrl.endsWith('/login')).toBeTruthy();

    const imageSrc = String(await basicImage.getAttribute('src') || '');
    expect(imageSrc.startsWith('data:image/png;base64,')).toBeTruthy();
    expect(decodeQrDataUrl(imageSrc)).toBe(expectedLoginUrl);

    await page.getByTestId('lan-qr-basic-image-button').click();
    await expect(page.getByTestId('lan-qr-modal')).toBeVisible();
    await expect(page.getByTestId('lan-qr-modal-target')).toHaveText(expectedLoginUrl);
    await page.getByTestId('lan-qr-modal-close').click();
    await expect(page.getByTestId('lan-qr-modal')).toBeHidden();
  });
});
