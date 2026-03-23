const { test } = require('@playwright/test');
const { expect, loginAsEinstein, openDmThread, uniqueName } = require('./helpers');

async function longPress(locator, page, durationMs = 650) {
  await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const point = {
      clientX: rect.left + (rect.width / 2),
      clientY: rect.top + (rect.height / 2)
    };

    const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(touchStart, 'touches', {
      configurable: true,
      value: [point]
    });
    Object.defineProperty(touchStart, 'changedTouches', {
      configurable: true,
      value: [point]
    });
    node.dispatchEvent(touchStart);
  });

  await page.waitForTimeout(durationMs);

  await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const point = {
      clientX: rect.left + (rect.width / 2),
      clientY: rect.top + (rect.height / 2)
    };

    const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
    Object.defineProperty(touchEnd, 'touches', {
      configurable: true,
      value: []
    });
    Object.defineProperty(touchEnd, 'changedTouches', {
      configurable: true,
      value: [point]
    });
    node.dispatchEvent(touchEnd);
  });
}

test.describe('Message Context Menu E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEinstein(page);
    await openDmThread(page);
  });

  test('shows Edit and Delete for own messages and edits in place', async ({ page }) => {
    const original = `Context edit original ${uniqueName('ctxedit')}`;
    const updated = `Context edit updated ${uniqueName('ctxedit')}`;

    await page.getByTestId('dm-composer-input').fill(original);
    await page.getByTestId('dm-send-button').click();

    const ownMessage = page.locator('[data-testid="dm-message"].own').last();
    await expect(ownMessage).toContainText(original);

    await ownMessage.locator('.bubble').click({ button: 'right' });
    const menu = page.locator('.message-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Edit Message' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Delete Message' })).toBeVisible();

    await menu.getByRole('button', { name: 'Edit Message' }).click();
    await expect(page.locator('[data-composer-mode-bar]')).toBeVisible();
    await expect(page.locator('[data-composer-mode-title]')).toContainText(/Editing/i);
    await expect(page.getByTestId('dm-composer-input')).toHaveValue(original);

    await page.getByTestId('dm-composer-input').fill(updated);
    await page.getByTestId('dm-send-button').click();

    await expect(ownMessage).toContainText(updated);
    await expect(ownMessage).toContainText('(edited)');
    await expect(ownMessage).not.toContainText(original);
  });

  test('shows Report but no Edit/Delete on foreign DM messages', async ({ page }) => {
    const foreignMessage = page.locator('[data-testid="dm-message"]:not(.own)').first();
    await expect(foreignMessage).toBeVisible();

    await foreignMessage.locator('.bubble').click({ button: 'right' });
    const menu = page.locator('.message-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Report Message' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Edit Message' })).toHaveCount(0);
    await expect(menu.getByRole('button', { name: /Delete Message/ })).toHaveCount(0);
  });

  test('closes on outside click and Escape and stays within the viewport near edges', async ({ page }) => {
    const lastMessage = page.locator('[data-testid="dm-message"]').last();
    await lastMessage.scrollIntoViewIfNeeded();
    await lastMessage.locator('.bubble').click({ button: 'right' });

    const menu = page.locator('.message-context-menu');
    await expect(menu).toBeVisible();

    const bounds = await menu.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: window.innerWidth,
        height: window.innerHeight
      };
    });

    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);

    await page.mouse.click(5, 5);
    await expect(menu).toBeHidden();

    await lastMessage.locator('.bubble').click({ button: 'right' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('deletes only the targeted message and sends replies with a preview', async ({ page }) => {
    const doomed = `Delete target ${uniqueName('ctxdel')}`;
    const survivor = `Delete survivor ${uniqueName('ctxdel')}`;

    await page.getByTestId('dm-composer-input').fill(doomed);
    await page.getByTestId('dm-send-button').click();
    await page.getByTestId('dm-composer-input').fill(survivor);
    await page.getByTestId('dm-send-button').click();

    const ownMessages = page.locator('[data-testid="dm-message"].own');
    const doomedMessage = ownMessages.nth((await ownMessages.count()) - 2);
    const survivorMessage = ownMessages.last();

    await expect(doomedMessage).toContainText(doomed);
    await expect(survivorMessage).toContainText(survivor);

    await doomedMessage.locator('.bubble').click({ button: 'right' });
    page.once('dialog', async (dialog) => dialog.accept());
    await page.locator('.message-context-menu').getByRole('button', { name: 'Delete Message' }).click();

    await expect(page.locator('.deleted-copy')).toContainText('Diese Nachricht wurde gelöscht.');
    await expect(survivorMessage).toContainText(survivor);

    const replySourceText = (await survivorMessage.locator('.msg-text').first().textContent()) || 'reply source';
    await survivorMessage.locator('.bubble').click({ button: 'right' });
    await page.locator('.message-context-menu').getByRole('button', { name: 'Reply' }).click();

    await expect(page.locator('[data-composer-mode-bar]')).toBeVisible();
    await expect(page.locator('[data-composer-mode-title]')).toContainText(/Replying/i);

    const replyBody = `Reply body ${uniqueName('ctxreply')}`;
    await page.getByTestId('dm-composer-input').fill(replyBody);
    await page.getByTestId('dm-send-button').click();

    const latestOwn = page.locator('[data-testid="dm-message"].own').last();
    await expect(latestOwn).toContainText(replyBody);
    await expect(latestOwn.locator('.msg-reply-preview')).toBeVisible();
    await expect(latestOwn.locator('.msg-reply-preview')).toContainText(replySourceText.trim().slice(0, 20));
  });

  test('opens the same menu on mobile-style long press', async ({ page }) => {
    const ownMessage = page.locator('[data-testid="dm-message"].own').last();
    await expect(ownMessage).toBeVisible();

    await longPress(ownMessage.locator('.bubble'), page);

    const menu = page.locator('.message-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Reply' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Edit Message' })).toBeVisible();
  });
});
