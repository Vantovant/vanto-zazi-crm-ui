/**
 * Zazi Follow-Up Copilot — Side Panel Controller
 */

const $ = (id) => document.getElementById(id);

let currentContext = null;
let currentChannel = null;
const lastKnownByChannel = {
  whatsapp: null,
  gmail: null,
};
const MAX_CONTEXT_AGE_MS = 120000;
const REFRESH_GRACE_MS = 45000;
const CONTEXT_STORAGE_KEYS = [
  'current_channel',
  'current_context',
  'last_known_good_whatsapp_context',
  'last_known_good_gmail_context',
];

function getLastKnownContextKey(channel) {
  return channel === 'gmail' ? 'last_known_good_gmail_context' : 'last_known_good_whatsapp_context';
}

function rememberLastKnownContext(ctx) {
  if (!ctx?.channel || !isContextPayloadValid(ctx)) return;
  lastKnownByChannel[ctx.channel] = ctx;
}

function hydrateLastKnownContexts(data) {
  if (isContextPayloadValid(data.last_known_good_whatsapp_context)) {
    lastKnownByChannel.whatsapp = data.last_known_good_whatsapp_context;
  }
  if (isContextPayloadValid(data.last_known_good_gmail_context)) {
    lastKnownByChannel.gmail = data.last_known_good_gmail_context;
  }
}

function pickFallbackContext(preferredChannel) {
  const now = Date.now();

  const preferred = preferredChannel ? lastKnownByChannel[preferredChannel] : null;
  if (isContextPayloadValid(preferred) && now - (preferred.timestamp || 0) <= REFRESH_GRACE_MS) {
    return preferred;
  }

  const candidates = Object.values(lastKnownByChannel)
    .filter((ctx) => isContextPayloadValid(ctx) && now - (ctx.timestamp || 0) <= MAX_CONTEXT_AGE_MS)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return candidates[0] || null;
}

// ===== INIT =====
async function init() {
  console.log('[Zazi SP] Side panel initializing');
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
  await chrome.storage.local.remove(CONTEXT_STORAGE_KEYS);
  $('loginSection').classList.remove('hidden');
  $('connectedSection').classList.add('hidden');
  $('logoutBtn').classList.add('hidden');
  $('statusBadge').textContent = 'Not Connected';
  $('statusBadge').className = 'status-badge disconnected';
  currentContext = null;
  currentChannel = null;
  lastKnownByChannel.whatsapp = null;
  lastKnownByChannel.gmail = null;
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
  setInterval(pollContext, 2000);
}

function isExplicitClear(ctx) {
  return Boolean(ctx?.cleared || ctx?.clearReason);
}

function isContextPayloadValid(ctx) {
  if (!ctx || isExplicitClear(ctx)) return false;
  if (ctx.isGroup) return true;
  return Boolean(
    ctx.contact?.id ||
    ctx.contactIdentifier ||
    ctx.contactInfo?.name ||
    (Array.isArray(ctx.messages) && ctx.messages.length > 0)
  );
}

function isFreshEnough(ctx) {
  if (!ctx?.timestamp) return false;
  return Date.now() - ctx.timestamp <= MAX_CONTEXT_AGE_MS;
}

function showDefaultEmptyState() {
  $('noContext').classList.remove('hidden');
  $('groupChatNotice').classList.add('hidden');
  $('activeContext').classList.add('hidden');
  $('timelineSection').classList.add('hidden');
}

