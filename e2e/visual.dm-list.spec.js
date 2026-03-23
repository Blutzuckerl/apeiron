const { test } = require('@playwright/test');
const {
  collectConsoleMessages,
  expect,
  loginAsEinstein,
  stabilizeVisualSnapshotUi
} = require('./helpers');

async function prepareDmVisualState(page) {
  await loginAsEinstein(page, { targetUrl: '/app/home' });

  const fixtureResponse = await page.context().request.post('/app/test/fixtures/dm-visual');
  expect(fixtureResponse.ok()).toBeTruthy();
  const fixturePayload = await fixtureResponse.json();
  expect(fixturePayload.ok).toBeTruthy();
  expect(Number(fixturePayload.focusThreadId || 0)).toBeGreaterThan(0);

  await page.goto(`/app/home?thread=${Number(fixturePayload.focusThreadId)}`, {
    waitUntil: 'domcontentloaded'
  });

  const eulerRow = page.locator('#activeDmList [data-testid="dm-thread-row"]', { hasText: /Leonhard Euler/i }).first();
  await eulerRow.click();
  await expect(page.getByTestId('dm-chat-main')).toBeVisible();
  await page.getByTestId('dm-nav-scroll').evaluate((node) => {
    if (node instanceof HTMLElement) {
      node.scrollTop = 0;
    }
  });
}

async function attachDmDiagnostics(page, testInfo, consoleMessages = []) {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }

  if (consoleMessages.length) {
    await testInfo.attach('console.log', {
      body: consoleMessages.join('\n'),
      contentType: 'text/plain'
    });
  }

  const domDump = await page.evaluate(() => {
    const root = document.querySelector('#dmNavRail');
    return root instanceof HTMLElement ? root.outerHTML : '';
  }).catch(() => '');

  if (domDump) {
    await testInfo.attach('dm-nav.html', {
      body: domDump,
      contentType: 'text/html'
    });
  }
}

test.describe.serial('DM List Visual Regression', () => {
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = collectConsoleMessages(page);
    await stabilizeVisualSnapshotUi(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachDmDiagnostics(page, testInfo, consoleMessages);
  });

  test('captures the DM list in a stable desktop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepareDmVisualState(page);

    const dmRowCount = await page.locator('#activeDmList [data-testid="dm-thread-row"]').count();
    expect(dmRowCount).toBeGreaterThanOrEqual(7);

    const navLegacyText = await page.evaluate(() => {
      const pattern = /@\S+\s•\s(?:online|offline|abwesend|nicht stören|streaming)/i;
      return [...document.querySelectorAll('#dmNavRail [data-testid="dm-thread-row"]')]
        .map((row) => row.textContent || '')
        .filter((text) => pattern.test(text));
    });
    expect(navLegacyText).toEqual([]);

    const dotMetrics = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#dmNavRail [data-testid="dm-thread-row"][data-presence-user-id]')];
      const values = rows.map((row) => {
        const avatar = row.querySelector('[data-testid="dm-thread-avatar"]');
        const dot = row.querySelector('[data-testid="dm-thread-status-dot"]');
        if (!(avatar instanceof HTMLElement) || !(dot instanceof HTMLElement)) {
          return null;
        }
        const avatarRect = avatar.getBoundingClientRect();
        const dotRect = dot.getBoundingClientRect();
        return {
          width: Math.round(dotRect.width),
          height: Math.round(dotRect.height),
          insideRight: dotRect.right <= avatarRect.right + 4,
          insideBottom: dotRect.bottom <= avatarRect.bottom + 4,
          anchoredRight: (dotRect.left + (dotRect.width / 2)) > (avatarRect.left + (avatarRect.width / 2)),
          anchoredBottom: (dotRect.top + (dotRect.height / 2)) > (avatarRect.top + (avatarRect.height / 2))
        };
      }).filter(Boolean);

      const widths = values.map((entry) => entry.width);
      const heights = values.map((entry) => entry.height);
      return {
        count: values.length,
        maxWidthDelta: Math.max(...widths) - Math.min(...widths),
        maxHeightDelta: Math.max(...heights) - Math.min(...heights),
        allAnchored: values.every((entry) => entry.insideRight && entry.insideBottom && entry.anchoredRight && entry.anchoredBottom)
      };
    });

    expect(dotMetrics.count).toBeGreaterThan(0);
    expect(dotMetrics.maxWidthDelta).toBeLessThanOrEqual(1);
    expect(dotMetrics.maxHeightDelta).toBeLessThanOrEqual(1);
    expect(dotMetrics.allAnchored).toBeTruthy();

    const appShell = page.locator('main.app-shell');
    const navRail = page.locator('#dmNavRail');
    const eulerRow = page.locator('#activeDmList [data-testid="dm-thread-row"]', { hasText: /Leonhard Euler/i }).first();

    await expect(appShell).toHaveScreenshot('dm-home-desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });

    await expect(navRail).toHaveScreenshot('dm-nav-rail-desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });

    await expect(eulerRow).toHaveScreenshot('dm-row-euler-desktop.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
  });

  test('captures narrow desktop layout and keeps the composer visible in long chats', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await prepareDmVisualState(page);

    await expect(page.locator('[data-testid="dm-timeline"] .msg-avatar .status-dot')).toHaveCount(0);

    await page.evaluate(() => {
      const timeline = document.getElementById('timeline');
      if (!(timeline instanceof HTMLElement)) {
        return;
      }
      for (let index = 0; index < 90; index += 1) {
        const article = document.createElement('article');
        article.className = 'msg';
        article.innerHTML = `
          <div class="avatar msg-avatar"><span class="avatar-fallback">LG</span></div>
          <div class="bubble">
            <div class="meta"><strong>Long Chat</strong> <span>12:34</span></div>
            <p class="msg-text">Long DM filler ${index}</p>
          </div>
        `;
        timeline.appendChild(article);
      }
      timeline.scrollTop = timeline.scrollHeight;
    });

    const composerMetrics = await page.evaluate(() => {
      const timeline = document.querySelector('[data-testid="dm-timeline"]');
      const composer = document.querySelector('[data-testid="dm-composer"]');
      if (!(timeline instanceof HTMLElement) || !(composer instanceof HTMLElement)) {
        return null;
      }
      const composerRect = composer.getBoundingClientRect();
      return {
        timelineScrolled: timeline.scrollTop > 0,
        composerBottomInViewport: composerRect.bottom <= window.innerHeight,
        composerTopVisible: composerRect.top >= 0
      };
    });

    expect(composerMetrics).not.toBeNull();
    expect(composerMetrics.timelineScrolled).toBeTruthy();
    expect(composerMetrics.composerBottomInViewport).toBeTruthy();
    expect(composerMetrics.composerTopVisible).toBeTruthy();

    await expect(page.locator('main.app-shell')).toHaveScreenshot('dm-home-narrow.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });

    await expect(page.getByTestId('dm-chat-main')).toHaveScreenshot('dm-chat-long-composer-narrow.png', {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
  });
});
