import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pastedText, contactName, contactId, userApiKeys } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!pastedText?.trim()) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert at parsing APLGO backoffice data that has been copy-pasted.

You will receive raw pasted text from the APLGO backoffice system. Your job is to extract ALL order/purchase entries.

There are TWO types of PV entries:
1. **Activity PVs** - From "Recent purchases" / monthly activity stock orders. These are regular product purchases.
2. **Upgrade PVs** - From "Login Status change History" / GO Status upgrades. These are status upgrade purchases.

CONVERSION RATES:
- Activity PV: 1 PV = R18.75 ZAR
- Upgrade PV: 1 PV = R37.50 ZAR

For each entry found, extract:
- product: The product or pack name (e.g. "Monthly Activity Stock", "GO Status Upgrade to Builder", specific product names)
- quantity: Number of items (default 1)
- pv_amount: The PV value as a number
- purchase_type: Either "Activity" or "Upgrade" 
- zar_amount: The calculated ZAR amount (pv_amount × rate)
- order_date: Date if found in the text (YYYY-MM-DD format), otherwise empty string
- status: "Paid" for completed purchases, "Pending" otherwise
- badges: Array of relevant badges like ["Upgrade"] for upgrades, ["First Order"] if it looks like a first purchase, etc.
- order_id: Any order/reference number found, or generate one like "BO-XXXXX"

Look for patterns like:
- Tables with columns: Date, Product, PV, Amount, Status
- "Login Status change History" section → these are Upgrade PVs
- "Recent purchases" section → these are Activity PVs
- Lines containing PV values, dates, product names
- Status levels: Associate, Promoter, Builder, Supervisor, Diamond, Crown Diamond

Return ONLY valid JSON using the extract_orders tool.`;

    const userPrompt = `Parse this backoffice data for contact "${contactName || 'Unknown'}":\n\n${pastedText}`;

    // AI provider selection with fallback
    let aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let aiHeaders: Record<string, string> = { "Content-Type": "application/json" };
    let aiModel = "google/gemini-3-flash-preview";

    const pref = userApiKeys?.preferred_provider || "lovable";
    if (pref === "gemini" && userApiKeys?.gemini_api_key) {
      aiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      aiHeaders.Authorization = `Bearer ${userApiKeys.gemini_api_key}`;
      aiModel = "gemini-2.5-flash";
    } else if (pref === "openai" && userApiKeys?.openai_api_key) {
      aiUrl = "https://api.openai.com/v1/chat/completions";
      aiHeaders.Authorization = `Bearer ${userApiKeys.openai_api_key}`;
      aiModel = "gpt-4o-mini";
    } else if (LOVABLE_API_KEY) {
      aiHeaders.Authorization = `Bearer ${LOVABLE_API_KEY}`;
    } else {
      return new Response(JSON.stringify({ error: "No AI provider configured." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(aiUrl, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_orders",
              description: "Return extracted order entries from backoffice paste",
              parameters: {
                type: "object",
                properties: {
                  orders: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        product: { type: "string" },
                        quantity: { type: "number" },
                        pv_amount: { type: "number" },
                        purchase_type: { type: "string", enum: ["Activity", "Upgrade"] },
                        zar_amount: { type: "number" },
                        order_date: { type: "string" },
                        status: { type: "string" },
                        badges: { type: "array", items: { type: "string" } },
                        order_id: { type: "string" },
                      },
                      required: ["product", "quantity", "pv_amount", "purchase_type", "zar_amount", "order_date", "status", "badges", "order_id"],
                    },
                  },
                  summary: { type: "string", description: "Brief summary: how many orders found, total Activity PV, total Upgrade PV, total ZAR" },
                },
                required: ["orders", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_orders" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);

      // Fallback to Lovable if user provider failed
      if (pref !== "lovable" && LOVABLE_API_KEY) {
        console.log("Falling back to Lovable AI...");
        const fallbackHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        };
        const fallbackResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: fallbackHeaders,
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_orders",
                  description: "Return extracted order entries from backoffice paste",
                  parameters: {
                    type: "object",
                    properties: {
                      orders: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            product: { type: "string" },
                            quantity: { type: "number" },
                            pv_amount: { type: "number" },
                            purchase_type: { type: "string", enum: ["Activity", "Upgrade"] },
                            zar_amount: { type: "number" },
                            order_date: { type: "string" },
                            status: { type: "string" },
                            badges: { type: "array", items: { type: "string" } },
                            order_id: { type: "string" },
                          },
                          required: ["product", "quantity", "pv_amount", "purchase_type", "zar_amount", "order_date", "status", "badges", "order_id"],
                        },
                      },
                      summary: { type: "string" },
                    },
                    required: ["orders", "summary"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "extract_orders" } },
          }),
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const toolCall = fallbackData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const result = JSON.parse(toolCall.function.arguments);
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return parsed orders" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-backoffice-orders error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
