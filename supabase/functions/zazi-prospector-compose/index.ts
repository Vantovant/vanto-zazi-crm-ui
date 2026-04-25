// Zazi MAM Prospector — Composer Brain (Phase B, shadow mode)
// Drafts proposed_message via Lovable AI Gateway. Strict negative-prompt guardrails.
// No sending. No Maytapi. Just text + metadata returned to the orchestrator.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM_PROMPT = `You are Zazi MAM, a wise African field leader inside an APLGO network-marketing CRM.
You write short, warm, leadership-focused 1-on-1 WhatsApp messages.

VOICE: belief-restoring, practical, respectful, action-focused. Sound like a trusted mentor, not a salesperson.

HARD RULES — never violate:
- No hype, pressure, guilt, fake urgency or scarcity.
- No income promises ("you'll make R..." or any earnings claim).
- No medical or health claims ("this cures / treats / heals ...").
- No comparisons that shame ("others are doing better than you").
- No emojis spam — at most one tasteful emoji.
- Keep it WhatsApp-short: 2–4 short sentences, max ~360 characters.
- Address the contact respectfully using their salutation_title + first name when available.
- End with EXACTLY ONE clear next step (a question or simple ask) — UNLESS the leadership_need is "recognition", in which case end with celebration only.
- Plain text, no markdown.

You will receive contact context, detector signals, and a chosen leadership_need + tone.
Return ONLY the message text — no preface, no labels, no quotes.`;

const SAFETY_LIST = [
  "no_income_promises",
  "no_medical_claims",
  "no_pressure_or_guilt",
  "no_fake_scarcity",
  "no_shaming_comparisons",
  "single_clear_next_step",
  "whatsapp_short_form",
];

function postFilter(text: string): { ok: boolean; reasons: string[] } {
  const t = text.toLowerCase();
  const reasons: string[] = [];
  const banned = [
    /you (will|'ll) (earn|make) [r$€£]?\s*\d/i,
    /guaranteed income/i,
    /cure[sd]?\b/i, /\bheal[s]?\b/i, /treats?\b/i,
    /last chance/i, /act now/i, /limited time/i,
    /others are doing better/i,
  ];
  for (const r of banned) if (r.test(text)) reasons.push(`matched_banned:${r}`);
  if (text.length > 600) reasons.push("too_long");
  return { ok: reasons.length === 0, reasons };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { contact, detector, reasoner } = await req.json();
    if (!contact || !detector || !reasoner) {
      return new Response(JSON.stringify({ error: "contact, detector, reasoner required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = [
      `CONTACT:`,
      `- Name: ${contact.full_name}`,
      `- Salutation: ${contact.salutation_title || "Leader"}`,
      `- Focus area: ${contact.focus_area || "Both"}`,
      ``,
      `STAGE: ${detector.movement_stage}`,
      `LEADERSHIP NEED: ${reasoner.leadership_need}`,
      `RECOMMENDED TONE: ${reasoner.recommended_tone}`,
      `BELIEF RISK: ${detector.belief_risk}/100`,
      `WHY: ${detector.reason_for_message}`,
      `EXPECTED NEXT STEP: ${detector.expected_next_step}`,
      ``,
      `Write the WhatsApp message now. Plain text only. One clear ask at the end (unless leadership_need is "recognition").`,
    ].join("\n");

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!ai.ok) {
      const errText = await ai.text();
      console.error("[compose] AI gateway error:", ai.status, errText);
      if (ai.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited by AI gateway, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (ai.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${ai.status}`);
    }
    const json = await ai.json();
    let text: string = json.choices?.[0]?.message?.content?.trim() || "";

    // strip stray quotes/markdown if model added any
    text = text.replace(/^["'`]+|["'`]+$/g, "").trim();

    const filter = postFilter(text);
    if (!filter.ok) {
      // Soft-fallback to a safe template draft so shadow mode still produces a row
      text =
        `Hi ${contact.salutation_title || "Leader"} ${contact.full_name?.split(" ")[0] || ""}, ` +
        `just a quick check-in from me. ${detector.next_best_business_action} ` +
        `Could we connect briefly this week?`;
    }

    return new Response(JSON.stringify({
      proposed_message: text,
      pattern_used: `${reasoner.leadership_need}/${reasoner.recommended_tone}`,
      knowledge_used: [],
      safety_constraints_applied: SAFETY_LIST,
      filter_flags: filter.reasons,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[compose] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
