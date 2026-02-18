// Content script for WhatsApp Web
// Injects CRM tags (lead temp, lead type, notes) inline next to contact names
// Eazybe-style tagging + inline editing directly in WhatsApp Web

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
    if (name.includes(',') || name.includes('📌') || name.includes('👥')) return;

    const contact = findCrmContact(name);

    const tagsDiv = document.createElement('span');
    tagsDiv.className = 'vz-crm-tags';

    if (contact) {
      // Temperature tag
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

      // Lead type tag
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

      // Notes icon
      const notesIcon = document.createElement('span');
      notesIcon.className = `vz-notes-icon ${contact.additional_notes ? 'has-notes' : ''}`;
      notesIcon.textContent = contact.additional_notes ? '📝' : '📋';
      notesIcon.title = 'Click to view/edit notes';
      notesIcon.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        showEditPanel(e, contact);
      });
      tagsDiv.appendChild(notesIcon);

      // Edit pencil icon
      const editIcon = document.createElement('span');
      editIcon.className = 'vz-edit-icon';
      editIcon.textContent = '✏️';
      editIcon.title = 'Edit contact in CRM';
      editIcon.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        showEditPanel(e, contact);
      });
      tagsDiv.appendChild(editIcon);

    } else {
      // Unmatched: show "+ CRM" button
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

// ===== EDIT PANEL — Full inline editor =====
function showEditPanel(event, contact) {
  closeEditPanel();
  closeDropdown();

  const overlay = document.createElement('div');
  overlay.className = 'vz-edit-overlay';
  overlay.addEventListener('click', closeEditPanel);

  const panel = document.createElement('div');
  panel.className = 'vz-edit-panel';
  panel.id = 'vz-edit-panel';

  // Position near the click
  const rect = event.target.getBoundingClientRect();
  panel.style.top = Math.min(rect.bottom + 8, window.innerHeight - 420) + 'px';
  panel.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';

  // Prevent overlay click from closing when clicking panel
  panel.addEventListener('click', (e) => e.stopPropagation());

  const tempOptions = [
    { value: 'Hot', icon: '🔴' },
    { value: 'Warm', icon: '🟡' },
    { value: 'Cold', icon: '🔵' },
  ];

  const typeOptions = [
    { value: 'Prospect', icon: '🟣' },
    { value: 'Registered_Nopurchase', label: 'Registered', icon: '🔵' },
    { value: 'Purchase_Nostatus', label: 'Purchase (No Status)', icon: '🟢' },
    { value: 'Purchase_Status', label: 'Purchase (Active)', icon: '✅' },
    { value: 'Expired', icon: '⚫' },
  ];

  const currentTemp = (contact.lead_temperature || 'Warm');
  const currentType = (contact.lead_type || 'Prospect');

  panel.innerHTML = `
    <div class="vz-edit-header">
      <span>✏️ Edit Contact</span>
      <span class="vz-edit-close" id="vz-edit-close">✕</span>
    </div>

    <div class="vz-edit-field">
      <label>Full Name</label>
      <input type="text" id="vz-edit-name" value="${escapeHtml(contact.full_name || '')}" />
    </div>

    <div class="vz-edit-field">
      <label>Phone</label>
      <input type="text" id="vz-edit-phone" value="${escapeHtml(contact.phone_number || '')}" />
    </div>

    <div class="vz-edit-field">
      <label>Email</label>
      <input type="email" id="vz-edit-email" value="${escapeHtml(contact.email_address || '')}" />
    </div>

    <div class="vz-edit-field">
      <label>Lead Temperature</label>
      <div class="vz-edit-pills" id="vz-edit-temp">
        ${tempOptions.map(o => `<span class="vz-pill ${currentTemp.toLowerCase() === o.value.toLowerCase() ? 'active' : ''}" data-value="${o.value}">${o.icon} ${o.value}</span>`).join('')}
      </div>
    </div>

    <div class="vz-edit-field">
      <label>Lead Type</label>
      <div class="vz-edit-pills" id="vz-edit-type">
        ${typeOptions.map(o => `<span class="vz-pill ${currentType.toLowerCase() === o.value.toLowerCase() ? 'active' : ''}" data-value="${o.value}">${o.icon} ${o.label || o.value}</span>`).join('')}
      </div>
    </div>

    <div class="vz-edit-field">
      <label>Notes</label>
      <textarea id="vz-edit-notes" rows="3">${escapeHtml(contact.additional_notes || '')}</textarea>
    </div>

    <div class="vz-edit-actions">
      <button class="vz-btn-cancel" id="vz-edit-cancel">Cancel</button>
      <button class="vz-btn-save" id="vz-edit-save">💾 Save to CRM</button>
    </div>

    <div class="vz-edit-status" id="vz-edit-status"></div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Pill selection handlers
  let selectedTemp = currentTemp;
  let selectedType = currentType;

  panel.querySelectorAll('#vz-edit-temp .vz-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      panel.querySelectorAll('#vz-edit-temp .vz-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTemp = pill.dataset.value;
    });
  });

  panel.querySelectorAll('#vz-edit-type .vz-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      panel.querySelectorAll('#vz-edit-type .vz-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedType = pill.dataset.value;
    });
  });

  // Close button
  panel.querySelector('#vz-edit-close').addEventListener('click', closeEditPanel);
  panel.querySelector('#vz-edit-cancel').addEventListener('click', closeEditPanel);

  // Save button
  panel.querySelector('#vz-edit-save').addEventListener('click', async () => {
    const statusEl = panel.querySelector('#vz-edit-status');
    const saveBtn = panel.querySelector('#vz-edit-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    statusEl.textContent = '';

    const updates = {
      full_name: panel.querySelector('#vz-edit-name').value.trim(),
      phone_number: panel.querySelector('#vz-edit-phone').value.trim(),
      email_address: panel.querySelector('#vz-edit-email').value.trim(),
      lead_temperature: selectedTemp,
      lead_type: selectedType,
      additional_notes: panel.querySelector('#vz-edit-notes').value.trim(),
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
        statusEl.textContent = '✅ Saved to CRM!';
        statusEl.style.color = '#4ade80';
        // Refresh tags
        setTimeout(async () => {
          closeEditPanel();
          removeAllTags();
          await fetchCrmContacts();
          injectTags();
        }, 800);
      } else {
        const err = await res.json();
        statusEl.textContent = '❌ ' + (err.message || 'Save failed');
        statusEl.style.color = '#f87171';
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save to CRM';
      }
    } catch (e) {
      statusEl.textContent = '❌ ' + e.message;
      statusEl.style.color = '#f87171';
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save to CRM';
    }
  });
}

function closeEditPanel() {
  document.querySelectorAll('.vz-edit-overlay').forEach(el => el.remove());
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  setInterval(() => injectTags(), 5000);
  setInterval(fetchCrmContacts, 120000);
}

init();
