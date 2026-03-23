const { test } = require('@playwright/test');
const {
  attachProfileDiagnostics,
  collectConsoleMessages,
  expect,
  loginAsEinstein,
  stabilizeProfileUi
} = require('./helpers');

test.describe.serial('Profile DM Info E2E', () => {
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = collectConsoleMessages(page);
    await stabilizeProfileUi(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachProfileDiagnostics(page, testInfo, consoleMessages);
  });

  test('opens the user DM info profile card and keeps the modal as the top layer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/home?thread=1' });

    const card = page.getByTestId('user-dm-info-card');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('user-dm-info-banner')).toBeVisible();
    await expect(card.getByTestId('user-dm-info-avatar')).toBeVisible();

    const overlap = await card.evaluate((node) => {
      const banner = node.querySelector('[data-testid="user-dm-info-banner"]');
      const avatar = node.querySelector('.profile-avatar');
      const nameBlock = node.querySelector('[data-testid="user-dm-info-name-block"]');
      if (!(banner instanceof HTMLElement) || !(avatar instanceof HTMLElement) || !(nameBlock instanceof HTMLElement)) {
        return null;
      }
      const bannerRect = banner.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      return {
        bannerHeight: bannerRect.height,
        bannerBottom: bannerRect.bottom,
        nameTop: nameBlock.getBoundingClientRect().top,
        avatarTop: avatarRect.top,
        avatarBottom: avatarRect.bottom
      };
    });

    expect(overlap).not.toBeNull();
    expect(overlap.bannerHeight).toBeGreaterThanOrEqual(120);
    expect(overlap.bannerHeight).toBeLessThanOrEqual(220);
    expect(overlap.nameTop).toBeGreaterThan(overlap.bannerBottom);
    expect(overlap.avatarTop).toBeLessThan(overlap.bannerBottom);
    expect(overlap.avatarBottom).toBeGreaterThan(overlap.bannerBottom);

    await page.getByTestId('view-full-profile-button').click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();

    const layering = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="profile-modal"]');
      const panel = document.querySelector('[data-testid="dm-info-panel"]');
      if (!(modal instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
        return null;
      }
      const modalCard = modal.querySelector('[data-testid="profile-modal-card"]');
      if (!(modalCard instanceof HTMLElement)) {
        return null;
      }
      const rect = modalCard.getBoundingClientRect();
      const probeX = Math.round(rect.left + Math.min(24, Math.max(8, rect.width / 10)));
      const probeY = Math.round(rect.top + Math.min(24, Math.max(8, rect.height / 10)));
      const topElement = document.elementFromPoint(probeX, probeY);
      return {
        modalContainsProbe: modal.contains(topElement),
        panelContainsProbe: panel.contains(topElement)
      };
    });

    expect(layering).not.toBeNull();
    expect(layering.modalContainsProbe).toBeTruthy();
    expect(layering.panelContainsProbe).toBeFalsy();
  });

  test('renders the AI DM info card with the same overlap geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/home' });
    await page.getByRole('link', { name: /sokrates/i }).first().click();

    const card = page.getByTestId('ai-dm-info-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('AI DM');

    const overlap = await card.evaluate((node) => {
      const banner = node.querySelector('[data-testid="ai-dm-info-banner"]');
      const avatar = node.querySelector('.profile-avatar');
      const nameBlock = node.querySelector('[data-testid="ai-dm-info-name-block"]');
      if (!(banner instanceof HTMLElement) || !(avatar instanceof HTMLElement) || !(nameBlock instanceof HTMLElement)) {
        return null;
      }
      const bannerRect = banner.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      return {
        bannerHeight: bannerRect.height,
        bannerBottom: bannerRect.bottom,
        nameTop: nameBlock.getBoundingClientRect().top,
        avatarTop: avatarRect.top,
        avatarBottom: avatarRect.bottom
      };
    });

    expect(overlap).not.toBeNull();
    expect(overlap.bannerHeight).toBeGreaterThanOrEqual(120);
    expect(overlap.bannerHeight).toBeLessThanOrEqual(220);
    expect(overlap.nameTop).toBeGreaterThan(overlap.bannerBottom);
    expect(overlap.avatarTop).toBeLessThan(overlap.bannerBottom);
    expect(overlap.avatarBottom).toBeGreaterThan(overlap.bannerBottom);
  });
});
