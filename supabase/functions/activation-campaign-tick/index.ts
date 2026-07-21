import { runCampaignTick, corsHeaders } from "../_shared/campaign-send.ts";

function buildBody(row: any): string {
  const first = row.first_name || (row.name ?? "").split(" ")[0] || "friend";
  const pack = row.pack_type ? ` (${row.pack_type})` : "";
  const sponsor = row.sponsor_name ? `\n\nYour sponsor ${row.sponsor_name} is cheering you on!` : "";
  return `Hi ${first} 🎉\n\nCongratulations on activating your APLGO position${pack} — welcome to the team!\n\nHere is your onboarding hub: https://crm.onlinecourseformlm.com/aplgo.html${sponsor}\n\n— Your APLGO Team`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const result = await runCampaignTick({
    campaignKey: "activation",
    table: "activation_campaign_recipients",
    buildBody,
    dryRun: !!body?.dry_run,
    cap: body?.cap,
    forceIds: body?.force_ids,
  });
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
