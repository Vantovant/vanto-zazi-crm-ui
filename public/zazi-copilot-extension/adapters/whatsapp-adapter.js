/**
 * Zazi Follow-Up Copilot — WhatsApp Web Content Script (Adapter)
 * Detects active chat, reads messages, determines reply direction, pushes to background.
 */

(() => {
  if (window.__zaziWAAdapterLoaded) return;
  window.__zaziWAAdapterLoaded = true;

  console.log('[Zazi WA] WhatsApp adapter loaded');

  // ===== RESILIENT SELECTORS =====
  const SELECTORS = {
    chatList: '[aria-label="Chat list"], #pane-side',
    activeChat: 'header span[dir="auto"][title]',
    messageContainer: '#main div[role="row"], #main .message-in, #main .message-out',
    messageRows: '#main div.message-in, #main div.message-out, #main [data-id]',
    incomingMsg: '.message-in, [data-id^="false_"]',
    outgoingMsg: '.message-out, [data-id^="true_"]',
    msgText: 'span.selectable-text, span[dir="ltr"], span[dir="auto"]',
    msgTime: '[data-pre-plain-text], span[dir="auto"]',
    composeBox: '#main footer div[contenteditable="true"], div[data-tab="10"]',
    contactInfo: '#main header span[title]',
    phoneFromHeader: 'header span[title*="+"]',
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return [...document.querySelectorAll(selector)];
  }

  // ===== GET ACTIVE CONTACT =====
  function getActiveContact() {
    // Try to get name from chat header
    const headerEl = $(SELECTORS.contactInfo);
    if (!headerEl) return null;

    const name = headerEl.getAttribute('title') || headerEl.textContent?.trim();
    if (!name) return null;

    // Try to extract phone from header or subtitle
    let phone = '';
    const phoneEl = $(SELECTORS.phoneFromHeader);
    if (phoneEl) {
      phone = phoneEl.getAttribute('title') || phoneEl.textContent || '';
    }

    // Also check the subtitle area for phone number
    if (!phone) {
      const subtitleEl = document.querySelector('#main header span[title*="+"]') ||
                         document.querySelector('#main header ._amig span');
      if (subtitleEl) phone = subtitleEl.textContent || '';
    }

    return { name, phone: phone.replace(/[^0-9+]/g, '') };
  }

  // ===== READ VISIBLE MESSAGES =====
  function readVisibleMessages() {
    const messages = [];
    const rows = $$('#main [data-id]');

    for (const row of rows.slice(-30)) { // Last 30 messages
      const dataId = row.getAttribute('data-id') || '';
      const isOutgoing = dataId.startsWith('true_') || row.classList.contains('message-out') ||
                         row.closest('.message-out') !== null;
      const isIncoming = dataId.startsWith('false_') || row.classList.contains('message-in') ||
                         row.closest('.message-in') !== null;

      if (!isOutgoing && !isIncoming) continue;

      // Get text content
      const textEl = row.querySelector('span.selectable-text');
      const text = textEl?.textContent?.trim() || '';
      if (!text) continue;

      // Try to get timestamp
      let timestamp = null;
      const preText = row.querySelector('[data-pre-plain-text]');
      if (preText) {
        const raw = preText.getAttribute('data-pre-plain-text');
        // Format: "[HH:MM, DD/MM/YYYY] Name: "
        const match = raw?.match(/\[(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]/);
        if (match) {
          const [, time, date] = match;
          const [day, month, year] = date.split('/');
          timestamp = new Date(`${year}-${month}-${day}T${time}:00`).toISOString();
        }
      }

      messages.push({
        direction: isOutgoing ? 'outbound' : 'inbound',
        text,
        timestamp: timestamp || new Date().toISOString(),
      });
    }

    return messages;
  }

  // ===== INSERT TEXT INTO COMPOSE BOX =====
  function insertIntoCompose(text) {
    const compose = $(SELECTORS.composeBox);
    if (!compose) {
      console.warn('[Zazi WA] Compose box not found');
      return false;
    }
    compose.focus();
    // Use execCommand for contenteditable compatibility
    document.execCommand('insertText', false, text);
    // Trigger input event
    compose.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ===== INJECT INLINE WIDGET =====
  function injectWidget(data) {
    let widget = document.getElementById('zazi-copilot-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'zazi-copilot-widget';
      // Insert after the chat header
      const header = document.querySelector('#main header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(widget, header.nextSibling);
      } else {
        return; // No main chat open
      }
    }

    const rec = data.recommendation || {};
    const contact = data.contact;

    widget.innerHTML = `
      <div class="zazi-widget-bar">
        <span class="zazi-widget-badge" style="background:${rec.badgeColor || '#6b7280'}20;color:${rec.badgeColor || '#6b7280'}">
          ${rec.badge || '📋 No Data'}
        </span>
        <span class="zazi-widget-name">${contact?.full_name || 'Unknown Contact'}</span>
        <span class="zazi-widget-type">${contact?.lead_type || ''}</span>
        <div class="zazi-widget-actions">
          <button class="zazi-btn" id="zazi-suggest-reply" title="Get smart reply suggestion">💡 Suggest</button>
          <button class="zazi-btn" id="zazi-log-activity" title="Log this interaction">📝 Log</button>
          <button class="zazi-btn" id="zazi-open-panel" title="Open Copilot panel">🔍 Panel</button>
        </div>
      </div>
    `;

    // Button handlers
    document.getElementById('zazi-suggest-reply')?.addEventListener('click', () => {
      if (data.suggestion?.whatsapp) {
        insertIntoCompose(data.suggestion.whatsapp);
      }
    });

    document.getElementById('zazi-log-activity')?.addEventListener('click', () => {
      const contactInfo = getActiveContact();
      chrome.runtime.sendMessage({
        type: 'LOG_ACTIVITY',
        params: {
          contact_id: contact?.id || null,
          activity_type: 'whatsapp',
          summary: `WhatsApp follow-up with ${contact?.full_name || contactInfo?.name || 'Unknown'}`,
          notes: data.messages?.[0]?.text?.substring(0, 200) || '',
          next_action: rec.reason || '',
        },
      });
    });

    document.getElementById('zazi-open-panel')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    });
  }

  // ===== POLL FOR ACTIVE CHAT CHANGES =====
  let lastContactName = '';
  let pollTimer = null;

  async function pollActiveChat() {
    try {
      const contactInfo = getActiveContact();
      if (!contactInfo || !contactInfo.name) {
        // Remove widget if no active chat
        const w = document.getElementById('zazi-copilot-widget');
        if (w) w.remove();
        lastContactName = '';
        return;
      }

      // Only re-process if contact changed or every 30s
      if (contactInfo.name === lastContactName && pollTimer) return;
      lastContactName = contactInfo.name;

      const messages = readVisibleMessages();

      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_CONTEXT_UPDATE',
        channel: 'whatsapp',
        contactIdentifier: contactInfo.phone || contactInfo.name,
        contactInfo,
        messages,
      });

      if (response && !response.error) {
        injectWidget({
          contact: response.contact,
          recommendation: response.recommendation,
          suggestion: response.suggestion,
          messages,
        });
      }
    } catch (err) {
      console.error('[Zazi WA] Poll error:', err);
    }
  }

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'scrape_contacts') {
      // Legacy compatibility with existing extension
      const contacts = scrapeContactList();
      sendResponse({ contacts });
    } else if (msg.action === 'insert_message') {
      const ok = insertIntoCompose(msg.text);
      sendResponse({ success: ok });
    } else if (msg.action === 'get_chat_context') {
      const contactInfo = getActiveContact();
      const messages = readVisibleMessages();
      sendResponse({ contactInfo, messages });
    }
    return true;
  });

  // Legacy scrape for backward compatibility
  function scrapeContactList() {
    const contacts = [];
    const chatItems = $$(SELECTORS.chatList + ' [role="listitem"], ' + SELECTORS.chatList + ' [data-id]');
    for (const item of chatItems) {
      const nameEl = item.querySelector('span[title][dir="auto"]');
      if (!nameEl) continue;
      const name = nameEl.getAttribute('title') || nameEl.textContent?.trim();
      if (!name) continue;
      contacts.push({ name, phone: '' });
    }
    return contacts;
  }

  // Start polling every 5 seconds
  setInterval(pollActiveChat, 5000);
  // Initial poll after 3s to let WhatsApp load
  setTimeout(pollActiveChat, 3000);
})();
