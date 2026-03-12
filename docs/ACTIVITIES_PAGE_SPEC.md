# Activities Page — Full Developer Specification

**Product:** Vanto Zazi CRM  
**Version:** 2.0  
**Last Updated:** 2026-03-12

---

## 1. Purpose & Goal

The Activities page is the **relationship health command center** of the CRM. Its primary goal is to ensure **no contact falls through the cracks**. It answers three critical daily questions for the user:

1. **Who have I neglected?** — Contacts with no interaction in 7+ days.
2. **Who have I never spoken to?** — Contacts added but never engaged.
3. **What have I been doing?** — A chronological record of all interactions.

The page is designed for **daily use** — it's the first place a user should check each morning to plan their outreach and the last place they visit to log the day's interactions.

---

## 2. Page Layout (3-Column + Timeline)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header: Title + Stats + [Suggested Outreach] [AI Check] [+ Log]   │
├─────────────────────────────────────────────────────────────────────┤
│  (Conditional) AI Insight Panel (violet-themed)                     │
├───────────────────┬───────────────────┬─────────────────────────────┤
│  Needs Attention  │  Never Contacted  │  Activity Summary           │
│  (Panel 1)        │  (Panel 2)        │  (Panel 3)                  │
├───────────────────┴───────────────────┴─────────────────────────────┤
│  Activity Timeline (full width, scrollable)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Header Bar

**What it shows:**
- Page title: "Activities"
- Subtitle stats: `{totalActivities} activities logged · {neglectedCount} contacts need attention`

**Actions (right-aligned):**

| Button | Color | Icon | Behavior |
|--------|-------|------|----------|
| **Suggested Outreach** | Amber (`bg-amber-600`) | `Zap` | Opens the Message Template Picker for the highest-priority neglected or never-contacted contact (see §5) |
| **AI Relationship Check** | Violet (`bg-violet-600`) | `Sparkles` | Triggers AI analysis of relationship health (see §6) |
| **+ Log Activity** | Teal (`bg-teal-600`) | `Plus` | Opens the Log Activity modal (see §7) |

**Disabled state:** "Suggested Outreach" is disabled when both the neglected and never-contacted lists are empty.

---

### 3.2 Panel 1: "Needs Attention" (Neglected Contacts)

**Goal:** Surface contacts the user hasn't interacted with in **7 or more days**, so they can re-engage before the relationship goes cold.

**Data Source:** `useContactActivities().getNeglectedContacts(7)` cross-referenced with the contacts list.

**Logic:**
1. Scan all records in `contact_activities` table for the current user.
2. For each contact, find the **most recent** activity timestamp.
3. If the most recent activity is older than 7 days from now → the contact is "neglected."
4. Sort results by **Leg assignment priority**: Leg 1 (`Manager_Leg_1`) first, then Leg 2 (`Manager_Leg_2`), then unassigned.
5. Within each leg group, sort by `daysSince` descending (most neglected first).

**Display per row:**
- Contact name (text, clickable → opens Contact Drawer)
- Leg badge: `L1` (teal) or `L2` (slate) — only if assigned
- **Quick action buttons** (right side):
  - WhatsApp icon (green) → opens Message Template Picker for WhatsApp channel
  - Email icon (violet) → opens Message Template Picker for Email channel
- Days since last activity: `{N}d ago` (amber text, right-aligned)
- Subtitle: `{LeadTemperature} · {LeadType}`

**Empty state:** Green checkmark + "All contacts are up to date!"

**Max height:** 320px with overflow-y scroll.

**Interaction:** Clicking the contact name opens the **Contact Drawer** for that contact.

---

### 3.3 Panel 2: "Never Contacted"

**Goal:** Highlight contacts that were added to the CRM but have **zero logged activities ever**. These are prospects who entered the pipeline but were never engaged — a missed opportunity.

**Data Source:** Compare `contacts` list against all `contact_activities` records.

**Logic:**
1. Build a `Set` of all `contact_id` values that appear in any activity record.
2. Filter the contacts list to only those whose `id` is NOT in that set.
3. Sort by Leg assignment (L1 first, L2 second, unassigned last).
4. Cap display at **10 contacts** (to keep the panel manageable).

**Display per row:**
- Contact name (clickable → opens Contact Drawer)
- Leg badge (L1/L2)
- **Quick action buttons** (right side):
  - WhatsApp icon (green) → opens Message Template Picker for WhatsApp
  - Email icon (violet) → opens Message Template Picker for Email
- Subtitle: `{LeadTemperature} · {NextAction || 'No action set'}`

