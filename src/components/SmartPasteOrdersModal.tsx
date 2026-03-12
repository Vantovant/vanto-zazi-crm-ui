import { useState, useMemo } from 'react';
import { X, ClipboardPaste, Loader2, Search, Check, ChevronDown, Sparkles } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Compute a stable dedupe key for an order */
function computeDedupeKey(o: {
  contactName: string; product: string; quantity: number;
  amount: number; pvAmount: number; purchaseType: string;
  orderDate: string; source: string;
}): string {
  const parts = [
    (o.contactName || '').trim().toLowerCase(),
    (o.product || '').trim().toLowerCase(),
    String(o.quantity || 0),
    String(o.amount || 0),
    String(o.pvAmount || 0),
    (o.purchaseType || '').trim().toLowerCase(),
    (o.orderDate || ''),
    (o.source || 'manual').trim().toLowerCase(),
  ].join('|');
  // Simple hash to match md5 conceptually – we use the raw string for DB lookup
  return parts;
}

interface ParsedOrder {
  product: string;
  quantity: number;
  pv_amount: number;
  purchase_type: 'Activity' | 'Upgrade';
  zar_amount: number;
  order_date: string;
  status: string;
  badges: string[];
  order_id: string;
  selected: boolean;
}

interface SmartPasteOrdersModalProps {
  onClose: () => void;
}

