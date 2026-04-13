# Zazi Follow-Up Copilot — Diagnostic Report: What Went Wrong

**Version Analyzed:** 2.0.0 (Spec dated 2026-03-12)  
**Diagnostic Date:** April 13, 2026  
**Prepared by:** Vanto CRM Engineering (Reference: Vanto Chrome Extension v6.2.5)

---

## Executive Summary

After a thorough code review of the Zazi Follow-Up Copilot extension (background.js, sidepanel.js, sidepanel.html, sidepanel.css, manifest.json, and full specification), we have identified **12 critical issues** across 4 categories:

1. **Contact identification failures** — fragile selectors, no normalization, no JID extraction
2. **Group identification is completely absent** — the extension cannot interact with WhatsApp groups at all
3. **Slow/unreliable chat switching** — no debouncing, race conditions, over-complex state management
4. **Architecture anti-patterns** — monolithic state via `chrome.storage.local` polling creates lag and thrashing

---

## 1. CONTACT IDENTIFICATION — What Went Wrong

### 1.1 ❌ No Text Normalization Before Matching

**The Problem:**  
The Zazi extension reads the raw `span[title]` text and passes it directly to CRM search. WhatsApp Web displays names with:
- Zero-width characters (`\u200B`, `\u200D`, `\uFEFF`)
- Emoji prefixes/suffixes (e.g., "🌟 John Smith")
- Non-breaking spaces, diacritics, and right-to-left marks

Without stripping these, a CRM contact named "John Smith" will NOT match "🌟 John Smith" or "John​Smith" (with zero-width space).

**What Vanto Does:**
```javascript
function normalizeText(text) {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')   // strip zero-width chars
    .replace(/\s+/g, ' ')                      // collapse whitespace
    .replace(/[^\p{L}\p{N}\s]/gu, '')          // strip emoji/symbols
    .trim()
    .toLowerCase();
}
```
Every contact name and group name passes through `normalizeText()` BEFORE any comparison.

**Fix Required:**  
Add a `normalizeText()` function and apply it in `whatsapp-adapter.js` before sending `contactInfo.name` to the background, and in `background.js` before CRM search.

---

### 1.2 ❌ No JID Extraction from `data-id` Attribute

**The Problem:**  
The Zazi extension extracts phone numbers using 5 strategies (header title, phone span, regex scan, name-as-phone, drawer). But it **completely misses** the most reliable source: the `data-id` attribute on message elements.

WhatsApp Web stamps every message bubble with a `data-id` attribute like:
```
true_27831234567@s.whatsapp.net_3A0123456789ABCDEF
false_27831234567@s.whatsapp.net_3A0123456789ABCDEF
```

The phone number (`27831234567`) is embedded directly in the JID. This is the **canonical identity** — it never changes regardless of display name, and it's always present even for unsaved contacts.

**What Vanto Does:**
```javascript
// Extract JID from message data-id — most reliable identity source
const JID_REGEX = /(\d{7,15})@/;
const msgEls = document.querySelectorAll('#main [data-id]');
for (const el of msgEls) {
  const match = el.getAttribute('data-id')?.match(JID_REGEX);
  if (match) {
    contactPhone = match[1];
    break;
  }
}
```
This is checked as **strategy #1** (highest priority) in Vanto's 8-selector cascade.

**Impact of Missing This:**  
- Unsaved contacts (who appear as "+27 83 123 4567" in the header) require complex regex parsing
- Contacts whose display names are in non-Latin scripts can't be phone-matched at all
- The phone extraction is fragile and breaks when WhatsApp changes header layout

**Fix Required:**  
Add JID extraction from `data-id` as the **first** identity strategy in `whatsapp-adapter.js`.

---

### 1.3 ❌ Only 5 Selector Strategies (vs. Vanto's 8)

**The Problem:**  
The Zazi extension uses 5 selectors for identity extraction. If WhatsApp changes any of these DOM structures, the extension breaks silently.

