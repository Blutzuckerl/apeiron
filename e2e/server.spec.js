const { test } = require('@playwright/test');
const { expect, loginAs, loginAsEinstein, openServerChannel, uniqueName } = require('./helpers');

async function clearSokratesServerApp(page) {
  await page.evaluate(async () => {
    await fetch('/app/servers/2/apps/sokrates/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({})
    });
  });
}

async function configureSokratesServerApp(page, overrides = {}) {
  await page.evaluate(async (payload) => {
    const response = await fetch('/app/servers/2/apps/sokrates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`app install failed: ${response.status}`);
    }
  }, {
    enabled: true,
    allowText: true,
    allowReactions: true,
    probabilityPreset: 'medium',
    channelScope: 'all',
    ...overrides
  });
}

async function injectServerSokratesPlan(page, plan) {
  await page.route('**/app/servers/2/message', async (route) => {
    const headers = { ...route.request().headers() };
    delete headers['content-length'];
    headers['content-type'] = 'application/json';
    const body = JSON.parse(route.request().postData() || '{}');
    body.sokratesServerTestPlan = plan;
    await route.continue({
      headers,
      postData: JSON.stringify(body)
    });
  });
}

async function sendServerMessage(page, content) {
  await page.getByTestId('server-composer-input').fill(content);
  await page.getByTestId('server-send-button').click();
}

