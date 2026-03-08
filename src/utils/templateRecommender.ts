import type { Prospect } from '@/data/mockData';
import type { MessageTemplate } from '@/hooks/useMessageTemplates';

interface Recommendation {
  template: MessageTemplate;
  reason: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export function recommendTemplate(
  contact: Prospect,
  templates: MessageTemplate[],
  channel: 'whatsapp' | 'email',
  daysSinceLastActivity: number | null,
  hasAnyActivity: boolean,
): Recommendation | null {
  const channelTemplates = templates.filter(t => t.channel === channel);
  if (channelTemplates.length === 0) return null;

  const find = (category: string, nameIncludes?: string) => {
    return channelTemplates.find(t =>
      t.category === category && (!nameIncludes || t.template_name.toLowerCase().includes(nameIncludes.toLowerCase()))
    );
  };

  // Priority-ordered rules
  // 1. Never contacted
  if (!hasAnyActivity) {
    if (contact.RegistrationStatus === 'Registered' || contact.RegistrationStatus === 'Activated') {
      const t = find('Welcome', 'Downline') || find('Welcome');
      if (t) return { template: t, reason: `${contact.FullName} is registered but has never been contacted. A welcome message will kickstart the relationship.`, confidence: 'High' };
    }
    const t = find('Welcome', 'Prospect') || find('Welcome');
    if (t) return { template: t, reason: `${contact.FullName} has never been contacted. A warm welcome message is the best first step.`, confidence: 'High' };
  }

  // 2. Registered but no purchase
  if (contact.LeadType === 'Registered_Nopurchase' || (contact.RegistrationStatus === 'Registered' && contact.LeadType === 'Prospect')) {
    const t = find('Activation', 'Registered') || find('Activation');
    if (t) return { template: t, reason: `${contact.FullName} is registered but hasn't purchased yet. An activation nudge will help convert them.`, confidence: 'High' };
  }

  // 3. Inactive 30+ days → Reactivation
  if (daysSinceLastActivity !== null && daysSinceLastActivity >= 30) {
    const t = find('Reactivation');
    if (t) return { template: t, reason: `${contact.FullName} has been inactive for ${daysSinceLastActivity} days. A gentle reactivation message can bring them back.`, confidence: 'High' };
  }

  // 4. Inactive 14-29 days
  if (daysSinceLastActivity !== null && daysSinceLastActivity >= 14) {
    const t = find('Inactivity', 'Inactive 2') || find('Inactivity');
    if (t) return { template: t, reason: `${contact.FullName} hasn't been contacted in ${daysSinceLastActivity} days. Time to reconnect before they go cold.`, confidence: 'High' };
  }

  // 5. Inactive 5-13 days
  if (daysSinceLastActivity !== null && daysSinceLastActivity >= 5) {
    const t = find('Inactivity', '5-7') || find('Inactivity');
    if (t) return { template: t, reason: `No activity with ${contact.FullName} in ${daysSinceLastActivity} days. A quick check-in keeps the momentum.`, confidence: 'Medium' };
  }

  // 6. Recently activated → Onboarding
  if (contact.RegistrationStatus === 'Activated' && contact.LeadType === 'Purchase_Status') {
    const t = find('Onboarding') || find('Training');
    if (t) return { template: t, reason: `${contact.FullName} is activated and building. An onboarding or training message will accelerate their growth.`, confidence: 'Medium' };
  }

  // 7. Active team member → Appreciation
  if (contact.CommunicationStatus === 'Completed' || contact.CommunicationStatus === 'Active') {
    const t = find('Appreciation');
    if (t) return { template: t, reason: `${contact.FullName} is an active member. Recognition and appreciation boost retention.`, confidence: 'Medium' };
  }

  // 8. End of month → Monthly push
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  if (daysInMonth - dayOfMonth <= 5) {
    const t = find('Monthly Activity', 'End');
    if (t) return { template: t, reason: `It's the final stretch of the month. A push message can help ${contact.FullName} hit their targets.`, confidence: 'Medium' };
  }

  // 9. Fallback: Monthly check-in
  const t = find('Monthly Activity', 'Check') || find('Appreciation') || channelTemplates[0];
  if (t) return { template: t, reason: `A regular check-in with ${contact.FullName} maintains the relationship.`, confidence: 'Low' };

  return null;
}
