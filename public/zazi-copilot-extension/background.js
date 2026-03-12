/**
 * Zazi Follow-Up Copilot — Background Service Worker
 * Orchestrates tab events, alarms, storage, sync jobs, and CRM lookups.
 */

importScripts('lib/config.js', 'lib/supabase-client.js', 'lib/followup-engine.js', 'lib/message-suggestions.js');

// Open side panel when extension icon clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

const CONTEXT_KEYS = [
  'current_channel',
  'current_context',
  'last_known_good_whatsapp_context',
  'last_known_good_gmail_context',
  'contact_mappings',
];
const MIN_CLEAR_MISSES = 3;
const CLEAR_GRACE_MS = 15000;
const CHANNEL_HOSTS = {
  whatsapp: 'web.whatsapp.com',
  gmail: 'mail.google.com',
};

const LEAD_TYPES = ['Prospect', 'Registered_Nopurchase', 'Purchase_Nostatus', 'Purchase_Status', 'Expired', 'Customer', 'Distributor'];

function getLastKnownContextKey(channel) {
  return channel === 'gmail' ? 'last_known_good_gmail_context' : 'last_known_good_whatsapp_context';
}

function getConversationKey({ channel, contactIdentifier, contactInfo, contact }) {
  const fallback = (contactIdentifier || contactInfo?.name || '').toString().trim().toLowerCase();
  return `${channel}:${contact?.id || fallback || 'unknown'}`;
}

function isStrongContextPayload({ channel, contactIdentifier, contactInfo, messages }) {
  if (!channel) return false;
  if (contactIdentifier?.toString().trim()) return true;
  if (contactInfo?.name?.toString().trim()) return true;
  return Array.isArray(messages) && messages.length > 0;
}

async function getStoredContexts() {
  return chrome.storage.local.get(CONTEXT_KEYS);
}

async function isSenderTabActiveForChannel(tabId, channel) {
  if (!tabId || !channel) return false;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.active) return false;
    const expectedHost = CHANNEL_HOSTS[channel];
    if (!expectedHost) return true;
    return (tab.url || '').includes(expectedHost);
  } catch {
    return false;
  }
}

// ===== PERSISTENT CONTACT MAPPINGS =====
async function getContactMappings() {
  const data = await chrome.storage.local.get('contact_mappings');
  return data.contact_mappings || {};
}

async function saveContactMapping(conversationKey, contactId) {
  const mappings = await getContactMappings();
  mappings[conversationKey] = contactId;
  await chrome.storage.local.set({ contact_mappings: mappings });
  console.log('[Zazi BG] Contact mapping saved:', conversationKey, '→', contactId);
}

