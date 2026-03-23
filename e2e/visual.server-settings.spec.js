const { test } = require('@playwright/test');
const {
  EMOJI_ASSET,
  SERVER_BANNER_ASSET,
  expect,
  loginAsEinstein,
  stabilizeVisualSnapshotUi
} = require('./helpers');

test.describe.serial('Server Settings Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await stabilizeVisualSnapshotUi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsEinstein(page, { targetUrl: '/app/servers/2?channel=3' });
  });

  test('renders settings mode without members rail and expands main width', async ({ page }) => {
    const serverMainWidth = await page.getByTestId('server-text-view').evaluate((node) => {
      if (!(node instanceof HTMLElement)) {
        return 0;
      }
      return Math.round(node.getBoundingClientRect().width);
    });

    await expect(page.getByTestId('members-rail')).toBeVisible();
    await page.evaluate(() => {
      const timeline = document.getElementById('serverTimeline');
      if (!(timeline instanceof HTMLElement)) {
        return;
      }
      timeline.innerHTML = `
        <article class=\"msg\">
          <div class=\"avatar msg-avatar\"><span class=\"avatar-fallback\">SV</span></div>
          <div class=\"bubble\">
            <div class=\"meta\"><strong>Snapshot Probe</strong> <span>12:34</span></div>
            <p class=\"msg-text\">Static layout baseline.</p>
          </div>
        </article>
      `;
      timeline.scrollTop = 0;
    });
    const serverViewScreenshot = await page.getByTestId('server-text-view').screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
    expect(serverViewScreenshot).toMatchSnapshot('server-view-with-members.png');

    await page.goto('/app/servers/2/settings?section=overview', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('members-rail')).toHaveCount(0);
    await expect(page.getByText(/Members\\s+—/)).toHaveCount(0);
    await expect(page.getByTestId('server-timeline')).toHaveCount(0);
    await expect(page.getByTestId('server-composer')).toHaveCount(0);

    const settingsMainWidth = await page.getByTestId('server-settings-main').evaluate((node) => {
      if (!(node instanceof HTMLElement)) {
        return 0;
      }
      return Math.round(node.getBoundingClientRect().width);
    });

    expect(settingsMainWidth).toBeGreaterThan(serverMainWidth + 120);

    const settingsViewScreenshot = await page.getByTestId('server-settings-main').screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
    expect(settingsViewScreenshot).toMatchSnapshot('server-settings-overview-no-members.png');
  });

  test('persists icon and banner and updates the preview card', async ({ page }) => {
    await page.goto('/app/servers/2/settings?section=overview', { waitUntil: 'domcontentloaded' });

    await page.fill('#serverSettingsDescriptionInput', 'Visual branding regression check');
    await page.fill('#serverTraitsInput', 'creative, thinkers, test-lab');

    await page.setInputFiles('#serverIconFileInput', EMOJI_ASSET);
    await page.setInputFiles('#serverBannerFileInput', SERVER_BANNER_ASSET);

    await expect(page.locator('#serverPreviewIconImg')).toHaveAttribute('src', /data:image\//);
    await expect(page.locator('#serverPreviewBannerImg')).toHaveAttribute('src', /data:image\//);

    await page.locator('#serverProfileSettingsForm button[type="submit"]').click();
    await page.waitForURL('**/app/servers/2/settings?section=overview', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#serverPreviewIconImg')).toHaveAttribute('src', /\/uploads\/server-assets\/2\/icon-/);
    await expect(page.locator('#serverPreviewBannerImg')).toHaveAttribute('src', /\/uploads\/server-assets\/2\/banner-/);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('#serverPreviewIconImg')).toHaveAttribute('src', /\/uploads\/server-assets\/2\/icon-/);
    await expect(page.locator('#serverPreviewBannerImg')).toHaveAttribute('src', /\/uploads\/server-assets\/2\/banner-/);

    const previewCardScreenshot = await page.getByTestId('server-settings-preview-card').screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
    expect(previewCardScreenshot).toMatchSnapshot('server-settings-preview-branding.png');
  });

  test('keeps server name and metadata below the preview banner', async ({ page }) => {
    await page.goto('/app/servers/2/settings?section=overview', { waitUntil: 'domcontentloaded' });

    await page.fill('#serverSettingsNameInput', 'SPACE CLUB - THE VERY LONG SERVER NAME FOR WRAPPING CHECKS');
    await page.fill('#serverSettingsDescriptionInput', 'Creative lounge for experiments and design playtests.');

    const metrics = await page.evaluate(() => {
      const banner = document.getElementById('serverPreviewBanner');
      const name = document.getElementById('serverPreviewName');
      const description = document.getElementById('serverPreviewDescription');
      const counts = document.getElementById('serverPreviewCounts');
      const tags = document.getElementById('serverPreviewTags');
      const icon = document.getElementById('serverPreviewIcon');
      if (!(banner instanceof HTMLElement)
        || !(name instanceof HTMLElement)
        || !(description instanceof HTMLElement)
        || !(counts instanceof HTMLElement)
        || !(tags instanceof HTMLElement)
        || !(icon instanceof HTMLElement)) {
        return null;
      }
      const bannerRect = banner.getBoundingClientRect();
      const nameRect = name.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const countsRect = counts.getBoundingClientRect();
      const tagsRect = tags.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const nameStyle = window.getComputedStyle(name);
      const descriptionStyle = window.getComputedStyle(description);
      const countsStyle = window.getComputedStyle(counts);
      return {
        bannerBottom: bannerRect.bottom,
        nameTop: nameRect.top,
        descriptionTop: descriptionRect.top,
        countsTop: countsRect.top,
        tagsTop: tagsRect.top,
        iconTop: iconRect.top,
        iconBottom: iconRect.bottom,
        hasNameInsideBanner: banner.contains(name),
        hasDescriptionInsideBanner: banner.contains(description),
        hasCountsInsideBanner: banner.contains(counts),
        namePosition: nameStyle.position,
        descriptionPosition: descriptionStyle.position,
        countsPosition: countsStyle.position
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.hasNameInsideBanner).toBe(false);
    expect(metrics.hasDescriptionInsideBanner).toBe(false);
    expect(metrics.hasCountsInsideBanner).toBe(false);
    expect(metrics.namePosition).not.toBe('absolute');
    expect(metrics.descriptionPosition).not.toBe('absolute');
    expect(metrics.countsPosition).not.toBe('absolute');
    expect(metrics.nameTop).toBeGreaterThan(metrics.bannerBottom + 4);
    expect(metrics.descriptionTop).toBeGreaterThan(metrics.bannerBottom + 4);
    expect(metrics.countsTop).toBeGreaterThan(metrics.bannerBottom + 4);
    expect(metrics.tagsTop).toBeGreaterThan(metrics.bannerBottom + 4);
    expect(metrics.iconTop).toBeLessThan(metrics.bannerBottom);
    expect(metrics.iconBottom).toBeGreaterThan(metrics.bannerBottom);
  });

  test('renders apps directory card and updates Sokrates install state', async ({ page }) => {
    await page.evaluate(async () => {
      await fetch('/app/servers/2/apps/sokrates/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({})
      });
    });

    await page.goto('/app/servers/2/settings?section=apps', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('sokrates-app-card')).toBeVisible();
    await expect(page.getByTestId('sokrates-card-install-state')).toHaveText('Not installed');

    const uninstalledCardShot = await page.getByTestId('sokrates-app-card').screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
    expect(uninstalledCardShot).toMatchSnapshot('server-settings-apps-sokrates-not-installed.png');

    await page.getByTestId('sokrates-card-primary-action').click();
    await expect(page.getByTestId('sokrates-card-install-state')).toHaveText('Installed');

    const installedCardShot = await page.getByTestId('sokrates-app-card').screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
    expect(installedCardShot).toMatchSnapshot('server-settings-apps-sokrates-installed.png');

    await page.getByTestId('sokrates-card-primary-action').click();
    await expect(page.getByTestId('sokrates-settings-manage-modal')).toBeVisible();

    const modalShot = await page.getByTestId('sokrates-settings-manage-modal').screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    });
    expect(modalShot).toMatchSnapshot('server-settings-apps-sokrates-manage-modal.png');
  });
});
