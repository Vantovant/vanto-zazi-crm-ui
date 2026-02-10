import { AlertTriangle, CheckCircle } from 'lucide-react';

interface DataStatusBannerProps {
  dbActive: boolean;
}

export function DataStatusBanner({ dbActive }: DataStatusBannerProps) {
  if (dbActive) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <p className="text-sm font-medium text-emerald-400">
          ✅ DATA IS NOW STORED SECURELY
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <p className="text-sm font-medium text-amber-400">
        ⚠️ DEMO MODE — DATA NOT PERSISTENT
      </p>
    </div>
  );
}
