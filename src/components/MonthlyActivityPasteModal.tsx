import { useState } from 'react';
import {
  X, ClipboardPaste, Loader2, Check, Sparkles, MessageCircle, AlertTriangle,
  Calendar, Users, ShieldAlert,
} from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWaitingRoom } from '@/hooks/useWaitingRoom';
import { parseMonthlyActivityReport, type MonthlyActivityRow } from '@/utils/monthlyActivityParser';
import { normalizeActivityMonth } from '@/utils/monthlyActivityKey';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeAplgoId } from '@/utils/aplgoId';
import type { Prospect } from '@/data/mockData';

interface MatchedRow extends MonthlyActivityRow {
  contact: Prospect | null;
  matchStatus: 'matched' | 'unmatched';
  matchMethod: 'local-cache' | 'exact-db' | 'none';
  selected: boolean;
}

function dbContactToProspect(row: any): Prospect {
  return {
    id: row.id as unknown as number,
    DateCaptured: row.date_captured,
    FullName: row.full_name,
    PhoneNumber: row.phone_number,
    EmailAddress: row.email_address,
    City: row.city,
    Province: row.province,
    State: row.state,
    Country: row.country,
    LeadTemperature: row.lead_temperature,
    CommunicationStatus: row.communication_status,
    RegistrationStatus: row.registration_status,
    LeadType: row.lead_type,
    InterestLevel: row.interest_level,
    FocusArea: row.focus_area,
    LeadPath: row.lead_path,
    SponsorName: row.sponsor_name,
    AssignedTo: row.assigned_to,
    ActionTaken: row.action_taken,
    NextAction: row.next_action,
    MeetingTime: row.meeting_time,
    APLGoID: row.aplgo_id,
    AssociateStatus: row.associate_status,
    AdditionalNotes: row.additional_notes,
    GOStatus: row.go_status,
    SalutationTitle: row.salutation_title,
    Leg: row.leg,
    Level: row.level,
  } as Prospect;
}

