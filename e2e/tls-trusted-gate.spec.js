const { devices, test } = require('@playwright/test');
const { expect } = require('./helpers');
const { decodeQrDataUrl } = require('./helpers/lan-mobile');

const trustedBaseRaw = String(process.env.PLAYWRIGHT_TRUSTED_BASE_URL || '').trim();
let trustedBaseUrl = '';

try {
  trustedBaseUrl = trustedBaseRaw ? new URL(trustedBaseRaw).origin : '';
} catch (_error) {
  trustedBaseUrl = '';
}

function requireTrustedBaseUrl() {
  if (!trustedBaseUrl) {
    throw new Error('PLAYWRIGHT_TRUSTED_BASE_URL is required (example: https://apeiron.example.com).');
  }
  const parsed = new URL(trustedBaseUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error(`PLAYWRIGHT_TRUSTED_BASE_URL must be https, got: ${parsed.protocol}`);
  }
  return trustedBaseUrl;
}

async function loginAtTrustedOrigin(page, targetPath = '/app/home') {
  const trustedBase = requireTrustedBaseUrl();
  await page.goto(`${trustedBase}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier-input').fill('einstein');
  await page.getByTestId('login-password-input').fill('apeiron123!');
  await page.getByTestId('login-form').evaluate((form) => {
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  });
  await page.waitForURL((url) => url.origin === trustedBase && url.pathname.startsWith('/app/'), {
    waitUntil: 'domcontentloaded'
  });
  await page.goto(`${trustedBase}${targetPath}`, { waitUntil: 'domcontentloaded' });
}

async function installVoiceWsTracer(page) {
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    const traces = [];
    window.__apeironTrustedWsTrace = traces;
    window.WebSocket = class TracedWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        super(url, protocols);
        const trace = {
          url: String(url || ''),
          opened: false,
          closed: false
        };
        traces.push(trace);
        this.addEventListener('open', () => {
          trace.opened = true;
        });
        this.addEventListener('close', () => {
          trace.closed = true;
        });
      }
    };
  });
}

async function readVoiceWsTrace(page) {
  return page.evaluate(() => window.__apeironTrustedWsTrace || []);
}

async function readBasicQrTargetFromSettings(page) {
  await expect(page.getByTestId('lan-access-panel')).toBeVisible();
  const basicQrImage = page.getByTestId('lan-qr-basic-image');
  await expect(basicQrImage).toBeVisible();

  const src = String(await basicQrImage.getAttribute('src') || '');
  expect(src.startsWith('data:image/png;base64,')).toBeTruthy();
  const decoded = String(decodeQrDataUrl(src)).trim();
  expect(decoded).toBeTruthy();
  expect(decoded).toMatch(/^https:\/\//i);
  expect(decoded).not.toMatch(/^https:\/\/(localhost|127\.0\.0\.1)/i);
  expect(decoded.endsWith('/login')).toBeTruthy();
  return decoded;
}

if (!trustedBaseUrl) {
  test('requires PLAYWRIGHT_TRUSTED_BASE_URL for trusted TLS gate suite', async () => {
    requireTrustedBaseUrl();
  });
} else {
  test.describe('Trusted TLS Gate - Desktop', () => {
    test('loads trusted login without SSL bypass and stays secure with WSS voice signaling', async ({ page }) => {
      const trustedBase = requireTrustedBaseUrl();
      await installVoiceWsTracer(page);

      const response = await page.goto(`${trustedBase}/login`, { waitUntil: 'domcontentloaded' });
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }
      await expect(page.getByTestId('login-form')).toBeVisible();

      const secureState = await page.evaluate(() => ({
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        origin: window.location.origin
      }));
      expect(secureState.isSecureContext).toBe(true);
      expect(secureState.protocol).toBe('https:');
      expect(secureState.origin).toBe(trustedBase);

      await loginAtTrustedOrigin(page, '/app/settings/lan-access');
      const qrUrl = await readBasicQrTargetFromSettings(page);
      expect(qrUrl.startsWith(trustedBase)).toBeTruthy();

      await page.goto(qrUrl, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`^${trustedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`));

      await page.goto(`${trustedBase}/app/servers/2?channel=3`, { waitUntil: 'domcontentloaded' });
      const voiceLink = page.locator('[data-channel-type="voice"]').first();
      test.skip(await voiceLink.count() === 0, 'no voice channel available for WSS gate');
      await voiceLink.click();
      await expect(page.getByTestId('server-voice-view')).toBeVisible();

      const joinButton = page.getByTestId('voice-join-button');
      if (await joinButton.count()) {
        await expect(joinButton).toBeEnabled();
        await joinButton.click();
      }

      await expect.poll(async () => {
        const trace = await readVoiceWsTrace(page);
        return trace.some((entry) => String(entry.url || '').includes('/app/voice/realtime') && entry.opened === true);
      }, { timeout: 15_000 }).toBeTruthy();

      const trace = await readVoiceWsTrace(page);
      const voiceTraces = trace.filter((entry) => String(entry.url || '').includes('/app/voice/realtime'));
      expect(voiceTraces.length).toBeGreaterThan(0);
      expect(voiceTraces.every((entry) => String(entry.url || '').startsWith('wss://'))).toBeTruthy();
    });
  });

  test.describe('Trusted TLS Gate - Android Chromium', () => {
    test('opens decoded HTTPS QR link and keeps secure context on Android viewport', async ({ browser }) => {
      const trustedBase = requireTrustedBaseUrl();
      const context = await browser.newContext({
        ...devices['Pixel 5']
      });
      const page = await context.newPage();
      try {
      await loginAtTrustedOrigin(page, '/app/settings/lan-access');
      const qrUrl = await readBasicQrTargetFromSettings(page);

      await page.goto(qrUrl, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`^${trustedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`));

      const secureContext = await page.evaluate(() => window.isSecureContext);
      expect(secureContext).toBe(true);
      await expect(page.getByTestId('dm-chat-main')).toBeVisible();
      await expect(page.getByTestId('dm-composer')).toBeVisible();
      } finally {
        await context.close();
      }
    });
  });

  test.describe('Trusted TLS Gate - iOS WebKit', () => {
    test('opens decoded HTTPS QR link and keeps secure context on iOS viewport', async () => {
      const trustedBase = requireTrustedBaseUrl();
      let webkitBrowser;
      try {
        webkitBrowser = await webkit.launch({ headless: true });
      } catch (_error) {
        test.skip(true, 'WebKit browser is not available in this environment');
        return;
      }
      const context = await webkitBrowser.newContext({
        ...devices['iPhone 13']
      });
      const page = await context.newPage();
      try {
      await loginAtTrustedOrigin(page, '/app/settings/lan-access');
      const qrUrl = await readBasicQrTargetFromSettings(page);

      await page.goto(qrUrl, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`^${trustedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`));

      const secureContext = await page.evaluate(() => window.isSecureContext);
      expect(secureContext).toBe(true);
      await expect(page.getByTestId('dm-chat-main')).toBeVisible();
      await expect(page.getByTestId('dm-composer')).toBeVisible();
      } finally {
        await context.close();
        await webkitBrowser.close();
      }
    });
  });
}
