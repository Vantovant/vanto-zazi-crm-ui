import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Order } from '@/data/mockData';
import { pushOutboundEvent } from '@/hooks/useOutboundWebhook';

interface OrderRow {
  id: string;
  user_id: string;
  order_id: string;
  contact_id: string | null;
  contact_name: string;
  product: string;
  quantity: number;
  amount: number;
  status: string;
  order_date: string;
  badges: string[];
  purchase_type: string;
  pv_amount: number;
  source: string;
  sales_channel: string;
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id as unknown as number,
    orderId: row.order_id,
    contactId: row.contact_id,
    contactName: row.contact_name,
    product: row.product,
    quantity: row.quantity,
    amount: Number(row.amount),
    status: row.status as Order['status'],
    orderDate: row.order_date,
    badges: (row.badges || []) as Order['badges'],
    purchaseType: row.purchase_type || '',
    pvAmount: Number(row.pv_amount) || 0,
    source: row.source || 'manual',
    salesChannel: row.sales_channel || 'Online',
  };
}

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbActive, setDbActive] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      setDbActive(false);
    } else {
      setOrders((data as OrderRow[]).map(rowToOrder));
      setDbActive(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /**
   * Same-person / same-amount / same-day guard.
   *
   * Buying twice in a month is legitimate, so we never block on name alone.
   * But the SAME person, the SAME amount and the SAME order date is almost
   * always the same purchase captured twice — we surface it for confirmation.
   */
  const findSuspectDuplicate = useCallback(async (params: {
    contact_id?: string | null;
    contactName?: string;
    amount: number;
    orderDate: string;
  }) => {
    if (!user || !params.orderDate) return null;
    let q = (supabase.from('orders') as any)
      .select('id, order_id, contact_name, product, amount, order_date, source, created_at')
      .eq('user_id', user.id)
      .eq('order_date', params.orderDate)
      .eq('amount', params.amount)
      .limit(1);
    if (params.contact_id) q = q.eq('contact_id', params.contact_id);
    else q = q.ilike('contact_name', (params.contactName || '').trim());
    const { data, error } = await q;
    if (error) {
      console.warn('[useOrders] duplicate pre-check failed', error);
      return null;
    }
    return (Array.isArray(data) && data.length > 0) ? data[0] : null;
  }, [user]);

  /**
   * Date-range overlap check for Monthly Activity pastes (upgrade).
   * Looks across ALL prior monthly-activity-paste orders for these contacts —
   * regardless of which calendar-month bucket they were filed under — and
   * flags any whose tagged activity_period overlaps the range being pasted now.
   * Purely additive: only meaningful for callers that pass activity_period_start/end.
   */
  const findOverlappingActivityPeriods = useCallback(async (
    contactIds: string[],
    periodStart: string,
    periodEnd: string,
  ): Promise<Map<string, { start: string; end: string }[]>> => {
    const result = new Map<string, { start: string; end: string }[]>();
    if (!user || contactIds.length === 0 || !periodStart || !periodEnd) return result;

    const { data, error } = await (supabase.from('orders') as any)
      .select('contact_id, activity_period_start, activity_period_end')
      .eq('user_id', user.id)
      .eq('source', 'monthly-activity-paste')
      .not('activity_period_start', 'is', null)
      .not('activity_period_end', 'is', null)
      .in('contact_id', contactIds);

    if (error) {
      console.warn('[useOrders] overlap pre-check failed', error);
      return result;
    }

    (data || []).forEach((row: any) => {
      const start = row.activity_period_start as string;
      const end = row.activity_period_end as string;
      // Overlap test: existing.start <= newEnd AND existing.end >= newStart
      if (start <= periodEnd && end >= periodStart) {
        const cid = String(row.contact_id);
        const list = result.get(cid) || [];
        list.push({ start, end });
        result.set(cid, list);
      }
    });
    return result;
  }, [user]);

  const addOrder = async (
    order: Omit<Order, 'id'> & {
      contact_id?: string;
      /** MP0.1 — explicit dedupe_key override (preferred for monthly-activity-paste). */
      dedupe_key?: string | null;
      /** Bypass the same-person/same-amount/same-date confirmation guard. */
      force?: boolean;
      /** Optional actual date-range this entry was pasted for (Monthly Activity upgrade). Record-keeping only — does not affect dedupe_key. */
      activity_period_start?: string | null;
      activity_period_end?: string | null;
    },
  ) => {
    if (!user) return null;

    // Same person + same amount + same date → ask before creating a twin.
    if (!order.force) {
      const twin = await findSuspectDuplicate({
        contact_id: order.contact_id ?? null,
        contactName: order.contactName,
        amount: order.amount,
        orderDate: order.orderDate,
      });
      if (twin) {
        return { id: 'suspect-duplicate', suspectDuplicate: true, existing: twin } as {
          id: string; suspectDuplicate: true; existing: any;
        };
      }
    }

    // Compute dedupe_key for paste-imported orders.
    // MP0.1: callers may now supply an explicit, position-independent dedupe_key
    // (e.g. monthly-activity-paste signature + within-batch occurrence).
    let dedupe_key: string | null = order.dedupe_key ?? null;
    if (!dedupe_key && order.source === 'backoffice-paste') {
      const parts = [
        (order.contactName || '').trim().toLowerCase(),
        (order.product || '').trim().toLowerCase(),
        String(order.quantity || 0),
        String(order.amount || 0),
        String(order.pvAmount || 0),
        (order.purchaseType || '').trim().toLowerCase(),
        (order.orderDate || ''),
        (order.source || 'manual').trim().toLowerCase(),
      ].join('|');
      dedupe_key = parts;
    } else if (!dedupe_key && order.source === 'monthly-activity-paste') {
      // Legacy fallback if caller did not supply an explicit MP0.1 key.
      dedupe_key = `ma|${(order.orderId || '').trim().toLowerCase()}`;
    }

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      order_id: order.orderId,
      contact_id: order.contact_id || null,
      contact_name: order.contactName,
      product: order.product,
      quantity: order.quantity,
      amount: order.amount,
      status: order.status,
      order_date: order.orderDate,
      badges: order.badges || [],
      purchase_type: order.purchaseType || '',
      pv_amount: order.pvAmount || 0,
      source: order.source || 'manual',
    };
    if (dedupe_key) insertPayload.dedupe_key = dedupe_key;
    if (order.activity_period_start) insertPayload.activity_period_start = order.activity_period_start;
    if (order.activity_period_end) insertPayload.activity_period_end = order.activity_period_end;

    const { data, error } = await supabase
      .from('orders')
      .insert(insertPayload as any)
      .select()
      .single();
    if (error) {
      // MP0.1: surface duplicate-skip as a typed result so callers can count
      // and route ambiguous repeats to Needs Review.
      if (error.code === '23505' && dedupe_key) {
        console.log('[useOrders] Duplicate order skipped by DB constraint', { dedupe_key });
        return { id: 'duplicate-skipped', duplicate: true } as { id: string; duplicate: true };
      }
      console.error('Error adding order:', error);
      return null;
    }
    await fetchOrders();
    pushOutboundEvent('order.created', {
      contact_name: order.contactName,
      contact_phone: '',
      product: order.product,
      quantity: order.quantity,
      amount: order.amount,
    });
    return data;
  };

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.orderId !== undefined) dbUpdates.order_id = updates.orderId;
    if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName;
    if (updates.product !== undefined) dbUpdates.product = updates.product;
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.orderDate !== undefined) dbUpdates.order_date = updates.orderDate;
    if (updates.badges !== undefined) dbUpdates.badges = updates.badges;

    const { error } = await supabase.from('orders').update(dbUpdates).eq('id', id);
    if (error) {
      console.error('Error updating order:', error);
      return false;
    }
    await fetchOrders();
    return true;
  };

  const deleteOrder = async (id: string) => {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      console.error('Error deleting order:', error);
      return false;
    }
    await fetchOrders();
    return true;
  };

  return { orders, loading, dbActive, addOrder, updateOrder, deleteOrder, findOverlappingActivityPeriods, refetch: fetchOrders };
}
