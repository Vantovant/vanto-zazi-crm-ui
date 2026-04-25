// Zazi MAM Prospector — Detector Brain orchestrator (Phase B + B.1, shadow mode)
// Hardened: requires authenticated JWT + admin OR self-owner. Manual-only.
// Automation gate: cron/automated runs require both integration_settings flags ON.
// NO UI. NO Maytapi. NO sends. NO autonomous actions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type MovementStage =
  | "expired" | "registered_nopurchase" | "purchase_nostatus"
  | "purchase_status" | "upgraded" | "builder" | "future_leader";

interface DetectorSignals {
  movement_stage: MovementStage;
  belief_risk: number;
  health_score: number;
  signals: string[];
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  days_since_activity: number | null;
  last_order_at: string | null;
  monthly_pv_status: string | null;
  reason_for_message: string;
  next_best_business_action: string;
  expected_next_step: string;
}

function deriveStage(contact: any, _lastOrder: any, upgradeOrder: any, downlineCount: number): MovementStage {
  const lt = (contact.lead_type || "").trim();
  if (downlineCount >= 3 && lt === "Purchase_Status") {
    return downlineCount >= 6 ? "future_leader" : "builder";
  }
  if (upgradeOrder) return "upgraded";
  if (lt === "Expired") return "expired";
  if (lt === "Registered_Nopurchase") return "registered_nopurchase";
  if (lt === "Purchase_Nostatus") return "purchase_nostatus";
  if (lt === "Purchase_Status") return "purchase_status";
  if (lt === "Customer" || lt === "Distributor") return "purchase_status";
  return "registered_nopurchase";
}
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000);

