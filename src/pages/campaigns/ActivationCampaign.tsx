import { CampaignModule } from "@/components/campaigns/CampaignModule";

export function ActivationCampaign() {
  return (
    <CampaignModule
      title="Activation Campaign (Automated)"
      description="Auto-hoists newly paid / activated distributors and sends the onboarding welcome + hub link. Rolling 48h deadline enforced by the tick."
      table="activation_campaign_recipients"
      tickFn="activation-campaign-tick"
      campaignKey="activation"
      accent="emerald"
    />
  );
}
