import { Search, Bell, UserPlus, ClipboardList, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Topbar() {
  const { user, signOut } = useAuth();
  const displayEmail = user?.email ?? '';
  const initials = displayEmail.slice(0, 2).toUpperCase();
  return (
    <header className="fixed top-0 left-56 right-0 h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-10">
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search contacts, activities..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-slate-500"
        />
      </div>

      {/* Quick Actions + Right section */}
      <div className="flex items-center gap-3">
        {/* Quick Action Buttons */}
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden lg:inline">Add Contact</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
        >
          <ClipboardList className="w-4 h-4" />
          <span className="hidden lg:inline">Log Activity</span>
        </button>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
        </button>

        {/* Sign Out */}
        <button
          type="button"
          onClick={signOut}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3 ml-1">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-200">{displayEmail}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
