const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test: base, expect } = require('@playwright/test');
const { uniqueName } = require('../../e2e/helpers');

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'playwright-artifacts', 'sokrates');
fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

const REDACT_ENV_KEYS = [
  'OPENAI_API_KEY',
  'SESSION_SECRET',
  'JWT_SECRET',
  'TURN_PASS',
  'TURN_USER',
  'TURN_URLS'
];

const TRACKED_PATHS = [
  '/app/home/message',
  '/app/home/ai-reply',
  '/app/home/ai-status',
  '/health/ai',
  '/ai/status'
];

const FALLBACK_TEXT_PATTERNS = [
  /Zu viele Fragen drängen zugleich; mein λόγος stockt/i,
  /Nicht aus Unwillen schweige ich/i,
  /Die Verbindung ist wie Nebel; ich höre dich, doch meine Antwort erreicht dich nicht/i,
  /Man hat mir den Mund gegeben, aber nicht die Zunge/i,
  /Der AI-Provider ist derzeit nicht verfügbar/i,
  /Netzwerkfehler beim AI-Provider/i
];
const REAL_REPLY_TIMEOUT_MS = Math.max(30_000, Number(process.env.SOKRATES_REPLY_TIMEOUT_MS || 60_000));

const diagnosticsByTestId = new Map();

function sanitizeForFileName(value) {
  return String(value || 'test')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'test';
}

function looksTrackedUrl(url) {
  try {
    const parsed = new URL(url);
    return TRACKED_PATHS.some((trackedPath) => parsed.pathname.includes(trackedPath));
  } catch (_error) {
    return false;
  }
}

function redactSensitiveText(input) {
  let text = String(input || '');

  REDACT_ENV_KEYS.forEach((key) => {
    const envRegex = new RegExp(`(${key}\\s*[=:]\\s*)([^\\s\\"'\\n]+)`, 'gi');
    text = text.replace(envRegex, '$1***REDACTED***');

    const jsonRegex = new RegExp(`(\"${key.toLowerCase()}\"\\s*:\\s*\")(.*?)(\")`, 'gi');
    text = text.replace(jsonRegex, '$1***REDACTED***$3');
  });

  text = text.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***REDACTED***');
  text = text.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***REDACTED***');

  return text;
}

