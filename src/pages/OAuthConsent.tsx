import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get('authorization_id') ?? '';
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError('Missing authorization request.');
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = '/auth?next=' + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError('No redirect returned by the authorization server.'); }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? 'An assistant';

  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 text-slate-100">
        {error ? (
          <>
            <h1 className="text-lg font-semibold mb-2">Could not load this request</h1>
            <p className="text-sm text-slate-300">{error}</p>
          </>
        ) : !details ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 text-teal-500 animate-spin" /></div>
        ) : (
          <>
            <ShieldCheck className="w-10 h-10 text-teal-500 mb-3" />
            <h1 className="text-xl font-semibold mb-2">Connect {clientName} to Get Well Grow</h1>
            <p className="text-sm text-slate-300 mb-6">
              {clientName} will be able to read and update your CRM data as you. It cannot send WhatsApp messages, delete or merge anything.
            </p>
            <div className="flex gap-3">
              <button disabled={busy} onClick={() => decide(true)} className="flex-1 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 py-2 font-medium">Approve</button>
              <button disabled={busy} onClick={() => decide(false)} className="flex-1 rounded-lg border border-slate-600 hover:bg-slate-700 disabled:opacity-50 py-2 font-medium">Deny</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
