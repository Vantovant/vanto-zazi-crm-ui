import { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Calendar,
  CheckCircle,
  User,
  Briefcase,
  Target,
  Clock,
  AlertCircle,
  Pencil,
  Award,
} from 'lucide-react';
import type { Prospect } from '../data/mockData';
import { EditContactModal } from './EditContactModal';
import { useCrm } from '@/contexts/CrmContext';

interface ContactDrawerProps {
  prospect: Prospect;
  onClose: () => void;
}

const temperatureColors: Record<string, string> = {
  Hot: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  Warm: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Cold: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
};

const leadTypeColors: Record<string, string> = {
  Prospect: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  Registered_Nopurchase: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Purchase_Nostatus: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
  Purchase_Status: 'bg-violet-500/20 text-violet-400 border-violet-500/40',
};

const regStatusColors: Record<string, string> = {
  Registered: 'bg-violet-500/20 text-violet-400',
  'Not Registered': 'bg-slate-600/30 text-slate-400',
  Activated: 'bg-emerald-500/20 text-emerald-400',
};

export function ContactDrawer({ prospect: initialProspect, onClose }: ContactDrawerProps) {
  const { contacts } = useCrm();
  const [showEdit, setShowEdit] = useState(false);

  // Always use latest contact data from context
  const prospect = contacts.find(c => String(c.id) === String(initialProspect.id)) || initialProspect;

  const initials = prospect.FullName.split(' ').map(n => n[0]).join('');

  const handleWhatsApp = () => {
    const phone = prospect.PhoneNumber.replace(/\s/g, '').replace('+', '');
    if (phone) window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-screen w-[680px] max-w-[90vw] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="font-semibold text-white text-lg">Contact Details</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-teal-400 hover:bg-teal-500/10 transition-colors text-sm font-medium"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Two Column Layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* LEFT COLUMN - Contact Summary */}
          <div className="w-[280px] border-r border-slate-700 overflow-y-auto">
            {/* Profile Header */}
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl mb-4">
                  {initials}
                </div>
                <h3 className="text-xl font-semibold text-white">{prospect.FullName}</h3>
                <p className="text-sm text-slate-400 mt-1">{prospect.City}, {prospect.Province}</p>

                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${temperatureColors[prospect.LeadTemperature] || ''}`}>
                    {prospect.LeadTemperature}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${leadTypeColors[prospect.LeadType] || ''}`}>
                    {prospect.LeadType}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${regStatusColors[prospect.RegistrationStatus] || ''}`}>
                    {prospect.RegistrationStatus}
                  </span>
                  {prospect.GOStatus && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      GO: {prospect.GOStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-b border-slate-700/50">
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={handleWhatsApp} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">WhatsApp</span>
                </button>
                <button type="button" onClick={() => { if (prospect.PhoneNumber) window.open(`tel:${prospect.PhoneNumber}`); }} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors">
                  <Phone className="w-5 h-5" />
                  <span className="text-xs font-medium">Call</span>
                </button>
                <button type="button" onClick={() => { if (prospect.EmailAddress) window.open(`mailto:${prospect.EmailAddress}`); }} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 transition-colors">
                  <Mail className="w-5 h-5" />
                  <span className="text-xs font-medium">Email</span>
                </button>
              </div>
            </div>

            {/* Contact Information */}
            <div className="p-4 space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Info</h4>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{prospect.PhoneNumber || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{prospect.EmailAddress || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.City}, {prospect.Province}</p>
                  </div>
                </div>
              </div>

              {/* MLM Details */}
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-4">Business Details</h4>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Target className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Focus Area</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.FocusArea}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Lead Path</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.LeadPath}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Sponsor</p>
                    <p className="text-sm font-medium text-slate-200">{prospect.SponsorName || '—'}</p>
                  </div>
                </div>

                {prospect.GOStatus && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                      <Award className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">GO Status</p>
                      <p className="text-sm font-medium text-amber-400">{prospect.GOStatus}</p>
                    </div>
                  </div>
                )}

                {prospect.APLGoID && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">APL ID</p>
                      <p className="text-sm font-medium text-emerald-400">{prospect.APLGoID}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Next Action */}
              {prospect.NextAction && (
                <>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-4">Next Action</h4>
                  <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    <p className="text-sm font-medium text-teal-400">{prospect.NextAction}</p>
                    {prospect.MeetingTime && (
                      <p className="text-xs text-teal-400/70 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {prospect.MeetingTime}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Activity & Notes */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Activity Header */}
            <div className="px-6 py-4 border-b border-slate-700/50">
              <h4 className="font-semibold text-white">Activity & Notes</h4>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Activity Details */}
              {prospect.ActionTaken || prospect.NextAction || prospect.MeetingTime ? (
                <div className="space-y-3">
                  {prospect.ActionTaken && (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                      <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Last Action Taken</h5>
                      <p className="text-sm text-slate-300">{prospect.ActionTaken}</p>
                    </div>
                  )}

                  {prospect.NextAction && (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                      <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Next Action</h5>
                      <p className="text-sm text-slate-300">{prospect.NextAction}</p>
                    </div>
                  )}

                  {prospect.MeetingTime && (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                      <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Meeting Time
                      </h5>
                      <p className="text-sm text-slate-300">{prospect.MeetingTime}</p>
                    </div>
                  )}

                  {prospect.DateCaptured && (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                      <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Date Captured</h5>
                      <p className="text-sm text-slate-300">{prospect.DateCaptured}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-800/30 rounded-lg border border-dashed border-slate-700 p-4">
                  <p className="text-sm text-slate-500 italic">No activity logged yet.</p>
                </div>
              )}

              {/* Phase 2B timeline notice */}
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400/70">
                  Full activity timeline coming in Phase 2B. Activity is currently saved to the contact's ActionTaken field.
                </p>
              </div>
            </div>

            {/* Notes Section */}
            <div className="border-t border-slate-700 p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Notes</h4>
              {prospect.AdditionalNotes ? (
                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <p className="text-sm text-slate-300">{prospect.AdditionalNotes}</p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-800/50 border border-dashed border-slate-700">
                  <p className="text-sm text-slate-500 italic">No notes added yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditContactModal
          prospect={prospect}
          onClose={() => setShowEdit(false)}
          onSaved={() => {}}
        />
      )}
    </>
  );
}
