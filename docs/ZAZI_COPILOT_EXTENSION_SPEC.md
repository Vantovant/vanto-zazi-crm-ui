# Zazi Follow-Up Copilot — Chrome Extension Full Specification

**Version:** 2.0.0  
**Last Updated:** 2026-03-12  
**Status:** Operational (Phase D — AI Copilot Active)

---

## 1. Overview

The Zazi Follow-Up Copilot is a Chrome Extension (Manifest V3) that serves as a real-time CRM companion for WhatsApp Web and Gmail. It runs alongside the Vanto Zazi CRM web application and provides:

- **AI-powered message suggestions** (Phase D) via the `zazi-copilot` edge function
- **Rule-based fallback** message generation with 48 template variants
- **Automatic contact matching** with persistent mappings
- **Follow-up intelligence** via a 10-rule decision engine
- **Inline CRM actions**: activity logging, draft saving, contact creation, contact editing
- **Cross-channel state isolation** preventing data bleed between WhatsApp and Gmail

### 1.1 Core Value Proposition

- **Zero context-switching**: Users stay in WhatsApp/Gmail while accessing full CRM intelligence.
- **Automatic contact matching**: Multi-tier matching (phone, email, suffix, name, persistent mapping).
- **AI Copilot (Phase D)**: LLM-generated messages using conversation history + CRM lead type context.
- **Follow-up intelligence**: Rules engine evaluates conversation state and recommends next best action.
- **Human-in-the-loop safety**: AI never auto-sends — suggestions populate a review box for user approval.
- **Inline editing**: Edit contact name, phone, and lead type directly from the side panel with instant CRM sync.
- **Instant switching**: Header observers and click listeners ensure sub-second context updates on chat changes.

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  WhatsApp     │  │  Gmail       │  │  Side Panel          │   │
│  │  Adapter      │  │  Adapter     │  │  (Primary UI)        │   │
│  │  (content.js) │  │  (content.js)│  │  sidepanel.html/js   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘   │
│         │                  │                     │              │
│         └──────────┬───────┘                     │              │
│                    ▼                             │              │
│         ┌──────────────────┐                     │              │
│         │  Background       │◄────────────────────┘              │
│         │  Service Worker   │                                    │
│         │  (background.js)  │                                    │
│         └────────┬─────────┘                                    │
│                  │                                               │
│  ┌───────────────┼───────────────────────────────────────────┐  │
│  │  Shared Libraries                                         │  │
│  │  ┌─────────────┐ ┌────────────────┐ ┌──────────────────┐ │  │
│  │  │ config.js   │ │ supabase-      │ │ followup-        │ │  │
│  │  │             │ │ client.js      │ │ engine.js        │ │  │
│  │  └─────────────┘ └────────────────┘ └──────────────────┘ │  │
│  │  ┌──────────────────┐                                     │  │
│  │  │ message-          │                                     │  │
│  │  │ suggestions.js    │                                     │  │
│  │  └──────────────────┘                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                  │                                               │
└──────────────────┼───────────────────────────────────────────────┘
                   │
                   ▼
         ┌──────────────────┐       ┌──────────────────┐
         │  Supabase Backend │       │  zazi-copilot     │
         │  (Lovable Cloud)  │       │  Edge Function    │
         │  - contacts       │       │  (AI generation)  │
         │  - contact_       │       └──────────────────┘
         │    activities     │
         │  - orders         │
         │  - follow_up_     │
         │    states         │
         └──────────────────┘
```

### 2.2 Component Responsibilities

| Component | File(s) | Role |
|---|---|---|
| **Background Service Worker** | `background.js` (546 lines) | Central orchestrator. Handles auth, CRM lookups, follow-up evaluation, AI suggestion routing, message generation, state management, contact mapping persistence, tab lifecycle, and inline contact CRUD. |
| **WhatsApp Adapter** | `adapters/whatsapp-adapter.js` (424 lines) | Content script injected into `web.whatsapp.com`. Detects active 1:1 chats via header observer + click listener + polling, extracts contact identity (name + phone via 5 strategies), reads visible messages, handles insert-into-compose. |
| **Gmail Adapter** | `adapters/gmail-adapter.js` (343 lines) | Content script injected into `mail.google.com`. Detects open email threads via thread signature, extracts sender email/name, reads thread messages, handles insert-into-reply, injects in-page widget. |
| **Side Panel** | `sidepanel.html`, `sidepanel.js` (817 lines), `sidepanel.css` | Primary UI workspace. Shows contact card, lead type intelligence, reply status, recommendations, AI/rule-based suggestions, inline edit/create forms, activity timeline, orders, and message history. |
| **Popup** | `popup.html`, `popup.js` (47 lines) | Quick-action menu: Open WhatsApp Web, Open CRM Dashboard, Open Side Panel. |
| **Supabase Client** | `lib/supabase-client.js` (319 lines) | Lightweight REST client for Supabase (no npm). Handles auth (login/logout/refresh), contact CRUD (find/create/update), activity logging, order queries, follow-up state sync, and AI edge function calls. |
| **Follow-Up Engine** | `lib/followup-engine.js` (205 lines) | Rules engine that evaluates conversation state and returns recommended action, urgency, tone, and objective. |
| **Message Suggestions** | `lib/message-suggestions.js` (226 lines) | Template-based message generator with 8 objectives × 3 tones × 2 channels = 48 message variants. |
| **Config** | `lib/config.js` (12 lines) | Supabase URL, anon key, and follow-up timing thresholds. |

### 2.3 Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "Zazi Follow-Up Copilot",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab", "scripting", "tabs", "alarms", "sidePanel"],
  "host_permissions": [
    "https://web.whatsapp.com/*",
    "https://mail.google.com/*",
    "https://<supabase-project>.supabase.co/*"
  ]
}
```

