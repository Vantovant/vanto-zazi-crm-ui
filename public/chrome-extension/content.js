// Content script for WhatsApp Web
// Injects CRM tags inline + Eazybe-style right sidebar, filter toolbar, and AI suggestion bar

const SUPABASE_URL = 'https://urfyfuakgabieellbuce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZnlmdWFrZ2FiaWVlbGxidWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDE2NjcsImV4cCI6MjA4NjIxNzY2N30.4JaSzSQUsz0__rAqTLFc5W3sJUkayahwAHHLf0zUDAk';

let crmContacts = [];
let accessToken = null;

// ===== Message listener for popup =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape_contacts') {
    const contacts = scrapeWhatsAppContacts();
    sendResponse({ contacts });
  }
  return true;
});

// ===== Fetch CRM contacts =====
async function fetchCrmContacts() {
  const data = await chrome.storage.local.get('access_token');
  accessToken = data.access_token;
  if (!accessToken) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?select=id,full_name,phone_number,email_address,lead_temperature,lead_type,additional_notes,interest_level,communication_status`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    if (res.ok) {
      crmContacts = await res.json();
      console.log(`[Vanto Zazi] Loaded ${crmContacts.length} CRM contacts`);
    }
  } catch (e) {
    console.log('[Vanto Zazi] Failed to fetch CRM contacts:', e.message);
  }
}

// ===== Match WhatsApp name to CRM contact =====
function findCrmContact(waName) {
  if (!waName || !crmContacts.length) return null;
  const lower = waName.toLowerCase().trim();

  let match = crmContacts.find(c => c.full_name?.toLowerCase().trim() === lower);
  if (match) return match;

  const cleanName = waName.replace(/[\s\-\(\)\+]/g, '');
  if (/^\d{7,15}$/.test(cleanName)) {
    match = crmContacts.find(c => {
      const cleanPhone = (c.phone_number || '').replace(/[\s\-\(\)\+]/g, '');
      return cleanPhone && (cleanPhone.includes(cleanName) || cleanName.includes(cleanPhone));
    });
    if (match) return match;
  }

  match = crmContacts.find(c => {
    const crmName = c.full_name?.toLowerCase().trim() || '';
    return crmName && crmName.length > 3 && (lower.includes(crmName) || crmName.includes(lower));
  });
  return match || null;
}

// ===== Temperature config =====
function getTempConfig(temp) {
  const t = (temp || '').toLowerCase();
  if (t === 'hot') return { label: '🔴 Hot', cls: 'vz-tag-hot' };
  if (t === 'warm') return { label: '🟡 Warm', cls: 'vz-tag-warm' };
  if (t === 'cold') return { label: '🔵 Cold', cls: 'vz-tag-cold' };
  return { label: '⚪ N/A', cls: 'vz-tag-unknown' };
}

// ===== Lead type config =====
function getTypeConfig(type) {
  const t = (type || '').toLowerCase();
  if (t === 'prospect') return { label: 'Prospect', cls: 'vz-tag-prospect' };
  if (t.includes('registered') || t === 'registered_nopurchase') return { label: 'Registered', cls: 'vz-tag-registered' };
  if (t.includes('purchase') || t === 'purchase_nostatus' || t === 'purchase_status') return { label: 'Purchase', cls: 'vz-tag-purchase' };
  if (t === 'expired') return { label: 'Expired', cls: 'vz-tag-expired' };
  return { label: type || 'Unknown', cls: 'vz-tag-unknown' };
}

// ===== Check if a chat row is a group =====
function isGroupChat(row) {
  if (row.querySelector('[data-testid="group-subject"]')) return true;
  if (row.querySelector('[data-icon="default-group"]')) return true;
  if (row.querySelector('[data-icon="community"]')) return true;
  if (row.querySelector('[data-testid="default-group"]')) return true;
  if (row.querySelector('[data-icon="default-group-large"]')) return true;
  if (row.querySelector('[data-icon="group"]')) return true;
  const avatars = row.querySelectorAll('img[draggable="false"]');
  if (avatars.length > 1) return true;
  return false;
}

// ===== Inject tags INLINE next to name =====
function injectTags() {
  let chatRows = document.querySelectorAll('[data-testid="cell-frame-container"]');
  if (!chatRows.length) chatRows = document.querySelectorAll('[role="listitem"]');
  if (!chatRows.length) chatRows = document.querySelectorAll('#pane-side [role="row"]');

  chatRows.forEach((row) => {
    if (row.querySelector('.vz-crm-tags')) return;
    if (isGroupChat(row)) return;

    let name = null;
    let titleSpan = row.querySelector('[data-testid="cell-frame-title"] span[title]');
    if (titleSpan) name = titleSpan.getAttribute('title')?.trim();
    if (!name) {
      titleSpan = row.querySelector('span[title]');
      if (titleSpan) name = titleSpan.getAttribute('title')?.trim();
    }
    if (!name || name.length < 2) return;
    if (name.includes(',') || name.includes('📌') || name.includes('👥') || name.includes('🏠') || name.includes('🏢')) return;

    const contact = findCrmContact(name);

    const tagsDiv = document.createElement('span');
    tagsDiv.className = 'vz-crm-tags';

    if (contact) {
      const tempConf = getTempConfig(contact.lead_temperature);
      const tempTag = document.createElement('span');
      tempTag.className = `vz-tag ${tempConf.cls}`;
      tempTag.textContent = tempConf.label;
      tempTag.title = 'Click to change temperature';
      tempTag.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        showDropdown(e, contact, 'temperature');
      });
      tagsDiv.appendChild(tempTag);

      const typeConf = getTypeConfig(contact.lead_type);
      const typeTag = document.createElement('span');
      typeTag.className = `vz-tag ${typeConf.cls}`;
      typeTag.textContent = typeConf.label;
      typeTag.title = 'Click to change lead type';
      typeTag.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        showDropdown(e, contact, 'lead_type');
      });
      tagsDiv.appendChild(typeTag);

      const notesIcon = document.createElement('span');
      notesIcon.className = `vz-notes-icon ${contact.additional_notes ? 'has-notes' : ''}`;
      notesIcon.textContent = contact.additional_notes ? '📝' : '📋';
      notesIcon.title = 'Click to view/edit notes';
      notesIcon.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        showSidebarPanel(contact);
      });
      tagsDiv.appendChild(notesIcon);

      const editIcon = document.createElement('span');
      editIcon.className = 'vz-edit-icon';
      editIcon.textContent = '✏️';
      editIcon.title = 'Edit contact in CRM';
      editIcon.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        showSidebarPanel(contact);
      });
      tagsDiv.appendChild(editIcon);

    } else {
      const addBtn = document.createElement('span');
      addBtn.className = 'vz-add-btn';
      addBtn.textContent = '➕ CRM';
      addBtn.title = 'Add this contact to your CRM';
      addBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); e.preventDefault();
        await quickAddContact(name);
      });
      tagsDiv.appendChild(addBtn);
    }

    if (titleSpan) {
      titleSpan.parentElement.style.overflow = 'visible';
      titleSpan.parentElement.style.display = 'flex';
      titleSpan.parentElement.style.alignItems = 'center';
      titleSpan.after(tagsDiv);
    }
  });
}

// ===== RIGHT-SIDE CONTACT PANEL (Eazybe style) =====
function showSidebarPanel(contact) {
  closeSidebarPanel();
  closeDropdown();

  const panel = document.createElement('div');
  panel.className = 'vz-sidebar-panel';
  panel.id = 'vz-sidebar-panel';

  const initials = (contact.full_name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  panel.innerHTML = `
    <div class="vz-sidebar-header">
      <span class="vz-sidebar-header-title">👤 Vanto Zazi CRM</span>
      <button class="vz-sidebar-close" id="vz-sidebar-close">✕</button>
    </div>

    <div class="vz-sidebar-tabs">
      <button class="vz-sidebar-tab active" data-tab="personal">Personal</button>
      <button class="vz-sidebar-tab" data-tab="shared">Shared</button>
    </div>

    <div class="vz-sidebar-icons">
      <button class="vz-sidebar-icon-btn active" title="Contact Info">👤</button>
      <button class="vz-sidebar-icon-btn" title="Notes">📝</button>
      <button class="vz-sidebar-icon-btn" title="Activities">📅</button>
      <button class="vz-sidebar-icon-btn" title="Labels">🏷️</button>
    </div>

    <div class="vz-sidebar-avatar">
      <div class="vz-sidebar-avatar-img">${initials}</div>
      <button class="vz-sidebar-copy-btn" title="Copy contact info">📋</button>
    </div>

    <div class="vz-sidebar-body">
      <div class="vz-sidebar-field">
        <div class="vz-sidebar-field-row">
          <span class="vz-sidebar-field-icon">≡</span>
          <span class="vz-sidebar-field-label">Name</span>
          <input class="vz-sidebar-field-input" id="vz-sb-name" value="${escapeHtml(contact.full_name || '')}" />
        </div>
      </div>

      <div class="vz-sidebar-field">
        <div class="vz-sidebar-field-row">
          <span class="vz-sidebar-field-icon">📞</span>
          <span class="vz-sidebar-field-label">Phone</span>
          <input class="vz-sidebar-field-input" id="vz-sb-phone" value="${escapeHtml(contact.phone_number || '')}" />
        </div>
      </div>

      <div class="vz-sidebar-field">
        <div class="vz-sidebar-field-row">
          <span class="vz-sidebar-field-icon">@</span>
          <span class="vz-sidebar-field-label">Email</span>
          <input class="vz-sidebar-field-input" id="vz-sb-email" value="${escapeHtml(contact.email_address || '')}" />
        </div>
      </div>

      <div class="vz-sidebar-field">
        <div class="vz-sidebar-field-row">
          <span class="vz-sidebar-field-icon">⊙</span>
          <span class="vz-sidebar-field-label">Priority</span>
          <select class="vz-sidebar-field-select" id="vz-sb-temp">
            <option value="Hot" ${contact.lead_temperature === 'Hot' ? 'selected' : ''}>🔴 Hot</option>
            <option value="Warm" ${contact.lead_temperature === 'Warm' ? 'selected' : ''}>🟡 Warm</option>
            <option value="Cold" ${contact.lead_temperature === 'Cold' ? 'selected' : ''}>🔵 Cold</option>
          </select>
        </div>
      </div>

      <div class="vz-sidebar-field">
        <div class="vz-sidebar-field-row">
          <span class="vz-sidebar-field-icon">🏷️</span>
          <span class="vz-sidebar-field-label">Type</span>
          <select class="vz-sidebar-field-select" id="vz-sb-type">
            <option value="Prospect" ${contact.lead_type === 'Prospect' ? 'selected' : ''}>Prospect</option>
            <option value="Registered_Nopurchase" ${contact.lead_type === 'Registered_Nopurchase' ? 'selected' : ''}>Registered</option>
            <option value="Purchase_Nostatus" ${contact.lead_type === 'Purchase_Nostatus' ? 'selected' : ''}>Purchase (No Status)</option>
            <option value="Purchase_Status" ${contact.lead_type === 'Purchase_Status' ? 'selected' : ''}>Purchase (Active)</option>
            <option value="Expired" ${contact.lead_type === 'Expired' ? 'selected' : ''}>Expired</option>
          </select>
        </div>
      </div>

      <div class="vz-sidebar-field">
        <div class="vz-sidebar-field-row">
          <span class="vz-sidebar-field-icon">📝</span>
          <span class="vz-sidebar-field-label">Notes</span>
        </div>
        <textarea class="vz-sidebar-field-input" id="vz-sb-notes" rows="3" style="width:100%;margin-top:6px;border:1px solid #e5e7eb;border-radius:6px;padding:8px;resize:vertical;">${escapeHtml(contact.additional_notes || '')}</textarea>
      </div>

      <div class="vz-sidebar-add-prop">+ Add a new property</div>

      <button class="vz-sidebar-save" id="vz-sb-save">Save</button>
      <div class="vz-sidebar-status" id="vz-sb-status"></div>
    </div>
  `;

  document.body.appendChild(panel);

  // Close
  panel.querySelector('#vz-sidebar-close').addEventListener('click', closeSidebarPanel);

  // Tab switching (visual only)
  panel.querySelectorAll('.vz-sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.vz-sidebar-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Icon switching (visual only)
  panel.querySelectorAll('.vz-sidebar-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.vz-sidebar-icon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Copy contact info
  panel.querySelector('.vz-sidebar-copy-btn').addEventListener('click', () => {
    const info = `${contact.full_name || ''}\n${contact.phone_number || ''}\n${contact.email_address || ''}`.trim();
    navigator.clipboard.writeText(info).then(() => {
      panel.querySelector('.vz-sidebar-copy-btn').textContent = '✅';
      setTimeout(() => panel.querySelector('.vz-sidebar-copy-btn').textContent = '📋', 1500);
    });
  });

  // Save
  panel.querySelector('#vz-sb-save').addEventListener('click', async () => {
    const saveBtn = panel.querySelector('#vz-sb-save');
    const statusEl = panel.querySelector('#vz-sb-status');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const updates = {
      full_name: panel.querySelector('#vz-sb-name').value.trim(),
      phone_number: panel.querySelector('#vz-sb-phone').value.trim(),
      email_address: panel.querySelector('#vz-sb-email').value.trim(),
      lead_temperature: panel.querySelector('#vz-sb-temp').value,
      lead_type: panel.querySelector('#vz-sb-type').value,
      additional_notes: panel.querySelector('#vz-sb-notes').value.trim(),
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${contact.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        statusEl.textContent = '✅ Saved!';
        statusEl.style.color = '#16a34a';
        setTimeout(async () => {
          closeSidebarPanel();
          removeAllTags();
          await fetchCrmContacts();
          injectTags();
        }, 800);
      } else {
        const err = await res.json();
        statusEl.textContent = '❌ ' + (err.message || 'Save failed');
        statusEl.style.color = '#dc2626';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    } catch (e) {
      statusEl.textContent = '❌ ' + e.message;
      statusEl.style.color = '#dc2626';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });
}

function closeSidebarPanel() {
  document.querySelectorAll('.vz-sidebar-panel').forEach(el => el.remove());
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== TOP FILTER TOOLBAR (Eazybe style) =====
function injectFilterToolbar() {
  if (document.getElementById('vz-filter-toolbar')) return;

  const sidePane = document.querySelector('#pane-side');
  if (!sidePane) return;

  // Count chats
  let chatRows = document.querySelectorAll('[data-testid="cell-frame-container"]');
  if (!chatRows.length) chatRows = document.querySelectorAll('[role="listitem"]');
  
  let totalCount = 0;
  let groupCount = 0;
  let oneOnOneCount = 0;

  chatRows.forEach(row => {
    totalCount++;
    if (isGroupChat(row)) {
      groupCount++;
    } else {
      oneOnOneCount++;
    }
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'vz-filter-toolbar';
  toolbar.id = 'vz-filter-toolbar';

  toolbar.innerHTML = `
    <button class="vz-filter-btn active" data-filter="all">All <span class="vz-filter-count">${totalCount}</span></button>
    <span class="vz-filter-separator"></span>
    <button class="vz-filter-btn" data-filter="unread">Unread</button>
    <span class="vz-filter-separator"></span>
    <button class="vz-filter-btn" data-filter="groups">Groups <span class="vz-filter-count">${groupCount}</span></button>
    <span class="vz-filter-separator"></span>
    <button class="vz-filter-btn" data-filter="1on1">1:1 <span class="vz-filter-count">${oneOnOneCount}</span></button>
    <span class="vz-status-dot"></span>
  `;

  // Insert before the chat list
  sidePane.parentElement.insertBefore(toolbar, sidePane);

  // Filter click handlers
  toolbar.querySelectorAll('.vz-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('.vz-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });
}

function applyFilter(filter) {
  let chatRows = document.querySelectorAll('[data-testid="cell-frame-container"]');
  if (!chatRows.length) chatRows = document.querySelectorAll('[role="listitem"]');

  chatRows.forEach(row => {
    const listItem = row.closest('[role="listitem"]') || row.closest('[data-testid="list-item"]') || row;
    const isGroup = isGroupChat(row);

    switch (filter) {
      case 'all':
        listItem.style.display = '';
        break;
      case 'groups':
        listItem.style.display = isGroup ? '' : 'none';
        break;
      case '1on1':
        listItem.style.display = isGroup ? 'none' : '';
        break;
      case 'unread':
        const hasUnread = row.querySelector('[data-testid="icon-unread-count"]') || 
                          row.querySelector('span[aria-label*="unread"]') ||
                          row.querySelector('.x1rg5ohu');
        listItem.style.display = hasUnread ? '' : 'none';
        break;
    }
  });
}

// ===== AI SUGGESTION BAR =====
function injectAISuggestionBar() {
  if (document.getElementById('vz-ai-bar')) return;

  // Find the chat footer / input area
  const footer = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                 document.querySelector('footer') ||
                 document.querySelector('[data-testid="compose-box"]');
  if (!footer) return;

  const chatPane = footer.closest('[data-testid="conversation-panel-wrapper"]') || 
                   footer.closest('#main') || 
                   footer.parentElement?.parentElement;
  if (!chatPane) return;

  // Get current active contact
  const headerName = document.querySelector('#main header span[title]')?.getAttribute('title')?.trim();
  if (!headerName) return;

  const contact = findCrmContact(headerName);
  if (!contact) return;

  const bar = document.createElement('div');
  bar.className = 'vz-ai-bar';
  bar.id = 'vz-ai-bar';

  const tempLabel = contact.lead_temperature ? `${contact.lead_temperature} lead` : 'contact';

  bar.innerHTML = `
    <span class="vz-ai-bar-icon">✨</span>
    <span class="vz-ai-bar-label">AI :</span>
    <span class="vz-ai-bar-text" id="vz-ai-suggestion" title="Click to copy suggestion">Tap to generate a message for this ${tempLabel}</span>
    <div class="vz-ai-bar-actions">
      <button class="vz-ai-bar-action" id="vz-ai-refresh" title="Generate new suggestion">🔄</button>
      <button class="vz-ai-bar-action" id="vz-ai-edit" title="Edit suggestion">✏️</button>
      <button class="vz-ai-bar-action" id="vz-ai-copy" title="Copy to clipboard">📋</button>
    </div>
  `;

  // Position the bar relative to the compose area
  const composeParent = footer.closest('footer') || footer.parentElement;
  if (composeParent) {
    composeParent.style.position = 'relative';
    composeParent.insertBefore(bar, composeParent.firstChild);
  }

  // Generate suggestion on click
  bar.querySelector('#vz-ai-suggestion').addEventListener('click', () => generateAISuggestion(contact));
  bar.querySelector('#vz-ai-refresh').addEventListener('click', () => generateAISuggestion(contact));

  // Copy to clipboard
  bar.querySelector('#vz-ai-copy').addEventListener('click', () => {
    const text = bar.querySelector('#vz-ai-suggestion').textContent;
    navigator.clipboard.writeText(text).then(() => {
      bar.querySelector('#vz-ai-copy').textContent = '✅';
      setTimeout(() => bar.querySelector('#vz-ai-copy').textContent = '📋', 1500);
    });
  });

  // Paste into input
  bar.querySelector('#vz-ai-edit').addEventListener('click', () => {
    const text = bar.querySelector('#vz-ai-suggestion').textContent;
    const input = document.querySelector('[data-testid="conversation-compose-box-input"]');
    if (input) {
      input.focus();
      document.execCommand('insertText', false, text);
    }
  });
}

async function generateAISuggestion(contact) {
  const suggestionEl = document.getElementById('vz-ai-suggestion');
  if (!suggestionEl) return;

  suggestionEl.textContent = 'Generating...';
  suggestionEl.style.background = '#9ca3af';

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/zazi-copilot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'suggest_message',
        contactData: {
          full_name: contact.full_name,
          lead_temperature: contact.lead_temperature,
          lead_type: contact.lead_type,
          communication_status: contact.communication_status,
          additional_notes: contact.additional_notes,
          interest_level: contact.interest_level,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const suggestion = data.reply || data.message || 'Could not generate suggestion';
      suggestionEl.textContent = suggestion;
      suggestionEl.style.background = '#22c55e';
    } else {
      suggestionEl.textContent = 'Failed to generate — click to retry';
      suggestionEl.style.background = '#ef4444';
      setTimeout(() => { suggestionEl.style.background = '#22c55e'; }, 2000);
    }
  } catch (e) {
    suggestionEl.textContent = 'Error — click to retry';
    suggestionEl.style.background = '#ef4444';
    setTimeout(() => { suggestionEl.style.background = '#22c55e'; }, 2000);
  }
}

// ===== Quick-add contact to CRM from WhatsApp =====
async function quickAddContact(name) {
  if (!accessToken) {
    console.log('[Vanto Zazi] Not logged in');
    return;
  }

  const cleanName = name.replace(/[\s\-\(\)\+]/g, '');
  const phone = /^\d{7,15}$/.test(cleanName) ? name : '';

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        full_name: name,
        phone_number: phone,
        lead_type: 'Prospect',
        lead_temperature: 'Warm',
        communication_status: 'New',
        additional_notes: 'Added from WhatsApp Web',
      }),
    });

    if (res.ok) {
      removeAllTags();
      await fetchCrmContacts();
      injectTags();
    }
  } catch (e) {
    console.log('[Vanto Zazi] Error adding contact:', e.message);
  }
}

// ===== Quick-tag Dropdown =====
function showDropdown(event, contact, field) {
  closeDropdown();

  const overlay = document.createElement('div');
  overlay.className = 'vz-dropdown-overlay';
  overlay.addEventListener('click', closeDropdown);

  const dropdown = document.createElement('div');
  dropdown.className = 'vz-dropdown';

  const rect = event.target.getBoundingClientRect();
  dropdown.style.top = (rect.bottom + 4) + 'px';
  dropdown.style.left = rect.left + 'px';

  setTimeout(() => {
    const dRect = dropdown.getBoundingClientRect();
    if (dRect.right > window.innerWidth) dropdown.style.left = (window.innerWidth - dRect.width - 8) + 'px';
    if (dRect.bottom > window.innerHeight) dropdown.style.top = (rect.top - dRect.height - 4) + 'px';
  }, 0);

  let options = [];
  let currentValue = '';

  if (field === 'temperature') {
    dropdown.innerHTML = '<div class="vz-dropdown-header">Lead Temperature</div>';
    currentValue = (contact.lead_temperature || '').toLowerCase();
    options = [
      { value: 'Hot', icon: '🔴', label: 'Hot' },
      { value: 'Warm', icon: '🟡', label: 'Warm' },
      { value: 'Cold', icon: '🔵', label: 'Cold' },
    ];
  } else if (field === 'lead_type') {
    dropdown.innerHTML = '<div class="vz-dropdown-header">Lead Type</div>';
    currentValue = (contact.lead_type || '').toLowerCase();
    options = [
      { value: 'Prospect', icon: '🟣', label: 'Prospect' },
      { value: 'Registered_Nopurchase', icon: '🔵', label: 'Registered (No Purchase)' },
      { value: 'Purchase_Nostatus', icon: '🟢', label: 'Purchase (No Status)' },
      { value: 'Purchase_Status', icon: '✅', label: 'Purchase (Active Status)' },
      { value: 'Expired', icon: '⚫', label: 'Expired' },
    ];
  }

  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = `vz-dropdown-item ${currentValue === opt.value.toLowerCase() ? 'active' : ''}`;
    item.innerHTML = `<span>${opt.icon}</span> ${opt.label}`;
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      await updateContactField(contact.id, field === 'temperature' ? 'lead_temperature' : 'lead_type', opt.value);
      closeDropdown();
      removeAllTags();
      await fetchCrmContacts();
      injectTags();
    });
    dropdown.appendChild(item);
  });

  overlay.appendChild(dropdown);
  document.body.appendChild(overlay);
}

function closeDropdown() {
  document.querySelectorAll('.vz-dropdown-overlay').forEach(el => el.remove());
}

// ===== Update contact in CRM =====
async function updateContactField(contactId, field, value) {
  if (!accessToken) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${contactId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ [field]: value }),
    });
  } catch (e) {
    console.log('[Vanto Zazi] Failed to update contact:', e.message);
  }
}

// ===== Remove all injected tags =====
function removeAllTags() {
  document.querySelectorAll('.vz-crm-tags').forEach(el => el.remove());
}

// ===== Scrape contacts (for popup sync) =====
function scrapeWhatsAppContacts() {
  const contacts = [];
  const seen = new Set();

  let chatRows = document.querySelectorAll('[data-testid="cell-frame-container"]');
  if (!chatRows.length) chatRows = document.querySelectorAll('[role="listitem"]');
  if (!chatRows.length) chatRows = document.querySelectorAll('#pane-side [role="row"]');
  if (!chatRows.length) {
    const sidePanel = document.querySelector('#pane-side') || document.querySelector('[data-testid="chat-list"]');
    if (sidePanel) chatRows = sidePanel.querySelectorAll('div[class]');
  }

  chatRows.forEach((row) => {
    try {
      if (isGroupChat(row)) return;
      let name = null;
      const titleEl = row.querySelector('[data-testid="cell-frame-title"] span[title]');
      if (titleEl) name = titleEl.getAttribute('title')?.trim();
      if (!name) {
        const anyTitle = row.querySelector('span[title]');
        if (anyTitle) name = anyTitle.getAttribute('title')?.trim();
      }
      if (!name || name.length < 2) return;
      if (name.includes(',') || name.includes('📌') || name.includes('👥')) return;

      const cleanName = name.replace(/[\s\-\(\)\+]/g, '');
      const isPhoneNumber = /^\d{7,15}$/.test(cleanName);
      const contact = { name, phone: isPhoneNumber ? name : '', source: 'whatsapp_web' };
      const key = contact.name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); contacts.push(contact); }
    } catch (e) { /* skip */ }
  });

  return contacts;
}

// ===== Inject floating sync button =====
function injectSyncButton() {
  if (document.getElementById('vanto-zazi-sync-btn')) return;
  const btn = document.createElement('div');
  btn.id = 'vanto-zazi-sync-btn';
  btn.innerHTML = '🟢';
  btn.title = 'Vanto Zazi CRM — Click extension icon to sync';
  btn.style.cssText = `
    position: fixed; bottom: 20px; left: 20px; z-index: 99999;
    width: 40px; height: 40px; border-radius: 50%;
    background: #1e293b; border: 2px solid #22c55e;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform 0.2s;
  `;
  btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
  btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
  btn.addEventListener('click', () => alert('Click the Vanto Zazi extension icon in your toolbar to sync contacts.'));
  document.body.appendChild(btn);
}

// ===== Initialize =====
async function init() {
  await new Promise(r => setTimeout(r, 3000));
  injectSyncButton();
  await fetchCrmContacts();
  injectTags();
  injectFilterToolbar();

  // Re-inject on DOM changes
  setInterval(() => {
    injectTags();
    injectAISuggestionBar();
  }, 5000);

  // Refresh filter counts periodically
  setInterval(() => {
    const existing = document.getElementById('vz-filter-toolbar');
    if (existing) existing.remove();
    injectFilterToolbar();
  }, 30000);

  setInterval(fetchCrmContacts, 120000);
}

init();
