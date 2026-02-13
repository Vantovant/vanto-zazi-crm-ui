import { useState } from 'react';
import {
  Plus,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { LogActivityModal } from '../components/LogActivityModal';
import { useCrm } from '@/contexts/CrmContext';

export function Activities() {
  const [showLogActivity, setShowLogActivity] = useState(false);
  const { contacts } = useCrm();

  // Derive recent activity from contacts' ActionTaken field
  const contactsWithActivity = contacts
    .filter(c => c.ActionTaken && c.ActionTaken.trim() !== '')
    .slice(0, 20);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Activities</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {contactsWithActivity.length} contacts with logged activity
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowLogActivity(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Activity
        </button>
      </div>

      {/* Phase 2B Notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-400">Activity Timeline — Coming in Phase 2B</p>
          <p className="text-xs text-amber-400/70 mt-1">
            A full activity timeline with filtering, grouping, and search will be implemented in the next phase. 
            For now, you can log activities using the button above — they are saved to your contacts' records.
          </p>
        </div>
      </div>

      {/* Current activity data from contacts */}
      {contactsWithActivity.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">Recent Contact Activity</h3>
          </div>
          <div className="divide-y divide-slate-700/50">
            {contactsWithActivity.map((contact) => (
              <div key={contact.id} className="px-5 py-4 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-teal-400">{contact.FullName}</p>
                    <p className="text-sm text-slate-300 mt-1">{contact.ActionTaken}</p>
                    {contact.NextAction && (
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Next: {contact.NextAction}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-4">{contact.DateCaptured}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-16 text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No activities logged yet. Use "Log Activity" to record your first interaction.</p>
        </div>
      )}

      {showLogActivity && (
        <LogActivityModal onClose={() => setShowLogActivity(false)} />
      )}
    </div>
  );
}
