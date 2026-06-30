import { Link } from 'react-router-dom';
import { ArrowRight, Upload, Users, MessageCircle, TrendingUp, Trophy, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    n: '01', icon: Upload,
    title: 'Bring your downline in',
    headline: 'From any MLM backoffice CSV to a clean CRM in under 5 minutes.',
    body:
      "Drop a CSV, XLSX, or XLS file in. ZAZI AI reads your column headers and maps them to the right CRM fields automatically — no manual matching. Duplicates are detected on normalised phone numbers and email addresses. Existing contacts merge cleanly using safe-merge (we never overwrite a non-empty field), new contacts are inserted, and you get a created / updated / skipped summary before anything commits.",
    bullets: [
      'Drag-and-drop CSV / XLSX / XLS',
      'AI column-mapping with confidence indicators',
      'Phone + email normalisation (+27, +266, more)',
      'Safe-merge upsert — never destructive',
      'Audit row written for every imported record',
    ],
  },
  {
    n: '02', icon: Users,
    title: 'See every leg, every temperature',
    headline: 'Your entire downline on one page — hot, warm, cold, expired, activated.',
    body:
      "Every contact carries a lead temperature, lead type, lead path, and focus area. The Contacts page lets you filter by any combination, bulk-tag, bulk-export, or open a slide-out drawer with the full timeline of every interaction. Manager legs are colour-coded so you can scan a team of 1,000+ and instantly see where the heat is.",
    bullets: [
      'Five lead-temperature buckets (Hot → Expired)',
      'Lead path + focus area filters',
      'Slide-out Contact Drawer with timeline',
      'Bulk actions with confirmation guards',
      'CSV export with current filter applied',
    ],
  },
  {
    n: '03', icon: MessageCircle,
    title: 'Talk to them — without burning out',
    headline: 'Send the right message to the right person, manually but at machine speed.',
    body:
      "Open the Birthday queue or the WhatsApp page. Pick a template from the 13-category library — welcome, follow-up, birthday, appreciation, activation, upgrade, event, recovery, and more. Merge fields personalise it, your signature appends automatically, and an Open Graph preview brands every link. Every send is MP1: one click → review → confirm → one Maytapi send. No bulk. No spam. No platform bans.",
    bullets: [
      '13 template categories with merge fields',
      'ZAZI AI drafts the words — you stay in control',
      'Branded link preview (Open Graph)',
      'Maytapi integration with verified message IDs',
      'MP1.5 Assisted Send: send → next, send → next',
    ],
  },
  {
    n: '04', icon: TrendingUp,
    title: 'Track activity & PV in real time',
    headline: 'Daily discipline, monthly appreciation, year-round momentum.',
    body:
      "The Activities page shows your daily goal progress (calls, emails, WhatsApp) with a weekly multiplier. Neglected contacts surface automatically after 7+ days. Smart Paste lets you import order text from any backoffice — ZAZI parses it, splits Activity PV from Upgrade PV, applies ZAR conversion. Monthly Activity Push turns your monthly purchase report into a personalised appreciation queue, ready to send one-by-one.",
    bullets: [
      'Daily goals with weekly multiplier',
      'Neglected-contact surfacing (7+ days)',
      'Smart Paste for orders + monthly activity',
      'Activity PV / Upgrade PV split automatically',
      'Per-contact appreciation messages',
    ],
  },
  {
    n: '05', icon: Trophy,
    title: 'Run the 90-Day Momentum cycle',
    headline: "RESET & RISE methodology, productised end-to-end.",
    body:
      "Five phases — Pre-Launch, Launch, Post-Launch, Build, Scale. Each phase has its own daily targets, contact segmentation, and message templates. ZAZI tracks your phase progression. By Day 90 your downline has compounded — measurably. Then you reset and ride again.",
    bullets: [
      'Pre-Launch → Launch → Post-Launch → Build → Scale',
      'Daily activity targets per phase',
      'Phase-specific message templates',
      'Progression tracked by ZAZI automatically',
    ],
  },
];

export function HowItWorks() {
  return (
    <>
      <section className="container mx-auto pt-16 pb-10">
        <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">How it works</span>
        <h1 className="text-4xl md:text-5xl font-bold mt-3 max-w-3xl leading-tight text-[#0F2A44]">
          From cold import to compounding downline in five steps.
        </h1>
        <p className="mt-5 text-lg text-[#0F2A44]/75 max-w-2xl">
          GetWell Grow is opinionated about one thing: every downline deserves a real conversation.
          Here's exactly how the system gets you there — what you do, what we do, and what changes.
        </p>
      </section>

      <section className="container mx-auto py-6">
        <div className="space-y-6">
          {steps.map(({ n, icon: Icon, title, headline, body, bullets }) => (
            <div
              key={n}
              className="grid md:grid-cols-[140px_1fr] gap-6 p-7 md:p-9 rounded-3xl bg-white border border-[#0F2A44]/5 shadow-sm"
            >
              <div>
                <div
                  className="text-5xl font-extrabold bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
                >
                  {n}
                </div>
                <div className="mt-3 w-12 h-12 rounded-xl flex items-center justify-center bg-[#2A8A8F]/10">
                  <Icon className="w-6 h-6 text-[#2A8A8F]" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#0F2A44]">{title}</h2>
                <p className="text-[#E8732C] font-semibold mt-1">{headline}</p>
                <p className="mt-4 text-[#0F2A44]/80 leading-relaxed">{body}</p>
                <ul className="mt-5 grid sm:grid-cols-2 gap-2">
                  {bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-sm text-[#0F2A44]/75">
                      <CheckCircle2 className="w-4 h-4 text-[#2A8A8F] mt-0.5 flex-shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto pt-12 pb-20">
        <div className="rounded-3xl bg-white border border-[#0F2A44]/10 p-10">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0F2A44]">Designed for any MLM company</h2>
          <p className="mt-3 text-[#0F2A44]/75 max-w-2xl">
            GetWell Grow is company-agnostic. APLGO, Forever Living, Herbalife, Amway, Atomy,
            Tiens — if your business runs on downlines, this CRM grows with you. Field labels,
            rank tiers, and PV formulas are configurable on request.
          </p>
          <Link
            to="/signin"
            className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white font-bold transition shadow-lg"
            style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
          >
            Start your free workspace <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
