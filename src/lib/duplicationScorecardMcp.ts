import { z } from 'zod';
import { saWeekStart, type Numbers } from './duplicationScorecard';

/** Reuses the page's South African week calculation; never shifts caller dates. */
export const scorecardWeek = z.string().superRefine((value, ctx) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    ctx.addIssue({ code: 'custom', message: 'week_start must be a real date in YYYY-MM-DD format.' });
  } else if (date.getUTCDay() !== 1) {
    ctx.addIssue({ code: 'custom', message: `week_start must be a Monday. The correct Monday for ${value} is ${saWeekStart(date)}; no date was changed.` });
  }
});

const count = () => z.number().int('Must be an integer.').min(0, 'Cannot be negative.').max(2147483647, 'Exceeds the supported integer maximum.').optional();
export const scorecardSaveFields = {
  week_start: scorecardWeek.optional().describe('This week / Past week — Monday in YYYY-MM-DD; defaults to the current South African week.'),
  new_introduced: count().describe('New people I introduced this week'),
  helped_started: count().describe('People I helped to get started'),
  taught_to_introduce: count().describe('People I taught to introduce others'),
  team_introduced: count().describe('Team members who introduced someone new'),
  four_by_four: z.number().int('Must be an integer.').min(0, 'My 4x4 must be between 0 and 4.').max(4, 'My 4x4 must be between 0 and 4.').optional().describe('My 4x4: people in place (out of 4)'),
  team_pv: z.number().min(0, 'Cannot be negative.').optional().describe("My team's total PV this week"),
  rating: z.enum(['progressing', 'standing_still', 'declining']).nullable().optional().describe('This week vs last week — Progressing / Standing still / Declining; you still choose.'),
  gap_type: z.enum(['skill', 'activity', 'belief']).nullable().optional().describe("Didn't duplicate this week? — SKILL / ACTIVITY / BELIEF"),
  fix_note: z.string().optional().describe('My one fix before next Friday'),
  commitment_action: z.string().optional().describe('This week I commit to one action…'),
  commitment_person: z.string().optional().describe('The person I will duplicate into:'),
  last_week_done: z.enum(['done', 'partly', 'not_yet']).nullable().optional().describe('Did I do it? — DONE / PARTLY / NOT YET'),
  dry_run: z.boolean().default(false).describe('Preview only: validates and returns what would be saved without writing.'),
};
export const scorecardSaveSchema = z.object(scorecardSaveFields).strict();
export const scorecardGetFields = { week_start: scorecardSaveFields.week_start };
export const scorecardGetSchema = z.object(scorecardGetFields).strict();
export const scorecardListFields = {
  limit: z.number().int().min(1).max(52).default(12).describe('Past weeks — number of weeks to return, newest first (default 12, maximum 52).'),
};
export const scorecardListSchema = z.object(scorecardListFields).strict();
export const emptyScorecardNumbers: Numbers = {
  new_introduced: 0, helped_started: 0, taught_to_introduce: 0,
  team_introduced: 0, four_by_four: 0, team_pv: 0,
};
export const emptyScorecard = {
  ...emptyScorecardNumbers, rating: null, gap_type: null, fix_note: '',
  commitment_action: '', commitment_person: '', last_week_done: null,
};

/** Only caller-provided form fields enter the upsert; tokens supply the owner. */
export function scorecardPatch(input: z.infer<typeof scorecardSaveSchema>) {
  const { dry_run: _dryRun, week_start: _week, ...fields } = input;
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
}