# Zazi Follow-Up Copilot — Chrome Extension Full Specification

**Version:** 1.0.0  
**Last Updated:** 2026-03-12  
**Status:** Operational (Phase C complete, pre-AI phase)

---

## 1. Overview

The Zazi Follow-Up Copilot is a Chrome Extension (Manifest V3) that serves as a real-time CRM companion for WhatsApp Web and Gmail. It runs alongside the Vanto Zazi CRM web application and provides intelligent follow-up recommendations, message suggestions, CRM contact matching, activity logging, and conversation state tracking — all without leaving the messaging platform.

### 1.1 Core Value Proposition

- **Zero context-switching**: Users stay in WhatsApp/Gmail while accessing full CRM intelligence.
- **Automatic contact matching**: The extension identifies who you're chatting with and links them to CRM records.
- **Follow-up intelligence**: A rules engine evaluates conversation state and recommends the next best action.
- **Message suggestions**: Pre-built, tone/objective-configurable message templates are generated contextually.
- **Activity logging**: Log interactions and save drafts directly to the CRM from the side panel.
- **Lead type awareness**: CRM lead types (Prospect, Expired, etc.) influence recommendations and are visible at a glance.

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
         ┌──────────────────┐
         │  Supabase Backend │
         │  (Lovable Cloud)  │
         │  - contacts       │
         │  - contact_       │
         │    activities     │
         │  - orders         │
         │  - follow_up_     │
         │    states         │
         └──────────────────┘
```

### 2.2 Component Responsibilities

| Component | File(s) | Role |
|---|---|---|
| **Background Service Worker** | `background.js` | Central orchestrator. Handles auth, CRM lookups, follow-up evaluation, message generation, state management, contact mapping persistence, and tab lifecycle. |
| **WhatsApp Adapter** | `adapters/whatsapp-adapter.js` | Content script injected into `web.whatsapp.com`. Detects active 1:1 chats, extracts contact identity (name + phone), reads visible messages, handles insert-into-compose. |
| **Gmail Adapter** | `adapters/gmail-adapter.js` | Content script injected into `mail.google.com`. Detects open email threads, extracts sender email/name, reads thread messages, handles insert-into-reply, injects in-page widget. |
| **Side Panel** | `sidepanel.html`, `sidepanel.js`, `sidepanel.css` | Primary UI workspace. Shows contact card, lead type intelligence, reply status, recommendations, message suggestions, activity timeline, orders, and inline contact creation form. |
| **Popup** | `popup.html`, `popup.js` | Quick-action menu: Open WhatsApp Web, Open CRM Dashboard, Open Side Panel. |
| **Supabase Client** | `lib/supabase-client.js` | Lightweight REST client for Supabase (no npm). Handles auth (login/logout/refresh), contact queries (phone/email/name), activity logging, order queries, follow-up state sync. |
| **Follow-Up Engine** | `lib/followup-engine.js` | Rules engine that evaluates conversation state and returns recommended action, urgency, tone, and objective. |
| **Message Suggestions** | `lib/message-suggestions.js` | Template-based message generator with 8 objectives × 3 tones × 2 channels = 48 message variants. |
| **Config** | `lib/config.js` | Supabase URL, anon key, and follow-up timing thresholds. |

### 2.3 Manifest Configuration

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "activeTab", "scripting", "tabs", "alarms", "sidePanel"],
  "host_permissions": [
    "https://web.whatsapp.com/*",
    "https://mail.google.com/*",
    "https://urfyfuakgabieellbuce.supabase.co/*"
  ]
}
```

- **Content scripts** are injected at `document_idle` into WhatsApp Web and Gmail.
- **Side panel** is the default panel opened on extension icon click.
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
- Resets all context state.

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
- Parses timestamps from `[data-pre-plain-text]` attributes.

#### 4.1.4 State Resilience

- **Consecutive no-chat threshold**: `MAX_NO_CHAT_MISSES_BEFORE_CLEAR = 3` consecutive polling cycles with no detected chat.
- **Minimum duration**: `MIN_NO_CHAT_DURATION_MS = 12000` (12 seconds) before clearing context.
- **Sticky keepalive**: If the same contact and messages are detected, logs a silent refresh every 10 seconds without re-sending to background.
- **MutationObserver**: Watches DOM changes and debounces (800ms) before re-checking.
- **Polling**: `processActiveChat()` runs every 5 seconds via `setInterval`.

#### 4.1.5 Floating Launcher

- A persistent `⚡` button at bottom-right of WhatsApp Web.
- Shows a green dot badge when an active context is detected.
- Clicking opens the side panel via `chrome.sidePanel.open()`.
- Survives SPA re-renders via the MutationObserver.

