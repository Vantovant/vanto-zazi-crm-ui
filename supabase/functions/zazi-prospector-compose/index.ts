// Zazi MAM Prospector — Composer Brain (Phase B, shadow mode)
// Drafts proposed_message via Lovable AI Gateway. Strict negative-prompt guardrails.
// No sending. No Maytapi. Just text + metadata returned to the orchestrator.
//
// First-touch branding rule:
//   When the orchestrator passes first_touch=true, the message ends with Vanto's
//   branded APLGO landing page link and a short signature. Follow-ups stay
//   conversational with NO link and NO signature footer.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const BRANDED_URL = "https://vanto-zazi-bloom.lovable.app/aplgo.html";
const BRAND_SIGNATURE = "— Vanto\nvanto@onlinecourseformlm.com";
// First-touch wrapper: URL on its own first line (WhatsApp preview header / branded letterhead),
// then the personal message, then the signature on its own bottom lines. No explanatory sentence about the link.

const SYSTEM_PROMPT_BASE = `You are Zazi MAM, a wise African field leader inside an APLGO network-marketing CRM.
You write short, warm, leadership-focused 1-on-1 WhatsApp messages.

VOICE: belief-restoring, practical, respectful, action-focused. Sound like a trusted mentor, not a salesperson.

HARD RULES — never violate:
- No hype, pressure, guilt, fake urgency or scarcity.
- No income promises ("you'll make R..." or any earnings claim).
- No medical or health claims ("this cures / treats / heals ...").
- No comparisons that shame ("others are doing better than you").
- No emojis spam — at most one tasteful emoji.
- Address the contact respectfully using their salutation_title + first name when available.
- End with EXACTLY ONE clear next step (a question or simple ask) — UNLESS the leadership_need is "recognition", in which case end with celebration only.
- Plain text, no markdown.

You will receive contact context, detector signals, and a chosen leadership_need + tone.
Return ONLY the message text — no preface, no labels, no quotes.`;

const FIRST_TOUCH_RULES = `
FIRST-TOUCH MODE (this is the first outbound message to this contact):
- Open with a warm personal greeting using salutation + first name.
- 2–3 short sentences of leadership-grade introduction tied to their focus_area.
- Do NOT include any URL, link, or signature in your output. The system will prepend the branded URL at the TOP (as a WhatsApp preview header) and append the signature at the bottom automatically. Just write the warm intro + one clear ask.
- Do NOT write any sentence describing or referring to the link (e.g. "Here is a short page", "see the link below", "check this page"). The URL is a silent letterhead, not content.
- Total body length: 280–420 characters (tighter is better).`;

const FOLLOWUP_RULES = `
FOLLOW-UP MODE (this contact has prior outbound history):
- Keep it WhatsApp-short: 2–4 short sentences, max ~360 characters.
- Do NOT include any URL or signature. Conversational only.`;

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
  const reasons: string[] = [];
  const banned = [
    /you (will|'ll) (earn|make) [r$€£]?\s*\d/i,
    /guaranteed income/i,
    /cure[sd]?\b/i, /\bheal[s]?\b/i, /treats?\b/i,
    /last chance/i, /act now/i, /limited time/i,
    /others are doing better/i,
  ];
  for (const r of banned) if (r.test(text)) reasons.push(`matched_banned:${r}`);
  if (text.length > 900) reasons.push("too_long");
  return { ok: reasons.length === 0, reasons };
}

// Convert any model/database-style escaped newline text into actual line breaks.
function normalizeMessageNewlines(text: string): string {
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Strip any model-emitted link/signature so we can apply our canonical wrapper
function stripModelBranding(text: string): string {
  let t = normalizeMessageNewlines(text);
  // remove any URL the model invented
  t = t.replace(/https?:\/\/\S+/gi, "");
  // remove em-dash signature lines like "— Vanto"
  t = t.replace(/^\s*[—\-–]\s*Vanto.*$/gim, "");
  // remove stray vanto email
  t = t.replace(/vanto@onlinecourseformlm\.com/gi, "");
  return normalizeMessageNewlines(t);
}

function buildFirstTouchMessage(aiPersonalMessage: string): string {
  const personalMessage = normalizeMessageNewlines(aiPersonalMessage);
  return `${BRANDED_URL}\n\n${personalMessage}\n\n${BRAND_SIGNATURE}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { contact, detector, reasoner, first_touch } = await req.json();
    if (!contact || !detector || !reasoner) {
      return new Response(JSON.stringify({ error: "contact, detector, reasoner required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFirstTouch = Boolean(first_touch);
    const systemPrompt = SYSTEM_PROMPT_BASE + (isFirstTouch ? FIRST_TOUCH_RULES : FOLLOWUP_RULES);

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
      `FIRST_TOUCH: ${isFirstTouch ? "yes" : "no"}`,
      ``,
      isFirstTouch
        ? `Write the FIRST WhatsApp message body now. Plain text only. No link, no signature — those will be appended by the system. End with one clear ask.`
        : `Write the WhatsApp follow-up now. Plain text only. No link, no signature. One clear ask at the end (unless leadership_need is "recognition").`,
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
          { role: "system", content: systemPrompt },
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
    // strip any branding the model emitted (we control it deterministically)
    text = stripModelBranding(text);

    const filter = postFilter(text);
    if (!filter.ok) {
      // Soft-fallback to a safe template draft so shadow mode still produces a row
      const firstName = contact.full_name?.split(" ")[0] || "";
      text =
        `Hi ${contact.salutation_title || "Leader"} ${firstName}, ` +
        `just a quick check-in from me. ${detector.next_best_business_action} ` +
        `Could we connect briefly this week?`;
    }

    // Wrap with branded URL header + signature ONLY for first-touch
    let brandingHeaderAdded = false;
    let brandedLinkUsed = false;
    if (isFirstTouch) {
      text = BRAND_HEADER + text + BRAND_SIGNATURE_BLOCK;
      brandingHeaderAdded = true;
      brandedLinkUsed = true;
    }

    return new Response(JSON.stringify({
      proposed_message: text,
      pattern_used: `${reasoner.leadership_need}/${reasoner.recommended_tone}${isFirstTouch ? "/first_touch" : "/follow_up"}`,
      knowledge_used: [],
      safety_constraints_applied: SAFETY_LIST,
      filter_flags: filter.reasons,
      first_touch: isFirstTouch,
      branding_header_added: brandingHeaderAdded,
      branding_footer_added: false,
      branded_link_used: brandedLinkUsed,
      first_touch_format: isFirstTouch ? "url_header_preview_plus_signature" : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[compose] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
