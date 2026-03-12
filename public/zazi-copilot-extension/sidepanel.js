/**
 * Zazi Follow-Up Copilot — Side Panel Controller
 */

const $ = (id) => document.getElementById(id);

let currentContext = null;

// ===== INIT =====
async function init() {
  const res = await chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
  if (res.authenticated) {
    showConnected(res.email);
    startContextPolling();
  }
}

// ===== AUTH =====
$('loginBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const password = $('password').value.trim();
  if (!email || !password) return;

  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'Connecting...';
  $('loginError').classList.add('hidden');

  const res = await chrome.runtime.sendMessage({ type: 'AUTH_LOGIN', email, password });

  if (res.success) {
    showConnected(email);
    startContextPolling();
  } else {
    $('loginError').textContent = res.error || 'Login failed';
    $('loginError').classList.remove('hidden');
  }

  $('loginBtn').disabled = false;
  $('loginBtn').textContent = 'Connect';
});

$('logoutBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'AUTH_LOGOUT' });
  $('loginSection').classList.remove('hidden');
  $('connectedSection').classList.add('hidden');
  $('logoutBtn').classList.add('hidden');
  $('statusBadge').textContent = 'Not Connected';
  $('statusBadge').className = 'status-badge disconnected';
  currentContext = null;
});

function showConnected(email) {
  $('loginSection').classList.add('hidden');
  $('connectedSection').classList.remove('hidden');
  $('logoutBtn').classList.remove('hidden');
  $('userEmail').textContent = email;
  $('statusBadge').textContent = 'Connected';
  $('statusBadge').className = 'status-badge connected';
}

// ===== CONTEXT POLLING =====
function startContextPolling() {
  pollContext();
  setInterval(pollContext, 3000);
}

async function pollContext() {
  const data = await chrome.storage.local.get('current_context');
  const ctx = data.current_context;

  if (!ctx || !ctx.timestamp) {
    $('noContext').classList.remove('hidden');
    $('activeContext').classList.add('hidden');
    $('timelineSection').classList.add('hidden');
    return;
  }

  // Only update if context is fresh (within last 30s)
  if (Date.now() - ctx.timestamp > 30000) return;

  // Avoid redundant re-renders
  if (currentContext && currentContext.timestamp === ctx.timestamp) return;
  currentContext = ctx;

  $('noContext').classList.add('hidden');
  $('activeContext').classList.remove('hidden');

  renderContext(ctx);
}

// ===== RENDER =====
function renderContext(ctx) {
  // Channel badge
  const channelLabel = ctx.channel === 'whatsapp' ? '💬 WhatsApp' : '📧 Gmail';
  $('channelBadge').textContent = channelLabel;

  // Contact
  const contact = ctx.contact;
  $('contactName').textContent = contact?.full_name || ctx.contactIdentifier || 'Unknown';

  if (contact) {
    $('noContactMatch').classList.add('hidden');
    $('contactType').textContent = contact.lead_type || '';
    $('contactTemp').textContent = contact.lead_temperature || '';
    $('contactStatus').textContent = contact.communication_status || '';
  } else {
    $('noContactMatch').classList.remove('hidden');
    $('contactType').textContent = '';
    $('contactTemp').textContent = '';
    $('contactStatus').textContent = '';
  }

  // Reply status badge
  const statusMap = {
    'awaiting_my_reply': { text: '⚡ Reply Needed', bg: '#ef444420', color: '#f87171' },
    'awaiting_their_reply': { text: '⏳ Awaiting Reply', bg: '#f59e0b20', color: '#fbbf24' },
    'replied_recently': { text: '💬 Active', bg: '#22c55e20', color: '#4ade80' },
    'stale': { text: '❄️ Stale', bg: '#3b82f620', color: '#60a5fa' },
    'unknown': { text: '❓ Unknown', bg: '#6b728020', color: '#94a3b8' },
  };
  const rs = statusMap[ctx.replyStatus] || statusMap['unknown'];
  $('replyBadge').textContent = rs.text;
  $('replyBadge').style.background = rs.bg;
  $('replyBadge').style.color = rs.color;

  // Recommendation
  const rec = ctx.recommendation || {};
  $('recAction').textContent = rec.badge || '—';
  $('recReason').textContent = rec.reason || '';

  // Set tone/objective selects to match recommendation
  if (rec.suggestedTone) $('toneSelect').value = rec.suggestedTone;
  if (rec.suggestedObjective) $('objectiveSelect').value = rec.suggestedObjective;

  // Suggestion
  const sugg = ctx.suggestion;
  if (sugg) {
    const text = ctx.channel === 'whatsapp' ? sugg.whatsapp : sugg.email?.body;
    $('suggestionText').textContent = text || '—';
  }

  // Messages
  renderMessages(ctx.messages || []);

  // Load timeline if contact exists
  if (contact?.id) {
    loadTimeline(contact.id);
  } else {
    $('timelineSection').classList.add('hidden');
  }
}

