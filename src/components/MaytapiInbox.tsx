import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Inbox, Link2, Loader2,
  MessageSquare, ShieldCheck, Search, Ban,
} from 'lucide-react';

// H3: Generic preview always rendered for unmatched rows — never raw body.
const UNMATCHED_GENERIC_PREVIEW = 'Message received from unknown number.';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * MAYTAPI INBOX — H2 (read-only viewer + unmatched review queue, admin-only)
 *
 * Renders inbound + outbound message history for Vanto's Maytapi number from
 * `maytapi_messages` (admin-only RLS) and the unmatched review queue from
 * `maytapi_inbound_unmatched`.
 *
 * Locked behaviour preserved:
 *  - No reply box, no AI suggestion, no auto-reply, no Send All, no cron, no
 *    production-mode flip.
 *  - All sends still flow through `maytapi-send-1to1` unchanged.
 *  - No writes to `prospector_send_log`, `zazi_actions`, `contact_activities`,
 *    `contacts.lead_type`, `contacts.leg`, `parent_contact_id`, or `tree_depth`.
 *  - Body text is rendered ONLY inside this viewer; never exported to audit
 *    panels, dashboards, or telemetry.
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
};

type ConvSummary = {
  conversation_key: string;
  contact_id: string | null;
  contact_name: string | null;
  phone_last4: string | null;
  last_preview: string | null;
  last_at: string;
  last_direction: 'inbound' | 'outbound';
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
  const [tab, setTab] = useState<'inbox' | 'unmatched'>('inbox');

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
      .select('id,direction,body,body_preview,received_at,status,contact_id,conversation_key,phone_e164,phone_last4,media_type,zazi_action_id')
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
      .eq('status', 'open')
      .order('last_seen_at', { ascending: false })
      .limit(200);
    setUnmatched((data ?? []) as unknown as UnmatchedRow[]);
    setLoadingUn(false);
  };

  useEffect(() => {
    if (isAdmin) { loadMessages(); loadUnmatched(); }
  }, [isAdmin]);

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

  // Conversation summaries (latest per key)
  const conversations = useMemo<ConvSummary[]>(() => {
    const seen = new Map<string, ConvSummary>();
    for (const m of messages) {
      if (seen.has(m.conversation_key)) continue;
      seen.set(m.conversation_key, {
        conversation_key: m.conversation_key,
        contact_id: m.contact_id,
        contact_name: m.contact_id ? (contactNames[m.contact_id] ?? null) : null,
        phone_last4: m.phone_last4,
        last_preview: m.body_preview,
        last_at: m.received_at,
        last_direction: m.direction,
      });
    }
    return Array.from(seen.values());
  }, [messages, contactNames]);

  const threadMessages = useMemo(() => {
    if (!selectedKey) return [];
    return messages
      .filter(m => m.conversation_key === selectedKey)
      .slice()
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
  }, [messages, selectedKey]);

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

  const linkContact = async (contactId: string) => {
    if (!linkFor || !user) return;
    setLinking(true);
    await supabase
      .from('maytapi_inbound_unmatched' as any)
      .update({
        status: 'linked',
        linked_contact_id: contactId,
        linked_at: new Date().toISOString(),
        linked_by: user.id,
      })
      .eq('id', linkFor.id);
    setLinking(false);
    setLinkFor(null);
    setLinkSearch('');
    setLinkResults([]);
    loadUnmatched();
    loadMessages();
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
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">Conversation history for Vanto's WhatsApp number</p>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">Separate from Twilio / shared inbox</div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mt-3">
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
        </div>
      </div>

      {/* Status banner */}
      <div className={`mx-4 mt-3 px-3 py-2 rounded-lg border flex items-start gap-2 ${hasInbound ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
        {hasInbound ? <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />}
        <div className={`text-xs ${hasInbound ? 'text-emerald-200' : 'text-amber-200'}`}>
          <span className="font-medium">
            {hasInbound ? 'Inbound connected (test).' : 'Awaiting first inbound message — webhook deployed, no traffic yet.'}
          </span>{' '}
          <span className="opacity-80">
            Read-only viewer. Reply box, AI suggestions, auto-reply and Send All are intentionally disabled.
            Sends continue via <code className="px-1 rounded bg-black/20">maytapi-send-1to1</code>.
          </span>
        </div>
      </div>

      {/* Body */}
      {tab === 'inbox' ? (
        <div className="flex-1 flex min-h-0 mt-3 mx-4 mb-4 rounded-lg border border-slate-700/70 overflow-hidden">
          {/* Conversation list */}
          <aside className="w-72 border-r border-slate-700/70 bg-slate-800/40 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-700/70 text-[11px] uppercase tracking-wide text-slate-500 font-medium flex items-center justify-between">
              <span>Conversations</span>
              {loadingMsgs && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center h-full">
                  <Inbox className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-300">No Maytapi conversations yet</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    They will appear here as inbound messages arrive.
                  </p>
                </div>
              ) : (
                conversations.map(c => (
                  <button
                    key={c.conversation_key}
                    onClick={() => setSelectedKey(c.conversation_key)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-700/50 hover:bg-slate-700/30 transition ${selectedKey === c.conversation_key ? 'bg-slate-700/40' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-100 truncate">
                        {c.contact_name ?? `••••${c.phone_last4 ?? ''}`}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">{relTime(c.last_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] uppercase tracking-wide ${c.last_direction === 'inbound' ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {c.last_direction === 'inbound' ? '← in' : '→ out'}
                      </span>
                      <span className="text-xs text-slate-400 truncate">{c.last_preview ?? '(no preview)'}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Thread viewer */}
          <section className="flex-1 flex flex-col bg-slate-900/30 min-w-0">
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
                <div className="px-4 py-2 border-b border-slate-700/70 bg-slate-800/40 text-xs text-slate-300 flex items-center justify-between">
                  <span>
                    {(() => {
                      const c = conversations.find(x => x.conversation_key === selectedKey);
                      return c?.contact_name ?? `••••${c?.phone_last4 ?? ''}`;
                    })()}
                  </span>
                  <span className="text-[10px] text-slate-500">{threadMessages.length} message{threadMessages.length === 1 ? '' : 's'}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {threadMessages.map(m => (
                    <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.direction === 'outbound' ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100' : 'bg-slate-700/50 border border-slate-600/50 text-slate-100'}`}>
                        {m.body ? (
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        ) : (
                          <p className="italic text-slate-400 text-xs">{m.media_type ? `[${m.media_type}]` : '(no body)'}</p>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>{new Date(m.received_at).toLocaleString()}</span>
                          {m.direction === 'outbound' && m.zazi_action_id && (
                            <span className="px-1 rounded bg-blue-500/20 text-blue-300">Zazi</span>
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
      ) : (
        // Unmatched tab
        <div className="flex-1 flex flex-col mt-3 mx-4 mb-4 rounded-lg border border-slate-700/70 overflow-hidden bg-slate-800/30">
          <div className="px-3 py-2 border-b border-slate-700/70 text-[11px] uppercase tracking-wide text-slate-500 font-medium flex items-center justify-between">
            <span>Unmatched inbound numbers</span>
            {loadingUn && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>
          <div className="flex-1 overflow-y-auto">
            {unmatched.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mb-2" />
                <p className="text-sm text-slate-300">No unmatched numbers</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Inbound from unknown phones will appear here as <span className="font-mono">••••XXXX</span>.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-700/50">
                {unmatched.map(u => (
                  <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-700/20">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-slate-100">••••{u.phone_last4}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{u.message_count} msg{u.message_count === 1 ? '' : 's'}</span>
                        <span className="text-[10px] text-slate-500">{relTime(u.last_seen_at)}</span>
                      </div>
                      {u.last_body_preview && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{u.last_body_preview}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setLinkFor(u)}
                      className="px-3 py-1.5 text-xs rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30 flex items-center gap-1.5 shrink-0"
                    >
                      <Link2 className="w-3 h-3" /> Link to contact
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Link-to-contact modal */}
      {linkFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !linking && setLinkFor(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-100 mb-1">Link unmatched number</h3>
            <p className="text-xs text-slate-400 mb-3">
              <span className="font-mono">••••{linkFor.phone_last4}</span> · {linkFor.message_count} message(s)
            </p>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                autoFocus
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                placeholder="Search by name or phone…"
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
                  onClick={() => linkContact(r.id)}
                  disabled={linking}
                  className="w-full text-left px-2 py-2 rounded-md hover:bg-slate-700/50 disabled:opacity-50"
                >
                  <div className="text-sm text-slate-100">{r.full_name}</div>
                  <div className="text-xs text-slate-400">{r.phone_number}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setLinkFor(null)}
                disabled={linking}
                className="px-3 py-1.5 text-xs rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
              >Cancel</button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Linking marks this entry as resolved. New messages from this number will attach to the linked contact going forward.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
