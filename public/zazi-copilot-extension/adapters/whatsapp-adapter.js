/**
 * Zazi Follow-Up Copilot — WhatsApp Web Content Script (Adapter)
 * Minimal launcher button only. Full UI lives in Chrome side panel.
 * Detects active chat, sends context to background, which updates side panel state.
 */

(() => {
  if (window.__zaziWACopilotLoaded) return;
  window.__zaziWACopilotLoaded = true;

  console.log('[Zazi WA] Copilot adapter loaded (launcher-only mode)');

  // ===== SELECTORS =====
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
  const MAX_NO_CHAT_MISSES_BEFORE_CLEAR = 3;

  // ===== MINIMAL FLOATING LAUNCHER (opens Chrome side panel) =====
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
      console.log('[Zazi WA] Launcher clicked — requesting side panel open');
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    });
  }

  function updateLauncherBadge(active) {
    const launcher = document.getElementById('zazi-copilot-launcher');
    if (launcher) {
      launcher.classList.toggle('has-context', active);
    }
  }

  // ===== GROUP DETECTION =====
  function isGroupChat() {
    // Check for group icon in header
    if ($(SEL.groupMeta)) return true;
    // Check for "participants" or "members" text in header subtitle
    if ($(SEL.participantCount)) return true;
    // Check header subtitle for comma-separated participant list
    const subtitleEl = document.querySelector('#main header span[title]:nth-child(2)');
    if (subtitleEl) {
      const text = subtitleEl.getAttribute('title') || '';
      // Group subtitles typically show participant names separated by commas
      if (text.includes(',') && !text.includes('+')) return true;
    }
    return false;
  }

  // ===== DOM HELPERS =====
  function getActiveContact() {
    const headerEl = $(SEL.contactInfo);
    if (!headerEl) return null;
    const name = headerEl.getAttribute('title') || headerEl.textContent?.trim();
    if (!name) return null;

    let phone = '';
    const phoneEl = $(SEL.phoneFromHeader);
    if (phoneEl) phone = phoneEl.getAttribute('title') || phoneEl.textContent || '';
    if (!phone) {
      const sub = document.querySelector('#main header span[title*="+"]');
      if (sub) phone = sub.textContent || '';
    }

    return { name, phone: phone.replace(/[^0-9+]/g, '') };
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

  /** Simple hash of last 5 messages to detect new messages in same chat */
  function computeMessageHash(messages) {
    const last5 = messages.slice(-5);
    return last5.map(m => `${m.direction}:${m.text.substring(0, 30)}`).join('|');
  }

  function getConversationKey(contactInfo) {
    const key = (contactInfo?.phone || contactInfo?.name || '').trim().toLowerCase();
    return key;
  }

  async function requestContextClear(reason, extra = {}) {
    try {
      await chrome.runtime.sendMessage({
        type: 'CONTEXT_CLEAR_REQUEST',
        channel: 'whatsapp',
        reason,
        ...extra,
      });
      console.log('[Zazi WA] Context clear requested:', reason, extra);
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
      const contactInfo = getActiveContact();
      if (!contactInfo || !contactInfo.name) {
        consecutiveNoChatReads += 1;
        console.log('[Zazi WA] Parse miss (no active chat)', {
          consecutiveNoChatReads,
          threshold: MAX_NO_CHAT_MISSES_BEFORE_CLEAR,
        });

        if (consecutiveNoChatReads < MAX_NO_CHAT_MISSES_BEFORE_CLEAR) {
          console.log('[Zazi WA] Parse miss ignored — keeping last-known-good state');
          return;
        }

        if (lastContactName) {
          console.log('[Zazi WA] Clearing context after confirmed no-chat reads');
          await requestContextClear('confirmed_no_active_chat', {
            consecutiveMisses: consecutiveNoChatReads,
          });
          lastContactName = '';
          lastMessageHash = '';
          hasContext = false;
          updateLauncherBadge(false);
        }
        return;
      }

      consecutiveNoChatReads = 0;

      // Detect and skip group chats
      if (isGroupChat()) {
        console.log('[Zazi WA] Group chat detected, skipping:', contactInfo.name);
        if (lastContactName !== contactInfo.name) {
          lastContactName = contactInfo.name;
          lastMessageHash = '';
          // Store group indicator so side panel can show appropriate message
          await chrome.storage.local.set({
            current_context: {
              channel: 'whatsapp',
              isGroup: true,
              contactIdentifier: contactInfo.name,
              conversationKey: `whatsapp:group:${getConversationKey(contactInfo)}`,
              timestamp: Date.now(),
            }
          });
        }
        return;
      }

      const messages = readVisibleMessages();
      const msgHash = computeMessageHash(messages);

      // Skip if same contact AND same messages (no new activity)
      const isSameContact = contactInfo.name === lastContactName;
      const isSameMessages = msgHash === lastMessageHash;
      if (isSameContact && isSameMessages) return;

      lastContactName = contactInfo.name;
      lastMessageHash = msgHash;

      console.log('[Zazi WA] Valid chat detected:', {
        contact: contactInfo.name,
        conversationKey: `whatsapp:${getConversationKey(contactInfo)}`,
        mode: isSameContact ? 'new_messages' : 'chat_switch',
      });

      // Send context to background — background processes CRM match + intelligence
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_CONTEXT_UPDATE',
        channel: 'whatsapp',
        contactIdentifier: contactInfo.phone || contactInfo.name,
        contactInfo,
        messages,
      });

      if (response?.ignored) {
        console.log('[Zazi WA] Null/empty overwrite attempt blocked by background');
      }

      if (response && !response.error && !response.ignored) {
        hasContext = true;
        updateLauncherBadge(true);
      }
    } catch (err) {
      console.error('[Zazi WA] processActiveChat error:', err);
    }
  }

  // ===== MUTATION OBSERVER for chat switches =====
  function startObserver() {
    const target = document.getElementById('app') || document.body;
    const observer = new MutationObserver(() => {
      clearTimeout(startObserver._timer);
      startObserver._timer = setTimeout(() => {
        ensureLauncher();
        processActiveChat();
      }, 800);
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
      // Force re-process even if same chat (e.g. after creating contact)
      lastContactName = '';
      lastMessageHash = '';
      processActiveChat();
      sendResponse({ success: true });
    }
    return true;
  });

  // ===== INIT =====
  function init() {
    ensureLauncher();
    startObserver();
    setInterval(processActiveChat, 5000); // Poll every 5s for new messages
    setTimeout(processActiveChat, 2000);
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
