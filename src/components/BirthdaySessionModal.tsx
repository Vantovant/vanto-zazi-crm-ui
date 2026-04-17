import { useState, useMemo, useCallback } from 'react';
import { X, Cake, Play, Check } from 'lucide-react';
import { classifyBirthdayEntry } from '@/utils/birthdayParser';
import type { BirthdayEntry } from '@/hooks/useBirthdays';
import { BirthdayComposerModal } from './BirthdayComposerModal';

interface Props {
  birthdays: BirthdayEntry[];
  onClose: () => void;
  onCongratulated: (id: string) => void;
}

type Scope = 'today' | 'tomorrow' | 'this_week';

export function BirthdaySessionModal({ birthdays, onClose, onCongratulated }: Props) {
  const [scope, setScope] = useState<Scope>('today');
  const [started, setStarted] = useState(false);
  const [composerIndex, setComposerIndex] = useState(0);
  const [congratulatedIds, setCongratulatedIds] = useState<Set<string>>(new Set());

  const queue = useMemo(() => {
    const scopes: Scope[] = scope === 'this_week' ? ['today', 'tomorrow', 'this_week'] :
      scope === 'tomorrow' ? ['today', 'tomorrow'] : ['today'];

    return birthdays.filter(b => {
      if (b.status === 'congratulated') return false;
      const cls = classifyBirthdayEntry(b);
      return scopes.includes(cls as Scope) || cls === 'past'; // include overdue
    });
  }, [birthdays, scope]);

  const remaining = queue.filter(b => !congratulatedIds.has(b.id));
  const completed = congratulatedIds.size;
  const total = queue.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const handleCongratulated = useCallback((id: string) => {
    setCongratulatedIds(prev => new Set(prev).add(id));
    onCongratulated(id);
  }, [onCongratulated]);

  if (started && remaining.length > 0) {
    return (
      <BirthdayComposerModal
        entries={remaining}
        initialIndex={0}
        onClose={() => setStarted(false)}
        onCongratulated={handleCongratulated}
      />
    );
  }

  const scopeOptions: { key: Scope; label: string; count: number }[] = [
    { key: 'today', label: 'Today Only', count: birthdays.filter(b => classifyBirthdayEntry(b) === 'today' && b.status !== 'congratulated').length },
    { key: 'tomorrow', label: 'Today + Tomorrow', count: birthdays.filter(b => { const c = classifyBirthdayEntry(b); return (c === 'today' || c === 'tomorrow') && b.status !== 'congratulated'; }).length },
    { key: 'this_week', label: 'This Week', count: birthdays.filter(b => { const c = classifyBirthdayEntry(b); return (c === 'today' || c === 'tomorrow' || c === 'this_week') && b.status !== 'congratulated'; }).length },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Cake className="w-5 h-5 text-pink-400" />
            <h2 className="text-base font-semibold text-white">Birthday Session</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Progress */}
          {completed > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{completed} / {total} completed</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Completion state */}
          {total > 0 && remaining.length === 0 ? (
            <div className="text-center py-6">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
              <p className="text-lg font-semibold text-white">All done! 🎉</p>
              <p className="text-sm text-slate-400 mt-1">You've congratulated everyone in this session.</p>
              <button type="button" onClick={onClose} className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Scope selector */}
              <div className="space-y-2">
                <p className="text-sm text-slate-300 font-medium">Select scope:</p>
                {scopeOptions.map(o => (
                  <button key={o.key} type="button" onClick={() => setScope(o.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all ${
                      scope === o.key ? 'border-pink-500 bg-pink-500/10 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-700/50'
                    }`}>
                    <span>{o.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.count > 0 ? 'bg-pink-500/20 text-pink-300' : 'bg-slate-700 text-slate-500'}`}>{o.count}</span>
                  </button>
                ))}
              </div>

              {/* Overdue warning */}
              {birthdays.some(b => classifyBirthdayEntry(b) === 'past' && b.status !== 'congratulated') && (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  ⚠️ You have overdue birthdays that will be included in this session.
                </div>
              )}

              {/* Start button */}
              <button type="button" onClick={() => setStarted(true)} disabled={queue.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white rounded-lg font-medium transition-colors">
                <Play className="w-4 h-4" />
                Start Session ({queue.length} {queue.length === 1 ? 'person' : 'people'})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
