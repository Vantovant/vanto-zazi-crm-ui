import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, UserPlus, ClipboardList, LogOut, Lock, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { AddContactModal } from './AddContactModal';

function useSearch(contacts: any[]) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const results = query.trim().length >= 2
    ? contacts.filter(c =>
        (c.FullName?.toLowerCase().includes(query.toLowerCase())) ||
        (c.PhoneNumber?.toLowerCase().includes(query.toLowerCase())) ||
        (c.EmailAddress?.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 6)
    : [];
  return { query, setQuery, open, setOpen, results };
}

export function Topbar() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { contacts } = useCrm();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const search = useSearch(contacts);

  const displayEmail = user?.email ?? '';
  const initials = displayEmail.slice(0, 2).toUpperCase();

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) search.setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recent contacts for notifications (last 5 added)
  const recentNotifs = contacts.slice(0, 5);

  return (
    <>
      <header className="fixed top-0 left-56 right-0 h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-10">
        {/* Search */}
        <div className="relative w-80" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search contacts, activities..."
            value={search.query}
            onChange={e => { search.setQuery(e.target.value); search.setOpen(true); }}
            onFocus={() => search.setOpen(true)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-slate-500"
          />
          {search.open && search.query.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
              {search.results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">No results found</p>
              ) : (
                <>
                  {search.results.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { search.setOpen(false); search.setQuery(''); navigate('/contacts'); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-200">{c.FullName}</p>
                        <p className="text-xs text-slate-500">{c.PhoneNumber || c.EmailAddress}</p>
                      </div>
                      <span className="text-xs text-slate-600">{c.LeadTemperature}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { search.setOpen(false); search.setQuery(''); navigate('/contacts'); }}
                    className="w-full text-center py-2 text-xs font-medium text-teal-400 hover:text-teal-300 border-t border-slate-700"
                  >
                    View all in Contacts
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions + Right section */}
        <div className="flex items-center gap-3">
          {/* Add Contact */}
          <button
            type="button"
            onClick={() => setShowAddContact(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden lg:inline">Add Contact</span>
          </button>

          {/* Log Activity → navigate to Activities page */}
          <button
            type="button"
            onClick={() => navigate('/activities')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            <span className="hidden lg:inline">Log Activity</span>
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(prev => !prev)}
              className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {recentNotifs.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Recent Contacts</h3>
                  <button type="button" onClick={() => setShowNotifications(false)} className="text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {recentNotifs.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500 text-center">No recent activity</p>
                ) : (
                  <div className="divide-y divide-slate-700/50 max-h-64 overflow-y-auto">
                    {recentNotifs.map((c: any) => (
                      <div key={c.id} className="px-4 py-3 hover:bg-slate-800/50 transition-colors">
                        <p className="text-sm font-medium text-slate-200">{c.FullName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{c.LeadTemperature} · {c.LeadType}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setShowNotifications(false); navigate('/contacts'); }}
                  className="w-full py-2.5 text-center text-xs font-medium text-teal-400 hover:text-teal-300 border-t border-slate-700"
                >
                  View All Contacts
                </button>
              </div>
            )}
          </div>

          {/* Change Password */}
          <button
            type="button"
            onClick={() => setShowChangePassword(true)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            title="Change password"
          >
            <Lock className="w-5 h-5" />
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

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
      {showAddContact && (
        <AddContactModal onClose={() => setShowAddContact(false)} />
      )}
    </>
  );
}
