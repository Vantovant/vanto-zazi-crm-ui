/**
 * Rule-based message suggestion engine.
 * Generates contextual follow-up message drafts based on CRM state + conversation context.
 */
const MessageSuggestions = {
  /**
   * @param {Object} params
   * @param {string} params.contactName
   * @param {string} params.objective - check-in, close, reorder, onboarding, reminder, activation, revival, objection-handling
   * @param {string} params.tone - warm, direct, professional
   * @param {string} params.channel - whatsapp, email
   * @param {string} params.leadType
   * @param {string} params.lastMessagePreview - last message in conversation
   * @param {boolean} params.hasPurchased
   * @returns {{ whatsapp: string, email: { subject: string, body: string } }}
   */
  generate(params) {
    const name = params.contactName?.split(' ')[0] || 'there';
    const templates = this._getTemplates(params.objective, params.tone);
    const wa = this._interpolate(templates.whatsapp, name, params);
    const em = {
      subject: this._interpolate(templates.email.subject, name, params),
      body: this._interpolate(templates.email.body, name, params),
    };
    return { whatsapp: wa, email: em };
  },

  _interpolate(template, firstName, params) {
    return template
      .replace(/\{name\}/g, firstName)
      .replace(/\{fullName\}/g, params.contactName || firstName)
      .replace(/\{product\}/g, params.lastProduct || 'our products');
  },

  _getTemplates(objective, tone) {
    const bank = {
      'check-in': {
        warm: {
          whatsapp: `Hi {name} 👋\n\nJust checking in to see how you're doing! Is there anything I can help you with?\n\nLooking forward to hearing from you 😊`,
          email: {
            subject: `Checking in, {name}`,
            body: `Hi {name},\n\nI hope you're doing well! I wanted to reach out and see how things are going on your end.\n\nIs there anything I can assist you with?\n\nWarm regards`,
          },
        },
        direct: {
          whatsapp: `Hi {name}\n\nFollowing up on our conversation. Would you like to continue from where we left off?\n\nLet me know a good time.`,
          email: {
            subject: `Following up — {name}`,
            body: `Hi {name},\n\nI'm following up on our previous conversation. I'd love to continue our discussion.\n\nPlease let me know a convenient time.\n\nBest regards`,
          },
        },
        professional: {
          whatsapp: `Good day {name}\n\nI hope this message finds you well. I'm reaching out to follow up on our recent interaction.\n\nPlease advise on next steps at your convenience.`,
          email: {
            subject: `Follow-up: {name}`,
            body: `Dear {name},\n\nI trust this email finds you well. I am writing to follow up on our recent discussion.\n\nKindly advise on the next steps at your earliest convenience.\n\nKind regards`,
          },
        },
      },
      'close': {
        warm: {
          whatsapp: `Hey {name} 🌟\n\nI'm excited to help you get started! Everything is ready for you.\n\nShall I walk you through the next steps?`,
          email: {
            subject: `Ready to get started, {name}?`,
            body: `Hi {name},\n\nGreat news — everything is set up and ready for you!\n\nWould you like me to walk you through the next steps?\n\nLooking forward to your response!`,
          },
        },
        direct: {
          whatsapp: `Hi {name}\n\nLet's get this finalized. Are you ready to proceed?\n\nI can have everything sorted for you today.`,
          email: {
            subject: `Let's finalize — {name}`,
            body: `Hi {name},\n\nI'd like to help you finalize your decision. Are you ready to proceed?\n\nI can arrange everything today.\n\nBest regards`,
          },
        },
        professional: {
          whatsapp: `Good day {name}\n\nFurther to our discussions, I'd like to assist you in finalizing your decision.\n\nPlease let me know how you'd like to proceed.`,
          email: {
            subject: `Decision follow-up — {name}`,
            body: `Dear {name},\n\nFurther to our recent discussions, I wanted to check if you're ready to move forward.\n\nPlease advise on how you'd like to proceed.\n\nKind regards`,
          },
        },
      },
      'reorder': {
        warm: {
          whatsapp: `Hi {name} 😊\n\nHow are you finding {product}? I hope you're seeing great results!\n\nWould you like to reorder or try something new?`,
          email: {
            subject: `Time for a reorder, {name}?`,
            body: `Hi {name},\n\nI hope you're enjoying {product}! It might be time for a reorder.\n\nWould you like me to help you with that?\n\nWarm regards`,
          },
        },
        direct: {
          whatsapp: `Hi {name}\n\nYour last order of {product} was a while ago. Ready for a refill?\n\nLet me know and I'll arrange it.`,
          email: {
            subject: `Reorder reminder — {name}`,
            body: `Hi {name},\n\nIt's been a while since your last order of {product}. Would you like to reorder?\n\nLet me know.\n\nBest regards`,
          },
        },
        professional: {
          whatsapp: `Good day {name}\n\nI trust your experience with {product} has been positive.\n\nShould you wish to place a reorder, I'm happy to assist.`,
          email: {
            subject: `Product reorder — {name}`,
            body: `Dear {name},\n\nI hope your experience with {product} has been satisfactory.\n\nShould you wish to place a reorder, please don't hesitate to let me know.\n\nKind regards`,
          },
        },
      },
      'reminder': {
        warm: {
          whatsapp: `Hey {name} 👋\n\nJust a friendly reminder about our conversation! I don't want you to miss out.\n\nAre you still interested?`,
          email: {
            subject: `Friendly reminder, {name}`,
            body: `Hi {name},\n\nJust a quick reminder about our recent discussion. I didn't want you to miss out!\n\nAre you still interested?\n\nWarm regards`,
          },
        },
        direct: {
          whatsapp: `Hi {name}\n\nFollowing up on my previous message. Let me know if you'd like to proceed.`,
          email: {
            subject: `Quick follow-up — {name}`,
            body: `Hi {name},\n\nFollowing up on my earlier message. Please let me know if you're interested in proceeding.\n\nBest regards`,
          },
        },
        professional: {
          whatsapp: `Good day {name}\n\nI am writing to follow up on my previous correspondence.\n\nKindly confirm your interest at your earliest convenience.`,
          email: {
            subject: `Follow-up correspondence — {name}`,
            body: `Dear {name},\n\nI am writing to follow up on my previous correspondence regarding our recent discussion.\n\nKindly confirm your interest at your earliest convenience.\n\nKind regards`,
          },
        },
      },
      'activation': {
        warm: {
          whatsapp: `Hi {name} 🎉\n\nCongratulations on getting registered! Let's get you activated and earning.\n\nWhen would be a good time for a quick call?`,
          email: {
            subject: `Let's activate your account, {name}!`,
            body: `Hi {name},\n\nCongratulations on completing your registration!\n\nThe next step is activation. When would be a good time for a quick onboarding session?\n\nExcited to help you get started!`,
          },
        },
        direct: {
          whatsapp: `Hi {name}\n\nYou're registered — great! Let's complete your activation.\n\nAre you available for a quick call this week?`,
          email: {
            subject: `Activation next step — {name}`,
            body: `Hi {name},\n\nYou've completed registration. Let's get you activated.\n\nWhen are you available for a brief onboarding?\n\nBest regards`,
          },
        },
        professional: {
          whatsapp: `Good day {name}\n\nI note your registration has been completed. I'd like to assist with your activation process.\n\nPlease advise a suitable time for a brief session.`,
          email: {
            subject: `Activation process — {name}`,
            body: `Dear {name},\n\nI note that your registration has been successfully completed.\n\nI'd like to assist you with the activation process. Please advise on a suitable time.\n\nKind regards`,
          },
        },
      },
      'revival': {
        warm: {
          whatsapp: `Hi {name} 👋\n\nIt's been a while! I was thinking about you and wanted to reconnect.\n\nA lot has happened — would you like to hear what's new?`,
          email: {
            subject: `We miss you, {name}!`,
            body: `Hi {name},\n\nIt's been a while since we connected! A lot of exciting things have happened.\n\nI'd love to share what's new. Are you open to reconnecting?\n\nWarm regards`,
          },
        },
        direct: {
          whatsapp: `Hi {name}\n\nIt's been some time. I have some updates that might interest you.\n\nWould you like a quick update?`,
          email: {
            subject: `Reconnecting — {name}`,
            body: `Hi {name},\n\nI wanted to reach out as it's been some time. I have updates that may interest you.\n\nWould you like to reconnect?\n\nBest regards`,
          },
        },
        professional: {
          whatsapp: `Good day {name}\n\nI trust you are well. I'm reaching out to reconnect regarding our business relationship.\n\nI have some developments I'd like to share.`,
          email: {
            subject: `Reconnection — {name}`,
            body: `Dear {name},\n\nI trust this finds you well. I am reaching out to reconnect regarding our business relationship.\n\nI have some recent developments that may be of interest.\n\nKind regards`,
          },
        },
      },
      'onboarding': {
        warm: {
          whatsapp: `Welcome {name}! 🎊\n\nSo glad to have you on board! Here's what happens next:\n\n1. I'll send you your starter info\n2. We'll schedule a quick orientation\n3. You'll be set up and ready!\n\nExcited for your journey!`,
          email: {
            subject: `Welcome aboard, {name}!`,
            body: `Hi {name},\n\nWelcome! I'm so glad you've joined us.\n\nHere's what happens next:\n1. Starter information pack\n2. Quick orientation session\n3. Full setup and activation\n\nLooking forward to working with you!\n\nWarm regards`,
          },
        },
        direct: {
          whatsapp: `Hi {name}\n\nWelcome! Let's get you set up.\n\nI'll send over everything you need shortly. When are you available for a quick orientation?`,
          email: {
            subject: `Getting started — {name}`,
            body: `Hi {name},\n\nWelcome aboard. Let's get you set up quickly.\n\nI'll send your starter pack shortly. When are you free for a brief orientation?\n\nBest regards`,
          },
        },
        professional: {
          whatsapp: `Good day {name}\n\nWelcome aboard. I'll be guiding your onboarding process.\n\nPlease advise a suitable time for your orientation session.`,
          email: {
            subject: `Onboarding — {name}`,
            body: `Dear {name},\n\nWelcome. I will be guiding your onboarding process.\n\nPlease advise on a suitable time for your orientation session.\n\nKind regards`,
          },
        },
      },
      'objection-handling': {
        warm: {
          whatsapp: `Hi {name} 😊\n\nI completely understand your concerns. Many people felt the same way initially.\n\nWould you be open to a quick chat? I'd love to address those questions and share some real results.`,
          email: {
            subject: `Addressing your concerns, {name}`,
            body: `Hi {name},\n\nThank you for sharing your thoughts. I completely understand your concerns — many others have felt the same way initially.\n\nI'd love the opportunity to address your questions. Would you be open to a brief chat?\n\nWarm regards`,
          },
        },
        direct: {
          whatsapp: `Hi {name}\n\nI hear your concerns. Let me share some facts that might change your perspective.\n\nCan we connect briefly?`,
          email: {
            subject: `Re: Your concerns — {name}`,
            body: `Hi {name},\n\nI appreciate your candor. I have some information that addresses your concerns directly.\n\nCould we schedule a brief call?\n\nBest regards`,
          },
        },
        professional: {
          whatsapp: `Good day {name}\n\nThank you for your feedback. I'd welcome the opportunity to address your specific concerns.\n\nMay I arrange a suitable time for discussion?`,
          email: {
            subject: `Response to your feedback — {name}`,
            body: `Dear {name},\n\nThank you for your valuable feedback. I'd welcome the opportunity to address your specific concerns in detail.\n\nMay I arrange a suitable time for discussion?\n\nKind regards`,
          },
        },
      },
    };

    const objectiveTemplates = bank[objective] || bank['check-in'];
    return objectiveTemplates[tone] || objectiveTemplates['warm'];
  },
};