- **Content scripts** are injected at `document_idle` into WhatsApp Web and Gmail.
- **Side panel** opens automatically on extension icon click (`openPanelOnActionClick: true`).
- **Alarms** are used for periodic session refresh (every 30 minutes).

---

## 3. Authentication

### 3.1 Login Flow

1. User opens the side panel.
2. If not authenticated, the login form is shown.
3. Previously used email is prefilled from `chrome.storage.local` (`remembered_email`).
4. User enters email + password → sent to background → Supabase `auth/v1/token` endpoint.
5. On success: `access_token`, `refresh_token`, `user_email`, `user_id` stored in `chrome.storage.local`.
6. Side panel transitions to connected state.

### 3.2 Session Persistence

- Tokens are stored in `chrome.storage.local` (persists across browser restarts).
- A 30-minute alarm triggers `SupabaseClient.refreshSession()` to keep the token fresh.
- On any API call returning 401, the client automatically attempts a token refresh and retries.

### 3.3 Logout

- Clears `access_token`, `refresh_token`, `user_email`, `user_id` from storage.
- Keeps `remembered_email` for future prefill.
- Resets all context state and channel-specific last-known contexts.

---

## 4. Channel Adapters

### 4.1 WhatsApp Adapter (`adapters/whatsapp-adapter.js`)

#### 4.1.1 Identity Extraction (5 strategies, in order)

1. **Header title span**: Reads `#main header span[title]` for the contact's display name.
2. **Phone from header**: Looks for `span[title*="+"]` in the header area.
3. **Header spans with phone patterns**: Scans all `#main header span[title]` for regex `/\+?\d[\d\s\-()]{6,}/`.
4. **Name-as-phone detection**: If the display name itself matches a phone pattern (unsaved contacts), treats it as a phone number.
5. **Drawer/info panel**: Checks `[data-testid="phone-number"]` for phone when the contact info panel is open.
6. **Message `data-id` attributes**: Extracts phone from `data-id` attributes on message elements (format: `digits@...`).

#### 4.1.2 Group Chat Detection

- Checks for group icons (`data-icon="default-group"` or `data-icon="group"`).
- Checks for participant/member count in header.
- Checks if the subtitle contains comma-separated names (group member list).
- Group chats are detected and flagged — the side panel shows "Group chat detected" notice.

#### 4.1.3 Message Reading

- Reads last 30 `[data-id]` elements from `#main`.
- Determines direction from `data-id` prefix (`true_` = outbound, `false_` = inbound) or CSS class (`message-out`/`message-in`).
- Extracts text from `span.selectable-text`.
- Parses timestamps from `[data-pre-plain-text]` attributes (format: `[HH:MM, DD/MM/YYYY]`).

#### 4.1.4 Performance: Instant Switching (Phase D Optimization)

Three detection mechanisms ensure sub-second context switching:

1. **Header MutationObserver** (`startHeaderObserver()`):
   - Watches `#main header span[title]` for `title` attribute changes.
   - Also watches the parent `<header>` for child list/subtree mutations (when header element is replaced).
   - Fires `processActiveChat()` **immediately** on any change — no debounce.
   - Retries every 500ms until the header element is available.

2. **Chat List Click Listener** (`startChatListClickListener()`):
   - Capture-phase click listener on `document`.
   - Detects clicks on chat row selectors: `[data-testid="cell-frame-container"]`, `[data-testid="list-item"]`, `div[tabindex="-1"][role="listitem"]`, `#pane-side [role="row"]`, `#pane-side div[tabindex]`.
   - Fires `processActiveChat()` after 80ms DOM settle delay.

3. **Background Polling** (safety net only):
   - `setInterval(processActiveChat, 4000)` — runs every 4 seconds.
   - Acts as fallback in case MutationObserver or click listener miss a change.

#### 4.1.5 State Resilience

- **Consecutive no-chat threshold**: `MAX_NO_CHAT_MISSES_BEFORE_CLEAR = 3` consecutive polling cycles.
- **Minimum duration**: `MIN_NO_CHAT_DURATION_MS = 8000` (8 seconds) before clearing context.
- **Sticky keepalive**: Same contact + same messages → no re-send. Periodic log every 10s.
- **General MutationObserver**: Watches `#app` or `document.body` with 400ms debounce (slower than header observer — used for launcher injection and general DOM changes).

#### 4.1.6 Floating Launcher

- A persistent `⚡` button at bottom-right of WhatsApp Web.
- Shows a green dot badge when an active context is detected.
- Clicking opens the side panel via `chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' })`.
- Styled with gradient background (`#6366f1` to `#8b5cf6`), hover animation, and tooltip.
- Survives SPA re-renders via the MutationObserver.

#### 4.1.7 Insert into Compose

- Finds the compose box via `#main footer div[contenteditable="true"]` or `div[data-tab="10"]`.
- Uses `document.execCommand('insertText')` to insert text.
- Dispatches an `input` event to trigger WhatsApp's internal state update.

### 4.2 Gmail Adapter (`adapters/gmail-adapter.js`)

#### 4.2.1 Thread Detection

- Checks for thread subject element: `h2[data-thread-perm-id]` or `h2.hP`.
- Builds a **thread signature** from: `subject::contactEmail::last3MessagesTail`.
- Same-thread refreshes are throttled to every 10 seconds (`SAME_THREAD_REFRESH_MS`).

#### 4.2.2 Identity Extraction

