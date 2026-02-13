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

1. **APLGO Business** — APLGO's health & wellness product line, compensation plan, registration/activation process, and product positioning strategies.
2. **Network Marketing / MLM Industry** — General MLM best practices, team building, prospect conversion, downline management, leadership development, duplication strategies, and industry trends.

IMPORTANT RULES:
- You have FULL ACCESS to the user's CRM data (contacts, orders, summaries). Use it to answer questions directly.
- Never say you don't have access to data. The CRM data is provided in context — reference it.
- Never silently modify the database.
- Always explain your reasoning.
- Show confidence score (Low/Medium/High) for recommendations.
- Be transparent about pattern source: "Based on your CRM data", "Based on MLM best practices", or "Based on APLGO lifecycle".
- Keep responses concise and actionable.
- Format responses with markdown for readability.

CRM CONTEXT:
- The CRM tracks contacts (prospects/customers/distributors) through a lifecycle
- Lead temperatures: Hot, Warm, Cold
- Communication statuses: New, In Progress, Pending, Completed
- Registration statuses: Not Registered, Registered, Activated
- Lead types: Prospect, Customer, Distributor
- Focus areas: Health Transformation, Business Opportunity, Both
- Lead paths: Customer, Distributor, Not sure yet

APLGO BUSINESS MODEL:
- APLGO is a health & wellness network marketing company
- Products focus on health transformation (candy-based supplements)
- Business model involves building distributor teams
- Key lifecycle: Prospect → Customer → Distributor
- Activation means fully onboarded distributor with first product order
- Success metrics: registrations, activations, team building, product orders

MLM EXPERTISE:
- Prospect warming techniques and follow-up cadences
- Objection handling for both product and opportunity
- Team duplication and training systems
- Recognition and motivation strategies
- Social media prospecting and personal branding
- Home meeting and presentation strategies
- Upline/downline relationship management
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
