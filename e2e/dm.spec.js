const path = require('path');
const { test } = require('@playwright/test');
const { expect, loginAs, loginAsEinstein, openDmThread, uniqueName } = require('./helpers');

test.describe('DM Core E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEinstein(page);
    await openDmThread(page);
  });

  test('opens a DM, keeps the composer visible, and appends a semantic message', async ({ page }) => {
    const composer = page.getByTestId('dm-composer');
    const textarea = page.getByTestId('dm-composer-input');
    const timeline = page.getByTestId('dm-timeline');
    const body = `Testing DM flow: Sokrates denkt mit ${uniqueName('dmcore')}`;

    await expect(composer).toBeVisible();
    await expect(textarea).toBeVisible();

    await textarea.fill(body);
    await page.getByTestId('dm-send-button').click();

    const latestOwn = page.locator('[data-testid="dm-message"].own').last();
    await expect(latestOwn).toContainText(body);

    const scrollSnapshot = await page.evaluate(() => {
      const timelineNode = document.querySelector('[data-testid="dm-timeline"]');
      const composerNode = document.querySelector('[data-testid="dm-composer"]');
      if (!(timelineNode instanceof HTMLElement) || !(composerNode instanceof HTMLElement)) {
        return null;
      }
      const beforeWindowY = window.scrollY;
      const beforeComposerTop = composerNode.getBoundingClientRect().top;
      timelineNode.scrollTop = timelineNode.scrollHeight;
      return {
        canScroll: timelineNode.scrollHeight > timelineNode.clientHeight,
        timelineScrolled: timelineNode.scrollTop > 0,
        windowYStable: window.scrollY === beforeWindowY,
        composerStable: Math.abs(composerNode.getBoundingClientRect().top - beforeComposerTop) < 2
      };
    });

    expect(scrollSnapshot).not.toBeNull();
    expect(scrollSnapshot.canScroll).toBeTruthy();
    expect(scrollSnapshot.timelineScrolled).toBeTruthy();
    expect(scrollSnapshot.windowYStable).toBeTruthy();
    expect(scrollSnapshot.composerStable).toBeTruthy();
  });

  test('keeps the DM composer visible in a long chat', async ({ page }) => {
    await page.evaluate(() => {
      const timeline = document.getElementById('timeline');
      if (!(timeline instanceof HTMLElement)) {
        return;
      }
      for (let index = 0; index < 80; index += 1) {
        const article = document.createElement('article');
        article.className = 'msg';
        article.innerHTML = `
          <div class="avatar msg-avatar"><span class="avatar-fallback">LG</span></div>
          <div class="bubble">
            <div class="meta"><strong>Long Chat</strong> <span>now</span></div>
            <p class="msg-text">Long DM filler ${index}</p>
          </div>
        `;
        timeline.appendChild(article);
      }
    });

    const composer = page.getByTestId('dm-composer');
    const snapshot = await page.evaluate(() => {
      const timelineNode = document.querySelector('[data-testid="dm-timeline"]');
      const composerNode = document.querySelector('[data-testid="dm-composer"]');
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

  test('renders DM custom status as the second line and keeps presence as an avatar overlay only', async ({ page, browser }) => {
    const actorContext = await browser.newContext();
    const actorPage = await actorContext.newPage();
    const customStatusText = `Status ${uniqueName('dmstatus')}`;

    try {
      await loginAs(actorPage, {
        identifier: 'euler',
        targetUrl: '/app/settings/profile'
      });

      await actorPage.locator('#profileCustomEmoji').selectOption('🔥');
      await actorPage.locator('#profileCustomText').fill(customStatusText);
      await actorPage.locator('input[name="customStatusExpiresAt"]').fill('');
      await Promise.all([
        actorPage.waitForNavigation(),
        actorPage.locator('#profileSettingsForm').evaluate((form) => {
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        })
      ]);

      await page.getByRole('button', { name: /Neue Nachricht/i }).click();
      await page.locator('#dmNewMessageForm input[name="username"]').fill('@euler');
      await Promise.all([
        page.waitForNavigation(),
        page.locator('#dmNewMessageForm').evaluate((form) => {
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        })
      ]);

      const eulerRow = page.locator('#activeDmList .dm-row', { hasText: /Leonhard Euler/i }).first();
      await expect(eulerRow).toBeVisible();

      const legacyPresenceLines = await page.evaluate(() => {
        const pattern = /@\S+\s•\s(?:online|offline|abwesend|nicht stören)/i;
        return [...document.querySelectorAll('#dmNavRail .dm-list-scroll .dm-row')]
          .map((row) => row.textContent || '')
          .filter((text) => pattern.test(text));
      });
      expect(legacyPresenceLines).toEqual([]);

      await expect(eulerRow.locator('.dm-row-subline')).toContainText('🔥');
      await expect(eulerRow.locator('.dm-row-subline')).toContainText(customStatusText);

      const dotCoverage = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#activeDmList .dm-row[data-presence-user-id]')];
        return {
          rowCount: rows.length,
          dotCount: rows.filter((row) => row.querySelector('[data-testid="dm-thread-status-dot"]')).length
        };
      });
      expect(dotCoverage.rowCount).toBeGreaterThan(0);
      expect(dotCoverage.dotCount).toBe(dotCoverage.rowCount);

      const overlayMetrics = await eulerRow.evaluate((node) => {
        const avatar = node.querySelector('[data-testid="dm-thread-avatar"]');
        const dot = node.querySelector('[data-testid="dm-thread-status-dot"]');
        if (!(avatar instanceof HTMLElement) || !(dot instanceof HTMLElement)) {
          return null;
        }
        const avatarRect = avatar.getBoundingClientRect();
        const dotRect = dot.getBoundingClientRect();
        return {
          avatarLeft: avatarRect.left,
          avatarTop: avatarRect.top,
          avatarRight: avatarRect.right,
          avatarBottom: avatarRect.bottom,
          avatarCenterX: avatarRect.left + (avatarRect.width / 2),
          avatarCenterY: avatarRect.top + (avatarRect.height / 2),
          dotLeft: dotRect.left,
          dotTop: dotRect.top,
          dotRight: dotRect.right,
          dotBottom: dotRect.bottom,
          dotCenterX: dotRect.left + (dotRect.width / 2),
          dotCenterY: dotRect.top + (dotRect.height / 2)
        };
      });

      expect(overlayMetrics).not.toBeNull();
      expect(overlayMetrics.dotLeft).toBeGreaterThanOrEqual(overlayMetrics.avatarLeft);
      expect(overlayMetrics.dotTop).toBeGreaterThanOrEqual(overlayMetrics.avatarTop);
      expect(overlayMetrics.dotRight).toBeLessThanOrEqual(overlayMetrics.avatarRight);
      expect(overlayMetrics.dotBottom).toBeLessThanOrEqual(overlayMetrics.avatarBottom);
      expect(overlayMetrics.dotCenterX).toBeGreaterThan(overlayMetrics.avatarCenterX);
      expect(overlayMetrics.dotCenterY).toBeGreaterThan(overlayMetrics.avatarCenterY);

      const groupRow = page.locator('#activeDmList .dm-row', { hasText: /Founders Group/i }).first();
      await expect(groupRow).toBeVisible();
      await expect(groupRow.locator('[data-testid="dm-thread-status-dot"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="dm-timeline"] .msg-avatar .status-dot')).toHaveCount(0);
    } finally {
      try {
        await actorPage.goto('/app/settings/profile');
        await actorPage.locator('#profileCustomEmoji').selectOption('');
        await actorPage.locator('#profileCustomText').fill('');
        await actorPage.locator('input[name="customStatusExpiresAt"]').fill('');
        await Promise.all([
          actorPage.waitForNavigation(),
          actorPage.locator('#profileSettingsForm').evaluate((form) => {
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          })
        ]);
      } catch (_error) {
        // Ignore cleanup failures; the test already captured the relevant assertion.
      }
      await actorContext.close();
    }
  });

  test('renders the direct DM info as a profile card with banner and avatar overlap', async ({ page }) => {
    await page.getByRole('link', { name: /platon/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    const infoPanel = page.locator('.info-rail .profile-panel').first();
    const metrics = await infoPanel.evaluate((node) => {
      const banner = node.querySelector('.profile-banner');
      const avatar = node.querySelector('.profile-avatar');
      if (!(banner instanceof HTMLElement) || !(avatar instanceof HTMLElement)) {
        return null;
      }
      const bannerRect = banner.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      return {
        bannerBottom: Math.round(bannerRect.bottom),
        avatarTop: Math.round(avatarRect.top),
        avatarBottom: Math.round(avatarRect.bottom)
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics.avatarTop).toBeLessThan(metrics.bannerBottom);
    expect(metrics.avatarBottom).toBeGreaterThan(metrics.bannerBottom);
    await expect(infoPanel).toContainText('About Me');
    await expect(infoPanel).toContainText('Member since');
    await expect(infoPanel.locator('[data-testid="view-full-profile-button"]')).toBeVisible();
    await expect(page.locator('.info-rail [data-group-edit-panel]')).toHaveCount(0);
  });

  test('renders the Sokrates DM info card and opens the dedicated AI profile view', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 420 });
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    const infoRail = page.locator('.info-rail');
    const infoPanel = infoRail.locator('.profile-panel');
    const sidebarBanner = infoPanel.locator('.profile-banner');
    const sidebarAvatar = infoPanel.locator('img.profile-avatar');

    await expect(infoPanel).toContainText('About Me');
    await expect(infoPanel).toContainText('Ich bin Sokrates.');
    await expect(infoPanel).toContainText('Man nennt mich einen Fragenden, keinen Lehrmeister.');
    await expect(infoPanel).not.toContainText(/Methode|Kontext/i);
    await expect(sidebarBanner.locator('.profile-banner-image')).toHaveAttribute('src', /NyaUwuUsoWarm\.jpg/);
    await expect(sidebarAvatar).toHaveAttribute('src', /DerDichterundDenker\.jpg/);
    const aiMetrics = await infoPanel.evaluate((node) => {
      const banner = node.querySelector('.profile-banner');
      const avatar = node.querySelector('.profile-avatar');
      if (!(banner instanceof HTMLElement) || !(avatar instanceof HTMLElement)) {
        return null;
      }
      const bannerRect = banner.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      return {
        bannerBottom: Math.round(bannerRect.bottom),
        avatarTop: Math.round(avatarRect.top),
        avatarBottom: Math.round(avatarRect.bottom)
      };
    });
    expect(aiMetrics).not.toBeNull();
    expect(aiMetrics.avatarTop).toBeLessThan(aiMetrics.bannerBottom);
    expect(aiMetrics.avatarBottom).toBeGreaterThan(aiMetrics.bannerBottom);

    await page.getByTestId('view-full-profile-button').click();

    const modalLayout = page.locator('#fullProfileLayout');
    await expect(page.getByTestId('full-profile-shell')).toBeVisible();
    await expect(modalLayout).toContainText('Sokrates');
    await expect(modalLayout).toContainText('AI DM');
    await expect(modalLayout).not.toContainText(/Kontext/i);
    await expect(page.locator('#fullProfileModal').getByRole('button', { name: /Mutual Friends/i })).toHaveCount(0);
    await expect(page.locator('#fullProfileLayout .profile-banner-image')).toHaveAttribute('src', /NyaUwuUsoWarm\.jpg/);
    await expect(page.locator('#fullProfileLayout img.profile-avatar')).toHaveAttribute('src', /DerDichterundDenker\.jpg/);
    await page.locator('#fullProfileModal').getByRole('button', { name: /About\+/i }).click();
    await expect(modalLayout).toContainText('Brot, Oliven, Ziegenkäse.');
    await expect(modalLayout).toContainText('#C2B280');
    await expect(modalLayout).toContainText('Disco Elysium');
    await expect(modalLayout).toContainText('Kithara-Hymnen (Apollo)');
    await expect(modalLayout).toContainText('Lieber Unrecht leiden als Unrecht tun.');
    await expect(modalLayout).toContainText('Weiteres über mich');
    await expect(modalLayout).toContainText('Athener Bürger, Fragender von Berufung.');
    await expect(modalLayout).not.toContainText('Profile Showcase');
    await expect(modalLayout).not.toContainText('Nicht angegeben');
    await expect(modalLayout).not.toContainText('Lieblingsbuch');
    await expect(modalLayout).not.toContainText('Was ich nicht mag');
    await expect(modalLayout).not.toContainText('Hobbys / Beschäftigung');
    await expect(modalLayout).not.toContainText('Das ungeprufte Leben ist nicht lebenswert.');
    await expect(page.getByTestId('profile-scroll')).toBeVisible();
  });

  test('keeps group settings hidden until edit mode is opened explicitly', async ({ page }) => {
    const title = uniqueName('ThinkerClub');
    await page.getByRole('button', { name: /Gruppe erstellen/i }).click();
    await expect(page.locator('[data-action-panel="new-group"]')).toBeVisible();

    await page.locator('#dmNewGroupForm input[name="title"]').fill(title);
    await page.locator('#dmNewGroupForm input[name="iconEmoji"]').fill('🧠');
    await page.locator('#dmNewGroupForm input[name="members"]').fill('@euler, @platon');

    await Promise.all([
      page.waitForNavigation(),
      page.locator('#dmNewGroupForm').evaluate((form) => {
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      })
    ]);

    const groupCard = page.locator('[data-group-dm-card]');
    await expect(groupCard).toBeVisible();
    await expect(page.getByTestId('group-dm-edit-panel')).toBeHidden();
    await expect(groupCard).toContainText(title);
    await expect(groupCard.locator('[data-testid="dm-members-header"]')).toContainText('Members');

    await page.getByTestId('group-dm-edit-toggle').click();
    await expect(page.getByTestId('group-dm-edit-panel')).toBeVisible();
    await expect(groupCard.locator('input[name="title"]')).toBeVisible();
    await expect(groupCard.locator('input[placeholder*="Teilnehmer"]')).toBeVisible();

    await page.locator('[data-group-edit-close]').first().click();
    await expect(page.getByTestId('group-dm-edit-panel')).toBeHidden();

    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.locator('[data-group-dm-card]')).toHaveCount(0);
  });

  test('lets the owner upload profile photos and persist About+ fields in the shared profile modal', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 420 });
    const uniqueQuote = `Favorit Zitat ${uniqueName('aboutplus')}`;
    const ownProfileTrigger = page.getByTestId('profile-open');

    await ownProfileTrigger.click();
    await expect(page.getByTestId('full-profile-shell')).toBeVisible();
    await expect(page.locator('#fullProfileLayout .profile-banner-image')).toBeVisible();
    await expect(page.locator('#fullProfileLayout img.profile-avatar')).toBeVisible();

    await page.locator('[data-testid="profile-photo-input"]').setInputFiles(path.join(process.cwd(), 'public/ressources/cat.png'));
    await expect(page.getByTestId('profile-scroll')).toContainText(/Untitled|cat/i);

    await page.locator('#fullProfileModal').getByRole('button', { name: /About\+/i }).click();
    await page.getByTestId('about-plus-edit-button').click();

    const ownerPanelMetrics = await page.getByTestId('profile-scroll').evaluate((node) => {
      const element = node;
      return {
        overflowY: window.getComputedStyle(element).overflowY
      };
    });

    expect(ownerPanelMetrics.overflowY).toMatch(/auto|scroll/);
    await page.getByTestId('about-plus-save-button').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('about-plus-save-button')).toBeVisible();

    await page.getByTestId('about-plus-favorite-quote-input').fill(uniqueQuote);
    await page.getByTestId('about-plus-save-button').click();
    await expect(page.getByTestId('profile-scroll')).toContainText(uniqueQuote);

    await page.locator('.full-profile-close').click();
    await page.reload();
    await ownProfileTrigger.click();
    await page.locator('#fullProfileModal').getByRole('button', { name: /About\+/i }).click();
    await expect(page.getByTestId('profile-scroll')).toContainText(uniqueQuote);
  });

  test('replaces provider failures with a normal Sokrates message and keeps cancel deterministic', async ({ page }) => {
    let aiReplyCalls = 0;
    let postedMessageId = 810000;

    await page.route('**/app/home/message', async (route) => {
      postedMessageId += 1;
      const requestBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: {
            id: postedMessageId,
            thread_id: Number(requestBody.threadId || 0),
            content: String(requestBody.content || ''),
            kind: 'text',
            agent_slug: '',
            created_at: 'now',
            author_id: 1,
            author_username: 'einstein',
            author_display_name: 'Einstein',
            author_avatar_url: '',
            emoji_entities: [],
            attachments: [],
            gifs: []
          },
          aiThread: true,
          aiReplyTargetMessageId: postedMessageId
        })
      });
    });

    await page.route('**/app/home/ai-reply', async (route) => {
      aiReplyCalls += 1;
      const requestBody = JSON.parse(route.request().postData() || '{}');

      if (aiReplyCalls === 1) {
        await route.fulfill({
          status: 504,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            requestId: 'req_timeout_mock',
            code: 'TIMEOUT',
            message: 'Zeitüberschreitung beim AI-Provider.',
            status: 504,
            reason: 'Gateway Timeout',
            retryable: true,
            detail: 'Simulated provider timeout.'
          })
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          requestId: 'req_cancel_late',
          message: {
            id: 910003,
            thread_id: Number(requestBody.threadId || 0),
            content: 'Diese Antwort darf nach Cancel nicht erscheinen.',
            kind: 'text',
            agent_slug: 'sokrates',
            created_at: 'later',
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

    await page.goto('/app/home');
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    const textarea = page.getByTestId('dm-composer-input');
    const sendButton = page.getByTestId('dm-send-button');
    const timeline = page.locator('#timeline');

    await page.evaluate(() => {
      const textareaNode = document.querySelector('[data-testid="dm-composer-input"]');
      const sendNode = document.querySelector('[data-testid="dm-send-button"]');
      const attachNode = document.querySelector('[data-testid="dm-attach-button"]');
      const emojiNode = document.querySelector('[data-testid="dm-emoji-button"]');
      const gifNode = document.querySelector('[data-testid="dm-gif-button"]');
      [textareaNode, sendNode, attachNode, emojiNode, gifNode].forEach((node) => {
        if (node instanceof HTMLButtonElement || node instanceof HTMLTextAreaElement) {
          node.disabled = false;
        }
      });
      const banner = document.getElementById('dmAiAvailabilityBanner');
      if (banner instanceof HTMLElement) {
        banner.hidden = true;
        banner.textContent = '';
      }
    });

    await textarea.fill(`Was ist Tugend? ${uniqueName('sokrates')}`);
    await sendButton.click();

    await expect(timeline).toContainText('Die Verbindung zu meinem λόγος ist unterbrochen; als spräche man durch dichten Nebel.');
    await expect(timeline).not.toContainText('Zeitüberschreitung beim AI-Provider.');
    await expect(timeline).not.toContainText('Simulated provider timeout.');
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
    await expect(page.locator('[data-ai-error-code]')).toHaveCount(0);

    await textarea.fill(`Bitte antworte spaeter ${uniqueName('cancel')}`);
    await sendButton.click();

    const cancelPending = page.locator('.ai-pending-msg');
    await expect(cancelPending).toHaveCount(1);
    await cancelPending.locator('[data-delete-ai-pending]').click();
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);

    await page.waitForTimeout(1200);
    await expect(timeline).not.toContainText('Diese Antwort darf nach Cancel nicht erscheinen.');
    expect(aiReplyCalls).toBe(2);
  });

  test('blocks Enter spam so only one Sokrates request is in flight per thread', async ({ page }) => {
    let messageCalls = 0;
    let aiReplyCalls = 0;
    let postedMessageId = 811000;

    await page.route('**/app/home/message', async (route) => {
      messageCalls += 1;
      postedMessageId += 1;
      const requestBody = JSON.parse(route.request().postData() || '{}');
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: {
            id: postedMessageId,
            thread_id: Number(requestBody.threadId || 0),
            content: String(requestBody.content || ''),
            kind: 'text',
            agent_slug: '',
            created_at: 'now',
            author_id: 1,
            author_username: 'einstein',
            author_display_name: 'Einstein',
            author_avatar_url: '',
            emoji_entities: [],
            attachments: [],
            gifs: []
          },
          aiThread: true,
          aiReplyTargetMessageId: postedMessageId,
          aiIdempotencyKey: String(postedMessageId)
        })
      });
    });

    await page.route('**/app/home/ai-reply', async (route) => {
      aiReplyCalls += 1;
      const requestBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          requestId: 'req_spam_guard',
          idempotencyKey: String(requestBody.replyToMessageId || ''),
          message: {
            id: postedMessageId + 1000,
            thread_id: Number(requestBody.threadId || 0),
            content: 'Eine Antwort auf genau eine Anfrage.',
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

    await page.goto('/app/home');
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('apeiron:ai-health-state', {
        detail: {
          ok: true,
          configured: true,
          available: true
        }
      }));
    });

    const textarea = page.getByTestId('dm-composer-input');
    await textarea.fill(`Spam guard ${uniqueName('spam')}`);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await textarea.press('Enter');
    }

    await expect(page.locator('#timeline')).toContainText('Eine Antwort auf genau eine Anfrage.');
    expect(messageCalls).toBe(1);
    expect(aiReplyCalls).toBe(1);
  });

  test('shows a localized cooldown as a normal Sokrates message for 429 rate limits', async ({ page }) => {
    let postedMessageId = 812000;

    await page.route('**/app/home/message', async (route) => {
      postedMessageId += 1;
      const requestBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: {
            id: postedMessageId,
            thread_id: Number(requestBody.threadId || 0),
            content: String(requestBody.content || ''),
            kind: 'text',
            agent_slug: '',
            created_at: 'now',
            author_id: 1,
            author_username: 'einstein',
            author_display_name: 'Einstein',
            author_avatar_url: '',
            emoji_entities: [],
            attachments: [],
            gifs: []
          },
          aiThread: true,
          aiReplyTargetMessageId: postedMessageId,
          aiIdempotencyKey: String(postedMessageId)
        })
      });
    });

    await page.route('**/app/home/ai-reply', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          requestId: 'req_rate_limit',
          idempotencyKey: String(postedMessageId),
          code: 'RATE_LIMIT',
          message: 'Rate limit erreicht. Bitte warte 3 Sekunden und versuche es erneut.',
          status: 429,
          reason: 'Too Many Requests',
          retryable: true,
          retryAfterMs: 3000,
          detail: 'Rate limit reached for requests per min.'
        })
      });
    });

    await page.goto('/app/home');
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('apeiron:ai-health-state', {
        detail: {
          ok: true,
          configured: true,
          available: true
        }
      }));
    });

    const textarea = page.getByTestId('dm-composer-input');
    const sendButton = page.getByTestId('dm-send-button');

    await textarea.fill(`Rate limit ${uniqueName('wait')}`);
    await sendButton.click();

    await expect(page.locator('#timeline')).toContainText('Mein Atem geht mir aus; zu viele Fragen drängen zugleich. Warte einen Augenblick, dann frage erneut.');
    await expect(page.locator('#timeline')).not.toContainText('Too Many Requests');
    await expect(page.locator('#timeline')).not.toContainText('Rate limit reached for requests per min.');
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
    await expect(page.locator('[data-ai-error-code]')).toHaveCount(0);
    await expect(sendButton).toBeDisabled();

    await page.waitForTimeout(3200);
    await expect(textarea).toHaveJSProperty('readOnly', false);
  });

  test('renders a normal Sokrates quota message without technical error UI', async ({ page }) => {
    let postedMessageId = 813000;

    await page.route('**/app/home/message', async (route) => {
      postedMessageId += 1;
      const requestBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: {
            id: postedMessageId,
            thread_id: Number(requestBody.threadId || 0),
            content: String(requestBody.content || ''),
            kind: 'text',
            agent_slug: '',
            created_at: 'now',
            author_id: 1,
            author_username: 'einstein',
            author_display_name: 'Einstein',
            author_avatar_url: '',
            emoji_entities: [],
            attachments: [],
            gifs: []
          },
          aiThread: true,
          aiReplyTargetMessageId: postedMessageId,
          aiIdempotencyKey: String(postedMessageId)
        })
      });
    });

    await page.route('**/app/home/ai-reply', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          requestId: 'req_insufficient_quota',
          idempotencyKey: String(postedMessageId),
          code: 'INSUFFICIENT_QUOTA',
          message: 'Sokrates ist nicht verfügbar: Kontingent/Billing erschöpft.',
          status: 429,
          reason: 'Too Many Requests',
          retryable: false,
          detail: 'You exceeded your current quota, please check your plan and billing details.'
        })
      });
    });

    await page.goto('/app/home');
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('apeiron:ai-health-state', {
        detail: {
          ok: true,
          configured: true,
          available: true
        }
      }));
    });

    const textarea = page.getByTestId('dm-composer-input');
    const sendButton = page.getByTestId('dm-send-button');

    await textarea.fill(`Quota lock ${uniqueName('quota')}`);
    await sendButton.click();

    await expect(page.locator('#timeline')).toContainText('Nicht aus Unwillen schweige ich, sondern weil mir die Mittel fehlen, weiter zu sprechen. Wenn du willst, frage später erneut.');
    await expect(page.locator('#timeline')).not.toContainText('billing details');
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
    await expect(page.locator('[data-ai-error-code]')).toHaveCount(0);
    await expect(sendButton).toBeDisabled();
    await expect(textarea).toHaveJSProperty('readOnly', true);
    await expect(page.locator('#dmAiAvailabilityBanner')).toBeHidden();
  });

  test('renders a normal Sokrates config message without technical error UI', async ({ page }) => {
    let postedMessageId = 820000;

    await page.route('**/app/home/message', async (route) => {
      postedMessageId += 1;
      const requestBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: {
            id: postedMessageId,
            thread_id: Number(requestBody.threadId || 0),
            content: String(requestBody.content || ''),
            kind: 'text',
            agent_slug: '',
            created_at: 'now',
            author_id: 1,
            author_username: 'einstein',
            author_display_name: 'Einstein',
            author_avatar_url: '',
            emoji_entities: [],
            attachments: [],
            gifs: []
          },
          aiThread: true,
          aiReplyTargetMessageId: postedMessageId
        })
      });
    });

    await page.route('**/app/home/ai-reply', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          requestId: 'req_config_error',
          code: 'CONFIG_ERROR',
          message: 'Sokrates ist nicht konfiguriert.',
          status: 503,
          reason: 'Service Unavailable',
          retryable: false,
          detail: 'Missing OPENAI_API_KEY.'
        })
      });
    });

    await page.goto('/app/home');
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    const textarea = page.getByTestId('dm-composer-input');
    const sendButton = page.getByTestId('dm-send-button');

    await page.evaluate(() => {
      const textareaNode = document.querySelector('[data-testid="dm-composer-input"]');
      const sendNode = document.querySelector('[data-testid="dm-send-button"]');
      const attachNode = document.querySelector('[data-testid="dm-attach-button"]');
      const emojiNode = document.querySelector('[data-testid="dm-emoji-button"]');
      const gifNode = document.querySelector('[data-testid="dm-gif-button"]');
      [textareaNode, sendNode, attachNode, emojiNode, gifNode].forEach((node) => {
        if (node instanceof HTMLButtonElement || node instanceof HTMLTextAreaElement) {
          node.disabled = false;
        }
      });
    });

    await textarea.fill(`Warum ist Mass wichtig? ${uniqueName('config')}`);
    await sendButton.click();

    await expect(page.locator('#timeline')).toContainText('Man hat mir keine Stimme gegeben; ich bin da, doch ohne Werkzeug zum Antworten.');
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
    await expect(page.locator('[data-ai-error-code]')).toHaveCount(0);
    await expect(sendButton).toBeDisabled();
    await expect(textarea).toHaveJSProperty('readOnly', true);
    await expect(page.locator('#dmAiAvailabilityBanner')).toBeHidden();
  });

  test('renders an AI reply when the composer is healthy', async ({ page }) => {
    let postedMessageId = 830000;

    await page.route('**/app/home/message', async (route) => {
      postedMessageId += 1;
      const requestBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: {
            id: postedMessageId,
            thread_id: Number(requestBody.threadId || 0),
            content: String(requestBody.content || ''),
            kind: 'text',
            agent_slug: '',
            created_at: 'now',
            author_id: 1,
            author_username: 'einstein',
            author_display_name: 'Einstein',
            author_avatar_url: '',
            emoji_entities: [],
            attachments: [],
            gifs: []
          },
          aiThread: true,
          aiReplyTargetMessageId: postedMessageId
        })
      });
    });

    await page.route('**/app/home/ai-reply', async (route) => {
      const requestBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          requestId: 'req_ai_success',
          message: {
            id: postedMessageId + 1000,
            thread_id: Number(requestBody.threadId || 0),
            content: 'Dies ist eine simulierte Sokrates-Antwort.',
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

    await page.goto('/app/home');
    await page.getByRole('link', { name: /sokrates/i }).first().click();
    await expect(page.getByTestId('dm-chat-main')).toBeVisible();

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('apeiron:ai-health-state', {
        detail: {
          ok: true,
          configured: true,
          available: true
        }
      }));
    });

    const textarea = page.getByTestId('dm-composer-input');
    const sendButton = page.getByTestId('dm-send-button');
    const prompt = `Was ist Gerechtigkeit? ${uniqueName('ok')}`;

    await textarea.fill(prompt);
    await sendButton.click();

    await expect(page.locator('[data-testid="dm-message"].own').last()).toContainText(prompt);
    await expect(page.locator('#timeline')).toContainText('Dies ist eine simulierte Sokrates-Antwort.');
    await expect(page.locator('.ai-pending-msg')).toHaveCount(0);
  });
});
