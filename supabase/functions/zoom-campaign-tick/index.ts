import { runCampaignTick, corsHeaders } from "../_shared/campaign-send.ts";

const STAGE_LABEL: Record<string, string> = {
  t_minus_48h: "in 2 days",
  t_minus_24h: "tomorrow",
  t_minus_2h: "in 2 hours",
};

function buildBody(row: any): string {
  const first = row.first_name || (row.name ?? "").split(" ")[0] || "friend";
  const when = STAGE_LABEL[row.reminder_stage] ?? "soon";
  const event = row.event_name ?? "our Zoom session";
  const date = new Date(row.event_date).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" });
  return `Hi ${first} 👋\n\nQuick reminder — *${event}* is ${when} (${date} SAST).\n\nJoin here: ${row.zoom_url}\n\nReply *1* to confirm, *2* if you can't make it.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const now = new Date();
  // stage windows: send t_minus_48h between 46-50h, t_minus_24h between 22-26h, t_minus_2h between 1-3h
  const result = await runCampaignTick({
    campaignKey: "zoom",
    table: "zoom_campaign_recipients",
    buildBody,
    dryRun: !!body?.dry_run,
    cap: body?.cap,
    forceIds: body?.force_ids,
    extraFilter: (q) => q.gte("event_date", now.toISOString()),
  });
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
