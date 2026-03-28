# Tester Dashboard — Full Technical Specification

**Version:** 1.0  
**Last Updated:** 2026-03-28  
**Route:** `/team`  
**Access:** Admin-only (role-based)  
**Component:** `src/pages/TeamDashboard.tsx`  
**Backend:** `supabase/functions/team-analytics/index.ts`

---

## 1. Purpose

The Tester Dashboard is an **admin-only analytics and management console** that provides the platform owner with:

- Real-time visibility into how testers (beta users) are engaging with the CRM
- Invite code management for gated signup
- AI-generated UX feedback reports based on actual usage telemetry

It is designed to answer: _Who signed up? What are they doing? Where are they getting stuck? What should I improve?_

---

## 2. Access Control

### 2.1 Role-Based Gating

| Layer | Mechanism |
|-------|-----------|
| **Frontend** | `TeamDashboard.tsx` queries `user_roles` table on mount; renders "Access Restricted" if user lacks `admin` role |
| **Backend** | `team-analytics` edge function performs server-side admin check via `user_roles` table with service role; returns 403 if not admin |
| **Sidebar** | Navigation item only visible when `user.id === OWNER_ID` (hardcoded in `Sidebar.tsx`) |

### 2.2 Security Flow

```
1. User navigates to /team
2. TeamDashboard.tsx queries: SELECT role FROM user_roles WHERE user_id = ? AND role = 'admin'
3. If no row → "Access Restricted" screen
4. If admin → render dashboard, fetch stats via edge function
5. Edge function re-validates admin role server-side before returning any data
```

### 2.3 Tables Involved

- **`user_roles`** — stores `user_id` + `role` (enum: `admin` | `user`)
- **`has_role()`** — security definer function for RLS policies (not directly used here but part of the role system)

---

## 3. UI Layout

### 3.1 Page Structure

```
┌─────────────────────────────────────────────────┐
│  Header: "Tester Dashboard" + Refresh + AI btn  │
├─────────────────────────────────────────────────┤
│  Summary Cards (4x grid)                        │
│  [Total Testers] [Active] [Contacts] [Orders]   │
├─────────────────────────────────────────────────┤
│  Invite Codes Management Panel                  │
│  - Create new invite (label + generate)         │
│  - List all invites (code, status, copy, delete)│
├─────────────────────────────────────────────────┤
│  AI UX Report (conditional, shown after click)  │
│  - Markdown-rendered AI analysis                │
├─────────────────────────────────────────────────┤
│  Tester Activity Table                          │
│  - Name, email, joined, last active, actions,   │
│    contacts, orders, pages visited              │
└─────────────────────────────────────────────────┘
```

### 3.2 Summary Cards

| Card | Source | Description |
|------|--------|-------------|
| **Total Testers** | `stats.length` | Count of all registered users (from profiles + auth.users) |
| **Active Testers** | `stats.filter(s => s.totalActions > 0)` | Users who have at least one `user_activity` record |
| **Contacts Created** | `SUM(contactsCreated)` | Total contacts across all users |
| **Orders Created** | `SUM(ordersCreated)` | Total orders across all users |

### 3.3 Invite Codes Panel

**Purpose:** Manage invite-gated signup. New users must enter a valid invite code to register.

**Features:**
- **Create invite:** Enter optional label (defaults to "Tester"), generates a 6-character alphanumeric code (charset: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, excludes ambiguous chars I/O/0/1)
- **List invites:** Shows all invites ordered by creation date (newest first)
- **Per-invite actions:**
  - Copy code to clipboard (with ✓ feedback)
  - Delete invite
- **Status badges:** "Available" (teal) or "Used" (grey)
- **Counter:** Shows `X available · Y used` in section header

**Data flow:**
```
Create: INSERT INTO invites { created_by: user.id, label, token }
List:   SELECT * FROM invites ORDER BY created_at DESC
Delete: DELETE FROM invites WHERE id = ?
```

**RLS:** All invite operations are scoped to `created_by = auth.uid()`.

### 3.4 Tester Activity Table

