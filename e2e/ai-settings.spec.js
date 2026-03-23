const { test } = require('@playwright/test');
const { expect, loginAs } = require('./helpers');

test.describe('AI Settings E2E', () => {
  test('shows live provider status from /ai/status in settings', async ({ page }) => {
    let aiStatusCalls = 0;

    await page.route('**/ai/status', async (route) => {
      aiStatusCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          configured: true,
          available: true,
          provider: 'openai',
          selectedProvider: 'ollama',
          model: 'llama3.2',
          activeMode: 'auto',
          active_mode: 'auto',
          openai_configured: false,
          ollama_configured: true,
          ollama_reachable: true,
          message: 'OpenAI nicht verfügbar - nutze Ollama.'
        })
      });
    });

    await loginAs(page, {
      identifier: 'einstein',
      password: 'apeiron123!',
      targetUrl: '/app/settings/ai'
    });

    await expect(page.getByRole('heading', { name: 'AI' })).toBeVisible();
    await expect(page.getByTestId('ai-settings-active-mode')).toHaveText('auto');
    await expect(page.getByTestId('ai-settings-selected-provider')).toHaveText('Ollama');
    await expect(page.getByTestId('ai-settings-openai-configured')).toHaveText('nein');
    await expect(page.getByTestId('ai-settings-ollama-configured')).toHaveText('ja');
    await expect(page.getByTestId('ai-settings-ollama-reachable')).toHaveText('ja');
    await expect(page.getByTestId('ai-settings-availability')).toHaveText('verfügbar');
    await expect(page.getByTestId('ai-settings-live-message')).toHaveText('OpenAI nicht verfügbar - nutze Ollama.');
    await expect(page.getByTestId('ai-settings-last-checked')).toContainText('Letzte Prüfung:');
    expect(aiStatusCalls).toBeGreaterThanOrEqual(1);
  });
});
