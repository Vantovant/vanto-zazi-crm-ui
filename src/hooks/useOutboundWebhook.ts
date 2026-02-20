import { supabase } from '@/integrations/supabase/client';

// External WhatsApp CRM user ID for outbound sync
const EXTERNAL_USER_ID = 'e336f0a0-ccf5-4992-9607-25c5bf590b11';

/**
 * Sends an event to the external WhatsApp CRM via our outbound-webhook edge function.
 * Fires automatically after contact/activity/order mutations.
 *
 * @param event  - 'contact.created' | 'contact.updated' | 'activity.created' | 'order.created'
 * @param data   - The record that was created/updated
 * @param externalUserId - Overrides the default external CRM user ID (optional)
 */
export async function pushOutboundEvent(
  event: 'contact.created' | 'contact.updated' | 'activity.created' | 'order.created',
  data: Record<string, unknown>,
  externalUserId: string = EXTERNAL_USER_ID
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