async function pollContext() {
  const data = await chrome.storage.local.get(CONTEXT_STORAGE_KEYS);
  const ctx = data.current_context;

  hydrateLastKnownContexts(data);
  currentChannel = data.current_channel || currentChannel;

  if (isExplicitClear(ctx)) {
    console.log('[Zazi SP] Context cleared intentionally:', ctx.clearReason || 'unknown');
    const fallback = pickFallbackContext(currentChannel || ctx.channel);
    if (fallback && Date.now() - (fallback.timestamp || 0) <= REFRESH_GRACE_MS) {
      console.log('[Zazi SP] Clear event fallback — keeping last-known-good context', {
        channel: fallback.channel,
      });
      if (!currentContext || currentContext.timestamp !== fallback.timestamp) {
        currentContext = fallback;
        currentChannel = fallback.channel || currentChannel;
        renderContext(fallback);
      }
      return;
    }

    currentContext = null;
    showDefaultEmptyState();
    return;
  }

  if (!isContextPayloadValid(ctx)) {
    const fallback = pickFallbackContext(currentChannel);
    if (fallback) {
      console.log('[Zazi SP] Parse miss ignored — rendering sticky last-known-good context', {
        channel: fallback.channel,
        conversationKey: fallback.conversationKey,
      });
      if (!currentContext || currentContext.timestamp !== fallback.timestamp) {
        currentContext = fallback;
        currentChannel = fallback.channel || currentChannel;
        renderContext(fallback);
      }
      return;
    }

    showDefaultEmptyState();
    return;
  }

  if (!isFreshEnough(ctx)) {
    const fallback = pickFallbackContext(ctx.channel || currentChannel);
    if (fallback && fallback.timestamp !== ctx.timestamp) {
      console.log('[Zazi SP] Stale refresh ignored — showing last-known-good conversation');
      if (!currentContext || currentContext.timestamp !== fallback.timestamp) {
        currentContext = fallback;
        currentChannel = fallback.channel || currentChannel;
        renderContext(fallback);
      }
      return;
    }
  }

  if (currentContext && currentContext.timestamp === ctx.timestamp) return;

  currentContext = ctx;
  currentChannel = ctx.channel || currentChannel;
  rememberLastKnownContext(ctx);

  console.log('[Zazi SP] Valid chat state stored in side panel cache', {
    channel: ctx.channel,
    conversationKey: ctx.conversationKey,
    contact: ctx.contact?.full_name || ctx.contactInfo?.name || ctx.contactIdentifier,
  });

  if (ctx.isGroup) {
    $('noContext').classList.add('hidden');
    $('groupChatNotice').classList.remove('hidden');
    $('activeContext').classList.add('hidden');
    $('timelineSection').classList.add('hidden');
    return;
  }

  $('noContext').classList.add('hidden');
  $('groupChatNotice').classList.add('hidden');
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
  $('contactName').textContent = contact?.full_name || ctx.contactInfo?.name || ctx.contactIdentifier || 'Unknown';

  if (contact) {
    $('noContactMatch').classList.add('hidden');
    $('candidateMatches').classList.add('hidden');
    $('contactType').textContent = contact.lead_type || '';
    $('contactTemp').textContent = contact.lead_temperature || '';
    $('contactStatus').textContent = contact.communication_status || '';
  } else if (ctx.candidateMatches && ctx.candidateMatches.length > 0) {
    $('noContactMatch').classList.add('hidden');
    $('candidateMatches').classList.remove('hidden');
    $('contactType').textContent = '';
    $('contactTemp').textContent = '';
    $('contactStatus').textContent = '';
    renderCandidates(ctx.candidateMatches);
  } else {
    $('noContactMatch').classList.remove('hidden');
    $('candidateMatches').classList.add('hidden');
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

  // Message summary previews
  $('lastInboundPreview').textContent = ctx.lastInboundPreview || '—';
  $('lastOutboundPreview').textContent = ctx.lastOutboundPreview || '—';

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

function renderCandidates(candidates) {
  const list = $('candidateList');
  list.innerHTML = '';
  for (const c of candidates.slice(0, 5)) {
    const btn = document.createElement('button');
    btn.className = 'btn-candidate';
    btn.textContent = `${c.full_name} (${c.phone_number || c.email_address || '—'})`;
    btn.addEventListener('click', () => selectCandidate(c));
    list.appendChild(btn);
  }
}

async function selectCandidate(contact) {
  if (!currentContext) return;
  // Update context with selected contact and re-process
  currentContext.contact = contact;
  currentContext.candidateMatches = [];
  currentContext.timestamp = Date.now();

  const channelKey = getLastKnownContextKey(currentContext.channel || 'whatsapp');
  await chrome.storage.local.set({
    current_channel: currentContext.channel || currentChannel || null,
    current_context: currentContext,
    [channelKey]: currentContext,
  });

  // Save persistent mapping so this contact is reused next time
  const mapKey = `${currentContext.channel}:${(currentContext.contactIdentifier || currentContext.contactInfo?.name || '').trim().toLowerCase()}`;
  if (mapKey && contact.id) {
    await chrome.runtime.sendMessage({
      type: 'SAVE_CONTACT_MAPPING',
      conversationKey: mapKey,
      contactId: contact.id,
    });
  }

  rememberLastKnownContext(currentContext);
  renderContext(currentContext);
  // Force adapter to re-send so background syncs follow-up state
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: 'force_refresh' }).catch(() => {});
  }
}