**Zazi's 5 Strategies:**
1. `#main header span[title]` — display name
2. `span[title*="+"]` — phone in header
3. `#main header span[title]` regex — phone pattern scan
4. Name-as-phone detection
5. `[data-testid="phone-number"]` — info drawer

**Vanto's 8-Selector Cascade (priority order):**
1. `data-id` JID extraction (most reliable)
2. `[data-testid="conversation-header"] span[title]`
3. `header span[dir="auto"][title]`
4. `#main header span[title]`
5. `#main header [data-testid="conversation-info-header"] span`
6. Phone regex on all header spans
7. `document.title` parsing
8. Side drawer `[data-testid="phone-number"]`

**Why It Matters:**  
WhatsApp Web updates frequently. A cascade with 8 fallbacks is far more resilient. The Zazi extension has been reported as "hallucinating" contact identity — this is because when strategies 1-5 all fail, there's no fallback and the extension either shows the wrong contact or no contact.

---

### 1.4 ❌ Phone Matching Does Suffix-Only as Tier 2

**The Problem:**  
The `findContactByPhone` in `supabase-client.js` uses:
1. Exact `phone_normalized` match
2. Suffix match (last 9 digits) via `LIKE`
3. Raw `phone_number` LIKE

This is **correct in theory** but the suffix extraction is happening in the Supabase client, not at the adapter level. The adapter sends the raw phone string, which may contain `+`, spaces, dashes, and parentheses. If the normalization at the database level doesn't perfectly match what the adapter sends, the lookup fails.

**What Vanto Does:**  
Normalization happens at **three** levels:
1. **Adapter level**: Strip all non-digits immediately upon extraction
2. **Background level**: Re-normalize before CRM lookup
3. **Database level**: `phone_normalized` column with trigger

This triple-check ensures no format mismatch can cause a missed match.

---

## 2. GROUP IDENTIFICATION — What Went Wrong

### 2.1 ❌ Groups Are Completely Unsupported

**The Problem:**  
The Zazi extension explicitly **detects groups and skips them**:

> "Group chats are detected and flagged — the side panel shows 'Group chat detected' notice."

The extension shows `👥 Group chat detected — Copilot works with 1:1 chats only` and does nothing further.

**What Vanto Does:**

Vanto has a **complete group campaign system** with:
- Group name capture from WhatsApp sidebar
- Group JID extraction via `data-id` on group messages
- Persistent group registry (`whatsapp_groups` table)
- Scheduled message posting to groups
- A **9-stage execution pipeline** for reliable group message delivery

### 2.2 ❌ No Group Name Normalization

Even if Zazi were to add group support, the spec shows no `normalizeGroupName()` function. WhatsApp group names commonly include:
- `|`, `•`, `~`, `-` as separators
- Emoji in group names (🌟, 💰, ✅)
- Extra spaces and special characters

**What Vanto Does — 3-Pass Group Matching:**

```javascript
// Pass 1: Exact Normalized Match
const normalizedTarget = normalizeText(targetGroupName);
const normalizedCandidate = normalizeText(visibleGroupName);
if (normalizedTarget === normalizedCandidate) → MATCH

// Pass 2: Partial Match (one contains the other)
if (normalizedTarget.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedTarget)) → MATCH

// Pass 3: Fuzzy Word-Score Match
const targetWords = normalizedTarget.split(/\s+/);
const candidateWords = normalizedCandidate.split(/\s+/);
const matchedWords = targetWords.filter(w => candidateWords.includes(w));
const score = matchedWords.length / targetWords.length;
if (score >= 0.6) → MATCH (with confidence score)
```

**Fix Required:**  
If the other project needs group support, they need to:
1. Remove the group-skip logic
2. Implement `normalizeText()` for group names
3. Use the 3-pass matching algorithm
4. Extract group JIDs from `data-id` for stable identity

