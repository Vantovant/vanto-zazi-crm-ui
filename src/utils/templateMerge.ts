import type { Prospect } from '@/data/mockData';

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
}

/** Normalise literal escape sequences (\n, \\n) into real line breaks */
function cleanEscapes(text: string): string {
  return text.replace(/\\n/g, '\n');
}

export function mergeTemplate(body: string, ctx: MergeContext): string {
  const rawFirst = ctx.contact.FullName.split(' ')[0];
  const firstName = `Leader ${rawFirst}`;
  const map: Record<string, string> = {
    firstName,
    senderName: ctx.senderName || 'Your Team Leader',
    teamName: ctx.teamName || 'Our Team',
    trainingLink: ctx.trainingLink || '[Training Link]',
    meetingLink: ctx.meetingLink || ctx.contact.MeetingTime || '[Meeting Link]',
    eventName: ctx.eventName || '[Event Name]',
    eventDate: ctx.eventDate || '[Event Date]',
    rankName: ctx.rankName || '[Rank]',
    pvNeeded: ctx.pvNeeded || '[PV Amount]',
    expiryDate: ctx.expiryDate || '[Expiry Date]',
  };
  const merged = body.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] || `[${key}]`);
  return cleanEscapes(merged);
}

export function mergeSubject(subject: string, ctx: MergeContext): string {
  return mergeTemplate(subject, ctx);
}
