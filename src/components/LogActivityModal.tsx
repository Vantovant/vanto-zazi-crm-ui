import { useState } from 'react';
import { X, ClipboardList, Loader2, MessageCircle, Phone, Calendar, FileText, CheckCircle } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';

interface LogActivityModalProps {
  onClose: () => void;
  prefillContactName?: string;
}

const activityTypes = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-400' },
  { value: 'call', label: 'Call', icon: Phone, color: 'text-cyan-400' },
  { value: 'meeting', label: 'Meeting', icon: Calendar, color: 'text-violet-400' },
  { value: 'note', label: 'Note', icon: FileText, color: 'text-slate-400' },
  { value: 'registration', label: 'Registration', icon: CheckCircle, color: 'text-emerald-400' },
];

export function LogActivityModal({ onClose, prefillContactName }: LogActivityModalProps) {
  const { contacts, updateContact } = useCrm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    contactId: '',
    type: 'call',
    summary: '',
    notes: '',
    nextAction: '',
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  // If prefillContactName provided, find matching contact
  const prefillContact = prefillContactName
    ? contacts.find(c => c.FullName === prefillContactName)
    : null;

  const selectedContactId = form.contactId || prefillContact?.id || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) return;
    setLoading(true);

    // Update the contact's action_taken and next_action fields
    const activityType = activityTypes.find(t => t.value === form.type);
    const actionText = `${activityType?.label}: ${form.summary} (${new Date().toLocaleDateString()})`;

    await updateContact(String(selectedContactId), {
      ActionTaken: actionText,
      NextAction: form.nextAction || undefined,
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
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-teal-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Log Activity</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {success ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-medium">Activity logged successfully!</p>
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
                <label className="block text-sm font-medium text-slate-300 mb-2">Activity Type</label>
                <div className="flex gap-2 flex-wrap">
                  {activityTypes.map(t => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => update('type', t.value)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          form.type === t.value
                            ? 'bg-teal-600/20 border-teal-500/50 text-teal-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${form.type === t.value ? 'text-teal-400' : t.color}`} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Summary *</label>
                <input type="text" value={form.summary} onChange={e => update('summary', e.target.value)} placeholder="Brief description of the activity" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Additional details..." rows={3} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Next Action</label>
                <input type="text" value={form.nextAction} onChange={e => update('nextAction', e.target.value)} placeholder="What's the next step?" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Log Activity
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