#### 4.1.6 Insert into Compose

- Finds the compose box via `#main footer div[contenteditable="true"]` or `div[data-tab="10"]`.
- Uses `document.execCommand('insertText')` to insert text.
- Dispatches an `input` event to trigger WhatsApp's internal state update.

### 4.2 Gmail Adapter (`adapters/gmail-adapter.js`)

#### 4.2.1 Thread Detection

- Checks for thread subject element: `h2[data-thread-perm-id]` or `h2.hP`.
- Builds a **thread signature** from: `subject::contactEmail::last3MessagesTail`.
- Same-thread refreshes are throttled to every 12 seconds (`SAME_THREAD_REFRESH_MS`).

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
- Shows: reply status badge, contact name, lead type, and action buttons (Suggest, Log, Panel).
- "Suggest" clicks reply button and inserts suggested text after 500ms delay.
- "Log" creates a CRM activity entry.
- "Panel" opens the side panel.

#### 4.2.5 Context Clearing

- `consecutiveNoThreadReads` counter with threshold of `MAX_NO_THREAD_MISSES = 3`.
- When user navigates away from a thread, context is cleared after 3 consecutive no-thread reads.
- Widget is removed from the page.

#### 4.2.6 Insert into Reply

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
| `GET_LEAD_TYPES` | Return valid lead type list |
| `LOOKUP_CONTACT_PHONE` | Find CRM contact by phone |
| `LOOKUP_CONTACT_EMAIL` | Find CRM contact by email |
| `LOOKUP_CONTACT_NAME` | Find CRM contacts by name |
| `GET_CONTACT_TIMELINE` | Fetch activities, orders, follow-up states for a contact |
| `EVALUATE_FOLLOWUP` | Run follow-up engine on provided context |
| `GENERATE_SUGGESTION` | Generate message suggestion |
| `LOG_ACTIVITY` | Create a `contact_activities` record |
| `CREATE_CONTACT` | Create a new CRM contact |
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
6. **Evaluate recommendation**: Run `FollowUpEngine.evaluate(context)`.
7. **Generate message suggestion**: Run `MessageSuggestions.generate(params)`.
8. **Sync follow-up state**: Upsert to `follow_up_states` table if contact matched.
9. **Build context payload**: Package everything for the side panel.
10. **Store context**: Save to `chrome.storage.local` as `current_context` and channel-specific `last_known_good_*_context`.
11. **Save persistent mapping**: Store `conversationKey → contactId` for future lookups.

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
- A 15-second grace window prevents premature clears after a valid detection.

### 5.4 Context Clear Conditions

Context is only cleared under these explicit conditions:

| Reason | Requirements |
|---|---|
| `confirmed_no_active_chat` | ≥3 consecutive misses AND ≥12s duration AND outside 15s grace window |
| `chat_switched` | Adapter detects a different contact |
| `tab_unloaded` | Tab is closed or `beforeunload` fires |
| `explicit_reset` | Manual reset triggered |

### 5.5 Persistent Contact Mappings

- Stored in `chrome.storage.local` under `contact_mappings`.
- Key format: `{channel}:{identifier}` (e.g., `whatsapp:27123456789`, `gmail:user@example.com`).
- When a contact is matched or created, mappings are saved for both the identifier and the display name.
- On subsequent conversations with the same person, the mapping is checked before doing a full CRM search.

### 5.6 Tab Lifecycle

- When a tab is closed (`chrome.tabs.onRemoved`), if it was the source of the current context, the context is cleared.
- Session refresh alarm runs every 30 minutes.

---

## 6. Side Panel (`sidepanel.html` / `sidepanel.js`)

### 6.1 Layout Sections

1. **Header**: Logo, title, connection status badge, logout button.
2. **Login Section**: Email + password form (prefilled with remembered email).
3. **Connected Section**:
   - **User bar**: Shows logged-in email.
   - **Context Section**:
     - **Empty state**: "Open a WhatsApp chat or Gmail thread to get started"
     - **Group chat notice**: "Group chat detected — works with 1:1 chats only"
     - **Active context**:
       - **Contact Card**: Name, lead type badge (with icon + color), temperature, communication status.
       - **Lead Type Intelligence Bar**: Contextual hints based on lead type and registration status.
       - **No CRM Match Warning**: With inline "Create Contact" button.
       - **Inline Create Contact Form**: Name, phone, email, lead type selector → creates in CRM and links.
       - **Candidate Matches**: Buttons for multiple possible matches.
     - **Message Summary**: Last inbound and outbound message previews.
     - **Recommendation Card**: Next action badge + reason.
     - **Smart Reply Section**: Tone selector, objective selector, regenerate button, suggestion text, action buttons (Copy, Insert, Log, Draft).
     - **Recent Messages**: Last 10 messages with direction indicators.
   - **Timeline Section**: Activity history and order history for matched contact.