interface MonthlyActivityPasteModalProps {
  onClose: () => void;
  onComplete?: (matched: { contact: Prospect; amount: number; month: string; actualLevel: string; displayedLevel: string }[]) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getCurrentMonthYear() {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function MonthlyActivityPasteModal({ onClose, onComplete }: MonthlyActivityPasteModalProps) {
  const { contacts, addOrder, refetchOrders } = useCrm();
  const { user } = useAuth();
  const { addToWaitingRoom } = useWaitingRoom();
  const [pastedText, setPastedText] = useState('');
  const [activityMonth, setActivityMonth] = useState(getCurrentMonthYear());
  const [step, setStep] = useState<'input' | 'preview' | 'done'>('input');
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState({ created: 0, skipped: 0, flagged: 0 });

  const handleParse = async () => {
    if (!pastedText.trim()) { setError('Please paste monthly activity data.'); return; }
    setError('');
    setMatching(true);

    const parsed = parseMonthlyActivityReport(pastedText);
    if (parsed.length === 0) {
      setError('No entries found. Make sure the format is:\nLevel 1\n1129930(6): 2,520.00 R, 934517: 2,385.00 R');
      setMatching(false);
      return;
    }

    const localByAplgo = new Map(
      contacts
        .map(c => [sanitizeAplgoId(c.APLGoID), c] as const)
        .filter(([aplgo]) => aplgo)
    );

    let rows: MatchedRow[] = parsed.map(row => {
      const key = sanitizeAplgoId(row.userId);
      const contact = localByAplgo.get(key) || null;
      return {
        ...row,
        contact,
        matchStatus: contact ? 'matched' : 'unmatched',
        matchMethod: contact ? 'local-cache' : 'none',
        selected: !!contact,
      };
    });

    const unmatchedIds = Array.from(new Set(rows
      .filter(r => !r.contact)
      .map(r => sanitizeAplgoId(r.userId))
      .filter(Boolean)));

    if (user && unmatchedIds.length > 0) {
      const { data, error: lookupError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .in('aplgo_id', unmatchedIds);

      if (lookupError) {
        console.error('Monthly Activity exact DB fallback failed:', lookupError);
        setError(`Exact DB fallback lookup failed: ${lookupError.message}`);
      } else if (Array.isArray(data) && data.length > 0) {
        const dbByAplgo = new Map(data.map((row: any) => [sanitizeAplgoId(row.aplgo_id), dbContactToProspect(row)]));
        rows = rows.map(row => {
          if (row.contact) return row;
          const contact = dbByAplgo.get(sanitizeAplgoId(row.userId)) || null;
          return contact
            ? { ...row, contact, matchStatus: 'matched', matchMethod: 'exact-db', selected: true }
            : row;
        });
      }
    }

    setMatchedRows(rows);
    setStep('preview');
    setMatching(false);
  };

  const toggleRow = (idx: number) => {
    setMatchedRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = () => {
    const allSelected = matchedRows.filter(r => r.contact).every(r => r.selected);
    setMatchedRows(prev => prev.map(r => r.contact ? { ...r, selected: !allSelected } : r));
  };

  const selectedRows = matchedRows.filter(r => r.selected && r.contact);
  const matchedCount = matchedRows.filter(r => r.contact).length;
  const unmatchedCount = matchedRows.filter(r => !r.contact).length;
  const totalAmount = selectedRows.reduce((s, r) => s + r.amount, 0);

  const handleSave = async () => {
    if (!user || selectedRows.length === 0) return;
    setSaving(true);
    setError('');
    let created = 0;
    let skipped = 0;
    let flagged = 0;

    // ── MP0.1 stable signature + within-batch occurrence ──
    // sig = user|monthKey|aplgoUserId|amount|displayedLevel|actualLevel
    // dedupe_key = ma|{sig}|#{occurrence_within_this_paste}
    // Cross-batch repeats default to skipped or Needs Review (never auto-promote).
    const monthKey = normalizeActivityMonth(activityMonth) || activityMonth.replace(/\s/g, '');
    const buildSig = (row: typeof selectedRows[number]) =>
      [
        user.id,
        monthKey,
        row.userId,
        row.amount,
        row.displayedLevel || 'x',
        row.actualLevel || 'x',
      ].join('|').toLowerCase();

    // Pre-fetch existing dedupe_keys for this user + this month to detect
    // ambiguous later repeats BEFORE attempting insert.
    const sigPrefix = `ma|${[user.id, monthKey].join('|').toLowerCase()}|`;
    let existingKeys = new Set<string>();
    try {
      const { data: existing } = await (supabase.from('orders') as any)
        .select('dedupe_key')
        .eq('user_id', user.id)
        .eq('source', 'monthly-activity-paste')
        .like('dedupe_key', `${sigPrefix}%`);
      if (Array.isArray(existing)) {
        existingKeys = new Set(existing.map((r: any) => String(r.dedupe_key || '').toLowerCase()));
      }
    } catch (e) {
      console.warn('[MP0.1] could not pre-fetch existing dedupe keys; will rely on DB unique index', e);
    }

    // Count identical signatures within THIS paste (proof-of-same-report-twin).
    const sigCountInBatch = new Map<string, number>();
    for (const r of selectedRows) {
      const s = buildSig(r);
      sigCountInBatch.set(s, (sigCountInBatch.get(s) || 0) + 1);
    }

    const occurrenceCursor = new Map<string, number>(); // sig -> next occurrence # in this paste
    const monthSlug = activityMonth.replace(/\s/g, '');

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      if (!row.contact) continue;

      const sig = buildSig(row);
      const occ = (occurrenceCursor.get(sig) || 0) + 1;
      occurrenceCursor.set(sig, occ);

      const dedupeKey = `ma|${sig}|#${occ}`;
      const firstKey = `ma|${sig}|#1`;
      const thisKeyAlreadyExists = existingKeys.has(dedupeKey);
      const firstAlreadyExists = existingKeys.has(firstKey);
      const sigCountThisPaste = sigCountInBatch.get(sig) || 0;
      const sameReportTwin = sigCountThisPaste >= 2;

      // MP0.1 final duplicate-branch order.
      //
      // A. Exact key already exists → silent skip (no Needs Review noise).
      if (thisKeyAlreadyExists) {
        skipped++;
        continue;
      }

      // B. Same-report twin proof in current paste → safe to insert this
      //    occurrence (e.g. old #1 already in DB, new #2 paired in same paste).
      if (sameReportTwin) {
        // fall through to insert
      }
      // C. Fresh first occurrence (no prior #1 in DB) → normal insert.
      else if (occ === 1 && !firstAlreadyExists) {
        // fall through to insert
      }
      // D. Ambiguous repeat: tries to introduce a new non-existing occurrence
      //    (occ >= 2) without same-report twin proof, OR any other unsafe case
      //    where prior signature exists but this exact key is new.
      //    Route to Needs Review — never insert, never Crown-able.
      else {
        await addToWaitingRoom({
          contact_id: String(row.contact.id),
          issue_type: 'follow_up_correction',
          issue_note:
            `Possible duplicate Monthly Activity entry — owner approval required. ` +
            `Month: ${activityMonth}. Amount: R${row.amount}. ` +
            `Level: ${row.displayedLevel}/${row.actualLevel}. ` +
            `A prior entry with the same signature exists and this paste did not provide same-report twin proof for a new occurrence.`,
          priority: 'medium',
        });
        flagged++;
        continue;
      }


      const entrySig = `${row.amount}-${row.displayedLevel || 'x'}-${row.actualLevel || 'x'}-occ${occ}`;
      const res = await addOrder({
        orderId: `MA-${row.userId}-${monthSlug}-${entrySig}`,
        contactName: row.contact.FullName,
        contact_id: String(row.contact.id),
        product: `Monthly Activity - ${activityMonth}`,
        quantity: 1,
        amount: row.amount,
        status: 'Paid',
        orderDate: new Date().toISOString().split('T')[0],
        badges: ['Activity'] as any,
        purchaseType: 'Activity',
        pvAmount: 0,
        source: 'monthly-activity-paste',
        salesChannel: 'Online',
        dedupe_key: dedupeKey,
      });
      if (res && (res as any).duplicate) skipped++;
      else if (res) created++;
      else skipped++;
    }

    await refetchOrders();
    setResult({ created, skipped, flagged });
    setSaving(false);
    setStep('done');

    // Notify parent with matched data for WhatsApp prep
    if (onComplete) {
      onComplete(selectedRows.filter(r => r.contact).map(r => ({
        contact: r.contact!,
        amount: r.amount,
        month: activityMonth,
        actualLevel: r.actualLevel,
        displayedLevel: r.displayedLevel,
      })));
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Monthly Activity Paste</h2>
                <p className="text-xs text-slate-400">Paste activity purchases → match contacts → send thank-you</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {step === 'input' && (
              <>
                {/* Activity Month */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    <Calendar className="w-4 h-4 inline mr-1.5" />
                    Activity Month *
                  </label>
                  <input
                    type="text"
                    value={activityMonth}
                    onChange={e => setActivityMonth(e.target.value)}
                    placeholder="e.g. March 2026"
                    className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-500"
                  />
                </div>

                {/* Paste area */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Paste Monthly Activity Report *
                  </label>
                  <div className="relative">
                    <textarea
                      value={pastedText}
                      onChange={e => setPastedText(e.target.value)}
                      placeholder={"Level 1\n1129930(6): 2,520.00 R, 934517: 2,385.00 R, 1230521: 1,968.00 R\n\nLevel 2\n879371(2): 1,575.00 R, 586154: 1,500.00 R"}
                      rows={12}
                      className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 placeholder:text-slate-500 font-mono resize-none"
                    />
                    {!pastedText && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <ClipboardPaste className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-600">Ctrl+V to paste activity report</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Format: Level headers followed by comma-separated entries like <code className="text-slate-400">1129930(6): 2,520.00 R, 934517: 2,385.00 R</code>
                  </p>
                </div>
              </>
            )}

            {step === 'preview' && (
              <>
                {/* Summary banner */}
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
                  <Sparkles className="w-4 h-4 inline mr-1.5" />
                  {matchedRows.length} entries parsed · {matchedCount} matched · {unmatchedCount} unmatched · Month: {activityMonth}
                </div>

                {/* Smart Tag applied */}
                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">This import will apply:</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">Month: {activityMonth}</span>
                    <span className="text-xs px-2 py-1 rounded bg-teal-500/20 text-teal-400">Type: Monthly Activity</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={toggleAll} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    {matchedRows.filter(r => r.contact).every(r => r.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                  <div className="text-xs text-slate-400">
                    {selectedRows.length} selected · R{totalAmount.toLocaleString()}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 border-b border-slate-700">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">✓</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Contact</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">User ID</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Displayed Lvl</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Actual Lvl</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Amount</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Method</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {matchedRows.map((row, idx) => (
                        <tr
                          key={idx}
                          onClick={() => row.contact && toggleRow(idx)}
                          className={`transition-colors ${row.contact ? 'cursor-pointer hover:bg-slate-700/30' : 'opacity-60'} ${
                            row.selected ? 'bg-slate-800/80' : 'bg-slate-800/30'
                          }`}
                        >
                          <td className="px-3 py-2.5">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              row.selected && row.contact ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                            }`}>
                              {row.selected && row.contact && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`font-medium ${row.contact ? 'text-slate-200' : 'text-slate-500'}`}>
                              {row.contact?.FullName || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">{row.userId}</td>
                          <td className="px-3 py-2.5 text-slate-400">{row.displayedLevel}</td>
                          <td className="px-3 py-2.5">
                            <span className={row.actualLevel !== row.displayedLevel ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                              {row.actualLevel}
                            </span>
                            {row.actualLevel !== row.displayedLevel && (
                              <span className="ml-1 text-[10px] text-amber-500">override</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-200 font-medium">R{row.amount.toLocaleString()}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              row.matchMethod === 'exact-db'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : row.matchMethod === 'local-cache'
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {row.matchMethod === 'exact-db' ? 'Exact DB' : row.matchMethod === 'local-cache' ? 'Local cache' : 'None'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {row.contact ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Matched</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-medium flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" /> Unmatched
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {unmatchedCount > 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 inline mr-1.5" />
                    {unmatchedCount} entries could not be matched by APLGO ID. These contacts may need to be added to the CRM first.
                  </div>
                )}
              </>
            )}

            {step === 'done' && (
              <div className="py-8 text-center space-y-3">
                <Check className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-semibold text-white">Import Complete</h3>
                <div className="flex justify-center gap-4 text-sm flex-wrap">
                  <span className="text-emerald-400">{result.created} Created</span>
                  <span className="text-slate-400">{result.skipped} Duplicate-skipped</span>
                  <span className="text-amber-400">{result.flagged} Flagged for Review</span>
                </div>
                <p className="text-sm text-slate-400">
                  Month: {activityMonth} · Use the Activities or Monthly Activity Push page to send thank-you messages.
                </p>
                {result.flagged > 0 && (
                  <div className="mx-auto max-w-md p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 text-left">
                    <ShieldAlert className="w-4 h-4 inline mr-1.5" />
                    <strong>{result.flagged}</strong> row(s) matched an existing entry from a previous import without
                    a same-report twin. They were sent to <strong>Needs Review</strong> (Waiting Room) and were NOT
                    inserted as send-ready entries. Owner approval required.
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-sm whitespace-pre-line">{error}</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
            {step === 'preview' && (
              <button type="button" onClick={() => setStep('input')} className="text-sm text-slate-400 hover:text-white transition-colors">
                ← Back
              </button>
            )}
            {step !== 'preview' && <div />}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                {step === 'done' ? 'Close' : 'Cancel'}
              </button>
              {step === 'input' && (
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={matching}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {matching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {matching ? 'Matching...' : 'Parse & Match'}
                </button>
              )}
              {step === 'preview' && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || selectedRows.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Saving...' : `Save ${selectedRows.length} & Prepare Thank-You`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
