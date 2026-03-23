const fs = require('fs');
const { expect } = require('@playwright/test');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const { loginAsEinstein } = require('../helpers');

function decodeQrPngBuffer(buffer) {
  const png = PNG.sync.read(buffer);
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return String(code?.data || '');
}

function decodeQrDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    return '';
  }
  return decodeQrPngBuffer(Buffer.from(match[1], 'base64'));
}

function isBrowserInstalled(browserType) {
  try {
    return fs.existsSync(browserType.executablePath());
  } catch (_error) {
    return false;
  }
}

function assertLanUrlShape(rawUrl) {
  const parsed = new URL(String(rawUrl || ''));
  expect(['http:', 'https:']).toContain(parsed.protocol);
  expect(parsed.hostname).not.toBe('0.0.0.0');
  expect(parsed.hostname).not.toMatch(/^172\.18\./);
  return parsed;
}

function toLoginUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return '';
  }
  try {
    return new URL('/login', value).toString();
  } catch (_error) {
    return '';
  }
}

async function decodeQrFromLocator(page, locator) {
  await expect(locator).toBeVisible();
  const tagName = await locator.evaluate((node) => String(node.tagName || '').toLowerCase());
  if (tagName === 'img') {
    const src = String(await locator.getAttribute('src') || '');
    if (src.startsWith('data:image/png;base64,')) {
      return decodeQrDataUrl(src);
    }
    if (src.startsWith('blob:') || src.startsWith('http')) {
      const response = await page.request.get(src);
      if (response.ok()) {
        const body = await response.body();
        return decodeQrPngBuffer(body);
      }
    }
  }

  const screenshot = await locator.screenshot();
  return decodeQrPngBuffer(screenshot);
}

async function openLanAccessAsEinstein(page) {
  await loginAsEinstein(page, { targetUrl: '/app/settings/lan-access' });
  await expect(page.getByTestId('lan-access-panel')).toBeVisible();
  await expect(page.getByTestId('lan-access-links')).toBeVisible();
}

async function readBasicLanQrPayload(page) {
  const basicUrl = String((await page.getByTestId('lan-basic-url').first().innerText()) || '').trim();
  const expectedLoginUrl = toLoginUrl(basicUrl);
  const decoded = String(
    await decodeQrFromLocator(page, page.getByTestId('lan-qr-basic-image'))
  ).trim();

  expect(basicUrl).toBeTruthy();
  expect(expectedLoginUrl).toBeTruthy();
  expect(decoded).toBeTruthy();
  expect(decoded).toBe(expectedLoginUrl);
  const parsed = assertLanUrlShape(decoded);

  return {
    basicUrl,
    expectedLoginUrl,
    decodedUrl: decoded,
    origin: parsed.origin
  };
}

async function ensureAuthenticatedAtOrigin(page, origin, targetPath = '/app/home') {
  const target = `${origin}${targetPath}`;
  await page.goto(target, { waitUntil: 'domcontentloaded' });

  let current = new URL(page.url());
  if (!current.pathname.startsWith('/login')) {
    return;
  }

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

  await page.goto(target, { waitUntil: 'domcontentloaded' });
  current = new URL(page.url());
  expect(current.origin).toBe(origin);
  expect(current.pathname.startsWith('/app/')).toBeTruthy();
}

async function expectCoreDmUi(page) {
  await expect(page.getByTestId('dm-chat-main')).toBeVisible();
  await expect(page.getByTestId('dm-composer')).toBeVisible();
  await expect(page.getByTestId('dm-composer-input')).toBeVisible();
}

async function expectTimelineScrollable(page) {
  const scrollProbe = await page.evaluate(() => {
    const timeline = document.querySelector('[data-testid="dm-timeline"]');
    if (!(timeline instanceof HTMLElement)) {
      return null;
    }

    if (timeline.scrollHeight <= timeline.clientHeight + 2) {
      for (let index = 0; index < 60; index += 1) {
        const article = document.createElement('article');
        article.className = 'msg';
        article.innerHTML = `
          <div class="avatar msg-avatar"><span class="avatar-fallback">SM</span></div>
          <div class="bubble">
            <div class="meta"><strong>Smoke</strong> <span>now</span></div>
            <p class="msg-text">Mobile scroll filler ${index}</p>
          </div>
        `;
        timeline.appendChild(article);
      }
    }

    const before = timeline.scrollTop;
    timeline.scrollTop = timeline.scrollHeight;
    return {
      before,
      after: timeline.scrollTop,
      scrollHeight: timeline.scrollHeight,
      clientHeight: timeline.clientHeight
    };
  });

  expect(scrollProbe).not.toBeNull();
  expect(Number(scrollProbe.scrollHeight || 0)).toBeGreaterThan(Number(scrollProbe.clientHeight || 0));
  expect(Number(scrollProbe.after || 0)).toBeGreaterThanOrEqual(Number(scrollProbe.before || 0));
}

module.exports = {
  assertLanUrlShape,
  toLoginUrl,
  decodeQrDataUrl,
  decodeQrFromLocator,
  ensureAuthenticatedAtOrigin,
  expectCoreDmUi,
  expectTimelineScrollable,
  isBrowserInstalled,
  openLanAccessAsEinstein,
  readBasicLanQrPayload
};