function detect(contact: any, orders: any[], followUp: any | null, downlineCount: number): DetectorSignals {
  const now = new Date();
  const sortedOrders = [...orders].sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
  const lastOrder = sortedOrders[0] || null;
  const upgradeOrder = sortedOrders.find((o) => {
    const pt = (o.purchase_type || "").toLowerCase();
    if (pt !== "upgrade") return false;
    return daysBetween(now, new Date(o.order_date)) <= 60;
  }) || null;

  const stage = deriveStage(contact, lastOrder, upgradeOrder, downlineCount);
  const lastInbound = followUp?.last_inbound_at || null;
  const lastOutbound = followUp?.last_outbound_at || null;
  const lastActivityDate = [lastInbound, lastOutbound, contact.updated_at]
    .filter(Boolean).map((d: string) => new Date(d).getTime()).sort((a, b) => b - a)[0];
  const daysSinceActivity = lastActivityDate ? daysBetween(now, new Date(lastActivityDate)) : null;
  const lastOrderAt = lastOrder?.order_date || null;
  const daysSinceOrder = lastOrderAt ? daysBetween(now, new Date(lastOrderAt)) : null;

  let monthlyPvStatus: string | null = null;
  if (sortedOrders.length > 0) {
    const thisMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const monthPv = sortedOrders.filter((o) => {
      const d = new Date(o.order_date);
      return d.getUTCFullYear() * 12 + d.getUTCMonth() === thisMonth;
    }).reduce((s, o) => s + Number(o.pv_amount || 0), 0);
    monthlyPvStatus = monthPv >= 50 ? "met" : monthPv > 0 ? "partial" : "none";
  }

  const signals: string[] = [];
  let beliefRisk = 30, healthScore = 60;
  if (stage === "expired") { signals.push("lead_type_expired"); beliefRisk = 80; healthScore = 25; }
  if (stage === "registered_nopurchase") {
    signals.push("registered_no_first_order"); beliefRisk = 55; healthScore = 45;
    if (daysSinceActivity && daysSinceActivity > 14) { signals.push("silent_after_registration"); beliefRisk += 15; healthScore -= 10; }
  }
  if (stage === "purchase_nostatus") { signals.push("purchase_without_status"); beliefRisk = 45; healthScore = 55; }
  if (stage === "purchase_status") {
    signals.push("status_holder"); beliefRisk = 25; healthScore = 75;
    if (monthlyPvStatus === "none") { signals.push("no_monthly_pv_yet"); beliefRisk += 20; healthScore -= 15; }
    else if (monthlyPvStatus === "partial") { signals.push("partial_monthly_pv"); beliefRisk += 10; }
  }
  if (stage === "upgraded") { signals.push("recent_upgrade"); beliefRisk = 20; healthScore = 80; }
  if (stage === "builder" || stage === "future_leader") { signals.push("active_builder"); beliefRisk = 15; healthScore = 85; }
  if (daysSinceActivity && daysSinceActivity > 30) { signals.push("neglected_30d"); beliefRisk += 10; healthScore -= 10; }
  if (daysSinceOrder && daysSinceOrder > 60 && stage !== "registered_nopurchase") { signals.push("no_recent_order"); beliefRisk += 5; }
  if (followUp?.reply_status === "no_reply") { signals.push("no_reply_to_last_outbound"); beliefRisk += 5; }

  beliefRisk = Math.max(0, Math.min(100, beliefRisk));
  healthScore = Math.max(0, Math.min(100, healthScore));

  let reason = "Leadership scout: this contact may need encouragement today.";
  let nbba = "Send a one-on-one warm check-in.";
  let nextStep = "Get a reply within 48h.";
  if (stage === "expired") { reason = "Contact is in expired state and likely needs belief restored."; nbba = "Reactivate with a no-pressure belief-first message."; nextStep = "Get a reply that opens the door to re-engagement."; }
  else if (stage === "registered_nopurchase") { reason = "Registered but no first order — needs activation clarity."; nbba = "Explain activation simply and offer help to place first order."; nextStep = "Confirm interest in first order this week."; }
  else if (stage === "purchase_nostatus") { reason = "Has purchased but not yet on monthly status — needs confidence push."; nbba = "Encourage simple monthly status step."; nextStep = "Commit to monthly status this cycle."; }
  else if (stage === "purchase_status" && monthlyPvStatus !== "met") { reason = "Status holder, monthly PV not yet met this month."; nbba = "Gentle monthly activity push."; nextStep = "Place this month's status order."; }
  else if (stage === "upgraded") { reason = "Recently upgraded — celebrate and coach on duplication."; nbba = "Recognize and ask about first builder leg."; nextStep = "Identify one new partner to mentor."; }
  else if (stage === "builder" || stage === "future_leader") { reason = "Active builder — needs duplication coaching and recognition."; nbba = "Recognize and coach on team duplication."; nextStep = "Schedule a leadership coaching moment."; }

  return { movement_stage: stage, belief_risk: beliefRisk, health_score: healthScore, signals,
    last_inbound_at: lastInbound, last_outbound_at: lastOutbound, days_since_activity: daysSinceActivity,
    last_order_at: lastOrderAt, monthly_pv_status: monthlyPvStatus,
    reason_for_message: reason, next_best_business_action: nbba, expected_next_step: nextStep };
}

