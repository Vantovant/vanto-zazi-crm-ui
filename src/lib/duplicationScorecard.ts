export type Rating = 'progressing' | 'standing_still' | 'declining';
export type GapType = 'skill' | 'activity' | 'belief';

export const NUMBER_FIELDS = [
  'new_introduced',
  'helped_started',
  'taught_to_introduce',
  'team_introduced',
  'four_by_four',
  'team_pv',
] as const;
export type NumberField = (typeof NUMBER_FIELDS)[number];
export type Numbers = Record<NumberField, number>;

const SA_OFFSET_MS = 2 * 60 * 60 * 1000; // South Africa: GMT+2, no DST

/** Monday (YYYY-MM-DD) of the week containing `now`, in South African time. */
export function saWeekStart(now: Date = new Date()): string {
  const sa = new Date(now.getTime() + SA_OFFSET_MS);
  const dow = sa.getUTCDay(); // 0=Sun
  const back = (dow + 6) % 7;
  const mon = new Date(Date.UTC(sa.getUTCFullYear(), sa.getUTCMonth(), sa.getUTCDate() - back));
  return mon.toISOString().slice(0, 10);
}

export function addWeeks(weekStart: string, n: number): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n * 7)).toISOString().slice(0, 10);
}

export function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  const f = (dt: Date, yr = false) =>
    dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', ...(yr ? { year: 'numeric' } : {}), timeZone: 'UTC' });
  return `${f(start)} – ${f(end, true)}`;
}

/** More numbers up than down = progressing; more down = declining; else standing still. */
export function suggestRating(current: Numbers, last: Numbers): Rating {
  let up = 0;
  let down = 0;
  for (const k of NUMBER_FIELDS) {
    const a = Number(current[k]) || 0;
    const b = Number(last[k]) || 0;
    if (a > b) up++;
    else if (a < b) down++;
  }
  if (up > down) return 'progressing';
  if (down > up) return 'declining';
  return 'standing_still';
}

export function gapIsProminent(rating: Rating | null, n: Numbers): boolean {
  if (rating === 'standing_still' || rating === 'declining') return true;
  return (n.new_introduced || 0) === 0 && (n.helped_started || 0) === 0 && (n.taught_to_introduce || 0) === 0;
}

export const RATING_LABEL: Record<Rating, string> = {
  progressing: 'Progressing',
  standing_still: 'Standing still',
  declining: 'Declining',
};
