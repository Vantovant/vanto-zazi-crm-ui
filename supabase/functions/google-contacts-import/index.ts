// Import all Google contacts into CRM. Dedupes on normalized phone or email.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateUser, getGoogleAccessToken } from "../_shared/google-token.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normPhone(raw: string): string | null {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  return digits.length > 0 ? digits : null;
}
function normEmail(raw: string): string | null {
  const t = (raw || "").trim().toLowerCase();
  return t.length > 0 ? t : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authenticateUser(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const tok = await getGoogleAccessToken(auth.admin, auth.userId);
  if ("error" in tok) return json({ error: tok.error }, tok.status);

  // Walk all pages
  const all: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://people.googleapis.com/v1/people/me/connections");
    url.searchParams.set("personFields", "names,emailAddresses,phoneNumbers,addresses");
    url.searchParams.set("pageSize", "500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tok.token}` },
    });
    const data = await resp.json();
    if (!resp.ok) return json({ error: "google_error", detail: data }, 502);
    all.push(...(data.connections ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  let imported = 0, skippedDup = 0, skippedEmpty = 0, failed = 0;
  const errors: string[] = [];

  for (const p of all) {
    const name = p.names?.[0]?.displayName ?? "";
    const email = p.emailAddresses?.[0]?.value ?? "";
    const phone = p.phoneNumbers?.[0]?.value ?? "";
    const city = p.addresses?.[0]?.city ?? "";
    const country = p.addresses?.[0]?.country ?? "";
    const nPhone = normPhone(phone);
    const nEmail = normEmail(email);

    if (!name && !nPhone && !nEmail) { skippedEmpty++; continue; }

    // Dedupe: existing contact by normalized phone or email
    if (nPhone || nEmail) {
      let dupQuery = auth.admin.from("contacts").select("id").eq("user_id", auth.userId).limit(1);
      if (nPhone && nEmail) {
        dupQuery = dupQuery.or(`phone_normalized.eq.${nPhone},email_normalized.eq.${nEmail}`);
      } else if (nPhone) {
        dupQuery = dupQuery.eq("phone_normalized", nPhone);
      } else if (nEmail) {
        dupQuery = dupQuery.eq("email_normalized", nEmail);
      }
      const { data: dupes } = await dupQuery;
      if (dupes && dupes.length > 0) { skippedDup++; continue; }
    }

    const { error } = await auth.admin.from("contacts").insert({
      user_id: auth.userId,
      date_captured: new Date().toISOString().split("T")[0],
      full_name: name || phone || email,
      phone_number: phone || "",
      email_address: email || "",
      city: city || "",
      province: "",
      state: "",
      country: country || "South Africa",
      lead_temperature: "Warm",
      communication_status: "New",
      registration_status: "Not Registered",
      lead_type: "Prospect",
      interest_level: "Medium",
      focus_area: "Health Transformation",
      lead_path: "Not sure yet",
      sponsor_name: "",
      assigned_to: "",
      action_taken: "",
      next_action: "",
      meeting_time: "",
      aplgo_id: "",
      associate_status: "",
      additional_notes: "Imported from Google Contacts",
      go_status: "",
      salutation_title: "Leader",
      leg: "",
      level: "",
    });
    if (error) {
      if (error.code === "23505") {
        skippedDup++;
      } else {
        failed++;
        if (errors.length < 5) errors.push(error.message);
      }
    } else {
      imported++;
    }
  }

  await auth.admin.from("google_contacts_tokens")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", auth.userId);

  return json({ ok: true, total: all.length, imported, skippedDup, skippedEmpty, failed, errors });
});
