/**
 * Zazi Copilot — Popup Controller
 */

console.log('[Zazi Popup] loaded');

const WHATSAPP_URL = 'https://web.whatsapp.com/';
const CRM_URL = 'https://vanto-zazi-bloom.lovable.app/dashboard';

function openOrFocusTab(url, matchPattern) {
  console.log('[Zazi Popup] openOrFocusTab:', url);
  chrome.tabs.query({}, (tabs) => {
    const existing = tabs.find((t) => t.url && t.url.startsWith(matchPattern));
    if (existing) {
      console.log('[Zazi Popup] focusing existing tab:', existing.id);
      chrome.tabs.update(existing.id, { active: true });
      chrome.windows.update(existing.windowId, { focused: true });
    } else {
      console.log('[Zazi Popup] creating new tab');
      chrome.tabs.create({ url });
    }
    window.close();
  });
}

document.getElementById('openWhatsApp').addEventListener('click', () => {
  console.log('[Zazi Popup] WhatsApp button clicked');
  openOrFocusTab(WHATSAPP_URL, 'https://web.whatsapp.com');
});

document.getElementById('openCRM').addEventListener('click', () => {
  console.log('[Zazi Popup] CRM button clicked');
  openOrFocusTab(CRM_URL, 'https://vanto-zazi-bloom.lovable.app');
});

document.getElementById('openSidePanel').addEventListener('click', async () => {
  console.log('[Zazi Popup] Side Panel button clicked');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (err) {
    console.error('[Zazi Popup] sidePanel.open error:', err);
  }
  window.close();
});
