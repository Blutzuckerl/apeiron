const { test } = require('@playwright/test');
const {
  attachProfileDiagnostics,
  collectConsoleMessages,
  expect,
  loginAsEinstein,
  stabilizeProfileUi
} = require('./helpers');

test.describe.serial('Profile AI View E2E', () => {
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = collectConsoleMessages(page);
    await stabilizeProfileUi(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachProfileDiagnostics(page, testInfo, consoleMessages);
  });

  test('renders Sokrates with stable geometry, tabs, and internal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/home' });
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    await page.getByTestId('view-full-profile-button').click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();
    await expect(page.getByTestId('profile-right')).toBeVisible();
    await expect(page.getByTestId('profile-tab-photos')).toBeVisible();
    await expect(page.getByTestId('profile-tab-aboutplus')).toBeVisible();
    await expect(page.getByTestId('profile-tab-capabilities')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const banner = document.querySelector('[data-testid="profile-banner"]');
      const avatarWrap = document.querySelector('[data-testid="profile-avatar"]');
      const avatar = avatarWrap?.querySelector('.profile-avatar');
      const nameBlock = document.querySelector('[data-testid="profile-name-block"]');
      const modal = document.querySelector('[data-testid="profile-modal-card"]');
      const left = document.querySelector('[data-testid="profile-left"]');
      const right = document.querySelector('[data-testid="profile-right"]');
      if (!(banner instanceof HTMLElement)
        || !(avatar instanceof HTMLElement)
        || !(nameBlock instanceof HTMLElement)
        || !(modal instanceof HTMLElement)
        || !(left instanceof HTMLElement)
        || !(right instanceof HTMLElement)) {
        return null;
      }
      const bannerRect = banner.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return {
        bannerBottom: bannerRect.bottom,
        bannerHeight: bannerRect.height,
        nameTop: nameBlock.getBoundingClientRect().top,
        avatarTop: avatarRect.top,
        avatarBottom: avatarRect.bottom,
        avatarHeight: avatarRect.height,
        modalClientWidth: modal.clientWidth,
        modalScrollWidth: modal.scrollWidth,
        leftX: leftRect.x,
        rightX: rightRect.x
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry.bannerHeight).toBeGreaterThanOrEqual(160);
    expect(geometry.bannerHeight).toBeLessThanOrEqual(240);
    expect(geometry.nameTop).toBeGreaterThan(geometry.bannerBottom);
    expect(geometry.avatarTop).toBeLessThan(geometry.bannerBottom);
    expect(geometry.avatarBottom).toBeGreaterThan(geometry.bannerBottom);
    expect(geometry.bannerBottom - geometry.avatarTop).toBeGreaterThanOrEqual(geometry.avatarHeight * 0.2);
    expect(Math.abs(geometry.modalScrollWidth - geometry.modalClientWidth)).toBeLessThanOrEqual(1);
    expect(geometry.leftX).toBeLessThan(geometry.rightX);

    await page.getByTestId('profile-tab-capabilities').click();
    const capabilities = page.getByTestId('ai-capabilities-display');
    await expect(capabilities).toContainText('Diskussionsmodus');
    await expect(capabilities).toContainText('Begriffsklärung');
    await expect(capabilities).toContainText('Dialektik / Elenchos');

    await page.getByTestId('profile-tab-aboutplus').click();
    await expect(page.getByTestId('about-plus-display')).toContainText('Disco Elysium');
    await expect(page.getByTestId('about-plus-quote-hero')).toBeVisible();
    await expect(page.getByTestId('about-plus-color-section')).toBeVisible();
    await expect(page.getByTestId('about-plus-favorites-grid')).toBeVisible();
    const aboutOrder = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="profile-scroll"]');
      const orderedNodes = [
        document.querySelector('[data-testid="about-plus-quote-hero"]'),
        document.querySelector('[data-testid="about-plus-color-section"]'),
        document.querySelector('[data-testid="about-plus-favorites-grid"]'),
        document.querySelector('[data-testid="about-plus-dislikes-block"]'),
        document.querySelector('[data-testid="about-plus-about-block"]')
      ].filter((node) => node instanceof HTMLElement);
      return {
        tops: orderedNodes.map((node) => node.getBoundingClientRect().top),
        panelScrollHeight: panel instanceof HTMLElement ? panel.scrollHeight : 0,
        panelClientHeight: panel instanceof HTMLElement ? panel.clientHeight : 0,
        panelScrollWidth: panel instanceof HTMLElement ? panel.scrollWidth : 0,
        panelClientWidth: panel instanceof HTMLElement ? panel.clientWidth : 0
      };
    });
    expect(aboutOrder.tops.length).toBeGreaterThanOrEqual(4);
    for (let index = 1; index < aboutOrder.tops.length; index += 1) {
      expect(aboutOrder.tops[index]).toBeGreaterThanOrEqual(aboutOrder.tops[index - 1]);
    }
    expect(Math.abs(aboutOrder.panelScrollWidth - aboutOrder.panelClientWidth)).toBeLessThanOrEqual(1);
    expect(aboutOrder.panelScrollHeight).toBeGreaterThanOrEqual(aboutOrder.panelClientHeight);

    const scrollState = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="profile-scroll"]');
      if (!(panel instanceof HTMLElement)) {
        return null;
      }
      const bodyScrollBefore = document.scrollingElement ? document.scrollingElement.scrollTop : window.scrollY;
      const lockedHeight = panel.clientHeight;
      panel.style.height = `${lockedHeight}px`;
      panel.style.maxHeight = `${lockedHeight}px`;
      const filler = document.createElement('div');
      filler.setAttribute('data-e2e-scroll-filler', '1');
      filler.style.display = 'block';
      filler.style.height = `${lockedHeight + 640}px`;
      panel.appendChild(filler);
      panel.scrollTop = panel.scrollHeight;
      return {
        scrollTop: panel.scrollTop,
        scrollHeight: panel.scrollHeight,
        clientHeight: panel.clientHeight,
        bodyScrollBefore,
        bodyScrollAfter: document.scrollingElement ? document.scrollingElement.scrollTop : window.scrollY
      };
    });

    expect(scrollState).not.toBeNull();
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
    expect(scrollState.scrollTop).toBeGreaterThan(0);
    expect(scrollState.bodyScrollAfter).toBe(scrollState.bodyScrollBefore);
  });
});
