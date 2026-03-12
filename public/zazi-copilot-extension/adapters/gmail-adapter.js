/**
 * Zazi Follow-Up Copilot — Gmail Web Content Script (Adapter)
 * Detects open email thread, reads messages, determines reply direction.
 */

(() => {
  if (window.__zaziGmailAdapterLoaded) return;
  window.__zaziGmailAdapterLoaded = true;

  console.log('[Zazi Gmail] Gmail adapter loaded');

  const SELECTORS = {
    threadSubject: 'h2[data-thread-perm-id], h2.hP',
    messageCards: '.gs .gE, [data-message-id], .h7',
    senderName: '.gD, span[email]',
    senderEmail: 'span[email]',
    messageBody: '.a3s, .gmail_default',
    timestamp: '.g3, span[data-tooltip]',
    composeBody: 'div[aria-label="Message Body"], div[g_editable="true"]',
    replyBtn: '[data-tooltip="Reply"], [aria-label="Reply"]',
    threadList: 'tr.zA',
    myEmail: 'a[aria-label*="Google Account"] + div, a[href*="SignOutOptions"]',
  };

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return [...document.querySelectorAll(sel)]; }

  // ===== STATE =====
  let lastSubject = '';
  let lastThreadSignature = '';
  let lastContextSentAt = 0;
  let wasInThread = false;
  let consecutiveNoThreadReads = 0;
  const MAX_NO_THREAD_MISSES = 3;
  const SAME_THREAD_REFRESH_MS = 10000; // Reduced from 12s

  function getMyEmail() {
    const el = document.querySelector('a[aria-label*="Google Account"]');
    if (el) {
      const label = el.getAttribute('aria-label') || '';
      const match = label.match(/[\w.+-]+@[\w.-]+/);
      if (match) return match[0].toLowerCase();
    }
    const titleMatch = document.title.match(/[\w.+-]+@[\w.-]+/);
    if (titleMatch) return titleMatch[0].toLowerCase();
    return null;
  }

  function isThreadView() {
    return Boolean($(SELECTORS.threadSubject));
  }

  function getThreadSubject() {
    const el = $(SELECTORS.threadSubject);
    return el?.textContent?.trim() || '';
  }

  function readThreadMessages() {
    const myEmail = getMyEmail();
    const messages = [];
    const cards = $$('[data-message-id]');

    if (cards.length === 0) {
      const altCards = $$('.gs');
      for (const card of altCards) {
        const parsed = parseMessageCard(card, myEmail);
        if (parsed) messages.push(parsed);
      }
    } else {
      for (const card of cards) {
        const parsed = parseMessageCard(card, myEmail);
        if (parsed) messages.push(parsed);
      }
    }

    return messages;
  }

  function parseMessageCard(card, myEmail) {
    const senderEl = card.querySelector('span[email]');
    const senderEmail = senderEl?.getAttribute('email')?.toLowerCase() || '';
    const senderName = senderEl?.getAttribute('name') || senderEl?.textContent?.trim() || '';

    if (!senderEmail && !senderName) return null;

    const isOutbound = myEmail && senderEmail === myEmail;
    const direction = isOutbound ? 'outbound' : 'inbound';

    const bodyEl = card.querySelector('.a3s, .gmail_default');
    const text = bodyEl?.textContent?.trim()?.substring(0, 500) || '';

    let timestamp = null;
    const timeEl = card.querySelector('span[data-tooltip]');
    if (timeEl) {
      const tooltip = timeEl.getAttribute('data-tooltip') || timeEl.textContent;
      try {
        timestamp = new Date(tooltip).toISOString();
      } catch (e) {
        timestamp = new Date().toISOString();
      }
    }

    return {
      direction,
      senderEmail,
      senderName,
      text,
      timestamp: timestamp || new Date().toISOString(),
    };
  }

  function getContactEmail() {
    const myEmail = getMyEmail();
    const messages = readThreadMessages();
    for (const msg of messages) {
      if (msg.senderEmail && msg.senderEmail !== myEmail) {
        return msg.senderEmail;
      }
    }
    const toEl = document.querySelector('span.g2');
    if (toEl) {
      const emailEl = toEl.querySelector('span[email]');
      if (emailEl) return emailEl.getAttribute('email')?.toLowerCase();
    }
    return null;
  }

  function getContactName() {
    const myEmail = getMyEmail();
    const messages = readThreadMessages();
    for (const msg of messages) {
      if (msg.senderEmail && msg.senderEmail !== myEmail) {
        return msg.senderName;
      }
    }
    return null;
  }

  function insertIntoReply(text) {
    const compose = $(SELECTORS.composeBody);
    if (!compose) {
      console.warn('[Zazi Gmail] Compose body not found');
      return false;
    }
    compose.focus();
    document.execCommand('insertText', false, text);
    compose.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ===== INJECT WIDGET =====
  function injectWidget(data) {
    let widget = document.getElementById('zazi-gmail-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'zazi-gmail-widget';
      const header = $(SELECTORS.threadSubject);
      if (header && header.parentNode) {
        header.parentNode.insertBefore(widget, header.nextSibling);
      } else return;
    }

    const rec = data.recommendation || {};
    const contact = data.contact;

    widget.innerHTML = `
      <div class="zazi-widget-bar zazi-gmail-bar">
        <span class="zazi-widget-badge" style="background:${rec.badgeColor || '#6b7280'}20;color:${rec.badgeColor || '#6b7280'}">
          ${rec.badge || '📋 No Data'}
        </span>
        <span class="zazi-widget-name">${contact?.full_name || getContactName() || 'Unknown'}</span>
        <span class="zazi-widget-type">${contact?.lead_type || ''}</span>
        <div class="zazi-widget-actions">
          <button class="zazi-btn" id="zazi-gmail-suggest" title="Get smart reply">💡 Suggest</button>
          <button class="zazi-btn" id="zazi-gmail-log" title="Log activity">📝 Log</button>
          <button class="zazi-btn" id="zazi-gmail-panel" title="Open panel">🔍 Panel</button>
        </div>
      </div>
    `;

    document.getElementById('zazi-gmail-suggest')?.addEventListener('click', () => {
      if (data.suggestion?.email?.body) {
        const replyBtn = $(SELECTORS.replyBtn);
        if (replyBtn) replyBtn.click();
        setTimeout(() => insertIntoReply(data.suggestion.email.body), 500);
      }
    });

    document.getElementById('zazi-gmail-log')?.addEventListener('click', () => {
      if (!contact?.id) {
        console.warn('[Zazi Gmail] Cannot log activity — no matched contact');
        return;
      }
      chrome.runtime.sendMessage({
        type: 'LOG_ACTIVITY',
        params: {
          contact_id: contact.id,
          activity_type: 'email',
          summary: `Email follow-up: ${getThreadSubject()}`,
          notes: data.messages?.[0]?.text?.substring(0, 200) || '',
        },
      });
    });

    document.getElementById('zazi-gmail-panel')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    });
  }

  function removeWidget() {
    const w = document.getElementById('zazi-gmail-widget');
    if (w) w.remove();
  }

  function buildThreadSignature(subject, contactEmail, messages) {
    const tail = (messages || [])
      .slice(-3)
      .map((m) => `${m.direction}:${(m.text || '').substring(0, 40)}`)
      .join('|');
    return `${subject || ''}::${contactEmail || ''}::${tail}`;
  }

  async function requestContextClear(reason) {
    try {
      await chrome.runtime.sendMessage({
        type: 'CONTEXT_CLEAR_REQUEST',
        channel: 'gmail',
        reason,
        consecutiveMisses: consecutiveNoThreadReads,
      });
    } catch (err) {
      console.warn('[Zazi Gmail] Failed to request context clear:', err);
    }
  }

  // ===== POLL FOR THREAD CHANGES =====
  async function pollThread() {
    try {
      if (!isThreadView()) {
        consecutiveNoThreadReads++;

        if (wasInThread && consecutiveNoThreadReads >= MAX_NO_THREAD_MISSES) {
          removeWidget();
          await requestContextClear('confirmed_no_active_chat');
          wasInThread = false;
          lastSubject = '';
          lastThreadSignature = '';
          lastContextSentAt = 0;
        }
        return;
      }

      // We are in a thread view
      consecutiveNoThreadReads = 0;
      wasInThread = true;

      const subject = getThreadSubject();
      const contactEmail = getContactEmail();
      if (!contactEmail) return;

      const messages = readThreadMessages();
      const signature = buildThreadSignature(subject, contactEmail, messages);
      const now = Date.now();
      const sameThread = signature === lastThreadSignature;

      // CRITICAL: If thread changed, send IMMEDIATELY — no debounce
      if (!sameThread) {
        console.log('[Zazi Gmail] Thread switched:', { subject, contactEmail });
        lastSubject = subject;
        lastThreadSignature = signature;
        lastContextSentAt = now;
        await sendGmailContext(subject, contactEmail, messages);
        return;
      }

      // Same thread — only refresh periodically
      if (now - lastContextSentAt < SAME_THREAD_REFRESH_MS) return;

      lastContextSentAt = now;
      await sendGmailContext(subject, contactEmail, messages);
    } catch (err) {
      console.error('[Zazi Gmail] Poll error:', err);
    }
  }

  async function sendGmailContext(subject, contactEmail, messages) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_CONTEXT_UPDATE',
        channel: 'gmail',
        contactIdentifier: contactEmail,
        contactInfo: { name: getContactName(), email: contactEmail },
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
      console.error('[Zazi Gmail] sendGmailContext error:', err);
    }
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'get_chat_context') {
      sendResponse({
        contactInfo: { name: getContactName(), email: getContactEmail() },
        messages: readThreadMessages(),
        subject: getThreadSubject(),
      });
    } else if (msg.action === 'insert_message') {
      const ok = insertIntoReply(msg.text);
      sendResponse({ success: ok });
    } else if (msg.action === 'force_refresh') {
      lastSubject = '';
      lastThreadSignature = '';
      lastContextSentAt = 0;
      consecutiveNoThreadReads = 0;
      pollThread();
      sendResponse({ success: true });
    }
    return true;
  });

  // Reduced polling from 5s to 3s
  setInterval(pollThread, 3000);
  setTimeout(pollThread, 1500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(pollThread, 300);
    }
  });

  window.addEventListener('beforeunload', () => {
    requestContextClear('tab_unloaded');
  });
})();
