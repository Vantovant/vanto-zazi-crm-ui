import { runCampaignTick, corsHeaders } from "../_shared/campaign-send.ts";

const SIGNATURE = "— Vanto Vanto, APLGO (079 083 1530)";
const RESTORE_URL = "https://getwellafrica.com/shop";

function buildBody(row: any): string {
  const first = row.first_name || (row.name ?? "").split(" ")[0] || "Leader";
  const status = row.former_go_status || "";
  const statusLine = status ? ` — you were ${status} when things went quiet.` : "";

  return `Hi ${first} 👋\n\nThis is Vanto from APLGO. I noticed we haven't heard from you in a while${statusLine} I wanted to check in personally — how are you doing?\n\nWhenever you're ready, your account can be restored by paying the Associate Enrollment fee again, and your GO status stays exactly as it was — nothing lost. No pressure at all, just want you back on the team when the time is right.\n\nYou can restore or order anytime here: ${RESTORE_URL}\n\n${SIGNATURE}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const result = await runCampaignTick({
    campaignKey: "expired" as any,
    table: "expired_campaign_recipients",
    buildBody,
    buildMetadata: (row) => ({
      template_hint: "expired_winback_checkin",
      tone: "expired_winback",
      former_go_status: row.former_go_status ?? null,
      date_inactive: row.date_inactive ?? null,
      email: row.email_address ?? row.email ?? null,
    }),
    dryRun: !!body?.dry_run,
    cap: body?.cap,
    forceIds: body?.force_ids,
    force: !!body?.force,
  });
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