**Empty state:** Green checkmark + "All contacts have been reached!"

**Max height:** 320px with overflow-y scroll.

---

### 3.4 Panel 3: "Activity Summary"

**Goal:** Provide a quick breakdown of the user's activity volume **by type**, so they can see their engagement patterns at a glance.

**Activity Types Tracked:**

| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `whatsapp` | `MessageCircle` | Green (`bg-green-500/20 text-green-400`) | WhatsApp messages sent/received |
| `call` | `Phone` | Cyan (`bg-cyan-500/20 text-cyan-400`) | Phone calls made |
| `meeting` | `Calendar` | Violet (`bg-violet-500/20 text-violet-400`) | In-person or virtual meetings |
| `note` | `FileText` | Slate (`bg-slate-500/20 text-slate-400`) | Internal notes or observations |
| `registration` | `CheckCircle` | Emerald (`bg-emerald-500/20 text-emerald-400`) | Registration/activation events |

**Display:** Each type shows as a row with icon (in colored rounded badge), label (capitalized), and count (total across all time for the user).

---

### 3.5 Activity Timeline

**Goal:** A **chronological feed** of every logged interaction, serving as the user's relationship journal.

**Data Source:** `contact_activities` table, ordered by `created_at DESC`, limited to the **50 most recent** entries.

**Display per entry:**

| Element | Detail |
|---------|--------|
| **Icon** | Activity type icon with colored background pill |
| **Contact Name** | Teal-colored, clickable → opens Contact Drawer |
| **Timestamp** | Relative time (right-aligned) — "Just now", "Xm ago", "Xh ago", "Xd ago", or full date (>7d) |
| **Summary** | The main description of what happened |
| **Notes** | (Optional) Additional context, shown in smaller muted text |
| **Next Action** | (Optional) Clock icon + "Next: {text}" |

**Empty state:** Clock icon + "No activities logged yet. Use 'Log Activity' to record your first interaction."

**Loading state:** Centered Loader2 spinner.

**Interaction:** Clicking any timeline entry opens the Contact Drawer for the associated contact (if `contact_id` is set).

---

## 4. Data Architecture

### 4.1 Database Table: `contact_activities`

