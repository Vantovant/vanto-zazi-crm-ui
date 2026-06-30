import { Link } from 'react-router-dom';
import {
  Cake, BarChart3, CheckCircle2, ArrowRight, Phone, MessageCircle,
  Clock, Sparkles, ShieldCheck, Users, TrendingUp,
} from 'lucide-react';

export function Flagship() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 80% 30%, rgba(232,115,44,0.18), transparent 55%), radial-gradient(circle at 10% 80%, rgba(42,138,143,0.16), transparent 55%)',
          }}
        />
        <div className="container mx-auto pt-16 pb-12 relative">
          <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Flagship modules</span>
          <h1 className="text-4xl md:text-6xl font-bold mt-3 max-w-3xl leading-[1.1] text-[#0F2A44]">
            The two modules that change the math of network marketing.
          </h1>
          <p className="mt-5 text-lg text-[#0F2A44]/75 max-w-2xl">
            Birthdays and Activities are not features. They are the heartbeat of relationship-based
            selling. We rebuilt them so they run themselves — without ever sending a single message
            you didn't approve.
          </p>
        </div>
      </section>

      {/* BIRTHDAY ENGINE */}
      <section className="bg-white border-y border-[#0F2A44]/5 py-20">
        <div className="container mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#E8732C18' }}>
              <Cake className="w-7 h-7 text-[#E8732C]" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Flagship I</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0F2A44]">Birthday Engine</h2>
            </div>
          </div>

          <p className="text-lg text-[#0F2A44]/75 max-w-3xl">
            Every birthday is a touchpoint. Every missed birthday is a deal evaporating quietly.
            The Birthday Engine makes "missed" impossible — and turns birthday wishes into a
            measurable revenue stream.
          </p>

          <div className="mt-10 grid lg:grid-cols-2 gap-6">
            {[
              {
                icon: CheckCircle2, t: 'Sendability queue',
                d: "Every upcoming birthday lands in one of four lanes. You work one lane at a time — never juggling.",
                items: [
                  'Ready to send — has phone, matched contact, no duplicates',
                  'Missing phone — needs a number before you can message',
                  'Unmatched — pasted name not yet linked to a CRM contact',
                  'Duplicate risk — multiple contacts share the same name/phone',
                ],
              },
              {
                icon: Phone, t: 'Smart Phone Rescue',
                d: "When a birthday has no phone, GetWell Grow searches CRM, order history, and the original paste text for a match — with confidence tiers and duplicate-collision warnings.",
                items: [
                  'Multi-source candidate scoring (high / medium / low)',
                  'Keyboard shortcuts for power operators',
                  'Safe merge — never overwrites existing data',
                  'Bulk "Update contact phones from birthdays"',
                ],
              },
              {
                icon: Sparkles, t: 'Smart Paste import',
                d: "Paste any list with Name, Date, optional Phone, optional APLGO ID. Unmatched rows auto-create minimal contacts. Matched rows backfill phone numbers via safe merge.",
                items: [
                  'Accepts pasted text from any backoffice',
                  'Optional 6th column for phone backfill',
                  'Auto-creates minimal contacts for unmatched names',
                  'pasted_phone column stored for later rescue',
                ],
              },
              {
                icon: MessageCircle, t: 'MP1.5 Assisted Send',
                d: "One click pre-fills a personalised message. Operator reviews, hits Send. The system calls Maytapi, logs a real message ID, marks congratulated, and opens the next eligible birthday.",
                items: [
                  'Pre-filled merge-field message (name, salutation, lead type)',
                  'Real Maytapi message ID logged for every send',
                  'Automatic next-birthday advance after each send',
                  'MP1-compliant — manual confirmation always required',
                ],
              },
            ].map(({ icon: Icon, t, d, items }) => (
              <div key={t} className="p-6 rounded-2xl bg-[#F8EFE2]/60 border border-[#0F2A44]/5">
                <div className="flex items-center gap-3 mb-3">
                  <Icon className="w-6 h-6 text-[#E8732C]" />
                  <h3 className="font-bold text-[#0F2A44] text-lg">{t}</h3>
                </div>
                <p className="text-sm text-[#0F2A44]/70">{d}</p>
                <ul className="mt-4 space-y-2 text-sm text-[#0F2A44]/80">
                  {items.map((b) => (
                    <li key={b} className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#2A8A8F] mt-0.5 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 rounded-2xl border border-[#E8732C]/30 bg-[#E8732C]/5 flex gap-4">
            <ShieldCheck className="w-7 h-7 text-[#E8732C] flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#0F2A44]">The MP1 promise</div>
              <p className="text-sm text-[#0F2A44]/75 mt-1">
                Every WhatsApp send is one entry → one review → one confirm → one Maytapi send.
                No bulk. No queues. No cron. No automation that puts your number at risk.
                Human-in-the-loop, by design.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVITY ENGINE */}
      <section className="py-20">
        <div className="container mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#2A8A8F18' }}>
              <BarChart3 className="w-7 h-7 text-[#2A8A8F]" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Flagship II</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0F2A44]">Activity Engine</h2>
            </div>
          </div>

          <p className="text-lg text-[#0F2A44]/75 max-w-3xl">
            Network marketing is daily, not monthly. The Activity Engine turns consistency into
            compounding — by making the right next action obvious every single morning.
          </p>

          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Clock, t: 'Daily goals',
                d: "Set targets for calls, emails, and WhatsApp messages. The weekly multiplier shows your real momentum at a glance. Streaks unlock visual badges, and ZAZI nudges you the moment you fall behind.",
              },
              {
                icon: Phone, t: 'Neglected alerts',
                d: "Any contact untouched for 7+ days surfaces in priority order by lead type and manager leg. Hot prospects bubble up first. Cold contacts are batched for weekly attention.",
              },
              {
                icon: MessageCircle, t: 'Monthly Activity Push',
                d: "Paste your APLGO monthly purchase report. The parser splits Level / User ID / Amount automatically, dedupes by month, and queues every active distributor for a personal appreciation message.",
              },
              {
                icon: Sparkles, t: 'Appreciation Engine',
                d: "Message tones adapt to the contact: bigger thanks for top performers, encouragement for slow movers, re-activation for dormant. Sequential bulk preparation, manual sequential send.",
              },
              {
                icon: CheckCircle2, t: 'Activity telemetry',
                d: "Every operator action is logged to user_activity — what you opened, what you sent, what you skipped. Build reports on what actually moves the needle for your downline.",
              },
              {
                icon: BarChart3, t: 'PV tracking',
                d: "Activity PV and Upgrade PV tracked separately. ZAR conversion applied automatically. Roll up by week, month, leg, or rank.",
              },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="p-6 rounded-2xl bg-white border border-[#0F2A44]/5 hover:border-[#2A8A8F]/40 hover:shadow-md transition">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: '#2A8A8F18' }}>
                  <Icon className="w-5 h-5 text-[#2A8A8F]" />
                </div>
                <div className="font-bold text-[#0F2A44]">{t}</div>
                <p className="text-sm text-[#0F2A44]/70 mt-2 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flywheel */}
      <section className="bg-white border-y border-[#0F2A44]/5 py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">The flywheel</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 text-[#0F2A44]">Birthdays + Activities = compounding loyalty</h2>
          <p className="mt-5 text-[#0F2A44]/75 max-w-2xl mx-auto">
            A birthday becomes a conversation. A conversation becomes an activity. An activity
            becomes a sale. A sale becomes a rank-up. The flywheel turns, and your downline grows
            — every single week of every single month.
          </p>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            {[
              { i: Cake, s: 'Birthday sent' },
              { i: MessageCircle, s: 'Conversation logged' },
              { i: Users, s: 'Order placed' },
              { i: TrendingUp, s: 'Rank advanced' },
            ].map(({ i: Icon, s }, idx) => (
              <div key={s} className="p-5 rounded-2xl bg-[#F8EFE2]/70 border border-[#0F2A44]/5">
                <div className="text-xs text-[#E8732C] font-bold tracking-wider">STEP {idx + 1}</div>
                <Icon className="w-6 h-6 text-[#2A8A8F] mt-3" />
                <div className="font-bold text-[#0F2A44] mt-2">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto py-24">
        <div
          className="rounded-3xl p-12 text-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white">Run the flagship in your workspace.</h2>
          <Link
            to="/signin"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-[#F8EFE2] text-[#0F2A44] font-bold transition"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
