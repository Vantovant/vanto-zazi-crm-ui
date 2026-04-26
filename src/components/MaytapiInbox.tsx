import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Inbox, Link2, Loader2,
  MessageSquare, ShieldCheck, Search, Ban, ArrowLeft,
  MailOpen, Mail, X,
} from 'lucide-react';

// H3: Generic preview always rendered for unmatched rows — never raw body.
const UNMATCHED_GENERIC_PREVIEW = 'Message received from unknown number.';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MaytapiAuditPanel } from './MaytapiAuditPanel';

/**
 * MAYTAPI INBOX — H4 (operational hardening; still read-only for messages)
 *
 * H1/H2/H2A/H3/H3A locks remain intact. H4 only adds:
 *  - read/unread state on inbound messages (via RPC)
 *  - conversation search (matched CRM only — never exposes unknown bodies/phones)
 *  - safe gate audit visibility (handled server-side via trigger)
 *  - mobile polish + improved empty/health states
 *
 * Still locked:
 *  - No reply box, no AI suggestion, no auto-reply, no Send All, no cron, no
 *    production-mode flip.
 *  - All sends still flow through `maytapi-send-1to1` unchanged.
 *  - No writes to `prospector_send_log`, `zazi_actions`, `contact_activities`,
 *    `contacts.lead_type`, `contacts.leg`, `parent_contact_id`, or `tree_depth`.
 *  - Unknown numbers stay masked (••••XXXX) and gated.
 */

type MsgRow = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string | null;
  body_preview: string | null;
  received_at: string;
  status: string;
  contact_id: string | null;
  conversation_key: string;
  phone_e164: string | null;
  phone_last4: string | null;
  media_type: string | null;
  zazi_action_id: string | null;
  read_at: string | null;
};

type ConvSummary = {
  conversation_key: string;
  contact_id: string | null;
  contact_name: string | null;
  phone_last4: string | null;
  last_preview: string | null;
  last_at: string;
  last_direction: 'inbound' | 'outbound';
  unread_count: number;
};