### 6.2 Context Polling

- Polls `chrome.storage.local` every 2 seconds.
- Validates context freshness (max age: 120 seconds).
- Falls back to `lastKnownByChannel` contexts within a 45-second grace window.
- Only re-renders when the context timestamp changes.

### 6.3 Lead Type Intelligence

The side panel displays lead-type-specific intelligence:

| Lead Type | Icon | Hint | Follow-Up Path |
|---|---|---|---|
| Prospect | 🎯 | Prospecting / conversion path | Conversion-focused messaging |
| Registered_Nopurchase | 📋 | Activation / first-purchase follow-up | Help them make first purchase |
| Purchase_Nostatus | 🛒 | Status follow-up needed | Follow up on activation status |
| Purchase_Status | ✅ | Support / reorder / progression | Reorder, support, team building |
| Expired | ⏰ | Reactivation path | Reactivation messaging |
| Customer | 🤝 | Support / reorder | Customer care, reorders |
| Distributor | 🌟 | Team support / progression | Leadership development |

Additional intelligence lines show:
- Registration status (Not Registered / Registered / Activated)
- GO Status (if available)
- Contextual action hints

### 6.4 CRM Actions

#### 6.4.1 Copy (`📋 Copy`)
- Copies the current suggestion text to clipboard.

#### 6.4.2 Insert (`📥 Insert`)
- Sends the suggestion text to the active tab's content script.
- WhatsApp: Inserts into compose box.
- Gmail: Inserts into reply compose area.

#### 6.4.3 Log (`📝 Log`)
- Creates a `contact_activities` record with:
  - `activity_type`: `whatsapp` or `email` (based on channel)
  - `summary`: Channel + follow-up action badge
  - `notes`: Reply status, lead type, suggestion text (up to 300 chars)
  - `next_action`: Recommendation reason
- Requires a linked contact (shows warning if none).
- Refreshes timeline after logging.

#### 6.4.4 Save as Draft (`💾 Draft`)
- Creates a `contact_activities` record with:
  - `activity_type`: `draft`
  - `summary`: "Draft {channel} reply for {contactName}"
  - `notes`: Suggestion text (up to 500 chars)
  - `next_action`: Recommendation action
- Requires a linked contact.

#### 6.4.5 Regenerate (`↻`)
- Re-generates the message suggestion with the currently selected tone and objective.

### 6.5 Inline Contact Creation

When no CRM match is found:

1. "No CRM match found" warning appears with "+ Create Contact" button.
2. Clicking shows an inline form prefilled with:
   - Name (from WhatsApp display name or Gmail sender name)
   - Phone (from WhatsApp identity extraction)
   - Email (from Gmail sender email)
   - Lead Type dropdown (defaults to "Prospect")
3. On "Create & Link":
   - Creates the contact via Supabase REST API.
   - Immediately links the new contact to the current conversation.
   - Saves persistent mapping.
   - Re-renders the side panel with the new contact.
   - Forces the adapter to re-send context.

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

### 7.2 Decision Matrix

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

### 7.4 Configurable Thresholds

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
- Each template has a `whatsapp` variant (shorter, emoji-friendly) and an `email` variant (with subject line).

### 8.2 Merge Fields

- `{name}` — Contact's first name
- `{fullName}` — Contact's full name
- `{product}` — Last ordered product (or "our products")

### 8.3 Suggestion Selection

The follow-up engine provides `suggestedTone` and `suggestedObjective` based on conversation state. The user can override via dropdowns in the side panel and regenerate.

---

## 9. Supabase Client (`lib/supabase-client.js`)

### 9.1 Design

A lightweight REST client that uses `fetch()` directly against the Supabase PostgREST API. No npm dependencies — designed for Chrome extension environment.

### 9.2 API Methods

| Method | Description |
|---|---|
| `init()` | Load tokens from `chrome.storage.local` |
| `login(email, password)` | Authenticate via Supabase Auth |
| `logout()` | Clear auth state |
| `refreshSession()` | Refresh access token using refresh token |
| `findContactByPhone(phone)` | Exact match on `phone_normalized`, then suffix match (last 9 digits), then raw `phone_number` |
| `findContactByEmail(email)` | Exact match on `email_normalized`, then `email_address` (case-insensitive) |
| `findContactByName(name)` | Case-insensitive `LIKE` search on `full_name` (returns up to 5) |
| `getContactActivities(contactId)` | Fetch recent activities for a contact |
| `getContactOrders(contactId)` | Fetch recent orders for a contact |
| `logActivity(params)` | Insert into `contact_activities` |
| `createContact(params)` | Insert into `contacts` with sensible defaults |
| `upsertFollowUpState(state)` | Upsert into `follow_up_states` (conflict on `user_id, contact_id, channel`) |
| `getFollowUpStates(contactId)` | Fetch follow-up states for a contact |

