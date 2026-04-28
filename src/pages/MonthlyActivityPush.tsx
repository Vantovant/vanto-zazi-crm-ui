import { useMemo, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Crown,
  ShieldAlert,
  Inbox,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  SkipForward,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCrm } from '@/contexts/CrmContext';
import { useContactActivities } from '@/hooks/useContactActivities';
import { useWaitingRoom } from '@/hooks/useWaitingRoom';
import { ActivityAppreciationModal } from '@/components/ActivityAppreciationModal';
import { ContactDrawer } from '@/components/ContactDrawer';
import {
  normalizeActivityMonth,
  monthLabel,
  compareMonthKeys,
  getActivityEntryKey,
  extractAppreciationEntryKey,
} from '@/utils/monthlyActivityKey';
import type { Prospect } from '@/data/mockData';

const OWNER_ID = 'b8028d7d-6a08-45ef-a369-b438c440bea3';

/** GMT+2 (SA) current month as YYYY-MM. */
function currentSaMonthKey(): string {
  const now = new Date();
  const sa = new Date(now.getTime() + (now.getTimezoneOffset() + 120) * 60_000);
  return `${sa.getFullYear()}-${String(sa.getMonth() + 1).padStart(2, '0')}`;
}

interface PushOrder {
  id: string;
  contactId: string | null;
  contactName: string;
  amount: number;
  product: string;
  dedupe_key?: string | null;
}

function normalizePushOrder(order: any): PushOrder {
  return {
    id: String(order.id),
    contactId: order.contactId ?? null,
    contactName: order.contactName ?? '',
    amount: order.amount ?? 0,
    product: order.product ?? '',
    dedupe_key: order.dedupe_key ?? null,
  };
}