| Column | Data Source | Format |
|--------|-----------|--------|
| **Tester** | `profiles.display_name` or email prefix | Avatar initials + name + email |
| **Joined** | `profiles.created_at` or `auth.users.created_at` | `DD Mon YYYY HH:MM` (en-ZA locale) |
| **Last Active** | Most recent `user_activity.created_at` | Relative: "5m ago", "3h ago", "2d ago", "Never" |
| **Actions** | Count of `user_activity` rows | Numeric |
| **Contacts** | Count of `contacts` rows | Numeric |
| **Orders** | Count of `orders` rows | Numeric |
| **Pages Visited** | Unique `user_activity.page` values | Up to 4 chips + "+N" overflow |

**Last Active indicator:** Green badge if active within last hour, grey otherwise.

---

## 4. Backend: `team-analytics` Edge Function

### 4.1 Authentication & Authorization

```
Request → Extract Bearer token from Authorization header
        → Validate JWT via anonSupabase.auth.getUser()
        → Server-side admin check: SELECT FROM user_roles WHERE user_id = ? AND role = 'admin'
        → If not admin → 403 "Admin access required"
        → If admin → proceed with service role client
```

### 4.2 Data Aggregation Pipeline

The function uses the **service role key** to bypass RLS and aggregate data across all users:

```
Step 1: Fetch all profiles
        SELECT id, display_name, created_at FROM profiles

Step 2: Fetch all auth users (for emails)
        supabase.auth.admin.listUsers({ perPage: 1000 })
        Build emailMap: { userId → email }

Step 3: Fetch activity telemetry
        SELECT user_id, action, page, created_at FROM user_activity
        ORDER BY created_at DESC LIMIT 5000

Step 4: Fetch contact counts
        SELECT user_id FROM contacts (count per user)

Step 5: Fetch order counts
        SELECT user_id FROM orders (count per user)

Step 6: Merge into unified user stats array
        - Union of profile IDs + auth user IDs (covers users without profiles)
        - Per user: displayName, email, joinedAt, lastActive, totalActions,
          contactsCreated, ordersCreated, pagesVisited[], pageFrequency{}
```

### 4.3 API Actions

| Action | Request Body | Response |
|--------|-------------|----------|
| `stats` (default) | `{ action: "stats" }` | `{ stats: UserStat[] }` |
| `ai_summary` | `{ action: "ai_summary" }` | `{ stats: UserStat[], aiSummary: string }` |
| `delete_user` | `{ action: "delete_user", userId: string }` | `{ success: true }` |

### 4.4 AI UX Report Generation

**Trigger:** User clicks "ZAZI UX Report" button.

**Flow:**
```
1. Aggregate all user stats (same as stats action)
2. Serialize stats as JSON
3. Call Lovable AI Gateway:
   POST https://ai.gateway.lovable.dev/v1/chat/completions
   Model: google/gemini-3-flash-preview
   Auth: LOVABLE_API_KEY (server-side secret)
4. System prompt instructs AI to analyze:
   - Most/least active users
   - Most/least visited pages (feature value signal)
   - Users with zero contacts (onboarding confusion)
   - Engagement patterns and drop-off signals
   - Specific UX improvement recommendations
5. Response rendered as Markdown in the UI
```

**System Prompt:**
```
You are ZAZI, the AI copilot for Vanto Zazi CRM. Analyze tester activity data 
and provide a clear, actionable UX feedback report. Focus on:
1. Who is most/least active
2. Which pages get the most/least traffic (indicates feature value)
3. Who hasn't created any contacts yet (may be confused)
4. Engagement patterns and drop-off signals
5. Specific recommendations to improve UX based on the data
Keep it practical, use markdown, and be encouraging.
```

---

## 5. Data Model

### 5.1 UserStat Interface (Frontend)

```typescript
interface UserStat {
  userId: string;
  displayName: string;        // From profiles or email prefix
  email: string;              // From auth.users
  joinedAt: string;           // ISO timestamp
  lastActive: string | null;  // Most recent activity timestamp
  totalActions: number;       // Count of user_activity rows
  contactsCreated: number;    // Count of contacts rows
  ordersCreated: number;      // Count of orders rows
  pagesVisited: string[];     // Unique page paths
  pageFrequency: Record<string, number>;  // page → visit count
}
```

### 5.2 Telemetry Source: `user_activity` Table

Populated by the `useActivityTracker` hook which fires on every route change:

