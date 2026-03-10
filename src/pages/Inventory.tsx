import { useState } from 'react';
import { Package, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { AddStockModal } from '@/components/AddStockModal';

export function Inventory() {
  const { inventory, loading, totalProducts, addOrUpdateStock, setStock, deleteItem } = useInventory();
  const [showAddStock, setShowAddStock] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);

  const startEdit = (id: string, currentQty: number) => {
    setEditingId(id);
    setEditQty(currentQty);
  };

  const saveEdit = async (id: string) => {
    await setStock(id, editQty);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this inventory item?')) return;
    await deleteItem(id);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Offline Inventory</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? 'Loading...' : `${inventory.length} products tracked`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddStock(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Stock
        </button>
      </div>

      {/* Total Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-xl border border-teal-500/20 p-4">
          <p className="text-xs font-medium text-teal-400">Total Units in Stock</p>
          <p className="text-2xl font-bold text-white mt-1">{totalProducts}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <p className="text-xs font-medium text-slate-400">Unique Products</p>
          <p className="text-2xl font-bold text-white mt-1">{inventory.length}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-amber-500/20 p-4">
          <p className="text-xs font-medium text-amber-400">Low Stock (≤ 2)</p>
          <p className="text-2xl font-bold text-amber-300 mt-1">{inventory.filter(i => i.stock_quantity <= 2 && i.stock_quantity > 0).length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock Qty</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {inventory.map(item => (
                <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-teal-400" />
                      <span className="text-sm font-medium text-slate-200">{item.product_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={editQty}
                          onChange={e => setEditQty(parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                          autoFocus
                        />
                        <button type="button" onClick={() => saveEdit(item.id)} className="text-xs text-teal-400 hover:text-teal-300">Save</button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-300 font-mono">{item.stock_quantity}</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {item.stock_quantity === 0 ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">Out of Stock</span>
                    ) : item.stock_quantity <= 2 ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">Low</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">In Stock</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => startEdit(item.id, item.stock_quantity)} className="p-1.5 rounded text-slate-400 hover:text-teal-400 hover:bg-slate-700 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && inventory.length === 0 && (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No inventory items yet. Add your first stock.</p>
            </div>
          )}

          {loading && (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {showAddStock && (
        <AddStockModal onClose={() => setShowAddStock(false)} onAdd={addOrUpdateStock} />
      )}
    </div>
  );
}
