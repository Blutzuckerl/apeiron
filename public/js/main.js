(function initComposerUX() {
  const form = document.querySelector('form.shared-composer-form');
  const composer = form?.closest('.composer');
  const textarea = form?.querySelector('textarea[name="content"]');
  if (!composer || !form || !textarea) {
    return;
  }

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const attachInput = composer.querySelector('#attachInput');
  const uploadQueue = composer.querySelector('#uploadQueue');
  const networkState = composer.querySelector('#networkState');
  const currentDisplayName = String(
    document.getElementById('dmCurrentDisplayName')?.value
    || document.getElementById('serverCurrentDisplayName')?.value
    || 'Du'
  );
  const currentAvatarUrl = String(
    document.getElementById('dmCurrentAvatarUrl')?.value
    || document.getElementById('serverCurrentAvatarUrl')?.value
    || ''
  ).trim();
  const dmActiveThreadType = String(document.getElementById('dmActiveThreadType')?.value || '');
  const dmActiveAgentSlug = String(document.getElementById('dmActiveAgentSlug')?.value || '');
  const aiDisplayName = String(document.getElementById('dmAiDisplayName')?.value || 'Sokrates').trim();
  const aiAvatarUrl = String(document.getElementById('dmAiAvatarUrl')?.value || '').trim();
  const aiAvailabilityBanner = document.getElementById('dmAiAvailabilityBanner');
  const aiProviderBadge = document.getElementById('dmAiProviderBadge');
  const aiAvailabilityCode = String(document.getElementById('dmAiAvailabilityCode')?.value || '').trim();
  const aiActiveMode = String(document.getElementById('dmAiActiveMode')?.value || '').trim();
  const aiSelectedProvider = String(document.getElementById('dmAiSelectedProvider')?.value || '').trim();
  const contextInput = form.querySelector('input[name="threadId"], input[name="channelId"]');
  const sendBtn = form?.querySelector('button[type="submit"]');
  const attachBtn = composer.querySelector('[data-action="attach"]');
  const emojiBtn = composer.querySelector('[data-action="emoji"]');
  const gifBtn = composer.querySelector('[data-action="gif"]');
  const emojiPopover = composer.querySelector('#emojiPopover');
  const emojiSearchInput = composer.querySelector('#emojiSearchInput');
  const emojiBrowseView = composer.querySelector('#emojiBrowseView');
  const emojiAddView = composer.querySelector('#emojiAddView');
  const emojiCategoryRail = composer.querySelector('#emojiCategoryRail');
  const emojiSectionScroll = composer.querySelector('#emojiSectionScroll');
  const emojiSectionMount = composer.querySelector('#emojiSectionMount');
  const emojiSelectionPreview = composer.querySelector('#emojiSelectionPreview');
  const emojiPreviewVisual = composer.querySelector('[data-emoji-preview-visual]');
  const emojiPreviewLabel = composer.querySelector('[data-emoji-preview-label]');
  const emojiPreviewToken = composer.querySelector('[data-emoji-preview-token]');
  const emojiItemMenu = composer.querySelector('#emojiItemMenu');
  const gifModal = composer.querySelector('#gifModal');
  const gifSearchInput = composer.querySelector('#gifSearchInput');
  const gifResults = composer.querySelector('#gifResults');
  const gifSectionScroll = composer.querySelector('#gifSectionScroll');
  const gifTabs = composer.querySelector('#gifTabs');
  const gifBrowseView = composer.querySelector('#gifBrowseView');
  const gifAddView = composer.querySelector('#gifAddView');
  const gifNameInput = composer.querySelector('#gifNameInput');
  const gifTagInput = composer.querySelector('#gifTagInput');
  const gifTagChips = composer.querySelector('#gifTagChips');
  const gifSearchStatus = composer.querySelector('#gifSearchStatus');
  const gifUploadFileInput = composer.querySelector('#gifUploadFileInput');
  const gifFileName = composer.querySelector('#gifFileName');
  const gifPreviewBox = composer.querySelector('#gifPreviewBox');
  const gifPreviewImg = composer.querySelector('#gifPreviewImg');
  const gifPreviewVideo = composer.querySelector('#gifPreviewVideo');
  const gifChooseFileBtn = composer.querySelector('#gifChooseFileBtn');
  const gifUploadCancelBtn = composer.querySelector('#gifUploadCancelBtn');
  const gifUploadBtn = composer.querySelector('#gifUploadBtn');
  const gifUploadStatus = composer.querySelector('#gifUploadStatus');
  const gifUploadError = composer.querySelector('#gifUploadError');
  const contextFieldName = String(contextInput?.name || '');
  const contextIdInput = contextInput;
  const customEmojiFileInput = composer.querySelector('#customEmojiFileInput');
  const emojiAddBtn = composer.querySelector('#emojiAddBtn');
  const emojiFileName = composer.querySelector('#emojiFileName');
  const emojiPreviewBox = composer.querySelector('#emojiPreviewBox');
  const emojiPreviewImg = composer.querySelector('#emojiPreviewImg');
  const emojiChooseFileBtn = composer.querySelector('#emojiChooseFileBtn');
  const emojiUploadCancelBtn = composer.querySelector('#emojiUploadCancelBtn');
  const emojiUploadBtn = composer.querySelector('#emojiUploadBtn');
  const emojiUploadStatus = composer.querySelector('#emojiUploadStatus');
  const emojiNameInput = composer.querySelector('#emojiNameInput');
  const emojiVisibilityInput = composer.querySelector('#emojiVisibilityInput');
  const emojiUploadError = composer.querySelector('#emojiUploadError');
  const userEmojiLibraryData = document.getElementById('userEmojiLibraryData');
  const emojiPreferenceData = document.getElementById('emojiPreferenceData');
  const composerModeBar = composer.querySelector('[data-composer-mode-bar]');
  const composerModeTitle = composer.querySelector('[data-composer-mode-title]');
  const composerModePreview = composer.querySelector('[data-composer-mode-preview]');
  const composerClearModeBtn = composer.querySelector('[data-composer-clear-mode]');
  const replyToInput = composer.querySelector('[data-composer-reply-id]');
  const editMessageInput = composer.querySelector('[data-composer-edit-id]');
  const currentUserId = Number(document.body?.dataset.currentUserId || 0);
  const activeServerId = Number(document.getElementById('serverContextServerId')?.value || 0);
  const canManageEmojiLibrary = contextFieldName === 'channelId' && String(document.getElementById('serverContextCanModerate')?.value || '') === '1';
  const canManageGifLibrary = canManageEmojiLibrary;

  const validTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'text/plain'
  ]);
  const maxFiles = 3;
  const maxSizeBytes = 2 * 1024 * 1024;
  const attachments = new Map();
  const failedPendings = new Map();
  const aiPendingRequests = new Map();
  const draftEmojiEntities = new Map();
  const customEmojiLibrary = new Map();
  const favoriteEmojiKeys = [];
  const recentEmojiKeys = [];
  const favoriteGifIds = [];
  const recentGifIds = [];
  let attachmentId = 0;
  let pendingId = 0;
  let selectedGif = null;
  let pendingEmojiUploadFile = null;
  let pendingGifUploadFile = null;
  let emojiPreviewObjectUrl = '';
  let gifPreviewObjectUrl = '';
  let fileDialogInProgress = false;
  let suppressOutsideCloseUntil = 0;
  let aiComposerLocked = false;
  let aiComposerLockMessage = '';
  let aiComposerCooldownUntil = 0;
  let aiComposerCooldownTimer = 0;
  let aiHealthPollTimer = 0;
  let submitInFlight = false;
  let emojiSearchQuery = '';
  let emojiActiveCategory = 'favorites';
  let emojiPreviewState = null;
  let emojiPreviewAnchor = null;
  let emojiItemMenuMeta = null;
  let gifSectionsData = [];
  let gifTab = 'global';
  let gifActiveCategory = 'favorites';
  let gifPreviewState = null;
  let gifPreviewAnchor = null;
  let gifItemMenuMeta = null;
  let suppressGifSelectionUntil = 0;
  let suppressGifSelectionId = 0;
  let suppressGifContextMenuUntil = 0;
  let suppressGifContextMenuId = 0;
  const isAiDmComposer = contextFieldName === 'threadId' && dmActiveThreadType === 'ai_dm' && dmActiveAgentSlug === 'sokrates';
  const messageTestId = contextFieldName === 'channelId' ? 'server-message' : 'dm-message';
  const baseTextareaPlaceholder = String(textarea.getAttribute('placeholder') || '');
  const AI_HEALTHCHECK_INTERVAL_MS = 30000;
  const EMOJI_CATEGORY_ORDER = ['people', 'animals', 'food', 'activities', 'travel', 'objects', 'symbols', 'flags'];
  const UNICODE_EMOJI_CATALOG = [
    {
      id: 'people',
      label: 'People / Smileys',
      icon: '😀',
      items: [
        { key: '😀', label: 'Grinning Face', shortcode: ':grinning:', keywords: ['grinning', 'smile', 'happy'] },
        { key: '😂', label: 'Face with Tears of Joy', shortcode: ':joy:', keywords: ['joy', 'laugh', 'tears'] },
        { key: '🥲', label: 'Smiling Face with Tear', shortcode: ':smile_tear:', keywords: ['smile', 'tear', 'relief'] },
        { key: '😎', label: 'Smiling Face with Sunglasses', shortcode: ':sunglasses:', keywords: ['cool', 'sunglasses'] },
        { key: '🥳', label: 'Partying Face', shortcode: ':partying_face:', keywords: ['party', 'celebration'] },
        { key: '🤖', label: 'Robot', shortcode: ':robot:', keywords: ['robot', 'bot'] },
        { key: '🙂', label: 'Slightly Smiling Face', shortcode: ':slight_smile:', keywords: ['smile', 'soft'] },
        { key: '🤯', label: 'Exploding Head', shortcode: ':exploding_head:', keywords: ['mindblown', 'shock'] },
        { key: '😭', label: 'Loudly Crying Face', shortcode: ':sob:', keywords: ['cry', 'sad'] },
        { key: '😴', label: 'Sleeping Face', shortcode: ':sleeping:', keywords: ['sleep', 'tired'] }
      ]
    },
    {
      id: 'animals',
      label: 'Animals',
      icon: '🐱',
      items: [
        { key: '🐱', label: 'Cat Face', shortcode: ':cat:', keywords: ['cat', 'pet', 'feline'] },
        { key: '🦊', label: 'Fox', shortcode: ':fox:', keywords: ['fox', 'animal'] },
        { key: '🐼', label: 'Panda', shortcode: ':panda:', keywords: ['panda', 'bear'] },
        { key: '🐙', label: 'Octopus', shortcode: ':octopus:', keywords: ['octopus', 'sea'] },
        { key: '🐉', label: 'Dragon', shortcode: ':dragon:', keywords: ['dragon', 'myth'] },
        { key: '🦄', label: 'Unicorn', shortcode: ':unicorn:', keywords: ['unicorn', 'magic'] },
        { key: '🐸', label: 'Frog', shortcode: ':frog:', keywords: ['frog', 'animal'] },
        { key: '🐢', label: 'Turtle', shortcode: ':turtle:', keywords: ['turtle', 'slow'] },
        { key: '🦉', label: 'Owl', shortcode: ':owl:', keywords: ['owl', 'bird'] },
        { key: '🦋', label: 'Butterfly', shortcode: ':butterfly:', keywords: ['butterfly', 'insect'] }
      ]
    },
    {
      id: 'food',
      label: 'Food',
      icon: '🍕',
      items: [
        { key: '🍕', label: 'Pizza', shortcode: ':pizza:', keywords: ['pizza', 'food'] },
        { key: '🍜', label: 'Steaming Bowl', shortcode: ':ramen:', keywords: ['ramen', 'noodles'] },
        { key: '🍓', label: 'Strawberry', shortcode: ':strawberry:', keywords: ['berry', 'fruit'] },
        { key: '🍩', label: 'Doughnut', shortcode: ':doughnut:', keywords: ['donut', 'sweet'] },
        { key: '☕', label: 'Hot Beverage', shortcode: ':coffee:', keywords: ['coffee', 'drink'] },
        { key: '🍔', label: 'Hamburger', shortcode: ':hamburger:', keywords: ['burger', 'food'] },
        { key: '🌮', label: 'Taco', shortcode: ':taco:', keywords: ['taco', 'food'] },
        { key: '🍣', label: 'Sushi', shortcode: ':sushi:', keywords: ['sushi', 'fish'] },
        { key: '🍪', label: 'Cookie', shortcode: ':cookie:', keywords: ['cookie', 'dessert'] }
      ]
    },
    {
      id: 'activities',
      label: 'Activities',
      icon: '⚽',
      items: [
        { key: '⚽', label: 'Soccer Ball', shortcode: ':soccer:', keywords: ['soccer', 'football'] },
        { key: '🎮', label: 'Video Game', shortcode: ':video_game:', keywords: ['game', 'controller'] },
        { key: '🎯', label: 'Direct Hit', shortcode: ':dart:', keywords: ['dart', 'target'] },
        { key: '🎵', label: 'Musical Note', shortcode: ':musical_note:', keywords: ['music', 'note'] },
        { key: '🧩', label: 'Puzzle Piece', shortcode: ':puzzle_piece:', keywords: ['puzzle', 'piece'] },
        { key: '🏓', label: 'Ping Pong', shortcode: ':ping_pong:', keywords: ['ping', 'pong', 'table tennis'] },
        { key: '🎨', label: 'Artist Palette', shortcode: ':art:', keywords: ['art', 'paint'] },
        { key: '🎬', label: 'Clapper Board', shortcode: ':clapper:', keywords: ['movie', 'film'] },
        { key: '🎤', label: 'Microphone', shortcode: ':microphone:', keywords: ['microphone', 'sing'] }
      ]
    },
    {
      id: 'travel',
      label: 'Travel',
      icon: '✈️',
      items: [
        { key: '✈️', label: 'Airplane', shortcode: ':airplane:', keywords: ['plane', 'travel'] },
        { key: '🚗', label: 'Automobile', shortcode: ':car:', keywords: ['car', 'drive'] },
        { key: '🚀', label: 'Rocket', shortcode: ':rocket:', keywords: ['rocket', 'launch'] },
        { key: '🗺️', label: 'World Map', shortcode: ':world_map:', keywords: ['map', 'travel'] },
        { key: '🏕️', label: 'Camping', shortcode: ':camping:', keywords: ['camping', 'outdoor'] },
        { key: '🚲', label: 'Bicycle', shortcode: ':bike:', keywords: ['bike', 'bicycle'] },
        { key: '🚢', label: 'Ship', shortcode: ':ship:', keywords: ['ship', 'boat'] },
        { key: '🚇', label: 'Metro', shortcode: ':metro:', keywords: ['metro', 'train'] },
        { key: '🧳', label: 'Luggage', shortcode: ':luggage:', keywords: ['luggage', 'travel'] }
      ]
    },
    {
      id: 'objects',
      label: 'Objects',
      icon: '💡',
      items: [
        { key: '💡', label: 'Light Bulb', shortcode: ':bulb:', keywords: ['idea', 'light'] },
        { key: '📌', label: 'Pushpin', shortcode: ':pushpin:', keywords: ['pin', 'marker'] },
        { key: '📎', label: 'Paperclip', shortcode: ':paperclip:', keywords: ['paperclip', 'attachment'] },
        { key: '🔒', label: 'Locked', shortcode: ':lock:', keywords: ['lock', 'secure'] },
        { key: '🖥️', label: 'Desktop Computer', shortcode: ':desktop:', keywords: ['computer', 'screen'] },
        { key: '📱', label: 'Mobile Phone', shortcode: ':iphone:', keywords: ['phone', 'mobile'] },
        { key: '⌛', label: 'Hourglass Done', shortcode: ':hourglass:', keywords: ['time', 'hourglass'] },
        { key: '🧠', label: 'Brain', shortcode: ':brain:', keywords: ['brain', 'mind'] },
        { key: '🛠️', label: 'Hammer and Wrench', shortcode: ':tools:', keywords: ['tools', 'build'] }
      ]
    },
    {
      id: 'symbols',
      label: 'Symbols',
      icon: '❤️',
      items: [
        { key: '❤️', label: 'Red Heart', shortcode: ':heart:', keywords: ['heart', 'love'] },
        { key: '💯', label: 'Hundred Points', shortcode: ':100:', keywords: ['hundred', 'score'] },
        { key: '✅', label: 'Check Mark Button', shortcode: ':white_check_mark:', keywords: ['check', 'done'] },
        { key: '❗', label: 'Exclamation Mark', shortcode: ':exclamation:', keywords: ['exclamation', 'alert'] },
        { key: '♾️', label: 'Infinity', shortcode: ':infinity:', keywords: ['infinity', 'loop'] },
        { key: '⚠️', label: 'Warning', shortcode: ':warning:', keywords: ['warning', 'alert'] },
        { key: '➕', label: 'Plus', shortcode: ':heavy_plus_sign:', keywords: ['plus', 'add'] },
        { key: '➖', label: 'Minus', shortcode: ':heavy_minus_sign:', keywords: ['minus', 'remove'] },
        { key: '✳️', label: 'Eight Spoked Asterisk', shortcode: ':eight_spoked_asterisk:', keywords: ['asterisk', 'symbol'] }
      ]
    },
    {
      id: 'flags',
      label: 'Flags',
      icon: '🏳️',
      items: [
        { key: '🏳️', label: 'White Flag', shortcode: ':white_flag:', keywords: ['flag', 'white'] },
        { key: '🏴', label: 'Black Flag', shortcode: ':black_flag:', keywords: ['flag', 'black'] },
        { key: '🏁', label: 'Chequered Flag', shortcode: ':checkered_flag:', keywords: ['finish', 'race'] },
        { key: '🚩', label: 'Triangular Flag', shortcode: ':triangular_flag:', keywords: ['flag', 'marker'] },
        { key: '🏳️‍🌈', label: 'Rainbow Flag', shortcode: ':rainbow_flag:', keywords: ['flag', 'rainbow', 'pride'] },
        { key: '🇩🇪', label: 'Flag Germany', shortcode: ':flag_de:', keywords: ['germany', 'de', 'flag'] },
        { key: '🇫🇷', label: 'Flag France', shortcode: ':flag_fr:', keywords: ['france', 'fr', 'flag'] },
        { key: '🇺🇸', label: 'Flag United States', shortcode: ':flag_us:', keywords: ['usa', 'us', 'flag'] },
        { key: '🇯🇵', label: 'Flag Japan', shortcode: ':flag_jp:', keywords: ['japan', 'jp', 'flag'] }
      ]
    }
  ];

  const escapeHtml = (value) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const ensureFloatingLayer = (id, className, { role = '', label = '' } = {}) => {
    let node = document.getElementById(id);
    if (!(node instanceof HTMLElement)) {
      node = document.createElement('div');
      node.id = id;
      document.body.appendChild(node);
    }
    node.className = className;
    node.hidden = true;
    if (role) {
      node.setAttribute('role', role);
    }
    if (label) {
      node.setAttribute('aria-label', label);
    }
    return node;
  };

  const emojiPreviewOverlay = ensureFloatingLayer('emojiPickerPreviewOverlay', 'picker-preview-overlay gradient-card', {
    role: 'dialog',
    label: 'Emoji preview'
  });
  const gifPreviewOverlay = ensureFloatingLayer('gifPickerPreviewOverlay', 'picker-preview-overlay gif-picker-preview gradient-card', {
    role: 'dialog',
    label: 'GIF preview'
  });
  const gifItemMenu = ensureFloatingLayer('gifItemMenu', 'picker-item-menu gradient-card', {
    role: 'menu',
    label: 'GIF actions'
  });
  if (emojiItemMenu && emojiItemMenu.parentElement !== document.body) {
    document.body.appendChild(emojiItemMenu);
  }
  if (emojiItemMenu) {
    emojiItemMenu.classList.add('picker-item-menu');
    emojiItemMenu.setAttribute('role', 'menu');
    emojiItemMenu.setAttribute('aria-label', 'Emoji actions');
  }

  const hideFloatingNode = (node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.hidden = true;
  };

  const eventPathIncludes = (event, node) => {
    if (!(node instanceof HTMLElement) || !(event instanceof Event)) {
      return false;
    }
    if (typeof event.composedPath === 'function') {
      return event.composedPath().includes(node);
    }
    const target = event.target;
    return target instanceof Node && node.contains(target);
  };

  const positionFloatingNode = (node, anchorRect, preferredSide = 'right') => {
    if (!(node instanceof HTMLElement) || !anchorRect) {
      return;
    }

    node.hidden = false;
    node.style.left = '0px';
    node.style.top = '0px';
    const nodeRect = node.getBoundingClientRect();
    const padding = 8;
    const gap = 12;
    const spaces = {
      right: window.innerWidth - anchorRect.right - gap,
      left: anchorRect.left - gap,
      top: anchorRect.top - gap,
      bottom: window.innerHeight - anchorRect.bottom - gap
    };

    let side = preferredSide;
    if (preferredSide === 'right' && spaces.right < nodeRect.width && spaces.left > spaces.right) {
      side = 'left';
    } else if (preferredSide === 'left' && spaces.left < nodeRect.width && spaces.right > spaces.left) {
      side = 'right';
    } else if ((preferredSide === 'right' || preferredSide === 'left') && Math.max(spaces.right, spaces.left) < nodeRect.width && spaces.top > gap) {
      side = 'top';
    }

    let left = anchorRect.right + gap;
    let top = anchorRect.top;

    if (side === 'left') {
      left = anchorRect.left - nodeRect.width - gap;
      top = anchorRect.top;
    } else if (side === 'top') {
      left = anchorRect.left + ((anchorRect.width - nodeRect.width) / 2);
      top = anchorRect.top - nodeRect.height - gap;
    } else if (side === 'bottom') {
      left = anchorRect.left + ((anchorRect.width - nodeRect.width) / 2);
      top = anchorRect.bottom + gap;
    }

    left = Math.max(padding, Math.min(window.innerWidth - nodeRect.width - padding, left));
    top = Math.max(padding, Math.min(window.innerHeight - nodeRect.height - padding, top));
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  };

  const formatBytes = (value) => {
    if (!value || value < 1024) {
      return `${value || 0} B`;
    }
    if (value < 1024 * 1024) {
      return `${Math.ceil(value / 1024)} KB`;
    }
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };

  const copyText = async (value) => {
    const text = String(value || '');
    if (!text) {
      return false;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_error) {
      // Fallback below.
    }

    const probe = document.createElement('textarea');
    probe.value = text;
    probe.setAttribute('readonly', 'readonly');
    probe.style.position = 'fixed';
    probe.style.opacity = '0';
    document.body.appendChild(probe);
    probe.select();
    const copied = document.execCommand('copy');
    probe.remove();
    return copied;
  };

  const showHint = (text) => {
    if (!networkState) {
      return;
    }
    networkState.hidden = false;
    networkState.textContent = text;
  };

  const showToast = (text, tone = 'ok') => {
    if (!composer) {
      return;
    }
    const node = document.createElement('div');
    node.className = `composer-toast ${tone === 'error' ? 'error' : ''}`;
    node.textContent = text;
    composer.appendChild(node);
    setTimeout(() => {
      node.classList.add('visible');
    }, 10);
    setTimeout(() => {
      node.classList.remove('visible');
      setTimeout(() => node.remove(), 220);
    }, 2200);
  };

  const hideHint = () => {
    if (!networkState || !navigator.onLine) {
      return;
    }
    networkState.hidden = true;
  };

  const hasText = () => textarea.value.trim().length > 0;
  const hasAttachments = () => [...attachments.values()].some((item) => item.status === 'ready');
  const hasGif = () => Boolean(selectedGif && selectedGif.url);
  const canSend = () => hasText() || hasAttachments() || hasGif();
  const currentThreadId = () => Number(contextIdInput?.value || 0);
  const pruneAiPendingRequests = (threadId = currentThreadId()) => {
    if (!isAiDmComposer) {
      return;
    }
    const numericThreadId = Number(threadId || 0);
    [...aiPendingRequests.entries()].forEach(([key, state]) => {
      const sameThread = Number(state?.threadId || 0) === numericThreadId;
      const nodeConnected = state?.node instanceof HTMLElement && state.node.isConnected;
      if (sameThread && !nodeConnected) {
        clearAiRetryCooldown(state);
        aiPendingRequests.delete(key);
      }
    });
  };

  const hasOutstandingAiRequestForThread = (threadId = currentThreadId()) => {
    if (!isAiDmComposer || !threadId) {
      return false;
    }
    pruneAiPendingRequests(threadId);
    return [...aiPendingRequests.values()].some((state) =>
      state.threadId === threadId
        && state.node instanceof HTMLElement
        && state.node.isConnected
        && (state.inFlight === true || state.node.classList.contains('ai-pending-msg'))
    );
  };

  const syncSendButtonState = () => {
    if (!sendBtn || textarea.disabled) {
      return;
    }
    if (submitInFlight) {
      sendBtn.disabled = true;
      return;
    }
    if (isAiDmComposer && aiComposerLocked) {
      sendBtn.disabled = true;
      return;
    }
    if (isAiDmComposer && hasOutstandingAiRequestForThread()) {
      sendBtn.disabled = true;
      return;
    }
    sendBtn.disabled = !canSend();
  };

  const setAiAvailabilityBanner = ({ visible, code = '', message = '' }) => {
    if (!aiAvailabilityBanner || !isAiDmComposer) {
      return;
    }
    aiAvailabilityBanner.dataset.aiAvailabilityCode = code;
    aiAvailabilityBanner.textContent = message;
    aiAvailabilityBanner.hidden = !visible;
  };

  const formatAiProviderLabel = ({ provider = '', mode = '' }) => {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const normalizedMode = String(mode || '').trim().toLowerCase();
    const providerLabel = normalizedProvider === 'ollama' ? 'Ollama' : 'OpenAI';
    return normalizedMode === 'auto'
      ? `Provider: ${providerLabel} (Auto)`
      : `Provider: ${providerLabel}`;
  };

  const setAiProviderBadge = ({ provider = '', mode = '' }) => {
    if (!aiProviderBadge || !isAiDmComposer) {
      return;
    }
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (!normalizedProvider) {
      aiProviderBadge.hidden = true;
      return;
    }
    aiProviderBadge.hidden = false;
    aiProviderBadge.dataset.aiProvider = normalizedProvider;
    aiProviderBadge.dataset.aiProviderMode = String(mode || '').trim().toLowerCase();
    aiProviderBadge.textContent = formatAiProviderLabel({ provider: normalizedProvider, mode });
  };

  const setAiComposerLockedState = (locked, message = '') => {
    if (!isAiDmComposer) {
      return;
    }

    aiComposerLocked = Boolean(locked);
    aiComposerLockMessage = aiComposerLocked ? String(message || '').trim() : '';
    textarea.disabled = false;
    textarea.readOnly = aiComposerLocked;
    textarea.placeholder = baseTextareaPlaceholder;

    [attachBtn, emojiBtn, gifBtn].forEach((button) => {
      if (button) {
        button.disabled = aiComposerLocked;
      }
    });

    if (aiComposerLocked) {
      sendBtn && (sendBtn.disabled = true);
      return;
    }

    syncSendButtonState();
  };

  const clearAiComposerCooldown = () => {
    aiComposerCooldownUntil = 0;
    if (aiComposerCooldownTimer) {
      window.clearInterval(aiComposerCooldownTimer);
      aiComposerCooldownTimer = 0;
    }
  };

  const updateAiComposerCooldown = (message = '') => {
    const remainingMs = Math.max(0, aiComposerCooldownUntil - Date.now());
    if (remainingMs <= 0) {
      clearAiComposerCooldown();
      setAiComposerLockedState(false);
      return;
    }

    const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
    setAiComposerLockedState(true, message || `Bitte warte ${seconds} Sekunde${seconds === 1 ? '' : 'n'} und versuche es erneut.`);
  };

  const startAiComposerCooldown = (waitMs, message = '') => {
    clearAiComposerCooldown();
    aiComposerCooldownUntil = Date.now() + Math.max(1000, Number(waitMs || 0));
    updateAiComposerCooldown(message);
    aiComposerCooldownTimer = window.setInterval(() => {
      updateAiComposerCooldown(message);
    }, 250);
  };

  const toAiPersonaMessage = (errorLike) => {
    const code = String(errorLike?.code || 'PROVIDER_ERROR').trim().toUpperCase();
    if (code === 'RATE_LIMIT') {
      return 'Zu viele Fragen drängen zugleich; mein λόγος stockt. Gib mir einen Augenblick.';
    }
    if (code === 'QUOTA') {
      return 'Zu viele Fragen drängen zugleich; mein λόγος stockt. Gib mir einen Augenblick.';
    }
    if (code === 'TIMEOUT' || code === 'PROVIDER_ERROR') {
      return 'Die Verbindung ist wie Nebel; ich höre dich, doch meine Antwort erreicht dich nicht.';
    }
    if (code === 'CONFIG_ERROR') {
      return 'Man hat mir den Mund gegeben, aber nicht die Zunge (Konfiguration).';
    }
    if (code === 'VALIDATION_ERROR') {
      return 'Deine Rede ist so lang, dass ich ihren Anfang vergesse, ehe ich ihr Ende erreiche. Kürze sie, und wir prüfen sie sauber.';
    }
    return 'Etwas Ungeordnetes hat meinen Gedankengang zerrissen. Wiederhole deine Frage, damit ich sie erneut prüfen kann.';
  };

  const buildSyntheticAiMessage = ({ content = '', threadId = 0 } = {}) => ({
    id: `ai-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    thread_id: Number(threadId || 0),
    content: String(content || '').trim(),
    kind: 'text',
    agent_slug: 'sokrates',
    created_at: 'now',
    author_id: -1,
    author_username: 'sokrates_ai_agent',
    author_display_name: aiDisplayName || 'Sokrates',
    author_avatar_url: aiAvatarUrl || '',
    author_is_system_agent: true,
    emoji_entities: [],
    attachments: [],
    gifs: []
  });

  const applyAiHealthState = (payload) => {
    if (!isAiDmComposer) {
      return;
    }

    setAiProviderBadge({
      provider: payload?.selectedProvider || payload?.provider || aiSelectedProvider || 'openai',
      mode: payload?.activeMode || aiActiveMode || 'auto'
    });

    if (payload?.available === true) {
      clearAiComposerCooldown();
      setAiAvailabilityBanner({ visible: false, code: '', message: '' });
      setAiComposerLockedState(false);
      hideHint();
      return;
    }

    const code = String(payload?.code || '');
    setAiAvailabilityBanner({
      visible: code === 'FALLBACK' && String(payload?.message || '').trim().length > 0,
      code: code === 'FALLBACK' ? code : '',
      message: code === 'FALLBACK' ? String(payload?.message || '') : ''
    });

    if (code === 'CONFIG_ERROR' || String(payload?.activeMode || payload?.active_mode || '') === 'auto') {
      setAiComposerLockedState(true, toAiPersonaMessage({ code: code || 'PROVIDER_ERROR' }));
    } else {
      clearAiComposerCooldown();
      setAiComposerLockedState(false);
    }
    hideHint();
  };

  setAiProviderBadge({
    provider: aiSelectedProvider || 'openai',
    mode: aiActiveMode || 'auto'
  });

  const pollAiHealth = async () => {
    if (!isAiDmComposer) {
      return false;
    }

    try {
      const response = await fetch('/ai/status', {
        headers: {
          Accept: 'application/json'
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        return false;
      }
      applyAiHealthState(data);
      return data.available === true;
    } catch (error) {
      return false;
    }
  };

  const scheduleAiHealthPoll = () => {
    if (!isAiDmComposer || aiHealthPollTimer) {
      return;
    }

    aiHealthPollTimer = window.setTimeout(async () => {
      aiHealthPollTimer = 0;
      const available = await pollAiHealth();
      const activeConfigCode = String(aiAvailabilityBanner?.dataset.aiAvailabilityCode || aiAvailabilityCode || '');
      if (!available && (aiComposerLocked || activeConfigCode === 'CONFIG_ERROR')) {
        scheduleAiHealthPoll();
      }
    }, AI_HEALTHCHECK_INTERVAL_MS);
  };

  document.addEventListener('apeiron:ai-health-state', (event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }
    applyAiHealthState(event.detail);
  });

  const buildAttachmentPayload = () => [...attachments.values()]
    .filter((item) => item.status === 'ready' && item.dataUrl)
    .map((item) => ({
      kind: item.kind,
      mime_type: item.file.type,
      filename: item.file.name,
      file_size: item.file.size,
      url: item.dataUrl
    }));

  const tokenForName = (name) => `:${String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32)}:`;
  const unicodeEmojiByKey = new Map();
  UNICODE_EMOJI_CATALOG.forEach((section) => {
    section.items.forEach((item) => {
      unicodeEmojiByKey.set(item.key, {
        ...item,
        type: 'unicode',
        sectionId: section.id,
        sectionLabel: section.label
      });
    });
  });
  const unicodeEmojiPattern = (() => {
    const keys = [...unicodeEmojiByKey.keys()]
      .sort((left, right) => right.length - left.length)
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return keys.length ? new RegExp(`(${keys.join('|')})`, 'g') : null;
  })();

  const replaceListContents = (list, nextValues) => {
    list.splice(0, list.length, ...nextValues);
  };

  const normalizeEmojiStateKeys = (values, limit = 48) => {
    if (!Array.isArray(values)) {
      return [];
    }

    const next = [];
    const seen = new Set();
    values.forEach((entry) => {
      const key = String(entry || '').trim().slice(0, 64);
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      next.push(key);
    });
    return next.slice(0, limit);
  };

  const readEmojiPreferencesFromDom = () => {
    if (!emojiPreferenceData?.textContent) {
      return;
    }

    try {
      const parsed = JSON.parse(emojiPreferenceData.textContent);
      replaceListContents(favoriteEmojiKeys, normalizeEmojiStateKeys(parsed?.favorites || [], 48));
      replaceListContents(recentEmojiKeys, normalizeEmojiStateKeys(parsed?.recents || [], 24));
    } catch (_error) {
      replaceListContents(favoriteEmojiKeys, []);
      replaceListContents(recentEmojiKeys, []);
    }
  };

  const applyEmojiStatePayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    if (Array.isArray(payload.favorites)) {
      replaceListContents(favoriteEmojiKeys, normalizeEmojiStateKeys(payload.favorites, 48));
    }
    if (Array.isArray(payload.recents)) {
      replaceListContents(recentEmojiKeys, normalizeEmojiStateKeys(payload.recents, 24));
    }
  };

  const normalizeGifStateIds = (values, limit = 48) => {
    if (!Array.isArray(values)) {
      return [];
    }

    const next = [];
    const seen = new Set();
    values.forEach((entry) => {
      const id = Number(entry);
      if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
        return;
      }
      seen.add(id);
      next.push(id);
    });
    return next.slice(0, limit);
  };

  const applyGifStatePayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    if (Array.isArray(payload.favorites)) {
      replaceListContents(favoriteGifIds, normalizeGifStateIds(payload.favorites, 48));
    }
    if (Array.isArray(payload.recents)) {
      replaceListContents(recentGifIds, normalizeGifStateIds(payload.recents, 24));
    }
  };

  const readLibraryFromDom = () => {
    customEmojiLibrary.clear();
    if (!userEmojiLibraryData?.textContent) {
      return;
    }
    try {
      const parsed = JSON.parse(userEmojiLibraryData.textContent);
      if (!Array.isArray(parsed)) {
        return;
      }
      parsed.forEach((item) => {
        const token = tokenForName(item.name);
        if (!item.id || !item.url || token === '::') {
          return;
        }
        customEmojiLibrary.set(token, {
          id: Number(item.id),
          userId: Number(item.user_id || 0),
          name: String(item.name || ''),
          url: String(item.url || ''),
          token,
          visibility: String(item.visibility || 'private') === 'public' ? 'public' : 'private'
        });
      });
    } catch (_error) {
      // ignore malformed bootstrap payload
    }
  };

  const syncDraftEmojiEntitiesWithLibrary = () => {
    [...draftEmojiEntities.keys()].forEach((token) => {
      if (!customEmojiLibrary.has(token)) {
        draftEmojiEntities.delete(token);
      }
    });
  };

  const closeEmojiItemMenu = () => {
    if (!emojiItemMenu) {
      return;
    }
    hideFloatingNode(emojiItemMenu);
    emojiItemMenu.innerHTML = '';
    emojiItemMenuMeta = null;
  };

  const closeEmojiPreviewOverlay = () => {
    hideFloatingNode(emojiPreviewOverlay);
    emojiPreviewAnchor = null;
  };

  const openEmojiItemContextMenu = (event, itemButton) => {
    if (!(itemButton instanceof HTMLElement)) {
      closeEmojiItemMenu();
      return;
    }

    closeGifItemMenu();
    const key = String(itemButton.dataset.emojiKey || '').trim();
    const kind = String(itemButton.dataset.emojiKind || '').trim();
    const entry = resolveEmojiEntry(key);
    if (!entry) {
      closeEmojiItemMenu();
      return;
    }

    if (kind === 'custom') {
      entry.id = Number(itemButton.dataset.customEmojiId || entry.id || 0);
      entry.name = String(itemButton.dataset.customEmojiName || entry.name || '');
      entry.preview = String(itemButton.dataset.customEmojiUrl || entry.preview || '');
      entry.visibility = String(itemButton.dataset.emojiVisibility || entry.visibility || 'private');
      entry.canDelete = String(itemButton.dataset.emojiCanDelete || '') === '1' || Boolean(entry.canDelete);
    }

    emojiItemMenuMeta = entry;
    if (!emojiItemMenu) {
      return;
    }

    const isFavorite = favoriteEmojiKeys.includes(entry.key);
    const deleteDisabled = entry.type !== 'custom' || !entry.canDelete;
    emojiItemMenu.innerHTML = [
      '<button type="button" class="message-context-item" data-emoji-menu-action="copy">Copy Emoji</button>',
      `<button type="button" class="message-context-item" data-emoji-menu-action="favorite">${isFavorite ? 'Unfavorite' : 'Favorite'}</button>`,
      entry.type === 'custom'
        ? `<button type="button" class="message-context-item danger ${deleteDisabled ? 'is-disabled' : ''}" data-emoji-menu-action="delete" ${deleteDisabled ? 'disabled title="Missing permission"' : ''}>Delete Emoji</button>`
        : ''
    ].join('');
    positionFloatingNode(emojiItemMenu, {
      left: event.clientX,
      right: event.clientX,
      top: event.clientY,
      bottom: event.clientY,
      width: 1,
      height: 1
    }, 'right');
  };

  const buildCustomEmojiEntry = (emoji) => {
    if (!emoji || !emoji.token) {
      return null;
    }
    const visibility = String(emoji.visibility || 'private') === 'public' ? 'public' : 'private';
    const isOwner = Number(emoji.userId || 0) === currentUserId;
    return {
      key: emoji.token,
      type: 'custom',
      label: emoji.name,
      shortcode: emoji.token,
      preview: emoji.url,
      token: emoji.token,
      name: emoji.name,
      id: Number(emoji.id || 0),
      ownerId: Number(emoji.userId || 0),
      visibility,
      canDelete: isOwner || (visibility === 'public' && activeServerId > 0 && canManageEmojiLibrary),
      sectionId: 'custom',
      sectionLabel: 'Custom'
    };
  };

  const getSortedCustomEntries = () => [...customEmojiLibrary.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')) || Number(a.id || 0) - Number(b.id || 0))
    .map((emoji) => buildCustomEmojiEntry(emoji))
    .filter(Boolean);

  const resolveEmojiEntry = (key) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) {
      return null;
    }
    if (unicodeEmojiByKey.has(normalizedKey)) {
      return unicodeEmojiByKey.get(normalizedKey);
    }
    if (customEmojiLibrary.has(normalizedKey)) {
      return buildCustomEmojiEntry(customEmojiLibrary.get(normalizedKey));
    }
    return null;
  };

  const renderEmojiPreviewOverlay = (entry, anchor = null) => {
    closeEmojiPreviewOverlay();
  };

  const setEmojiPreviewState = (entry, anchor = null) => {
    emojiPreviewState = entry || null;
    if (!emojiSelectionPreview || !emojiPreviewVisual || !emojiPreviewLabel || !emojiPreviewToken) {
      closeEmojiPreviewOverlay();
      return;
    }

    if (!entry) {
      emojiPreviewVisual.textContent = '🙂';
      emojiPreviewVisual.innerHTML = '🙂';
      emojiPreviewLabel.textContent = 'No emoji selected';
      emojiPreviewToken.textContent = 'Pick an emoji to preview it';
      closeEmojiPreviewOverlay();
      return;
    }

    if (entry.type === 'custom' && entry.preview) {
      emojiPreviewVisual.innerHTML = `<img src="${escapeHtml(entry.preview)}" alt="${escapeHtml(entry.shortcode || entry.label)}" loading="lazy" />`;
    } else {
      emojiPreviewVisual.textContent = entry.key;
    }
    emojiPreviewLabel.textContent = entry.label || 'Emoji';
    emojiPreviewToken.textContent = entry.shortcode || entry.key;
    closeEmojiPreviewOverlay();
  };

  const updateEmojiCategoryRail = () => {
    const buttons = emojiCategoryRail?.querySelectorAll('[data-emoji-category-target]') || [];
    buttons.forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      button.classList.toggle('is-active', !emojiSearchQuery && button.dataset.emojiCategoryTarget === emojiActiveCategory);
    });
  };

  const renderEmojiItem = (entry) => {
    const isCustom = entry.type === 'custom';
    const preview = isCustom && entry.preview
      ? `<img src="${escapeHtml(entry.preview)}" alt="${escapeHtml(entry.shortcode || entry.label)}" data-testid="${contextFieldName === 'channelId' ? 'server' : 'dm'}-custom-emoji-image" loading="lazy" />`
      : escapeHtml(entry.key);

    return `
      <button
        type="button"
        class="emoji-item ${isCustom ? 'custom-emoji' : 'unicode-emoji'}"
        data-emoji-key="${escapeHtml(entry.key)}"
        data-emoji-kind="${escapeHtml(entry.type)}"
        data-emoji-label="${escapeHtml(entry.label || 'Emoji')}"
        data-emoji-token="${escapeHtml(entry.shortcode || entry.key)}"
        data-emoji-preview="${escapeHtml(entry.preview || '')}"
        data-emoji-visibility="${escapeHtml(entry.visibility || '')}"
        data-emoji-can-delete="${isCustom && entry.canDelete ? '1' : '0'}"
        data-custom-emoji-id="${isCustom ? escapeHtml(String(entry.id || 0)) : ''}"
        data-custom-emoji-name="${isCustom ? escapeHtml(String(entry.name || '')) : ''}"
        data-custom-emoji-url="${isCustom ? escapeHtml(String(entry.preview || '')) : ''}"
        data-testid="${isCustom ? `${contextFieldName === 'channelId' ? 'server' : 'dm'}-custom-emoji-item` : `${contextFieldName === 'channelId' ? 'server' : 'dm'}-emoji-item`}"
        title="${escapeHtml(entry.label || entry.shortcode || entry.key)}"
      >${preview}</button>
    `;
  };

  const matchesEmojiSearch = (entry, query) => {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) {
      return true;
    }
    if (entry.type === 'unicode') {
      return [
        entry.label,
        entry.shortcode,
        ...(Array.isArray(entry.keywords) ? entry.keywords : [])
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    }
    return [
      entry.label,
      entry.shortcode,
      entry.name
    ].some((value) => String(value || '').toLowerCase().includes(needle));
  };

  const buildEmojiSections = () => {
    if (emojiSearchQuery) {
      const unicodeMatches = [];
      UNICODE_EMOJI_CATALOG.forEach((section) => {
        section.items.forEach((item) => {
          const entry = unicodeEmojiByKey.get(item.key);
          if (entry && matchesEmojiSearch(entry, emojiSearchQuery)) {
            unicodeMatches.push(entry);
          }
        });
      });
      const customMatches = getSortedCustomEntries().filter((entry) => matchesEmojiSearch(entry, emojiSearchQuery));
      const sections = [];
      if (unicodeMatches.length) {
        sections.push({ id: 'search-emoji', label: 'Emoji', entries: unicodeMatches });
      }
      if (customMatches.length) {
        sections.push({ id: 'search-custom', label: 'Custom', entries: customMatches });
      }
      return sections;
    }

    const sections = [];
    const favoriteEntries = favoriteEmojiKeys.map((key) => resolveEmojiEntry(key)).filter(Boolean);
    const recentEntries = recentEmojiKeys
      .filter((key) => !favoriteEmojiKeys.includes(key))
      .map((key) => resolveEmojiEntry(key))
      .filter(Boolean);

    if (favoriteEntries.length) {
      sections.push({ id: 'favorites', label: 'Favorites', entries: favoriteEntries });
    }
    if (recentEntries.length) {
      sections.push({ id: 'recent', label: 'Recent', entries: recentEntries });
    }

    EMOJI_CATEGORY_ORDER.forEach((sectionId) => {
      const section = UNICODE_EMOJI_CATALOG.find((entry) => entry.id === sectionId);
      if (!section) {
        return;
      }
      sections.push({
        id: section.id,
        label: section.label,
        entries: section.items.map((item) => unicodeEmojiByKey.get(item.key)).filter(Boolean)
      });
    });

    const customEntries = getSortedCustomEntries();
    if (customEntries.length) {
      sections.push({ id: 'custom', label: 'Custom', entries: customEntries });
    }

    return sections;
  };

  const renderEmojiBrowser = () => {
    if (!emojiSectionMount) {
      return;
    }

    const sections = buildEmojiSections();
    if (!sections.length) {
      emojiSectionMount.innerHTML = '<div class="cat-card empty">Keine Emojis gefunden.</div>';
      updateEmojiCategoryRail();
      closeEmojiItemMenu();
      setEmojiPreviewState(null);
      return;
    }

    if (!emojiSearchQuery && !sections.some((section) => section.id === emojiActiveCategory)) {
      emojiActiveCategory = sections[0].id;
    }

    emojiSectionMount.innerHTML = sections.map((section) => `
      <section class="emoji-section" id="emoji-section-${escapeHtml(section.id)}" data-emoji-section="${escapeHtml(section.id)}">
        <div class="emoji-section-head">
          <strong>${escapeHtml(section.label)}</strong>
          <span>${section.entries.length}</span>
        </div>
        <div class="emoji-grid ${section.id === 'custom' ? 'custom' : ''}">
          ${section.entries.map((entry) => renderEmojiItem(entry)).join('')}
        </div>
      </section>
    `).join('');

    updateEmojiCategoryRail();
    closeEmojiItemMenu();
    if (!emojiPreviewState || !resolveEmojiEntry(emojiPreviewState.key)) {
      setEmojiPreviewState(null);
    } else {
      setEmojiPreviewState(resolveEmojiEntry(emojiPreviewState.key));
    }
  };

  const scrollToEmojiSection = (sectionId) => {
    if (!emojiSectionScroll || !emojiSectionMount) {
      return;
    }
    const nextSectionId = String(sectionId || '').trim();
    if (!nextSectionId) {
      return;
    }

    const target = emojiSectionMount.querySelector(`[data-emoji-section="${nextSectionId}"]`);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.scrollIntoView({
      block: 'start',
      behavior: 'auto'
    });
    emojiActiveCategory = nextSectionId;
    updateEmojiCategoryRail();
  };

  const persistFavorites = async (key, favorite) => {
    const response = await fetch('/app/home/emoji/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        key,
        favorite
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Favorit konnte nicht gespeichert werden.');
    }
    applyEmojiStatePayload(payload);
  };

  const persistRecent = async (key) => {
    const response = await fetch('/app/home/emoji/recents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ key })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      return;
    }
    applyEmojiStatePayload(payload);
  };

  const recordEmojiUsage = (key) => {
    const safeKey = String(key || '').trim();
    if (!safeKey) {
      return;
    }
    const nextRecents = [safeKey, ...recentEmojiKeys.filter((entry) => entry !== safeKey)].slice(0, 24);
    replaceListContents(recentEmojiKeys, nextRecents);
    renderEmojiBrowser();
    persistRecent(safeKey).catch(() => {});
  };

  const removeDeletedEmojiFromMessages = (deletedEmoji) => {
    const safeId = Number(deletedEmoji?.id || 0);
    const safeToken = String(deletedEmoji?.token || '').trim();
    if (!timeline || (!safeId && !safeToken)) {
      return;
    }

    const nodes = timeline.querySelectorAll('[data-emoji-entities]');
    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      let entities = [];
      try {
        entities = JSON.parse(decodeURIComponent(node.dataset.emojiEntities || '[]'));
      } catch (_error) {
        entities = [];
      }
      if (!Array.isArray(entities) || !entities.length) {
        return;
      }

      const filtered = entities.filter((entity) => Number(entity.id || 0) !== safeId && String(entity.token || '').trim() !== safeToken);
      if (filtered.length === entities.length) {
        return;
      }

      node.dataset.emojiEntities = encodeURIComponent(JSON.stringify(filtered));
      const textNode = node.querySelector('.msg-text');
      if (textNode instanceof HTMLElement) {
        const rawText = decodeMessageText(node.dataset.messageText || textNode.textContent || '');
        textNode.innerHTML = renderInlineEmojis(rawText, filtered);
      }
    });
  };

  const renderQueue = () => {
    if (!uploadQueue) {
      return;
    }

    const attachmentHtml = [...attachments.values()].map((item) => {
      const statusLabel = item.status === 'ready'
        ? 'Bereit'
        : item.status === 'reading'
          ? 'Verarbeite...'
          : 'Fehler';
      const preview = item.kind === 'image'
        ? `<img class="upload-thumb" src="${item.previewUrl}" alt="${escapeHtml(item.file.name)}" />`
        : `<div class="upload-file-icon">${item.kind === 'video' ? '🎬' : '📄'}</div>`;

      return `
        <article class="upload-item">
          <div class="upload-preview">
            ${preview}
            <div class="upload-meta">
              <strong>${escapeHtml(item.file.name)}</strong>
              <span>${statusLabel} • ${formatBytes(item.file.size)}</span>
              ${item.error ? `<span class="sub">${escapeHtml(item.error)}</span>` : ''}
            </div>
          </div>
          <div class="composer-tools">
            ${item.status === 'error' ? `<button type="button" class="chip" data-retry-attachment="${item.id}">Retry</button>` : ''}
            <button type="button" class="chip danger" data-remove-attachment="${item.id}">Remove</button>
          </div>
        </article>
      `;
    }).join('');

    const gifHtml = hasGif() ? `
      <article class="upload-item">
        <div class="upload-preview">
          ${String(selectedGif.mimeType || 'image/gif').startsWith('video/')
            ? `<video class="upload-thumb" src="${escapeHtml(selectedGif.url)}" muted loop autoplay playsinline></video>`
            : `<img class="upload-thumb" src="${escapeHtml(selectedGif.url)}" alt="${escapeHtml(selectedGif.label || 'GIF')}" />`}
          <div class="upload-meta">
            <strong>GIF: ${escapeHtml(selectedGif.label || 'Selected')}</strong>
            <span>Bereit</span>
          </div>
        </div>
        <div class="composer-tools">
          <button type="button" class="chip danger" data-remove-gif="1">Remove</button>
        </div>
      </article>
    ` : '';

    uploadQueue.innerHTML = `${attachmentHtml}${gifHtml}`;
    syncSendButtonState();
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });

  const processAttachment = async (item) => {
    item.status = 'reading';
    item.error = '';
    renderQueue();

    try {
      const dataUrl = await readFileAsDataUrl(item.file);
      if (!dataUrl.startsWith(`data:${item.file.type};base64,`)) {
        throw new Error('invalid-data-url');
      }
      item.dataUrl = dataUrl;
      item.previewUrl = item.kind === 'image' ? dataUrl : '';
      item.status = 'ready';
      hideHint();
    } catch (error) {
      item.status = 'error';
      item.error = 'Datei konnte nicht gelesen werden.';
      showHint('Upload fehlgeschlagen. Bitte Retry.');
    }
    renderQueue();
  };

  const detectKind = (file) => {
    if (file.type === 'image/gif') {
      return 'gif';
    }
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    if (file.type.startsWith('video/')) {
      return 'video';
    }
    return 'file';
  };

  const addAttachment = async (file) => {
    if (!validTypes.has(file.type)) {
      showHint(`Ungültiger Dateityp: ${file.name}`);
      return;
    }
    if (file.size > maxSizeBytes) {
      showHint(`Datei zu groß: ${file.name}. Max 2MB. Alternative: compress.`);
      return;
    }
    if (attachments.size >= maxFiles) {
      showHint(`Maximal ${maxFiles} Attachments pro Nachricht.`);
      return;
    }

    attachmentId += 1;
    const item = {
      id: attachmentId,
      file,
      kind: detectKind(file),
      dataUrl: '',
      previewUrl: '',
      status: 'reading',
      error: ''
    };
    attachments.set(item.id, item);
    await processAttachment(item);
  };

  attachBtn?.addEventListener('click', () => attachInput?.click());

  attachInput?.addEventListener('change', async () => {
    const files = Array.from(attachInput.files || []);
    for (const file of files) {
      // Sequential read keeps UI state predictable.
      // eslint-disable-next-line no-await-in-loop
      await addAttachment(file);
    }
    attachInput.value = '';
  });

  uploadQueue?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const removeAttachmentId = target.dataset.removeAttachment;
    if (removeAttachmentId) {
      attachments.delete(Number(removeAttachmentId));
      renderQueue();
      return;
    }

    const retryAttachmentId = target.dataset.retryAttachment;
    if (retryAttachmentId) {
      const item = attachments.get(Number(retryAttachmentId));
      if (item) {
        await processAttachment(item);
      }
      return;
    }

    if (target.dataset.removeGif === '1') {
      selectedGif = null;
      renderQueue();
    }
  });

  const insertAtCursor = (value) => {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.setRangeText(value, start, end, 'end');
    textarea.focus();
  };

  const insertCustomEmojiToken = (emoji) => {
    if (!emoji) {
      return;
    }
    const token = tokenForName(emoji.name);
    if (!token || token === '::') {
      return;
    }
    draftEmojiEntities.set(token, {
      id: Number(emoji.id),
      token,
      name: String(emoji.name || ''),
      url: String(emoji.url || '')
    });
    insertAtCursor(`${token} `);
    setEmojiPreviewState(resolveEmojiEntry(token));
    recordEmojiUsage(token);
  };

  const positionEmojiPopover = () => {
    if (!emojiPopover || !emojiBtn) {
      return;
    }
    const rect = emojiBtn.getBoundingClientRect();
    const width = Math.min(480, window.innerWidth - 16);
    const maxHeight = Math.min(560, window.innerHeight - 16);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    emojiPopover.style.width = `${width}px`;
    emojiPopover.style.maxHeight = `${maxHeight}px`;
    emojiPopover.style.left = `${Math.max(8, left)}px`;
    emojiPopover.style.top = '8px';
    emojiPopover.style.transform = 'none';

    const measuredHeight = Math.min(Math.ceil(emojiPopover.getBoundingClientRect().height || maxHeight), maxHeight);
    const spaceAbove = rect.top - 12;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    let top = 8;

    if (spaceAbove >= measuredHeight) {
      top = rect.top - measuredHeight - 12;
    } else if (spaceBelow >= measuredHeight || spaceBelow >= 280) {
      top = Math.max(8, Math.min(window.innerHeight - measuredHeight - 8, rect.bottom + 12));
    } else {
      top = Math.max(8, Math.min(window.innerHeight - measuredHeight - 8, rect.top - Math.min(spaceAbove, measuredHeight)));
    }

    emojiPopover.style.top = `${top}px`;
    if (emojiPreviewState) {
      renderEmojiPreviewOverlay(emojiPreviewState, emojiPreviewAnchor);
    }
  };

  const setEmojiOpen = (open) => {
    if (!emojiPopover) {
      return;
    }
    emojiPopover.hidden = !open;
    if (open) {
      if (gifModal && !gifModal.hidden) {
        setGifModalOpen(false);
      }
      if (emojiBrowseView) {
        emojiBrowseView.hidden = false;
      }
      if (emojiAddView) {
        emojiAddView.hidden = true;
      }
      closeGifItemMenu();
      hideFloatingNode(gifPreviewOverlay);
      closeEmojiItemMenu();
      positionEmojiPopover();
      renderEmojiBrowser();
      emojiSearchInput?.focus();
    } else if (emojiSearchInput) {
      emojiSearchQuery = '';
      emojiSearchInput.value = '';
      closeEmojiItemMenu();
      if (emojiPreviewObjectUrl) {
        URL.revokeObjectURL(emojiPreviewObjectUrl);
        emojiPreviewObjectUrl = '';
      }
      pendingEmojiUploadFile = null;
      setEmojiPreviewState(null);
    }
  };

  emojiItemMenu?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !emojiItemMenuMeta) {
      return;
    }
    const menuAction = target.closest('[data-emoji-menu-action]');
    if (!(menuAction instanceof HTMLElement) || !emojiItemMenu.contains(menuAction)) {
      return;
    }

    event.stopPropagation();
    const action = String(menuAction.dataset.emojiMenuAction || '');
    const entry = emojiItemMenuMeta;
    suppressOutsideCloseUntil = Date.now() + 250;
    closeEmojiItemMenu();

    if (action === 'copy') {
      const copied = await copyText(entry.type === 'custom' ? entry.shortcode : entry.key);
      showToast(copied ? 'Emoji kopiert.' : 'Emoji konnte nicht kopiert werden.', copied ? 'ok' : 'error');
      return;
    }

    if (action === 'favorite') {
      const shouldFavorite = !favoriteEmojiKeys.includes(entry.key);
      try {
        await persistFavorites(entry.key, shouldFavorite);
        if (shouldFavorite) {
          emojiActiveCategory = 'favorites';
        }
        renderEmojiBrowser();
        if (shouldFavorite) {
          if (emojiSectionScroll) {
            emojiSectionScroll.scrollTop = 0;
          }
          scrollToEmojiSection('favorites');
        }
        showToast(shouldFavorite ? 'Zu Favoriten hinzugefugt.' : 'Favorit entfernt.');
      } catch (error) {
        showToast(error.message || 'Favorit konnte nicht gespeichert werden.', 'error');
      }
      return;
    }

    if (action === 'delete' && entry.type === 'custom' && entry.id) {
      if (!entry.canDelete) {
        showToast('Missing permission', 'error');
        return;
      }
      if (!window.confirm('Emoji loschen? Wird aus allen Chats entfernt (bleibt als Text/Placeholder).')) {
        return;
      }
      const response = await fetch(`/app/home/emoji/${entry.id}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          serverId: activeServerId || 0
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        showToast(payload.error || 'Emoji konnte nicht geloscht werden.', 'error');
        return;
      }
      customEmojiLibrary.delete(entry.key);
      draftEmojiEntities.delete(entry.key);
      applyEmojiStatePayload(payload);
      syncDraftEmojiEntitiesWithLibrary();
      removeDeletedEmojiFromMessages(payload.emoji || entry);
      renderEmojiBrowser();
      showToast('Emoji geloscht.');
    }
  });

  emojiBtn?.addEventListener('click', () => {
    if (!emojiPopover) {
      return;
    }
    setEmojiOpen(emojiPopover.hidden);
  });

  emojiPopover?.addEventListener('click', async (event) => {
    if (event instanceof MouseEvent && event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.closeEmoji === 'true') {
      setEmojiOpen(false);
      return;
    }

    const categoryButton = target.closest('[data-emoji-category-target]');
    if (categoryButton instanceof HTMLElement) {
      const sectionId = String(categoryButton.dataset.emojiCategoryTarget || '');
      if (!sectionId) {
        return;
      }
      if (emojiSearchQuery) {
        emojiSearchQuery = '';
        if (emojiSearchInput) {
          emojiSearchInput.value = '';
        }
        renderEmojiBrowser();
      }
      scrollToEmojiSection(sectionId);
      return;
    }

    const itemButton = target.closest('[data-emoji-key]');
    if (!(itemButton instanceof HTMLElement)) {
      if (emojiItemMenu && !emojiItemMenu.hidden && !emojiItemMenu.contains(target)) {
        closeEmojiItemMenu();
      }
      return;
    }

    const key = String(itemButton.dataset.emojiKey || '').trim();
    const kind = String(itemButton.dataset.emojiKind || '').trim();
    if (!key) {
      return;
    }

    if (kind === 'custom') {
      setEmojiPreviewState(resolveEmojiEntry(key), itemButton);
      insertCustomEmojiToken({
        id: Number(itemButton.dataset.customEmojiId || 0),
        name: String(itemButton.dataset.customEmojiName || ''),
        url: String(itemButton.dataset.customEmojiUrl || '')
      });
      return;
    }

    setEmojiPreviewState(resolveEmojiEntry(key), itemButton);
    insertAtCursor(`${key} `);
    recordEmojiUsage(key);
  });

  emojiSearchInput?.addEventListener('input', () => {
    emojiSearchQuery = emojiSearchInput.value.trim().toLowerCase();
    renderEmojiBrowser();
  });

  const setEmojiUploadError = (message) => {
    if (!emojiUploadError) {
      return;
    }
    emojiUploadError.hidden = !message;
    emojiUploadError.textContent = message || '';
  };

  const setEmojiUploadStatus = (message, tone = '') => {
    if (!emojiUploadStatus) {
      return;
    }
    emojiUploadStatus.hidden = !message;
    emojiUploadStatus.textContent = message || '';
    emojiUploadStatus.classList.remove('upload-status-ok', 'upload-status-run');
    if (tone === 'ok') {
      emojiUploadStatus.classList.add('upload-status-ok');
    } else if (tone === 'run') {
      emojiUploadStatus.classList.add('upload-status-run');
    }
  };

  const resetEmojiAddView = () => {
    pendingEmojiUploadFile = null;
    fileDialogInProgress = false;
    suppressOutsideCloseUntil = 0;
    if (customEmojiFileInput) {
      customEmojiFileInput.value = '';
    }
    if (emojiNameInput) {
      emojiNameInput.value = '';
    }
    if (emojiVisibilityInput) {
      emojiVisibilityInput.value = 'private';
    }
    if (emojiFileName) {
      emojiFileName.value = '';
    }
    if (emojiPreviewObjectUrl) {
      URL.revokeObjectURL(emojiPreviewObjectUrl);
      emojiPreviewObjectUrl = '';
    }
    if (emojiPreviewImg) {
      emojiPreviewImg.src = '';
    }
    if (emojiPreviewBox) {
      emojiPreviewBox.hidden = true;
    }
    if (emojiUploadBtn) {
      emojiUploadBtn.disabled = true;
      emojiUploadBtn.textContent = 'Upload';
      emojiUploadBtn.classList.remove('is-loading');
    }
    setEmojiUploadError('');
    setEmojiUploadStatus('');
  };

  const updateEmojiUploadEnabled = () => {
    const file = pendingEmojiUploadFile;
    const raw = String(emojiNameInput?.value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32);
    if (emojiNameInput && emojiNameInput.value !== raw) {
      emojiNameInput.value = raw;
    }
    const duplicate = customEmojiLibrary.has(tokenForName(raw));
    const valid = Boolean(file && raw.length >= 2 && raw.length <= 32 && !duplicate);
    if (emojiUploadBtn) {
      emojiUploadBtn.disabled = !valid;
    }
    if (duplicate) {
      setEmojiUploadError('Name already exists.');
    } else {
      setEmojiUploadError('');
    }
    if (!duplicate && valid) {
      setEmojiUploadStatus('Ready to upload');
    } else if (!emojiUploadBtn?.disabled) {
      setEmojiUploadStatus('');
    } else {
      setEmojiUploadStatus('');
    }
  };

  const openEmojiAddView = () => {
    if (emojiBrowseView) {
      emojiBrowseView.hidden = true;
    }
    if (emojiAddView) {
      emojiAddView.hidden = false;
    }
    resetEmojiAddView();
    emojiNameInput?.focus();
  };

  const closeEmojiAddView = () => {
    if (emojiAddView) {
      emojiAddView.hidden = true;
    }
    if (emojiBrowseView) {
      emojiBrowseView.hidden = false;
    }
    resetEmojiAddView();
  };

  emojiAddBtn?.addEventListener('click', () => {
    openEmojiAddView();
  });

  emojiChooseFileBtn?.addEventListener('click', () => {
    fileDialogInProgress = true;
    suppressOutsideCloseUntil = Date.now() + 1500;
    customEmojiFileInput?.click();
  });

  customEmojiFileInput?.addEventListener('change', () => {
    fileDialogInProgress = false;
    suppressOutsideCloseUntil = Date.now() + 350;
    const nextFile = customEmojiFileInput.files?.[0];
    if (!nextFile) {
      return;
    }
    pendingEmojiUploadFile = nextFile;
    if (emojiFileName) {
      emojiFileName.value = pendingEmojiUploadFile.name;
    }
    if (emojiPreviewObjectUrl) {
      URL.revokeObjectURL(emojiPreviewObjectUrl);
      emojiPreviewObjectUrl = '';
    }
    if (pendingEmojiUploadFile) {
      emojiPreviewObjectUrl = URL.createObjectURL(pendingEmojiUploadFile);
      if (emojiPreviewImg) {
        emojiPreviewImg.src = emojiPreviewObjectUrl;
      }
      if (emojiPreviewBox) {
        emojiPreviewBox.hidden = false;
      }
    } else if (emojiPreviewBox) {
      emojiPreviewBox.hidden = true;
    }
    updateEmojiUploadEnabled();
  });

  emojiUploadCancelBtn?.addEventListener('click', () => {
    closeEmojiAddView();
  });

  emojiNameInput?.addEventListener('input', updateEmojiUploadEnabled);

  emojiUploadBtn?.addEventListener('click', async () => {
    const file = pendingEmojiUploadFile;
    const name = String(emojiNameInput?.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
    const visibility = String(emojiVisibilityInput?.value || 'private') === 'public' ? 'public' : 'private';
    if (!file || !name) {
      setEmojiUploadError('Datei und Name erforderlich.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setEmojiUploadError('Emoji zu groß (max 1MB).');
      return;
    }
    if (!['image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setEmojiUploadError('Nur PNG/WEBP/GIF erlaubt.');
      return;
    }

    setEmojiUploadError('');
    setEmojiUploadStatus('Uploading...', 'run');
    emojiUploadBtn.disabled = true;
    emojiUploadBtn.textContent = 'Uploading...';
    emojiUploadBtn.classList.add('is-loading');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch('/app/home/emoji', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          name,
          mimeType: file.type,
          url: dataUrl,
          visibility
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.emoji) {
        const err = new Error(payload.error || 'Emoji Upload fehlgeschlagen.');
        err.payload = payload;
        throw err;
      }
      const token = tokenForName(payload.emoji.name);
      customEmojiLibrary.set(token, {
        id: Number(payload.emoji.id),
        userId: Number(payload.emoji.user_id || 0),
        name: payload.emoji.name,
        url: payload.emoji.url,
        token,
        visibility: String(payload.emoji.visibility || 'private') === 'public' ? 'public' : 'private'
      });
      renderEmojiBrowser();
      insertCustomEmojiToken(payload.emoji);
      if (emojiNameInput) {
        emojiNameInput.value = '';
      }
      if (customEmojiFileInput) {
        customEmojiFileInput.value = '';
      }
      setEmojiUploadStatus('Emoji added.', 'ok');
      showToast('Emoji hinzugefügt');
      closeEmojiAddView();
    } catch (error) {
      const payload = error?.payload || {};
      if (payload.suggestedName && emojiNameInput) {
        emojiNameInput.value = payload.suggestedName;
      }
      setEmojiUploadError(error.message || 'Emoji Upload fehlgeschlagen.');
      setEmojiUploadStatus('Upload failed.');
      showToast(error.message || 'Emoji Upload fehlgeschlagen.', 'error');
    } finally {
      emojiUploadBtn.textContent = 'Upload';
      emojiUploadBtn.classList.remove('is-loading');
      updateEmojiUploadEnabled();
    }
  });

  emojiPopover?.addEventListener('contextmenu', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const itemButton = target.closest('[data-emoji-key]');
    if (!(itemButton instanceof HTMLElement)) {
      closeEmojiItemMenu();
      return;
    }

    event.preventDefault();
    openEmojiItemContextMenu(event, itemButton);
  });

  emojiSectionScroll?.addEventListener('scroll', () => {
    closeEmojiItemMenu();
  });

  emojiSectionMount?.addEventListener('pointerdown', (event) => {
    if (event.button !== 2) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const itemButton = target.closest('[data-emoji-key]');
    if (!(itemButton instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    openEmojiItemContextMenu(event, itemButton);
  });

  document.addEventListener('click', (event) => {
    if (!emojiPopover || emojiPopover.hidden) {
      return;
    }
    if (fileDialogInProgress || Date.now() < suppressOutsideCloseUntil) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const withinPopover = eventPathIncludes(event, emojiPopover);
    const withinMenu = eventPathIncludes(event, emojiItemMenu);
    const withinPreview = eventPathIncludes(event, emojiPreviewOverlay);
    if (!withinPopover && target !== emojiBtn && !withinMenu && !withinPreview) {
      setEmojiOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !emojiPopover || emojiPopover.hidden) {
      return;
    }
    if (emojiItemMenu && !emojiItemMenu.hidden) {
      closeEmojiItemMenu();
      return;
    }
    setEmojiOpen(false);
  });

  window.addEventListener('resize', () => {
    if (!emojiPopover?.hidden) {
      positionEmojiPopover();
    } else {
      closeEmojiPreviewOverlay();
    }
    closeEmojiItemMenu();
  });
  const gifTags = [];

  const renderDeletedGifPlaceholder = (gif = {}) => `
    <div class="msg-attachment media deleted-gif-card" data-message-gif-id="${escapeHtml(String(gif.id || 0))}" data-gif-deleted="1">
      <div class="deleted-gif-placeholder">
        <strong>GIF deleted</strong>
        <span>${escapeHtml(String(gif.name || 'Removed from library'))}</span>
      </div>
    </div>
  `;

  const closeGifItemMenu = () => {
    hideFloatingNode(gifItemMenu);
    gifItemMenu.innerHTML = '';
    gifItemMenuMeta = null;
  };

  const closeGifPreviewOverlay = () => {
    hideFloatingNode(gifPreviewOverlay);
    gifPreviewAnchor = null;
  };

  const normalizeGifPickerEntry = (item, section = null) => {
    const source = String(item?.source || '') === 'mine' || Number(item?.owner_id || 0) === currentUserId ? 'mine' : 'global';
    return {
      id: Number(item?.id || 0),
      name: String(item?.name || 'GIF'),
      tags: String(item?.tags || ''),
      description: String(item?.description || ''),
      mimeType: String(item?.mime_type || item?.mimeType || 'image/gif'),
      url: String(item?.url || ''),
      previewUrl: String(item?.previewUrl || item?.url || ''),
      ownerId: Number(item?.owner_id || item?.ownerId || 0),
      ownerDisplayName: String(item?.owner_display_name || item?.ownerDisplayName || ''),
      ownerUsername: String(item?.owner_username || item?.ownerUsername || ''),
      source,
      sourceLabel: source === 'mine' ? 'My Uploads' : 'Global Library',
      sectionId: String(section?.id || ''),
      sectionLabel: String(section?.label || ''),
      canDelete: Number(item?.owner_id || item?.ownerId || 0) === currentUserId || canManageGifLibrary
    };
  };

  const applyGifSectionsPayload = (payload) => {
    applyGifStatePayload(payload);
    gifSectionsData = Array.isArray(payload?.sections)
      ? payload.sections.map((section) => ({
        id: String(section?.id || '').trim(),
        label: String(section?.label || '').trim() || 'GIFs',
        items: Array.isArray(section?.items)
          ? section.items.map((item) => normalizeGifPickerEntry(item, section)).filter((item) => item.id && item.url)
          : []
      })).filter((section) => section.id && section.items.length)
      : [];
  };

  const resolveGifEntry = (gifId) => {
    const safeId = Number(gifId);
    if (!safeId) {
      return null;
    }

    for (const section of gifSectionsData) {
      const match = section.items.find((item) => item.id === safeId);
      if (match) {
        return match;
      }
    }
    return null;
  };

  const renderGifPreviewOverlay = (entry, anchor = null) => {
    closeGifPreviewOverlay();
  };

  const setGifPreviewState = (entry, anchor = null) => {
    gifPreviewState = entry || null;
    closeGifPreviewOverlay();
  };

  const openGifItemContextMenu = (event, gifTarget) => {
    if (!(gifTarget instanceof HTMLElement)) {
      closeGifItemMenu();
      return;
    }

    closeEmojiItemMenu();
    const entry = resolveGifEntry(Number(gifTarget.dataset.gifId || 0));
    if (!entry) {
      closeGifItemMenu();
      return;
    }

    suppressGifSelectionUntil = Date.now() + 400;
    suppressGifSelectionId = entry.id;
    gifItemMenuMeta = entry;
    const isFavorite = favoriteGifIds.includes(entry.id);
    const deleteDisabled = !entry.canDelete;
    gifItemMenu.innerHTML = [
      `<button type="button" class="message-context-item" data-gif-menu-action="favorite">${isFavorite ? 'Unfavorite' : 'Favorite'}</button>`,
      '<button type="button" class="message-context-item" data-gif-menu-action="copy">Copy GIF Link</button>',
      '<button type="button" class="message-context-item" data-gif-menu-action="open">Open in new tab</button>',
      `<button type="button" class="message-context-item danger ${deleteDisabled ? 'is-disabled' : ''}" data-gif-menu-action="delete" ${deleteDisabled ? 'disabled title="Missing permission"' : ''}>Delete GIF</button>`
    ].join('');
    positionFloatingNode(gifItemMenu, {
      left: event.clientX,
      right: event.clientX,
      top: event.clientY,
      bottom: event.clientY,
      width: 1,
      height: 1
    }, 'right');
  };

  const updateGifTabs = () => {
    const activeId = gifTab === 'add' ? 'add' : gifActiveCategory;
    gifTabs?.querySelectorAll('[data-gif-tab]').forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      button.classList.toggle('active-chip', button.dataset.gifTab === activeId);
    });
  };

  const renderGifItem = (entry) => `
    <button
      type="button"
      class="gif-item"
      data-testid="${contextFieldName === 'channelId' ? 'server' : 'dm'}-gif-result-item"
      data-gif-id="${entry.id}"
      data-gif-url="${escapeHtml(entry.url)}"
      data-gif-preview-url="${escapeHtml(entry.previewUrl || entry.url)}"
      data-gif-label="${escapeHtml(entry.name || 'GIF')}"
      data-gif-tags="${escapeHtml(entry.tags || '')}"
      data-gif-mime-type="${escapeHtml(entry.mimeType)}"
      data-gif-source="${escapeHtml(entry.source)}"
      data-gif-owner-id="${entry.ownerId}"
      data-gif-can-delete="${entry.canDelete ? '1' : '0'}"
    >
      ${entry.mimeType.startsWith('video/')
        ? `<video src="${escapeHtml(entry.previewUrl || entry.url)}" muted loop autoplay playsinline></video>`
        : `<img src="${escapeHtml(entry.previewUrl || entry.url)}" alt="${escapeHtml(entry.name || 'GIF')}" loading="lazy" />`}
      <span>${escapeHtml(entry.name || 'GIF')}</span>
    </button>
  `;

  const renderGifSections = () => {
    if (!gifResults) {
      return;
    }

    if (!gifSectionsData.length) {
      gifResults.innerHTML = '<div class="cat-card empty">Keine GIFs gefunden.</div>';
      closeGifItemMenu();
      closeGifPreviewOverlay();
      updateGifTabs();
      return;
    }

    if (!gifSectionsData.some((section) => section.id === gifActiveCategory)) {
      gifActiveCategory = gifSectionsData[0].id;
    }

    gifResults.innerHTML = gifSectionsData.map((section) => `
      <section class="gif-section" id="gif-section-${escapeHtml(section.id)}" data-gif-section="${escapeHtml(section.id)}">
        <div class="emoji-section-head">
          <strong>${escapeHtml(section.label)}</strong>
          <span>${section.items.length}</span>
        </div>
        <div class="gif-grid">
          ${section.items.map((entry) => renderGifItem(entry)).join('')}
        </div>
      </section>
    `).join('');

    closeGifItemMenu();
    updateGifTabs();
    if (!gifPreviewState || !resolveGifEntry(gifPreviewState.id)) {
      setGifPreviewState(null);
    } else {
      setGifPreviewState(resolveGifEntry(gifPreviewState.id), gifPreviewAnchor);
    }
  };

  const scrollToGifSection = (sectionId) => {
    if (!gifSectionScroll || !gifResults) {
      return;
    }
    const nextSectionId = String(sectionId || '').trim();
    if (!nextSectionId) {
      return;
    }

    const target = gifResults.querySelector(`[data-gif-section="${nextSectionId}"]`);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.scrollIntoView({
      block: 'start',
      behavior: 'auto'
    });
    gifActiveCategory = nextSectionId;
    updateGifTabs();
  };

  const persistGifFavorites = async (gifId, favorite) => {
    const response = await fetch('/app/home/gifs/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        gifId,
        favorite
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Favorit konnte nicht gespeichert werden.');
    }
    applyGifStatePayload(payload);
  };

  const persistGifRecent = async (gifId) => {
    const response = await fetch('/app/home/gifs/recents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ gifId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      return;
    }
    applyGifStatePayload(payload);
  };

  const recordGifUsage = (gifId) => {
    const safeId = Number(gifId);
    if (!safeId) {
      return;
    }
    const nextRecents = [safeId, ...recentGifIds.filter((entry) => entry !== safeId)].slice(0, 24);
    replaceListContents(recentGifIds, nextRecents);
    renderGifSections();
    persistGifRecent(safeId).catch(() => {});
  };

  const removeDeletedGifFromMessages = (deletedGif) => {
    const safeId = Number(deletedGif?.id || 0);
    if (!safeId) {
      return;
    }

    document.querySelectorAll(`[data-message-gif-id="${safeId}"]`).forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      node.outerHTML = renderDeletedGifPlaceholder(deletedGif);
    });
  };

  const resetGifAddView = () => {
    pendingGifUploadFile = null;
    fileDialogInProgress = false;
    suppressOutsideCloseUntil = 0;
    if (gifUploadFileInput) {
      gifUploadFileInput.value = '';
    }
    if (gifNameInput) {
      gifNameInput.value = '';
    }
    gifTags.splice(0, gifTags.length);
    if (gifTagChips) {
      gifTagChips.innerHTML = '';
    }
    if (gifTagInput) {
      gifTagInput.value = '';
    }
    if (gifFileName) {
      gifFileName.value = '';
    }
    if (gifPreviewObjectUrl) {
      URL.revokeObjectURL(gifPreviewObjectUrl);
      gifPreviewObjectUrl = '';
    }
    if (gifPreviewImg) {
      gifPreviewImg.src = '';
      gifPreviewImg.hidden = true;
    }
    if (gifPreviewVideo) {
      gifPreviewVideo.src = '';
      gifPreviewVideo.hidden = true;
    }
    if (gifPreviewBox) {
      gifPreviewBox.hidden = true;
    }
    if (gifUploadBtn) {
      gifUploadBtn.disabled = true;
      gifUploadBtn.textContent = 'Upload';
      gifUploadBtn.classList.remove('is-loading');
    }
    setGifUploadError('');
    setGifUploadStatus('');
  };

  const renderGifTagChips = () => {
    if (!gifTagChips) {
      return;
    }
    gifTagChips.innerHTML = gifTags.map((tag) => `
      <button type="button" class="chip" data-remove-gif-tag="${escapeHtml(tag)}">${escapeHtml(tag)} ✕</button>
    `).join('');
  };

  const updateGifUploadEnabled = () => {
    const name = String(gifNameInput?.value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32);
    if (gifNameInput && gifNameInput.value !== name) {
      gifNameInput.value = name;
    }
    const valid = Boolean(pendingGifUploadFile && name.length >= 2 && name.length <= 32 && gifTags.length > 0);
    if (gifUploadBtn) {
      gifUploadBtn.disabled = !valid;
    }
    if (valid) {
      setGifUploadStatus('Ready to upload');
    } else {
      setGifUploadStatus('');
    }
  };

  const setGifTab = (nextTab) => {
    gifTab = nextTab;
    if (gifBrowseView) {
      gifBrowseView.hidden = nextTab === 'add';
    }
    if (gifAddView) {
      gifAddView.hidden = nextTab !== 'add';
    }
    if (gifSearchInput) {
      gifSearchInput.hidden = nextTab === 'add';
    }
    closeGifItemMenu();
    if (nextTab !== 'add') {
      resetGifAddView();
      gifActiveCategory = nextTab;
    }
    updateGifTabs();

    if (nextTab !== 'add') {
      fetchGifSections(gifSearchInput?.value || '').then(() => {
        scrollToGifSection(nextTab);
      });
    } else {
      resetGifAddView();
      closeGifPreviewOverlay();
      gifNameInput?.focus();
    }
  };

  const fetchGifSections = async (query = '') => {
    setGifSearchStatus('Loading...');
    try {
      const url = `/app/home/gifs?q=${encodeURIComponent(query.trim())}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      applyGifSectionsPayload(payload);
    } catch (error) {
      gifSectionsData = [];
      setGifSearchStatus('Laden fehlgeschlagen.');
      renderGifSections();
      return;
    }
    renderGifSections();
    if (!gifSectionsData.length) {
      setGifSearchStatus('Keine Treffer');
    } else {
      setGifSearchStatus('');
    }
  };

  const setGifModalOpen = (open) => {
    if (!gifModal) {
      return;
    }
    gifModal.hidden = !open;
    if (open) {
      if (emojiPopover && !emojiPopover.hidden) {
        setEmojiOpen(false);
      }
      closeEmojiItemMenu();
      closeEmojiPreviewOverlay();
      gifActiveCategory = 'global';
      setGifTab('global');
      gifSearchInput?.focus();
    } else if (gifSearchInput) {
      gifSearchInput.value = '';
      resetGifAddView();
      setGifSearchStatus('');
      closeGifItemMenu();
      closeGifPreviewOverlay();
    }
  };

  gifBtn?.addEventListener('click', () => {
    setGifModalOpen(Boolean(gifModal?.hidden));
  });

  gifItemMenu.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !gifItemMenuMeta) {
      return;
    }
    const menuAction = target.closest('[data-gif-menu-action]');
    if (!(menuAction instanceof HTMLElement) || !gifItemMenu.contains(menuAction)) {
      return;
    }

    event.stopPropagation();
    const action = String(menuAction.dataset.gifMenuAction || '');
    const entry = gifItemMenuMeta;
    closeGifItemMenu();

    if (action === 'favorite') {
      const shouldFavorite = !favoriteGifIds.includes(entry.id);
      try {
        await persistGifFavorites(entry.id, shouldFavorite);
        if (shouldFavorite) {
          gifActiveCategory = 'favorites';
        }
        await fetchGifSections(gifSearchInput?.value || '');
        if (shouldFavorite) {
          if (gifSectionScroll) {
            gifSectionScroll.scrollTop = 0;
          }
          scrollToGifSection('favorites');
        }
        showToast(shouldFavorite ? 'GIF zu Favoriten hinzugefugt.' : 'GIF-Favorit entfernt.');
      } catch (error) {
        showToast(error.message || 'Favorit konnte nicht gespeichert werden.', 'error');
      }
      return;
    }

    if (action === 'copy') {
      const copied = await copyText(entry.url);
      showToast(copied ? 'GIF-Link kopiert.' : 'GIF-Link konnte nicht kopiert werden.', copied ? 'ok' : 'error');
      return;
    }

    if (action === 'open') {
      window.open(entry.url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (action === 'delete') {
      if (!entry.canDelete) {
        showToast('Missing permission', 'error');
        return;
      }
      if (!window.confirm('GIF loschen? Wird aus Library entfernt.')) {
        return;
      }
      const response = await fetch(`/app/home/gifs/${entry.id}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          serverId: activeServerId || 0
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        showToast(payload.error || 'GIF konnte nicht geloscht werden.', 'error');
        return;
      }
      applyGifStatePayload(payload);
      if (selectedGif?.id === entry.id) {
        selectedGif = null;
        renderQueue();
      }
      removeDeletedGifFromMessages(payload.gif || entry);
      await fetchGifSections(gifSearchInput?.value || '');
      showToast('GIF geloscht.');
    }
  });

  gifModal?.addEventListener('click', (event) => {
    if (event instanceof MouseEvent && event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.dataset.closeGif === 'true') {
      setGifModalOpen(false);
      return;
    }

    const gifTarget = target.closest('[data-gif-url]');
    if (!(gifTarget instanceof HTMLElement)) {
      return;
    }
    const gifId = Number(gifTarget.dataset.gifId || 0);
    const gifUrl = gifTarget.dataset.gifUrl;
    const gifLabel = gifTarget.dataset.gifLabel;
    if (!gifUrl || !gifId) {
      return;
    }
    if (Date.now() < suppressGifSelectionUntil && suppressGifSelectionId === gifId) {
      return;
    }
    const entry = resolveGifEntry(gifId) || normalizeGifPickerEntry({
      id: gifId,
      url: gifUrl,
      previewUrl: String(gifTarget.dataset.gifPreviewUrl || gifUrl),
      name: gifLabel || 'GIF',
      tags: String(gifTarget.dataset.gifTags || ''),
      mime_type: String(gifTarget.dataset.gifMimeType || 'image/gif'),
      source: String(gifTarget.dataset.gifSource || 'global'),
      owner_id: Number(gifTarget.dataset.gifOwnerId || 0)
    });
    selectedGif = {
      id: gifId,
      url: gifUrl,
      label: gifLabel || 'GIF',
      mimeType: entry.mimeType
    };
    event.stopPropagation();
    renderQueue();
    recordGifUsage(gifId);
  });

  gifSearchInput?.addEventListener('input', () => {
    fetchGifSections(gifSearchInput.value);
  });

  const setGifUploadError = (message) => {
    if (!gifUploadError) {
      return;
    }
    gifUploadError.hidden = !message;
    gifUploadError.textContent = message || '';
  };

  const setGifUploadStatus = (message, tone = '') => {
    if (!gifUploadStatus) {
      return;
    }
    gifUploadStatus.hidden = !message;
    gifUploadStatus.textContent = message || '';
    gifUploadStatus.classList.remove('upload-status-ok', 'upload-status-run');
    if (tone === 'ok') {
      gifUploadStatus.classList.add('upload-status-ok');
    } else if (tone === 'run') {
      gifUploadStatus.classList.add('upload-status-run');
    }
  };

  const setGifSearchStatus = (message) => {
    if (!gifSearchStatus) {
      return;
    }
    gifSearchStatus.hidden = !message;
    gifSearchStatus.textContent = message || '';
  };

  gifTabs?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const tab = target.dataset.gifTab;
    if (!tab) {
      return;
    }
    if (tab !== 'add' && gifTab === 'add' && gifBrowseView) {
      gifBrowseView.hidden = false;
    }
    setGifTab(tab);
  });

  gifChooseFileBtn?.addEventListener('click', () => {
    fileDialogInProgress = true;
    suppressOutsideCloseUntil = Date.now() + 1500;
    gifUploadFileInput?.click();
  });

  gifUploadFileInput?.addEventListener('change', () => {
    fileDialogInProgress = false;
    suppressOutsideCloseUntil = Date.now() + 350;
    const nextFile = gifUploadFileInput.files?.[0];
    if (!nextFile) {
      return;
    }
    pendingGifUploadFile = nextFile;
    if (gifFileName) {
      gifFileName.value = pendingGifUploadFile.name;
    }
    if (gifPreviewObjectUrl) {
      URL.revokeObjectURL(gifPreviewObjectUrl);
      gifPreviewObjectUrl = '';
    }
    if (pendingGifUploadFile) {
      gifPreviewObjectUrl = URL.createObjectURL(pendingGifUploadFile);
      if (gifPreviewVideo && pendingGifUploadFile.type === 'video/mp4') {
        gifPreviewVideo.src = gifPreviewObjectUrl;
        gifPreviewVideo.hidden = false;
        if (gifPreviewImg) {
          gifPreviewImg.hidden = true;
        }
      } else if (gifPreviewImg) {
        gifPreviewImg.src = gifPreviewObjectUrl;
        gifPreviewImg.hidden = false;
        if (gifPreviewVideo) {
          gifPreviewVideo.hidden = true;
        }
      }
      if (gifPreviewBox) {
        gifPreviewBox.hidden = false;
      }
    } else if (gifPreviewBox) {
      gifPreviewBox.hidden = true;
    }
    updateGifUploadEnabled();
  });

  gifUploadCancelBtn?.addEventListener('click', () => {
    setGifTab('global');
  });

  gifNameInput?.addEventListener('input', updateGifUploadEnabled);

  gifTagInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const tag = gifTagInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
      if (!tag || gifTags.includes(tag) || gifTags.length >= 10) {
        gifTagInput.value = '';
        updateGifUploadEnabled();
        return;
      }
      gifTags.push(tag);
      gifTagInput.value = '';
      renderGifTagChips();
      updateGifUploadEnabled();
      return;
    }
    if (event.key === 'Backspace' && !gifTagInput.value && gifTags.length) {
      gifTags.pop();
      renderGifTagChips();
      updateGifUploadEnabled();
    }
  });

  gifTagChips?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const tag = target.dataset.removeGifTag;
    if (!tag) {
      return;
    }
    const idx = gifTags.indexOf(tag);
    if (idx >= 0) {
      gifTags.splice(idx, 1);
      renderGifTagChips();
      updateGifUploadEnabled();
    }
  });

  gifUploadBtn?.addEventListener('click', async () => {
    const file = pendingGifUploadFile;
    const name = String(gifNameInput?.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
    const tags = gifTags.join(',');
    if (!file || !name || !tags) {
      setGifUploadError('Datei + Name + Tags erforderlich.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setGifUploadError('GIF zu groß (max 15MB).');
      return;
    }
    if (!['image/gif', 'image/webp', 'video/mp4'].includes(file.type)) {
      setGifUploadError('Nur GIF/WEBP/MP4 erlaubt.');
      return;
    }

    setGifUploadStatus('Uploading...', 'run');
    gifUploadBtn.disabled = true;
    gifUploadBtn.textContent = 'Uploading...';
    gifUploadBtn.classList.add('is-loading');
    setGifUploadError('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch('/app/home/gifs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          name,
          tags,
          mimeType: file.type,
          url: dataUrl
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.gif) {
        const err = new Error(payload.error || 'GIF Upload fehlgeschlagen.');
        err.payload = payload;
        throw err;
      }
      selectedGif = {
        id: payload.gif.id,
        url: payload.gif.url,
        label: payload.gif.name,
        mimeType: String(payload.gif.mime_type || 'image/gif')
      };
      renderQueue();
      setGifUploadStatus('GIF added.', 'ok');
      showToast('GIF hinzugefügt');
      if (gifNameInput) {
        gifNameInput.value = '';
      }
      setGifTab('mine');
    } catch (error) {
      const payload = error?.payload || {};
      if (payload.suggestedName && gifNameInput) {
        gifNameInput.value = payload.suggestedName;
      }
      setGifUploadError(error.message || 'GIF Upload fehlgeschlagen.');
      setGifUploadStatus('Upload failed.');
      showToast(error.message || 'GIF Upload fehlgeschlagen.', 'error');
    } finally {
      gifUploadBtn.textContent = 'Upload';
      gifUploadBtn.classList.remove('is-loading');
      updateGifUploadEnabled();
    }
  });

  gifResults?.addEventListener('contextmenu', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const gifTarget = target.closest('[data-gif-id]');
    if (!(gifTarget instanceof HTMLElement)) {
      closeGifItemMenu();
      return;
    }

    event.preventDefault();
    const gifId = Number(gifTarget.dataset.gifId || 0);
    if (Date.now() < suppressGifContextMenuUntil && suppressGifContextMenuId === gifId) {
      return;
    }
    openGifItemContextMenu(event, gifTarget);
  });

  gifResults?.addEventListener('pointerdown', (event) => {
    if (event.button !== 2) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const gifTarget = target.closest('[data-gif-id]');
    if (!(gifTarget instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    suppressGifContextMenuUntil = Date.now() + 400;
    suppressGifContextMenuId = Number(gifTarget.dataset.gifId || 0);
    openGifItemContextMenu(event, gifTarget);
  });

  gifSectionScroll?.addEventListener('scroll', () => {
    closeGifItemMenu();
  });

  document.addEventListener('click', (event) => {
    if (!gifModal || gifModal.hidden) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const withinModal = eventPathIncludes(event, gifModal);
    const withinMenu = eventPathIncludes(event, gifItemMenu);
    const withinPreview = eventPathIncludes(event, gifPreviewOverlay);
    if (!withinModal && !withinMenu && !withinPreview && target !== gifBtn) {
      setGifModalOpen(false);
      return;
    }
    if (!withinModal && !withinMenu) {
      closeGifItemMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !gifModal || gifModal.hidden) {
      return;
    }
    if (!gifItemMenu.hidden) {
      closeGifItemMenu();
      return;
    }
    setGifModalOpen(false);
  });

  window.addEventListener('resize', () => {
    if (!gifModal?.hidden && gifPreviewState) {
      renderGifPreviewOverlay(gifPreviewState, gifPreviewAnchor);
    } else {
      closeGifPreviewOverlay();
    }
    closeGifItemMenu();
  });

  const syncNetworkState = () => {
    if (!networkState) {
      return;
    }
    if (navigator.onLine) {
      networkState.hidden = true;
      return;
    }
    networkState.hidden = false;
    networkState.textContent = 'Reconnecting...';
  };

  window.addEventListener('online', syncNetworkState);
  window.addEventListener('offline', syncNetworkState);
  syncNetworkState();

  const timeline = document.getElementById('timeline') || document.getElementById('serverTimeline');
  const contextType = contextFieldName === 'channelId' ? 'server' : 'dm';
  const contextDeleteAny = contextType === 'server'
    ? String(document.getElementById('serverContextCanModerate')?.value || document.querySelector('[data-testid="server-message"]')?.dataset.canDeleteAny || '0') === '1'
    : false;

  const escapeText = (value) => escapeHtml(String(value || ''));
  const currentReplyToMessageId = () => Number(replyToInput?.value || 0);
  const currentEditMessageId = () => Number(editMessageInput?.value || 0);

  const decodeMessageText = (value) => {
    try {
      return decodeURIComponent(String(value || ''));
    } catch (_error) {
      return String(value || '');
    }
  };

  const summarizeText = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      return 'Attachment';
    }
    return text.length > 96 ? `${text.slice(0, 93)}...` : text;
  };

  const renderReplyPreview = (replyMessage) => {
    if (!replyMessage || !replyMessage.id) {
      return '';
    }

    const author = escapeText(replyMessage.author_display_name || replyMessage.author_username || 'User');
    const snippet = replyMessage.missing
      ? 'Deleted message'
      : escapeText(summarizeText(replyMessage.content || 'Attachment'));

    return `
      <button type="button" class="msg-reply-preview" data-jump-to-message="${Number(replyMessage.id)}">
        <strong>${author}</strong>
        <span>${snippet}</span>
      </button>
    `;
  };

  const setComposerMode = ({ type = '', messageId = 0, author = '', preview = '', content = '' } = {}) => {
    const normalizedType = type === 'edit' ? 'edit' : (type === 'reply' ? 'reply' : '');
    if (!normalizedType) {
      if (replyToInput) {
        replyToInput.value = '';
      }
      if (editMessageInput) {
        editMessageInput.value = '';
      }
      if (composerModeBar) {
        composerModeBar.hidden = true;
      }
      textarea.placeholder = baseTextareaPlaceholder;
      syncSendButtonState();
      return;
    }

    const numericId = Number(messageId || 0);
    if (normalizedType === 'reply') {
      if (replyToInput) {
        replyToInput.value = numericId ? String(numericId) : '';
      }
      if (editMessageInput) {
        editMessageInput.value = '';
      }
    } else {
      if (editMessageInput) {
        editMessageInput.value = numericId ? String(numericId) : '';
      }
      if (replyToInput) {
        replyToInput.value = '';
      }
      attachments.clear();
      selectedGif = null;
      draftEmojiEntities.clear();
      renderQueue();
      textarea.value = String(content || '');
    }

    if (composerModeTitle) {
      composerModeTitle.textContent = normalizedType === 'edit'
        ? `Editing ${author || 'message'}`
        : `Replying to ${author || 'message'}`;
    }
    if (composerModePreview) {
      composerModePreview.textContent = summarizeText(preview || content || '');
    }
    if (composerModeBar) {
      composerModeBar.hidden = false;
    }
    textarea.placeholder = normalizedType === 'edit'
      ? 'Nachricht bearbeiten...'
      : baseTextareaPlaceholder;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    syncSendButtonState();
  };

  const renderSavedMessageNode = (message) => {
    const safeMessageId = Number(message.id || 0);
    const own = Number(message.author_id || 0) === Number(document.body?.dataset.currentUserId || 0);
    const hasText = String(message.content || '').trim().length > 0;
    const hasAttachments = (Array.isArray(message.attachments) && message.attachments.length)
      || (Array.isArray(message.gifs) && message.gifs.length);
    const replyHtml = renderReplyPreview(message.reply_to_message);
    const editedHtml = message.edited_at ? ' <span class="edited-mark">(edited)</span>' : '';

    return `
      ${renderAvatarCell({
        avatarUrl: message.author_avatar_url,
        displayName: message.author_display_name || 'Du',
        username: message.author_username || ''
      })}
      <div class="bubble">
        <div class="meta"><strong>${escapeText(message.author_display_name || 'Du')}</strong> <span>${escapeText(message.created_at || 'now')}${editedHtml}</span></div>
        ${replyHtml}
        ${renderMessageBubble(message)}
      </div>
    `;
  };

  const applySavedMessageMetadata = (node, message) => {
    if (!(node instanceof HTMLElement) || !message) {
      return;
    }

    const own = Number(message.author_id || 0) === Number(document.body?.dataset.currentUserId || 0);
    const hasText = String(message.content || '').trim().length > 0;
    const hasAttachments = (Array.isArray(message.attachments) && message.attachments.length)
      || (Array.isArray(message.gifs) && message.gifs.length);

    node.classList.remove('pending-msg', 'failed-msg', 'editing-msg');
    node.classList.toggle('own', own);
    node.id = `msg-${message.id}`;
    node.dataset.testid = messageTestId;
    node.dataset.messageId = String(message.id);
    node.dataset.authorId = String(message.author_id || 0);
    node.dataset.isOwn = own ? '1' : '0';
    node.dataset.contextType = contextType;
    node.dataset.contextId = String(contextIdInput?.value || '');
    node.dataset.canDeleteAny = contextDeleteAny ? '1' : '0';
    node.dataset.hasText = hasText ? '1' : '0';
    node.dataset.hasAttachments = hasAttachments ? '1' : '0';
    node.dataset.isSystemMessage = String(message.kind || 'text') === 'system' ? '1' : '0';
    node.dataset.messageText = encodeURIComponent(String(message.content || ''));
    node.dataset.emojiEntities = encodeURIComponent(JSON.stringify(message.emoji_entities || []));
    node.innerHTML = renderSavedMessageNode(message);
  };

  const replaceMessageWithDeletedPlaceholder = (messageId) => {
    const node = timeline?.querySelector(`[data-message-id="${messageId}"]`);
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.classList.remove('own', 'pending-msg', 'failed-msg', 'editing-msg');
    node.dataset.messageId = '';
    node.removeAttribute('data-message-id');
    node.removeAttribute('data-message-text');
    node.removeAttribute('data-has-text');
    node.removeAttribute('data-has-attachments');
    node.innerHTML = `
      <div class="avatar msg-avatar"><span class="avatar-fallback">×</span></div>
      <div class="bubble deleted-bubble">
        <div class="meta"><strong>Nachricht gelöscht</strong></div>
        <p class="msg-text deleted-copy">Diese Nachricht wurde gelöscht.</p>
      </div>
    `;
  };

  const renderInlineEmojis = (rawText, entities = []) => {
    const text = String(rawText || '');
    if (!text) {
      return '';
    }
    const unique = new Map();
    entities.forEach((entity) => {
      const token = String(entity.token || '').trim();
      if (!token) {
        return;
      }
      unique.set(token, entity);
    });

    let html = escapeText(text);
    unique.forEach((entity, token) => {
      if (!entity.url) {
        return;
      }
      const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(tokenEscaped, 'g');
      const knownEntry = resolveEmojiEntry(token);
      const sourceLabel = knownEntry?.type === 'unicode' ? 'Unicode' : 'Custom';
      const scopeLabel = knownEntry?.type === 'unicode'
        ? 'Global'
        : (knownEntry?.visibility === 'public' ? 'Server/Public' : (knownEntry?.visibility === 'private' ? 'Private' : 'Unknown'));
      const emojiName = String(entity.name || knownEntry?.label || token).trim() || token;
      const img = `<img class="inline-emoji" src="${escapeText(entity.url || '')}" alt="${escapeText(token)}" title="${escapeText(token)}" data-message-emoji-token="${escapeText(token)}" data-message-emoji-name="${escapeText(emojiName)}" data-message-emoji-url="${escapeText(entity.url || '')}" data-message-emoji-source="${escapeText(sourceLabel)}" data-message-emoji-scope="${escapeText(scopeLabel)}" />`;
      html = html.replace(regex, img);
    });
    if (unicodeEmojiPattern) {
      html = html.replace(unicodeEmojiPattern, (match) => {
        const entry = unicodeEmojiByKey.get(match);
        if (!entry) {
          return match;
        }
        const label = String(entry.label || entry.key || 'Emoji').trim() || 'Emoji';
        const shortcode = String(entry.shortcode || entry.key || label).trim() || label;
        return `<span class="inline-emoji inline-emoji-glyph" role="button" tabindex="0" title="${escapeText(shortcode)}" aria-label="${escapeText(label)}" data-message-emoji-token="${escapeText(entry.key)}" data-message-emoji-name="${escapeText(label)}" data-message-emoji-shortcode="${escapeText(shortcode)}" data-message-emoji-source="Unicode" data-message-emoji-scope="Global">${escapeText(entry.key)}</span>`;
      });
    }
    return html;
  };

  const fallbackAvatarToken = (displayName, username = '') => {
    const source = String(displayName || username || '?').trim();
    if (!source) {
      return '?';
    }
    return source.slice(0, 2).toUpperCase();
  };

  const renderAvatarCell = ({
    avatarUrl = '',
    displayName = '',
    username = ''
  }) => {
    const safeDisplayName = escapeText(displayName || username || 'User');
    const safeAvatarUrl = escapeText(String(avatarUrl || '').trim());
    const fallbackToken = escapeText(fallbackAvatarToken(displayName, username));
    if (safeAvatarUrl) {
      return `<div class="avatar msg-avatar"><img src="${safeAvatarUrl}" alt="${safeDisplayName}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" /><span class="avatar-fallback" hidden>${fallbackToken}</span></div>`;
    }
    return `<div class="avatar msg-avatar"><span class="avatar-fallback">${fallbackToken}</span></div>`;
  };

  const renderReactionRow = (reactions = []) => {
    if (!Array.isArray(reactions) || !reactions.length) {
      return '';
    }
    return `<div class="msg-reaction-row">${reactions.map((reaction) => {
      const emoji = escapeText(reaction.emoji || '');
      const count = Math.max(1, Number(reaction.count || 0));
      return `<button type="button" class="msg-reaction-chip" data-reaction-emoji="${emoji}" data-reaction-count="${count}"><span>${emoji}</span><small>${count}</small></button>`;
    }).join('')}</div>`;
  };

  const renderMessageBubble = ({ content, attachments: atts, emoji_entities: entities = [], gifs = [], reactions = [] }) => {
    const textHtml = String(content || '').trim() ? `<p class="msg-text">${renderInlineEmojis(content, entities)}</p>` : '';
    const attachmentHtml = Array.isArray(atts) && atts.length
      ? `<div class="msg-attachments">${atts.map((att) => {
        const url = escapeText(att.url || '');
        const name = escapeText(att.filename || 'attachment');
        const kind = String(att.kind || '').toLowerCase();
        const mime = String(att.mime_type || '').toLowerCase();
        if ((kind === 'image' || kind === 'gif' || mime.startsWith('image/')) && url) {
          return `<a class="msg-attachment media" href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${name}" loading="lazy" /></a>`;
        }
        if ((kind === 'video' || mime.startsWith('video/')) && url) {
          return `<video class="msg-video" controls preload="metadata"><source src="${url}" type="${escapeText(att.mime_type || 'video/mp4')}" /></video>`;
        }
        return `<a class="msg-attachment file" href="${url}" target="_blank" rel="noopener noreferrer"><strong>${name}</strong><span>${formatBytes(Number(att.file_size || 0))}</span></a>`;
      }).join('')}</div>`
      : '';
    const gifHtml = Array.isArray(gifs) && gifs.length
      ? `<div class="msg-attachments">${gifs.map((gif) => {
        if (gif.deleted || !gif.url) {
          return renderDeletedGifPlaceholder(gif);
        }
        const url = escapeText(gif.url || '');
        const name = escapeText(gif.name || 'gif');
        const tags = escapeText(String(gif.tags || ''));
        const source = escapeText(String(gif.source || gif.sourceLabel || 'Message'));
        return `<a class="msg-attachment media" data-message-gif-id="${escapeText(String(gif.id || 0))}" data-message-gif-name="${name}" data-message-gif-tags="${tags}" data-message-gif-source="${source}" href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${name}" loading="lazy" /></a>`;
      }).join('')}</div>`
      : '';
    const reactionHtml = renderReactionRow(reactions);

    return `${textHtml}${attachmentHtml}${gifHtml}${reactionHtml}`;
  };

  const createPendingMessageNode = (payload, id) => {
    if (!timeline) {
      return null;
    }
    const node = document.createElement('article');
    node.className = 'msg own pending-msg';
    node.dataset.testid = messageTestId;
    node.dataset.pendingId = String(id);
    node.dataset.emojiEntities = encodeURIComponent(JSON.stringify(payload.emoji_entities || []));
    node.innerHTML = `
      ${renderAvatarCell({ avatarUrl: currentAvatarUrl, displayName: currentDisplayName })}
      <div class="bubble">
        <div class="meta"><strong>Du</strong> <span>wird gesendet…</span></div>
        ${renderMessageBubble(payload)}
      </div>
    `;
    timeline.appendChild(node);
    timeline.scrollTop = timeline.scrollHeight;
    return node;
  };

  const setPendingFailed = (node, errorText) => {
    if (!node) {
      return;
    }
    node.classList.add('failed-msg');
    const bubble = node.querySelector('.bubble');
    if (!bubble) {
      return;
    }
    bubble.insertAdjacentHTML(
      'beforeend',
      `<div class="pending-actions"><span class="sub">${escapeText(errorText)}</span><button type="button" class="chip" data-retry-pending="${node.dataset.pendingId}">Retry</button><button type="button" class="chip danger" data-delete-pending="${node.dataset.pendingId}">Delete</button></div>`
    );
  };

  const replacePendingWithSaved = (node, message) => {
    if (!node || !message) {
      return;
    }
    node.removeAttribute('data-pending-id');
    applySavedMessageMetadata(node, message);
  };

  const appendSavedMessageNode = (message) => {
    if (!timeline || !message) {
      return null;
    }
    const node = document.createElement('article');
    node.className = 'msg';
    timeline.appendChild(node);
    applySavedMessageMetadata(node, message);
    timeline.scrollTop = timeline.scrollHeight;
    return node;
  };

  const applyReactionListToMessage = (messageId, reactions = []) => {
    const numericMessageId = Number(messageId || 0);
    if (!numericMessageId) {
      return;
    }
    const node = timeline?.querySelector(`[data-message-id="${numericMessageId}"]`);
    const bubble = node?.querySelector('.bubble');
    if (!(bubble instanceof HTMLElement)) {
      return;
    }
    bubble.querySelector('.msg-reaction-row')?.remove();
    const reactionHtml = renderReactionRow(reactions);
    if (reactionHtml) {
      bubble.insertAdjacentHTML('beforeend', reactionHtml);
    }
  };

  const createAiPendingNode = (replyToMessageId) => {
    if (!timeline) {
      return null;
    }
    const node = document.createElement('article');
    node.className = 'msg ai-pending-msg';
    node.dataset.testid = messageTestId;
    node.dataset.aiPendingReplyTo = String(replyToMessageId);
    node.innerHTML = `
      ${renderAvatarCell({ avatarUrl: aiAvatarUrl, displayName: aiDisplayName, username: 'sokrates' })}
      <div class="bubble">
        <div class="meta"><strong>${escapeText(aiDisplayName)}</strong> <span data-ai-status-label>antwortet…</span></div>
        <p class="msg-text" data-ai-pending-copy>Antwort wird generiert…</p>
        <div class="pending-actions">
          <button type="button" class="chip danger" data-delete-ai-pending="${replyToMessageId}">Cancel</button>
        </div>
      </div>
    `;
    timeline.appendChild(node);
    timeline.scrollTop = timeline.scrollHeight;
    return node;
  };

  const clearAiRetryCooldown = (state) => {
    if (!state) {
      return;
    }
    if (state.cooldownTimer) {
      window.clearInterval(state.cooldownTimer);
      state.cooldownTimer = 0;
    }
    state.retryBlockedUntil = 0;
  };

  const updateAiRetryButtonState = (state) => {
    if (!state?.node || !(state.node instanceof HTMLElement) || !state.node.isConnected) {
      clearAiRetryCooldown(state);
      return;
    }

    const retryButton = state.node.querySelector(`[data-retry-ai-pending="${state.replyToMessageId}"]`);
    if (!(retryButton instanceof HTMLButtonElement)) {
      clearAiRetryCooldown(state);
      return;
    }

    const remainingMs = Math.max(0, Number(state.retryBlockedUntil || 0) - Date.now());
    if (remainingMs > 0) {
      retryButton.disabled = true;
      retryButton.textContent = `Erneut in ${Math.max(1, Math.ceil(remainingMs / 1000))} s`;
      syncSendButtonState();
      return;
    }

    retryButton.disabled = false;
    retryButton.textContent = 'Retry';
    clearAiRetryCooldown(state);
    syncSendButtonState();
  };

  const startAiRetryCooldown = (state, waitMs) => {
    if (!state) {
      return;
    }

    clearAiRetryCooldown(state);
    state.retryBlockedUntil = Date.now() + Math.max(1000, Number(waitMs || 0));
    updateAiRetryButtonState(state);
    state.cooldownTimer = window.setInterval(() => {
      updateAiRetryButtonState(state);
    }, 250);
  };

  const replaceAiPendingWithSaved = (node, message) => {
    if (!node || !message) {
      return;
    }
    const numericMessageId = Number(message.id || 0);
    if (numericMessageId) {
      const existingNode = timeline.querySelector(`[data-message-id="${numericMessageId}"]:not(.ai-pending-msg)`);
      if (existingNode instanceof HTMLElement && existingNode !== node) {
        applySavedMessageMetadata(existingNode, message);
        node.remove();
        timeline.scrollTop = timeline.scrollHeight;
        return;
      }
    }
    node.classList.remove('ai-pending-msg');
    node.removeAttribute('data-ai-pending-reply-to');
    applySavedMessageMetadata(node, message);
    timeline.scrollTop = timeline.scrollHeight;
  };

  const formatAiStatusLabel = (error) => {
    const code = String(error?.code || 'PROVIDER_ERROR');
    if (error?.activeMode === 'auto' && error?.fallbackReason && error?.retryable === false) {
      return 'Nicht verfügbar';
    }
    if (code === 'RATE_LIMIT') {
      return 'Wartezeit aktiv';
    }
    if (code === 'QUOTA') {
      return 'Kontingent erschöpft';
    }
    if (code === 'CONFIG_ERROR') {
      return 'Nicht verfügbar';
    }
    if (code === 'TIMEOUT') {
      return 'Zeitüberschreitung';
    }
    if (code === 'VALIDATION_ERROR') {
      return 'Anfragefehler';
    }
    return 'Fehler';
  };

  const formatAiErrorBody = (error) => {
    return String(error?.message || 'Sokrates ist vorübergehend nicht verfügbar.');
  };

  const setAiPendingFailed = (node, pendingKey, error, state) => {
    if (!node) {
      return;
    }
    node.classList.remove('ai-pending-msg');
    node.classList.add('failed-msg');
    const bubble = node.querySelector('.bubble');
    if (!bubble) {
      return;
    }
    const statusLabel = bubble.querySelector('[data-ai-status-label]');
    const copyNode = bubble.querySelector('[data-ai-pending-copy]');
    if (statusLabel) {
      statusLabel.textContent = formatAiStatusLabel(error);
    }
    if (copyNode) {
      copyNode.textContent = formatAiErrorBody(error);
    }
    if (error?.detail) {
      node.dataset.aiDebugDetail = String(error.detail);
    } else {
      delete node.dataset.aiDebugDetail;
    }
    bubble.querySelector('.pending-actions')?.remove();
    const retryButton = error?.retryable !== false
      ? `<button type="button" class="chip" data-retry-ai-pending="${pendingKey}">Retry</button>`
      : '';
    bubble.insertAdjacentHTML(
      'beforeend',
      `<div class="pending-actions" data-ai-error-code="${escapeText(String(error?.code || 'PROVIDER_ERROR'))}">
        ${retryButton}
        <button type="button" class="chip danger" data-delete-ai-pending="${pendingKey}">Cancel</button>
      </div>`
    );

    if (state && error?.code === 'RATE_LIMIT' && error?.retryable !== false) {
      startAiRetryCooldown(state, Math.max(1000, Number(error?.retryAfterMs || 0)));
    }
  };

  const buildAiRequestError = (response, data) => {
    const rawCode = String(data.code || 'PROVIDER_ERROR').trim();
    const normalizedCode = /quota/i.test(rawCode) ? 'QUOTA' : rawCode.toUpperCase();
    const error = new Error(data.message || 'Sokrates ist vorübergehend nicht verfügbar.');
    error.code = normalizedCode;
    error.status = Number(data.status || response.status || 503);
    error.reason = String(data.reason || response.statusText || 'Error');
    error.retryable = data.retryable !== false;
    error.detail = String(data.detail || '');
    error.requestId = String(data.requestId || '');
    error.retryAfterMs = Number(data.retryAfterMs || 0);
    error.provider = String(data.provider || '');
    error.activeMode = String(data.activeMode || '');
    error.fallbackReason = String(data.fallbackReason || '');
    return error;
  };

  const AI_REPLY_REQUEST_TIMEOUT_MS = 120000;

  const requestAiReply = async ({ threadId, replyToMessageId, idempotencyKey }, signal) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), AI_REPLY_REQUEST_TIMEOUT_MS);
    let onAbort = null;

    if (signal) {
      onAbort = () => controller.abort();
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    let response;
    try {
      response = await fetch('/app/home/ai-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ threadId, replyToMessageId, idempotencyKey }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError' && signal?.aborted) {
        throw error;
      }
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('Sokrates antwortet gerade nicht. Versuche es erneut.');
        timeoutError.code = 'TIMEOUT';
        timeoutError.status = 504;
        timeoutError.reason = 'Gateway Timeout';
        timeoutError.retryable = true;
        timeoutError.retryAfterMs = 1000;
        timeoutError.detail = `Client timeout after ${AI_REPLY_REQUEST_TIMEOUT_MS}ms`;
        throw timeoutError;
      }
      const networkError = new Error('Apeiron konnte den AI-Endpunkt nicht erreichen.');
      networkError.code = 'TIMEOUT';
      networkError.status = 503;
      networkError.reason = 'Service Unavailable';
      networkError.retryable = true;
      networkError.retryAfterMs = 1000;
      networkError.detail = String(error?.message || '').slice(0, 240);
      throw networkError;
    } finally {
      window.clearTimeout(timeoutId);
      if (signal && onAbort) {
        signal.removeEventListener('abort', onAbort);
      }
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.message) {
      throw buildAiRequestError(response, data);
    }
    return {
      message: data.message,
      provider: String(data.provider || data.selectedProvider || ''),
      activeMode: String(data.activeMode || ''),
      usedFallback: data.usedFallback === true,
      fallbackReason: String(data.fallbackReason || ''),
      aiError: data.aiError && typeof data.aiError === 'object' ? data.aiError : null
    };
  };

  const startAiRequest = async (pendingKey) => {
    const state = aiPendingRequests.get(pendingKey);
    if (!state || !state.node || state.inFlight) {
      return;
    }

    const { node } = state;
    clearAiRetryCooldown(state);
    const bubble = node.querySelector('.bubble');
    node.classList.remove('failed-msg');
    bubble?.querySelector('.pending-actions')?.remove();
    const statusLabel = bubble?.querySelector('[data-ai-status-label]');
    const copyNode = bubble?.querySelector('[data-ai-pending-copy]');
    if (statusLabel) {
      statusLabel.textContent = state.hasAttempted ? 'retrying…' : 'antwortet…';
    }
    if (copyNode) {
      copyNode.textContent = state.hasAttempted
        ? 'Vorherige Anfrage wird erneut gesendet…'
        : 'Antwort wird generiert…';
    }
    bubble?.insertAdjacentHTML(
      'beforeend',
      `<div class="pending-actions"><button type="button" class="chip danger" data-delete-ai-pending="${pendingKey}">Cancel</button></div>`
    );

    const controller = new AbortController();
    state.controller = controller;
    state.inFlight = true;

    try {
      const response = await requestAiReply(
        {
          threadId: state.threadId,
          replyToMessageId: state.replyToMessageId,
          idempotencyKey: state.idempotencyKey
        },
        controller.signal
      );
      replaceAiPendingWithSaved(node, response.message);
      clearAiRetryCooldown(state);
      aiPendingRequests.delete(pendingKey);
      setAiProviderBadge({
        provider: response.provider || aiSelectedProvider || 'openai',
        mode: response.activeMode || aiActiveMode || 'auto'
      });
      if (response.aiError) {
        const aiError = response.aiError;
        setAiAvailabilityBanner({ visible: false, code: '', message: '' });

        if (aiError.code === 'RATE_LIMIT' && Number(aiError.retryAfterMs || 0) > 0) {
          startAiComposerCooldown(
            aiError.retryAfterMs,
            toAiPersonaMessage(aiError)
          );
        } else if ((aiError.code === 'TIMEOUT' || aiError.code === 'PROVIDER_ERROR') && Number(aiError.retryAfterMs || 0) > 0) {
          startAiComposerCooldown(
            aiError.retryAfterMs,
            'Sokrates schweigt gerade. Bitte kurz warten.'
          );
        } else if (aiError.code === 'CONFIG_ERROR') {
          clearAiComposerCooldown();
          setAiComposerLockedState(true, toAiPersonaMessage(aiError));
          scheduleAiHealthPoll();
        } else if (aiError.code === 'QUOTA') {
          clearAiComposerCooldown();
          setAiComposerLockedState(true, toAiPersonaMessage(aiError));
          scheduleAiHealthPoll();
        } else if (aiError.code === 'TIMEOUT' || aiError.code === 'PROVIDER_ERROR') {
          const available = await pollAiHealth();
          if (!available && aiComposerLocked) {
            scheduleAiHealthPoll();
          } else if (available) {
            clearAiComposerCooldown();
            setAiComposerLockedState(false);
          }
        } else {
          clearAiComposerCooldown();
          setAiComposerLockedState(false);
        }
      } else if (response.usedFallback && response.provider === 'ollama') {
        clearAiComposerCooldown();
        setAiComposerLockedState(false);
        let shouldShowFallbackBanner = true;
        try {
          const storageKey = `apeiron.ai.fallback:${state.threadId}:${response.fallbackReason || 'fallback'}`;
          if (window.sessionStorage.getItem(storageKey)) {
            shouldShowFallbackBanner = false;
          } else {
            window.sessionStorage.setItem(storageKey, '1');
          }
        } catch (_error) {
          shouldShowFallbackBanner = true;
        }
        if (shouldShowFallbackBanner) {
          setAiAvailabilityBanner({
            visible: true,
            code: 'FALLBACK',
            message: 'OpenAI nicht verfügbar - nutze Ollama.'
          });
        }
      } else if (String(aiAvailabilityBanner?.dataset.aiAvailabilityCode || '') === 'FALLBACK') {
        clearAiComposerCooldown();
        setAiComposerLockedState(false);
        setAiAvailabilityBanner({ visible: false, code: '', message: '' });
      } else {
        clearAiComposerCooldown();
        setAiComposerLockedState(false);
      }
      hideHint();
    } catch (error) {
      if (error?.name === 'AbortError') {
        clearAiRetryCooldown(state);
        aiPendingRequests.delete(pendingKey);
        node.remove();
        hideHint();
        syncSendButtonState();
        return;
      }

      state.lastError = error;
      setAiProviderBadge({
        provider: error?.provider || aiSelectedProvider || 'openai',
        mode: error?.activeMode || aiActiveMode || 'auto'
      });
      setAiPendingFailed(node, pendingKey, {
        ...error,
        message: toAiPersonaMessage(error)
      }, state);
      setAiAvailabilityBanner({ visible: false, code: '', message: '' });
      hideHint();

      const errorCode = String(error?.code || '');
      if (errorCode === 'RATE_LIMIT' && Number(error?.retryAfterMs || 0) > 0) {
        startAiComposerCooldown(Number(error.retryAfterMs || 0), toAiPersonaMessage(error));
      } else if ((errorCode === 'TIMEOUT' || errorCode === 'PROVIDER_ERROR') && Number(error?.retryAfterMs || 0) > 0) {
        startAiComposerCooldown(Number(error.retryAfterMs || 0), 'Sokrates schweigt gerade. Bitte kurz warten.');
      } else if (errorCode === 'CONFIG_ERROR') {
        clearAiComposerCooldown();
        setAiComposerLockedState(true, toAiPersonaMessage(error));
        scheduleAiHealthPoll();
      } else if (errorCode === 'QUOTA') {
        clearAiComposerCooldown();
        setAiComposerLockedState(true, toAiPersonaMessage(error));
        scheduleAiHealthPoll();
      } else if (errorCode === 'TIMEOUT' || errorCode === 'PROVIDER_ERROR') {
        const available = await pollAiHealth();
        if (!available && aiComposerLocked) {
          scheduleAiHealthPoll();
        } else if (available) {
          clearAiComposerCooldown();
          setAiComposerLockedState(false);
        }
      } else {
        clearAiComposerCooldown();
        setAiComposerLockedState(false);
      }
    } finally {
      const latest = aiPendingRequests.get(pendingKey);
      if (latest) {
        latest.inFlight = false;
        latest.controller = null;
        latest.hasAttempted = true;
        syncSendButtonState();
      }
    }
  };

  const clearComposerPayload = () => {
    textarea.value = '';
    attachments.clear();
    selectedGif = null;
    draftEmojiEntities.clear();
    renderQueue();
  };

  const sendPayload = async (payload, pendingNode, pendingKey) => {
    const response = await fetch(form.getAttribute('action') || window.location.pathname, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Datei konnte nicht versendet werden.');
    }
    if (data.mode === 'edit') {
      replacePendingWithSaved(pendingNode, data.message);
      return;
    }

    replacePendingWithSaved(pendingNode, data.message);
    if (data.serverSokratesAction?.type === 'reaction') {
      applyReactionListToMessage(
        Number(data.serverSokratesAction.messageId || data.message?.id || 0),
        data.serverSokratesAction.reactions || []
      );
    } else if (data.serverSokratesAction?.type === 'text' && data.serverSokratesAction.message) {
      appendSavedMessageNode(data.serverSokratesAction.message);
    }
    if (isAiDmComposer && data.aiThread && data.aiReplyTargetMessageId) {
      const replyToMessageId = Number(data.aiReplyTargetMessageId || 0);
      if (replyToMessageId) {
        const existingState = aiPendingRequests.get(replyToMessageId);
        const aiPendingNode = existingState?.node?.isConnected
          ? existingState.node
          : createAiPendingNode(replyToMessageId);
        aiPendingRequests.set(replyToMessageId, {
          threadId: Number(payload.threadId || 0),
          replyToMessageId,
          idempotencyKey: String(data.aiIdempotencyKey || replyToMessageId),
          node: aiPendingNode,
          inFlight: false,
          controller: null,
          lastError: null,
          hasAttempted: false,
          retryBlockedUntil: 0,
          cooldownTimer: 0
        });
        syncSendButtonState();
        void startAiRequest(replyToMessageId);
      }
    }
    failedPendings.delete(pendingKey);
  };

  const buildSendPayload = () => {
    const content = textarea.value.trim();
    const emojiEntitiesPayload = [...draftEmojiEntities.values()]
      .filter((entity) => content.includes(entity.token))
      .map((entity) => ({ id: entity.id, token: entity.token }));

    return {
      [contextFieldName]: Number(contextIdInput?.value || 0),
      replyToMessageId: currentReplyToMessageId() || null,
      editMessageId: currentEditMessageId() || null,
      content,
      attachmentsPayload: buildAttachmentPayload(),
      gifPayload: hasGif() ? { gifId: selectedGif.id } : null,
      emojiEntitiesPayload
    };
  };

  form?.addEventListener('submit', async (event) => {
    if (submitInFlight) {
      event.preventDefault();
      return;
    }

    if (isAiDmComposer && aiComposerLocked) {
      event.preventDefault();
      showHint(aiComposerLockMessage || 'Sokrates ist derzeit nicht verfügbar.');
      return;
    }

    if (isAiDmComposer && hasOutstandingAiRequestForThread()) {
      event.preventDefault();
      showHint('Bitte schliesse zuerst die laufende Sokrates-Anfrage ab.');
      return;
    }

    if (!canSend()) {
      event.preventDefault();
      showHint('Bitte Text, Attachment oder GIF hinzufügen.');
      return;
    }

    event.preventDefault();
    const payload = buildSendPayload();
    const contextId = Number(payload[contextFieldName] || 0);
    const editMessageId = Number(payload.editMessageId || 0);
    if (!contextId) {
      showHint(contextFieldName === 'channelId' ? 'Channel nicht gefunden.' : 'Thread nicht gefunden.');
      return;
    }

    let currentPendingId = 0;
    let pendingNode = null;
    if (editMessageId) {
      pendingNode = timeline?.querySelector(`[data-message-id="${editMessageId}"]`) || null;
      if (!(pendingNode instanceof HTMLElement)) {
        showHint('Nachricht zum Bearbeiten wurde nicht gefunden.');
        return;
      }
      pendingNode.classList.add('editing-msg');
    } else {
      pendingId += 1;
      currentPendingId = pendingId;
      pendingNode = createPendingMessageNode(
        {
          content: payload.content,
          attachments: [...payload.attachmentsPayload, ...(selectedGif ? [{ url: selectedGif.url, kind: 'gif', mime_type: 'image/gif', file_size: 0, filename: `${selectedGif.label || 'gif'}.gif` }] : [])],
          emoji_entities: payload.emojiEntitiesPayload.map((entity) => {
            const byToken = customEmojiLibrary.get(entity.token);
            return {
              id: entity.id,
              token: entity.token,
              name: byToken?.name || '',
              url: byToken?.url || ''
            };
          })
        },
        currentPendingId
      );
    }

    if (!navigator.onLine) {
      showHint('Reconnecting...');
      if (pendingNode && !editMessageId) {
        setPendingFailed(pendingNode, 'Offline');
        failedPendings.set(currentPendingId, payload);
      }
      return;
    }

    sendBtn && (sendBtn.disabled = true);
    submitInFlight = true;
    try {
      await sendPayload(payload, pendingNode, currentPendingId);
      clearComposerPayload();
      setComposerMode();
      hideHint();
    } catch (error) {
      if (pendingNode && !editMessageId) {
        setPendingFailed(pendingNode, error.message || 'Datei konnte nicht versendet werden.');
        failedPendings.set(currentPendingId, payload);
      } else if (pendingNode instanceof HTMLElement) {
        pendingNode.classList.remove('editing-msg');
      }
      showHint(error.message || 'Datei konnte nicht versendet werden.');
    } finally {
      if (pendingNode instanceof HTMLElement && editMessageId) {
        pendingNode.classList.remove('editing-msg');
      }
      submitInFlight = false;
      syncSendButtonState();
    }
  });

  timeline?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const jumpTarget = target.closest('[data-jump-to-message]');
    if (jumpTarget instanceof HTMLElement) {
      const messageId = Number(jumpTarget.dataset.jumpToMessage || 0);
      if (messageId) {
        const destination = timeline.querySelector(`#msg-${messageId}`);
        if (destination instanceof HTMLElement) {
          destination.scrollIntoView({ block: 'center', behavior: 'smooth' });
          destination.classList.add('focus-hit');
          window.setTimeout(() => destination.classList.remove('focus-hit'), 1200);
        }
      }
      return;
    }

    const retryId = target.dataset.retryPending;
    if (retryId) {
      const key = Number(retryId);
      const payload = failedPendings.get(key);
      const node = timeline.querySelector(`[data-pending-id="${key}"]`);
      if (!payload || !(node instanceof HTMLElement)) {
        return;
      }
      if (!navigator.onLine) {
        showHint('Reconnecting...');
        return;
      }
      node.querySelector('.pending-actions')?.remove();
      node.classList.remove('failed-msg');
      try {
        await sendPayload(payload, node, key);
        hideHint();
      } catch (error) {
        setPendingFailed(node, error.message || 'Datei konnte nicht versendet werden.');
        showHint(error.message || 'Datei konnte nicht versendet werden.');
      }
      return;
    }

    const retryAiId = target.dataset.retryAiPending;
    if (retryAiId) {
      const key = Number(retryAiId);
      const state = aiPendingRequests.get(key);
      if (!state?.node || !(state.node instanceof HTMLElement) || state.inFlight) {
        return;
      }
      if (Number(state.retryBlockedUntil || 0) > Date.now()) {
        return;
      }
      if (!navigator.onLine) {
        showHint('Reconnecting...');
        return;
      }
      if (target instanceof HTMLButtonElement) {
        target.disabled = true;
      }
      try {
        await startAiRequest(key);
      } catch (error) {
        showHint(error.message || 'Sokrates ist vorübergehend nicht verfügbar.');
      }
      return;
    }

    const deleteId = target.dataset.deletePending;
    if (deleteId) {
      const key = Number(deleteId);
      failedPendings.delete(key);
      timeline.querySelector(`[data-pending-id="${key}"]`)?.remove();
      return;
    }

    const deleteAiId = target.dataset.deleteAiPending;
    if (deleteAiId) {
      const key = Number(deleteAiId);
      const state = aiPendingRequests.get(key);
      clearAiRetryCooldown(state);
      state?.controller?.abort();
      aiPendingRequests.delete(key);
      timeline.querySelector(`[data-ai-pending-reply-to="${key}"]`)?.remove();
      syncSendButtonState();
    }
  });

  composerClearModeBtn?.addEventListener('click', () => {
    setComposerMode();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (emojiPopover && !emojiPopover.hidden) {
      setEmojiOpen(false);
    }
    if (gifModal && !gifModal.hidden) {
      setGifModalOpen(false);
    }
  });

  textarea.addEventListener('input', () => {
    hideHint();
    syncSendButtonState();
  });

  const applyInlineEmojiRendering = () => {
    const textNodes = timeline?.querySelectorAll('.msg .msg-text') || [];
    textNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const article = node.closest('.msg');
      if (!(article instanceof HTMLElement)) {
        return;
      }
      const encoded = article.dataset.emojiEntities || '';
      let entities = [];
      if (encoded) {
        try {
          entities = JSON.parse(decodeURIComponent(encoded));
        } catch (error) {
          entities = [];
        }
      }
      const rawText = decodeMessageText(article.dataset.messageText || node.textContent || '');
      node.innerHTML = renderInlineEmojis(rawText, entities);
    });
  };

  readEmojiPreferencesFromDom();
  readLibraryFromDom();
  syncDraftEmojiEntitiesWithLibrary();
  renderEmojiBrowser();
  applyInlineEmojiRendering();
  renderQueue();
  if (isAiDmComposer && aiAvailabilityCode === 'CONFIG_ERROR') {
    scheduleAiHealthPoll();
  }
  window.__apeironMessageComposer = {
    setReply({ messageId, author, preview }) {
      setComposerMode({
        type: 'reply',
        messageId,
        author,
        preview
      });
    },
    setEdit({ messageId, author, content }) {
      setComposerMode({
        type: 'edit',
        messageId,
        author,
        content,
        preview: content
      });
    },
    clearMode() {
      setComposerMode();
    },
    showToast,
    refreshInlineEmojis() {
      applyInlineEmojiRendering();
    },
    getCustomEmojiMeta(token) {
      return resolveEmojiEntry(token);
    },
    getGifMeta(gifId) {
      return resolveGifEntry(gifId);
    },
    replaceDeleted(messageId) {
      replaceMessageWithDeletedPlaceholder(messageId);
    }
  };
  syncSendButtonState();
})();

(function initMessageContextMenu() {
  let menu = null;
  let activeMeta = null;
  let activeMessageId = 0;
  let openedAt = 0;
  let longPressTimer = 0;
  let longPressTarget = null;
  let longPressPointerId = '';
  let longPressPoint = null;
  let suppressNativeContextMenuUntil = 0;
  let suppressClickUntil = 0;
  let suppressClickMessageId = 0;
  let previewOverlay = null;
  let previewCard = null;
  let previewVisual = null;
  let previewTitle = null;
  let previewMeta = null;
  let previewTags = null;
  let previewPopover = null;
  let previewPopoverCard = null;
  let previewPopoverVisual = null;
  let previewPopoverTitle = null;
  let previewPopoverMeta = null;
  let previewPopoverTags = null;
  let previewPopoverMore = null;
  let previewPopoverAsset = null;
  let previewPopoverAnchor = null;
  let previewPopoverKey = '';
  const LONG_PRESS_DELAY_MS = 520;
  const LONG_PRESS_MOVE_TOLERANCE = 12;

  const escapeHtml = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const decodeMessageText = (value) => {
    try {
      return decodeURIComponent(String(value || ''));
    } catch (_error) {
      return String(value || '');
    }
  };

  const getComposerBridge = () => window.__apeironMessageComposer || null;

  const buildPreviewAssetKey = (asset) => {
    if (!asset || !asset.kind) {
      return '';
    }
    if (asset.kind === 'gif') {
      return `gif:${Number(asset.id || 0) || String(asset.url || '').trim()}`;
    }
    return `emoji:${String(asset.token || asset.shortcode || asset.name || '').trim()}`;
  };

  const resolvePreviewTrigger = (target) => {
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    const emojiTarget = target.closest('.inline-emoji');
    if (emojiTarget instanceof HTMLElement) {
      return emojiTarget;
    }
    const gifTarget = target.closest('.msg-attachment[href][data-message-gif-id]');
    if (gifTarget instanceof HTMLAnchorElement) {
      return gifTarget;
    }
    return null;
  };

  const ensurePreviewOverlay = () => {
    if (previewOverlay) {
      return previewOverlay;
    }

    previewOverlay = document.createElement('div');
    previewOverlay.className = 'chat-preview-overlay';
    previewOverlay.hidden = true;
    previewOverlay.dataset.testid = 'chat-preview-overlay';
    previewOverlay.setAttribute('role', 'dialog');
    previewOverlay.setAttribute('aria-modal', 'true');
    previewOverlay.setAttribute('aria-label', 'Asset preview');
    previewOverlay.innerHTML = `
      <button type="button" class="chat-preview-backdrop" data-chat-preview-close="backdrop" data-testid="chat-preview-backdrop" aria-label="Close preview"></button>
      <section class="chat-preview-card gradient-card" tabindex="-1">
        <div class="chat-preview-head">
          <strong class="chat-preview-title" data-chat-preview-title data-testid="chat-preview-title">Preview</strong>
          <button type="button" class="chip" data-chat-preview-close="button">Close</button>
        </div>
        <div class="chat-preview-visual" data-chat-preview-visual data-testid="chat-preview-visual"></div>
        <div class="chat-preview-meta" data-chat-preview-meta data-testid="chat-preview-meta"></div>
        <div class="chat-preview-tags" data-chat-preview-tags data-testid="chat-preview-tags" hidden></div>
      </section>
    `;
    document.body.appendChild(previewOverlay);

    previewCard = previewOverlay.querySelector('.chat-preview-card');
    previewVisual = previewOverlay.querySelector('[data-chat-preview-visual]');
    previewTitle = previewOverlay.querySelector('[data-chat-preview-title]');
    previewMeta = previewOverlay.querySelector('[data-chat-preview-meta]');
    previewTags = previewOverlay.querySelector('[data-chat-preview-tags]');

    previewOverlay.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.dataset.chatPreviewClose === 'backdrop' || target.dataset.chatPreviewClose === 'button') {
        closePreviewOverlay();
      }
    });

    return previewOverlay;
  };

  const closePreviewOverlay = () => {
    if (!previewOverlay) {
      return;
    }
    previewOverlay.hidden = true;
    if (previewVisual) {
      previewVisual.innerHTML = '';
    }
    if (previewMeta) {
      previewMeta.innerHTML = '';
    }
    if (previewTags) {
      previewTags.innerHTML = '';
      previewTags.hidden = true;
    }
  };

  const ensurePreviewPopover = () => {
    if (previewPopover) {
      return previewPopover;
    }

    previewPopover = document.createElement('div');
    previewPopover.className = 'chat-preview-popover';
    previewPopover.hidden = true;
    previewPopover.dataset.testid = 'chat-preview-popover';
    previewPopover.setAttribute('role', 'dialog');
    previewPopover.setAttribute('aria-modal', 'false');
    previewPopover.setAttribute('aria-label', 'Asset quick preview');
    previewPopover.innerHTML = `
      <section class="chat-preview-popover-card gradient-card">
        <div class="chat-preview-popover-visual" data-chat-preview-popover-visual data-testid="chat-preview-popover-visual"></div>
        <div class="chat-preview-popover-copy">
          <strong class="chat-preview-popover-title" data-chat-preview-popover-title data-testid="chat-preview-popover-title">Preview</strong>
          <div class="chat-preview-popover-meta" data-chat-preview-popover-meta data-testid="chat-preview-popover-meta"></div>
          <div class="chat-preview-popover-tags" data-chat-preview-popover-tags data-testid="chat-preview-popover-tags" hidden></div>
          <button type="button" class="chat-preview-more" data-chat-preview-more data-testid="chat-preview-more">More</button>
        </div>
      </section>
    `;
    document.body.appendChild(previewPopover);

    previewPopoverCard = previewPopover.querySelector('.chat-preview-popover-card');
    previewPopoverVisual = previewPopover.querySelector('[data-chat-preview-popover-visual]');
    previewPopoverTitle = previewPopover.querySelector('[data-chat-preview-popover-title]');
    previewPopoverMeta = previewPopover.querySelector('[data-chat-preview-popover-meta]');
    previewPopoverTags = previewPopover.querySelector('[data-chat-preview-popover-tags]');
    previewPopoverMore = previewPopover.querySelector('[data-chat-preview-more]');

    previewPopover.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.dataset.chatPreviewMore !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        const asset = previewPopoverAsset;
        closePreviewPopover();
        openPreviewOverlay(asset);
      }
    });

    return previewPopover;
  };

  const closePreviewPopover = () => {
    if (!previewPopover) {
      return;
    }
    previewPopover.hidden = true;
    previewPopoverAsset = null;
    previewPopoverAnchor = null;
    previewPopoverKey = '';
    if (previewPopoverVisual) {
      previewPopoverVisual.innerHTML = '';
    }
    if (previewPopoverTitle) {
      previewPopoverTitle.textContent = 'Preview';
    }
    if (previewPopoverMeta) {
      previewPopoverMeta.innerHTML = '';
    }
    if (previewPopoverTags) {
      previewPopoverTags.innerHTML = '';
      previewPopoverTags.hidden = true;
    }
    if (previewPopoverMore) {
      previewPopoverMore.textContent = 'More';
    }
  };

  const positionPreviewPopover = () => {
    if (!previewPopover || !previewPopoverCard || !previewPopoverAnchor) {
      return;
    }
    if (!(previewPopoverAnchor instanceof HTMLElement) || !document.body.contains(previewPopoverAnchor)) {
      closePreviewPopover();
      return;
    }

    const anchorRect = previewPopoverAnchor.getBoundingClientRect();
    previewPopover.hidden = false;
    previewPopover.style.left = '0px';
    previewPopover.style.top = '0px';
    const cardRect = previewPopoverCard.getBoundingClientRect();
    const padding = 8;
    const gap = 10;

    let left = anchorRect.left + ((anchorRect.width - cardRect.width) / 2);
    let top = anchorRect.bottom + gap;
    const canShowAbove = anchorRect.top - cardRect.height - gap >= padding;
    if (top + cardRect.height > window.innerHeight - padding && canShowAbove) {
      top = anchorRect.top - cardRect.height - gap;
    }

    left = Math.max(padding, Math.min(window.innerWidth - cardRect.width - padding, left));
    top = Math.max(padding, Math.min(window.innerHeight - cardRect.height - padding, top));
    previewPopover.style.left = `${left}px`;
    previewPopover.style.top = `${top}px`;
  };

  const openPreviewPopover = (asset, anchorNode) => {
    if (!asset || !asset.kind || !(anchorNode instanceof HTMLElement)) {
      return;
    }

    ensurePreviewPopover();
    if (!previewPopover || !previewPopoverVisual || !previewPopoverTitle || !previewPopoverMeta || !previewPopoverTags) {
      return;
    }

    previewPopoverAsset = asset;
    previewPopoverAnchor = anchorNode;
    previewPopoverKey = buildPreviewAssetKey(asset);
    previewPopoverTitle.textContent = String(
      asset.name
      || asset.shortcode
      || asset.token
      || (asset.kind === 'gif' ? 'GIF' : 'Emoji')
    ).trim() || (asset.kind === 'gif' ? 'GIF' : 'Emoji');

    if (asset.kind === 'gif') {
      const media = String(asset.mimeType || '').startsWith('video/')
        ? `<video src="${escapeHtml(String(asset.url || ''))}" autoplay loop muted playsinline></video>`
        : `<img src="${escapeHtml(String(asset.url || ''))}" alt="${escapeHtml(String(asset.name || 'GIF'))}" loading="lazy" />`;
      previewPopoverVisual.innerHTML = media;
      previewPopoverMeta.innerHTML = `<small>${escapeHtml(String(asset.source || 'Message'))}</small>`;
      const tags = Array.isArray(asset.tags)
        ? asset.tags.filter(Boolean)
        : String(asset.tags || '').split(',').map((tag) => String(tag || '').trim()).filter(Boolean);
      if (tags.length) {
        previewPopoverTags.hidden = false;
        previewPopoverTags.innerHTML = tags.slice(0, 3).map((tag) => `<span class="chat-preview-tag">#${escapeHtml(tag)}</span>`).join('');
      } else {
        previewPopoverTags.hidden = true;
        previewPopoverTags.innerHTML = '';
      }
    } else {
      const visual = String(asset.url || '').trim()
        ? `<img src="${escapeHtml(String(asset.url || ''))}" alt="${escapeHtml(String(asset.shortcode || asset.token || asset.name || 'Emoji'))}" loading="lazy" />`
        : `<span class="chat-preview-popover-glyph">${escapeHtml(String(asset.glyph || asset.token || '🙂'))}</span>`;
      previewPopoverVisual.innerHTML = visual;
      previewPopoverMeta.innerHTML = [
        asset.shortcode && asset.shortcode !== asset.name ? `<small>${escapeHtml(String(asset.shortcode))}</small>` : '',
        `<small>${escapeHtml(String(asset.source || 'Unicode'))}${asset.scope ? ` • ${escapeHtml(String(asset.scope))}` : ''}</small>`,
        asset.uploader ? `<small>Uploader: ${escapeHtml(String(asset.uploader))}</small>` : ''
      ].filter(Boolean).join('');
      previewPopoverTags.hidden = true;
      previewPopoverTags.innerHTML = '';
    }

    previewPopover.hidden = false;
    positionPreviewPopover();
  };

  const openPreviewOverlay = (asset) => {
    if (!asset || !asset.kind) {
      return;
    }

    closePreviewPopover();
    ensurePreviewOverlay();
    if (!previewOverlay || !previewCard || !previewVisual || !previewTitle || !previewMeta || !previewTags) {
      return;
    }

    const title = String(asset.title || (asset.kind === 'gif' ? 'GIF Preview' : 'Emoji Preview')).trim();
    previewOverlay.setAttribute('aria-label', title);
    previewTitle.textContent = title;

    if (asset.kind === 'gif') {
      const media = String(asset.mimeType || '').startsWith('video/')
        ? `<video src="${escapeHtml(String(asset.url || ''))}" autoplay loop muted playsinline controls></video>`
        : `<img src="${escapeHtml(String(asset.url || ''))}" alt="${escapeHtml(title)}" loading="lazy" />`;
      previewVisual.innerHTML = media;
      previewMeta.innerHTML = [
        `<span>${escapeHtml(String(asset.name || 'GIF'))}</span>`,
        `<small>${escapeHtml(String(asset.source || 'Message'))}</small>`
      ].join('');
      const tags = Array.isArray(asset.tags)
        ? asset.tags.filter(Boolean)
        : String(asset.tags || '').split(',').map((tag) => String(tag || '').trim()).filter(Boolean);
      if (tags.length) {
        previewTags.hidden = false;
        previewTags.innerHTML = tags.map((tag) => `<span class="chat-preview-tag">#${escapeHtml(tag)}</span>`).join('');
      } else {
        previewTags.hidden = true;
        previewTags.innerHTML = '';
      }
    } else {
      const visual = String(asset.url || '').trim()
        ? `<img src="${escapeHtml(String(asset.url || ''))}" alt="${escapeHtml(String(asset.token || title))}" loading="lazy" />`
        : `<span class="chat-preview-glyph">${escapeHtml(String(asset.glyph || asset.token || '🙂'))}</span>`;
      previewVisual.innerHTML = visual;
      previewMeta.innerHTML = [
        `<span>${escapeHtml(String(asset.name || asset.shortcode || asset.token || 'Emoji'))}</span>`,
        asset.shortcode && asset.shortcode !== asset.name ? `<small>${escapeHtml(String(asset.shortcode))}</small>` : '',
        `<small>${escapeHtml(String(asset.source || 'Unicode'))}${asset.scope ? ` • ${escapeHtml(String(asset.scope))}` : ''}</small>`,
        asset.uploader ? `<small>Uploader: ${escapeHtml(String(asset.uploader))}</small>` : ''
      ].filter(Boolean).join('');
      previewTags.hidden = true;
      previewTags.innerHTML = '';
    }

    previewOverlay.hidden = false;
    previewCard.focus?.();
  };

  const cancelLongPress = () => {
    if (longPressTimer) {
      window.clearTimeout(longPressTimer);
      longPressTimer = 0;
    }
    longPressTarget = null;
    longPressPointerId = '';
    longPressPoint = null;
  };

  const ensureMenu = () => {
    if (menu) {
      return menu;
    }

    menu = document.createElement('div');
    menu.className = 'message-context-menu gradient-card';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Message actions');
    menu.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const actionButton = target.closest('[data-message-action]');
      if (!(actionButton instanceof HTMLElement) || !menu.contains(actionButton)) {
        return;
      }

      const messageId = Number(menu.dataset.messageId || activeMessageId || 0);
      const meta = activeMeta || buildMetaForSourceNode(
        document.querySelector(`.msg[data-message-id="${messageId}"]`),
        {
          messageId,
          attachmentUrl: String(menu?.dataset.attachmentUrl || '')
        }
      );
      const action = String(actionButton.dataset.messageAction || '');
      const reactionValue = String(actionButton.dataset.reactionValue || '');

      closeMenu();
      if (action === 'react' && reactionValue) {
        addReactionToMessage(messageId, reactionValue);
        getComposerBridge()?.showToast('Reaktion hinzugefügt.');
        return;
      }

      try {
        await performAction(action, meta);
      } catch (_error) {
        getComposerBridge()?.showToast('Aktion fehlgeschlagen.', 'error');
      }
    });
    document.body.appendChild(menu);
    return menu;
  };

  const closeMenu = () => {
    if (!menu) {
      return;
    }
    menu.hidden = true;
    menu.innerHTML = '';
    activeMeta = null;
    activeMessageId = 0;
    openedAt = 0;
  };

  const copyToClipboard = async (value) => {
    const text = String(value || '');
    if (!text) {
      return false;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_error) {
      // Fallback below.
    }

    const probe = document.createElement('textarea');
    probe.value = text;
    probe.setAttribute('readonly', 'readonly');
    probe.style.position = 'fixed';
    probe.style.opacity = '0';
    document.body.appendChild(probe);
    probe.select();
    const copied = document.execCommand('copy');
    probe.remove();
    return copied;
  };

  const addReactionToMessage = (messageId, emoji) => {
    const node = document.querySelector(`.msg[data-message-id="${messageId}"]`);
    const bubble = node?.querySelector('.bubble');
    if (!(bubble instanceof HTMLElement)) {
      return;
    }

    let row = bubble.querySelector('.msg-reaction-row');
    if (!(row instanceof HTMLElement)) {
      row = document.createElement('div');
      row.className = 'msg-reaction-row';
      bubble.appendChild(row);
    }

    const safeSelectorValue = window.CSS && typeof window.CSS.escape === 'function'
      ? window.CSS.escape(String(emoji))
      : String(emoji).replace(/"/g, '\\"');
    const existing = row.querySelector(`[data-reaction-emoji="${safeSelectorValue}"]`);
    if (existing instanceof HTMLButtonElement) {
      const currentCount = Number(existing.dataset.reactionCount || 1) + 1;
      existing.dataset.reactionCount = String(currentCount);
      existing.innerHTML = `<span>${escapeHtml(emoji)}</span><small>${currentCount}</small>`;
      return;
    }

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'msg-reaction-chip';
    chip.dataset.reactionEmoji = String(emoji);
    chip.dataset.reactionCount = '1';
    chip.innerHTML = `<span>${escapeHtml(emoji)}</span><small>1</small>`;
    row.appendChild(chip);
  };

  const performAction = async (action, meta) => {
    const composer = getComposerBridge();
    const messageId = Number(meta.messageId || 0);
    if (!messageId) {
      return;
    }

    if (action === 'reply') {
      composer?.setReply({
        messageId,
        author: meta.authorLabel,
        preview: meta.messageText || 'Attachment'
      });
      return;
    }

    if (action === 'edit') {
      composer?.setEdit({
        messageId,
        author: meta.authorLabel,
        content: meta.messageText
      });
      return;
    }

    if (action === 'preview_emoji' || action === 'preview_gif') {
      openPreviewOverlay(meta.previewAsset);
      return;
    }

    if (action === 'copy_text') {
      const ok = await copyToClipboard(meta.messageText);
      composer?.showToast(ok ? 'Text kopiert.' : 'Text konnte nicht kopiert werden.', ok ? 'ok' : 'error');
      return;
    }

    if (action === 'copy_link') {
      const link = `${window.location.origin}${window.location.pathname}${window.location.search}#msg-${messageId}`;
      const ok = await copyToClipboard(link);
      composer?.showToast(ok ? 'Nachrichtenlink kopiert.' : 'Link konnte nicht kopiert werden.', ok ? 'ok' : 'error');
      return;
    }

    if (action === 'copy_attachment') {
      const ok = await copyToClipboard(meta.attachmentUrl);
      composer?.showToast(ok ? 'Attachment-Link kopiert.' : 'Link konnte nicht kopiert werden.', ok ? 'ok' : 'error');
      return;
    }

    if (action === 'delete') {
      if (!window.confirm('Diese Nachricht wirklich löschen?')) {
        return;
      }

      const response = await fetch(`/app/messages/${messageId}/delete`, {
        method: 'POST',
        headers: {
          Accept: 'application/json'
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        composer?.showToast(data.error || 'Nachricht konnte nicht gelöscht werden.', 'error');
        return;
      }
      composer?.replaceDeleted(messageId);
      composer?.showToast('Nachricht gelöscht.');
      return;
    }

    if (action === 'report') {
      const response = await fetch(`/app/messages/${messageId}/report`, {
        method: 'POST',
        headers: {
          Accept: 'application/json'
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        composer?.showToast(data.error || 'Nachricht konnte nicht gemeldet werden.', 'error');
        return;
      }
      composer?.showToast('Nachricht gemeldet.');
    }
  };

  const buildMenuHtml = (meta) => {
    const items = [];

    items.push('<div class="message-context-reactions"><button type="button" class="chip" data-message-action="react" data-reaction-value="👍">👍</button><button type="button" class="chip" data-message-action="react" data-reaction-value="❤️">❤️</button><button type="button" class="chip" data-message-action="react" data-reaction-value="👀">👀</button></div>');
    items.push('<button type="button" class="message-context-item" data-message-action="reply">Reply</button>');

    if (meta.previewAsset?.kind === 'emoji') {
      items.push('<button type="button" class="message-context-item" data-message-action="preview_emoji">Preview Emoji</button>');
    }

    if (meta.previewAsset?.kind === 'gif') {
      items.push('<button type="button" class="message-context-item" data-message-action="preview_gif">Preview GIF</button>');
    }

    if (meta.hasText) {
      items.push('<button type="button" class="message-context-item" data-message-action="copy_text">Copy Text</button>');
    }

    items.push('<button type="button" class="message-context-item" data-message-action="copy_link">Copy Message Link</button>');

    if (meta.attachmentUrl) {
      items.push('<button type="button" class="message-context-item" data-message-action="copy_attachment">Copy Attachment Link</button>');
    }

    if (meta.canEdit) {
      items.push('<div class="menu-divider"></div>');
      items.push('<button type="button" class="message-context-item" data-message-action="edit">Edit Message</button>');
    }

    if (meta.canDelete) {
      items.push(`<button type="button" class="message-context-item danger" data-message-action="delete">${meta.isOwn ? 'Delete Message' : 'Delete Message (Mod)'}</button>`);
    }

    if (!meta.isOwn) {
      items.push('<div class="menu-divider"></div>');
      items.push('<button type="button" class="message-context-item danger" data-message-action="report">Report Message</button>');
    }

    return items.join('');
  };

  const buildEmojiPreviewAsset = (emojiNode) => {
    if (!(emojiNode instanceof HTMLElement)) {
      return null;
    }

    const token = String(emojiNode.dataset.messageEmojiToken || emojiNode.getAttribute('alt') || emojiNode.textContent || '').trim();
    if (!token) {
      return null;
    }

    const composer = getComposerBridge();
    const knownEntry = composer?.getCustomEmojiMeta?.(token) || null;
    const shortcode = String(emojiNode.dataset.messageEmojiShortcode || knownEntry?.shortcode || token).trim() || token;
    return {
      kind: 'emoji',
      title: 'Emoji Preview',
      token,
      shortcode,
      name: String(emojiNode.dataset.messageEmojiName || knownEntry?.label || token).trim() || token,
      url: String(emojiNode.dataset.messageEmojiUrl || knownEntry?.preview || '').trim(),
      glyph: knownEntry?.key || token,
      source: String(emojiNode.dataset.messageEmojiSource || (knownEntry?.type === 'unicode' ? 'Unicode' : 'Custom') || 'Custom').trim(),
      scope: String(emojiNode.dataset.messageEmojiScope || (knownEntry?.visibility === 'public' ? 'Server/Public' : (knownEntry?.visibility === 'private' ? 'Private' : 'Global'))).trim(),
      uploader: knownEntry?.ownerId ? `User ${knownEntry.ownerId}` : ''
    };
  };

  const buildGifPreviewAsset = (attachmentNode) => {
    if (!(attachmentNode instanceof HTMLAnchorElement)) {
      return null;
    }

    const gifId = Number(attachmentNode.dataset.messageGifId || 0);
    if (!gifId) {
      return null;
    }

    const composer = getComposerBridge();
    const knownEntry = composer?.getGifMeta?.(gifId) || null;
    const imageNode = attachmentNode.querySelector('img, video');
    return {
      kind: 'gif',
      title: 'GIF Preview',
      id: gifId,
      name: String(
        attachmentNode.dataset.messageGifName
        || imageNode?.getAttribute('alt')
        || knownEntry?.name
        || 'GIF'
      ).trim() || 'GIF',
      url: String(attachmentNode.href || knownEntry?.url || '').trim(),
      mimeType: String(knownEntry?.mimeType || attachmentNode.dataset.messageGifMimeType || 'image/gif').trim() || 'image/gif',
      tags: String(attachmentNode.dataset.messageGifTags || knownEntry?.tags || '').trim(),
      source: String(attachmentNode.dataset.messageGifSource || knownEntry?.sourceLabel || 'Message').trim() || 'Message'
    };
  };

  const resolvePreviewAssetForMessage = (messageNode, target = null) => {
    if (!(messageNode instanceof HTMLElement)) {
      return null;
    }

    const sourceTarget = target instanceof HTMLElement ? target : null;
    const emojiTarget = sourceTarget?.closest('.inline-emoji');
    if (emojiTarget instanceof HTMLElement && messageNode.contains(emojiTarget)) {
      return buildEmojiPreviewAsset(emojiTarget);
    }

    const attachmentTarget = sourceTarget?.closest('.msg-attachment[href][data-message-gif-id]');
    if (attachmentTarget instanceof HTMLAnchorElement && messageNode.contains(attachmentTarget)) {
      return buildGifPreviewAsset(attachmentTarget);
    }

    const firstEmoji = messageNode.querySelector('.inline-emoji');
    if (firstEmoji instanceof HTMLElement) {
      return buildEmojiPreviewAsset(firstEmoji);
    }

    const firstGif = messageNode.querySelector('.msg-attachment[href][data-message-gif-id]');
    if (firstGif instanceof HTMLAnchorElement) {
      return buildGifPreviewAsset(firstGif);
    }

    return null;
  };

  const buildMetaForSourceNode = (sourceNode, overrides = {}) => {
    if (!(sourceNode instanceof HTMLElement)) {
      return {
        messageId: Number(overrides.messageId || 0),
        authorLabel: 'User',
        messageText: '',
        isOwn: false,
        attachmentUrl: String(overrides.attachmentUrl || ''),
        hasText: false,
        canEdit: false,
        canDelete: false,
        previewAsset: overrides.previewAsset || null
      };
    }

    const isOwn = sourceNode.dataset.isOwn === '1';
    const hasText = sourceNode.dataset.hasText === '1';
    const isSystemMessage = sourceNode.dataset.isSystemMessage === '1';

    return {
      messageId: Number(overrides.messageId || sourceNode.dataset.messageId || 0),
      authorLabel: String(sourceNode.querySelector('.meta strong')?.textContent || 'User').trim(),
      messageText: decodeMessageText(sourceNode.dataset.messageText || ''),
      isOwn,
      attachmentUrl: String(overrides.attachmentUrl || ''),
      hasText,
      canEdit: isOwn && hasText && !isSystemMessage,
      canDelete: (isOwn && !isSystemMessage) || sourceNode.dataset.canDeleteAny === '1',
      previewAsset: overrides.previewAsset || null
    };
  };

  const resolveMessageMenuContext = (target) => {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const messageNode = target.closest('.msg[data-message-id]');
    if (!(messageNode instanceof HTMLElement)) {
      return null;
    }

    const messageId = Number(messageNode.dataset.messageId || 0);
    if (!messageId) {
      return null;
    }

    const attachment = target.closest('.msg-attachment[href]');
    const previewAsset = resolvePreviewAssetForMessage(messageNode, target);
    const meta = buildMetaForSourceNode(messageNode, {
      messageId,
      attachmentUrl: attachment instanceof HTMLAnchorElement ? attachment.href : '',
      previewAsset
    });

    return {
      messageNode,
      meta
    };
  };

  const openMenuAtPoint = (point, meta) => {
    if (!point) {
      return;
    }
    openMenu({
      clientX: Number(point.clientX || 0),
      clientY: Number(point.clientY || 0)
    }, meta);
  };

  const openMenu = (event, meta) => {
    const node = ensureMenu();
    closePreviewPopover();
    closePreviewOverlay();
    activeMeta = meta;
    activeMessageId = meta.messageId;
    openedAt = Date.now();
    node.dataset.messageId = String(meta.messageId);
    node.dataset.attachmentUrl = String(meta.attachmentUrl || '');
    node.innerHTML = buildMenuHtml(meta);
    node.hidden = false;
    node.style.left = '0px';
    node.style.top = '0px';

    const { innerWidth, innerHeight } = window;
    const viewportPadding = 8;
    const rect = node.getBoundingClientRect();
    let left = event.clientX;
    let top = event.clientY;

    if (left + rect.width > innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, event.clientX - rect.width);
    }
    if (top + rect.height > innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, event.clientY - rect.height);
    }

    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  };

  document.addEventListener('contextmenu', (event) => {
    const target = event.target;
    const context = resolveMessageMenuContext(target);
    if (!context) {
      closeMenu();
      closePreviewPopover();
      return;
    }

    if (Date.now() < suppressNativeContextMenuUntil) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    openMenu(event, context.meta);
  });

  document.addEventListener('touchstart', (event) => {
    const touch = event.touches?.[0];
    const context = resolveMessageMenuContext(event.target);
    if (!touch || !context) {
      cancelLongPress();
      return;
    }

    cancelLongPress();
    longPressTarget = context.messageNode;
    longPressPointerId = String(context.meta.messageId);
    longPressPoint = {
      clientX: Number(touch.clientX || 0),
      clientY: Number(touch.clientY || 0)
    };
    longPressTimer = window.setTimeout(() => {
      const activeContext = resolveMessageMenuContext(longPressTarget);
      if (!activeContext || longPressPointerId !== String(activeContext.meta.messageId)) {
        cancelLongPress();
        return;
      }

      suppressNativeContextMenuUntil = Date.now() + 800;
      suppressClickUntil = Date.now() + 800;
      suppressClickMessageId = activeContext.meta.messageId;
      openMenuAtPoint(longPressPoint, activeContext.meta);
      cancelLongPress();
    }, LONG_PRESS_DELAY_MS);
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!longPressTimer || !longPressPoint) {
      return;
    }

    const touch = event.touches?.[0];
    if (!touch) {
      cancelLongPress();
      return;
    }

    const deltaX = Math.abs(Number(touch.clientX || 0) - longPressPoint.clientX);
    const deltaY = Math.abs(Number(touch.clientY || 0) - longPressPoint.clientY);
    if (deltaX > LONG_PRESS_MOVE_TOLERANCE || deltaY > LONG_PRESS_MOVE_TOLERANCE) {
      cancelLongPress();
    }
  }, { passive: true });

  document.addEventListener('touchend', cancelLongPress, { passive: true });
  document.addEventListener('touchcancel', cancelLongPress, { passive: true });

  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const previewTrigger = resolvePreviewTrigger(target);
    if (previewPopover && !previewPopover.hidden && !previewTrigger && !previewPopover.contains(target)) {
      closePreviewPopover();
    }

    if (menu && !menu.hidden && !menu.contains(target)) {
      closeMenu();
    }
  });

  document.addEventListener('click', (event) => {
    if (Date.now() >= suppressClickUntil) {
      return;
    }

    const context = resolveMessageMenuContext(event.target);
    if (!context || context.meta.messageId !== suppressClickMessageId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener('click', (event) => {
    if (!(event instanceof MouseEvent) || event.button !== 0 || event.defaultPrevented) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const previewTrigger = resolvePreviewTrigger(target);
    if (!previewTrigger) {
      return;
    }

    const context = resolveMessageMenuContext(target);
    if (!context || !context.meta.previewAsset) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    closePreviewOverlay();
    const nextKey = buildPreviewAssetKey(context.meta.previewAsset);
    if (previewPopover && !previewPopover.hidden && previewPopoverKey === nextKey && previewPopoverAnchor === previewTrigger) {
      closePreviewPopover();
      return;
    }
    openPreviewPopover(context.meta.previewAsset, previewTrigger);
  });

  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.defaultPrevented) {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const previewTrigger = resolvePreviewTrigger(target);
        const context = previewTrigger ? resolveMessageMenuContext(target) : null;
        if (previewTrigger && context?.meta.previewAsset) {
          event.preventDefault();
          closeMenu();
          closePreviewOverlay();
          const nextKey = buildPreviewAssetKey(context.meta.previewAsset);
          if (previewPopover && !previewPopover.hidden && previewPopoverKey === nextKey && previewPopoverAnchor === previewTrigger) {
            closePreviewPopover();
            return;
          }
          openPreviewPopover(context.meta.previewAsset, previewTrigger);
          return;
        }
      }
    }

    if (event.key === 'Escape') {
      if (previewPopover && !previewPopover.hidden) {
        closePreviewPopover();
        return;
      }
      if (previewOverlay && !previewOverlay.hidden) {
        closePreviewOverlay();
        return;
      }
      closeMenu();
    }
  });

  document.addEventListener('scroll', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.timeline')) {
      closePreviewPopover();
      if (openedAt && Date.now() - openedAt < 250) {
        return;
      }
      closeMenu();
    }
  }, true);

  window.addEventListener('resize', () => {
    closeMenu();
    if (previewPopover && !previewPopover.hidden) {
      positionPreviewPopover();
    }
    closePreviewOverlay();
  });
})();

(function initLoadingState() {
  const forms = document.querySelectorAll('form');
  forms.forEach((form) => {
    form.addEventListener('submit', () => {
      if (form.classList.contains('composer') || form.dataset.asyncSubmit === 'true') {
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = '😺 Lädt...';
      }
    });
  });
})();

(function initInternalScrollWheelFallback() {
  const scrollSelector = [
    '.timeline',
    '.dm-list-scroll',
    '.nav-rail-scroll',
    '.server-rail-scroll',
    '.info-rail',
    '.emoji-section-scroll',
    '.gif-section-scroll',
    '.full-profile-panel'
  ].join(', ');

  const isInteractiveControl = (node) => (
    node instanceof HTMLElement
    && Boolean(node.closest('input, textarea, select, [contenteditable="true"]'))
  );

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  document.addEventListener('wheel', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || isInteractiveControl(target)) {
      return;
    }

    const container = target.closest(scrollSelector);
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const canScrollY = container.scrollHeight > (container.clientHeight + 1);
    const canScrollX = container.scrollWidth > (container.clientWidth + 1);
    if (!canScrollY && !canScrollX) {
      return;
    }

    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const nextTop = canScrollY ? clamp(container.scrollTop + event.deltaY, 0, maxTop) : container.scrollTop;
    const nextLeft = canScrollX ? clamp(container.scrollLeft + event.deltaX, 0, maxLeft) : container.scrollLeft;

    if (nextTop === container.scrollTop && nextLeft === container.scrollLeft) {
      return;
    }

    event.preventDefault();
    if (nextTop !== container.scrollTop) {
      container.scrollTop = nextTop;
    }
    if (nextLeft !== container.scrollLeft) {
      container.scrollLeft = nextLeft;
    }
  }, { passive: false });
})();

(function initDmActionsAccordion() {
  const container = document.getElementById('dmActionSwitches');
  const buttons = [...document.querySelectorAll('.dm-action-btn[data-action-target]')];
  const panels = [...document.querySelectorAll('.dm-action-panel[data-action-panel]')];

  if (!container || buttons.length !== 3 || panels.length !== 3) {
    return;
  }

  const findPanel = document.querySelector('[data-action-panel="find"]');
  const findForm = document.getElementById('dmFindForm');
  const findInput = document.getElementById('dmFindInput');
  const findNoResults = document.getElementById('dmFindNoResults');
  const dmList = document.getElementById('activeDmList');
  const dmRows = [...(dmList?.querySelectorAll('.dm-row') || [])];

  const newMessageForm = document.getElementById('dmNewMessageForm');
  const newMessageError = document.getElementById('dmNewMessageError');
  const newGroupForm = document.getElementById('dmNewGroupForm');
  const newGroupError = document.getElementById('dmNewGroupError');
  const currentUsername = String(document.getElementById('dmCurrentUsername')?.value || '').trim().toLowerCase();

  const clearFind = () => {
    if (findInput) {
      findInput.value = '';
    }
    dmRows.forEach((row) => {
      row.hidden = false;
    });
    if (findNoResults) {
      findNoResults.hidden = true;
    }
  };

  const setOpenPanel = (targetName) => {
    panels.forEach((panel) => {
      const open = panel.dataset.actionPanel === targetName;
      panel.hidden = !open;
      panel.classList.toggle('open', open);
      if (!open && panel.dataset.actionPanel === 'find') {
        clearFind();
      }
    });
    buttons.forEach((btn) => {
      btn.classList.toggle('active-chip', btn.dataset.actionTarget === targetName);
    });
  };

  const closeAllPanels = () => {
    panels.forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove('open');
      if (panel.dataset.actionPanel === 'find') {
        clearFind();
      }
    });
    buttons.forEach((btn) => btn.classList.remove('active-chip'));
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.actionTarget;
      const panel = document.querySelector(`[data-action-panel="${target}"]`);
      if (!panel) {
        return;
      }

      const alreadyOpen = !panel.hidden;
      if (alreadyOpen) {
        closeAllPanels();
        return;
      }
      setOpenPanel(target);
      if (target === 'find' && findInput) {
        findInput.focus();
      }
    });
  });

  findForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = (findInput?.value || '').trim().toLowerCase();
    if (!query) {
      clearFind();
      return;
    }

    let visible = 0;
    dmRows.forEach((row) => {
      const text = (row.textContent || '').toLowerCase();
      const match = text.includes(query);
      row.hidden = !match;
      if (match) {
        visible += 1;
      }
    });
    if (findNoResults) {
      findNoResults.hidden = visible > 0;
    }
  });

  newMessageForm?.addEventListener('submit', (event) => {
    if (!newMessageError) {
      return;
    }

    const input = newMessageForm.querySelector('input[name="username"]');
    const username = String(input?.value || '').trim().replace(/^@/, '').toLowerCase();
    newMessageError.hidden = true;
    newMessageError.textContent = '';

    if (!username) {
      event.preventDefault();
      newMessageError.hidden = false;
      newMessageError.textContent = 'Username erforderlich';
      return;
    }

    if (username === currentUsername) {
      event.preventDefault();
      newMessageError.hidden = false;
      newMessageError.textContent = 'Du kannst dir nicht selbst schreiben';
    }
  });

  newGroupForm?.addEventListener('submit', (event) => {
    if (!newGroupError) {
      return;
    }

    const membersInput = newGroupForm.querySelector('input[name="members"]');
    const members = String(membersInput?.value || '')
      .split(',')
      .map((v) => v.trim().replace(/^@/, ''))
      .filter(Boolean);

    newGroupError.hidden = true;
    newGroupError.textContent = '';
    if (members.length < 2) {
      event.preventDefault();
      newGroupError.hidden = false;
      newGroupError.textContent = 'Mindestens 2 Teilnehmer erforderlich';
    }
  });

  document.addEventListener('click', (event) => {
    const anyOpen = panels.some((panel) => !panel.hidden);
    if (!anyOpen) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (!container.closest('#dmNavRail')?.contains(target)) {
      closeAllPanels();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    const anyOpen = panels.some((panel) => !panel.hidden);
    if (anyOpen) {
      closeAllPanels();
    }
  });
})();

(function initDmInfoSidebar() {
  const groupCard = document.querySelector('[data-group-dm-card]');
  const editPanel = document.querySelector('[data-group-edit-panel]');
  const toggleButtons = [...document.querySelectorAll('[data-group-edit-toggle]')];
  const closeButtons = [...document.querySelectorAll('[data-group-edit-close]')];

  if (!groupCard || !editPanel || !toggleButtons.length) {
    return;
  }

  const setEditing = (editing) => {
    editPanel.hidden = !editing;
    groupCard.classList.toggle('is-editing', editing);
    toggleButtons.forEach((button) => {
      button.setAttribute('aria-expanded', editing ? 'true' : 'false');
    });
  };

  setEditing(false);

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setEditing(editPanel.hidden);
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setEditing(false);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !editPanel.hidden) {
      setEditing(false);
    }
  });
})();

(function initDmMobilePanels() {
  const shell = document.querySelector('main.dm-shell');
  const navRail = document.getElementById('dmNavRail');
  const infoRail = document.querySelector('[data-testid="dm-info-panel"]');
  const openListButton = document.querySelector('[data-dm-mobile-open-list]');
  const openInfoButton = document.querySelector('[data-dm-mobile-open-info]');
  const closeListButtons = [...document.querySelectorAll('[data-dm-mobile-close-list]')];
  const closeInfoButtons = [...document.querySelectorAll('[data-dm-mobile-close-info]')];
  const backdrop = document.querySelector('[data-dm-mobile-backdrop]');

  if (!shell || !navRail || !infoRail) {
    return;
  }

  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const NAV_OPEN_CLASS = 'is-mobile-nav-open';
  const INFO_OPEN_CLASS = 'is-mobile-info-open';

  const isMobileViewport = () => mobileQuery.matches;

  const syncControls = () => {
    const navOpen = shell.classList.contains(NAV_OPEN_CLASS);
    const infoOpen = shell.classList.contains(INFO_OPEN_CLASS);
    openListButton?.setAttribute('aria-expanded', navOpen ? 'true' : 'false');
    openInfoButton?.setAttribute('aria-expanded', infoOpen ? 'true' : 'false');
    if (backdrop) {
      backdrop.hidden = !(isMobileViewport() && (navOpen || infoOpen));
    }
  };

  const closePanels = () => {
    shell.classList.remove(NAV_OPEN_CLASS, INFO_OPEN_CLASS);
    syncControls();
  };

  const openListPanel = () => {
    if (!isMobileViewport()) {
      return;
    }
    shell.classList.add(NAV_OPEN_CLASS);
    shell.classList.remove(INFO_OPEN_CLASS);
    syncControls();
  };

  const openInfoPanel = () => {
    if (!isMobileViewport()) {
      return;
    }
    shell.classList.add(INFO_OPEN_CLASS);
    shell.classList.remove(NAV_OPEN_CLASS);
    syncControls();
  };

  openListButton?.addEventListener('click', () => {
    if (shell.classList.contains(NAV_OPEN_CLASS)) {
      closePanels();
      return;
    }
    openListPanel();
  });

  openInfoButton?.addEventListener('click', () => {
    if (shell.classList.contains(INFO_OPEN_CLASS)) {
      closePanels();
      return;
    }
    openInfoPanel();
  });

  closeListButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closePanels();
    });
  });

  closeInfoButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closePanels();
    });
  });

  backdrop?.addEventListener('click', () => {
    closePanels();
  });

  navRail.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest('a.dm-row[href]')) {
      closePanels();
    }
  });

  document.addEventListener('click', (event) => {
    if (!isMobileViewport()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest('[data-open-full-profile], [data-action="emoji"], [data-action="gif"], [data-member-menu-trigger], [data-chat-preview-open]')) {
      closePanels();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isMobileViewport()) {
      return;
    }
    if (shell.classList.contains(NAV_OPEN_CLASS) || shell.classList.contains(INFO_OPEN_CLASS)) {
      closePanels();
    }
  });

  const handleViewportChange = () => {
    if (!isMobileViewport()) {
      closePanels();
      return;
    }
    syncControls();
  };

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', handleViewportChange);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(handleViewportChange);
  }

  window.addEventListener('resize', () => {
    if (!isMobileViewport()) {
      closePanels();
    }
  });

  syncControls();
})();

(function initTimelineScrollBehavior() {
  const timeline = document.getElementById('timeline');
  const indicator = document.getElementById('newMessagesIndicator');
  if (!timeline) {
    return;
  }

  const thresholdPx = 48;
  let shouldStickToBottom = true;

  const distanceToBottom = () => timeline.scrollHeight - (timeline.scrollTop + timeline.clientHeight);

  const scrollToBottom = () => {
    timeline.scrollTop = timeline.scrollHeight;
    shouldStickToBottom = true;
    if (indicator) {
      indicator.hidden = true;
    }
  };

  const updateStickiness = () => {
    shouldStickToBottom = distanceToBottom() <= thresholdPx;
    if (shouldStickToBottom && indicator) {
      indicator.hidden = true;
    }
  };

  timeline.addEventListener('scroll', updateStickiness);
  indicator?.addEventListener('click', scrollToBottom);

  const observer = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some((mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0);
    if (!hasNewNodes) {
      return;
    }

    if (shouldStickToBottom) {
      scrollToBottom();
      return;
    }

    if (indicator) {
      indicator.hidden = false;
    }
  });

  observer.observe(timeline, { childList: true, subtree: true });

  // Initial position after first paint
  requestAnimationFrame(scrollToBottom);
})();

(function initRegisterFormValidation() {
  const form = document.getElementById('registerForm');
  const passwordInput = document.getElementById('registerPasswordInput');
  const inlineError = document.getElementById('registerPasswordInlineError');
  if (!form || !passwordInput || !inlineError) {
    return;
  }

  const validatePassword = () => {
    const value = String(passwordInput.value || '');
    const valid = value.length >= 8 && /\d/.test(value);
    if (!value) {
      inlineError.hidden = true;
      passwordInput.setCustomValidity('');
      return true;
    }
    if (valid) {
      inlineError.hidden = true;
      inlineError.textContent = '';
      passwordInput.setCustomValidity('');
      return true;
    }
    inlineError.hidden = false;
    inlineError.textContent = 'Mindestens 8 Zeichen und mindestens 1 Zahl.';
    passwordInput.setCustomValidity('invalid-password');
    return false;
  };

  passwordInput.addEventListener('input', validatePassword);
  form.addEventListener('submit', (event) => {
    if (!validatePassword()) {
      event.preventDefault();
      passwordInput.focus();
    }
  });
})();

(function initServerViewMenus() {
  const serverMenuTrigger = document.getElementById('serverMenuTrigger');
  const serverMenu = document.getElementById('serverMenu');
  const membersRail = document.getElementById('serverMembersRail');
  const membersToggleBtn = document.getElementById('membersToggleBtn');
  const serverId = Number(document.getElementById('serverContextServerId')?.value || 0);
  const serverComposerTextarea = document.querySelector('#serverComposerForm textarea[name="content"]');
  const serverToastStack = document.getElementById('serverToastStack');
  const memberRows = [...document.querySelectorAll('.server-member-row[data-member-menu-for]')];
  const serverModals = [...document.querySelectorAll('.server-modal[data-server-modal]')];
  const modalByName = new Map(serverModals.map((modal) => [String(modal.dataset.serverModal || ''), modal]));
  const MENU_STATE_CLOSED = 'CLOSED';
  const MENU_STATE_OPEN = 'OPEN';

  if (!serverMenuTrigger && !memberRows.length && !membersToggleBtn && !serverModals.length) {
    return;
  }

  const ensureOverlayRoot = () => {
    let root = document.getElementById('appOverlayRoot');
    if (root) {
      return root;
    }
    root = document.createElement('div');
    root.id = 'appOverlayRoot';
    root.className = 'overlay-root';
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
    return root;
  };

  const overlayRoot = ensureOverlayRoot();
  const serverMenuState = {
    state: MENU_STATE_CLOSED,
    anchorRect: null
  };
  let openModalName = '';
  let lastMarkReadSnapshot = null;

  const closeServerMenu = (options = {}) => {
    if (!serverMenu || !serverMenuTrigger) {
      return;
    }
    const { restoreFocus = false } = options;
    const wasOpen = serverMenuState.state === MENU_STATE_OPEN;
    serverMenuState.state = MENU_STATE_CLOSED;
    serverMenuState.anchorRect = null;
    serverMenu.hidden = true;
    serverMenuTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && wasOpen) {
      serverMenuTrigger.focus();
    }
  };

  const closeMemberMenus = () => {
    memberRows.forEach((row) => {
      const menuId = row.getAttribute('data-member-menu-for');
      const menu = menuId ? document.getElementById(menuId) : null;
      if (menu) {
        menu.hidden = true;
      }
    });
  };

  const closeServerModal = (options = {}) => {
    if (!openModalName) {
      return;
    }
    const { restoreFocus = false } = options;
    const modal = modalByName.get(openModalName);
    if (modal) {
      modal.hidden = true;
    }
    openModalName = '';
    if (restoreFocus) {
      serverMenuTrigger?.focus();
    }
  };

  const openServerModal = (name) => {
    const modal = modalByName.get(name);
    if (!modal) {
      return;
    }
    closeServerMenu();
    closeMemberMenus();
    if (sokratesAppManagePanel instanceof HTMLElement && !sokratesAppManagePanel.hidden) {
      sokratesAppManagePanel.hidden = true;
    }
    closeServerModal();
    if (modal.parentElement !== overlayRoot) {
      overlayRoot.appendChild(modal);
    }
    modal.hidden = false;
    openModalName = name;
    const autofocusTarget = modal.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])');
    autofocusTarget?.focus();
  };

  const setButtonLoading = (button, loading, loadingLabel = 'Loading...') => {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const htmlButton = button;
    if (loading) {
      if (!htmlButton.dataset.defaultLabel) {
        htmlButton.dataset.defaultLabel = htmlButton.textContent || '';
      }
      htmlButton.textContent = loadingLabel;
      htmlButton.classList.add('is-loading');
      htmlButton.setAttribute('disabled', 'disabled');
      return;
    }
    htmlButton.textContent = htmlButton.dataset.defaultLabel || htmlButton.textContent || '';
    htmlButton.classList.remove('is-loading');
    htmlButton.removeAttribute('disabled');
  };

  const setStatusText = (node, message = '', tone = '') => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.hidden = !message;
    node.textContent = message;
    node.classList.remove('upload-status-ok', 'inline-error');
    if (tone === 'ok') {
      node.classList.add('upload-status-ok');
    } else if (tone === 'error') {
      node.classList.add('inline-error');
    }
  };

  const showServerToast = (message, options = {}) => {
    if (!serverToastStack || !message) {
      return;
    }
    const {
      tone = 'ok',
      actionLabel = '',
      onAction = null,
      durationMs = 3200
    } = options;

    const toast = document.createElement('div');
    toast.className = `server-toast ${tone === 'error' ? 'error' : ''}`;
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    let closed = false;
    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      toast.remove();
    };

    let timer = null;

    if (actionLabel && typeof onAction === 'function') {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'chip';
      actionBtn.textContent = actionLabel;
      actionBtn.addEventListener('click', async () => {
        actionBtn.disabled = true;
        clearTimeout(timer);
        try {
          await onAction();
        } finally {
          close();
        }
      });
      toast.appendChild(actionBtn);
    }

    serverToastStack.appendChild(toast);
    timer = setTimeout(close, durationMs);
  };

  const postJson = async (url, payload = {}) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const mapServerError = (code, fallback = 'Aktion fehlgeschlagen.') => {
    const byCode = {
      permission_denied: 'Keine Berechtigung.',
      name_required: 'Name ist erforderlich.',
      name_exists: 'Name ist bereits vergeben.',
      category_invalid: 'Kategorie ist ungültig.',
      invalid_snapshot: 'Undo-Daten sind ungültig.',
      owner_transfer_required: 'Ownership-Transfer ist erforderlich.',
      transfer_target_invalid: 'Ungültiger Transfer-User.',
      not_member: 'Du bist kein Mitglied dieses Servers.',
      save_failed: 'Einstellungen konnten nicht gespeichert werden.'
    };
    return byCode[String(code || '')] || fallback;
  };

  const insertMentionIntoComposer = async (mention) => {
    if (!mention) {
      return;
    }
    if (serverComposerTextarea) {
      const current = serverComposerTextarea.value || '';
      const prefix = current && !/\s$/.test(current) ? ' ' : '';
      serverComposerTextarea.value = `${current}${prefix}${mention} `;
      serverComposerTextarea.focus();
      serverComposerTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      showServerToast('Mention eingefügt.');
      return;
    }
    try {
      await navigator.clipboard.writeText(mention);
      showServerToast('Mention kopiert.');
    } catch (error) {
      showServerToast('Mention konnte nicht kopiert werden.', { tone: 'error' });
    }
  };

  const runMarkServerAsRead = async (triggerBtn) => {
    if (!serverId) {
      return;
    }
    setButtonLoading(triggerBtn, true, 'Marking...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/mark-read`, {});
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Server konnte nicht als gelesen markiert werden.'));
      }
      lastMarkReadSnapshot = data.snapshot;
      showServerToast('Server marked as read', {
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            const undoResult = await postJson(`/app/servers/${serverId}/mark-read/undo`, {
              snapshot: lastMarkReadSnapshot
            });
            if (!undoResult.response.ok || !undoResult.data.ok) {
              throw new Error(mapServerError(undoResult.data.error, 'Undo fehlgeschlagen.'));
            }
            lastMarkReadSnapshot = null;
            showServerToast('Undo erfolgreich.');
          } catch (error) {
            showServerToast(error.message || 'Undo fehlgeschlagen.', { tone: 'error' });
          }
        }
      });
    } catch (error) {
      showServerToast(error.message || 'Server konnte nicht als gelesen markiert werden.', { tone: 'error' });
    } finally {
      setButtonLoading(triggerBtn, false);
    }
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const measureServerMenu = () => {
    if (!serverMenu) {
      return { width: 260, height: 0 };
    }
    const wasHidden = serverMenu.hidden;
    const previousVisibility = serverMenu.style.visibility;
    const previousPointerEvents = serverMenu.style.pointerEvents;
    const previousLeft = serverMenu.style.left;
    const previousTop = serverMenu.style.top;
    const previousWidth = serverMenu.style.width;

    if (wasHidden) {
      serverMenu.hidden = false;
    }
    serverMenu.style.visibility = 'hidden';
    serverMenu.style.pointerEvents = 'none';
    serverMenu.style.left = '0px';
    serverMenu.style.top = '0px';
    serverMenu.style.width = '';

    const rect = serverMenu.getBoundingClientRect();

    if (wasHidden) {
      serverMenu.hidden = true;
    }
    serverMenu.style.visibility = previousVisibility;
    serverMenu.style.pointerEvents = previousPointerEvents;
    serverMenu.style.left = previousLeft;
    serverMenu.style.top = previousTop;
    serverMenu.style.width = previousWidth;

    return {
      width: rect.width || 260,
      height: rect.height || 0
    };
  };

  const positionServerMenu = () => {
    if (!serverMenu || !serverMenuTrigger || serverMenuState.state !== MENU_STATE_OPEN) {
      return;
    }
    const viewportPadding = 8;
    const gap = 8;
    const anchorRect = serverMenuState.anchorRect || serverMenuTrigger.getBoundingClientRect();
    const measured = measureServerMenu();
    const maxWidth = Math.max(220, window.innerWidth - viewportPadding * 2);
    const baseWidth = Math.max(anchorRect.width, 220, measured.width);
    const width = Math.min(baseWidth, maxWidth);

    let left = anchorRect.left;
    if (left + width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - viewportPadding - width;
    }
    left = clamp(left, viewportPadding, window.innerWidth - viewportPadding - width);

    const belowTop = anchorRect.bottom + gap;
    const spaceBelow = window.innerHeight - belowTop - viewportPadding;
    const spaceAbove = anchorRect.top - gap - viewportPadding;
    const preferredHeight = measured.height || 260;
    const openAbove = spaceBelow < Math.min(preferredHeight, 260) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, openAbove ? spaceAbove : spaceBelow);
    const renderHeight = Math.min(preferredHeight, maxHeight);
    let top = openAbove ? anchorRect.top - gap - renderHeight : belowTop;
    top = clamp(top, viewportPadding, window.innerHeight - viewportPadding - renderHeight);

    serverMenu.style.left = `${Math.round(left)}px`;
    serverMenu.style.top = `${Math.round(top)}px`;
    serverMenu.style.width = `${Math.round(width)}px`;
    serverMenu.style.maxHeight = `${Math.floor(maxHeight)}px`;
  };

  const openServerMenu = () => {
    if (!serverMenu || !serverMenuTrigger) {
      return;
    }
    closeMemberMenus();
    serverMenuState.state = MENU_STATE_OPEN;
    serverMenuState.anchorRect = serverMenuTrigger.getBoundingClientRect();
    if (serverMenu.parentElement !== overlayRoot) {
      overlayRoot.appendChild(serverMenu);
    }
    serverMenu.hidden = false;
    serverMenuTrigger.setAttribute('aria-expanded', 'true');
    positionServerMenu();
  };

  const toggleServerMenu = () => {
    if (!serverMenu) {
      return;
    }
    if (serverMenuState.state === MENU_STATE_OPEN) {
      closeServerMenu();
      return;
    }
    openServerMenu();
  };

  if (serverMenu) {
    serverMenu.hidden = true;
    serverMenu.classList.add('server-menu-overlay');
    if (serverMenu.parentElement !== overlayRoot) {
      overlayRoot.appendChild(serverMenu);
    }
  }

  serverModals.forEach((modal) => {
    modal.hidden = true;
    if (modal.parentElement !== overlayRoot) {
      overlayRoot.appendChild(modal);
    }
    modal.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const closeTrigger = target.closest('[data-close-server-modal]');
      if (!closeTrigger) {
        return;
      }
      event.preventDefault();
      closeServerModal({ restoreFocus: true });
    });
  });

  serverMenuTrigger?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleServerMenu();
  });

  const runServerMenuAction = async (actionNode) => {
    const action = String(actionNode.dataset.serverMenuAction || '');
    if (!action) {
      return;
    }
    closeServerMenu();
    if (action === 'server-settings') {
      const route = String(actionNode.dataset.serverNav || '');
      if (route) {
        window.location.assign(route);
      }
      return;
    }
    if (action === 'mark-read') {
      await runMarkServerAsRead(actionNode);
      return;
    }
    if (action === 'sokrates-app-settings') {
      if (sokratesAppState?.installed) {
        openSokratesManagePanel();
      } else {
        openServerModal(action);
      }
      return;
    }
    if (modalByName.has(action)) {
      openServerModal(action);
    }
  };

  serverMenu?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const actionNode = target.closest('[data-server-menu-action]');
    if (!(actionNode instanceof HTMLButtonElement) || actionNode.disabled) {
      return;
    }
    await runServerMenuAction(actionNode);
  });

  memberRows.forEach((row) => {
    row.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const menuId = row.getAttribute('data-member-menu-for');
      const menu = menuId ? document.getElementById(menuId) : null;
      if (!menu) {
        return;
      }
      const trigger = target.closest('[data-member-menu-trigger]');
      if (trigger) {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = menu.hidden;
        closeMemberMenus();
        closeServerMenu();
        menu.hidden = !willOpen;
        return;
      }
      if (!menu.contains(target)) {
        closeMemberMenus();
      }
    });

    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const menuId = row.getAttribute('data-member-menu-for');
      const menu = menuId ? document.getElementById(menuId) : null;
      if (!menu) {
        return;
      }
      const willOpen = menu.hidden;
      closeMemberMenus();
      closeServerMenu();
      menu.hidden = !willOpen;
    });

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      const menuId = row.getAttribute('data-member-menu-for');
      const menu = menuId ? document.getElementById(menuId) : null;
      if (!menu) {
        return;
      }
      const willOpen = menu.hidden;
      closeMemberMenus();
      closeServerMenu();
      menu.hidden = !willOpen;
    });

    const menuId = row.getAttribute('data-member-menu-for');
    const menu = menuId ? document.getElementById(menuId) : null;
    menu?.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = target.closest('button, a');
      if (!action) {
        return;
      }
      closeMemberMenus();
    });
  });

  const invitePeopleForm = document.getElementById('invitePeopleForm');
  const invitePeopleSubmitBtn = document.getElementById('invitePeopleSubmitBtn');
  const invitePeopleStatus = document.getElementById('invitePeopleStatus');
  const invitePeopleLink = document.getElementById('invitePeopleLink');
  const invitePeopleCopyBtn = document.getElementById('invitePeopleCopyBtn');
  const invitePendingList = document.getElementById('invitePendingList');
  const notificationSettingsForm = document.getElementById('notificationSettingsForm');
  const notificationSettingsSubmitBtn = document.getElementById('notificationSettingsSubmitBtn');
  const notificationSettingsStatus = document.getElementById('notificationSettingsStatus');
  const privacySettingsForm = document.getElementById('privacySettingsForm');
  const privacySettingsSubmitBtn = document.getElementById('privacySettingsSubmitBtn');
  const privacySettingsStatus = document.getElementById('privacySettingsStatus');
  const createChannelForm = document.getElementById('createChannelForm');
  const createChannelSubmitBtn = document.getElementById('createChannelSubmitBtn');
  const createChannelStatus = document.getElementById('createChannelStatus');
  const createCategoryForm = document.getElementById('createCategoryForm');
  const createCategorySubmitBtn = document.getElementById('createCategorySubmitBtn');
  const createCategoryStatus = document.getElementById('createCategoryStatus');
  const leaveServerForm = document.getElementById('leaveServerForm');
  const leaveServerSubmitBtn = document.getElementById('leaveServerSubmitBtn');
  const leaveServerStatus = document.getElementById('leaveServerStatus');
  const sokratesAppMenuButton = document.getElementById('sokratesAppMenuButton');
  const sokratesAppDataNode = document.getElementById('sokratesServerAppData');
  const sokratesAppForm = document.getElementById('sokratesAppForm');
  const sokratesAppTitle = document.getElementById('sokratesAppTitle');
  const sokratesAppSubmitBtn = document.getElementById('sokratesAppSubmitBtn');
  const sokratesAppRemoveBtn = document.getElementById('sokratesAppRemoveBtn');
  const sokratesAppStatus = document.getElementById('sokratesAppStatus');
  const sokratesAppChannelScopeInput = document.getElementById('sokratesAppChannelScopeInput');
  const sokratesAppChannelAllowlist = document.getElementById('sokratesAppChannelAllowlist');
  const sokratesAppManagePanel = document.getElementById('sokratesAppManagePanel');
  const sokratesAppManageForm = document.getElementById('sokratesAppManageForm');
  const sokratesAppManageSubmitBtn = document.getElementById('sokratesAppManageSubmitBtn');
  const sokratesAppManageRemoveBtn = document.getElementById('sokratesAppManageRemoveBtn');
  const sokratesAppManageStatus = document.getElementById('sokratesAppManageStatus');
  const sokratesAppManageCloseBtn = document.getElementById('sokratesAppPanelCloseBtn');
  const sokratesAppManageChannelScopeInput = document.getElementById('sokratesAppManageChannelScopeInput');
  const sokratesAppManageAllowlist = document.getElementById('sokratesAppManageAllowlist');
  let sokratesAppState = null;

  if (sokratesAppDataNode?.textContent) {
    try {
      sokratesAppState = JSON.parse(sokratesAppDataNode.textContent);
    } catch (_error) {
      sokratesAppState = null;
    }
  }

  const buildInviteUrl = (invite) => {
    const token = String(invite?.token || '').trim();
    if (invite?.url) {
      return invite.url;
    }
    if (!token) {
      return '';
    }
    return `${window.location.origin}/app/invite/${token}`;
  };

  const parseSokratesReactionPool = (value = '') => (
    [...new Set(
      String(value || '')
        .split(/[,\s]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )]
  ).slice(0, 12);

  const syncSokratesScopeVisibility = (scopeInput, allowlistNode) => {
    if (!(allowlistNode instanceof HTMLElement)) {
      return;
    }
    const scope = String(scopeInput?.value || 'all').trim().toLowerCase();
    allowlistNode.hidden = scope !== 'selected';
  };

  const defaultSokratesSettings = () => ({
    enabled: true,
    allow_text: true,
    allow_reactions: true,
    channel_scope: 'all',
    channels_allowlist: [],
    probability_preset: 'medium',
    channel_cooldown_ms: 180000,
    server_hour_cap: 12,
    reaction_pool: ['✅', '🤔', '😼', '👀', '🔥']
  });

  const applySokratesFormState = (form, installation, options = {}) => {
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const { advanced = false } = options;
    const settings = installation?.settings || defaultSokratesSettings();
    const allowedChannels = new Set((settings.channels_allowlist || []).map((entry) => Number(entry || 0)));

    const setCheckbox = (name, checked) => {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement) {
        input.checked = Boolean(checked);
      }
    };

    const setValue = (name, value) => {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
        input.value = String(value ?? '');
      }
    };

    setCheckbox('enabled', settings.enabled !== false);
    setCheckbox('allowText', settings.allow_text !== false);
    setCheckbox('allowReactions', settings.allow_reactions !== false);
    setValue('probabilityPreset', settings.probability_preset || 'medium');
    setValue('channelScope', settings.channel_scope || 'all');

    form.querySelectorAll('input[name="channelsAllowlist"]').forEach((node) => {
      if (!(node instanceof HTMLInputElement)) {
        return;
      }
      node.checked = settings.channel_scope === 'selected'
        ? allowedChannels.has(Number(node.value || 0))
        : false;
    });

    if (advanced) {
      setValue('channelCooldownMinutes', Math.max(1, Math.round(Number(settings.channel_cooldown_ms || 180000) / 60000)));
      setValue('serverHourCap', Math.max(1, Number(settings.server_hour_cap || 12)));
      setValue(
        'reactionPool',
        Array.isArray(settings.reaction_pool) && settings.reaction_pool.length
          ? settings.reaction_pool.join(' ')
          : '✅ 🤔 😼 👀 🔥'
      );
    }
  };

  const collectSokratesPayload = (form, options = {}) => {
    const { advanced = false } = options;
    const formData = new FormData(form);
    const payload = {
      enabled: formData.get('enabled') === 'on',
      allowText: formData.get('allowText') === 'on',
      allowReactions: formData.get('allowReactions') === 'on',
      probabilityPreset: String(formData.get('probabilityPreset') || 'medium'),
      channelScope: String(formData.get('channelScope') || 'all'),
      channelsAllowlist: formData.getAll('channelsAllowlist').map((value) => Number(value || 0)).filter((value) => value > 0)
    };

    if (advanced) {
      payload.channelCooldownMinutes = Math.max(1, Number(formData.get('channelCooldownMinutes') || 0) || 3);
      payload.serverHourCap = Math.max(1, Number(formData.get('serverHourCap') || 0) || 12);
      payload.reactionPool = parseSokratesReactionPool(formData.get('reactionPool') || '');
    }

    return payload;
  };

  const prependInviteToList = (invite) => {
    if (!invitePendingList || !invite?.token) {
      return;
    }
    invitePendingList.querySelectorAll('p.sub').forEach((node) => node.remove());
    const row = document.createElement('div');
    row.className = 'server-inline-row';
    row.dataset.inviteToken = invite.token;
    const code = document.createElement('code');
    code.textContent = `/app/invite/${invite.token}`;
    const details = document.createElement('span');
    const expiry = invite.expires_at ? `expires ${invite.expires_at}` : 'no expiry';
    const maxUses = Number(invite.max_uses || 0) > 0 ? String(invite.max_uses) : '∞';
    details.className = 'sub';
    details.textContent = `${expiry} • uses ${invite.use_count || 0}/${maxUses}`;
    row.appendChild(code);
    row.appendChild(details);
    invitePendingList.prepend(row);
  };

  const syncSokratesAppAllowlistVisibility = () => {
    syncSokratesScopeVisibility(sokratesAppChannelScopeInput, sokratesAppChannelAllowlist);
    syncSokratesScopeVisibility(sokratesAppManageChannelScopeInput, sokratesAppManageAllowlist);
  };

  const closeSokratesManagePanel = (options = {}) => {
    if (!(sokratesAppManagePanel instanceof HTMLElement)) {
      return;
    }
    const { restoreFocus = false } = options;
    sokratesAppManagePanel.hidden = true;
    if (restoreFocus) {
      serverMenuTrigger?.focus();
    }
  };

  const openSokratesManagePanel = () => {
    if (!(sokratesAppManagePanel instanceof HTMLElement)) {
      return;
    }
    closeServerMenu();
    closeMemberMenus();
    closeServerModal();
    sokratesAppManagePanel.hidden = false;
    sokratesAppManagePanel.scrollIntoView({ block: 'start', behavior: 'auto' });
    syncSokratesAppAllowlistVisibility();
    const autofocusTarget = sokratesAppManagePanel.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])');
    autofocusTarget?.focus();
  };

  const syncSokratesAppUi = (installation) => {
    const installed = Boolean(installation?.installed);
    sokratesAppState = installation || null;
    if (sokratesAppDataNode) {
      sokratesAppDataNode.textContent = JSON.stringify(installation || null);
    }
    if (sokratesAppTitle) {
      sokratesAppTitle.textContent = installed ? 'Manage App: Sokrates' : 'Add App: Sokrates';
    }
    if (sokratesAppMenuButton) {
      sokratesAppMenuButton.textContent = installed ? 'Manage App: Sokrates' : 'Add App: Sokrates';
    }
    if (sokratesAppSubmitBtn instanceof HTMLButtonElement) {
      sokratesAppSubmitBtn.textContent = installed ? 'Save' : 'Install';
      sokratesAppSubmitBtn.dataset.defaultLabel = installed ? 'Save' : 'Install';
    }
    if (sokratesAppRemoveBtn instanceof HTMLButtonElement) {
      sokratesAppRemoveBtn.hidden = !installed;
      sokratesAppRemoveBtn.dataset.defaultLabel = 'Remove App';
    }
    if (sokratesAppManageRemoveBtn instanceof HTMLButtonElement) {
      sokratesAppManageRemoveBtn.hidden = !installed;
      sokratesAppManageRemoveBtn.dataset.defaultLabel = 'Remove App';
    }
    applySokratesFormState(sokratesAppForm, installation, { advanced: false });
    applySokratesFormState(sokratesAppManageForm, installation, { advanced: true });
    syncSokratesAppAllowlistVisibility();
    if (!installed) {
      closeSokratesManagePanel();
    }
  };

  invitePeopleForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!serverId) {
      return;
    }
    setStatusText(invitePeopleStatus, '');
    const formData = new FormData(invitePeopleForm);
    const payload = {
      expiresOption: String(formData.get('expiresOption') || '1d'),
      maxUses: Number(formData.get('maxUses') || 0),
      requireVerification: formData.get('requireVerification') === 'on'
    };
    setButtonLoading(invitePeopleSubmitBtn, true, 'Creating...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/invites`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Invite konnte nicht erstellt werden.'));
      }
      const inviteUrl = buildInviteUrl(data.invite || {});
      if (invitePeopleLink) {
        invitePeopleLink.value = inviteUrl;
      }
      if (invitePeopleCopyBtn) {
        invitePeopleCopyBtn.disabled = !inviteUrl;
      }
      prependInviteToList(data.invite || {});
      setStatusText(invitePeopleStatus, 'Invite-Link erstellt.', 'ok');
      showServerToast('Invite-Link erstellt');
    } catch (error) {
      setStatusText(invitePeopleStatus, error.message || 'Invite konnte nicht erstellt werden.', 'error');
      showServerToast(error.message || 'Invite konnte nicht erstellt werden.', { tone: 'error' });
    } finally {
      setButtonLoading(invitePeopleSubmitBtn, false);
    }
  });

  invitePeopleCopyBtn?.addEventListener('click', async () => {
    const value = String(invitePeopleLink?.value || '').trim();
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      showServerToast('Invite-Link kopiert');
    } catch (error) {
      showServerToast('Kopieren fehlgeschlagen.', { tone: 'error' });
    }
  });

  notificationSettingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!serverId) {
      return;
    }
    setStatusText(notificationSettingsStatus, '');
    const formData = new FormData(notificationSettingsForm);
    const payload = {
      muteDuration: String(formData.get('muteDuration') || 'off'),
      notificationLevel: String(formData.get('notificationLevel') || 'mentions'),
      suppressEveryone: formData.get('suppressEveryone') === 'on',
      suppressHere: formData.get('suppressHere') === 'on'
    };
    setButtonLoading(notificationSettingsSubmitBtn, true, 'Saving...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/settings/notifications`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Notification Settings konnten nicht gespeichert werden.'));
      }
      setStatusText(notificationSettingsStatus, 'Saved.', 'ok');
      showServerToast('Notification Settings saved');
      closeServerModal();
    } catch (error) {
      setStatusText(notificationSettingsStatus, error.message || 'Speichern fehlgeschlagen.', 'error');
      showServerToast(error.message || 'Speichern fehlgeschlagen.', { tone: 'error' });
    } finally {
      setButtonLoading(notificationSettingsSubmitBtn, false);
    }
  });

  privacySettingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!serverId) {
      return;
    }
    setStatusText(privacySettingsStatus, '');
    const formData = new FormData(privacySettingsForm);
    const payload = {
      dmPermission: String(formData.get('dmPermission') || 'friends'),
      explicitFilter: String(formData.get('explicitFilter') || 'safe')
    };
    setButtonLoading(privacySettingsSubmitBtn, true, 'Saving...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/settings/privacy`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Privacy Settings konnten nicht gespeichert werden.'));
      }
      setStatusText(privacySettingsStatus, 'Saved.', 'ok');
      showServerToast('Privacy Settings saved');
      closeServerModal();
    } catch (error) {
      setStatusText(privacySettingsStatus, error.message || 'Speichern fehlgeschlagen.', 'error');
      showServerToast(error.message || 'Speichern fehlgeschlagen.', { tone: 'error' });
    } finally {
      setButtonLoading(privacySettingsSubmitBtn, false);
    }
  });

  createChannelForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!serverId) {
      return;
    }
    setStatusText(createChannelStatus, '');
    const formData = new FormData(createChannelForm);
    const payload = {
      type: String(formData.get('type') || 'text'),
      name: String(formData.get('name') || ''),
      topic: String(formData.get('topic') || ''),
      categoryId: String(formData.get('categoryId') || '')
    };
    setButtonLoading(createChannelSubmitBtn, true, 'Creating...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/channels`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Channel konnte nicht erstellt werden.'));
      }
      closeServerModal();
      window.location.assign(data.redirectUrl || `/app/servers/${serverId}`);
    } catch (error) {
      setStatusText(createChannelStatus, error.message || 'Channel konnte nicht erstellt werden.', 'error');
      showServerToast(error.message || 'Channel konnte nicht erstellt werden.', { tone: 'error' });
    } finally {
      setButtonLoading(createChannelSubmitBtn, false);
    }
  });

  createCategoryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!serverId) {
      return;
    }
    setStatusText(createCategoryStatus, '');
    const formData = new FormData(createCategoryForm);
    const payload = {
      name: String(formData.get('name') || '')
    };
    setButtonLoading(createCategorySubmitBtn, true, 'Creating...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/categories`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Kategorie konnte nicht erstellt werden.'));
      }
      setStatusText(createCategoryStatus, 'Kategorie erstellt. Aktualisiere Ansicht…', 'ok');
      showServerToast('Category created');
      setTimeout(() => {
        window.location.assign(window.location.href);
      }, 140);
    } catch (error) {
      setStatusText(createCategoryStatus, error.message || 'Kategorie konnte nicht erstellt werden.', 'error');
      showServerToast(error.message || 'Kategorie konnte nicht erstellt werden.', { tone: 'error' });
    } finally {
      setButtonLoading(createCategorySubmitBtn, false);
    }
  });

  sokratesAppChannelScopeInput?.addEventListener('change', () => {
    syncSokratesAppAllowlistVisibility();
  });
  sokratesAppManageChannelScopeInput?.addEventListener('change', () => {
    syncSokratesAppAllowlistVisibility();
  });
  sokratesAppManageCloseBtn?.addEventListener('click', () => {
    closeSokratesManagePanel({ restoreFocus: true });
  });

  sokratesAppForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!serverId) {
      return;
    }
    setStatusText(sokratesAppStatus, '');
    const payload = collectSokratesPayload(sokratesAppForm, { advanced: false });

    const wasInstalled = Boolean(sokratesAppState?.installed);
    setButtonLoading(sokratesAppSubmitBtn, true, wasInstalled ? 'Saving...' : 'Installing...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/apps/sokrates`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Sokrates konnte nicht gespeichert werden.'));
      }
      syncSokratesAppUi(data.installation || null);
      setStatusText(sokratesAppStatus, wasInstalled ? 'Saved.' : 'Installed.', 'ok');
      showServerToast(wasInstalled ? 'Sokrates gespeichert' : 'Sokrates installiert');
      closeServerModal();
    } catch (error) {
      setStatusText(sokratesAppStatus, error.message || 'Sokrates konnte nicht gespeichert werden.', 'error');
      showServerToast(error.message || 'Sokrates konnte nicht gespeichert werden.', { tone: 'error' });
    } finally {
      setButtonLoading(sokratesAppSubmitBtn, false);
    }
  });

  sokratesAppManageForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!serverId) {
      return;
    }
    setStatusText(sokratesAppManageStatus, '');
    const payload = collectSokratesPayload(sokratesAppManageForm, { advanced: true });

    setButtonLoading(sokratesAppManageSubmitBtn, true, 'Saving...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/apps/sokrates`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Sokrates konnte nicht gespeichert werden.'));
      }
      syncSokratesAppUi(data.installation || null);
      setStatusText(sokratesAppManageStatus, 'Saved.', 'ok');
      showServerToast('Sokrates gespeichert');
    } catch (error) {
      setStatusText(sokratesAppManageStatus, error.message || 'Sokrates konnte nicht gespeichert werden.', 'error');
      showServerToast(error.message || 'Sokrates konnte nicht gespeichert werden.', { tone: 'error' });
    } finally {
      setButtonLoading(sokratesAppManageSubmitBtn, false);
    }
  });

  sokratesAppRemoveBtn?.addEventListener('click', async () => {
    if (!serverId) {
      return;
    }
    setStatusText(sokratesAppStatus, '');
    setButtonLoading(sokratesAppRemoveBtn, true, 'Removing...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/apps/sokrates/remove`, {});
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Sokrates konnte nicht entfernt werden.'));
      }
      syncSokratesAppUi(null);
      setStatusText(sokratesAppStatus, 'Removed.', 'ok');
      showServerToast('Sokrates entfernt');
      closeServerModal();
    } catch (error) {
      setStatusText(sokratesAppStatus, error.message || 'Sokrates konnte nicht entfernt werden.', 'error');
      showServerToast(error.message || 'Sokrates konnte nicht entfernt werden.', { tone: 'error' });
    } finally {
      setButtonLoading(sokratesAppRemoveBtn, false);
    }
  });

  sokratesAppManageRemoveBtn?.addEventListener('click', async () => {
    if (!serverId) {
      return;
    }
    setStatusText(sokratesAppManageStatus, '');
    setButtonLoading(sokratesAppManageRemoveBtn, true, 'Removing...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/apps/sokrates/remove`, {});
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Sokrates konnte nicht entfernt werden.'));
      }
      syncSokratesAppUi(null);
      setStatusText(sokratesAppManageStatus, 'Removed.', 'ok');
      showServerToast('Sokrates entfernt');
    } catch (error) {
      setStatusText(sokratesAppManageStatus, error.message || 'Sokrates konnte nicht entfernt werden.', 'error');
      showServerToast(error.message || 'Sokrates konnte nicht entfernt werden.', { tone: 'error' });
    } finally {
      setButtonLoading(sokratesAppManageRemoveBtn, false);
    }
  });

  syncSokratesAppUi(sokratesAppState);
  syncSokratesAppAllowlistVisibility();

  leaveServerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!serverId) {
      return;
    }
    setStatusText(leaveServerStatus, '');
    const formData = new FormData(leaveServerForm);
    const transferOwnerId = String(formData.get('transferOwnerId') || '').trim();
    const payload = transferOwnerId ? { transferOwnerId: Number(transferOwnerId) } : {};
    setButtonLoading(leaveServerSubmitBtn, true, 'Leaving...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/leave`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Server konnte nicht verlassen werden.'));
      }
      closeServerModal();
      window.location.assign(String(data.redirectUrl || '/app/home'));
    } catch (error) {
      setStatusText(leaveServerStatus, error.message || 'Server konnte nicht verlassen werden.', 'error');
      showServerToast(error.message || 'Server konnte nicht verlassen werden.', { tone: 'error' });
    } finally {
      setButtonLoading(leaveServerSubmitBtn, false);
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!serverMenu || !serverMenuTrigger || serverMenuState.state !== MENU_STATE_OPEN) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      closeServerMenu();
      return;
    }
    if (serverMenu.contains(target) || serverMenuTrigger.contains(target)) {
      return;
    }
    closeServerMenu();
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      closeMemberMenus();
      return;
    }

    let insideMemberMenu = false;
    memberRows.forEach((row) => {
      const menuId = row.getAttribute('data-member-menu-for');
      const menu = menuId ? document.getElementById(menuId) : null;
      if (!menu || menu.hidden) {
        return;
      }
      if (menu.contains(target) || row.contains(target)) {
        insideMemberMenu = true;
      }
    });
    if (!insideMemberMenu) {
      closeMemberMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (openModalName) {
      closeServerModal({ restoreFocus: true });
      return;
    }
    if (sokratesAppManagePanel instanceof HTMLElement && !sokratesAppManagePanel.hidden) {
      closeSokratesManagePanel({ restoreFocus: true });
      return;
    }
    closeServerMenu({ restoreFocus: true });
    closeMemberMenus();
  });

  window.addEventListener('resize', () => {
    closeServerMenu();
  });

  document.addEventListener('scroll', (event) => {
    const target = event.target;
    if (serverMenu && target instanceof Node && serverMenu.contains(target)) {
      return;
    }
    closeServerMenu();
  }, true);

  window.addEventListener('beforeunload', () => {
    closeServerMenu();
    closeServerModal();
  });
  window.addEventListener('hashchange', () => {
    closeServerMenu();
    closeServerModal();
  });
  window.addEventListener('popstate', () => {
    closeServerMenu();
    closeServerModal();
  });

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const navTarget = target.closest('a[href]');
    if (navTarget && serverMenuState.state === MENU_STATE_OPEN && !serverMenu?.contains(navTarget)) {
      closeServerMenu();
    }
    const mention = target.dataset.mention;
    if (!mention) {
      return;
    }
    event.preventDefault();
    await insertMentionIntoComposer(mention);
    closeMemberMenus();
  });

  membersToggleBtn?.addEventListener('click', () => {
    if (!membersRail) {
      return;
    }
    const nextHidden = !membersRail.hidden;
    membersRail.hidden = nextHidden;
    membersToggleBtn.setAttribute('aria-pressed', nextHidden ? 'false' : 'true');
  });
})();

(function initServerVoiceChannels() {
  const bootstrapNode = document.getElementById('serverVoiceBootstrap');
  const voiceView = document.getElementById('serverVoiceView');
  const textView = document.getElementById('serverTextView');
  const channelLinks = [...document.querySelectorAll('.server-channel-link[data-channel-id]')];
  const voiceLinks = channelLinks.filter((link) => link.dataset.channelType === 'voice');
  const countNodes = [...document.querySelectorAll('[data-voice-count-for]')];
  const previewNodes = [...document.querySelectorAll('[data-voice-preview-for]')];
  const memberListNodes = [...document.querySelectorAll('[data-voice-members-for]')];

  if (!bootstrapNode || !voiceView || !textView || !channelLinks.length) {
    return;
  }

  let bootstrap = {};
  try {
    bootstrap = JSON.parse(bootstrapNode.textContent || '{}');
  } catch (error) {
    bootstrap = {};
  }

  const parseId = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const escapeHtml = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const serverId = parseId(bootstrap.serverId);
  const currentUserId = parseId(bootstrap.currentUserId);
  const currentDisplayName = String(document.getElementById('serverCurrentDisplayName')?.value || 'Du');
  const currentAvatarUrl = String(document.getElementById('serverCurrentAvatarUrl')?.value || '').trim();
  const hostname = String(window.location.hostname || '').toLowerCase();
  const isLoopbackOrigin = hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1';
  const secureOriginRequired = bootstrap.secureOriginRequired !== false;
  const secureOriginReady = Boolean(window.isSecureContext) || isLoopbackOrigin;
  const voiceBlockedByInsecureOrigin = secureOriginRequired && !secureOriginReady;
  const externalHttpsBaseUrl = (() => {
    const raw = String(bootstrap.externalHttpsBaseUrl || '').trim();
    if (!raw) {
      return '';
    }
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'https:') {
        return '';
      }
      return parsed.origin;
    } catch (_error) {
      return '';
    }
  })();
  const fullModeUrl = (() => {
    if (window.location.protocol === 'https:') {
      return window.location.origin;
    }
    if (externalHttpsBaseUrl) {
      return externalHttpsBaseUrl;
    }
    if (!bootstrap.httpsEnabled) {
      return '';
    }
    const httpsPort = Number(bootstrap.httpsPort || 0);
    if (!Number.isFinite(httpsPort) || httpsPort <= 0) {
      return '';
    }
    const includePort = httpsPort !== 443;
    return includePort
      ? `https://${window.location.hostname}:${httpsPort}`
      : `https://${window.location.hostname}`;
  })();
  const realtimePath = String(bootstrap.realtimePath || '/app/voice/realtime').trim() || '/app/voice/realtime';
  const turnRequired = bootstrap.turnRequired !== false;
  const turnConfigured = Boolean(bootstrap.turnConfigured);
  const normalizeIceServerEntry = (entry) => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const urls = Array.isArray(entry.urls)
      ? entry.urls.map((value) => String(value || '').trim()).filter(Boolean)
      : [String(entry.urls || '').trim()].filter(Boolean);
    if (!urls.length) {
      return null;
    }
    const normalized = { urls: urls.length === 1 ? urls[0] : urls };
    if (entry.username) {
      normalized.username = String(entry.username);
    }
    if (entry.credential) {
      normalized.credential = String(entry.credential);
    }
    return normalized;
  };
  const configuredIceServers = (Array.isArray(bootstrap.iceServers) ? bootstrap.iceServers : [])
    .map((entry) => normalizeIceServerEntry(entry))
    .filter(Boolean);
  const voiceIceServers = configuredIceServers.length
    ? configuredIceServers
    : [{ urls: 'stun:stun.l.google.com:19302' }];
  const initialVoiceChannelId = String(bootstrap.selectedChannelType || '') === 'voice'
    ? parseId(bootstrap.selectedChannelId)
    : 0;
  const initialTextChannelId = parseId(document.querySelector('.server-channel-link[data-channel-type="text"].active')?.dataset.channelId)
    || parseId(bootstrap.fallbackTextChannelId);
  const countNodeByChannelId = new Map(countNodes.map((node) => [parseId(node.dataset.voiceCountFor), node]));
  const previewNodeByChannelId = new Map(previewNodes.map((node) => [parseId(node.dataset.voicePreviewFor), node]));
  const memberListByChannelId = new Map(memberListNodes.map((node) => [parseId(node.dataset.voiceMembersFor), node]));
  const blockNodes = [...document.querySelectorAll('[data-voice-channel-block]')];

  const channelsById = new Map((Array.isArray(bootstrap.channels) ? bootstrap.channels : []).map((channel) => [parseId(channel.id), {
    id: parseId(channel.id),
    name: String(channel.name || 'Voice'),
    topic: String(channel.topic || ''),
    participants: Array.isArray(channel.participants) ? channel.participants : []
  }]));

  if (!voiceLinks.length && !channelsById.size) {
    return;
  }

  const state = {
    voiceConnectionState: 'DISCONNECTED',
    voicePanelOpen: Boolean(initialVoiceChannelId),
    targetChannelId: initialVoiceChannelId,
    currentChannelId: 0,
    sessionId: '',
    joinRequestStartedAt: 0,
    ws: null,
    wsConnectPromise: null,
    wsReconnectTimerId: 0,
    wsReconnectAttempts: 0,
    wsWanted: true,
    wsStateLabel: 'idle',
    pendingJoinRequest: null,
    peerWarning: '',
    peerConnections: new Map(),
    connectedPeerIds: new Set(),
    seenSignalIds: new Set(),
    seenSignalOrder: [],
    audioNodes: new Map(),
    localStream: null,
    audioContext: null,
    analyser: null,
    meterFrameId: 0,
    smoothedLevel: 0,
    localSpeaking: false,
    errorCode: '',
    errorMessage: '',
    networkIssue: false,
    micPermissionState: 'unknown',
    lastActiveTextChannelId: initialTextChannelId,
    localAudioState: {
      micEnabled: true,
      deafened: false,
      pushToTalk: false,
      inputDeviceId: '',
      outputDeviceId: ''
    },
    permissions: {
      canJoinVoice: Boolean(bootstrap.permissions?.canJoinVoice),
      canSpeak: Boolean(bootstrap.permissions?.canSpeak)
    }
  };

  try {
    const storedPrefs = JSON.parse(window.localStorage.getItem('apeiron.voice.prefs') || '{}');
    if (typeof storedPrefs.micEnabled === 'boolean') {
      state.localAudioState.micEnabled = storedPrefs.micEnabled;
    } else {
      state.localAudioState.micEnabled = Boolean(bootstrap.permissions?.canSpeak);
    }
    if (typeof storedPrefs.deafened === 'boolean') {
      state.localAudioState.deafened = storedPrefs.deafened;
    }
  } catch (error) {
    state.localAudioState.micEnabled = Boolean(bootstrap.permissions?.canSpeak);
  }
  if (!state.permissions.canSpeak) {
    state.localAudioState.micEnabled = false;
  }

  const persistVoicePrefs = () => {
    try {
      window.localStorage.setItem('apeiron.voice.prefs', JSON.stringify({
        micEnabled: state.localAudioState.micEnabled,
        deafened: state.localAudioState.deafened
      }));
    } catch (error) {
      // Ignore storage failures.
    }
  };

  const audioRoot = (() => {
    let root = document.getElementById('voiceAudioRoot');
    if (root) {
      return root;
    }
    root = document.createElement('div');
    root.id = 'voiceAudioRoot';
    root.hidden = true;
    document.body.appendChild(root);
    return root;
  })();

  const postJson = async (url, payload = {}, options = {}) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: Boolean(options.keepalive),
      signal: options.signal || undefined
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const getJson = async (url) => {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const mapVoiceErrorMessage = (code, fallbackMessage = '') => {
    const safeCode = String(code || '').trim().toLowerCase();
    if (safeCode === 'voice_requires_https' || safeCode === 'secure_origin_required') {
      return fullModeUrl
        ? `Voice benötigt HTTPS im LAN. Öffne ${fullModeUrl}`
        : 'Voice benötigt HTTPS im LAN.';
    }
    if (safeCode === 'turn_required') {
      return 'Voice benötigt TURN-Konfiguration auf dem Server.';
    }
    if (safeCode === 'join_timeout') {
      return 'Voice join timed out. Signaling did not respond in time.';
    }
    if (safeCode === 'session_missing') {
      return 'Voice session expired.';
    }
    if (safeCode === 'mic_denied') {
      return 'Microphone access denied';
    }
    if (safeCode === 'mic_failed') {
      return 'Microphone could not be started.';
    }
    if (safeCode === 'realtime_unavailable' || safeCode === 'realtime_closed') {
      return 'Voice signaling connection failed.';
    }
    return String(fallbackMessage || 'Voice operation failed.');
  };

  const buildVoiceRealtimeUrl = () => {
    const normalizedPath = realtimePath.startsWith('/') ? realtimePath : `/${realtimePath}`;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${normalizedPath}`;
  };

  const getVisibleVoiceChannelId = () => state.currentChannelId || state.targetChannelId;

  const getVoiceChannel = (channelId) => channelsById.get(parseId(channelId)) || null;

  const getChannelParticipants = (channelId) => getVoiceChannel(channelId)?.participants || [];

  const setServerPresence = (presence) => {
    if (!Array.isArray(presence)) {
      return;
    }
    presence.forEach((entry) => {
      const channel = channelsById.get(parseId(entry.id));
      if (!channel) {
        return;
      }
      channel.participants = Array.isArray(entry.participants) ? entry.participants : [];
    });
  };

  const participantTone = (participant) => {
    if (participant.user_id === currentUserId) {
      if (!state.permissions.canSpeak) {
        return 'Listening only';
      }
      if (participant.deafened) {
        return 'Deafened';
      }
      if (participant.muted) {
        return 'Muted';
      }
      return participant.speaking ? 'Speaking' : 'Mic live';
    }
    if (participant.deafened) {
      return 'Deafened';
    }
    if (participant.muted) {
      return 'Muted';
    }
    return participant.speaking ? 'Speaking' : 'Connected';
  };

  const applyLocalParticipantState = () => {
    const channel = getVoiceChannel(state.currentChannelId || state.targetChannelId);
    if (!channel) {
      return;
    }
    channel.participants = channel.participants.map((participant) => (
      String(participant.session_id || '') !== state.sessionId
        ? participant
        : {
            ...participant,
            speaking: Boolean(state.localSpeaking && state.permissions.canSpeak && state.localAudioState.micEnabled && !state.localAudioState.deafened),
            muted: Boolean(!state.permissions.canSpeak || !state.localAudioState.micEnabled || state.localAudioState.deafened),
            deafened: Boolean(state.localAudioState.deafened)
          }
    ));
  };

  const renderParticipantAvatar = (participant) => {
    const fallback = escapeHtml(String(participant.displayname || '?').trim().slice(0, 2).toUpperCase() || '?');
    const avatarUrl = escapeHtml(String(participant.avatar_url || '').trim());
    if (avatarUrl) {
      return `<img src="${avatarUrl}" alt="${escapeHtml(participant.displayname)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" /><span class="avatar-fallback" hidden>${fallback}</span>`;
    }
    return `<span class="avatar-fallback">${fallback}</span>`;
  };

  const renderVoiceChannelPresence = () => {
    channelsById.forEach((channel, channelId) => {
      const participants = Array.isArray(channel.participants) ? channel.participants : [];
      const countNode = countNodeByChannelId.get(channelId);
      const previewNode = previewNodeByChannelId.get(channelId);
      const memberListNode = memberListByChannelId.get(channelId);
      const blockNode = blockNodes.find((node) => parseId(node.dataset.voiceChannelBlock) === channelId);
      if (countNode) {
        countNode.textContent = String(participants.length);
      }
      if (previewNode) {
        previewNode.innerHTML = participants.slice(0, 3).map((participant) => {
          const fallback = escapeHtml(String(participant.displayname || '?').trim().slice(0, 1).toUpperCase() || '?');
          const avatarUrl = escapeHtml(String(participant.avatar_url || '').trim());
          if (avatarUrl) {
            return `<span class="voice-mini-avatar"><img src="${avatarUrl}" alt="${escapeHtml(participant.displayname)}" loading="lazy" /></span>`;
          }
          return `<span class="voice-mini-avatar"><span class="voice-mini-fallback">${fallback}</span></span>`;
        }).join('');
      }
      if (memberListNode) {
        memberListNode.classList.toggle('is-populated', participants.length > 0);
        memberListNode.innerHTML = participants.map((participant) => `
          <div class="voice-member-row ${participant.user_id === currentUserId ? 'is-self' : ''} ${participant.speaking ? 'is-speaking' : ''}" data-testid="voice-member-row" data-voice-member-id="${participant.user_id}" data-presence-user-id="${participant.user_id}" data-presence-status="${escapeHtml(participant.status || 'offline')}" data-presence-last-seen="${escapeHtml(participant.last_seen || '')}">
            <span class="avatar voice-member-avatar">${renderParticipantAvatar(participant)}<span class="status-dot ${escapeHtml(participant.status || 'offline')}" data-presence-dot></span></span>
            <span class="voice-member-copy">
              <span class="voice-member-name">${escapeHtml(participant.displayname)}</span>
              <span class="voice-member-presence" data-presence-text>${escapeHtml(participant.status_label || participant.status || 'offline')}</span>
            </span>
            <span class="voice-member-flags" aria-hidden="true">${participant.muted ? '🎤' : ''}${participant.deafened ? '🔇' : ''}</span>
          </div>
        `).join('');
      }
      if (blockNode) {
        const isActive = state.voicePanelOpen && getVisibleVoiceChannelId() === channelId;
        blockNode.classList.toggle('active', isActive);
      }
    });
  };

  const syncChannelSelection = () => {
    const activeVoiceChannelId = state.voicePanelOpen ? getVisibleVoiceChannelId() : 0;
    const activeChannelId = activeVoiceChannelId || state.lastActiveTextChannelId;
    channelLinks.forEach((link) => {
      const isActive = parseId(link.dataset.channelId) === activeChannelId;
      link.classList.toggle('active', isActive);
    });
    blockNodes.forEach((node) => {
      node.classList.toggle('active', parseId(node.dataset.voiceChannelBlock) === activeVoiceChannelId);
    });
  };

  const recomputeVoiceState = () => {
    if (!state.sessionId) {
      state.voiceConnectionState = state.errorMessage ? 'ERROR' : 'DISCONNECTED';
      return;
    }
    if (state.networkIssue) {
      state.voiceConnectionState = 'RECONNECTING';
      return;
    }
    state.voiceConnectionState = 'CONNECTED';
  };

  const closeRemoteAudio = (sessionId) => {
    const audio = state.audioNodes.get(String(sessionId));
    if (!audio) {
      return;
    }
    audio.pause();
    audio.remove();
    state.audioNodes.delete(String(sessionId));
  };

  const closePeerConnection = (sessionId) => {
    const entry = state.peerConnections.get(String(sessionId));
    if (!entry) {
      return;
    }
    if (entry.connectTimeoutId) {
      window.clearTimeout(entry.connectTimeoutId);
      entry.connectTimeoutId = 0;
    }
    entry.pc.ontrack = null;
    entry.pc.onicecandidate = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.oniceconnectionstatechange = null;
    entry.pc.close();
    state.peerConnections.delete(String(sessionId));
    state.connectedPeerIds.delete(String(sessionId));
    closeRemoteAudio(sessionId);
  };

  const closeAllPeerConnections = () => {
    [...state.peerConnections.keys()].forEach((sessionId) => closePeerConnection(sessionId));
  };

  const syncLocalTrackState = () => {
    if (!state.localStream) {
      return;
    }
    const enabled = Boolean(state.permissions.canSpeak && state.localAudioState.micEnabled && !state.localAudioState.deafened);
    state.localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  };

  const stopVoiceMeter = () => {
    if (state.meterFrameId) {
      window.cancelAnimationFrame(state.meterFrameId);
      state.meterFrameId = 0;
    }
    if (state.audioContext) {
      state.audioContext.close().catch(() => {});
      state.audioContext = null;
    }
    state.analyser = null;
    state.smoothedLevel = 0;
    state.localSpeaking = false;
  };

  const pushLocalVoiceState = async () => {
    if (!state.sessionId) {
      return;
    }
    const muted = !state.permissions.canSpeak || !state.localAudioState.micEnabled || state.localAudioState.deafened;
    applyLocalParticipantState();
    renderVoiceChannelPresence();
    renderVoiceView();
    await sendVoiceWs({
      type: 'voice_state',
      sessionId: state.sessionId,
      speaking: !muted && state.localSpeaking,
      audioLevel: muted ? 0 : state.smoothedLevel,
      muted,
      deafened: state.localAudioState.deafened
    }).catch(() => {});
  };

  const startVoiceMeter = () => {
    stopVoiceMeter();
    if (!state.localStream || !state.permissions.canSpeak) {
      return;
    }
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    try {
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(state.localStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      state.audioContext = audioContext;
      state.analyser = analyser;
    } catch (error) {
      stopVoiceMeter();
      return;
    }

    const samples = new Uint8Array(state.analyser.frequencyBinCount);
    let lastTransmitAt = 0;
    const tick = () => {
      if (!state.analyser) {
        return;
      }
      state.analyser.getByteTimeDomainData(samples);
      let total = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const normalized = (samples[i] - 128) / 128;
        total += normalized * normalized;
      }
      const rms = Math.sqrt(total / samples.length);
      state.smoothedLevel = state.smoothedLevel * 0.82 + rms * 0.18;
      const muted = !state.permissions.canSpeak || !state.localAudioState.micEnabled || state.localAudioState.deafened;
      const nextSpeaking = muted
        ? false
        : (state.localSpeaking ? state.smoothedLevel > 0.028 : state.smoothedLevel > 0.05);
      const now = Date.now();
      if (nextSpeaking !== state.localSpeaking || now - lastTransmitAt > 300) {
        state.localSpeaking = nextSpeaking;
        lastTransmitAt = now;
        pushLocalVoiceState();
        renderVoiceChannelPresence();
        renderVoiceView();
      }
      state.meterFrameId = window.requestAnimationFrame(tick);
    };
    state.meterFrameId = window.requestAnimationFrame(tick);
  };

  const releaseLocalMedia = () => {
    stopVoiceMeter();
    if (!state.localStream) {
      return;
    }
    state.localStream.getTracks().forEach((track) => track.stop());
    state.localStream = null;
  };

  const ensureMicrophone = async () => {
    if (!state.permissions.canSpeak) {
      state.micPermissionState = 'disabled';
      return null;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      const error = new Error('unsupported');
      error.name = 'NotSupportedError';
      throw error;
    }
    if (state.localStream) {
      syncLocalTrackState();
      return state.localStream;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    const track = stream.getAudioTracks()[0];
    state.localStream = stream;
    state.micPermissionState = 'granted';
    state.localAudioState.inputDeviceId = String(track?.getSettings?.().deviceId || '');
    syncLocalTrackState();
    startVoiceMeter();
    return stream;
  };

  const ensureRemoteAudio = (sessionId, stream) => {
    const key = String(sessionId);
    let audio = state.audioNodes.get(key);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audioRoot.appendChild(audio);
      state.audioNodes.set(key, audio);
    }
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
      audio.play().catch(() => {});
    }
    audio.muted = Boolean(state.localAudioState.deafened);
    audio.volume = state.localAudioState.deafened ? 0 : 1;
  };

  const syncRemoteAudioState = () => {
    state.audioNodes.forEach((audio) => {
      audio.muted = Boolean(state.localAudioState.deafened);
      audio.volume = state.localAudioState.deafened ? 0 : 1;
    });
  };

  const clearPendingJoinRequest = () => {
    if (!state.pendingJoinRequest) {
      return null;
    }
    const pending = state.pendingJoinRequest;
    state.pendingJoinRequest = null;
    if (pending.timeoutId) {
      window.clearTimeout(pending.timeoutId);
    }
    return pending;
  };

  const settlePendingJoinRequest = (result) => {
    const pending = clearPendingJoinRequest();
    if (!pending) {
      return false;
    }
    if (result instanceof Error) {
      pending.reject(result);
    } else {
      pending.resolve(result);
    }
    return true;
  };

  const scheduleVoiceWsReconnect = () => {
    if (!state.wsWanted || state.wsReconnectTimerId) {
      return;
    }
    const delayMs = Math.min(5000, 350 + (state.wsReconnectAttempts * 450));
    state.wsReconnectTimerId = window.setTimeout(() => {
      state.wsReconnectTimerId = 0;
      ensureVoiceWs().catch(() => {});
    }, delayMs);
  };

  const sendVoiceWs = async (payload) => {
    const ws = await ensureVoiceWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('realtime_unavailable');
    }
    ws.send(JSON.stringify(payload || {}));
  };

  const requestVoiceJoinOverWs = (channelId) => new Promise((resolve, reject) => {
    settlePendingJoinRequest(new Error('join_replaced'));
    const timeoutId = window.setTimeout(() => {
      if (!state.pendingJoinRequest) {
        return;
      }
      settlePendingJoinRequest(new Error('join_timeout'));
    }, 10000);
    state.pendingJoinRequest = {
      resolve,
      reject,
      timeoutId
    };
    sendVoiceWs({
      type: 'voice_join',
      serverId,
      channelId
    }).catch((error) => {
      settlePendingJoinRequest(error instanceof Error ? error : new Error('realtime_unavailable'));
    });
  });

  const sendSignal = async (targetSessionId, payload) => {
    if (!state.sessionId) {
      return;
    }
    await sendVoiceWs({
      type: 'voice_signal',
      sessionId: state.sessionId,
      targetSessionId,
      description: payload.description || null,
      candidate: payload.candidate || null
    }).catch(() => {});
  };

  const onPeerConnectivityChange = (remoteSessionId, pc) => {
    const connected = ['connected', 'completed'].includes(String(pc.connectionState || '').toLowerCase())
      || ['connected', 'completed'].includes(String(pc.iceConnectionState || '').toLowerCase());
    const entry = state.peerConnections.get(String(remoteSessionId));
    if (connected) {
      state.connectedPeerIds.add(String(remoteSessionId));
      if (entry?.connectTimeoutId) {
        window.clearTimeout(entry.connectTimeoutId);
        entry.connectTimeoutId = 0;
      }
      state.peerWarning = '';
    } else {
      state.connectedPeerIds.delete(String(remoteSessionId));
    }
    if (['failed'].includes(String(pc.connectionState || '').toLowerCase()) || ['failed'].includes(String(pc.iceConnectionState || '').toLowerCase())) {
      state.peerWarning = 'Peer audio failed. Check ICE/TURN connectivity.';
    }
    if (['failed', 'closed', 'disconnected'].includes(String(pc.connectionState || '').toLowerCase())) {
      closeRemoteAudio(remoteSessionId);
    }
    recomputeVoiceState();
    renderVoiceView();
  };

  const ensurePeerConnection = (participant) => {
    const remoteSessionId = String(participant.session_id || '');
    if (!remoteSessionId || remoteSessionId === state.sessionId) {
      return null;
    }
    const existing = state.peerConnections.get(remoteSessionId);
    if (existing) {
      existing.participant = participant;
      return existing;
    }

    if (typeof RTCPeerConnection !== 'function') {
      state.errorCode = 'webrtc_missing';
      state.errorMessage = 'WebRTC is not available in this browser.';
      recomputeVoiceState();
      renderVoiceView();
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: voiceIceServers
    });

    const entry = {
      participant,
      pc,
      startedOffer: false,
      makingOffer: false,
      connectTimeoutId: 0,
      pendingCandidates: []
    };

    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, state.localStream);
      });
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.ontrack = (event) => {
      const remoteStream = event.streams?.[0];
      if (remoteStream) {
        ensureRemoteAudio(remoteSessionId, remoteStream);
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      sendSignal(remoteSessionId, {
        candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
      });
    };

    pc.onconnectionstatechange = () => onPeerConnectivityChange(remoteSessionId, pc);
    pc.oniceconnectionstatechange = () => onPeerConnectivityChange(remoteSessionId, pc);

    state.peerConnections.set(remoteSessionId, entry);
    entry.connectTimeoutId = window.setTimeout(() => {
      if (state.connectedPeerIds.has(remoteSessionId) || !state.peerConnections.has(remoteSessionId)) {
        return;
      }
      state.peerWarning = 'Peer audio timed out. The room is connected, but direct audio did not establish.';
      renderVoiceView();
    }, 12000);
    return entry;
  };

  const flushPendingCandidates = async (entry) => {
    if (!entry?.pc?.remoteDescription || !entry.pendingCandidates.length) {
      return;
    }
    const queued = [...entry.pendingCandidates];
    entry.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await entry.pc.addIceCandidate(candidate);
      } catch (error) {
        // Ignore stale candidates.
      }
    }
  };

  const createOfferFor = async (participant) => {
    const remoteSessionId = String(participant.session_id || '');
    if (!remoteSessionId || remoteSessionId === state.sessionId || state.sessionId >= remoteSessionId) {
      return;
    }
    const entry = ensurePeerConnection(participant);
    if (!entry || entry.startedOffer || entry.makingOffer) {
      return;
    }
    entry.makingOffer = true;
    try {
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      entry.startedOffer = true;
      await sendSignal(remoteSessionId, {
        description: entry.pc.localDescription?.toJSON ? entry.pc.localDescription.toJSON() : entry.pc.localDescription
      });
    } catch (error) {
      entry.startedOffer = false;
    } finally {
      entry.makingOffer = false;
    }
  };

  const handleIncomingSignal = async (signal) => {
    const signalId = String(signal?.signal_id || '');
    if (signalId) {
      if (state.seenSignalIds.has(signalId)) {
        return;
      }
      state.seenSignalIds.add(signalId);
      state.seenSignalOrder.push(signalId);
      if (state.seenSignalOrder.length > 300) {
        const staleSignalId = state.seenSignalOrder.shift();
        if (staleSignalId) {
          state.seenSignalIds.delete(staleSignalId);
        }
      }
    }
    const remoteSessionId = String(signal?.from_session_id || '');
    if (!remoteSessionId || remoteSessionId === state.sessionId) {
      return;
    }
    const participant = getChannelParticipants(state.currentChannelId).find((entry) => String(entry.session_id) === remoteSessionId)
      || {
        session_id: remoteSessionId,
        user_id: 0,
        displayname: 'Voice peer',
        avatar_url: '',
        speaking: false,
        muted: false,
        deafened: false,
        status: 'online'
      };
    const entry = ensurePeerConnection(participant);
    if (!entry) {
      return;
    }
    try {
      if (signal.description) {
        const description = new RTCSessionDescription(signal.description);
        if (description.type === 'offer') {
          await entry.pc.setRemoteDescription(description);
          await flushPendingCandidates(entry);
          const answer = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(answer);
          await sendSignal(remoteSessionId, {
            description: entry.pc.localDescription?.toJSON ? entry.pc.localDescription.toJSON() : entry.pc.localDescription
          });
          return;
        }
        if (description.type === 'answer') {
          await entry.pc.setRemoteDescription(description);
          await flushPendingCandidates(entry);
          return;
        }
      }
      if (signal.candidate) {
        if (!entry.pc.remoteDescription) {
          entry.pendingCandidates.push(signal.candidate);
          return;
        }
        await entry.pc.addIceCandidate(signal.candidate);
      }
    } catch (error) {
      // Ignore transient signaling errors and continue syncing.
    }
  };

  const reconcilePeers = async (participants) => {
    const remoteParticipants = participants.filter((participant) => String(participant.session_id || '') !== state.sessionId);
    const activeSessionIds = new Set(remoteParticipants.map((participant) => String(participant.session_id)));
    [...state.peerConnections.keys()].forEach((remoteSessionId) => {
      if (!activeSessionIds.has(String(remoteSessionId))) {
        closePeerConnection(remoteSessionId);
      }
    });
    for (const participant of remoteParticipants) {
      ensurePeerConnection(participant);
    }
    for (const participant of remoteParticipants) {
      // eslint-disable-next-line no-await-in-loop
      await createOfferFor(participant);
    }
  };

  const removeSelfFromChannel = (channelId, sessionId) => {
    const channel = getVoiceChannel(channelId);
    if (!channel) {
      return;
    }
    channel.participants = channel.participants.filter((participant) => String(participant.session_id || '') !== String(sessionId || ''));
  };

  const applyRealtimeSyncPayload = async (payload = {}) => {
    state.networkIssue = false;
    setServerPresence(payload.serverPresence);
    if (Array.isArray(payload.participants) && payload.room?.voice_channel_id) {
      const activeChannel = getVoiceChannel(payload.room.voice_channel_id);
      if (activeChannel) {
        activeChannel.participants = payload.participants;
        if (activeChannel.participants.filter((participant) => String(participant.session_id || '') !== state.sessionId).length === 0) {
          state.peerWarning = '';
        }
      }
    }
    if (Array.isArray(payload.signals)) {
      for (const signal of payload.signals) {
        // eslint-disable-next-line no-await-in-loop
        await handleIncomingSignal(signal);
      }
    }
    await reconcilePeers(getChannelParticipants(state.currentChannelId));
    recomputeVoiceState();
    renderVoiceView();
  };

  const handleVoiceWsMessage = async (rawMessage) => {
    let payload = null;
    try {
      payload = JSON.parse(String(rawMessage || '{}'));
    } catch (_error) {
      return;
    }
    const type = String(payload?.type || '').trim().toLowerCase();
    if (!type) {
      return;
    }

    if (type === 'voice_ready') {
      state.networkIssue = false;
      if (Boolean(payload.turnRequired) && !Boolean(payload.turnConfigured)) {
        state.errorCode = 'turn_required';
        state.errorMessage = mapVoiceErrorMessage('turn_required');
      }
      recomputeVoiceState();
      renderVoiceView();
      return;
    }

    if (type === 'voice_presence') {
      setServerPresence(payload.channels);
      renderVoiceChannelPresence();
      if (!state.voicePanelOpen) {
        syncChannelSelection();
      } else {
        renderVoiceView();
      }
      if (state.sessionId) {
        await reconcilePeers(getChannelParticipants(state.currentChannelId));
      }
      return;
    }

    if (type === 'voice_synced') {
      await applyRealtimeSyncPayload(payload);
      return;
    }

    if (type === 'voice_signal' && payload.signal) {
      await handleIncomingSignal(payload.signal);
      return;
    }

    if (type === 'voice_joined') {
      settlePendingJoinRequest(payload);
      return;
    }

    if (type === 'voice_left') {
      if (String(payload.sessionId || '') === state.sessionId) {
        await disconnectVoice({ notifyServer: false, preservePanel: true });
      }
      return;
    }

    if (type === 'voice_ping') {
      sendVoiceWs({ type: 'voice_pong', ts: Date.now() }).catch(() => {});
      return;
    }

    if (type === 'voice_error') {
      const code = String(payload.code || 'voice_error');
      const message = mapVoiceErrorMessage(code, payload.message || 'Voice operation failed.');
      if (settlePendingJoinRequest(new Error(code))) {
        return;
      }
      if (code === 'session_missing' && state.sessionId) {
        const failedChannelId = state.currentChannelId || state.targetChannelId;
        await disconnectVoice({ notifyServer: false, releaseMedia: true, preservePanel: false });
        state.errorCode = code;
        state.errorMessage = message;
        state.voiceConnectionState = 'ERROR';
        state.voicePanelOpen = true;
        state.targetChannelId = failedChannelId;
        renderVoiceView();
        return;
      }
      state.errorCode = code;
      state.errorMessage = message;
      if (!state.sessionId) {
        state.voiceConnectionState = 'ERROR';
      }
      renderVoiceView();
    }
  };

  const closeVoiceWs = ({ manual = false } = {}) => {
    if (manual) {
      state.wsWanted = false;
    }
    if (state.wsReconnectTimerId) {
      window.clearTimeout(state.wsReconnectTimerId);
      state.wsReconnectTimerId = 0;
    }
    state.wsConnectPromise = null;
    const ws = state.ws;
    state.ws = null;
    state.wsStateLabel = manual ? 'closed' : state.wsStateLabel;
    if (!ws) {
      return;
    }
    try {
      ws.close();
    } catch (_error) {
      // Ignore socket close failures.
    }
  };

  const ensureVoiceWs = async () => {
    if (typeof WebSocket !== 'function') {
      throw new Error('realtime_unavailable');
    }
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      return state.ws;
    }
    if (state.wsConnectPromise) {
      return state.wsConnectPromise;
    }

    state.wsWanted = true;
    const wsUrl = buildVoiceRealtimeUrl();
    state.wsStateLabel = 'connecting';
    state.wsConnectPromise = new Promise((resolve, reject) => {
      let opened = false;
      let settled = false;
      const ws = new WebSocket(wsUrl);
      state.ws = ws;

      ws.addEventListener('open', () => {
        opened = true;
        state.wsConnectPromise = null;
        state.wsReconnectAttempts = 0;
        state.networkIssue = false;
        state.wsStateLabel = 'open';
        recomputeVoiceState();
        renderVoiceView();
        ws.send(JSON.stringify({
          type: 'voice_subscribe',
          serverId
        }));
        if (state.sessionId) {
          const muted = !state.permissions.canSpeak || !state.localAudioState.micEnabled || state.localAudioState.deafened;
          ws.send(JSON.stringify({
            type: 'voice_resync',
            sessionId: state.sessionId,
            muted,
            deafened: state.localAudioState.deafened
          }));
        }
        settled = true;
        resolve(ws);
      });

      ws.addEventListener('message', (event) => {
        handleVoiceWsMessage(event.data).catch(() => {});
      });

      ws.addEventListener('close', () => {
        if (state.ws === ws) {
          state.ws = null;
        }
        if (!opened && !settled) {
          settled = true;
          state.wsConnectPromise = null;
          reject(new Error('realtime_unavailable'));
        } else {
          state.wsConnectPromise = null;
        }
        state.wsStateLabel = 'closed';
        settlePendingJoinRequest(new Error('realtime_closed'));
        if (state.sessionId) {
          state.networkIssue = true;
          recomputeVoiceState();
          renderVoiceView();
        }
        if (state.wsWanted) {
          state.wsReconnectAttempts += 1;
          scheduleVoiceWsReconnect();
        }
      });

      ws.addEventListener('error', () => {
        if (!settled && !opened) {
          state.wsStateLabel = 'error';
        }
        try {
          ws.close();
        } catch (_error) {
          // Ignore close failures.
        }
      });
    });

    return state.wsConnectPromise;
  };

  const stopSyncLoop = () => {};

  const stopPresenceLoop = () => {};

  const runPresencePoll = async () => {
    await sendVoiceWs({
      type: 'voice_subscribe',
      serverId
    }).catch(() => {});
  };

  const startPresenceLoop = () => {
    runPresencePoll().catch(() => {});
  };

  const renderVoiceView = () => {
    if (!state.voicePanelOpen || !getVisibleVoiceChannelId()) {
      voiceView.hidden = true;
      textView.hidden = false;
      syncChannelSelection();
      renderVoiceChannelPresence();
      return;
    }

    const channel = getVoiceChannel(getVisibleVoiceChannelId());
    if (!channel) {
      voiceView.hidden = true;
      textView.hidden = false;
      syncChannelSelection();
      return;
    }

    const participants = getChannelParticipants(getVisibleVoiceChannelId());
    const remoteParticipants = participants.filter((participant) => String(participant.session_id || '') !== state.sessionId);
    const connectedPeerCount = state.connectedPeerIds.size;
    const roomStatusLabel = state.voiceConnectionState === 'CONNECTED'
      ? 'Connected to room'
      : state.voiceConnectionState === 'RECONNECTING'
        ? 'Reconnecting'
        : state.voiceConnectionState === 'ERROR'
          ? 'Error'
          : state.voiceConnectionState === 'DISCONNECTED'
            ? 'Disconnected'
            : 'Connecting';
    const roomStatusTone = state.voiceConnectionState === 'ERROR'
      ? 'is-error'
      : state.voiceConnectionState === 'RECONNECTING'
        ? 'is-warn'
        : state.voiceConnectionState === 'CONNECTED'
          ? 'is-ok'
          : '';
    const peerStatusCopy = !state.sessionId
      ? ''
      : remoteParticipants.length === 0
        ? 'Waiting for others'
        : connectedPeerCount > 0
          ? `${connectedPeerCount} peer audio live`
          : 'Connecting peer audio';
    const bannerMessage = state.errorMessage || state.peerWarning;
    const insecureOriginMessage = voiceBlockedByInsecureOrigin
      ? `Voice benötigt HTTPS im LAN.${fullModeUrl ? ` Öffne ${fullModeUrl}` : ''}`
      : '';
    const turnConfigMessage = turnRequired && !turnConfigured
      ? 'Voice benötigt TURN-Konfiguration auf dem Server.'
      : '';
    const effectiveBannerMessage = bannerMessage || insecureOriginMessage || turnConfigMessage;
    const joinAllowed = state.permissions.canJoinVoice
      && !voiceBlockedByInsecureOrigin
      && !(turnRequired && !turnConfigured);
    const joinButtonLabel = !state.permissions.canJoinVoice
      ? 'No permission'
      : voiceBlockedByInsecureOrigin
        ? 'HTTPS required'
        : (turnRequired && !turnConfigured)
          ? 'TURN required'
        : 'Join Voice';

    let stageHtml = '';
    if (!state.sessionId) {
      stageHtml = `
        <div class="voice-hero-card">
          <div class="voice-hero-copy">
            <p class="list-head">Voice Channel</p>
            <h3>🔊 ${escapeHtml(channel.name)}</h3>
            <p>${escapeHtml(channel.topic || 'Join voice to start talking.')}</p>
          </div>
          <div class="voice-hero-actions">
            <button type="button" class="btn primary" data-testid="voice-join-button" aria-label="Join voice" data-voice-action="join-current" ${joinAllowed ? '' : 'disabled'}>
              ${joinButtonLabel}
            </button>
          </div>
          ${voiceBlockedByInsecureOrigin ? `<p class="voice-inline-note" data-testid="voice-https-required-note">Voice benötigt HTTPS im LAN${fullModeUrl ? `: ${escapeHtml(fullModeUrl)}` : ''}.</p>` : ''}
          ${(turnRequired && !turnConfigured) ? '<p class="voice-inline-note" data-testid="voice-turn-required-note">Voice benötigt TURN-Konfiguration auf dem Server.</p>' : ''}
        </div>
      `;
    } else {
      const participantCards = participants.map((participant) => `
        <article class="voice-participant-card ${participant.speaking ? 'is-speaking' : ''} ${participant.muted ? 'is-muted' : ''}" data-voice-user-id="${participant.user_id}" data-presence-user-id="${participant.user_id}" data-presence-status="${escapeHtml(participant.status || 'offline')}" data-presence-last-seen="${escapeHtml(participant.last_seen || '')}">
          <div class="voice-participant-avatar">
            <span class="avatar voice-avatar">${renderParticipantAvatar(participant)}</span>
            <span class="voice-speaking-ring" aria-hidden="true"></span>
            <span class="status-dot ${escapeHtml(participant.status || 'offline')}" data-presence-dot></span>
          </div>
          <div class="voice-participant-copy">
            <strong>${escapeHtml(participant.displayname)}${participant.user_id === currentUserId ? ' (You)' : ''}</strong>
            <p><span data-presence-text>${escapeHtml(participant.status_label || participant.status || 'offline')}</span> • ${escapeHtml(participantTone(participant))}</p>
          </div>
        </article>
      `).join('');
      const waitingNote = state.voiceConnectionState !== 'CONNECTED' || peerStatusCopy
        ? `
          <div class="voice-connection-note" data-testid="voice-waiting-note">
            ${state.voiceConnectionState === 'CONNECTED' ? '' : '<span class="voice-spinner" aria-hidden="true"></span>'}
            <span>${escapeHtml(
              state.voiceConnectionState === 'RECONNECTING'
                ? 'Reconnecting signaling…'
                : state.voiceConnectionState === 'CONNECTED'
                  ? `Connected to room${peerStatusCopy ? ` — ${peerStatusCopy}` : ''}`
                  : 'Joining room…'
            )}</span>
          </div>
        `
        : '';
      stageHtml = `
        <div class="voice-stage-shell" data-testid="voice-stage-shell">
          ${waitingNote}
          <div class="voice-participant-grid" data-testid="voice-participant-grid">${participantCards || '<div class="voice-empty-state">Niemand im Channel.</div>'}</div>
        </div>
        <div class="voice-control-bar" data-testid="voice-control-bar">
          <button type="button" class="voice-control-btn ${state.localAudioState.micEnabled && state.permissions.canSpeak && !state.localAudioState.deafened ? '' : 'is-alert'}" data-testid="voice-mute-button" aria-label="Toggle mute" data-voice-action="toggle-mic" ${state.sessionId && state.permissions.canSpeak && state.micPermissionState !== 'blocked' ? '' : 'disabled'}>
            <span aria-hidden="true">${state.localAudioState.micEnabled && state.permissions.canSpeak && !state.localAudioState.deafened ? '🎙' : '🎤'}</span>
            <span>${state.localAudioState.micEnabled && state.permissions.canSpeak && !state.localAudioState.deafened ? 'Mute' : 'Unmute'}</span>
          </button>
          <button type="button" class="voice-control-btn ${state.localAudioState.deafened ? 'is-alert' : ''}" data-testid="voice-deafen-button" aria-label="Toggle deafen" data-voice-action="toggle-deafen" ${state.sessionId ? '' : 'disabled'}>
            <span aria-hidden="true">${state.localAudioState.deafened ? '🔇' : '🔊'}</span>
            <span>${state.localAudioState.deafened ? 'Undeafen' : 'Deafen'}</span>
          </button>
          <button type="button" class="voice-control-btn voice-control-btn-danger" data-testid="voice-leave-button" aria-label="Leave voice" data-voice-action="disconnect">
            <span aria-hidden="true">☎</span>
            <span>Auflegen</span>
          </button>
        </div>
      `;
    }

    voiceView.innerHTML = `
      <header class="voice-head">
        <div class="voice-head-main">
          <h2>🔊 ${escapeHtml(channel.name)}</h2>
          <p>${escapeHtml(channel.topic || 'Live voice room')}</p>
        </div>
        <div class="voice-state-pill ${roomStatusTone}" data-testid="voice-state-pill">
          <span class="voice-dot" aria-hidden="true"></span>
          <span>${escapeHtml(roomStatusLabel)}</span>
        </div>
      </header>
      ${peerStatusCopy ? `<p class="voice-head-status-note" data-testid="voice-peer-status">${escapeHtml(peerStatusCopy)}</p>` : ''}
      ${effectiveBannerMessage
        ? `
          <div class="voice-banner ${state.errorMessage ? (state.voiceConnectionState === 'ERROR' ? 'is-error' : 'is-warn') : 'is-warn'}" data-testid="voice-banner">
            <span>${escapeHtml(effectiveBannerMessage)}</span>
            ${state.errorCode === 'mic_denied'
              ? '<button type="button" class="chip" data-testid="voice-retry-button" data-voice-action="retry-join">Allow microphone</button>'
              : state.errorCode === 'join_timeout'
                ? '<button type="button" class="chip" data-testid="voice-retry-button" data-voice-action="retry-join">Retry</button>'
                : ''}
          </div>
        `
        : ''}
      ${stageHtml}
      ${!state.permissions.canSpeak && state.sessionId ? '<p class="voice-inline-note">Speaking is disabled in this channel.</p>' : ''}
    `;
    if (isLoopbackOrigin) {
      const debugPanel = document.createElement('div');
      debugPanel.className = 'voice-debug-panel';
      const firstPeer = [...state.peerConnections.values()][0];
      debugPanel.innerHTML = `
        <strong>Voice Debug</strong>
        <span>state: ${escapeHtml(state.voiceConnectionState)}</span>
        <span>signaling: ${escapeHtml(state.wsStateLabel)}</span>
        <span>mic: ${escapeHtml(state.micPermissionState)}</span>
        <span>join ms: ${escapeHtml(state.joinRequestStartedAt ? String(Math.max(0, Date.now() - state.joinRequestStartedAt)) : '0')}</span>
        <span>peers: ${escapeHtml(String(state.peerConnections.size))}</span>
        <span>ice: ${escapeHtml(firstPeer?.pc?.iceConnectionState || 'n/a')}</span>
        <span>conn: ${escapeHtml(firstPeer?.pc?.connectionState || 'n/a')}</span>
      `;
      voiceView.appendChild(debugPanel);
    }
    voiceView.hidden = false;
    textView.hidden = true;
    syncChannelSelection();
    renderVoiceChannelPresence();
  };

  const runSync = async () => {
    if (!state.sessionId) {
      return;
    }
    const muted = !state.permissions.canSpeak || !state.localAudioState.micEnabled || state.localAudioState.deafened;
    await sendVoiceWs({
      type: 'voice_resync',
      sessionId: state.sessionId,
      muted,
      deafened: state.localAudioState.deafened
    }).catch(() => {
      state.networkIssue = true;
      recomputeVoiceState();
      renderVoiceView();
    });
  };

  const startSyncLoop = () => {
    runSync().catch(() => {});
  };

  const disconnectVoice = async (options = {}) => {
    const {
      notifyServer = true,
      releaseMedia = true,
      preservePanel = false
    } = options;
    const previousSessionId = state.sessionId;
    const previousChannelId = state.currentChannelId;
    stopSyncLoop();
    clearPendingJoinRequest();
    closeAllPeerConnections();
    state.connectedPeerIds.clear();
    state.seenSignalIds.clear();
    state.seenSignalOrder = [];
    state.sessionId = '';
    state.joinRequestStartedAt = 0;
    state.currentChannelId = 0;
    state.networkIssue = false;
    state.localSpeaking = false;
    if (releaseMedia) {
      releaseLocalMedia();
    }
    if (notifyServer && previousSessionId) {
      await sendVoiceWs({
        type: 'voice_leave',
        sessionId: previousSessionId
      }).catch(() => {});
    }
    if (previousChannelId) {
      removeSelfFromChannel(previousChannelId, previousSessionId);
    }
    state.errorCode = '';
    state.errorMessage = '';
    state.peerWarning = '';
    state.voicePanelOpen = preservePanel;
    if (!preservePanel) {
      state.targetChannelId = 0;
    }
    recomputeVoiceState();
    renderVoiceView();
    if (!state.sessionId) {
      runPresencePoll().catch(() => {});
    }
  };

  const beginJoin = async (channelId) => {
    const nextChannelId = parseId(channelId);
    if (!getVoiceChannel(nextChannelId)) {
      return;
    }
    state.voicePanelOpen = true;
    state.targetChannelId = nextChannelId;
    state.errorCode = '';
    state.errorMessage = '';
    if (voiceBlockedByInsecureOrigin) {
      state.voiceConnectionState = 'ERROR';
      state.errorCode = 'secure_origin_required';
      state.errorMessage = mapVoiceErrorMessage(state.errorCode);
      renderVoiceView();
      return;
    }
    if (turnRequired && !turnConfigured) {
      state.voiceConnectionState = 'ERROR';
      state.errorCode = 'turn_required';
      state.errorMessage = mapVoiceErrorMessage(state.errorCode);
      renderVoiceView();
      return;
    }
    if (!state.permissions.canJoinVoice) {
      state.voiceConnectionState = 'ERROR';
      state.errorCode = 'permission_denied';
      state.errorMessage = 'No permission to join voice.';
      renderVoiceView();
      return;
    }

    if (state.sessionId && state.currentChannelId === nextChannelId) {
      renderVoiceView();
      return;
    }

    if (state.sessionId) {
      await disconnectVoice({
        notifyServer: true,
        releaseMedia: false,
        preservePanel: true
      });
    }

    try {
      await ensureMicrophone();
    } catch (error) {
      state.micPermissionState = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(String(error?.name))
        ? 'blocked'
        : state.micPermissionState;
      state.voiceConnectionState = 'ERROR';
      state.errorCode = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(String(error?.name))
        ? 'mic_denied'
        : 'mic_failed';
      state.errorMessage = mapVoiceErrorMessage(state.errorCode);
      releaseLocalMedia();
      renderVoiceView();
      return;
    }

    state.voiceConnectionState = 'CONNECTING';
    renderVoiceView();

    try {
      state.joinRequestStartedAt = Date.now();
      await ensureVoiceWs();
      const data = await requestVoiceJoinOverWs(nextChannelId);
      state.sessionId = String(data.sessionId || '');
      state.joinRequestStartedAt = 0;
      state.currentChannelId = nextChannelId;
      state.permissions.canSpeak = Boolean(data.permissions?.canSpeak);
      if (!state.permissions.canSpeak) {
        state.localAudioState.micEnabled = false;
        syncLocalTrackState();
      }
      state.peerWarning = '';
      setServerPresence(data.serverPresence);
      const activeChannel = getVoiceChannel(nextChannelId);
      if (activeChannel) {
        activeChannel.participants = Array.isArray(data.participants) ? data.participants : [];
      }
      recomputeVoiceState();
      renderVoiceView();
      await reconcilePeers(getChannelParticipants(nextChannelId));
      startSyncLoop();
      pushLocalVoiceState();
    } catch (error) {
      state.sessionId = '';
      state.joinRequestStartedAt = 0;
      state.currentChannelId = 0;
      state.voiceConnectionState = 'ERROR';
      state.errorCode = String(error?.message || 'join_failed');
      if (state.errorCode === 'realtime_closed' || state.errorCode === 'realtime_unavailable') {
        state.networkIssue = true;
      }
      state.errorMessage = mapVoiceErrorMessage(state.errorCode, 'Voice join failed.');
      releaseLocalMedia();
      renderVoiceView();
    }
  };

  const toggleMic = () => {
    if (!state.permissions.canSpeak) {
      return;
    }
    state.localAudioState.micEnabled = !state.localAudioState.micEnabled;
    if (!state.localAudioState.micEnabled) {
      state.localSpeaking = false;
    }
    persistVoicePrefs();
    syncLocalTrackState();
    pushLocalVoiceState();
    renderVoiceView();
  };

  const toggleDeafen = () => {
    state.localAudioState.deafened = !state.localAudioState.deafened;
    if (state.localAudioState.deafened) {
      state.localAudioState.micEnabled = false;
      state.localSpeaking = false;
    }
    persistVoicePrefs();
    syncLocalTrackState();
    syncRemoteAudioState();
    pushLocalVoiceState();
    renderVoiceView();
  };

  voiceLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      beginJoin(parseId(link.dataset.channelId));
    });
  });

  channelLinks
    .filter((link) => link.dataset.channelType === 'text')
    .forEach((link) => {
      link.addEventListener('click', () => {
        state.lastActiveTextChannelId = parseId(link.dataset.channelId);
      });
    });

  voiceView.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const actionNode = target.closest('[data-voice-action]');
    if (!(actionNode instanceof HTMLButtonElement)) {
      return;
    }
    const action = String(actionNode.dataset.voiceAction || '');
    if (action === 'join-current' || action === 'retry-join') {
      beginJoin(getVisibleVoiceChannelId());
      return;
    }
    if (action === 'toggle-mic') {
      toggleMic();
      return;
    }
    if (action === 'toggle-deafen') {
      toggleDeafen();
      return;
    }
    if (action === 'disconnect') {
      disconnectVoice({ preservePanel: true });
    }
  });

  window.addEventListener('offline', () => {
    if (!state.sessionId) {
      return;
    }
    state.networkIssue = true;
    recomputeVoiceState();
    renderVoiceView();
  });

  window.addEventListener('online', () => {
    ensureVoiceWs()
      .then(() => {
        if (state.sessionId) {
          runSync().catch(() => {});
        }
      })
      .catch(() => {});
  });

  window.addEventListener('beforeunload', () => {
    if (state.sessionId && state.ws && state.ws.readyState === WebSocket.OPEN) {
      try {
        state.ws.send(JSON.stringify({
          type: 'voice_leave',
          sessionId: state.sessionId
        }));
      } catch (_error) {
        // Ignore best-effort leave failures during unload.
      }
    }
    stopPresenceLoop();
    stopSyncLoop();
    closeVoiceWs({ manual: true });
    closeAllPeerConnections();
    releaseLocalMedia();
  });

  startPresenceLoop();
  ensureVoiceWs().catch(() => {});
  renderVoiceChannelPresence();
  renderVoiceView();
})();

(function initServerComposerUX() {
  const form = document.getElementById('serverComposerForm');
  if (form?.classList.contains('shared-composer-form')) {
    return;
  }
  const timeline = document.getElementById('serverTimeline');
  const status = document.getElementById('serverComposerStatus');
  const currentDisplayName = String(document.getElementById('serverCurrentDisplayName')?.value || 'Du');
  const currentAvatarUrl = String(document.getElementById('serverCurrentAvatarUrl')?.value || '').trim();
  if (!form || !timeline) {
    return;
  }

  const textarea = form.querySelector('textarea[name="content"]');
  const sendBtn = form.querySelector('button[type="submit"]');
  const channelIdInput = form.querySelector('input[name="channelId"]');
  if (!textarea || !sendBtn || !channelIdInput) {
    return;
  }

  const failedById = new Map();
  let pendingId = 0;

  const escapeText = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const fallbackAvatarToken = (displayName, username = '') => {
    const source = String(displayName || username || '?').trim();
    if (!source) {
      return '?';
    }
    return source.slice(0, 2).toUpperCase();
  };

  const renderAvatarCell = ({
    avatarUrl = '',
    displayName = '',
    username = ''
  }) => {
    const safeDisplayName = escapeText(displayName || username || 'User');
    const safeAvatarUrl = escapeText(String(avatarUrl || '').trim());
    const fallbackToken = escapeText(fallbackAvatarToken(displayName, username));
    if (safeAvatarUrl) {
      return `<div class="avatar msg-avatar"><img src="${safeAvatarUrl}" alt="${safeDisplayName}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" /><span class="avatar-fallback" hidden>${fallbackToken}</span></div>`;
    }
    return `<div class="avatar msg-avatar"><span class="avatar-fallback">${fallbackToken}</span></div>`;
  };

  const setStatus = (message) => {
    if (!status) {
      return;
    }
    status.hidden = !message;
    status.textContent = message || '';
  };

  const canSend = () => textarea.value.trim().length > 0;

  const syncSend = () => {
    sendBtn.disabled = !canSend();
  };

  const createPendingNode = (content, id) => {
    const node = document.createElement('article');
    node.className = 'msg own pending-msg';
    node.dataset.pendingId = String(id);
    node.innerHTML = `
      ${renderAvatarCell({ avatarUrl: currentAvatarUrl, displayName: currentDisplayName })}
      <div class="bubble">
        <div class="meta"><strong>Du</strong> <span>wird gesendet…</span></div>
        <p>${escapeText(content)}</p>
      </div>
    `;
    timeline.appendChild(node);
    timeline.scrollTop = timeline.scrollHeight;
    return node;
  };

  const setPendingFailed = (node, message) => {
    node.classList.add('failed-msg');
    const bubble = node.querySelector('.bubble');
    if (!bubble) {
      return;
    }
    bubble.insertAdjacentHTML(
      'beforeend',
      `<div class="pending-actions"><span class="sub">${message}</span><button type="button" class="chip" data-retry-server-pending="${node.dataset.pendingId}">Retry</button><button type="button" class="chip danger" data-delete-server-pending="${node.dataset.pendingId}">Delete</button></div>`
    );
  };

  const replacePendingWithSaved = (node, message) => {
    node.classList.remove('pending-msg', 'failed-msg');
    node.removeAttribute('data-pending-id');
    node.id = `msg-${message.id}`;
    node.dataset.messageId = String(message.id || '');
    node.dataset.authorId = String(message.author_id || 0);
    node.innerHTML = `
      ${renderAvatarCell({
    avatarUrl: message.author_avatar_url,
    displayName: message.author_display_name || 'Du',
    username: message.author_username || ''
  })}
      <div class="bubble">
        <div class="meta"><strong>${escapeText(message.author_display_name || 'Du')}</strong> <span>${escapeText(message.created_at || 'now')}</span></div>
        <p>${escapeText(message.content || '')}</p>
      </div>
    `;
  };

  const sendPayload = async (payload, pendingNode, pendingKey) => {
    const response = await fetch(form.getAttribute('action') || window.location.pathname, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Nachricht konnte nicht gesendet werden.');
    }
    replacePendingWithSaved(pendingNode, data.message || {});
    failedById.delete(pendingKey);
  };

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  textarea.addEventListener('input', () => {
    setStatus('');
    syncSend();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content) {
      syncSend();
      return;
    }

    pendingId += 1;
    const currentPendingId = pendingId;
    const payload = {
      channelId: Number(channelIdInput.value || 0),
      content
    };
    const pendingNode = createPendingNode(content, currentPendingId);

    textarea.value = '';
    syncSend();
    sendBtn.classList.add('is-loading');
    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;

    try {
      await sendPayload(payload, pendingNode, currentPendingId);
      setStatus('');
    } catch (error) {
      setPendingFailed(pendingNode, error.message || 'failed to send');
      failedById.set(currentPendingId, payload);
      setStatus(error.message || 'failed to send');
    } finally {
      sendBtn.classList.remove('is-loading');
      sendBtn.textContent = 'Senden';
      syncSend();
    }
  });

  timeline.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const retryId = target.dataset.retryServerPending;
    if (retryId) {
      const key = Number(retryId);
      const payload = failedById.get(key);
      const node = timeline.querySelector(`[data-pending-id="${key}"]`);
      if (!payload || !(node instanceof HTMLElement)) {
        return;
      }
      node.querySelector('.pending-actions')?.remove();
      node.classList.remove('failed-msg');
      try {
        await sendPayload(payload, node, key);
        setStatus('');
      } catch (error) {
        setPendingFailed(node, error.message || 'failed to send');
        setStatus(error.message || 'failed to send');
      }
      return;
    }

    const deleteId = target.dataset.deleteServerPending;
    if (deleteId) {
      const key = Number(deleteId);
      failedById.delete(key);
      timeline.querySelector(`[data-pending-id="${key}"]`)?.remove();
    }
  });

  syncSend();
})();

(function initSettingsDirtyState() {
  const forms = [...document.querySelectorAll('.settings-form[data-dirty-track="true"]')];
  const bar = document.querySelector('.unsaved-bar');
  const revertBtn = document.querySelector('[data-settings-revert="true"]');
  const saveBtn = document.querySelector('[data-settings-save="true"]');

  if (!forms.length || !bar || !revertBtn || !saveBtn) {
    return;
  }

  const serialize = (form) => new URLSearchParams(new FormData(form)).toString();
  const initialByForm = new Map(forms.map((form) => [form, serialize(form)]));
  let activeForm = forms[0];
  let isDirty = false;

  const applyInlineValidation = (form) => {
    const matchFields = form.querySelectorAll('[data-match]');
    matchFields.forEach((field) => {
      if (!(field instanceof HTMLInputElement)) {
        return;
      }
      const peer = form.querySelector(`[name="${field.dataset.match}"]`);
      if (!(peer instanceof HTMLInputElement)) {
        return;
      }
      field.setCustomValidity(field.value && field.value !== peer.value ? 'Werte stimmen nicht überein.' : '');
    });
  };

  const updateBar = () => {
    const dirtyForms = forms.filter((form) => serialize(form) !== initialByForm.get(form));
    isDirty = dirtyForms.length > 0;
    bar.hidden = !isDirty;
    activeForm = dirtyForms[0] || activeForm;
    if (!activeForm) {
      return;
    }
    applyInlineValidation(activeForm);
    saveBtn.disabled = !activeForm.checkValidity();
  };

  window.addEventListener('beforeunload', (event) => {
    if (!isDirty) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  });

  forms.forEach((form) => {
    const onEdit = () => {
      activeForm = form;
      applyInlineValidation(form);
      updateBar();
    };
    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);
  });

  revertBtn.addEventListener('click', () => {
    if (!activeForm) {
      return;
    }
    activeForm.reset();
    applyInlineValidation(activeForm);
    updateBar();
  });

  saveBtn.addEventListener('click', () => {
    if (!activeForm) {
      return;
    }
    applyInlineValidation(activeForm);
    if (!activeForm.checkValidity()) {
      activeForm.reportValidity();
      return;
    }
    activeForm.requestSubmit();
  });

  updateBar();
})();

(function initServerProfileSettingsPreview() {
  const form = document.getElementById('serverProfileSettingsForm');
  if (!form) {
    return;
  }

  const escapeHtml = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const nameInput = document.getElementById('serverSettingsNameInput');
  const descriptionInput = document.getElementById('serverSettingsDescriptionInput');
  const accentInput = document.getElementById('serverAccentColorInput');
  const traitsInput = document.getElementById('serverTraitsInput');

  const chooseIconBtn = document.getElementById('serverChooseIconBtn');
  const chooseBannerBtn = document.getElementById('serverChooseBannerBtn');
  const removeIconBtn = document.getElementById('serverRemoveIconBtn');
  const removeBannerBtn = document.getElementById('serverRemoveBannerBtn');
  const iconFileInput = document.getElementById('serverIconFileInput');
  const bannerFileInput = document.getElementById('serverBannerFileInput');
  const iconDataInput = document.getElementById('serverIconDataInput');
  const bannerDataInput = document.getElementById('serverBannerDataInput');
  const iconRemoveInput = document.getElementById('serverIconRemoveInput');
  const bannerRemoveInput = document.getElementById('serverBannerRemoveInput');
  const iconErr = document.getElementById('serverIconFileError');
  const bannerErr = document.getElementById('serverBannerFileError');

  const savedIcon = document.getElementById('serverPreviewSavedIcon')?.value || '';
  const savedBanner = document.getElementById('serverPreviewSavedBanner')?.value || '';
  const memberCount = Number(document.getElementById('serverPreviewMemberCount')?.value || 0);
  const onlineCount = Number(document.getElementById('serverPreviewOnlineCount')?.value || 0);

  const previewCard = document.getElementById('serverPreviewCard');
  const previewBanner = document.getElementById('serverPreviewBanner');
  const previewBannerImg = document.getElementById('serverPreviewBannerImg');
  const previewBannerFallback = document.getElementById('serverPreviewBannerFallback');
  const previewIconImg = document.getElementById('serverPreviewIconImg');
  const previewIconFallback = document.getElementById('serverPreviewIconFallback');
  const previewName = document.getElementById('serverPreviewName');
  const previewDescription = document.getElementById('serverPreviewDescription');
  const previewCounts = document.getElementById('serverPreviewCounts');
  const previewTags = document.getElementById('serverPreviewTags');

  if (!nameInput || !descriptionInput || !accentInput || !traitsInput || !chooseIconBtn || !chooseBannerBtn || !removeIconBtn || !removeBannerBtn || !iconFileInput || !bannerFileInput || !iconDataInput || !bannerDataInput || !iconRemoveInput || !bannerRemoveInput || !previewCard || !previewBanner || !previewBannerImg || !previewBannerFallback || !previewIconImg || !previewIconFallback || !previewName || !previewDescription || !previewCounts || !previewTags) {
    return;
  }

  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const iconMaxBytes = 2 * 1024 * 1024;
  const bannerMaxBytes = 6 * 1024 * 1024;

  let iconPreviewSrc = savedIcon;
  let bannerPreviewSrc = savedBanner;

  const markDirty = () => {
    form.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const clearError = (node) => {
    if (!node) {
      return;
    }
    node.hidden = true;
    node.textContent = '';
  };

  const setError = (node, message) => {
    if (!node) {
      return;
    }
    node.hidden = false;
    node.textContent = message;
  };

  const normalizeTraits = (value) => {
    const unique = new Set();
    return String(value || '')
      .split(/[,\n]/g)
      .map((entry) => entry.trim().replace(/\s+/g, ' ').slice(0, 24))
      .filter((entry) => {
        if (!entry) {
          return false;
        }
        const key = entry.toLowerCase();
        if (unique.has(key)) {
          return false;
        }
        unique.add(key);
        return true;
      })
      .slice(0, 8);
  };

  const hexToRgba = (hex, alpha) => {
    const normalized = String(hex || '').trim();
    const value = /^#[0-9a-fA-F]{6}$/.test(normalized)
      ? normalized
      : '#45c8ff';
    const channel = (offset) => Number.parseInt(value.slice(offset, offset + 2), 16);
    return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
  };

  const updatePreview = () => {
    const nextName = nameInput.value.trim() || 'Server';
    const nextDescription = descriptionInput.value.trim() || 'No description set.';
    const accent = /^#[0-9a-fA-F]{6}$/.test(accentInput.value || '') ? accentInput.value : '#45c8ff';
    const initials = nextName.slice(0, 2).toUpperCase();

    previewName.textContent = nextName;
    previewDescription.textContent = nextDescription;
    previewCounts.textContent = `${memberCount} members - ${onlineCount} online`;
    previewCard.style.borderColor = hexToRgba(accent, 0.65);
    previewBanner.style.background = `linear-gradient(120deg, ${hexToRgba(accent, 0.55)}, rgba(255, 94, 168, 0.42))`;

    if (bannerPreviewSrc) {
      previewBannerImg.src = bannerPreviewSrc;
      previewBannerImg.hidden = false;
      previewBannerFallback.hidden = true;
    } else {
      previewBannerImg.hidden = true;
      previewBannerImg.removeAttribute('src');
      previewBannerFallback.hidden = false;
    }

    if (iconPreviewSrc) {
      previewIconImg.src = iconPreviewSrc;
      previewIconImg.hidden = false;
      previewIconFallback.hidden = true;
    } else {
      previewIconImg.hidden = true;
      previewIconImg.removeAttribute('src');
      previewIconFallback.hidden = false;
      previewIconFallback.textContent = initials || 'SV';
    }

    const tags = normalizeTraits(traitsInput.value);
    previewTags.innerHTML = tags.length
      ? tags.map((tag) => `<span class=\"server-tag-pill\">${escapeHtml(tag)}</span>`).join('')
      : '<span class=\"sub\">No traits yet.</span>';
  };

  const readAndPreview = (file, kind) => {
    const isIcon = kind === 'icon';
    const maxBytes = isIcon ? iconMaxBytes : bannerMaxBytes;
    const errorNode = isIcon ? iconErr : bannerErr;

    clearError(errorNode);
    if (!validTypes.includes(file.type)) {
      setError(errorNode, 'Invalid file type. Allowed: PNG, JPG, WEBP, GIF.');
      return;
    }
    if (file.size > maxBytes) {
      setError(errorNode, `File too large. Max ${isIcon ? '2MB' : '6MB'}.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result.startsWith('data:image/')) {
        setError(errorNode, 'File could not be processed.');
        return;
      }

      if (isIcon) {
        iconDataInput.value = result;
        iconRemoveInput.value = '0';
        iconPreviewSrc = result;
      } else {
        bannerDataInput.value = result;
        bannerRemoveInput.value = '0';
        bannerPreviewSrc = result;
      }

      updatePreview();
      markDirty();
    };
    reader.readAsDataURL(file);
  };

  chooseIconBtn.addEventListener('click', () => iconFileInput.click());
  chooseBannerBtn.addEventListener('click', () => bannerFileInput.click());

  iconFileInput.addEventListener('change', () => {
    const file = iconFileInput.files?.[0];
    if (!file) {
      return;
    }
    readAndPreview(file, 'icon');
  });

  bannerFileInput.addEventListener('change', () => {
    const file = bannerFileInput.files?.[0];
    if (!file) {
      return;
    }
    readAndPreview(file, 'banner');
  });

  removeIconBtn.addEventListener('click', () => {
    iconDataInput.value = '';
    iconRemoveInput.value = '1';
    iconFileInput.value = '';
    iconPreviewSrc = '';
    clearError(iconErr);
    updatePreview();
    markDirty();
  });

  removeBannerBtn.addEventListener('click', () => {
    bannerDataInput.value = '';
    bannerRemoveInput.value = '1';
    bannerFileInput.value = '';
    bannerPreviewSrc = '';
    clearError(bannerErr);
    updatePreview();
    markDirty();
  });

  document.querySelectorAll('.server-accent-preset[data-accent-value]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      const value = String(button.dataset.accentValue || '').trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
        return;
      }
      accentInput.value = value;
      updatePreview();
      markDirty();
    });
  });

  [nameInput, descriptionInput, accentInput, traitsInput].forEach((input) => {
    input.addEventListener('input', () => {
      updatePreview();
    });
    input.addEventListener('change', () => {
      updatePreview();
    });
  });

  updatePreview();
})();

(function initServerAppsSettingsDirectory() {
  const dataNode = document.getElementById('sokratesSettingsAppData');
  if (!dataNode) {
    return;
  }

  let bootstrap = {};
  try {
    bootstrap = JSON.parse(dataNode.textContent || '{}');
  } catch (_error) {
    bootstrap = {};
  }

  const serverId = Number(bootstrap.serverId || 0);
  const canManage = Boolean(bootstrap.canManage);

  const cardStateNode = document.getElementById('sokratesCardInstallState');
  const cardStatusNode = document.getElementById('sokratesCardStatus');
  const primaryBtn = document.getElementById('sokratesCardPrimaryBtn');
  const removeBtn = document.getElementById('sokratesCardRemoveBtn');
  const permissionsBtn = document.getElementById('sokratesAppPermissionsBtn');
  const manageModal = document.getElementById('sokratesSettingsManageModal');
  const manageForm = document.getElementById('sokratesSettingsManageForm');
  const manageStatus = document.getElementById('sokratesSettingsManageStatus');
  const modalSaveBtn = document.getElementById('sokratesSettingsSaveBtn');
  const modalRemoveBtn = document.getElementById('sokratesSettingsModalRemoveBtn');
  const scopeInput = document.getElementById('sokratesSettingsChannelScopeInput');
  const allowlistNode = document.getElementById('sokratesSettingsChannelAllowlist');

  if (!serverId || !cardStateNode || !primaryBtn || !manageModal || !manageForm || !scopeInput || !allowlistNode) {
    return;
  }

  const postJson = async (url, payload = {}) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  const setButtonLoading = (button, loading, loadingLabel = 'Loading...') => {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const htmlButton = button;
    if (loading) {
      if (!htmlButton.dataset.defaultLabel) {
        htmlButton.dataset.defaultLabel = htmlButton.textContent || '';
      }
      htmlButton.textContent = loadingLabel;
      htmlButton.classList.add('is-loading');
      htmlButton.setAttribute('disabled', 'disabled');
      return;
    }
    htmlButton.textContent = htmlButton.dataset.defaultLabel || htmlButton.textContent || '';
    htmlButton.classList.remove('is-loading');
    htmlButton.removeAttribute('disabled');
  };

  const setStatusText = (node, message = '', tone = '') => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.hidden = !message;
    node.textContent = message;
    node.classList.remove('upload-status-ok', 'inline-error');
    if (tone === 'ok') {
      node.classList.add('upload-status-ok');
    } else if (tone === 'error') {
      node.classList.add('inline-error');
    }
  };

  const mapServerError = (code, fallback = 'Action failed.') => {
    const byCode = {
      permission_denied: 'Missing permission.',
      not_member: 'You are not a member of this server.',
      save_failed: 'Settings could not be saved.'
    };
    return byCode[String(code || '')] || fallback;
  };

  const defaultSettings = () => ({
    enabled: true,
    reaction_rate: 'rare',
    reply_rate: 'rare',
    channel_scope: 'all',
    channels_allowlist: [],
    provider_unavailable_behavior: 'silent'
  });

  const defaultInstallation = () => ({
    app_id: 'sokrates',
    installed: false,
    installed_at: '',
    settings: defaultSettings()
  });

  let installation = bootstrap.installation && typeof bootstrap.installation === 'object'
    ? bootstrap.installation
    : defaultInstallation();

  const getEffectiveSettings = () => {
    const base = defaultSettings();
    const source = installation && installation.settings && typeof installation.settings === 'object'
      ? installation.settings
      : {};
    return {
      ...base,
      ...source
    };
  };

  const syncAllowlistVisibility = () => {
    const scope = String(scopeInput.value || 'all').trim().toLowerCase();
    allowlistNode.hidden = scope !== 'selected';
  };

  const applyFormState = () => {
    const settings = getEffectiveSettings();
    const enabledInput = manageForm.elements.namedItem('enabled');
    const reactionRateInput = manageForm.elements.namedItem('reactionRate');
    const replyRateInput = manageForm.elements.namedItem('replyRate');
    const providerSilentInput = manageForm.elements.namedItem('providerUnavailableSilent');

    if (enabledInput instanceof HTMLInputElement) {
      enabledInput.checked = settings.enabled !== false;
    }
    if (reactionRateInput instanceof HTMLSelectElement) {
      reactionRateInput.value = ['rare', 'normal', 'frequent'].includes(String(settings.reaction_rate || ''))
        ? String(settings.reaction_rate)
        : 'rare';
    }
    if (replyRateInput instanceof HTMLSelectElement) {
      replyRateInput.value = ['off', 'rare', 'normal'].includes(String(settings.reply_rate || ''))
        ? String(settings.reply_rate)
        : 'rare';
    }
    if (scopeInput instanceof HTMLSelectElement) {
      scopeInput.value = settings.channel_scope === 'selected' ? 'selected' : 'all';
    }
    if (providerSilentInput instanceof HTMLInputElement) {
      providerSilentInput.checked = String(settings.provider_unavailable_behavior || 'silent') !== 'notify';
    }

    const allowlist = new Set(
      Array.isArray(settings.channels_allowlist)
        ? settings.channels_allowlist.map((entry) => Number(entry || 0))
        : []
    );
    manageForm.querySelectorAll('input[name="channelsAllowlist"]').forEach((node) => {
      if (!(node instanceof HTMLInputElement)) {
        return;
      }
      node.checked = allowlist.has(Number(node.value || 0));
    });

    syncAllowlistVisibility();
  };

  const syncUi = () => {
    const installed = Boolean(installation?.installed);
    const stateText = installed ? 'Installed' : 'Not installed';
    cardStateNode.textContent = stateText;
    cardStateNode.classList.toggle('fancy', installed);
    primaryBtn.textContent = installed ? 'Manage' : 'Add to Server';
    primaryBtn.dataset.defaultLabel = primaryBtn.textContent;
    if (removeBtn instanceof HTMLElement) {
      removeBtn.hidden = !installed || !canManage;
    }
    if (modalRemoveBtn instanceof HTMLButtonElement) {
      modalRemoveBtn.hidden = !installed;
      modalRemoveBtn.dataset.defaultLabel = 'Remove';
    }
    dataNode.textContent = JSON.stringify({
      serverId,
      canManage,
      installation
    });
    applyFormState();
  };

  const openManageModal = () => {
    if (!Boolean(installation?.installed)) {
      return;
    }
    setStatusText(manageStatus, '');
    applyFormState();
    manageModal.hidden = false;
    const autofocusTarget = manageModal.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])');
    autofocusTarget?.focus();
  };

  const closeManageModal = () => {
    manageModal.hidden = true;
  };

  const collectPayload = () => {
    const formData = new FormData(manageForm);
    const channelScope = String(formData.get('channelScope') || 'all');
    return {
      enabled: formData.get('enabled') === 'on',
      reactionRate: String(formData.get('reactionRate') || 'rare'),
      replyRate: String(formData.get('replyRate') || 'rare'),
      channelScope,
      channelsAllowlist: channelScope === 'selected'
        ? formData.getAll('channelsAllowlist').map((value) => Number(value || 0)).filter((value) => value > 0)
        : [],
      providerUnavailableBehavior: formData.get('providerUnavailableSilent') === 'on' ? 'silent' : 'notify'
    };
  };

  const persistSettings = async (payload, button, loadingLabel) => {
    setButtonLoading(button, true, loadingLabel);
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/apps/sokrates`, payload);
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Sokrates could not be saved.'));
      }
      installation = data.installation || defaultInstallation();
      syncUi();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Sokrates could not be saved.'
      };
    } finally {
      setButtonLoading(button, false);
    }
  };

  const removeInstallation = async (button) => {
    setButtonLoading(button, true, 'Removing...');
    try {
      const { response, data } = await postJson(`/app/servers/${serverId}/apps/sokrates/remove`, {});
      if (!response.ok || !data.ok) {
        throw new Error(mapServerError(data.error, 'Sokrates could not be removed.'));
      }
      installation = defaultInstallation();
      syncUi();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Sokrates could not be removed.'
      };
    } finally {
      setButtonLoading(button, false);
    }
  };

  scopeInput.addEventListener('change', syncAllowlistVisibility);

  primaryBtn.addEventListener('click', async () => {
    if (!canManage) {
      return;
    }
    if (Boolean(installation?.installed)) {
      openManageModal();
      return;
    }
    setStatusText(cardStatusNode, '');
    const settings = getEffectiveSettings();
    const result = await persistSettings({
      enabled: settings.enabled !== false,
      reactionRate: settings.reaction_rate || 'rare',
      replyRate: settings.reply_rate || 'rare',
      providerUnavailableBehavior: settings.provider_unavailable_behavior === 'notify' ? 'notify' : 'silent',
      channelScope: 'all',
      channelsAllowlist: []
    }, primaryBtn, 'Adding...');
    if (!result.ok) {
      setStatusText(cardStatusNode, result.message, 'error');
      return;
    }
    setStatusText(cardStatusNode, 'Installed.', 'ok');
  });

  removeBtn?.addEventListener('click', async () => {
    if (!canManage) {
      return;
    }
    setStatusText(cardStatusNode, '');
    const result = await removeInstallation(removeBtn);
    if (!result.ok) {
      setStatusText(cardStatusNode, result.message, 'error');
      return;
    }
    setStatusText(cardStatusNode, 'Removed.', 'ok');
    closeManageModal();
  });

  permissionsBtn?.addEventListener('click', () => {
    openManageModal();
  });

  manageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setStatusText(manageStatus, '');
    const result = await persistSettings(collectPayload(), modalSaveBtn, 'Saving...');
    if (!result.ok) {
      setStatusText(manageStatus, result.message, 'error');
      return;
    }
    setStatusText(manageStatus, 'Saved.', 'ok');
    setStatusText(cardStatusNode, 'Saved.', 'ok');
  });

  modalRemoveBtn?.addEventListener('click', async () => {
    if (!canManage) {
      return;
    }
    setStatusText(manageStatus, '');
    const result = await removeInstallation(modalRemoveBtn);
    if (!result.ok) {
      setStatusText(manageStatus, result.message, 'error');
      return;
    }
    setStatusText(manageStatus, 'Removed.', 'ok');
    setStatusText(cardStatusNode, 'Removed.', 'ok');
    closeManageModal();
  });

  manageModal.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.matches('[data-sokrates-manage-close]') || target.closest('[data-sokrates-manage-close]')) {
      closeManageModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !manageModal.hidden) {
      closeManageModal();
    }
  });

  syncUi();
})();

(function initProfileSettingsPreview() {
  const form = document.getElementById('profileSettingsForm');
  if (!form) {
    return;
  }

  const escapeHtml = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const chooseAvatarBtn = document.getElementById('chooseAvatarBtn');
  const chooseBannerBtn = document.getElementById('chooseBannerBtn');
  const removeAvatarBtn = document.getElementById('removeAvatarBtn');
  const removeBannerBtn = document.getElementById('removeBannerBtn');
  const avatarFileInput = document.getElementById('avatarFileInput');
  const bannerFileInput = document.getElementById('bannerFileInput');
  const avatarDataInput = document.getElementById('avatarDataInput');
  const bannerDataInput = document.getElementById('bannerDataInput');
  const avatarRemoveInput = document.getElementById('avatarRemoveInput');
  const bannerRemoveInput = document.getElementById('bannerRemoveInput');
  const avatarErr = document.getElementById('avatarFileError');
  const bannerErr = document.getElementById('bannerFileError');

  const displayNameInput = document.getElementById('profileDisplayName');
  const aboutInput = document.getElementById('profileAboutMe');
  const statusInput = document.getElementById('profilePresenceStatus');
  const customEmojiInput = document.getElementById('profileCustomEmoji');
  const customTextInput = document.getElementById('profileCustomText');

  const usernameValue = document.getElementById('profilePreviewUsername')?.value || 'user';
  const savedAvatar = document.getElementById('profilePreviewAvatarSaved')?.value || '';
  const savedBanner = document.getElementById('profilePreviewBannerSaved')?.value || '';

  const previewBanner = document.getElementById('profilePreviewBanner');
  const previewBannerImg = document.getElementById('profilePreviewBannerImg');
  const previewBannerFallback = document.getElementById('profilePreviewBannerFallback');
  const previewAvatarImg = document.getElementById('profilePreviewAvatarImg');
  const previewAvatarFallback = document.getElementById('profilePreviewAvatarFallback');
  const previewStatusDot = document.getElementById('profilePreviewStatusDot');
  const previewDisplayName = document.getElementById('profilePreviewDisplayName');
  const previewHandle = document.getElementById('profilePreviewHandle');
  const previewStatusText = document.getElementById('profilePreviewStatusText');
  const previewAbout = document.getElementById('profilePreviewAbout');

  if (!chooseAvatarBtn || !chooseBannerBtn || !removeAvatarBtn || !removeBannerBtn || !avatarFileInput || !bannerFileInput || !avatarDataInput || !bannerDataInput || !avatarRemoveInput || !bannerRemoveInput || !previewBanner || !previewBannerImg || !previewBannerFallback || !previewAvatarImg || !previewAvatarFallback || !previewStatusDot || !previewDisplayName || !previewHandle || !previewStatusText || !previewAbout || !displayNameInput || !aboutInput || !statusInput || !customEmojiInput || !customTextInput) {
    return;
  }

  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const avatarMax = 2 * 1024 * 1024;
  const bannerMax = 4 * 1024 * 1024;

  let avatarObjectUrl = '';
  let bannerObjectUrl = '';
  let avatarPreviewSrc = savedAvatar;
  let bannerPreviewSrc = savedBanner;

  const markDirty = () => {
    form.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const clearError = (node) => {
    if (!node) {
      return;
    }
    node.hidden = true;
    node.textContent = '';
  };

  const setError = (node, msg) => {
    if (!node) {
      return;
    }
    node.hidden = false;
    node.textContent = msg;
  };

  const updatePreview = () => {
    previewDisplayName.textContent = displayNameInput.value.trim() || 'Display Name';
    previewHandle.textContent = `@${usernameValue}`;
    previewAbout.textContent = aboutInput.value.trim() || 'No bio set.';

    const emoji = Array.from(customEmojiInput.value.trim())[0] || '';
    if (customEmojiInput.value.trim() !== emoji) {
      customEmojiInput.value = emoji;
    }
    const customText = customTextInput.value.trim();
    previewStatusText.textContent = `${emoji ? `${emoji} ` : ''}${customText || statusInput.value || 'online'}`;

    const status = statusInput.value === 'invisible' ? 'offline' : statusInput.value;
    previewStatusDot.className = `status-dot ${status}`;

    if (bannerPreviewSrc) {
      previewBannerImg.src = bannerPreviewSrc;
      previewBannerImg.hidden = false;
      previewBannerFallback.hidden = true;
    } else {
      previewBannerImg.hidden = true;
      previewBannerImg.removeAttribute('src');
      previewBannerFallback.hidden = false;
    }

    if (avatarPreviewSrc) {
      previewAvatarImg.src = avatarPreviewSrc;
      previewAvatarImg.hidden = false;
      previewAvatarFallback.hidden = true;
    } else {
      previewAvatarImg.hidden = true;
      previewAvatarFallback.hidden = false;
      previewAvatarFallback.textContent = (displayNameInput.value.trim() || 'A').charAt(0).toUpperCase();
    }
  };

  const readAndPreview = (file, kind) => {
    const isAvatar = kind === 'avatar';
    const maxSize = isAvatar ? avatarMax : bannerMax;
    const errNode = isAvatar ? avatarErr : bannerErr;

    clearError(errNode);

    if (!validTypes.includes(file.type)) {
      setError(errNode, 'Ungültiger Dateityp. Erlaubt: PNG, JPG, WEBP, GIF.');
      return;
    }

    if (file.size > maxSize) {
      setError(errNode, `Datei zu groß. Max ${isAvatar ? '2MB' : '4MB'}.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result.startsWith('data:image/')) {
        setError(errNode, 'Datei konnte nicht verarbeitet werden.');
        return;
      }

      if (isAvatar) {
        avatarDataInput.value = result;
        avatarRemoveInput.value = '0';
        avatarPreviewSrc = result;
        if (avatarObjectUrl) {
          URL.revokeObjectURL(avatarObjectUrl);
          avatarObjectUrl = '';
        }
      } else {
        bannerDataInput.value = result;
        bannerRemoveInput.value = '0';
        bannerPreviewSrc = result;
        if (bannerObjectUrl) {
          URL.revokeObjectURL(bannerObjectUrl);
          bannerObjectUrl = '';
        }
      }

      updatePreview();
      markDirty();
    };
    reader.readAsDataURL(file);
  };

  chooseAvatarBtn.addEventListener('click', () => avatarFileInput.click());
  chooseBannerBtn.addEventListener('click', () => bannerFileInput.click());

  avatarFileInput.addEventListener('change', () => {
    const file = avatarFileInput.files?.[0];
    if (!file) {
      return;
    }
    readAndPreview(file, 'avatar');
  });

  bannerFileInput.addEventListener('change', () => {
    const file = bannerFileInput.files?.[0];
    if (!file) {
      return;
    }
    readAndPreview(file, 'banner');
  });

  removeAvatarBtn.addEventListener('click', () => {
    avatarDataInput.value = '';
    avatarRemoveInput.value = '1';
    avatarPreviewSrc = '';
    avatarFileInput.value = '';
    clearError(avatarErr);
    updatePreview();
    markDirty();
  });

  removeBannerBtn.addEventListener('click', () => {
    bannerDataInput.value = '';
    bannerRemoveInput.value = '1';
    bannerPreviewSrc = '';
    bannerFileInput.value = '';
    clearError(bannerErr);
    updatePreview();
    markDirty();
  });

  [displayNameInput, aboutInput, statusInput, customEmojiInput, customTextInput].forEach((input) => {
    input.addEventListener('input', updatePreview);
    input.addEventListener('change', updatePreview);
  });

  const aboutPlusJsonInput = document.getElementById('aboutPlusJsonInput');
  const aboutPlusSettingsData = document.getElementById('aboutPlusSettingsData');
  const aboutPlusBuilderList = document.getElementById('aboutPlusBuilderList');
  const aboutPlusOpenPickerBtn = document.getElementById('aboutPlusOpenPickerBtn');
  const aboutPlusTemplatePicker = document.getElementById('aboutPlusTemplatePicker');
  const aboutPlusTemplateGrid = document.getElementById('aboutPlusTemplateGrid');
  const aboutPlusClosePickerBtn = document.getElementById('aboutPlusClosePickerBtn');
  const aboutPlusPreviewRoot = document.getElementById('settingsAboutPlusPreview');

  if (aboutPlusJsonInput && aboutPlusSettingsData && aboutPlusBuilderList && aboutPlusPreviewRoot) {
    let aboutPlusPayload = {};
    try {
      aboutPlusPayload = JSON.parse(aboutPlusSettingsData.textContent || '{}');
    } catch (_error) {
      aboutPlusPayload = {};
    }

    const templates = Array.isArray(aboutPlusPayload.templates) ? aboutPlusPayload.templates : [];
    const templateDescriptors = {
      favorite_quote: {
        name: 'Quote Card',
        description: 'Hero quote with optional source.',
        preview: 'Lieber Unrecht leiden ...'
      },
      favorite_color: {
        name: 'Color Card',
        description: 'Soft theme glow plus hex accent.',
        preview: '#C2B280'
      },
      favorite_food: {
        name: 'Short Favorite Card',
        description: 'Compact favorite with optional image.',
        preview: 'Brot, Oliven, Ziegenkäse'
      },
      favorite_game: {
        name: 'Short Favorite Card',
        description: 'Game highlight with secure auto-cover lookup.',
        preview: 'Disco Elysium'
      },
      favorite_music: {
        name: 'Short Favorite Card',
        description: 'Compact favorite music card.',
        preview: 'Kithara-Hymnen'
      },
      favorite_book: {
        name: 'Short Favorite Card',
        description: 'Compact favorite book card.',
        preview: 'Politeia'
      },
      dislikes: {
        name: 'List Card',
        description: 'Chip/list based dislikes.',
        preview: 'Widersprüche ohne Prüfung'
      },
      media_card: {
        name: 'Media Card',
        description: '1-3 images with optional captions.',
        preview: '3-image gallery'
      },
      bio: {
        name: 'Long Text Card',
        description: 'Long-form paragraph card.',
        preview: 'Long text'
      }
    };
    const templatesWithMeta = templates.map((template) => ({
      ...template,
      displayName: templateDescriptors[template.key]?.name || template.label,
      description: templateDescriptors[template.key]?.description || 'Prebuilt profile card.',
      preview: templateDescriptors[template.key]?.preview || template.label
    }));
    const templateMap = new Map(templatesWithMeta.map((template) => [String(template.key || ''), template]));
    const createBlockId = () => `settings:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;
    const cloneBlocks = (value) => JSON.parse(JSON.stringify(Array.isArray(value) ? value : []));
    const normalizeList = (value) => (Array.isArray(value) ? value : String(value || '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)).slice(0, 12);
    const normalizeQuote = (value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return {
          text: String(value.text || '').trim(),
          source: String(value.source || '').trim()
        };
      }
      return {
        text: String(value || '').trim(),
        source: ''
      };
    };
    const normalizeMedia = (value) => {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      return {
        file_url: String(source.file_url || '').trim(),
        data_url: String(source.data_url || '').trim(),
        caption: String(source.caption || '').trim()
      };
    };
    const normalizeMediaCard = (value) => {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const legacyItem = normalizeMedia(source);
      const items = (Array.isArray(source.items) ? source.items : [legacyItem])
        .map((item) => normalizeMedia(item))
        .filter((item) => item.file_url || item.data_url || item.caption)
        .slice(0, 3);
      return {
        items
      };
    };
    const normalizeBuilderBlock = (raw, index) => {
      const source = raw && typeof raw === 'object' ? raw : {};
      const template = templateMap.get(String(source.template_key || '').trim()) || null;
      const type = String(source.type || template?.type || 'text_short');
      let nextValue = String(source.value || '').trim();
      if (type === 'quote') {
        nextValue = normalizeQuote(source.value);
      } else if (type === 'list') {
        nextValue = normalizeList(source.value);
      } else if (type === 'media_card') {
        nextValue = normalizeMediaCard(source.value);
      } else if (type === 'color') {
        const candidate = String(source.value || '').trim();
        nextValue = /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : '';
      }

      const media = template?.supports_image || type === 'media_card'
        ? normalizeMedia(source.media || {})
        : {};

      return {
        id: String(source.id || source.key || createBlockId()).trim() || createBlockId(),
        key: String(source.key || source.template_key || source.id || createBlockId()).trim() || createBlockId(),
        template_key: String(source.template_key || '').trim(),
        type,
        kind: String(source.kind || template?.kind || 'text').trim() || 'text',
        label: String(source.label || template?.label || 'Custom Field').trim() || 'Custom Field',
        value: nextValue,
        visible: source.visible !== false,
        order: Number(source.order ?? index),
        display_mode: String(source.display_mode || (source.show_in_mini_profile === true ? 'mini' : 'full')).trim().toLowerCase() === 'mini' ? 'mini' : 'full',
        icon: String(source.icon || '').trim(),
        media,
        privacy: String(source.privacy || 'public'),
        show_in_full_profile: true,
        show_in_mini_profile: String(source.display_mode || '').trim().toLowerCase() === 'mini' || source.show_in_mini_profile === true,
        show_in_dm_info_sidebar: source.show_in_dm_info_sidebar === true,
        expanded: source.expanded === true
      };
    };
    const blockHasValue = (block) => {
      if (!block || block.visible === false || block.show_in_full_profile === false) {
        return false;
      }
      if (block.type === 'color') {
        return Boolean(String(block.value || '').trim());
      }
      if (block.type === 'quote') {
        return Boolean(String(block.value?.text || '').trim());
      }
      if (block.type === 'list') {
        return Array.isArray(block.value) && block.value.length > 0;
      }
      if (block.type === 'media_card') {
        return Array.isArray(block.value?.items) && block.value.items.length > 0;
      }
      return Boolean(String(block.value || '').trim());
    };
    const getBlockImageUrl = (block) => {
      if (block.type === 'media_card') {
        const firstItem = Array.isArray(block.value?.items) ? block.value.items[0] : [];
        return String(firstItem?.data_url || firstItem?.file_url || '').trim();
      }
      return String(block.media?.data_url || block.media?.file_url || '').trim();
    };
    const getBlockMediaItems = (block) => (
      block.type === 'media_card' && Array.isArray(block.value?.items)
        ? block.value.items
        : []
    );
    const normalizeHexColor = (value) => {
      const match = String(value || '').trim().match(/^#([0-9a-f]{6})$/i);
      return match ? `#${match[1]}`.toLowerCase() : '';
    };
    const toRgba = (hex, alpha = 1) => {
      const normalized = normalizeHexColor(hex);
      if (!normalized) {
        return '';
      }
      const channel = (offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16);
      return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
    };
    const renderPreviewFavoriteCard = (block) => {
      const imageUrl = getBlockImageUrl(block);
      const value = String(block?.value || '').trim();
      if (!value) {
        return '';
      }
      return `
        <section class="profile-card profile-about-favorite-card" data-about-plus-template="${escapeHtml(block.template_key || block.key || '')}">
          <div class="profile-about-favorite-label">${escapeHtml(block.label)}</div>
          ${imageUrl ? `<div class="profile-about-favorite-media"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(block.label)}" loading="lazy" /></div>` : ''}
          <p class="profile-copy">${escapeHtml(value)}</p>
        </section>
      `;
    };
    const renderPreview = (blocks) => {
      const visibleBlocks = blocks
        .slice()
        .map((block, index) => ({ ...block, order: index }))
        .filter((block) => blockHasValue(block));
      if (!visibleBlocks.length) {
        aboutPlusPreviewRoot.innerHTML = '<div class="cat-card empty">Keine Profilangaben vorhanden.</div>';
        return;
      }

      const blockByTemplate = visibleBlocks.reduce((acc, block) => {
        const key = String(block?.template_key || '').trim();
        if (key) {
          acc[key] = block;
        }
        return acc;
      }, {});
      const quoteBlock = blockByTemplate.favorite_quote || null;
      const colorBlock = blockByTemplate.favorite_color || null;
      const favoriteBlocks = [
        blockByTemplate.favorite_food,
        blockByTemplate.favorite_game,
        blockByTemplate.favorite_music,
        blockByTemplate.favorite_book
      ].filter(Boolean);
      const dislikesBlock = blockByTemplate.dislikes || null;
      const bioBlock = blockByTemplate.bio || null;
      const themeColor = normalizeHexColor(colorBlock?.value || '');
      const themeStyle = themeColor
        ? ` style="--about-plus-accent:${escapeHtml(themeColor)};--about-plus-accent-soft:${escapeHtml(toRgba(themeColor, 0.18))};--about-plus-accent-strong:${escapeHtml(toRgba(themeColor, 0.32))};"`
        : '';

      aboutPlusPreviewRoot.innerHTML = `
        <section class="profile-about-showcase"${themeStyle}>
          ${quoteBlock && String(quoteBlock.value?.text || '').trim() ? `
            <section class="profile-about-quote-hero">
              <span class="about-plus-quote-mark" aria-hidden="true">“</span>
              <div class="profile-about-quote-copy">
                <div class="profile-about-quote-label">${escapeHtml(quoteBlock.label)}</div>
                <blockquote>${escapeHtml(String(quoteBlock.value?.text || '').trim())}</blockquote>
                ${quoteBlock.value?.source ? `<footer>${escapeHtml(String(quoteBlock.value.source || '').trim())}</footer>` : ''}
              </div>
            </section>
          ` : ''}
          ${themeColor ? `
            <section class="profile-about-color-section">
              <div class="profile-about-color-swatch" style="background:${escapeHtml(themeColor)};"></div>
              <div class="profile-about-color-copy">
                <div class="profile-about-section-label">${escapeHtml(colorBlock?.label || 'Favorite Color')}</div>
                <strong>${escapeHtml(themeColor)}</strong>
                <p class="sub">Soft profile glow from your color theme.</p>
              </div>
            </section>
          ` : ''}
          ${favoriteBlocks.length ? `
            <section class="profile-about-section">
              <div class="profile-about-section-head">
                <div class="profile-about-section-label">Favorites</div>
              </div>
              <div class="profile-about-favorites-grid">
                ${favoriteBlocks.map((block) => renderPreviewFavoriteCard(block)).join('')}
              </div>
            </section>
          ` : ''}
          ${dislikesBlock && Array.isArray(dislikesBlock.value) && dislikesBlock.value.length ? `
            <section class="profile-about-section">
              <section class="profile-card profile-about-detail-card is-dislikes">
                <div class="profile-about-detail-label">${escapeHtml(dislikesBlock.label)}</div>
                <div class="profile-about-tag-row">
                  ${dislikesBlock.value.map((item) => `<span class="profile-about-tag">${escapeHtml(String(item || ''))}</span>`).join('')}
                </div>
              </section>
            </section>
          ` : ''}
          ${bioBlock && String(bioBlock.value || '').trim() ? `
            <section class="profile-about-section">
              <section class="profile-card profile-about-detail-card">
                <div class="profile-about-detail-label">${escapeHtml(bioBlock.label)}</div>
                <p class="profile-copy">${escapeHtml(String(bioBlock.value || '').trim())}</p>
              </section>
            </section>
          ` : ''}
        </section>
      `;
    };
    const serializeBlocks = (blocks) => ({
      fields: blocks
        .slice()
        .map((block, index) => ({
          ...block,
          expanded: undefined,
          order: index
        }))
    });
    let blocks = cloneBlocks(Array.isArray(aboutPlusPayload.fields) ? aboutPlusPayload.fields : []).map((block, index) => normalizeBuilderBlock(block, index));
    const initialBlocks = cloneBlocks(blocks);
    let draggedBlockId = '';

    const syncAboutPlusHiddenInput = () => {
      aboutPlusJsonInput.value = JSON.stringify(serializeBlocks(blocks));
    };

    const renderTemplatePicker = () => {
      if (!aboutPlusTemplatePicker || !aboutPlusTemplateGrid) {
        return;
      }
      aboutPlusTemplateGrid.innerHTML = templatesWithMeta.map((template) => {
        const alreadyExists = blocks.some((block) => block.template_key === template.key);
        return `
          <button
            type="button"
            class="about-plus-template-card ${alreadyExists ? 'is-disabled' : ''}"
            data-about-plus-template-create="${escapeHtml(template.key)}"
            ${alreadyExists ? 'disabled' : ''}
          >
            <strong>${escapeHtml(template.displayName)}</strong>
            <p>${escapeHtml(template.description)}</p>
            <div class="about-plus-template-preview">
              <span class="about-plus-template-badge">${escapeHtml(template.type)}</span>
              <span>${escapeHtml(template.preview)}</span>
            </div>
          </button>
        `;
      }).join('');
    };

    const setTemplatePickerOpen = (open) => {
      if (!aboutPlusTemplatePicker) {
        return;
      }
      aboutPlusTemplatePicker.hidden = !open;
    };

    const renderBuilder = () => {
      blocks = blocks
        .map((block, index) => ({ ...block, order: index }));
      aboutPlusBuilderList.innerHTML = blocks.length
        ? blocks.map((block, index) => {
          const complete = blockHasValue({ ...block, visible: true, show_in_full_profile: true });
          const listItems = block.type === 'list' && Array.isArray(block.value) ? block.value : [];
          const mediaItems = getBlockMediaItems(block);
          const summary = complete ? 'Ready to show' : 'Needs content';
          return `
            <section class="about-plus-builder-card" data-about-plus-block-id="${escapeHtml(block.id)}" data-testid="about-plus-builder-card" draggable="true">
              <div class="about-plus-builder-head">
                <div class="about-plus-builder-meta">
                  <strong>${escapeHtml(block.label)}</strong>
                  <div class="about-plus-builder-status ${complete ? 'is-complete' : ''}">${summary}</div>
                </div>
                <div class="about-plus-builder-actions">
                  <button
                    type="button"
                    class="chip about-plus-eye-toggle ${block.visible !== false ? 'is-visible' : 'is-hidden'}"
                    data-about-plus-visible-toggle="${escapeHtml(block.id)}"
                    aria-pressed="${block.visible !== false ? 'true' : 'false'}"
                    title="${block.visible !== false ? 'Hide card' : 'Show card'}"
                    data-testid="about-plus-visibility-toggle"
                  >${block.visible !== false ? '👁' : '🙈'}</button>
                  ${block.visible !== false ? `
                    <select class="about-plus-mode-select" data-about-plus-display-mode="${escapeHtml(block.id)}" data-testid="about-plus-display-mode-select">
                      <option value="full" ${block.display_mode !== 'mini' ? 'selected' : ''}>Full</option>
                      <option value="mini" ${block.display_mode === 'mini' ? 'selected' : ''}>Mini</option>
                    </select>
                  ` : ''}
                  <button type="button" class="chip icon-only" data-about-plus-move-up="${escapeHtml(block.id)}" title="Move Up" ${index === 0 ? 'disabled' : ''}>↑</button>
                  <button type="button" class="chip icon-only" data-about-plus-move-down="${escapeHtml(block.id)}" title="Move Down" ${index === blocks.length - 1 ? 'disabled' : ''}>↓</button>
                  <button type="button" class="chip icon-only" data-about-plus-advanced-toggle="${escapeHtml(block.id)}" title="Details">${block.expanded ? '▾' : '▸'}</button>
                  <button type="button" class="chip icon-only danger" data-about-plus-remove="${escapeHtml(block.id)}" title="Remove">✕</button>
                </div>
              </div>
              <div class="about-plus-builder-editor">
                ${block.type === 'text_short' ? `<input type="text" value="${escapeHtml(String(block.value || ''))}" maxlength="200" placeholder="Value" data-about-plus-value="${escapeHtml(block.id)}" />` : ''}
                ${block.type === 'text_long' ? `<textarea rows="4" maxlength="1200" placeholder="Write something..." data-about-plus-value="${escapeHtml(block.id)}">${escapeHtml(String(block.value || ''))}</textarea>` : ''}
                ${block.type === 'color' ? `
                  <div class="about-plus-color-row">
                    <input type="text" value="${escapeHtml(String(block.value || ''))}" maxlength="7" placeholder="#AABBCC" data-about-plus-value="${escapeHtml(block.id)}" />
                    <input type="color" value="${escapeHtml(/^#[0-9a-fA-F]{6}$/.test(String(block.value || '')) ? String(block.value) : '#86a7ff')}" data-about-plus-color-picker="${escapeHtml(block.id)}" />
                  </div>
                ` : ''}
                ${block.type === 'quote' ? `
                  <textarea rows="3" maxlength="320" placeholder="Quote" data-about-plus-quote-text="${escapeHtml(block.id)}">${escapeHtml(String(block.value?.text || ''))}</textarea>
                  <input type="text" value="${escapeHtml(String(block.value?.source || ''))}" maxlength="160" placeholder="Source (optional)" data-about-plus-quote-source="${escapeHtml(block.id)}" />
                ` : ''}
                ${block.type === 'list' ? `
                  <div class="about-plus-list-editor">
                    <div class="about-plus-list-chip-row">
                      ${listItems.map((item, itemIndex) => `<span class="about-plus-list-chip">${escapeHtml(item)}<button type="button" class="chip" data-about-plus-list-remove="${escapeHtml(block.id)}" data-about-plus-list-index="${itemIndex}">x</button></span>`).join('')}
                    </div>
                    <div class="about-plus-list-add">
                      <input type="text" maxlength="160" placeholder="Add list item" data-about-plus-list-input="${escapeHtml(block.id)}" />
                      <button type="button" class="btn" data-about-plus-list-add="${escapeHtml(block.id)}">Add</button>
                    </div>
                  </div>
                ` : ''}
                ${(block.type === 'media_card' || block.template_key === 'favorite_food') ? `
                  <div class="about-plus-list-editor">
                    <div class="about-plus-builder-actions">
                      <button type="button" class="btn" data-about-plus-media-pick="${escapeHtml(block.id)}">${block.type === 'media_card' ? 'Add Photos' : 'Choose File'}</button>
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" ${block.type === 'media_card' ? 'multiple' : ''} hidden data-about-plus-media-input="${escapeHtml(block.id)}" />
                      <button type="button" class="chip" data-about-plus-media-clear="${escapeHtml(block.id)}" ${(block.type === 'media_card' ? mediaItems.length : Boolean(getBlockImageUrl(block))) ? '' : 'disabled'}>${block.type === 'media_card' ? 'Clear All' : 'Remove File'}</button>
                    </div>
                    <div class="about-plus-media-preview">
                      ${block.type === 'media_card'
                        ? (mediaItems.length
                          ? `
                            <div class="about-plus-media-grid" data-testid="about-plus-media-grid">
                              ${mediaItems.map((item, itemIndex) => `
                                <figure class="about-plus-media-tile">
                                  <img src="${escapeHtml(String(item.data_url || item.file_url || ''))}" alt="${escapeHtml(`${block.label} ${itemIndex + 1}`)}" />
                                  <figcaption>
                                    <input type="text" value="${escapeHtml(String(item.caption || ''))}" maxlength="120" placeholder="Caption ${itemIndex + 1}" data-about-plus-media-item-caption="${escapeHtml(block.id)}" data-about-plus-media-item-index="${itemIndex}" />
                                  </figcaption>
                                  <button type="button" class="chip icon-only" data-about-plus-media-item-remove="${escapeHtml(block.id)}" data-about-plus-media-item-index="${itemIndex}" title="Remove Photo">✕</button>
                                </figure>
                              `).join('')}
                            </div>
                          `
                          : '<span>No photos selected.</span>')
                        : (getBlockImageUrl(block) ? `<img src="${escapeHtml(getBlockImageUrl(block))}" alt="${escapeHtml(block.label)}" />` : '<span>No media selected.</span>')}
                    </div>
                    ${block.type === 'media_card'
                      ? `<p class="sub">Up to 3 images. Reopen Add Photos to append more.</p>`
                      : ''}
                  </div>
                ` : ''}
                <div class="about-plus-builder-advanced" ${block.expanded ? '' : 'hidden'}>
                  <label>Label
                    <input type="text" value="${escapeHtml(block.label)}" maxlength="80" data-about-plus-label="${escapeHtml(block.id)}" />
                  </label>
                  <p class="sub">${escapeHtml(templateMap.get(block.template_key)?.description || 'Only relevant inputs are shown for this card type.')}</p>
                </div>
              </div>
            </section>
          `;
        }).join('')
        : '<div class="cat-card empty">Noch keine About+-Cards. Öffne den Template-Picker und füge deine erste Card hinzu.</div>';
      renderPreview(blocks);
      renderTemplatePicker();
      syncAboutPlusHiddenInput();
    };

    const markAboutPlusDirty = () => {
      renderBuilder();
      markDirty();
    };

    const addTemplateBlock = (templateKey) => {
      const template = templateMap.get(String(templateKey || '').trim());
      if (!template) {
        return;
      }
      if (blocks.some((block) => block.template_key === template.key)) {
        return;
      }
      blocks.push(normalizeBuilderBlock({
        id: `template:${template.key}`,
        key: template.key,
        template_key: template.key,
        type: template.type,
        kind: template.kind,
        label: template.label,
        value: template.type === 'quote' ? { text: '', source: '' } : template.type === 'list' ? [] : template.type === 'media_card' ? { items: [] } : '',
        visible: true,
        order: blocks.length,
        display_mode: 'full',
        media: template.supports_image ? { file_url: '', data_url: '', caption: '' } : {}
      }, blocks.length));
      setTemplatePickerOpen(false);
      markAboutPlusDirty();
    };

    aboutPlusOpenPickerBtn?.addEventListener('click', () => {
      setTemplatePickerOpen(true);
    });

    aboutPlusClosePickerBtn?.addEventListener('click', () => {
      setTemplatePickerOpen(false);
    });

    aboutPlusTemplateGrid?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-about-plus-template-create]') : null;
      if (!target) {
        return;
      }
      addTemplateBlock(String(target.getAttribute('data-about-plus-template-create') || '').trim());
    });

    aboutPlusBuilderList.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }
      const findIndex = (attr) => blocks.findIndex((block) => block.id === String(target.getAttribute(attr) || '').trim());
      const toggleId = String(target.getAttribute('data-about-plus-visible-toggle') || '').trim();
      if (toggleId) {
        const block = blocks.find((entry) => entry.id === toggleId);
        if (block) {
          block.visible = !block.visible;
          markAboutPlusDirty();
        }
        return;
      }
      const advancedId = String(target.getAttribute('data-about-plus-advanced-toggle') || '').trim();
      if (advancedId) {
        const block = blocks.find((entry) => entry.id === advancedId);
        if (block) {
          block.expanded = !block.expanded;
          renderBuilder();
        }
        return;
      }
      const moveUpId = String(target.getAttribute('data-about-plus-move-up') || '').trim();
      if (moveUpId) {
        const index = blocks.findIndex((entry) => entry.id === moveUpId);
        if (index > 0) {
          [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
          markAboutPlusDirty();
        }
        return;
      }
      const moveDownId = String(target.getAttribute('data-about-plus-move-down') || '').trim();
      if (moveDownId) {
        const index = blocks.findIndex((entry) => entry.id === moveDownId);
        if (index >= 0 && index < blocks.length - 1) {
          [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
          markAboutPlusDirty();
        }
        return;
      }
      const removeIndex = findIndex('data-about-plus-remove');
      if (removeIndex >= 0) {
        blocks.splice(removeIndex, 1);
        markAboutPlusDirty();
        return;
      }
      const addListId = String(target.getAttribute('data-about-plus-list-add') || '').trim();
      if (addListId) {
        const block = blocks.find((entry) => entry.id === addListId);
        const input = aboutPlusBuilderList.querySelector(`[data-about-plus-list-input="${addListId}"]`);
        const value = input instanceof HTMLInputElement ? input.value.trim() : '';
        if (block && value) {
          block.value = normalizeList([...(Array.isArray(block.value) ? block.value : []), value]);
          if (input instanceof HTMLInputElement) {
            input.value = '';
          }
          markAboutPlusDirty();
        }
        return;
      }
      const removeListId = String(target.getAttribute('data-about-plus-list-remove') || '').trim();
      if (removeListId) {
        const itemIndex = Number(target.getAttribute('data-about-plus-list-index') || -1);
        const block = blocks.find((entry) => entry.id === removeListId);
        if (block && Array.isArray(block.value) && itemIndex >= 0 && itemIndex < block.value.length) {
          block.value.splice(itemIndex, 1);
          block.value = normalizeList(block.value);
          markAboutPlusDirty();
        }
        return;
      }
      const pickMediaId = String(target.getAttribute('data-about-plus-media-pick') || '').trim();
      if (pickMediaId) {
        aboutPlusBuilderList.querySelector(`[data-about-plus-media-input="${pickMediaId}"]`)?.click();
        return;
      }
      const clearMediaId = String(target.getAttribute('data-about-plus-media-clear') || '').trim();
      if (clearMediaId) {
        const block = blocks.find((entry) => entry.id === clearMediaId);
        if (block) {
          if (block.type === 'media_card') {
            block.value = {
              ...normalizeMediaCard(block.value),
              items: []
            };
          } else {
            block.media = {
              ...(block.media || {}),
              file_url: '',
              data_url: ''
            };
          }
          markAboutPlusDirty();
        }
        return;
      }
      const removeMediaItemId = String(target.getAttribute('data-about-plus-media-item-remove') || '').trim();
      if (removeMediaItemId) {
        const itemIndex = Number(target.getAttribute('data-about-plus-media-item-index') || -1);
        const block = blocks.find((entry) => entry.id === removeMediaItemId);
        if (block && block.type === 'media_card' && Array.isArray(block.value?.items) && itemIndex >= 0 && itemIndex < block.value.items.length) {
          block.value = {
            ...normalizeMediaCard(block.value),
            items: block.value.items.filter((_, index) => index !== itemIndex)
          };
          markAboutPlusDirty();
        }
      }
    });

    aboutPlusBuilderList.addEventListener('input', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }
      const attrValue = (name) => String(target.getAttribute(name) || '').trim();
      const blockBy = (name) => blocks.find((entry) => entry.id === attrValue(name));
      const labelBlock = blockBy('data-about-plus-label');
      if (labelBlock && target instanceof HTMLInputElement) {
        labelBlock.label = target.value.trim() || 'Custom Field';
        markAboutPlusDirty();
        return;
      }
      const valueBlock = blockBy('data-about-plus-value');
      if (valueBlock && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        valueBlock.value = valueBlock.type === 'color'
          ? (/^#[0-9a-fA-F]{6}$/.test(target.value.trim()) ? target.value.trim() : '')
          : target.value;
        markAboutPlusDirty();
        return;
      }
      const colorBlock = blockBy('data-about-plus-color-picker');
      if (colorBlock && target instanceof HTMLInputElement) {
        colorBlock.value = target.value;
        markAboutPlusDirty();
        return;
      }
      const quoteTextBlock = blockBy('data-about-plus-quote-text');
      if (quoteTextBlock && target instanceof HTMLTextAreaElement) {
        quoteTextBlock.value = {
          ...normalizeQuote(quoteTextBlock.value),
          text: target.value
        };
        markAboutPlusDirty();
        return;
      }
      const quoteSourceBlock = blockBy('data-about-plus-quote-source');
      if (quoteSourceBlock && target instanceof HTMLInputElement) {
        quoteSourceBlock.value = {
          ...normalizeQuote(quoteSourceBlock.value),
          source: target.value
        };
        markAboutPlusDirty();
        return;
      }
      const mediaCaptionBlock = blockBy('data-about-plus-media-caption');
      if (mediaCaptionBlock && target instanceof HTMLInputElement) {
        mediaCaptionBlock.value = {
          ...normalizeMedia(mediaCaptionBlock.value),
          caption: target.value
        };
        markAboutPlusDirty();
        return;
      }
      const mediaItemCaptionBlock = blockBy('data-about-plus-media-item-caption');
      if (mediaItemCaptionBlock && target instanceof HTMLInputElement) {
        const itemIndex = Number(target.getAttribute('data-about-plus-media-item-index') || -1);
        const nextValue = normalizeMediaCard(mediaItemCaptionBlock.value);
        if (itemIndex >= 0 && itemIndex < nextValue.items.length) {
          nextValue.items[itemIndex] = {
            ...nextValue.items[itemIndex],
            caption: target.value.trim()
          };
          mediaItemCaptionBlock.value = nextValue;
          markAboutPlusDirty();
        }
      }
    });

    aboutPlusBuilderList.addEventListener('change', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }
      const attrValue = (name) => String(target.getAttribute(name) || '').trim();
      const blockBy = (name) => blocks.find((entry) => entry.id === attrValue(name));
      const modeBlock = blockBy('data-about-plus-display-mode');
      if (modeBlock && target instanceof HTMLSelectElement) {
        modeBlock.display_mode = target.value === 'mini' ? 'mini' : 'full';
        modeBlock.show_in_mini_profile = modeBlock.display_mode === 'mini';
        markAboutPlusDirty();
        return;
      }
      const mediaBlock = blockBy('data-about-plus-media-input');
      if (mediaBlock && target instanceof HTMLInputElement) {
        const files = [...(target.files || [])];
        if (!files.length) {
          return;
        }
        if (files.some((file) => !validTypes.includes(file.type) || file.size > bannerMax)) {
          return;
        }
        Promise.all(files.map((file) => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.startsWith('data:image/') ? result : '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        }))).then((results) => {
          const validResults = results.filter(Boolean);
          if (!validResults.length) {
            return;
          }
          if (mediaBlock.type === 'media_card') {
            const nextValue = normalizeMediaCard(mediaBlock.value);
            const nextItems = [
              ...nextValue.items,
              ...validResults.map((result) => ({
                file_url: '',
                data_url: result,
                caption: ''
              }))
            ].slice(0, 3);
            mediaBlock.value = {
              items: nextItems
            };
          } else {
            mediaBlock.media = {
              ...normalizeMedia(mediaBlock.media),
              data_url: validResults[0],
              file_url: ''
            };
          }
          markAboutPlusDirty();
        });
      }
    });

    aboutPlusBuilderList.addEventListener('dragstart', (event) => {
      const card = event.target instanceof Element ? event.target.closest('[data-about-plus-block-id]') : null;
      if (!(card instanceof HTMLElement)) {
        return;
      }
      draggedBlockId = String(card.getAttribute('data-about-plus-block-id') || '').trim();
      if (!draggedBlockId) {
        return;
      }
      card.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedBlockId);
      }
    });

    aboutPlusBuilderList.addEventListener('dragover', (event) => {
      const card = event.target instanceof Element ? event.target.closest('[data-about-plus-block-id]') : null;
      if (!(card instanceof HTMLElement) || !draggedBlockId) {
        return;
      }
      event.preventDefault();
      aboutPlusBuilderList.querySelectorAll('.about-plus-builder-card.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
      if (String(card.getAttribute('data-about-plus-block-id') || '').trim() !== draggedBlockId) {
        card.classList.add('is-drop-target');
      }
    });

    aboutPlusBuilderList.addEventListener('drop', (event) => {
      const card = event.target instanceof Element ? event.target.closest('[data-about-plus-block-id]') : null;
      if (!(card instanceof HTMLElement) || !draggedBlockId) {
        return;
      }
      event.preventDefault();
      const targetId = String(card.getAttribute('data-about-plus-block-id') || '').trim();
      if (!targetId || targetId === draggedBlockId) {
        return;
      }
      const fromIndex = blocks.findIndex((block) => block.id === draggedBlockId);
      const toIndex = blocks.findIndex((block) => block.id === targetId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return;
      }
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      draggedBlockId = '';
      markAboutPlusDirty();
    });

    aboutPlusBuilderList.addEventListener('dragend', () => {
      draggedBlockId = '';
      aboutPlusBuilderList.querySelectorAll('.about-plus-builder-card.is-dragging, .about-plus-builder-card.is-drop-target').forEach((node) => {
        node.classList.remove('is-dragging', 'is-drop-target');
      });
    });

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !aboutPlusTemplatePicker || aboutPlusTemplatePicker.hidden) {
        return;
      }
      if (target.closest('#aboutPlusOpenPickerBtn') || target.closest('#aboutPlusTemplatePicker')) {
        return;
      }
      setTemplatePickerOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && aboutPlusTemplatePicker && !aboutPlusTemplatePicker.hidden) {
        setTemplatePickerOpen(false);
      }
    });

    form.addEventListener('reset', () => {
      window.setTimeout(() => {
        blocks = cloneBlocks(initialBlocks).map((block, index) => normalizeBuilderBlock(block, index));
        setTemplatePickerOpen(false);
        renderBuilder();
      }, 0);
    });

    renderBuilder();
  }

  updatePreview();
})();

(function initAppearanceLivePreview() {
  const form = document.querySelector('form[action="/app/settings/appearance/save"]');
  if (!form) {
    return;
  }

  const theme = form.querySelector('select[name="theme"]');
  const fontScale = form.querySelector('input[name="fontScale"]');
  const density = form.querySelector('select[name="density"]');
  const reducedMotion = form.querySelector('input[name="reducedMotion"]');

  const apply = () => {
    if (theme) {
      document.body.dataset.theme = theme.value || 'dark';
    }
    if (density) {
      document.body.dataset.density = density.value || 'cozy';
    }
    if (fontScale) {
      const safeScale = Math.max(80, Math.min(140, Number(fontScale.value) || 100));
      document.body.style.setProperty('--app-font-scale', `${safeScale}%`);
    }
    if (reducedMotion) {
      document.body.dataset.reducedMotion = reducedMotion.checked ? '1' : '0';
    }
  };

  [theme, fontScale, density, reducedMotion].forEach((el) => {
    if (!el) {
      return;
    }
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });

  form.addEventListener('reset', () => {
    setTimeout(apply, 0);
  });

  apply();
})();

(function initPresenceSync() {
  const currentUserId = Number(document.body?.dataset.currentUserId || 0);
  if (!currentUserId) {
    return;
  }

  const knownPresence = new Map();
  let eventSource = null;
  let heartbeatTimerId = 0;
  let idleTimerId = 0;
  let clientIdle = false;

  const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/"/g, '\\"');
  };

  const presenceLabel = (status) => {
    if (status === 'idle') {
      return 'abwesend';
    }
    if (status === 'dnd') {
      return 'nicht stören';
    }
    if (status === 'streaming') {
      return 'streaming';
    }
    return status === 'online' ? 'online' : 'offline';
  };

  const normalizeStatus = (value) => ['online', 'idle', 'dnd', 'streaming'].includes(String(value || '').toLowerCase())
    ? String(value).toLowerCase()
    : 'offline';

  const applyPresence = (snapshot) => {
    const userId = Number(snapshot?.user_id || 0);
    if (!userId) {
      return;
    }

    const status = normalizeStatus(snapshot.status);
    const label = presenceLabel(status);
    const lastSeen = String(snapshot.last_seen || '');
    knownPresence.set(userId, {
      user_id: userId,
      status,
      last_seen: lastSeen
    });

    document.querySelectorAll(`[data-presence-user-id="${escapeSelector(userId)}"]`).forEach((root) => {
      if (!(root instanceof HTMLElement)) {
        return;
      }

      root.dataset.presenceStatus = status;
      root.dataset.presenceLastSeen = lastSeen;

      const dots = [];
      if (root.hasAttribute('data-presence-dot')) {
        dots.push(root);
      }
      root.querySelectorAll('[data-presence-dot]').forEach((node) => dots.push(node));
      dots.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        node.classList.remove('online', 'idle', 'dnd', 'offline');
        node.classList.add(status);
      });

      const textNodes = [];
      if (root.hasAttribute('data-presence-text')) {
        textNodes.push(root);
      }
      root.querySelectorAll('[data-presence-text]').forEach((node) => textNodes.push(node));
      textNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        const prefix = String(node.dataset.presencePrefix || '').trim();
        const suffix = String(node.dataset.presenceSuffix || '');
        node.textContent = prefix ? `${prefix} • ${label}${suffix}` : label;
      });
    });
  };

  const sendHeartbeat = async ({ keepalive = false } = {}) => {
    if (!navigator.onLine) {
      return;
    }

    try {
      await fetch('/app/presence/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ idle: clientIdle }),
        keepalive
      });
    } catch (_error) {
      // Presence heartbeat is best-effort.
    }
  };

  const sendDisconnect = () => {
    const payload = JSON.stringify({});
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/app/presence/disconnect', blob);
      return;
    }

    fetch('/app/presence/disconnect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: payload,
      keepalive: true
    }).catch(() => {});
  };

  const resetIdleTimer = () => {
    window.clearTimeout(idleTimerId);
    idleTimerId = window.setTimeout(() => {
      if (clientIdle) {
        return;
      }
      clientIdle = true;
      sendHeartbeat();
    }, 5 * 60 * 1000);
  };

  const markActive = () => {
    const wasIdle = clientIdle;
    clientIdle = false;
    resetIdleTimer();
    if (wasIdle) {
      sendHeartbeat();
    }
  };

  const attachActivityListeners = () => {
    ['mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach((eventName) => {
      window.addEventListener(eventName, markActive, { passive: true });
    });
  };

  if (typeof window.EventSource === 'function') {
    eventSource = new window.EventSource('/app/presence/stream');
    eventSource.addEventListener('presence:bulk', (event) => {
      try {
        const payload = JSON.parse(String(event.data || '{}'));
        Object.values(payload.users || {}).forEach((snapshot) => applyPresence(snapshot));
      } catch (_error) {
        // Ignore malformed event payloads.
      }
    });
    eventSource.addEventListener('presence:update', (event) => {
      try {
        applyPresence(JSON.parse(String(event.data || '{}')));
      } catch (_error) {
        // Ignore malformed event payloads.
      }
    });
  }

  attachActivityListeners();
  resetIdleTimer();
  sendHeartbeat();
  heartbeatTimerId = window.setInterval(() => {
    sendHeartbeat();
  }, 25_000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      markActive();
      sendHeartbeat();
    }
  });

  window.addEventListener('beforeunload', () => {
    window.clearInterval(heartbeatTimerId);
    window.clearTimeout(idleTimerId);
    if (eventSource) {
      eventSource.close();
    }
    sendDisconnect();
  });

  window.addEventListener('apeiron:presence-force-idle', () => {
    clientIdle = true;
    window.clearTimeout(idleTimerId);
    sendHeartbeat();
  });

  window.__apeironPresenceUi = {
    get(userId) {
      return knownPresence.get(Number(userId || 0)) || null;
    },
    apply(snapshot) {
      applyPresence(snapshot);
    }
  };
})();

(function initFullProfileOverlay() {
  const modal = document.getElementById('fullProfileModal');
  const layout = document.getElementById('fullProfileLayout');
  const loading = document.getElementById('fullProfileLoading');
  if (!modal || !layout || !loading) {
    return;
  }

  let activeTab = 'photos';
  let activeUserId = 0;
  let payloadCache = null;
  let lightboxPhotoId = 0;
  let aboutPlusEditOpen = false;
  let pendingAboutPlusFoodImage = '';
  let removeAboutPlusFoodImage = false;
  let lastFocusedElement = null;

  const escapeHtml = (value) => String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const statusLabel = (status) => {
    if (status === 'idle') {
      return 'abwesend';
    }
    if (status === 'dnd') {
      return 'nicht stören';
    }
    if (status === 'streaming') {
      return 'streaming';
    }
    return status === 'online' ? 'online' : 'offline';
  };

  const formatMemberSince = (value) => {
    const stamp = new Date(String(value || ''));
    if (Number.isNaN(stamp.getTime())) {
      return 'Unknown';
    }
    return stamp.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getFieldMap = (payload) => {
    const fields = Array.isArray(payload?.about_plus?.fields) ? payload.about_plus.fields : [];
    return fields.reduce((acc, field) => {
      acc[String(field.key || '')] = field;
      return acc;
    }, {});
  };

  const renderBanner = (profile) => {
    const bannerUrl = String(profile.banner_url || '').trim();
    const fallbackUrl = String(profile.banner_fallback_url || '').trim();
    if (!bannerUrl) {
      return '<div class="profile-banner" data-testid="profile-banner"><span class="profile-banner-fallback"></span></div>';
    }
    return `
      <div class="profile-banner" data-testid="profile-banner">
        <img
          class="profile-banner-image"
          src="${escapeHtml(bannerUrl)}"
          alt="${escapeHtml(profile.display_name || profile.username || 'Banner')}"
          loading="lazy"
          data-fallback-src="${escapeHtml(fallbackUrl)}"
          onerror="if(!this.dataset.failed&&this.dataset.fallbackSrc){this.dataset.failed='1';this.src=this.dataset.fallbackSrc;return;}this.hidden=true;this.nextElementSibling.hidden=false;"
        />
        <span class="profile-banner-fallback" hidden></span>
      </div>
    `;
  };

  const renderAvatar = (profile) => {
    const fallback = escapeHtml(String(profile.display_name || profile.username || '?').trim().charAt(0).toUpperCase() || '?');
    const avatarUrl = String(profile.avatar_url || '').trim();
    const fallbackUrl = String(profile.avatar_fallback_url || '').trim();
    if (avatarUrl) {
      return `
        <img
          class="profile-avatar"
          src="${escapeHtml(avatarUrl)}"
          alt="${escapeHtml(profile.display_name || profile.username)}"
          loading="lazy"
          data-fallback-src="${escapeHtml(fallbackUrl)}"
          onerror="if(!this.dataset.failed&&this.dataset.fallbackSrc){this.dataset.failed='1';this.src=this.dataset.fallbackSrc;return;}this.hidden=true;this.nextElementSibling.hidden=false;"
        />
        <div class="profile-avatar fallback" hidden>${fallback}</div>
      `;
    }
    return `<div class="profile-avatar fallback">${fallback}</div>`;
  };

  const getProfileTabTestId = (tabId) => {
    if (tabId === 'photos') {
      return 'profile-tab-photos';
    }
    if (tabId === 'about_plus') {
      return 'profile-tab-aboutplus';
    }
    if (tabId === 'friends') {
      return 'mutual-friends-tab';
    }
    if (tabId === 'servers') {
      return 'mutual-servers-tab';
    }
    if (tabId === 'capabilities') {
      return 'profile-tab-capabilities';
    }
    return `profile-tab-${String(tabId || 'unknown').replace(/[^a-z0-9_-]/gi, '').toLowerCase()}`;
  };

  const renderMutualFriends = (items) => {
    if (!items.length) {
      return '<div class="cat-card empty">Keine gemeinsamen Freunde.</div>';
    }
    return `
      <div class="mutual-list" data-testid="profile-mutual-friends-list">
        ${items.map((friend) => `
          <button type="button" class="mutual-pill" data-testid="profile-mutual-friend-item" data-open-full-profile="${friend.id}" data-presence-user-id="${friend.id}" data-presence-status="${escapeHtml(friend.presence || 'offline')}">
            <span class="avatar member-avatar">
              ${friend.avatar_url
                ? `<img src="${escapeHtml(friend.avatar_url)}" alt="${escapeHtml(friend.display_name)}" loading="lazy" data-fallback-src="${escapeHtml(friend.avatar_fallback_url || '')}" onerror="if(!this.dataset.failed&&this.dataset.fallbackSrc){this.dataset.failed='1';this.src=this.dataset.fallbackSrc;return;}this.hidden=true;this.nextElementSibling.hidden=false;" /><span class="avatar-fallback" hidden>${escapeHtml(String(friend.display_name || '?').charAt(0).toUpperCase())}</span>`
                : `<span class="avatar-fallback">${escapeHtml(String(friend.display_name || '?').charAt(0).toUpperCase())}</span>`}
              <span class="status-dot ${escapeHtml(friend.presence || 'offline')}" data-presence-dot></span>
            </span>
            <div class="dm-row-copy">
              <strong>${escapeHtml(friend.display_name)}</strong>
              <p>${escapeHtml(friend.custom_status_line || `@${friend.username}`)}</p>
            </div>
          </button>
        `).join('')}
      </div>
    `;
  };

  const renderMutualServers = (items) => {
    if (!items.length) {
      return '<div class="cat-card empty">Keine gemeinsamen Server.</div>';
    }
    return `
      <div class="mutual-list" data-testid="profile-mutual-servers-list">
        ${items.map((server) => `
          <a class="mutual-pill" data-testid="profile-mutual-server-item" href="/app/servers/${Number(server.id || 0)}">
            <span class="avatar"><span class="avatar-fallback">#</span></span>
            <div>
              <strong>${escapeHtml(server.name)}</strong>
              <p>${escapeHtml(server.description || 'Kein Beschreibungstext.')}</p>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  };

  const renderProfileText = (value, fallback = 'No bio set.') => (
    `<p class="profile-copy">${escapeHtml(value || fallback)}</p>`
  );

  const renderPhotosTab = (payload) => {
    const photos = Array.isArray(payload.photos) ? payload.photos : [];
    const uploadConfig = payload.photo_upload || {};
    const canUpload = Boolean(uploadConfig.enabled);

    return `
      <div class="profile-tab-stack">
        ${canUpload ? `
          <div class="profile-upload-toolbar">
            <input type="text" data-profile-photo-title placeholder="Titel (optional)" maxlength="120" />
            <select data-profile-photo-visibility>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <select data-profile-photo-effect>
              <option value="none">No Effect</option>
              <option value="frame">Frame</option>
              <option value="glow">Glow</option>
              <option value="sticker">Sticker</option>
            </select>
            <button type="button" class="btn primary" data-testid="profile-photo-upload-button" data-profile-photo-upload>Add Photo</button>
            <input type="file" accept="${escapeHtml(uploadConfig.accepted_types || 'image/*')}" data-testid="profile-photo-input" data-profile-photo-input hidden />
            <p class="sub profile-inline-status" data-profile-photo-status hidden></p>
          </div>
        ` : ''}
        ${photos.length ? `
          <div class="profile-photo-grid" data-testid="profile-photo-grid">
            ${photos.map((photo) => `
              <button
                type="button"
                class="profile-photo-tile effect-${escapeHtml(photo.effect_name || 'none')}"
                data-profile-photo-open="${photo.id}"
                title="${escapeHtml(photo.title || 'Photo')}"
              >
                ${String(photo.mime_type || '').startsWith('video/')
                  ? `<video src="${escapeHtml(photo.file_url)}" muted playsinline preload="metadata"></video>`
                  : `<img src="${escapeHtml(photo.file_url)}" alt="${escapeHtml(photo.title || 'Photo')}" loading="lazy" />`}
                <span class="profile-photo-meta">
                  <strong>${escapeHtml(photo.title || 'Untitled')}</strong>
                  <small>${escapeHtml(photo.visibility === 'private' ? 'Private' : 'Public')}</small>
                </span>
              </button>
            `).join('')}
          </div>
        ` : '<div class="cat-card empty">Noch keine Fotos im Profil.</div>'}
      </div>
    `;
  };

  const renderAboutPlusCards = (payload) => {
    const aboutPlus = payload.about_plus || {};
    const editableFields = Array.isArray(aboutPlus.fields) ? aboutPlus.fields : [];
    const visibleFields = Array.isArray(aboutPlus.visible_fields) ? aboutPlus.visible_fields : [];
    const fieldMap = getFieldMap(payload);
    const favoriteFoodField = fieldMap.favorite_food || editableFields.find((field) => String(field?.template_key || '').trim() === 'favorite_food') || null;
    const previewFoodImage = removeAboutPlusFoodImage
      ? ''
      : (pendingAboutPlusFoodImage || String(favoriteFoodField?.media?.data_url || favoriteFoodField?.media?.file_url || '').trim());
    const fieldHasRenderableValue = (field) => {
      if (!field || field.visible === false || field.show_in_full_profile === false) {
        return false;
      }
      if (field.type === 'color') {
        return Boolean(String(field.value || '').trim());
      }
      if (field.type === 'quote') {
        return Boolean(String(field.value?.text || '').trim());
      }
      if (field.type === 'list') {
        return Array.isArray(field.value) && field.value.length > 0;
      }
      if (field.type === 'media_card') {
        return Array.isArray(field.value?.items) && field.value.items.some((item) => String(item?.file_url || item?.data_url || item?.caption || '').trim());
      }
      return Boolean(String(field.value || '').trim());
    };
    const getFieldMediaUrl = (field) => {
      if (field?.type === 'media_card') {
        return String(field?.value?.items?.[0]?.data_url || field?.value?.items?.[0]?.file_url || '').trim();
      }
      return String(field?.media?.data_url || field?.media?.file_url || '').trim();
    };
    const getFieldMediaItems = (field) => (
      field?.type === 'media_card' && Array.isArray(field?.value?.items)
        ? field.value.items
        : []
    );
    const cards = visibleFields.filter((field) => fieldHasRenderableValue(field));
    const cardsByTemplate = cards.reduce((acc, field) => {
      const key = String(field?.template_key || '').trim();
      if (key) {
        acc[key] = field;
      }
      return acc;
    }, {});
    const getCardByTemplate = (key) => cardsByTemplate[String(key || '').trim()] || null;
    const normalizeHexColor = (value) => {
      const match = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!match) {
        return '';
      }
      if (match[1].length === 3) {
        return `#${match[1].split('').map((char) => `${char}${char}`).join('')}`.toLowerCase();
      }
      return `#${match[1]}`.toLowerCase();
    };
    const toRgba = (hex, alpha = 1) => {
      const normalized = normalizeHexColor(hex);
      if (!normalized) {
        return '';
      }
      const channel = (offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16);
      return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
    };

    const renderAboutPlusEditorField = (field) => {
      const key = String(field?.key || '').trim();
      if (!key) {
        return '';
      }

      const editorType = String(field.editor_type || (field.type === 'color'
        ? 'color'
        : (field.type === 'quote' || field.type === 'text_long' || field.type === 'list' ? 'textarea' : 'text')));
      const visibility = field.visible === false ? 'private' : 'public';
      const maxLength = Math.max(1, Number(field.max_length || 1200));
      const rows = Math.max(3, Number(field.editor_rows || 3));
      let control = '';
      if (field.type === 'quote') {
        control = `
          <textarea ${field.template_key === 'favorite_quote' ? 'data-testid="about-plus-favorite-quote-input" ' : ''}data-about-plus-input="${escapeHtml(key)}-quote-text" rows="${rows}" maxlength="${maxLength}">${escapeHtml(String(field.value?.text || ''))}</textarea>
          <input type="text" data-about-plus-input="${escapeHtml(key)}-quote-source" value="${escapeHtml(String(field.value?.source || ''))}" maxlength="160" placeholder="Source (optional)" />
        `;
      } else if (field.type === 'list') {
        control = `<textarea data-about-plus-input="${escapeHtml(key)}-value" rows="${rows}" maxlength="${maxLength}">${escapeHtml(Array.isArray(field.value) ? field.value.join('\n') : '')}</textarea>`;
      } else if (field.type === 'media_card') {
        const mediaItems = getFieldMediaItems(field);
        control = `
          <div class="about-plus-media-grid">
            ${mediaItems.length ? mediaItems.map((item, itemIndex) => `
              <figure class="about-plus-media-tile">
                <img src="${escapeHtml(String(item.data_url || item.file_url || ''))}" alt="${escapeHtml(`${field.label} ${itemIndex + 1}`)}" loading="lazy" />
                <figcaption>
                  <input type="text" data-about-plus-input="${escapeHtml(key)}-media-caption-${itemIndex}" value="${escapeHtml(String(item.caption || ''))}" maxlength="120" placeholder="Caption ${itemIndex + 1}" />
                </figcaption>
              </figure>
            `).join('') : '<span class="sub">No media set.</span>'}
          </div>
        `;
      } else if (editorType === 'textarea') {
        control = `<textarea data-about-plus-input="${escapeHtml(key)}-value" rows="${rows}" maxlength="${maxLength}">${escapeHtml(String(field.value || ''))}</textarea>`;
      } else {
        const rawValue = String(field.value || '');
        control = `<input type="${escapeHtml(editorType)}" ${field.template_key === 'favorite_color' ? 'data-testid="about-plus-color-input" ' : ''}data-about-plus-input="${escapeHtml(key)}-value" value="${escapeHtml(editorType === 'color' ? (rawValue || '#86a7ff') : rawValue)}"${editorType === 'color' ? '' : ` maxlength="${maxLength}"`} />`;
      }

      return `
        <label class="${editorType === 'textarea' ? 'is-wide' : ''}">
          <span>${escapeHtml(field.label || key)}</span>
          ${control}
        </label>
        <label>
          <span>Sichtbarkeit</span>
          <select data-about-plus-input="${escapeHtml(key)}-visibility">
            <option value="public" ${visibility !== 'private' ? 'selected' : ''}>Public</option>
            <option value="private" ${visibility === 'private' ? 'selected' : ''}>Private</option>
          </select>
        </label>
      `;
    };

    const renderFavoriteCard = (field) => {
      const mediaUrl = getFieldMediaUrl(field);
      const value = String(field?.value || '').trim();
      if (!value) {
        return '';
      }
      return `
        <section class="profile-card profile-about-favorite-card" data-about-plus-template="${escapeHtml(field.template_key || field.key || '')}">
          <div class="profile-about-favorite-label">${escapeHtml(field.label)}</div>
          ${mediaUrl ? `<div class="profile-about-favorite-media"><img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(field.label)}" loading="lazy" /></div>` : ''}
          <p class="profile-copy">${escapeHtml(value)}</p>
        </section>
      `;
    };

    const renderQuoteHero = (field) => {
      const text = String(field?.value?.text || '').trim();
      if (!text) {
        return '';
      }
      const source = String(field?.value?.source || '').trim();
      return `
        <section class="profile-about-quote-hero" id="aboutPlusQuote" data-testid="about-plus-quote-hero" data-about-plus-template="${escapeHtml(field.template_key || field.key || '')}">
          <span class="about-plus-quote-mark" aria-hidden="true">“</span>
          <div class="profile-about-quote-copy">
            <div class="profile-about-quote-label">${escapeHtml(field.label)}</div>
            <blockquote>${escapeHtml(text)}</blockquote>
            ${source ? `<footer>${escapeHtml(source)}</footer>` : ''}
          </div>
        </section>
      `;
    };

    const renderAboutBlock = (field) => {
      const value = String(field?.value || '').trim();
      if (!value) {
        return '';
      }
      return `
        <section class="profile-card profile-about-detail-card" id="aboutPlusAbout" data-testid="about-plus-about-block" data-about-plus-template="${escapeHtml(field.template_key || field.key || '')}">
          <div class="profile-about-detail-label">${escapeHtml(field.label)}</div>
          <p class="profile-copy">${escapeHtml(value)}</p>
        </section>
      `;
    };

    const renderDislikesBlock = (field) => {
      const items = Array.isArray(field?.value) ? field.value.filter((item) => String(item || '').trim()) : [];
      if (!items.length) {
        return '';
      }
      return `
        <section class="profile-card profile-about-detail-card is-dislikes" data-testid="about-plus-dislikes-block" data-about-plus-template="${escapeHtml(field.template_key || field.key || '')}">
          <div class="profile-about-detail-label">${escapeHtml(field.label)}</div>
          <div class="profile-about-tag-row">
            ${items.map((item) => `<span class="profile-about-tag">${escapeHtml(String(item || ''))}</span>`).join('')}
          </div>
        </section>
      `;
    };

    const colorField = getCardByTemplate('favorite_color');
    const themeColor = normalizeHexColor(colorField?.value || '');
    const quoteField = getCardByTemplate('favorite_quote');
    const favoriteFields = [
      getCardByTemplate('favorite_food'),
      getCardByTemplate('favorite_game'),
      getCardByTemplate('favorite_music'),
      getCardByTemplate('favorite_book')
    ].filter(Boolean);
    const aboutField = getCardByTemplate('bio');
    const dislikesField = getCardByTemplate('dislikes');
    const heroHtml = quoteField ? renderQuoteHero(quoteField) : '';
    const colorHtml = themeColor
      ? `
        <section class="profile-about-color-section" data-testid="about-plus-color-section">
          <div class="profile-about-color-swatch" style="background:${escapeHtml(themeColor)};"></div>
          <div class="profile-about-color-copy">
            <div class="profile-about-section-label">${escapeHtml(colorField?.label || 'Favorite Color')}</div>
            <strong>${escapeHtml(themeColor)}</strong>
            <p class="sub">Soft profile glow from your color theme.</p>
          </div>
        </section>
      `
      : '';
    const favoritesHtml = favoriteFields.length
      ? `
        <section class="profile-about-section" id="aboutPlusFavorites">
          <div class="profile-about-section-head">
            <div class="profile-about-section-label">Favorites</div>
          </div>
          <div class="profile-about-favorites-grid" data-testid="about-plus-favorites-grid">
            ${favoriteFields.map((field) => renderFavoriteCard(field)).join('')}
          </div>
        </section>
      `
      : '';
    const aboutHtml = (aboutField || dislikesField)
      ? `
        <section class="profile-about-section" id="aboutPlusAboutSection">
          ${dislikesField ? renderDislikesBlock(dislikesField) : ''}
          ${aboutField ? renderAboutBlock(aboutField) : ''}
        </section>
      `
      : '';
    const sectionCount = [heroHtml, colorHtml, favoritesHtml, aboutHtml].filter(Boolean).length;
    const jumpHtml = sectionCount > 2
      ? `
        <div class="profile-about-jump" data-testid="about-plus-jump-nav">
          ${heroHtml ? '<a href="#aboutPlusQuote">Quote</a>' : ''}
          ${favoritesHtml ? '<a href="#aboutPlusFavorites">Favorites</a>' : ''}
          ${aboutHtml ? '<a href="#aboutPlusAboutSection">About</a>' : ''}
        </div>
      `
      : '';
    const themeStyle = themeColor
      ? ` style="--about-plus-accent:${escapeHtml(themeColor)};--about-plus-accent-soft:${escapeHtml(toRgba(themeColor, 0.18))};--about-plus-accent-strong:${escapeHtml(toRgba(themeColor, 0.32))};"`
      : '';

    const formHtml = aboutPlusEditOpen && aboutPlus.editable ? `
      <form class="profile-about-form" data-profile-about-form>
        <div class="profile-about-form-grid">
          ${editableFields.map((field) => renderAboutPlusEditorField(field)).join('')}
        </div>
        <div class="profile-about-image-row">
          <button type="button" class="btn" data-about-plus-food-image-pick>Food Image</button>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-about-plus-food-image-input hidden />
          <button type="button" class="chip ${previewFoodImage ? '' : 'is-disabled'}" ${previewFoodImage ? '' : 'disabled'} data-about-plus-food-image-remove>Remove Image</button>
          <div class="profile-about-image-preview">
            ${previewFoodImage ? `<img src="${escapeHtml(previewFoodImage)}" alt="Food preview" />` : '<span>No image</span>'}
          </div>
        </div>
        <div class="profile-action-row">
          <button type="submit" class="btn primary" data-testid="about-plus-save-button">Save</button>
          <button type="button" class="chip" data-about-plus-toggle>Cancel</button>
        </div>
      </form>
    ` : '';

    return `
      <div class="profile-tab-stack">
        ${aboutPlus.editable ? `
          <div class="profile-action-row">
            <button type="button" class="btn" data-testid="about-plus-edit-button" data-about-plus-toggle>${aboutPlusEditOpen ? 'Close Editor' : 'Edit Profile'}</button>
          </div>
        ` : ''}
        ${cards.length ? `
          <section class="profile-about-showcase" data-testid="about-plus-display"${themeStyle}>
            ${jumpHtml}
            ${heroHtml}
            ${colorHtml}
            ${favoritesHtml}
            ${aboutHtml}
          </section>
        ` : '<div class="cat-card empty">Keine Profilangaben vorhanden.</div>'}
        ${formHtml}
      </div>
    `;
  };

  const renderAiCapabilitiesTab = (payload) => {
    const aiProfile = payload.ai_profile || {};
    const discussionModeLines = Array.isArray(aiProfile.discussion_mode_lines) ? aiProfile.discussion_mode_lines : [];
    const capabilities = Array.isArray(aiProfile.capabilities) ? aiProfile.capabilities : [];
    return `
      <div class="profile-tab-stack" data-testid="ai-capabilities-display">
        <div class="profile-card">
          <div class="list-head">Diskussionsmodus</div>
          ${discussionModeLines.length
            ? `<ul class="profile-bullet-list">${discussionModeLines.map((line) => `<li>${escapeHtml(String(line || ''))}</li>`).join('')}</ul>`
            : '<p class="profile-copy">Keine Hinweise verfügbar.</p>'}
        </div>
        <div class="profile-card">
          <div class="list-head">Capabilities</div>
          ${capabilities.length
            ? `<ul class="profile-bullet-list">${capabilities.map((entry) => `<li>${escapeHtml(String(entry || ''))}</li>`).join('')}</ul>`
            : '<p class="profile-copy">Keine Capabilities verfügbar.</p>'}
        </div>
      </div>
    `;
  };

  const renderTabPanel = (payload) => {
    if (activeTab === 'capabilities' && payload?.profile?.is_ai_dm) {
      return renderAiCapabilitiesTab(payload);
    }
    if (activeTab === 'friends') {
      return renderMutualFriends(payload.mutual_friends || []);
    }
    if (activeTab === 'servers') {
      return renderMutualServers(payload.mutual_servers || []);
    }
    if (activeTab === 'about_plus') {
      return renderAboutPlusCards(payload);
    }
    return renderPhotosTab(payload);
  };

  const renderLightbox = (payload) => {
    const photos = Array.isArray(payload.photos) ? payload.photos : [];
    const current = photos.find((photo) => Number(photo.id) === Number(lightboxPhotoId || 0));
    if (!current) {
      return '';
    }

    return `
      <div class="profile-photo-lightbox" data-profile-photo-lightbox>
        <button type="button" class="profile-photo-lightbox-backdrop" data-profile-photo-lightbox-close></button>
        <div class="profile-photo-lightbox-card">
          <button type="button" class="chip profile-photo-lightbox-close" data-profile-photo-lightbox-close>Close</button>
          ${String(current.mime_type || '').startsWith('video/')
            ? `<video src="${escapeHtml(current.file_url)}" controls autoplay muted playsinline></video>`
            : `<img src="${escapeHtml(current.file_url)}" alt="${escapeHtml(current.title || 'Photo')}" />`}
          <div class="profile-photo-lightbox-meta">
            <strong>${escapeHtml(current.title || 'Untitled')}</strong>
            <p>${escapeHtml(current.visibility === 'private' ? 'Private' : 'Public')} • ${escapeHtml(current.effect_name || 'none')}</p>
          </div>
        </div>
      </div>
    `;
  };

  const renderActionButton = (action) => {
    const className = action.variant === 'btn' ? 'btn' : 'chip';
    const disabledAttr = action.disabled ? ' disabled' : '';
    const disabledClass = action.disabled ? ' is-disabled' : '';
    const closeAttr = action.close_only ? ' data-full-profile-close-action' : '';
    const customAttr = action.action === 'edit-about-plus' ? ' data-about-plus-action' : '';
    return `<button type="button" class="${className}${disabledClass}"${disabledAttr}${closeAttr}${customAttr}>${escapeHtml(action.label)}</button>`;
  };

  const render = (payload) => {
    const profile = payload.profile;
    const tabs = Array.isArray(payload.tabs) ? payload.tabs : [];
    const actions = Array.isArray(payload.actions) ? payload.actions : [];

    layout.innerHTML = `
      <div class="full-profile-layout" data-testid="profile-layout">
        <aside class="full-profile-side" data-testid="profile-left">
          <section class="profile-panel" ${profile.is_ai_dm ? '' : `data-presence-user-id="${profile.id}" data-presence-status="${escapeHtml(profile.presence || 'offline')}" data-presence-last-seen="${escapeHtml(profile.last_seen || '')}"`}>
            ${renderBanner(profile)}
            <div class="profile-panel-body">
              <div class="profile-head" data-testid="profile-header">
                <div class="profile-avatar-wrap" data-testid="profile-avatar">
                  ${renderAvatar(profile)}
                  <span class="status-dot ${escapeHtml(profile.presence || 'offline')}" ${profile.is_ai_dm ? '' : 'data-presence-dot'}></span>
                </div>
                <div class="profile-meta" data-testid="profile-name-block">
                  <div class="profile-title-row">
                    <h3 id="fullProfileTitle">${escapeHtml(profile.display_name)}</h3>
                    ${profile.badge_label ? `<span class="profile-badge">${escapeHtml(profile.badge_label)}</span>` : ''}
                  </div>
                  ${profile.is_ai_dm ? '' : `<p class="sub">@${escapeHtml(profile.username)}</p>`}
                  <p class="profile-status-line" ${profile.is_ai_dm ? '' : 'data-presence-text'}>${escapeHtml(profile.presence_label || statusLabel(profile.presence || 'offline'))}</p>
                </div>
              </div>
              <div class="profile-content-stack">
                <div class="profile-action-row">${actions.map((action) => renderActionButton(action)).join('')}</div>
                <div class="profile-card">
                  <div class="list-head">About Me</div>
                  ${renderProfileText(profile.about_me)}
                </div>
                <div class="profile-card">
                  <div class="list-head">Member Since</div>
                  <p>${escapeHtml(formatMemberSince(profile.created_at))}</p>
                </div>
              </div>
            </div>
          </section>
        </aside>
        <section class="full-profile-main" data-testid="profile-right">
          <div class="full-profile-tabs" role="tablist" aria-label="Profile tabs" data-testid="profile-tabs">
            ${tabs.map((tab) => `
              <button type="button" class="full-profile-tab ${activeTab === tab.id ? 'active' : ''}" data-testid="${escapeHtml(getProfileTabTestId(tab.id))}" data-full-profile-tab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>
            `).join('')}
          </div>
          <div class="full-profile-panel" data-testid="profile-scroll" data-profile-panel data-profile-scroll>
            ${renderTabPanel(payload)}
          </div>
        </section>
      </div>
      ${renderLightbox(payload)}
    `;

    loading.hidden = true;
    layout.hidden = false;
  };

  const getFocusableModalNodes = () => (
    [...modal.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((node) => {
        if (!(node instanceof HTMLElement) || node.hidden) {
          return false;
        }
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
  );

  const focusFirstModalControl = () => {
    const first = getFocusableModalNodes()[0];
    if (first instanceof HTMLElement) {
      first.focus();
    }
  };

  const openModal = () => {
    if (!modal.hidden) {
      return;
    }
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.hidden = false;
    window.requestAnimationFrame(() => {
      focusFirstModalControl();
    });
  };

  const closeModal = () => {
    if (modal.hidden) {
      return;
    }
    modal.hidden = true;
    activeUserId = 0;
    activeTab = 'photos';
    payloadCache = null;
    lightboxPhotoId = 0;
    aboutPlusEditOpen = false;
    pendingAboutPlusFoodImage = '';
    removeAboutPlusFoodImage = false;
    layout.hidden = true;
    layout.innerHTML = '';
    loading.hidden = false;
    if (lastFocusedElement instanceof HTMLElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  };

  const applyPayload = (payload, { preserveTab = true } = {}) => {
    payloadCache = payload;
    const tabs = Array.isArray(payload?.tabs) ? payload.tabs : [];
    const nextTab = preserveTab && tabs.some((tab) => tab.id === activeTab)
      ? activeTab
      : String(tabs[0]?.id || 'photos');
    activeTab = nextTab;
    if (!(Array.isArray(payload?.photos) && payload.photos.some((photo) => Number(photo.id) === Number(lightboxPhotoId || 0)))) {
      lightboxPhotoId = 0;
    }
    render(payload);
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });

  const loadProfile = async (userId) => {
    activeUserId = Number(userId || 0);
    if (!activeUserId) {
      return;
    }

    activeTab = 'photos';
    payloadCache = null;
    lightboxPhotoId = 0;
    aboutPlusEditOpen = false;
    pendingAboutPlusFoodImage = '';
    removeAboutPlusFoodImage = false;
    openModal();
    layout.hidden = true;
    layout.innerHTML = '';
    loading.hidden = false;

    try {
      const response = await fetch(`/app/profile/${activeUserId}`, {
        headers: {
          Accept: 'application/json'
        }
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || activeUserId !== Number(userId || 0)) {
        throw new Error('profile_fetch_failed');
      }
      applyPayload(payload, { preserveTab: false });
    } catch (_error) {
      loading.hidden = true;
      layout.hidden = false;
      layout.innerHTML = '<div class="cat-card empty">Profil konnte nicht geladen werden.</div>';
    }
  };

  const uploadProfilePhoto = async (fileInput) => {
    if (!payloadCache?.photo_upload?.enabled || !fileInput?.files?.[0]) {
      return;
    }

    const file = fileInput.files[0];
    const titleInput = layout.querySelector('[data-profile-photo-title]');
    const visibilityInput = layout.querySelector('[data-profile-photo-visibility]');
    const effectInput = layout.querySelector('[data-profile-photo-effect]');
    const statusNode = layout.querySelector('[data-profile-photo-status]');

    if (statusNode instanceof HTMLElement) {
      statusNode.hidden = false;
      statusNode.textContent = 'Uploading...';
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch(`/app/profile/${activeUserId}/photo`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataUrl,
          mimeType: file.type,
          title: titleInput instanceof HTMLInputElement ? titleInput.value : '',
          visibility: visibilityInput instanceof HTMLSelectElement ? visibilityInput.value : 'public',
          effectName: effectInput instanceof HTMLSelectElement ? effectInput.value : 'none'
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error('photo_upload_failed');
      }

      lightboxPhotoId = 0;
      applyPayload(payload);
    } catch (_error) {
      if (statusNode instanceof HTMLElement) {
        statusNode.hidden = false;
        statusNode.textContent = 'Photo upload failed.';
      }
      return;
    }

    if (statusNode instanceof HTMLElement) {
      statusNode.hidden = false;
      statusNode.textContent = 'Photo uploaded.';
    }
  };

  const collectAboutPlusPayload = () => {
    const fields = Array.isArray(payloadCache?.about_plus?.fields) ? payloadCache.about_plus.fields : [];
    const nextFields = fields.map((field, index) => {
      const key = String(field?.key || field?.template_key || field?.id || '').trim();
      let nextValue = '';
      if (field.type === 'quote') {
        nextValue = {
          text: String(layout.querySelector(`[data-about-plus-input="${key}-quote-text"]`)?.value || ''),
          source: String(layout.querySelector(`[data-about-plus-input="${key}-quote-source"]`)?.value || '')
        };
      } else if (field.type === 'list') {
        nextValue = String(layout.querySelector(`[data-about-plus-input="${key}-value"]`)?.value || '')
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean);
      } else if (field.type === 'media_card') {
        const mediaState = field.value && typeof field.value === 'object' ? field.value : {};
        nextValue = {
          ...mediaState,
          items: (Array.isArray(mediaState.items) ? mediaState.items : []).map((item, itemIndex) => ({
            ...(item && typeof item === 'object' ? item : {}),
            caption: String(layout.querySelector(`[data-about-plus-input="${key}-media-caption-${itemIndex}"]`)?.value || item?.caption || '')
          }))
        };
      } else {
        const defaultValue = field.type === 'color' ? '#86a7ff' : '';
        nextValue = String(layout.querySelector(`[data-about-plus-input="${key}-value"]`)?.value || defaultValue);
      }

      const visibility = String(layout.querySelector(`[data-about-plus-input="${key}-visibility"]`)?.value || 'public');
      const nextField = {
        ...field,
        key,
        value: nextValue,
        visible: visibility !== 'private',
        order: index,
        privacy: visibility === 'private' ? 'private' : 'public'
      };

      if (String(field?.template_key || '').trim() === 'favorite_food') {
        nextField.media = {
          ...(field.media && typeof field.media === 'object' ? field.media : {}),
          data_url: removeAboutPlusFoodImage ? '' : pendingAboutPlusFoodImage,
          file_url: removeAboutPlusFoodImage ? '' : String(field?.media?.file_url || '').trim()
        };
      }

      return nextField;
    });

    return {
      fields: nextFields,
      favorite_food_remove_image: removeAboutPlusFoodImage
    };
  };

  const syncAboutPlusFoodImagePreview = () => {
    const preview = layout.querySelector('.profile-about-image-preview');
    const removeButton = layout.querySelector('[data-about-plus-food-image-remove]');
    if (preview instanceof HTMLElement) {
      preview.innerHTML = pendingAboutPlusFoodImage
        ? `<img src="${escapeHtml(pendingAboutPlusFoodImage)}" alt="Food preview" />`
        : '<span>No image</span>';
    }
    if (removeButton instanceof HTMLButtonElement) {
      const favoriteFoodField = Array.isArray(payloadCache?.about_plus?.fields)
        ? payloadCache.about_plus.fields.find((field) => String(field?.template_key || '').trim() === 'favorite_food')
        : null;
      const canRemove = Boolean(
        pendingAboutPlusFoodImage
        || (!removeAboutPlusFoodImage && (
          String(favoriteFoodField?.media?.file_url || '').trim()
          || String(favoriteFoodField?.media?.data_url || '').trim()
        ))
      );
      removeButton.disabled = !canRemove;
      removeButton.classList.toggle('is-disabled', !canRemove);
    }
  };

  const saveAboutPlus = async () => {
    try {
      const response = await fetch(`/app/profile/${activeUserId}/about-plus`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aboutPlus: collectAboutPlusPayload()
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error('about_plus_save_failed');
      }

      aboutPlusEditOpen = false;
      pendingAboutPlusFoodImage = '';
      removeAboutPlusFoodImage = false;
      applyPayload(payload);
    } catch (_error) {
      const panel = layout.querySelector('[data-testid="profile-scroll"]');
      if (panel instanceof HTMLElement) {
        const status = document.createElement('p');
        status.className = 'sub profile-inline-status';
        status.textContent = 'About+ konnte nicht gespeichert werden.';
        panel.prepend(status);
      }
    }
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-open-full-profile]') : null;
    if (trigger) {
      event.preventDefault();
      loadProfile(trigger.getAttribute('data-open-full-profile'));
      return;
    }

    const closeButton = event.target instanceof Element ? event.target.closest('[data-full-profile-close], [data-full-profile-close-action]') : null;
    if (closeButton) {
      event.preventDefault();
      closeModal();
      return;
    }

    const tabButton = event.target instanceof Element ? event.target.closest('[data-full-profile-tab]') : null;
    if (tabButton && payloadCache) {
      event.preventDefault();
      activeTab = String(tabButton.getAttribute('data-full-profile-tab') || 'photos');
      lightboxPhotoId = 0;
      render(payloadCache);
      return;
    }

    const aboutPlusAction = event.target instanceof Element ? event.target.closest('[data-about-plus-action]') : null;
    if (aboutPlusAction && payloadCache) {
      event.preventDefault();
      activeTab = 'about_plus';
      aboutPlusEditOpen = true;
      render(payloadCache);
      return;
    }

    const aboutPlusToggle = event.target instanceof Element ? event.target.closest('[data-about-plus-toggle]') : null;
    if (aboutPlusToggle && payloadCache) {
      event.preventDefault();
      aboutPlusEditOpen = !aboutPlusEditOpen;
      if (!aboutPlusEditOpen) {
        pendingAboutPlusFoodImage = '';
        removeAboutPlusFoodImage = false;
      }
      render(payloadCache);
      return;
    }

    const photoUploadButton = event.target instanceof Element ? event.target.closest('[data-profile-photo-upload]') : null;
    if (photoUploadButton) {
      event.preventDefault();
      layout.querySelector('[data-profile-photo-input]')?.click();
      return;
    }

    const photoOpenButton = event.target instanceof Element ? event.target.closest('[data-profile-photo-open]') : null;
    if (photoOpenButton && payloadCache) {
      event.preventDefault();
      lightboxPhotoId = Number(photoOpenButton.getAttribute('data-profile-photo-open') || 0);
      render(payloadCache);
      return;
    }

    const photoLightboxClose = event.target instanceof Element ? event.target.closest('[data-profile-photo-lightbox-close]') : null;
    if (photoLightboxClose && payloadCache) {
      event.preventDefault();
      lightboxPhotoId = 0;
      render(payloadCache);
      return;
    }

    const aboutPlusFoodImagePick = event.target instanceof Element ? event.target.closest('[data-about-plus-food-image-pick]') : null;
    if (aboutPlusFoodImagePick) {
      event.preventDefault();
      layout.querySelector('[data-about-plus-food-image-input]')?.click();
      return;
    }

    const aboutPlusFoodImageRemove = event.target instanceof Element ? event.target.closest('[data-about-plus-food-image-remove]') : null;
    if (aboutPlusFoodImageRemove && payloadCache) {
      event.preventDefault();
      pendingAboutPlusFoodImage = '';
      removeAboutPlusFoodImage = true;
      syncAboutPlusFoodImagePreview();
    }
  });

  layout.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const photoInput = target.closest('[data-profile-photo-input]');
    if (photoInput instanceof HTMLInputElement) {
      await uploadProfilePhoto(photoInput);
      photoInput.value = '';
      return;
    }

    const aboutPlusFoodImageInput = target.closest('[data-about-plus-food-image-input]');
    if (aboutPlusFoodImageInput instanceof HTMLInputElement && aboutPlusFoodImageInput.files?.[0] && payloadCache) {
      try {
        pendingAboutPlusFoodImage = await readFileAsDataUrl(aboutPlusFoodImageInput.files[0]);
        removeAboutPlusFoodImage = false;
        syncAboutPlusFoodImagePreview();
      } catch (_error) {
        pendingAboutPlusFoodImage = '';
      }
      aboutPlusFoodImageInput.value = '';
    }
  });

  layout.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof Element)) {
      return;
    }

    if (form.matches('[data-profile-about-form]')) {
      event.preventDefault();
      await saveAboutPlus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (modal.hidden) {
      return;
    }

    if (event.key === 'Tab') {
      const focusable = getFocusableModalNodes();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !modal.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (document.activeElement === last || !modal.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (event.key === 'Escape') {
      if (lightboxPhotoId && payloadCache) {
        lightboxPhotoId = 0;
        render(payloadCache);
        return;
      }
      closeModal();
    }
  });
})();
