import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-900">
      <Sidebar />
      <Topbar />
      <main className="ml-56 pt-14 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
