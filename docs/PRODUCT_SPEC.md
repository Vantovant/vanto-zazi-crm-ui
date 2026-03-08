# Vanto Zazi — Product Specification

**Version:** 1.0  
**Last Updated:** 2026-03-08  
**Platform:** React + Vite + Tailwind CSS + TypeScript  
**Backend:** Lovable Cloud (Supabase)

---

## 1. Product Overview

**Vanto Zazi** is a hybrid MLM/CRM web application purpose-built for network marketing (specifically APLGO distributors). It combines traditional CRM contact management with MLM-specific workflows: lead temperature tracking, registration pipelines, order/PV management, team leg assignment, and AI-powered coaching.

### Core Philosophy
- **Contacts are the center** of the entire system
- Dark, professional, data-first UI (Nimble CRM-inspired)
- Mobile-responsive with sidebar navigation
- AI copilot embedded throughout the experience

---

## 2. Architecture

### 2.1 Frontend Stack
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Bundler | Vite |
| Styling | Tailwind CSS + tailwindcss-animate |
| Routing | react-router-dom v7 |
| Icons | lucide-react |
| Spreadsheet parsing | xlsx |
| Markdown rendering | react-markdown |

### 2.2 Backend (Lovable Cloud / Supabase)
| Feature | Implementation |
|---------|---------------|
| Database | PostgreSQL with RLS |
| Auth | Supabase Auth (email/password + invite codes) |
| Edge Functions | Deno-based serverless functions |
| AI | Lovable AI (Gemini/GPT models, no API key required) |
| File Storage | Supabase Storage (knowledge docs) |

### 2.3 Database Schema

#### `contacts` (22+ fields)
The central table. Key fields:
- `full_name`, `phone_number`, `email_address`
- `phone_normalized`, `email_normalized` (auto-computed, unique partial indexes)
- `lead_temperature` (Hot / Warm / Cold)
- `communication_status` (New / In Progress / Pending / Completed)
- `registration_status` (Not Registered / Registered / Activated)
- `lead_type` (Prospect / Registered_Nopurchase / Purchase_Nostatus / Purchase_Status)
- `lead_path`, `focus_area`, `interest_level`
- `go_status`, `aplgo_id`, `associate_status`
- `assigned_to` (Manager_Leg_1 / Manager_Leg_2)
- `sponsor_name`, `meeting_time`, `action_taken`, `next_action`
- `city`, `province`, `state`, `country`
- `additional_notes`, `date_captured`
- `user_id` (RLS-scoped to authenticated user)

#### `orders`
- `order_id`, `contact_name`, `contact_id` (FK → contacts)
- `product`, `quantity`, `amount`, `pv_amount`
- `purchase_type` (Activity / Upgrade)
- `status` (Pending / Paid / Delivered / Activated)
- `badges` (text array: "First Order", "Activated", "Upgrade")
- `source`, `order_date`

#### `contact_activities`
- `activity_type` (whatsapp / call / meeting / note / registration)
- `contact_id` (FK → contacts)
- `summary`, `notes`, `next_action`
- `user_id`, `created_at`

#### `profiles`
- `id` (matches auth.users.id)
- `display_name`, `email`, `avatar_url`

#### `invites`
- `token` (6-char alphanumeric), `label`, `is_used`
- `created_by`, `used_by`, `used_at`

#### `user_activity` (telemetry)
- `user_id`, `page`, `action`, `metadata`

#### `user_api_keys`
- Per-user AI provider keys (optional override)
- `preferred_provider`, `openai_api_key`, `gemini_api_key`

#### `user_knowledge_docs`
- Uploaded documents for ZAZI Copilot knowledge base
- `file_name`, `file_path`, `file_type`, `file_size`, `extracted_text`, `status`

#### `ai_action_log` / `ai_team_patterns`
- AI recommendation tracking and team-wide pattern learning

#### `user_roles`
- `user_id`, `role` (admin / user)
- Used for Tester Dashboard access control

#### `merge_log`
- Records of duplicate merges: `primary_id`, `merged_ids`, `key_type`, `key_value`

---

## 3. Authentication & Authorization

### 3.1 Invite-Gated Signup
- New users must enter a valid invite code during registration
- Invite codes are validated via the `invite-check` edge function
- Codes are single-use and marked `is_used = true` after consumption
- Invite links: `https://app.url/auth?invite=XXXXXX`

### 3.2 Email Verification
- Email verification is required before sign-in (no auto-confirm)
- Password reset flow via Supabase Auth magic links

