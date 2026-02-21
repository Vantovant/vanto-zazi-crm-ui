import { supabase } from '@/integrations/supabase/client';

/**
 * Sends an event to the external WhatsApp CRM via our outbound-webhook edge function.
 * Identity is resolved by email on the receiving end — no external UUIDs are sent.
 *
 * @param event  - 'contact.created' | 'contact.updated' | 'activity.created' | 'order.created'
 * @param data   - The record that was created/updated
 */
export async function pushOutboundEvent(
  event: 'contact.created' | 'contact.updated' | 'activity.created' | 'order.created',
  data: Record<string, unknown>,
) {
  try {
    const { error } = await supabase.functions.invoke('outbound-webhook', {
      body: { event, data },
    });
    if (error) {
      console.warn('[outbound-webhook] Push failed silently:', error.message);
    }
  } catch (err) {
    // Never throw — outbound sync should never break the main CRM flow
    console.warn('[outbound-webhook] Push error (non-fatal):', err);
  }
}
