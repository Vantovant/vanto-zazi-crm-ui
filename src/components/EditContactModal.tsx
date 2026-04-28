import { useState } from 'react';
import { X, Pencil, Loader2, CheckCircle } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';
import type { Prospect } from '@/data/mockData';
import { DuplicateWarningModal } from './DuplicateWarningModal';
import { safeMerge } from '@/utils/contactNormalization';
import { SALUTATION_OPTIONS } from '@/utils/templateMerge';
import { filterOptions } from '@/data/mockData';

interface EditContactModalProps {
  prospect: Prospect;
  onClose: () => void;
  onSaved: () => void;
}

export function EditContactModal({ prospect, onClose, onSaved }: EditContactModalProps) {
  const { updateContact, checkDuplicate } = useCrm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [duplicateMatch, setDuplicateMatch] = useState<{ contact: any; matchType: 'phone' | 'email'; matchValue: string } | null>(null);

  const [form, setForm] = useState({
    FullName: prospect.FullName || '',
    PhoneNumber: prospect.PhoneNumber || '',
    EmailAddress: prospect.EmailAddress || '',
    City: prospect.City || '',
    Province: prospect.Province || '',
    Country: prospect.Country || 'South Africa',
    LeadTemperature: prospect.LeadTemperature || 'Warm',
    LeadType: prospect.LeadType || 'Prospect',
    RegistrationStatus: prospect.RegistrationStatus || 'Not Registered',
    FocusArea: prospect.FocusArea || 'Health Transformation',
    NextAction: prospect.NextAction || '',
    AdditionalNotes: prospect.AdditionalNotes || '',
    GOStatus: prospect.GOStatus || '',
    SponsorName: prospect.SponsorName || '',
    SalutationTitle: prospect.SalutationTitle || 'Leader',
    Leg: prospect.Leg || '',
    Level: prospect.Level || '',
    APLGoID: (prospect as any).APLGoID || '',
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.FullName.trim()) { setError('Full name is required.'); return; }
    setLoading(true);
    setError('');

    // Check for duplicates (exclude current contact)
    const dup = await checkDuplicate(form.PhoneNumber, form.EmailAddress, String(prospect.id));
    if (dup) {
      setDuplicateMatch(dup);
      setLoading(false);
      return;
    }

    const trimmedForm = { ...form, APLGoID: (form.APLGoID || '').trim() };
    const result = await updateContact(String(prospect.id), trimmedForm as Partial<Prospect>);
    setLoading(false);
    if (result === 'duplicate' as any) {
      setError('A contact with this phone or email already exists. Visit the Duplicates page to review.');
    } else if (result) {
      setSuccess(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 800);
    } else {
      setError('Failed to update contact. Please try again.');
    }
  };

  const handleMergeIntoExisting = async (existingId: string) => {
    const fieldMap: Record<string, string> = {
      FullName: 'full_name', PhoneNumber: 'phone_number', EmailAddress: 'email_address',
      City: 'city', Province: 'province', Country: 'country',
      LeadTemperature: 'lead_temperature', LeadType: 'lead_type',
      RegistrationStatus: 'registration_status', FocusArea: 'focus_area',
      NextAction: 'next_action', AdditionalNotes: 'additional_notes',
      GOStatus: 'go_status', SponsorName: 'sponsor_name', SalutationTitle: 'salutation_title',
      Leg: 'leg', Level: 'level',
    };

    const incoming: Record<string, unknown> = {};
    for (const [formKey, dbKey] of Object.entries(fieldMap)) {
      incoming[dbKey] = (form as any)[formKey] || '';
    }

    const existing = duplicateMatch?.contact || {};
    const merged = safeMerge(existing, incoming);

    const reverseMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldMap)) reverseMap[v] = k;
    const prospectUpdates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (reverseMap[k]) prospectUpdates[reverseMap[k]] = v;
    }

    await updateContact(existingId, prospectUpdates as any);
    setDuplicateMatch(null);
    onSaved();
    onClose();
  };

  const handleOpenExisting = (_id: string) => {
    setDuplicateMatch(null);
    onClose();
  };

  if (success) {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-12 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-medium">Contact updated successfully!</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-teal-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Edit Contact</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label>
              <input type="text" value={form.FullName} onChange={e => update('FullName', e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">APLGO ID</label>
              <input type="text" inputMode="numeric" value={form.APLGoID} onChange={e => update('APLGoID', e.target.value)} placeholder="e.g. 1234567 (leave empty if not yet assigned)" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500 font-mono" />
              <p className="text-xs text-slate-500 mt-1">Used to match Monthly Activity Paste rows to this contact.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
                <input type="text" value={form.PhoneNumber} onChange={e => update('PhoneNumber', e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={form.EmailAddress} onChange={e => update('EmailAddress', e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">City</label>
                <input type="text" value={form.City} onChange={e => update('City', e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Province</label>
                <input type="text" value={form.Province} onChange={e => update('Province', e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
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
                  {filterOptions.LeadType.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Reg. Status</label>
                <select value={form.RegistrationStatus} onChange={e => update('RegistrationStatus', e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  <option value="Not Registered">Not Registered</option>
                  <option value="Registered">Registered</option>
                  <option value="Activated">Activated</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Leg</label>
                <select value={form.Leg} onChange={e => update('Leg', e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  <option value="">Unplaced</option>
                  <option value="L">L (Left)</option>
                  <option value="R">R (Right)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Level</label>
                <input type="text" value={form.Level} onChange={e => update('Level', e.target.value)} placeholder="e.g. 1, 2, 3" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Focus Area</label>
                <select value={form.FocusArea} onChange={e => update('FocusArea', e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  <option value="Health Transformation">Health Transformation</option>
                  <option value="Business Opportunity">Business Opportunity</option>
                  <option value="Both">Both</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">GO Status</label>
                <input type="text" value={form.GOStatus} onChange={e => update('GOStatus', e.target.value)} placeholder="e.g. No Status, Promoter" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Sponsor</label>
                <input type="text" value={form.SponsorName} onChange={e => update('SponsorName', e.target.value)} placeholder="Sponsor name" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Title / Salutation</label>
                <select value={form.SalutationTitle} onChange={e => update('SalutationTitle', e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  {SALUTATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Next Action</label>
              <input type="text" value={form.NextAction} onChange={e => update('NextAction', e.target.value)} placeholder="What's the next step?" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
              <textarea value={form.AdditionalNotes} onChange={e => update('AdditionalNotes', e.target.value)} placeholder="Additional notes..." rows={3} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500 resize-none" />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-sm">{error}</div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      {duplicateMatch && (
        <DuplicateWarningModal
          existingContact={duplicateMatch.contact}
          matchType={duplicateMatch.matchType}
          matchValue={duplicateMatch.matchValue}
          onClose={() => setDuplicateMatch(null)}
          onOpenExisting={handleOpenExisting}
          onMergeIntoExisting={handleMergeIntoExisting}
        />
      )}
    </>
  );
}
