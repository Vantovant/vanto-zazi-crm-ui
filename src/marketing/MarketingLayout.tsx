import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import logo from '@/assets/getwellgrow-logo.png';

const nav = [
  { to: '/', label: 'Home', end: true },
  { to: '/features', label: 'Features' },
  { to: '/flagship', label: 'Flagship' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/suite', label: 'Suite' },
  { to: '/investors', label: 'Investors' },
];

export function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen bg-[#F8EFE2] text-[#0F2A44]">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#F8EFE2]/90 border-b border-[#0F2A44]/5">
        <div className="container mx-auto flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="GetWell Grow" className="w-10 h-10 object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-lg tracking-tight">
                <span className="text-[#2A8A8F]">GetWell</span>{' '}
                <span className="text-[#E8732C]">Grow</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#0F2A44]/60 font-medium">
                Grow your team · Grow your wellness
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 bg-white/60 rounded-full px-2 py-1 border border-[#0F2A44]/5">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-full text-sm transition ${
                    isActive
                      ? 'bg-[#0F2A44]/5 text-[#0F2A44] font-semibold'
                      : 'text-[#0F2A44]/70 hover:text-[#0F2A44]'
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
              className="px-4 py-2 text-sm rounded-full text-[#0F2A44] hover:text-[#2A8A8F] transition font-medium"
            >
              Sign in
            </Link>
            <Link
              to="/signin"
              className="px-5 py-2.5 text-sm rounded-full text-white font-semibold transition inline-flex items-center gap-1.5 shadow-[0_8px_24px_-8px_rgba(232,115,44,0.5)] hover:shadow-[0_12px_28px_-8px_rgba(232,115,44,0.65)]"
              style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <button
            className="lg:hidden p-2 rounded-md hover:bg-[#0F2A44]/5"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="lg:hidden border-t border-[#0F2A44]/5 bg-[#F8EFE2]">
            <div className="container mx-auto py-3 flex flex-col gap-1">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm ${
                      isActive ? 'text-[#2A8A8F] bg-white/70 font-semibold' : 'text-[#0F2A44]/80'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              <Link
                to="/signin"
                className="mt-2 px-3 py-2 rounded-full text-white text-sm font-semibold text-center"
                style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
              >
                Get started
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-[#0F2A44]/10 bg-white/50 mt-24">
        {/* VantoOS parent attribution band */}
        <div className="border-b border-[#0F2A44]/10 bg-[#0F2A44] text-white/90">
          <div className="container mx-auto py-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-bold tracking-wider uppercase text-[#D4AF37]">
                Developed by VantoOS
              </span>
              <span className="text-white/70">
                GetWell Grow is a product of the <a href="https://vantoos.com/suite" target="_blank" rel="noopener noreferrer" className="text-white font-semibold hover:text-[#D4AF37]">VantoOS Suite</a> — designed and developed by{' '}
                <a href="https://vantoos.com" target="_blank" rel="noopener noreferrer" className="text-white font-semibold hover:text-[#D4AF37]">VantoOS</a>.
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/70">
              <Link to="/suite" className="hover:text-[#D4AF37]">The Suite</Link>
              <a href="https://getwellhub.dev" target="_blank" rel="noopener noreferrer" className="hover:text-[#D4AF37]">GetWell Hub</a>
              <a href="https://vantoos.com/command-center" target="_blank" rel="noopener noreferrer" className="hover:text-[#D4AF37]">Command Center</a>
            </div>
          </div>
        </div>

        <div className="container mx-auto py-12 grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <img src={logo} alt="GetWell Grow" className="w-8 h-8 object-contain" />
              <span className="font-bold">
                <span className="text-[#2A8A8F]">GetWell</span>{' '}
                <span className="text-[#E8732C]">Grow</span>
              </span>
            </div>
            <p className="text-sm text-[#0F2A44]/70 max-w-sm">
              The downline growth CRM for modern network-marketing teams. Grow your team. Grow your wellness.
            </p>
            <p className="text-xs text-[#0F2A44]/55 mt-3">A VantoOS product · <a href="https://vantoos.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#2A8A8F] font-semibold">vantoos.com</a></p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#0F2A44] mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-[#0F2A44]/70">
              <li><Link to="/features" className="hover:text-[#2A8A8F]">Features</Link></li>
              <li><Link to="/flagship" className="hover:text-[#2A8A8F]">Flagship modules</Link></li>
              <li><Link to="/how-it-works" className="hover:text-[#2A8A8F]">How it works</Link></li>
              <li><Link to="/suite" className="hover:text-[#2A8A8F]">Part of the Suite</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#0F2A44] mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-[#0F2A44]/70">
              <li><Link to="/investors" className="hover:text-[#2A8A8F]">Investors</Link></li>
              <li><a href="https://vantoos.com/company" target="_blank" rel="noopener noreferrer" className="hover:text-[#2A8A8F]">Parent: VantoOS</a></li>
              <li><Link to="/signin" className="hover:text-[#2A8A8F]">Sign in</Link></li>
              <li><a href="mailto:hello@getwellgrow.app" className="hover:text-[#2A8A8F]">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto py-5 border-t border-[#0F2A44]/10 text-xs text-[#0F2A44]/55 flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} VantoOS (Pty) Ltd. All rights reserved.</span>
          <span>Grow your team. Grow your wellness.</span>
        </div>
      </footer>
    </div>
  );
}
