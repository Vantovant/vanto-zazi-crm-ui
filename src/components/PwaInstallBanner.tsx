import { Download, Share, X } from 'lucide-react';
import { PwaInstallButton } from './PwaInstallButton';
import { usePwaInstall } from '@/contexts/PwaInstallContext';

export function PwaInstallBanner() {
  const { canInstall, showFallback, dismissInstallUi } = usePwaInstall();

  if (!canInstall && !showFallback) {
    return null;
  }

  return (
    <div className="fixed top-16 left-4 right-4 sm:left-auto sm:w-[22rem] z-[90]">
      <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-4 text-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400">
              {canInstall ? <Download className="h-5 w-5" /> : <Share className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">
                {canInstall ? 'Install Zazi CRM' : 'Add Zazi CRM to your Home Screen'}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {canInstall
                  ? 'Install the app for faster access from your desktop or phone.'
                  : 'On iPhone Safari, tap Share, then choose Add to Home Screen.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissInstallUi}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Dismiss install help"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {canInstall ? (
            <PwaInstallButton label="Install App" />
          ) : (
            <button
              type="button"
              onClick={dismissInstallUi}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}