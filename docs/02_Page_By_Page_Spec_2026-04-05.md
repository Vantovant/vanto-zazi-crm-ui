# Vanto Zazi — Page-by-Page Specification

**Version:** 2.0  
**Date:** 2026-04-05

---

## 1. Auth (`/auth`)

**File:** `src/pages/Auth.tsx`

- Toggle between Sign In and Sign Up
- **Sign Up** fields: email, password, display name, invite code
- Invite code auto-filled from URL param (`?invite=XXXXXX`)
- Invite validated via `invite-check` edge function
- Email verification message after signup
- Forgot password link → sends reset email
- Error handling with toast notifications

---

## 2. Reset Password (`/reset-password`)

**File:** `src/pages/ResetPassword.tsx`

- Receives token from email reset link
- New password entry + confirmation
- Updates via Supabase Auth

---

## 3. Dashboard (`/dashboard`)

**File:** `src/pages/Dashboard.tsx` (536 lines)

### Sections:
1. **KPI Cards** (5): Total Prospects, Hot Leads, Warm Leads, Cold Leads, Registered
2. **Order Revenue Summary** (5 cards): Total Orders/Revenue, Paid, Pending, Activity PV, Upgrade PV
3. **ZAZI Mail** — AI news briefing with CRM data context (via `zazi-copilot` edge function)
4. **Today's Focus** (3 panels):
   - Follow-ups Due (contacts with NextAction set)
   - Meetings (contacts with MeetingTime set)
   - Hot Leads Needing Action
5. **Recent Activity Feed** — Mixed feed of recent orders and contact additions
6. **Recent Prospects Table** — Last 5 contacts, clickable → ContactDrawer

### Components Used:
- `DataStatusBanner`, `ContactDrawer`, `ReactMarkdown`

### Data Sources:
- `useCrm()` → contacts, orders
- `useContactActivities()` → activities, neglectedContacts

---

## 4. Contacts (`/contacts`)

**File:** `src/pages/Contacts.tsx`

### Features:
- Searchable data table with 22+ prospect fields
- **Column visibility picker** — toggle columns on/off
- **Multi-filter dropdowns:** LeadTemperature, RegistrationStatus, LeadType, FocusArea, LeadPath
- **Bulk selection** via checkbox column
- **Bulk delete** selected contacts
- **Add Contact** button → `AddContactModal` with duplicate detection (phone/email)
- **Row click** → opens `ContactDrawer`

### ContactDrawer (`src/components/ContactDrawer.tsx`):
- Full contact details (all fields)
- Activity timeline for the contact
- Quick actions: WhatsApp link, copy phone, AI message, log activity, edit
- `EditContactModal` integration
- `LogActivityModal` integration
- `MessageTemplatePicker` for WhatsApp templates

---

## 5. Activities (`/activities`)

**File:** `src/pages/Activities.tsx`

### Sections:
1. **Activity Timeline** — Grouped by date, type icons, contact names, summaries
2. **Activity Goals** — Daily targets for calls, emails, WhatsApp (configurable via `ActivityGoalsModal`)
3. **Log Activity** button → `LogActivityModal`
4. **Neglected Contacts Panel:**
   - Smart sorter by lead type (Prospect, Registered, Purchase, etc.)
   - Sorted by Leg assignment
   - Contacts with no activity in 7+ days
5. **Never Contacted List** — Contacts with zero activities
6. **AI Activity Insights** — AI analysis of patterns

### Data Sources:
- `useContactActivities()` → activities, neglected contacts
- `useActivityGoals()` → daily goals and progress
- `useCrm()` → contacts for matching

---

## 6. Orders (`/orders`)

**File:** `src/pages/Orders.tsx`

### Features:
- Orders table: Order ID, Contact, Product, Qty, Amount, PV, Status, Type, Badges, Date
- Search, status filter, product filter, contact filter, date range
- **Add Order** → `AddOrderModal` with product catalog
- **Smart Paste** → `SmartPasteOrdersModal` (AI parses backoffice text via `parse-backoffice-orders`)
- Status badges with color coding (Pending=Amber, Paid=Cyan, Delivered=Violet, Activated=Emerald)
- PV tracking: Activity PV vs Upgrade PV

---

## 7. Inventory (`/inventory`)

**File:** `src/pages/Inventory.tsx` (146 lines)

### Features:
- Product stock table with quantities
- **Add Stock** → `AddStockModal`
- Inline edit stock quantities
- Delete inventory items
- Linked to order creation (auto-deducts via `create_offline_order_and_deduct_stock`)

### Data Source:
- `useInventory()` hook

---

