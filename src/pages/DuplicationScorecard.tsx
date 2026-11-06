import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Toaster, toast } from '@/components/callsheets/ui';
import {
  NUMBER_FIELDS, RATING_LABEL, addWeeks, gapIsProminent, saWeekStart, suggestRating, weekLabel,
  type GapType, type Numbers, type Rating,
} from '@/lib/duplicationScorecard';

type Row = Numbers & { week_start: string; rating: Rating | null; gap_type: GapType | null; fix_note: string };

const BOXES: { key: keyof Numbers; label: string; max?: number; decimal?: boolean }[] = [
  { key: 'new_introduced', label: 'New people I introduced this week' },
  { key: 'helped_started', label: 'People I helped to get started' },
  { key: 'taught_to_introduce', label: 'People I taught to introduce others' },
  { key: 'team_introduced', label: 'Team members who introduced someone new' },
  { key: 'four_by_four', label: 'My 4x4: people in place (out of 4)', max: 4 },
  { key: 'team_pv', label: "My team's total PV this week", decimal: true },
];
const SHORT = ['Introduced', 'Started', 'Taught', 'Team intro', '4x4', 'Team PV'];

const GAPS: { key: GapType; title: string; quote: string; fix: string }[] = [
  { key: 'skill', title: 'SKILL', quote: "I don't know how to do it yet.", fix: 'Ask for help. Get trained. Watch someone do it.' },
  { key: 'activity', title: 'ACTIVITY', quote: "I know how. I didn't do it.", fix: "Set one daily action. Show up even when you don't feel like it." },
  { key: 'belief', title: 'BELIEF', quote: "I'm not sure it works for me.", fix: 'Look at who has already done it. Talk to them.' },
];

const empty = (): Numbers => ({ new_introduced: 0, helped_started: 0, taught_to_introduce: 0, team_introduced: 0, four_by_four: 0, team_pv: 0 });