function runDockerComposeLogs(service, tail = 500) {
  try {
    const output = execFileSync('docker', ['compose', 'logs', `--tail=${tail}`, service], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    return redactSensitiveText(output);
  } catch (error) {
    const stdout = redactSensitiveText(String(error?.stdout || ''));
    const stderr = redactSensitiveText(String(error?.stderr || ''));
    return `docker compose logs failed for ${service}: ${error.message}\n${stdout}\n${stderr}`.trim();
  }
}

async function waitForRouteHealthy(page, route = '/login', timeoutMs = 60_000) {
  const started = Date.now();
  while ((Date.now() - started) < timeoutMs) {
    try {
      const response = await page.request.get(route, { failOnStatusCode: false });
      if (response.status() >= 200 && response.status() < 400) {
        return;
      }
    } catch (_error) {
      // Retry until timeout.
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`Health check timeout for ${route} after ${timeoutMs}ms.`);
}

async function registerFreshUser(page, testInfo, targetUrl = '/app/home') {
  const slug = uniqueName('sokrates_user').replace(/[^a-z0-9_]/gi, '').slice(0, 20).toLowerCase();
  const username = `sok_${slug}`.slice(0, 28);
  const password = 'Apeiron123!';
  const email = `${username}@apeiron.app`;

  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('register-email-input').fill(email);
  await page.getByTestId('register-display-name-input').fill(`Sokrates ${testInfo.repeatEachIndex || 0}`);
  await page.getByTestId('register-username-input').fill(username);
  await page.getByTestId('register-dob-input').fill('1994-01-01');
  await page.getByTestId('register-password-input').fill(password);
  await page.getByTestId('register-policy-input').check();
  await page.getByTestId('register-form').evaluate((form) => {
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  });
  await page.waitForURL((url) => url.pathname.startsWith('/app/'), { waitUntil: 'domcontentloaded' });
  if (targetUrl !== '/app/home') {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  }
}

async function openSokratesDm(page) {
  await page.getByRole('link', { name: /sokrates/i }).first().click();

  await expect(page.getByTestId('dm-chat-main')).toBeVisible();
  await expect(page.locator('.chat-head h2')).toContainText(/Σ\s*Sokrates|Sokrates/i);
  await expect(page.locator('#dmAiProviderBadge')).toBeVisible();
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
  await page.getByTestId('dm-composer-input').fill(prompt);
  await page.getByTestId('dm-send-button').click();
}

async function waitForFreshSokratesReply(page, beforeMessageCount, timeoutMs = REAL_REPLY_TIMEOUT_MS) {
  const timelineMessages = page.locator('[data-testid="dm-message"]');
  await expect(timelineMessages).toHaveCount(beforeMessageCount + 2, { timeout: timeoutMs });

  const latestMessage = timelineMessages.last();
  await expect(latestMessage).toContainText(/Sokrates/i, { timeout: timeoutMs });
  return latestMessage;
}

async function expectLooksLikeRealReply(messageLocator) {
  const text = (await messageLocator.innerText()).trim();
  expect(text.length).toBeGreaterThanOrEqual(30);
  FALLBACK_TEXT_PATTERNS.forEach((pattern) => {
    expect(text).not.toMatch(pattern);
  });
}

async function fetchJson(page, route) {
  const response = await page.request.get(route, { failOnStatusCode: false });
  const body = await response.json().catch(() => ({}));
  return { status: response.status(), ok: response.ok(), body };
}

async function fetchAiStatus(page) {
  try {
    const response = await page.request.get('/app/home/ai-status', { failOnStatusCode: false });
    const raw = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      parsed = null;
    }

    return {
      status: response.status(),
      ok: response.ok(),
      body: parsed || redactSensitiveText(raw).slice(0, 1000)
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      body: `ai-status request failed: ${String(error?.message || error)}`
    };
  }
}

async function attachJson(testInfo, name, data) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    contentType: 'application/json'
  });
}

async function attachTextFile(testInfo, name, filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  await testInfo.attach(name, {
    path: filePath,
    contentType: 'text/plain'
  });
}

function initDiagnostics(page, testInfo) {
  const state = {
    consoleMessages: [],
    networkCalls: [],
    pendingRequests: new Map(),
    aiStatusBefore: null,
    aiStatusAfter: null
  };

  const onConsole = (message) => {
    state.consoleMessages.push({
      ts: new Date().toISOString(),
      type: message.type(),
      text: redactSensitiveText(message.text())
    });
  };

  const onRequest = (request) => {
    if (!looksTrackedUrl(request.url())) {
      return;
    }

    state.pendingRequests.set(request, {
      ts: Date.now(),
      method: request.method(),
      url: request.url()
    });
  };

  const onRequestFailed = (request) => {
    const pending = state.pendingRequests.get(request);
    if (!pending) {
      return;
    }

    state.pendingRequests.delete(request);
    state.networkCalls.push({
      method: pending.method,
      url: pending.url,
      status: 'FAILED',
      durationMs: Date.now() - pending.ts,
      failureText: redactSensitiveText(String(request.failure()?.errorText || 'request_failed'))
    });
  };

  const onResponse = async (response) => {
    const request = response.request();
    const pending = state.pendingRequests.get(request);
    if (!pending) {
      return;
    }

    state.pendingRequests.delete(request);

    const call = {
      method: pending.method,
      url: pending.url,
      status: response.status(),
      durationMs: Date.now() - pending.ts
    };

    if (call.url.includes('/app/home/ai-reply') || call.url.includes('/app/home/ai-status')) {
      const body = await response.text().catch(() => '');
      call.responsePreview = redactSensitiveText(String(body || '').slice(0, 800));
    }

    state.networkCalls.push(call);
  };

  page.on('console', onConsole);
  page.on('request', onRequest);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  diagnosticsByTestId.set(testInfo.testId, {
    state,
    teardown: () => {
      page.off('console', onConsole);
      page.off('request', onRequest);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
    }
  });

  return state;
}

