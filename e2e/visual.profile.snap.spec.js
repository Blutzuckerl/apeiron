const { test } = require('@playwright/test');
const {
  attachProfileDiagnostics,
  collectConsoleMessages,
  expect,
  loginAsEinstein,
  stabilizeProfileUi
} = require('./helpers');

async function buildMask(root) {
  return [
    root.locator('.status-dot'),
    root.locator('[data-presence-text]')
  ];
}

test.describe.serial('Profile Visual Regression', () => {
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = collectConsoleMessages(page);
    await stabilizeProfileUi(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachProfileDiagnostics(page, testInfo, consoleMessages);
  });

  test('captures user profile modal states', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loginAsEinstein(page, { targetUrl: '/app/home?thread=1' });
    await page.getByTestId('profile-open').click();

    const modal = page.getByTestId('profile-modal-card');
    const mask = await buildMask(modal);
    await expect(modal).toHaveScreenshot('user-profile-photos.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask
    });

    await page.getByTestId('profile-tab-aboutplus').click();
    await expect(modal).toHaveScreenshot('user-profile-aboutplus.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask
    });

    await page.getByTestId('mutual-friends-tab').click();
    await expect(modal).toHaveScreenshot('user-profile-mutual-friends.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask
    });

    await page.getByTestId('mutual-servers-tab').click();
    await expect(modal).toHaveScreenshot('user-profile-mutual-servers.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask
    });
  });

  test('captures AI profile modal states', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loginAsEinstein(page, { targetUrl: '/app/home' });
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await page.getByTestId('view-full-profile-button').click();

    const modal = page.getByTestId('profile-modal-card');
    const mask = await buildMask(modal);
    await expect(modal).toHaveScreenshot('ai-profile-photos.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask
    });

    await page.getByTestId('profile-tab-aboutplus').click();
    await expect(modal).toHaveScreenshot('ai-profile-aboutplus.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask
    });

    await page.getByTestId('profile-tab-capabilities').click();
    await expect(modal).toHaveScreenshot('ai-profile-capabilities.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask
    });
  });

  test('captures DM info and group info panels', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/home?thread=1' });

    const userPanel = page.getByTestId('dm-info-panel');
    await expect(userPanel).toHaveScreenshot('dm-info-user.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask: await buildMask(userPanel)
    });

    await page.getByRole('link', { name: /sokrates/i }).first().click();
    const aiPanel = page.getByTestId('dm-info-panel');
    await expect(aiPanel).toHaveScreenshot('dm-info-ai.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask: await buildMask(aiPanel)
    });

    await page.goto('/app/home?thread=2', { waitUntil: 'domcontentloaded' });
    const groupPanel = page.getByTestId('group-info-panel');
    await expect(groupPanel).toHaveScreenshot('dm-info-group.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask: await buildMask(groupPanel)
    });
  });

  test('captures the settings profile preview card', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/settings/profile' });

    const previewCard = page.getByTestId('settings-profile-preview-card');
    await expect(previewCard).toHaveScreenshot('settings-profile-preview.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask: await buildMask(previewCard)
    });
  });
});