async function callPropose(payload: any) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/zazi-prospector-propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`propose failed: ${r.status} ${await r.text()}`);
  return await r.json();
}
async function callCompose(payload: any) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/zazi-prospector-compose`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`compose failed: ${r.status} ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ---- AUTH: require JWT, identify caller ----
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired JWT" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const targetUserId: string = body.user_id || callerId;
    const limit: number = Math.min(Number(body.limit ?? 10), 10);
    const dryRun: boolean = Boolean(body.dry_run ?? false);
    const reportOnly: boolean = Boolean(body.report_only ?? false);
    const manualShadowTest: boolean = Boolean(body.manual_shadow_test ?? false);

    // Service-role admin client (only used after authorization passes)
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ---- AUTHORIZATION (Phase B.2): admin/owner ONLY for ALL paths ----
    // No self-run bypass. Manual shadow generation is admin-only until Phase D UI defines visibility.
    let isAdmin = false;
    {
      const { data: rolesRes } = await sb.rpc("has_role", { _user_id: callerId, _role: "admin" });
      isAdmin = Boolean(rolesRes);
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({
        error: "Forbidden: Zazi MAM Prospector shadow runs are admin/owner only in Phase B.2.",
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- AUTOMATION GATE: any non-manual-shadow-test write run requires flags ON ----
    const { data: settings } = await sb
      .from("integration_settings")
      .select("user_id, zazi_prospector_enabled, prospector_can_propose")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ error: "no integration_settings row for target user" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- REPORT-ONLY MODE ----
    if (reportOnly) {
      const [
        { count: total },
        { data: byStatus },
        { data: byStage },
        { data: byNeed },
        { count: superFilled },
        { count: leakedCount },
        { data: latest },
      ] = await Promise.all([
        sb.from("zazi_actions").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
        sb.from("zazi_actions").select("status").eq("user_id", targetUserId),
        sb.from("zazi_actions").select("movement_stage").eq("user_id", targetUserId),
        sb.from("zazi_actions").select("leadership_need").eq("user_id", targetUserId),
        sb.from("zazi_actions").select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId).not("supervisor_quality_score", "is", null),
        sb.from("zazi_actions").select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .or("approved_by.not.is.null,approved_at.not.is.null,sent_at.not.is.null,maytapi_message_id.not.is.null"),
        sb.from("zazi_actions").select("id, status, movement_stage, leadership_need, created_at")
          .eq("user_id", targetUserId).eq("status", "draft").order("created_at", { ascending: false }).limit(10),
      ]);
      const tally = (rows: any[] | null, key: string) =>
        (rows || []).reduce((m: Record<string, number>, r: any) => { m[r[key] || "(none)"] = (m[r[key] || "(none)"] || 0) + 1; return m; }, {});

      return new Response(JSON.stringify({
        ok: true, report_only: true, target_user_id: targetUserId, caller_is_admin: isAdmin,
        total_actions: total || 0,
        count_by_status: tally(byStatus, "status"),
        count_by_movement_stage: tally(byStage, "movement_stage"),
        count_by_leadership_need: tally(byNeed, "leadership_need"),
        supervisor_filled_count: superFilled || 0,
        leaked_approval_or_send_count: leakedCount || 0,
        latest_10_drafts: (latest || []).map((d: any) => isAdmin ? d : { id: d.id, status: d.status, created_at: d.created_at }),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // For any *write* (real or dry-run candidate generation), enforce manual-shadow-test rule
    // unless both flags are ON (future Phase E automation).
    const flagsOn = settings.zazi_prospector_enabled && settings.prospector_can_propose;
    if (!flagsOn && !manualShadowTest) {
      return new Response(JSON.stringify({
        error: "Automation gate: pass {\"manual_shadow_test\": true} for admin shadow runs while flags are OFF.",
        flags: { zazi_prospector_enabled: settings.zazi_prospector_enabled, prospector_can_propose: settings.prospector_can_propose },
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- candidate scan ----
    const { data: contacts, error: cErr } = await sb
      .from("contacts")
      .select("id, full_name, salutation_title, phone_number, lead_type, focus_area, updated_at, additional_notes, sponsor_name")
      .eq("user_id", targetUserId).order("updated_at", { ascending: false }).limit(200);
    if (cErr) throw cErr;

    const candidates: any[] = [];
    let scanned = 0;
    for (const c of contacts || []) {
      scanned++;
      const [{ data: orders }, { data: fuArr }] = await Promise.all([
        sb.from("orders").select("id, order_date, pv_amount, purchase_type, status").eq("user_id", targetUserId).eq("contact_id", c.id),
        sb.from("follow_up_states").select("last_inbound_at, last_outbound_at, reply_status").eq("user_id", targetUserId).eq("contact_id", c.id).limit(1),
      ]);
      const followUp = (fuArr && fuArr[0]) || null;
      const { count: downlineCount } = await sb.from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId).eq("sponsor_name", c.full_name);
      const detector = detect(c, orders || [], followUp, Number(downlineCount || 0));
      candidates.push({ contact: c, detector });
      if (candidates.length >= 50) break;
    }
    candidates.sort((a, b) => b.detector.belief_risk - a.detector.belief_risk);
    const top = candidates.slice(0, limit);

    const results: any[] = [];
    let drafted = 0;
    const stageBreak: Record<string, number> = {};
    const needBreak: Record<string, number> = {};

    for (const cand of top) {
      const { contact, detector } = cand;
      const reasoner = await callPropose({ contact, detector });

      // ---- Widened dedup: open-ish statuses in last 24h ----
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data: existing } = await sb
        .from("zazi_actions")
        .select("id, status")
        .eq("user_id", targetUserId)
        .eq("contact_id", contact.id)
        .eq("movement_stage", detector.movement_stage)
        .eq("leadership_need", reasoner.leadership_need)
        .in("status", ["draft", "proposed", "approved", "snoozed"])
        .gte("created_at", since)
        .limit(1);
      if (existing && existing.length > 0) {
        results.push({ contact_id: contact.id, skipped: "duplicate_24h", existing_status: existing[0].status });
        continue;
      }

      // ---- First-touch detection ----
      // First-touch = no prior outbound prospector message AND no prior outbound
      // whatsapp activity logged for this contact.
      const [{ count: priorActions }, { count: priorOutboundActivity }, { count: priorOutboundFu }] = await Promise.all([
        sb.from("zazi_actions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("contact_id", contact.id)
          .in("status", ["approved", "sent"]),
        sb.from("contact_activities")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("contact_id", contact.id)
          .in("activity_type", ["whatsapp", "whatsapp_sent", "message_sent", "outbound_message"]),
        sb.from("follow_up_states")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("contact_id", contact.id)
          .not("last_outbound_at", "is", null),
      ]);
      const isFirstTouch =
        (priorActions || 0) === 0 &&
        (priorOutboundActivity || 0) === 0 &&
        (priorOutboundFu || 0) === 0;

      const composer = await callCompose({ contact, detector, reasoner, first_touch: isFirstTouch });

      const evidence = {
        movement_stage: detector.movement_stage, leadership_need: reasoner.leadership_need,
        belief_risk: detector.belief_risk, recommended_tone: reasoner.recommended_tone,
        reason_for_message: detector.reason_for_message,
        next_best_business_action: detector.next_best_business_action,
        expected_next_step: detector.expected_next_step,
        detector: {
          signals: detector.signals, health_score: detector.health_score,
          last_inbound_at: detector.last_inbound_at, last_outbound_at: detector.last_outbound_at,
          days_since_activity: detector.days_since_activity, last_order_at: detector.last_order_at,
          monthly_pv_status: detector.monthly_pv_status,
        },
        reasoner: {
          stage_rule: reasoner.stage_rule, selected_reason: reasoner.selected_reason,
          alternatives_considered: reasoner.alternatives_considered,
        },
        composer: {
          template_or_pattern_used: composer.pattern_used,
          knowledge_used: composer.knowledge_used || [],
          safety_constraints_applied: composer.safety_constraints_applied || [],
        },
      };

      if (!dryRun) {
        const { data: inserted, error: insErr } = await sb
          .from("zazi_actions")
          .insert({
            user_id: targetUserId,
            contact_id: contact.id,
            status: "draft",
            channel: "whatsapp",
            movement_stage: detector.movement_stage,
            leadership_need: reasoner.leadership_need,
            belief_risk: detector.belief_risk,
            recommended_tone: reasoner.recommended_tone,
            reason_for_message: detector.reason_for_message,
            next_best_business_action: detector.next_best_business_action,
            expected_next_step: detector.expected_next_step,
            proposed_message: composer.proposed_message,
            evidence,
            // Phase B.1: supervisor fields explicitly NULL
            supervisor_quality_score: null,
            supervisor_safety: null,
            supervisor_grounding: null,
            supervisor_cultural_fit: null,
            supervisor_clarity: null,
            supervisor_relevance: null,
            supervisor_tone_fit: null,
            supervisor_leadership_fit: null,
            supervisor_block_reason: null,
          })
          .select("id").single();
        if (insErr) throw insErr;
        drafted++;
        results.push({ contact_id: contact.id, draft_id: inserted.id });
      } else {
        results.push({ contact_id: contact.id, dry_run: true, evidence });
      }

      stageBreak[detector.movement_stage] = (stageBreak[detector.movement_stage] || 0) + 1;
      needBreak[reasoner.leadership_need] = (needBreak[reasoner.leadership_need] || 0) + 1;
    }

    return new Response(JSON.stringify({
      ok: true, manual_shadow_test: manualShadowTest, dry_run: dryRun,
      caller_is_admin: isAdmin, target_user_id: targetUserId,
      scanned, candidates_found: candidates.length, drafted,
      movement_stage_breakdown: stageBreak, leadership_need_breakdown: needBreak,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[detect] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
