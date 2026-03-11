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

  const addOrder = async (order: Omit<Order, 'id'> & { contact_id?: string }) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('orders')
      .insert({
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
      })
      .select()
      .single();
    if (error) {
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

  return { orders, loading, dbActive, addOrder, updateOrder, deleteOrder, refetch: fetchOrders };
}
