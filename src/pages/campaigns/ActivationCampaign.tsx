import { CampaignModule } from "@/components/campaigns/CampaignModule";

export function ActivationCampaign() {
  return (
    <CampaignModule
      title="Monthly Activity Campaign (Automated)"
      description="Thanks distributors who completed their monthly activity purchase. Tone and message scale with how much they paid this month. Auto-enrolled from the Monthly Activity Push list; kill-switch and daily caps enforced by the tick."
      table="activation_campaign_recipients"
      tickFn="activation-campaign-tick"
      campaignKey="activation"
      accent="emerald"
    />
  );
}
