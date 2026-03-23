const { test } = require('@playwright/test');
const { expect, loginAsEinstein, uniqueName } = require('./helpers');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

function decodeQrDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    return '';
  }
  const buffer = Buffer.from(match[1], 'base64');
  const png = PNG.sync.read(buffer);
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return String(qr?.data || '');
}

function toLoginUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return '';
  }
  return new URL('/login', value).toString();
}

async function expectInViewport(locator, page) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box.width).toBeGreaterThan(40);
  expect(box.height).toBeGreaterThan(40);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual((viewport?.width || 0) + 1);
  expect(box.y + box.height).toBeLessThanOrEqual((viewport?.height || 0) + 1);
}

async function loginAtOrigin(page, origin, targetPath = '/app/home') {
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  const currentUrl = new URL(page.url());
  if (currentUrl.origin === origin && currentUrl.pathname.startsWith('/app/')) {
    await page.goto(`${origin}${targetPath}`, { waitUntil: 'domcontentloaded' });
    return;
  }

  await expect(page.getByTestId('login-identifier-input')).toBeVisible();
  await page.getByTestId('login-identifier-input').fill('einstein');
  await page.getByTestId('login-password-input').fill('apeiron123!');
  await page.getByTestId('login-form').evaluate((form) => {
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  });
  await page.waitForURL((url) => url.origin === origin && url.pathname.startsWith('/app/'), {
    waitUntil: 'domcontentloaded'
  });
  await page.goto(`${origin}${targetPath}`, { waitUntil: 'domcontentloaded' });
}

async function loadLanAccessPayload(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/system/lan', {
      headers: {
        Accept: 'application/json'
      }
    });
    const data = await response.json().catch(() => ({}));
    return {
      status: response.status,
      ok: response.ok,
      data
    };
  });
}

async function installVoiceWsTracer(page) {
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    const traces = [];
    window.__apeironVoiceWsTrace = traces;
    window.WebSocket = class TracedWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        super(url, protocols);
        const trace = {
          url: String(url || ''),
          opened: false,
          closed: false,
          sent: [],
          receivedTypes: []
        };
        traces.push(trace);
        this.addEventListener('open', () => {
          trace.opened = true;
        });
        this.addEventListener('close', () => {
          trace.closed = true;
        });
        this.addEventListener('message', (event) => {
          try {
            const payload = JSON.parse(String(event.data || '{}'));
            if (payload?.type) {
              trace.receivedTypes.push(String(payload.type));
            }
          } catch (_error) {
            // Ignore non-json payloads.
          }
        });
        const nativeSend = this.send.bind(this);
        this.send = (data) => {
          try {
            const payload = JSON.parse(String(data || '{}'));
            if (payload?.type) {
              trace.sent.push(String(payload.type));
            }
          } catch (_error) {
            // Ignore non-json payloads.
          }
          return nativeSend(data);
        };
      }
    };
  });
}

async function readVoiceWsTrace(page) {
  return page.evaluate(() => window.__apeironVoiceWsTrace || []);
}

