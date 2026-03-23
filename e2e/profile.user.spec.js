const { test } = require('@playwright/test');
const {
  attachProfileDiagnostics,
  collectConsoleMessages,
  expect,
  loginAsEinstein,
  stabilizeProfileUi
} = require('./helpers');

test.describe.serial('Profile User View E2E', () => {
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = collectConsoleMessages(page);
    await stabilizeProfileUi(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachProfileDiagnostics(page, testInfo, consoleMessages);
  });

  test('keeps the user profile modal stable, overlapped, and internally scrollable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/home?thread=1' });
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    await page.getByTestId('view-full-profile-button').click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();
    await expect(page.getByTestId('profile-left')).toBeVisible();
    await expect(page.getByTestId('profile-right')).toBeVisible();

    const before = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="profile-modal-card"]');
      const left = document.querySelector('[data-testid="profile-left"]');
      const right = document.querySelector('[data-testid="profile-right"]');
      const panel = document.querySelector('[data-testid="profile-scroll"]');
      const banner = document.querySelector('[data-testid="profile-banner"]');
      const avatarWrap = document.querySelector('[data-testid="profile-avatar"]');
      const avatar = avatarWrap?.querySelector('.profile-avatar');
      const nameBlock = document.querySelector('[data-testid="profile-name-block"]');
      const tabs = document.querySelector('[data-testid="profile-tabs"]');
      if (!(modal instanceof HTMLElement)
        || !(left instanceof HTMLElement)
        || !(right instanceof HTMLElement)
        || !(panel instanceof HTMLElement)
        || !(banner instanceof HTMLElement)
        || !(avatar instanceof HTMLElement)
        || !(nameBlock instanceof HTMLElement)
        || !(tabs instanceof HTMLElement)) {
        return null;
      }
      const modalRect = modal.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const bannerRect = banner.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      return {
        modalHeight: modalRect.height,
        viewportHeight: window.innerHeight,
        panelOverflowY: window.getComputedStyle(panel).overflowY,
        modalClientWidth: modal.clientWidth,
        modalScrollWidth: modal.scrollWidth,
        left: { x: leftRect.x, width: leftRect.width },
        right: { x: rightRect.x, width: rightRect.width },
        tabsY: tabs.getBoundingClientRect().y,
        bannerHeight: bannerRect.height,
        bannerBottom: bannerRect.bottom,
        nameTop: nameBlock.getBoundingClientRect().top,
        avatarTop: avatarRect.top,
        avatarBottom: avatarRect.bottom,
        avatarHeight: avatarRect.height
      };
    });

    expect(before).not.toBeNull();
    expect(before.modalHeight).toBeLessThanOrEqual((before.viewportHeight * 0.9) + 4);
    expect(before.panelOverflowY).toMatch(/auto|scroll/);
    expect(before.bannerHeight).toBeGreaterThanOrEqual(160);
    expect(before.bannerHeight).toBeLessThanOrEqual(240);
    expect(before.nameTop).toBeGreaterThan(before.bannerBottom);
    expect(before.avatarTop).toBeLessThan(before.bannerBottom);
    expect(before.avatarBottom).toBeGreaterThan(before.bannerBottom);
    expect(before.bannerBottom - before.avatarTop).toBeGreaterThanOrEqual(before.avatarHeight * 0.2);
    expect(Math.abs(before.modalScrollWidth - before.modalClientWidth)).toBeLessThanOrEqual(1);

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
        scrollHeight: panel.scrollHeight,
        clientHeight: panel.clientHeight,
        scrollTop: panel.scrollTop,
        bodyScrollBefore,
        bodyScrollAfter: document.scrollingElement ? document.scrollingElement.scrollTop : window.scrollY
      };
    });

    expect(scrollState).not.toBeNull();
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
    expect(scrollState.scrollTop).toBeGreaterThan(0);
    expect(scrollState.bodyScrollAfter).toBe(scrollState.bodyScrollBefore);

    await page.getByTestId('profile-tab-aboutplus').click();
    const aboutGrid = page.getByTestId('about-plus-display');
    const hasAboutCards = await aboutGrid.count();
    if (hasAboutCards) {
      await expect(aboutGrid).toBeVisible();
      await expect(page.getByTestId('about-plus-quote-hero')).toBeVisible();
      await expect(page.getByTestId('about-plus-color-section')).toBeVisible();
      await expect(page.getByTestId('about-plus-favorites-grid')).toBeVisible();
      await expect(page.getByTestId('about-plus-about-block')).toBeVisible();
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
    } else {
      await expect(page.getByTestId('profile-scroll')).toContainText('Keine Profilangaben vorhanden.');
    }
    await expect(page.getByTestId('profile-scroll')).not.toContainText('Nicht angegeben');
    await page.getByTestId('mutual-friends-tab').click();
    await expect(page.getByTestId('profile-scroll')).toBeVisible();
    await page.getByTestId('mutual-servers-tab').click();
    await expect(page.getByTestId('profile-scroll')).toBeVisible();

    const after = await page.evaluate(() => {
      const left = document.querySelector('[data-testid="profile-left"]');
      const right = document.querySelector('[data-testid="profile-right"]');
      const banner = document.querySelector('[data-testid="profile-banner"]');
      const nameBlock = document.querySelector('[data-testid="profile-name-block"]');
      const tabs = document.querySelector('[data-testid="profile-tabs"]');
      if (!(left instanceof HTMLElement)
        || !(right instanceof HTMLElement)
        || !(banner instanceof HTMLElement)
        || !(nameBlock instanceof HTMLElement)
        || !(tabs instanceof HTMLElement)) {
        return null;
      }
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return {
        left: { x: leftRect.x, width: leftRect.width },
        right: { x: rightRect.x, width: rightRect.width },
        tabsY: tabs.getBoundingClientRect().y,
        bannerHeight: banner.getBoundingClientRect().height,
        nameTop: nameBlock.getBoundingClientRect().top,
        bannerBottom: banner.getBoundingClientRect().bottom
      };
    });

    expect(after).not.toBeNull();
    expect(Math.abs(after.left.x - before.left.x)).toBeLessThan(2);
    expect(Math.abs(after.left.width - before.left.width)).toBeLessThan(2);
    expect(Math.abs(after.right.x - before.right.x)).toBeLessThan(2);
    expect(Math.abs(after.right.width - before.right.width)).toBeLessThan(2);
    expect(Math.abs(after.tabsY - before.tabsY)).toBeLessThan(2);
    expect(Math.abs(after.bannerHeight - before.bannerHeight)).toBeLessThan(2);
    expect(after.nameTop).toBeGreaterThan(after.bannerBottom);
    expect(after.right.width).toBeGreaterThan(320);
  });

  test('keeps focus trapped inside the profile modal and closes via keyboard controls', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await loginAsEinstein(page, { targetUrl: '/app/home' });

    await page.getByTestId('profile-open').click();
    const modal = page.getByTestId('profile-modal-card');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('profile-left')).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');

    const closeButton = page.getByTestId('profile-close-button');
    await expect(closeButton).toBeFocused();

    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('Tab');
      await expect.poll(async () => page.evaluate(() => {
        const modalNode = document.querySelector('[data-testid="profile-modal-card"]');
        return modalNode instanceof HTMLElement && modalNode.contains(document.activeElement);
      })).toBeTruthy();
    }

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('profile-modal')).toBeHidden();

    await page.getByTestId('profile-open').click();
    await expect(modal).toBeVisible();
    await closeButton.click();
    await expect(page.getByTestId('profile-modal')).toBeHidden();
  });

  test('renders default banner assets and keeps mutual tabs interactive without collapsing the modal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/home?thread=1' });

    await page.getByTestId('profile-open').click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();
    await expect(page.getByTestId('profile-left')).toBeVisible();

    const bannerState = await page.evaluate(() => {
      const bannerImage = document.querySelector('[data-testid="profile-banner"] img');
      const fallback = document.querySelector('[data-testid="profile-banner"] .profile-banner-fallback');
      return {
        src: bannerImage instanceof HTMLImageElement ? bannerImage.getAttribute('src') : '',
        hasFallback: fallback instanceof HTMLElement
      };
    });

    expect(
      String(bannerState?.src || '').startsWith('/public/ressources/')
      || Boolean(bannerState?.hasFallback)
    ).toBeTruthy();

    await page.getByTestId('mutual-friends-tab').click();
    const friendItems = page.getByTestId('profile-mutual-friend-item');
    const friendCount = await friendItems.count();
    expect(friendCount).toBeGreaterThan(0);

    const firstFriend = friendItems.first();
    const firstFriendName = ((await firstFriend.locator('strong').textContent()) || '').trim();
    await firstFriend.click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();
    await expect(page.locator('#fullProfileTitle')).toHaveText(firstFriendName);

    await page.getByTestId('profile-close-button').click();
    await expect(page.getByTestId('profile-modal')).toBeHidden();

    await page.getByTestId('profile-open').click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();
    await expect(page.getByTestId('profile-left')).toBeVisible();

    await page.getByTestId('mutual-servers-tab').click();
    const serverItem = page.getByTestId('profile-mutual-server-item').first();
    await expect(serverItem).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/app\/servers\/\d+/),
      serverItem.click()
    ]);
    await expect(page.getByTestId('server-text-view')).toBeVisible();
  });

  test('keeps the profile settings preview card aligned with the shared banner and identity geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/settings/profile' });

    const previewCard = page.getByTestId('settings-profile-preview-card');
    await expect(previewCard).toBeVisible();

    const metrics = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="settings-profile-preview-card"]');
      const banner = document.querySelector('[data-testid="settings-profile-preview-banner"]');
      const avatar = document.querySelector('[data-testid="settings-profile-preview-avatar"]');
      const avatarFallback = document.getElementById('profilePreviewAvatarFallback');
      const nameBlock = document.querySelector('[data-testid="settings-profile-preview-name-block"]');
      if (!(card instanceof HTMLElement)
        || !(banner instanceof HTMLElement)
        || !(nameBlock instanceof HTMLElement)
        || (!(avatar instanceof HTMLElement) && !(avatarFallback instanceof HTMLElement))) {
        return null;
      }
      const avatarNode = avatar instanceof HTMLElement && !avatar.hidden ? avatar : avatarFallback;
      if (!(avatarNode instanceof HTMLElement)) {
        return null;
      }
      const bannerRect = banner.getBoundingClientRect();
      const avatarRect = avatarNode.getBoundingClientRect();
      const nameRect = nameBlock.getBoundingClientRect();
      return {
        bannerHeight: bannerRect.height,
        bannerBottom: bannerRect.bottom,
        avatarTop: avatarRect.top,
        avatarBottom: avatarRect.bottom,
        nameTop: nameRect.top,
        cardClientWidth: card.clientWidth,
        cardScrollWidth: card.scrollWidth
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.bannerHeight).toBeGreaterThanOrEqual(140);
    expect(metrics.bannerHeight).toBeLessThanOrEqual(220);
    expect(metrics.nameTop).toBeGreaterThan(metrics.bannerBottom);
    expect(metrics.avatarTop).toBeLessThan(metrics.bannerBottom);
    expect(metrics.avatarBottom).toBeGreaterThan(metrics.bannerBottom);
    expect(Math.abs(metrics.cardScrollWidth - metrics.cardClientWidth)).toBeLessThanOrEqual(1);
  });
});
