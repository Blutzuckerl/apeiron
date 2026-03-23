const { test } = require('@playwright/test');
const {
  attachProfileDiagnostics,
  collectConsoleMessages,
  expect,
  loginAsEinstein,
  stabilizeProfileUi
} = require('./helpers');

test.describe.serial('Profile Group Info E2E', () => {
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = collectConsoleMessages(page);
    await stabilizeProfileUi(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachProfileDiagnostics(page, testInfo, consoleMessages);
  });

  test('keeps group settings hidden by default and exposes member actions progressively', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/home?thread=2' });
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    const panel = page.getByTestId('group-info-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('group-dm-edit-panel')).toBeHidden();
    await expect(panel.getByTestId('group-members-list')).toBeVisible();
    await expect(panel.getByTestId('dm-members-header')).toContainText(/Members/i);

    await expect(panel.locator('input[name="title"]')).toBeHidden();
    await expect(panel.locator('input[placeholder*="Teilnehmer"]')).toBeHidden();
    await expect(panel.getByTestId('member-remove-button')).toHaveCount(0);

    const firstMenu = panel.locator('[data-member-menu-trigger]').first();
    await firstMenu.click();
    await expect(panel.getByTestId('member-context-menu').first()).toBeVisible();

    await page.getByTestId('group-dm-edit-toggle').click();
    await expect(page.getByTestId('group-dm-edit-panel')).toBeVisible();
    await expect(panel.locator('input[name="title"]')).toBeVisible();

    await page.locator('[data-group-edit-close]').first().click();
    await expect(page.getByTestId('group-dm-edit-panel')).toBeHidden();

    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('group-info-panel')).toHaveCount(0);
  });
});
