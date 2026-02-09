import { NavLink } from 'react-router-dom';
import logo from '@/assets/logo.jpg';
import {
  LayoutDashboard,
  Users,
  Activity,
  ShoppingCart,
  Briefcase,
  MessageCircle,
  ArrowUpDown,
  HelpCircle,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/contacts', label: 'Contacts', icon: Users },
  { path: '/activities', label: 'Activities', icon: Activity },
  { path: '/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/deals', label: 'Deals', icon: Briefcase },
  { path: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { path: '/import-export', label: 'Import / Export', icon: ArrowUpDown },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-slate-900 text-slate-300 flex flex-col z-20">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Vanto Zazi logo" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-semibold text-lg text-white tracking-tight">Vanto Zazi</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
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
      </nav>

      {/* Help at bottom */}
      <div className="p-3 border-t border-slate-800">
        <NavLink
          to="/help"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all duration-150"
        >
          <HelpCircle className="w-5 h-5" />
          Help
        </NavLink>
      </div>
    </aside>
  );
}
