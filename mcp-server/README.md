# Vanto Zazi CRM MCP Server

Connects Claude directly to your Vanto Zazi CRM ("GetWell Grow") app via a
locked-down Supabase Edge Function ("mcp-bridge") — no Lovable credits used,
no raw database password needed anywhere. Mirrors the same pattern already
in production for Get Well Hub (`Vantovant/getwellhub-mcp`).

## How it fits together

Claude → this server (on Railway) → `mcp-bridge` edge function (in this repo) → your database

## Where these files go

This was delivered as two pieces you drop into your **existing**
`vanto-zazi-crm-ui` repo (no new GitHub repo needed):

```
vanto-zazi-crm-ui/
├── supabase/functions/mcp-bridge/index.ts   ← the bridge (deploys with the rest of your Supabase functions)
└── mcp-server/                              ← this folder (deploys separately, to Railway)
    ├── package.json
    ├── README.md
    └── src/index.js
```

## Step 1 — Set secrets on the mcp-bridge edge function

In your Supabase project (or Lovable → Project Settings → Secrets, whichever
you use to manage this project's function secrets), set:

- **`MCP_BRIDGE_TOKEN`** — make up any long random string yourself, e.g.
  `vzc-8x2k9-mySecretToken-42`. This is the shared secret between this
  server and the bridge function. **Do not commit this value to git** — the
  repo is public.
- **`DEFAULT_OWNER_EMAIL`** (or reuse the existing `ZAZI_DEFAULT_OWNER_EMAIL`
  if you already set one for `crm-webhook`) — the email of the account whose
  contacts/orders/prospector data these tools should operate on. The bridge
  uses the service-role key, which bypasses row-level security entirely, so
  this scoping step matters: without it, nothing would work; done wrong, it
  could expose the wrong tenant's data in a multi-user setup.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` should already exist as
Supabase's own default function secrets — no action needed there.

## Step 2 — Choose a secret API key for this server

Make up another random long string, separate from Step 1's token, e.g.
`vzc-mcp-9pQz-key-77`. This protects the Railway server itself.

## Step 3 — Deploy `mcp-server/` to Railway

1. Create a new Railway service from this GitHub repo.
2. In Railway's service settings, set the **Root Directory** to `mcp-server`
   (so Railway only builds this subfolder, not the whole frontend).
3. In the service's **Variables** tab, add:
   - `MCP_BRIDGE_TOKEN` = the value from Step 1
   - `MCP_API_KEY` = the value from Step 2
4. Deploy. Railway will give you a public URL like
   `https://vanto-zazi-mcp-production.up.railway.app`. Your MCP endpoint is
   that URL + `/mcp`.

## Step 4 — Connect it to Claude

In Claude's settings, add a **custom connector**:

- **URL**: your deployed `/mcp` endpoint
- **Authorization header**: `Bearer <your MCP_API_KEY from Step 2>`

Once connected, you can ask Claude things like:
- "List my hot leads"
- "Show me everything on contact [name/phone]"
- "Log a note on [contact]: had a great call today"
- "What orders are still pending?"
- "What's in the prospector queue waiting for review?"

## Available tools (v1 — deliberately safety-scoped)

- `list_contacts` — filter by lead_type / lead_temperature / registration_status / search (read-only)
- `get_contact` — full detail + last 10 activity entries (read-only)
- `update_contact` — edit specific fields only; phone number excluded on purpose
- `add_contact_note` — append-only activity log entry
- `list_orders` — filter by status / contact (read-only — no order creation/editing)
- `get_prospector_status` — counts + pending review items (read-only — never sends)

**Deliberately not included (still true in 2.1.0):** anything that sends a
WhatsApp message, creates/edits an order, or deletes anything. Sending stays
behind the app's existing approval workflow (`zazi_actions` →
`maytapi-send-1to1`), not this bridge — see the architecture notes in the
technical report for why a shared-token bridge with service-role DB access
shouldn't be handed broader write/send power without per-caller scoping.

## Local testing (optional)

```bash
cd mcp-server
npm install
MCP_BRIDGE_TOKEN="your-bridge-token" MCP_API_KEY="your-secret" npm start
```

Then it runs at `http://localhost:3000/mcp`.

## Known open items

- **`lead_type` / `lead_temperature` / `registration_status` /
  `communication_status` have no DB-level enum** — their `CHECK` constraints
  were dropped in migration `20260210103356_...sql`. The bridge and tool
  descriptions treat these as free text rather than guessing at a fixed list,
  to avoid rejecting legitimate values the app itself already uses.
- **Single-owner scoping via `DEFAULT_OWNER_EMAIL`** — if you want this to
  eventually operate across multiple team members' data rather than one
  configured account, that needs deliberate design (per-caller identity,
  not just the shared bridge token), not a default.

## Version 2.1.0 — Call Sheets tools

Same design as before: read-mostly, **no WhatsApp sending, no order writes, no
deletes**, and none of these tools change consent, unsubscribe,
`auto_send_opt_out` or `communication_status`. Fields match the
`call_sheet_cards` view used by the in-app Call Sheets page. Writes are marked **WRITES**.

| Tool | What it does | Example call |
|---|---|---|
| `list_call_sheet` | Read. Cards for one level (latest export only) + last 3 history lines | `{"level": 1, "bucket": "open", "not_called_today": true}` |
| `get_call_sheet_card` | Read. One card + last 10 history lines + last 10 WhatsApp messages | `{"aplgo_id": "1318879"}` |
| `get_whatsapp_thread` | Read. Last N messages (default 30), direction/date/text/media label | `{"contact_id": "<uuid>", "limit": 30}` |
| `log_call` | **WRITES** one call, same as "Save call" | `{"contact_id": "<uuid>", "outcome": "Call back", "notes": "Busy", "follow_up_on": "2026-11-02"}` |
| `list_calls` | Read. Calls in a date range (default today) | `{"from": "2026-10-01", "to": "2026-10-31", "level": 2}` |
| `list_followups_due` | Read. Follow-ups due on/before a date (default today) | `{"on_or_before": "2026-11-05"}` |
| `list_needs_level` | Read. "Needs a level" + "Outside the range" lists | `{}` |
| `set_contact_level` | **WRITES** level 1–12 (+ leg, GO status) and a note | `{"contact_id": "<uuid>", "level": 3, "leg": "L"}` |
| `bulk_set_levels` | **WRITES** up to 100 export rows; marks matched people as in the latest export; never creates contacts | `{"items": [{"aplgo_id": "1318879", "level": 1, "leg": "R"}, {"phone": "0821234567", "level": 2}]}` |
| `get_call_sheet_settings` | Read. Level range and day windows | `{}` |
| `set_call_sheet_settings` | **WRITES** only the settings given | `{"max_level": 12, "export_fresh_days": 45}` |

Errors are returned as JSON, e.g. `contact_not_found`, `invalid_outcome`,
`level_must_be_1_to_12`.

### Redeploying after this update

The `mcp-bridge` function updates with the app. The Railway server must be
redeployed so Claude sees the new tools: in Railway open this service and click
**Deploy** (or **Redeploy** on the latest deployment) after the GitHub change
reaches your repo. No new environment variables are needed.
