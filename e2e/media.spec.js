const fs = require('fs');
const { test } = require('@playwright/test');
const {
  EMOJI_ASSET,
  GIF_ASSET,
  expect,
  loginAsEinstein,
  openDmThread,
  openServerChannel,
  uniqueName
} = require('./helpers');

test.describe('Emoji and GIF E2E', () => {
  test('uploads a custom emoji, persists favorites after reload, and deletes it without broken placeholders', async ({ page }) => {
    test.skip(!fs.existsSync(EMOJI_ASSET), 'keine passenden Dateien im Ordner');

    const emojiName = uniqueName('apei');
    await loginAsEinstein(page);
    await openDmThread(page);

    await page.getByTestId('dm-emoji-button').click();
    await expect(page.getByTestId('dm-emoji-browse-view')).toBeVisible();
    await expect(page.getByTestId('dm-emoji-add-view')).toBeHidden();
    await page.getByTestId('dm-emoji-add-button').click();
    await expect(page.getByTestId('dm-emoji-add-view')).toBeVisible();

    await page.getByTestId('dm-emoji-name-input').fill(emojiName);
    await page.getByTestId('dm-emoji-file-input').setInputFiles(EMOJI_ASSET);
    await expect(page.getByTestId('dm-emoji-preview-box')).toBeVisible();
    await expect(page.getByTestId('dm-emoji-upload-status')).toContainText('Ready to upload');

    await page.getByTestId('dm-emoji-upload-button').click();
    await expect(page.locator(`[data-custom-emoji-name="${emojiName}"]`).first()).toBeVisible();

    if (await page.getByTestId('dm-emoji-popover').isHidden()) {
      await page.getByTestId('dm-emoji-button').click();
    }
    const customEmoji = page.locator(`[data-custom-emoji-name="${emojiName}"]`).first();
    await expect(customEmoji).toBeVisible();
    await customEmoji.hover();
    await expect(page.locator('#emojiPickerPreviewOverlay')).toBeHidden();

    await customEmoji.click({ button: 'right' });
    const emojiMenu = page.locator('#emojiItemMenu');
    await expect(emojiMenu).toBeVisible();
    await emojiMenu.getByRole('button', { name: 'Favorite' }).click();
    await expect(page.locator('[data-emoji-section="favorites"]').locator(`[data-custom-emoji-name="${emojiName}"]`)).toBeVisible();

    await page.reload();
    await page.getByTestId('dm-emoji-button').click();
    await expect(page.locator(`[data-custom-emoji-name="${emojiName}"]`).first()).toBeVisible();
    await expect(page.locator('[data-emoji-section="favorites"]').locator(`[data-custom-emoji-name="${emojiName}"]`)).toBeVisible();
    await page.getByTestId('dm-emoji-search-input').fill('dragon');
    await expect(page.locator('[data-emoji-section="search-emoji"]').locator('[data-emoji-key="🐉"]')).toBeVisible();
    await page.getByTestId('dm-emoji-search-input').fill('');
    await expect(page.locator('[data-emoji-section="people"]')).toBeVisible();

    await openServerChannel(page);
    await page.getByTestId('server-emoji-button').click();
    await expect(page.locator(`[data-custom-emoji-name="${emojiName}"]`).first()).toBeVisible();
    await expect(page.locator('[data-emoji-section="favorites"]').locator(`[data-custom-emoji-name="${emojiName}"]`)).toBeVisible();

    await openDmThread(page);
    await page.getByTestId('dm-composer-input').fill(`Testing custom emoji: ${emojiName} `);
    await page.getByTestId('dm-emoji-button').click();
    await page.locator(`[data-custom-emoji-name="${emojiName}"]`).first().click();
    await page.getByTestId('dm-send-button').click();

    const latestOwn = page.locator('[data-testid="dm-message"].own').last();
    await expect(latestOwn.locator('.msg-text .inline-emoji')).toBeVisible();
    await expect(latestOwn.locator('.msg-text')).not.toContainText(`:${emojiName}:`);

    await page.getByTestId('dm-emoji-button').click();
    const customEmojiAgain = page.locator(`[data-custom-emoji-name="${emojiName}"]`).first();
    await customEmojiAgain.click({ button: 'right' });
    page.once('dialog', async (dialog) => dialog.accept());
    await page.locator('#emojiItemMenu').getByRole('button', { name: 'Delete Emoji' }).click();

    await expect(page.locator(`[data-custom-emoji-name="${emojiName}"]`)).toHaveCount(0);
    await expect(page.locator('[data-emoji-section="favorites"]').locator(`[data-custom-emoji-name="${emojiName}"]`)).toHaveCount(0);
    await expect(latestOwn.locator('.msg-text .inline-emoji')).toHaveCount(0);
    await expect(latestOwn.locator('.msg-text')).toContainText(`:${emojiName}:`);
  });

  test('uploads a custom GIF, finds it in libraries, and sends it as a GIF block', async ({ page }) => {
    test.skip(!fs.existsSync(GIF_ASSET), 'keine passenden Dateien im Ordner');

    const gifName = uniqueName('gifcat');
    await loginAsEinstein(page);
    await openServerChannel(page);

    await page.getByTestId('server-gif-button').click();
    await expect(page.getByTestId('server-gif-modal')).toBeVisible();
    await expect(page.getByTestId('server-gif-add-view')).toBeHidden();
    await page.getByTestId('server-gif-tab-mine').click();
    await expect(page.getByTestId('server-gif-add-view')).toBeHidden();
    await page.getByTestId('server-gif-tab-add').click();
    await expect(page.getByTestId('server-gif-add-view')).toBeVisible();

    await page.getByTestId('server-gif-name-input').fill(gifName);
    await page.getByTestId('server-gif-tag-input').fill('cat');
    await page.getByTestId('server-gif-tag-input').press('Enter');
    await page.getByTestId('server-gif-tag-input').fill('meme');
    await page.getByTestId('server-gif-tag-input').press('Enter');
    await page.getByTestId('server-gif-tag-input').fill('test');
    await page.getByTestId('server-gif-tag-input').press('Enter');
    await page.getByTestId('server-gif-file-input').setInputFiles(GIF_ASSET);
    await expect(page.getByTestId('server-gif-preview-box')).toBeVisible();
    await expect(page.getByTestId('server-gif-upload-status')).toContainText('Ready to upload');

    await page.getByTestId('server-gif-upload-button').click();
    await expect(page.getByTestId('server-upload-queue').locator('img')).toBeVisible();

    await page.getByTestId('server-gif-tab-mine').click();
    const mineGif = page.getByTestId('server-gif-results').getByTestId('server-gif-result-item').filter({ hasText: gifName }).first();
    await expect(mineGif).toBeVisible();
    await mineGif.hover();
    await expect(page.locator('#gifPickerPreviewOverlay')).toBeHidden();

    await mineGif.click({ button: 'right' });
    const gifMenu = page.locator('#gifItemMenu');
    await expect(gifMenu).toBeVisible();
    await gifMenu.getByRole('button', { name: 'Favorite' }).click();
    await page.getByTestId('server-gif-tab-favorites').click();
    await expect(page.getByTestId('server-gif-results').getByText(gifName)).toBeVisible();

    await page.getByTestId('server-gif-tab-global').click();
    await page.getByTestId('server-gif-search-input').fill(gifName);
    await expect(page.getByTestId('server-gif-results').getByText(gifName).first()).toBeVisible();
    await page.getByTestId('server-gif-search-input').fill('meme');
    await expect(page.getByTestId('server-gif-results').getByText(gifName).first()).toBeVisible();

    await page.getByTestId('server-gif-search-input').fill(gifName);
    await page.getByTestId('server-composer-input').fill(`Testing custom gif: ${gifName}`);
    await page.getByTestId('server-gif-result-item').filter({ hasText: gifName }).first().click();
    await expect(page.getByTestId('server-upload-queue').locator('img')).toBeVisible();
    await page.getByTestId('server-gif-close').click();
    await expect(page.getByTestId('server-gif-modal')).toBeHidden();
    await page.getByTestId('server-send-button').click();

    const latestOwn = page.locator('[data-testid="server-message"].own').last();
    await expect(latestOwn).toContainText(`Testing custom gif: ${gifName}`);
    await expect(latestOwn.locator('.msg-attachments img')).toBeVisible();
    await expect(latestOwn.locator('.msg-text')).not.toContainText('http');

    await page.getByTestId('server-gif-button').click();
    await page.getByTestId('server-gif-tab-mine').click();
    await page.getByTestId('server-gif-result-item').filter({ hasText: gifName }).first().click({ button: 'right' });
    await expect(page.locator('#gifItemMenu')).toBeVisible();
    page.once('dialog', async (dialog) => dialog.accept());
    await page.locator('#gifItemMenu').getByRole('button', { name: 'Delete GIF' }).evaluate((button) => {
      if (button instanceof HTMLButtonElement) {
        button.click();
      }
    });

    await page.getByTestId('server-gif-tab-favorites').click();
    await expect(page.getByTestId('server-gif-results').getByText(gifName)).toHaveCount(0);
    await expect(latestOwn.locator('.deleted-gif-placeholder')).toBeVisible();
  });

  test('respects custom emoji public/private visibility across users', async ({ page }) => {
    test.skip(!fs.existsSync(EMOJI_ASSET), 'keine passenden Dateien im Ordner');

    const privateName = uniqueName('priv');
    const publicName = uniqueName('publ');

    await loginAsEinstein(page);
    await openDmThread(page);

    await page.getByTestId('dm-emoji-button').click();
    await page.getByTestId('dm-emoji-add-button').click();
    await page.getByTestId('dm-emoji-name-input').fill(privateName);
    await page.getByTestId('dm-emoji-visibility-input').selectOption('private');
    await page.getByTestId('dm-emoji-file-input').setInputFiles(EMOJI_ASSET);
    await page.getByTestId('dm-emoji-upload-button').click();
    await expect(page.locator(`[data-custom-emoji-name="${privateName}"]`).first()).toBeVisible();

    await page.getByTestId('dm-emoji-add-button').click();
    await page.getByTestId('dm-emoji-name-input').fill(publicName);
    await page.getByTestId('dm-emoji-visibility-input').selectOption('public');
    await page.getByTestId('dm-emoji-file-input').setInputFiles(EMOJI_ASSET);
    await page.getByTestId('dm-emoji-upload-button').click();
    await expect(page.locator(`[data-custom-emoji-name="${publicName}"]`).first()).toBeVisible();

    await page.evaluate(async () => {
      await fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    });

    await page.goto('/login');
    await page.getByTestId('login-identifier-input').fill('euler');
    await page.getByTestId('login-password-input').fill('apeiron123!');
    await page.getByTestId('login-form').evaluate((form) => {
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    });
    await page.waitForURL((url) => url.pathname.startsWith('/app/'));
    await openDmThread(page);

    await page.getByTestId('dm-emoji-button').click();
    await expect(page.locator(`[data-custom-emoji-name="${privateName}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-custom-emoji-name="${publicName}"]`).first()).toBeVisible();

    await page.evaluate(async () => {
      await fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    });

    await loginAsEinstein(page);
    await openDmThread(page);
    await page.getByTestId('dm-emoji-button').click();
    for (const emojiName of [privateName, publicName]) {
      const ownedEmoji = page.locator(`[data-custom-emoji-name="${emojiName}"]`).first();
      await expect(ownedEmoji).toBeVisible();
      await ownedEmoji.click({ button: 'right' });
      await expect(page.locator('#emojiItemMenu')).toBeVisible();
      page.once('dialog', async (dialog) => dialog.accept());
      await page.locator('#emojiItemMenu').getByRole('button', { name: 'Delete Emoji' }).click();
      await expect(page.locator(`[data-custom-emoji-name="${emojiName}"]`)).toHaveCount(0);
    }
  });

  test('allows a server manager to delete another users public emoji from the server picker', async ({ page }) => {
    test.skip(!fs.existsSync(EMOJI_ASSET), 'keine passenden Dateien im Ordner');

    const publicName = uniqueName('modpub');

    await page.goto('/login');
    await page.getByTestId('login-identifier-input').fill('euler');
    await page.getByTestId('login-password-input').fill('apeiron123!');
    await page.getByTestId('login-form').evaluate((form) => {
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    });
    await page.waitForURL((url) => url.pathname.startsWith('/app/'));
    await openDmThread(page);

    await page.getByTestId('dm-emoji-button').click();
    await page.getByTestId('dm-emoji-add-button').click();
    await page.getByTestId('dm-emoji-name-input').fill(publicName);
    await page.getByTestId('dm-emoji-visibility-input').selectOption('public');
    await page.getByTestId('dm-emoji-file-input').setInputFiles(EMOJI_ASSET);
    await page.getByTestId('dm-emoji-upload-button').click();
    await expect(page.locator(`[data-custom-emoji-name="${publicName}"]`).first()).toBeVisible();

    await page.evaluate(async () => {
      await fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    });

    await loginAsEinstein(page);
    await openServerChannel(page);

    await page.getByTestId('server-emoji-button').click();
    await page.getByTestId('server-emoji-search-input').fill(publicName);
    const foreignPublicEmoji = page.locator(`[data-custom-emoji-name="${publicName}"]`).first();
    await foreignPublicEmoji.scrollIntoViewIfNeeded();
    await expect(foreignPublicEmoji).toBeVisible();
    await foreignPublicEmoji.click({ button: 'right' });
    await expect(page.locator('#emojiItemMenu')).toBeVisible();
    page.once('dialog', async (dialog) => dialog.accept());
    await page.locator('#emojiItemMenu').getByRole('button', { name: 'Delete Emoji' }).click();
    await expect(page.locator(`[data-custom-emoji-name="${publicName}"]`)).toHaveCount(0);
  });
});
