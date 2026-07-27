// Push all CRM contacts to Google People API. Manual trigger.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateUser, getGoogleAccessToken } from "../_shared/google-token.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authenticateUser(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const tok = await getGoogleAccessToken(auth.admin, auth.userId);
  if ("error" in tok) return json({ error: tok.error }, tok.status);

  // Fetch all CRM contacts for this user
  const contacts: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await auth.admin
      .from("contacts")
      .select("id, full_name, phone_number, email_address, phone_normalized, email_normalized, city, country, aplgo_id")
      .eq("user_id", auth.userId)
      .range(from, from + pageSize - 1);
    if (error) return json({ error: "fetch_failed", detail: error.message }, 500);
    contacts.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  let created = 0, failed = 0, skipped = 0;
  const errors: string[] = [];

  for (const c of contacts) {
    const name = (c.full_name ?? "").trim();
    const phone = c.phone_normalized || c.phone_number || "";
    const email = c.email_normalized || c.email_address || "";
    if (!name && !phone && !email) { skipped++; continue; }

    const body = {
      names: name ? [{ unstructuredName: name, givenName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || undefined }] : undefined,
      phoneNumbers: phone ? [{ value: phone, type: "mobile" }] : undefined,
      emailAddresses: email ? [{ value: email }] : undefined,
      addresses: (c.city || c.country) ? [{ city: c.city || undefined, country: c.country || undefined }] : undefined,
      biographies: c.aplgo_id ? [{ value: `APLGO ID: ${c.aplgo_id}`, contentType: "TEXT_PLAIN" }] : undefined,
    };

    try {
      const resp = await fetch("https://people.googleapis.com/v1/people:createContact", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        created++;
      } else {
        failed++;
        if (errors.length < 5) errors.push(`${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      }
    } catch (e) {
      failed++;
      if (errors.length < 5) errors.push(String(e));
    }
    // gentle pacing to avoid rate limits
    if ((created + failed) % 20 === 0) await new Promise((r) => setTimeout(r, 300));
  }

  await auth.admin.from("google_contacts_tokens")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", auth.userId);

  return json({ ok: true, total: contacts.length, created, failed, skipped, errors });
});
