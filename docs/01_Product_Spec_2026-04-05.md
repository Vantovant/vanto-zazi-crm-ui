# Vanto Zazi — Product Specification

**Version:** 2.0  
**Date:** 2026-04-05  
**Platform:** React 18 + Vite 5 + Tailwind CSS v3 + TypeScript 5  
**Backend:** Lovable Cloud (Supabase)  
**Published URL:** https://vanto-zazi-bloom.lovable.app

---

## 1. Product Overview

**Vanto Zazi** is a hybrid MLM/CRM progressive web application purpose-built for APLGO network marketing distributors. It combines traditional CRM contact management with MLM-specific workflows: lead temperature tracking, registration pipelines, order/PV management, team leg assignment, AI-powered coaching, and a 90-Day Momentum Run system.

### Core Philosophy
- **Contacts are the center** of the entire system
- Dark, professional, data-first UI (Nimble CRM-inspired)
- Mobile-responsive with sidebar navigation
- AI copilot (ZAZI) embedded throughout the experience
- Installable as a PWA on desktop and mobile
- APLGO branding integrated into WhatsApp link previews

---

## 2. Architecture

### 2.1 Frontend Stack
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5 |
| Bundler | Vite 5 |
| Styling | Tailwind CSS v3 + tailwindcss-animate |
| Routing | react-router-dom v7 |
| Icons | lucide-react |
| Spreadsheet parsing | xlsx |
| Markdown rendering | react-markdown |
| PWA | vite-plugin-pwa (Workbox) |

### 2.2 Backend (Lovable Cloud / Supabase)
| Feature | Implementation |
|---------|---------------|
| Database | PostgreSQL with Row-Level Security |
| Auth | Email/password + invite-gated signup |
| Edge Functions | 9 Deno-based serverless functions |
| AI | Lovable AI (Gemini/GPT models, no API key required) |
| File Storage | Supabase Storage (knowledge docs) |

### 2.3 Database Tables

| Table | Purpose |
|-------|---------|
| `contacts` | Central 22+ field prospect table |
| `orders` | Product orders with PV tracking |
| `contact_activities` | Activity timeline per contact |
| `profiles` | User display name, email, avatar |
| `invites` | Single-use invite codes |
| `user_activity` | Telemetry for page views |
| `user_api_keys` | Per-user AI provider keys |
| `user_knowledge_docs` | Uploaded docs for ZAZI knowledge base |
| `user_roles` | Admin/user role assignments |
| `merge_log` | Duplicate merge audit trail |
| `message_templates` | WhatsApp & email message templates |
| `follow_up_states` | Follow-up tracking per contact |
| `inventory` | Product stock management |
| `activity_goals` | Daily activity targets (calls, emails, WhatsApp) |
| `ai_action_log` | AI recommendation tracking |
| `ai_team_patterns` | Team-wide pattern learning |

### 2.4 Key Database Functions
- `normalize_phone(raw)` — Strips spaces, dashes, adds country code
- `normalize_email(raw)` — Lowercase, trim
- `has_role(_user_id, _role)` — Security definer for role checks
- `is_self_profile(profile_id)` — Profile ownership check
- `create_offline_order_and_deduct_stock(...)` — Atomic order + inventory

---

## 3. Authentication & Authorization

### 3.1 Invite-Gated Signup
- Valid invite code required during registration
- Codes validated via `invite-check` edge function
- Single-use: marked `is_used = true` after consumption
- Invite links: `https://vanto-zazi-bloom.lovable.app/auth?invite=XXXXXX`

### 3.2 Email Verification
- Email verification required before sign-in (no auto-confirm)
- Password reset via magic links

### 3.3 Role-Based Access
- `user_roles` table with `has_role()` security definer function
- Admin role gates: Tester Dashboard, 90-Day Momentum Run
- All data tables use RLS: `user_id = auth.uid()`

---

## 4. Pages & Features

| Route | Page | Access |
|-------|------|--------|
| `/auth` | Sign In / Sign Up | Public |
| `/reset-password` | Password Reset | Public |
| `/dashboard` | Dashboard | Authenticated |
| `/contacts` | Contacts | Authenticated |
| `/activities` | Activities | Authenticated |
| `/orders` | Orders | Authenticated |
| `/inventory` | Inventory | Authenticated |
| `/deals` | Deals | Authenticated |
| `/whatsapp` | WhatsApp | Authenticated |
| `/import-export` | Import / Export | Authenticated |
| `/duplicates` | Duplicates | Authenticated |
| `/momentum` | 90-Day Momentum Run | Owner only |
| `/team` | Tester Dashboard | Owner only |

---

## 5. AI Features (ZAZI Copilot)

### 5.1 Floating Copilot Widget
Always-visible chat bubble with tabs: Ask, Page, Contact, Insight, Knowledge.

### 5.2 AI Across Pages
- **Dashboard:** Daily brief, ZAZI Mail news digest
- **Activities:** Activity pattern insights
- **WhatsApp:** Suggested messages per contact (with template library)
- **Orders:** Smart Paste (backoffice text → structured orders)
- **Import/Export:** AI column mapping
- **Contact Drawer:** AI-suggested next actions
- **Tester Dashboard:** AI UX behavior report
- **Momentum Run:** AI daily plan generation

### 5.3 Message Templates
- 13 categories: Welcome, Activation, Onboarding, Training, Orders, Monthly Activity, Inactivity, Expiry, Rank, Events, Commissions, Appreciation, Reactivation
- Merge fields: `{{first_name}}`, `{{full_name}}`, `{{product}}`, `{{rank}}`, `{{sender_name}}`, `{{sender_email}}`
- Personalized greetings based on contact lead type
- APLGO branded link preview appended to all WhatsApp messages

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

## 7. PWA Configuration

- **Installable** on desktop Chrome, Android Chrome, and mobile Safari (Add to Home Screen)
- **Service worker** with network-first strategy for API calls
- **Install banner** appears at bottom on mobile, top-right on desktop
- **iOS fallback** guidance: "Tap Share → Add to Home Screen"
- **Auth safety:** Network-only for Supabase endpoints, no stale cache for dynamic data
- **Offline banner** when network unavailable

---

## 8. Chrome Extensions

### 8.1 WhatsApp Sync Extension (`public/chrome-extension/`)
- Scrapes WhatsApp Web chat list
- Syncs contacts to CRM via authenticated API
- Matches by phone, skips group chats

### 8.2 ZAZI Follow-Up Copilot (`public/zazi-copilot-extension/`)
- Side panel with real-time follow-up suggestions
- Adapters for Gmail and WhatsApp
- Follow-up engine with recommended actions

---

## 9. APLGO Landing Page

Static page at `/aplgo.html` with:
- Full Open Graph metadata for WhatsApp/social previews
- OG image: 1200×630 branded card
- Appended to all WhatsApp messages as branded link preview

---

## 10. Design System

- **Theme:** Dark slate (bg-slate-900, panels bg-slate-800)
- **Accent:** Teal (teal-500/600 for CTAs)
- **Status Colors:** Hot=Rose, Warm=Amber, Cold=Sky, Registered=Violet, Activated=Emerald
- **Layout:** Fixed sidebar (w-56) + fixed topbar (h-14) + scrollable main
- **Responsive:** Sidebar collapses to hamburger on mobile (lg breakpoint)

---

## 11. Security

- All tables: RLS scoped to `user_id = auth.uid()`
- Invite-gated registration
- Admin functions protected by `has_role()` security definer
- No anonymous signups
- Email verification required
- API keys stored in DB, not frontend
- Chrome extension authenticates via user credentials
