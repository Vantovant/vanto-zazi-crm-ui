import { runCampaignTick, corsHeaders } from "../_shared/campaign-send.ts";

const APLGO_URL = "https://crm.onlinecourseformlm.com/aplgo.html";

const TONES: Record<string, (first: string) => string> = {
  warm: (n) => `Hi Leader ${n} 🎉\n\nHappy Birthday to you! 🎂 Wishing you joy, favor, and a beautiful year ahead.`,
  royal: (n) => `Leader ${n} 👑🎂\n\nToday we celebrate YOU! Crown up — it's YOUR day.`,
  spiritual: (n) => `Dear Leader ${n} 🕊️\n\nHappy Blessed Birthday! May the Lord pour His favor upon you this new year. 🙏✨`,
  professional: (n) => `Hi Leader ${n},\n\nHappy Birthday! 🎂 Wishing you a wonderful celebration and a year of success.`,
};

function buildBody(row: any): string {
  const first = row.first_name || (row.name ?? "").split(" ")[0] || "Friend";
  const tone = TONES[row.tone] ? row.tone : "warm";
  return `${APLGO_URL}\n\n${TONES[tone](first)}\n\n— Your Team`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const result = await runCampaignTick({
    campaignKey: "birthday",
    table: "birthday_campaign_recipients",
    buildBody,
    buildMetadata: (row) => ({
      template_hint: `birthday_${TONES[row.tone] ? row.tone : "warm"}`,
      tone: TONES[row.tone] ? row.tone : "warm",
      congratulate_by_date: row.congratulate_by_date ?? null,
      cycle_year: row.cycle_year ?? null,
    }),
    dryRun: !!body?.dry_run,
    cap: body?.cap,
    forceIds: body?.force_ids,
    force: !!body?.force,
    extraFilter: (q) => q.lte("congratulate_by_date", new Date().toISOString().slice(0, 10)),
  });
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
