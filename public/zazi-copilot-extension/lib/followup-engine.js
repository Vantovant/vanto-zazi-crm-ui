/**
 * Follow-Up Intelligence Rules Engine
 * Evaluates contact + communication state and returns a recommended action.
 */
const FollowUpEngine = {
  /**
   * @param {Object} context
   * @param {string} context.replyStatus - 'awaiting_my_reply' | 'awaiting_their_reply' | 'replied_recently' | 'stale' | 'unknown'
   * @param {number|null} context.hoursSinceLastInbound - hours since their last message
   * @param {number|null} context.hoursSinceLastOutbound - hours since my last message
   * @param {string} context.leadTemperature - 'Hot' | 'Warm' | 'Cold'
   * @param {string} context.leadType - e.g. 'Prospect', 'Purchase_Status', 'Expired'
   * @param {string} context.registrationStatus - 'Not Registered' | 'Registered' | 'Activated'
   * @param {boolean} context.hasPurchased - whether contact has any orders
   * @param {number} context.followUpAttempts - number of outbound messages without reply
   * @param {string|null} context.lastReplyTone - 'positive' | 'negative' | 'neutral' | null
   */
  evaluate(context) {
    const t = CONFIG.FOLLOW_UP_THRESHOLDS;
    const result = {
      action: 'none',
      urgency: 'low', // low, medium, high, critical
      reason: '',
      suggestedTone: 'warm',
      suggestedObjective: 'check-in',
      badge: '',
      badgeColor: '',
    };

    // Case 1: They replied — I need to respond
    if (context.replyStatus === 'awaiting_my_reply') {
      result.action = 'reply_now';
      result.urgency = 'critical';
      result.reason = 'Contact has replied and is waiting for your response.';
      result.badge = '⚡ Reply Now';
      result.badgeColor = '#ef4444';

      if (context.lastReplyTone === 'positive') {
        result.suggestedObjective = 'close';
        result.suggestedTone = 'direct';
      } else if (context.lastReplyTone === 'negative') {
        result.suggestedObjective = 'objection-handling';
        result.suggestedTone = 'professional';
      } else {
        result.suggestedObjective = 'check-in';
        result.suggestedTone = 'warm';
      }
      return result;
    }

    // Case 2: I sent last message, waiting for their reply
    if (context.replyStatus === 'awaiting_their_reply') {
      const h = context.hoursSinceLastOutbound || 0;

      if (h < t.PROMPT_REPLY_HOURS) {
        result.action = 'wait';
        result.urgency = 'low';
        result.reason = 'Message sent recently. Give them time to respond.';
        result.badge = '⏳ Waiting';
        result.badgeColor = '#6b7280';
        return result;
      }

      if (h < t.GENTLE_FOLLOWUP_HOURS) {
        result.action = 'gentle_followup';
        result.urgency = 'medium';
        result.reason = `No reply in ${Math.round(h)}h. A gentle follow-up is recommended.`;
        result.badge = '🔔 Follow Up';
        result.badgeColor = '#f59e0b';
        result.suggestedObjective = 'reminder';
        result.suggestedTone = 'warm';
        return result;
      }

      if (h < t.STRONGER_CHECKIN_DAYS * 24) {
        result.action = 'stronger_checkin';
        result.urgency = 'high';
        result.reason = `No reply in ${Math.round(h / 24)} days. Send a stronger check-in.`;
        result.badge = '🔴 Check In';
        result.badgeColor = '#ef4444';
        result.suggestedObjective = 'check-in';
        result.suggestedTone = 'direct';
        return result;
      }

      // After multiple attempts with no reply
      if (context.followUpAttempts >= 3) {
        result.action = 'move_to_nurture';
        result.urgency = 'low';
        result.reason = `${context.followUpAttempts} follow-ups sent with no reply. Move to nurture/cold.`;
        result.badge = '❄️ Nurture';
        result.badgeColor = '#3b82f6';
        result.suggestedObjective = 'revival';
        return result;
      }

      if (h >= t.STALE_DAYS * 24) {
        result.action = 'escalate_to_call';
        result.urgency = 'high';
        result.reason = `Conversation stale for ${Math.round(h / 24)} days. Try a phone call.`;
        result.badge = '📞 Call';
        result.badgeColor = '#8b5cf6';
        result.suggestedObjective = 'check-in';
        result.suggestedTone = 'direct';
        return result;
      }
    }

    // Case 3: Recently replied
    if (context.replyStatus === 'replied_recently') {
      result.action = 'continue_conversation';
      result.urgency = 'medium';
      result.reason = 'Active conversation. Keep the momentum.';
      result.badge = '💬 Active';
      result.badgeColor = '#22c55e';

      if (context.hasPurchased) {
        result.suggestedObjective = 'reorder';
      } else if (context.registrationStatus === 'Activated') {
        result.suggestedObjective = 'activation';
      } else {
        result.suggestedObjective = 'close';
      }
      return result;
    }

    // Case 4: Expired / Inactive contacts
    if (context.leadType === 'Expired') {
      result.action = 'reactivation';
      result.urgency = 'low';
      result.reason = 'Contact is expired. Send a reactivation message.';
      result.badge = '🔄 Reactivate';
      result.badgeColor = '#f59e0b';
      result.suggestedObjective = 'revival';
      result.suggestedTone = 'warm';
      return result;
    }

    // Case 5: Purchased but no recent interaction
    if (context.hasPurchased && context.replyStatus === 'stale') {
      result.action = 'support_reorder';
      result.urgency = 'medium';
      result.reason = 'Existing customer with no recent interaction. Check in about reorder.';
      result.badge = '🛒 Reorder';
      result.badgeColor = '#10b981';
      result.suggestedObjective = 'reorder';
      result.suggestedTone = 'warm';
      return result;
    }

    // Default: stale or unknown
    if (context.replyStatus === 'stale' || context.replyStatus === 'unknown') {
      result.action = 'initial_outreach';
      result.urgency = 'low';
      result.reason = 'No recent communication. Initiate contact.';
      result.badge = '📨 Reach Out';
      result.badgeColor = '#6b7280';
      result.suggestedObjective = 'check-in';
      result.suggestedTone = 'warm';
    }

    return result;
  },

  /**
   * Determine reply status from message history.
   * @param {Object} params
   * @param {Date|null} params.lastInboundTime
   * @param {Date|null} params.lastOutboundTime
   * @returns {string}
   */
  computeReplyStatus({ lastInboundTime, lastOutboundTime }) {
    if (!lastInboundTime && !lastOutboundTime) return 'unknown';
    if (!lastOutboundTime && lastInboundTime) return 'awaiting_my_reply';
    if (!lastInboundTime && lastOutboundTime) return 'awaiting_their_reply';

    const inT = lastInboundTime.getTime();
    const outT = lastOutboundTime.getTime();
    const now = Date.now();
    const hoursSinceLast = (now - Math.max(inT, outT)) / (1000 * 60 * 60);

    if (inT > outT) {
      // Their message is newer — I need to reply
      if (hoursSinceLast < 24) return 'awaiting_my_reply';
      return 'awaiting_my_reply';
    }

    // My message is newer — waiting for their reply
    if (hoursSinceLast > CONFIG.FOLLOW_UP_THRESHOLDS.STALE_DAYS * 24) return 'stale';
    if (hoursSinceLast < 4) return 'replied_recently';
    return 'awaiting_their_reply';
  },

  /**
   * Count consecutive outbound messages without inbound reply.
   */
  countFollowUpAttempts(messages) {
    let count = 0;
    for (const msg of messages) {
      if (msg.direction === 'outbound') count++;
      else break;
    }
    return count;
  },
};
