import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Shipment {
  id: string;
  user_id: string;
  waybill_number: string;
  contact_id: string | null;
  order_id: string | null;
  status: string;
  product_summary: string;
  collection_address: string;
  delivery_address: string;
  service_level: string;
  courier_reference: string;
  earliest_delivery_date: string | null;
  last_status_update: string;
  created_at: string;
  inventory_applied?: boolean;
  inventory_note?: string;
}

export const SHIPMENT_STATUSES = [
  'collection-assigned',
  'collected',
  'in-transit',
  'at-hub',
  'out-for-delivery',
  'delivered',
  'delivery-exception',
  'returned-to-sender',
  'cancelled',
  'unknown',
] as const;

export function shipmentStatusClasses(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'out-for-delivery':
      return 'bg-teal-500/10 text-teal-300 border-teal-500/20';
    case 'in-transit':
    case 'at-hub':
      return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
    case 'collected':
    case 'collection-assigned':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    case 'delivery-exception':
    case 'returned-to-sender':
    case 'cancelled':
      return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
    default:
      return 'bg-slate-600/20 text-slate-300 border-slate-600/40';
  }
}

export function useShipments() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShipments = useCallback(async () => {
    if (!user) {
      setShipments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase.from('shipments') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('last_status_update', { ascending: false });
    if (error) {
      console.error('Error fetching shipments:', error);
    } else {
      setShipments((data || []) as Shipment[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const linkShipmentToContact = useCallback(async (shipmentId: string, contactId: string) => {
    const { error } = await (supabase.from('shipments') as any)
      .update({ contact_id: contactId })
      .eq('id', shipmentId);
    if (error) {
      console.error('Error linking shipment:', error);
      return false;
    }
    await fetchShipments();
    return true;
  }, [fetchShipments]);

  const linkShipmentToOrder = useCallback(async (shipmentId: string, orderId: string | null) => {
    const { error } = await (supabase.from('shipments') as any)
      .update({ order_id: orderId })
      .eq('id', shipmentId);
    if (error) {
      console.error('Error linking shipment to order:', error);
      return false;
    }
    await fetchShipments();
    return true;
  }, [fetchShipments]);

  const syncHistory = useCallback(async (days = 30) => {
    const { data, error } = await supabase.functions.invoke('shiplogic-backfill', {
      body: { days },
    });
    if (error) {
      console.error('Shiplogic history sync failed:', error);
      return { ok: false, error: error.message } as any;
    }
    await fetchShipments();
    return data as any;
  }, [fetchShipments]);

  return {
    shipments,
    loading,
    refetch: fetchShipments,
    linkShipmentToContact,
    linkShipmentToOrder,
    syncHistory,
  };
}

/**
 * Shipments keyed by the order they were created for, for the "Shipped /
 * Not yet shipped" indicator on the Orders page. Read-only.
 */
export function useOrderShipments() {
  const { user } = useAuth();
  const [byOrderId, setByOrderId] = useState<Record<string, Shipment>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setByOrderId({}); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data } = await (supabase.from('shipments') as any)
        .select('*')
        .eq('user_id', user.id)
        .not('order_id', 'is', null)
        .order('last_status_update', { ascending: false });
      if (cancelled) return;
      const map: Record<string, Shipment> = {};
      for (const row of (data || []) as Shipment[]) {
        if (row.order_id && !map[row.order_id]) map[row.order_id] = row;
      }
      setByOrderId(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { byOrderId, loading };
}

export function useContactShipments(contactId?: string | null) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!contactId) {
      setShipments([]);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await (supabase.from('shipments') as any)
        .select('*')
        .eq('contact_id', contactId)
        .order('last_status_update', { ascending: false });
      if (!cancelled) {
        setShipments((data || []) as Shipment[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId]);

  return { shipments, loading };
}
