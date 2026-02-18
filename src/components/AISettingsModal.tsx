import { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, CheckCircle, AlertCircle, Cpu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AISettingsModalProps {
  onClose: () => void;
}

type Provider = 'lovable' | 'openai' | 'gemini';

export function AISettingsModal({ onClose }: AISettingsModalProps) {
  const { user } = useAuth();
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [preferred, setPreferred] = useState<Provider>('lovable');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setOpenaiKey(data.openai_api_key || '');
        setGeminiKey(data.gemini_api_key || '');
        setPreferred((data.preferred_provider as Provider) || 'lovable');
      }
      setFetching(false);
    })();
  }, [user]);

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate keys if provided
    if (openaiKey && !openaiKey.startsWith('sk-')) {
      setStatus('error');
      setMessage('OpenAI key should start with "sk-"');
      return;
    }

    setLoading(true);
    setStatus('idle');

    const payload = {
      user_id: user.id,
      openai_api_key: openaiKey,
      gemini_api_key: geminiKey,
      preferred_provider: preferred,
    };

    const { data: existing } = await supabase
      .from('user_api_keys')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from('user_api_keys').update(payload).eq('user_id', user.id)
      : await supabase.from('user_api_keys').insert(payload);

    setLoading(false);
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('success');
      setMessage('AI settings saved successfully!');
      setTimeout(onClose, 1500);
    }
  };

  const providers: { value: Provider; label: string; desc: string }[] = [
    { value: 'lovable', label: 'Lovable AI (Default)', desc: 'Uses shared credits — free tier included' },
    { value: 'gemini', label: 'Google Gemini', desc: 'Uses your personal Gemini API key' },
    { value: 'openai', label: 'OpenAI', desc: 'Uses your personal OpenAI API key' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">AI Settings</h2>
                <p className="text-xs text-slate-500">Connect your own AI accounts</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {fetching ? (
            <div className="p-6 text-center text-slate-400 text-sm">Loading...</div>
          ) : (
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Preferred Provider */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Preferred AI Provider</label>
                <div className="space-y-2">
                  {providers.map(p => (
                    <label key={p.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      preferred === p.value
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}>
                      <input
                        type="radio"
                        name="provider"
                        value={p.value}
                        checked={preferred === p.value}
                        onChange={() => setPreferred(p.value)}
                        className="accent-teal-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{p.label}</p>
                        <p className="text-xs text-slate-500">{p.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs text-slate-500 mb-3">
                  <Key className="w-3.5 h-3.5 inline mr-1" />
                  Your keys are stored securely and only used when Lovable AI credits run out or when you choose a specific provider.
                </p>
              </div>

              {/* OpenAI Key */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">OpenAI API Key</label>
                <div className="relative">
                  <input
                    type={showOpenai ? 'text' : 'password'}
                    value={showOpenai ? openaiKey : maskKey(openaiKey)}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 pr-10 placeholder:text-slate-500 font-mono"
                  />
                  <button type="button" onClick={() => setShowOpenai(!showOpenai)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Gemini Key */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Google Gemini API Key</label>
                <div className="relative">
                  <input
                    type={showGemini ? 'text' : 'password'}
                    value={showGemini ? geminiKey : maskKey(geminiKey)}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 pr-10 placeholder:text-slate-500 font-mono"
                  />
                  <button type="button" onClick={() => setShowGemini(!showGemini)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Status */}
              {status !== 'idle' && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {message}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                  {loading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
