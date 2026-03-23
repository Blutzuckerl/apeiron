const { test } = require('@playwright/test');
const { expect, loginAsEinstein, openDmThread } = require('./helpers');

test.describe('Chat Asset Preview E2E', () => {
  test('does not show large picker previews on hover', async ({ page }) => {
    await page.route('**/app/home/gifs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          favorites: [],
          recents: [],
          sections: [
            {
              id: 'global',
              label: 'Global',
              items: [
                {
                  id: 501,
                  name: 'cat_spin',
                  tags: 'cat,spin',
                  mime_type: 'image/gif',
                  url: '/public/ressources/aristotle.gif',
                  previewUrl: '/public/ressources/aristotle.gif',
                  source: 'global'
                }
              ]
            }
          ]
        })
      });
    });

    await loginAsEinstein(page);
    await openDmThread(page);

    await page.getByTestId('dm-emoji-button').click();
    await expect(page.getByTestId('dm-emoji-popover')).toBeVisible();
    const firstEmoji = page.getByTestId('dm-emoji-item').first();
    await expect(firstEmoji).toBeVisible();
    await firstEmoji.hover();
    await expect(page.locator('#emojiPickerPreviewOverlay')).toBeHidden();
    await expect(page.getByTestId('dm-emoji-popover')).toBeVisible();

    await page.getByTestId('dm-gif-button').click();
    const firstGif = page.getByTestId('dm-gif-result-item').first();
    await expect(firstGif).toBeVisible();
    await firstGif.hover();
    await expect(page.locator('#gifPickerPreviewOverlay')).toBeHidden();
  });

  test('uses a compact popover on left click and keeps the large preview explicit', async ({ page }) => {
    await loginAsEinstein(page);
    await openDmThread(page);

    await page.evaluate(() => {
      const timeline = document.getElementById('timeline');
      if (!(timeline instanceof HTMLElement)) {
        return;
      }

      const emojiMessage = document.createElement('article');
      emojiMessage.className = 'msg';
      emojiMessage.dataset.messageId = '880001';
      emojiMessage.dataset.isOwn = '0';
      emojiMessage.dataset.hasText = '1';
      emojiMessage.dataset.canDeleteAny = '0';
      emojiMessage.dataset.isSystemMessage = '0';
      emojiMessage.dataset.messageText = encodeURIComponent('Custom emoji');
      emojiMessage.innerHTML = `
        <div class="avatar msg-avatar"><span class="avatar-fallback">SO</span></div>
        <div class="bubble">
          <div class="meta"><strong>Sokrates</strong> <span>now</span></div>
          <p class="msg-text">
            <img
              class="inline-emoji"
              src="/public/ressources/cat.png"
              alt=":apei_cat:"
              title=":apei_cat:"
              data-message-emoji-token=":apei_cat:"
              data-message-emoji-name="apei_cat"
              data-message-emoji-url="/public/ressources/cat.png"
              data-message-emoji-source="Custom"
              data-message-emoji-scope="Server/Public"
            />
          </p>
        </div>
      `;

      const gifMessage = document.createElement('article');
      gifMessage.className = 'msg';
      gifMessage.dataset.messageId = '880002';
      gifMessage.dataset.isOwn = '0';
      gifMessage.dataset.hasText = '0';
      gifMessage.dataset.canDeleteAny = '0';
      gifMessage.dataset.isSystemMessage = '0';
      gifMessage.dataset.messageText = encodeURIComponent('');
      gifMessage.innerHTML = `
        <div class="avatar msg-avatar"><span class="avatar-fallback">SO</span></div>
        <div class="bubble">
          <div class="meta"><strong>Sokrates</strong> <span>now</span></div>
          <div class="msg-attachments">
            <a
              class="msg-attachment media"
              data-message-gif-id="990001"
              data-message-gif-name="philosophy_cat"
              data-message-gif-tags="wisdom,cat"
              data-message-gif-source="My Uploads"
              href="/public/ressources/aristotle.gif"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/public/ressources/aristotle.gif" alt="philosophy_cat" loading="lazy" />
            </a>
          </div>
        </div>
      `;

      timeline.appendChild(emojiMessage);
      timeline.appendChild(gifMessage);
    });

    const emojiMessage = page.locator('.msg[data-message-id="880001"]');
    const emojiNode = page.locator('.inline-emoji[data-message-emoji-token=":apei_cat:"]');
    await emojiMessage.click({ button: 'right' });
    await expect(page.locator('.message-context-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Preview Emoji' }).click();
    await expect(page.getByTestId('chat-preview-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chat-preview-overlay')).toBeHidden();

    await emojiNode.click();
    await expect(page.getByTestId('chat-preview-popover')).toBeVisible();
    await expect(page.getByTestId('chat-preview-overlay')).toBeHidden();
    await expect(page.getByTestId('chat-preview-popover-title')).toHaveText('apei_cat');
    await expect(page.getByTestId('chat-preview-popover-meta')).toContainText('Server/Public');
    await expect(page.getByTestId('chat-preview-more')).toHaveText('More');
    await emojiNode.click();
    await expect(page.getByTestId('chat-preview-popover')).toBeHidden();

    await emojiNode.click();
    await expect(page.getByTestId('chat-preview-popover')).toBeVisible();
    await page.getByTestId('chat-preview-more').click();
    await expect(page.getByTestId('chat-preview-popover')).toBeHidden();
    await expect(page.getByTestId('chat-preview-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chat-preview-overlay')).toBeHidden();

    const gifMessage = page.locator('.msg[data-message-id="880002"]');
    const gifNode = page.locator('[data-message-gif-id="990001"]').first();
    await gifMessage.click({ button: 'right' });
    await expect(page.locator('.message-context-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Preview GIF' }).click();
    await expect(page.getByTestId('chat-preview-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chat-preview-overlay')).toBeHidden();

    await gifNode.click();
    await expect(page.getByTestId('chat-preview-popover')).toBeVisible();
    await expect(page.getByTestId('chat-preview-overlay')).toBeHidden();
    await expect(page.getByTestId('chat-preview-popover-title')).toHaveText('philosophy_cat');
    await expect(page.getByTestId('chat-preview-popover-tags')).toContainText('#wisdom');
    await page.getByTestId('chat-preview-more').click();
    await expect(page.getByTestId('chat-preview-overlay')).toBeVisible();
    await expect(page.getByTestId('chat-preview-title')).toHaveText('GIF Preview');
    await expect(page.getByTestId('chat-preview-meta')).toContainText('philosophy_cat');
    await expect(page.getByTestId('chat-preview-tags')).toContainText('#wisdom');
    await page.getByTestId('chat-preview-backdrop').click({ position: { x: 8, y: 8 } });
    await expect(page.getByTestId('chat-preview-overlay')).toBeHidden();
  });
});