export function SmartPasteOrdersModal({ onClose }: SmartPasteOrdersModalProps) {
  const { contacts, addOrder, refetchOrders } = useCrm();
  const { user } = useAuth();
  const [pastedText, setPastedText] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedContactName, setSelectedContactName] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 20);
    const q = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.FullName.toLowerCase().includes(q) ||
      c.PhoneNumber?.toLowerCase().includes(q) ||
      c.APLGoID?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [contacts, contactSearch]);

  const selectContact = (id: string, name: string) => {
    setSelectedContactId(id);
    setSelectedContactName(name);
    setContactSearch(name);
    setShowContactDropdown(false);
  };

  const handleParse = async () => {
    if (!pastedText.trim()) { setError('Please paste backoffice data first.'); return; }
    if (!selectedContactName.trim()) { setError('Please select a contact first.'); return; }
    setParsing(true);
    setError('');

    try {
      // Get user API keys for AI provider
      let userApiKeys = null;
      try {
        const { data } = await supabase.from('user_api_keys').select('*').limit(1).maybeSingle();
        if (data) userApiKeys = data;
      } catch { /* use default */ }

      // Use fetch directly with longer timeout to avoid supabase-js default timeout
      const session = (await supabase.auth.getSession()).data.session;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

      let data: any;
      let fnError: any = null;
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-backoffice-orders`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              pastedText,
              contactName: selectedContactName,
              contactId: selectedContactId,
              userApiKeys,
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);
        data = await response.json();
        if (!response.ok) fnError = { message: data.error || `HTTP ${response.status}` };
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error('Request timed out. Try pasting less data or check your connection.');
        }
        throw fetchErr;
      }

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const orders = (data.orders || []).map((o: Omit<ParsedOrder, 'selected'>) => ({ ...o, selected: true }));
      setParsedOrders(orders);
      setSummary(data.summary || '');
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse backoffice data.');
    } finally {
      setParsing(false);
    }
  };

  const toggleOrder = (idx: number) => {
    setParsedOrders(prev => prev.map((o, i) => i === idx ? { ...o, selected: !o.selected } : o));
  };

  const toggleAll = () => {
    const allSelected = parsedOrders.every(o => o.selected);
    setParsedOrders(prev => prev.map(o => ({ ...o, selected: !allSelected })));
  };

  const selectedOrders = parsedOrders.filter(o => o.selected);
  const totalPV = selectedOrders.reduce((sum, o) => sum + o.pv_amount, 0);
  const totalZAR = selectedOrders.reduce((sum, o) => sum + o.zar_amount, 0);

  const handleSave = async () => {
    if (selectedOrders.length === 0) return;
    setSaving(true);
    setError('');

    let successCount = 0;
    for (const order of selectedOrders) {
      const result = await addOrder({
        orderId: order.order_id || `BO-${Date.now().toString(36).toUpperCase()}`,
        contactName: selectedContactName,
        contact_id: selectedContactId || undefined,
        product: order.product,
        quantity: order.quantity,
        amount: order.zar_amount,
        status: order.status as 'Pending' | 'Paid' | 'Delivered' | 'Activated',
        orderDate: order.order_date || new Date().toISOString().split('T')[0],
        badges: order.badges as ('Activated' | 'First Order' | 'Upgrade')[],
        purchaseType: order.purchase_type,
        pvAmount: order.pv_amount,
        source: 'backoffice-paste',
      });
      if (result) successCount++;
    }

    setSaving(false);
    if (successCount > 0) {
      onClose();
    } else {
      setError('Failed to save orders.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Smart Paste Orders</h2>
                <p className="text-xs text-slate-400">Paste backoffice data → AI extracts orders</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {step === 'input' ? (
              <>
                {/* Contact selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Select Contact *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={e => { setContactSearch(e.target.value); setShowContactDropdown(true); setSelectedContactId(''); setSelectedContactName(''); }}
                      onFocus={() => setShowContactDropdown(true)}
                      placeholder="Search by name, phone, or APLGO ID..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 placeholder:text-slate-500"
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

                {/* Paste area */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Paste Backoffice Data *
                  </label>
                  <div className="relative">
                    <textarea
                      value={pastedText}
                      onChange={e => setPastedText(e.target.value)}
                      placeholder="Copy data from the APLGO backoffice (Login Status change History, Recent purchases, etc.) and paste it here..."
                      rows={10}
                      className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 placeholder:text-slate-500 font-mono resize-none"
                    />
                    {!pastedText && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <ClipboardPaste className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-600">Ctrl+V to paste</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>Activity PV: 1 PV = R18.75</span>
                    <span>Upgrade PV: 1 PV = R37.50</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Preview parsed results */}
                {summary && (
                  <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-sm text-violet-300">
                    <Sparkles className="w-4 h-4 inline mr-1.5" />
                    {summary}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <button type="button" onClick={toggleAll} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    {parsedOrders.every(o => o.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                  <div className="text-xs text-slate-400">
                    {selectedOrders.length} of {parsedOrders.length} selected · {totalPV} PV · R{totalZAR.toLocaleString()}
                  </div>
                </div>

                <div className="space-y-2">
                  {parsedOrders.map((order, idx) => (
                    <div
                      key={idx}
                      onClick={() => toggleOrder(idx)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        order.selected
                          ? 'bg-slate-800/80 border-violet-500/30'
                          : 'bg-slate-800/30 border-slate-700/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                          order.selected ? 'bg-violet-500 border-violet-500' : 'border-slate-600'
                        }`}>
                          {order.selected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200 truncate">{order.product}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              order.purchase_type === 'Upgrade'
                                ? 'bg-violet-500/20 text-violet-400'
                                : 'bg-teal-500/20 text-teal-400'
                            }`}>
                              {order.purchase_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{order.pv_amount} PV</span>
                            <span>R{order.zar_amount.toLocaleString()}</span>
                            <span>Qty: {order.quantity}</span>
                            {order.order_date && <span>{order.order_date}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {order.badges.map(b => (
                            <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{b}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {parsedOrders.length === 0 && (
                  <div className="py-8 text-center text-slate-500">
                    <p>No orders could be extracted from the pasted data.</p>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-sm">{error}</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
            {step === 'preview' && (
              <button type="button" onClick={() => setStep('input')} className="text-sm text-slate-400 hover:text-white transition-colors">
                ← Back to edit
              </button>
            )}
            {step === 'input' && <div />}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
              {step === 'input' ? (
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={parsing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {parsing ? 'Parsing...' : 'Parse with AI'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || selectedOrders.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Saving...' : `Save ${selectedOrders.length} Orders`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {showContactDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowContactDropdown(false)} />
      )}
    </>
  );
}