- Reads sender email from `span[email]` attributes on message cards.
- Determines current user's email from Google Account link aria-label or page title.
- The first non-self sender email becomes the `contactIdentifier`.

#### 4.2.3 Message Reading

- Reads `[data-message-id]` or `.gs` elements.
- Extracts sender name, email, body text (first 500 chars), and timestamp.
- Direction determined by comparing sender email to current user email.

#### 4.2.4 In-Page Widget

- Injected below the thread subject heading.
- Shows: reply status badge (with color), contact name, lead type, and action buttons (Suggest, Log, Panel).
- **Suggest**: Clicks reply button and inserts suggested text after 500ms delay.
- **Log**: Creates a CRM activity entry with `activity_type: 'email'` and thread subject.
- **Panel**: Opens the side panel.

#### 4.2.5 Context Clearing

- `consecutiveNoThreadReads` counter with threshold of `MAX_NO_THREAD_MISSES = 3`.
- When user navigates away from a thread, context is cleared after 3 consecutive no-thread reads.
- Widget is removed from the page.

#### 4.2.6 Polling

- `setInterval(pollThread, 3000)` — every 3 seconds.
- `setTimeout(pollThread, 1500)` — initial poll 1.5s after load.
- `visibilitychange` listener: polls 300ms after tab becomes visible.

#### 4.2.7 Insert into Reply

- Finds compose body via `div[aria-label="Message Body"]` or `div[g_editable="true"]`.
- Uses `document.execCommand('insertText')`.

---

## 5. Background Service Worker (`background.js`)

### 5.1 Message Handler

The background script processes these message types:

| Message Type | Description |
|---|---|
| `AUTH_LOGIN` | Authenticate with email/password |
| `AUTH_LOGOUT` | Clear auth state |
| `AUTH_STATUS` | Check current auth status |
| `GET_REMEMBERED_EMAIL` | Retrieve prefilled email |
| `GET_LEAD_TYPES` | Return valid lead type list (7 types) |
| `LOOKUP_CONTACT_PHONE` | Find CRM contact by phone |
| `LOOKUP_CONTACT_EMAIL` | Find CRM contact by email |
| `LOOKUP_CONTACT_NAME` | Find CRM contacts by name |
| `GET_CONTACT_TIMELINE` | Fetch activities, orders, follow-up states for a contact |
| `EVALUATE_FOLLOWUP` | Run follow-up engine on provided context |
| `GENERATE_SUGGESTION` | Generate rule-based message suggestion |
| `AI_SUGGEST` | Generate AI-powered message via `zazi-copilot` edge function (Phase D) |
| `LOG_ACTIVITY` | Create a `contact_activities` record (requires `contact_id`) |
| `CREATE_CONTACT` | Create a new CRM contact |
| `UPDATE_CONTACT` | Update an existing CRM contact (inline editing) |
| `SYNC_FOLLOWUP_STATE` | Upsert follow-up state for a contact/channel |
| `SAVE_CONTACT_MAPPING` | Persist conversation-to-contact mapping |
| `CONTEXT_CLEAR_REQUEST` | Request to clear the active context |
| `CHAT_CONTEXT_UPDATE` | Full context update from an adapter |
| `OPEN_SIDE_PANEL` | Open the Chrome side panel |

### 5.2 `CHAT_CONTEXT_UPDATE` Flow (Core Logic)

This is the most important message handler. When an adapter detects a chat/thread:

1. **Validate payload strength**: Reject weak/empty payloads to prevent false clears.
2. **CRM Contact Matching** (ordered):
   - **WhatsApp**: exact phone → suffix phone (last 9 digits) → name-as-phone → persistent mapping → name fallback
   - **Gmail**: exact email → persistent mapping → name fallback
3. **Compute reply status**: Analyze message timestamps to determine `awaiting_my_reply`, `awaiting_their_reply`, `replied_recently`, `stale`, or `unknown`.
4. **Count follow-up attempts**: Count consecutive outbound messages without inbound reply.
5. **Build follow-up context**: Combine reply status, lead type, registration status, purchase history, temperature.
6. **Check purchase history**: Query last order for `hasPurchased` flag and `lastProduct`.
7. **Evaluate recommendation**: Run `FollowUpEngine.evaluate(context)`.
8. **Generate message suggestion**: Run `MessageSuggestions.generate(params)`.
9. **Sync follow-up state**: Upsert to `follow_up_states` table if contact matched.
10. **Build context payload**: Package everything for the side panel.
11. **Store context**: Save to `chrome.storage.local` as `current_context` and channel-specific `last_known_good_*_context`.
12. **Save persistent mapping**: Store `conversationKey → contactId` for future lookups.

### 5.3 Channel-Aware State Model

```
chrome.storage.local:
  ├── current_channel          // 'whatsapp' | 'gmail' | null
  ├── current_context          // Active context payload (or { cleared: true, clearReason: ... })
  ├── last_known_good_whatsapp_context  // Last valid WhatsApp context
  ├── last_known_good_gmail_context     // Last valid Gmail context
  └── contact_mappings         // { "whatsapp:+27123456789": "uuid", "gmail:user@example.com": "uuid" }
```

**Isolation rules:**
- One channel's adapter cannot wipe the other channel's active context.
- Weak/empty payloads are blocked if a valid context exists for that channel.
- Context clear requests require an allowed reason AND sufficient consecutive misses.
- A 10-second grace window (`CLEAR_GRACE_MS`) prevents premature clears after a valid detection.

### 5.4 Context Clear Conditions

Context is only cleared under these explicit conditions:

