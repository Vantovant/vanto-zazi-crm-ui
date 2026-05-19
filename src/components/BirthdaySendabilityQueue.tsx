import { useMemo, useState } from 'react';
import {
  CheckCircle2, PhoneOff, Link2, Copy, Wrench, SkipForward, Clock,
  PlayCircle, History, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { BirthdayEntry } from '@/hooks/useBirthdays';
import {
  categorize, snoozeFor, skip, type SendabilityCategory, isSendReady,
  readAudit, repairedToday,
} from '@/utils/birthdaySendability';

interface Props {
  birthdays: BirthdayEntry[];
  onFixMissingPhone: (b: BirthdayEntry) => void;
  onFixUnmatched: (b: BirthdayEntry) => void;
  onFixDuplicate: (b: BirthdayEntry) => void;
  onChanged: () => void;
  // Expose a way to imperatively open the "next unresolved" item after each save.
  registerOpenNext?: (fn: () => void) => void;
}

const META: Record<SendabilityCategory, { label: string; color: string; icon: React.ElementType }> = {
  ready:         { label: 'Ready',          color: 'emerald', icon: CheckCircle2 },
  missing_phone: { label: 'Missing phone',  color: 'amber',   icon: PhoneOff },
  unmatched:     { label: 'Unmatched',      color: 'sky',     icon: Link2 },
  duplicate:     { label: 'Duplicate',      color: 'rose',    icon: Copy },
};

const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string }> = {
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  amber:   { border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   text: 'text-amber-300' },
  sky:     { border: 'border-sky-500/30',     bg: 'bg-sky-500/10',     text: 'text-sky-300' },
  rose:    { border: 'border-rose-500/30',    bg: 'bg-rose-500/10',    text: 'text-rose-300' },
};

const ACTION_LABEL = { repaired: 'Repaired', skipped: 'Skipped', snoozed: 'Snoozed' } as const;
const ACTION_COLOR = {
  repaired: 'text-emerald-300',
  skipped: 'text-slate-400',
  snoozed: 'text-amber-300',
} as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function BirthdaySendabilityQueue({
  birthdays, onFixMissingPhone, onFixUnmatched, onFixDuplicate, onChanged,
}: Props) {
  const [openCat, setOpenCat] = useState<SendabilityCategory | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const data = useMemo(() => categorize(birthdays), [birthdays]);
  const sendReadyCount = useMemo(
    () => birthdays.filter(b => isSendReady(b, data.duplicateGroups)).length,
    [birthdays, data.duplicateGroups],
  );
  const unresolvedCount = data.missing_phone.length + data.unmatched.length + data.duplicate.length;
  const repairedCount = repairedToday();
  const auditEntries = useMemo(() => readAudit().slice(0, 20), [birthdays]);

  const cats: SendabilityCategory[] = ['ready', 'missing_phone', 'unmatched', 'duplicate'];

  const runFix = (cat: SendabilityCategory, b: BirthdayEntry) => {
    if (cat === 'missing_phone') onFixMissingPhone(b);
    else if (cat === 'unmatched') onFixUnmatched(b);
    else if (cat === 'duplicate') onFixDuplicate(b);
  };

  const handleSnooze = (b: BirthdayEntry) => { snoozeFor(b.id, 7, b.full_name); onChanged(); };
  const handleSkip = (b: BirthdayEntry) => { skip(b.id, b.full_name); onChanged(); };

  const openNextUnresolved = () => {
    // Priority: missing_phone → unmatched → duplicate
    const next =
      data.missing_phone[0] ||
      data.unmatched[0] ||
      data.duplicate[0];
    if (!next) return;
    if (data.missing_phone.includes(next)) { setOpenCat('missing_phone'); onFixMissingPhone(next); }
    else if (data.unmatched.includes(next)) { setOpenCat('unmatched'); onFixUnmatched(next); }
    else { setOpenCat('duplicate'); onFixDuplicate(next); }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-2">
      {/* Header + quick metrics + Open next */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-semibold text-slate-200">Sendable Soon</div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">
            {sendReadyCount} ready
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-200">
            {unresolvedCount} unresolved
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-200">
            {repairedCount} repaired today
          </span>
        </div>
        <button
          type="button"
          onClick={openNextUnresolved}
          disabled={unresolvedCount === 0}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md"
          title="Cycle through Missing phone → Unmatched → Duplicate"
        >
          <PlayCircle className="w-3.5 h-3.5" /> Open next
        </button>
      </div>

      {/* Compact chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {cats.map(cat => {
          const m = META[cat];
          const c = COLOR_CLASSES[m.color];
          const list = data[cat];
          const Icon = m.icon;
          const isOpen = openCat === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setOpenCat(isOpen ? null : cat)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md border ${c.border} ${c.bg} hover:brightness-110 transition`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className={`w-3.5 h-3.5 ${c.text} shrink-0`} />
                <span className="text-[11px] text-slate-200 truncate">{m.label}</span>
              </div>
              <span className={`text-sm font-bold ${c.text}`}>{list.length}</span>
            </button>
          );
        })}
      </div>

      {/* Drawer */}
      {openCat && (
        <div className="border border-slate-700 rounded-md bg-slate-900/60 max-h-60 overflow-y-auto">
          {data[openCat].length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-4">Nothing in this category.</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {data[openCat].map(b => {
                const fixable = openCat !== 'ready';
                return (
                  <li key={b.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-medium truncate">{b.full_name}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {b.associate_id && <span className="font-mono mr-2">ID: {b.associate_id}</span>}
                        {b.phone_number && <span className="font-mono">{b.phone_number}</span>}
                        {b.opt_out && <span className="text-amber-400 ml-2">opted out</span>}
                      </div>
                    </div>
                    {fixable && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => runFix(openCat, b)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white rounded"
                          title="Fix (Enter)"
                        >
                          <Wrench className="w-3 h-3" /> Fix
                        </button>
                        <button
                          onClick={() => handleSkip(b)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400"
                          title="Skip"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSnooze(b)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400"
                          title="Snooze 7d"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Recently repaired / audit trail */}
      <div className="border-t border-slate-800 pt-2">
        <button
          type="button"
          onClick={() => setShowHistory(s => !s)}
          className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200"
        >
          <span className="flex items-center gap-1.5">
            <History className="w-3 h-3" />
            Recently repaired ({auditEntries.length})
          </span>
          {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showHistory && (
          auditEntries.length === 0 ? (
            <div className="text-[11px] text-slate-500 py-2 text-center">No activity yet.</div>
          ) : (
            <ul className="mt-1.5 divide-y divide-slate-800 max-h-48 overflow-y-auto">
              {auditEntries.map((a, i) => (
                <li key={i} className="flex items-center gap-2 py-1.5">
                  <span className={`text-[10px] font-semibold w-14 shrink-0 ${ACTION_COLOR[a.action]}`}>
                    {ACTION_LABEL[a.action]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-slate-200 truncate">{a.name || '(unnamed)'}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {a.phone && <span className="font-mono mr-2">{a.phone}</span>}
                      {a.source && <span>· {a.source}</span>}
                      {a.repairedBy && <span> · by {a.repairedBy}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(a.ts)}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}
