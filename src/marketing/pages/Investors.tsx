import { Link } from 'react-router-dom';
import {
  ArrowRight, Target, Globe, TrendingUp, Layers, Users, DollarSign, Sparkles,
  CheckCircle2, BarChart3, Rocket, Shield,
} from 'lucide-react';

export function Investors() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 80% 20%, rgba(232,115,44,0.18), transparent 55%), radial-gradient(circle at 10% 80%, rgba(42,138,143,0.16), transparent 55%)',
          }}
        />
        <div className="container mx-auto pt-16 pb-12 relative">
          <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">For investors</span>
          <h1 className="text-4xl md:text-5xl font-bold mt-3 max-w-3xl leading-tight text-[#0F2A44]">
            The downline CRM for a $200B+ global industry.
          </h1>
          <p className="mt-5 text-lg text-[#0F2A44]/75 max-w-2xl">
            Network marketing has 120M+ active distributors worldwide. 85% run their entire
            business on WhatsApp, Excel, and memory. GetWell Grow replaces the memory — and we're
            the first vertical-native CRM to do it without breaking the WhatsApp compliance model
            that keeps distributors' numbers alive.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="mailto:invest@getwellgrow.app"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white font-bold transition shadow-lg"
              style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
            >
              Request the data room <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="mailto:invest@getwellgrow.app"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white border-2 border-[#0F2A44]/10 text-[#0F2A44] font-bold hover:border-[#2A8A8F]/40 transition"
            >
              Book a 20-min walkthrough
            </a>
          </div>
        </div>
      </section>

      {/* Market stats */}
      <section className="container mx-auto py-12">
        <div className="grid md:grid-cols-4 gap-5">
          {[
            ['$200B+', 'Global MLM industry revenue (2024, WFDSA)'],
            ['120M+', 'Active distributors worldwide'],
            ['85%', 'Run business on WhatsApp + memory only'],
            ['<5%', 'Have any vertical-fit CRM today'],
          ].map(([n, l]) => (
            <div key={l} className="p-6 rounded-2xl bg-white border border-[#0F2A44]/5 shadow-sm">
              <div
                className="text-3xl font-extrabold bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
              >
                {n}
              </div>
              <div className="text-sm text-[#0F2A44]/70 mt-2 leading-snug">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem / Opportunity */}
      <section className="py-16 border-y border-[#0F2A44]/5 bg-white">
        <div className="container mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">The problem</span>
            <h2 className="text-3xl font-bold mt-2 text-[#0F2A44]">A $200B industry running on memory.</h2>
            <p className="mt-4 text-[#0F2A44]/80 leading-relaxed">
              Distributors don't fail because they lack opportunity. They fail because they lose
              touch with their downline. Birthdays missed. Activity streaks broken. Hot prospects
              forgotten. Generic CRMs (Salesforce, HubSpot, Pipedrive) don't speak MLM — no rank
              logic, no PV tracking, no leg visibility, no manual-first messaging. WhatsApp alone
              doesn't scale past 200 contacts. Excel sheets fragment across phones and laptops.
              The result: 95% distributor churn inside 12 months.
            </p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">The opportunity</span>
            <h2 className="text-3xl font-bold mt-2 text-[#0F2A44]">First vertical-native, WhatsApp-safe CRM.</h2>
            <p className="mt-4 text-[#0F2A44]/80 leading-relaxed">
              A purpose-built CRM that mirrors MLM rhythms — ranks, legs, Activity PV, Upgrade PV,
              90-day momentum cycles — and respects WhatsApp's manual-first compliance model
              (MP1). We're first to build it. We're first to scale it. And every leader who
              succeeds with it brings their entire team in behind them. Pure network-effect
              distribution inside an industry that is itself a distribution network.
            </p>
          </div>
        </div>
      </section>

      {/* Why we win */}
      <section className="container mx-auto py-20">
        <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Why GetWell Grow wins</span>
        <h2 className="text-3xl md:text-4xl font-bold mt-2 text-[#0F2A44]">Six structural advantages.</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {[
            { icon: Target, t: 'Vertical-native',
              d: 'Built by an active Diamond-leg distributor. Every feature solves a daily pain we live. Generic CRM giants cannot copy what they do not feel.' },
            { icon: Globe, t: 'Company-agnostic',
              d: 'Configurable field labels, rank tiers, and PV formulas mean we work for any MLM brand. TAM = the entire global industry, not one company.' },
            { icon: Layers, t: 'Defensible moat',
              d: 'Domain depth, MP1 send architecture, ZAZI AI trained on MLM lexicon, and a 13-category template library that took two years to refine.' },
            { icon: TrendingUp, t: 'Sticky by design',
              d: 'Birthdays, activity streaks, momentum cycles — daily-use rituals. Once a leader is 90 days in, ripping us out means losing their downline rhythm.' },
            { icon: Users, t: 'Network-effect distribution',
              d: 'Every downline leader brings in their team. Every team brings in their legs. Viral acquisition baked into the product\'s use-case itself.' },
            { icon: Sparkles, t: 'AI native, AI safe',
              d: 'ZAZI Copilot embedded everywhere. Drafts, briefs, surfaces. Never edits data without confirmation. Multi-tier model fallback for uptime.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="p-6 rounded-2xl bg-white border border-[#0F2A44]/5 hover:border-[#E8732C]/40 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: '#E8732C18' }}>
                <Icon className="w-5 h-5 text-[#E8732C]" />
              </div>
              <div className="font-bold text-[#0F2A44]">{t}</div>
              <p className="text-sm text-[#0F2A44]/70 mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Business model */}
      <section className="bg-white border-y border-[#0F2A44]/5 py-16">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Business model</span>
            <h2 className="text-3xl font-bold mt-2 text-[#0F2A44]">Three revenue streams. One engine.</h2>
            <ul className="mt-6 space-y-5">
              {[
                { t: 'SaaS subscription', d: 'Per distributor seat. Tiered: Solo ($19/mo), Leader ($49/mo), Team ($149/mo).' },
                { t: 'Enterprise license', d: 'MLM corporates deploy across their full distributor base — $30k–$500k ARR per company.' },
                { t: 'Premium AI (ZAZI Pro)', d: 'Advanced briefing, copywriting, analytics, custom training. $29–$99 per seat per month add-on.' },
              ].map(({ t, d }) => (
                <li key={t} className="flex gap-3">
                  <DollarSign className="w-5 h-5 text-[#2A8A8F] mt-1 flex-shrink-0" />
                  <span className="text-[#0F2A44]/85">
                    <strong className="text-[#0F2A44]">{t}.</strong> {d}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 p-4 rounded-xl bg-[#F8EFE2]/70 border border-[#0F2A44]/5">
              <div className="text-xs uppercase tracking-wider text-[#E8732C] font-bold">Unit economics target</div>
              <div className="mt-2 text-sm text-[#0F2A44]/80 grid grid-cols-2 gap-2">
                <div>ARPU: <strong className="text-[#0F2A44]">$49/mo</strong></div>
                <div>Gross margin: <strong className="text-[#0F2A44]">82%</strong></div>
                <div>CAC: <strong className="text-[#0F2A44]">~$35</strong> (viral)</div>
                <div>LTV / CAC: <strong className="text-[#0F2A44]">~14x</strong></div>
              </div>
            </div>
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Traction & roadmap</span>
            <h2 className="text-3xl font-bold mt-2 text-[#0F2A44]">Live, paying, growing.</h2>
            <ul className="mt-6 space-y-3 text-[#0F2A44]/80">
              {[
                'Live product with active APLGO distributors across South Africa',
                '1,000+ contacts under management per active leader',
                'Birthday Engine + Monthly Activity Push in daily production use',
                '13-category WhatsApp template library shipped',
                'ZAZI AI Copilot embedded on every page',
                'PWA + Chrome extension shipped',
              ].map((b) => (
                <li key={b} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#2A8A8F] mt-1 flex-shrink-0" /><span>{b}</span></li>
              ))}
            </ul>
            <div className="mt-5 text-sm text-[#0F2A44]/70 font-semibold">Next 12 months</div>
            <ul className="mt-2 space-y-2 text-[#0F2A44]/80 text-sm">
              {[
                'Multi-tenant white-label for MLM corporates (Q3 2026)',
                'Expansion into Forever Living + Herbalife distributor networks',
                'LATAM (Brazil, Mexico) and SE Asia (Indonesia, Philippines) launches',
                'ZAZI Pro paid AI tier',
              ].map((b) => (
                <li key={b} className="flex gap-2"><Rocket className="w-4 h-4 text-[#E8732C] mt-0.5 flex-shrink-0" /><span>{b}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The ask */}
      <section className="container mx-auto py-20">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 items-start">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">The ask</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 text-[#0F2A44]">Seed round open.</h2>
            <p className="mt-4 text-[#0F2A44]/80 leading-relaxed">
              We are opening a strategic seed round to accelerate enterprise rollouts, expand
              into LATAM and SE Asia (the two fastest-growing MLM markets), and ship the
              multi-tenant white-label product.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {[
                ['Raise', 'US$ 750k'],
                ['Valuation', 'On request'],
                ['Use of funds', '60% growth · 30% product · 10% ops'],
                ['Runway', '18 months to Series A'],
              ].map(([k, v]) => (
                <div key={k} className="p-4 rounded-xl bg-white border border-[#0F2A44]/5">
                  <div className="text-xs uppercase tracking-wider text-[#E8732C] font-bold">{k}</div>
                  <div className="font-bold text-[#0F2A44] mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-white border border-[#0F2A44]/5">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-5 h-5 text-[#2A8A8F]" />
                <h3 className="font-bold text-[#0F2A44]">Use of funds</h3>
              </div>
              <ul className="space-y-2 text-sm text-[#0F2A44]/80">
                <li>• Growth & GTM in SA, LATAM, SE Asia ($450k)</li>
                <li>• Multi-tenant white-label + enterprise SSO ($150k)</li>
                <li>• ZAZI Pro AI tier + custom model training ($75k)</li>
                <li>• Compliance & infra hardening ($75k)</li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-[#0F2A44]/5">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-[#2A8A8F]" />
                <h3 className="font-bold text-[#0F2A44]">Risk mitigations already in place</h3>
              </div>
              <ul className="space-y-2 text-sm text-[#0F2A44]/80">
                <li>• MP1 manual-send architecture — zero WhatsApp ban risk at scale</li>
                <li>• RLS-enforced multi-tenancy from day one</li>
                <li>• Multi-tier AI fallback for vendor independence</li>
                <li>• Company-agnostic schema — not tied to one MLM brand</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto pb-24">
        <div
          className="rounded-3xl p-12 text-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white">Let's talk.</h2>
          <p className="mt-4 text-white/90 max-w-xl mx-auto">
            Detailed deck, financial model, traction data, and product demo available under NDA.
          </p>
          <a
            href="mailto:invest@getwellgrow.app"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-[#F8EFE2] text-[#0F2A44] font-bold transition"
          >
            invest@getwellgrow.app <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </>
  );
}
