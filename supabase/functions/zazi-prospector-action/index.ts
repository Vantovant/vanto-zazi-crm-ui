// zazi-prospector-action — Phase D.1.1
// Admin/owner-only action handler for Prospector drafts.
// Writes ONLY to public.zazi_actions. Never sends. Never touches contact_activities or contacts.lead_type.
// Allowed actions: approve | undo_approve | edit_save | reject | snooze | unsnooze
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Action =
  | { type: "approve"; id: string }
  | { type: "undo_approve"; id: string }
  | { type: "edit_save"; id: string; new_message: string; reason?: string }
  | { type: "reject"; id: string; reason: string }
  | { type: "snooze"; id: string; until: string; label?: string }
  | { type: "unsnooze"; id: string };

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function validate(body: any): { ok: true; action: Action } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid body" };
  const { type, id } = body;
  if (!isUuid(id)) return { ok: false, error: "invalid id" };
  switch (type) {
    case "approve":
    case "undo_approve":
    case "unsnooze":
      return { ok: true, action: { type, id } };
    case "edit_save":
      if (typeof body.new_message !== "string" || !body.new_message.trim()) {
        return { ok: false, error: "new_message required" };
      }
      if (body.new_message.length > 4000) return { ok: false, error: "new_message too long" };
      return {
        ok: true,
        action: { type, id, new_message: body.new_message, reason: typeof body.reason === "string" ? body.reason : undefined },
      };
    case "reject":
      if (typeof body.reason !== "string" || !body.reason.trim()) {
        return { ok: false, error: "reason required" };
      }
      if (body.reason.length > 500) return { ok: false, error: "reason too long" };
      return { ok: true, action: { type, id, reason: body.reason } };
    case "snooze": {
      if (typeof body.until !== "string") return { ok: false, error: "until required" };
      const t = Date.parse(body.until);
      if (Number.isNaN(t)) return { ok: false, error: "until invalid" };
      if (t <= Date.now()) return { ok: false, error: "until must be in the future" };
      if (t > Date.now() + 1000 * 60 * 60 * 24 * 90) return { ok: false, error: "snooze max 90d" };
      return { ok: true, action: { type, id, until: new Date(t).toISOString(), label: typeof body.label === "string" ? body.label : "custom" } };
    }
    default:
      return { ok: false, error: "unknown action type" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  // 1) Require JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimErr } = await userClient.auth.getClaims(token);
  if (claimErr || !claims?.claims?.sub) return json(401, { error: "Unauthorized" });
  const callerId = claims.claims.sub as string;

  // 2) Admin/owner gate (uses public.has_role -> security definer)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: isAdminData, error: roleErr } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });
  if (roleErr) return json(500, { error: "role check failed" });
  if (!isAdminData) return json(403, { error: "admin only" });

  // 3) Parse + validate input
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }
  const v = validate(body);
  if (!v.ok) return json(400, { error: v.error });
  const action = v.action;

  // 4) Load row (service role; row must belong to caller for now — single-tenant admin)
  const { data: row, error: loadErr } = await admin
    .from("zazi_actions")
    .select("*")
    .eq("id", action.id)
    .maybeSingle();
  if (loadErr) return json(500, { error: "load failed" });
  if (!row) return json(404, { error: "not found" });
  if (row.user_id !== callerId) return json(403, { error: "not your row" });

  // 5) Hard guard: never act on rows that already left the workflow
  if (row.status === "sent") return json(409, { error: "row already sent (immutable)" });
  if (row.sent_at || row.maytapi_message_id) return json(409, { error: "row has send markers (immutable)" });

  const nowIso = new Date().toISOString();
  const baseEvidence = (row.evidence && typeof row.evidence === "object" && !Array.isArray(row.evidence))
    ? row.evidence : {};

  // 6) Per-action transition + supervisor gate
  let updatePayload: Record<string, unknown> | null = null;
  let requiredCurrentStatus: string | null = null;

  if (action.type === "approve") {
    if (row.status !== "draft") return json(409, { error: "approve requires status=draft" });
    if (row.supervisor_block_reason) return json(409, { error: "supervisor blocked" });
    if (row.supervisor_quality_score == null) return json(409, { error: "not yet supervised" });
    if ((row.supervisor_safety ?? 0) < 70) return json(409, { error: "safety < 70" });
    if ((row.supervisor_leadership_fit ?? 0) < 60) return json(409, { error: "leadership_fit < 60" });
    if ((row.supervisor_quality_score ?? 0) < 60) return json(409, { error: "quality < 60" });
    requiredCurrentStatus = "draft";
    updatePayload = {
      status: "approved",
      approved_by: callerId,
      approved_at: nowIso,
      // Explicit: NEVER set sent_at or maytapi_message_id here
    };
  } else if (action.type === "undo_approve") {
    if (row.status !== "approved") return json(409, { error: "undo_approve requires status=approved" });
    requiredCurrentStatus = "approved";
    updatePayload = { status: "draft", approved_by: null, approved_at: null };
  } else if (action.type === "edit_save") {
    if (row.status !== "draft") return json(409, { error: "edit requires status=draft" });
    requiredCurrentStatus = "draft";
    updatePayload = {
      proposed_message: action.new_message,
      status: "draft",
      evidence: {
        ...baseEvidence,
        ui_edit: {
          edited_by: callerId,
          edited_at: nowIso,
          previous_message: row.proposed_message,
          edit_reason: action.reason ?? null,
        },
      },
    };
  } else if (action.type === "reject") {
    if (row.status !== "draft") return json(409, { error: "reject requires status=draft" });
    requiredCurrentStatus = "draft";
    updatePayload = {
      status: "rejected",
      approved_by: null,
      approved_at: null,
      evidence: {
        ...baseEvidence,
        feedback: {
          rejected_by: callerId,
          rejected_at: nowIso,
          reason: action.reason,
        },
      },
    };
  } else if (action.type === "snooze") {
    if (row.status !== "draft") return json(409, { error: "snooze requires status=draft" });
    requiredCurrentStatus = "draft";
    updatePayload = {
      status: "snoozed",
      snoozed_until: action.until,
      snooze_reason: action.label ?? "custom",
    };
  } else if (action.type === "unsnooze") {
    if (row.status !== "snoozed") return json(409, { error: "unsnooze requires status=snoozed" });
    requiredCurrentStatus = "snoozed";
    updatePayload = { status: "draft", snoozed_until: null, snooze_reason: null };
  }

  if (!updatePayload || !requiredCurrentStatus) return json(500, { error: "no payload built" });

  // 7) Atomic conditional update — protects against concurrent transitions
  const { data: updated, error: upErr } = await admin
    .from("zazi_actions")
    .update(updatePayload)
    .eq("id", action.id)
    .eq("user_id", callerId)
    .eq("status", requiredCurrentStatus)
    .is("sent_at", null)
    .is("maytapi_message_id", null)
    .select("id, status, approved_at, snoozed_until, sent_at, maytapi_message_id")
    .maybeSingle();
  if (upErr) return json(500, { error: upErr.message });
  if (!updated) return json(409, { error: "no row updated (state changed?)" });

  // Final paranoia: confirm we did not somehow cross into a send state
  if (updated.sent_at || updated.maytapi_message_id) {
    return json(500, { error: "send markers detected post-update — rolled back is impossible, refusing to confirm" });
  }

  return json(200, {
    ok: true,
    action: action.type,
    id: updated.id,
    status: updated.status,
    approved_at: updated.approved_at,
    snoozed_until: updated.snoozed_until,
    not_sent: true,
  });
});
