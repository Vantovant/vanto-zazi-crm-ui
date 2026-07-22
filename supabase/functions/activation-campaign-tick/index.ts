import { runCampaignTick, corsHeaders } from "../_shared/campaign-send.ts";

function tierOf(row: any): "champion" | "strong" | "solid" | "starter" {
  const amt = Number(row.amount ?? 0);
  if (amt >= 5000) return "champion";
  if (amt >= 2500) return "strong";
  if (amt >= 1000) return "solid";
  return "starter";
}

function buildBody(row: any): string {
  const first = row.first_name || (row.name ?? "").split(" ")[0] || "Leader";
  const amt = Number(row.amount ?? 0);
  const month = row.activity_month || "this month";
  const amtStr = amt > 0 ? `R${amt.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : null;
  const tier = tierOf(row);

  const library: Record<typeof tier, string> = {
    champion:
      `Leader ${first} 👑\n\nYour ${month} activity of ${amtStr} is CHAMPION-level — thank you for leading from the front. Your consistency is building a rank shift for the whole team. Keep the fire burning! 🔥\n\n— GetWell Grow`,
    strong:
      `Leader ${first} 🌟\n\nA huge thank you for your ${month} activity of ${amtStr}. That is a STRONG commitment and it moves the team forward every single week. We see you and we appreciate you. 💪\n\n— GetWell Grow`,
    solid:
      `Leader ${first} 🙏\n\nThank you for keeping your rank active in ${month} with ${amtStr}. Consistency wins in APLGO — every month you show up, your income and your team grow. Well done! 🌱\n\n— GetWell Grow`,
    starter:
      `Leader ${first} 🌿\n\nThank you for staying active in ${month}${amtStr ? ` with ${amtStr}` : ""}. Every activity month keeps your position and your commissions alive — proud of you for showing up. Let's push for more next month! 💚\n\n— GetWell Grow`,
  };

  return library[tier];
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