---

## 3. CHAT SWITCHING — What Went Wrong

### 3.1 ❌ No Debouncing on Header Observer

**The Problem (Spec §4.1.4):**
> "Fires `processActiveChat()` **immediately** on any change — no debounce."

This is explicitly stated as a feature, but it's actually a bug. When a user clicks a new chat, WhatsApp Web updates the header in multiple DOM mutations:
1. Old name removed
2. Loading placeholder inserted
3. New name rendered
4. Subtitle updated
5. Avatar updated

Without debouncing, `processActiveChat()` fires 3-5 times in rapid succession, each time triggering:
- DOM scraping
- `chrome.runtime.sendMessage` to background
- CRM lookup (network request to Supabase)
- State update in `chrome.storage.local`

This creates a **race condition** where earlier (stale) lookups may resolve AFTER the correct lookup, overwriting the correct contact with wrong data.

**What Vanto Does:**
```javascript
// 600ms debounce on MutationObserver
let debounceTimer = null;
observer.observe(header, { childList: true, subtree: true, attributes: true });
// On mutation:
clearTimeout(debounceTimer);
debounceTimer = setTimeout(() => processActiveChat(), 600);
```

The 600ms wait ensures all DOM mutations settle before scraping. This is the single most important fix for "hallucinating" contact identity.

**Fix Required:**  
Add 500-800ms debounce to the header `MutationObserver` callback in `whatsapp-adapter.js`.

---

### 3.2 ❌ 4-Second Polling Interval Is Too Slow as Primary Fallback

**The Problem:**  
The WhatsApp adapter uses `setInterval(processActiveChat, 4000)` as the safety-net poll. Combined with the non-debounced observer creating false positives, the polling is both:
- Too slow to catch observer misses promptly
- Unnecessary when the observer is firing correctly (creates duplicate work)

**What Vanto Does:**
- **1.5-second polling** as safety net
- **MutationObserver** with 600ms debounce as primary
- **`document.title` change** detection as secondary (WhatsApp updates `<title>` with the active chat name)

The title-change detection is a key innovation that Zazi is missing entirely. It catches chat switches even when the header observer fails.

---

### 3.3 ❌ Chat List Click Listener Has 80ms Settle Delay (Too Short)

**The Problem (Spec §4.1.4):**
> "Fires `processActiveChat()` after 80ms DOM settle delay."

80ms is far too short. WhatsApp's SPA takes 200-600ms to fully render a new chat after a click. At 80ms, the adapter is reading the OLD chat's DOM, then the observer fires later with the NEW chat — but without debouncing, the old data may have already been sent to the background.

**What Vanto Does:**
- Click listener uses **300ms** settle delay
- The click listener's `processActiveChat()` call is **merged with the observer's debounce** — if an observer mutation arrives within the debounce window, only one `processActiveChat()` runs

---

### 3.4 ❌ Side Panel Polls Storage Every 1.5s Instead of Using Events

**The Problem:**  
The side panel uses `setInterval(pollContext, 1500)` to read `chrome.storage.local` and re-render. This introduces up to 1.5 seconds of latency on every context change.

**Better Approach (What Vanto Does):**
```javascript
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.current_context) {
    renderContext(changes.current_context.newValue);
  }
});
```
This is **event-driven** — the side panel re-renders instantly when the background updates storage. Zero polling latency.

The Zazi extension DOES use `chrome.storage.onChanged` for some things, but the primary context rendering path goes through polling. This is the #1 reason for perceived slowness.

---

## 4. ARCHITECTURE ANTI-PATTERNS

### 4.1 ❌ Over-Complex State Machine for Context Clearing

**The Problem:**  
The `CONTEXT_CLEAR_REQUEST` handler in `background.js` (lines 223-273) has 7 conditions, 3 grace windows, and channel-isolation checks. The side panel has ANOTHER layer of validation with `isContextPayloadValid()`, `isFreshEnough()`, `isExplicitClear()`, and `lastKnownByChannel` fallbacks.