```sql
CREATE TABLE contact_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,           -- FK to auth.users
  contact_id  UUID REFERENCES contacts(id),  -- nullable (for general activities)
  activity_type TEXT NOT NULL DEFAULT 'note',
  summary     TEXT NOT NULL DEFAULT '',
  notes       TEXT DEFAULT '',
  next_action TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS Policies:**
- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `auth.uid() = user_id`
- `DELETE`: `auth.uid() = user_id`
- `UPDATE`: **Not enabled** — activities are immutable logs.

### 4.2 Hook: `useContactActivities` (`src/hooks/useContactActivities.ts`)

**Exports:**

| Function | Purpose |
|----------|---------|
| `activities` | Array of all activities for the current user (max 200, newest first) |
| `loading` | Boolean loading state |
| `logActivity(params)` | Insert a new activity record. Fires outbound webhook `activity.created`. Returns `boolean`. |
| `daysSinceLastActivity(contactId)` | Returns number of days since last activity for a specific contact, or `null` if no activities exist |
| `getContactActivities(contactId)` | Returns filtered activities for one contact |
| `getNeglectedContacts(days)` | Returns contacts with last activity older than `days` (default 7), sorted by most neglected. Returns `{ contact_id, lastActivity, daysSince }[]` |
| `refetch()` | Re-fetches all activities from the database |

**logActivity params:**
```typescript
{
  contact_id?: string;     // UUID of the contact (optional)
  activity_type: string;   // 'whatsapp' | 'call' | 'meeting' | 'note' | 'registration'
  summary: string;         // Brief description
  notes?: string;          // Additional details
  next_action?: string;    // Planned follow-up
}
```

### 4.3 Side Effects of Logging an Activity

When a user logs an activity via the modal, **three things happen**:

1. **Activity record created** → inserted into `contact_activities` table
2. **Contact record updated** → the contact's `action_taken`, `next_action`, and `additional_notes` fields are updated on the `contacts` table to reflect the latest interaction
3. **Outbound webhook** event (`activity.created`) is fired via `pushOutboundEvent()` for external integrations

This dual-write ensures that:
- The timeline has the full history (contact_activities)
- The contact record always shows the most recent status (contacts table)

---

## 5. Suggested Outreach (Message Template Picker Integration)

**Trigger:** "Suggested Outreach" button in the header.

**Logic:**
1. Find the highest-priority contact needing outreach:
   - First: top neglected contact (sorted by leg priority, then days since)
   - Fallback: first never-contacted contact
2. Open the `MessageTemplatePicker` component with that contact and `whatsapp` as default channel.

**MessageTemplatePicker capabilities:**
- AI-driven template recommendation based on contact lifecycle (LeadType, Status, inactivity)
- Manual template browser (Welcome, Activation, Rank, etc.)
- "Use My Own Message" custom paste mode with automatic personalization
- Send via `wa.me` or `mailto:` triggers automatic activity logging and `ActionTaken` update
- Rendered messages auto-convert literal `\n` sequences into actual line breaks

---

## 6. Leg Prioritization System

**Context:** In the MLM structure, users manage two "legs" (downline teams). Leg 1 is the user's primary active business leg.

**Implementation:**
```typescript
const legSortOrder = (assignedTo: string | undefined) => {
  if (assignedTo === 'Manager_Leg_1') return 0;  // Highest priority
  if (assignedTo === 'Manager_Leg_2') return 1;  // Secondary
  return 2;  // Unassigned
};
```

**Visual indicators:**
- `L1` badge: `text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400`
- `L2` badge: `text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400`

This sorting applies to both the "Needs Attention" and "Never Contacted" panels.

---

## 7. AI Relationship Check

**Goal:** Provide an AI-generated, personalized action plan that tells the user exactly who to contact, in what order, and what to say.

**Trigger:** "AI Relationship Check" button in the header.

**Data sent to AI:**
```json
{
  "totalContacts": 150,
  "totalActivities": 420,
  "neglectedCount": 12,
  "neverContactedCount": 8,
  "neglectedNames": [
    { "name": "John Doe", "daysSince": 14, "temperature": "Hot" }
  ],
  "neverContacted": [
    { "name": "Jane Smith", "temperature": "Warm", "leadType": "Prospect" }
  ],
  "recentActivities": [
    { "type": "whatsapp", "summary": "Sent product info", "date": "2026-03-07T..." }
  ]
}
```

**AI Prompt:** "Analyze my relationship management health. I have {N} neglected contacts (no activity in 7+ days) and {M} contacts I've never interacted with. Give me a prioritized action plan with specific names and what I should do for each. Focus on Hot leads first, then Warm. Be specific and actionable."

**Backend:** Calls the `zazi-copilot` edge function with `action: 'business_insight'`.

**Response parsing:** The response is an SSE stream. Each `data:` line contains a JSON object with `choices[0].delta.content`. Content chunks are concatenated and rendered as markdown.

**Display:** Rendered in a violet-themed panel (`bg-violet-500/10 border border-violet-500/20 rounded-xl`) below the header with a `Sparkles` icon and "ZAZI Relationship Intelligence" heading. Markdown is rendered via `react-markdown`.

**UX States:**
- **Loading:** Spinner + "Analyzing your relationship health..."
- **Success:** Markdown-rendered insight panel
- **Error:** "Unable to generate AI insights. Please try again."

---

## 8. Log Activity Modal (`src/components/LogActivityModal.tsx`)

**Goal:** Structured form to record any interaction with a contact.

**Trigger:** "+ Log Activity" button (header) or quick action buttons from Contact Drawer / WhatsApp page.

**Form Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Contact | Dropdown (`<select>`, all contacts sorted by name) | Yes | Can be pre-filled via `prefillContactName` prop |
| Activity Type | Button group (5 options, toggle-style) | Yes | Default: `call` |
| Summary | Text input | Yes | Placeholder: "Brief description of the activity" |
| Notes | Textarea (3 rows, no resize) | No | Placeholder: "Additional details..." |
| Next Action | Text input | No | Placeholder: "What's the next step?" |

**Activity Type Button Group:**

| Type | Icon | Active Color | Inactive Color |
|------|------|-------------|----------------|
| WhatsApp | `MessageCircle` | `text-teal-400` | `text-green-400` |
| Call | `Phone` | `text-teal-400` | `text-cyan-400` |
| Meeting | `Calendar` | `text-teal-400` | `text-violet-400` |
| Note | `FileText` | `text-teal-400` | `text-slate-400` |
| Registration | `CheckCircle` | `text-teal-400` | `text-emerald-400` |

Active state: `bg-teal-600/20 border-teal-500/50 text-teal-400`
Inactive state: `bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200`

**On Submit:**
1. Insert record into `contact_activities` table via `logActivity()` hook
2. Update the contact's `action_taken` field: `"{Type}: {Summary} ({date})"`
3. Update contact's `next_action` field (if provided)
4. Update contact's `additional_notes` field (if provided)
5. Fire outbound webhook: `activity.created`
6. Show success state (green `CheckCircle` + "Activity logged successfully!") for 1.2 seconds, then auto-close

**Modal UI:**
- Backdrop: `bg-black/60` (click to close)
- Container: `bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg`
- Header: Teal icon badge + "Log Activity" title + X close button
- Submit button: `bg-teal-600 hover:bg-teal-500` with `Loader2` spinner when loading

---

## 9. Contact Drawer Integration

Every contact name on this page is **clickable** and opens the **Contact Drawer** (`src/components/ContactDrawer.tsx`) — a slide-out panel showing:
- Full contact details (22+ CRM fields)
- Activity history timeline for that specific contact
- Quick actions: Open WhatsApp, Copy Phone, AI Suggest Message, Log Activity, Edit Contact
- "Open Template Picker" button for WhatsApp/Email outreach

The Contact Drawer also supports opening the Message Template Picker. When it does:
1. The drawer closes
2. The Template Picker opens with the contact pre-selected

---

## 10. Time Formatting

```typescript
function formatTimeAgo(dateStr: string) {
  const diffMs = now - date;
  if (mins < 1)   → 'Just now'
  if (mins < 60)  → '{N}m ago'
  if (hours < 24) → '{N}h ago'
  if (days < 7)   → '{N}d ago'
  else            → date.toLocaleDateString()
}
```

---

## 11. Technical Notes

- **Max activities fetched:** 200 (via `useContactActivities` hook). Oldest activities beyond 200 are not shown.
- **Timeline display cap:** 50 entries rendered in the timeline UI. All 200 are used for calculations (neglected, summary stats).
- **Never Contacted cap:** 10 contacts shown in the panel.
- **Neglected threshold:** 7 days (hardcoded).
- **Real-time updates:** Activities list is re-fetched after every new activity is logged via `fetchActivities()`. No websocket/realtime subscription — manual refresh.
- **Outbound webhook:** Every logged activity fires an `activity.created` event via `pushOutboundEvent()` for external system integration.
- **Responsive:** The 3-column layout switches to single column on screens below `lg` breakpoint.
- **Memoization:** `neglectedContacts` and `neverContactedList` are wrapped in `useMemo` to prevent unnecessary recalculations.

---

## 12. File Inventory

| File | Purpose |
|------|---------|
| `src/pages/Activities.tsx` | Main Activities page component (404 lines) |
| `src/components/LogActivityModal.tsx` | Log Activity modal form (162 lines) |
| `src/hooks/useContactActivities.ts` | Activity data hook — fetch, log, analyze (113 lines) |
| `src/components/ContactDrawer.tsx` | Slide-out contact detail panel |
| `src/components/MessageTemplatePicker.tsx` | AI-powered message template selector |

---

## 13. Daily Workflow — How This Page Should Be Used

### Morning Routine (5–10 minutes)
1. **Open Activities page**
2. **Check "Needs Attention"** panel — identify who needs immediate outreach
3. **Check "Never Contacted"** panel — pick 2-3 new contacts to reach out to
4. **Click "Suggested Outreach"** — instantly get a recommended message for the highest-priority contact
5. **Click "AI Relationship Check"** — get a prioritized action plan for the day
6. **Click contacts from the panels** → Contact Drawer opens → use WhatsApp/Call/Email buttons to engage

### During the Day
7. **After every interaction**, click **"+ Log Activity"** to record what happened
8. Set a **Next Action** for each activity (e.g., "Follow up in 3 days", "Send product samples")
9. Use the **WhatsApp/Email quick action buttons** directly from the panels for fast outreach

### Evening Review (2–3 minutes)
10. **Scroll the Activity Timeline** — verify all interactions were logged
11. **Check Activity Summary** — ensure a balanced mix of activity types
12. **Confirm "Needs Attention"** count has decreased from the morning

### Weekly Review
13. Use **AI Relationship Check** to get a strategic overview
14. Review the **Activity Summary** to identify patterns (too many notes, not enough calls?)
15. Address any contacts that have been in "Never Contacted" for more than a week

---

## 14. Success Metrics

The Activities page is working correctly when:
- [ ] Users log at least 5 activities per day
- [ ] "Needs Attention" count trends downward over time
- [ ] "Never Contacted" list empties within 1 week of contact creation
- [ ] Activity Summary shows a healthy mix (not 100% one type)
- [ ] AI Relationship Check produces actionable, name-specific recommendations
- [ ] Suggested Outreach opens the Template Picker with the correct highest-priority contact