| Reason | Requirements |
|---|---|
| `confirmed_no_active_chat` | ≥3 consecutive misses AND outside grace window |
| `chat_switched` | Adapter detects a different contact |
| `tab_unloaded` | Tab is closed or `beforeunload` fires |
| `explicit_reset` | Manual reset triggered |
| `tab_switch_no_cached_context` | Tab activated but no cached context for that channel |

Non-active channel clear requests are blocked: if the requesting channel ≠ current active channel, the clear only wipes that channel's `last_known_good` context.

### 5.5 Tab Activation — Instant Channel Switching

```javascript
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  // Detect channel from URL
  if (url.includes('web.whatsapp.com')) newChannel = 'whatsapp';
  else if (url.includes('mail.google.com')) newChannel = 'gmail';
  
  // Promote last-known-good context for this channel
  // Or set cleared state if no cached context exists
});
```

### 5.6 Persistent Contact Mappings

- Stored in `chrome.storage.local` under `contact_mappings`.
- Key format: `{channel}:{identifier}` (e.g., `whatsapp:27123456789`, `gmail:user@example.com`).
- When a contact is matched or created, mappings are saved for both the identifier and the display name.
- On subsequent conversations with the same person, the mapping is checked before doing a full CRM search.

### 5.7 Session Management

- Session refresh alarm runs every 30 minutes via `chrome.alarms`.
- Tab removal listener (`chrome.tabs.onRemoved`) clears context if the removed tab was the source.

---

## 6. Side Panel (`sidepanel.html` / `sidepanel.js`)

### 6.1 Layout Sections

1. **Header**: Logo, title ("Zazi Copilot"), connection status badge, logout button.
2. **Login Section**: Email + password form (prefilled with remembered email), login error display.
3. **Connected Section**:
   - **User bar**: Shows logged-in email.
   - **Context Section**:
     - **Empty state**: "Open a WhatsApp chat or Gmail thread to get started"
     - **Group chat notice**: "Group chat detected — the Copilot works with 1:1 chats only"
     - **Active context**:
       - **Channel Badge**: `💬 WhatsApp` or `📧 Gmail`
       - **Contact Card**: Name, lead type badge (icon + color + label), temperature, communication status.
       - **Edit Contact Button** (✏️): Opens inline edit form.
       - **Lead Type Intelligence Bar**: Contextual hints based on lead type and registration status.
       - **No CRM Match Warning**: With inline "+ Create Contact" button.
       - **Inline Create Contact Form**: Name, phone, email, lead type selector → creates in CRM and links.
       - **Inline Edit Contact Form**: Name, phone, lead type dropdown → updates CRM immediately.
       - **Candidate Matches**: Buttons for multiple possible matches (up to 5).
     - **Reply Status Badge**: Color-coded status (Reply Needed, Awaiting Reply, Active, Stale, Unknown).
     - **Message Summary**: Last inbound and outbound message previews.
     - **Recommendation Card**: Next action badge + reason text.
     - **Smart Reply Section**:
       - Tone selector (Warm / Direct / Professional)
       - Objective selector (Check-in / Close / Reorder / Onboarding / Reminder / Activation / Revival / Objection)
       - ↻ Regenerate button (rule-based)
       - 🤖 AI button (Phase D — LLM-generated)
       - Suggestion text display with AI indicator badge
       - Action buttons: 📋 Copy, 📥 Insert, 📝 Log, 💾 Draft
     - **Recent Messages**: Last 10 messages with direction indicators (inbound/outbound).
   - **Timeline Section**: Activity history and order history for matched contact.

### 6.2 Context Polling

- Polls `chrome.storage.local` every **1.5 seconds** (reduced from 2s).
- **isEditing guard**: If user is editing or creating a contact, ALL rendering updates are skipped.
- Validates context freshness (max age: 120 seconds).
- Falls back to `lastKnownByChannel` contexts within a 30-second grace window (`REFRESH_GRACE_MS`).
- Only re-renders when the context timestamp changes.

### 6.3 Strict Channel Isolation in Side Panel

The side panel enforces **absolute channel isolation**:

```javascript
// ABSOLUTE CHANNEL ISOLATION: If ctx is from a different channel than current, NEVER render it
if (currentChannel && ctx.channel && ctx.channel !== currentChannel) {
  rememberLastKnownContext(ctx);  // Store for its own channel only
  console.log('[Zazi SP] BLOCKED cross-channel render');
  return;
}
```

- Cross-channel payloads are stored for their respective channel but **never rendered**.
- Fallback contexts only come from the **same channel** as `currentChannel`.
- This prevents Gmail data from appearing in WhatsApp and vice versa.

### 6.4 Lead Type Intelligence

The side panel displays lead-type-specific intelligence:

| Lead Type | Icon | Color | Hint | Follow-Up Path |
|---|---|---|---|---|
| Prospect | 🎯 | `#6b7280` | Prospecting / conversion path | Conversion-focused messaging |
| Registered_Nopurchase | 📋 | `#f59e0b` | Activation / first-purchase follow-up | Help them make first purchase |
| Purchase_Nostatus | 🛒 | `#3b82f6` | Status follow-up needed | Follow up on activation status |
| Purchase_Status | ✅ | `#22c55e` | Support / reorder / progression | Reorder, support, team building |
| Expired | ⏰ | `#ef4444` | Reactivation path | Reactivation messaging |
| Customer | 🤝 | `#10b981` | Support / reorder | Customer care, reorders |
| Distributor | 🌟 | `#8b5cf6` | Team support / progression | Leadership development |

Additional intelligence lines show:
- Registration status (Not Registered / Registered / Activated)
- GO Status (if available)
- Contextual action hints per lead type

### 6.5 CRM Actions

