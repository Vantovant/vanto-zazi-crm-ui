# Activities Page — Developer Specification

**Product:** Vanto Zazi CRM  
**Version:** 1.0  
**Last Updated:** 2026-03-08

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
┌─────────────────────────────────────────────────────┐
│  Header: Title + Stats + [AI Relationship Check] [+ Log Activity] │
├─────────────────────────────────────────────────────┤
│  (Conditional) AI Insight Panel                     │
├──────────────┬──────────────┬───────────────────────┤
│  Needs       │  Never       │  Activity             │
│  Attention   │  Contacted   │  Summary              │
│  (Panel 1)   │  (Panel 2)   │  (Panel 3)            │
├──────────────┴──────────────┴───────────────────────┤
│  Activity Timeline (full width, scrollable)         │
└─────────────────────────────────────────────────────┘
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
| **AI Relationship Check** | Violet (`bg-violet-600`) | `Sparkles` | Triggers AI analysis of relationship health (see §6) |
| **+ Log Activity** | Teal (`bg-teal-600`) | `Plus` | Opens the Log Activity modal (see §7) |

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
- Contact name (text, clickable)
- Leg badge: `L1` (teal) or `L2` (slate) — only if assigned
- Days since last activity: `{N}d ago` (amber text, right-aligned)
- Subtitle: `{LeadTemperature} · {LeadType}`

**Empty state:** Green checkmark + "All contacts are up to date!"

**Interaction:** Clicking any row opens the **Contact Drawer** for that contact, allowing immediate follow-up.

**Why this matters for daily use:** This is the user's "accountability list." Every morning they should aim to clear items from this panel by reaching out to neglected contacts. The Leg 1 priority ensures the user's most important business relationships (their primary paying leg in the MLM structure) are always addressed first.

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
- Contact name (clickable)
- Leg badge (L1/L2)
- Subtitle: `{LeadTemperature} · {NextAction || 'No action set'}`

**Empty state:** Green checkmark + "All contacts have been reached!"

**Interaction:** Clicking opens the Contact Drawer.

**Why this matters:** New prospects often get added (via import, WhatsApp sync, or manual entry) but then forgotten. This panel ensures no prospect is invisibly sitting in the database without ever being contacted.

---

### 3.4 Panel 3: "Activity Summary"

**Goal:** Provide a quick breakdown of the user's activity volume **by type**, so they can see their engagement patterns at a glance.

**Activity Types Tracked:**

| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `whatsapp` | `MessageCircle` | Green | WhatsApp messages sent/received |
| `call` | `Phone` | Cyan | Phone calls made |
| `meeting` | `Calendar` | Violet | In-person or virtual meetings |
| `note` | `FileText` | Slate | Internal notes or observations |
| `registration` | `CheckCircle` | Emerald | Registration/activation events |

**Display:** Each type shows as a row with icon, label, and count (total across all time for the user).

**Why this matters:** Users in MLM need to maintain a balanced outreach strategy. If the summary shows 50 WhatsApp messages but 0 calls, the user knows they need to diversify. The summary is a self-coaching tool.

---

### 3.5 Activity Timeline

**Goal:** A **chronological feed** of every logged interaction, serving as the user's relationship journal. This is the single source of truth for "what happened with whom and when."

**Data Source:** `contact_activities` table, ordered by `created_at DESC`, limited to the **50 most recent** entries.

**Display per entry:**
| Element | Detail |
|---------|--------|
| **Icon** | Activity type icon with colored background |
| **Contact Name** | Teal colored, clickable → opens Contact Drawer |
| **Timestamp** | Relative time (e.g., "2h ago", "3d ago") — right-aligned |
| **Summary** | The main description of what happened |
| **Notes** | (Optional) Additional context, shown in smaller muted text |
| **Next Action** | (Optional) Prefixed with clock icon + "Next:", shows planned follow-up |

**Empty state:** Clock icon + "No activities logged yet. Use 'Log Activity' to record your first interaction."

**Loading state:** Centered spinner.

**Interaction:** Clicking any timeline entry opens the Contact Drawer for the associated contact.

