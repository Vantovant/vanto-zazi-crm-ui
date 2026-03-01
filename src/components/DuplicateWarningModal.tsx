import { useState } from 'react';
import { X, AlertTriangle, ExternalLink, Loader2, GitMerge } from 'lucide-react';

interface DuplicateContact {
  id: string;
  full_name: string;
  phone_number: string;
  email_address: string;
  lead_type: string;
  registration_status: string;
  updated_at: string;
}

interface DuplicateWarningModalProps {
  existingContact: DuplicateContact;
  matchType: 'phone' | 'email';
  matchValue: string;
  onClose: () => void;
  onOpenExisting: (id: string) => void;
  onMergeIntoExisting: (id: string) => Promise<void>;
}

export function DuplicateWarningModal({
  existingContact,
  matchType,
  matchValue,
  onClose,
  onOpenExisting,
  onMergeIntoExisting,
}: DuplicateWarningModalProps) {
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    setMerging(true);
    await onMergeIntoExisting(existingContact.id);
    setMerging(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Duplicate Found</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-300">
              A contact with the same <span className="text-amber-400 font-medium">{matchType}</span>{' '}
              (<span className="text-white font-mono text-xs">{matchValue}</span>) already exists:
            </p>

            <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-2">
              <p className="text-white font-medium">{existingContact.full_name}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Phone:</span>{' '}
                  <span className="text-slate-300">{existingContact.phone_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>{' '}
                  <span className="text-slate-300">{existingContact.email_address || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Lead Type:</span>{' '}
                  <span className="text-slate-300">{existingContact.lead_type}</span>
                </div>
                <div>
                  <span className="text-slate-500">Reg Status:</span>{' '}
                  <span className="text-slate-300">{existingContact.registration_status}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Last Updated:</span>{' '}
                  <span className="text-slate-300">{new Date(existingContact.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenExisting(existingContact.id)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Existing Contact
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={merging}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                Update Existing with New Values
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