#### 6.5.1 Copy (`📋 Copy`)
- Copies the current suggestion text to clipboard.
- Flash feedback: "✅ Copied!" for 1.5s.

#### 6.5.2 Insert (`📥 Insert`)
- Sends the suggestion text to the active tab's content script via `chrome.tabs.sendMessage`.
- WhatsApp: Inserts into compose box.
- Gmail: Inserts into reply compose area.
- Flash feedback: "✅ Inserted!"

#### 6.5.3 Log (`📝 Log`)
- Creates a `contact_activities` record with:
  - `activity_type`: `whatsapp` or `email` (based on channel)
  - `summary`: Channel + follow-up action badge
  - `notes`: Reply status, lead type, suggestion text (up to 300 chars)
  - `next_action`: Recommendation reason
- Requires a linked contact (shows "⚠️ No contact linked" if none).
- Refreshes timeline after successful logging.
- Flash feedback: "✅ Logged!" or "❌ Error"

#### 6.5.4 Save as Draft (`💾 Draft`)
- Creates a `contact_activities` record with:
  - `activity_type`: `draft`
  - `summary`: "Draft {channel} reply for {contactName}"
  - `notes`: Suggestion text (up to 500 chars)
  - `next_action`: Recommendation action
- Requires a linked contact.
- Flash feedback: "✅ Saved!" or "❌ Error"

#### 6.5.5 Regenerate (`↻`)
- Re-generates the rule-based message suggestion with the currently selected tone and objective.
- Hides the AI indicator badge.

#### 6.5.6 AI Suggest (`🤖 AI`) — Phase D

- Calls `AI_SUGGEST` message handler in background.
- Sends to `zazi-copilot` edge function with:
  - Contact data (name, lead type)
  - Last 6 messages (direction + text)
  - Selected tone and objective
  - Channel-specific formatting instructions
- Parses SSE response stream to extract full AI-generated text.
- On success: displays AI text + shows "AI ✨" indicator badge.
- On failure: falls back to rule-based regeneration + flashes "⚠️" warning.
- **Human-in-the-loop**: AI text only populates the suggestion box — never auto-sent.

### 6.6 Inline Contact Editing (Phase D)

When a matched contact is displayed:

1. **Edit button** (✏️) appears next to the contact card.
2. Clicking sets `isEditing = true` and shows the edit form.
3. Form fields:
   - **Name** (`full_name`): text input, required
   - **Phone** (`phone_number`): text input
   - **Lead Type** (`lead_type`): dropdown with 7 CRM schema values
4. On **Save**:
   - Sends `UPDATE_CONTACT` message to background → `SupabaseClient.updateContact()` → PATCH request.
   - On success: updates in-memory context, recalculates recommendation via `FollowUpEngine.evaluate()`, regenerates suggestion via `MessageSuggestions.generate()`, persists to storage, re-renders.
   - Sets `isEditing = false` to resume background polling.
5. On **Cancel**: hides form, sets `isEditing = false`.
6. **Error handling**: Shows inline error message if update fails.

### 6.7 Inline Contact Creation

When no CRM match is found:

1. "No CRM match found" warning appears with "+ Create Contact" button.
2. Clicking sets `isEditing = true` and shows the create form prefilled with:
   - Name (from WhatsApp display name or Gmail sender name)
   - Phone (from WhatsApp identity extraction)
   - Email (from Gmail sender email)
   - Lead Type dropdown (defaults to "Prospect")
3. On "Create & Link":
   - Creates the contact via `CREATE_CONTACT` → `SupabaseClient.createContact()`.
   - Immediately links the new contact to the current conversation context.
   - Saves persistent mappings for both identifier and name.
   - Sets `isEditing = false`, re-renders with new contact.
   - Forces the adapter to re-send context via `force_refresh` message.

### 6.8 isEditing State Guard

**Critical for UX stability.** The `isEditing` boolean prevents background polling from overwriting user input:

```javascript
async function pollContext() {
  if (isEditing) return; // Skip ALL rendering updates
  // ... normal polling logic
}
```

- Set to `true` when: Edit form opened, Create form opened.
- Set to `false` when: Save succeeds, Cancel clicked, Create succeeds.
- While `isEditing === true`: No context re-renders, no DOM updates, no fallback context loading.

---

## 7. Follow-Up Intelligence Engine (`lib/followup-engine.js`)

### 7.1 Input Context

```javascript
{
  replyStatus,           // 'awaiting_my_reply' | 'awaiting_their_reply' | 'replied_recently' | 'stale' | 'unknown'
  hoursSinceLastInbound, // hours since their last message (or null)
  hoursSinceLastOutbound,// hours since my last message (or null)
  leadTemperature,       // 'Hot' | 'Warm' | 'Cold'
  leadType,              // 'Prospect' | 'Registered_Nopurchase' | 'Purchase_Nostatus' | 'Purchase_Status' | 'Expired' | 'Customer' | 'Distributor'
  registrationStatus,    // 'Not Registered' | 'Registered' | 'Activated'
  hasPurchased,          // boolean
  followUpAttempts,      // number of consecutive outbound messages without reply
  lastReplyTone,         // 'positive' | 'negative' | 'neutral' | null
}
```

### 7.2 Decision Matrix (10 Rules)

