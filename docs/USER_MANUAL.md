# Vanto Zazi — User Manual

**Version:** 1.0  
**Last Updated:** 2026-03-08

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Contacts](#3-contacts)
4. [Activities](#4-activities)
5. [Orders](#5-orders)
6. [Deals](#6-deals)
7. [WhatsApp](#7-whatsapp)
8. [Import / Export](#8-import--export)
9. [Duplicates](#9-duplicates)
10. [ZAZI Copilot (AI Assistant)](#10-zazi-copilot-ai-assistant)
11. [AI Settings](#11-ai-settings)
12. [Chrome Extension](#12-chrome-extension)
13. [Admin: Tester Dashboard](#13-admin-tester-dashboard)
14. [Account Management](#14-account-management)
15. [FAQ & Troubleshooting](#15-faq--troubleshooting)

---

## 1. Getting Started

### Creating Your Account

1. You need an **invite code** to sign up. Get one from your team admin.
2. Go to the app URL or use an invite link (`https://app-url/auth?invite=XXXXXX`).
3. Click **"Don't have an account? Sign up"**.
4. Fill in your **email**, **password**, **display name**, and **invite code**.
5. Click **Sign Up**.
6. Check your email and **verify your address** by clicking the confirmation link.
7. Return to the app and **sign in** with your email and password.

### Signing In

1. Go to the app URL.
2. Enter your **email** and **password**.
3. Click **Sign In**.

### Forgot Password

1. On the sign-in screen, click **"Forgot password?"**
2. Enter your email address.
3. Check your inbox for a reset link.
4. Click the link and set a new password.

---

## 2. Dashboard

The Dashboard is your home screen — a snapshot of your entire CRM.

### KPI Cards
At the top you'll see 5 cards:
- **Total Prospects** — All contacts in your system
- **Hot Leads** — Contacts marked as Hot temperature
- **Warm Leads** — Contacts marked as Warm temperature
- **Cold Leads** — Contacts marked as Cold temperature
- **Registered** — Contacts with Registered or Activated status

### Order Stats
Below the KPIs, you'll see revenue metrics:
- Total Revenue, Paid, Pending amounts
- Activity PV and Upgrade PV totals
- Total order count

### Today's Focus
- **Follow-Ups:** Contacts with a "Next Action" set — your to-do list
- **Neglected Contacts:** Contacts you haven't interacted with in 7+ days

### Recent Activity
A feed of your latest logged activities (WhatsApp messages, calls, meetings, notes).

### Recent Prospects
A quick table of the 5 most recently added contacts. Click any row to open the Contact Drawer.

### AI Daily Brief
Click the **✨ Daily Brief** button to get an AI-generated summary of your CRM state, priorities, and recommendations.

---

## 3. Contacts

This is the core of Vanto Zazi — your complete contact database.

### Viewing Contacts
- The table shows all your prospects with configurable columns.
- Use the **search bar** to find contacts by name, phone, or email.
- Click **Columns** to show/hide specific fields.

### Filtering
Click any filter dropdown to narrow the view:
- **Lead Temperature:** Hot, Warm, Cold
- **Registration Status:** Not Registered, Registered, Activated
- **Lead Type:** Prospect, Registered_Nopurchase, Purchase_Nostatus, Purchase_Status
- **Focus Area:** Business, Product, Both
- **Lead Path:** Various paths

Active filters appear as badges. Click **✕** on a badge to remove it.

### Adding a Contact
1. Click the **+ Add Contact** button (in the topbar or contacts page).
2. Fill in the contact details (name is required).
3. The system will **automatically check for duplicates** by phone and email.
4. If a duplicate is detected, you'll see a warning.
5. Click **Save** to create the contact.

### Editing a Contact
1. Click a row to open the **Contact Drawer**.
2. Click the **✏️ Edit** button.
3. Modify fields in the Edit Contact modal.
4. Click **Save**.

### Contact Drawer
When you click a contact, a slide-out panel appears with:
- **Full contact details** — all 22 fields
- **Activity timeline** — all logged activities for this contact
- **Quick actions:**
  - Open WhatsApp (wa.me link)
  - Copy phone number
  - AI-suggested next message
  - Log an activity
  - Edit contact

### Deleting Contacts
1. Check the boxes next to contacts you want to remove.
2. Click the **🗑️ Delete Selected** button.
3. Confirm the deletion.

---

## 4. Activities

Track every interaction with your prospects.

### Viewing Activities
- Activities are displayed in a **timeline** grouped by date.
- Each entry shows: type icon, contact name, summary, and time ago.

### Logging an Activity
1. Click **+ Log Activity** button.
2. Select the **contact** from the dropdown.
3. Choose the **activity type:** WhatsApp, Call, Meeting, Note, Registration.
4. Write a **summary** of the interaction.
5. Optionally add **notes** and a **next action**.
6. Click **Save**.

### Neglected Contacts
The panel on the right shows:
- **Neglected (7+ days):** Contacts with no recent activity, sorted by Leg assignment.
- **Never Contacted:** Contacts with zero logged activities ever.

Click any name to open their Contact Drawer.

### AI Insights
Click **✨ AI Insights** to get an AI analysis of your activity patterns and suggestions for improvement.

---

## 5. Orders

Manage product orders and track PV (Point Value).

### Viewing Orders
- The table shows all orders with columns: Order ID, Contact, Product, Qty, Amount, PV, Status, Type, Badges, Date.
- Use search, status filter, product filter, contact filter, and date range to narrow results.

### Adding an Order Manually
1. Click **+ Add Order**.
2. Select the contact, product, quantity, amount, PV, purchase type, and status.
3. Click **Save**.

### Smart Paste (AI-Powered)
This is the fastest way to add orders from your APLGO backoffice:

1. Click the **✨ Smart Paste** button.
2. Copy the orders table from your APLGO backoffice website.
3. Paste the text into the text area.
4. Optionally select a contact to associate all orders with.
5. Click **Parse Orders** — the AI will extract structured order data.
6. Review the parsed orders in the preview table.
7. Click **Import All** to save them to your database.

> **Tip:** If parsing times out, try pasting smaller amounts of data at a time.

### Order Statuses
- **Pending** — Order placed, not yet paid
- **Paid** — Payment received
- **Delivered** — Product delivered
- **Activated** — Contact activated their account

---

## 6. Deals

The Deals page provides a **revenue-focused view** of your activated contacts.

### How Deals Work
- A "deal" is automatically derived from contacts who are Registered or Activated.
- Deal values are calculated from their orders, or estimated based on their GO-Status rank.
- Two categories:
  - **Activation Only** — Activated but no GO-Status rank
  - **[Rank Name]** — Has a specific rank (Promoter, Associate, Builder, Mentor, VIP, Diamond)

### Deal Values by Rank (Estimated Minimum)
| Rank | Estimated Value (ZAR) |
|------|----------------------|
| Diamond | R45,000 |
| VIP | R27,000 |
| Mentor | R9,000 |
| Builder | R6,000 |
| Associate | R3,000 |
| Promoter | R1,500 |
| Activation Only | R375 |

### Features
- Search by contact name
- Filter by deal status, GO-Status
- View breakdown: Upgrade PV, Activity PV, Upgrade ZAR, Activity ZAR
- Export deals to CSV
- Click a deal to open the Contact Drawer

---

## 7. WhatsApp

A dedicated workspace for WhatsApp outreach.

### Contact List
- Shows all contacts with phone numbers.
- Search by name or phone number.
- Temperature indicators (Hot 🔴, Warm 🟡, Cold 🔵) next to each name.

### Contact Detail Panel
When you select a contact:
1. **Open WhatsApp** — Opens WhatsApp Web with the contact's number pre-filled.
2. **Copy Phone** — Copies the phone number to clipboard.
3. **AI Suggest Message** — Click ✨ to get an AI-generated message suggestion based on the contact's profile, history, and temperature.
4. **Copy Message** — Copy the AI suggestion to clipboard.
5. **Send to WhatsApp** — Opens WhatsApp with the AI message pre-filled.
6. **Log Activity** — Quick log a WhatsApp activity for this contact.
7. **Set Follow-Up** — Schedule a follow-up action.

---

## 8. Import / Export

### Importing Contacts

#### AI-Powered Smart Import (Recommended)
1. Go to **Import / Export** page.
2. Click **Upload** or drag-and-drop a file (CSV, XLSX, or XLS).
3. The AI will analyze your headers and **auto-map** them to CRM fields.
4. Review the mapping — adjust any fields the AI got wrong.
5. Click **Preview** to see how data will be imported.
6. Click **Import** to start.
7. View the summary: how many contacts were created, updated, or skipped.

#### Manual Mapping (Fallback)
If AI mapping is unavailable, you can manually select which CRM field each column maps to.

#### Duplicate Handling
- During import, the system checks each contact's phone and email against existing records.
- If a match is found, the existing contact is **updated** (not duplicated).
- The summary shows "updated" count separately from "created".

### Exporting Data
Click any export button to download a CSV file:
- **Export Contacts** — All contacts with all fields
- **Export Orders** — All orders
- **Export Deals** — Activated contacts with deal values
- **Export Activities** — All logged activities

---

## 9. Duplicates

### Viewing Duplicates
- The Duplicates page automatically scans your contacts for duplicates based on **normalized phone** or **normalized email**.
- Duplicate groups are displayed as expandable cards.

### Merging Duplicates
1. Expand a duplicate group to see all matching contacts.
2. The system auto-selects the **most recent** record as the primary.
3. Click **Merge** to combine them:
   - The primary contact is kept.
   - Notes from secondary contacts are appended with timestamps.
   - All orders and activities are reassigned to the primary contact.
   - Secondary contacts are deleted.

### Prevention
- The database has unique constraints on normalized phone and email.
- Adding a contact with a duplicate phone or email shows an error message.

---

## 10. ZAZI Copilot (AI Assistant)

ZAZI is your AI-powered CRM assistant, accessible via the **floating chat bubble** in the bottom-right corner.

### Tabs

| Tab | What it does |
|-----|-------------|
| **Ask** | Free-form questions about your CRM data. ZAZI has context about all your contacts, orders, and activities. |
| **Page** | Analyzes whatever page you're currently on and provides insights. |
| **Contact** | When a Contact Drawer is open, provides AI analysis of that specific contact. |
| **Insight** | Strategic recommendations for your business. |
| **Knowledge** | Upload documents (PDF, DOCX, TXT) that ZAZI uses as reference material for better answers. |

### Knowledge Base
1. Click the **Knowledge** tab.
2. Click **Upload** and select a document.
3. The document is processed and its text is extracted.
4. ZAZI will use this information when answering your questions.
5. You can delete documents you no longer need.

### Tips for Best Results
- Be specific: "Which hot leads haven't been contacted this week?" is better than "Tell me about my leads."
- Use the Contact tab when you have a specific person open.
- Upload your product catalogs and training materials to the Knowledge tab.

---

## 11. AI Settings

Access AI Settings via the **⚙️ CPU icon** in the topbar.

### Options
- **Lovable AI (Default):** Uses built-in AI models — no API key needed.
- **OpenAI:** Enter your own OpenAI API key for GPT models.
- **Google Gemini:** Enter your own Gemini API key.

Your API keys are stored securely in the database and are only used for your account.

---

## 12. Chrome Extension

The Vanto Zazi Chrome Extension syncs contacts from WhatsApp Web to your CRM.

### Installation
1. Download the `chrome-extension` folder from the project.
2. Open Chrome → `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** → select the `chrome-extension` folder.

### Usage
1. Open [WhatsApp Web](https://web.whatsapp.com) in Chrome.
2. Click the **Vanto Zazi** extension icon.
3. Log in with your CRM email and password.
4. Click **Sync WhatsApp Contacts**.
5. The extension scrapes visible contacts and syncs them to your CRM.

### Notes
- Only individual chats are synced (group chats are skipped).
- Existing contacts are matched by phone number (no duplicates).
- Scroll down in WhatsApp to load more contacts before syncing.

---

## 13. Admin: Tester Dashboard

> **Access:** Only available to users with the `admin` role.

The Tester Dashboard at `/team` provides oversight of all app users.

### Invite Management
- **Create Invite:** Enter a label and click **+ Create** to generate a 6-character invite code.
- **Copy Link:** Click the copy icon to copy the full invite URL.
- **Delete:** Remove unused invites.
- **Status:** See which invites have been used and by whom.

### Tester Activity Table
For each registered user, you can see:
- Display name and email
- Join date
- Last active timestamp
- Total actions performed
- Contacts and orders created
- Pages visited with frequency breakdown

### AI UX Report
Click **✨ Generate AI Report** to get an AI analysis of:
- How testers are using the app
- Which features are popular/ignored
- UX improvement suggestions
- Onboarding recommendations

---

## 14. Account Management

### Changing Your Password
1. Click the **🔒 Lock icon** in the topbar.
2. Enter your new password.
3. Click **Change Password**.

### Signing Out
Click the **↪️ Sign Out** icon in the topbar.

---

## 15. FAQ & Troubleshooting

**Q: I can't sign up — "Invalid invite code"**  
A: Ask your team admin for a valid, unused invite code.

**Q: I signed up but can't sign in**  
A: Check your email for a verification link. You must verify your email before signing in.

**Q: My imported contacts are showing as duplicates**  
A: Go to the Duplicates page and merge them. Future imports will upsert by phone/email.

**Q: Smart Paste timed out**  
A: Try pasting smaller amounts of backoffice data. The AI needs time to parse large datasets.

**Q: I don't see the Tester Dashboard**  
A: This page is only visible to admin users. Contact your system administrator.

**Q: The AI says "Failed to send request"**  
A: Check your internet connection. If the issue persists, try refreshing the page.

**Q: How do I export my data?**  
A: Go to Import / Export → scroll to the Export section → click the relevant export button.

**Q: Can I undo a merge?**  
A: No, merges are permanent. The merge log records what was merged for auditing purposes.