### 3.3 Role-Based Access
- `user_roles` table with `has_role()` security definer function
- Admin role gates access to the Tester Dashboard
- All data tables use RLS scoped to `auth.uid()` = `user_id`

---

## 4. Pages & Features

### 4.1 Dashboard (`/dashboard`)
- **KPI Cards:** Total Prospects, Hot Leads, Warm Leads, Cold Leads, Registered
- **Order Stats:** Total Revenue, Paid, Pending, Activity PV, Upgrade PV
- **Today's Focus:** Follow-ups (from NextAction field), neglected contacts
- **Recent Activity Feed:** Latest logged activities with icons and timestamps
- **Recent Prospects Table:** Last 5 added contacts (clickable → ContactDrawer)
- **AI Daily Brief:** One-click AI-generated summary of CRM state (via `zazi-copilot` edge function)
- **AI News:** AI-generated industry/MLM news digest

### 4.2 Contacts (`/contacts`)
- **Searchable data table** with all 22 prospect fields
- **Column visibility picker** (toggle which columns show)
- **Multi-filter dropdowns:** LeadTemperature, RegistrationStatus, LeadType, FocusArea, LeadPath
- **Bulk selection** with checkbox column
- **Bulk delete** selected contacts
- **Add Contact** modal with duplicate detection (phone/email)
- **Contact Drawer** (Nimble-style slide-out panel):
  - Contact details with all fields
  - Activity timeline
  - Quick edit inline fields
  - AI message suggestions
  - Direct WhatsApp link
  - Edit Contact modal
  - Log Activity from drawer

### 4.3 Activities (`/activities`)
- **Activity Timeline:** Grouped by date, showing type icons, contact names, summaries
- **Log Activity Modal:** Select contact, type, write summary/notes, set next action
- **Neglected Contacts Panel:** Contacts with no activity in 7+ days, sorted by Leg assignment
- **Never Contacted List:** Contacts with zero activities ever
- **AI Activity Insights:** One-click AI analysis of activity patterns

### 4.4 Orders (`/orders`)
- **Orders table** with search, filters (status, product, contact), date range picker
- **Add Order Modal:** Manual order entry with product catalog selection
- **Smart Paste Orders:** Paste backoffice text → AI parses into structured orders (via `parse-backoffice-orders` edge function)
- **Order detail expansion** (inline)
- **Status badges** with color coding
- **PV tracking** (Activity PV vs Upgrade PV)

### 4.5 Deals (`/deals`)
- **Derived from contacts + orders:** Shows only activated/registered contacts
- **Deal statuses:** Activation Only vs GO-Status ranked contacts
- **Estimated deal values** based on GO-Status rank hierarchy
- **Breakdown:** Upgrade PV, Activity PV, Upgrade ZAR, Activity ZAR
- **Filters:** Status, GO-Status, search
- **Export to CSV**
- **Contact Drawer** integration

### 4.6 WhatsApp (`/whatsapp`)
- **Contact list** with phone numbers, temperature indicators
- **Selected contact detail panel** with:
  - One-click open WhatsApp Web (wa.me link)
  - Copy phone number
  - AI message suggestion (via `zazi-copilot`)
  - Copy suggested message
  - Send directly to WhatsApp
  - Log Activity shortcut
  - Set Follow-Up shortcut

### 4.7 Import / Export (`/import-export`)
- **Smart Import (AI-powered):**
  1. Upload CSV/XLSX/XLS file
  2. AI analyzes headers and auto-maps to CRM fields (via `smart-import` edge function)
  3. User reviews/adjusts column mapping
  4. Preview data before import
  5. Import with duplicate detection (phone/email upsert)
  6. Summary: created vs updated vs skipped
- **Fallback:** Manual header mapping if AI unavailable
- **Export:**
  - Export Contacts to CSV
  - Export Orders to CSV
  - Export Deals to CSV
  - Export Activities to CSV

### 4.8 Duplicates (`/duplicates`)
- **Auto-detection** by `phone_normalized` and `email_normalized`
- **Duplicate groups** displayed with expandable details
- **Merge function:** Keeps most recent record as primary, appends notes, reassigns orders/activities
- **Merge log** tracking
- **Database-level unique constraints** prevent future duplicates

### 4.9 Tester Dashboard (`/team`) — Admin Only
- **Access:** Only visible to admin-role users
- **Invite Management:**
  - Create invite codes with labels
  - Copy invite links
  - Delete unused invites
  - View used/unused status
