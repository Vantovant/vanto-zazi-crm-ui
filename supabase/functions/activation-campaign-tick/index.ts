import { runCampaignTick, corsHeaders } from "../_shared/campaign-send.ts";

function tierOf(row: any): "champion" | "strong" | "solid" | "starter" {
  const amt = Number(row.amount ?? 0);
  if (amt >= 5000) return "champion";
  if (amt >= 2500) return "strong";
  if (amt >= 1000) return "solid";
  return "starter";
}

const SIGNATURE = "— Vanto Vanto, APLGO (079 083 1530)";
const SHOP_URL = "https://getwellafrica.com/shop";

function buildBody(row: any): string {
  const first = row.first_name || (row.name ?? "").split(" ")[0] || "Leader";
  const amt = Number(row.amount ?? 0);
  const month = row.activity_month || "this month";
  const amtStr = amt > 0 ? `R${amt.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : null;
  const tier = tierOf(row);
  const isNew = String(row.pack_type ?? "").toLowerCase() === "new";

  if (isNew) {
    return `Hi ${first} 👋\n\nThis is Vanto Vanto from APLGO. Thank you for your ${month} activity${amtStr ? ` of ${amtStr}` : ""} — welcome and well done! 🙏\n\nYou can order anytime here: ${SHOP_URL}\n\n${SIGNATURE}`;
  }

  const order = `\n\nOrder anytime here: ${SHOP_URL}`;

  const library: Record<typeof tier, string> = {
    champion: `Leader ${first} 👑\n\nThank you for your ${month} activity of ${amtStr} — champion level. You are leading from the front. 🔥${order}\n\n${SIGNATURE}`,
    strong: `Leader ${first} 🌟\n\nThank you for your ${month} activity of ${amtStr}. Strong commitment — it moves the whole team forward. 💪${order}\n\n${SIGNATURE}`,
    solid: `Leader ${first} 🙏\n\nThank you for staying active in ${month} with ${amtStr}. Consistency keeps your rank and your income growing. 🌱${order}\n\n${SIGNATURE}`,
    starter: `Leader ${first} 🌿\n\nThank you for staying active in ${month}${amtStr ? ` with ${amtStr}` : ""}. Every active month protects your position and commissions. 💚${order}\n\n${SIGNATURE}`,
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
    buildMetadata: (row) => ({
      template_hint: `monthly_activity_thankyou_${tierOf(row)}`,
      tone: `activation_${tierOf(row)}`,
      tier: tierOf(row),
      activity_month: row.activity_month ?? null,
      amount: Number(row.amount ?? 0),
      email: row.email_address ?? row.email ?? null,
    }),
    dryRun: !!body?.dry_run,
    cap: body?.cap,
    forceIds: body?.force_ids,
    force: !!body?.force,
  });
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
