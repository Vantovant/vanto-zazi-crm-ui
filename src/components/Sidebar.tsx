import { NavLink } from 'react-router-dom';
import logo from '@/assets/getwellgrow-logo.png';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Activity,
  ShoppingCart,
  Package,
  Briefcase,
  MessageCircle,
  ArrowUpDown,
  HelpCircle,
  X,
  BarChart3,
  GitMerge,
  Flame,
  GitBranch,
  Crown,
  Cake,
  Zap,
  Video,
} from 'lucide-react';

const OWNER_ID = 'b8028d7d-6a08-45ef-a369-b438c440bea3';

const baseNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/contacts', label: 'Contacts', icon: Users },
  { path: '/activities', label: 'Activities', icon: Activity },
  { path: '/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/deals', label: 'Deals', icon: Briefcase },
  { path: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { path: '/import-export', label: 'Import / Export', icon: ArrowUpDown },
  { path: '/duplicates', label: 'Duplicates', icon: GitMerge },
  { path: '/momentum', label: '90-Day Run', icon: Flame },
];

const campaignNavItems = [
  { path: '/campaigns/birthday', label: 'Birthday Campaign', icon: Cake },
  { path: '/campaigns/activation', label: 'Monthly Activity Campaign', icon: Zap },
  { path: '/campaigns/zoom', label: 'Zoom Invitation', icon: Video },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const navItems = user?.id === OWNER_ID
    ? [
        ...baseNavItems,
        { path: '/monthly-activity-push', label: 'Monthly Activity Push', icon: Crown },
        { path: '/sponsor-review', label: 'Sponsor Review', icon: GitBranch },
        { path: '/team', label: 'Tester Dashboard', icon: BarChart3 },
      ]
    : baseNavItems;
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed left-0 top-0 h-screen w-56 bg-slate-900 text-slate-300 flex flex-col z-40 transition-transform duration-200 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="GetWell Grow logo" className="w-8 h-8 rounded-lg object-contain bg-white/5 p-0.5" />
            <span className="font-semibold text-lg text-white tracking-tight">
              <span className="text-brand-teal-300">GetWell</span> <span className="text-brand-orange-400">Grow</span>
            </span>
          </div>
          <button type="button" onClick={onClose} className="lg:hidden p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-teal-500/10 text-teal-400 border-l-2 border-teal-400 -ml-[2px] pl-[14px]'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-5 mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Campaigns
          </div>
          <ul className="space-y-1">
            {campaignNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-orange-500/10 text-orange-400 border-l-2 border-orange-400 -ml-[2px] pl-[14px]'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Install + Help at bottom */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <NavLink
            to="/help"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all duration-150"
          >
            <HelpCircle className="w-5 h-5" />
            Help
          </NavLink>
        </div>
      </aside>
    </>
  );
}
