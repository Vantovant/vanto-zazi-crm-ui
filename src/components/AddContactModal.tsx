import { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';

interface AddContactModalProps {
  onClose: () => void;
}

export function AddContactModal({ onClose }: AddContactModalProps) {
  const { addContact } = useCrm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    FullName: '',
    PhoneNumber: '',
    EmailAddress: '',
    City: '',
    Province: '',
    Country: 'South Africa',
    LeadTemperature: 'Warm' as const,
    LeadType: 'Prospect' as const,
    FocusArea: 'Health Transformation' as const,
    AdditionalNotes: '',
    GOStatus: '',
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.FullName.trim()) { setError('Full name is required.'); return; }
    setLoading(true);
    setError('');
    const result = await addContact(form as any);
    setLoading(false);
    if (result) {
      onClose();
    } else {
      setError('Failed to add contact. Please try again.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-teal-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Add New Contact</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
              <input type="text" value={form.FullName} onChange={e => update('FullName', e.target.value)} placeholder="Enter full name" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
                <input type="text" value={form.PhoneNumber} onChange={e => update('PhoneNumber', e.target.value)} placeholder="Phone number" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={form.EmailAddress} onChange={e => update('EmailAddress', e.target.value)} placeholder="Email address" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">City</label>
                <input type="text" value={form.City} onChange={e => update('City', e.target.value)} placeholder="City" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Province</label>
                <input type="text" value={form.Province} onChange={e => update('Province', e.target.value)} placeholder="Province" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Temperature</label>
                <select value={form.LeadTemperature} onChange={e => update('LeadTemperature', e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Lead Type</label>
                <select value={form.LeadType} onChange={e => update('LeadType', e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  <option value="Prospect">Prospect</option>
                  <option value="Customer">Customer</option>
                  <option value="Distributor">Distributor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Focus Area</label>
                <select value={form.FocusArea} onChange={e => update('FocusArea', e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  <option value="Health Transformation">Health Transformation</option>
                  <option value="Business Opportunity">Business Opportunity</option>
                  <option value="Both">Both</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">GO Status</label>
              <input type="text" value={form.GOStatus} onChange={e => update('GOStatus', e.target.value)} placeholder="e.g. No Status, Promoter, Associate" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
              <textarea value={form.AdditionalNotes} onChange={e => update('AdditionalNotes', e.target.value)} placeholder="Additional notes about this contact..." rows={3} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500 resize-none" />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-sm">{error}</div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Contact
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
