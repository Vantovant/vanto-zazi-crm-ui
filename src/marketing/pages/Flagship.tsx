import { Link } from 'react-router-dom';
import { Cake, BarChart3, CheckCircle2, ArrowRight, Phone, MessageCircle, Clock, Sparkles } from 'lucide-react';

export function Flagship() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-50"
          style={{ background: 'radial-gradient(circle at 80% 30%, rgba(232,115,44,0.35), transparent 55%), radial-gradient(circle at 10% 80%, rgba(42,138,143,0.30), transparent 55%)' }} />
        <div className="container mx-auto pt-20 pb-12 relative">
          <span className="text-xs uppercase tracking-widest text-brand-orange-400 font-semibold">Flagship modules</span>
          <h1 className="text-4xl md:text-6xl font-bold mt-3 max-w-3xl leading-tight">
            The two modules that change the math of network marketing.
          </h1>
          <p className="mt-5 text-lg text-brand-sand/80 max-w-2xl">
            Birthdays and Activities are not features. They are the heartbeat of
            relationship-based selling. We rebuilt them from the ground up so they run
            themselves — without ever sending a single message you didn't approve.
          </p>
        </div>
      </section>

      {/* Birthdays */}
      <section className="border-t border-white/5 bg-[#0B2138] py-20">
        <div className="container mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-orange-500/20 flex items-center justify-center">
              <Cake className="w-7 h-7 text-brand-orange-400" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-brand-orange-400 font-semibold">Flagship I</span>
              <h2 className="text-3xl md:text-4xl font-bold">Birthday Engine</h2>
            </div>
          </div>

          <p className="text-lg text-brand-sand/80 max-w-3xl">
            Every birthday is a touchpoint. Every missed birthday is a deal evaporating
            quietly. The Birthday Engine makes "missed" impossible.
          </p>

          <div className="mt-10 grid lg:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/5">
              <h3 className="font-semibold text-white text-lg">Sendability queue</h3>
              <p className="text-sm text-brand-sand/70 mt-2">
                Every upcoming birthday lands in one of four lanes — Ready, Missing
                Phone, Unmatched, Duplicate. The operator works one lane at a time.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-brand-sand/80">
                {[
                  'Phone health score (target: ≥80%)',
                  '"Open next unresolved" workflow',
                  'Inline Fix / Skip / Snooze actions',
                  'Local audit trail of every manual repair',
                ].map((b) => (
                  <li key={b} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal-300 mt-0.5" />{b}</li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/5">
              <h3 className="font-semibold text-white text-lg">Smart Phone Rescue</h3>
              <p className="text-sm text-brand-sand/70 mt-2">
                When a birthday has no phone, GetWell Grow searches the CRM, the order
                history, and the original paste text for a match — with confidence
                tiers and duplicate-collision warnings.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-brand-sand/80">
                {[
                  'Multi-source candidate scoring',
                  'Keyboard shortcuts for power operators',
                  'Safe merge — never overwrites existing data',
                  'Bulk "Update contact phones from birthdays"',
                ].map((b) => (
                  <li key={b} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-brand-teal-300 mt-0.5" />{b}</li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/5">
              <h3 className="font-semibold text-white text-lg">Smart Paste import</h3>
              <p className="text-sm text-brand-sand/70 mt-2">
                Paste any list with Name, Date, optional Phone, optional APLGO ID.
                Unmatched rows auto-create minimal contacts. Matched rows backfill
                phone numbers via safe merge.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/5">
              <h3 className="font-semibold text-white text-lg">MP1.5 Assisted Send</h3>
              <p className="text-sm text-brand-sand/70 mt-2">
                One click pre-fills a personalised message. Operator reviews, hits
                Send. The system calls Maytapi, logs a real message ID, marks
                congratulated, and opens the next eligible birthday. Manual. Safe. Fast.
              </p>
            </div>
          </div>

          <div className="mt-10 p-6 rounded-2xl border border-brand-orange-500/30 bg-brand-orange-500/5 flex gap-4">
            <Sparkles className="w-6 h-6 text-brand-orange-400 flex-shrink-0 mt-1" />
            <div>
              <div className="font-semibold text-white">The MP1 promise</div>
              <p className="text-sm text-brand-sand/80 mt-1">
                Every WhatsApp send is one entry → one review → one confirm → one
                Maytapi send. No bulk. No queues. No cron. No automation that puts your
                number at risk. Human-in-the-loop, by design.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Activities */}
      <section className="py-20">
        <div className="container mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-teal-500/20 flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-brand-teal-300" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-brand-orange-400 font-semibold">Flagship II</span>
              <h2 className="text-3xl md:text-4xl font-bold">Activity Engine</h2>
            </div>
          </div>

          <p className="text-lg text-brand-sand/80 max-w-3xl">
            Network marketing is daily, not monthly. The Activity Engine turns
            consistency into compounding.
          </p>

          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Clock, t: 'Daily goals', d: 'Calls, emails, WhatsApp targets. Weekly multiplier logic for momentum visibility.' },
              { icon: Phone, t: 'Neglected alerts', d: 'Any contact untouched for 7+ days surfaces in priority order by lead type and leg.' },
              { icon: MessageCircle, t: 'Monthly Activity Push', d: 'Smart Paste your monthly activity report. Get a personalised appreciation queue, ready to send one-by-one.' },
              { icon: Sparkles, t: 'Appreciation Engine', d: 'Data-driven message tones based on contact context. Sequential bulk preparation, manual sequential send.' },
              { icon: CheckCircle2, t: 'Activity telemetry', d: 'Every user action logged. Build reports on what actually moves the needle.' },
              { icon: BarChart3, t: 'PV tracking', d: 'Activity PV and Upgrade PV tracked separately. ZAR conversion applied automatically.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="p-6 rounded-2xl bg-white/[0.04] border border-white/5">
                <Icon className="w-6 h-6 text-brand-teal-300 mb-3" />
                <div className="font-semibold text-white">{t}</div>
                <p className="text-sm text-brand-sand/70 mt-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Together */}
      <section className="bg-[#0B2138] border-y border-white/5 py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Together: a relationship flywheel</h2>
          <p className="mt-5 text-brand-sand/80">
            A birthday becomes a conversation. A conversation becomes an activity.
            An activity becomes a sale. A sale becomes a rank-up. The flywheel turns,
            and your downline grows — every single week of every single month.
          </p>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            {['Birthday sent', 'Conversation logged', 'Order placed', 'Rank advanced'].map((s, i) => (
              <div key={s} className="p-4 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-xs text-brand-orange-400 font-bold">STEP {i + 1}</div>
                <div className="font-semibold text-white mt-1">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto py-24">
        <div className="rounded-3xl p-12 text-center" style={{ background: 'var(--gradient-brand)' }}>
          <h2 className="text-3xl md:text-4xl font-bold text-white">Run the flagship in your workspace.</h2>
          <Link
            to="/signin"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-md bg-[#0F2A44] hover:bg-[#0B2138] text-white font-semibold transition"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
