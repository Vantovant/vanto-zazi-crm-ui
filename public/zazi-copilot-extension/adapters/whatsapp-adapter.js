/**
 * Zazi Follow-Up Copilot — WhatsApp Web Content Script (Adapter)
 * Persistent floating panel + inline widget. Survives SPA re-renders.
 */

(() => {
  if (window.__zaziWACopilotLoaded) return;
  window.__zaziWACopilotLoaded = true;

  console.log('[Zazi WA] Copilot adapter loaded');

  // ===== SELECTORS =====
  const SEL = {
    contactInfo: '#main header span[title]',
    phoneFromHeader: 'header span[title*="+"]',
    composeBox: '#main footer div[contenteditable="true"], div[data-tab="10"]',
    mainPanel: '#main',
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ===== STATE =====
  let lastContactName = '';
  let currentData = null;
  let panelOpen = false;

  // ===== PERSISTENT FLOATING LAUNCHER (on document.body) =====
  function ensureLauncher() {
    if (document.getElementById('zazi-copilot-launcher')) return;

    const launcher = document.createElement('div');
    launcher.id = 'zazi-copilot-launcher';
    launcher.innerHTML = `
      <style>
        #zazi-copilot-launcher {
          position: fixed; bottom: 24px; right: 24px; z-index: 99999;
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,0.4);
          transition: transform 0.2s, box-shadow 0.2s;
          font-size: 22px; user-select: none;
        }
        #zazi-copilot-launcher:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 28px rgba(99,102,241,0.55);
        }
        #zazi-copilot-launcher .zazi-badge-dot {
          position: absolute; top: 2px; right: 2px; width: 12px; height: 12px;
          border-radius: 50%; background: #22c55e; border: 2px solid #1a1a2e;
          display: none;
        }
        #zazi-copilot-launcher.has-context .zazi-badge-dot { display: block; }

        #zazi-copilot-panel {
          position: fixed; bottom: 88px; right: 24px; z-index: 99998;
          width: 340px; max-height: 520px; overflow-y: auto;
          background: #0f0f23; border: 1px solid #2a2a4a; border-radius: 14px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px; color: #e2e8f0;
          display: none;
          flex-direction: column;
        }
        #zazi-copilot-panel.open { display: flex; }

        .zcp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid #1e1e3a;
          background: #13132b; border-radius: 14px 14px 0 0;
        }
        .zcp-header-left { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
        .zcp-close { background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; padding: 4px; }
        .zcp-close:hover { color: #e2e8f0; }

        .zcp-body { padding: 12px 16px; }

        .zcp-empty { text-align: center; padding: 32px 16px; color: #64748b; }
        .zcp-empty .icon { font-size: 28px; margin-bottom: 8px; }

        .zcp-contact-card {
          background: #1a1a2e; border-radius: 10px; padding: 12px; margin-bottom: 10px;
        }
        .zcp-contact-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px; }
        .zcp-contact-name { font-weight: 700; font-size: 15px; color: #f1f5f9; }
        .zcp-reply-badge {
          font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap;
        }
        .zcp-meta { display: flex; gap: 6px; flex-wrap: wrap; }
        .zcp-meta-tag {
          font-size: 10px; padding: 2px 6px; background: #2a2a4a; border-radius: 6px; color: #94a3b8;
        }
        .zcp-no-match { background: #f59e0b15; border: 1px solid #f59e0b40; border-radius: 8px; padding: 8px; margin-top: 8px; font-size: 12px; color: #fbbf24; }
        .zcp-no-match button {
          background: #f59e0b30; border: 1px solid #f59e0b60; color: #fbbf24; border-radius: 6px;
          padding: 4px 10px; font-size: 11px; cursor: pointer; margin-top: 6px;
        }

        .zcp-rec-card {
          background: #1a1a2e; border-radius: 10px; padding: 12px; margin-bottom: 10px;
          border-left: 3px solid #6366f1;
        }
        .zcp-rec-header { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12px; color: #a5b4fc; margin-bottom: 4px; }
        .zcp-rec-action { font-weight: 700; font-size: 14px; color: #f1f5f9; margin-bottom: 2px; }
        .zcp-rec-reason { font-size: 12px; color: #94a3b8; }

        .zcp-sugg-card {
          background: #1a1a2e; border-radius: 10px; padding: 12px; margin-bottom: 10px;
        }
        .zcp-sugg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .zcp-sugg-label { font-weight: 600; font-size: 12px; color: #a5b4fc; }
        .zcp-sugg-body {
          background: #13132b; border-radius: 8px; padding: 10px; font-size: 13px;
          line-height: 1.5; color: #cbd5e1; margin-bottom: 8px; min-height: 40px;
        }
        .zcp-sugg-actions { display: flex; gap: 6px; }
        .zcp-sugg-btn {
          flex: 1; background: #2a2a4a; border: 1px solid #3a3a5a; color: #e2e8f0;
          border-radius: 8px; padding: 6px; font-size: 11px; cursor: pointer; text-align: center;
          transition: background 0.15s;
        }
        .zcp-sugg-btn:hover { background: #3a3a6a; }

        .zcp-msgs-header { font-weight: 600; font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
        .zcp-msg {
          padding: 6px 8px; border-radius: 6px; margin-bottom: 4px; font-size: 12px;
          max-height: 48px; overflow: hidden; line-height: 1.4;
        }
        .zcp-msg-in { background: #1e293b; border-left: 2px solid #3b82f6; }
        .zcp-msg-out { background: #1a2e1a; border-left: 2px solid #22c55e; }
        .zcp-msg-time { font-size: 10px; color: #64748b; margin-top: 2px; }

        .zcp-open-crm {
          display: block; width: 100%; background: #6366f120; border: 1px solid #6366f140;
          color: #a5b4fc; border-radius: 8px; padding: 8px; font-size: 12px;
          cursor: pointer; text-align: center; margin-top: 4px;
        }
        .zcp-open-crm:hover { background: #6366f130; }
      </style>
      <span class="zazi-badge-dot"></span>
      ⚡
    `;
    document.body.appendChild(launcher);
    launcher.addEventListener('click', togglePanel);
  }

  // ===== PERSISTENT PANEL (on document.body) =====
  function ensurePanel() {
    if (document.getElementById('zazi-copilot-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'zazi-copilot-panel';
    panel.innerHTML = `
      <div class="zcp-header">
        <div class="zcp-header-left">⚡ Zazi Copilot</div>
        <button class="zcp-close" id="zcp-close-btn">✕</button>
      </div>
      <div class="zcp-body" id="zcp-body">
        <div class="zcp-empty">
          <div class="icon">📭</div>
          <div>Open a chat to see follow-up intelligence</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#zcp-close-btn').addEventListener('click', () => {
      panelOpen = false;
      panel.classList.remove('open');
    });
  }

  function togglePanel() {
    const panel = document.getElementById('zazi-copilot-panel');
    if (!panel) return;
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
  }

  // ===== RENDER PANEL CONTENT =====
  function renderPanel(data) {
    const body = document.getElementById('zcp-body');
    if (!body) return;

    const { contact, recommendation, suggestion, messages, replyStatus } = data;

    // Reply status badge
    const statusMap = {
      'awaiting_my_reply': { text: '⚡ Reply Needed', bg: '#ef444420', color: '#f87171' },
      'awaiting_their_reply': { text: '⏳ Awaiting Reply', bg: '#f59e0b20', color: '#fbbf24' },
      'replied_recently': { text: '💬 Active', bg: '#22c55e20', color: '#4ade80' },
      'stale': { text: '❄️ Stale', bg: '#3b82f620', color: '#60a5fa' },
      'unknown': { text: '❓ Unknown', bg: '#6b728020', color: '#94a3b8' },
    };
    const rs = statusMap[replyStatus] || statusMap['unknown'];

    const rec = recommendation || {};
    const contactName = contact?.full_name || data.contactInfo?.name || 'Unknown';

    // Suggestion text
    const suggText = suggestion?.whatsapp || '—';

    // Messages HTML
    let msgsHtml = '';
    const msgs = (messages || []).slice(0, 6);
    for (const m of msgs) {
      const cls = m.direction === 'outbound' ? 'zcp-msg-out' : 'zcp-msg-in';
      const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      msgsHtml += `<div class="zcp-msg ${cls}">${esc(m.text?.substring(0, 120) || '')}<div class="zcp-msg-time">${time}</div></div>`;
    }
    if (msgs.length === 0) {
      msgsHtml = '<div style="color:#64748b;text-align:center;padding:8px;">No messages captured</div>';
    }

    body.innerHTML = `
      <div class="zcp-contact-card">
        <div class="zcp-contact-header">
          <div class="zcp-contact-name">${esc(contactName)}</div>
          <span class="zcp-reply-badge" style="background:${rs.bg};color:${rs.color}">${rs.text}</span>
        </div>
        <div class="zcp-meta">
          ${contact?.lead_type ? `<span class="zcp-meta-tag">${esc(contact.lead_type)}</span>` : ''}
          ${contact?.lead_temperature ? `<span class="zcp-meta-tag">${esc(contact.lead_temperature)}</span>` : ''}
          ${contact?.communication_status ? `<span class="zcp-meta-tag">${esc(contact.communication_status)}</span>` : ''}
        </div>
        ${!contact ? '<div class="zcp-no-match">⚠️ No CRM match found<br><button id="zcp-create-contact">+ Create Contact</button></div>' : ''}
      </div>

      <div class="zcp-rec-card">
        <div class="zcp-rec-header">🎯 Next Action</div>
        <div class="zcp-rec-action">${esc(rec.badge || '—')}</div>
        <div class="zcp-rec-reason">${esc(rec.reason || '')}</div>
      </div>

      <div class="zcp-sugg-card">
        <div class="zcp-sugg-header">
          <span class="zcp-sugg-label">💡 Suggested Reply</span>
        </div>
        <div class="zcp-sugg-body" id="zcp-sugg-text">${esc(suggText)}</div>
        <div class="zcp-sugg-actions">
          <button class="zcp-sugg-btn" id="zcp-copy">📋 Copy</button>
          <button class="zcp-sugg-btn" id="zcp-insert">📥 Insert</button>
          <button class="zcp-sugg-btn" id="zcp-log">💾 Log</button>
        </div>
      </div>

      <div class="zcp-msgs-header">Recent Messages</div>
      ${msgsHtml}

      <button class="zcp-open-crm" id="zcp-open-crm">📊 Open in CRM</button>
    `;

    // Bind actions
    body.querySelector('#zcp-copy')?.addEventListener('click', () => {
      const text = document.getElementById('zcp-sugg-text')?.textContent;
      if (text && text !== '—') {
        navigator.clipboard.writeText(text);
        body.querySelector('#zcp-copy').textContent = '✅ Copied!';
        setTimeout(() => { body.querySelector('#zcp-copy').textContent = '📋 Copy'; }, 1500);
      }
    });

    body.querySelector('#zcp-insert')?.addEventListener('click', () => {
      const text = document.getElementById('zcp-sugg-text')?.textContent;
      if (text && text !== '—') insertIntoCompose(text);
    });

    body.querySelector('#zcp-log')?.addEventListener('click', () => {
      const text = document.getElementById('zcp-sugg-text')?.textContent;
      chrome.runtime.sendMessage({
        type: 'LOG_ACTIVITY',
        params: {
          contact_id: contact?.id || null,
          activity_type: 'draft',
          summary: `Draft WhatsApp reply prepared for ${contactName}`,
          notes: text?.substring(0, 500) || '',
          next_action: rec?.action || '',
        },
      });
      body.querySelector('#zcp-log').textContent = '✅ Saved!';
      setTimeout(() => { body.querySelector('#zcp-log').textContent = '💾 Log'; }, 1500);
    });

    body.querySelector('#zcp-create-contact')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    });

    body.querySelector('#zcp-open-crm')?.addEventListener('click', () => {
      const url = contact?.id
        ? `https://vanto-zazi-bloom.lovable.app/contacts`
        : 'https://vanto-zazi-bloom.lovable.app/dashboard';
      window.open(url, '_blank');
    });

    // Update launcher badge
    const launcher = document.getElementById('zazi-copilot-launcher');
    if (launcher) launcher.classList.add('has-context');
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

  function insertIntoCompose(text) {
    const compose = $(SEL.composeBox);
    if (!compose) { console.warn('[Zazi WA] Compose box not found'); return false; }
    compose.focus();
    document.execCommand('insertText', false, text);
    compose.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ===== CHAT POLLING WITH MUTATION OBSERVER =====
  async function processActiveChat() {
    try {
      const contactInfo = getActiveContact();
      if (!contactInfo || !contactInfo.name) {
        if (lastContactName) {
          lastContactName = '';
          // Don't clear panel — keep last context visible
        }
        return;
      }

      // Skip if same contact and we already have data
      if (contactInfo.name === lastContactName && currentData) return;
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
        currentData = { ...response, messages, contactInfo };
        renderPanel(currentData);

        // Auto-open panel on first context
        if (!panelOpen) {
          panelOpen = true;
          document.getElementById('zazi-copilot-panel')?.classList.add('open');
        }
      }
    } catch (err) {
      console.error('[Zazi WA] processActiveChat error:', err);
    }
  }

  // ===== MUTATION OBSERVER for chat switches =====
  function startObserver() {
    // Watch #app or body for structural changes indicating chat switch
    const target = document.getElementById('app') || document.body;
    const observer = new MutationObserver(() => {
      // Debounce: only process after DOM settles
      clearTimeout(startObserver._timer);
      startObserver._timer = setTimeout(() => {
        ensureLauncher();
        ensurePanel();
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
    }
    return true;
  });

  // ===== INIT =====
  function init() {
    ensureLauncher();
    ensurePanel();
    startObserver();
    // Also poll periodically as backup
    setInterval(processActiveChat, 8000);
    // Initial check after WhatsApp loads
    setTimeout(processActiveChat, 3000);
  }

  // Wait for page ready
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();

