// Vanto Zazi CRM ("GetWell Grow") — standalone MCP server
// Connects Claude to the app via a locked-down Supabase Edge Function
// ("mcp-bridge") instead of a direct database connection.
// Mirrors the architecture of Vantovant/getwellhub-mcp.

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration (set these as environment variables wherever you host this)
// ---------------------------------------------------------------------------
const BRIDGE_URL = "https://urfyfuakgabieellbuce.supabase.co/functions/v1/mcp-bridge";
const BRIDGE_TOKEN = process.env.MCP_BRIDGE_TOKEN; // must match the mcp-bridge edge function's MCP_BRIDGE_TOKEN secret
const MCP_API_KEY = process.env.MCP_API_KEY;       // shared secret you invent, protects THIS server
const PORT = process.env.PORT || 3000;

if (!BRIDGE_TOKEN) {
  console.error("Missing MCP_BRIDGE_TOKEN environment variable. Set it to match the mcp-bridge edge function secret.");
  process.exit(1);
}
if (!MCP_API_KEY) {
  console.error("Missing MCP_API_KEY environment variable. Set any secret string you choose.");
  process.exit(1);
}

async function callBridge(action, payload = {}) {
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mcp-token": BRIDGE_TOKEN,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Bridge call failed with status ${res.status}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// MCP server + tools
// Deliberately read-mostly / safety-scoped:
//   - No WhatsApp send capability exposed anywhere (sending stays behind the
//     app's own approval workflow in zazi_actions / maytapi-send-1to1).
//   - WhatsApp inbox tools only ever surface MATCHED contacts — unmatched /
//     unknown numbers (masked ••••XXXX in-app) are never reachable here.
//   - No order editing (orders are otherwise read-only here — financial data).
//     paste_monthly_activity is the one deliberate write path, and it is a
//     server-side mirror of the app's own Monthly Activity Paste modal (same
//     parsing, matching, and MP0.1 dedupe/Needs-Review rules), not a bypass
//     of them. It defaults to dry_run:true — nothing is written until the
//     caller explicitly reviews the preview and passes dry_run:false.
//   - No contact/inventory deletes. No duplicate-merge (detection only).
//   - No Sponsor ID placeholder-contact creation (that page is "no automatic
//     fixes" even in-app).
//   - No Prospector approve/reject/snooze/send — draft review only.
//   - update_contact only ever touches fields explicitly provided.
//   - add_contact_note is strictly additive.
//   - create_contact runs the same duplicate check the app's own UI runs.
//   - compose_birthday_message only COMPOSES text server-side from the same
//     templates as BirthdayComposerModal.tsx — it does not send anything and
//     does not mark a birthday congratulated. Sending/marking stays a
//     one-by-one, human-driven action in the app (or via the app's own
//     Maytapi-assisted send), same as the rest of this server's design.
// ---------------------------------------------------------------------------
function buildServer() {
  const server = new McpServer({
    name: "vanto-zazi-mcp",
    version: "1.3.0",
  });

  server.registerTool(
    "list_contacts",
    {
      title: "List contacts",
      description:
        "Read Zazi CRM contacts, optionally filtered by lead_type, lead_temperature, " +
        "registration_status, or free-text search on name/phone/email. Returns up to " +
        "100. Read-only. Note: lead_type / lead_temperature / registration_status / " +
        "communication_status are free text in this app (no fixed enum at the DB " +
        "level) — common values include lead_temperature: Hot/Warm/Cold; " +
        "registration_status: Not Registered/Registered/Activated; lead_type varies " +
        "(Prospect, Customer, Distributor, Expired, and others used historically).",
      inputSchema: {
        lead_type: z.string().optional().describe("Filter by lead type (free text, exact match)"),
        lead_temperature: z.string().optional().describe("Filter by temperature, e.g. Hot, Warm, Cold"),
        registration_status: z.string().optional().describe("Filter by registration status"),
        search: z.string().optional().describe("Free-text search on name, phone, or email"),
        limit: z.number().int().positive().max(100).optional().describe("Max results, default 25, max 100"),
      },
    },
    async (args) => {
      const data = await callBridge("list_contacts", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "get_contact",
    {
      title: "Get a single contact",
      description:
        "Full detail for one contact by id or normalized phone number, plus their " +
        "last 10 activity log entries. Read-only.",
      inputSchema: {
        contact_id: z.string().optional().describe("UUID of the contact"),
        phone_normalized: z.string().optional().describe("Normalized phone number, e.g. +27831234567"),
      },
    },
    async (args) => {
      const data = await callBridge("get_contact", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "update_contact",
    {
      title: "Update a contact",
      description:
        "Edit specific fields on a contact. Only the fields you provide are changed " +
        "— everything else is left untouched. Phone number is intentionally not " +
        "editable here (use the app UI, to avoid breaking duplicate-detection matching).",
      inputSchema: {
        contact_id: z.string().describe("UUID of the contact to update"),
        full_name: z.string().optional(),
        email_address: z.string().optional(),
        lead_type: z.string().optional().describe("Free text, e.g. Prospect, Customer, Distributor"),
        lead_temperature: z.string().optional().describe("e.g. Hot, Warm, Cold"),
        registration_status: z.string().optional().describe("e.g. Not Registered, Registered, Activated"),
        communication_status: z.string().optional().describe("e.g. New, In Progress, Pending, Completed"),
        assigned_to: z.string().optional(),
        next_action: z.string().optional(),
        sponsor_name: z.string().optional(),
        city: z.string().optional(),
        province: z.string().optional(),
        country: z.string().optional(),
      },
    },
    async (args) => {
      const data = await callBridge("update_contact", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "create_contact",
    {
      title: "Create a new contact",
      description:
        "Add a new contact to the CRM. Runs the same duplicate check the app's own " +
        "Add Contact flow runs (matching phone_number/email_address against existing " +
        "contacts) — if a likely duplicate is found, it returns that existing contact " +
        "instead of creating a new one, unless force=true is passed. Defaults mirror " +
        "the app: lead_temperature=Warm, communication_status=New, " +
        "registration_status='Not Registered', lead_type=Prospect, country='South Africa'.",
      inputSchema: {
        full_name: z.string().describe("Required. Contact's full name."),
        phone_number: z.string().optional(),
        email_address: z.string().optional(),
        city: z.string().optional(),
        province: z.string().optional(),
        country: z.string().optional().describe("Defaults to South Africa if omitted"),
        lead_temperature: z.string().optional().describe("Defaults to Warm"),
        communication_status: z.string().optional().describe("Defaults to New"),
        registration_status: z.string().optional().describe("Defaults to Not Registered"),
        lead_type: z.string().optional().describe("Defaults to Prospect"),
        sponsor_name: z.string().optional(),
        additional_notes: z.string().optional(),
        force: z.boolean().optional().describe("Set true to create even if a phone/email duplicate is found"),
      },
    },
    async (args) => {
      const data = await callBridge("create_contact", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "add_contact_note",
    {
      title: "Log an activity / note for a contact",
      description:
        "Append a new entry to a contact's activity timeline (contact_activities " +
        "table). Strictly additive — never edits or removes existing activity entries.",
      inputSchema: {
        contact_id: z.string().describe("UUID of the contact"),
        note: z.string().describe("The note/activity text to log"),
      },
    },
    async (args) => {
      const data = await callBridge("add_contact_note", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "list_orders",
    {
      title: "List orders",
      description:
        "Read orders, optionally filtered by status (Pending/Paid/Delivered/Activated) " +
        "or contact_id. Returns up to 100. Read-only — order creation/editing is not " +
        "exposed here (except via paste_monthly_activity, see that tool).",
      inputSchema: {
        status: z.string().optional().describe("Filter by status, e.g. Pending, Paid, Delivered, Activated"),
        contact_id: z.string().optional().describe("Filter by contact UUID"),
        limit: z.number().int().positive().max(100).optional().describe("Max results, default 25, max 100"),
      },
    },
    async (args) => {
      const data = await callBridge("list_orders", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "paste_monthly_activity",
    {
      title: "Paste a Monthly Activity report (Smart Paste)",
      description:
        "Server-side mirror of the app's 'Monthly Activity Paste' modal (Orders page): " +
        "parses raw pasted APLGO activity-report text, matches each APLGO ID to a " +
        "contact, and creates Activity orders — using the exact same parsing format, " +
        "MP0.1 stable-signature dedupe, and same-report-twin/Needs-Review rules the " +
        "in-app modal uses, so this cannot silently diverge from what a human pasting " +
        "in the app would get. " +
        "\n\nINPUT FORMAT (pasted_text): level headers followed by comma-separated " +
        "entries, e.g. \"Level 1\\n1318879(5): 1,275.00 R, 1392817: 1,260.00 R\". The " +
        "number before the colon is the APLGO ID; an optional (N) is a level override; " +
        "the amount is in ZAR." +
        "\n\nDRY RUN IS MANDATORY FIRST STEP: dry_run defaults to true. Call once with " +
        "dry_run left as default (or explicitly true) and review the returned 'rows' " +
        "— check matched vs unmatched APLGO IDs, and especially any " +
        "'would_flag_needs_review' rows (ambiguous repeats that will NOT be created, " +
        "just routed to the in-app Waiting Room for owner review). Only call again with " +
        "dry_run:false once that preview has been reviewed and confirmed." +
        "\n\nUnmatched APLGO IDs are never inserted — those contacts need to exist in " +
        "the CRM first (see create_contact).",
      inputSchema: {
        pasted_text: z.string().describe(
          "Raw report text. Format: \"Level 1\\n1318879(5): 1,275.00 R, 1392817: 1,260.00 R\\n\\nLevel 2\\n...\""
        ),
        activity_month: z.string().describe(
          "The activity month this paste covers, e.g. \"August 2026\" or \"2026-08\". Drives dedupe grouping — same convention as the in-app modal."
        ),
        period_start: z.string().optional().describe(
          "Optional YYYY-MM-DD — the actual date range this specific paste covers (e.g. for a mid-cycle paste). Purely additive record-keeping + overlap warning, does not affect dedupe."
        ),
        period_end: z.string().optional().describe("Optional YYYY-MM-DD, paired with period_start."),
        dry_run: z.boolean().optional().describe(
          "Defaults to true. MUST be explicitly set to false to actually write anything. Always review a dry_run:true preview first."
        ),
      },
    },
    async (args) => {
      const data = await callBridge("paste_monthly_activity", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "get_prospector_status",
    {
      title: "Get Zazi AI Prospector status",
      description:
        "Counts of prospector-drafted outreach actions (zazi_actions) by status " +
        "(draft/proposed/approved/rejected/snoozed/sent/blocked), plus the most " +
        "recent items awaiting review. Read-only — does not send anything.",
      inputSchema: {},
    },
    async () => {
      const data = await callBridge("get_prospector_status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "get_prospector_drafts",
    {
      title: "Get Zazi AI Prospector draft detail",
      description:
        "Full detail for prospector-drafted outreach (zazi_actions), including the " +
        "proposed message text, supervisor quality/safety scores, and block reasons — " +
        "the same detail shown in the in-app Prospector Inbox review screen. " +
        "Read-only — no approve/reject/snooze/send action is exposed here; sending " +
        "stays a one-by-one, human-approved action in the app.",
      inputSchema: {
        status: z.string().optional().describe("Filter by status: draft, approved, rejected, snoozed, sent"),
        limit: z.number().int().positive().max(100).optional().describe("Max results, default 25, max 100"),
      },
    },
    async (args) => {
      const data = await callBridge("get_prospector_drafts", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "list_inventory",
    {
      title: "List offline inventory",
      description: "Read tracked stock levels from the Offline Inventory page. Read-only.",
      inputSchema: {},
    },
    async () => {
      const data = await callBridge("list_inventory");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "update_inventory_stock",
    {
      title: "Set inventory stock quantity",
      description:
        "Set the absolute stock quantity for a product, by inventory id or by " +
        "product_name (creates a new inventory row if that product doesn't exist yet). " +
        "Same operation as the inline stock edit in the app's Inventory page.",
      inputSchema: {
        id: z.string().optional().describe("Inventory row UUID (preferred if known)"),
        product_name: z.string().optional().describe("Product name — used if id is omitted; will create the row if it doesn't exist"),
        quantity: z.number().int().nonnegative().describe("New absolute stock quantity"),
      },
    },
    async (args) => {
      const data = await callBridge("update_inventory_stock", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "get_deals_summary",
    {
      title: "Get Deals summary",
      description:
        "Derived view of activated distributors (contacts with lead_type = " +
        "'Purchase_Status'), matching the Deals page: split into 'Activation Only' " +
        "vs 'With GO-Status', with order totals per contact. Read-only, computed on " +
        "each call (not a stored table).",
      inputSchema: {
        limit: z.number().int().positive().max(100).optional().describe("Max deals returned, default 50, max 100"),
      },
    },
    async (args) => {
      const data = await callBridge("get_deals_summary", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "find_duplicate_contacts",
    {
      title: "Find duplicate contacts",
      description:
        "Detects contacts sharing the same normalized phone or email, matching the " +
        "Duplicates page's grouping logic. Detection only — no merge or delete tool " +
        "is exposed via MCP; resolving duplicates stays an in-app, human-confirmed " +
        "action since it permanently deletes contact rows.",
      inputSchema: {},
    },
    async () => {
      const data = await callBridge("find_duplicate_contacts");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "get_sponsor_id_audit",
    {
      title: "Get Sponsor ID Review audit",
      description:
        "Read-only audit matching the Sponsor ID Review page: counts of exact / " +
        "ambiguous / missing aplgo_id matches against sponsor_name references, " +
        "self-match risks, and a list of sponsor IDs with no matching upline contact " +
        "yet. No writes — this page is explicitly 'no automatic fixes' even in-app, " +
        "and placeholder-upline creation is not exposed here.",
      inputSchema: {},
    },
    async () => {
      const data = await callBridge("get_sponsor_id_audit");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "list_birthdays",
    {
      title: "List birthdays",
      description:
        "Read the Birthday WhatsApp Engine list (contact_birthdays) for a cycle year " +
        "(defaults to the current year), optionally filtered by status " +
        "(not_congratulated/congratulated/unmatched). Each entry includes a computed " +
        "'timing' bucket: today, tomorrow, this_week, upcoming, or past. Read-only — " +
        "no send/enroll/congratulate action is exposed here.",
      inputSchema: {
        status: z.string().optional().describe("Filter: not_congratulated, congratulated, or unmatched"),
        cycle_year: z.number().int().optional().describe("Defaults to the current year"),
        limit: z.number().int().positive().max(200).optional().describe("Max results, default 100, max 200"),
      },
    },
    async (args) => {
      const data = await callBridge("list_birthdays", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "list_birthday_message_tones",
    {
      title: "List birthday message tones",
      description:
        "Static reference list of the 4 tones the in-app Birthday Message composer " +
        "(BirthdayComposerModal.tsx) offers — Warm, Royal, Spiritual, Professional — " +
        "with their label and description. No DB call. Use this to decide which " +
        "'tone' value to pass to compose_birthday_message.",
      inputSchema: {},
    },
    async () => {
      const data = await callBridge("list_birthday_message_tones");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "compose_birthday_message",
    {
      title: "Compose a birthday message",
      description:
        "Generates the exact birthday message text the in-app Birthday Message " +
        "composer would produce for one contact_birthdays entry — same templates, " +
        "same tones (warm/royal/spiritual/professional), same APLGO brand link and " +
        "signature line as BirthdayComposerModal.tsx. This is the gap that closes: " +
        "list_birthdays could only show who's due, not generate what to send. " +
        "Composition only — this tool does NOT send anything and does NOT mark the " +
        "birthday congratulated; sending/marking stays in the app (or the app's own " +
        "Maytapi-assisted send). Pass all_tones=true to get all 4 variants back in " +
        "one call instead of picking one tone up front.",
      inputSchema: {
        birthday_id: z.string().optional().describe("UUID of the contact_birthdays row (preferred if known, e.g. from list_birthdays)"),
        associate_id: z.string().optional().describe("APLGO associate ID — used to look up the entry if birthday_id is omitted"),
        cycle_year: z.number().int().optional().describe("Defaults to the current year"),
        tone: z.enum(["warm", "royal", "spiritual", "professional"]).optional().describe("Defaults to 'warm'. Ignored if all_tones=true"),
        all_tones: z.boolean().optional().describe("If true, returns all 4 tone variants instead of just one"),
        sender_name: z.string().optional().describe("Defaults to the account's profile display_name"),
        sender_email: z.string().optional().describe("Defaults to the account's profile email"),
      },
    },
    async (args) => {
      const data = await callBridge("compose_birthday_message", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "list_whatsapp_conversations",
    {
      title: "List WhatsApp conversations",
      description:
        "Read-only summary of WhatsApp conversations from the Maytapi inbox — last " +
        "message preview, timestamp, and unread count per contact. MATCHED CONTACTS " +
        "ONLY: unmatched/unknown numbers are never surfaced here, mirroring the app's " +
        "own privacy gate for unlinked numbers. No reply/send capability.",
      inputSchema: {
        limit: z.number().int().positive().max(300).optional().describe("Max messages scanned, default 200, max 300"),
      },
    },
    async (args) => {
      const data = await callBridge("list_whatsapp_conversations", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "get_whatsapp_thread",
    {
      title: "Get a WhatsApp conversation thread",
      description:
        "Full message history for one contact's WhatsApp conversation, oldest first. " +
        "Requires contact_id (not a raw conversation key) — this is a deliberate " +
        "guardrail so an unmatched/masked-number thread can never be requested " +
        "through this tool. Read-only.",
      inputSchema: {
        contact_id: z.string().describe("UUID of the contact whose thread to read"),
        limit: z.number().int().positive().max(200).optional().describe("Max messages, default 100, max 200"),
      },
    },
    async (args) => {
      const data = await callBridge("get_whatsapp_thread", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// HTTP transport (stateless streamable HTTP, one server instance per request)
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const auth = req.headers["authorization"];
  const queryKey = req.query.key;
  const authorized =
    auth === `Bearer ${MCP_API_KEY}` || queryKey === MCP_API_KEY;
  if (!authorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Vanto Zazi CRM MCP server listening on port ${PORT}`);
});
