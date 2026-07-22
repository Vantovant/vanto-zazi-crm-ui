import { useState } from 'react';
import { Cloud, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  contactId: string;
  contactName?: string;
}

type State = 'idle' | 'loading' | 'done' | 'error';

/**
 * Push this contact to the VantoOS hub so sister apps (email app, etc.)
 * can locate the same person by email/phone when they need to reach out.
 */
export function SyncContactToHubButton({ contactId, contactName }: Props) {
  const [state, setState] = useState<State>('idle');
  const [err, setErr] = useState<string | null>(null);

  const sync = async () => {
    setState('loading');
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke('sync-contact-to-hub', {
        body: { contact_id: contactId },
      });
      if (error) throw error;
      if ((data as any)?.ok === false) throw new Error((data as any)?.error || 'Hub rejected');
      setState('done');
      setTimeout(() => setState('idle'), 4000);
    } catch (e: any) {
      setErr(e?.message || 'Sync failed');
      setState('error');
    }
  };

  return (
    <div className="px-4 pb-3">
      <button
        type="button"
        onClick={sync}
        disabled={state === 'loading'}
        title={err || `Sync ${contactName ?? 'contact'} to VantoOS hub (email app will locate this contact)`}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 transition-colors text-xs font-medium disabled:opacity-60"
      >
        {state === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : state === 'done' ? <Check className="w-3.5 h-3.5" />
          : state === 'error' ? <AlertCircle className="w-3.5 h-3.5" />
          : <Cloud className="w-3.5 h-3.5" />}
        <span>
          {state === 'loading' ? 'Syncing to VantoOS…'
            : state === 'done' ? 'Synced to VantoOS'
            : state === 'error' ? 'Retry sync'
            : 'Sync to VantoOS (Email app)'}
        </span>
      </button>
      {err && <p className="mt-1 text-[10px] text-rose-400">{err}</p>}
    </div>
  );
}
