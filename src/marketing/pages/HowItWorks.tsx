import { Link } from 'react-router-dom';
import { ArrowRight, Upload, Users, MessageCircle, TrendingUp, Trophy } from 'lucide-react';

const steps = [
  {
    n: '01',
    icon: Upload,
    title: 'Bring your downline in',
    body:
      'Upload a CSV from any MLM backoffice. Our AI maps the columns automatically. Duplicates are detected by phone and email — your existing contacts merge cleanly, new ones are inserted, and nothing is overwritten without you saying so.',
  },
  {
    n: '02',
    icon: Users,
    title: 'See every leg, every temperature',
    body:
      'Hot, warm, cold, expired. Activated, registered, prospect. Every downline is tagged, scored, and visible on one page. Filter by leg, status, focus area, or lead path.',
  },
  {
    n: '03',
    icon: MessageCircle,
    title: 'Talk to them — without burning out',
    body:
      'Open the Birthday queue or WhatsApp page, pick a template, and send. Every message is one-by-one and human-confirmed (MP1 rule). No bulk, no spam, no platform bans. ZAZI AI drafts the words — you stay in control.',
  },
  {
    n: '04',
    icon: TrendingUp,
    title: 'Track activity & PV in real time',
    body:
      'Daily goals on the Activities page. Monthly Activity Push sends personal appreciation to every active distributor. Smart Paste imports order text from any backoffice. PV and ZAR are split between Activity and Upgrade automatically.',
  },
  {
    n: '05',
    icon: Trophy,
    title: 'Run the 90-Day Momentum cycle',
    body:
      'Five phases, daily targets, phase-appropriate messages. Built on the RESET & RISE methodology. By Day 90 your downline has compounded — and you can reset and ride again.',
  },
];

export function HowItWorks() {
  return (
    <>
      <section className="container mx-auto pt-20 pb-10">
        <span className="text-xs uppercase tracking-widest text-brand-orange-400 font-semibold">How it works</span>
        <h1 className="text-4xl md:text-5xl font-bold mt-3 max-w-3xl leading-tight">
          From cold import to compounding downline in five steps.
        </h1>
        <p className="mt-5 text-lg text-brand-sand/80 max-w-2xl">
          GetWell Grow is opinionated about one thing: every downline deserves a
          real conversation. Here's how the system gets you there.
        </p>
      </section>

      <section className="container mx-auto py-10">
        <div className="space-y-8">
          {steps.map(({ n, icon: Icon, title, body }) => (
            <div
              key={n}
              className="grid md:grid-cols-[120px_1fr] gap-6 p-6 md:p-8 rounded-2xl bg-white/[0.03] border border-white/5"
            >
              <div>
                <div className="text-5xl font-bold brand-gradient-text">{n}</div>
                <Icon className="w-8 h-8 text-brand-teal-300 mt-3" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{title}</h2>
                <p className="mt-3 text-brand-sand/80 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto py-20">
        <div className="rounded-3xl border border-white/10 p-10 bg-[#0B2138]">
          <h2 className="text-2xl md:text-3xl font-bold">Designed for any MLM company</h2>
          <p className="mt-3 text-brand-sand/80 max-w-2xl">
            GetWell Grow is company-agnostic. APLGO, Forever Living, Herbalife, Amway,
            Atomy, Tiens — if your business runs on downlines, this CRM grows with you.
          </p>
          <Link
            to="/signin"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-md bg-brand-orange-500 hover:bg-brand-orange-600 text-white font-semibold transition"
          >
            Start your free workspace <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
