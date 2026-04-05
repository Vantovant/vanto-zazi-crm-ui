# Vanto Zazi — Technical Handover Document

**Version:** 1.0  
**Date:** 2026-04-05  
**Prepared for:** Developer handover / onboarding

---

## 1. Project Structure

```
/
├── src/
│   ├── App.tsx                    # Route definitions
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Tailwind base + design tokens
│   ├── components/                # 20+ shared UI components
│   ├── contexts/                  # AuthContext, CrmContext, PwaInstallContext
│   ├── hooks/                     # 8 custom hooks
│   ├── pages/                     # 12 page components
│   ├── data/                      # Mock data, product catalog
│   ├── utils/                     # Contact normalization, template merge/recommender
│   ├── integrations/supabase/     # Auto-generated client + types (DO NOT EDIT)
│   └── lib/                       # Environment helpers
├── supabase/
│   ├── config.toml                # Project config (auto-managed)
│   ├── migrations/                # SQL migrations (read-only)
│   └── functions/                 # 9 edge functions
├── public/
│   ├── aplgo.html                 # APLGO landing page (OG metadata)
│   ├── chrome-extension/          # WhatsApp sync extension
│   ├── zazi-copilot-extension/    # Follow-up copilot extension
│   └── manifest.json              # PWA manifest
├── docs/                          # Documentation
└── vite.config.ts                 # Build config + PWA plugin
```

---

## 2. Key Files — Do NOT Edit

| File | Reason |
|------|--------|
| `src/integrations/supabase/client.ts` | Auto-generated Supabase client |
| `src/integrations/supabase/types.ts` | Auto-generated from DB schema |
| `.env` | Auto-managed by Lovable Cloud |
| `supabase/migrations/*` | Migration history (append-only) |

---

## 3. Environment Variables

Automatically provided by Lovable Cloud:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Anon key
- `VITE_SUPABASE_PROJECT_ID` — Project identifier

Edge function secrets (set via Lovable Cloud):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY` — For Lovable AI model access

---

## 4. Authentication Flow

```
User → /auth (sign up with invite code)
  → invite-check edge function validates code
  → Supabase Auth creates user
  → profiles table row auto-created via trigger
  → Email verification sent
  → User verifies → can sign in
  → AuthContext wraps app, provides user/session
  → ProtectedRoute redirects unauthenticated to /auth
```

### Owner Check
The sidebar uses a hardcoded `OWNER_ID` to show admin-only nav items (Momentum Run, Tester Dashboard). This is in `src/components/Sidebar.tsx`:
```typescript
const OWNER_ID = 'b8028d7d-6a08-45ef-a369-b438c440bea3';
```

---

## 5. Data Flow

### CrmContext (`src/contexts/CrmContext.tsx`)
Central data provider wrapping all authenticated routes:
- Fetches contacts and orders on mount
- Provides: `contacts`, `orders`, `dbActive`, loading states
- Re-fetches on data mutations

### Contacts Data Model
Frontend uses camelCase field names (e.g., `FullName`, `LeadTemperature`) mapped from snake_case DB columns (`full_name`, `lead_temperature`).

### RLS Pattern
All tables use: `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE policies.

---

## 6. Edge Functions

All in `supabase/functions/`:

### `zazi-copilot/index.ts` (309 lines)
- Actions: `chat`, `page_analysis`, `contact_analysis`, `business_insight`
- Streams responses using SSE format
- Injects CRM summary as system prompt context
- Supports user API key override (OpenAI/Gemini)
- Falls back to Lovable AI (no key required)

### `smart-import/index.ts`
- Receives CSV headers + sample rows
- Returns column mapping suggestions
- Uses AI to match headers to CRM field names

### `parse-backoffice-orders/index.ts`
- Receives pasted text from APLGO backoffice
- Returns structured order objects

### `team-analytics/index.ts`
- Aggregates `user_activity` and entity counts per user
- Optionally generates AI UX report

### `invite-check/index.ts`
- Validates invite token exists and is unused
- Marks as used on signup completion

---

## 7. Message Templates System

### Database: `message_templates` table
- Seeded with templates across 13 categories
- Channels: `whatsapp`, `email`
- Merge fields: `{{first_name}}`, `{{full_name}}`, `{{product}}`, `{{rank}}`, `{{sender_name}}`, `{{sender_email}}`

### Frontend Flow:
1. `useMessageTemplates()` hook fetches active templates
2. `MessageTemplatePicker` component renders category → template selection
3. `templateMerge.ts` replaces merge fields with contact data
4. `templateRecommender.ts` suggests templates based on contact lead type
5. APLGO link + sender info appended before sending

---

## 8. PWA Architecture

### Config: `vite.config.ts`
- `vite-plugin-pwa` with Workbox
- Network-first for Supabase API endpoints
- Cache-first for static assets

### Components:
- `PwaInstallContext.tsx` — Captures `beforeinstallprompt`, detects platform
- `PwaInstallBanner.tsx` — Install button (desktop top-right, mobile bottom)
- `PwaInstallButton.tsx` — Reusable install trigger
- `OfflineBanner.tsx` — Network status indicator

### Manifest: `public/manifest.json`

---

## 9. Build & Deploy

```bash
npm run build       # Vite production build
npm run dev         # Local dev server
```

- Deployed via Lovable Cloud (automatic on save)
- Published URL: https://vanto-zazi-bloom.lovable.app
- Netlify config in `netlify.toml` (SPA redirect)

---

## 10. Database Functions

| Function | Type | Purpose |
|----------|------|---------|
| `normalize_phone(raw)` | SQL | Phone normalization |
| `normalize_email(raw)` | SQL | Email normalization |
| `has_role(_user_id, _role)` | Security Definer | Role check (bypasses RLS) |
| `is_self_profile(profile_id)` | SQL | Profile ownership |
| `create_offline_order_and_deduct_stock(...)` | SQL | Atomic order + inventory deduction |

---

## 11. Third-Party Dependencies (Key)

| Package | Purpose |
|---------|---------|
| `react-router-dom` | Client-side routing |
| `lucide-react` | Icons |
| `xlsx` | Spreadsheet parsing for import |
| `react-markdown` | Markdown rendering (AI responses) |
| `vite-plugin-pwa` | PWA support |
| `tailwindcss` | Utility CSS |
| `@supabase/supabase-js` | Database client |

---

## 12. Known Patterns & Conventions

1. **Dark theme only** — No light mode. All colors use slate-800/900 backgrounds.
2. **Toast notifications** — Used for success/error feedback (no custom toast library — inline).
3. **Modals** — All modals are local state-driven (no global modal manager).
4. **Loading states** — Components show `Loader2` spinner from lucide-react.
5. **Error handling** — Try/catch with console.error + user-facing toast.
6. **Data fetching** — Direct Supabase client calls in hooks, no React Query.
