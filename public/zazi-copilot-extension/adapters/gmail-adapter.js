/**
 * Zazi Follow-Up Copilot — Gmail Web Content Script (Adapter)
 * Detects open email thread, reads messages, determines reply direction.
 * Architecture: adapter-based for future Outlook/Webmail support.
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

  // Attempt to get current user's email
  function getMyEmail() {
    // Gmail often has the email in various places
    const el = document.querySelector('a[aria-label*="Google Account"]');
    if (el) {
      const label = el.getAttribute('aria-label') || '';
      const match = label.match(/[\w.+-]+@[\w.-]+/);
      if (match) return match[0].toLowerCase();
    }
    // Fallback: check title
    const titleMatch = document.title.match(/[\w.+-]+@[\w.-]+/);
    if (titleMatch) return titleMatch[0].toLowerCase();
    return null;
  }

  // Detect if we're viewing a thread
  function isThreadView() {
    return Boolean($(SELECTORS.threadSubject));
  }

  // Get thread subject
  function getThreadSubject() {
    const el = $(SELECTORS.threadSubject);
    return el?.textContent?.trim() || '';
  }

  // Read messages in the open thread
  function readThreadMessages() {
    const myEmail = getMyEmail();
    const messages = [];
    const cards = $$('[data-message-id]');

    if (cards.length === 0) {
      // Fallback: try expanded messages
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
    // Get sender
    const senderEl = card.querySelector('span[email]');
    const senderEmail = senderEl?.getAttribute('email')?.toLowerCase() || '';
    const senderName = senderEl?.getAttribute('name') || senderEl?.textContent?.trim() || '';

    if (!senderEmail && !senderName) return null;

    // Determine direction
    const isOutbound = myEmail && senderEmail === myEmail;
    const direction = isOutbound ? 'outbound' : 'inbound';

    // Get body text
    const bodyEl = card.querySelector('.a3s, .gmail_default');
    const text = bodyEl?.textContent?.trim()?.substring(0, 500) || '';

    // Get timestamp
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

  // Get the contact email (the other person in the thread, not me)
  function getContactEmail() {
    const myEmail = getMyEmail();
    const messages = readThreadMessages();
    for (const msg of messages) {
      if (msg.senderEmail && msg.senderEmail !== myEmail) {
        return msg.senderEmail;
      }
    }
    // Check To: field
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

  // Insert text into Gmail reply compose
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
        // Try to click reply first
        const replyBtn = $(SELECTORS.replyBtn);
        if (replyBtn) replyBtn.click();
        setTimeout(() => insertIntoReply(data.suggestion.email.body), 500);
      }
    });

    document.getElementById('zazi-gmail-log')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'LOG_ACTIVITY',
        params: {
          contact_id: contact?.id || null,
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

  // ===== POLL FOR THREAD CHANGES =====
  let lastSubject = '';
  let lastThreadSignature = '';
  let lastContextSentAt = 0;
  const SAME_THREAD_REFRESH_MS = 12000;

  function buildThreadSignature(subject, contactEmail, messages) {
    const tail = (messages || [])
      .slice(-3)
      .map((m) => `${m.direction}:${(m.text || '').substring(0, 40)}`)
      .join('|');
    return `${subject || ''}::${contactEmail || ''}::${tail}`;
  }

  async function pollThread() {
    try {
      if (!isThreadView()) {
        const w = document.getElementById('zazi-gmail-widget');
        if (w) w.remove();
        lastSubject = '';
        lastThreadSignature = '';
        lastContextSentAt = 0;
        return;
      }

      const subject = getThreadSubject();
      const contactEmail = getContactEmail();
      if (!contactEmail) return;

      const messages = readThreadMessages();
      const signature = buildThreadSignature(subject, contactEmail, messages);
      const now = Date.now();
      const sameThread = signature === lastThreadSignature;
      const shouldRefresh = now - lastContextSentAt >= SAME_THREAD_REFRESH_MS;

      if (sameThread && !shouldRefresh) return;

      if (sameThread) {
        console.log('[Zazi Gmail] Valid thread refreshed', { subject, contactEmail });
      } else {
        console.log('[Zazi Gmail] Valid thread detected', { subject, contactEmail });
      }

      lastSubject = subject;
      lastThreadSignature = signature;

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

      lastContextSentAt = now;
    } catch (err) {
      console.error('[Zazi Gmail] Poll error:', err);
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
    }
    return true;
  });

  setInterval(pollThread, 5000);
  setTimeout(pollThread, 3000);
})();
