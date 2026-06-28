import { Link } from 'react-router-dom';
import {
  ArrowRight, MessageCircle, Cake, Users, TrendingUp, Sparkles,
  ShieldCheck, Zap, BarChart3, Bot, Quote, CheckCircle2,
} from 'lucide-react';

export function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            background:
              'radial-gradient(circle at 15% 20%, rgba(42,138,143,0.35), transparent 55%), radial-gradient(circle at 85% 80%, rgba(232,115,44,0.30), transparent 55%)',
          }}
        />
        <div className="container mx-auto py-20 lg:py-28 relative">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-brand-sand/80 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-brand-orange-400" />
              Built for every MLM company — not just one
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
              Grow your <span className="text-brand-teal-300">team</span>.
              <br />
              Grow your <span className="text-brand-orange-400">wellness</span>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-brand-sand/80 max-w-2xl">
              GetWell Grow is the downline-first CRM for network marketers. We help you
              talk to every downline, on time, every time — so each leg compounds into
              real momentum, real volume, and real income.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/signin"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-brand-orange-500 hover:bg-brand-orange-600 text-white font-semibold transition"
              >
                Start growing today <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/flagship"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-white/15 hover:border-white/30 text-brand-sand hover:text-white transition"
              >
                See the flagship modules
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
              {[
                ['1,000+', 'Contacts managed'],
                ['90-day', 'Momentum cycle'],
                ['MP1 safe', 'Manual-first sends'],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="text-2xl font-bold text-brand-teal-300">{n}</div>
                  <div className="text-xs text-brand-sand/60 mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pain → Promise */}
      <section className="py-16 border-t border-white/5 bg-[#0B2138]">
        <div className="container mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              Network marketing dies in the gaps between conversations.
            </h2>
            <p className="mt-4 text-brand-sand/70">
              Forgotten birthdays. Inactive uplines. Distorted phone numbers. Followups
              you meant to send last Tuesday. GetWell Grow closes every one of those
              gaps with a system that quietly does the remembering for you.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Users, t: 'Every downline visible', d: 'Hot, warm, cold, expired — sorted, scored, prioritised.' },
              { icon: Cake, t: 'No missed birthdays', d: 'Daily birthday queue with one-click personalised sends.' },
              { icon: MessageCircle, t: 'Manual-safe WhatsApp', d: 'MP1 one-by-one sends — compliant, human, never spammy.' },
              { icon: TrendingUp, t: '90-day momentum run', d: 'RESET & RISE methodology, mapped to your daily targets.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="p-4 rounded-xl bg-white/5 border border-white/5">
                <Icon className="w-5 h-5 text-brand-orange-400 mb-2" />
                <div className="font-semibold text-white">{t}</div>
                <div className="text-sm text-brand-sand/70 mt-1">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules teaser */}
      <section className="py-20">
        <div className="container mx-auto">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <span className="text-xs uppercase tracking-widest text-brand-orange-400 font-semibold">The platform</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">Everything a downline leader needs</h2>
            </div>
            <Link to="/features" className="text-sm text-brand-teal-300 hover:text-brand-teal-200 inline-flex items-center gap-1">
              Explore all modules <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Users, t: 'Contacts', d: '22+ fields, duplicate detection, lead temperature, smart import.' },
              { icon: Cake, t: 'Birthdays', d: 'Daily queue, sendability score, smart phone rescue.' },
              { icon: MessageCircle, t: 'WhatsApp', d: '13-category template library with merge fields and branded link preview.' },
              { icon: BarChart3, t: 'Activities', d: 'Daily goals, neglected-contact alerts, monthly activity push.' },
              { icon: TrendingUp, t: 'Deals & PV', d: 'Rank-based valuation, Activity vs Upgrade PV, ZAR breakdowns.' },
              { icon: Bot, t: 'ZAZI AI Copilot', d: 'On every page. Briefs you, drafts messages, surfaces opportunities.' },
            ].map(({ icon: Icon, t, d }) => (
              <div
                key={t}
                className="p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/5 hover:border-brand-teal-500/40 transition"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-brand-teal-500/20 mb-4">
                  <Icon className="w-5 h-5 text-brand-teal-300" />
                </div>
                <div className="font-semibold text-white">{t}</div>
                <p className="text-sm text-brand-sand/70 mt-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flagship spotlight */}
      <section className="py-20 bg-gradient-to-br from-[#0B2138] to-[#0F2A44] border-y border-white/5">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs uppercase tracking-widest text-brand-orange-400 font-semibold">Flagship</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 leading-tight">
              Birthdays + Activities = compounding loyalty
            </h2>
            <p className="mt-4 text-brand-sand/80">
              Two modules drive 80% of the relationship value in network marketing. We
              built them to feel inevitable — not optional.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Birthday queue auto-categorises Ready, Missing Phone, Unmatched, Duplicate.',
                'Phone Rescue scans CRM, orders & paste history for sendable numbers.',
                'Monthly Activity Push thanks every active distributor — personally.',
                'MP1.5 Assisted Send: one click → send → next, with a real human in the loop.',
              ].map((l) => (
                <li key={l} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-teal-300 mt-0.5 flex-shrink-0" />
                  <span className="text-brand-sand/80">{l}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/flagship"
              className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-md bg-brand-teal-500 hover:bg-brand-teal-600 text-white font-semibold transition"
            >
              Deep dive into the flagship <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="relative">
            <div
              className="aspect-square rounded-3xl"
              style={{ background: 'var(--gradient-brand)' }}
            />
            <div className="absolute inset-4 rounded-2xl bg-[#0F2A44] border border-white/10 p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cake className="w-5 h-5 text-brand-orange-400" />
                  <span className="font-semibold">Today's birthdays</span>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-brand-teal-500/20 text-brand-teal-300">7 ready</span>
              </div>
              {['Nomvula M. — Diamond leg', 'Sipho K. — Activated', 'Lebo P. — Promoter'].map((n) => (
                <div key={n} className="p-3 rounded-lg bg-white/5 border border-white/5 flex justify-between items-center">
                  <span className="text-sm">{n}</span>
                  <span className="text-xs text-brand-orange-400">Send</span>
                </div>
              ))}
              <div className="text-xs text-brand-sand/60 text-center pt-2">
                Phone health: <span className="text-brand-teal-300 font-semibold">94%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why-now / trust */}
      <section className="py-20">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: ShieldCheck, t: 'Compliant by design', d: 'Every WhatsApp send is human-confirmed. No bulk, no spam, no platform bans.' },
              { icon: Zap, t: 'Fast where it matters', d: 'Smart paste from any backoffice. AI mapping. Duplicate-safe imports.' },
              { icon: Bot, t: 'AI you can trust', d: 'ZAZI never edits data without confirmation. Operator stays in control.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
                <Icon className="w-6 h-6 text-brand-orange-400 mb-3" />
                <div className="font-semibold text-white">{t}</div>
                <p className="text-sm text-brand-sand/70 mt-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 border-t border-white/5 bg-[#0B2138]">
        <div className="container mx-auto max-w-3xl text-center">
          <Quote className="w-10 h-10 mx-auto text-brand-orange-400 mb-4" />
          <p className="text-xl md:text-2xl text-brand-sand leading-relaxed">
            "I used to lose three deals a month because I forgot to follow up. GetWell
            Grow remembers every contact, every birthday, every promise. My team
            doubled in six months."
          </p>
          <div className="mt-6 text-sm text-brand-sand/60">
            Vanto — Diamond leader, APLGO Africa
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto">
          <div
            className="rounded-3xl p-12 text-center"
            style={{ background: 'var(--gradient-brand)' }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Your downline is waiting for a message.
            </h2>
            <p className="mt-4 text-white/90 max-w-xl mx-auto">
              Start free. Import your contacts in minutes. Send your first birthday
              today.
            </p>
            <Link
              to="/signin"
              className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-md bg-[#0F2A44] hover:bg-[#0B2138] text-white font-semibold transition"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
