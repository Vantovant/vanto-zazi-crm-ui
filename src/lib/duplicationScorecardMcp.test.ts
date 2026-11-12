import { describe, it, expect } from 'vitest';
import { scorecardWeek, scorecardSaveSchema, scorecardListSchema, scorecardPatch, emptyScorecard } from './duplicationScorecardMcp';
import { saWeekStart } from './duplicationScorecard';
import { runAction } from './mcp/actions';

describe('scorecard MCP week and validation rules', () => {
  it('uses Monday in GMT+2 across the Sunday UTC boundary', () => {
    expect(saWeekStart(new Date('2026-11-08T22:00:00Z'))).toBe('2026-11-09');
  });
  it('accepts the Monday unchanged', () => {
    expect(scorecardWeek.parse('2026-11-09')).toBe('2026-11-09');
  });
  it('rejects Thursday and names the correct Monday without shifting', () => {
    const result = scorecardWeek.safeParse('2026-11-12');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain('2026-11-09');
  });
  it('rejects impossible calendar dates', () => {
    expect(scorecardWeek.safeParse('2026-02-30').success).toBe(false);
  });
  it.each(['new_introduced', 'helped_started', 'taught_to_introduce', 'team_introduced', 'team_pv'])('rejects negative %s', (field) => {
    expect(scorecardSaveSchema.safeParse({ [field]: -1 }).success).toBe(false);
  });
  it.each(['new_introduced', 'helped_started', 'taught_to_introduce', 'team_introduced'])('requires integer %s', (field) => {
    expect(scorecardSaveSchema.safeParse({ [field]: 1.5 }).success).toBe(false);
  });
  it('accepts decimal team PV', () => {
    expect(scorecardSaveSchema.parse({ team_pv: 1.5 }).team_pv).toBe(1.5);
  });
  it('allows only integer 4x4 from 0 to 4 inclusive', () => {
    for (const value of [-1, 4.5, 5]) expect(scorecardSaveSchema.safeParse({ four_by_four: value }).success).toBe(false);
    for (const value of [0, 4]) expect(scorecardSaveSchema.parse({ four_by_four: value }).four_by_four).toBe(value);
  });
  it.each([
    ['rating', ['progressing', 'standing_still', 'declining']],
    ['gap_type', ['skill', 'activity', 'belief']],
    ['last_week_done', ['done', 'partly', 'not_yet']],
  ])('validates %s choices or null', (field, choices) => {
    for (const value of [...choices, null]) expect(scorecardSaveSchema.safeParse({ [field]: value }).success).toBe(true);
    expect(scorecardSaveSchema.safeParse({ [field]: 'unknown' }).success).toBe(false);
  });
  it('defaults the list limit to 12 and bounds it at 52', () => {
    expect(scorecardListSchema.parse({}).limit).toBe(12);
    expect(scorecardListSchema.parse({ limit: 52 }).limit).toBe(52);
    expect(scorecardListSchema.safeParse({ limit: 53 }).success).toBe(false);
  });
  it('keeps omitted fields out of an update and never auto-adds a rating', () => {
    expect(scorecardPatch(scorecardSaveSchema.parse({ new_introduced: 2, dry_run: true }))).toEqual({ new_introduced: 2 });
  });
  it('rejects caller-supplied owner and other undeclared fields', () => {
    expect(scorecardSaveSchema.safeParse({ user_id: 'another-owner' }).success).toBe(false);
  });
});

function fakeClient(existing: Record<string, unknown> | null) {
  const writes: Record<string, unknown>[] = [];
  const filters: [string, unknown][] = [];
  const previous = { ...emptyScorecard, week_start: '2026-11-02', new_introduced: 1 };
  const client = {
    from: (table: string) => {
      expect(table).toBe('duplication_scorecards');
      let week: unknown;
      let payload: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push([key, value]); if (key === 'week_start') week = value; return query; },
        maybeSingle: async () => ({ data: week === '2026-11-02' ? previous : existing, error: null }),
        upsert: (data: Record<string, unknown>, options: { onConflict: string }) => {
          expect(options.onConflict).toBe('user_id,week_start');
          payload = data; writes.push(data); return query;
        },
        single: async () => ({ data: { ...existing, ...payload }, error: null }),
      };
      return query;
    },
  };
  return { client, writes, filters };
}

describe('scorecard MCP action rules without real writes', () => {
  const existing = { ...emptyScorecard, user_id: 'owner', week_start: '2026-11-09', team_pv: 80, rating: 'declining', commitment_action: 'Existing action' };
  it('dry run returns before/after, preserves omitted values and makes zero writes', async () => {
    const db = fakeClient(existing);
    const result = await runAction('save_duplication_scorecard', { week_start: '2026-11-09', new_introduced: 2, dry_run: true }, db.client, 'owner');
    expect(result.status).toBe(200);
    expect(result.body.before).toEqual(existing);
    expect(result.body.after).toEqual({ ...existing, new_introduced: 2 });
    expect(result.body.suggested_rating).toBe('progressing');
    expect(db.writes).toEqual([]);
    expect(db.filters.filter(([key]) => key === 'user_id')).toEqual([['user_id', 'owner'], ['user_id', 'owner']]);
  });
  it('new week defaults missing numbers to zero and does not set rating', async () => {
    const db = fakeClient(null);
    const result = await runAction('save_duplication_scorecard', { week_start: '2026-11-09', dry_run: true }, db.client, 'owner');
    expect(result.body.after).toEqual({ ...emptyScorecard, user_id: 'owner', week_start: '2026-11-09' });
    expect(result.body.before).toBeNull();
    expect(db.writes).toHaveLength(0);
  });
  it('upserts only provided fields on existing weeks, always setting the verified owner', async () => {
    const db = fakeClient(existing);
    const result = await runAction('save_duplication_scorecard', { week_start: '2026-11-09', new_introduced: 3 }, db.client, 'owner');
    expect(result.status).toBe(200);
    expect(db.writes).toEqual([{ week_start: '2026-11-09', user_id: 'owner', new_introduced: 3 }]);
    expect(result.body.before).toEqual(existing);
    expect(result.body.after).toEqual({ ...existing, new_introduced: 3 });
  });
  it('invalid Monday returns a clear error before any database access', async () => {
    const result = await runAction('save_duplication_scorecard', { week_start: '2026-11-12' }, {}, 'owner');
    expect(result.status).toBe(400);
    expect(result.body.message).toContain('2026-11-09');
  });
});