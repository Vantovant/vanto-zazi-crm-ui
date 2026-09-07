import { useMemo, useState } from 'react';
import { Truck, Loader2, RefreshCw, Link2, AlertTriangle, History } from 'lucide-react';
import { useShipments, shipmentStatusClasses, SHIPMENT_STATUSES } from '@/hooks/useShipments';
import { useCrm } from '@/contexts/CrmContext';
import { ContactDrawer } from '@/components/ContactDrawer';
import type { Prospect } from '@/data/mockData';

export function Deliveries() {
  const { shipments, loading, refetch, linkShipmentToContact, linkShipmentToOrder, syncHistory } = useShipments();
  const { contacts, orders } = useCrm();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [openContact, setOpenContact] = useState<Prospect | null>(null);
  const [syncDays, setSyncDays] = useState(30);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const runSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res: any = await syncHistory(syncDays);
    setSyncing(false);
    if (!res || res.ok === false) {
      setSyncResult(res?.error ? `Sync failed: ${res.error}` : 'Sync failed.');
      return;
    }
    setSyncResult(
      `Checked ${res.fetched ?? 0} courier shipments — ${res.created ?? 0} new, ${res.updated ?? 0} updated, ${res.unlinked ?? 0} without a contact.` +
      (res.errors?.length ? ` Issues: ${res.errors[0]}` : '')
    );
  };

  const contactById = useMemo(() => {
    const map = new Map<string, Prospect>();
    for (const c of contacts) map.set(String(c.id), c);
    return map;
  }, [contacts]);

  const linked = shipments.filter((s) => s.contact_id);
  const unlinked = shipments.filter((s) => !s.contact_id);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = linked.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      const name = s.contact_id ? contactById.get(s.contact_id)?.FullName || '' : '';
      return (
        s.waybill_number.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        s.product_summary.toLowerCase().includes(q) ||
        s.delivery_address.toLowerCase().includes(q)
      );
    });
    return filtered.sort((a, b) => {
      const d = new Date(a.last_status_update).getTime() - new Date(b.last_status_update).getTime();
      return sortDesc ? -d : d;
    });
  }, [linked, statusFilter, search, sortDesc, contactById]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Deliveries</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Loading...' : `${shipments.length} shipments tracked · ${unlinked.length} unlinked`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={syncDays}
            onChange={(e) => setSyncDays(Number(e.target.value))}
            className="px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
          </select>
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
            Sync history
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="text-sm text-slate-300 bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-3">
          {syncResult}
        </div>
      )}


      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search waybill, name, product, address..."
          className="flex-1 min-w-[220px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
        >
          <option value="all">All statuses</option>
          {SHIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300"
        >
          Updated {sortDesc ? '↓ newest' : '↑ oldest'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No shipments match this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Waybill</th>
                  <th className="text-left px-4 py-3">Recipient</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Products</th>
                  <th className="text-left px-4 py-3">Delivery address</th>
                  <th className="text-left px-4 py-3">Order</th>
                  <th className="text-left px-4 py-3">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const contact = s.contact_id ? contactById.get(s.contact_id) : undefined;
                  const contactOrders = contact
                    ? orders.filter((o) => String(o.contactId ?? '') === String(contact.id))
                    : [];
                  return (
                    <tr
                      key={s.id}
                      onClick={() => contact && setOpenContact(contact)}
                      className="border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-slate-200">{s.waybill_number}</td>
                      <td className="px-4 py-3 text-white">{contact?.FullName || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${shipmentStatusClasses(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{s.product_summary || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-[260px] truncate">{s.delivery_address || '—'}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={s.order_id || ''}
                          onChange={(e) => linkShipmentToOrder(s.id, e.target.value || null)}
                          className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white max-w-[180px]"
                        >
                          <option value="">Not linked</option>
                          {contactOrders.map((o) => (
                            <option key={String(o.id)} value={String(o.id)}>
                              {o.orderId} · {o.product}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(s.last_status_update).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unlinked shipments */}
      {unlinked.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-300">
              Unlinked shipments ({unlinked.length})
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            These waybills arrived from the courier but aren't linked to a contact yet. Pick the right person to link them.
          </p>
          <div className="space-y-2">
            {unlinked.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2">
                <span className="font-mono text-sm text-slate-200">{s.waybill_number}</span>
                <span className={`px-2 py-0.5 rounded-full border text-[11px] ${shipmentStatusClasses(s.status)}`}>
                  {s.status}
                </span>
                <span className="text-xs text-slate-400 flex-1 min-w-[120px] truncate">
                  {s.delivery_address || 'No address on file'}
                </span>
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) linkShipmentToContact(s.id, e.target.value);
                    }}
                    className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white max-w-[220px]"
                  >
                    <option value="">Link to contact...</option>
                    {contacts.map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {c.FullName} {c.PhoneNumber ? `· ${c.PhoneNumber}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && shipments.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Truck className="w-4 h-4" />
          Shipments appear here automatically as the courier sends tracking updates.
        </div>
      )}

      {openContact && (
        <ContactDrawer prospect={openContact} onClose={() => setOpenContact(null)} />
      )}
    </div>
  );
}