## 8. Deals (`/deals`)

**File:** `src/pages/Deals.tsx`

### Features:
- Derived from contacts + orders (Registered/Activated contacts)
- Deal statuses: Activation Only, ranked by GO-Status
- Estimated values by rank (Diamond R45k → Promoter R1.5k → Activation R375)
- Breakdown: Upgrade PV, Activity PV, Upgrade ZAR, Activity ZAR
- Filters: status, GO-Status, search
- Export to CSV
- Click → ContactDrawer

---

## 9. WhatsApp (`/whatsapp`)

**File:** `src/pages/WhatsApp.tsx`

### Features:
- Contact list with phone numbers and temperature indicators
- Selected contact panel:
  - Open WhatsApp Web (wa.me link)
  - Copy phone number
  - AI message suggestion (via `zazi-copilot`)
  - **Message Template Library** — 13 categories with merge field personalization
  - Copy/send message to WhatsApp
  - Log Activity shortcut
  - Set Follow-Up shortcut
- All messages include APLGO branded link (`/aplgo.html`) for WhatsApp preview
- Sender name and email appended to all messages (from user profile)

---

## 10. Import / Export (`/import-export`)

**File:** `src/pages/ImportExport.tsx`

### Smart Import:
1. Upload CSV/XLSX/XLS
2. AI auto-maps headers to CRM fields (via `smart-import` edge function)
3. User reviews/adjusts mapping
4. Preview data
5. Import with duplicate detection (phone/email upsert)
6. Summary: created vs updated vs skipped

### Export:
- Export Contacts, Orders, Deals, Activities to CSV

---

## 11. Duplicates (`/duplicates`)

**File:** `src/pages/Duplicates.tsx`

### Features:
- Auto-detection by `phone_normalized` and `email_normalized`
- Duplicate groups as expandable cards
- Merge: keeps most recent as primary, appends notes, reassigns orders/activities
- Merge log tracking
- Database unique constraints prevent future duplicates

---

## 12. 90-Day Momentum Run (`/momentum`)

**File:** `src/pages/MomentumRun.tsx` (307 lines)  
**Access:** Owner only (OWNER_ID check)

### Phases:
| Phase | Days | Name |
|-------|------|------|
| 1 | 1–3 | Pre-Launch — Whisper Campaign |
| 2 | 4–13 | Launch — 70-in-10 |
| 3 | 14–30 | Post-Launch Momentum |
| 4 | 31–60 | Building & Duplicating |
| 5 | 61–90 | Scaling & Closing |

### Features:
- Current day/phase indicator with progress bar
- Daily targets (conversations, follow-ups, presentations) per phase
- Contact segmentation by lead type mapped to phases
- Message template picker for phase-appropriate outreach
- Based on RESET & RISE methodology (uploaded knowledge docs)

### Config:
- Start: 2026-03-30, End: 2026-06-27
- Lead type → phase mapping for contact prioritization

---

## 13. Tester Dashboard (`/team`)

**File:** `src/pages/TeamDashboard.tsx`  
**Access:** Owner only

### Invite Management:
- Create invite codes with labels
- Copy invite links
- Delete unused invites
- View used/unused status

### Tester Stats:
- Display name, email, join date
- Last active timestamp
- Total actions, contacts created, orders created
- Page visit frequency breakdown

### AI UX Report:
- AI-generated analysis of tester behavior and UX recommendations

---

## 14. Shared Components

| Component | Purpose |
|-----------|---------|
| `Layout.tsx` | Shell: Sidebar + Topbar + Outlet + ZaziCopilot |
| `Sidebar.tsx` | Navigation (collapses on mobile) |
| `Topbar.tsx` | Search, quick actions, settings |
| `ContactDrawer.tsx` | Slide-out contact detail panel |
| `ZaziCopilot.tsx` | Floating AI chat widget |
| `ProtectedRoute.tsx` | Auth guard |
| `PwaInstallBanner.tsx` | PWA install prompt |
| `OfflineBanner.tsx` | Network status indicator |
| `MessageTemplatePicker.tsx` | Template selection with merge fields |
| `DataStatusBanner.tsx` | Database connection indicator |

---

## 15. Hooks

| Hook | Purpose |
|------|---------|
| `useContacts` | CRUD for contacts table |
| `useOrders` | CRUD for orders table |
| `useContactActivities` | Activities + neglected contacts logic |
| `useInventory` | Stock management |
| `useMessageTemplates` | Template library |
| `useActivityGoals` | Daily goal targets |
| `useActivityTracker` | Page view telemetry |
| `useOutboundWebhook` | Webhook configuration |
