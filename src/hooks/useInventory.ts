import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface InventoryItem {
  id: string;
  product_name: string;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export function useInventory() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('product_name', { ascending: true });

    if (error) {
      console.error('Error fetching inventory:', error);
    } else {
      setInventory((data as any[]).map(row => ({
        id: row.id,
        product_name: row.product_name,
        stock_quantity: row.stock_quantity,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const addOrUpdateStock = async (productName: string, quantity: number) => {
    if (!user) return false;
    // Check if product already exists
    const existing = inventory.find(i => i.product_name === productName);
    if (existing) {
      const { error } = await supabase
        .from('inventory')
        .update({ stock_quantity: existing.stock_quantity + quantity })
        .eq('id', existing.id);
      if (error) { console.error('Error updating inventory:', error); return false; }
    } else {
      const { error } = await supabase
        .from('inventory')
        .insert({ user_id: user.id, product_name: productName, stock_quantity: quantity });
      if (error) { console.error('Error adding inventory:', error); return false; }
    }
    await fetchInventory();
    return true;
  };

  const setStock = async (id: string, quantity: number) => {
    const { error } = await supabase
      .from('inventory')
      .update({ stock_quantity: quantity })
      .eq('id', id);
    if (error) { console.error('Error setting stock:', error); return false; }
    await fetchInventory();
    return true;
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) { console.error('Error deleting inventory item:', error); return false; }
    await fetchInventory();
    return true;
  };

  const deductStock = async (productName: string, quantity: number) => {
    const item = inventory.find(i => i.product_name === productName);
    if (!item || item.stock_quantity < quantity) return false;
    const { error } = await supabase
      .from('inventory')
      .update({ stock_quantity: item.stock_quantity - quantity })
      .eq('id', item.id);
    if (error) { console.error('Error deducting stock:', error); return false; }
    await fetchInventory();
    return true;
  };

  const totalProducts = inventory.reduce((s, i) => s + i.stock_quantity, 0);

  return { inventory, loading, totalProducts, addOrUpdateStock, setStock, deleteItem, deductStock, refetch: fetchInventory };
}
