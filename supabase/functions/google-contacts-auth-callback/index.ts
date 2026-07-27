// Google OAuth callback. verify_jwt = false. Exchanges code, stores tokens, redirects to app.
import { createClient } from "npm:@supabase/supabase-js@2";

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthErr = url.searchParams.get("error");

  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!clientId || !clientSecret || !supabaseUrl) {
    return html("<h1>Google OAuth not configured</h1>", 500);
  }

  if (oauthErr) return html(`<h1>Google denied the request</h1><p>${oauthErr}</p>`, 400);
  if (!code || !state) return html("<h1>Missing code or state</h1>", 400);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Look up state → user_id (single-use)
  const { data: stateRow, error: stateErr } = await admin
    .from("google_contacts_oauth_state")
    .select("*")
    .eq("state", state)
    .maybeSingle();
  if (stateErr || !stateRow) return html("<h1>Invalid or expired state</h1>", 400);

  // Delete state row immediately
  await admin.from("google_contacts_oauth_state").delete().eq("state", state);

  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return html("<h1>State expired — please try again</h1>", 400);
  }

  const redirectUri = `${supabaseUrl}/functions/v1/google-contacts-auth-callback`;

  // Exchange code for tokens
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = await tokenResp.json();
  if (!tokenResp.ok) {
    return html(`<h1>Token exchange failed</h1><pre>${JSON.stringify(tokenJson)}</pre>`, 502);
  }

  const accessToken = tokenJson.access_token as string;
  const refreshToken = (tokenJson.refresh_token as string | undefined) ?? null;
  const expiresIn = (tokenJson.expires_in as number | undefined) ?? 3600;
  const scope = (tokenJson.scope as string | undefined) ?? null;
  const tokenType = (tokenJson.token_type as string | undefined) ?? "Bearer";

  // Fetch Google account email
  let googleEmail: string | null = null;
  try {
    const uiResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (uiResp.ok) {
      const ui = await uiResp.json();
      googleEmail = (ui?.email as string) ?? null;
    }
  } catch { /* non-fatal */ }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Upsert per user. Preserve existing refresh token if Google didn't return a new one.
  const { data: existing } = await admin
    .from("google_contacts_tokens")
    .select("refresh_token")
    .eq("user_id", stateRow.user_id)
    .maybeSingle();

  const finalRefresh = refreshToken ?? existing?.refresh_token ?? null;

  const { error: upErr } = await admin
    .from("google_contacts_tokens")
    .upsert({
      user_id: stateRow.user_id,
      google_email: googleEmail,
      access_token: accessToken,
      refresh_token: finalRefresh,
      token_type: tokenType,
      scope,
      expires_at: expiresAt,
    }, { onConflict: "user_id" });

  if (upErr) return html(`<h1>Failed to store tokens</h1><pre>${upErr.message}</pre>`, 500);

  const target = stateRow.redirect_after || "/settings/google-contacts?connected=1";
  return html(`<!doctype html><html><head><title>Connected</title></head><body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem"><h1>✅ Google Contacts connected</h1><p>Signed in as <strong>${googleEmail ?? "your Google account"}</strong>.</p><p>You can close this tab, or <a style="color:#5eead4" href="${target}">return to the app</a>.</p><script>setTimeout(function(){window.location.href=${JSON.stringify(target)}},1500)</script></body></html>`);
});
