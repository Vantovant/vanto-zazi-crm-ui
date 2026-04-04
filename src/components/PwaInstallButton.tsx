import { Download } from 'lucide-react';
import { usePwaInstall } from '@/contexts/PwaInstallContext';

interface PwaInstallButtonProps {
  label?: string;
}

export function PwaInstallButton({ label = 'Install Zazi CRM' }: PwaInstallButtonProps) {
  const { canInstall, promptInstall } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={promptInstall}
      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-500"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
