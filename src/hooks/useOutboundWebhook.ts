import { supabase } from '@/integrations/supabase/client';

/**
 * Sends an event to the external WhatsApp CRM via our outbound-webhook edge function.
 * Call this after creating/updating contacts, activities, or orders.
 *
 * @param event  - 'contact.created' | 'contact.updated' | 'activity.created' | 'order.created'
 * @param data   - The record that was created/updated
 * @param externalUserId - The user's ID in the external WhatsApp CRM (optional)
 */
export async function pushOutboundEvent(
  event: 'contact.created' | 'contact.updated' | 'activity.created' | 'order.created',
  data: Record<string, unknown>,
  externalUserId?: string
) {
  try {
    const { error } = await supabase.functions.invoke('outbound-webhook', {
      body: { event, data, external_user_id: externalUserId },
    });
    if (error) {
      console.warn('[outbound-webhook] Push failed silently:', error.message);
    }
  } catch (err) {
    // Never throw — outbound sync should never break the main CRM flow
    console.warn('[outbound-webhook] Push error (non-fatal):', err);
  }
}
