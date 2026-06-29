import { Link } from 'react-router-dom';
import {
  ArrowRight, MessageCircle, Cake, Users, TrendingUp, Sparkles,
  ShieldCheck, Zap, BarChart3, Bot, Quote, CheckCircle2,
} from 'lucide-react';
import logo from '@/assets/getwellgrow-logo.png';

export function Home() {
  return (
    <>
      {/* Hero — light, split, with logo art on the right */}
      <section className="relative overflow-hidden">
        {/* soft warm wash */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 85% 20%, rgba(232,115,44,0.18), transparent 55%), radial-gradient(circle at 10% 90%, rgba(42,138,143,0.18), transparent 55%)',
          }}
        />
        <div className="container mx-auto py-16 lg:py-24 relative">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">
            {/* LEFT — copy */}
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-white border border-[#2A8A8F]/20 text-[#2A8A8F] mb-7 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-[#E8732C]" />
                AI Prospector · WhatsApp-first · Built for Africa
              </span>
              <h1 className="text-[2.6rem] md:text-6xl font-extrabold leading-[1.05] tracking-tight text-[#0F2A44]">
                Grow your <span className="text-[#2A8A8F]">team</span>.
                <br />
                Grow your <span className="text-[#E8732C]">wellness</span>.
              </h1>
              <p className="mt-6 text-lg text-[#0F2A44]/75 max-w-xl leading-relaxed">
                GetWell Grow is the downline-first CRM and autonomous Prospector for
                network-marketing teams. We help you talk to every downline, on time,
                every time — so each leg compounds into real momentum, real volume,
                and real income.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/signin"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-white font-semibold transition shadow-[0_14px_30px_-12px_rgba(42,138,143,0.55)] hover:shadow-[0_18px_36px_-12px_rgba(232,115,44,0.6)]"
                  style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
                >
                  Open the App <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/flagship"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border-2 border-[#0F2A44]/15 hover:border-[#2A8A8F]/40 text-[#0F2A44] font-semibold bg-white/60 hover:bg-white transition"
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
                    <div className="text-2xl md:text-3xl font-extrabold text-[#2A8A8F]">{n}</div>
                    <div className="text-[11px] uppercase tracking-wider text-[#0F2A44]/55 mt-1 font-semibold">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — logo art card */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[#2A8A8F]/20 via-[#E8732C]/10 to-transparent blur-2xl" />
              <div className="relative rounded-[2rem] bg-white shadow-[0_30px_80px_-30px_rgba(15,42,68,0.35)] border border-white p-8 lg:p-10">
                <img
                  src={logo}
                  alt="GetWell Grow — Grow your team, grow your wellness"
                  className="w-full h-auto object-contain mx-auto max-h-[480px]"
                />
                <div className="mt-4 text-center">
                  <div className="text-xs uppercase tracking-[0.2em] font-semibold text-[#0F2A44]/50">
                    Built for every MLM company
                  </div>
                </div>
              </div>
              {/* floating mini-badge */}
              <div className="hidden md:flex absolute -bottom-5 -left-5 items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-xl border border-[#0F2A44]/5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2A8A8F, #E8732C)' }}>
                  <Cake className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs text-[#0F2A44]/55 font-medium">Today's birthdays</div>
                  <div className="text-sm font-bold text-[#0F2A44]">7 ready to send</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain → Promise */}
      <section className="py-16 bg-white border-y border-[#0F2A44]/5">
        <div className="container mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight text-[#0F2A44]">
              Network marketing dies in the gaps between conversations.
            </h2>
            <p className="mt-4 text-[#0F2A44]/70 text-lg">
              Forgotten birthdays. Inactive uplines. Distorted phone numbers. Followups
              you meant to send last Tuesday. GetWell Grow closes every one of those
              gaps with a system that quietly does the remembering for you.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Users, t: 'Every downline visible', d: 'Hot, warm, cold, expired — sorted, scored, prioritised.', c: '#2A8A8F' },
              { icon: Cake, t: 'No missed birthdays', d: 'Daily birthday queue with one-click personalised sends.', c: '#E8732C' },
              { icon: MessageCircle, t: 'Manual-safe WhatsApp', d: 'MP1 one-by-one sends — compliant, human, never spammy.', c: '#2A8A8F' },
              { icon: TrendingUp, t: '90-day momentum run', d: 'RESET & RISE methodology, mapped to your daily targets.', c: '#E8732C' },
            ].map(({ icon: Icon, t, d, c }) => (
              <div key={t} className="p-5 rounded-2xl bg-[#F8EFE2]/60 border border-[#0F2A44]/5 hover:border-[#2A8A8F]/30 hover:bg-white transition">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${c}15` }}>
                  <Icon className="w-5 h-5" style={{ color: c }} />
                </div>
                <div className="font-bold text-[#0F2A44]">{t}</div>
                <div className="text-sm text-[#0F2A44]/65 mt-1">{d}</div>
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
              <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">The platform</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 text-[#0F2A44]">Everything a downline leader needs</h2>
            </div>
            <Link to="/features" className="text-sm text-[#2A8A8F] hover:text-[#1C5A5E] inline-flex items-center gap-1 font-semibold">
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
                className="p-6 rounded-2xl bg-white border border-[#0F2A44]/5 hover:border-[#2A8A8F]/40 hover:shadow-lg transition"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#2A8A8F]/10 mb-4">
                  <Icon className="w-5 h-5 text-[#2A8A8F]" />
                </div>
                <div className="font-bold text-[#0F2A44]">{t}</div>
                <p className="text-sm text-[#0F2A44]/65 mt-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flagship spotlight */}
      <section className="py-20 bg-white border-y border-[#0F2A44]/5">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Flagship</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 leading-tight text-[#0F2A44]">
              Birthdays + Activities = compounding loyalty
            </h2>
            <p className="mt-4 text-[#0F2A44]/75 text-lg">
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
                  <CheckCircle2 className="w-5 h-5 text-[#2A8A8F] mt-0.5 flex-shrink-0" />
                  <span className="text-[#0F2A44]/80">{l}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/flagship"
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold transition"
              style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
            >
              Deep dive into the flagship <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="relative">
            <div className="rounded-3xl bg-gradient-to-br from-[#F8EFE2] to-white border border-[#0F2A44]/10 p-6 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cake className="w-5 h-5 text-[#E8732C]" />
                  <span className="font-bold text-[#0F2A44]">Today's birthdays</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#2A8A8F]/10 text-[#2A8A8F] font-semibold">7 ready</span>
              </div>
              {['Nomvula M. — Diamond leg', 'Sipho K. — Activated', 'Lebo P. — Promoter'].map((n) => (
                <div key={n} className="p-3 rounded-xl bg-white border border-[#0F2A44]/5 flex justify-between items-center">
                  <span className="text-sm text-[#0F2A44]">{n}</span>
                  <span className="text-xs text-[#E8732C] font-semibold">Send →</span>
                </div>
              ))}
              <div className="text-xs text-[#0F2A44]/55 text-center pt-2 font-medium">
                Phone health: <span className="text-[#2A8A8F] font-bold">94%</span>
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
              <div key={t} className="p-6 rounded-2xl bg-white border border-[#0F2A44]/5">
                <Icon className="w-6 h-6 text-[#E8732C] mb-3" />
                <div className="font-bold text-[#0F2A44]">{t}</div>
                <p className="text-sm text-[#0F2A44]/65 mt-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 bg-white border-y border-[#0F2A44]/5">
        <div className="container mx-auto max-w-3xl text-center">
          <Quote className="w-10 h-10 mx-auto text-[#E8732C] mb-4" />
          <p className="text-xl md:text-2xl text-[#0F2A44] leading-relaxed">
            "I used to lose three deals a month because I forgot to follow up. GetWell
            Grow remembers every contact, every birthday, every promise. My team
            doubled in six months."
          </p>
          <div className="mt-6 text-sm text-[#0F2A44]/55 font-medium">
            Vanto — Diamond leader, APLGO Africa
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto">
          <div
            className="rounded-3xl p-12 text-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
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
              className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-[#F8EFE2] text-[#0F2A44] font-bold transition"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
