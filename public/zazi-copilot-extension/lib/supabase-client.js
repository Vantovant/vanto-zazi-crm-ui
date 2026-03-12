/**
 * Lightweight Supabase REST client for Chrome extension (no npm).
 * Handles auth, contacts, activities, and orders queries.
 */
const SupabaseClient = {
  _token: null,
  _refreshToken: null,
  _userEmail: null,
  _userId: null,

  async init() {
    const data = await chrome.storage.local.get([
      'access_token', 'refresh_token', 'user_email', 'user_id'
    ]);
    this._token = data.access_token || null;
    this._refreshToken = data.refresh_token || null;
    this._userEmail = data.user_email || null;
    this._userId = data.user_id || null;
    return this.isAuthenticated();
  },

  isAuthenticated() {
    return Boolean(this._token);
  },

  async login(email, password) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CONFIG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.access_token) {
      this._token = data.access_token;
      this._refreshToken = data.refresh_token;
      this._userEmail = data.user?.email || email;
      this._userId = data.user?.id || null;
      await chrome.storage.local.set({
        access_token: this._token,
        refresh_token: this._refreshToken,
        user_email: this._userEmail,
        user_id: this._userId,
        remembered_email: email,
      });
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error_description || data.msg || 'Login failed' };
  },

  async logout() {
    this._token = null;
    this._refreshToken = null;
    this._userEmail = null;
    this._userId = null;
    await chrome.storage.local.remove(['access_token', 'refresh_token', 'user_email', 'user_id']);
  },

  async refreshSession() {
    if (!this._refreshToken) return false;
    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': CONFIG.SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: this._refreshToken }),
      });
      const data = await res.json();
      if (data.access_token) {
        this._token = data.access_token;
        this._refreshToken = data.refresh_token;
        await chrome.storage.local.set({
          access_token: this._token,
          refresh_token: this._refreshToken,
        });
        return true;
      }
    } catch (e) { console.error('Token refresh failed:', e); }
    return false;
  },

  _headers() {
    return {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${this._token}`,
    };
  },

  async _query(table, params = '') {
    const res = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/${table}?${params}`,
      { headers: this._headers() }
    );
    if (res.status === 401) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        const retry = await fetch(
          `${CONFIG.SUPABASE_URL}/rest/v1/${table}?${params}`,
          { headers: this._headers() }
        );
        return retry.json();
      }
    }
    return res.json();
  },

  async _insert(table, row) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this._headers(), 'Prefer': 'return=representation' },
      body: JSON.stringify(row),
    });
    return res.json();
  },

  async _update(table, id, updates) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...this._headers(), 'Prefer': 'return=representation' },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async _upsert(table, row, onConflict) {
    const headers = {
      ...this._headers(),
      'Prefer': 'return=representation,resolution=merge-duplicates',
    };
    const res = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`,
      { method: 'POST', headers, body: JSON.stringify(row) }
    );
    return res.json();
  },

  // ---- CRM Queries ----

  async findContactByPhone(phone) {
    const digits = phone.replace(/[^0-9]/g, '');
    if (!digits || digits.length < 7) return null;

    // Try exact normalized match first
    let data = await this._query('contacts', `phone_normalized=eq.${digits}&limit=1`);
    if (Array.isArray(data) && data.length > 0) return data[0];

    // Suffix match — last 9 digits
    const suffix = digits.slice(-9);
    if (suffix.length >= 7) {
      data = await this._query('contacts', `phone_normalized=like.*${suffix}&limit=3`);
      if (Array.isArray(data) && data.length >= 1) return data[0];
    }

    // Try raw phone_number field
    data = await this._query('contacts', `phone_number=like.*${suffix}&limit=3`);
    if (Array.isArray(data) && data.length >= 1) return data[0];

    return null;
  },

  async findContactByEmail(email) {
    const norm = email.trim().toLowerCase();
    if (!norm) return null;
    const data = await this._query('contacts', `email_normalized=eq.${encodeURIComponent(norm)}&limit=1`);
    if (Array.isArray(data) && data.length > 0) return data[0];

    const data2 = await this._query('contacts', `email_address=ilike.${encodeURIComponent(norm)}&limit=1`);
    if (Array.isArray(data2) && data2.length > 0) return data2[0];
    return null;
  },

  async findContactByName(name) {
    const norm = name.trim();
    if (!norm) return null;
    const data = await this._query('contacts', `full_name=ilike.${encodeURIComponent('%' + norm + '%')}&limit=5`);
    return Array.isArray(data) ? data : [];
  },

  async getContactActivities(contactId, limit = 20) {
    return this._query('contact_activities', `contact_id=eq.${contactId}&order=created_at.desc&limit=${limit}`);
  },

  async getContactOrders(contactId, limit = 10) {
    return this._query('orders', `contact_id=eq.${contactId}&order=order_date.desc&limit=${limit}`);
  },

  async logActivity(params) {
    return this._insert('contact_activities', {
      user_id: this._userId,
      contact_id: params.contact_id || null,
      activity_type: params.activity_type || 'note',
      summary: params.summary || '',
      notes: params.notes || '',
      next_action: params.next_action || '',
    });
  },

  async createContact(params) {
    const row = {
      user_id: this._userId,
      full_name: params.full_name || '',
      phone_number: params.phone_number || '',
      email_address: params.email_address || '',
      lead_type: params.lead_type || 'Prospect',
      lead_temperature: params.lead_temperature || 'Warm',
      communication_status: 'New',
      registration_status: 'Not Registered',
      interest_level: 'Medium',
      focus_area: 'Health Transformation',
      lead_path: 'Not sure yet',
      country: 'South Africa',
    };
    const result = await this._insert('contacts', row);
    if (Array.isArray(result) && result.length > 0) {
      return { success: true, contact: result[0] };
    }
    if (result?.id) {
      return { success: true, contact: result };
    }
    return { success: false, error: result?.message || result?.error || 'Creation failed' };
  },

  async updateContact(contactId, updates) {
    if (!contactId) return { success: false, error: 'No contact ID' };
    const result = await this._update('contacts', contactId, updates);
    if (Array.isArray(result) && result.length > 0) {
      return { success: true, contact: result[0] };
    }
    if (result?.id) {
      return { success: true, contact: result };
    }
    return { success: false, error: result?.message || result?.error || 'Update failed' };
  },

  async upsertFollowUpState(state) {
    return this._upsert('follow_up_states', {
      ...state,
      user_id: this._userId,
      updated_at: new Date().toISOString(),
    }, 'user_id,contact_id,channel');
  },

  async getFollowUpStates(contactId) {
    return this._query('follow_up_states', `contact_id=eq.${contactId}&order=updated_at.desc`);
  },

  // ---- AI Suggestion (calls zazi-copilot edge function) ----
  async callAISuggest(params) {
    const { contactData, messages, channel, tone, objective, leadType } = params;

    // Build a concise conversation excerpt
    const recentMessages = (messages || []).slice(-6).map(m =>
      `${m.direction === 'outbound' ? 'Me' : 'Them'}: ${(m.text || '').substring(0, 120)}`
    ).join('\n');

    const userMessage = `Generate a ${tone || 'warm'} ${channel || 'whatsapp'} follow-up message for this contact.

Contact: ${contactData?.full_name || 'Unknown'}
Lead Type: ${leadType || 'Prospect'}
Objective: ${objective || 'check-in'}
Channel: ${channel || 'whatsapp'}

Recent conversation:
${recentMessages || '(no messages)'}

${channel === 'whatsapp' ? 'Keep it short, conversational, max 3-4 sentences. Use appropriate emoji.' : 'Write a professional email body, 4-6 sentences.'}

Output ONLY the message text — no quotes, no labels, no markdown.`;

    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/zazi-copilot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${this._token}`,
      },
      body: JSON.stringify({
        action: 'suggest_message',
        message: userMessage,
        contactData: contactData || {},
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI request failed (${res.status}): ${errText}`);
    }

    // Parse SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) fullText += content;
        } catch { /* partial chunk */ }
      }
    }

    return { success: true, text: fullText.trim() };
  },
};
