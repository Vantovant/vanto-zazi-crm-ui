import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { ISSUE_TYPES } from '@/hooks/useWaitingRoom';

interface Props {
  contactName: string;
  onSubmit: (data: { issue_type: string; issue_note: string; priority: string }) => void;
  onClose: () => void;
}

export function AddToWaitingRoomModal({ contactName, onSubmit, onClose }: Props) {
  const [issueType, setIssueType] = useState('whatsapp_not_working');
  const [issueNote, setIssueNote] = useState('');
  const [priority, setPriority] = useState('medium');

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white text-base">Send to Waiting Room</h3>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-300">
              Adding <span className="font-semibold text-white">{contactName}</span> to the waiting room for follow-up.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 block">Issue Type</label>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setIssueType(t.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors border ${
                      issueType === t.value
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 block">Note</label>
              <textarea
                value={issueNote}
                onChange={e => setIssueNote(e.target.value)}
                placeholder="What needs to be fixed?"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 placeholder:text-slate-500 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase mb-1.5 block">Priority</label>
              <div className="flex gap-2">
                {['high', 'medium', 'low'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors border ${
                      priority === p
                        ? p === 'high' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : p === 'medium' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-slate-600/30 border-slate-500/40 text-slate-300'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-700 flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit({ issue_type: issueType, issue_note: issueNote, priority })}
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
            >
              Add to Waiting Room
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