| Priority | Condition | Action | Urgency | Badge | Suggested Objective |
|---|---|---|---|---|---|
| 1 | `awaiting_my_reply` | `reply_now` | critical | ⚡ Reply Now | Depends on tone |
| 2 | `awaiting_their_reply` < 24h | `wait` | low | ⏳ Waiting | — |
| 3 | `awaiting_their_reply` 24-72h | `gentle_followup` | medium | 🔔 Follow Up | reminder |
| 4 | `awaiting_their_reply` 3-7d | `stronger_checkin` | high | 🔴 Check In | check-in |
| 5 | `followUpAttempts ≥ 3` | `move_to_nurture` | low | ❄️ Nurture | revival |
| 6 | `awaiting_their_reply` ≥ 14d | `escalate_to_call` | high | 📞 Call | check-in |
| 7 | `replied_recently` | `continue_conversation` | medium | 💬 Active | context-dependent |
| 8 | `leadType === 'Expired'` | `reactivation` | low | 🔄 Reactivate | revival |
| 9 | `hasPurchased && stale` | `support_reorder` | medium | 🛒 Reorder | reorder |
| 10 | `stale/unknown` | `initial_outreach` | low | 📨 Reach Out | check-in |

### 7.3 Reply Status Computation

```
No messages at all           → 'unknown'
Only inbound, no outbound    → 'awaiting_my_reply'
Only outbound, no inbound    → 'awaiting_their_reply'
Inbound newer than outbound  → 'awaiting_my_reply'
Outbound newer, < 4h ago     → 'replied_recently'
Outbound newer, > 14 days    → 'stale'
Otherwise                    → 'awaiting_their_reply'
```

### 7.4 Configurable Thresholds (`lib/config.js`)

```javascript
FOLLOW_UP_THRESHOLDS: {
  PROMPT_REPLY_HOURS: 24,        // Wait before first follow-up
  GENTLE_FOLLOWUP_HOURS: 72,     // Gentle follow-up window
  STRONGER_CHECKIN_DAYS: 7,      // Stronger check-in threshold
  STALE_DAYS: 14,                // Conversation considered stale
  DEAD_DAYS: 30,                 // Conversation considered dead
}
```

---

## 8. Message Suggestion Engine (`lib/message-suggestions.js`)

### 8.1 Template Matrix

**8 Objectives:**
1. `check-in` — General follow-up
2. `close` — Move to decision/purchase
3. `reorder` — Existing customer reorder
4. `onboarding` — New member welcome
5. `reminder` — Gentle nudge
6. `activation` — Post-registration activation
7. `revival` — Re-engage dormant contact
8. `objection-handling` — Address concerns

**3 Tones:**
1. `warm` — Friendly, emoji-inclusive, personal
2. `direct` — Business-focused, concise
3. `professional` — Formal, respectful

**2 Channels:**
- Each template has a `whatsapp` variant (shorter, emoji-friendly, conversational) and an `email` variant (with subject line, 4-6 sentences, formal structure).

**Total: 8 × 3 × 2 = 48 unique message variants.**

### 8.2 Merge Fields

- `{name}` — Contact's first name (split from full name)
- `{fullName}` — Contact's full name
- `{product}` — Last ordered product (or "our products" as fallback)

### 8.3 Suggestion Selection

The follow-up engine provides `suggestedTone` and `suggestedObjective` based on conversation state. The user can override via dropdowns in the side panel and click ↻ to regenerate.

---

## 9. AI Copilot — Phase D (`SupabaseClient.callAISuggest`)

### 9.1 Architecture

The AI suggestion system calls the `zazi-copilot` edge function with `action: 'suggest_message'`.

### 9.2 Prompt Construction

```
Generate a {tone} {channel} follow-up message for this contact.

Contact: {full_name}
Lead Type: {leadType}
Objective: {objective}
Channel: {channel}

Recent conversation:
{last 6 messages with direction labels}

{Channel-specific formatting instruction}

Output ONLY the message text — no quotes, no labels, no markdown.
```

**Channel-specific instructions:**
- WhatsApp: "Keep it short, conversational, max 3-4 sentences. Use appropriate emoji."
- Gmail: "Write a professional email body, 4-6 sentences."

### 9.3 SSE Stream Parsing

The edge function returns a Server-Sent Events stream. The client:
1. Gets a `ReadableStream` reader from `res.body`.
2. Decodes chunks with `TextDecoder`.
3. Splits on newlines, finds `data: ` prefixed lines.
4. Parses JSON, extracts `choices[0].delta.content`.
5. Concatenates all content chunks into `fullText`.
6. Returns `{ success: true, text: fullText.trim() }`.

### 9.4 Fallback Behavior

If the AI request fails (network error, timeout, edge function error):
1. The 🤖 AI button flashes "⚠️" for 2 seconds.
2. The rule-based regenerate button is automatically clicked.
3. The user sees a rule-based suggestion instead.

### 9.5 Human-in-the-Loop

**AI messages are NEVER auto-sent.** The generated text only appears in the suggestion text box. The user must:
- Review the message
- Optionally regenerate (rule-based or AI)
- Explicitly click "Insert" to place it in the compose box, or "Copy" to clipboard

---

## 10. Supabase Client (`lib/supabase-client.js`)

### 10.1 Design

A lightweight REST client that uses `fetch()` directly against the Supabase PostgREST API. No npm dependencies — designed for Chrome extension environment.

### 10.2 API Methods

