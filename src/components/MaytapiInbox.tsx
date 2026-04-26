import { useEffect, useState } from 'react';
import { AlertTriangle, Inbox, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * MAYTAPI INBOX — H1 SHELL ONLY (read-only, admin-only)
 *
 * Scope: presentational shell that will eventually display Maytapi inbound +
 * outbound conversation history for Vanto's own Maytapi-connected WhatsApp
 * number.
 *
 * H1 explicitly does NOT:
 *  - call Maytapi from the browser
 *  - create or read any new tables
 *  - write a webhook
 *  - render fake/sample conversations
 *  - mix Twilio/shared inbox data with Maytapi data
 *  - enable replies, AI suggestions, auto-reply, Send All, cron, or
 *    production mode
 *  - touch maytapi-send-1to1, prospector_send_log, contact_activities,
 *    ProspectorSendAuditPanel, or contacts.lead_type
 *
 * Inbound logging is connected in H2.
 */
export function MaytapiInbox() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    };
    check();
    return () => { cancelled = true; };
  }, [user]);

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
              <MessageSquare className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-100">Maytapi Inbox</h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Maytapi
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide bg-slate-700 text-slate-300 border border-slate-600">
                  Admin only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Conversation history for Vanto's WhatsApp number
              </p>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Separate from Twilio / shared inbox
          </div>
        </div>
      </div>

      {/* H2 warning banner */}
      <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-200">
          <span className="font-medium">Inbound logging not connected yet — H2 pending.</span>{' '}
          <span className="text-amber-200/80">
            Outbound sends from the Prospector still flow through{' '}
            <code className="px-1 rounded bg-amber-500/10">maytapi-send-1to1</code>{' '}
            unchanged. No conversations will appear here until the inbound webhook
            and message store are added.
          </span>
        </div>
      </div>

      {/* Body: split layout placeholder */}
      <div className="flex-1 flex min-h-0 mt-3 mx-4 mb-4 rounded-lg border border-slate-700/70 overflow-hidden">
        {/* Conversation list */}
        <aside className="w-72 border-r border-slate-700/70 bg-slate-800/40 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-700/70 text-[11px] uppercase tracking-wide text-slate-500 font-medium">
            Conversations
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Inbox className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-300">No Maytapi conversations yet</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Conversations will appear here once H2 connects inbound logging.
            </p>
          </div>
        </aside>

        {/* Conversation viewer */}
        <section className="flex-1 flex items-center justify-center bg-slate-900/30">
          <div className="text-center px-6">
            <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              Select a conversation to view messages
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Read-only shell. Reply box and AI suggestions are intentionally disabled in H1.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
