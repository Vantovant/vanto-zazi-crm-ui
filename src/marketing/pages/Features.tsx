import { Link } from 'react-router-dom';
import {
  Users, Cake, MessageCircle, BarChart3, TrendingUp, ShoppingCart,
  Package, Upload, Copy, Shield, Bot, Rocket, ArrowRight, CheckCircle2,
} from 'lucide-react';

type Module = {
  icon: typeof Users;
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
  accent: 'teal' | 'orange';
};

const modules: Module[] = [
  {
    icon: BarChart3, accent: 'teal',
    title: 'Dashboard',
    tagline: 'Your daily command centre.',
    description:
      "The first screen every morning. Five lead-temperature KPIs sit at the top — Hot, Warm, Cold, Expired, Activated — so you know exactly where your downline stands the moment you log in. Beneath them: order revenue, Activity PV, Upgrade PV, follow-ups due, hot leads needing action, and a ZAZI AI morning briefing that tells you what to do today, in priority order. No clicking around. No guessing.",
    bullets: [
      '5 lead-temperature KPI tiles with real-time counts',
      'Order revenue + Activity/Upgrade PV split in ZAR',
      'ZAZI morning briefing: "Today you should…"',
      'Follow-ups due, hot leads, neglected contacts surfaced',
      'One-click jump into the Contact Drawer from any tile',
    ],
  },
  {
    icon: Users, accent: 'orange',
    title: 'Contacts',
    tagline: '22+ field downline database.',
    description:
      "Your downline lives here. 22 functional fields per contact — name, phone, email, APLGO ID, sponsor ID, lead type, lead temperature, lead path, focus area, rank, salutation, notes, tags, and more. Real-time duplicate detection on normalised phone and email stops your database rotting. Bulk select, bulk delete, column visibility picker, sorting, filtering, and a slide-out Contact Drawer with the full activity timeline + quick actions on every record.",
    bullets: [
      '22+ fields including APLGO-specific functional fields',
      'Lead temperature, type, path, focus area filters',
      'Bulk select / delete / tag / export with confirmation',
      'Real-time duplicate detection (phone + email normalised)',
      'Slide-out drawer: timeline, orders, activities, quick actions',
      'CSV/XLSX import with AI header mapping + safe-merge upsert',
    ],
  },
  {
    icon: Cake, accent: 'teal',
    title: 'Birthdays',
    tagline: 'Never miss a relationship moment.',
    description:
      "The daily birthday queue is split into four lanes: Ready to send, Missing phone, Unmatched, Duplicate risk. A phone-health score tells you what percent of upcoming birthdays you can actually message. Smart Phone Rescue scans your CRM, order history, and original paste text for missing numbers with confidence tiers. MP1.5 Assisted Send pre-fills a personal message, you hit Send, the system calls Maytapi, logs a real message ID, marks congratulated, and opens the next one — manual, safe, fast.",
    bullets: [
      'Four-lane queue: Ready / Missing Phone / Unmatched / Duplicate',
      'Phone health score with target ≥80%',
      'Smart Paste import (Name, Date, Phone, APLGO ID)',
      'Phone Rescue across CRM + orders + paste history',
      'MP1.5 Assisted Send — one click → review → send → next',
      'Local audit trail of every manual repair',
    ],
  },
  {
    icon: BarChart3, accent: 'orange',
    title: 'Activities',
    tagline: 'Daily discipline, weekly compounding.',
    description:
      "Network marketing dies in the gaps between conversations. Activities closes those gaps. Set daily goals for calls, emails, and WhatsApp messages. The weekly multiplier shows your real momentum. The Neglected Contact alert surfaces anyone untouched for 7+ days, prioritised by lead type and manager leg. Monthly Activity Push lets you paste an APLGO purchase report and instantly generate a personalised appreciation queue for every active distributor.",
    bullets: [
      'Configurable daily goals (calls, emails, WhatsApp)',
      'Weekly multiplier for streak visibility',
      'Neglected-contact alerts (7+ days dormant)',
      'Monthly Activity Push — paste report → appreciation queue',
      'Appreciation Engine with data-driven message tones',
      'Sorted by Lead Type priority + Manager Leg',
    ],
  },
  {
    icon: ShoppingCart, accent: 'teal',
    title: 'Orders',
    tagline: 'Track every sale, every PV point.',
    description:
      "Every order in one place — pasted from any MLM backoffice, parsed by AI, deduped by a stable key. Each order separates Activity PV from Upgrade PV, applies a ZAR conversion, and links back to the contact and product catalogue. Offline orders go through a dedicated RPC that auto-deducts stock so your inventory never drifts.",
    bullets: [
      'Smart Paste — AI parses backoffice order text',
      'Activity PV vs Upgrade PV separation',
      'Status, product, channel, and date-range filters',
      'Offline order RPC with automatic stock deduction',
      'Stable dedupe key prevents duplicate imports',
    ],
  },
  {
    icon: Package, accent: 'orange',
    title: 'Inventory',
    tagline: 'Stock that ties into every offline order.',
    description:
      "Simple per-product stock counts that the offline-order RPC consumes automatically. Inline edit, inline delete, real-time balance — built for the leader who actually keeps product at home.",
    bullets: [
      'Per-product quantity tracking',
      'Inline edit and delete',
      'Auto-deducts on offline order placement',
      'Linked to the APLGO product catalogue',
    ],
  },
  {
    icon: TrendingUp, accent: 'teal',
    title: 'Deals',
    tagline: 'Rank-based valuation pipeline.',
    description:
      "Deals is a derived view — it pulls active distributors from Contacts and combines them with their order history to produce a rank-aware estimated value. Diamond, Sapphire, Ruby, Pearl, Activated — each rank has its own PV and ZAR formula. Export to CSV in one click for offline coaching sessions.",
    bullets: [
      'Auto-derived from Contacts + Orders',
      'Estimated value per rank (Diamond → Activation)',
      'Upgrade PV vs Activity PV breakdown in ZAR',
      'CSV export for downline coaching',
    ],
  },
  {
    icon: MessageCircle, accent: 'orange',
    title: 'WhatsApp',
    tagline: '13-category template library.',
    description:
      "Every conversation goes through one branded surface. 13 message categories — welcome, follow-up, birthday, appreciation, activation, upgrade, event, recovery, and more — each with merge fields, your personal signature, and an Open Graph link preview that ships your brand into every chat. All sends are MP1: one entry → one review → one confirm → one Maytapi message. No bulk, ever.",
    bullets: [
      '13 template categories with merge fields',
      'Per-user signature auto-appended',
      'Branded Open Graph link preview',
      'MP1 manual one-by-one sends — compliant, never banned',
      'Maytapi integration with verified message IDs',
    ],
  },
  {
    icon: Upload, accent: 'teal',
    title: 'Import / Export',
    tagline: 'AI-mapped, duplicate-safe.',
    description:
      "Drag a CSV, XLSX, or XLS in. ZAZI AI maps headers to CRM fields. The Smart Importer upserts on phone and email with a safe-merge rule (we never overwrite a non-empty field). After every import you get a created / updated / skipped summary and a full audit row.",
    bullets: [
      'CSV / XLSX / XLS file support',
      'AI auto-mapping of headers to CRM fields',
      'Upsert by phone + email with safe merge',
      'Created / updated / skipped summary',
      'Every row written to import_audit',
    ],
  },
  {
    icon: Copy, accent: 'orange',
    title: 'Duplicates',
    tagline: 'Self-cleaning database.',
    description:
      "Duplicates surface in their own page. Normalised phone and email match candidates side-by-side, you pick the keeper, and orders + activities reassign automatically. Notes are appended, never lost. Database-level unique constraints keep the problem from coming back.",
    bullets: [
      'Auto-detection on normalised phone + email',
      'Side-by-side merge with keeper selection',
      'Reassigns orders, activities, and notes',
      'Database constraints prevent recurrence',
    ],
  },
  {
    icon: Rocket, accent: 'teal',
    title: '90-Day Momentum Run',
    tagline: 'RESET & RISE methodology, productised.',
    description:
      "Five phases — Pre-Launch, Launch, Post-Launch, Build, Scale — each with daily targets, contact segmentation, and phase-appropriate templates. By Day 90 your downline has compounded. Then you reset and ride again.",
    bullets: [
      'Pre-Launch → Launch → Post-Launch → Build → Scale',
      'Daily activity targets per phase',
      'Contact segmentation mapped to phases',
      'Phase-specific message templates',
    ],
  },
  {
    icon: Bot, accent: 'orange',
    title: 'ZAZI AI Copilot',
    tagline: 'Embedded across every page.',
    description:
      "ZAZI is the AI sidekick that lives on every screen. She drafts birthday messages, surfaces neglected contacts, gives you a morning briefing, recommends templates by lead context, and answers domain questions in plain MLM language. She never edits data without confirmation. Multi-tier model fallback keeps her up when one provider hiccups.",
    bullets: [
      'On every page — Dashboard, Contacts, WhatsApp, Activities',
      'Drafts personalised messages with merge fields',
      'Surfaces opportunities and neglected leads',
      'Confirmation required before any data write',
      'Multi-model fallback for reliability',
    ],
  },
  {
    icon: Shield, accent: 'teal',
    title: 'Tester / Team Dashboard',
    tagline: 'Owner-only growth observability.',
    description:
      "Admin-only. See every tester's actions, page-by-page heatmap, AI usage, and conversion behaviour. Six-character voucher invites onboard new testers without exposing your workspace.",
    bullets: [
      '6-character voucher invite codes',
      'Per-tester action stats + page heatmap',
      'AI-generated UX recommendations',
      'Role-gated — server-validated, not client',
    ],
  },
];

