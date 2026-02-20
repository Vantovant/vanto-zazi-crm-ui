import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

// External WhatsApp CRM endpoint
const EXTERNAL_ENDPOINT =
  "https://nqyyvqcmcyggvlcswkio.supabase.co/functions/v1/crm-webhook";
const SHARED_SECRET = "50c55093544a96d14343fc1bc652738a";

async function pushToExternalCRM(payload: Record<string, unknown>) {
  try {
    const res = await fetch(EXTERNAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": SHARED_SECRET,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`[outbound-webhook] External CRM response ${res.status}: ${text}`);
    return { status: res.status, body: text };
  } catch (err) {
    console.error("[outbound-webhook] Failed to push to external CRM:", err);
    return { status: 0, body: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate JWT — only authenticated users can trigger this
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;

  try {
    const body = await req.json();
    const { event, data, external_user_id } = body;

    // external_user_id is the user's ID in the external WhatsApp CRM system
    const extUserId = external_user_id || userId;

    let result: { status: number; body: string } | null = null;

    switch (event) {
      case "contact.created":
      case "contact.updated": {
        const contact = data;
        result = await pushToExternalCRM({
          action: "upsert_contact",
          user_id: extUserId,
          contact: {
            full_name: contact.full_name,
            phone_number: contact.phone_number,
            email_address: contact.email_address || "",
            lead_type: contact.lead_type || "Prospect",
            lead_temperature: contact.lead_temperature || "Warm",
            communication_status: contact.communication_status || "New",
            country: contact.country || "South Africa",
            city: contact.city || "",
            additional_notes: contact.additional_notes || "",
            aplgo_id: contact.aplgo_id || "",
            sponsor_name: contact.sponsor_name || "",
          },
        });
        break;
      }

      case "activity.created": {
        const activity = data;
        result = await pushToExternalCRM({
          action: "log_chat",
          user_id: extUserId,
          phone: activity.phone || "",
          name: activity.contact_name || "",
          message_preview: activity.summary || activity.notes || "",
        });
        break;
      }

      case "order.created": {
        const order = data;
        // Push as a contact note — external CRM logs it as an activity
        result = await pushToExternalCRM({
          action: "log_chat",
          user_id: extUserId,
          phone: order.contact_phone || "",
          name: order.contact_name || "",
          message_preview: `New order: ${order.product || "Product"} × ${order.quantity || 1} — R${order.amount || 0}`,
        });
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown event: ${event}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        event,
        external_response: result,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[outbound-webhook] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
