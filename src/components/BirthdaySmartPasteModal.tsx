import { useState, useCallback, useMemo } from 'react';
import { X, ClipboardPaste, Upload, Check, AlertTriangle, Users, CalendarRange, CopyX } from 'lucide-react';
import { parseBirthdayReport, type BirthdayRow } from '@/utils/birthdayParser';
import type { DuplicateCheck, ImportRange } from '@/hooks/useBirthdays';

interface BirthdaySmartPasteModalProps {
  onClose: () => void;
  onImport: (rows: BirthdayRow[], range?: ImportRange) => Promise<{ imported: number; matched: number; unmatched: number }>;
  onCheckDuplicates: (rows: BirthdayRow[]) => Promise<DuplicateCheck[]>;
}

function formatRangeLabel(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const sameYear = s.getFullYear() === e.getFullYear();
  const startText = s.toLocaleDateString('en-GB', opts);
  const endText = e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return sameYear ? `${startText} – ${endText}` : `${s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })} – ${endText}`;
}

export function BirthdaySmartPasteModal({ onClose, onImport, onCheckDuplicates }: BirthdaySmartPasteModalProps) {
  const [rawText, setRawText] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [parsed, setParsed] = useState<BirthdayRow[] | null>(null);
  const [dupChecks, setDupChecks] = useState<DuplicateCheck[]>([]);
  const [included, setIncluded] = useState<boolean[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; matched: number; unmatched: number; skipped: number } | null>(null);

  const rangeValid = !rangeStart || !rangeEnd || rangeStart <= rangeEnd;

  const handleParse = useCallback(async () => {
    const rows = parseBirthdayReport(rawText);
    setParsed(rows);
    if (rows.length === 0) return;
    setCheckingDup(true);
    const checks = await onCheckDuplicates(rows);
    setDupChecks(checks);
    // Default: pre-check everything that ISN'T a duplicate; leave duplicates unchecked
    // so a re-paste of the same report doesn't silently re-import and re-send.
    setIncluded(checks.map(c => !c.isDuplicate));
    setCheckingDup(false);
  }, [rawText, onCheckDuplicates]);

  const toggleIncluded = useCallback((i: number) => {
    setIncluded(prev => prev.map((v, idx) => (idx === i ? !v : v)));
  }, []);

  const includeAllNew = useCallback(() => {
    setIncluded(dupChecks.map(c => !c.isDuplicate));
  }, [dupChecks]);

  const includeEverything = useCallback(() => {
    setIncluded(dupChecks.map(() => true));
  }, [dupChecks]);

  const duplicateCount = useMemo(() => dupChecks.filter(c => c.isDuplicate).length, [dupChecks]);
  const includedCount = useMemo(() => included.filter(Boolean).length, [included]);

  const handleImport = useCallback(async () => {
    if (!parsed || parsed.length === 0) return;
    const rowsToImport = parsed.filter((_, i) => included[i]);
    if (rowsToImport.length === 0) return;
    setImporting(true);
    const range: ImportRange | undefined = rangeStart && rangeEnd
      ? { start: rangeStart, end: rangeEnd, label: formatRangeLabel(rangeStart, rangeEnd) }
      : undefined;
    const res = await onImport(rowsToImport, range);
    setResult({ ...res, skipped: parsed.length - rowsToImport.length });
    setImporting(false);
  }, [parsed, included, onImport, rangeStart, rangeEnd]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold text-white">Birthday Smart Paste</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            /* Result */
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Import Complete</h3>
              <div className="flex justify-center gap-6 flex-wrap">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{result.imported}</p>
                  <p className="text-xs text-slate-400">Imported</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">{result.matched}</p>
                  <p className="text-xs text-slate-400">Matched</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400">{result.unmatched}</p>
                  <p className="text-xs text-slate-400">Unmatched</p>
                </div>
                {result.skipped > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-400">{result.skipped}</p>
                    <p className="text-xs text-slate-400">Skipped (duplicates)</p>
                  </div>
                )}
              </div>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm">
                Close
              </button>
            </div>
          ) : parsed ? (
            /* Preview */
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-slate-300">
                  <Users className="w-4 h-4 inline mr-1" />
                  {parsed.length} birthday{parsed.length !== 1 ? 's' : ''} found
                  {duplicateCount > 0 && (
                    <span className="ml-2 text-amber-300">
                      · {duplicateCount} already in the system
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setParsed(null); setDupChecks([]); setIncluded([]); }}
                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                    Back
                  </button>
                  <button type="button" onClick={handleImport} disabled={importing || checkingDup || includedCount === 0}
                    className="px-3 py-1.5 text-xs bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                    {importing ? 'Importing...' : `Import ${includedCount}`}
                  </button>
                </div>
              </div>

              {duplicateCount > 0 && !checkingDup && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <CopyX className="w-3.5 h-3.5 shrink-0" />
                    {duplicateCount} row{duplicateCount !== 1 ? 's' : ''} already exist{duplicateCount === 1 ? 's' : ''} this cycle — unchecked by default so they won't be re-imported or re-sent.
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={includeAllNew} className="text-[11px] text-slate-300 hover:text-white underline">
                      Only new
                    </button>
                    <button type="button" onClick={includeEverything} className="text-[11px] text-slate-300 hover:text-white underline">
                      Include all anyway
                    </button>
                  </div>
                </div>
              )}

              {checkingDup ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">Checking for duplicates already in the system…</p>
                </div>
              ) : parsed.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No birthday rows detected. Check your pasted format.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-700/50 text-slate-400 text-xs">
                        <th className="px-2 py-2 text-left w-8"></th>
                        <th className="px-3 py-2 text-left">Level</th>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Birthday</th>
                        <th className="px-3 py-2 text-left">When</th>
                        <th className="px-3 py-2 text-left">Phone</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row, i) => {
                        const dup = dupChecks[i];
                        const isIncluded = included[i];
                        return (
                          <tr key={i} className={`border-t border-slate-700/50 ${dup?.isDuplicate ? 'bg-amber-500/5' : 'hover:bg-slate-700/30'}`}>
                            <td className="px-2 py-2">
                              <input type="checkbox" checked={isIncluded} onChange={() => toggleIncluded(i)}
                                className="w-3.5 h-3.5 rounded border-slate-600 text-pink-500 focus:ring-pink-500/30 bg-slate-800" />
                            </td>
                            <td className="px-3 py-2 text-slate-300">{row.level || '—'}</td>
                            <td className="px-3 py-2 text-slate-300 font-mono text-xs">{row.associateId || '—'}</td>
                            <td className="px-3 py-2 text-white">{row.fullName}</td>
                            <td className="px-3 py-2 text-slate-300">{row.birthDateText || '—'}</td>
                            <td className="px-3 py-2 text-slate-400 text-xs">{row.whenToCongratulate || '—'}</td>
                            <td className="px-3 py-2 text-pink-300 text-xs font-mono">{row.phone || '—'}</td>
                            <td className="px-3 py-2 text-xs">
                              {dup?.isDuplicate ? (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300" title={dup.existingBatchLabel ? `Previously pasted: ${dup.existingBatchLabel}` : undefined}>
                                  Already {dup.existingStatus === 'congratulated' ? 'congratulated' : 'imported'}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">New</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            /* Input */
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5 text-pink-400" />
                  Date range for this paste (recommended)
                </p>
                <div className="flex items-center gap-2">
                  <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/40" />
                  <span className="text-slate-500 text-xs">to</span>
                  <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/40" />
                </div>
                {!rangeValid && (
                  <p className="text-xs text-rose-400">End date must be on or after the start date.</p>
                )}
                <p className="text-[11px] text-slate-500">
                  Use the exact window this report covers (e.g. 1–15 Aug) instead of a whole month — narrower, non-overlapping batches
                  are what makes the duplicate check below actually useful.
                </p>
              </div>

              <p className="text-sm text-slate-400">Paste the birthday table from the back-office. Supports tab-separated, pipe-separated, or multi-space formats.</p>
              <p className="text-xs text-slate-500">Expected columns: Level · ID Associate · Name · Date of Birth · When to Congratulate · <span className="text-pink-300">Phone (optional)</span></p>
              <p className="text-xs text-slate-500">If a 6th Phone column is included, it backfills the matched contact's phone number only when empty (existing numbers are never overwritten).</p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Level\tID\tName\tBirthday\tWhen\tPhone\n1\t1129930\tJohn Smith\t03 May\tAfter 20 days\t+27 82 111 2222\n2\t934517\tJane Doe\t05 May\ttomorrow\t`}
                className="w-full h-48 p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/40 font-mono resize-none"
              />
              <div className="flex justify-end">
                <button type="button" onClick={handleParse} disabled={!rawText.trim() || !rangeValid}
                  className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  Parse Birthdays
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
