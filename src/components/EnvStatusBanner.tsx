import { useState } from 'react';
import { AlertTriangle, Copy, CheckCircle } from 'lucide-react';
import { env, getEnvReport } from '@/lib/env';

export function EnvStatusBanner() {
  const [copied, setCopied] = useState(false);

  if (env.hasBackend) return null;

  const handleCopy = () => {
    const report = getEnvReport();
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-rose-600 text-white px-4 py-2.5 flex items-center justify-between text-sm font-medium">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>⚠ Backend not configured for this deployment (production env missing).</span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
      >
        {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy Env Report'}
      </button>
    </div>
  );
}
