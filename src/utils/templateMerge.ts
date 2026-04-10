import type { Prospect } from '@/data/mockData';

export const SALUTATION_OPTIONS = [
  'Leader', 'Mr', 'Mrs', 'Ms', 'Dr', 'Pastor', 'Coach', 'Boss', 'Brother', 'Sister', 'None',
] as const;

export interface MergeContext {
  contact: Prospect;
  senderName?: string;
  teamName?: string;
  trainingLink?: string;
  meetingLink?: string;
  eventName?: string;
  eventDate?: string;
  rankName?: string;
  pvNeeded?: string;
  expiryDate?: string;
  amount?: string;
  month?: string;
  actualLevel?: string;
  displayedLevel?: string;
  userId?: string;
}

/** Normalise literal escape sequences (\n, \\n) into real line breaks */
function cleanEscapes(text: string): string {
  return text.replace(/\\n/g, '\n');
}

/** Build a greeting-ready name from the contact, e.g. "Leader Dimpho" */
export function generateGreeting(contact: Prospect): string {
  const rawFirst = contact.FullName.split(' ')[0];
  const title = contact.SalutationTitle || 'Leader';
  if (title === 'None') return rawFirst;
  return `${title} ${rawFirst}`;
}

export function mergeTemplate(body: string, ctx: MergeContext): string {
  const firstName = generateGreeting(ctx.contact);
  const map: Record<string, string> = {
    firstName,
    full_name: ctx.contact.FullName,
    senderName: ctx.senderName || 'Your Team Leader',
    teamName: ctx.teamName || 'Our Team',
    trainingLink: ctx.trainingLink || '[Training Link]',
    meetingLink: ctx.meetingLink || ctx.contact.MeetingTime || '[Meeting Link]',
    eventName: ctx.eventName || '[Event Name]',
    eventDate: ctx.eventDate || '[Event Date]',
    rankName: ctx.rankName || '[Rank]',
    pvNeeded: ctx.pvNeeded || '[PV Amount]',
    expiryDate: ctx.expiryDate || '[Expiry Date]',
    amount: ctx.amount || '[Amount]',
    month: ctx.month || '[Month]',
    actual_level: ctx.actualLevel || '[Level]',
    displayed_level: ctx.displayedLevel || '[Level]',
    user_id: ctx.userId || ctx.contact.APLGoID || '[User ID]',
    sender_email: '[Email]',
  };
  const merged = body.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] || `[${key}]`);
  return cleanEscapes(merged);
}

export function mergeSubject(subject: string, ctx: MergeContext): string {
  return mergeTemplate(subject, ctx);
}
