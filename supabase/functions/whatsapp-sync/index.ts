import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
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

    const body = await req.json();
    const { action } = body;

    // ACTION: sync_contacts — bulk upsert WhatsApp contacts
    if (action === "sync_contacts") {
      const { contacts: waContacts } = body;
      if (!Array.isArray(waContacts) || waContacts.length === 0) {
        return new Response(JSON.stringify({ error: "No contacts provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch existing contacts to match by phone number
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, full_name, phone_number")
        .eq("user_id", userId);

      const existingByPhone = new Map(
        (existing || []).map((c: any) => [c.phone_number.replace(/\s/g, ""), c])
      );

      const created: string[] = [];
      const matched: string[] = [];
      const errors: string[] = [];

      for (const wa of waContacts) {
        const phone = (wa.phone || "").replace(/\s/g, "");
        const name = wa.name || "Unknown";
        // Skip entries without a phone number (likely groups or unnamed contacts)
        if (!phone) continue;
        // Skip group-like names
        if (name.includes(",") || name.includes("📌") || name.includes("👥")) continue;

        const match = existingByPhone.get(phone);
        if (match) {
          matched.push(match.full_name);
        } else {
          // Create new contact
          const { error: insertErr } = await supabase.from("contacts").insert({
            user_id: userId,
            full_name: name,
            phone_number: phone,
            lead_type: "Prospect",
            lead_temperature: "Warm",
            communication_status: "New",
            additional_notes: "Imported from WhatsApp Web",
          });
          if (insertErr) {
            errors.push(`${name}: ${insertErr.message}`);
          } else {
            created.push(name);
          }
        }
      }

      return new Response(
        JSON.stringify({ created, matched, errors, total: waContacts.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: log_chat — log a WhatsApp chat interaction
    if (action === "log_chat") {
      const { phone, name, message_preview } = body;
      if (!phone) {
        return new Response(JSON.stringify({ error: "Phone required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanPhone = phone.replace(/\s/g, "");

      // Find contact by phone
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, full_name")
        .eq("user_id", userId)
        .eq("phone_number", cleanPhone)
        .limit(1);

      const contact = contacts?.[0];

      // Log the activity
      await supabase.from("contact_activities").insert({
        user_id: userId,
        contact_id: contact?.id || null,
        activity_type: "whatsapp",
        summary: `WhatsApp chat with ${contact?.full_name || name || cleanPhone}`,
        notes: message_preview || "",
      });

      return new Response(
        JSON.stringify({ success: true, contact_id: contact?.id || null, contact_name: contact?.full_name || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-sync error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