type UnmatchedRow = {
  id: string;
  phone_hash: string;
  phone_last4: string;
  message_count: number;
  last_body_preview: string | null;
  last_seen_at: string;
  status: string;
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function MaytapiInbox() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'inbox' | 'unmatched' | 'audit'>('inbox');

  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hasInbound, setHasInbound] = useState(false);

  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([]);
  const [loadingUn, setLoadingUn] = useState(false);

  const [linkFor, setLinkFor] = useState<UnmatchedRow | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<Array<{ id: string; full_name: string; phone_number: string }>>([]);
  const [linking, setLinking] = useState(false);
  const [pendingLinkContact, setPendingLinkContact] = useState<{ id: string; full_name: string; phone_number: string } | null>(null);

  // H3: Ignore action + status filter
  const [ignoreFor, setIgnoreFor] = useState<UnmatchedRow | null>(null);
  const [ignoring, setIgnoring] = useState(false);
  const [unmatchedFilter, setUnmatchedFilter] = useState<'open' | 'linked' | 'ignored'>('open');

  // H4: Conversation search (matched CRM only)
  const [convSearch, setConvSearch] = useState('');
  const [markingUnread, setMarkingUnread] = useState(false);

  // Admin check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { if (!cancelled) setIsAdmin(false); return; }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load messages
  const loadMessages = async () => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('maytapi_messages' as any)
      .select('id,direction,body,body_preview,received_at,status,contact_id,conversation_key,phone_e164,phone_last4,media_type,zazi_action_id,read_at')
      .order('received_at', { ascending: false })
      .limit(500);
    const rows = (data ?? []) as unknown as MsgRow[];
    setMessages(rows);
    setHasInbound(rows.some(r => r.direction === 'inbound'));

    const ids = Array.from(new Set(rows.map(r => r.contact_id).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: cs } = await supabase
        .from('contacts')
        .select('id,full_name')
        .in('id', ids);
      const map: Record<string, string> = {};
      (cs ?? []).forEach((c: any) => { map[c.id] = c.full_name; });
      setContactNames(map);
    } else {
      setContactNames({});
    }
    setLoadingMsgs(false);
  };

  const loadUnmatched = async () => {
    setLoadingUn(true);
    const { data } = await supabase
      .from('maytapi_inbound_unmatched' as any)
      .select('id,phone_hash,phone_last4,message_count,last_body_preview,last_seen_at,status')
      .eq('status', unmatchedFilter)
      .order('last_seen_at', { ascending: false })
      .limit(200);
    setUnmatched((data ?? []) as unknown as UnmatchedRow[]);
    setLoadingUn(false);
  };

  useEffect(() => {
    if (isAdmin) { loadMessages(); loadUnmatched(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, unmatchedFilter]);

  // Realtime refresh
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel('maytapi-inbox-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maytapi_messages' }, () => loadMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maytapi_inbound_unmatched' }, () => loadUnmatched())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  // Conversation summaries (latest per key) + unread counts
  const conversations = useMemo<ConvSummary[]>(() => {
    const seen = new Map<string, ConvSummary>();
    const unreadByKey = new Map<string, number>();
    for (const m of messages) {
      if (m.direction === 'inbound' && !m.read_at) {
        unreadByKey.set(m.conversation_key, (unreadByKey.get(m.conversation_key) ?? 0) + 1);
      }
      if (seen.has(m.conversation_key)) continue;
      seen.set(m.conversation_key, {
        conversation_key: m.conversation_key,
        contact_id: m.contact_id,
        contact_name: m.contact_id ? (contactNames[m.contact_id] ?? null) : null,
        phone_last4: m.phone_last4,
        last_preview: m.body_preview,
        last_at: m.received_at,
        last_direction: m.direction,
        unread_count: 0,
      });
    }
    for (const [k, n] of unreadByKey) {
      const c = seen.get(k);
      if (c) c.unread_count = n;
    }
    return Array.from(seen.values());
  }, [messages, contactNames]);

  // H4: Filter conversations by search query (matched CRM bodies + names + last4).
  // Unknown / unmatched numbers are NOT in this list (they live in the gate),
  // so search cannot expose unknown bodies or raw phones.
  const filteredConversations = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return conversations;
    const matchingKeys = new Set<string>();
    for (const m of messages) {
      if (!m.contact_id) continue; // Only matched CRM threads are searchable.
      const hay = `${m.body ?? ''} ${m.body_preview ?? ''}`.toLowerCase();
      if (hay.includes(q)) matchingKeys.add(m.conversation_key);
    }
    return conversations.filter(c => {
      if (!c.contact_id) return false; // never expose unmatched here
      if ((c.contact_name ?? '').toLowerCase().includes(q)) return true;
      if ((c.phone_last4 ?? '').includes(q)) return true;
      if (matchingKeys.has(c.conversation_key)) return true;
      return false;
    });
  }, [conversations, messages, convSearch]);

  const totalUnread = useMemo(
    () => conversations.reduce((n, c) => n + c.unread_count, 0),
    [conversations],
  );

  const threadMessages = useMemo(() => {
    if (!selectedKey) return [];
    return messages
      .filter(m => m.conversation_key === selectedKey)
      .slice()
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
  }, [messages, selectedKey]);

  // H4: Mark inbound messages read when a thread is opened.
  useEffect(() => {
    if (!selectedKey || !isAdmin) return;
    const hasUnread = messages.some(
      m => m.conversation_key === selectedKey && m.direction === 'inbound' && !m.read_at,
    );
    if (!hasUnread) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase.rpc('mark_maytapi_thread_read' as any, {
        p_conversation_key: selectedKey,
      });
      if (!cancelled && !error) loadMessages();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, isAdmin]);

  const markCurrentUnread = async () => {
    if (!selectedKey) return;
    setMarkingUnread(true);
    const { error } = await supabase.rpc('mark_maytapi_thread_unread' as any, {
      p_conversation_key: selectedKey,
    });
    setMarkingUnread(false);
    if (error) { alert(`Mark unread failed: ${error.message}`); return; }
    loadMessages();
  };

  // Contact search for unmatched linking
  useEffect(() => {
    if (!linkFor) return;
    const q = linkSearch.trim();
    if (!q) { setLinkResults([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id,full_name,phone_number')
        .or(`full_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
        .limit(10);
      if (!cancelled) setLinkResults((data ?? []) as any);
    })();
    return () => { cancelled = true; };
  }, [linkFor, linkSearch]);

  const confirmLinkContact = async () => {
    if (!linkFor || !user || !pendingLinkContact) return;
    setLinking(true);
    const { error } = await supabase
      .from('maytapi_inbound_unmatched' as any)
      .update({
        status: 'linked',
        linked_contact_id: pendingLinkContact.id,
        linked_at: new Date().toISOString(),
        linked_by: user.id,
      })
      .eq('id', linkFor.id);
    setLinking(false);
    if (error) {
      alert(`Link failed: ${error.message}`);
      return;
    }
    setLinkFor(null);
    setPendingLinkContact(null);
    setLinkSearch('');
    setLinkResults([]);
    loadUnmatched();
    loadMessages();
  };

  const confirmIgnore = async () => {
    if (!ignoreFor) return;
    setIgnoring(true);
    const { error } = await supabase
      .from('maytapi_inbound_unmatched' as any)
      .update({ status: 'ignored' })
      .eq('id', ignoreFor.id);
    setIgnoring(false);
    if (error) {
      alert(`Ignore failed: ${error.message}`);
      return;
    }
    setIgnoreFor(null);
    loadUnmatched();
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-sm">
        Maytapi Inbox is admin-only.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-slate-700 bg-slate-800/30">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-100">Maytapi Inbox</h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Maytapi</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide bg-slate-700 text-slate-300 border border-slate-600">Admin only</span>
                {totalUnread > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/20 text-blue-200 border border-blue-500/30">
                    {totalUnread} unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">Conversation history for Vanto's WhatsApp number</p>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">Separate from Twilio / shared inbox</div>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap gap-1 mt-3">
          <button
            onClick={() => setTab('inbox')}
            className={`px-3 py-1.5 text-xs rounded-md border ${tab === 'inbox' ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
            Conversations {messages.length > 0 && <span className="ml-1 text-[10px] opacity-70">({conversations.length})</span>}
          </button>
          <button
            onClick={() => setTab('unmatched')}
            className={`px-3 py-1.5 text-xs rounded-md border ${tab === 'unmatched' ? 'bg-amber-600/20 border-amber-500/40 text-amber-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
            Unmatched {unmatched.length > 0 && <span className="ml-1 text-[10px] opacity-70">({unmatched.length})</span>}
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-3 py-1.5 text-xs rounded-md border ${tab === 'audit' ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
            title="Read-only audit of link/ignore/read actions"
          >
            Audit
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div className={`mx-4 mt-3 px-3 py-2 rounded-lg border flex items-start gap-2 ${hasInbound ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
        {hasInbound ? <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />}
        <div className={`text-xs ${hasInbound ? 'text-emerald-200' : 'text-amber-200'}`}>
          <span className="font-medium">
            {hasInbound ? 'Webhook connected.' : 'Webhook connected, awaiting messages.'}
          </span>{' '}
          <span className="opacity-80">
            Read-only viewer. Reply box, AI suggestions, auto-reply and Send All are intentionally disabled.
            Sends continue via <code className="px-1 rounded bg-black/20">maytapi-send-1to1</code>.
          </span>
        </div>
      </div>

      {/* Body */}
      {tab === 'inbox' ? (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 mt-3 mx-2 sm:mx-4 mb-4 rounded-lg border border-slate-700/70 overflow-hidden">
          {/* Conversation list */}
          <aside className={`${selectedKey ? 'hidden md:flex' : 'flex'} w-full md:w-80 md:border-r border-slate-700/70 bg-slate-800/40 flex-col min-w-0`}>
            <div className="px-3 pt-2 pb-3 border-b border-slate-700/70 flex flex-col gap-2 sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium flex items-center justify-between">
                <span>Conversations</span>
                {loadingMsgs && <Loader2 className="w-3 h-3 animate-spin" />}
              </div>
              {/* H4: Conversation search — matched CRM only (never exposes unknown bodies/phones) */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={convSearch}
                  onChange={e => setConvSearch(e.target.value)}
                  placeholder="Search name, message, last4…"
                  aria-label="Search conversations"
                  className="w-full pl-9 pr-8 py-2 text-sm bg-slate-950 border border-slate-600 rounded-md text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
                />
                {convSearch && (
                  <button
                    type="button"
                    onClick={() => setConvSearch('')}
                    className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-100"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center h-full">
                  <Inbox className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-300">No matched conversations</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    They will appear here as inbound messages arrive.
                  </p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center h-full">
                  <Search className="w-7 h-7 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-300">Search returned no results</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Try a different name, last 4 digits, or message text.
                  </p>
                </div>
              ) : (
                filteredConversations.map(c => (
                  <button
                    key={c.conversation_key}
                    onClick={() => setSelectedKey(c.conversation_key)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-700/50 hover:bg-slate-700/30 transition ${selectedKey === c.conversation_key ? 'bg-slate-700/40' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${c.unread_count > 0 ? 'font-semibold text-white' : 'font-medium text-slate-100'}`}>
                        {c.contact_name ?? `••••${c.phone_last4 ?? ''}`}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.unread_count > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-semibold flex items-center justify-center">
                            {c.unread_count}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">{relTime(c.last_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] uppercase tracking-wide ${c.last_direction === 'inbound' ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {c.last_direction === 'inbound' ? '← in' : '→ out'}
                      </span>
                      <span className={`text-xs truncate ${c.unread_count > 0 ? 'text-slate-200' : 'text-slate-400'}`}>
                        {c.last_preview ?? '(no preview)'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
            {totalUnread === 0 && conversations.length > 0 && !convSearch && (
              <div className="px-3 py-1.5 border-t border-slate-700/70 text-[10px] text-slate-500 text-center">
                No unread messages
              </div>
            )}
          </aside>

          {/* Thread viewer — hidden on mobile until a conversation is selected */}
          <section className={`${selectedKey ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-slate-900/30 min-w-0`}>
            {!selectedKey ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-6">
                  <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Select a conversation to view messages</p>
                  <p className="text-[11px] text-slate-600 mt-1">Read-only viewer.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-3 py-2 border-b border-slate-700/70 bg-slate-800/40 text-xs text-slate-300 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedKey(null)}
                      className="md:hidden flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-[11px] shrink-0"
                      aria-label="Back to conversations"
                    >
                      <ArrowLeft className="w-3 h-3" /> Back
                    </button>
                    <span className="truncate">
                      {(() => {
                        const c = conversations.find(x => x.conversation_key === selectedKey);
                        return c?.contact_name ?? `••••${c?.phone_last4 ?? ''}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={markCurrentUnread}
                      disabled={markingUnread}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-[11px] disabled:opacity-50"
                      title="Mark conversation unread"
                    >
                      {markingUnread
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Mail className="w-3 h-3" />}
                      <span className="hidden sm:inline">Mark unread</span>
                    </button>
                    <span className="text-[10px] text-slate-500">{threadMessages.length} msg{threadMessages.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {threadMessages.map(m => (
                    <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] sm:max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.direction === 'outbound' ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100' : 'bg-slate-700/50 border border-slate-600/50 text-slate-100'}`}>
                        {m.body ? (
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        ) : (
                          <p className="italic text-slate-400 text-xs">{m.media_type ? `[${m.media_type}]` : '(no body)'}</p>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                          <span>{new Date(m.received_at).toLocaleString()}</span>
                          {m.direction === 'outbound' && m.zazi_action_id && (
                            <span className="px-1 rounded bg-blue-500/20 text-blue-300">Zazi</span>
                          )}
                          {m.direction === 'inbound' && m.read_at && (
                            <span className="px-1 rounded bg-slate-600/40 text-slate-300 inline-flex items-center gap-0.5">
                              <MailOpen className="w-2.5 h-2.5" /> read
                            </span>
                          )}
                          <span className="opacity-60">{m.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      ) : tab === 'unmatched' ? (
        // Unmatched tab
        <div className="flex-1 flex flex-col mt-3 mx-2 sm:mx-4 mb-4 rounded-lg border border-slate-700/70 overflow-hidden bg-slate-800/30">
          <div className="px-3 py-2 border-b border-slate-700/70 text-[11px] uppercase tracking-wide text-slate-500 font-medium flex items-center justify-between gap-3 flex-wrap">
            <span>Unmatched inbound numbers</span>
            <div className="flex items-center gap-1 flex-wrap">
              {(['open', 'linked', 'ignored'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setUnmatchedFilter(s)}
                  className={`px-2 py-0.5 text-[10px] rounded border ${unmatchedFilter === s
                    ? 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
              {loadingUn && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {unmatched.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mb-2" />
                <p className="text-sm text-slate-300">No {unmatchedFilter} unmatched numbers</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Inbound from unknown phones will appear here as <span className="font-mono">••••XXXX</span>.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-700/50">
                {unmatched.map(u => (
                  <li key={u.id} className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 hover:bg-slate-700/20">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-slate-100">••••{u.phone_last4}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{u.message_count} msg{u.message_count === 1 ? '' : 's'}</span>
                        <span className="text-[10px] text-slate-500">{relTime(u.last_seen_at)}</span>
                        {u.status !== 'open' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${u.status === 'linked'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                            {u.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 italic truncate">
                        {UNMATCHED_GENERIC_PREVIEW}
                      </p>
                    </div>
                    {u.status === 'open' && (
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          onClick={() => setLinkFor(u)}
                          className="px-3 py-1.5 text-xs rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30 flex items-center gap-1.5"
                        >
                          <Link2 className="w-3 h-3" /> Link to contact
                        </button>
                        <button
                          onClick={() => setIgnoreFor(u)}
                          className="px-3 py-1.5 text-xs rounded-md bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 flex items-center gap-1.5"
                        >
                          <Ban className="w-3 h-3" /> Ignore
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Link-to-contact modal (search → confirm) */}
      {linkFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !linking && (setLinkFor(null), setPendingLinkContact(null))}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-100 mb-1">Link unmatched number</h3>
            <p className="text-xs text-slate-400 mb-3">
              <span className="font-mono">••••{linkFor.phone_last4}</span> · {linkFor.message_count} message(s)
            </p>

            {!pendingLinkContact ? (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    autoFocus
                    value={linkSearch}
                    onChange={e => setLinkSearch(e.target.value)}
                    placeholder="Search existing CRM contacts by name or phone…"
                    className="w-full pl-8 pr-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto">
                  {linkResults.length === 0 && linkSearch && (
                    <p className="text-xs text-slate-500 px-1 py-3">No matches.</p>
                  )}
                  {linkResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setPendingLinkContact(r)}
                      className="w-full text-left px-2 py-2 rounded-md hover:bg-slate-700/50"
                    >
                      <div className="text-sm text-slate-100">{r.full_name}</div>
                      <div className="text-xs text-slate-400">{r.phone_number}</div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setLinkFor(null)}
                    className="px-3 py-1.5 text-xs rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600"
                  >Cancel</button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  No new contact will be created. No old unknown history will be backfilled.
                  Future messages from this number will attach to the linked contact.
                </p>
              </>
            ) : (
              <>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 mb-3">
                  <p className="text-xs text-slate-300 mb-1">Link <span className="font-mono">••••{linkFor.phone_last4}</span> to:</p>
                  <p className="text-sm font-medium text-slate-100">{pendingLinkContact.full_name}</p>
                  <p className="text-xs text-slate-400">{pendingLinkContact.phone_number}</p>
                </div>
                <ul className="text-[11px] text-slate-400 space-y-1 mb-3 list-disc pl-4">
                  <li>No new contact created.</li>
                  <li>No <code>lead_type</code>, <code>leg</code>, <code>tree_depth</code> writes.</li>
                  <li>No backfill of old unknown messages.</li>
                  <li>Future inbound from this number will attach to this contact.</li>
                </ul>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPendingLinkContact(null)}
                    disabled={linking}
                    className="px-3 py-1.5 text-xs rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                  >Back</button>
                  <button
                    onClick={confirmLinkContact}
                    disabled={linking}
                    className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {linking && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirm link
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Ignore confirmation modal */}
      {ignoreFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !ignoring && setIgnoreFor(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-100 mb-1">Ignore unknown number</h3>
            <p className="text-xs text-slate-400 mb-3">
              <span className="font-mono">••••{ignoreFor.phone_last4}</span> · {ignoreFor.message_count} message(s)
            </p>
            <ul className="text-[11px] text-slate-400 space-y-1 mb-3 list-disc pl-4">
              <li>This number will be hidden from the open Unmatched list.</li>
              <li>No CRM contact will be created.</li>
              <li>No reply, no AI, no auto-anything.</li>
              <li>Reversible by changing the filter to "Ignored".</li>
            </ul>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIgnoreFor(null)}
                disabled={ignoring}
                className="px-3 py-1.5 text-xs rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
              >Cancel</button>
              <button
                onClick={confirmIgnore}
                disabled={ignoring}
                className="px-3 py-1.5 text-xs rounded-md bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 flex items-center gap-1.5"
              >
                {ignoring && <Loader2 className="w-3 h-3 animate-spin" />}
                Confirm ignore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
