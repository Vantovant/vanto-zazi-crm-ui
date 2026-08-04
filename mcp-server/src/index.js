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
// Deliberately read-mostly / safety-scoped for this first version:
//   - No WhatsApp send capability exposed (sending stays behind the app's own
//     approval workflow in zazi_actions / maytapi-send-1to1, not this bridge).
//   - No order creation/editing (orders are read-only here — financial data).
//   - No delete of any kind.
//   - update_contact only ever touches fields explicitly provided.
//   - add_contact_note is strictly additive.
// ---------------------------------------------------------------------------
function buildServer() {
  const server = new McpServer({
    name: "vanto-zazi-mcp",
    version: "1.0.0",
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
        "exposed here.",
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
