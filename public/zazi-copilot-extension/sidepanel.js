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

// Lead type intelligence map
const LEAD_TYPE_INTEL = {
  'Prospect': { icon: '🎯', label: 'Prospect', color: '#6b7280', hint: 'Prospecting / conversion path' },
  'Registered_Nopurchase': { icon: '📋', label: 'Registered (No Purchase)', color: '#f59e0b', hint: 'Activation / first-purchase follow-up' },
  'Purchase_Nostatus': { icon: '🛒', label: 'Purchase (No Status)', color: '#3b82f6', hint: 'Status follow-up needed' },
  'Purchase_Status': { icon: '✅', label: 'Active (Status)', color: '#22c55e', hint: 'Support / reorder / progression' },
  'Expired': { icon: '⏰', label: 'Expired', color: '#ef4444', hint: 'Reactivation path' },
  'Customer': { icon: '🤝', label: 'Customer', color: '#10b981', hint: 'Support / reorder' },
  'Distributor': { icon: '🌟', label: 'Distributor', color: '#8b5cf6', hint: 'Team support / progression' },
};

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

  // Prefill remembered email
  try {
    const remembered = await chrome.runtime.sendMessage({ type: 'GET_REMEMBERED_EMAIL' });
    if (remembered?.email) {
      $('email').value = remembered.email;
    }
  } catch (e) { /* ignore */ }

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
    const fallback = pickFallbackContext(currentChannel || ctx.channel);
    if (fallback && Date.now() - (fallback.timestamp || 0) <= REFRESH_GRACE_MS) {
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

  // Hide inline create form when re-rendering
  $('inlineCreateForm').classList.add('hidden');

  if (contact) {
    $('noContactMatch').classList.add('hidden');
    $('candidateMatches').classList.add('hidden');

    // Lead type with intelligence
    const lt = contact.lead_type || 'Prospect';
    const intel = LEAD_TYPE_INTEL[lt] || LEAD_TYPE_INTEL['Prospect'];
    $('contactType').textContent = `${intel.icon} ${intel.label}`;
    $('contactType').style.background = `${intel.color}20`;
    $('contactType').style.color = intel.color;
    $('contactTemp').textContent = contact.lead_temperature || '';
    $('contactStatus').textContent = contact.communication_status || '';

    // Lead type intelligence bar
    renderLeadTypeIntel(contact);
  } else if (ctx.candidateMatches && ctx.candidateMatches.length > 0) {
    $('noContactMatch').classList.add('hidden');
    $('candidateMatches').classList.remove('hidden');
    $('leadTypeIntel').classList.add('hidden');
    $('contactType').textContent = '';
    $('contactTemp').textContent = '';
    $('contactStatus').textContent = '';
    renderCandidates(ctx.candidateMatches);
  } else {
    $('noContactMatch').classList.remove('hidden');
    $('candidateMatches').classList.add('hidden');
    $('leadTypeIntel').classList.add('hidden');
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

  if (rec.suggestedTone) $('toneSelect').value = rec.suggestedTone;
  if (rec.suggestedObjective) $('objectiveSelect').value = rec.suggestedObjective;

  // Suggestion
  const sugg = ctx.suggestion;
  if (sugg) {
    const text = ctx.channel === 'whatsapp' ? sugg.whatsapp : sugg.email?.body;
    $('suggestionText').textContent = text || '—';
  }

  renderMessages(ctx.messages || []);

  if (contact?.id) {
    loadTimeline(contact.id);
  } else {
    $('timelineSection').classList.add('hidden');
  }
}

function renderLeadTypeIntel(contact) {
  const el = $('leadTypeIntel');
  if (!contact) { el.classList.add('hidden'); return; }

  const lt = contact.lead_type || 'Prospect';
  const intel = LEAD_TYPE_INTEL[lt] || LEAD_TYPE_INTEL['Prospect'];
  const regStatus = contact.registration_status || 'Not Registered';
  const goStatus = contact.go_status || '';

  let details = [`${intel.icon} ${intel.hint}`];

  if (lt === 'Expired') {
    details.push('⚠️ Account expired — reactivation needed');
  } else if (lt === 'Registered_Nopurchase') {
    details.push('📦 Registered but no purchase yet — help them activate');
  } else if (lt === 'Purchase_Nostatus') {
    details.push('🔄 Has purchased but no active status — follow up on status');
  } else if (lt === 'Purchase_Status') {
    details.push('💪 Active with status — support, reorder, or progression');
  }

  if (regStatus === 'Not Registered') {
    details.push('📝 Not registered yet');
  } else if (regStatus === 'Registered') {
    details.push('✅ Registered');
  } else if (regStatus === 'Activated') {
    details.push('🚀 Activated');
  }

  if (goStatus) {
    details.push(`🏷️ GO Status: ${goStatus}`);
  }

  el.innerHTML = details.map(d => `<div class="intel-line">${d}</div>`).join('');
  el.classList.remove('hidden');
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
  currentContext.contact = contact;
  currentContext.candidateMatches = [];
  currentContext.timestamp = Date.now();

  const channelKey = getLastKnownContextKey(currentContext.channel || 'whatsapp');
  await chrome.storage.local.set({
    current_channel: currentContext.channel || currentChannel || null,
    current_context: currentContext,
    [channelKey]: currentContext,
  });

  // Save persistent mapping
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

// Regenerate suggestion
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

// Log Activity
$('logActivityBtn').addEventListener('click', async () => {
  if (!currentContext) return;
  if (!currentContext.contact?.id) {
    flashButton('logActivityBtn', '⚠️ No contact linked', '📝 Log', 2000);
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
      notes: `Reply status: ${currentContext.replyStatus || 'unknown'}. Lead type: ${currentContext.contact.lead_type || 'unknown'}. Suggestion: ${$('suggestionText').textContent?.substring(0, 300) || ''}`,
      next_action: rec.reason || '',
    },
  });
  if (res.success) {
    flashButton('logActivityBtn', '✅ Logged!', '📝 Log');
    if (currentContext.contact?.id) loadTimeline(currentContext.contact.id);
  } else {
    flashButton('logActivityBtn', '❌ Error', '📝 Log', 2000);
  }
});

