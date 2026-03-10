import { useState } from 'react';
import { X, Package, Loader2 } from 'lucide-react';
import { productCatalog } from '@/data/productCatalog';

interface AddStockModalProps {
  onClose: () => void;
  onAdd: (productName: string, quantity: number) => Promise<boolean>;
}

export function AddStockModal({ onClose, onAdd }: AddStockModalProps) {
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) { setError('Please select a product.'); return; }
    if (quantity < 1) { setError('Quantity must be at least 1.'); return; }
    setLoading(true);
    setError('');
    const success = await onAdd(productName, quantity);
    setLoading(false);
    if (success) onClose();
    else setError('Failed to add stock. Please try again.');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-teal-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Add Stock</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Product *</label>
              <select
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
              >
                <option value="">Select product...</option>
                {productCatalog.map(p => (
                  <option key={p.name} value={p.name}>{p.name} ({p.range}) — R{p.priceIncVat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Quantity Received *</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
              />
            </div>

            {error && <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-sm">{error}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Stock
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
