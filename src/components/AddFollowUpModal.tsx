import { useState } from 'react';
import { X, Bell, Loader2, CheckCircle } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';

interface AddFollowUpModalProps {
  onClose: () => void;
  prefillContactName?: string;
}

export function AddFollowUpModal({ onClose, prefillContactName }: AddFollowUpModalProps) {
  const { contacts, updateContact } = useCrm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    contactId: '',
    nextAction: '',
    meetingTime: '',
    notes: '',
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const prefillContact = prefillContactName
    ? contacts.find(c => c.FullName === prefillContactName)
    : null;

  const selectedContactId = form.contactId || prefillContact?.id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !form.nextAction.trim()) return;
    setLoading(true);

    await updateContact(String(selectedContactId), {
      NextAction: form.nextAction,
      MeetingTime: form.meetingTime || undefined,
      AdditionalNotes: form.notes || undefined,
    } as any);

    setLoading(false);
    setSuccess(true);
    setTimeout(() => onClose(), 1200);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Add Follow-up</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {success ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-medium">Follow-up added!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Contact *</label>
                <select
                  value={selectedContactId}
                  onChange={e => update('contactId', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                  required
                >
                  <option value="">Select a contact...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.FullName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Follow-up Action *</label>
                <input type="text" value={form.nextAction} onChange={e => update('nextAction', e.target.value)} placeholder="e.g. Call back about product info" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">When</label>
                <input type="datetime-local" value={form.meetingTime} onChange={e => update('meetingTime', e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Additional context..." rows={2} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500 resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Follow-up
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
