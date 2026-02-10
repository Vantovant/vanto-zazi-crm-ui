import { useState } from 'react';
import { X, ShoppingCart, Loader2 } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';

interface AddOrderModalProps {
  onClose: () => void;
}

export function AddOrderModal({ onClose }: AddOrderModalProps) {
  const { addOrder, contacts } = useCrm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    orderId: '',
    contactName: '',
    contact_id: '',
    product: '',
    quantity: 1,
    amount: 0,
    status: 'Pending',
    orderDate: new Date().toISOString().split('T')[0],
  });

  const update = (key: string, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const handleContactSelect = (contactId: string) => {
    const contact = contacts.find(c => String(c.id) === contactId);
    setForm(prev => ({
      ...prev,
      contact_id: contactId,
      contactName: contact?.FullName || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactName.trim()) { setError('Contact name is required.'); return; }
    if (!form.product.trim()) { setError('Product is required.'); return; }
    setLoading(true);
    setError('');
    const result = await addOrder({
      orderId: form.orderId || `ORD-${Date.now().toString(36).toUpperCase()}`,
      contactName: form.contactName,
      contact_id: form.contact_id || undefined,
      product: form.product,
      quantity: form.quantity,
      amount: form.amount,
      status: form.status as 'Pending' | 'Paid' | 'Delivered' | 'Activated',
      orderDate: form.orderDate,
      badges: [],
    });
    setLoading(false);
    if (result) {
      onClose();
    } else {
      setError('Failed to add order. Please try again.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-teal-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">New Order</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Contact *</label>
              {contacts.length > 0 ? (
                <select
                  value={form.contact_id}
                  onChange={e => handleContactSelect(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                >
                  <option value="">Select a contact...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.FullName}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={form.contactName} onChange={e => update('contactName', e.target.value)} placeholder="Contact name" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" required />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Product *</label>
                <input type="text" value={form.product} onChange={e => update('product', e.target.value)} placeholder="Product name" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Order ID</label>
                <input type="text" value={form.orderId} onChange={e => update('orderId', e.target.value)} placeholder="Auto-generated" className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Quantity</label>
                <input type="number" min={1} value={form.quantity} onChange={e => update('quantity', parseInt(e.target.value) || 1)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Amount (R)</label>
                <input type="number" min={0} step="0.01" value={form.amount} onChange={e => update('amount', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Status</label>
                <select value={form.status} onChange={e => update('status', e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Activated">Activated</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Order Date</label>
              <input type="date" value={form.orderDate} onChange={e => update('orderDate', e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-sm">{error}</div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Order
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