test.describe('LAN Access and HTTPS Voice Gating', () => {
  test.use({ ignoreHTTPSErrors: true });

  test('LAN Access uses request origin for secure URL + QR target', async ({ page }) => {
    await loginAsEinstein(page, { targetUrl: '/app/settings/lan-access' });

    await expect(page.getByTestId('lan-access-panel')).toBeVisible();
    await expect(page.getByTestId('lan-access-links')).toBeVisible();
    await expect(page.getByTestId('lan-qr-grid')).toBeVisible();
    await expect(page.getByTestId('lan-qr-basic-card')).toBeVisible();

    const lanPayload = await loadLanAccessPayload(page);
    expect(lanPayload.ok).toBeTruthy();

    const requestOrigin = new URL(page.url()).origin;
    const currentOriginDetected = String(lanPayload.data?.currentOriginDetected || '').trim();
    const secureLanBaseUrl = (await page.getByTestId('lan-basic-url').first().innerText()).trim();
    const secureMirrorUrl = (await page.getByTestId('lan-full-url').first().innerText()).trim();
    const secureLoginUrl = toLoginUrl(requestOrigin);
    const expectedHostPort = String(process.env.PLAYWRIGHT_EXPECT_LAN_HOSTPORT || '').trim();
    const forbiddenPort = String(process.env.PLAYWRIGHT_FORBID_LAN_PORT || '').trim();
    const basicQrTarget = (await page.getByTestId('lan-qr-basic-target').innerText()).trim();
    expect(currentOriginDetected || requestOrigin).toBe(requestOrigin);
    expect(secureLanBaseUrl).toBe(requestOrigin);
    expect(secureMirrorUrl).toBe(requestOrigin);
    expect(basicQrTarget).toBe(secureLoginUrl);
    expect(basicQrTarget).not.toContain('172.18.');
    if (expectedHostPort) {
      expect(secureLanBaseUrl).toContain(expectedHostPort);
      expect(basicQrTarget).toContain(expectedHostPort);
    }
    if (forbiddenPort) {
      expect(secureLanBaseUrl).not.toContain(`:${forbiddenPort}`);
      expect(basicQrTarget).not.toContain(`:${forbiddenPort}`);
    }

    const basicQrSrc = String(await page.getByTestId('lan-qr-basic-image').getAttribute('src') || '');
    expect(basicQrSrc.startsWith('data:image/png;base64,')).toBeTruthy();
    expect(decodeQrDataUrl(basicQrSrc)).toBe(secureLoginUrl);

    await page.getByTestId('lan-qr-basic-image-button').click();
    await expect(page.getByTestId('lan-qr-modal')).toBeVisible();
    await expect(page.getByTestId('lan-qr-modal-target')).toHaveText(secureLoginUrl);
    const modalQrSrc = String(await page.getByTestId('lan-qr-modal-image').getAttribute('src') || '');
    expect(decodeQrDataUrl(modalQrSrc)).toBe(secureLoginUrl);
    await page.getByTestId('lan-qr-modal-close').click();
    await expect(page.getByTestId('lan-qr-modal')).toBeHidden();
    await expect(page.getByTestId('lan-qr-full-card')).toHaveCount(0);

    await page.getByTestId('lan-self-test-button').evaluate((button) => {
      if (button instanceof HTMLButtonElement) {
        button.click();
      }
    });
    const selfResult = page.getByTestId('lan-self-test-result');
    await expect(selfResult).toContainText('secure:ok:200');
    await expect(selfResult).toHaveAttribute('data-secure-ok', '1');
    await expect(selfResult).toHaveAttribute('data-secure-status', '200');

    await expectInViewport(page.getByTestId('lan-qr-grid'), page);
    await expectInViewport(page.getByTestId('lan-qr-basic-card'), page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await expect(page.getByTestId('lan-qr-grid')).toBeVisible();
    await expectInViewport(page.getByTestId('lan-qr-basic-card'), page);
  });

  test('LAN payload keeps /login and /healthz reachable on resolved origin', async ({ page }) => {
    await loginAsEinstein(page, { targetUrl: '/app/settings/lan-access' });

    const lanPayload = await loadLanAccessPayload(page);
    expect(lanPayload.ok).toBeTruthy();

    const requestOrigin = new URL(page.url()).origin;
    const currentOriginDetected = String(lanPayload.data?.currentOriginDetected || '').trim();
    const secureBaseUrl = String(lanPayload.data?.secureBaseUrl || '').trim();
    const secureLoginUrl = String(lanPayload.data?.secureLoginUrl || lanPayload.data?.basicQrTarget || '').trim();
    expect(currentOriginDetected || requestOrigin).toBe(requestOrigin);
    expect(secureBaseUrl).toBeTruthy();
    expect(secureLoginUrl).toBe(toLoginUrl(secureBaseUrl));

    const loginResponse = await page.goto(secureLoginUrl, { waitUntil: 'domcontentloaded' });
    const loginStatus = Number(loginResponse?.status() || 0);
    expect([200, 302, 303]).toContain(loginStatus);

    const healthResponse = await page.goto(new URL('/healthz', secureBaseUrl).toString(), {
      waitUntil: 'domcontentloaded'
    });
    expect(healthResponse?.status()).toBe(200);
  });

  test('HTTP LAN origin blocks voice join and shows HTTPS requirement', async ({ page }) => {
    await installVoiceWsTracer(page);
    await loginAsEinstein(page, { targetUrl: '/app/settings/lan-access' });

    const lanPayload = await loadLanAccessPayload(page);
    expect(lanPayload.ok).toBeTruthy();
    const basicOrigin = String(lanPayload.data?.basicBaseUrl || '').trim();
    test.skip(!basicOrigin, 'No LAN address available for HTTP gating check');
    await loginAtOrigin(page, new URL(basicOrigin).origin, '/app/servers/2?channel=3');

    const secureContext = await page.evaluate(() => window.isSecureContext);
    test.skip(secureContext, 'Selected basic LAN origin resolved to a secure context');

    const voiceLink = page.locator('[data-channel-type="voice"]').first();
    test.skip(await voiceLink.count() === 0, 'no voice channel available');
    await voiceLink.click();

    await expect(page.getByTestId('server-voice-view')).toBeVisible();
    await expect(page.getByTestId('voice-join-button')).toBeDisabled();
    await expect(page.getByTestId('voice-https-required-note')).toContainText('Voice benötigt HTTPS');
    await expect(page.getByTestId('voice-banner')).toContainText('Voice benötigt HTTPS');

    const wsTrace = await readVoiceWsTrace(page);
    const voiceWs = wsTrace.find((entry) => String(entry.url || '').includes('/app/voice/realtime'));
    expect(Boolean(voiceWs)).toBeTruthy();
    expect(Boolean(voiceWs?.opened)).toBeTruthy();
  });

  test('HTTPS LAN origin enables voice join and keeps mute/deafen state interactive', async ({ page, context }) => {
    await installVoiceWsTracer(page);
    await loginAsEinstein(page, { targetUrl: '/app/settings/lan-access' });

    const lanPayload = await loadLanAccessPayload(page);
    expect(lanPayload.ok).toBeTruthy();
    const fullOrigin = String(lanPayload.data?.secureBaseUrl || '').trim();
    test.skip(!fullOrigin.startsWith('https://'), 'HTTPS LAN URL not available (enable HTTPS for this suite)');

    await context.grantPermissions(['microphone'], { origin: fullOrigin });
    await loginAtOrigin(page, fullOrigin, '/app/servers/2?channel=3');
    const deprecatedVoiceRequests = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/voice/sync') || url.includes('/voice/presence') || url.includes('/voice/signal')) {
        deprecatedVoiceRequests.push(url);
      }
    });

    const voiceLink = page.locator('[data-channel-type="voice"]').first();
    test.skip(await voiceLink.count() === 0, 'no voice channel available');
    await voiceLink.click();

    await expect(page.getByTestId('server-voice-view')).toBeVisible();
    const joinButton = page.getByTestId('voice-join-button');
    if (await joinButton.count()) {
      await expect(joinButton).toBeEnabled();
      await joinButton.click();
    }

    await expect(page.getByTestId('voice-state-pill')).toContainText(/Connected to room|Connecting|Reconnecting/);
    const muteButton = page.getByTestId('voice-mute-button');
    const deafenButton = page.getByTestId('voice-deafen-button');
    await expect(muteButton).toBeVisible();
    await expect(deafenButton).toBeVisible();
    await expect(muteButton).toBeEnabled();
    await expect(deafenButton).toBeEnabled();

    await muteButton.click();
    await expect(muteButton).toContainText(/Unmute|Mute/);
    await deafenButton.click();
    await expect(deafenButton).toContainText(/Undeafen|Deafen/);

    const wsTrace = await readVoiceWsTrace(page);
    const voiceWs = wsTrace.find((entry) => String(entry.url || '').includes('/app/voice/realtime'));
    expect(Boolean(voiceWs)).toBeTruthy();
    expect(Boolean(voiceWs?.opened)).toBeTruthy();
    expect(voiceWs.receivedTypes).toContain('voice_ready');
    expect(voiceWs.receivedTypes).toEqual(expect.arrayContaining(['voice_presence', 'voice_joined']));
    expect(deprecatedVoiceRequests).toEqual([]);
  });

  test('HTTPS mode keeps login/chat/pickers on secure origin', async ({ page }) => {
    await loginAsEinstein(page, { targetUrl: '/app/settings/lan-access' });

    const lanPayload = await loadLanAccessPayload(page);
    expect(lanPayload.ok).toBeTruthy();
    const fullOrigin = String(lanPayload.data?.secureBaseUrl || '').trim();
    test.skip(!fullOrigin.startsWith('https://'), 'HTTPS LAN URL not available (enable HTTPS for this suite)');

    await loginAtOrigin(page, fullOrigin, '/app/home?thread=2');

    const appRequests = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/app/') || url.includes('/uploads/')) {
        appRequests.push(url);
      }
    });

    const marker = uniqueName('lan_https');
    await page.getByTestId('dm-composer-input').fill(`LAN HTTPS regression ${marker}`);
    await page.getByTestId('dm-send-button').click();
    await expect(page.locator('[data-testid="dm-message"].own').last()).toContainText(marker);

    await page.getByTestId('dm-emoji-button').click();
    await expect(page.getByTestId('dm-emoji-popover')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('dm-gif-button').click();
    await expect(page.getByTestId('dm-gif-modal')).toBeVisible();
    await page.getByTestId('dm-gif-close').click();

    const insecureRequest = appRequests.find((url) => {
      try {
        return new URL(url).protocol !== 'https:';
      } catch (_error) {
        return false;
      }
    });
    expect(insecureRequest).toBeFalsy();
  });
});
