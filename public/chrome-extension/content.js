// Content script for WhatsApp Web
// Listens for messages from the popup to scrape contacts

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape_contacts') {
    const contacts = scrapeWhatsAppContacts();
    sendResponse({ contacts });
  }
  return true; // keep channel open for async
});

function scrapeWhatsAppContacts() {
  const contacts = [];
  const seen = new Set();

  // WhatsApp Web chat list items — each row has a contact name and sometimes a phone
  const chatRows = document.querySelectorAll('[data-testid="cell-frame-container"]');

  chatRows.forEach((row) => {
    try {
      // Get the contact name from the title span
      const nameEl = row.querySelector('[data-testid="cell-frame-title"] span[title]');
      const name = nameEl?.getAttribute('title')?.trim();
      if (!name) return;

      // Skip group chats (usually have commas or special chars)
      if (name.includes(',') || name.includes('📌')) return;

      // Try to detect if the name is actually a phone number
      const cleanName = name.replace(/[\s\-\(\)\+]/g, '');
      const isPhoneNumber = /^\d{7,15}$/.test(cleanName);

      const contact = {
        name: isPhoneNumber ? name : name,
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

// Also inject a small floating button on WhatsApp Web for quick sync
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
