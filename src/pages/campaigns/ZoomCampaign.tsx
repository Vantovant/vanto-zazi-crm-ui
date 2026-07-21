import { CampaignModule } from "@/components/campaigns/CampaignModule";

export function ZoomCampaign() {
  return (
    <CampaignModule
      title="Zoom Invitation Campaign (Automated)"
      description="Per-event recipient list with 3-stage reminders (T-48h, T-24h, T-2h). Paste attendees, set event date + Zoom URL, then the tick fires each stage within its window."
      table="zoom_campaign_recipients"
      tickFn="zoom-campaign-tick"
      campaignKey="zoom"
      accent="blue"
    />
  );
}
