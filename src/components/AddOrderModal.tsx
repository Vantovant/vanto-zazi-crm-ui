import { useState, useMemo } from 'react';
import { X, ShoppingCart, Loader2, Search, Check, Plus, Trash2 } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';
import { productCatalog, type Product } from '@/data/productCatalog';

interface OrderLine {
  product: Product;
  quantity: number;
  sellingPrice: number; // defaults to stock price, user can override
}

interface AddOrderModalProps {
  onClose: () => void;
}

export function AddOrderModal({ onClose }: AddOrderModalProps) {
  const { addOrder, contacts } = useCrm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Contact search
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedContactName, setSelectedContactName] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Line items
  const [lines, setLines] = useState<OrderLine[]>([]);

  // Order meta
  const [status, setStatus] = useState('Pending');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 20);
    const q = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.FullName.toLowerCase().includes(q) ||
      c.PhoneNumber?.toLowerCase().includes(q) ||
      c.APLGoID?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [contacts, contactSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productCatalog;
    const q = productSearch.toLowerCase();
    return productCatalog.filter(p =>
      p.name.toLowerCase().includes(q) || p.range.toLowerCase().includes(q)
    );
  }, [productSearch]);

  const selectContact = (id: string, name: string) => {
    setSelectedContactId(id);
    setSelectedContactName(name);
    setContactSearch(name);
    setShowContactDropdown(false);
  };

  const addLine = (product: Product) => {
    setLines(prev => {
      const existing = prev.findIndex(l => l.product.name === product.name);
      if (existing >= 0) {
        return prev.map((l, i) => i === existing ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { product, quantity: 1, sellingPrice: product.priceIncVat }];
    });
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: qty } : l));
  };

  const updatePrice = (idx: number, price: number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, sellingPrice: price } : l));
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = lines.reduce((s, l) => s + l.sellingPrice * l.quantity, 0);
  const totalPV = lines.reduce((s, l) => s + l.product.pv * l.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactName.trim()) { setError('Please select a contact.'); return; }
    if (lines.length === 0) { setError('Add at least one product.'); return; }
    setLoading(true);
    setError('');

    let successCount = 0;
    for (const line of lines) {
      const result = await addOrder({
        orderId: `ORD-${Date.now().toString(36).toUpperCase()}-${successCount}`,
        contactName: selectedContactName,
        contact_id: selectedContactId || undefined,
        product: line.product.name,
        quantity: line.quantity,
        amount: line.sellingPrice * line.quantity,
        status: status as 'Pending' | 'Paid' | 'Delivered' | 'Activated',
        orderDate,
        badges: [],
        purchaseType: '',
        pvAmount: line.product.pv * line.quantity,
        source: 'manual',
      });
      if (result) successCount++;
    }

    setLoading(false);
    if (successCount > 0) {
      onClose();
    } else {
      setError('Failed to add orders. Please try again.');
    }
  };

  const rangeColor: Record<string, string> = {
    Daily: 'bg-teal-500/20 text-teal-400',
    Premium: 'bg-violet-500/20 text-violet-400',
    Elite: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
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

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Contact Search */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Contact *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={e => { setContactSearch(e.target.value); setShowContactDropdown(true); setSelectedContactId(''); setSelectedContactName(''); }}
                  onFocus={() => setShowContactDropdown(true)}
                  placeholder="Search by name, phone, or APLGO ID..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500"
                />
                {selectedContactName && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                )}
                {showContactDropdown && filteredContacts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 max-h-48 overflow-y-auto">
                    {filteredContacts.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectContact(String(c.id), c.FullName)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <span className="text-slate-200">{c.FullName}</span>
                          {c.APLGoID && <span className="ml-2 text-xs text-slate-500">{c.APLGoID}</span>}
                        </div>
                        <span className="text-xs text-slate-500">{c.PhoneNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Product Search & Add */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Add Products *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Search products (GRW, ALT, BTY...)"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500"
                />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto">
                    {(['Daily', 'Premium', 'Elite'] as const).map(range => {
                      const items = filteredProducts.filter(p => p.range === range);
                      if (items.length === 0) return null;
                      return (
                        <div key={range}>
                          <div className="px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-800/80 sticky top-0">{range} Range</div>
                          {items.map(p => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => addLine(p)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-slate-200 font-medium">{p.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${rangeColor[p.range]}`}>{p.pv} PV</span>
                              </div>
                              <span className="text-xs text-slate-400">R{p.priceIncVat.toLocaleString()}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            {lines.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Order Items</div>
                {lines.map((line, idx) => (
                  <div key={line.product.name} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{line.product.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${rangeColor[line.product.range]}`}>{line.product.range}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">R</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.sellingPrice}
                            onChange={e => updatePrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-20 px-1.5 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                          />
                        </div>
                        <span className="text-xs text-slate-500">× {line.quantity} = R{(line.sellingPrice * line.quantity).toLocaleString()}</span>
                        <span className="text-xs text-slate-500">· {line.product.pv * line.quantity} PV</span>
                        {line.sellingPrice !== line.product.priceIncVat && (
                          <span className="text-xs text-amber-400/70" title={`Stock price: R${line.product.priceIncVat}`}>edited</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => updateQty(idx, line.quantity - 1)} className="w-7 h-7 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-sm font-bold">−</button>
                      <span className="w-8 text-center text-sm text-slate-200">{line.quantity}</span>
                      <button type="button" onClick={() => updateQty(idx, line.quantity + 1)} className="w-7 h-7 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center text-sm font-bold">+</button>
                    </div>
                    <button type="button" onClick={() => removeLine(idx)} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-sm font-medium border-t border-slate-700/50">
                  <span className="text-slate-400">Total</span>
                  <span className="text-slate-200">R{totalAmount.toLocaleString()} · {totalPV} PV</span>
                </div>
              </div>
            )}

            {/* Status & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500">
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Activated">Activated</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Order Date</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full px-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500" />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-sm">{error}</div>
            )}
          </form>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {lines.length > 1 ? `Create ${lines.length} Orders` : 'Create Order'}
            </button>
          </div>
        </div>
      </div>

      {/* Close dropdowns on outside click */}
      {(showContactDropdown || showProductDropdown) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowContactDropdown(false); setShowProductDropdown(false); }} />
      )}
    </>
  );
}