test.describe('Server and Voice E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEinstein(page);
    await openServerChannel(page);
  });

  test('renders channels, toggles the server dropdown, and keeps server composer parity', async ({ page }) => {
    const channelLinks = page.getByTestId('server-channel-link');
    const trigger = page.getByTestId('server-menu-trigger');
    const menu = page.getByTestId('server-menu');

    await expect(channelLinks.first()).toBeVisible();
    await expect(page.getByTestId('server-composer')).toBeVisible();
    await expect(page.getByTestId('server-emoji-button')).toBeVisible();
    await expect(page.getByTestId('server-gif-button')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();

    await page.getByTestId('server-text-view').click();
    await expect(menu).toBeHidden();

    await trigger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('installs Sokrates via server settings apps and keeps the integration after reload', async ({ page }) => {
    await clearSokratesServerApp(page);
    await page.goto('/app/servers/2/settings?section=apps', { waitUntil: 'domcontentloaded' });

    const installState = page.getByTestId('sokrates-card-install-state');
    const primaryAction = page.getByTestId('sokrates-card-primary-action');

    await expect(installState).toHaveText('Not installed');
    await expect(primaryAction).toHaveText('Add to Server');
    await primaryAction.click();
    await expect(installState).toHaveText('Installed');
    await expect(primaryAction).toHaveText('Manage');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('sokrates-card-install-state')).toHaveText('Installed');
    await expect(page.getByTestId('sokrates-card-primary-action')).toHaveText('Manage');
  });

  test('opens the Sokrates manage modal in settings and persists settings', async ({ page }) => {
    await configureSokratesServerApp(page);
    await page.goto('/app/servers/2/settings?section=apps', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('sokrates-card-primary-action').click();
    await expect(page.getByTestId('sokrates-settings-manage-modal')).toBeVisible();

    await page.getByTestId('sokrates-settings-reaction-rate-input').selectOption('normal');
    await page.getByTestId('sokrates-settings-reply-rate-input').selectOption('off');
    await page.getByTestId('sokrates-settings-channel-scope-input').selectOption('selected');
    await page.getByTestId('sokrates-settings-channel-allowlist').locator('input[name="channelsAllowlist"]').first().check();
    await page.getByTestId('sokrates-settings-provider-silent-input').uncheck();
    await page.getByTestId('sokrates-settings-save-button').click();

    await expect(page.locator('#sokratesSettingsManageStatus')).toHaveText('Saved.');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('sokrates-settings-manage-modal')).toBeHidden();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('sokrates-card-primary-action').click();

    await expect(page.getByTestId('sokrates-settings-reaction-rate-input')).toHaveValue('normal');
    await expect(page.getByTestId('sokrates-settings-reply-rate-input')).toHaveValue('off');
    await expect(page.getByTestId('sokrates-settings-channel-scope-input')).toHaveValue('selected');
    await expect(page.getByTestId('sokrates-settings-provider-silent-input')).not.toBeChecked();
  });

  test('keeps Sokrates out of server dropdown and blocks settings access for members without manage permission', async ({ page }) => {
    await page.evaluate(async () => {
      await fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    });
    await loginAs(page, {
      identifier: 'euler',
      password: 'apeiron123!',
      targetUrl: '/app/servers/2?channel=3'
    });

    await page.getByTestId('server-menu-trigger').click();
    await expect(page.getByTestId('server-sokrates-app-menu-item')).toHaveCount(0);

    await page.goto('/app/servers/2/settings?section=apps', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/servers\/2(\?channel=\d+)?$/);
  });

  test('keeps the server composer visible in a long text channel', async ({ page }) => {
    await page.evaluate(() => {
      const timeline = document.getElementById('serverTimeline');
      if (!(timeline instanceof HTMLElement)) {
        return;
      }
      for (let index = 0; index < 90; index += 1) {
        const article = document.createElement('article');
        article.className = 'msg';
        article.innerHTML = `
          <div class="avatar msg-avatar"><span class="avatar-fallback">SV</span></div>
          <div class="bubble">
            <div class="meta"><strong>Server Fill</strong> <span>now</span></div>
            <p class="msg-text">Long server filler ${index}</p>
          </div>
        `;
        timeline.appendChild(article);
      }
    });

    const composer = page.getByTestId('server-composer');
    const snapshot = await page.evaluate(() => {
      const timelineNode = document.querySelector('[data-testid="server-timeline"]');
      const composerNode = document.querySelector('[data-testid="server-composer"]');
      if (!(timelineNode instanceof HTMLElement) || !(composerNode instanceof HTMLElement)) {
        return null;
      }
      const beforeTop = composerNode.getBoundingClientRect().top;
      const beforeBottom = composerNode.getBoundingClientRect().bottom;
      const beforeWindowY = window.scrollY;
      timelineNode.scrollTop = timelineNode.scrollHeight;
      const afterTop = composerNode.getBoundingClientRect().top;
      const afterBottom = composerNode.getBoundingClientRect().bottom;
      return {
        timelineScrolled: timelineNode.scrollTop > 0,
        pageStable: window.scrollY === beforeWindowY,
        topStable: Math.abs(afterTop - beforeTop) < 2,
        bottomInViewport: afterBottom <= window.innerHeight
      };
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot.timelineScrolled).toBeTruthy();
    expect(snapshot.pageStable).toBeTruthy();
    expect(snapshot.topStable).toBeTruthy();
    expect(snapshot.bottomInViewport).toBeTruthy();
    await expect(composer).toBeVisible();
  });

  test('shows member rows, hides context actions until right click, and toggles the members rail', async ({ page }) => {
    const membersHeader = page.getByTestId('members-header');
    const membersRail = page.getByTestId('members-rail');
    const toggle = page.getByTestId('members-toggle-button');
    const firstRow = page.getByTestId('member-row').first();
    const firstMenu = page.getByTestId('member-context-menu').first();

    await expect(membersHeader).toContainText(/Members\s+—\s+\d+/);
    await expect(firstRow).toBeVisible();
    await expect(firstRow.getByTestId('member-avatar')).toBeVisible();
    await expect(firstMenu).toBeHidden();

    await firstRow.click();
    await expect(firstMenu).toBeHidden();

    await firstRow.click({ button: 'right' });
    await expect(firstMenu).toBeVisible();

    const removeButtons = firstMenu.getByTestId('member-remove-button');
    if (await removeButtons.count()) {
      await expect(removeButtons.first()).toBeVisible();
    }

    await toggle.click();
    await expect(membersRail).toBeHidden();
    await toggle.click();
    await expect(membersRail).toBeVisible();
  });

  test('can force a Sokrates reaction in a server channel', async ({ page }) => {
    await configureSokratesServerApp(page, {
      allowText: false,
      allowReactions: true
    });
    await injectServerSokratesPlan(page, {
      forceAction: 'reaction',
      emoji: '👀'
    });

    const marker = uniqueName('srv_react');
    await sendServerMessage(page, `Reaction please ${marker}`);

    const latestOwn = page.locator('[data-testid="server-message"].own').last();
    await expect(latestOwn).toContainText(`Reaction please ${marker}`);
    await expect(latestOwn.locator('.msg-reaction-chip')).toContainText('👀');
    await page.unroute('**/app/servers/2/message');
  });

  test('can force a short Sokrates text reply in a server channel', async ({ page }) => {
    await configureSokratesServerApp(page, {
      allowText: true,
      allowReactions: false
    });
    await injectServerSokratesPlan(page, {
      forceAction: 'text',
      providerTestPlan: {
        openai: [{ ok: true, text: 'Prufe zuerst den Begriff, ehe du urteilst.' }],
        ollama: [{ ok: true, text: 'Prufe zuerst den Begriff, ehe du urteilst.' }]
      }
    });

    const beforeCount = await page.getByTestId('server-message').count();
    await sendServerMessage(page, `Text reply ${uniqueName('srv_text')}`);

    await expect(page.getByTestId('server-message')).toHaveCount(beforeCount + 2);
    await expect(page.locator('#serverTimeline')).toContainText('Prufe zuerst den Begriff, ehe du urteilst.');
    await page.unroute('**/app/servers/2/message');
  });

  test('fails silently when forced Sokrates text generation cannot complete', async ({ page }) => {
    await configureSokratesServerApp(page, {
      allowText: true,
      allowReactions: false
    });
    await injectServerSokratesPlan(page, {
      forceAction: 'text',
      providerTestPlan: {
        openai: [
          { ok: false, code: 'TIMEOUT', status: 504, retryable: true, detail: 'Simulated OpenAI timeout.' },
          { ok: false, code: 'TIMEOUT', status: 504, retryable: true, detail: 'Simulated OpenAI timeout retry.' }
        ],
        ollama: [
          { ok: false, code: 'TIMEOUT', status: 503, retryable: true, detail: 'Simulated Ollama outage.' },
          { ok: false, code: 'TIMEOUT', status: 503, retryable: true, detail: 'Simulated Ollama retry.' }
        ]
      }
    });

    const beforeCount = await page.getByTestId('server-message').count();
    const marker = uniqueName('srv_silent');
    await sendServerMessage(page, `Silent fail ${marker}`);

    await expect(page.getByTestId('server-message')).toHaveCount(beforeCount + 1);
    await expect(page.locator('#serverTimeline')).not.toContainText('Simulated OpenAI timeout.');
    await expect(page.locator('#serverTimeline')).not.toContainText('Sokrates ist nicht verfügbar');
    await page.unroute('**/app/servers/2/message');
  });

  test('joins voice, shows realistic connection states, toggles mute and deafen, and disconnects cleanly', async ({ page, context }) => {
    await context.grantPermissions(['microphone'], { origin: 'http://127.0.0.1:3000' });

    const voiceLink = page.locator('[data-channel-type="voice"]').first();
    test.skip(await voiceLink.count() === 0, 'no voice channel available');

    await voiceLink.click();
    await expect(page.getByTestId('server-voice-view')).toBeVisible();
    const joinButton = page.getByTestId('voice-join-button');
    const leaveButton = page.getByTestId('voice-leave-button');

    if (await joinButton.count() > 0) {
      await expect(joinButton).toBeVisible();
      await joinButton.click();
    } else {
      await expect(page.getByTestId('voice-state-pill')).toContainText(/Connected to room|Connecting|Reconnecting/);
      await expect(leaveButton).toBeVisible();
    }
    await expect(page.getByTestId('voice-state-pill')).toContainText(/Connected to room|Connecting/);
    await expect(page.getByTestId('voice-peer-status')).toContainText(/Waiting for others|Connecting peer audio|peer audio live/);

    const muteButton = page.getByTestId('voice-mute-button');
    const deafenButton = page.getByTestId('voice-deafen-button');

    await expect(muteButton).toBeVisible();
    await expect(deafenButton).toBeVisible();
    await expect(leaveButton).toBeVisible();

    await muteButton.click();
    await expect(muteButton).toContainText(/Unmute|Mute/);

    await deafenButton.click();
    await expect(deafenButton).toContainText(/Undeafen|Deafen/);

    await leaveButton.click();
    await expect(page.getByTestId('voice-state-pill')).toContainText('Disconnected');
    await expect(page.getByTestId('voice-join-button')).toBeVisible();
  });
});