export function Features() {
  return (
    <>
      <section className="container mx-auto pt-16 pb-10">
        <span className="text-xs uppercase tracking-widest text-[#E8732C] font-bold">Platform</span>
        <h1 className="text-4xl md:text-5xl font-bold mt-3 max-w-3xl leading-tight text-[#0F2A44]">
          One CRM. Every module a downline leader actually uses.
        </h1>
        <p className="mt-5 text-lg text-[#0F2A44]/75 max-w-2xl">
          Thirteen modules. Each one ships in every GetWell Grow workspace. Each one built around
          the daily rhythms of real network-marketing teams — not a generic sales pipeline retrofitted
          for MLM.
        </p>
      </section>

      <section className="container mx-auto pb-20">
        <div className="grid lg:grid-cols-2 gap-6">
          {modules.map(({ icon: Icon, title, tagline, description, bullets, accent }) => {
            const color = accent === 'teal' ? '#2A8A8F' : '#E8732C';
            return (
              <article
                key={title}
                className="p-7 rounded-2xl bg-white border border-[#0F2A44]/5 hover:border-[#2A8A8F]/40 hover:shadow-lg transition"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18` }}
                  >
                    <Icon className="w-6 h-6" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-[#0F2A44]">{title}</h2>
                    <p className="text-sm font-semibold mt-0.5" style={{ color }}>{tagline}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-[#0F2A44]/75 leading-relaxed">{description}</p>
                <ul className="mt-5 space-y-2 pt-4 border-t border-[#0F2A44]/5">
                  {bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-sm text-[#0F2A44]/80">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container mx-auto pb-20">
        <div
          className="rounded-3xl p-10 md:p-12 text-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #2A8A8F 0%, #E8732C 100%)' }}
        >
          <h2 className="text-3xl font-bold text-white">Ready to see it in your workspace?</h2>
          <p className="mt-3 text-white/85 max-w-xl mx-auto">
            Every module above is live today. Sign in, import your downline, and run your first
            birthday queue in under fifteen minutes.
          </p>
          <Link
            to="/signin"
            className="mt-7 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-[#F8EFE2] text-[#0F2A44] font-bold transition"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
