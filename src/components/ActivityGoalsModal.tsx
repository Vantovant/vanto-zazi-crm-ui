import { useState } from 'react';
import { X, Target } from 'lucide-react';
import { useActivityGoals, type ActivityGoals } from '@/hooks/useActivityGoals';

interface Props {
  onClose: () => void;
}

export function ActivityGoalsModal({ onClose }: Props) {
  const { goals, updateGoals } = useActivityGoals();
  const [form, setForm] = useState<ActivityGoals>({ ...goals });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateGoals(form);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-semibold text-white">Set Daily Goals</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {[
            { key: 'daily_whatsapp_goal' as const, label: 'Daily WhatsApp Messages', color: 'text-green-400' },
            { key: 'daily_email_goal' as const, label: 'Daily Emails', color: 'text-violet-400' },
            { key: 'daily_call_goal' as const, label: 'Daily Calls', color: 'text-cyan-400' },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <label className={`text-sm font-medium ${color} block mb-1.5`}>{label}</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form[key]}
                onChange={(e) => setForm(prev => ({ ...prev, [key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Goals'}
          </button>
        </div>
      </div>
    </div>
  );
}