async function finalizeDiagnostics(page, testInfo) {
  const entry = diagnosticsByTestId.get(testInfo.testId);
  if (!entry) {
    return;
  }

  entry.teardown();
  const { state } = entry;
  diagnosticsByTestId.delete(testInfo.testId);

  state.aiStatusAfter = await fetchAiStatus(page);

  const now = Date.now();
  for (const pending of state.pendingRequests.values()) {
    state.networkCalls.push({
      method: pending.method,
      url: pending.url,
      status: 'PENDING',
      durationMs: now - pending.ts
    });
  }

  const failingOrSlowCalls = state.networkCalls.filter((call) => {
    if (call.status === 'FAILED' || call.status === 'PENDING') {
      return true;
    }
    if (typeof call.status === 'number' && call.status >= 400) {
      return true;
    }
    return Number(call.durationMs || 0) > 15_000;
  });

  const diagnosticsPayload = {
    aiStatusBefore: state.aiStatusBefore,
    aiStatusAfter: state.aiStatusAfter,
    failingOrSlowCalls,
    allTrackedCalls: state.networkCalls,
    consoleTail: state.consoleMessages.slice(-80)
  };
  await attachJson(testInfo, 'sokrates-diagnostics.json', diagnosticsPayload);
  const slug = sanitizeForFileName(testInfo.title);
  const diagnosticsPath = path.join(ARTIFACT_ROOT, `${slug}.diagnostics.json`);
  fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnosticsPayload, null, 2), 'utf8');

  if (testInfo.status !== testInfo.expectedStatus) {
    const appLogPath = path.join(ARTIFACT_ROOT, `${slug}.app.log`);
    const ollamaLogPath = path.join(ARTIFACT_ROOT, `${slug}.ollama.log`);

    fs.writeFileSync(appLogPath, runDockerComposeLogs('app', 500), 'utf8');
    fs.writeFileSync(ollamaLogPath, runDockerComposeLogs('ollama', 500), 'utf8');

    await attachTextFile(testInfo, 'docker-app.log', appLogPath);
    await attachTextFile(testInfo, 'docker-ollama.log', ollamaLogPath);
  }
}

const test = base;

test.beforeEach(async ({ page }, testInfo) => {
  const state = initDiagnostics(page, testInfo);
  await waitForRouteHealthy(page, '/login', 60_000);

  await registerFreshUser(page, testInfo, '/app/home');
  state.aiStatusBefore = await fetchAiStatus(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await finalizeDiagnostics(page, testInfo);
});

test.describe('A) Sokrates DM Entry', () => {
  test.use({
    recordHar: {
      path: path.join(ARTIFACT_ROOT, 'sokrates-A-open-dm.har'),
      mode: 'minimal'
    }
  });

  test('opens Sokrates DM and verifies header + AI badge', async ({ page }) => {
    await openSokratesDm(page);
    await expect(page.locator('#dmAiProviderBadge')).toContainText(/Provider:/i);
  });
});

test.describe('B) Sokrates Reply', () => {
  test.use({
    recordHar: {
      path: path.join(ARTIFACT_ROOT, 'sokrates-B-reply.har'),
      mode: 'minimal'
    }
  });

  test('sends message and expects Sokrates answer within configured timeout', async ({ page }) => {
    await openSokratesDm(page);

    const timelineMessages = page.locator('[data-testid="dm-message"]');
    const beforeCount = await timelineMessages.count();
    const prompt = 'Definiere Tugend in einem Satz.';

    await sendPrompt(page, prompt);
    await expect(page.locator('[data-testid="dm-message"].own').last()).toContainText(prompt);

    const latestReply = await waitForFreshSokratesReply(page, beforeCount, REAL_REPLY_TIMEOUT_MS);
    await expectLooksLikeRealReply(latestReply);
    await expect(page.getByTestId('dm-timeline')).not.toContainText(/Sokrates Zeitüberschreitung/i);
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0, { timeout: 45_000 });
  });
});

