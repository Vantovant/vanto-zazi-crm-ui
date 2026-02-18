// ===== CONFIGURATION =====
// Update this to your Lovable project's Supabase URL
const SUPABASE_URL = 'https://urfyfuakgabieellbuce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZnlmdWFrZ2FiaWVlbGxidWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDE2NjcsImV4cCI6MjA4NjIxNzY2N30.4JaSzSQUsz0__rAqTLFc5W3sJUkayahwAHHLf0zUDAk';

const $ = (id) => document.getElementById(id);

// Check stored session on load
chrome.storage.local.get(['access_token', 'user_email'], (data) => {
  if (data.access_token) {
    showConnected(data.user_email);
  }
});

// Login
$('loginBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const password = $('password').value.trim();
  if (!email || !password) return;

  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'Connecting...';

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.access_token) {
      chrome.storage.local.set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_email: data.user?.email || email,
      });
      showConnected(data.user?.email || email);
    } else {
      alert(data.error_description || data.msg || 'Login failed');
    }
  } catch (err) {
    alert('Connection error: ' + err.message);
  }

  $('loginBtn').disabled = false;
  $('loginBtn').textContent = 'Connect to CRM';
});

// Sync contacts
$('syncBtn').addEventListener('click', async () => {
  $('syncBtn').disabled = true;
  $('syncBtn').textContent = 'Scanning WhatsApp...';
  $('syncResult').classList.add('hidden');

  try {
    // Ask the content script to scrape contacts from WhatsApp Web
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url?.includes('web.whatsapp.com')) {
      alert('Please open WhatsApp Web first, then click Sync.');
      $('syncBtn').disabled = false;
      $('syncBtn').textContent = 'Sync WhatsApp Contacts';
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape_contacts' });
    const contacts = response?.contacts || [];

    if (contacts.length === 0) {
      $('syncResult').textContent = 'No contacts found. Make sure WhatsApp Web is fully loaded.';
      $('syncResult').classList.remove('hidden');
      $('syncBtn').disabled = false;
      $('syncBtn').textContent = 'Sync WhatsApp Contacts';
      return;
    }

    $('syncBtn').textContent = `Syncing ${contacts.length} contacts...`;

    // Send to CRM API
    const { access_token } = await chrome.storage.local.get('access_token');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({ action: 'sync_contacts', contacts }),
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    $('statCreated').textContent = data.created?.length || 0;
    $('statMatched').textContent = data.matched?.length || 0;
    $('syncStats').style.display = 'grid';

    const msg = `✅ Synced! ${data.created?.length || 0} new contacts added, ${data.matched?.length || 0} already existed.`;
    $('syncResult').textContent = msg;
    $('syncResult').classList.remove('hidden');
  } catch (err) {
    $('syncResult').textContent = '❌ ' + err.message;
    $('syncResult').classList.remove('hidden');
  }

  $('syncBtn').disabled = false;
  $('syncBtn').textContent = 'Sync WhatsApp Contacts';
});

// Logout
$('logoutBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['access_token', 'refresh_token', 'user_email']);
  $('loginSection').classList.remove('hidden');
  $('connectedSection').classList.add('hidden');
  $('statusBadge').textContent = 'Not Connected';
  $('statusBadge').style.background = '#ef444420';
  $('statusBadge').style.color = '#f87171';
});

function showConnected(email) {
  $('loginSection').classList.add('hidden');
  $('connectedSection').classList.remove('hidden');
  $('userEmail').textContent = email;
  $('statusBadge').textContent = 'Connected';
  $('statusBadge').style.background = '#22c55e20';
  $('statusBadge').style.color = '#4ade80';
}
