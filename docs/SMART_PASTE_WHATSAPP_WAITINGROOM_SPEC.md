# Smart Paste · WhatsApp Appreciation Engine · Waiting Room — Feature Specification

**Version:** 1.0  
**Date:** 2026-04-12  
**Status:** Implemented & Live

---

## Table of Contents

1. [Overview](#overview)
2. [Smart Paste — Monthly Activity Import](#smart-paste--monthly-activity-import)
3. [WhatsApp Appreciation Engine](#whatsapp-appreciation-engine)
4. [Contact Waiting Room / To-Do List](#contact-waiting-room--to-do-list)
5. [End-to-End Workflow](#end-to-end-workflow)
6. [Data Model](#data-model)
7. [Phone Number Normalization](#phone-number-normalization)
8. [Security & Access Control](#security--access-control)
9. [Files & Architecture](#files--architecture)

---

## 1. Overview

These three features form a connected operational pipeline on the **Activities** page:

| Step | Feature | Purpose |
|------|---------|---------|
| 1 | **Smart Paste** | Bulk-import monthly activity purchase data from APLGO back-office reports |
| 2 | **WhatsApp Appreciation Engine** | Generate and send personalized thank-you messages to members who purchased |
| 3 | **Waiting Room** | Park contacts that need manual correction (wrong number, missing info) for later follow-up |

The pipeline flow: **Paste → Match → Appreciate → Park problems**.

---

## 2. Smart Paste — Monthly Activity Import

### Purpose

Allows the user to paste raw text from the APLGO back-office monthly activity report and bulk-import purchase records as orders.

### Input Format

```
Level 1
1129930(6): 2,520.00 R
934517: 2,385.00 R

Level 2
884012: 1,200.00 R
```

### Parsing Rules

| Element | Rule |
|---------|------|
| `Level N` header | Sets `displayedLevel` for all subsequent rows until next header |
| User ID (digits before `:`) | Matched to `contacts.aplgo_id` |
| `(N)` after user ID | Optional actual-level override (`actualLevel`); defaults to `displayedLevel` |
| Amount after `:` | ZAR amount; thousands-separator commas stripped before parsing |
| `R` suffix | Currency indicator (always ZAR) |
| Comma-separated entries | Multiple entries on one line are supported |

### Parser Implementation

- **File:** `src/utils/monthlyActivityParser.ts`
- **Function:** `parseMonthlyActivityReport(text: string): MonthlyActivityRow[]`
- **Output per row:** `{ userId, displayedLevel, actualLevel, amount, currency: 'ZAR', purchaseType: 'monthly_activity' }`

### Modal UI

- **File:** `src/components/MonthlyActivityPasteModal.tsx`
- **Steps:** Input → Preview (with match status) → Save → Done
- **Month selector:** User picks the activity month (defaults to current month/year)
- **Contact matching:** Each parsed user ID is matched against `contacts.aplgo_id`
  - ✅ **Matched** — linked to contact, selectable for saving
  - ❌ **Unmatched** — shown but cannot be saved as orders
- **Deduplication:** Uses `dedupe_key` = `activity-{month}-{userId}` with a database-level unique partial index to prevent duplicate imports
- **Order creation:** Saved with `purchase_type: 'Activity'`, `source: 'monthly-activity-paste'`

### Post-Save Trigger

On successful save, the modal passes matched entries to `onComplete`, which triggers the **Appreciation Engine** for bulk WhatsApp outreach.

---

## 3. WhatsApp Appreciation Engine

### Purpose

Generates personalized WhatsApp appreciation messages for members who made monthly activity purchases, then opens `wa.me` links for one-click sending.

### Entry Points

1. **Bulk:** Triggered automatically after Smart Paste completes — all matched contacts are queued
2. **Single:** Click the 👑 crown icon on any row in the "Activity Paid" section on the Activities page

### Modal UI

- **File:** `src/components/ActivityAppreciationModal.tsx`
- **Navigation:** Left/right arrows to cycle through queued contacts
- **Progress indicator:** "1 of 12" counter

### Message Generation

Each message includes:

| Component | Detail |
|-----------|--------|
| **Brand link** | `https://vanto-zazi-bloom.lovable.app/aplgo.html` — triggers Open Graph rich preview card |
| **Greeting** | Personalized using salutation + name via `generateGreeting()` |
| **Amount** | Formatted as `R2,520` |
| **Month** | The activity month selected during paste |
| **Level/Leg** | Shown if available on the contact record |
| **Tone** | User-selectable: Warm 💖, Royal 👑, Leadership 💼, Professional 🏆 |
| **Signature** | Dynamic: user's display name + email from auth profile |

### Tone Variants

| Tone | Style |
|------|-------|
| `warm` | Heartfelt, family-oriented |
| `royal` | Celebratory, majestic language |
| `leadership` | Motivational, empowering |
| `professional` | Clean, respectful, brief |

### WhatsApp Link Generation

- **Utility:** `src/utils/whatsappPhone.ts` → `buildWhatsAppUrl(phone, country, message)`
- Normalizes phone numbers with correct country codes (see §7)
- Opens `https://wa.me/{e164Phone}?text={encodedMessage}`

### Activity Logging

When appreciation is sent, an activity is logged:
- `activity_type: 'whatsapp'`
- `summary: 'Monthly activity appreciation — {Month}'`

### Fallback Contacts

If an order exists but no linked contact record is found, a `fallbackContact` object is generated from the order data so the crown icon and appreciation flow still work.

---

## 4. Contact Waiting Room / To-Do List

### Purpose

A dedicated operational panel for parking contacts that need manual correction before further engagement (e.g., wrong WhatsApp number discovered during appreciation).

### Database Table

**Table:** `contact_waiting_room`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | — | Owner (RLS-scoped) |
| `contact_id` | uuid | — | FK to `contacts.id` |
| `issue_type` | text | `'other'` | Categorized issue |
| `issue_note` | text | `''` | Free-text description |
| `priority` | text | `'medium'` | `high` / `medium` / `low` |
| `status` | text | `'open'` | `open` / `in_progress` / `resolved` |
| `created_at` | timestamptz | `now()` | When added |
| `updated_at` | timestamptz | `now()` | Last modified |

### Issue Type Presets

| Value | Label |
|-------|-------|
| `whatsapp_not_working` | WhatsApp not working |
| `wrong_email` | Wrong email |
| `wrong_phone` | Wrong phone number |
| `missing_contact_info` | Missing details |
| `duplicate_review` | Duplicate review |
| `wrong_aplgo_id` | Wrong APLGO ID |
| `follow_up_correction` | Need follow-up correction |
| `other` | Other |

### Activities Page Panel

- **Location:** Dedicated "To-Do Waiting Room" section on Activities page
- **Badge:** Count of open entries
- **Filters:** All open, High priority only, Resolved
- **Row display:** Contact name, issue type label, priority badge (color-coded), date added
- **Actions per row:** Open contact drawer, Mark resolved, Remove

### Contact Drawer Integration

- **File:** `src/components/ContactDrawer.tsx`
- Shows whether contact is already in the waiting room
- "Send to Waiting Room" button opens the `AddToWaitingRoomModal`
- If already queued: shows status, issue type, note inline with edit/resolve options

### Add to Waiting Room Modal

- **File:** `src/components/AddToWaitingRoomModal.tsx`
- Issue type selector (grid of preset buttons)
- Free-text note field
- Priority selector (High / Medium / Low)

### Activity Logging

When a contact is added to the waiting room, a `note` activity is logged:
- `summary: 'Added to waiting room'`
- `notes: '{issue_type}: {issue_note}'`

### Hook

- **File:** `src/hooks/useWaitingRoom.ts`
- CRUD operations: `addToWaitingRoom`, `updateEntry`, `removeEntry`
- Computed lists: `openEntries`, `resolvedEntries`, `highPriorityEntries`
- Lookup: `getEntryForContact(contactId)` — checks if contact has an open entry

---

## 5. End-to-End Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. USER PASTES MONTHLY ACTIVITY REPORT                     │
│     MonthlyActivityPasteModal → parseMonthlyActivityReport  │
│     Contacts matched by APLGoID → Orders created            │
└────────────────────────┬────────────────────────────────────┘
                         │ onComplete(matchedEntries)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. APPRECIATION ENGINE LAUNCHES                            │
│     ActivityAppreciationModal opens with all matched entries│
│     User selects tone → message generated → WhatsApp opened │
└────────────────────────┬────────────────────────────────────┘
                         │ WhatsApp fails? Wrong number?
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  3. CONTACT SENT TO WAITING ROOM                            │
│     User clicks "Send to Waiting Room" in Contact Drawer    │
│     Issue type + note + priority saved                      │
│     Contact appears in Waiting Room panel on Activities     │
└────────────────────────┬────────────────────────────────────┘
                         │ Later, user fixes the issue
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  4. RESOLVED                                                │
│     User marks entry as resolved or removes it              │
│     Contact returns to normal workflow                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Data Model

### Orders (Activity purchases)

| Field | Value |
|-------|-------|
| `purchase_type` | `'Activity'` |
| `source` | `'monthly-activity-paste'` |
| `dedupe_key` | `'activity-{Month Year}-{aplgoId}'` |
| `product` | `'Monthly Activity'` |
| `sales_channel` | `'Back Office'` |
| `status` | `'Paid'` |

### Contact Activities (logged events)

| Scenario | `activity_type` | `summary` |
|----------|-----------------|-----------|
| Appreciation sent | `whatsapp` | `Monthly activity appreciation — April 2026` |
| Added to waiting room | `note` | `Added to waiting room` |
| Resolved from waiting room | `note` | `Resolved waiting room issue` |

---

## 7. Phone Number Normalization

**File:** `src/utils/whatsappPhone.ts`

### Functions

- `formatWhatsAppPhone(rawPhone, country)` → E.164 digits or `null`
- `buildWhatsAppUrl(rawPhone, country, message?)` → full `wa.me` URL or `null`

### Country Rules

| Country | Input Pattern | Output |
|---------|--------------|--------|
| South Africa | `079 123 4567` | `27791234567` |
| South Africa | `0791234567` (10 digits, starts with 0) | `27791234567` |
| South Africa | `791234567` (9 digits) | `27791234567` |
| Lesotho | `058001234` (9 digits, starts with 0) | `26658001234` |
| Lesotho | `58001234` (8 digits) | `26658001234` |
| Any | `27791234567` (11-15 digits) | `27791234567` (passed through) |

### Normalization Pipeline

1. `normalizePhone()` from `contactNormalization.ts` strips spaces, dashes, brackets
2. Leading `00` stripped (international prefix)
3. Country detected from contact's `country` field
4. Local format converted to international

---

## 8. Security & Access Control

| Table | RLS | Scope |
|-------|-----|-------|
| `contact_waiting_room` | ✅ Enabled | `user_id = auth.uid()` for all CRUD |
| `orders` | ✅ Enabled | `user_id = auth.uid()` for all CRUD |
| `contact_activities` | ✅ Enabled | `user_id = auth.uid()` for SELECT, INSERT, DELETE |
| `contacts` | ✅ Enabled | `user_id = auth.uid()` for all CRUD |

All data is fully user-scoped. No cross-user visibility.

---

## 9. Files & Architecture

### Core Files

| File | Purpose |
|------|---------|
| `src/pages/Activities.tsx` | Main page — hosts all three panels |
| `src/components/MonthlyActivityPasteModal.tsx` | Smart Paste modal (input → preview → save) |
| `src/components/ActivityAppreciationModal.tsx` | WhatsApp appreciation message generator |
| `src/components/AddToWaitingRoomModal.tsx` | Modal to add contact to waiting room |
| `src/components/ContactDrawer.tsx` | Contact detail panel with waiting room integration |

### Utilities & Hooks

| File | Purpose |
|------|---------|
| `src/utils/monthlyActivityParser.ts` | Parses raw APLGO activity report text |
| `src/utils/whatsappPhone.ts` | Phone normalization + `wa.me` URL builder |
| `src/utils/templateMerge.ts` | Greeting generation with merge fields |
| `src/hooks/useWaitingRoom.ts` | CRUD hook for `contact_waiting_room` table |
| `src/hooks/useContactActivities.ts` | Activity logging and retrieval |

### Database

| Migration | Table |
|-----------|-------|
| `20260411094343_*.sql` | `contact_waiting_room` with RLS policies |

---

*This document covers the interconnected Smart Paste → Appreciation → Waiting Room pipeline as implemented in the Vanto Zazi CRM.*
