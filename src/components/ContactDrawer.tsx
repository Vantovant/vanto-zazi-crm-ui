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
  FileText,
  ChevronRight,
  Edit3,
} from 'lucide-react';
import type { Prospect } from '../data/mockData';

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
  Customer: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
  Distributor: 'bg-violet-500/20 text-violet-400 border-violet-500/40',
};

const regStatusColors: Record<string, string> = {
  Registered: 'bg-violet-500/20 text-violet-400',
  'Not Registered': 'bg-slate-600/30 text-slate-400',
  Activated: 'bg-emerald-500/20 text-emerald-400',
};

const activityIcons: Record<string, typeof Phone> = {
  whatsapp: MessageCircle,
  call: Phone,
  meeting: Calendar,
  registration: CheckCircle,
  note: FileText,
};

const activityColors: Record<string, string> = {
  whatsapp: 'bg-green-500/20 text-green-400 border-green-500/30',
  call: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  meeting: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  registration: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  note: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

// Mock activity data for the contact
const generateMockActivities = (name: string) => [
  { id: 1, type: 'whatsapp', description: 'Sent product catalog', time: '2 hours ago', details: 'Shared wellness product brochure' },
  { id: 2, type: 'call', description: 'Discovery call completed', time: '1 day ago', details: 'Discussed business opportunity, very interested' },
  { id: 3, type: 'meeting', description: 'Business presentation', time: '3 days ago', details: 'Presented compensation plan and products' },
  { id: 4, type: 'note', description: 'Added note', time: '5 days ago', details: 'Referred by existing team member. Has network marketing experience.' },
  { id: 5, type: 'whatsapp', description: 'Initial contact', time: '1 week ago', details: 'Introduced myself and company' },
];

export function ContactDrawer({ prospect, onClose }: ContactDrawerProps) {
  const activities = generateMockActivities(prospect.FullName);
  const initials = prospect.FullName.split(' ').map(n => n[0]).join('');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-screen w-[680px] max-w-[90vw] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="font-semibold text-white text-lg">Contact Details</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
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

                {/* Status Badges */}
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${temperatureColors[prospect.LeadTemperature]}`}>
                    {prospect.LeadTemperature}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${leadTypeColors[prospect.LeadType]}`}>
                    {prospect.LeadType}
                  </span>
                </div>
                <div className="mt-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${regStatusColors[prospect.RegistrationStatus]}`}>
                    {prospect.RegistrationStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-b border-slate-700/50">
              <div className="grid grid-cols-3 gap-2">
                <button type="button" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">WhatsApp</span>
                </button>
                <button type="button" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors">
                  <Phone className="w-5 h-5" />
                  <span className="text-xs font-medium">Call</span>
                </button>
                <button type="button" className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 transition-colors">
                  <Calendar className="w-5 h-5" />
                  <span className="text-xs font-medium">Meeting</span>
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
                    <p className="text-sm font-medium text-slate-200 truncate">{prospect.PhoneNumber}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-200 truncate">{prospect.EmailAddress}</p>
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

          {/* RIGHT COLUMN - Activity Timeline */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline Header */}
            <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <h4 className="font-semibold text-white">Activity Timeline</h4>
              <button type="button" className="text-xs font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1">
                Log Activity <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700" />

                {/* Activity Items */}
                <div className="space-y-6">
                  {activities.map((activity, index) => {
                    const Icon = activityIcons[activity.type];
                    const colorClass = activityColors[activity.type];
                    return (
                      <div key={activity.id} className="relative pl-12">
                        {/* Icon */}
                        <div className={`absolute left-0 w-8 h-8 rounded-full border-2 ${colorClass} flex items-center justify-center bg-slate-900`}>
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 hover:bg-slate-800/70 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium text-slate-200">{activity.description}</p>
                            <span className="text-xs text-slate-500 whitespace-nowrap ml-3">{activity.time}</span>
                          </div>
                          <p className="text-sm text-slate-400">{activity.details}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  <p className="text-sm text-slate-500 italic">No notes added yet. Click to add a note.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
