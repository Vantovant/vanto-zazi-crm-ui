import { useState, useMemo, useCallback } from 'react';
import {
  Cake, ClipboardPaste, Search, ExternalLink, Check,
  ChevronDown, ChevronUp, MessageCircle, Trash2, Filter, PartyPopper, Play,
} from 'lucide-react';
import { classifyBirthday, daysUntil } from '@/utils/birthdayParser';
import { useBirthdays, type BirthdayEntry } from '@/hooks/useBirthdays';
import { BirthdaySmartPasteModal } from './BirthdaySmartPasteModal';
import { BirthdayComposerModal } from './BirthdayComposerModal';
import { BirthdaySessionModal } from './BirthdaySessionModal';

type FilterType = 'all' | 'today' | 'tomorrow' | 'this_week' | 'upcoming' | 'congratulated' | 'not_congratulated' | 'unmatched';

const STATUS_COLORS: Record<string, string> = {
  not_congratulated: 'bg-amber-500/20 text-amber-300',
  congratulated: 'bg-emerald-500/20 text-emerald-300',
  needs_review: 'bg-rose-500/20 text-rose-300',
  unmatched: 'bg-slate-500/20 text-slate-300',
};

export function BirthdayPanel() {
  const { birthdays, loading, importBirthdays, markCongratulated, deleteBirthday, clearAll } = useBirthdays();
  const [showPaste, setShowPaste] = useState(false);
  const [composerEntries, setComposerEntries] = useState<BirthdayEntry[] | null>(null);
  const [composerIndex, setComposerIndex] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSession, setShowSession] = useState(false);

  // Counts
  const counts = useMemo(() => {
    const c = { today: 0, tomorrow: 0, this_week: 0, upcoming: 0, congratulated: 0, not_congratulated: 0, unmatched: 0 };
    birthdays.forEach(b => {
      const timing = classifyBirthday(b.congratulate_by_date ? new Date(b.congratulate_by_date) : b.birth_date ? new Date(b.birth_date) : null);
      if (timing === 'today') c.today++;
      else if (timing === 'tomorrow') c.tomorrow++;
      else if (timing === 'this_week') c.this_week++;
      else c.upcoming++;
      if (b.status === 'congratulated') c.congratulated++;
      else if (b.status === 'unmatched') c.unmatched++;
      else c.not_congratulated++;
    });
    return c;
  }, [birthdays]);

  const filtered = useMemo(() => {
    let list = birthdays;
    if (filter === 'today' || filter === 'tomorrow' || filter === 'this_week' || filter === 'upcoming') {
      list = list.filter(b => {
        const d = b.congratulate_by_date ? new Date(b.congratulate_by_date) : b.birth_date ? new Date(b.birth_date) : null;
        return classifyBirthday(d) === filter;
      });
    } else if (filter === 'congratulated') {
      list = list.filter(b => b.status === 'congratulated');
    } else if (filter === 'not_congratulated') {
      list = list.filter(b => b.status === 'not_congratulated');
    } else if (filter === 'unmatched') {
      list = list.filter(b => b.status === 'unmatched');
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b => b.full_name.toLowerCase().includes(q) || b.associate_id.includes(q));
    }
    return list;
  }, [birthdays, filter, search]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const openComposer = useCallback((entries: BirthdayEntry[], idx: number) => {
    setComposerEntries(entries);
    setComposerIndex(idx);
  }, []);

  const openBulkComposer = useCallback(() => {
    const selected = filtered.filter(b => selectedIds.has(b.id) && b.status !== 'congratulated');
    if (selected.length > 0) openComposer(selected, 0);
  }, [filtered, selectedIds, openComposer]);

  const handleCongratulated = useCallback(async (id: string) => {
    await markCongratulated(id);
  }, [markCongratulated]);

  return (
    <>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        {/* Header */}
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors">
          <div className="flex items-center gap-2">
            <Cake className="w-5 h-5 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">Birthday WhatsApp Engine</h3>
            {birthdays.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-xs font-medium">{birthdays.length}</span>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            {/* Notification counters */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'today' as FilterType, label: 'Today', count: counts.today, color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
                { key: 'tomorrow' as FilterType, label: 'Tomorrow', count: counts.tomorrow, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                { key: 'this_week' as FilterType, label: 'This Week', count: counts.this_week, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                { key: 'upcoming' as FilterType, label: 'Upcoming', count: counts.upcoming, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
              ].map(n => (
                <button key={n.key} type="button" onClick={() => setFilter(f => f === n.key ? 'all' : n.key)}
                  className={`flex flex-col items-center py-2 rounded-lg border text-xs transition-all ${
                    filter === n.key ? n.color : 'border-slate-700 text-slate-400 hover:bg-slate-700/50'
                  }`}>
                  <span className="text-lg font-bold">{n.count}</span>
                  <span>{n.label}</span>
                </button>
              ))}
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setShowPaste(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors">
                <ClipboardPaste className="w-3 h-3" />
                Smart Paste
              </button>
              {birthdays.filter(b => b.status !== 'congratulated').length > 0 && (
                <button type="button" onClick={() => setShowSession(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                  <Play className="w-3 h-3" />
                  Start Session
                </button>
              )}
              {selectedIds.size > 0 && (
                <button type="button" onClick={openBulkComposer}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
                  <PartyPopper className="w-3 h-3" />
                  Message Selected ({selectedIds.size})
                </button>
              )}
              <div className="flex-1" />
              {/* Filter buttons */}
              <div className="flex gap-1">
                {[
                  { key: 'not_congratulated' as FilterType, label: 'Pending' },
                  { key: 'congratulated' as FilterType, label: 'Done' },
                  { key: 'unmatched' as FilterType, label: 'Unmatched' },
                ].map(f => (
                  <button key={f.key} type="button" onClick={() => setFilter(fi => fi === f.key ? 'all' : f.key)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      filter === f.key ? 'bg-pink-500/20 text-pink-300' : 'text-slate-400 hover:text-slate-300'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            {birthdays.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input type="text" placeholder="Search birthdays..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/40 placeholder:text-slate-500"
                />
              </div>
            )}

            {/* List */}
            {filtered.length === 0 ? (
              <div className="text-center py-6">
                <Cake className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  {birthdays.length === 0 ? 'No birthdays imported yet. Use Smart Paste to add.' : 'No birthdays match this filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {filtered.map((b, idx) => {
                  const d = b.congratulate_by_date ? new Date(b.congratulate_by_date) : b.birth_date ? new Date(b.birth_date) : null;
                  const days = daysUntil(d);
                  const timing = classifyBirthday(d);
                  const isSelected = selectedIds.has(b.id);

                  return (
                    <div key={b.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        isSelected ? 'border-pink-500/50 bg-pink-500/10' : 'border-slate-700/50 hover:bg-slate-700/30'
                      }`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(b.id)}
                        className="w-3.5 h-3.5 rounded border-slate-600 text-pink-500 focus:ring-pink-500/30 bg-slate-800" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium truncate">{b.full_name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[b.status] || STATUS_COLORS.unmatched}`}>
                            {b.status === 'not_congratulated' ? 'Pending' : b.status === 'congratulated' ? 'Done' : b.status === 'unmatched' ? 'Unmatched' : b.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>🎂 {b.birth_date_text || '—'}</span>
                          {b.associate_id && <span className="font-mono">ID: {b.associate_id}</span>}
                          {days !== null && (
                            <span className={`${timing === 'today' ? 'text-rose-400 font-medium' : timing === 'tomorrow' ? 'text-amber-400' : 'text-slate-500'}`}>
                              {timing === 'today' ? '🎉 Today!' : timing === 'tomorrow' ? 'Tomorrow' : days > 0 ? `In ${days}d` : days < 0 ? `${Math.abs(days)}d ago` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {b.status !== 'congratulated' && (
                          <button type="button" onClick={() => openComposer([b], 0)} title="Send birthday message"
                            className="p-1.5 hover:bg-green-500/20 rounded-md transition-colors">
                            <MessageCircle className="w-4 h-4 text-green-400" />
                          </button>
                        )}
                        {b.status !== 'congratulated' && (
                          <button type="button" onClick={() => markCongratulated(b.id)} title="Mark congratulated"
                            className="p-1.5 hover:bg-emerald-500/20 rounded-md transition-colors">
                            <Check className="w-4 h-4 text-emerald-400" />
                          </button>
                        )}
                        <button type="button" onClick={() => deleteBirthday(b.id)} title="Remove"
                          className="p-1.5 hover:bg-rose-500/20 rounded-md transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showPaste && (
        <BirthdaySmartPasteModal onClose={() => setShowPaste(false)} onImport={importBirthdays} />
      )}
      {composerEntries && (
        <BirthdayComposerModal
          entries={composerEntries}
          initialIndex={composerIndex}
          onClose={() => setComposerEntries(null)}
          onCongratulated={handleCongratulated}
        />
      )}
      {showSession && (
        <BirthdaySessionModal
          birthdays={birthdays}
          onClose={() => setShowSession(false)}
          onCongratulated={async (id) => { await markCongratulated(id); }}
        />
      )}
    </>
  );
}