test.describe('C) Provider Fallback', () => {
  test.use({
    recordHar: {
      path: path.join(ARTIFACT_ROOT, 'sokrates-C-fallback.har'),
      mode: 'minimal'
    }
  });

  test('falls back to Ollama when OpenAI fails (forced via test plan)', async ({ page }) => {
    await openSokratesDm(page);
    await unlockAiComposer(page);
    const aiStatusBefore = await fetchAiStatus(page);
    const openAiCircuitOpenBefore = Boolean(aiStatusBefore?.body?.openaiCircuitOpen);
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
        { ok: true, text: 'Dies ist die simulierte Ollama-Antwort fuer den Fallback-Test.' }
      ]
    });

    const beforeCount = await page.locator('[data-testid="dm-message"]').count();
    const aiReplyResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/app/home/ai-reply') && response.request().method() === 'POST'
    );
    await sendPrompt(page, `Fallback pruefen ${uniqueName('fallback')}`);

    await expect(page.getByTestId('dm-timeline')).toContainText('Dies ist die simulierte Ollama-Antwort fuer den Fallback-Test.');
    await expect(page.locator('#dmAiProviderBadge')).toContainText(/Ollama/i);
    await expect(page.getByTestId('dm-timeline')).not.toContainText(/Mittel fehlen|Gateway Timeout|stack|trace/i);
    await waitForFreshSokratesReply(page, beforeCount, 20_000);
    const aiReplyResponse = await aiReplyResponsePromise;
    const aiReplyPayload = await aiReplyResponse.json();
    const traceId = aiReplyResponse.headers()['x-ai-trace-id'];
    expect(Boolean(traceId)).toBeTruthy();
    const traceFetch = await fetchJson(page, `/app/debug/ai-trace/${traceId}`);
    expect(traceFetch.ok).toBeTruthy();
    expect(Array.isArray(traceFetch.body?.trace?.provider_attempts)).toBeTruthy();
    expect(String(traceFetch.body?.trace?.final_provider_used || '')).toBe('ollama');
    expect(String(aiReplyPayload.provider || aiReplyPayload.selectedProvider || '')).toBe('ollama');
    expect(Array.isArray(aiReplyPayload.providerAttemptOrder)).toBeTruthy();
    if (openAiCircuitOpenBefore) {
      expect(aiReplyPayload.providerAttemptOrder).toEqual(['ollama']);
    } else {
      expect(aiReplyPayload.providerAttemptOrder).toEqual(['openai', 'ollama']);
    }

    await page.unroute('**/app/home/ai-reply');
  });

  test('falls back to Ollama when OPENAI_API_KEY is invalid (real provider run)', async ({ page }) => {
    test.setTimeout(140_000);
    test.skip(
      process.env.SOKRATES_REAL_INVALID_OPENAI !== '1',
      'Set SOKRATES_REAL_INVALID_OPENAI=1 for this real-provider fallback check.'
    );

    await openSokratesDm(page);
    const beforeCount = await page.locator('[data-testid="dm-message"]').count();
    const aiReplyResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/app/home/ai-reply') && response.request().method() === 'POST'
    );

    await sendPrompt(page, 'Trenne δυνατόν und εἰκός.');
    const latestReply = await waitForFreshSokratesReply(page, beforeCount, 45_000);
    await expectLooksLikeRealReply(latestReply);

    const aiReplyResponse = await aiReplyResponsePromise;
    const aiReplyPayload = await aiReplyResponse.json();
    expect(String(aiReplyPayload.final_provider_used || aiReplyPayload.finalProviderUsed || '')).toBe('ollama');
    expect(Array.isArray(aiReplyPayload.provider_attempts || aiReplyPayload.providerAttempts)).toBeTruthy();
  });
});

