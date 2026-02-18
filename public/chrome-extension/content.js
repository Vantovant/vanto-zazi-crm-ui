// Content script for WhatsApp Web
// Listens for messages from the popup to scrape contacts

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape_contacts') {
    const contacts = scrapeWhatsAppContacts();
    sendResponse({ contacts });
  }
  return true;
});

function scrapeWhatsAppContacts() {
  const contacts = [];
  const seen = new Set();

  // Strategy 1: Try data-testid selectors (current WhatsApp Web)
  let chatRows = document.querySelectorAll('[data-testid="cell-frame-container"]');
  
  // Strategy 2: Try list item role selectors
  if (!chatRows.length) {
    chatRows = document.querySelectorAll('[role="listitem"]');
  }

  // Strategy 3: Try the chat list pane directly
  if (!chatRows.length) {
    chatRows = document.querySelectorAll('#pane-side [role="row"]');
  }

  // Strategy 4: Broad fallback — any element with a title in the side panel
  if (!chatRows.length) {
    const sidePanel = document.querySelector('#pane-side') || document.querySelector('[data-testid="chat-list"]');
    if (sidePanel) {
      chatRows = sidePanel.querySelectorAll('div[class]');
    }
  }

  chatRows.forEach((row) => {
    try {
      // Try multiple ways to find the contact name
      let name = null;

      // Method 1: cell-frame-title with span[title]
      const titleEl = row.querySelector('[data-testid="cell-frame-title"] span[title]');
      if (titleEl) {
        name = titleEl.getAttribute('title')?.trim();
      }

      // Method 2: Any span with a title attribute inside the row
      if (!name) {
        const anyTitle = row.querySelector('span[title]');
        if (anyTitle) {
          name = anyTitle.getAttribute('title')?.trim();
        }
      }

      // Method 3: Look for specific chat name elements
      if (!name) {
        const chatName = row.querySelector('[data-testid="conversation-info-header-chat-title"]');
        if (chatName) {
          name = chatName.textContent?.trim();
        }
      }

      if (!name || name.length < 2) return;

      // Skip group chats (usually have commas, or group indicators)
      if (name.includes(',') || name.includes('📌') || name.includes('👥')) return;

      // Detect if the name is actually a phone number
      const cleanName = name.replace(/[\s\-\(\)\+]/g, '');
      const isPhoneNumber = /^\d{7,15}$/.test(cleanName);

      const contact = {
        name: name,
        phone: isPhoneNumber ? name : '',
        source: 'whatsapp_web',
      };

      // Deduplicate
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

// Inject a small floating button on WhatsApp Web for quick sync
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

// Wait for WhatsApp to load, then inject
setTimeout(injectSyncButton, 3000);