export function DuplicationScorecard() {
  const { user } = useAuth();
  const currentWeek = useMemo(() => saWeekStart(), []);
  const [week, setWeek] = useState(currentWeek);
  const [rows, setRows] = useState<Row[]>([]);
  const [nums, setNums] = useState<Numbers>(empty());
  const [rating, setRating] = useState<Rating | null>(null);
  const [gap, setGap] = useState<GapType | null>(null);
  const [fix, setFix] = useState('');
  const [gapOpen, setGapOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('duplication_scorecards')
      .select('week_start,new_introduced,helped_started,taught_to_introduce,team_introduced,four_by_four,team_pv,rating,gap_type,fix_note')
      .order('week_start', { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []).map((r) => ({ ...r, team_pv: Number(r.team_pv) })) as Row[]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const r = rows.find((x) => x.week_start === week);
    if (r) {
      const n = empty();
      NUMBER_FIELDS.forEach((k) => (n[k] = Number(r[k]) || 0));
      setNums(n); setRating(r.rating); setGap(r.gap_type); setFix(r.fix_note ?? '');
    } else {
      setNums(empty()); setRating(null); setGap(null); setFix('');
    }
  }, [week, rows]);

  const last = rows.find((x) => x.week_start === addWeeks(week, -1));
  const suggestion = last ? suggestRating(nums, last) : null;
  const prominent = gapIsProminent(rating, nums);
  const showGap = prominent || gapOpen;

  const setNum = (key: keyof Numbers, raw: string, max?: number, decimal?: boolean) => {
    let v = decimal ? parseFloat(raw) : parseInt(raw, 10);
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (max !== undefined && v > max) v = max;
    setNums((p) => ({ ...p, [key]: v }));
  };

  const save = async () => {
    if (!user) return;
    if (!rating) { toast.error('Pick Progressing, Standing still or Declining first.'); return; }
    setSaving(true);
    const { error } = await supabase.from('duplication_scorecards').upsert(
      { user_id: user.id, week_start: week, ...nums, rating, gap_type: gap, fix_note: fix.trim() },
      { onConflict: 'user_id,week_start' },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Scorecard saved');
    load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 text-foreground sm:p-6">
      <Toaster />
      <header>
        <h1 className="text-2xl font-bold text-gold sm:text-3xl">My Weekly Duplication Scorecard</h1>
        <p className="mt-1 text-muted-foreground">Complete it honestly every Friday.</p>
      </header>

      <div className="flex items-center justify-between rounded-xl border border-gold/30 bg-card p-2">
        <button aria-label="Previous week" onClick={() => setWeek(addWeeks(week, -1))} className="rounded-lg p-2 text-gold hover:bg-gold/10">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="font-semibold">{weekLabel(week)}</div>
          <div className="text-xs text-muted-foreground">{week === currentWeek ? 'This week' : 'Past week'}</div>
        </div>
        <button aria-label="Next week" disabled={week >= currentWeek} onClick={() => setWeek(addWeeks(week, 1))} className="rounded-lg p-2 text-gold hover:bg-gold/10 disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {BOXES.map((b, i) => (
          <label key={b.key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold font-bold text-gold-foreground">{i + 1}</span>
            <span className="flex-1 text-sm">{b.label}</span>
            <input
              type="number" inputMode={b.decimal ? 'decimal' : 'numeric'} min={0} max={b.max} step={b.decimal ? 'any' : 1}
              value={nums[b.key]} onChange={(e) => setNum(b.key, e.target.value, b.max, b.decimal)}
              className="w-20 rounded-lg border border-gold/40 bg-background px-2 py-2 text-right text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </label>
        ))}
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">This week vs last week</h2>
          {suggestion && <span className="text-xs text-gold">Suggested: {RATING_LABEL[suggestion]}</span>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(RATING_LABEL) as Rating[]).map((r) => (
            <button key={r} onClick={() => setRating(r)}
              className={`rounded-lg border px-2 py-3 text-sm font-medium transition ${rating === r ? 'border-gold bg-gold text-gold-foreground' : 'border-border bg-card hover:border-gold/50'}`}>
              {RATING_LABEL[r]}
            </button>
          ))}
        </div>
      </section>

      <section className={`rounded-xl border p-4 ${prominent ? 'border-gold bg-gold/10' : 'border-border bg-card'}`}>
        <button className="flex w-full items-start justify-between text-left" onClick={() => !prominent && setGapOpen((o) => !o)} disabled={prominent}>
          <div>
            <h2 className="text-lg font-bold text-gold">Didn't duplicate this week?</h2>
            <p className="text-sm text-muted-foreground">No blame. Find the gap, then fix it before next Friday.</p>
          </div>
          {!prominent && <ChevronDown className={`mt-1 h-5 w-5 text-gold transition ${showGap ? 'rotate-180' : ''}`} />}
        </button>
        {showGap && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {GAPS.map((g) => (
                <button key={g.key} onClick={() => setGap(gap === g.key ? null : g.key)}
                  className={`rounded-xl border p-3 text-left transition ${gap === g.key ? 'border-gold bg-gold/15 ring-1 ring-gold' : 'border-border bg-background hover:border-gold/50'}`}>
                  <div className="text-xs font-bold tracking-wider text-gold">{g.title}</div>
                  <div className="mt-1 text-sm italic">"{g.quote}"</div>
                  <div className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">FIX:</span> {g.fix}</div>
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-sm font-medium">My one fix before next Friday</span>
              <textarea value={fix} onChange={(e) => setFix(e.target.value)} rows={2}
                className="mt-1 w-full rounded-lg border border-gold/40 bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold" />
            </label>
          </div>
        )}
      </section>

      <button onClick={save} disabled={saving}
        className="w-full rounded-xl bg-gold py-3 text-base font-bold text-gold-foreground hover:opacity-90 disabled:opacity-50">
        {saving ? 'Saving…' : rows.some((r) => r.week_start === week) ? 'Update this week' : 'Save this week'}
      </button>

      <section className="space-y-2">
        <h2 className="font-semibold text-gold">Past weeks</h2>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No scorecards saved yet.</p>}
        {rows.map((r) => (
          <button key={r.week_start} onClick={() => setWeek(r.week_start)}
            className={`w-full rounded-xl border bg-card p-3 text-left ${r.week_start === week ? 'border-gold' : 'border-border'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{weekLabel(r.week_start)}</span>
              <span className="flex gap-2 text-xs">
                {r.rating && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-gold">{RATING_LABEL[r.rating]}</span>}
                {r.gap_type && <span className="rounded-full border border-border px-2 py-0.5 capitalize">{r.gap_type}</span>}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center sm:grid-cols-6">
              {NUMBER_FIELDS.map((k, i) => (
                <div key={k} className="rounded bg-background px-1 py-1">
                  <div className="text-sm font-semibold">{k === 'four_by_four' ? `${r[k]}/4` : r[k]}</div>
                  <div className="text-[10px] text-muted-foreground">{SHORT[i]}</div>
                </div>
              ))}
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}
