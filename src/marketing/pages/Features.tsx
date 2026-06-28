import { Link } from 'react-router-dom';
import {
  Users, Cake, MessageCircle, BarChart3, TrendingUp, ShoppingCart,
  Package, Upload, Copy, Shield, Bot, Rocket, ArrowRight, CheckCircle2,
} from 'lucide-react';

type Module = {
  icon: typeof Users;
  title: string;
  tagline: string;
  bullets: string[];
};

const modules: Module[] = [
  {
    icon: BarChart3,
    title: 'Dashboard',
    tagline: 'Your daily command centre.',
    bullets: [
      '5 lead-temperature KPIs at a glance',
      'Order revenue summary (Paid, Pending, Activity & Upgrade PV)',
      'ZAZI AI morning briefing on what to do today',
      'Follow-ups due, meetings, hot leads needing action',
    ],
  },
  {
    icon: Users,
    title: 'Contacts',
    tagline: '22+ field downline database.',
    bullets: [
      'Lead temperature, type, path, focus area filters',
      'Bulk select, bulk delete, column visibility picker',
      'Real-time duplicate detection on phone & email',
      'Slide-out drawer with full timeline & quick actions',
    ],
  },
  {
    icon: Cake,
    title: 'Birthdays',
    tagline: 'Never miss a relationship moment.',
    bullets: [
      'Daily queue with Ready / Missing Phone / Unmatched / Duplicate categories',
      'Smart Paste import with optional phone column',
      'Phone Rescue: scans CRM, orders & paste history for matches',
      'MP1.5 Assisted Send — one click → send → next',
    ],
  },
  {
    icon: BarChart3,
    title: 'Activities',
    tagline: 'Daily discipline, weekly compounding.',
    bullets: [
      'Configurable goals: calls, emails, WhatsApp',
      'Neglected-contact alerts (7+ days dormant)',
      'Monthly Activity Push for personal appreciation',
      'Smart prioritisation by lead type & leg',
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Orders',
    tagline: 'Track every sale, every PV point.',
    bullets: [
      'Smart Paste — AI parses backoffice order text',
      'Status & product filters, date ranges, badges',
      'Activity PV vs Upgrade PV separation',
      'Offline order RPC with auto stock deduction',
    ],
  },
  {
    icon: Package,
    title: 'Inventory',
    tagline: 'Stock that ties into every offline order.',
    bullets: [
      'Per-product quantities',
      'Inline edit & delete',
      'Auto-deducts on offline orders',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Deals',
    tagline: 'Rank-based valuation pipeline.',
    bullets: [
      'Derived from contacts + orders',
      'Estimated value by rank (Diamond → Activation)',
      'Upgrade & Activity PV/ZAR breakdowns',
      'Export to CSV',
    ],
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    tagline: '13-category template library.',
    bullets: [
      'Merge fields for personalised messages',
      'Branded link preview (Open Graph)',
      'Per-user signature appended automatically',
      'Manual one-by-one sends (MP1 compliant)',
    ],
  },
  {
    icon: Upload,
    title: 'Import / Export',
    tagline: 'AI-mapped, duplicate-safe.',
    bullets: [
      'CSV/XLSX/XLS support',
      'AI auto-maps headers to CRM fields',
      'Upsert by phone & email',
      'Created / updated / skipped summary',
    ],
  },
  {
    icon: Copy,
    title: 'Duplicates',
    tagline: 'Self-cleaning database.',
    bullets: [
      'Auto-detection on normalised phone & email',
      'Merge keeps most recent, appends notes',
      'Reassigns orders & activities',
      'Database constraints prevent recurrence',
    ],
  },
  {
    icon: Rocket,
    title: '90-Day Momentum Run',
    tagline: 'RESET & RISE methodology, productised.',
    bullets: [
      'Pre-Launch → Launch → Post-Launch → Build → Scale',
      'Daily targets per phase',
      'Contact segmentation mapped to phases',
      'Phase-appropriate message templates',
    ],
  },
  {
    icon: Bot,
    title: 'ZAZI AI Copilot',
    tagline: 'Embedded across every page.',
    bullets: [
      'Drafts birthday & follow-up messages',
      'Surfaces neglected contacts & opportunities',
      'Never edits data without confirmation',
      'Multi-tier model fallback for reliability',
    ],
  },
  {
    icon: Shield,
    title: 'Tester Dashboard',
    tagline: 'Owner-only growth observability.',
    bullets: [
      '6-character voucher invites',
      'Per-tester action stats & page heatmap',
      'AI UX recommendations',
    ],
  },
];

export function Features() {
  return (
    <>
      <section className="container mx-auto pt-20 pb-10">
        <span className="text-xs uppercase tracking-widest text-brand-orange-400 font-semibold">Platform</span>
        <h1 className="text-4xl md:text-5xl font-bold mt-3 max-w-3xl leading-tight">
          One CRM. Every module a downline leader actually uses.
        </h1>
        <p className="mt-5 text-lg text-brand-sand/80 max-w-2xl">
          Each module below ships in every GetWell Grow workspace. Built around the
          rhythms of real network-marketing teams.
        </p>
      </section>

      <section className="container mx-auto pb-20">
        <div className="grid md:grid-cols-2 gap-5">
          {modules.map(({ icon: Icon, title, tagline, bullets }) => (
            <article
              key={title}
              className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-brand-teal-500/40 transition"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-teal-500/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-brand-teal-300" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">{title}</h2>
                  <p className="text-sm text-brand-orange-400 mt-1">{tagline}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2">
                {bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-brand-sand/80">
                    <CheckCircle2 className="w-4 h-4 text-brand-teal-300 mt-0.5 flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="container mx-auto py-12">
        <div
          className="rounded-3xl p-10 md:p-12 text-center"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <h2 className="text-3xl font-bold text-white">Ready to see it in your workspace?</h2>
          <Link
            to="/signin"
            className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-md bg-[#0F2A44] hover:bg-[#0B2138] text-white font-semibold transition"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