function renderMessages(messages) {
  const list = $('messagesList');
  list.innerHTML = '';
  for (const msg of messages.slice(0, 10)) {
    const div = document.createElement('div');
    div.className = `msg-item ${msg.direction === 'outbound' ? 'msg-outbound' : 'msg-inbound'}`;
    div.innerHTML = `
      <div>${escapeHtml(msg.text?.substring(0, 150) || '')}</div>
      <div class="msg-time">${formatTime(msg.timestamp)}</div>
    `;
    list.appendChild(div);
  }
  if (messages.length === 0) {
    list.innerHTML = '<p style="color:#64748b;text-align:center;padding:12px;">No messages captured</p>';
  }
}

async function loadTimeline(contactId) {
  const res = await chrome.runtime.sendMessage({ type: 'GET_CONTACT_TIMELINE', contactId });
  if (!res || res.error) return;

  $('timelineSection').classList.remove('hidden');

  // Activities
  const tl = $('timelineList');
  tl.innerHTML = '';
  const activities = res.activities || [];
  for (const a of activities.slice(0, 15)) {
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.innerHTML = `
      <div class="timeline-item-header">
        <span class="timeline-type">${a.activity_type}</span>
        <span class="timeline-date">${formatDate(a.created_at)}</span>
      </div>
      <div class="timeline-summary">${escapeHtml(a.summary || '')}</div>
    `;
    tl.appendChild(div);
  }
  if (activities.length === 0) {
    tl.innerHTML = '<p style="color:#64748b;text-align:center;padding:8px;">No activities</p>';
  }

  // Orders
  const ol = $('ordersList');
  ol.innerHTML = '';
  const orders = res.orders || [];
  for (const o of orders.slice(0, 10)) {
    const div = document.createElement('div');
    div.className = 'order-item';
    div.innerHTML = `
      <div>
        <div class="order-product">${escapeHtml(o.product || '')}</div>
        <div class="order-date">${formatDate(o.order_date)}</div>
      </div>
      <div class="order-amount">R${Number(o.amount || 0).toFixed(2)}</div>
    `;
    ol.appendChild(div);
  }
  if (orders.length === 0) {
    ol.innerHTML = '<p style="color:#64748b;text-align:center;padding:8px;">No orders</p>';
  }
}

// ===== ACTIONS =====

// Regenerate suggestion with selected tone/objective
$('regenerateBtn').addEventListener('click', async () => {
  if (!currentContext?.contact) return;
  const res = await chrome.runtime.sendMessage({
    type: 'GENERATE_SUGGESTION',
    params: {
      contactName: currentContext.contact.full_name,
      objective: $('objectiveSelect').value,
      tone: $('toneSelect').value,
      channel: currentContext.channel,
      leadType: currentContext.contact.lead_type,
      hasPurchased: false,
    },
  });
  if (res.suggestion) {
    const text = currentContext.channel === 'whatsapp' ? res.suggestion.whatsapp : res.suggestion.email?.body;
    $('suggestionText').textContent = text || '—';
    currentContext.suggestion = res.suggestion;
  }
});

// Copy suggestion
$('copyBtn').addEventListener('click', () => {
  const text = $('suggestionText').textContent;
  if (text && text !== '—') {
    navigator.clipboard.writeText(text);
    $('copyBtn').textContent = '✅ Copied!';
    setTimeout(() => { $('copyBtn').textContent = '📋 Copy'; }, 1500);
  }
});

// Insert into active chat
$('insertBtn').addEventListener('click', async () => {
  const text = $('suggestionText').textContent;
  if (!text || text === '—') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: 'insert_message', text });
    $('insertBtn').textContent = '✅ Inserted!';
    setTimeout(() => { $('insertBtn').textContent = '📥 Insert'; }, 1500);
  }
});

// Save as draft activity
$('logDraftBtn').addEventListener('click', async () => {
  if (!currentContext) return;
  const text = $('suggestionText').textContent;
  await chrome.runtime.sendMessage({
    type: 'LOG_ACTIVITY',
    params: {
      contact_id: currentContext.contact?.id || null,
      activity_type: 'draft',
      summary: `Draft ${currentContext.channel} reply prepared`,
      notes: text?.substring(0, 500) || '',
      next_action: currentContext.recommendation?.action || '',
    },
  });
  $('logDraftBtn').textContent = '✅ Saved!';
  setTimeout(() => { $('logDraftBtn').textContent = '💾 Save as Draft'; }, 1500);
});

// Create contact from extension
$('createContactBtn')?.addEventListener('click', () => {
  const crmUrl = 'https://vanto-zazi-bloom.lovable.app/contacts';
  chrome.tabs.create({ url: crmUrl });
});

// ===== HELPERS =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

// Start
init();
