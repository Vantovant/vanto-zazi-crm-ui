import { ProspectorInbox } from '@/components/ProspectorInbox';

export function ProspectorInboxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">ZAZI AI Prospector</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Review, approve and send AI-drafted leadership messages one-by-one.
        </p>
      </div>
      <ProspectorInbox />
    </div>
  );
}
