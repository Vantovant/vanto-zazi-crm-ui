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
        remembered_email: email, // Remember for prefill
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
    // Keep remembered_email for prefill
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
    console.log('[Supabase] Phone lookup (exact):', digits);
    let data = await this._query('contacts', `phone_normalized=eq.${digits}&limit=1`);
    if (Array.isArray(data) && data.length > 0) {
      console.log('[Supabase] Phone matched (exact):', data[0].full_name);
      return data[0];
    }

    // Try suffix match — last 9 digits (handles country code differences)
    const suffix = digits.slice(-9);
    if (suffix.length >= 7) {
      console.log('[Supabase] Phone lookup (suffix):', suffix);
      data = await this._query('contacts', `phone_normalized=like.*${suffix}&limit=3`);
      if (Array.isArray(data) && data.length === 1) {
        console.log('[Supabase] Phone matched (suffix):', data[0].full_name);
        return data[0];
      }
      if (Array.isArray(data) && data.length > 1) {
        console.log('[Supabase] Phone suffix matched multiple:', data.length);
        // Return first — caller can handle ambiguity
        return data[0];
      }
    }

    // Try raw phone_number field as well (unnormalized)
    data = await this._query('contacts', `phone_number=like.*${suffix}&limit=3`);
    if (Array.isArray(data) && data.length === 1) {
      console.log('[Supabase] Phone matched (raw field suffix):', data[0].full_name);
      return data[0];
    }

    console.log('[Supabase] Phone lookup: no match for', digits);
    return null;
  },

  async findContactByEmail(email) {
    const norm = email.trim().toLowerCase();
    if (!norm) return null;
    console.log('[Supabase] Email lookup:', norm);
    const data = await this._query('contacts', `email_normalized=eq.${encodeURIComponent(norm)}&limit=1`);
    if (Array.isArray(data) && data.length > 0) {
      console.log('[Supabase] Email matched:', data[0].full_name);
      return data[0];
    }
    // Also try raw email_address
    const data2 = await this._query('contacts', `email_address=ilike.${encodeURIComponent(norm)}&limit=1`);
    if (Array.isArray(data2) && data2.length > 0) {
      console.log('[Supabase] Email matched (raw field):', data2[0].full_name);
      return data2[0];
    }
    console.log('[Supabase] Email lookup: no match for', norm);
    return null;
  },

  async findContactByName(name) {
    const norm = name.trim();
    if (!norm) return null;
    console.log('[Supabase] Name lookup:', norm);
    const data = await this._query('contacts', `full_name=ilike.${encodeURIComponent('%' + norm + '%')}&limit=5`);
    console.log('[Supabase] Name lookup results:', Array.isArray(data) ? data.length : 0);
    return Array.isArray(data) ? data : [];
  },

  async getContactActivities(contactId, limit = 20) {
    return this._query(
      'contact_activities',
      `contact_id=eq.${contactId}&order=created_at.desc&limit=${limit}`
    );
  },

  async getContactOrders(contactId, limit = 10) {
    return this._query(
      'orders',
      `contact_id=eq.${contactId}&order=order_date.desc&limit=${limit}`
    );
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
    console.log('[Supabase] Creating contact:', params.full_name);
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
      console.log('[Supabase] Contact created:', result[0].id, result[0].full_name);
      return { success: true, contact: result[0] };
    }
    if (result?.id) {
      console.log('[Supabase] Contact created:', result.id);
      return { success: true, contact: result };
    }
    console.error('[Supabase] Contact creation failed:', result);
    return { success: false, error: result?.message || result?.error || 'Creation failed' };
  },

  async upsertFollowUpState(state) {
    return this._upsert('follow_up_states', {
      ...state,
      user_id: this._userId,
      updated_at: new Date().toISOString(),
    }, 'user_id,contact_id,channel');
  },

  async getFollowUpStates(contactId) {
    return this._query(
      'follow_up_states',
      `contact_id=eq.${contactId}&order=updated_at.desc`
    );
  },
};
