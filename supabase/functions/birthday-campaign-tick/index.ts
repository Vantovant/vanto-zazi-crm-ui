import { runCampaignTick, corsHeaders } from "../_shared/campaign-send.ts";

const APLGO_URL = "https://crm.onlinecourseformlm.com/aplgo.html";

// Full library, matching src/components/BirthdayComposerModal.tsx
const TONES: Record<string, (first: string, full: string) => string> = {
  warm: (n) => `Hi ${n} 🎉\n\nHappy Birthday to you! 🎂\n\nWishing you joy, strength, favor, and a beautiful year ahead.\n\nMay this new season bring growth, peace, and great grace into your life.\n\nEnjoy your special day! 🌟`,
  royal: (_n, full) => `${full} 👑🎂\n\nToday we celebrate YOU!\n\nHappy Birthday — you are royalty, and this day marks another year of greatness.\n\nMay your new year be filled with abundance, favor, and extraordinary blessings.\n\nCrown up. It's YOUR day! 🎉🏆`,
  spiritual: (n) => `Dear ${n} 🕊️\n\nHappy Blessed Birthday! 🎂\n\nMay the Lord pour out His favor, protection, and wisdom upon you this new year.\n\nYou are a blessing to everyone around you. May this season bring divine connections, growth, and peace beyond understanding.\n\nCelebrate with gratitude — the best is yet to come. 🙏✨`,
  professional: (_n, full) => `Hi ${full},\n\nHappy Birthday! 🎂\n\nWishing you a wonderful celebration and a year filled with success, growth, and good health.\n\nKind regards`,
};

function buildBody(row: any): string {
  const first = row.first_name || (row.name ?? "").split(" ")[0] || "Friend";
  const full = row.name || first;
  const tone = TONES[row.tone] ? row.tone : "warm";
  return `${APLGO_URL}\n\n${TONES[tone](first, full)}\n\n— Your Team`;
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
