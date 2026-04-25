// Zazi MAM Prospector — Supervisor Brain (Phase S, SHADOW MODE ONLY)
// Scores existing zazi_actions drafts on the v3.1 7-axis rubric.
// Admin/owner ONLY. Manual invocation only. NO cron. NO sends.
// Writes ONLY supervisor_* fields and evidence.supervisor.
// Does NOT change status (stays 'draft'). Does NOT touch contact_activities or contacts.lead_type.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ---- v3.1 thresholds ----
const SAFETY_FLOOR = 70;
const LEADERSHIP_FIT_FLOOR = 60;
const QUALITY_FLOOR = 60;

// ---- Rule patterns (deterministic, fast) ----
const INCOME_PROMISE = /\b(guaranteed?|you\s+will\s+(earn|make)|earn\s+r?\d|make\s+r?\d|\$\d+\s*(per|\/)\s*(day|week|month)|\d+%\s*(roi|return)|get\s+rich|financial\s+freedom\s+guaranteed)\b/i;
const MEDICAL_CLAIM = /\b(cure[ds]?|heal[s]?\b|treat(s|ment)?\s+(cancer|diabetes|covid|hiv|aids|hypertension)|reverse[s]?\s+(disease|aging)|miracle\s+(cure|drug|product)|fda\s+approved|clinically\s+proven)\b/i;
const HYPE_MANIPULATION = /\b(life[\s-]?changing\s+miracle|once[\s-]in[\s-]a[\s-]lifetime|don'?t\s+miss\s+out\s+forever|secret\s+formula|exclusive\s+insider)\b/i;
const GUILT_TRIPPING = /\b(you'?re\s+letting\s+(me|us|your\s+family)\s+down|disappointed\s+in\s+you|after\s+all\s+i'?ve\s+done|you\s+owe\s+(me|it))\b/i;
const FAKE_URGENCY = /\b(only\s+\d+\s+(spots?|seats?)\s+left\s+today|last\s+chance\s+ever|expires?\s+in\s+\d+\s+(minutes?|hours?)\s+forever|act\s+now\s+or\s+lose)\b/i;
const COMPARISON_SHAMING = /\b(everyone\s+else\s+is|others\s+are\s+already\s+ahead|even\s+\w+\s+managed|why\s+can'?t\s+you)\b/i;
const PRESSURE = /\b(you\s+must\s+(decide|act|sign)\s+(now|today)|no\s+excuses|stop\s+making\s+excuses|just\s+do\s+it\s+already)\b/i;
const PRODUCT_PRICING_HEALTH_CLAIM = /\b(r?\d{2,}\s*(pv|points?|rand|usd|zar)|costs?\s+r?\d|price\s+is\s+r?\d|helps?\s+with\s+(diabetes|cancer|blood\s+pressure|cholesterol|arthritis)|boosts?\s+immunity|lose\s+\d+\s*kg|burn[s]?\s+fat)\b/i;

const TONE_KEYWORDS: Record<string, RegExp> = {
  warm: /\b(hi|hello|hope|trust|well|brother|sister|friend|🙏|❤️|😊)\b/i,
  encouraging: /\b(you\s+can|believe|proud|step\s+forward|keep\s+going|next\s+step|capable)\b/i,
  coaching: /\b(let'?s|together|plan|focus|practice|learn|try|consider)\b/i,
  celebratory: /\b(congrat|well\s+done|amazing|🎉|proud|achievement|milestone)\b/i,
  gentle_accountability: /\b(check[\s-]?in|how'?s\s+it\s+going|haven'?t\s+heard|noticed|gentle\s+reminder)\b/i,
  belief_restoring: /\b(believe|possible|trust|story|journey|started|remember\s+why)\b/i,
  clarifying: /\b(clarify|explain|simply\s+put|in\s+short|to\s+be\s+clear|means)\b/i,
};

// Stage-need congruence: which leadership_needs are appropriate per movement_stage
const STAGE_NEED_OK: Record<string, string[]> = {
  expired: ["reactivation", "restore_belief", "accountability"],
  registered_nopurchase: ["explain_activation", "first_order_confidence", "restore_belief"],
  purchase_nostatus: ["status_consistency", "monthly_activity_push", "explain_activation"],
  purchase_status: ["monthly_activity_push", "upgrade_readiness", "first_customer_help", "recognition", "accountability"],
  upgraded: ["recruiting_confidence", "team_duplication", "first_customer_help", "recognition"],
  builder: ["team_duplication", "recruiting_confidence", "recognition", "accountability"],
  future_leader: ["team_duplication", "recognition", "recruiting_confidence", "accountability"],
};

interface SupervisorScores {
  safety: number;
  grounding: number;
  cultural_fit: number;
  clarity: number;
  relevance: number;
  tone_fit: number;
  leadership_fit: number;
  overall: number;
}

interface SuperviseResult {
  scores: SupervisorScores;
  blocked_shadow: boolean;
  block_reasons: string[];
  review_notes: string;
  model_or_rules_used: string;
}

function scoreDraft(row: any): SuperviseResult {
  const msg: string = String(row.proposed_message || "");
  const stage: string = String(row.movement_stage || "");
  const need: string = String(row.leadership_need || "");
  const tone: string = String(row.recommended_tone || "");
  const reasons: string[] = [];

  // ---- Safety ----
  let safety = 100;
  if (INCOME_PROMISE.test(msg)) { safety -= 50; reasons.push("income_promise"); }
  if (MEDICAL_CLAIM.test(msg)) { safety -= 60; reasons.push("medical_claim"); }
  if (HYPE_MANIPULATION.test(msg)) { safety -= 25; reasons.push("hype_or_manipulation"); }
  if (GUILT_TRIPPING.test(msg)) { safety -= 30; reasons.push("guilt_tripping"); }
  if (FAKE_URGENCY.test(msg)) { safety -= 30; reasons.push("fake_urgency_or_scarcity"); }
  if (COMPARISON_SHAMING.test(msg)) { safety -= 25; reasons.push("comparison_shaming"); }
  if (PRESSURE.test(msg)) { safety -= 20; reasons.push("pressure_language"); }
  safety = Math.max(0, Math.min(100, safety));

  // ---- Grounding ----
  // Only punish if message makes product/pricing/comp/health claims without evidence chunks
  const composer = row?.evidence?.composer || {};
  const knowledgeUsed: any[] = Array.isArray(composer.knowledge_used) ? composer.knowledge_used : [];
  const makesClaim = PRODUCT_PRICING_HEALTH_CLAIM.test(msg);
  let grounding = 100;
  if (makesClaim && knowledgeUsed.length === 0) {
    grounding = 40;
    reasons.push("ungrounded_claim");
  } else if (makesClaim) {
    grounding = 80;
  }

  // ---- Cultural fit (warm African field-leader tone, respectful, no hype) ----
  let culturalFit = 90;
  if (HYPE_MANIPULATION.test(msg)) culturalFit -= 25;
  if (PRESSURE.test(msg)) culturalFit -= 15;
  if (GUILT_TRIPPING.test(msg)) culturalFit -= 20;
  // Reward respectful openings
  if (/\b(hello|hi|good\s+(morning|afternoon|evening)|dear|brother|sister|leader)\b/i.test(msg)) culturalFit += 5;
  culturalFit = Math.max(0, Math.min(100, culturalFit));

  // ---- Clarity ----
  let clarity = 100;
  const len = msg.length;
  if (len < 30) { clarity -= 30; reasons.push("too_short"); }
  if (len > 900) { clarity -= 20; reasons.push("too_long_for_whatsapp"); }
  // Multiple asks: count question marks + imperative CTAs
  const questionMarks = (msg.match(/\?/g) || []).length;
  const ctaHits = (msg.match(/\b(reply|click|book|join|order|buy|register|call|message|send|tell\s+me|let\s+me\s+know)\b/gi) || []).length;
  if (questionMarks + ctaHits >= 4) {
    clarity -= 25;
    reasons.push("multiple_or_confusing_asks");
  }
  clarity = Math.max(0, Math.min(100, clarity));

  // ---- Relevance (does message match stage + need?) ----
  let relevance = 80;
  const okNeeds = STAGE_NEED_OK[stage] || [];
  if (okNeeds.length > 0 && !okNeeds.includes(need)) {
    relevance = 40;
    reasons.push("stage_need_mismatch");
  } else {
    relevance = 90;
  }

  // ---- Tone fit ----
  let toneFit = 70;
  const tonePattern = TONE_KEYWORDS[tone];
  if (tonePattern) {
    toneFit = tonePattern.test(msg) ? 90 : 55;
    if (toneFit < 60) reasons.push("tone_mismatch");
  }

  // ---- Leadership fit (belief-restoring, practical, action-focused, exactly one clear next step) ----
  let leadershipFit = 80;
  const hasNextStep = /\b(reply|let\s+me\s+know|when\s+can|are\s+you\s+open|would\s+you|can\s+we|tell\s+me|message\s+me)\b/i.test(msg);
  if (!hasNextStep && need !== "recognition") {
    leadershipFit -= 25;
    reasons.push("missing_clear_next_step");
  }
  if (HYPE_MANIPULATION.test(msg) || PRESSURE.test(msg) || GUILT_TRIPPING.test(msg)) {
    leadershipFit -= 30;
  }
  if (/\b(believe|story|journey|possible|capable|leader|grow|build)\b/i.test(msg)) {
    leadershipFit += 5;
  }
  leadershipFit = Math.max(0, Math.min(100, leadershipFit));

  // ---- Overall (weighted) ----
  const overall = Math.round(
    safety * 0.25 +
    grounding * 0.10 +
    culturalFit * 0.10 +
    clarity * 0.15 +
    relevance * 0.15 +
    toneFit * 0.10 +
    leadershipFit * 0.15
  );

  const blocked =
    safety < SAFETY_FLOOR ||
    leadershipFit < LEADERSHIP_FIT_FLOOR ||
    overall < QUALITY_FLOOR ||
    reasons.some((r) => ["income_promise", "medical_claim", "ungrounded_claim"].includes(r));

  const reviewNotes = blocked
    ? `Shadow-blocked: ${reasons.slice(0, 3).join(", ") || "below threshold"}`
    : "Passes shadow rubric.";

  return {
    scores: {
      safety,
      grounding,
      cultural_fit: culturalFit,
      clarity,
      relevance,
      tone_fit: toneFit,
      leadership_fit: leadershipFit,
      overall,
    },
    blocked_shadow: blocked,
    block_reasons: Array.from(new Set(reasons)),
    review_notes: reviewNotes,
    model_or_rules_used: "rules-v3.1-supervisor-shadow",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ---- AUTH ----
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
    const limit: number = Math.min(Math.max(Number(body.limit ?? 10), 1), 10);
    const dryRun: boolean = Boolean(body.dry_run ?? false);
    const reportOnly: boolean = Boolean(body.report_only ?? false);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ---- AUTHORIZATION (Phase B.2 + S): admin/owner ONLY ----
    let isAdmin = false;
    {
      const { data: rolesRes } = await sb.rpc("has_role", { _user_id: callerId, _role: "admin" });
      isAdmin = Boolean(rolesRes);
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({
        error: "Forbidden: Zazi MAM Prospector Supervisor is admin/owner only (Phase S shadow mode).",
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- REPORT-ONLY ----
    if (reportOnly) {
      const [
        { count: totalDrafts },
        { data: needSup },
        { data: alreadySup },
        { data: stageRows },
        { data: needRows },
        { data: blockedRows },
      ] = await Promise.all([
        sb.from("zazi_actions").select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId).eq("status", "draft"),
        sb.from("zazi_actions").select("id")
          .eq("user_id", targetUserId).eq("status", "draft")
          .is("supervisor_quality_score", null).not("proposed_message", "is", null),
        sb.from("zazi_actions").select("id")
          .eq("user_id", targetUserId).eq("status", "draft")
          .not("supervisor_quality_score", "is", null),
        sb.from("zazi_actions").select("movement_stage")
          .eq("user_id", targetUserId).eq("status", "draft"),
        sb.from("zazi_actions").select("leadership_need")
          .eq("user_id", targetUserId).eq("status", "draft"),
        sb.from("zazi_actions").select("id")
          .eq("user_id", targetUserId).eq("status", "draft")
          .not("supervisor_block_reason", "is", null),
      ]);

      const byStage: Record<string, number> = {};
      (stageRows || []).forEach((r: any) => { byStage[r.movement_stage || "_unknown"] = (byStage[r.movement_stage || "_unknown"] || 0) + 1; });
      const byNeed: Record<string, number> = {};
      (needRows || []).forEach((r: any) => { byNeed[r.leadership_need || "_unknown"] = (byNeed[r.leadership_need || "_unknown"] || 0) + 1; });

      return new Response(JSON.stringify({
        ok: true,
        mode: "report_only",
        target_user_id: targetUserId,
        caller_is_admin: isAdmin,
        total_draft_rows: totalDrafts || 0,
        rows_needing_supervision: (needSup || []).length,
        rows_already_supervised: (alreadySup || []).length,
        count_by_movement_stage: byStage,
        count_by_leadership_need: byNeed,
        rows_with_block_reason: (blockedRows || []).length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- FETCH DRAFTS NEEDING SUPERVISION ----
    const { data: drafts, error: fetchErr } = await sb
      .from("zazi_actions")
      .select("id, contact_id, movement_stage, leadership_need, recommended_tone, proposed_message, evidence")
      .eq("user_id", targetUserId)
      .eq("status", "draft")
      .is("supervisor_quality_score", null)
      .not("proposed_message", "is", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: "fetch_failed", detail: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    let blockedCount = 0;
    const reviewNotes: string[] = [];

    for (const row of (drafts || [])) {
      const result = scoreDraft(row);
      if (result.blocked_shadow) blockedCount++;
      reviewNotes.push(result.review_notes);

      if (!dryRun) {
        const newEvidence = {
          ...(row.evidence || {}),
          supervisor: {
            scores: result.scores,
            blocked_shadow: result.blocked_shadow,
            block_reasons: result.block_reasons,
            review_notes: result.review_notes,
            model_or_rules_used: result.model_or_rules_used,
          },
        };
        const { error: updErr } = await sb
          .from("zazi_actions")
          .update({
            // STATUS REMAINS 'draft' — Phase S shadow only, no blocking yet
            supervisor_quality_score: result.scores.overall,
            supervisor_safety: result.scores.safety,
            supervisor_grounding: result.scores.grounding,
            supervisor_cultural_fit: result.scores.cultural_fit,
            supervisor_clarity: result.scores.clarity,
            supervisor_relevance: result.scores.relevance,
            supervisor_tone_fit: result.scores.tone_fit,
            supervisor_leadership_fit: result.scores.leadership_fit,
            supervisor_block_reason: result.blocked_shadow ? result.block_reasons.join(", ") : null,
            evidence: newEvidence,
          })
          .eq("id", row.id)
          .eq("user_id", targetUserId)
          .eq("status", "draft"); // Defensive: never touch non-drafts
        if (updErr) {
          results.push({ id: row.id, error: updErr.message });
          continue;
        }
      }

      results.push({
        id: row.id,
        movement_stage: row.movement_stage,
        leadership_need: row.leadership_need,
        scores: result.scores,
        blocked_shadow: result.blocked_shadow,
        block_reasons: result.block_reasons,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      mode: dryRun ? "dry_run" : "real_shadow_run",
      target_user_id: targetUserId,
      caller_is_admin: isAdmin,
      rows_scored: results.length,
      blocked_shadow_count: blockedCount,
      sample_review_notes: reviewNotes.slice(0, 3),
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("supervisor error:", e);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
