import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRM_SCHEMA = {
  DateCaptured: { label: "Date Captured", description: "Date the contact was added (YYYY-MM-DD)", examples: ["2026-01-15", "15/01/2026"] },
  FullName: { label: "Full Name", description: "Contact's full name", examples: ["Thabo Molefe", "Jane Smith"] },
  PhoneNumber: { label: "Phone Number", description: "Contact phone number with country code", examples: ["+27 82 345 6789"] },
  EmailAddress: { label: "Email Address", description: "Contact email", examples: ["john@gmail.com"] },
  City: { label: "City", description: "City of residence", examples: ["Johannesburg", "Cape Town"] },
  Province: { label: "Province", description: "Province or region", examples: ["Gauteng", "Western Cape"] },
  State: { label: "State", description: "State (for non-SA contacts)", examples: ["California", "Texas"] },
  Country: { label: "Country", description: "Country", examples: ["South Africa", "Nigeria"] },
  LeadTemperature: { label: "Lead Temperature", description: "Hot, Warm, or Cold", examples: ["Hot", "Warm", "Cold"] },
  CommunicationStatus: { label: "Communication Status", description: "New, In Progress, Pending, or Completed", examples: ["New", "In Progress"] },
  RegistrationStatus: { label: "Registration Status", description: "Registered, Not Registered, or Activated", examples: ["Registered", "Not Registered"] },
  LeadType: { label: "Lead Type", description: "Prospect, Registered_Nopurchase, Purchase_Nostatus, Purchase_Status, or Expired (for inactive/expired members)", examples: ["Prospect", "Expired"] },
  InterestLevel: { label: "Interest Level", description: "High, Medium, or Low", examples: ["High", "Medium"] },
  FocusArea: { label: "Focus Area", description: "Health Transformation, Business Opportunity, or Both", examples: ["Health Transformation"] },
  LeadPath: { label: "Lead Path", description: "Customer, Distributor, or Not sure yet", examples: ["Customer", "Distributor"] },
  SponsorName: { label: "Sponsor Name", description: "Name of the sponsor/upline", examples: ["Alex Morgan"] },
  AssignedTo: { label: "Assigned To", description: "Team member responsible", examples: ["Sarah Botha"] },
  ActionTaken: { label: "Action Taken", description: "Last action performed", examples: ["Initial call completed"] },
  NextAction: { label: "Next Action", description: "Next planned action", examples: ["Schedule follow-up"] },
  MeetingTime: { label: "Meeting Time", description: "Scheduled meeting date/time", examples: ["2026-02-10 14:00"] },
  APLGoID: { label: "APLGO ID", description: "APLGO Associate ID", examples: ["APL-78234"] },
  AssociateStatus: { label: "Associate Status", description: "Associate/distributor status", examples: ["Active", "Pending"] },
  AdditionalNotes: { label: "Notes", description: "Additional notes", examples: ["Very interested"] },
  GOStatus: { label: "GO Status", description: "APLGO GO-Status level", examples: ["Promoter", "Associate", "Builder", "Diamond"] },
  Level: { label: "Level", description: "Network level number in the MLM tree", examples: ["1", "2", "6"] },
  Leg: { label: "Leg", description: "Leg/branch number in the MLM binary tree", examples: ["1", "2"] },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.95.3");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { headers, sampleRows, userApiKeys } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const systemPrompt = `You are a data mapping expert for the Vanto Zazi CRM (an APLGO MLM business CRM).

Your job: Given spreadsheet column headers and sample data rows, map each spreadsheet column to the correct CRM field.

CRM SCHEMA:
${JSON.stringify(CRM_SCHEMA, null, 2)}

RULES:
- Analyze BOTH the header name AND the sample data values to determine the best mapping
- If a column clearly doesn't match any CRM field, map it to null
- If data looks like it contains multiple fields combined (e.g. "Full Name" in one column), still map it to the best single field
- Consider common aliases: "Name" → FullName, "Tel"/"Mobile"/"Cell" → PhoneNumber, "Email" → EmailAddress, "Temp" → LeadTemperature, "Status" → CommunicationStatus, "Province/Region" → Province
- Consider data patterns: phone numbers (+27...), email patterns, date formats, city names
- If a column has values like "Hot/Warm/Cold" it's LeadTemperature regardless of header name
- Provide a confidence score (0.0-1.0) for each mapping
- If data values need transformation (e.g. "Y/N" to "Registered/Not Registered"), note it

Return ONLY a valid JSON array using the suggest_mappings tool.`;

    const userPrompt = `Map these spreadsheet columns to CRM fields:

HEADERS: ${JSON.stringify(headers)}

SAMPLE DATA (first 5 rows):
${sampleRows.map((row: string[], i: number) => `Row ${i + 1}: ${JSON.stringify(row)}`).join("\n")}`;

    // Determine provider - try Lovable first, fallback to user keys
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
              name: "suggest_mappings",
              description: "Return column mapping suggestions",
              parameters: {
                type: "object",
                properties: {
                  mappings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        spreadsheetColumn: { type: "string", description: "Original header from spreadsheet" },
                        crmField: { type: "string", description: "CRM field key to map to, or null if no match", nullable: true },
                        confidence: { type: "number", description: "Confidence 0.0-1.0" },
                        reason: { type: "string", description: "Brief explanation of why this mapping was chosen" },
                        transformNote: { type: "string", description: "Note about any data transformation needed, or empty", nullable: true },
                      },
                      required: ["spreadsheetColumn", "crmField", "confidence", "reason"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string", description: "Brief summary of the analysis for the user (1-2 sentences)" },
                },
                required: ["mappings", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_mappings" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return mappings" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-import error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
