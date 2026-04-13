# Vanto CRM Chrome Extension — Portable Technical Specification

> **Purpose:** This document explains EXACTLY how the Vanto CRM Chrome Extension identifies contacts, switches between contacts, identifies WhatsApp groups by name, and executes automated group posts — so another team can replicate these capabilities.
>
> **Version:** 6.2.5 | **Date:** April 13, 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Contact Detection & Identification](#2-contact-detection--identification)
3. [Fast Contact Switching](#3-fast-contact-switching)
4. [Group Chat Detection](#4-group-chat-detection)
5. [Group Name Identification & Matching](#5-group-name-identification--matching)
6. [9-Stage Group Post Execution Pipeline](#6-9-stage-group-post-execution-pipeline)
7. [DOM Selector Cascades (Full Reference)](#7-dom-selector-cascades-full-reference)
8. [Self-Healing & Reliability](#8-self-healing--reliability)
9. [Common Pitfalls & How We Solved Them](#9-common-pitfalls--how-we-solved-them)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Chrome Extension (Manifest V3)                          │
│                                                         │
│  ┌──────────────┐     messages      ┌────────────────┐  │
│  │ content.js   │◄────────────────►│ background.js   │  │
│  │ (WhatsApp    │  chrome.runtime  │ (Service Worker)│  │
│  │  Web page)   │  .sendMessage()  │                 │  │
│  └──────┬───────┘                  └───────┬─────────┘  │
│         │ DOM manipulation                 │ REST API   │
│         ▼                                  ▼            │
│  WhatsApp Web DOM                   Supabase Database   │
└─────────────────────────────────────────────────────────┘
```

- **content.js** runs ON the WhatsApp Web page. It reads the DOM to detect contacts/groups and manipulates the DOM to send messages.
- **background.js** is the service worker. It handles auth, database calls, and schedules group post execution.
- Communication is via `chrome.runtime.sendMessage()` / `chrome.tabs.sendMessage()`.

---

## 2. Contact Detection & Identification

### How We Identify a Contact

We extract TWO pieces of data from the WhatsApp Web DOM:

#### A) Contact Name Detection

We use a **selector cascade** — an ordered list of CSS selectors tried one-by-one until one works. This is critical because WhatsApp updates its DOM frequently.

```javascript
const SELECTORS = {
  contactName: [
    '[data-testid="conversation-header"] span[title]',
    '[data-testid="conversation-info-header-chat-title"] span',
    '[data-testid="conversation-info-header-chat-title"]',
    'header [data-testid="conversation-info-header"] span[title]',
    'header span[dir="auto"][title]',
    '#main header span[title]',
    '#main header span[dir="auto"]',
    '#main header > div > div > div > div span[title]'
  ]
};
```

**Key insight:** We prioritize the `title` HTML attribute over `textContent`. The `title` attribute is always clean and short (just the name). `textContent` can accidentally grab UI text like "click to view", participant counts, or other junk from child elements.

```javascript
function detectContactName() {
  for (const selector of SELECTORS.contactName) {
    const el = document.querySelector(selector);
    if (!el) continue;
    
    // PRIORITY 1: Use 'title' attribute (most reliable, always short)
    const titleAttr = el.getAttribute('title');
    if (titleAttr && titleAttr.trim()) {
      return sanitizeExtractedText(titleAttr, 'Contact name');
    }
    
    // PRIORITY 2: Fall back to textContent (risky)
    // Only use DIRECT text nodes, not inherited from children
    const directText = Array.from(el.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('')
      .trim();
    
    const textToUse = directText || el.textContent;
    return sanitizeExtractedText(textToUse, 'Contact name');
  }
  return null;
}
```

#### B) Phone Number Detection (4-Priority System)

```javascript
function detectPhoneNumber() {
  // Priority 0: From #main element's data-id attribute
  // WhatsApp stores the JID like "27821234567@s.whatsapp.net" in data-id
  const mainEl = document.querySelector('#main[data-id]');
  if (mainEl) {
    const dataId = mainEl.getAttribute('data-id');
    const match = dataId.match(/(\d{7,15})@/);  // Extract digits before @
    if (match) return match[1];
  }

  // Priority 1: From URL hash (e.g., #/chat/27821234567@s.whatsapp.net)
  const hash = window.location.hash;
  const urlMatch = hash.match(/chat\/(\d{7,15})@/);
  if (urlMatch) return urlMatch[1];

  // Priority 2: From any element with data-id containing phone
  const dataIdElements = document.querySelectorAll('#main [data-id]');
  for (const el of dataIdElements) {
    const match = el.getAttribute('data-id').match(/(\d{7,15})@/);
    if (match) return match[1];
  }

  // Priority 3: From header text (visible phone number in header)
  const headerSpans = document.querySelectorAll('#main header span');
  for (const span of headerSpans) {
    const text = span.textContent || '';
    if (/^\+?\d[\d\s\-(). ]{5,}$/.test(text)) {
      const phone = text.replace(/\D/g, '');
      if (phone.length >= 7) return phone;
    }
  }
  return null;
}
```

**Key insight:** The `data-id` attribute on `#main` is the MOST reliable source. WhatsApp always sets it to `{phone}@s.whatsapp.net` for contacts or `{id}@g.us` for groups. This is how we ALSO distinguish contacts from groups (see Section 4).

---

## 3. Fast Contact Switching

### The Problem
When a user clicks from one WhatsApp chat to another, the extension must detect the change INSTANTLY and update its sidebar with the new contact's info.

### Our Solution: Dual-Detection System

We use TWO change-detection mechanisms running simultaneously:

#### A) MutationObserver on `#main` and `<title>`

```javascript
function watchChatChanges() {
  // Observer 1: Watch the page title (changes with each chat)
  const titleObserver = new MutationObserver(() => {
    scheduleDetection();
  });
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, { 
      childList: true, characterData: true, subtree: true 
    });
  }

  // Observer 2: Watch #main for data-id changes (the chat pane)
  const bodyObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target.id === 'main' ||
          (mutation.target.closest && mutation.target.closest('#main'))) {
        scheduleDetection();
        break;
      }
    }
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-id']  // KEY: Only watch data-id changes
  });
}
```

#### B) Polling Fallback (1.5s interval)

```javascript
setInterval(() => {
  scheduleDetection();
}, 1500);  // POLLING_INTERVAL_MS
```

#### C) Debounced Detection

Multiple rapid MutationObserver events are debounced into a single detection run:

```javascript
const DETECTION_DEBOUNCE_MS = 600;

function scheduleDetection() {
  if (detectionTimer) clearTimeout(detectionTimer);
  detectionTimer = setTimeout(runDetection, DETECTION_DEBOUNCE_MS);
}

function runDetection() {
  const name = detectContactName();
  if (name !== lastDetectedName) {
    lastDetectedName = name;
  }

  isGroupChat = detectGroupChat();

  if (isGroupChat) {
    currentGroupName = detectGroupName();
    lastDetectedPhone = null;
  } else {
    const phone = detectPhoneNumber();
    if (phone !== lastDetectedPhone) {
      lastDetectedPhone = phone;
    }
  }

  updateUI();  // Instantly refreshes the sidebar
}
```

### Why This Is Fast

1. **MutationObserver fires immediately** when WhatsApp changes the `data-id` attribute on `#main` (which happens on every chat switch)
2. **600ms debounce** prevents redundant runs during WhatsApp's DOM transition animations
3. **State diffing** (`name !== lastDetectedName`) avoids unnecessary UI updates
4. **Polling at 1.5s** catches any edge cases the MutationObserver misses

---

## 4. Group Chat Detection

### How We Know It's a Group (Not a Contact)

WhatsApp uses different JID suffixes:
- **Contact:** `27821234567@s.whatsapp.net`
- **Group:** `120363012345678901@g.us`

```javascript
function detectGroupChat() {
  // Check 1: data-id on #main contains @g.us
  const mainEl = document.querySelector('#main');
  if (mainEl) {
    const dataId = mainEl.getAttribute('data-id');
    if (dataId && dataId.includes('@g.us')) return true;
  }

  // Check 2: URL hash contains @g.us
  if (window.location.hash.includes('@g.us')) return true;

  // Check 3: Any element with data-id containing @g.us
  const groupIndicator = document.querySelector('[data-id*="@g.us"]');
  if (groupIndicator) return true;

  return false;
}
```

### Group JID Extraction (Stable Identity)

Group NAMES can change. Group JIDs (`120363012345678901@g.us`) are permanent. We extract and store BOTH:

```javascript
// When saving a group:
const mainEl = document.querySelector('#main');
let groupJid = null;
if (mainEl) {
  const dataId = mainEl.getAttribute('data-id');
  if (dataId && dataId.includes('@g.us')) {
    groupJid = dataId;  // e.g., "120363012345678901@g.us"
  }
}

// Store in database: { group_name: "APLGO Health", group_jid: "120363...@g.us" }
```

---

## 5. Group Name Identification & Matching

### The Core Problem Other Extensions Fail At

WhatsApp group names contain special characters (`|`, `-`, `•`, emoji, zero-width chars) that break naive string comparison. Our solution is a **3-pass normalized matching system**.

### Text Normalization Function

```javascript
function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Remove zero-width characters
    .replace(/\s+/g, ' ')                     // Collapse whitespace
    .replace(/\s*\|\s*/g, ' ')                // Pipe with spaces → single space
    .replace(/\s*-\s*/g, ' ')                 // Dash with spaces → single space
    .replace(/[\[\](){}]/g, '')                // Remove brackets
    .trim()
    .toLowerCase();
}
```

**Example:**
- Input: `"APLGO | Health and Biz 🌟"` → Normalized: `"aplgo health and biz 🌟"`
- Input: `"APLGO  |  Health and Biz"` → Normalized: `"aplgo health and biz"`
- Both now match!

### 3-Pass Matching System

```javascript
function matchGroupNames(targetName, domText) {
  const normalizedTarget = normalizeText(targetName);
  const normalizedDom = normalizeText(domText);
  
  // PASS 1: Exact match after normalization
  const exact = normalizedTarget === normalizedDom;
  
  // PASS 2: Containment check (one contains the other)
  const partial = normalizedTarget.includes(normalizedDom) || 
                  normalizedDom.includes(normalizedTarget);
  
  // PASS 3: Word-based fuzzy scoring
  const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 1);
  const domWords = normalizedDom.split(/\s+/).filter(w => w.length > 1);
  const matchingWords = targetWords.filter(w => domWords.includes(w)).length;
  const score = targetWords.length > 0 ? matchingWords / targetWords.length : 0;
  
  return { exact, partial, score };
}
```

### How `select_group` Uses This (Full Algorithm)

```
1. Type group name into WhatsApp search bar
2. Wait 1.5s for search results to render
3. Collect all visible search result items using selector cascade
4. For EACH result item:
   a. Extract title via: title attribute → child span[title] → [title] → first line of textContent
   b. Run matchGroupNames(target, extracted_title)
   c. If exact match → use immediately
   d. If partial match with best score → track as candidate
5. Pick: exact_match || best_partial_match || first_result_fallback
6. Find clickable target within the item (role="button" or cell-frame-container)
7. Click it
```

### Getting the Title from Search Results (4-Method Cascade)

This is where most extensions fail — they only try one way to read the name:

```javascript
for (const item of resultItems) {
  let title = '';
  
  // Method 1: title attribute on the list item itself
  title = item.getAttribute('title') || '';
  
  // Method 2: Look for WhatsApp's title span inside the item
  if (!title) {
    for (const titleSelector of SELECTORS.chatTitleSpan) {
      const titleEl = item.querySelector(titleSelector);
      if (titleEl) {
        title = titleEl.getAttribute('title') || titleEl.textContent || '';
        if (title) break;
      }
    }
  }
  
  // Method 3: Any element inside with a title attribute
  if (!title) {
    const titleEl = item.querySelector('[title]');
    if (titleEl) title = titleEl.getAttribute('title') || '';
  }
  
  // Method 4: textContent fallback (first line only, max 100 chars)
  if (!title) {
    const firstLine = (item.textContent || '').split('\n')[0];
    if (firstLine && firstLine.length < 100) title = firstLine.trim();
  }
}
```

### Search Result Selectors (Multiple Fallbacks)

WhatsApp changes its DOM structure. We handle this with cascading selectors:

```javascript
searchResultItems: [
  'div[aria-label="Search results"] [role="listitem"]',
  'div[aria-label="Search results"] > div > div',
  '#pane-side [role="listbox"] [role="listitem"]',
  'div[aria-label*="result"] [role="listitem"]'
],
// Plus fallback to general chat list:
chatListItems: '#pane-side [role="listitem"]'
```

---

## 6. 9-Stage Group Post Execution Pipeline

Each stage has its own timeout and structured error reporting:

| # | Stage | Timeout | What It Does | How It Detects Success |
|---|-------|---------|-------------|----------------------|
| 1 | `open_search` | 10s | Finds search input; clicks search icon if needed | Search input element found |
| 2 | `search_group` | 15s | Types group name into search, waits 1.5s for results | Text inserted into search box |
| 3 | `select_group` | 8s | 3-pass matching (exact → partial → first result), clicks best match | Click executed on result item |
| 4 | `wait_chat_open` | 12s | Polls until `#main header` exists | Header element found |
| 5 | `find_input` | 10s | Locates message compose box via selector cascade | Compose box element found |
| 6 | `inject_message` | 8s | `execCommand('insertText')` + InputEvent dispatch | Text in compose box |
| 7 | `find_send_button` | 10s | Locates send button via selector cascade | Send button element found |
| 8 | `click_send` | 8s | Clicks the send button | Click executed |
| 9 | `confirm_sent` | 12s | Checks compose box is empty after 1s | Input cleared |

**Total safety timeout:** 90 seconds

### Structured Error Payload

When a stage fails, the error propagates all the way to the database:

```json
{
  "success": false,
  "error": "[select_group] Group not found: APLGO Health Team"
}
```

Written to `scheduled_group_posts.failure_reason` in the database.

---

## 7. DOM Selector Cascades (Full Reference)

### Why Cascades Matter

WhatsApp Web updates its DOM without warning. A selector that works today may break tomorrow. By using cascades (try selector A, if fail try B, if fail try C...), the extension survives most DOM changes.

```javascript
const SELECTORS = {
  contactName: [
    '[data-testid="conversation-header"] span[title]',
    '[data-testid="conversation-info-header-chat-title"] span',
    '[data-testid="conversation-info-header-chat-title"]',
    'header [data-testid="conversation-info-header"] span[title]',
    'header span[dir="auto"][title]',
    '#main header span[title]',
    '#main header span[dir="auto"]',
    '#main header > div > div > div > div span[title]'
  ],
  
  searchInput: [
    '[data-testid="chat-list-search-input"]',
    'div[contenteditable="true"][data-tab="3"]',
    'div[role="textbox"][title="Search input textbox"]'
  ],
  
  messageInput: [
    '[data-testid="conversation-compose-box-input"]',
    'div[contenteditable="true"][data-tab="10"]',
    '#main footer div[contenteditable="true"]',
    'div[role="textbox"][title="Type a message"]',
    '#main footer [contenteditable="true"]'
  ],
  
  sendButton: [
    '[data-testid="send"]',
    'button[aria-label="Send"]',
    'span[data-icon="send"]',
    '[data-testid="compose-btn-send"]',
    'button[data-tab="11"]'
  ],
  
  searchResultItems: [
    'div[aria-label="Search results"] [role="listitem"]',
    'div[aria-label="Search results"] > div > div',
    '#pane-side [role="listbox"] [role="listitem"]',
    'div[aria-label*="result"] [role="listitem"]'
  ],
  
  chatTitleSpan: [
    'div[data-testid="cell-frame-title"] span[title]',
    'span[dir="auto"][title]',
    'span[title]',
    '[data-testid="cell-frame-title"]'
  ]
};
```

### The `findElement()` Utility

```javascript
function findElement(selectors, label = 'element') {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Found ${label} with selector: ${selector}`);
        return element;
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }
  return null;
}
```

### The `waitForElement()` Utility (with timeout)

```javascript
function waitForElement(selectors, timeout = 5000, label = 'element') {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      const element = findElement(selectors, label);
      if (element) { resolve(element); return; }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error(`${label} not found within ${timeout}ms`));
        return;
      }
      
      requestAnimationFrame(check);  // ~60fps polling
    }
    check();
  });
}
```

---

## 8. Self-Healing & Reliability

### Content Script Re-Injection

If the content script dies (tab sleep, page reload), the background worker detects this and re-injects:

```javascript
async function ensureContentScriptInjected(tabId) {
  // Step 1: Handle sleeping (discarded) tabs
  const tab = await chrome.tabs.get(tabId);
  if (tab.discarded) {
    await chrome.tabs.update(tabId, { active: true });  // Wake it up
    await waitForTabToLoad(tabId, 10000);
  }

  // Step 2: Handle loading tabs
  if (tab.status === 'loading') {
    await waitForTabToLoad(tabId, 5000);
  }

  // Step 3: Ping existing content script
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (response?.pong && response?.initialized) return { success: true };
  } catch (e) {
    // Content script not loaded
  }

  // Step 4: Inject programmatically with retry
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['sidebar.css'] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await sleep(2000);
      
      // Verify it worked
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      if (response?.pong) return { success: true };
    } catch (e) {
      await sleep(1000);
    }
  }
  
  return { success: false, error: 'Injection failed after retries' };
}
```

### Heartbeat System

The background worker pings every 60 seconds:
- Records `{ last_seen, whatsapp_ready }` to the database
- CRM dashboard reads this to show "Extension Connected" or "Disconnected"

### Proactive Tab Injection

When a WhatsApp tab finishes loading, we inject immediately:

```javascript
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes('web.whatsapp.com')) {
    await sleep(1000);  // Let WhatsApp render
    await ensureContentScriptInjected(tabId);
  }
});
```

---

## 9. Common Pitfalls & How We Solved Them

### Pitfall 1: "Extension grabs wrong text for contact name"
**Cause:** Using `el.textContent` which inherits text from ALL child elements.
**Solution:** Prioritize `el.getAttribute('title')`. Fall back to direct text nodes only.

### Pitfall 2: "Group name too long, crashes database insert"
**Cause:** Selector grabbed a container's full `innerText` (hundreds of chars).
**Solution:** `sanitizeExtractedText()` enforces 255-char limit and rejects text with >3 newlines.

### Pitfall 3: "Can't find group in search results"
**Cause:** Group name has `|` or `-` but DOM text renders them differently.
**Solution:** `normalizeText()` strips pipes, dashes, zero-width chars before comparison.

### Pitfall 4: "Extension dies when tab sleeps"
**Cause:** Chrome discards background tabs to save memory.
**Solution:** `wakeUpDiscardedTab()` activates the tab and waits for load before injecting.

### Pitfall 5: "Send button not found after typing message"
**Cause:** WhatsApp only shows the send button AFTER text is in the compose box.
**Solution:** `findSendButton()` waits 300ms after message injection, then uses `waitForElement()` with timeout.

### Pitfall 6: "Generic timeout error with no diagnostics"
**Cause:** Single 45s global timeout with no stage visibility.
**Solution:** 9-stage pipeline where each stage has its own timeout, logging, and error message.

### Pitfall 7: "Extension doesn't detect chat switch"
**Cause:** Only using polling.
**Solution:** MutationObserver on `data-id` attribute changes + `<title>` changes + polling fallback.

### Pitfall 8: "WhatsApp blocks keyboard events from extension"
**Cause:** Events propagate from extension sidebar into WhatsApp.
**Solution:** `stopPropagation()` on all keyboard/click events within the sidebar div.

```javascript
['keydown', 'keyup', 'keypress', 'click'].forEach(function(evt) {
  sidebar.addEventListener(evt, function(e) {
    e.stopPropagation();
  });
});
```

### Pitfall 9: "Sidebar shifts WhatsApp layout"
**Cause:** Using `margin-left` or `flex` on WhatsApp's `#app`.
**Solution:** Use `position: fixed` overlay only. Never modify WhatsApp's DOM layout.

---

## Summary: Key Techniques to Replicate

| Capability | Technique |
|-----------|-----------|
| **Contact identification** | Selector cascade (8 selectors) + title attribute priority + text sanitization |
| **Phone extraction** | `data-id` attribute regex (`/(\d{7,15})@/`) from `#main`, URL hash, child elements, header text |
| **Fast switching** | MutationObserver on `data-id` + title observer + 1.5s polling + 600ms debounce |
| **Group vs Contact** | Check for `@g.us` in `data-id` (groups) vs `@s.whatsapp.net` (contacts) |
| **Group name matching** | `normalizeText()` strips symbols → 3-pass matching (exact, partial, word-score) |
| **Search result reading** | 4-method title extraction (attribute → child span → any [title] → textContent first line) |
| **Reliable execution** | 9-stage pipeline with per-stage timeouts and structured error codes |
| **Self-healing** | Pre-flight ping → programmatic re-injection → discarded tab wake-up → retry logic |
| **Sidebar isolation** | `position: fixed` + `stopPropagation()` on all events |

---

*End of Portable Specification — April 13, 2026*
