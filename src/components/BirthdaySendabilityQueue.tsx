import { useMemo, useState } from 'react';
import {
  CheckCircle2, PhoneOff, Link2, Copy, ChevronDown, ChevronUp,
  Wrench, SkipForward, Clock,
} from 'lucide-react';
import type { BirthdayEntry } from '@/hooks/useBirthdays';
import {
  categorize, snoozeFor, skip, type SendabilityCategory, isSendReady,
} from '@/utils/birthdaySendability';

interface Props {
  birthdays: BirthdayEntry[];
  onFixMissingPhone: (b: BirthdayEntry) => void;
  onFixUnmatched: (b: BirthdayEntry) => void;
  onFixDuplicate: (b: BirthdayEntry) => void;
  onChanged: () => void;
}

const META: Record<SendabilityCategory, { label: string; color: string; icon: React.ElementType }> = {
  ready:         { label: 'Ready to send',  color: 'emerald', icon: CheckCircle2 },
  missing_phone: { label: 'Missing phone',  color: 'amber',   icon: PhoneOff },
  unmatched:     { label: 'Unmatched',      color: 'sky',     icon: Link2 },
  duplicate:     { label: 'Duplicate risk', color: 'rose',    icon: Copy },
};

const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string; chip: string }> = {
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300', chip: 'bg-emerald-500/20 text-emerald-200' },
  amber:   { border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   text: 'text-amber-300',   chip: 'bg-amber-500/20 text-amber-200' },
  sky:     { border: 'border-sky-500/30',     bg: 'bg-sky-500/10',     text: 'text-sky-300',     chip: 'bg-sky-500/20 text-sky-200' },
  rose:    { border: 'border-rose-500/30',    bg: 'bg-rose-500/10',    text: 'text-rose-300',    chip: 'bg-rose-500/20 text-rose-200' },
};

export function BirthdaySendabilityQueue({
  birthdays, onFixMissingPhone, onFixUnmatched, onFixDuplicate, onChanged,
}: Props) {
  const [openCat, setOpenCat] = useState<SendabilityCategory | null>(null);

  const data = useMemo(() => categorize(birthdays), [birthdays]);
  const sendReadyCount = useMemo(
    () => birthdays.filter(b => isSendReady(b, data.duplicateGroups)).length,
    [birthdays, data.duplicateGroups],
  );

  const cats: SendabilityCategory[] = ['ready', 'missing_phone', 'unmatched', 'duplicate'];

  const runFix = (cat: SendabilityCategory, b: BirthdayEntry) => {
    if (cat === 'missing_phone') onFixMissingPhone(b);
    else if (cat === 'unmatched') onFixUnmatched(b);
    else if (cat === 'duplicate') onFixDuplicate(b);
  };

  const handleSnooze = (id: string) => { snoozeFor(id, 7); onChanged(); };
  const handleSkip = (id: string) => { skip(id); onChanged(); };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-200">Sendable Soon queue</div>
        <div className="text-[11px] text-slate-400">
          <span className="text-emerald-300 font-semibold">{sendReadyCount}</span> send-ready
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
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
              className={`flex items-center justify-between px-2.5 py-2 rounded-md border ${c.border} ${c.bg} hover:brightness-110 transition`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={`w-4 h-4 ${c.text} shrink-0`} />
                <span className="text-[11px] text-slate-200 truncate">{m.label}</span>
              </div>
              <span className={`text-sm font-bold ${c.text}`}>{list.length}</span>
            </button>
          );
        })}
      </div>

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
                      <>
                        <button
                          onClick={() => runFix(openCat, b)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-white rounded"
                          title="Fix"
                        >
                          <Wrench className="w-3 h-3" /> Fix
                        </button>
                        <button
                          onClick={() => handleSkip(b.id)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400"
                          title="Skip (hide from queue)"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSnooze(b.id)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400"
                          title="Snooze 7 days"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
