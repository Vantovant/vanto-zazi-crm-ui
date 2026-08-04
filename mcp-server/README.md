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

**Deliberately not included in this first version:** anything that sends a
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
