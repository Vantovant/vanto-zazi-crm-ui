// Preview Google Contacts — nothing imported. Returns a page of contacts.
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

  let pageToken: string | undefined;
  try { const b = await req.json(); pageToken = b?.pageToken; } catch { /* */ }

  const url = new URL("https://people.googleapis.com/v1/people/me/connections");
  url.searchParams.set("personFields", "names,emailAddresses,phoneNumbers");
  url.searchParams.set("pageSize", "200");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${tok.token}` },
  });
  const data = await resp.json();
  if (!resp.ok) return json({ error: "google_error", detail: data }, 502);

  const items = (data.connections ?? []).map((p: any) => ({
    resourceName: p.resourceName,
    name: p.names?.[0]?.displayName ?? "",
    email: p.emailAddresses?.[0]?.value ?? "",
    phone: p.phoneNumbers?.[0]?.value ?? "",
  }));

  return json({
    ok: true,
    items,
    nextPageToken: data.nextPageToken ?? null,
    totalPeople: data.totalPeople ?? null,
  });
});
