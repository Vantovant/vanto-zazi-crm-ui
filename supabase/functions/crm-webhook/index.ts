import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version",
};

/**
 * Resolves a local Zazi user UUID from an email address.
 * NEVER trust external UUIDs — always resolve locally.
 */
async function resolveLocalUserId(
  supabase: any,
  email: string
): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .limit(1)
    .single();
  return data?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Authenticate via shared webhook secret ──────────────────────────────
  const incomingSecret = req.headers.get("x-webhook-secret");
  const expectedSecret = Deno.env.get("WEBHOOK_SECRET");

  if (!incomingSecret || incomingSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized: invalid webhook secret" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Use service role key so RLS is bypassed for webhook writes ──────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { action, email } = body;

    // ── Resolve local user by email — NEVER trust external user_id ────────
    if (!email) {
      return new Response(JSON.stringify({ error: "email is required to resolve local user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const localUserId = await resolveLocalUserId(supabase, email);
    if (!localUserId) {
      return new Response(
        JSON.stringify({ error: `No matching local user found for email: ${email}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: sync_contacts ─────────────────────────────────────────────
    if (action === "sync_contacts") {
      const { contacts: waContacts } = body;

      if (!Array.isArray(waContacts) || waContacts.length === 0) {
        return new Response(JSON.stringify({ error: "No contacts provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("contacts")
        .select("id, full_name, phone_number")
        .eq("user_id", localUserId);

      const existingByPhone = new Map(
        (existing || []).map((c: any) => [c.phone_number.replace(/\s/g, ""), c])
      );

      const created: string[] = [];
      const matched: string[] = [];
      const errors: string[] = [];

      for (const wa of waContacts) {
        const phone = (wa.phone || "").replace(/\s/g, "");
        const name = wa.name || "Unknown";

        if (!phone) continue;
        if (name.includes(",") || name.includes("📌") || name.includes("👥")) continue;

        const match = existingByPhone.get(phone);
        if (match) {
          matched.push(match.full_name);
        } else {
          const { error: insertErr } = await supabase.from("contacts").insert({
            user_id: localUserId,
            assigned_to: localUserId,
            full_name: name,
            phone_number: phone,
            email_address: wa.email || "",
            lead_type: wa.lead_type || "Prospect",
            lead_temperature: wa.lead_temperature || "Warm",
            communication_status: "New",
            country: wa.country || "South Africa",
            additional_notes: wa.notes || "Imported via CRM Webhook",
          });

          if (insertErr) {
            errors.push(`${name}: ${insertErr.message}`);
          } else {
            created.push(name);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          resolved_user_id: localUserId,
          created: created.length,
          matched: matched.length,
          errors,
          total: waContacts.length,
          created_names: created,
          matched_names: matched,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: log_chat ──────────────────────────────────────────────────
    if (action === "log_chat") {
      const { phone, name, message_preview } = body;

      if (!phone) {
        return new Response(JSON.stringify({ error: "phone is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanPhone = phone.replace(/\s/g, "");

      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, full_name")
        .eq("user_id", localUserId)
        .eq("phone_number", cleanPhone)
        .limit(1);

      const contact = contacts?.[0];

      await supabase.from("contact_activities").insert({
        user_id: localUserId,
        contact_id: contact?.id || null,
        activity_type: "whatsapp",
        summary: `WhatsApp chat with ${contact?.full_name || name || cleanPhone}`,
        notes: message_preview || "",
      });

      return new Response(
        JSON.stringify({
          success: true,
          resolved_user_id: localUserId,
          contact_id: contact?.id || null,
          contact_name: contact?.full_name || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: upsert_contact ────────────────────────────────────────────
    if (action === "upsert_contact") {
      const { contact } = body;

      if (!contact?.full_name) {
        return new Response(JSON.stringify({ error: "contact.full_name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phone = (contact.phone_number || "").replace(/\s/g, "");

      let existingId: string | null = null;
      if (phone) {
        const { data: found } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", localUserId)
          .eq("phone_number", phone)
          .limit(1);
        existingId = found?.[0]?.id || null;
      }

      const contactData = {
        user_id: localUserId,
        assigned_to: localUserId,
        full_name: contact.full_name,
        phone_number: phone,
        email_address: contact.email_address || "",
        lead_type: contact.lead_type || "Prospect",
        lead_temperature: contact.lead_temperature || "Warm",
        communication_status: contact.communication_status || "New",
        country: contact.country || "South Africa",
        city: contact.city || "",
        additional_notes: contact.additional_notes || "",
        aplgo_id: contact.aplgo_id || "",
        sponsor_name: contact.sponsor_name || "",
      };

      if (existingId) {
        const { error } = await supabase
          .from("contacts")
          .update(contactData)
          .eq("id", existingId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ success: true, action: "updated", contact_id: existingId, resolved_user_id: localUserId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const { data: inserted, error } = await supabase
          .from("contacts")
          .insert(contactData)
          .select("id")
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ success: true, action: "created", contact_id: inserted.id, resolved_user_id: localUserId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("crm-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