test.describe('F) Ollama Health + Model', () => {
  test('exposes healthy ollama status with model presence', async ({ page }) => {
    await openSokratesDm(page);
    const health = await fetchJson(page, '/health/ollama');
    expect(health.status).toBe(200);
    expect(health.body?.ok).toBe(true);
    expect(health.body?.reachable).toBe(true);
    expect(health.body?.modelPresent).toBe(true);
  });
});

test.describe('G) Concurrency + Persistence', () => {
  test('handles 3 rapid prompts without fallback spam', async ({ page }) => {
    await openSokratesDm(page);
    await unlockAiComposer(page);

    await injectAiProviderPlan(page, {
      openai: [{ ok: false, code: 'QUOTA', status: 429, retryable: false }],
      ollama: [{ ok: true, text: 'Antwort A mit Inhalt und Kontextbezug.' }]
    });

    const prompts = ['A', 'B', 'C'];
    for (const prompt of prompts) {
      await sendPrompt(page, `Concurrent ${prompt} ${uniqueName('rapid')}`);
      await page.waitForTimeout(150);
    }

    await expect(page.getByTestId('dm-timeline')).toContainText('Antwort A mit Inhalt und Kontextbezug.', { timeout: 30_000 });
    for (const pattern of FALLBACK_TEXT_PATTERNS) {
      await expect(page.getByTestId('dm-timeline')).not.toContainText(pattern);
    }

    await page.unroute('**/app/home/ai-reply');
  });

  test('keeps history stable after reload without auto-posting new bot message', async ({ page }) => {
    await openSokratesDm(page);
    const beforeCount = await page.locator('[data-testid="dm-message"]').count();
    await sendPrompt(page, `Persistenztest ${uniqueName('persist')}`);
    await waitForFreshSokratesReply(page, beforeCount, 20_000);
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0, { timeout: 45_000 });
    const afterReplyCount = await page.locator('[data-testid="dm-message"]').count();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openSokratesDm(page);
    const afterReloadCount = await page.locator('[data-testid="dm-message"]').count();
    expect(afterReloadCount).toBe(afterReplyCount);
  });
});

