import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import logo from '@/assets/getwellgrow-logo.png';

const nav = [
  { to: '/', label: 'Home', end: true },
  { to: '/features', label: 'Features' },
  { to: '/flagship', label: 'Flagship' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/investors', label: 'Investors' },
];

export function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen bg-[#0F2A44] text-brand-sand">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0F2A44]/85 border-b border-white/5">
        <div className="container mx-auto flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="GetWell Grow" className="w-9 h-9 object-contain" />
            <span className="font-bold text-lg tracking-tight">
              <span className="text-brand-teal-300">GetWell</span>{' '}
              <span className="text-brand-orange-400">Grow</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm transition ${
                    isActive
                      ? 'text-brand-orange-400 bg-white/5'
                      : 'text-brand-sand/80 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <Link
              to="/signin"
              className="px-4 py-2 text-sm rounded-md text-brand-sand hover:text-white border border-white/10 hover:border-white/30 transition"
            >
              Sign in
            </Link>
            <Link
              to="/signin"
              className="px-4 py-2 text-sm rounded-md bg-brand-orange-500 hover:bg-brand-orange-600 text-white font-medium transition inline-flex items-center gap-1"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <button
            className="lg:hidden p-2 rounded-md hover:bg-white/5"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="lg:hidden border-t border-white/5 bg-[#0F2A44]">
            <div className="container mx-auto py-3 flex flex-col gap-1">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm ${
                      isActive ? 'text-brand-orange-400 bg-white/5' : 'text-brand-sand/80'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              <Link
                to="/signin"
                className="mt-2 px-3 py-2 rounded-md bg-brand-orange-500 text-white text-sm font-medium text-center"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-white/5 bg-[#0B2138] mt-24">
        <div className="container mx-auto py-12 grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <img src={logo} alt="GetWell Grow" className="w-8 h-8 object-contain" />
              <span className="font-bold">
                <span className="text-brand-teal-300">GetWell</span>{' '}
                <span className="text-brand-orange-400">Grow</span>
              </span>
            </div>
            <p className="text-sm text-brand-sand/70 max-w-sm">
              The downline growth CRM for modern network-marketing teams. Grow your team. Grow your wellness.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-brand-sand/70">
              <li><Link to="/features" className="hover:text-white">Features</Link></li>
              <li><Link to="/flagship" className="hover:text-white">Flagship modules</Link></li>
              <li><Link to="/how-it-works" className="hover:text-white">How it works</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-brand-sand/70">
              <li><Link to="/investors" className="hover:text-white">Investors</Link></li>
              <li><Link to="/signin" className="hover:text-white">Sign in</Link></li>
              <li><a href="mailto:hello@getwellgrow.app" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto py-5 border-t border-white/5 text-xs text-brand-sand/50 flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} GetWell Grow. All rights reserved.</span>
          <span>Grow your team. Grow your wellness.</span>
        </div>
      </footer>
    </div>
  );
}