// Save as draft
$('logDraftBtn').addEventListener('click', async () => {
  if (!currentContext) return;
  if (!currentContext.contact?.id) {
    flashButton('logDraftBtn', '⚠️ No contact linked', '💾 Draft', 2000);
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

// ===== INLINE CREATE CONTACT =====
$('createContactBtn')?.addEventListener('click', () => {
  // Show inline form, prefill from context
  $('noContactMatch').classList.add('hidden');
  $('inlineCreateForm').classList.remove('hidden');
  $('createError').classList.add('hidden');

  // Prefill
  const ctx = currentContext;
  if (ctx) {
    $('createName').value = ctx.contactInfo?.name || ctx.contactIdentifier || '';
    $('createPhone').value = ctx.contactInfo?.phone || (ctx.channel === 'whatsapp' ? ctx.contactIdentifier || '' : '');
    $('createEmail').value = ctx.contactInfo?.email || (ctx.channel === 'gmail' ? ctx.contactIdentifier || '' : '');
    $('createLeadType').value = 'Prospect';
  }
});

$('cancelCreateBtn')?.addEventListener('click', () => {
  $('inlineCreateForm').classList.add('hidden');
  $('noContactMatch').classList.remove('hidden');
});

$('submitCreateBtn')?.addEventListener('click', async () => {
  const name = $('createName').value.trim();
  const phone = $('createPhone').value.trim();
  const email = $('createEmail').value.trim();
  const leadType = $('createLeadType').value;

  if (!name) {
    $('createError').textContent = 'Name is required';
    $('createError').classList.remove('hidden');
    return;
  }

  $('submitCreateBtn').disabled = true;
  $('submitCreateBtn').textContent = 'Creating...';
  $('createError').classList.add('hidden');

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'CREATE_CONTACT',
      params: {
        full_name: name,
        phone_number: phone,
        email_address: email,
        lead_type: leadType,
      },
    });

    if (res.success && res.contact) {
      console.log('[Zazi SP] Contact created:', res.contact.id, res.contact.full_name);

      // Link to current conversation
      if (currentContext) {
        currentContext.contact = res.contact;
        currentContext.candidateMatches = [];
        currentContext.timestamp = Date.now();

        const channelKey = getLastKnownContextKey(currentContext.channel || 'whatsapp');
        await chrome.storage.local.set({
          current_channel: currentContext.channel || currentChannel,
          current_context: currentContext,
          [channelKey]: currentContext,
        });

        // Save persistent mapping
        const mapKeys = [
          `${currentContext.channel}:${(currentContext.contactIdentifier || '').trim().toLowerCase()}`,
          `${currentContext.channel}:${(currentContext.contactInfo?.name || '').trim().toLowerCase()}`,
        ].filter(k => k !== `${currentContext.channel}:`);

        for (const mk of mapKeys) {
          await chrome.runtime.sendMessage({
            type: 'SAVE_CONTACT_MAPPING',
            conversationKey: mk,
            contactId: res.contact.id,
          });
        }

        rememberLastKnownContext(currentContext);
        $('inlineCreateForm').classList.add('hidden');
        renderContext(currentContext);

        // Force adapter to re-send
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { action: 'force_refresh' }).catch(() => {});
        }
      }
    } else {
      $('createError').textContent = res.error || 'Failed to create contact';
      $('createError').classList.remove('hidden');
    }
  } catch (err) {
    $('createError').textContent = 'Error: ' + err.message;
    $('createError').classList.remove('hidden');
  }

  $('submitCreateBtn').disabled = false;
  $('submitCreateBtn').textContent = 'Create & Link';
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
