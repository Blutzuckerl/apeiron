const { test } = require('@playwright/test');
const {
  expect,
  loginAsEinstein,
  stabilizeVisualSnapshotUi
} = require('./helpers');

test.describe('Visual Smoke - Profile DM Picker', () => {
  test.beforeEach(async ({ page }) => {
    await stabilizeVisualSnapshotUi(page);
  });

  test('captures DM list, composer, emoji/gif pickers, and profile modal without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/home?thread=2' });

    await expect(page.getByTestId('dm-chat-main')).toBeVisible();
    await expect(page.getByTestId('dm-composer')).toBeVisible();

    await expect(page.locator('main.app-shell')).toHaveScreenshot('visual-smoke-dm-home.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01
    });

    await page.getByTestId('dm-emoji-button').click();
    await expect(page.getByTestId('dm-emoji-popover')).toBeVisible();
    await expect(page.getByTestId('dm-emoji-popover')).toHaveScreenshot('visual-smoke-emoji-popover.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01
    });
    await page.keyboard.press('Escape');

    await page.getByTestId('dm-gif-button').click();
    await expect(page.getByTestId('dm-gif-modal')).toBeVisible();
    await expect(page.getByTestId('dm-gif-modal')).toHaveScreenshot('visual-smoke-gif-modal.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01
    });
    await page.getByTestId('dm-gif-close').click();

    await page.evaluate(() => {
      const timeline = document.querySelector('[data-testid="dm-timeline"]');
      if (!(timeline instanceof HTMLElement)) {
        return;
      }
      for (let index = 0; index < 90; index += 1) {
        const article = document.createElement('article');
        article.className = 'msg';
        article.innerHTML = `
          <div class="avatar msg-avatar"><span class="avatar-fallback">VR</span></div>
          <div class="bubble">
            <div class="meta"><strong>Visual</strong> <span>12:34</span></div>
            <p class="msg-text">Visual smoke filler ${index}</p>
          </div>
        `;
        timeline.appendChild(article);
      }
      timeline.scrollTop = timeline.scrollHeight;
    });

    const composerMetrics = await page.evaluate(() => {
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

    expect(composerMetrics).not.toBeNull();
    expect(Number(composerMetrics.top || 0)).toBeGreaterThanOrEqual(0);
    expect(Number(composerMetrics.bottom || 0)).toBeLessThanOrEqual(Number(composerMetrics.viewportHeight || 0) + 1);

    await expect(page.getByTestId('dm-chat-main')).toHaveScreenshot('visual-smoke-dm-long-chat.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01
    });

    await page.getByTestId('profile-open').click();
    const modal = page.getByTestId('profile-modal-card');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveScreenshot('visual-smoke-profile-modal.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01
    });
  });
});
