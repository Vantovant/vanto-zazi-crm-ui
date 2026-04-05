# Vanto Zazi — TODO, Known Issues & Coming Soon

**Date:** 2026-04-05  
**Status:** Active Development

---

## 1. Outstanding TODO Items

### High Priority
- [ ] **Order Detail Drawer** — Full order detail expansion with edit capability (currently inline-only)
- [ ] **Help Page** — Currently a placeholder (`PlaceholderPage`), needs real content with FAQ, tutorials, support contact
- [ ] **Offline data queue** — Queue CRM mutations (add contact, log activity) when offline and sync on reconnect
- [ ] **Real-time notifications** — Supabase Realtime for new activities, orders, follow-up reminders

### Medium Priority
- [ ] **Bulk edit contacts** — Edit multiple contacts' fields at once (e.g., change lead type for selected)
- [ ] **Contact tags/custom fields** — Allow users to add custom tags beyond the fixed 22-field schema
- [ ] **Order editing** — Edit existing orders (currently create-only)
- [ ] **Activity reminders** — Push notifications or in-app reminders for scheduled follow-ups
- [ ] **Dashboard date range filter** — Filter KPIs and stats by custom date ranges
- [ ] **Mobile activity goals display** — Activity goals panel visibility improvements on small screens

### Low Priority
- [ ] **Dark/light mode toggle** — Currently dark-only; some users may prefer light mode
- [ ] **Multi-language support** — i18n for non-English users
- [ ] **Contact profile photos** — Avatar upload per contact
- [ ] **Export to PDF** — PDF report generation for deals and activities
- [ ] **Keyboard shortcuts** — Power-user navigation shortcuts

---

## 2. Known Issues — Needs Investigation

### Authentication & Access
- [ ] **Owner-only pages use hardcoded UUID** — `OWNER_ID` in Sidebar.tsx is hardcoded. Should use `has_role()` from `user_roles` table for proper admin access control.
- [ ] **Invite code race condition** — If two users try the same code simultaneously, both might pass validation. Needs atomic check-and-mark.

### Data & Performance
- [ ] **1000-row query limit** — Supabase default limit may hide data for users with large contact lists. Pagination not implemented on Contacts page.
- [ ] **CrmContext loads all contacts on mount** — No pagination or lazy loading. Performance may degrade with 500+ contacts.
- [ ] **Contact field mapping inconsistency** — Frontend uses PascalCase (`FullName`), DB uses snake_case (`full_name`). Mapping happens in CrmContext but is fragile.

### UI/UX
- [ ] **Smart Paste timeout** — Large backoffice pastes can timeout. Needs chunking or progress indicator.
- [ ] **Neglected contacts performance** — Computes neglected list on every render. Should memoize with dependency on activities data.
- [ ] **Mobile sidebar overlap** — PWA install banner and sidebar can overlap on small screens.
- [ ] **Column visibility not persisted** — Column preferences reset on page reload. Should save to localStorage or DB.

### PWA
- [ ] **iOS install detection** — Cannot reliably detect if already installed on iOS. Banner may show to already-installed users.
- [ ] **Service worker cache invalidation** — After deployments, users may see stale app shell until manual refresh.

### AI Features
- [ ] **Streaming response parsing** — SSE parsing in Dashboard (ZAZI Mail) silently drops malformed chunks. Needs error handling.
- [ ] **Knowledge doc size limits** — No file size validation on upload. Large PDFs may fail text extraction.
- [ ] **Template merge field failures** — If contact data is missing (e.g., no `go_status`), merge fields show as `{{rank}}` literally.

---

## 3. Coming Soon — Planned Features

### Phase 1 — Near Term (Next Sprint)
- 🔔 **Follow-up reminders** — In-app notification bell with overdue follow-ups
- 📊 **Contact analytics** — Per-contact engagement score based on activity frequency and recency
- 📋 **Bulk import templates** — Pre-built CSV templates for common import formats
- ✏️ **Inline contact editing** — Edit fields directly in the contacts table without opening drawer

### Phase 2 — Mid Term
- 📱 **WhatsApp Business API integration** — Direct message sending from CRM (beyond wa.me links)
- 🏆 **Gamification** — Points, badges, leaderboard for team activity
- 📈 **Advanced reporting** — Custom date range reports with charts (contacts growth, revenue trend)
- 🗓️ **Calendar view** — Visual calendar for meetings and follow-ups
- 👥 **Team management** — Multi-user teams with shared contacts and role-based views

### Phase 3 — Long Term
- 🌍 **Multi-MLM support** — Configurable product catalogs beyond APLGO
- 📧 **Email campaigns** — Bulk email sending with template library
- 🔗 **Zapier/Make integration** — Connect to external tools via webhooks
- 📱 **Native mobile app** — React Native companion app
- 🧠 **AI lead scoring** — Automated lead temperature based on engagement patterns

---

## 4. Technical Debt

| Item | Severity | Description |
|------|----------|-------------|
| No test suite | High | Zero unit/integration tests. Should add Vitest + React Testing Library |
| No error boundary | Medium | App crashes show blank screen. Need React Error Boundary component |
| No React Query | Medium | Direct Supabase calls in hooks. React Query would add caching, retry, deduplication |
| No global state management | Low | CrmContext works but doesn't scale. Consider Zustand for complex state |
| Hardcoded product catalog | Low | `src/data/productCatalog.ts` should be a DB table for configurability |
| No API rate limiting | Medium | Edge functions have no rate limiting. Could be abused |
| Console.log in production | Low | Debug logs still present in production builds |
| No CSP headers | Medium | No Content Security Policy headers configured |
