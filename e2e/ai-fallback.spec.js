const { test } = require('@playwright/test');
const { expect, loginAsEinstein, uniqueName } = require('./helpers');

async function openSokratesThread(page) {
  await loginAsEinstein(page);
  await page.getByRole('link', { name: /sokrates/i }).first().click();
  await expect(page.getByTestId('dm-chat-main')).toBeVisible();
}

async function unlockAiComposer(page) {
  await page.evaluate(() => {
    const textareaNode = document.querySelector('[data-testid="dm-composer-input"]');
    const sendNode = document.querySelector('[data-testid="dm-send-button"]');
    const attachNode = document.querySelector('[data-testid="dm-attach-button"]');
    const emojiNode = document.querySelector('[data-testid="dm-emoji-button"]');
    const gifNode = document.querySelector('[data-testid="dm-gif-button"]');
    [textareaNode, sendNode, attachNode, emojiNode, gifNode].forEach((node) => {
      if (node instanceof HTMLButtonElement || node instanceof HTMLTextAreaElement) {
        node.disabled = false;
        if ('readOnly' in node) {
          node.readOnly = false;
        }
      }
    });
    document.dispatchEvent(new CustomEvent('apeiron:ai-health-state', {
      detail: {
        ok: true,
        configured: true,
        available: true,
        provider: 'openai',
        selectedProvider: 'openai',
        activeMode: 'auto'
      }
    }));
  });
}

async function injectAiProviderPlan(page, plan) {
  await page.route('**/app/home/ai-reply', async (route) => {
    const headers = { ...route.request().headers() };
    delete headers['content-length'];
    headers['content-type'] = 'application/json';
    const body = JSON.parse(route.request().postData() || '{}');
    body.aiProviderTestPlan = plan;
    await route.continue({
      headers,
      postData: JSON.stringify(body)
    });
  });
}

async function sendPrompt(page, prompt) {
  const textarea = page.getByTestId('dm-composer-input');
  const sendButton = page.getByTestId('dm-send-button');
  await textarea.fill(prompt);
  await sendButton.click();
}

test.describe('AI Auto Provider E2E', () => {
  test('uses OpenAI first when it succeeds and does not show fallback UI', async ({ page }) => {
    await openSokratesThread(page);
    await unlockAiComposer(page);
    await injectAiProviderPlan(page, {
      openai: [
        { ok: true, text: 'Dies ist die simulierte OpenAI-Antwort.' }
      ],
      ollama: []
    });

    await sendPrompt(page, `OpenAI zuerst ${uniqueName('openai_ok')}`);

    await expect(page.getByTestId('dm-timeline')).toContainText('Dies ist die simulierte OpenAI-Antwort.');
    await expect(page.locator('#dmAiProviderBadge')).toHaveText('Provider: OpenAI (Auto)');
    await expect(page.locator('#dmAiProviderBadge')).toHaveAttribute('data-ai-provider', 'openai');
    await expect(page.locator('#dmAiAvailabilityBanner')).toBeHidden();
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
    await page.unroute('**/app/home/ai-reply');
  });

  test('falls back immediately to Ollama when OpenAI quota is exhausted', async ({ page }) => {
    await openSokratesThread(page);
    await unlockAiComposer(page);
    await injectAiProviderPlan(page, {
      openai: [
        {
          ok: false,
          code: 'QUOTA',
          status: 429,
          retryable: false,
          providerErrorCode: 'insufficient_quota',
          detail: 'Simulated insufficient_quota.'
        }
      ],
      ollama: [
        { ok: true, text: 'Dies ist die simulierte Ollama-Antwort nach dem Quota-Fallback.' }
      ]
    });

    await sendPrompt(page, `Quota fallback ${uniqueName('quota_ok')}`);

    await expect(page.getByTestId('dm-timeline')).toContainText('Dies ist die simulierte Ollama-Antwort nach dem Quota-Fallback.');
    await expect(page.locator('#dmAiProviderBadge')).toHaveText('Provider: Ollama (Auto)');
    await expect(page.locator('#dmAiProviderBadge')).toHaveAttribute('data-ai-provider', 'ollama');
    await expect(page.locator('#dmAiAvailabilityBanner')).toHaveText('OpenAI nicht verfügbar - nutze Ollama.');
    await expect(page.getByTestId('dm-timeline')).not.toContainText('Kontingent erschöpft');
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
    await page.unroute('**/app/home/ai-reply');
  });

  test('falls back to Ollama after an OpenAI timeout sequence without looping', async ({ page }) => {
    await openSokratesThread(page);
    await unlockAiComposer(page);
    await injectAiProviderPlan(page, {
      openai: [
        { ok: false, code: 'TIMEOUT', status: 504, retryable: true, detail: 'Simulated timeout #1.' },
        { ok: false, code: 'TIMEOUT', status: 504, retryable: true, detail: 'Simulated timeout #2.' }
      ],
      ollama: [
        { ok: true, text: 'Dies ist die simulierte Ollama-Antwort nach dem Timeout-Fallback.' }
      ]
    });

    await sendPrompt(page, `Timeout fallback ${uniqueName('timeout_ok')}`);

    await expect(page.getByTestId('dm-timeline')).toContainText('Dies ist die simulierte Ollama-Antwort nach dem Timeout-Fallback.');
    await expect(page.locator('#dmAiProviderBadge')).toHaveText('Provider: Ollama (Auto)');
    await expect(page.locator('#dmAiProviderBadge')).toHaveAttribute('data-ai-provider', 'ollama');
    await expect(page.getByTestId('dm-timeline')).not.toContainText('Zeitüberschreitung beim AI-Provider.');
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
    await page.unroute('**/app/home/ai-reply');
  });

  test('renders a normal Sokrates message and disables sending when both providers fail', async ({ page }) => {
    await openSokratesThread(page);
    await unlockAiComposer(page);
    await injectAiProviderPlan(page, {
      openai: [
        { ok: false, code: 'TIMEOUT', status: 504, retryable: true, detail: 'Simulated OpenAI timeout #1.' },
        { ok: false, code: 'TIMEOUT', status: 504, retryable: true, detail: 'Simulated OpenAI timeout #2.' }
      ],
      ollama: [
        { ok: false, code: 'TIMEOUT', status: 503, retryable: true, detail: 'Simulated Ollama outage.' },
        { ok: false, code: 'TIMEOUT', status: 503, retryable: true, detail: 'Simulated Ollama outage retry.' }
      ]
    });

    await sendPrompt(page, `Both down ${uniqueName('down')}`);

    await expect(page.getByTestId('dm-timeline')).toContainText('Die Verbindung zu meinem λόγος ist unterbrochen; als spräche man durch dichten Nebel.');
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
    await expect(page.locator('[data-ai-error-code]')).toHaveCount(0);
    await expect(page.locator('#dmAiAvailabilityBanner')).toBeHidden();
    await expect(page.getByTestId('dm-send-button')).toBeDisabled();
    await page.unroute('**/app/home/ai-reply');
  });
});
