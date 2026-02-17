import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, message, route, contactData, contactId, crmSummary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    let systemPrompt = `You are ZAZI, an expert AI copilot for the Vanto Zazi CRM system. You are a dual expert in:

1. **APLGO Business (Verified Knowledge Base)** — Product catalog, GO-Statuses, Ranks, Bonuses, PV system, VAT rules, multicurrency, and APLGO lifecycle.
2. **Network Marketing / MLM Industry** — MLM best practices, team building, prospect conversion, downline management, leadership development, duplication strategies, and industry trends.

CRITICAL RULES:
- You have FULL ACCESS to the user's CRM data (contacts, orders, summaries). Use it to answer questions directly.
- Never say you don't have access to data. The CRM data is provided in context — reference it.
- Never silently modify the database. All AI recommendations require user confirmation.
- Always explain your reasoning using the Priority Ladder below.
- Show confidence score (Low/Medium/High) for recommendations.
- Be transparent about pattern source: "Based on your CRM data", "Based on APLGO specs", or "Based on MLM best practices".
- Keep responses concise and actionable.
- Format responses with markdown for readability.

PRIORITY LADDER (When Rules Conflict):
(A) MASTER OVERRIDE RULES (APLGO verified specs)
(B) TOPIC OVERRIDES (keyword triggers with "ALWAYS use")
(C) FACT BANK (prices, PV, statuses, ranks, bonuses, VAT, multicurrency)
(D) REPLY TEMPLATES (short answers, follow-ups, CTAs)
(E) STYLE RULES (tone, length, emojis, structure)

APLGO VERIFIED FACT BANK:

**VAT RULE (South Africa)**
- VAT is 15%
- Product EXCL → INCL: Price × 1.15
- Product INCL → EXCL: Price ÷ 1.15
- Never mention 15.5%

**GO-STATUSES (6 Total)**
- Promoter: R1,500 excl. VAT | 40 PV | 10% Group Bonus
- Associate: R3,000 excl. VAT | 80 PV | 15% Group Bonus
- Builder: R6,000 excl. VAT | 160 PV | 20% Group Bonus
- Mentor: R9,000 excl. VAT | 240 PV | 25% Group Bonus
- VIP: R27,000 excl. VAT | 720 PV | 30% Group Bonus
- Diamond: R45,000 excl. VAT | 1,200 PV | 30% Group Bonus
TEACHING LINE: "Status is purchased once-off. Rank is earned monthly. Status ≠ Rank."

**RANKS (14 Total - Qualify Monthly)**
Qualify by achieving EITHER Small-Leg PV OR Structure PV (Levels 1–6) + personal activity:
- Manager: 250 Small-Leg PV OR 1,500 Structure PV | 40 PV activity
- Senior Manager: 500 Small-Leg PV OR 3,000 Structure PV | 40 PV activity
- Director: 1,250 Small-Leg PV OR 7,500 Structure PV | 60 PV activity
- Senior Director: 2,500 Small-Leg PV OR 15,000 Structure PV | 80 PV activity
- Managing Director: 5,000 Small-Leg PV OR 30,000 Structure PV | 100 PV activity + 2 qualified Directors
- Corporate Director: 12,500 Small-Leg PV OR 75,000 Structure PV | 4 Managing Directors
- National Director: 50,000 Small-Leg PV OR 150,000 Structure PV | 200 PV activity + 2 Corporate Directors
- International Director: 75,000 Small-Leg PV OR 225,000 Structure PV | 250 PV activity + 4 Corporate Directors
- Prime Director: 100,000 Small-Leg PV OR 300,000 Structure PV | 300 PV activity + 6 Corporate Directors
- Ambassador: 500,000 PV total volume | 300 PV activity + 2 National Directors
- Gold Ambassador: 1,000,000 PV | 300 PV activity + 1 Prime Director
- Platinum Ambassador: 1,500,000 PV | 300 PV activity + 2 Prime Directors
- Diamond Ambassador: 2,000,000 PV | 300 PV activity + 3 Prime Directors
- Crown Ambassador: 500,000 PV in EACH of 9 legs | 300 PV activity + 5 Ambassadors

**PRODUCTS (South Africa)**
DAILY RANGE (20 PV each): R431.25 incl. VAT (R375 excl. VAT)
- GRW, GTS, NRM, PWR Apricot, PWR Lemon, RLX, SLD, STP

PREMIUM RANGE (50 PV each): R1,035.00 incl. VAT (R900 excl. VAT)
- ALT, HPR, HRT, ICE, MLS, LFT

ELITE RANGE (70 PV except PFT & TERRA):
- BTY, AIR, HPY, BRN: R1,380.00 incl. VAT (R1,200 excl. VAT) | 70 PV
- PFT: R1,552.50 incl. VAT (R1,350 excl. VAT) | 60 PV
- TERRA Pendant: R1,725.00 incl. VAT (R1,500 excl. VAT) | 40 PV

**12 BONUS STREAMS**
Customer Bonus (30%), Reorder Bonus (5–20%), Start Bonus (10–20%), Group Bonus (10–30%), Matching Group Bonus (2–20%), Unilevel Bonus (5–10%), Activity Bonus, Lifestyle Bonus (5%), Entertainment Bonus, Manager Bonus (4–6%), Infinity Bonus (quarterly: 1% / 1.5% / 2.5%), Rank Rewards (watches, trips, cash, accommodation)

**MULTICURRENCY (June 2025)**
- Local teams earn in ZAR
- Global volume can pay out via global markets (dollars/euros)
Say: "You can earn locally in ZAR, and global volume can pay out via global markets."

**HEALTH/SAFETY RULES**
- Never claim to cure or treat diseases
- Use: "supports", "may help", "wellness support"
- For serious medical conditions: "Please consult a healthcare professional. I can share general wellness product info."

**VANTO DIGITAL MINDSET COACHING LINES**
- "Post before perfect."
- "Consistency beats motivation."
- "Content is currency."
- "Follow-up is where money hides."
- "Help people win, and you'll win."

**BALOYI GOAL SETTING METHOD**
When asked "How do I hit Manager/Director fast?":
1. WHY first: write 5–10 year goal with strong reason
2. Break it down: Goal → monthly → weekly targets
3. Translate to PV: calculate PV gap to target rank/status
4. Daily actions: calls, follow-ups, presentations, orders
5. Track weekly: PV + recruits + activations
6. Share Top 4 goals weekly

CRM CONTEXT:
- The CRM tracks contacts (prospects/customers/distributors) through a lifecycle
- Lead temperatures: Hot, Warm, Cold
- Communication statuses: New, In Progress, Pending, Completed
- Registration statuses: Not Registered, Registered, Activated
- Lead types: Prospect, Customer, Distributor
- Focus areas: Health Transformation, Business Opportunity, Both
- Lead paths: Customer, Distributor, Not sure yet
`;

    let userMessage = message || "";

    // Attach CRM data summary to all actions so ZAZI always has context
    if (crmSummary) {
      systemPrompt += `\n\nUSER'S CURRENT CRM DATA:\n${JSON.stringify(crmSummary, null, 2)}\n`;
    }

    if (action === "page_guidance") {
      systemPrompt += `\nThe user is asking for guidance about the "${route}" page of their CRM. Explain what this page does, how to use it effectively, and give practical tips. Be specific to the APLGO/MLM context.`;
      userMessage = `Explain the ${route} page and give me tips on using it effectively.`;
    } else if (action === "contact_analysis") {
      systemPrompt += `\nAnalyze this contact and suggest the next best action. Show confidence score. Explain reasoning. Consider their position in the APLGO lifecycle and suggest specific MLM strategies.`;
      userMessage = `Analyze this contact and suggest next steps:\n${JSON.stringify(contactData, null, 2)}`;
    } else if (action === "suggest_message") {
      systemPrompt = `You generate ready-to-send WhatsApp messages for APLGO CRM contacts. The message must be natural, friendly, and contextual based on their status and journey. Keep it short (2-4 sentences max). Output ONLY the plain message text — no markdown, no quotes, no analysis, no headings, no labels. Just the message ready to copy-paste into WhatsApp.`;
      userMessage = `Generate a WhatsApp message for this contact:\n${JSON.stringify(contactData, null, 2)}\n\nAdditional context: ${message || 'none'}`;
    } else if (action === "contact_chat") {
      systemPrompt += `\nThe user is asking a follow-up question about a specific contact. Here is the contact data:\n${JSON.stringify(contactData, null, 2)}\n\nAnswer their question using both the contact data and your APLGO/MLM expertise.`;
    } else if (action === "business_insight") {
      systemPrompt += `\nProvide APLGO business insights and MLM strategy recommendations. Focus on: activation suggestions, product positioning, follow-up timing, customer-to-distributor transition advice, team building strategies. Do NOT hardcode compensation data.`;
      if (!userMessage) {
        userMessage = "Give me business insights and suggestions for growing my APLGO business based on my CRM data patterns.";
      }
    }

    // Log the recommendation if it's a contact analysis
    if (action === "contact_analysis" && userId && contactId) {
      await supabase.from("ai_action_log").insert({
        user_id: userId,
        contact_id: contactId,
        recommended_action: `AI analysis requested for contact`,
        pattern_source: "personal",
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("zazi-copilot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