**Why this matters for daily use:**
- **Morning review:** Scan recent activities to remember where conversations left off.
- **End of day:** Verify all interactions were logged (if you had 5 calls today, there should be 5 entries).
- **Accountability:** Provides a paper trail that can be reviewed during team check-ins.

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

**RLS Policies:** Users can only SELECT, INSERT, and DELETE their own records (filtered by `user_id = auth.uid()`). UPDATE is not enabled — activities are immutable logs.

### 4.2 Hook: `useContactActivities`

**Location:** `src/hooks/useContactActivities.ts`

**Exports:**
| Function | Purpose |
|----------|---------|
| `activities` | Array of all activities for the current user (max 200, newest first) |
| `loading` | Boolean loading state |
| `logActivity(params)` | Insert a new activity record. Also fires an outbound webhook event. |
| `daysSinceLastActivity(contactId)` | Returns number of days since last activity for a specific contact, or `null` if no activities exist |
| `getContactActivities(contactId)` | Returns filtered activities for one contact |
| `getNeglectedContacts(days)` | Returns contacts with last activity older than `days` (default 7), sorted by most neglected |
| `refetch()` | Re-fetches all activities from the database |

### 4.3 Side Effects of Logging an Activity

When a user logs an activity via the modal, **two things happen**:

1. **Activity record created** → inserted into `contact_activities` table
2. **Contact record updated** → the contact's `action_taken`, `next_action`, and `additional_notes` fields are updated on the `contacts` table to reflect the latest interaction

This dual-write ensures that:
- The timeline has the full history (contact_activities)
- The contact record always shows the most recent status (contacts table)

Additionally, an **outbound webhook** event (`activity.created`) is fired for external integrations.

---

## 5. Leg Prioritization System

**Context:** In the MLM structure, users manage two "legs" (downline teams). Leg 1 is the user's primary active business leg — it generates revenue and requires the most attention.

**Implementation:**
```typescript
const legSortOrder = (assignedTo: string) => {
  if (assignedTo === 'Manager_Leg_1') return 0;  // Highest priority
  if (assignedTo === 'Manager_Leg_2') return 1;  // Secondary
  return 2;  // Unassigned
};
```

**Visual indicators:**
- `L1` badge: Teal background (`bg-teal-500/20 text-teal-400`)
- `L2` badge: Slate background (`bg-slate-500/20 text-slate-400`)

This sorting applies to both the "Needs Attention" and "Never Contacted" panels.

---

## 6. AI Relationship Check

**Goal:** Provide an AI-generated, personalized action plan that tells the user exactly who to contact, in what order, and what to say — based on their actual CRM data.

**Trigger:** "AI Relationship Check" button in the header.

**Data sent to AI:**
```json
{
  "totalContacts": 150,
  "totalActivities": 420,
  "neglectedCount": 12,
  "neverContactedCount": 8,
  "neglectedNames": [
    { "name": "John Doe", "daysSince": 14, "temperature": "Hot" },
    ...
  ],
  "neverContacted": [
    { "name": "Jane Smith", "temperature": "Warm", "leadType": "Prospect" },
    ...
  ],
  "recentActivities": [
    { "type": "whatsapp", "summary": "Sent product info", "date": "2026-03-07T..." },
    ...
  ]
}
```

**AI Prompt:** "Analyze my relationship management health. I have {N} neglected contacts (no activity in 7+ days) and {M} contacts I've never interacted with. Give me a prioritized action plan with specific names and what I should do for each. Focus on Hot leads first, then Warm. Be specific and actionable."

**Backend:** Calls the `zazi-copilot` edge function with `action: 'business_insight'`.

**Response:** Rendered as markdown in a violet-themed panel below the header. The AI typically returns:
- Priority tiers (Hot leads first)
- Specific names with recommended actions
- Timing suggestions
- General relationship health score

**UX States:**
- Loading: Spinner + "Analyzing your relationship health..."
- Success: Markdown-rendered insight panel
- Error: "Unable to generate AI insights. Please try again."

---

## 7. Log Activity Modal

**Goal:** Structured form to record any interaction with a contact.

