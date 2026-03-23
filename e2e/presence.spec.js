const { test } = require('@playwright/test');
const { expect, loginAs } = require('./helpers');

test.describe.serial('Presence and Profile E2E', () => {
  test('syncs online, dnd, idle, and offline presence across clients', async ({ browser }) => {
    const watcherContext = await browser.newContext();
    const actorContext = await browser.newContext();
    const watcherPage = await watcherContext.newPage();
    const actorPage = await actorContext.newPage();

    try {
      await loginAs(watcherPage, {
        identifier: 'einstein',
        targetUrl: '/app/friends?tab=all'
      });

      const eulerRow = watcherPage.locator('article.msg', { hasText: 'Leonhard Euler' }).first();
      await expect(eulerRow).toBeVisible();

      await loginAs(actorPage, {
        identifier: 'euler',
        targetUrl: '/app/home'
      });

      await expect.poll(async () => eulerRow.getAttribute('data-presence-status')).toBe('online');

      await actorPage.goto('/app/settings/profile');
      await actorPage.locator('#profilePresenceStatus').selectOption('dnd');
      await Promise.all([
        actorPage.waitForNavigation(),
        actorPage.locator('#profileSettingsForm').evaluate((form) => {
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        })
      ]);
      await expect.poll(async () => eulerRow.getAttribute('data-presence-status')).toBe('dnd');

      await actorPage.locator('#profilePresenceStatus').selectOption('online');
      await Promise.all([
        actorPage.waitForNavigation(),
        actorPage.locator('#profileSettingsForm').evaluate((form) => {
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        })
      ]);
      await expect.poll(async () => eulerRow.getAttribute('data-presence-status')).toBe('online');

      await actorPage.evaluate(() => {
        window.dispatchEvent(new Event('apeiron:presence-force-idle'));
      });
      await expect.poll(async () => eulerRow.getAttribute('data-presence-status')).toBe('idle');

      await actorPage.close({ runBeforeUnload: true });
      await expect.poll(async () => eulerRow.getAttribute('data-presence-status')).toBe('offline');
      await expect.poll(async () => {
        const value = await eulerRow.getAttribute('data-presence-last-seen');
        return Boolean(value);
      }).toBeTruthy();
    } finally {
      await actorContext.close();
      await watcherContext.close();
    }
  });

  test('opens the full profile overlay without navigation and closes it via X, ESC, and backdrop', async ({ page }) => {
    await loginAs(page, {
      identifier: 'einstein',
      targetUrl: '/app/home'
    });

    await page.getByRole('link', { name: /Leonhard Euler/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    const beforeUrl = page.url();
    const trigger = page.getByTestId('view-full-profile-button');
    await expect(trigger).toBeVisible();

    await trigger.click();
    await expect(page).toHaveURL(beforeUrl);
    await expect(page.getByTestId('full-profile-shell')).toBeVisible();
    await expect(page.locator('#fullProfileTitle')).toContainText('Leonhard Euler');
    await expect(page.locator('#fullProfileLayout .profile-banner')).toBeVisible();
    await expect(page.locator('#fullProfileLayout img.profile-avatar')).toBeVisible();
    await expect(page.getByTestId('profile-scroll')).toContainText(/Fotos|Noch keine Fotos|Untitled/);

    const layoutSnapshotBefore = await page.evaluate(() => {
      const card = document.querySelector('#fullProfileModal .full-profile-card');
      const side = document.querySelector('#fullProfileLayout .full-profile-side');
      const main = document.querySelector('#fullProfileLayout .full-profile-main');
      const tabs = document.querySelector('#fullProfileModal .full-profile-tabs');
      const panel = document.querySelector('[data-testid="profile-scroll"]');
      const readRect = (node) => {
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const rect = node.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      };
      return {
        card: readRect(card),
        side: readRect(side),
        main: readRect(main),
        tabs: readRect(tabs),
        shellOverflowY: window.getComputedStyle(document.getElementById('fullProfileShell')).overflowY,
        panelOverflowY: panel instanceof HTMLElement ? window.getComputedStyle(panel).overflowY : ''
      };
    });

    await page.locator('#fullProfileModal').getByRole('button', { name: /About\+/i }).click();
    await expect(page.getByTestId('profile-scroll')).toContainText('Keine Profilangaben vorhanden.');
    await expect(page.getByTestId('profile-scroll')).not.toContainText('Nicht angegeben');

    const layoutSnapshotAfterAbout = await page.evaluate(() => {
      const card = document.querySelector('#fullProfileModal .full-profile-card');
      const side = document.querySelector('#fullProfileLayout .full-profile-side');
      const main = document.querySelector('#fullProfileLayout .full-profile-main');
      const tabs = document.querySelector('#fullProfileModal .full-profile-tabs');
      const panel = document.querySelector('[data-testid="profile-scroll"]');
      const readRect = (node) => {
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const rect = node.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      };
      return {
        card: readRect(card),
        side: readRect(side),
        main: readRect(main),
        tabs: readRect(tabs),
        shellOverflowY: window.getComputedStyle(document.getElementById('fullProfileShell')).overflowY,
        panelOverflowY: panel instanceof HTMLElement ? window.getComputedStyle(panel).overflowY : ''
      };
    });

    for (const key of ['card', 'side', 'main', 'tabs']) {
      expect(Math.abs(layoutSnapshotAfterAbout[key].x - layoutSnapshotBefore[key].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(layoutSnapshotAfterAbout[key].y - layoutSnapshotBefore[key].y)).toBeLessThanOrEqual(1);
      expect(Math.abs(layoutSnapshotAfterAbout[key].width - layoutSnapshotBefore[key].width)).toBeLessThanOrEqual(1);
      expect(Math.abs(layoutSnapshotAfterAbout[key].height - layoutSnapshotBefore[key].height)).toBeLessThanOrEqual(1);
    }
    expect(layoutSnapshotAfterAbout.shellOverflowY).toBe('hidden');
    expect(layoutSnapshotAfterAbout.panelOverflowY).toMatch(/auto|scroll/);

    await page.locator('#fullProfileModal').getByRole('button', { name: /Mutual Friends/i }).click();
    await expect(page.getByTestId('profile-scroll')).toBeVisible();

    await page.locator('#fullProfileModal').getByRole('button', { name: /Mutual Servers/i }).click();
    await expect(page.getByTestId('profile-scroll')).toBeVisible();

    await page.locator('.full-profile-close').click();
    await expect(page.locator('#fullProfileModal')).toBeHidden();

    await trigger.click();
    await expect(page.locator('#fullProfileModal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#fullProfileModal')).toBeHidden();

    await trigger.click();
    await expect(page.locator('#fullProfileModal')).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.locator('#fullProfileModal')).toBeHidden();
  });

  test('keeps the profile settings view scrollable on shorter viewports', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 620 });
    await loginAs(page, {
      identifier: 'einstein',
      targetUrl: '/app/settings/profile'
    });

    const scroller = page.locator('.settings-grid .chat-main');
    await expect(scroller).toBeVisible();

    const metrics = await scroller.evaluate((node) => {
      const element = node;
      const start = element.scrollTop;
      element.scrollTop = element.scrollHeight;
      return {
        overflowY: window.getComputedStyle(element).overflowY,
        maxScroll: element.scrollHeight - element.clientHeight,
        delta: element.scrollTop - start
      };
    });

    expect(metrics.overflowY).toMatch(/auto|scroll/);
    expect(metrics.maxScroll).toBeGreaterThan(0);
    expect(metrics.delta).toBeGreaterThan(0);

    const saveButton = page.locator('#profileSettingsForm button[type="submit"]').last();
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible();
  });

  test('builds structured About+ in profile settings and keeps order and visibility in sync', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await loginAs(page, {
      identifier: 'einstein',
      targetUrl: '/app/settings/profile'
    });

    const builderLayout = await page.getByTestId('about-plus-builder-list').evaluate((node) => {
      const cards = [...node.querySelectorAll('[data-testid="about-plus-builder-card"]')];
      const first = cards[0];
      const second = cards[1];
      if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) {
        return null;
      }
      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      return {
        sameRow: Math.abs(firstRect.y - secondRect.y) <= 2,
        separated: Math.abs(firstRect.x - secondRect.x) > 40
      };
    });

    expect(builderLayout).not.toBeNull();
    expect(builderLayout.sameRow).toBeTruthy();
    expect(builderLayout.separated).toBeTruthy();

    await page.getByTestId('about-plus-open-picker').click();
    await expect(page.locator('#aboutPlusTemplatePicker')).toBeVisible();
    const dislikesTemplate = page.locator('[data-about-plus-template-create="dislikes"]');
    if (await dislikesTemplate.isEnabled()) {
      await dislikesTemplate.click();
    } else {
      await page.locator('#aboutPlusClosePickerBtn').click();
    }
    await expect(page.locator('[data-about-plus-block-id="template:dislikes"]')).toBeVisible();
    await page.getByTestId('about-plus-open-picker').click();
    await expect(page.locator('#aboutPlusTemplatePicker')).toBeVisible();
    const mediaTemplate = page.locator('[data-about-plus-template-create="media_card"]');
    if (await mediaTemplate.isEnabled()) {
      await mediaTemplate.click();
    } else {
      await page.locator('#aboutPlusClosePickerBtn').click();
    }
    await expect(page.locator('[data-about-plus-block-id="template:media_card"]')).toBeVisible();

    const dislikesInput = page.locator('[data-about-plus-list-input="template:dislikes"]');
    await dislikesInput.fill('Widersprüche ohne Prüfung');
    await page.locator('[data-about-plus-list-add="template:dislikes"]').click();

    const dislikesVisibilityToggle = page.locator('[data-about-plus-visible-toggle="template:dislikes"]');
    if ((await dislikesVisibilityToggle.getAttribute('aria-pressed')) !== 'true') {
      await dislikesVisibilityToggle.click();
    }

    await expect(page.locator('#settingsAboutPlusPreview')).toContainText(/Was ich nicht mag/i);
    await expect(page.locator('#settingsAboutPlusPreview')).toContainText('Widersprüche ohne Prüfung');

    await dislikesVisibilityToggle.click();
    await expect(page.locator('#settingsAboutPlusPreview')).not.toContainText('Widersprüche ohne Prüfung');
    await dislikesVisibilityToggle.click();
    await expect(page.locator('#settingsAboutPlusPreview')).toContainText('Widersprüche ohne Prüfung');

    await page.locator('[data-about-plus-display-mode="template:dislikes"]').selectOption('mini');
    await expect(page.locator('#settingsAboutPlusPreview .profile-about-card', { hasText: 'Widersprüche ohne Prüfung' }).first()).toHaveAttribute('data-about-plus-render-mode', 'mini');

    const mediaCard = page.locator('[data-about-plus-block-id="template:media_card"]');
    await mediaCard.scrollIntoViewIfNeeded();
    const clearMediaButton = mediaCard.locator('[data-about-plus-media-clear="template:media_card"]');
    if (await clearMediaButton.isEnabled()) {
      await clearMediaButton.click();
    }
    await mediaCard.locator('[data-about-plus-media-input="template:media_card"]').setInputFiles([
      'public/ressources/cat.png',
      'public/ressources/NyaUwuUsoWarm.jpg'
    ]);
    await expect(mediaCard.locator('[data-testid="about-plus-media-grid"] img')).toHaveCount(2);
    await mediaCard.locator('[data-about-plus-media-item-caption="template:media_card"]').first().fill('Relativity');
    await expect(page.locator('#settingsAboutPlusPreview .profile-about-card.is-media_card img')).toHaveCount(2);

    const getBuilderOrder = async () => page.locator('[data-testid="about-plus-builder-card"]').evaluateAll((cards) => (
      cards.map((card) => card.getAttribute('data-about-plus-block-id'))
    ));
    const initialOrder = await getBuilderOrder();
    const favoriteFoodCard = page.locator('[data-about-plus-block-id="template:favorite_food"]');
    const favoriteQuoteCard = page.locator('[data-about-plus-block-id="template:favorite_quote"]');
    await favoriteFoodCard.scrollIntoViewIfNeeded();
    await favoriteQuoteCard.scrollIntoViewIfNeeded();

    let earlierId = 'template:favorite_quote';
    let laterId = 'template:favorite_food';
    let earlierLabel = 'lieblingszitat';
    let laterLabel = 'lieblingsessen';
    if (initialOrder.indexOf(earlierId) < initialOrder.indexOf(laterId)) {
      earlierId = 'template:favorite_food';
      laterId = 'template:favorite_quote';
      earlierLabel = 'lieblingsessen';
      laterLabel = 'lieblingszitat';
      await page.evaluate(({ sourceId, targetId }) => {
        const source = document.querySelector(`[data-about-plus-block-id="${sourceId}"]`);
        const target = document.querySelector(`[data-about-plus-block-id="${targetId}"]`);
        if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
          return;
        }
        const dataTransfer = new DataTransfer();
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
      }, {
        sourceId: 'template:favorite_food',
        targetId: 'template:favorite_quote'
      });
    } else {
      await page.evaluate(({ sourceId, targetId }) => {
        const source = document.querySelector(`[data-about-plus-block-id="${sourceId}"]`);
        const target = document.querySelector(`[data-about-plus-block-id="${targetId}"]`);
        if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
          return;
        }
        const dataTransfer = new DataTransfer();
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
      }, {
        sourceId: 'template:favorite_quote',
        targetId: 'template:favorite_food'
      });
    }

    const reorderedOrder = await getBuilderOrder();
    expect(reorderedOrder).not.toEqual(initialOrder);
    expect(reorderedOrder.indexOf(earlierId)).toBeGreaterThanOrEqual(0);
    expect(reorderedOrder.indexOf(laterId)).toBeGreaterThanOrEqual(0);
    expect(reorderedOrder.indexOf(earlierId)).toBeLessThan(reorderedOrder.indexOf(laterId));

    const favoriteBookToggle = page.locator('[data-about-plus-visible-toggle="template:favorite_book"]');
    if ((await favoriteBookToggle.getAttribute('aria-pressed')) === 'true') {
      await favoriteBookToggle.click();
    }
    await expect(page.locator('#settingsAboutPlusPreview')).not.toContainText('Lieblingsbuch');

    const previewText = (await page.locator('#settingsAboutPlusPreview').innerText()).toLowerCase();
    expect(previewText.indexOf(earlierLabel)).toBeGreaterThanOrEqual(0);
    expect(previewText.indexOf(laterLabel)).toBeGreaterThanOrEqual(0);
    expect(previewText.indexOf(earlierLabel)).toBeLessThan(previewText.indexOf(laterLabel));

    await Promise.all([
      page.waitForNavigation(),
      page.locator('#profileSettingsForm').evaluate((form) => {
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      })
    ]);

    await expect(page.locator('[data-about-plus-block-id="template:dislikes"]')).toBeVisible();
    await expect(page.locator('[data-about-plus-block-id="template:dislikes"] .about-plus-list-chip-row')).toContainText('Widersprüche ohne Prüfung');
    await expect(page.locator('[data-about-plus-display-mode="template:dislikes"]')).toHaveValue('mini');
    await expect(page.locator('[data-about-plus-block-id="template:media_card"] [data-testid="about-plus-media-grid"] img')).toHaveCount(2);
    await expect(page.locator('[data-about-plus-block-id="template:media_card"] [data-about-plus-media-item-caption="template:media_card"]').first()).toHaveValue('Relativity');

    await page.goto('/app/home');
    const ownProfileButton = page.locator('.sidebar-user-footer [data-open-full-profile]').first();
    await expect(ownProfileButton).toBeVisible();
    await ownProfileButton.click();
    await expect(page.getByTestId('full-profile-shell')).toBeVisible();
    await page.locator('#fullProfileModal').getByRole('button', { name: /About\+/i }).click();

    const aboutPanel = page.getByTestId('profile-scroll');
    await expect(aboutPanel).toContainText(/Was ich nicht mag/i);
    await expect(aboutPanel).toContainText('Widersprüche ohne Prüfung');
    await expect(aboutPanel).not.toContainText('Lieblingsbuch');
    await expect(aboutPanel.locator('.profile-about-card.is-media_card img')).toHaveCount(2);
    await expect(aboutPanel.locator('.profile-about-card.is-media_card')).toContainText('Relativity');
    await expect(aboutPanel.locator('.profile-about-card', { hasText: 'Widersprüche ohne Prüfung' }).first()).toHaveAttribute('data-about-plus-render-mode', 'mini');

    const aboutText = (await aboutPanel.innerText()).toLowerCase();
    expect(aboutText.indexOf(earlierLabel)).toBeGreaterThanOrEqual(0);
    expect(aboutText.indexOf(laterLabel)).toBeGreaterThanOrEqual(0);
    expect(aboutText.indexOf(earlierLabel)).toBeLessThan(aboutText.indexOf(laterLabel));
  });

  test('keeps the full profile overlay scrollable on narrow viewports', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 620 });
    await loginAs(page, {
      identifier: 'einstein',
      targetUrl: '/app/home?thread=1'
    });

    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    await page.getByTestId('view-full-profile-button').click();
    await expect(page.getByTestId('full-profile-shell')).toBeVisible();

    await page.locator('#fullProfileModal').getByRole('button', { name: /About\+/i }).click();

    const metrics = await page.evaluate(() => {
      const shell = document.getElementById('fullProfileShell');
      const panel = document.querySelector('[data-testid="profile-scroll"]');
      return {
        shellOverflowY: shell instanceof HTMLElement ? window.getComputedStyle(shell).overflowY : '',
        panelOverflowY: panel instanceof HTMLElement ? window.getComputedStyle(panel).overflowY : ''
      };
    });

    expect(metrics.shellOverflowY).toBe('hidden');
    expect(metrics.panelOverflowY).toMatch(/auto|scroll/);
    await expect(page.getByTestId('profile-scroll')).toBeVisible();
  });
});