| Column | Value |
|--------|-------|
| `user_id` | `auth.uid()` |
| `page` | Route path (e.g., `/dashboard`, `/contacts`) |
| `action` | `"page_view"` |
| `metadata` | `{ path: "/dashboard" }` |
| `created_at` | Auto-generated timestamp |

### 5.3 Invite Table: `invites`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `token` | text | 6-char code (default: `encode(gen_random_bytes(16), 'hex')`, overridden by frontend) |
| `label` | text | Human-readable label (e.g., tester name) |
| `is_used` | boolean | Whether the code has been consumed |
| `created_by` | uuid | Admin who created it |
| `used_by` | uuid | User who consumed it (nullable) |
| `used_at` | timestamptz | When consumed (nullable) |
| `created_at` | timestamptz | Creation timestamp |

**Invite consumption** is handled by the `invite-check` edge function during signup.

---

## 6. Telemetry Pipeline

```
User navigates to /contacts
  → useActivityTracker fires
    → INSERT INTO user_activity { user_id, page: '/contacts', action: 'page_view' }

Admin opens Tester Dashboard
  → fetchStats() calls team-analytics edge function
    → Edge function reads user_activity with service role (bypasses RLS)
    → Aggregates per-user stats
    → Returns to frontend

Admin clicks "ZAZI UX Report"
  → fetchAiSummary() calls team-analytics with action: 'ai_summary'
    → Edge function aggregates stats + sends to AI
    → AI returns markdown analysis
    → Frontend renders with ReactMarkdown
```

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Non-admin accessing stats | Frontend role check + server-side role check in edge function |
| Viewing other users' data | Only admin can access; service role used server-side |
| Email exposure | Emails fetched via `auth.admin.listUsers()` — only accessible with service role |
| Invite manipulation | RLS ensures users can only manage their own invites (`created_by = auth.uid()`) |
| User deletion | `delete_user` action uses `auth.admin.deleteUser()` — server-side admin check required |

---

## 8. UI Interactions

| Action | Trigger | Result |
|--------|---------|--------|
| **Refresh** | Click "Refresh" button | Re-fetches stats from edge function |
| **ZAZI UX Report** | Click "ZAZI UX Report" button | Fetches stats + AI summary, renders markdown |
| **Create Invite** | Enter label + click "Create Invite" | Generates 6-char code, inserts into `invites`, refreshes list |
| **Copy Code** | Click copy icon on invite | Copies token to clipboard, shows ✓ for 2 seconds |
| **Delete Invite** | Click trash icon on invite | Deletes from `invites`, refreshes list |

---

## 9. Limitations & Known Constraints

1. **Activity limit:** Edge function fetches max 5,000 `user_activity` rows — may miss older activity for very active platforms
2. **Auth user limit:** `listUsers` fetches max 1,000 users per page — sufficient for current scale
3. **No real-time updates:** Dashboard requires manual refresh; no Supabase Realtime subscription
4. **Sidebar visibility:** Uses hardcoded `OWNER_ID` check in `Sidebar.tsx` — separate from the `user_roles` admin check
5. **No pagination:** Tester table shows all users at once — works for small tester pools
6. **Delete user action:** Implemented in edge function but not currently exposed in UI

---

## 10. Files Involved

| File | Role |
|------|------|
| `src/pages/TeamDashboard.tsx` | Full page component with all UI sections |
| `supabase/functions/team-analytics/index.ts` | Edge function: stats aggregation, AI report, user deletion |
| `src/components/Sidebar.tsx` | Conditional nav item visibility (OWNER_ID check) |
| `src/hooks/useActivityTracker.ts` | Telemetry hook that populates `user_activity` table |
| `src/contexts/AuthContext.tsx` | Provides `user` object for admin check |
| `supabase/functions/invite-check/index.ts` | Validates invite codes during signup (consumed here, managed in dashboard) |

---

## 11. Future Enhancements (Not Yet Built)

- [ ] Expose "Delete User" action in UI with confirmation modal
- [ ] Add date range filter to tester activity table
- [ ] Add export tester stats to CSV
- [ ] Real-time activity feed (Supabase Realtime on `user_activity`)
- [ ] Per-tester drill-down page with full activity timeline
- [ ] Pagination for large tester pools
- [ ] Unify sidebar visibility with `user_roles` admin check (remove hardcoded OWNER_ID)
