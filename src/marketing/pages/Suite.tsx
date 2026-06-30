import { ArrowRight, ExternalLink, Building2, Sparkles } from 'lucide-react';

const suiteApps = [
  {
    name: 'Executive AI Command Center',
    tagline: 'Flagship — AI cockpit for executives, founders and growing teams.',
    href: 'https://vantoos.com/command-center',
    accent: '#D4AF37',
    status: 'Flagship',
  },
  {
    name: 'GetWell Grow',
    tagline: 'Downline-first CRM and AI Prospector for MLM teams. (You are here.)',
    href: 'https://getwellgrow.app',
    accent: '#E8732C',
    status: 'Live',
    current: true,
  },
  {
    name: 'GetWell Hub',
    tagline: 'WhatsApp-first CRM and AI Prospector — where prospects become partners.',
    href: 'https://getwellhub.dev',
    accent: '#2A8A8F',
    status: 'Live',
  },
  {
    name: 'More from VantoOS',
    tagline: 'New executive tools shipping across 2026 — one governance core, one AI gateway, one design language.',
    href: 'https://vantoos.com/suite',
    accent: '#0F2A44',
    status: 'Coming 2026',
  },
];

const parentLinks: [string, string][] = [
  ['Home', 'https://vantoos.com/'],
  ['Command Center', 'https://vantoos.com/command-center'],
  ['Features', 'https://vantoos.com/features'],
  ['How it Works', 'https://vantoos.com/how-it-works'],
  ['The Suite', 'https://vantoos.com/suite'],
  ['Company', 'https://vantoos.com/company'],
  ['Clientele', 'https://vantoos.com/clientele'],
  ['Investors', 'https://vantoos.com/investors'],
  ['Pricing', 'https://vantoos.com/pricing'],
  ['Contact', 'https://vantoos.com/contact'],
  ['Sign in', 'https://vantoos.com/signin'],
  ['Privacy', 'https://vantoos.com/privacy'],
  ['Terms', 'https://vantoos.com/terms'],
];

export function Suite() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 85% 20%, rgba(212,175,55,0.18), transparent 55%), radial-gradient(circle at 10% 90%, rgba(42,138,143,0.18), transparent 55%)',
          }}
        />
        <div className="container mx-auto py-16 lg:py-20 relative">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-white border border-[#0F2A44]/10 text-[#0F2A44] mb-7 shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            Part of the VantoOS Suite
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-[#0F2A44] max-w-3xl">
            One company. One governance core. <span className="text-[#2A8A8F]">A growing suite</span> of apps.
          </h1>
          <p className="mt-6 text-lg text-[#0F2A44]/75 max-w-3xl leading-relaxed">
            VantoOS is an African-built software house designing AI-powered operating systems for executives, founders,
            and growing teams. VantoOS is the parent company behind the Executive AI Command Center, GetWell Hub,
            GetWell Grow, and a growing suite of products that share one governance core, one AI gateway, and one
            design language.{' '}
            <a
              href="https://vantoos.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2A8A8F] hover:text-[#1C5A5E] underline-offset-4 hover:underline font-semibold"
            >
              Learn more at vantoos.com →
            </a>
          </p>
        </div>
      </section>

      {/* Suite grid */}
      <section className="py-12 bg-white border-y border-[#0F2A44]/5">
        <div className="container mx-auto">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">The Suite</span>
              <h2 className="text-3xl font-bold mt-2 text-[#0F2A44]">Apps in the VantoOS family</h2>
            </div>
            <a
              href="https://vantoos.com/suite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#2A8A8F] hover:text-[#1C5A5E] inline-flex items-center gap-1 font-semibold"
            >
              See the full suite <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {suiteApps.map((app) => (
              <a
                key={app.name}
                href={app.href}
                target={app.current ? undefined : '_blank'}
                rel={app.current ? undefined : 'noopener noreferrer'}
                className={`group p-6 rounded-2xl border transition flex gap-4 items-start ${
                  app.current
                    ? 'bg-[#F8EFE2] border-[#E8732C]/40'
                    : 'bg-white border-[#0F2A44]/10 hover:border-[#2A8A8F]/40 hover:shadow-lg'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${app.accent}18` }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: app.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-bold text-[#0F2A44] text-lg">{app.name}</div>
                    <span
                      className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${app.accent}18`, color: app.accent }}
                    >
                      {app.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#0F2A44]/70 mt-1.5 leading-relaxed">{app.tagline}</p>
                  {!app.current && (
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2A8A8F] group-hover:text-[#1C5A5E]">
                      Visit <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Parent sitemap */}
      <section className="py-16">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Parent company</span>
            <h2 className="text-3xl font-bold mt-2 text-[#0F2A44]">Explore vantoos.com</h2>
            <p className="text-[#0F2A44]/65 mt-3">Direct links into every section of the VantoOS parent site.</p>
          </div>
          <div className="rounded-2xl bg-white border border-[#0F2A44]/10 p-6 md:p-8">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {parentLinks.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 rounded-lg text-sm text-[#0F2A44] hover:bg-[#F8EFE2] hover:text-[#2A8A8F] transition inline-flex items-center justify-between gap-2 group"
                >
                  <span className="font-medium">{label}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto">
          <div
            className="rounded-3xl p-10 md:p-12 text-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #0F2A44 0%, #2A8A8F 60%, #D4AF37 100%)' }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white">One operating system. Every executive. Every team.</h2>
            <p className="mt-4 text-white/85 max-w-2xl mx-auto">
              GetWell Grow is one of several products in the VantoOS Suite. Visit the parent company to see the full
              roadmap.
            </p>
            <a
              href="https://vantoos.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-[#F8EFE2] text-[#0F2A44] font-bold transition"
            >
              Visit VantoOS <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
