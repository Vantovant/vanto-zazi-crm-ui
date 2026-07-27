// Shared helper: get a valid Google access token for a user, refreshing if needed.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function getGoogleAccessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<{ token: string; email: string | null } | { error: string; status: number }> {
  const { data: row, error } = await admin
    .from("google_contacts_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !row) return { error: "not_connected", status: 400 };

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  // Refresh if expiring within 60s
  if (expiresAt - 60_000 > Date.now()) {
    return { token: row.access_token as string, email: row.google_email ?? null };
  }

  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
  const refresh = row.refresh_token as string | null;
  if (!refresh || !clientId || !clientSecret) return { error: "no_refresh_token", status: 400 };

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json();
  if (!resp.ok) return { error: "refresh_failed", status: 502 };

  const newAccess = data.access_token as string;
  const newRefresh = (data.refresh_token as string | undefined) ?? refresh;
  const expiresIn = (data.expires_in as number | undefined) ?? 3600;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await admin.from("google_contacts_tokens").update({
    access_token: newAccess,
    refresh_token: newRefresh,
    expires_at: newExpiresAt,
  }).eq("user_id", userId);

  return { token: newAccess, email: row.google_email ?? null };
}

export async function authenticateUser(req: Request): Promise<{ userId: string; admin: SupabaseClient } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return { error: "unauthorized", status: 401 };
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return { error: "unauthorized", status: 401 };
  return { userId: data.user.id, admin };
}
