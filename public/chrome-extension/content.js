// Content script for WhatsApp Web
// Listens for messages from the popup to scrape contacts
// Injects CRM tags (lead temp, lead type, notes) into WhatsApp chat list

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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?select=id,full_name,phone_number,lead_temperature,lead_type,additional_notes,interest_level,communication_status`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    if (res.ok) {
      crmContacts = await res.json();
    }
  } catch (e) {
    console.log('[Vanto Zazi] Failed to fetch CRM contacts:', e.message);
  }
}

// ===== Match WhatsApp name to CRM contact =====
function findCrmContact(waName) {
  if (!waName || !crmContacts.length) return null;
  const lower = waName.toLowerCase().trim();
  
  // Try exact name match
  let match = crmContacts.find(c => c.full_name?.toLowerCase().trim() === lower);
  if (match) return match;

  // Try phone match (if waName looks like a phone number)
  const cleanName = waName.replace(/[\s\-\(\)\+]/g, '');
  if (/^\d{7,15}$/.test(cleanName)) {
    match = crmContacts.find(c => {
      const cleanPhone = (c.phone_number || '').replace(/[\s\-\(\)\+]/g, '');
      return cleanPhone && (cleanPhone.includes(cleanName) || cleanName.includes(cleanPhone));
    });
    if (match) return match;
  }

  // Try partial match (first + last name)
  match = crmContacts.find(c => {
    const crmName = c.full_name?.toLowerCase().trim() || '';
    return crmName && (lower.includes(crmName) || crmName.includes(lower));
  });
  return match || null;
}

// ===== Temperature config =====
function getTempConfig(temp) {
  const t = (temp || '').toLowerCase();
  if (t === 'hot') return { label: '🔴 Hot', cls: 'vz-tag-hot' };
  if (t === 'warm') return { label: '🟡 Warm', cls: 'vz-tag-warm' };
  if (t === 'cold') return { label: '🔵 Cold', cls: 'vz-tag-cold' };
  return { label: '⚪ ' + (temp || 'N/A'), cls: 'vz-tag-unknown' };
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

// ===== Inject tags into chat rows =====
function injectTags() {
  // Find chat rows
  let chatRows = document.querySelectorAll('[data-testid="cell-frame-container"]');
  if (!chatRows.length) chatRows = document.querySelectorAll('[role="listitem"]');
  if (!chatRows.length) chatRows = document.querySelectorAll('#pane-side [role="row"]');

  chatRows.forEach((row) => {
    // Skip if already tagged
    if (row.querySelector('.vz-crm-tags')) return;
    // Skip groups
    if (isGroupChat(row)) return;

    // Find contact name
    let name = null;
    const titleEl = row.querySelector('[data-testid="cell-frame-title"] span[title]');
    if (titleEl) name = titleEl.getAttribute('title')?.trim();
    if (!name) {
      const anyTitle = row.querySelector('span[title]');
      if (anyTitle) name = anyTitle.getAttribute('title')?.trim();
    }
    if (!name || name.length < 2) return;

    // Skip groups
    if (name.includes(',') || name.includes('📌') || name.includes('👥')) return;

    const contact = findCrmContact(name);
    if (!contact) return;

    // Create tags container
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'vz-crm-tags';

    // Temperature tag
    const tempConf = getTempConfig(contact.lead_temperature);
    const tempTag = document.createElement('span');
    tempTag.className = `vz-tag ${tempConf.cls}`;
    tempTag.textContent = tempConf.label;
    tempTag.title = 'Click to change temperature';
    tempTag.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
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
      e.stopPropagation();
      e.preventDefault();
      showDropdown(e, contact, 'lead_type');
    });
    tagsDiv.appendChild(typeTag);

    // Notes icon
    const notesIcon = document.createElement('span');
    notesIcon.className = `vz-notes-icon ${contact.additional_notes ? 'has-notes' : ''}`;
    notesIcon.textContent = contact.additional_notes ? '📝' : '📋';
    notesIcon.title = contact.additional_notes || 'No notes';
    notesIcon.addEventListener('mouseenter', (e) => showNotesTooltip(e, contact));
    notesIcon.addEventListener('mouseleave', hideNotesTooltip);
    notesIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    tagsDiv.appendChild(notesIcon);

    // Insert after the title element
    const titleContainer = row.querySelector('[data-testid="cell-frame-title"]');
    if (titleContainer) {
      titleContainer.parentElement.appendChild(tagsDiv);
    } else {
      // Fallback: append to the row
      const firstSpanTitle = row.querySelector('span[title]');
      if (firstSpanTitle && firstSpanTitle.parentElement) {
        firstSpanTitle.parentElement.appendChild(tagsDiv);
      }
    }
  });
}

// ===== Quick-tag Dropdown =====
function showDropdown(event, contact, field) {
  closeDropdown();

  const overlay = document.createElement('div');
  overlay.className = 'vz-dropdown-overlay';
  overlay.addEventListener('click', closeDropdown);

  const dropdown = document.createElement('div');
  dropdown.className = 'vz-dropdown';
  dropdown.id = 'vz-active-dropdown';

  const rect = event.target.getBoundingClientRect();
  dropdown.style.top = (rect.bottom + 4) + 'px';
  dropdown.style.left = rect.left + 'px';

  // Ensure dropdown stays in viewport
  setTimeout(() => {
    const dRect = dropdown.getBoundingClientRect();
    if (dRect.right > window.innerWidth) {
      dropdown.style.left = (window.innerWidth - dRect.width - 8) + 'px';
    }
    if (dRect.bottom > window.innerHeight) {
      dropdown.style.top = (rect.top - dRect.height - 4) + 'px';
    }
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
      // Refresh tags
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

// ===== Notes Tooltip =====
function showNotesTooltip(event, contact) {
  hideNotesTooltip();
  const tooltip = document.createElement('div');
  tooltip.className = 'vz-notes-tooltip';
  tooltip.id = 'vz-notes-tooltip';

  const rect = event.target.getBoundingClientRect();
  tooltip.style.top = (rect.bottom + 6) + 'px';
  tooltip.style.left = rect.left + 'px';

  tooltip.innerHTML = `
    <div class="vz-notes-tooltip-title">📝 Notes — ${contact.full_name}</div>
    <div class="vz-notes-tooltip-body ${contact.additional_notes ? '' : 'vz-notes-tooltip-empty'}">
      ${contact.additional_notes || 'No notes yet. Add notes in the CRM.'}
    </div>
  `;

  document.body.appendChild(tooltip);

  // Reposition if off screen
  setTimeout(() => {
    const tRect = tooltip.getBoundingClientRect();
    if (tRect.right > window.innerWidth) {
      tooltip.style.left = (window.innerWidth - tRect.width - 8) + 'px';
    }
    if (tRect.bottom > window.innerHeight) {
      tooltip.style.top = (rect.top - tRect.height - 6) + 'px';
    }
  }, 0);
}

function hideNotesTooltip() {
  document.querySelectorAll('.vz-notes-tooltip').forEach(el => el.remove());
}

// ===== Remove all injected tags (for refresh) =====
function removeAllTags() {
  document.querySelectorAll('.vz-crm-tags').forEach(el => el.remove());
}

// ===== Check if a chat row is a group =====
function isGroupChat(row) {
  // Group indicators: group metadata, multiple participants
  if (row.querySelector('[data-testid="group-subject"]')) return true;
  if (row.querySelector('[data-icon="default-group"]')) return true;
  if (row.querySelector('[data-icon="community"]')) return true;
  // Check for group avatar icon
  const avatarImg = row.querySelector('[data-testid="cell-frame-primary"] img');
  if (!avatarImg) {
    // No profile pic AND has group-style default icon
    const groupIcon = row.querySelector('[data-testid="default-group"]');
    if (groupIcon) return true;
  }
  return false;
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
      // Skip groups
      if (isGroupChat(row)) return;

      let name = null;
      const titleEl = row.querySelector('[data-testid="cell-frame-title"] span[title]');
      if (titleEl) name = titleEl.getAttribute('title')?.trim();
      if (!name) {
        const anyTitle = row.querySelector('span[title]');
        if (anyTitle) name = anyTitle.getAttribute('title')?.trim();
      }
      if (!name) {
        const chatName = row.querySelector('[data-testid="conversation-info-header-chat-title"]');
        if (chatName) name = chatName.textContent?.trim();
      }
      if (!name || name.length < 2) return;

      // Skip names that look like groups (commas = multiple participants, emojis commonly used for groups)
      if (name.includes(',') || name.includes('📌') || name.includes('👥')) return;

      const cleanName = name.replace(/[\s\-\(\)\+]/g, '');
      const isPhoneNumber = /^\d{7,15}$/.test(cleanName);

      const contact = {
        name: name,
        phone: isPhoneNumber ? name : '',
        source: 'whatsapp_web',
      };

      const key = contact.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        contacts.push(contact);
      }
    } catch (e) {
      // Skip problematic rows
    }
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
    position: fixed; bottom: 20px; right: 20px; z-index: 99999;
    width: 40px; height: 40px; border-radius: 50%;
    background: #1e293b; border: 2px solid #22c55e;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform 0.2s;
  `;
  btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
  btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
  btn.addEventListener('click', () => {
    alert('Click the Vanto Zazi extension icon in your toolbar to sync contacts.');
  });
  document.body.appendChild(btn);
}

// ===== Initialize =====
async function init() {
  // Wait for WhatsApp to load
  await new Promise(r => setTimeout(r, 3000));
  injectSyncButton();

  // Fetch CRM data and inject tags
  await fetchCrmContacts();
  if (crmContacts.length > 0) {
    injectTags();
  }

  // Re-inject tags periodically (WhatsApp re-renders chat list)
  setInterval(async () => {
    if (crmContacts.length === 0) {
      await fetchCrmContacts();
    }
    injectTags();
  }, 5000);

  // Refresh CRM data every 2 minutes
  setInterval(fetchCrmContacts, 120000);
}

init();
