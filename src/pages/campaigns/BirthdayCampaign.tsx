import { CampaignModule } from "@/components/campaigns/CampaignModule";

export function BirthdayCampaign() {
  return (
    <CampaignModule
      title="Birthday Campaign (Automated)"
      description="Auto-hoists today's eligible birthdays from Contact Birthdays and sends a warm one-touch WhatsApp via Maytapi. Kill-switch controls live sending; caps prevent bulk-fire mistakes."
      table="birthday_campaign_recipients"
      tickFn="birthday-campaign-tick"
      campaignKey="birthday"
      accent="pink"
    />
  );
}