function renderMessages(messages) {
  const list = $('messagesList');
  list.innerHTML = '';
  for (const msg of messages.slice(-10)) {
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
  if (!currentContext) return;
  const contactName = currentContext.contact?.full_name || currentContext.contactInfo?.name || 'there';
  const res = await chrome.runtime.sendMessage({
    type: 'GENERATE_SUGGESTION',
    params: {
      contactName,
      objective: $('objectiveSelect').value,
      tone: $('toneSelect').value,
      channel: currentContext.channel,
      leadType: currentContext.contact?.lead_type || 'Prospect',
      hasPurchased: currentContext.recommendation?.hasPurchased || false,
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
    flashButton('copyBtn', '✅ Copied!', '📋 Copy');
  }
});

// Insert into active chat
$('insertBtn').addEventListener('click', async () => {
  const text = $('suggestionText').textContent;
  if (!text || text === '—') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: 'insert_message', text });
    flashButton('insertBtn', '✅ Inserted!', '📥 Insert');
  }
});

// Log Activity — creates real CRM activity entry
$('logActivityBtn').addEventListener('click', async () => {
  if (!currentContext) return;
  if (!currentContext.contact?.id) {
    flashButton('logActivityBtn', '⚠️ No contact', '📝 Log', 2000);
    return;
  }
  const rec = currentContext.recommendation || {};
  const activityType = currentContext.channel === 'gmail' ? 'email' : 'whatsapp';
  const res = await chrome.runtime.sendMessage({
    type: 'LOG_ACTIVITY',
    params: {
      contact_id: currentContext.contact.id,
      activity_type: activityType,
      summary: `${currentContext.channel} follow-up: ${rec.badge || rec.action || 'check-in'}`,
      notes: `Reply status: ${currentContext.replyStatus || 'unknown'}. Suggestion: ${$('suggestionText').textContent?.substring(0, 300) || ''}`,
      next_action: rec.reason || '',
    },
  });
  if (res.success) {
    flashButton('logActivityBtn', '✅ Logged!', '📝 Log');
    // Refresh timeline
    if (currentContext.contact?.id) loadTimeline(currentContext.contact.id);
  } else {
    flashButton('logActivityBtn', '❌ Error', '📝 Log', 2000);
  }
});

// Save as draft activity — requires matched contact
$('logDraftBtn').addEventListener('click', async () => {
  if (!currentContext) return;
  if (!currentContext.contact?.id) {
    flashButton('logDraftBtn', '⚠️ No contact', '💾 Draft', 2000);
    return;
  }
  const text = $('suggestionText').textContent;
  const res = await chrome.runtime.sendMessage({
    type: 'LOG_ACTIVITY',
    params: {
      contact_id: currentContext.contact.id,
      activity_type: 'draft',
      summary: `Draft ${currentContext.channel} reply for ${currentContext.contact.full_name}`,
      notes: text?.substring(0, 500) || '',
      next_action: currentContext.recommendation?.action || '',
    },
  });
  if (res.success) {
    flashButton('logDraftBtn', '✅ Saved!', '💾 Draft');
  } else {
    flashButton('logDraftBtn', '❌ Error', '💾 Draft', 2000);
  }
});

// Create contact from extension
$('createContactBtn')?.addEventListener('click', () => {
  const crmUrl = 'https://vanto-zazi-bloom.lovable.app/contacts';
  chrome.tabs.create({ url: crmUrl });
});

// ===== HELPERS =====
function flashButton(id, tempText, originalText, duration = 1500) {
  const btn = $(id);
  if (!btn) return;
  btn.textContent = tempText;
  setTimeout(() => { btn.textContent = originalText; }, duration);
}

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
