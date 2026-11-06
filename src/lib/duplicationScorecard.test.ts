import { describe, it, expect } from 'vitest';
import { saWeekStart, addWeeks, suggestRating, gapIsProminent, type Numbers } from './duplicationScorecard';

const zero: Numbers = { new_introduced: 0, helped_started: 0, taught_to_introduce: 0, team_introduced: 0, four_by_four: 0, team_pv: 0 };

describe('duplication scorecard rules', () => {
  it('week starts Monday in SA time (Sunday 23:30 SA is still the previous week)', () => {
    expect(saWeekStart(new Date('2026-11-08T21:30:00Z'))).toBe('2026-11-02');
  });
  it('Monday 00:30 SA (Sunday 22:30 UTC) is the new week', () => {
    expect(saWeekStart(new Date('2026-11-08T22:30:00Z'))).toBe('2026-11-09');
  });
  it('going back one week gives the previous Monday', () => {
    expect(addWeeks('2026-11-02', -1)).toBe('2026-10-26');
  });
  it('suggests progressing when more numbers went up', () => {
    expect(suggestRating({ ...zero, new_introduced: 2 }, zero)).toBe('progressing');
  });
  it('suggests declining when more numbers went down', () => {
    expect(suggestRating(zero, { ...zero, team_pv: 100 })).toBe('declining');
  });
  it('suggests standing still when nothing changed', () => {
    expect(suggestRating(zero, zero)).toBe('standing_still');
  });
  it('gap section is prominent when boxes 1-3 are all 0', () => {
    expect(gapIsProminent('progressing', { ...zero, team_pv: 50 })).toBe(true);
  });
  it('gap section is collapsed when progressing with activity', () => {
    expect(gapIsProminent('progressing', { ...zero, helped_started: 1 })).toBe(false);
  });
  it('gap section is prominent on declining', () => {
    expect(gapIsProminent('declining', { ...zero, new_introduced: 3 })).toBe(true);
  });
});