### 9.3 Phone Matching Logic

1. Strip all non-digits from the input.
2. **Exact match**: Query `phone_normalized=eq.{digits}`.
3. **Suffix match**: Take last 9 digits, query `phone_normalized=like.*{suffix}` (handles different country codes).
4. **Raw field match**: Query `phone_number=like.*{suffix}` (for contacts with unnormalized phone data).

### 9.4 Auto-Retry on 401

All queries check for 401 status → attempt token refresh → retry the query.

---

## 10. CRM Database Tables Used

### 10.1 `contacts`

The primary contact table. Key fields used by the extension:
- `id`, `user_id`, `full_name`, `phone_number`, `email_address`
- `phone_normalized`, `email_normalized` (auto-computed by DB trigger)
- `lead_type`, `lead_temperature`, `communication_status`, `registration_status`
- `go_status`, `associate_status`

### 10.2 `contact_activities`

Activity log entries. The extension creates entries with:
- `activity_type`: `whatsapp`, `email`, `draft`, or `note`
- `summary`: Description of the interaction
- `notes`: Additional context (reply status, lead type, suggestion text)
- `next_action`: Recommended next step

### 10.3 `orders`

Order history. Used to determine `hasPurchased` and `lastProduct` for message generation.

### 10.4 `follow_up_states`

Tracks the follow-up state per contact per channel:
- `reply_status`, `last_inbound_at`, `last_outbound_at`
- `follow_up_attempts`, `recommended_action`, `last_message_preview`

### 10.5 RLS Policies

All tables use Row-Level Security scoped to `auth.uid() = user_id`. The extension authenticates as the user, so all queries are automatically scoped to the logged-in user's data.

---

## 11. Cross-Channel State Management

### 11.1 Problem

WhatsApp and Gmail are separate tabs. Both adapters send context updates to the same background worker. Without isolation:
- Switching from WhatsApp to Gmail could wipe WhatsApp context.
- Temporary DOM parse misses in WhatsApp could show "no context" in the side panel.

### 11.2 Solution: Channel-Aware Sticky State

```
current_channel                    → Which channel is currently active
current_context                    → The active context payload
last_known_good_whatsapp_context   → Last valid WhatsApp context
last_known_good_gmail_context      → Last valid Gmail context
```

**Rules:**
1. A context update from channel X only promotes to `current_context` if:
   - The sender tab is the active tab for that channel, OR
   - The current channel IS that channel, OR
   - There is no existing context.
2. Weak/empty payloads are blocked if a valid context exists for that channel.
3. A channel's clear request cannot wipe the other channel's context.
4. The side panel uses a fallback mechanism: if `current_context` is invalid/stale, it checks `lastKnownByChannel` within a 45-second grace window.

### 11.3 Grace Periods

| Parameter | Value | Purpose |
|---|---|---|
| `CLEAR_GRACE_MS` | 15s | Don't clear if valid context was set within this window |
| `MIN_NO_CHAT_DURATION_MS` | 12s | WhatsApp: minimum no-chat duration before clearing |
| `MAX_CONTEXT_AGE_MS` | 120s | Side panel: maximum age before context is considered stale |
| `REFRESH_GRACE_MS` | 45s | Side panel: fallback context grace window |
| `SAME_THREAD_REFRESH_MS` | 12s | Gmail: throttle same-thread refresh |

---

## 12. Deployment

### 12.1 Installation

1. Download extension files from `public/zazi-copilot-extension/` directory.
2. Open Chrome → `chrome://extensions/` → Enable "Developer mode".
3. Click "Load unpacked" → Select the `zazi-copilot-extension` folder.
4. The extension icon (⚡) appears in the Chrome toolbar.

### 12.2 Important Notes

- Files must be downloaded directly from GitHub (Raw view), NOT from the Lovable preview site (which injects tracking scripts that cause CSP errors).
- Developer mode warnings are normal and do not affect functionality.
- The extension requires an active Vanto Zazi CRM account (email/password).

---

## 13. File Inventory

