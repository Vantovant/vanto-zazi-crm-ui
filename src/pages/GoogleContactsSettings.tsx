import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TokenRow {
  google_email: string | null;
  last_sync_at: string | null;
  expires_at: string | null;
  scope: string | null;
}

interface BrowseItem {
  resourceName: string;
  name: string;
  email: string;
  phone: string;
}

export function GoogleContactsSettings() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [token, setToken] = useState<TokenRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [browseItems, setBrowseItems] = useState<BrowseItem[]>([]);
  const [browseTotal, setBrowseTotal] = useState<number | null>(null);

  const justConnected = params.get('connected') === '1';

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('google_contacts_tokens')
      .select('google_email,last_sync_at,expires_at,scope')
      .eq('user_id', user.id)
      .maybeSingle();
    setToken((data as TokenRow) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const call = async (fn: string, body: Record<string, unknown> = {}) => {
    setResult(null);
    setBusy(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) {
        setResult(`❌ ${error.message}`);
        return null;
      }
      return data as any;
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    const data = await call('google-contacts-auth-start', {
      redirect_after: window.location.pathname + '?connected=1',
    });
    if (data?.auth_url) window.location.href = data.auth_url;
  };

  const disconnect = async () => {
    if (!user) return;
    if (!confirm('Disconnect Google Contacts? Tokens will be removed.')) return;
    await supabase.from('google_contacts_tokens').delete().eq('user_id', user.id);
    setToken(null);
    setResult('Disconnected.');
  };

  const pushAll = async () => {
    if (!confirm('Push ALL CRM contacts to Google Contacts? This may create many entries.')) return;
    const data = await call('google-contacts-push');
    if (data?.ok) setResult(`✅ Pushed: created ${data.created}, failed ${data.failed}, skipped ${data.skipped} of ${data.total}`);
    await load();
  };

  const browse = async () => {
    const data = await call('google-contacts-browse');
    if (data?.ok) {
      setBrowseItems(data.items ?? []);
      setBrowseTotal(data.totalPeople ?? null);
      setResult(`👁 Preview: showing ${data.items?.length ?? 0}${data.totalPeople ? ` of ~${data.totalPeople}` : ''} (nothing imported)`);
    }
  };

  const importAll = async () => {
    if (!confirm('Import ALL contacts from Google into CRM? Duplicates on phone/email are skipped.')) return;
    const data = await call('google-contacts-import');
    if (data?.ok) setResult(`✅ Imported ${data.imported} · skipped duplicate ${data.skippedDup} · empty ${data.skippedEmpty} · failed ${data.failed} of ${data.total}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Google Contacts</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Two-way sync between GetWell Grow contacts and your Google account. All directions are manual — nothing runs automatically.
        </p>
      </div>

      {justConnected && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">
          ✅ Google account connected.
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-white">Connection</div>
            {loading ? (
              <div className="text-slate-400 text-sm mt-1">Loading…</div>
            ) : token ? (
              <div className="text-sm text-slate-300 mt-1">
                Connected as <span className="text-emerald-300 font-medium">{token.google_email ?? 'unknown'}</span>
                {token.last_sync_at && (
                  <span className="text-slate-500 ml-2">· last sync {new Date(token.last_sync_at).toLocaleString()}</span>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400 mt-1">Not connected</div>
            )}
          </div>
          {token ? (
            <button
              onClick={disconnect}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={busy === 'google-contacts-auth-start'}
              className="text-sm px-4 py-2 rounded-md bg-white text-slate-900 font-medium hover:bg-slate-100 disabled:opacity-60"
            >
              {busy === 'google-contacts-auth-start' ? 'Opening…' : 'Connect Google'}
            </button>
          )}
        </div>
      </div>

      {token && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="text-sm font-medium text-white">Manual sync</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              onClick={pushAll}
              disabled={!!busy}
              className="text-sm px-3 py-2 rounded-md bg-teal-500 text-slate-900 font-medium hover:bg-teal-400 disabled:opacity-60"
            >
              {busy === 'google-contacts-push' ? 'Pushing…' : 'Push all to Google'}
            </button>
            <button
              onClick={browse}
              disabled={!!busy}
              className="text-sm px-3 py-2 rounded-md border border-slate-600 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {busy === 'google-contacts-browse' ? 'Loading…' : 'Browse Google (preview)'}
            </button>
            <button
              onClick={importAll}
              disabled={!!busy}
              className="text-sm px-3 py-2 rounded-md bg-orange-500 text-white font-medium hover:bg-orange-400 disabled:opacity-60"
            >
              {busy === 'google-contacts-import' ? 'Importing…' : 'Import all from Google'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            <strong>Push all</strong> creates entries in Google Contacts. <strong>Browse</strong> is preview-only, nothing is imported. <strong>Import all</strong> dedupes on phone/email.
          </p>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 text-slate-200 px-4 py-3 text-sm whitespace-pre-wrap">
          {result}
        </div>
      )}

      {browseItems.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 text-sm text-slate-300">
            Preview from Google {browseTotal ? `(~${browseTotal} total)` : ''}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Phone</th>
                  <th className="text-left px-4 py-2">Email</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {browseItems.map((it) => (
                  <tr key={it.resourceName} className="border-t border-slate-800/60">
                    <td className="px-4 py-2">{it.name || '—'}</td>
                    <td className="px-4 py-2">{it.phone || '—'}</td>
                    <td className="px-4 py-2">{it.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500 space-y-1">
        <div>Redirect URI registered with Google:</div>
        <code className="text-slate-300 break-all">
          https://urfyfuakgabieellbuce.supabase.co/functions/v1/google-contacts-auth-callback
        </code>
      </div>
    </div>
  );
}