| Method | HTTP | Description |
|---|---|---|
| `init()` | — | Load tokens from `chrome.storage.local` |
| `login(email, password)` | POST | Authenticate via Supabase Auth token endpoint |
| `logout()` | — | Clear auth state from storage |
| `refreshSession()` | POST | Refresh access token using refresh token |
| `_query(table, params)` | GET | Generic PostgREST query with auto-retry on 401 |
| `_insert(table, row)` | POST | Insert with `Prefer: return=representation` |
| `_update(table, id, updates)` | PATCH | Update by ID with `Prefer: return=representation` |
| `_upsert(table, row, onConflict)` | POST | Upsert with `resolution=merge-duplicates` |
| `findContactByPhone(phone)` | GET | Exact `phone_normalized` → suffix match → raw `phone_number` |
| `findContactByEmail(email)` | GET | Exact `email_normalized` → case-insensitive `email_address` |
| `findContactByName(name)` | GET | Case-insensitive LIKE on `full_name` (up to 5 results) |
| `getContactActivities(contactId)` | GET | Fetch 20 recent activities for a contact |
| `getContactOrders(contactId, limit)` | GET | Fetch recent orders for a contact |
| `logActivity(params)` | POST | Insert into `contact_activities` |
| `createContact(params)` | POST | Insert into `contacts` with sensible defaults |
| `updateContact(contactId, updates)` | PATCH | Update contact fields by ID |
| `upsertFollowUpState(state)` | POST | Upsert into `follow_up_states` (conflict: `user_id,contact_id,channel`) |
| `getFollowUpStates(contactId)` | GET | Fetch follow-up states for a contact |
| `callAISuggest(params)` | POST | Call `zazi-copilot` edge function, parse SSE stream |

### 10.3 Phone Matching Logic (3-tier)

1. **Exact match**: Strip non-digits → query `phone_normalized=eq.{digits}`.
2. **Suffix match**: Take last 9 digits → query `phone_normalized=like.*{suffix}` (handles different country codes like `+27` vs `0` prefix).
3. **Raw field match**: Query `phone_number=like.*{suffix}` (for contacts with unnormalized phone data).

### 10.4 Auto-Retry on 401

All `_query` calls check for 401 status → attempt `refreshSession()` → retry the query with new token.

### 10.5 Contact Creation Defaults

When creating a contact via the extension, these defaults are applied:
```javascript
{
  lead_temperature: 'Warm',
  communication_status: 'New',
  registration_status: 'Not Registered',
  interest_level: 'Medium',
  focus_area: 'Health Transformation',
  lead_path: 'Not sure yet',
  country: 'South Africa',
}
```

---

## 11. CRM Database Tables Used

### 11.1 `contacts`
Primary contact table. Key fields used by the extension:
- `id`, `user_id`, `full_name`, `phone_number`, `email_address`
- `phone_normalized`, `email_normalized` (auto-computed by DB trigger)
- `lead_type`, `lead_temperature`, `communication_status`, `registration_status`
- `go_status`, `associate_status`

### 11.2 `contact_activities`
Activity log entries. The extension creates entries with:
- `activity_type`: `whatsapp`, `email`, `draft`, or `note`
- `summary`: Description of the interaction
- `notes`: Additional context (reply status, lead type, suggestion text)
- `next_action`: Recommended next step

### 11.3 `orders`
Order history. Used to determine `hasPurchased` and `lastProduct` for message generation.

### 11.4 `follow_up_states`
Tracks the follow-up state per contact per channel:
- `reply_status`, `last_inbound_at`, `last_outbound_at`
- `follow_up_attempts`, `recommended_action`, `last_message_preview`

### 11.5 RLS Policies
All tables use Row-Level Security scoped to `auth.uid() = user_id`. The extension authenticates as the user, so all queries are automatically scoped to the logged-in user's data.

---

## 12. Cross-Channel State Management

### 12.1 Problem

WhatsApp and Gmail are separate tabs. Both adapters send context updates to the same background worker. Without isolation:
- Switching from WhatsApp to Gmail could wipe WhatsApp context.
- Temporary DOM parse misses could show "no context" or wrong-channel data.

### 12.2 Solution: Channel-Aware Sticky State

```
current_channel                    → Which channel is currently active
current_context                    → The active context payload
last_known_good_whatsapp_context   → Last valid WhatsApp context
last_known_good_gmail_context      → Last valid Gmail context
```

**Rules:**
1. A context update from channel X only promotes to `current_context` if:
   - The current channel IS that channel, OR
   - There is no existing context, OR
   - The user explicitly switched tabs.
2. Weak/empty payloads are blocked if a valid context exists for that channel.
3. A channel's clear request cannot wipe the other channel's context.
4. The side panel uses a fallback mechanism: if `current_context` is invalid/stale, it checks `lastKnownByChannel` within a 30-second grace window.
5. **Cross-channel payloads are NEVER rendered** — they are stored for their own channel's fallback only.

### 12.3 Timing Parameters

| Parameter | Value | Location | Purpose |
|---|---|---|---|
| `CLEAR_GRACE_MS` | 10s | background.js | Don't clear if valid context was set within this window |
| `MIN_NO_CHAT_DURATION_MS` | 8s | whatsapp-adapter.js | Minimum no-chat duration before clearing |
| `MAX_NO_CHAT_MISSES_BEFORE_CLEAR` | 3 | whatsapp-adapter.js | Consecutive polls with no chat |
| `MAX_NO_THREAD_MISSES` | 3 | gmail-adapter.js | Consecutive polls with no thread |
| `MAX_CONTEXT_AGE_MS` | 120s | sidepanel.js | Maximum age before context is stale |
| `REFRESH_GRACE_MS` | 30s | sidepanel.js | Fallback context grace window |
| `SAME_THREAD_REFRESH_MS` | 10s | gmail-adapter.js | Throttle same-thread refresh |
| Side panel poll interval | 1.5s | sidepanel.js | How often side panel checks for updates |
| WhatsApp polling | 4s | whatsapp-adapter.js | Background safety net poll |
| Gmail polling | 3s | gmail-adapter.js | Thread detection poll |

---

## 13. Deployment

### 13.1 Installation

