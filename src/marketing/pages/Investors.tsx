import { Link } from 'react-router-dom';
import { ArrowRight, Target, Globe, TrendingUp, Layers, Users, DollarSign, Sparkles } from 'lucide-react';

export function Investors() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(circle at 80% 20%, rgba(232,115,44,0.35), transparent 55%), radial-gradient(circle at 10% 80%, rgba(42,138,143,0.30), transparent 55%)' }} />
        <div className="container mx-auto pt-20 pb-12 relative">
          <span className="text-xs uppercase tracking-widest text-brand-orange-400 font-semibold">For investors</span>
          <h1 className="text-4xl md:text-5xl font-bold mt-3 max-w-3xl leading-tight">
            The downline CRM for a $200B+ global industry.
          </h1>
          <p className="mt-5 text-lg text-brand-sand/80 max-w-2xl">
            Network marketing has 120M+ active distributors worldwide. Most use
            WhatsApp, Excel, and memory. GetWell Grow replaces the memory.
          </p>
        </div>
      </section>

      {/* Market */}
      <section className="container mx-auto py-12">
        <div className="grid md:grid-cols-4 gap-5">
          {[
            ['$200B+', 'Global MLM industry revenue'],
            ['120M+', 'Active distributors worldwide'],
            ['85%', 'Use only WhatsApp + memory'],
            ['<5%', 'Have any real CRM'],
          ].map(([n, l]) => (
            <div key={l} className="p-6 rounded-2xl bg-white/[0.04] border border-white/5">
              <div className="text-3xl font-bold brand-gradient-text">{n}</div>
              <div className="text-sm text-brand-sand/70 mt-2">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 border-y border-white/5 bg-[#0B2138]">
        <div className="container mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-bold">The problem</h2>
            <p className="mt-4 text-brand-sand/80">
              Network marketers don't fail because they lack opportunity. They fail
              because they lose touch with their downline. Birthdays missed. Activity
              streaks broken. Hot prospects forgotten. Generic CRMs (Salesforce,
              HubSpot) don't speak MLM. WhatsApp alone doesn't scale.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-bold">The opportunity</h2>
            <p className="mt-4 text-brand-sand/80">
              A purpose-built CRM that mirrors MLM rhythms (ranks, legs, activity PV,
              upgrade PV, momentum cycles) and respects WhatsApp's manual-first
              compliance model. We're first to build it. We're first to scale it.
            </p>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="container mx-auto py-20">
        <h2 className="text-3xl md:text-4xl font-bold">Why GetWell Grow wins</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {[
            { icon: Target, t: 'Vertical-native', d: 'Built by an active distributor. Every feature solves a daily pain we live.' },
            { icon: Globe, t: 'Company-agnostic', d: 'Works for any MLM brand. Total addressable market = the entire industry.' },
            { icon: Layers, t: 'Defensible moat', d: 'Domain depth, MP1-compliant send architecture, ZAZI AI trained on MLM lexicon.' },
            { icon: TrendingUp, t: 'Sticky by design', d: 'Birthdays, activity streaks, momentum cycles — daily-use, hard to rip out.' },
            { icon: Users, t: 'Network-effect distribution', d: 'Every downline leader brings in their team. Viral growth baked in.' },
            { icon: Sparkles, t: 'AI native', d: 'ZAZI Copilot embedded everywhere. Drafts, briefs, surfaces — without overstepping.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="p-6 rounded-2xl bg-white/[0.04] border border-white/5">
              <Icon className="w-6 h-6 text-brand-orange-400 mb-3" />
              <div className="font-semibold text-white">{t}</div>
              <p className="text-sm text-brand-sand/70 mt-2">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Business model */}
      <section className="bg-[#0B2138] border-y border-white/5 py-16">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-bold">Business model</h2>
            <ul className="mt-6 space-y-4 text-brand-sand/80">
              <li className="flex gap-3">
                <DollarSign className="w-5 h-5 text-brand-teal-300 mt-1 flex-shrink-0" />
                <span><strong className="text-white">SaaS subscription</strong> per distributor seat. Tiered: Solo, Leader, Team.</span>
              </li>
              <li className="flex gap-3">
                <DollarSign className="w-5 h-5 text-brand-teal-300 mt-1 flex-shrink-0" />
                <span><strong className="text-white">Enterprise license</strong> for MLM companies to deploy across their network.</span>
              </li>
              <li className="flex gap-3">
                <DollarSign className="w-5 h-5 text-brand-teal-300 mt-1 flex-shrink-0" />
                <span><strong className="text-white">Premium AI</strong> add-on (ZAZI Pro) for advanced briefing, copywriting, and analytics.</span>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-3xl font-bold">Traction & roadmap</h2>
            <ul className="mt-6 space-y-3 text-brand-sand/80">
              <li>✓ Live product with active distributors in South Africa</li>
              <li>✓ 1,000+ contacts under management per active leader</li>
              <li>✓ Birthday & Monthly Activity flagship modules in production</li>
              <li>→ Multi-tenant white-label for MLM corporates (Q3 2026)</li>
              <li>→ Chrome extension for in-WhatsApp coaching (in beta)</li>
              <li>→ Mobile app — installable PWA already shipped</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto py-24">
        <div className="rounded-3xl p-12 text-center" style={{ background: 'var(--gradient-brand)' }}>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Let's talk.</h2>
          <p className="mt-4 text-white/90 max-w-xl mx-auto">
            We're opening a strategic round to accelerate enterprise rollouts and
            expand into LATAM and SE Asia — the two fastest-growing MLM markets.
          </p>
          <a
            href="mailto:invest@getwellgrow.app"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-md bg-[#0F2A44] hover:bg-[#0B2138] text-white font-semibold transition"
          >
            invest@getwellgrow.app <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </>
  );
}