- **Tester Stats Table:**
  - Display name, email, join date
  - Last active timestamp
  - Total actions, contacts created, orders created
  - Pages visited with frequency breakdown
- **AI UX Report:** One-click AI-generated analysis of tester behavior and UX recommendations

### 4.10 Auth (`/auth`)
- Sign in / Sign up toggle
- Invite code field (auto-filled from URL param)
- Email + password authentication
- Forgot password link
- Email verification message

### 4.11 Reset Password (`/reset-password`)
- New password entry after clicking email reset link

---

## 5. AI Features (ZAZI Copilot)

### 5.1 Floating Copilot Widget
Always-visible chat bubble in bottom-right corner with tabs:

| Tab | Function |
|-----|----------|
| **Ask** | Free-form chat with CRM context (contacts summary, orders, activities injected as system prompt) |
| **Page** | AI analysis of current page context |
| **Contact** | AI insights for selected contact (from ContactDrawer) |
| **Insight** | AI-generated strategic recommendations |
| **Knowledge** | Upload/manage knowledge documents (PDF, DOCX, TXT) for RAG-style context |

### 5.2 AI-Powered Features Across Pages
- **Dashboard:** Daily brief, news digest
- **Activities:** Activity pattern insights
- **WhatsApp:** Suggested messages per contact
- **Orders:** Smart Paste (backoffice text → structured orders)
- **Import/Export:** AI column mapping
- **Contact Drawer:** AI-suggested next actions
- **Tester Dashboard:** AI UX behavior report

### 5.3 AI Settings
- Per-user API key configuration (optional)
- Provider selection (OpenAI / Gemini / Lovable AI default)

---

## 6. Edge Functions

| Function | Purpose |
|----------|---------|
| `zazi-copilot` | Streaming AI chat with CRM context injection |
| `parse-backoffice-orders` | AI parsing of pasted backoffice text into orders |
| `smart-import` | AI-powered CSV header → CRM field mapping |
| `team-analytics` | Aggregates tester stats + generates AI UX report |
| `invite-check` | Validates invite codes during signup |
| `crm-webhook` | Inbound webhook for external integrations |
| `outbound-webhook` | Fires webhooks on CRM events |
| `whatsapp-sync` | WhatsApp contact sync (Chrome extension backend) |
| `parse-knowledge-doc` | Extracts text from uploaded knowledge documents |

---

## 7. Chrome Extension

Located in `public/chrome-extension/`:
- Scrapes WhatsApp Web chat list for contact names and phone numbers
- Syncs to CRM via authenticated API calls
- Matches existing contacts by phone (no duplicates)
- Creates new prospects for unrecognized contacts
- Skips group chats automatically

---

## 8. Outbound Webhooks

- Configurable webhook URL per user
- Fires on CRM events (contact created, order added, etc.)
- Managed via `useOutboundWebhook` hook

---

## 9. Data Normalization

- Phone numbers normalized via `normalize_phone()` database function (strips spaces, dashes, leading zeros, adds country code)
- Emails normalized via `normalize_email()` database function (lowercase, trim)
- Computed columns `phone_normalized` and `email_normalized` with unique partial indexes
- Frontend utilities in `src/utils/contactNormalization.ts`

---

## 10. Design System

- **Theme:** Dark slate (bg-slate-900, panels bg-slate-800)
- **Accent:** Teal (teal-500/600 for CTAs, links)
- **Status Colors:**
  - Hot = Rose, Warm = Amber, Cold = Sky
  - Registered = Violet, Activated = Emerald
  - Pending = Amber, Paid = Cyan, Delivered = Violet
- **Typography:** System font stack
- **Layout:** Fixed sidebar (56 = w-56) + fixed topbar (h-14) + scrollable main content
- **Responsive:** Sidebar collapses to hamburger menu on mobile (lg breakpoint)

---

## 11. Security

- All tables have RLS policies scoped to `user_id = auth.uid()`
- Invite-gated registration prevents unauthorized signups
- Admin functions protected by `has_role()` security definer
- No anonymous signups
- Email verification required
- API keys stored in database (user_api_keys), not in frontend code
- Chrome extension authenticates via user credentials

---

## 12. Activity Tracking

- `useActivityTracker` hook fires on every route change
- Records: `user_id`, `page`, `action` ("page_view"), `metadata` (route path)
- Powers the Tester Dashboard analytics
