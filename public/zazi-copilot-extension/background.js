/**
 * Zazi Follow-Up Copilot — Background Service Worker
 * Orchestrates tab events, alarms, storage, sync jobs, and CRM lookups.
 */

importScripts('lib/config.js', 'lib/supabase-client.js', 'lib/followup-engine.js', 'lib/message-suggestions.js');

// Open side panel when extension icon clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Listen for messages from content scripts and side panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle OPEN_SIDE_PANEL specially — needs sender.tab context
  if (msg.type === 'OPEN_SIDE_PANEL') {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.sidePanel.open({ tabId }).catch(err => {
        console.warn('[Zazi BG] Could not open side panel:', err);
      });
    }
    sendResponse({ success: true });
    return true;
  }

  handleMessage(msg, sender).then(sendResponse).catch(err => {
    console.error('[Zazi BG] Error:', err);
    sendResponse({ error: err.message });
  });
  return true; // Keep channel open for async
});

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case 'AUTH_LOGIN':
      return SupabaseClient.login(msg.email, msg.password);

    case 'AUTH_LOGOUT':
      await SupabaseClient.logout();
      return { success: true };

    case 'AUTH_STATUS':
      await SupabaseClient.init();
      return {
        authenticated: SupabaseClient.isAuthenticated(),
        email: SupabaseClient._userEmail,
      };

    case 'LOOKUP_CONTACT_PHONE':
      await SupabaseClient.init();
      return { contact: await SupabaseClient.findContactByPhone(msg.phone) };

    case 'LOOKUP_CONTACT_EMAIL':
      await SupabaseClient.init();
      return { contact: await SupabaseClient.findContactByEmail(msg.email) };

    case 'LOOKUP_CONTACT_NAME':
      await SupabaseClient.init();
      return { contacts: await SupabaseClient.findContactByName(msg.name) };

    case 'GET_CONTACT_TIMELINE': {
      await SupabaseClient.init();
      const [activities, orders, followUpStates] = await Promise.all([
        SupabaseClient.getContactActivities(msg.contactId),
        SupabaseClient.getContactOrders(msg.contactId),
        SupabaseClient.getFollowUpStates(msg.contactId),
      ]);
      return { activities, orders, followUpStates };
    }

    case 'EVALUATE_FOLLOWUP': {
      const recommendation = FollowUpEngine.evaluate(msg.context);
      return { recommendation };
    }

    case 'GENERATE_SUGGESTION': {
      const suggestion = MessageSuggestions.generate(msg.params);
      return { suggestion };
    }

    case 'LOG_ACTIVITY': {
      if (!msg.params?.contact_id) {
        return { success: false, error: 'No contact matched — cannot log activity without a linked contact.' };
      }
      await SupabaseClient.init();
      const result = await SupabaseClient.logActivity(msg.params);
      return { success: !result.error, result };
    }

    case 'SYNC_FOLLOWUP_STATE': {
      await SupabaseClient.init();
      const result = await SupabaseClient.upsertFollowUpState(msg.state);
      return { success: !result.error, result };
    }

    case 'CHAT_CONTEXT_UPDATE': {
      const { channel, contactIdentifier, messages, contactInfo } = msg;
      await SupabaseClient.init();

      // ---- Contact matching: phone first, then name fallback ----
      let contact = null;
      let candidateMatches = [];

      if (channel === 'whatsapp' && contactIdentifier) {
        // Try phone match first
        const phoneDigits = contactIdentifier.replace(/[^0-9]/g, '');
        if (phoneDigits.length >= 7) {
          contact = await SupabaseClient.findContactByPhone(phoneDigits);
        }

        // Fallback: name match
        if (!contact && contactInfo?.name) {
          const nameResults = await SupabaseClient.findContactByName(contactInfo.name);
          if (nameResults.length === 1) {
            contact = nameResults[0];
          } else if (nameResults.length > 1) {
            candidateMatches = nameResults;
          }
        }
      } else if (channel === 'gmail' && contactIdentifier) {
        contact = await SupabaseClient.findContactByEmail(contactIdentifier);
        if (!contact && contactInfo?.name) {
          const nameResults = await SupabaseClient.findContactByName(contactInfo.name);
          if (nameResults.length === 1) {
            contact = nameResults[0];
          } else if (nameResults.length > 1) {
            candidateMatches = nameResults;
          }
        }
      }

      // ---- Compute reply status from visible messages ----
      let lastInboundTime = null;
      let lastOutboundTime = null;
      let followUpAttempts = 0;
      let lastInboundPreview = '';
      let lastOutboundPreview = '';

      if (messages && messages.length > 0) {
        const sorted = [...messages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        for (const m of sorted) {
          if (m.direction === 'inbound' && !lastInboundTime) {
            lastInboundTime = new Date(m.timestamp);
            lastInboundPreview = m.text?.substring(0, 200) || '';
          }
          if (m.direction === 'outbound' && !lastOutboundTime) {
            lastOutboundTime = new Date(m.timestamp);
            lastOutboundPreview = m.text?.substring(0, 200) || '';
          }
        }
        followUpAttempts = FollowUpEngine.countFollowUpAttempts(sorted);
      }

      const replyStatus = FollowUpEngine.computeReplyStatus({ lastInboundTime, lastOutboundTime });

      // ---- Build follow-up engine context ----
      const context = {
        replyStatus,
        hoursSinceLastInbound: lastInboundTime ? (Date.now() - lastInboundTime.getTime()) / 3600000 : null,
        hoursSinceLastOutbound: lastOutboundTime ? (Date.now() - lastOutboundTime.getTime()) / 3600000 : null,
        leadTemperature: contact?.lead_temperature || 'Warm',
        leadType: contact?.lead_type || 'Prospect',
        registrationStatus: contact?.registration_status || 'Not Registered',
        hasPurchased: false,
        followUpAttempts,
        lastReplyTone: null,
      };

      // Check if contact has orders
      let lastProduct = null;
      if (contact) {
        const orders = await SupabaseClient.getContactOrders(contact.id, 1);
        if (Array.isArray(orders) && orders.length > 0) {
          context.hasPurchased = true;
          lastProduct = orders[0].product || null;
        }
      }

      const recommendation = FollowUpEngine.evaluate(context);

      // ---- Generate message suggestion ----
      const suggestion = MessageSuggestions.generate({
        contactName: contact?.full_name || contactInfo?.name || 'there',
        objective: recommendation.suggestedObjective,
        tone: recommendation.suggestedTone,
        channel,
        leadType: context.leadType,
        hasPurchased: context.hasPurchased,
        lastProduct,
      });

      // ---- Sync follow-up state to DB if we have a contact ----
      if (contact) {
        await SupabaseClient.upsertFollowUpState({
          contact_id: contact.id,
          channel,
          reply_status: replyStatus,
          last_inbound_at: lastInboundTime?.toISOString() || null,
          last_outbound_at: lastOutboundTime?.toISOString() || null,
          follow_up_attempts: followUpAttempts,
          recommended_action: recommendation.action,
          last_message_preview: messages?.[messages.length - 1]?.text?.substring(0, 200) || '',
        });
      }

      // ---- Store latest state for side panel ----
      await chrome.storage.local.set({
        current_context: {
          channel,
          contact,
          candidateMatches,
          contactIdentifier,
          contactInfo,
          replyStatus,
          recommendation,
          suggestion,
          lastInboundTime: lastInboundTime?.toISOString(),
          lastOutboundTime: lastOutboundTime?.toISOString(),
          lastInboundPreview,
          lastOutboundPreview,
          followUpAttempts,
          messages: (messages || []).slice(-10),
          timestamp: Date.now(),
        }
      });

      return { contact, candidateMatches, replyStatus, recommendation, suggestion };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// Periodic alarm for session refresh
chrome.alarms.create('refresh-session', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refresh-session') {
    await SupabaseClient.init();
    if (SupabaseClient.isAuthenticated()) {
      await SupabaseClient.refreshSession();
    }
  }
});