export function MonthlyActivityPush() {
  const { user, loading: authLoading } = useAuth();
  const { contacts, orders } = useCrm();
  const { activities } = useContactActivities();
  const { addToWaitingRoom, getEntryForContact, openEntries } = useWaitingRoom();

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');
  const [search, setSearch] = useState('');
  const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
  const [appreciationEntry, setAppreciationEntry] = useState<{
    contact: Prospect;
    order: PushOrder;
    month: string;
  } | null>(null);

  // Optimistic local marks (entry-scoped) — survive until activities refetches
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());

  // Build entry-scoped Done set from contact_activities log markers (M2 truth).
  const doneEntryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const a of activities) {
      if (a.activity_type !== 'whatsapp') continue;
      if (!a.summary || !/activity appreciation/i.test(a.summary)) continue;
      const k = extractAppreciationEntryKey(a);
      if (k) keys.add(k);
    }
    return keys;
  }, [activities]);

  const isEntryDone = useCallback(
    (order: any, contact?: any) => {
      const k = getActivityEntryKey(order, contact);
      if (!k) return false;
      return doneEntryKeys.has(k) || optimisticDone.has(k);
    },
    [doneEntryKeys, optimisticDone],
  );

  // All monthly-activity-paste orders, grouped by canonical month key.
  const { monthOptions, allMonthOrders, effectiveMonthKey, monthDisplay } = useMemo(() => {
    const activityOrders = orders.filter((o: any) => o.source === 'monthly-activity-paste');
    const groups = new Map<string, { label: string; orders: any[] }>();
    for (const o of activityOrders) {
      const rawLabel = (o.product || '').replace(/^Monthly Activity\s*-\s*/i, '').trim() || 'Unknown';
      const key = normalizeActivityMonth(rawLabel) || rawLabel;
      const display = monthLabel(rawLabel) || rawLabel;
      const bucket = groups.get(key) || { label: display, orders: [] };
      bucket.orders.push(o);
      groups.set(key, bucket);
    }
    const opts = Array.from(groups.entries())
      .sort((a, b) => compareMonthKeys(b[0], a[0]))
      .map(([key, v]) => ({ key, label: v.label, count: v.orders.length }));

    // Default selection priority: explicit pick → current SA month if present → newest available
    const saMonth = currentSaMonthKey();
    const fallback =
      (groups.has(saMonth) ? saMonth : opts[0]?.key) || '';
    const eff = selectedMonthKey && groups.has(selectedMonthKey) ? selectedMonthKey : fallback;

    return {
      monthOptions: opts,
      allMonthOrders: eff ? groups.get(eff)?.orders || [] : [],
      effectiveMonthKey: eff,
      monthDisplay: eff ? groups.get(eff)?.label || '' : '',
    };
  }, [orders, selectedMonthKey]);

  // Decorate each order with its contact, status, and entry key.
  const decoratedRows: RowShape[] = useMemo(() => {
    return allMonthOrders.map((o: any) => {
      const contact = o.contactId
        ? contacts.find((c: any) => String(c.id) === String(o.contactId))
        : undefined;
      const entryKey = getActivityEntryKey(o, contact);
      const done = isEntryDone(o, contact);
      const wrEntry = contact ? getEntryForContact(String(contact.id)) : undefined;
      const possibleDuplicate = !!wrEntry && /possible duplicate/i.test(wrEntry.issue_note || '');
      const needsReview = !done && (!contact || !!wrEntry);
      let status: 'done' | 'pending' | 'needs_review';
      if (done) status = 'done';
      else if (needsReview) status = 'needs_review';
      else status = 'pending';
      return { order: o, contact, entryKey, status, possibleDuplicate };
    });
  }, [allMonthOrders, contacts, isEntryDone, getEntryForContact]);

  // MP0.1: count Waiting Room entries flagged as possible duplicates from imports.
  const possibleDuplicateCount = useMemo(
    () => openEntries.filter((e) => /possible duplicate/i.test(e.issue_note || '')).length,
    [openEntries],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return decoratedRows;
    return decoratedRows.filter(({ order, contact }) => {
      const aplgo = (contact?.APLGoID || '').toLowerCase();
      return order.contactName.toLowerCase().includes(q) || aplgo.includes(q);
    });
  }, [decoratedRows, search]);

  const counts = useMemo(() => {
    const imported = decoratedRows.length;
    let done = 0,
      pending = 0,
      needs = 0;
    for (const r of decoratedRows) {
      if (r.status === 'done') done++;
      else if (r.status === 'needs_review') needs++;
      else pending++;
    }
    return { imported, pending, done, needs };
  }, [decoratedRows]);

  const importedRows = filteredRows;
  const pendingRows = filteredRows.filter((r) => r.status === 'pending');
  const doneRows = filteredRows.filter((r) => r.status === 'done');
  const needsRows = filteredRows.filter((r) => r.status === 'needs_review');

  const openCrown = (row: (typeof decoratedRows)[number]) => {
    const fallback = (row.contact || ({
      id: row.order.id,
      FullName: row.order.contactName,
      PhoneNumber: '',
      LeadTemperature: '',
      LeadType: '',
      AssignedTo: '',
    } as unknown)) as Prospect;
    setAppreciationEntry({
      contact: fallback,
      order: normalizePushOrder(row.order),
      month: monthDisplay,
    });
  };

  const handleSkip = async (row: (typeof decoratedRows)[number]) => {
    if (!row.contact) {
      alert('No matched contact for this entry — cannot add to Waiting Room.');
      return;
    }
    const ok = await addToWaitingRoom({
      contact_id: String(row.contact.id),
      issue_type: 'follow_up_correction',
      issue_note: `Monthly Activity Push — skipped for ${monthDisplay}. Entry: ${row.entryKey.slice(-6)}`,
      priority: 'medium',
    });
    if (ok) alert('Added to Needs Review (Waiting Room).');
  };

  // ── Auth gate ──
  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.id !== OWNER_ID) {
    return (
      <div className="p-6 text-center text-slate-400">
        <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-amber-400" />
        Owner only.
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-7xl mx-auto w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-semibold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0" />
            <span className="truncate">Monthly Activity Push</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Entry-scoped appreciation workspace. Read-only of M2 truth. No Maytapi sending in this phase.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={effectiveMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            title="Select activity month"
          >
            {monthOptions.length === 0 && <option value="">No months yet</option>}
            {monthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label} ({opt.count})
              </option>
            ))}
          </select>
          <a
            href="/orders"
            className="px-3 py-2 text-xs sm:text-sm rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/70 whitespace-nowrap"
            title="Paste a Monthly Report on the Orders page"
          >
            Paste Monthly Report →
          </a>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <SummaryCard icon={Inbox} label="Imported" value={counts.imported} tone="slate" />
        <SummaryCard icon={Clock} label="Pending" value={counts.pending} tone="amber" />
        <SummaryCard icon={CheckCircle} label="Done" value={counts.done} tone="emerald" />
        <SummaryCard icon={AlertCircle} label="Needs Review" value={counts.needs} tone="rose" />
      </div>

      {/* MP0.1 — Duplicate warning banner (only when flagged > 0) */}
      {possibleDuplicateCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-amber-100">
              {possibleDuplicateCount} possible duplicate import{possibleDuplicateCount === 1 ? '' : 's'} flagged
            </div>
            <div className="text-xs text-amber-200/80 mt-0.5">
              These rows were NOT inserted as send-ready entries. They were routed to Needs Review (Waiting Room)
              because the same signature already exists from a previous import without a same-report twin. Owner
              approval required before they can be appreciated.
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or APLGO ID…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      </div>

      {/* Sections */}
      <Section
        title="Imported"
        subtitle={monthDisplay ? `All entries for ${monthDisplay}` : 'No month selected'}
        icon={Inbox}
        accent="slate"
        rows={importedRows}
        onPreview={(r) => r.order.contactId && setDrawerContactId(String(r.order.contactId))}
        onCrown={openCrown}
        onSkip={handleSkip}
      />
      <Section
        title="Pending Appreciation"
        subtitle="Entries awaiting appreciation"
        icon={Clock}
        accent="amber"
        rows={pendingRows}
        onPreview={(r) => r.order.contactId && setDrawerContactId(String(r.order.contactId))}
        onCrown={openCrown}
        onSkip={handleSkip}
      />
      <Section
        title="Done This Month"
        subtitle="Entries marked Done by the M2 entry marker"
        icon={CheckCircle}
        accent="emerald"
        rows={doneRows}
        onPreview={(r) => r.order.contactId && setDrawerContactId(String(r.order.contactId))}
        onCrown={openCrown}
        onSkip={handleSkip}
        hideSkip
      />
      {needsRows.length > 0 && (
        <Section
          title="Needs Review"
          subtitle="Unmatched contact or open Waiting Room issue"
          icon={AlertCircle}
          accent="rose"
          rows={needsRows}
          onPreview={(r) => r.order.contactId && setDrawerContactId(String(r.order.contactId))}
          onCrown={openCrown}
          onSkip={handleSkip}
        />
      )}

      {/* Drawer + Crown modal — reuse existing components, no new send paths */}
      {drawerContactId && (() => {
        const p = contacts.find((c: any) => String(c.id) === String(drawerContactId)) as Prospect | undefined;
        if (!p) return null;
        return <ContactDrawer prospect={p} onClose={() => setDrawerContactId(null)} />;
      })()}
      {appreciationEntry && (
        <ActivityAppreciationModal
          entries={[appreciationEntry]}
          initialIndex={0}
          onClose={() => setAppreciationEntry(null)}
          onAppreciated={({ entryKey }) => {
            if (entryKey) {
              setOptimisticDone((prev) => {
                const n = new Set(prev);
                n.add(entryKey);
                return n;
              });
            }
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  tone: 'slate' | 'amber' | 'emerald' | 'rose';
}) {
  const toneClass: Record<string, string> = {
    slate: 'text-slate-300 bg-slate-800/60 border-slate-700',
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  };
  return (
    <div className={`rounded-xl border px-3 sm:px-4 py-3 ${toneClass[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 opacity-80" />
        <span className="text-[11px] sm:text-xs uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

interface RowShape {
  order: any;
  contact: any | undefined;
  entryKey: string;
  status: 'done' | 'pending' | 'needs_review';
  possibleDuplicate?: boolean;
}

function Section({
  title,
  subtitle,
  icon: Icon,
  accent,
  rows,
  onPreview,
  onCrown,
  onSkip,
  hideSkip,
}: {
  title: string;
  subtitle: string;
  icon: typeof Inbox;
  accent: 'slate' | 'amber' | 'emerald' | 'rose';
  rows: RowShape[];
  onPreview: (r: RowShape) => void;
  onCrown: (r: RowShape) => void;
  onSkip: (r: RowShape) => void;
  hideSkip?: boolean;
}) {
  const accentBorder: Record<string, string> = {
    slate: 'border-slate-700',
    amber: 'border-amber-500/30',
    emerald: 'border-emerald-500/30',
    rose: 'border-rose-500/30',
  };
  const accentText: Record<string, string> = {
    slate: 'text-slate-300',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
  };
  return (
    <div className={`bg-slate-800/40 border ${accentBorder[accent]} rounded-xl overflow-hidden`}>
      <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accentText[accent]}`} />
        <h3 className="text-sm sm:text-base font-semibold text-white">{title}</h3>
        <span className={`text-xs ${accentText[accent]}`}>{rows.length}</span>
        <span className="text-xs text-slate-500 ml-2 hidden sm:inline">{subtitle}</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">No entries.</div>
      ) : (
        <div className="divide-y divide-slate-700/50 max-h-[26rem] overflow-y-auto">
          {rows.map((r) => (
            <RowItem
              key={`${r.order.id}-${r.entryKey}`}
              row={r}
              onPreview={() => onPreview(r)}
              onCrown={() => onCrown(r)}
              onSkip={() => onSkip(r)}
              hideSkip={hideSkip}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RowItem({
  row,
  onPreview,
  onCrown,
  onSkip,
  hideSkip,
}: {
  row: RowShape;
  onPreview: () => void;
  onCrown: () => void;
  onSkip: () => void;
  hideSkip?: boolean;
}) {
  const { order, contact, entryKey, status, possibleDuplicate } = row;
  const statusBadge =
    status === 'done'
      ? 'bg-emerald-500/20 text-emerald-300'
      : status === 'needs_review'
      ? 'bg-rose-500/20 text-rose-300'
      : 'bg-amber-500/20 text-amber-300';
  const statusLabel =
    status === 'done' ? '✓ Done' : status === 'needs_review' ? 'Needs Review' : 'Pending';

  const rawMonth = (order.product || '').replace(/^Monthly Activity\s*-\s*/i, '').trim();
  const monthShown = monthLabel(rawMonth) || rawMonth || '—';

  return (
    <div className="px-3 sm:px-4 py-3 hover:bg-slate-700/30 transition-colors">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-white truncate">{order.contactName || '—'}</p>
            {contact?.APLGoID && (
              <span className="text-[10px] text-slate-500 font-mono">{contact.APLGoID}</span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge}`}>
              {statusLabel}
            </span>
            {possibleDuplicate && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30"
                title="Flagged by MP0.1: same signature exists from a previous import without same-report twin"
              >
                ⚠ possible duplicate
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 flex-wrap">
            <span>{monthShown}</span>
            <span className="text-emerald-400 font-semibold">R{(order.amount || 0).toLocaleString()}</span>
            {contact?.Level && <span>Lvl {contact.Level}</span>}
            {contact?.Leg && <span>Leg {contact.Leg}</span>}
            <span className="font-mono opacity-70" title={`entryKey: ${entryKey}`}>
              #{entryKey.slice(-6)}
            </span>
            {!contact && <span className="text-rose-400">unmatched</span>}
          </div>
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={onPreview}
          disabled={!order.contactId}
          className="p-1.5 rounded-lg bg-slate-700/40 text-slate-300 hover:bg-slate-700 disabled:opacity-30 transition-colors shrink-0"
          title="Preview contact"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onCrown}
          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
          title="👑 Send Activity Appreciation (existing manual flow)"
        >
          <Crown className="w-5 h-5" />
        </button>
        {!hideSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors shrink-0"
            title="Skip — send to Needs Review (Waiting Room)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
