import { Truck } from 'lucide-react';
import { useContactShipments, shipmentStatusClasses } from '@/hooks/useShipments';

export function ContactShipmentsCard({ contactId }: { contactId?: string | null }) {
  const { shipments } = useContactShipments(contactId);

  if (!contactId || shipments.length === 0) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="w-4 h-4 text-teal-400" />
        <h5 className="text-xs font-semibold text-teal-300 uppercase">
          Deliveries ({shipments.length})
        </h5>
      </div>
      <div className="space-y-2">
        {shipments.map((s) => (
          <div key={s.id} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-slate-200">{s.waybill_number}</span>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${shipmentStatusClasses(s.status)}`}>
                {s.status}
              </span>
            </div>
            {s.product_summary && (
              <p className="text-xs text-slate-400 mt-0.5">{s.product_summary}</p>
            )}
            <p className="text-[11px] text-slate-500 mt-0.5">
              Updated {new Date(s.last_status_update).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
