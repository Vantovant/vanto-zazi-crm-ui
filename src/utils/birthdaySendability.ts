import type { BirthdayEntry } from '@/hooks/useBirthdays';
import { normalizePhone } from './contactNormalization';
import { sanitizeAplgoId } from './aplgoId';

export type SendabilityCategory = 'ready' | 'missing_phone' | 'unmatched' | 'duplicate';

const SNOOZE_KEY = 'birthday_sendability_snooze_v1';
const TREND_KEY = 'birthday_phone_health_trend_v1';

// ---------- Snooze (local-only, low-token; no schema change) ----------
type SnoozeMap = Record<string, string>; // birthdayId -> ISO date

function readSnooze(): SnoozeMap {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}'); }
  catch { return {}; }
}
function writeSnooze(map: SnoozeMap) {
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
}
export function isSnoozed(id: string): boolean {
  const m = readSnooze();
  const until = m[id];
  if (!until) return false;
  if (new Date(until).getTime() > Date.now()) return true;
  delete m[id]; writeSnooze(m);
  return false;
}
export function snoozeFor(id: string, days: number, name = '') {
  const m = readSnooze();
  m[id] = new Date(Date.now() + days * 86400_000).toISOString();
  writeSnooze(m);
  appendAudit({ id, name, action: 'snoozed' });
}
export function unsnooze(id: string) {
  const m = readSnooze();
  delete m[id]; writeSnooze(m);
}

// ---------- Skip (local-only persistent dismiss) ----------
const SKIP_KEY = 'birthday_sendability_skip_v1';
function readSkip(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SKIP_KEY) || '[]')); }
  catch { return new Set(); }
}
export function isSkipped(id: string): boolean {
  return readSkip().has(id);
}
export function skip(id: string, name = '') {
  const s = readSkip(); s.add(id);
  localStorage.setItem(SKIP_KEY, JSON.stringify([...s]));
  appendAudit({ id, name, action: 'skipped' });
}
export function unskip(id: string) {
  const s = readSkip(); s.delete(id);
  localStorage.setItem(SKIP_KEY, JSON.stringify([...s]));
}

// ---------- Audit trail (local operational history) ----------
export type AuditAction = 'repaired' | 'skipped' | 'snoozed';
export interface AuditEntry {
  id: string;
  name: string;
  action: AuditAction;
  source?: string;
  phone?: string;
  repairedBy?: string;
  ts: string;
}
const AUDIT_KEY = 'birthday_repair_audit_v1';
const AUDIT_CAP = 100;

export function readAudit(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); }
  catch { return []; }
}
export function appendAudit(e: Omit<AuditEntry, 'ts'>): void {
  const list = readAudit();
  list.unshift({ ...e, ts: new Date().toISOString() });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, AUDIT_CAP)));
}
export function auditRepaired(id: string, name: string, phone: string, source: string, repairedBy?: string) {
  appendAudit({ id, name, action: 'repaired', phone, source, repairedBy });
}
export function repairedToday(): number {
  const today = todayKey();
  return readAudit().filter(a => a.action === 'repaired' && a.ts.startsWith(today)).length;
}

// ---------- Recovery confidence ----------
export type Confidence = 'high' | 'medium' | 'low';
export function confidenceLabel(c: Confidence): string {
  return c === 'high' ? 'High' : c === 'medium' ? 'Medium' : 'Low';
}


// ---------- Categorization ----------
function nameKey(name: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface CategorizedBirthdays {
  ready: BirthdayEntry[];
  missing_phone: BirthdayEntry[];
  unmatched: BirthdayEntry[];
  duplicate: BirthdayEntry[];
  duplicateGroups: Map<string, BirthdayEntry[]>; // for inspection
}

export function hasSendablePhone(b: BirthdayEntry): boolean {
  if (!b.contact_id) return false;
  const normalized = b.phone_normalized || normalizePhone(b.phone_number || '');
  return Boolean(normalized && normalized.length >= 9);
}

export function isDuplicateRisk(
  b: BirthdayEntry,
  groups: Map<string, BirthdayEntry[]>,
): boolean {
  const aplgo = sanitizeAplgoId(b.associate_id);
  const nk = nameKey(b.full_name);
  if (aplgo && (groups.get(`aplgo:${aplgo}`)?.length || 0) > 1) return true;
  if (nk && (groups.get(`name:${nk}`)?.length || 0) > 1) return true;
  return false;
}

export function buildDuplicateGroups(list: BirthdayEntry[]): Map<string, BirthdayEntry[]> {
  const groups = new Map<string, BirthdayEntry[]>();
  list.forEach(b => {
    const aplgo = sanitizeAplgoId(b.associate_id);
    const nk = nameKey(b.full_name);
    if (aplgo) {
      const k = `aplgo:${aplgo}`;
      groups.set(k, [...(groups.get(k) || []), b]);
    }
    if (nk) {
      const k = `name:${nk}`;
      groups.set(k, [...(groups.get(k) || []), b]);
    }
  });
  return groups;
}

export function categorize(list: BirthdayEntry[]): CategorizedBirthdays {
  const groups = buildDuplicateGroups(list);
  const result: CategorizedBirthdays = {
    ready: [], missing_phone: [], unmatched: [], duplicate: [],
    duplicateGroups: groups,
  };
  list.forEach(b => {
    if (isSnoozed(b.id) || isSkipped(b.id)) return;
    if (isDuplicateRisk(b, groups)) { result.duplicate.push(b); return; }
    if (!b.contact_id) { result.unmatched.push(b); return; }
    if (!hasSendablePhone(b)) { result.missing_phone.push(b); return; }
    if (b.opt_out) return; // not ready, but not a fixable cleanup row either
    result.ready.push(b);
  });
  return result;
}

export function isSendReady(b: BirthdayEntry, groups: Map<string, BirthdayEntry[]>): boolean {
  if (!b.contact_id) return false;
  if (!hasSendablePhone(b)) return false;
  if (b.opt_out) return false;
  if (isDuplicateRisk(b, groups)) return false;
  return true;
}

// ---------- Phone health trend ----------
type TrendEntry = { date: string; pct: number };
type TrendStore = { today?: TrendEntry; yesterday?: TrendEntry };

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function recordHealthSnapshot(pct: number): TrendStore {
  let store: TrendStore = {};
  try { store = JSON.parse(localStorage.getItem(TREND_KEY) || '{}'); } catch {}
  const today = todayKey();
  if (!store.today || store.today.date !== today) {
    // Roll today -> yesterday only if it's a distinct prior day (avoid duplicating same-day).
    if (store.today && store.today.date !== today) store.yesterday = store.today;
    store.today = { date: today, pct };
  } else {
    store.today.pct = pct;
  }
  localStorage.setItem(TREND_KEY, JSON.stringify(store));
  return store;
}

export function readTrend(): TrendStore {
  try { return JSON.parse(localStorage.getItem(TREND_KEY) || '{}'); }
  catch { return {}; }
}