test.describe('D) Timeout + Retry Behavior', () => {
  test.use({
    recordHar: {
      path: path.join(ARTIFACT_ROOT, 'sokrates-D-timeout-retry.har'),
      mode: 'minimal'
    }
  });

  test('uses persona error text and exposes a deterministic retry path', async ({ page }) => {
    await openSokratesDm(page);

    let aiReplyCalls = 0;
    await page.route('**/app/home/ai-reply', async (route) => {
      aiReplyCalls += 1;
      if (aiReplyCalls === 1) {
        await route.fulfill({
          status: 504,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            requestId: 'req_timeout_test',
            code: 'TIMEOUT',
            message: 'Zeitüberschreitung beim AI-Provider.',
            status: 504,
            reason: 'Gateway Timeout',
            retryable: true,
            retryAfterMs: 1000,
            detail: 'Simulated provider timeout.'
          })
        });
        return;
      }

      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          requestId: 'req_timeout_retry_success',
          message: {
            id: 990099,
            thread_id: Number(body.threadId || 0),
            content: 'Retry erfolgreich beantwortet.',
            kind: 'text',
            agent_slug: 'sokrates',
            created_at: 'now',
            author_id: 9999,
            author_username: 'sokrates_ai_agent',
            author_display_name: 'Sokrates',
            author_avatar_url: '',
            author_is_system_agent: true,
            emoji_entities: [],
            attachments: [],
            gifs: []
          }
        })
      });
    });

    await sendPrompt(page, `Verzoegerung pruefen ${uniqueName('timeout')}`);

    const latestAssistantMessage = page.locator('[data-testid="dm-message"]').last();
    await expect(latestAssistantMessage).toContainText('Die Verbindung ist wie Nebel; ich höre dich, doch meine Antwort erreicht dich nicht.');
    await expect(latestAssistantMessage).not.toContainText(/Gateway Timeout|stack|trace/i);

    const retryButton = page.locator('[data-retry-ai-pending]').first();
    await expect(retryButton, 'Retry button missing after timeout failure.').toBeVisible({ timeout: 5_000 });

    await retryButton.click();
    await expect(page.locator('#timeline')).toContainText('Retry erfolgreich beantwortet.', { timeout: 20_000 });

    await page.waitForTimeout(1200);
    expect(aiReplyCalls).toBe(2);

    await page.unroute('**/app/home/ai-reply');
  });

  test('does not poison composer input when both providers fail', async ({ page }) => {
    await openSokratesDm(page);
    await unlockAiComposer(page);

    const composerInput = page.getByTestId('dm-composer-input');
    const baselinePlaceholder = await composerInput.getAttribute('placeholder');
    await injectAiProviderPlan(page, {
      openai: [
        {
          ok: false,
          code: 'QUOTA',
          status: 429,
          retryable: false,
          providerErrorCode: 'insufficient_quota',
          detail: 'Simulated quota stop.'
        }
      ],
      ollama: [
        {
          ok: false,
          code: 'TIMEOUT',
          status: 504,
          retryable: false,
          detail: 'Simulated ollama timeout.'
        }
      ]
    });

    const beforeCount = await page.locator('[data-testid="dm-message"]').count();
    await sendPrompt(page, `Beide Provider down ${uniqueName('bothdown')}`);

    await expect(page.locator('[data-testid="dm-message"]')).toHaveCount(beforeCount + 2, { timeout: 20_000 });
    const timelineMessages = page.locator('[data-testid="dm-message"]');
    await expect(timelineMessages.last()).toContainText('Die Verbindung ist wie Nebel; ich höre dich, doch meine Antwort erreicht dich nicht.');
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-testid="dm-message"]')).toHaveCount(beforeCount + 2);

    await expect(composerInput).toHaveValue('');
    await expect(composerInput).not.toHaveValue(/Nebel|Mund gegeben|λόγος stockt|Mittel fehlen/i);
    expect(await composerInput.getAttribute('placeholder')).toBe(baselinePlaceholder);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openSokratesDm(page);
    await expect(page.locator('[data-testid="dm-message"]')).toHaveCount(beforeCount + 2);

    await page.unroute('**/app/home/ai-reply');
  });
});

test.describe('E) Rate Limit Guard', () => {
  test.use({
    recordHar: {
      path: path.join(ARTIFACT_ROOT, 'sokrates-E-rate-limit.har'),
      mode: 'minimal'
    }
  });

  test('handles repeated sends without 429 technical spam loop', async ({ page }) => {
    await openSokratesDm(page);

    let aiReplyCalls = 0;
    await page.route('**/app/home/ai-reply', async (route) => {
      aiReplyCalls += 1;
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          requestId: `req_rate_limit_${aiReplyCalls}`,
          code: 'RATE_LIMIT',
          message: 'Rate limit erreicht. Bitte warte 2 Sekunden und versuche es erneut.',
          status: 429,
          reason: 'Too Many Requests',
          retryable: true,
          retryAfterMs: 2000,
          detail: 'Simulated rate limit.'
        })
      });
    });

    for (let i = 0; i < 3; i += 1) {
      const clearPendingButton = page.locator('[data-delete-ai-pending]').first();
      if (await clearPendingButton.isVisible().catch(() => false)) {
        await clearPendingButton.click();
      }

      const sendButton = page.getByTestId('dm-send-button');
      if (await sendButton.isDisabled()) {
        await page.waitForTimeout(2200);
      }
      await sendPrompt(page, `Rate-Limit pruefen ${i + 1} ${uniqueName('rl')}`);
      await expect(page.locator('#timeline')).toContainText('Zu viele Fragen drängen zugleich; mein λόγος stockt. Gib mir einen Augenblick.');
      await page.waitForTimeout(2200);
    }

    await expect(page.locator('#timeline')).not.toContainText(/Too Many Requests|429|Simulated rate limit|stack|trace/i);
    expect(aiReplyCalls).toBeLessThanOrEqual(3);

    await page.unroute('**/app/home/ai-reply');
  });
});
