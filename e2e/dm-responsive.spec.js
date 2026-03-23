const { test } = require('@playwright/test');
const {
  expect,
  loginAsEinstein,
  stabilizeVisualSnapshotUi
} = require('./helpers');

const MOBILE_VIEWPORTS = [
  { name: 'mobile-375x667', width: 375, height: 667 },
  { name: 'mobile-390x844', width: 390, height: 844 }
];

async function openDmPage(page, viewport) {
  await page.setViewportSize(viewport);
  await stabilizeVisualSnapshotUi(page);
  await loginAsEinstein(page, { targetUrl: '/app/home?thread=2' });
  await expect(page.getByTestId('dm-chat-main')).toBeVisible();
}

test.describe('DM Responsive Layout', () => {
  test('keeps desktop 3-column layout unchanged at 1440x900', async ({ page }) => {
    await openDmPage(page, { width: 1440, height: 900 });

    const navRail = page.locator('#dmNavRail');
    const chatMain = page.getByTestId('dm-chat-main');
    const infoPanel = page.getByTestId('dm-info-panel');

    await expect(navRail).toBeVisible();
    await expect(chatMain).toBeVisible();
    await expect(infoPanel).toBeVisible();
    await expect(page.getByTestId('dm-mobile-open-list')).toBeHidden();
    await expect(page.getByTestId('dm-mobile-open-info')).toBeHidden();

    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('#dmNavRail');
      const chat = document.querySelector('[data-testid="dm-chat-main"]');
      const info = document.querySelector('[data-testid="dm-info-panel"]');
      if (!(nav instanceof HTMLElement) || !(chat instanceof HTMLElement) || !(info instanceof HTMLElement)) {
        return null;
      }
      const navRect = nav.getBoundingClientRect();
      const chatRect = chat.getBoundingClientRect();
      const infoRect = info.getBoundingClientRect();
      return {
        navRight: navRect.right,
        chatLeft: chatRect.left,
        chatRight: chatRect.right,
        infoLeft: infoRect.left
      };
    });

    expect(geometry).not.toBeNull();
    expect(Number(geometry.navRight)).toBeLessThan(Number(geometry.chatLeft));
    expect(Number(geometry.chatRight)).toBeLessThan(Number(geometry.infoLeft));

    await expect(page.locator('main.app-shell')).toHaveScreenshot('dm-responsive-desktop-1440x900.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01
    });
  });

  for (const viewport of MOBILE_VIEWPORTS) {
    test(`uses screen/sheet flow on ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await openDmPage(page, { width: viewport.width, height: viewport.height });

      await expect(page.getByTestId('dm-mobile-open-list')).toBeVisible();
      await expect(page.getByTestId('dm-mobile-open-info')).toBeVisible();

      const initialState = await page.evaluate(() => {
        const shell = document.querySelector('main.dm-shell');
        const info = document.querySelector('[data-testid="dm-info-panel"]');
        const nav = document.querySelector('#dmNavRail');
        if (!(shell instanceof HTMLElement) || !(info instanceof HTMLElement) || !(nav instanceof HTMLElement)) {
          return null;
        }
        return {
          infoOpen: shell.classList.contains('is-mobile-info-open'),
          navOpen: shell.classList.contains('is-mobile-nav-open'),
          infoPointerEvents: window.getComputedStyle(info).pointerEvents,
          navPointerEvents: window.getComputedStyle(nav).pointerEvents
        };
      });

      expect(initialState).not.toBeNull();
      expect(initialState.infoOpen).toBeFalsy();
      expect(initialState.navOpen).toBeFalsy();
      expect(initialState.infoPointerEvents).toBe('none');
      expect(initialState.navPointerEvents).toBe('none');

      await page.getByTestId('dm-mobile-open-info').click();
      await expect(page.getByTestId('dm-mobile-close-info')).toBeVisible();

      const infoOpenState = await page.evaluate(() => {
        const shell = document.querySelector('main.dm-shell');
        const info = document.querySelector('[data-testid="dm-info-panel"]');
        if (!(shell instanceof HTMLElement) || !(info instanceof HTMLElement)) {
          return null;
        }
        const rect = info.getBoundingClientRect();
        return {
          infoOpen: shell.classList.contains('is-mobile-info-open'),
          infoTop: rect.top,
          infoBottom: rect.bottom,
          viewportHeight: window.innerHeight
        };
      });

      expect(infoOpenState).not.toBeNull();
      expect(infoOpenState.infoOpen).toBeTruthy();
      expect(Number(infoOpenState.infoTop)).toBeGreaterThanOrEqual(0);
      expect(Number(infoOpenState.infoBottom)).toBeLessThanOrEqual(Number(infoOpenState.viewportHeight) + 1);

      await page.getByTestId('dm-mobile-close-info').click();

      const infoClosedState = await page.evaluate(() => {
        const shell = document.querySelector('main.dm-shell');
        return shell instanceof HTMLElement ? shell.classList.contains('is-mobile-info-open') : true;
      });
      expect(infoClosedState).toBeFalsy();

      await page.getByTestId('dm-mobile-open-list').click();
      await expect(page.getByTestId('dm-mobile-close-list')).toBeVisible();

      const listOpenState = await page.evaluate(() => {
        const shell = document.querySelector('main.dm-shell');
        return shell instanceof HTMLElement ? shell.classList.contains('is-mobile-nav-open') : false;
      });
      expect(listOpenState).toBeTruthy();

      await page.getByTestId('dm-mobile-close-list').click();

      const composerMetrics = await page.evaluate(() => {
        const shell = document.querySelector('main.dm-shell');
        const composer = document.querySelector('[data-testid="dm-composer"]');
        if (!(shell instanceof HTMLElement) || !(composer instanceof HTMLElement)) {
          return null;
        }
        const composerRect = composer.getBoundingClientRect();
        return {
          navOpen: shell.classList.contains('is-mobile-nav-open'),
          infoOpen: shell.classList.contains('is-mobile-info-open'),
          top: composerRect.top,
          bottom: composerRect.bottom,
          viewportHeight: window.innerHeight
        };
      });

      expect(composerMetrics).not.toBeNull();
      expect(composerMetrics.navOpen).toBeFalsy();
      expect(composerMetrics.infoOpen).toBeFalsy();
      expect(Number(composerMetrics.top)).toBeGreaterThanOrEqual(0);
      expect(Number(composerMetrics.bottom)).toBeLessThanOrEqual(Number(composerMetrics.viewportHeight) + 1);

      const overflow = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(Number(overflow.scrollWidth)).toBeLessThanOrEqual(Number(overflow.viewportWidth) + 1);

      await expect(page.locator('main.app-shell')).toHaveScreenshot(`dm-responsive-${viewport.name}-chat.png`, {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        maxDiffPixelRatio: 0.01
      });

      await page.getByTestId('dm-mobile-open-info').click();
      await expect(page.getByTestId('dm-info-panel')).toHaveScreenshot(`dm-responsive-${viewport.name}-info-sheet.png`, {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        maxDiffPixelRatio: 0.01
      });
    });
  }
});
