const { test } = require('@playwright/test');
const { expect, loginAsEinstein, uniqueName } = require('./helpers');

test.describe('Ollama Live E2E', () => {
  test('uses the real Ollama provider and returns a non-placeholder Sokrates answer', async ({ page }) => {
    test.setTimeout(240000);

    await loginAsEinstein(page);

    try {
      await page.goto('/app/settings/ai', { waitUntil: 'domcontentloaded' });
      await page.locator('select[name="providerMode"]').selectOption('ollama');
      await page.locator('input[name="ollamaModel"]').fill('llama3.2:3b');
      await page.locator('form[action="/app/settings/ai/save"]').evaluate((form) => {
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      });
      await page.waitForURL('**/app/settings/ai', { waitUntil: 'domcontentloaded' });

      await expect(page.getByTestId('ai-settings-ollama-configured')).toHaveText('ja');
      await expect(page.getByTestId('ai-settings-ollama-reachable')).toHaveText('ja');

      await page.goto('/app/home', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: /sokrates/i }).first().click();
      await expect(page.getByTestId('dm-chat-main')).toBeVisible();

      const messages = page.getByTestId('dm-message');
      const prompts = [
        `Antworte in einem Satz: Was ist Gerechtigkeit? ${uniqueName('ollama_live_a')}`,
        `Antworte in einem Satz: Was ist Tugend? ${uniqueName('ollama_live_b')}`,
        `Antworte in einem Satz: Was ist Wissen? ${uniqueName('ollama_live_c')}`
      ];
      const replies = [];

      for (const prompt of prompts) {
        const beforeCount = await messages.count();
        await page.getByTestId('dm-composer-input').fill(prompt);
        await page.getByTestId('dm-send-button').click();

        await expect(page.locator('.ai-pending-msg')).toHaveCount(0, { timeout: 120000 });
        await expect(messages).toHaveCount(beforeCount + 2, { timeout: 120000 });
        await expect(page.locator('#dmAiProviderBadge')).toHaveText('Provider: Ollama', { timeout: 120000 });

        const latestMessage = messages.last();
        const latestText = String((await latestMessage.textContent()) || '').trim();

        expect(latestText).toBeTruthy();
        expect(latestText).not.toContain('Die Verbindung zu meinem λόγος ist unterbrochen');
        expect(latestText).not.toContain('dichten Nebel');
        expect(latestText).not.toContain(prompt);
        replies.push(latestText);
      }

      // Real local models can occasionally collapse two prompts into the same concise wording.
      // This test is about "real, non-placeholder answers", not about guaranteed stylistic variance.
      expect(new Set(replies).size).toBeGreaterThanOrEqual(2);
    } finally {
      await page.goto('/app/settings/ai', { waitUntil: 'domcontentloaded' });
      await page.locator('select[name="providerMode"]').selectOption('auto');
      await page.locator('form[action="/app/settings/ai/save"]').evaluate((form) => {
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      });
      await page.waitForURL('**/app/settings/ai', { waitUntil: 'domcontentloaded' });
    }
  });
});
