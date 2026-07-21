import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CampaignTable =
  | "birthday_campaign_recipients"
  | "activation_campaign_recipients"
  | "zoom_campaign_recipients";

export interface CampaignRecipient {
  id: string;
  user_id: string;
  contact_id: string | null;
  name: string | null;
  first_name: string | null;
  phone_normalized: string;
  email: string | null;
  status: string;
  attempts: number;
  sent_at: string | null;
  provider_message_id: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  reply_preview: string | null;
  error: string | null;
  created_at: string;
  [k: string]: any;
}

export interface CampaignStats {
  total: number; queued: number; sent: number; delivered: number; read: number; replied: number; failed: number;
}

export function useCampaignRecipients(table: CampaignTable) {
  const [rows, setRows] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CampaignStats>({ total: 0, queued: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from(table) as any)
      .select("*")
      .order("replied_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);
    const list = (data ?? []) as CampaignRecipient[];
    setRows(list);
    setStats({
      total: list.length,
      queued: list.filter(r => r.status === "queued").length,
      sent: list.filter(r => r.status === "sent").length,
      delivered: list.filter(r => r.delivered_at).length,
      read: list.filter(r => r.read_at).length,
      replied: list.filter(r => r.replied_at).length,
      failed: list.filter(r => r.status === "failed").length,
    });
    setLoading(false);
  }, [table]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const insertMany = useCallback(async (payload: any[]) => {
    if (!payload.length) return { inserted: 0, errors: 0 };
    const { data, error } = await (supabase.from(table) as any)
      .upsert(payload, { onConflict: table === "birthday_campaign_recipients" ? "phone_normalized,cycle_year"
        : table === "activation_campaign_recipients" ? "phone_normalized"
        : "event_id,phone_normalized,reminder_stage", ignoreDuplicates: true })
      .select("id");
    await fetchAll();
    return { inserted: data?.length ?? 0, errors: error ? 1 : 0, error: error?.message };
  }, [table, fetchAll]);

  const remove = useCallback(async (id: string) => {
    await (supabase.from(table) as any).delete().eq("id", id);
    fetchAll();
  }, [table, fetchAll]);

  const skip = useCallback(async (id: string) => {
    await (supabase.from(table) as any).update({ status: "skipped" }).eq("id", id);
    fetchAll();
  }, [table, fetchAll]);

  return { rows, loading, stats, refetch: fetchAll, insertMany, remove, skip };
}

export async function runTick(fn: "birthday-campaign-tick" | "activation-campaign-tick" | "zoom-campaign-tick", body: any = {}) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  return { data, error };
}

export async function loadCampaignSettings(campaignKey: string) {
  const { data } = await (supabase.from("campaign_settings") as any)
    .select("*")
    .eq("campaign_key", campaignKey)
    .maybeSingle();
  return data ?? { campaign_key: campaignKey, enabled: false, daily_cap: 40, per_tick_cap: 10 };
}

export async function saveCampaignSettings(campaignKey: string, patch: any) {
  await (supabase.from("campaign_settings") as any)
    .upsert({ campaign_key: campaignKey, ...patch }, { onConflict: "campaign_key" });
}
