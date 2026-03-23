const path = require('path');
const { expect } = require('@playwright/test');

const RESOURCES_DIR = path.resolve(__dirname, '..', 'public', 'ressources');
const EMOJI_ASSET = path.join(RESOURCES_DIR, 'cat.png');
const GIF_ASSET = path.join(RESOURCES_DIR, 'aristotle.gif');
const SERVER_BANNER_ASSET = path.join(RESOURCES_DIR, 'Big.png');

function uniqueName(prefix) {
  const stamp = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${stamp}_${suffix}`.slice(0, 32);
}

async function loginAsEinstein(page, options = {}) {
  return loginAs(page, {
    identifier: 'einstein',
    password: 'apeiron123!',
    targetUrl: options.targetUrl || '/app/home'
  });
}

async function loginAs(page, options = {}) {
  const targetUrl = options.targetUrl || '/app/home';
  const identifier = options.identifier || 'einstein';
  const password = options.password || 'apeiron123!';
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier-input').fill(identifier);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-form').evaluate((form) => {
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  });
  await page.waitForURL((url) => url.pathname.startsWith('/app/'), { waitUntil: 'domcontentloaded' });
  if (targetUrl !== '/app/home') {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  }
}

async function openDmThread(page, threadName = 'Founders Group') {
  await page.goto('/app/home?thread=2', { waitUntil: 'domcontentloaded' });
  const chatMain = page.getByTestId('dm-chat-main');
  await expect(chatMain).toBeVisible();
  const threadLink = page.getByRole('link', { name: new RegExp(threadName, 'i') }).first();
  await expect(threadLink).toBeVisible();
}

async function openServerChannel(page, serverId = 2, channelId = 3) {
  await page.goto(`/app/servers/${serverId}?channel=${channelId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('server-text-view')).toBeVisible();
}

async function stabilizeProfileUi(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const css = `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    `;
    const inject = () => {
      if (!document.head || document.querySelector('style[data-e2e-profile-stable="1"]')) {
        return;
      }
      const style = document.createElement('style');
      style.setAttribute('data-e2e-profile-stable', '1');
      style.textContent = css;
      document.head.appendChild(style);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
    } else {
      inject();
    }
  });
}

async function stabilizeVisualSnapshotUi(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixedTimestamp = Date.parse('2026-03-04T12:34:56.000Z');
    class FixedDate extends NativeDate {
      constructor(...args) {
        if (!args.length) {
          super(fixedTimestamp);
          return;
        }
        super(...args);
      }

      static now() {
        return fixedTimestamp;
      }

      static parse(value) {
        return NativeDate.parse(value);
      }

      static UTC(...args) {
        return NativeDate.UTC(...args);
      }
    }

    window.Date = FixedDate;

    const css = `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }

      html, body, input, textarea, button, select {
        font-family: "Helvetica Neue", Arial, sans-serif !important;
        text-rendering: geometricPrecision !important;
        -webkit-font-smoothing: antialiased !important;
      }

      .msg .meta > span {
        color: transparent !important;
        position: relative !important;
        display: inline-block !important;
        width: 44px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }

      .msg .meta > span::before {
        content: "12:34";
        position: absolute;
        left: 0;
        top: 0;
        color: #a8b9e8 !important;
      }

      .msg .meta > span .edited-mark {
        display: none !important;
      }
    `;

    const inject = () => {
      if (!document.head || document.querySelector('style[data-e2e-visual-stable="1"]')) {
        return;
      }
      const style = document.createElement('style');
      style.setAttribute('data-e2e-visual-stable', '1');
      style.textContent = css;
      document.head.appendChild(style);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
    } else {
      inject();
    }
  });
}

function collectConsoleMessages(page) {
  const messages = [];
  page.on('console', (message) => {
    messages.push(`[${message.type()}] ${message.text()}`);
  });
  return messages;
}

async function attachProfileDiagnostics(page, testInfo, consoleMessages = []) {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }

  if (consoleMessages.length) {
    await testInfo.attach('console.log', {
      body: consoleMessages.join('\n'),
      contentType: 'text/plain'
    });
  }

  const domDump = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="profile-modal-card"], [data-testid="group-info-panel"], [data-testid="dm-info-panel"]');
    return root instanceof HTMLElement ? root.innerHTML : '';
  }).catch(() => '');

  if (domDump) {
    await testInfo.attach('profile-dom.html', {
      body: domDump,
      contentType: 'text/html'
    });
  }
}

module.exports = {
  EMOJI_ASSET,
  GIF_ASSET,
  SERVER_BANNER_ASSET,
  attachProfileDiagnostics,
  collectConsoleMessages,
  expect,
  loginAs,
  loginAsEinstein,
  openDmThread,
  openServerChannel,
  stabilizeProfileUi,
  stabilizeVisualSnapshotUi,
  uniqueName
};
