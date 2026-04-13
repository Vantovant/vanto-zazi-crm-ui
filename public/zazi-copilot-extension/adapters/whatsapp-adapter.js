/**
 * Zazi Follow-Up Copilot — WhatsApp Web Content Script (Adapter)
 * v2.0 — Rebuilt with Vanto patterns: 8-selector cascade, JID extraction,
 *         normalizeText, 600ms debounce, title observer, event-driven updates.
 */

(() => {
  if (window.__zaziWACopilotLoaded) return;
  window.__zaziWACopilotLoaded = true;

  console.log('[Zazi WA] Copilot adapter v2.0 loaded');

  // ===== SELECTOR CASCADES (Vanto-style 8-selector resilience) =====
  const SELECTORS = {
    contactName: [
      '[data-testid="conversation-header"] span[title]',
      '[data-testid="conversation-info-header-chat-title"] span',
      '[data-testid="conversation-info-header-chat-title"]',
      'header [data-testid="conversation-info-header"] span[title]',
      'header span[dir="auto"][title]',
      '#main header span[title]',
      '#main header span[dir="auto"]',
      '#main header > div > div > div > div span[title]',
    ],
    groupMeta: [
      '#main header span[data-icon="default-group"]',
      '#main header span[data-icon="group"]',
      '#main header span[data-icon*="community"]',
      '#main header span[data-icon*="group"]',
    ],
    participantCount: [
      '#main header span[title*="participants"]',
      '#main header span[title*="members"]',
    ],
    subtitle: [
      '#main header span[dir="auto"]:not(:first-child)',
      '#main header [title]:nth-of-type(2)',
    ],
    composeBox: [
      '[data-testid="conversation-compose-box-input"]',
      'div[contenteditable="true"][data-tab="10"]',
      '#main footer div[contenteditable="true"]',
      'div[role="textbox"][title="Type a message"]',
      '#main footer [contenteditable="true"]',
    ],
  };

  const DETECTION_DEBOUNCE_MS = 600;
  const CLICK_SETTLE_MS = 300;
  const POLLING_INTERVAL_MS = 1500;

  // ===== UTILITIES =====
  function findElement(selectors, label) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (e) { /* invalid selector, skip */ }
    }
    return null;
  }

  /** Strip zero-width chars, emoji, collapse whitespace — Vanto normalizeText */
  function normalizeText(text) {
    if (!text) return '';
    return text
      .replace(/[\u200B-\u200D\uFEFF]/g, '')   // zero-width chars
      .replace(/\s+/g, ' ')                      // collapse whitespace
      .replace(/[^\p{L}\p{N}\s]/gu, '')           // strip emoji/symbols
      .trim()
      .toLowerCase();
  }

  /** Strip non-digits from phone strings */
  function normalizePhone(raw) {
    if (!raw) return '';
    return raw.replace(/[^0-9]/g, '');
  }

  // ===== STATE =====
  let lastContactName = '';
  let lastMessageHash = '';
  let hasContext = false;
  let consecutiveNoChatReads = 0;
  let noChatSince = null;
  let lastRefreshLogAt = 0;
  let detectionTimer = null;
  let lastDetectedPhone = null;

  const MAX_NO_CHAT_MISSES_BEFORE_CLEAR = 3;
  const MIN_NO_CHAT_DURATION_MS = 5000;
  const REFRESH_LOG_INTERVAL_MS = 10000;

  // ===== MINIMAL FLOATING LAUNCHER =====
  function ensureLauncher() {
    if (document.getElementById('zazi-copilot-launcher')) return;

    const style = document.createElement('style');
    style.textContent = `
      #zazi-copilot-launcher {
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        width: 48px; height: 48px; border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,0.4);
        transition: transform 0.2s, box-shadow 0.2s;
        font-size: 20px; user-select: none; border: none;
        color: white; font-family: sans-serif;
      }
      #zazi-copilot-launcher:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 28px rgba(99,102,241,0.55);
      }
      #zazi-copilot-launcher .zazi-badge-dot {
        position: absolute; top: 0; right: 0; width: 12px; height: 12px;
        border-radius: 50%; background: #22c55e; border: 2px solid #1a1a2e;
        display: none;
      }
      #zazi-copilot-launcher.has-context .zazi-badge-dot { display: block; }
      #zazi-copilot-launcher-tooltip {
        position: fixed; bottom: 80px; right: 24px; z-index: 99999;
        background: #1a1a2e; color: #e2e8f0; padding: 6px 12px;
        border-radius: 8px; font-size: 12px; font-family: sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); pointer-events: none;
        opacity: 0; transition: opacity 0.2s;
        white-space: nowrap;
      }
      #zazi-copilot-launcher:hover + #zazi-copilot-launcher-tooltip { opacity: 1; }
    `;
    document.head.appendChild(style);

    const launcher = document.createElement('button');
    launcher.id = 'zazi-copilot-launcher';
    launcher.innerHTML = `⚡<span class="zazi-badge-dot"></span>`;
    launcher.title = 'Open Zazi Copilot';
    document.body.appendChild(launcher);

    const tooltip = document.createElement('div');
    tooltip.id = 'zazi-copilot-launcher-tooltip';
    tooltip.textContent = 'Open Zazi Copilot';
    document.body.appendChild(tooltip);

    launcher.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    });
  }

  function updateLauncherBadge(active) {
    const launcher = document.getElementById('zazi-copilot-launcher');
    if (launcher) launcher.classList.toggle('has-context', active);
  }

  // ===== GROUP DETECTION (JID-first, Vanto pattern) =====
  function isGroupChat() {
    // Check 1 (MOST RELIABLE): data-id on #main contains @g.us
    const mainEl = document.querySelector('#main');
    if (mainEl) {
      const dataId = mainEl.getAttribute('data-id');
      if (dataId && dataId.includes('@g.us')) return true;
    }

    // Check 2: URL hash contains @g.us
    if (window.location.hash.includes('@g.us')) return true;

    // Check 3: Any element with data-id containing @g.us
    const groupIndicator = document.querySelector('[data-id*="@g.us"]');
    if (groupIndicator) return true;

    // Check 4: Group icon in header
    if (findElement(SELECTORS.groupMeta, 'group icon')) return true;

    // Check 5: "participants" or "members" text
    if (findElement(SELECTORS.participantCount, 'participant count')) return true;

    // Check 6: Subtitle with comma-separated participant names
    const subtitleEl = findElement(SELECTORS.subtitle, 'subtitle');
    if (subtitleEl) {
      const text = (subtitleEl.getAttribute('title') || subtitleEl.textContent || '').trim();
      if (text.includes(',')) {
        const parts = text.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const hasNonPhonePart = parts.some(p => !/^\+?\d[\d\s\-()]{6,}$/.test(p));
          if (hasNonPhonePart || parts.length >= 3) return true;
        }
      }
      if (/click here|tap here|group info/i.test(text)) return true;
    }

    // Check 7: data-icon attributes for community/group (broader)
    const communityIcon = document.querySelector('#main header span[data-icon*="community"], #main header span[data-icon*="group"]');
    if (communityIcon) return true;

    return false;
  }

  // ===== CONTACT NAME DETECTION (8-selector cascade) =====
  function detectContactName() {
    for (const selector of SELECTORS.contactName) {
      try {
        const el = document.querySelector(selector);
        if (!el) continue;

        // PRIORITY 1: title attribute (always clean)
        const titleAttr = el.getAttribute('title');
        if (titleAttr && titleAttr.trim()) {
          return normalizeText(titleAttr) ? titleAttr.trim() : null;
        }

        // PRIORITY 2: Direct text nodes only (avoid child element text)
        const directText = Array.from(el.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent)
          .join('')
          .trim();

        const textToUse = directText || el.textContent?.trim();
        if (textToUse && normalizeText(textToUse)) return textToUse;
      } catch (e) { /* skip invalid selector */ }
    }
    return null;
  }

  // ===== PHONE DETECTION (JID-first, 4-priority, Vanto pattern) =====
  const JID_REGEX = /(\d{7,15})@/;

  function detectPhoneNumber() {
    // Priority 0: data-id on #main (JID — MOST RELIABLE)
    const mainEl = document.querySelector('#main');
    if (mainEl) {
      const dataId = mainEl.getAttribute('data-id');
      if (dataId) {
        const match = dataId.match(JID_REGEX);
        if (match) return match[1];
      }
    }

    // Priority 1: URL hash
    const hash = window.location.hash;
    const urlMatch = hash.match(/chat\/(\d{7,15})@/);
    if (urlMatch) return urlMatch[1];

    // Priority 2: data-id on message elements
    const dataIdElements = document.querySelectorAll('#main [data-id]');
    for (const el of dataIdElements) {
      const did = el.getAttribute('data-id') || '';
      // Skip group JIDs
      if (did.includes('@g.us')) continue;
      const match = did.match(JID_REGEX);
      if (match) return match[1];
    }

    // Priority 3: Phone in header spans
    const headerSpans = document.querySelectorAll('#main header span');
    for (const span of headerSpans) {
      const text = span.getAttribute('title') || span.textContent || '';
      if (/^\+?\d[\d\s\-()]{6,}$/.test(text.trim())) {
        const phone = normalizePhone(text);
        if (phone.length >= 7) return phone;
      }
    }

    // Priority 4: Info drawer phone
    const drawerPhone = document.querySelector('[data-testid="phone-number"] span, .copyable-text[data-tab] span[title*="+"]');
    if (drawerPhone) {
      const phone = normalizePhone(drawerPhone.textContent || drawerPhone.getAttribute('title') || '');
      if (phone.length >= 7) return phone;
    }

    return null;
  }

  // ===== COMBINED IDENTITY EXTRACTION =====
  function getActiveContact() {
    const name = detectContactName();
    if (!name) return null;

    let phone = detectPhoneNumber() || '';

    // Name-as-phone fallback
    if (!phone && /^\+?\d[\d\s\-()]{6,}$/.test(name)) {
      phone = normalizePhone(name);
    }

    return { name, phone: normalizePhone(phone) };
  }

  function readVisibleMessages() {
    const messages = [];
    const rows = [...document.querySelectorAll('#main [data-id]')];
    for (const row of rows.slice(-30)) {
      const dataId = row.getAttribute('data-id') || '';
      const isOut = dataId.startsWith('true_') || row.classList.contains('message-out') || row.closest('.message-out');
      const isIn = dataId.startsWith('false_') || row.classList.contains('message-in') || row.closest('.message-in');
      if (!isOut && !isIn) continue;

      const textEl = row.querySelector('span.selectable-text');
      const text = textEl?.textContent?.trim() || '';
      if (!text) continue;

      let timestamp = null;
      const pre = row.querySelector('[data-pre-plain-text]');
      if (pre) {
        const raw = pre.getAttribute('data-pre-plain-text');
        const match = raw?.match(/\[(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]/);
        if (match) {
          const [, time, date] = match;
          const [day, month, year] = date.split('/');
          timestamp = new Date(`${year}-${month}-${day}T${time}:00`).toISOString();
        }
      }

      messages.push({
        direction: isOut ? 'outbound' : 'inbound',
        text,
        timestamp: timestamp || new Date().toISOString(),
      });
    }
    return messages;
  }

  function computeMessageHash(messages) {
    const last5 = messages.slice(-5);
    return last5.map(m => `${m.direction}:${m.text.substring(0, 30)}`).join('|');
  }

  // ===== INSTANT CLEAR on chat switch =====
  async function signalChatSwitched() {
    try {
      await chrome.runtime.sendMessage({
        type: 'CONTEXT_CLEAR_REQUEST',
        channel: 'whatsapp',
        reason: 'chat_switched',
      });
    } catch (err) {
      console.warn('[Zazi WA] Failed to signal chat switch:', err);
    }
  }

  async function requestContextClear(reason, extra = {}) {
    try {
      await chrome.runtime.sendMessage({
        type: 'CONTEXT_CLEAR_REQUEST',
        channel: 'whatsapp',
        reason,
        ...extra,
      });
    } catch (err) {
      console.warn('[Zazi WA] Failed to request context clear:', err);
    }
  }

  function insertIntoCompose(text) {
    const compose = findElement(SELECTORS.composeBox, 'compose box');
    if (!compose) { console.warn('[Zazi WA] Compose box not found'); return false; }
    compose.focus();
    document.execCommand('insertText', false, text);
    compose.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ===== DEBOUNCED DETECTION (Vanto pattern — 600ms) =====
  function scheduleDetection() {
    if (detectionTimer) clearTimeout(detectionTimer);
    detectionTimer = setTimeout(processActiveChat, DETECTION_DEBOUNCE_MS);
  }

  // ===== CHAT CONTEXT DETECTION =====
  async function processActiveChat() {
    try {
      // STEP 1: Check for group BEFORE extracting contact identity
      if (isGroupChat()) {
        if (lastContactName) {
          lastContactName = '';
          lastMessageHash = '';
          lastDetectedPhone = null;
          hasContext = false;
          updateLauncherBadge(false);
        }

        const groupName = detectContactName() || 'Group';

        await chrome.storage.local.set({
          current_channel: 'whatsapp',
          current_context: {
            channel: 'whatsapp',
            isGroup: true,
            contactIdentifier: groupName,
            conversationKey: `whatsapp:group:${groupName.toLowerCase()}`,
            timestamp: Date.now(),
          }
        });
        return;
      }

      // STEP 2: Not a group — extract contact
      const contactInfo = getActiveContact();
      if (!contactInfo || !contactInfo.name) {
        if (document.visibilityState === 'hidden') return;

        consecutiveNoChatReads += 1;
        if (!noChatSince) noChatSince = Date.now();
        const noChatDurationMs = Date.now() - noChatSince;

        const stillInDebounceWindow =
          consecutiveNoChatReads < MAX_NO_CHAT_MISSES_BEFORE_CLEAR ||
          noChatDurationMs < MIN_NO_CHAT_DURATION_MS;

        if (stillInDebounceWindow) return;

        if (lastContactName) {
          console.log('[Zazi WA] Clearing context after confirmed sustained no-chat state');
          await requestContextClear('confirmed_no_active_chat', {
            consecutiveMisses: consecutiveNoChatReads,
            noChatDurationMs,
          });
          lastContactName = '';
          lastMessageHash = '';
          lastDetectedPhone = null;
          hasContext = false;
          updateLauncherBadge(false);
        }
        return;
      }

      consecutiveNoChatReads = 0;
      noChatSince = null;

      const messages = readVisibleMessages();
      const msgHash = computeMessageHash(messages);

      // Use normalized names for comparison (handles zero-width chars, emoji)
      const normalizedNew = normalizeText(contactInfo.name);
      const normalizedOld = normalizeText(lastContactName);
      const isSameContact = normalizedNew === normalizedOld && normalizedNew !== '';
      const isSameMessages = msgHash === lastMessageHash;

      // CRITICAL: If contact changed, send update IMMEDIATELY
      if (!isSameContact) {
        console.log('[Zazi WA] Chat switched:', { from: lastContactName, to: contactInfo.name, phone: contactInfo.phone || '(none)' });
        lastContactName = contactInfo.name;
        lastMessageHash = msgHash;
        lastDetectedPhone = contactInfo.phone;
        lastRefreshLogAt = Date.now();
        await sendContextUpdate(contactInfo, messages);
        return;
      }

      // Same contact, same messages — periodic keepalive only
      if (isSameMessages) {
        const now = Date.now();
        if (now - lastRefreshLogAt >= REFRESH_LOG_INTERVAL_MS) {
          lastRefreshLogAt = now;
        }
        return;
      }

      // Same contact, new messages
      lastMessageHash = msgHash;
      lastRefreshLogAt = Date.now();
      console.log('[Zazi WA] New messages in current chat:', contactInfo.name);
      await sendContextUpdate(contactInfo, messages);
    } catch (err) {
      console.error('[Zazi WA] processActiveChat error:', err);
    }
  }

  async function sendContextUpdate(contactInfo, messages) {
    try {
      // Triple-normalize phone at adapter level before sending
      const cleanPhone = normalizePhone(contactInfo.phone);
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_CONTEXT_UPDATE',
        channel: 'whatsapp',
        contactIdentifier: cleanPhone || contactInfo.name,
        contactInfo: { ...contactInfo, phone: cleanPhone },
        messages,
      });

      if (response && !response.error && !response.ignored) {
        hasContext = true;
        updateLauncherBadge(true);
      }
    } catch (err) {
      console.error('[Zazi WA] sendContextUpdate error:', err);
    }
  }

  // ===== DUAL-DETECTION: MutationObserver + Title Observer (Vanto pattern) =====
  function startHeaderObserver() {
    // Observer 1: Watch <title> changes (WhatsApp updates title with chat name)
    const titleEl = document.querySelector('title');
    if (titleEl) {
      const titleObserver = new MutationObserver(() => {
        scheduleDetection(); // Debounced!
      });
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
      console.log('[Zazi WA] Title observer started');
    }

    // Observer 2: Watch #main for data-id changes (KEY: fires on chat switch)
    const bodyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // data-id change on #main = definitive chat switch
        if (mutation.attributeName === 'data-id') {
          signalChatSwitched(); // Instant clear
          scheduleDetection();  // Then detect new
          return;
        }
        if (mutation.target.id === 'main' ||
            (mutation.target.closest && mutation.target.closest('#main'))) {
          scheduleDetection(); // Debounced
          return;
        }
      }
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-id'], // KEY: Only watch data-id changes
    });
    console.log('[Zazi WA] Body/data-id observer started');

    // Observer 3: Header-specific observer (existing pattern, now debounced)
    const checkHeader = () => {
      const headerEl = findElement(SELECTORS.contactName, 'header name');
      if (!headerEl) return;

      const observer = new MutationObserver(() => {
        scheduleDetection(); // Debounced!
      });
      observer.observe(headerEl, { attributes: true, attributeFilter: ['title'] });

      const headerParent = headerEl.closest('header');
      if (headerParent) {
        const parentObs = new MutationObserver(() => {
          scheduleDetection(); // Debounced!
        });
        parentObs.observe(headerParent, { childList: true, subtree: true });
      }
    };

    const headerInterval = setInterval(() => {
      if (findElement(SELECTORS.contactName, 'header name')) {
        clearInterval(headerInterval);
        checkHeader();
      }
    }, 500);
  }

  // ===== CHAT LIST CLICK — instant switch on click (300ms settle) =====
  function startChatListClickListener() {
    document.addEventListener('click', (e) => {
      const chatRow = e.target.closest('[data-testid="cell-frame-container"], [data-testid="list-item"], div[tabindex="-1"][role="listitem"], #pane-side [role="row"], #pane-side div[tabindex]');
      if (chatRow) {
        // INSTANT: Signal chat_switched to kill the old state immediately
        signalChatSwitched();
        // Then fire context check after DOM settles (300ms, not 80ms)
        setTimeout(() => scheduleDetection(), CLICK_SETTLE_MS);
      }
    }, true);
  }

  // ===== MESSAGE LISTENER =====
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'insert_message') {
      sendResponse({ success: insertIntoCompose(msg.text) });
    } else if (msg.action === 'get_chat_context') {
      sendResponse({ contactInfo: getActiveContact(), messages: readVisibleMessages() });
    } else if (msg.action === 'force_refresh') {
      lastContactName = '';
      lastMessageHash = '';
      lastDetectedPhone = null;
      consecutiveNoChatReads = 0;
      noChatSince = null;
      lastRefreshLogAt = 0;
      processActiveChat();
      sendResponse({ success: true });
    }
    return true;
  });

  // ===== INIT =====
  function init() {
    ensureLauncher();
    startHeaderObserver();         // MutationObservers (primary)
    startChatListClickListener();  // Click detection (secondary)
    setInterval(() => scheduleDetection(), POLLING_INTERVAL_MS); // 1.5s polling fallback
    setTimeout(processActiveChat, 500); // Initial check
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  window.addEventListener('beforeunload', () => {
    requestContextClear('tab_unloaded');
  });
})();