**Trigger:** "+ Log Activity" button (header) or quick action buttons from Contact Drawer / WhatsApp page.

**Form Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Contact | Dropdown (all contacts) | Yes | Can be pre-filled when opened from a specific contact context |
| Activity Type | Button group (5 options) | Yes | Default: `call` |
| Summary | Text input | Yes | Brief description: "Discussed product pricing" |
| Notes | Textarea (3 rows) | No | Additional context |
| Next Action | Text input | No | Planned follow-up: "Send pricing PDF by Friday" |

**Activity Types:**
- WhatsApp (green) — `MessageCircle` icon
- Call (cyan) — `Phone` icon
- Meeting (violet) — `Calendar` icon
- Note (slate) — `FileText` icon
- Registration (emerald) — `CheckCircle` icon

**On Submit:**
1. Insert record into `contact_activities` table
2. Update the contact's `action_taken` field with formatted string: `"{Type}: {Summary} ({date})"`
3. Update contact's `next_action` field (if provided)
4. Update contact's `additional_notes` field (if provided)
5. Fire outbound webhook: `activity.created`
6. Show success state (green checkmark) for 1.2 seconds, then auto-close

**Pre-fill behavior:** When opened from a specific contact context (e.g., Contact Drawer), the contact dropdown is pre-selected.

---

## 8. Daily Workflow — How This Page Should Be Used

### Morning Routine (5–10 minutes)
1. **Open Activities page**
2. **Check "Needs Attention"** panel — identify who needs immediate outreach
3. **Check "Never Contacted"** panel — pick 2-3 new contacts to reach out to
4. **Click "AI Relationship Check"** — get a prioritized action plan for the day
5. **Click contacts from the panels** to open their Contact Drawer → use WhatsApp/Call buttons to engage

### During the Day
6. **After every interaction**, click **"+ Log Activity"** to record what happened
7. Set a **Next Action** for each activity (e.g., "Follow up in 3 days", "Send product samples")

### Evening Review (2–3 minutes)
8. **Scroll the Activity Timeline** — verify all interactions were logged
9. **Check Activity Summary** — ensure a balanced mix of activity types
10. **Confirm "Needs Attention"** count has decreased from the morning

### Weekly Review
11. Use **AI Relationship Check** to get a strategic overview
12. Review the **Activity Summary** to identify patterns (too many notes, not enough calls?)
13. Address any contacts that have been in "Never Contacted" for more than a week

---

## 9. Interactions & Navigation

Every contact name on this page is **clickable** and opens the **Contact Drawer** — a slide-out panel showing:
- Full contact details (22 fields)
- Activity history for that specific contact
- Quick actions: Open WhatsApp, Copy Phone, AI Suggest Message, Log Activity, Edit Contact

This means the user never needs to leave the Activities page to take action. The workflow is:
1. See a neglected contact → click their name
2. Contact Drawer opens → click "Open WhatsApp" or "Call"
3. Have the conversation
4. Click "Log Activity" in the drawer → record the interaction
5. Close drawer → the "Needs Attention" list updates automatically

---

## 10. Technical Notes

- **Max activities fetched:** 200 (to keep the page performant). Oldest activities are not shown.
- **Timeline display cap:** 50 entries rendered in the timeline. This is a UI cap — all 200 are used for calculations.
- **Never Contacted cap:** 10 contacts shown (prevents overwhelming the panel).
- **Relative time formatting:** "Just now" → "Xm ago" → "Xh ago" → "Xd ago" → full date (after 7 days).
- **Real-time updates:** Activities list is re-fetched after every new activity is logged. No websocket/realtime subscription currently — manual refresh via `refetch()`.
- **Outbound webhook:** Every logged activity fires an `activity.created` event via `pushOutboundEvent()` for external system integration.

---

## 11. Success Metrics

The Activities page is working correctly when:
- [ ] Users log at least 5 activities per day
- [ ] "Needs Attention" count trends downward over time
- [ ] "Never Contacted" list empties within 1 week of contact creation
- [ ] Activity Summary shows a healthy mix (not 100% one type)
- [ ] AI Relationship Check produces actionable, name-specific recommendations