```
public/zazi-copilot-extension/
├── manifest.json                    # Extension manifest (MV3)
├── background.js                    # Service worker (537 lines)
├── sidepanel.html                   # Side panel HTML (176 lines)
├── sidepanel.js                     # Side panel controller (687 lines)
├── sidepanel.css                    # Side panel styles
├── popup.html                       # Popup quick-actions (53 lines)
├── popup.js                         # Popup controller (47 lines)
├── content.css                      # Shared content script styles
├── icon48.png                       # Extension icon (48px)
├── icon128.png                      # Extension icon (128px)
├── adapters/
│   ├── whatsapp-adapter.js          # WhatsApp content script (367 lines)
│   └── gmail-adapter.js             # Gmail content script (339 lines)
└── lib/
    ├── config.js                    # Configuration (12 lines)
    ├── supabase-client.js           # REST client (265 lines)
    ├── followup-engine.js           # Rules engine (205 lines)
    └── message-suggestions.js       # Message templates (226 lines)
```

**Total extension code: ~2,700 lines**

---

## 14. Current Status & What's Done

### ✅ Fully Implemented

| Feature | Status | Details |
|---|---|---|
| Authentication | ✅ Working | Login, logout, session refresh, email prefill |
| WhatsApp chat detection | ✅ Working | 5-strategy identity extraction, group detection |
| WhatsApp sticky state | ✅ Working | 12s debounce, 3-miss threshold, grace windows |
| Gmail thread detection | ✅ Working | Thread signature-based, subject + email + message tail |
| Gmail in-page widget | ✅ Working | Status badge, suggest, log, panel buttons |
| CRM contact matching | ✅ Working | Phone (exact + suffix), email, name fallback, persistent mappings |
| Follow-up engine | ✅ Working | 10-rule decision matrix, 5 reply statuses |
| Message suggestions | ✅ Working | 8 objectives × 3 tones × 2 channels |
| Copy suggestion | ✅ Working | Clipboard copy |
| Insert suggestion | ✅ Working | WhatsApp compose + Gmail reply |
| Log activity | ✅ Working | Creates `contact_activities` with correct types |
| Save as Draft | ✅ Working | Creates draft activity linked to contact |
| Inline contact creation | ✅ Working | Form in side panel, creates + links + persists mapping |
| Lead type display | ✅ Working | Icon, color, label, intelligence hints |
| Lead type in recommendations | ✅ Working | Expired → reactivation, etc. |
| Activity timeline | ✅ Working | Shows recent activities and orders |
| Cross-channel state | ✅ Working | Isolated contexts, no cross-wipe |
| Persistent mappings | ✅ Working | Remembered across sessions |
| Login memory | ✅ Working | Email prefilled on reopen |
| Floating launcher | ✅ Working | ⚡ button with context badge |
| Tab lifecycle | ✅ Working | Context cleared on tab close |

### 🔜 Not Yet Built (Planned for Future Phases)

| Feature | Phase | Details |
|---|---|---|
| AI-powered message suggestions | AI Phase | Replace rule-based templates with LLM-generated suggestions using CRM context |
| AI conversation summary | AI Phase | Summarize conversation history and recommend actions |
| Smart lead scoring | AI Phase | AI-based lead temperature adjustment |
| Inline lead type editing | Future | Edit lead type directly from side panel |
| Multi-user team features | Future | Team-level pattern sharing |
| Notification system | Future | Badge/notification when follow-up is overdue |
| Offline mode | Future | Queue actions when offline |
| Analytics dashboard | Future | Extension usage metrics |

---

## 15. Known Limitations

1. **WhatsApp DOM dependency**: The adapter relies on WhatsApp Web's DOM structure, which can change without notice. Selectors may need updating.
2. **Gmail DOM dependency**: Similarly, Gmail's DOM is complex and changes periodically.
3. **No real-time sync**: The extension polls every 2-5 seconds rather than receiving push notifications.
4. **Single-user scoped**: All data is scoped to the logged-in user via RLS. No team-wide visibility from the extension.
5. **No end-to-end encryption awareness**: The extension reads visible DOM text, not encrypted message payloads.
6. **Chrome-only**: Built for Chrome/Chromium browsers. Not compatible with Firefox or Safari.
7. **Side panel requires Chrome 114+**: The `sidePanel` API requires Chrome 114 or later.

---

## 16. Security Considerations

1. **Auth tokens** are stored in `chrome.storage.local` (encrypted at rest by Chrome).
2. **Supabase anon key** is publishable and safe to include in client code.
3. **RLS policies** ensure users can only access their own data.
4. **No service role key** is used in the extension — all operations go through the anon key + user JWT.
5. **HTTPS only**: All API calls are to `https://` endpoints.
6. **Host permissions** are scoped to only WhatsApp Web, Gmail, and the Supabase project URL.
