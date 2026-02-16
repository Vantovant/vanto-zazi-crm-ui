import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ZaziCopilot } from './ZaziCopilot';
import { CrmProvider } from '@/contexts/CrmContext';
import { useActivityTracker } from '@/hooks/useActivityTracker';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  useActivityTracker();

  return (
    <CrmProvider>
      <div className="min-h-screen bg-slate-900">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <Topbar onMenuToggle={() => setSidebarOpen(true)} />
        <main className="lg:ml-56 pt-14 min-h-screen">
          <div className="p-4 lg:p-6">
            <Outlet context={{ setSelectedContactId }} />
          </div>
        </main>
        <ZaziCopilot selectedContactId={selectedContactId} />
      </div>
    </CrmProvider>
  );
}