This creates a 2-layer state machine where:
- The background decides if a clear should happen
- The side panel has its own fallback logic that may contradict the background

**Result:** The extension sometimes shows stale contacts because the side panel's fallback logic resurrects a context that the background already cleared.

**What Vanto Does:**  
Single source of truth. The background writes to `chrome.storage.local`, and the side panel reads it. No side-panel-level fallback logic. If the background says "cleared," it's cleared.

---

### 4.2 ❌ `isEditing` Guard Blocks ALL Updates

**The Problem:**  
When `isEditing = true`, the polling function returns immediately:
```javascript
if (isEditing) return; // Skip ALL rendering updates
```

If the user opens the edit form, switches to a different WhatsApp chat, and then comes back to the side panel, the side panel is STILL showing the OLD contact's edit form. The user might accidentally save edits to the wrong contact.

**What Vanto Does:**  
The edit form is bound to a specific `contactId`. If the active contact changes while editing, the edit form is automatically closed with a toast notification: "Contact changed — edit cancelled."

---

### 4.3 ❌ No Structured Error Reporting

**The Problem:**  
When a CRM lookup fails or identity extraction returns nothing, the extension logs to `console.log()`. There's no structured error taxonomy, no error codes, and no user-visible diagnostics.

**What Vanto Does:**  
Every operation has error codes like:
- `SEARCH_GROUP_TIMEOUT` — group search timed out
- `SELECT_GROUP_NO_MATCH` — no matching group found
- `CONTACT_PHONE_MISMATCH` — phone formats don't match

These codes are stored in the database and displayed in the CRM UI for diagnostics.

---

## 5. SUMMARY: Priority Fixes

| # | Issue | Severity | Effort | Fix |
|---|-------|----------|--------|-----|
| 1 | Add 600ms debounce to header observer | **Critical** | 10 min | Wrap observer callback in `setTimeout` with clear-on-re-fire |
| 2 | Add JID extraction from `data-id` | **Critical** | 30 min | Regex on message elements, use as primary phone source |
| 3 | Add `normalizeText()` function | **Critical** | 15 min | Strip zero-width chars, emoji, collapse whitespace |
| 4 | Replace storage polling with `chrome.storage.onChanged` | **High** | 20 min | Event-driven side panel rendering |
| 5 | Increase click listener settle delay to 300ms | **High** | 5 min | Change `80` to `300` in `setTimeout` |
| 6 | Add `document.title` change detection | **High** | 20 min | Secondary observer for `<title>` mutations |
| 7 | Add more selector fallbacks (8-cascade) | **Medium** | 30 min | Add `data-testid` variants, title parsing |
| 8 | Triple-normalize phone (adapter + BG + DB) | **Medium** | 20 min | Strip non-digits at each layer |
| 9 | Close edit form on contact change | **Medium** | 15 min | Check `contactId` in poll, auto-cancel |
| 10 | Implement group support (if needed) | **Low** | 2-4 hrs | 3-pass matching, JID registry, execution pipeline |
| 11 | Add structured error codes | **Low** | 1 hr | Error taxonomy, user-visible diagnostics |
| 12 | Simplify context-clear state machine | **Low** | 1 hr | Remove side-panel fallback, single source of truth |

---

## 6. REFERENCE IMPLEMENTATION

For the working reference implementation of all fixes above, see:

- **`docs/VANTO_CHROME_EXTENSION_PORTABLE_SPEC.md`** — Portable specification with all algorithms
- **`public/chrome-extension/content.js`** — Vanto's content script (1240 lines) with 8-selector cascade, `normalizeText()`, debounced observer, JID extraction
- **`public/chrome-extension/background.js`** — Vanto's background script (734 lines) with 9-stage pipeline and structured error reporting

---

*End of Diagnostic Report — April 13, 2026*
