// Zazi MAM Prospector — Reasoner Brain (Phase B, shadow mode)
// Pure rule-based reasoner. Selects exactly one leadership_need + recommended_tone
// from the locked v3.1 vocabularies, with explanation.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LeadershipNeed =
  | "restore_belief" | "explain_activation" | "first_order_confidence"
  | "status_consistency" | "monthly_activity_push" | "upgrade_readiness"
  | "first_customer_help" | "recruiting_confidence" | "team_duplication"
  | "recognition" | "reactivation" | "accountability";

type Tone =
  | "warm" | "encouraging" | "coaching" | "celebratory"
  | "gentle_accountability" | "belief_restoring" | "clarifying";

function reason(detector: any): {
  leadership_need: LeadershipNeed;
  recommended_tone: Tone;
  stage_rule: string;
  selected_reason: string;
  alternatives_considered: string[];
} {
  const stage = detector.movement_stage as string;
  const signals: string[] = detector.signals || [];
  const beliefRisk = Number(detector.belief_risk || 0);
  const monthly = detector.monthly_pv_status as string | null;

  let need: LeadershipNeed = "accountability";
  let tone: Tone = "warm";
  let rule = "";
  const alts: string[] = [];

  switch (stage) {
    case "expired": {
      need = beliefRisk >= 70 ? "restore_belief" : "reactivation";
      tone = need === "restore_belief" ? "belief_restoring" : "warm";
      rule = "stage=expired → restore_belief if belief_risk>=70 else reactivation";
      alts.push("reactivation", "restore_belief");
      break;
    }
    case "registered_nopurchase": {
      if (signals.includes("silent_after_registration")) {
        need = "explain_activation";
        tone = "clarifying";
        rule = "stage=registered_nopurchase + silent → explain_activation";
        alts.push("first_order_confidence");
      } else {
        need = "first_order_confidence";
        tone = "encouraging";
        rule = "stage=registered_nopurchase → first_order_confidence";
        alts.push("explain_activation");
      }
      break;
    }
    case "purchase_nostatus": {
      need = "status_consistency";
      tone = "coaching";
      rule = "stage=purchase_nostatus → status_consistency";
      alts.push("monthly_activity_push", "first_customer_help");
      break;
    }
    case "purchase_status": {
      if (monthly === "none" || monthly === "partial") {
        need = "monthly_activity_push";
        tone = monthly === "none" ? "gentle_accountability" : "encouraging";
        rule = "stage=purchase_status + monthly_pv not met → monthly_activity_push";
        alts.push("status_consistency", "recognition");
      } else {
        need = "upgrade_readiness";
        tone = "coaching";
        rule = "stage=purchase_status + monthly_pv met → upgrade_readiness";
        alts.push("recognition", "team_duplication");
      }
      break;
    }
    case "upgraded": {
      need = "team_duplication";
      tone = "celebratory";
      rule = "stage=upgraded → team_duplication";
      alts.push("recognition", "recruiting_confidence");
      break;
    }
    case "builder": {
      need = "recruiting_confidence";
      tone = "coaching";
      rule = "stage=builder → recruiting_confidence";
      alts.push("team_duplication", "recognition");
      break;
    }
    case "future_leader": {
      need = "recognition";
      tone = "celebratory";
      rule = "stage=future_leader → recognition";
      alts.push("team_duplication", "recruiting_confidence");
      break;
    }
    default: {
      need = "accountability";
      tone = "warm";
      rule = "fallback → accountability/warm";
    }
  }

  const selectedReason =
    `Selected ${need} with ${tone} tone because ${rule}. ` +
    `Belief risk=${beliefRisk}, signals=[${signals.join(",")}].`;

  return { leadership_need: need, recommended_tone: tone, stage_rule: rule, selected_reason: selectedReason, alternatives_considered: alts };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { detector } = await req.json();
    if (!detector?.movement_stage) {
      return new Response(JSON.stringify({ error: "detector.movement_stage required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(reason(detector)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