// ===== MESSAGE HANDLER =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
  return true;
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

    case 'GET_REMEMBERED_EMAIL': {
      const data = await chrome.storage.local.get('remembered_email');
      return { email: data.remembered_email || '' };
    }

    case 'GET_LEAD_TYPES':
      return { leadTypes: LEAD_TYPES };

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

    case 'CREATE_CONTACT': {
      await SupabaseClient.init();
      const createResult = await SupabaseClient.createContact(msg.params);
      return createResult;
    }

    case 'SYNC_FOLLOWUP_STATE': {
      await SupabaseClient.init();
      const result = await SupabaseClient.upsertFollowUpState(msg.state);
      return { success: !result.error, result };
    }

    case 'SAVE_CONTACT_MAPPING': {
      if (msg.conversationKey && msg.contactId) {
        await saveContactMapping(msg.conversationKey, msg.contactId);
        return { success: true };
      }
      return { success: false, error: 'Missing conversationKey or contactId' };
    }

    case 'CONTEXT_CLEAR_REQUEST': {
      const reason = msg.reason || 'unknown';
      const allowedReasons = new Set(['confirmed_no_active_chat', 'chat_switched', 'tab_unloaded', 'explicit_reset']);
      const misses = Number(msg.consecutiveMisses || 0);
      const stored = await getStoredContexts();
      const currentContext = stored.current_context;
      const currentChannel = stored.current_channel || currentContext?.channel || null;
      const requestedChannel = msg.channel || null;
      const effectiveChannel = requestedChannel || currentChannel;
      const lastKnownForChannel = effectiveChannel ? stored[getLastKnownContextKey(effectiveChannel)] : null;

      if (!allowedReasons.has(reason)) {
        console.log('[Zazi BG] Blocked context clear request (invalid reason):', reason);
        return { success: false, blocked: true };
      }

      if (reason === 'confirmed_no_active_chat' && misses < MIN_CLEAR_MISSES) {
        console.log('[Zazi BG] Blocked context clear request (insufficient misses):', misses);
        return { success: false, blocked: true };
      }

      // Don't let a non-active channel clear the active channel's context
      if (effectiveChannel && currentChannel && effectiveChannel !== currentChannel) {
        console.log('[Zazi BG] Blocked context clear from non-active channel', {
          requestedChannel: effectiveChannel,
          currentChannel,
          reason,
        });
        if (effectiveChannel) {
          await chrome.storage.local.set({
            [getLastKnownContextKey(effectiveChannel)]: null,
          });
        }
        return { success: true, ignored: true, reason: 'non_active_channel_clear_blocked' };
      }

      if (
        reason === 'confirmed_no_active_chat' &&
        lastKnownForChannel?.timestamp &&
        Date.now() - lastKnownForChannel.timestamp <= CLEAR_GRACE_MS
      ) {
        console.log('[Zazi BG] Parse miss ignored — clear blocked by sticky grace window');
        return { success: true, ignored: true, reason: 'clear_grace_window' };
      }

      console.log('[Zazi BG] State cleared intentionally:', reason, { channel: effectiveChannel });

      await chrome.storage.local.set({
        current_channel: null,
        current_context: {
          cleared: true,
          clearReason: reason,
          channel: effectiveChannel || null,
          timestamp: Date.now(),
        },
      });

      return { success: true, cleared: true };
    }

    case 'CHAT_CONTEXT_UPDATE': {
      const { channel, contactIdentifier, messages, contactInfo } = msg;
      const sourceTabId = sender?.tab?.id ?? null;

      if (!['whatsapp', 'gmail'].includes(channel)) {
        return { success: false, error: 'Unsupported channel' };
      }

      await SupabaseClient.init();

      const stored = await getStoredContexts();
      const currentChannel = stored.current_channel || stored.current_context?.channel || null;
      const currentContext = stored.current_context || null;
      const channelLastKnownKey = getLastKnownContextKey(channel);
      const existingChannelContext = stored[channelLastKnownKey] || null;

      if (!isStrongContextPayload({ channel, contactIdentifier, contactInfo, messages })) {
        if (existingChannelContext?.conversationKey || (currentChannel === channel && currentContext?.conversationKey)) {
          console.log('[Zazi BG] Null/empty update blocked', { channel, reason: 'weak_payload_blocked' });
          return { success: true, ignored: true, reason: 'weak_payload_blocked' };
        }
        return { success: true, ignored: true, reason: 'weak_payload_no_state' };
      }

      // ---- Contact matching: phone/email → persistent mapping → name fallback ----
      let contact = null;
      let candidateMatches = [];
      const contactMappings = await getContactMappings();

      console.log('[Zazi BG] CRM search started', {
        channel,
        contactIdentifier,
        contactName: contactInfo?.name,
      });

      if (channel === 'whatsapp') {
        // Try phone first
        if (contactIdentifier) {
          const phoneDigits = contactIdentifier.replace(/[^0-9]/g, '');
          if (phoneDigits.length >= 7) {
            contact = await SupabaseClient.findContactByPhone(phoneDigits);
            if (contact) console.log('[Zazi BG] CRM matched by phone:', contact.full_name);
          }
        }

        // Try name-as-phone (when WhatsApp shows unsaved number as name)
        if (!contact && contactInfo?.name) {
          const nameDigits = contactInfo.name.replace(/[^0-9]/g, '');
          if (nameDigits.length >= 7) {
            contact = await SupabaseClient.findContactByPhone(nameDigits);
            if (contact) console.log('[Zazi BG] CRM matched by name-as-phone:', contact.full_name);
          }
        }

        // Try persistent mapping
        if (!contact) {
          const mapKeys = [
            `whatsapp:${(contactIdentifier || '').trim().toLowerCase()}`,
            `whatsapp:${(contactInfo?.name || '').trim().toLowerCase()}`,
            `whatsapp:${(contactInfo?.phone || '').trim().toLowerCase()}`,
          ].filter(k => k !== 'whatsapp:');

          for (const mapKey of mapKeys) {
            const mappedId = contactMappings[mapKey];
            if (mappedId) {
              const mapped = await SupabaseClient._query('contacts', `id=eq.${mappedId}&limit=1`);
              if (Array.isArray(mapped) && mapped.length > 0) {
                contact = mapped[0];
                console.log('[Zazi BG] CRM matched via persistent mapping:', mapKey, '→', contact.full_name);
                break;
              }
            }
          }
        }

        // Name fallback
        if (!contact && contactInfo?.name) {
          const nameResults = await SupabaseClient.findContactByName(contactInfo.name);
          if (nameResults.length === 1) {
            contact = nameResults[0];
            console.log('[Zazi BG] CRM matched by name:', contact.full_name);
          } else if (nameResults.length > 1) {
            candidateMatches = nameResults;
            console.log('[Zazi BG] CRM name search returned multiple matches:', nameResults.length);
          }
        }
      } else if (channel === 'gmail' && contactIdentifier) {
        contact = await SupabaseClient.findContactByEmail(contactIdentifier);
        if (contact) console.log('[Zazi BG] CRM matched by email:', contact.full_name);

        if (!contact) {
          const mapKey = `gmail:${contactIdentifier.trim().toLowerCase()}`;
          const mappedId = contactMappings[mapKey];
          if (mappedId) {
            const mapped = await SupabaseClient._query('contacts', `id=eq.${mappedId}&limit=1`);
            if (Array.isArray(mapped) && mapped.length > 0) {
              contact = mapped[0];
              console.log('[Zazi BG] CRM matched via persistent mapping:', mapKey);
            }
          }
        }

        if (!contact && contactInfo?.name) {
          const nameResults = await SupabaseClient.findContactByName(contactInfo.name);
          if (nameResults.length === 1) {
            contact = nameResults[0];
            console.log('[Zazi BG] CRM matched by name (Gmail):', contact.full_name);
          } else if (nameResults.length > 1) {
            candidateMatches = nameResults;
          }
        }
      }

      if (!contact && candidateMatches.length === 0) {
        console.log('[Zazi BG] CRM search: no match found', {
          channel,
          identifier: contactIdentifier,
          name: contactInfo?.name,
        });
      }

      // Save persistent mapping if contact found
      if (contact) {
        const mapKeys = [
          `${channel}:${(contactIdentifier || '').trim().toLowerCase()}`,
          `${channel}:${(contactInfo?.name || '').trim().toLowerCase()}`,
        ].filter(k => k !== `${channel}:`);

        for (const mapKey of mapKeys) {
          if (contactMappings[mapKey] !== contact.id) {
            await saveContactMapping(mapKey, contact.id);
          }
        }
      }

      // ---- Compute reply status ----
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

      // ---- Sync follow-up state ----
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

      // ---- Build context payload ----
      const conversationKey = getConversationKey({ channel, contactIdentifier, contactInfo, contact });
      const contextPayload = {
        channel,
        conversationKey,
        sourceTabId,
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
      };

      const tabIsActiveForChannel = await isSenderTabActiveForChannel(sourceTabId, channel);
      const shouldPromoteToCurrent =
        tabIsActiveForChannel ||
        currentChannel === channel ||
        !currentContext?.conversationKey ||
        currentContext?.cleared;

      const previousChannelContext = existingChannelContext;
      const updateType = previousChannelContext?.conversationKey === conversationKey ? 'refreshed' : 'detected';

      const storageUpdate = {
        [channelLastKnownKey]: contextPayload,
      };

      if (shouldPromoteToCurrent) {
        storageUpdate.current_channel = channel;
        storageUpdate.current_context = contextPayload;
      }

      await chrome.storage.local.set(storageUpdate);

      if (shouldPromoteToCurrent) {
        console.log(`[Zazi BG] Valid chat ${updateType}`, {
          channel,
          conversationKey,
          contactId: contact?.id || null,
          contactName: contact?.full_name || contactInfo?.name || null,
        });
      }

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

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const { current_context, current_channel } = await getStoredContexts();
    if (!current_context?.sourceTabId || current_context.sourceTabId !== tabId) return;

    await chrome.storage.local.set({
      current_channel: null,
      current_context: {
        cleared: true,
        clearReason: 'tab_unloaded',
        channel: current_context.channel || current_channel || null,
        timestamp: Date.now(),
      },
    });

    console.log('[Zazi BG] State cleared intentionally: tab_unloaded');
  } catch (err) {
    console.warn('[Zazi BG] Failed to clear context on tab close:', err);
  }
});
