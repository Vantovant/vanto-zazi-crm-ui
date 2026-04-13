import { useState, useCallback } from 'react';
import { X, ClipboardPaste, Upload, Check, AlertTriangle, Users } from 'lucide-react';
import { parseBirthdayReport, type BirthdayRow } from '@/utils/birthdayParser';

interface BirthdaySmartPasteModalProps {
  onClose: () => void;
  onImport: (rows: BirthdayRow[]) => Promise<{ imported: number; matched: number; unmatched: number }>;
}

export function BirthdaySmartPasteModal({ onClose, onImport }: BirthdaySmartPasteModalProps) {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<BirthdayRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; matched: number; unmatched: number } | null>(null);

  const handleParse = useCallback(() => {
    const rows = parseBirthdayReport(rawText);
    setParsed(rows);
  }, [rawText]);

  const handleImport = useCallback(async () => {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    const res = await onImport(parsed);
    setResult(res);
    setImporting(false);
  }, [parsed, onImport]);

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
              <div className="flex justify-center gap-6">
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
              </div>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm">
                Close
              </button>
            </div>
          ) : parsed ? (
            /* Preview */
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">
                  <Users className="w-4 h-4 inline mr-1" />
                  {parsed.length} birthday{parsed.length !== 1 ? 's' : ''} found
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setParsed(null)} className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                    Back
                  </button>
                  <button type="button" onClick={handleImport} disabled={importing || parsed.length === 0}
                    className="px-3 py-1.5 text-xs bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                    {importing ? 'Importing...' : `Import ${parsed.length}`}
                  </button>
                </div>
              </div>

              {parsed.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No birthday rows detected. Check your pasted format.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-700/50 text-slate-400 text-xs">
                        <th className="px-3 py-2 text-left">Level</th>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Birthday</th>
                        <th className="px-3 py-2 text-left">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row, i) => (
                        <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                          <td className="px-3 py-2 text-slate-300">{row.level || '—'}</td>
                          <td className="px-3 py-2 text-slate-300 font-mono text-xs">{row.associateId || '—'}</td>
                          <td className="px-3 py-2 text-white">{row.fullName}</td>
                          <td className="px-3 py-2 text-slate-300">{row.birthDateText || '—'}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs">{row.whenToCongratulate || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            /* Input */
            <>
              <p className="text-sm text-slate-400">Paste the birthday table from the back-office. Supports tab-separated, pipe-separated, or multi-space formats.</p>
              <p className="text-xs text-slate-500">Expected columns: Level · ID Associate · Name · Date of Birth · When to Congratulate</p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Level\tID\tName\tBirthday\tWhen\n1\t1129930\tJohn Smith\t03 May\tAfter 20 days\n2\t934517\tJane Doe\t05 May\ttomorrow`}
                className="w-full h-48 p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/40 font-mono resize-none"
              />
              <div className="flex justify-end">
                <button type="button" onClick={handleParse} disabled={!rawText.trim()}
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
