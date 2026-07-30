// Mirrors supabase/functions/_shared/campaign-send.ts cycle keys so the UI can
// show which recipients were already messaged this cycle.

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export type CampaignKind = "birthday" | "activation" | "zoom";

export function cycleKeyFor(campaign: string, row: any): string {
  const now = new Date();
  if (campaign === "zoom") return String(row?.event_id ?? now.toISOString().slice(0, 10));
  if (campaign === "birthday") return String(row?.cycle_year ?? now.getUTCFullYear());
  const raw = String(row?.activity_month ?? "").trim().toLowerCase();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const mon = MONTHS[raw.slice(0, 3)];
  if (mon) {
    const yr = raw.match(/(20\d{2})/)?.[1] ?? String(now.getUTCFullYear());
    return `${yr}-${mon}`;
  }
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dedupeKeyFor(campaign: string, phone: string, cycle: string): string {
  return `${campaign}:${phone}:${cycle}`;
}
