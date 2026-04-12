/**
 * Zazi Follow-Up Copilot — WhatsApp Web Content Script (Adapter)
 * Detects active chat, sends context to background, which updates side panel state.
 */

(() => {
  if (window.__zaziWACopilotLoaded) return;
  window.__zaziWACopilotLoaded = true;

  console.log('[Zazi WA] Copilot adapter loaded');

  const SEL = {
    contactInfo: '#main header span[title]',
    phoneFromHeader: 'header span[title*="+"]',
    composeBox: '#main footer div[contenteditable="true"], div[data-tab="10"]',
    groupMeta: '#main header span[data-icon="default-group"], #main header span[data-icon="group"]',
    participantCount: '#main header span[title*="participants"], #main header span[title*="members"]',
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ===== STATE =====
  let lastContactName = '';
  let lastMessageHash = '';
  let hasContext = false;
  let consecutiveNoChatReads = 0;
  let noChatSince = null;
  let lastRefreshLogAt = 0;
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

  // ===== ROBUST GROUP DETECTION =====
  function isGroupChat() {
    // Check 1: Group icon in header
    if ($(SEL.groupMeta)) return true;

    // Check 2: "participants" or "members" text
    if ($(SEL.participantCount)) return true;

    // Check 3: Subtitle with comma-separated participant names
    // WhatsApp groups show "Name1, Name2, Name3, ..." or "You, Name1, Name2"
    const subtitleEl = document.querySelector('#main header span[dir="auto"]:not(:first-child)') ||
                       document.querySelector('#main header [title]:nth-of-type(2)');
    if (subtitleEl) {
      const text = (subtitleEl.getAttribute('title') || subtitleEl.textContent || '').trim();
      // A comma-separated list with 2+ names is a strong group signal
      if (text.includes(',')) {
        const parts = text.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          // Exclude phone-number-only lists (e.g. "+27..., +27...")
          const hasNonPhonePart = parts.some(p => !/^\+?\d[\d\s\-()]{6,}$/.test(p));
          if (hasNonPhonePart || parts.length >= 3) return true;
        }
      }
      // "click here for group info" or "tap here"
      if (/click here|tap here|group info/i.test(text)) return true;
    }

    // Check 4: data-icon attributes for community/group
    const communityIcon = document.querySelector('#main header span[data-icon*="community"], #main header span[data-icon*="group"]');
    if (communityIcon) return true;

    return false;
  }

  // ===== IMPROVED IDENTITY EXTRACTION =====
  function getActiveContact() {
    const headerEl = $(SEL.contactInfo);
    if (!headerEl) return null;
    const name = headerEl.getAttribute('title') || headerEl.textContent?.trim();
    if (!name) return null;

    let phone = '';

    const phoneEl = $(SEL.phoneFromHeader);
    if (phoneEl) {
      phone = phoneEl.getAttribute('title') || phoneEl.textContent || '';
    }

    if (!phone) {
      const headerSpans = $$('#main header span[title]');
      for (const span of headerSpans) {
        const t = span.getAttribute('title') || '';
        if (/\+?\d[\d\s\-()]{6,}/.test(t) && t !== name) {
          phone = t;
          break;
        }
      }
    }

    if (!phone && /^\+?\d[\d\s\-()]{6,}$/.test(name)) {
      phone = name;
    }

    if (!phone) {
      const drawerPhone = document.querySelector('[data-testid="phone-number"] span, .copyable-text[data-tab] span[title*="+"]');
      if (drawerPhone) {
        phone = drawerPhone.textContent || drawerPhone.getAttribute('title') || '';
      }
    }

    if (!phone) {
      const msgEl = document.querySelector('#main [data-id*="@"]');
      if (msgEl) {
        const dataId = msgEl.getAttribute('data-id') || '';
        const phoneMatch = dataId.match(/(\d{10,15})@/);
        if (phoneMatch) {
          phone = phoneMatch[1];
        }
      }
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    return { name, phone: cleanPhone };
  }

  function readVisibleMessages() {
    const messages = [];
    const rows = $$('#main [data-id]');
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

  function getConversationKey(contactInfo) {
    return (contactInfo?.phone || contactInfo?.name || '').trim().toLowerCase();
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
    const compose = $(SEL.composeBox);
    if (!compose) { console.warn('[Zazi WA] Compose box not found'); return false; }
    compose.focus();
    document.execCommand('insertText', false, text);
    compose.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ===== CHAT CONTEXT DETECTION =====
  async function processActiveChat() {
    try {
      // STEP 1: Check for group BEFORE extracting contact identity
      if (isGroupChat()) {
        // If we were previously on a 1:1 chat, clear that state
        if (lastContactName) {
          lastContactName = '';
          lastMessageHash = '';
          hasContext = false;
          updateLauncherBadge(false);
        }

        // Send group context — side panel shows "Group chat detected" warning
        const headerEl = $(SEL.contactInfo);
        const groupName = headerEl?.getAttribute('title') || headerEl?.textContent?.trim() || 'Group';

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
          hasContext = false;
          updateLauncherBadge(false);
        }
        return;
      }

      consecutiveNoChatReads = 0;
      noChatSince = null;

      const messages = readVisibleMessages();
      const msgHash = computeMessageHash(messages);

      const isSameContact = contactInfo.name === lastContactName;
      const isSameMessages = msgHash === lastMessageHash;

      // CRITICAL: If contact changed, send update IMMEDIATELY
      if (!isSameContact) {
        console.log('[Zazi WA] Chat switched:', { from: lastContactName, to: contactInfo.name, phone: contactInfo.phone || '(none)' });
        lastContactName = contactInfo.name;
        lastMessageHash = msgHash;
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
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_CONTEXT_UPDATE',
        channel: 'whatsapp',
        contactIdentifier: contactInfo.phone || contactInfo.name,
        contactInfo,
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

  // ===== HEADER-SPECIFIC OBSERVER — instant chat switch detection =====
  function startHeaderObserver() {
    const checkHeader = () => {
      const headerEl = document.querySelector('#main header span[title]');
      if (!headerEl) return;

      const observer = new MutationObserver(() => {
        processActiveChat();
      });
      observer.observe(headerEl, { attributes: true, attributeFilter: ['title'] });

      const headerParent = headerEl.closest('header');
      if (headerParent) {
        const parentObs = new MutationObserver(() => {
          processActiveChat();
        });
        parentObs.observe(headerParent, { childList: true, subtree: true });
      }
    };

    const headerInterval = setInterval(() => {
      if (document.querySelector('#main header span[title]')) {
        clearInterval(headerInterval);
        checkHeader();
      }
    }, 500);
  }

  // ===== CHAT LIST CLICK — instant switch on click =====
  function startChatListClickListener() {
    document.addEventListener('click', (e) => {
      const chatRow = e.target.closest('[data-testid="cell-frame-container"], [data-testid="list-item"], div[tabindex="-1"][role="listitem"], #pane-side [role="row"], #pane-side div[tabindex]');
      if (chatRow) {
        // INSTANT: Signal chat_switched to kill the old state immediately
        signalChatSwitched();
        // Then fire context check after DOM settles
        setTimeout(processActiveChat, 80);
      }
    }, true);
  }

  // ===== GENERAL MUTATION OBSERVER =====
  function startObserver() {
    const target = document.getElementById('app') || document.body;
    const observer = new MutationObserver(() => {
      clearTimeout(startObserver._timer);
      startObserver._timer = setTimeout(() => {
        ensureLauncher();
        processActiveChat();
      }, 400);
    });
    observer.observe(target, { childList: true, subtree: true });
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
    startObserver();
    startHeaderObserver();
    startChatListClickListener();
    setInterval(processActiveChat, 4000);
    setTimeout(processActiveChat, 500);
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  window.addEventListener('beforeunload', () => {
    requestContextClear('tab_unloaded');
  });
})();