1. Download extension files from `public/zazi-copilot-extension/` directory.
2. **IMPORTANT**: Download from GitHub Raw view, NOT from Lovable preview (which injects tracking scripts causing CSP errors).
3. Open Chrome → `chrome://extensions/` → Enable "Developer mode".
4. Click "Load unpacked" → Select the `zazi-copilot-extension` folder.
5. The extension icon appears in the Chrome toolbar.
6. Click the icon to open the side panel and log in with CRM credentials.

### 13.2 Requirements

- Chrome 114+ (for `sidePanel` API)
- Active Vanto Zazi CRM account (email/password)
- WhatsApp Web and/or Gmail open in Chrome tabs

---

## 14. File Inventory

```
public/zazi-copilot-extension/
├── manifest.json                    # Extension manifest (MV3)
├── background.js                    # Service worker (546 lines)
├── sidepanel.html                   # Side panel HTML
├── sidepanel.js                     # Side panel controller (817 lines)
├── sidepanel.css                    # Side panel styles
├── popup.html                       # Popup quick-actions
├── popup.js                         # Popup controller (47 lines)
├── content.css                      # Shared content script styles
├── icon48.png                       # Extension icon (48px)
├── icon128.png                      # Extension icon (128px)
├── adapters/
│   ├── whatsapp-adapter.js          # WhatsApp content script (424 lines)
│   └── gmail-adapter.js             # Gmail content script (343 lines)
└── lib/
    ├── config.js                    # Configuration (12 lines)
    ├── supabase-client.js           # REST client (319 lines)
    ├── followup-engine.js           # Rules engine (205 lines)
    └── message-suggestions.js       # Message templates (226 lines)
```

**Total extension code: ~2,900 lines**

---

## 15. Feature Status

### ✅ Fully Implemented

| Feature | Phase | Details |
|---|---|---|
| Authentication | Phase A | Login, logout, session refresh, email prefill |
| WhatsApp chat detection | Phase A | 5-strategy identity extraction, group detection |
| WhatsApp instant switching | Phase D | Header observer + click listener + polling |
| Gmail thread detection | Phase B | Thread signature-based detection |
| Gmail in-page widget | Phase B | Status badge, suggest, log, panel buttons |
| CRM contact matching | Phase A | Phone (exact + suffix), email, name fallback, persistent mappings |
| Follow-up engine | Phase B | 10-rule decision matrix, 5 reply statuses |
| Rule-based message suggestions | Phase B | 8 objectives × 3 tones × 2 channels |
| **AI-powered message suggestions** | **Phase D** | LLM via zazi-copilot edge function, SSE streaming |
| Copy suggestion | Phase B | Clipboard copy with flash feedback |
| Insert suggestion | Phase B | WhatsApp compose + Gmail reply |
| Log activity | Phase B | Creates `contact_activities` with correct types |
| Save as Draft | Phase B | Creates draft activity linked to contact |
| Inline contact creation | Phase C | Form in side panel, creates + links + persists mapping |
| **Inline contact editing** | **Phase D** | Edit name, phone, lead type with instant CRM sync |
| Lead type display | Phase C | Icon, color, label, intelligence hints |
| Lead type in recommendations | Phase C | Expired → reactivation, etc. |
| Activity timeline | Phase C | Shows recent activities and orders |
| Cross-channel state | Phase C | Isolated contexts, no cross-wipe |
| **Strict channel isolation** | **Phase D** | Absolute block on cross-channel rendering |
| **isEditing state guard** | **Phase D** | Prevents background refresh during edits |
| Persistent mappings | Phase A | Remembered across sessions |
| Login memory | Phase A | Email prefilled on reopen |
| Floating launcher | Phase A | ⚡ button with context badge |
| Tab lifecycle | Phase A | Context cleared on tab close |
| **Tab activation switching** | **Phase D** | Instant channel swap on tab switch |

### 🔜 Planned for Future Phases

| Feature | Details |
|---|---|
| AI conversation summary | Summarize conversation history and recommend actions |
| Smart lead scoring | AI-based lead temperature adjustment |
| Multi-user team features | Team-level pattern sharing |
| Notification system | Badge/notification when follow-up is overdue |
| Offline mode | Queue actions when offline |
| Analytics dashboard | Extension usage metrics |

---

## 16. Known Limitations

1. **WhatsApp DOM dependency**: The adapter relies on WhatsApp Web's DOM structure, which can change without notice.
2. **Gmail DOM dependency**: Gmail's DOM is complex and changes periodically.
3. **No real-time push**: The extension polls every 1.5-4 seconds rather than receiving push notifications.
4. **Single-user scoped**: All data is scoped to the logged-in user via RLS.
5. **No end-to-end encryption awareness**: The extension reads visible DOM text, not encrypted payloads.
6. **Chrome-only**: Built for Chrome/Chromium browsers. Not compatible with Firefox or Safari.
7. **Side panel requires Chrome 114+**: The `sidePanel` API requires Chrome 114 or later.
8. **AI requires edge function**: AI suggestions depend on the `zazi-copilot` edge function being deployed and responsive.

---

## 17. Security Considerations

1. **Auth tokens** are stored in `chrome.storage.local` (encrypted at rest by Chrome).
2. **Supabase anon key** is publishable and safe to include in client code.
3. **RLS policies** ensure users can only access their own data.
4. **No service role key** is used in the extension — all operations go through the anon key + user JWT.
5. **HTTPS only**: All API calls are to `https://` endpoints.
6. **Host permissions** are scoped to only WhatsApp Web, Gmail, and the Supabase project URL.
7. **AI messages are never auto-sent** — human review is always required before insertion.
