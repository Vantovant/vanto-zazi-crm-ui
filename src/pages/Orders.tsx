import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ShoppingCart,
  X,
  Calendar,
} from 'lucide-react';
import { orders, orderFilterOptions, type Order } from '../data/mockData';

const statusColors: Record<string, string> = {
  Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Paid: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Delivered: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  Activated: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const badgeColors: Record<string, string> = {
  Activated: 'bg-emerald-500/20 text-emerald-400',
  'First Order': 'bg-teal-500/20 text-teal-400',
  Upgrade: 'bg-violet-500/20 text-violet-400',
};

type FilterKey = 'status' | 'product' | 'contact';

export function Orders() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, string>>({
    status: '',
    product: '',
    contact: '',
  });
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Get unique contacts from orders
  const uniqueContacts = useMemo(() => {
    return [...new Set(orders.map(o => o.contactName))];
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = `${order.orderId} ${order.contactName} ${order.product}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      if (activeFilters.status && order.status !== activeFilters.status) return false;

      // Product filter
      if (activeFilters.product && order.product !== activeFilters.product) return false;

      // Contact filter
      if (activeFilters.contact && order.contactName !== activeFilters.contact) return false;

      // Date range filter
      if (dateRange.from && order.orderDate < dateRange.from) return false;
      if (dateRange.to && order.orderDate > dateRange.to) return false;

      return true;
    });
  }, [searchQuery, activeFilters, dateRange]);

  const clearFilter = (key: FilterKey) => {
    setActiveFilters((prev) => ({ ...prev, [key]: '' }));
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length + (dateRange.from || dateRange.to ? 1 : 0);

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Orders</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filteredOrders.length} orders · R{totalRevenue.toLocaleString()} total
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          New Order
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
              activeFilters.status
                ? 'bg-teal-600/20 border-teal-500/50 text-teal-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            Status
            {activeFilters.status && (
              <span className="text-xs bg-teal-500/30 px-1.5 py-0.5 rounded">{activeFilters.status}</span>
            )}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {openFilter === 'status' && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
              <button
                type="button"
                onClick={() => { clearFilter('status'); setOpenFilter(null); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-slate-700"
              >
                All
              </button>
              {orderFilterOptions.status.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setActiveFilters(prev => ({ ...prev, status: option })); setOpenFilter(null); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${activeFilters.status === option ? 'text-teal-400' : 'text-slate-300'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenFilter(openFilter === 'product' ? null : 'product')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
              activeFilters.product
                ? 'bg-teal-600/20 border-teal-500/50 text-teal-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            Product
            {activeFilters.product && (
              <span className="text-xs bg-teal-500/30 px-1.5 py-0.5 rounded max-w-[100px] truncate">{activeFilters.product}</span>
            )}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {openFilter === 'product' && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => { clearFilter('product'); setOpenFilter(null); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-slate-700"
              >
                All
              </button>
              {orderFilterOptions.product.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setActiveFilters(prev => ({ ...prev, product: option })); setOpenFilter(null); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 truncate ${activeFilters.product === option ? 'text-teal-400' : 'text-slate-300'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Contact Filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenFilter(openFilter === 'contact' ? null : 'contact')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
              activeFilters.contact
                ? 'bg-teal-600/20 border-teal-500/50 text-teal-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            Contact
            {activeFilters.contact && (
              <span className="text-xs bg-teal-500/30 px-1.5 py-0.5 rounded">{activeFilters.contact}</span>
            )}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {openFilter === 'contact' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => { clearFilter('contact'); setOpenFilter(null); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-slate-700"
              >
                All
              </button>
              {uniqueContacts.map((contact) => (
                <button
                  key={contact}
                  type="button"
                  onClick={() => { setActiveFilters(prev => ({ ...prev, contact })); setOpenFilter(null); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 ${activeFilters.contact === contact ? 'text-teal-400' : 'text-slate-300'}`}
                >
                  {contact}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="pl-10 pr-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
            />
          </div>
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
          />
        </div>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setActiveFilters({ status: '', product: '', contact: '' });
              setDateRange({ from: '', to: '' });
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-rose-400 hover:text-rose-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4">
                    <span className="text-sm font-mono text-teal-400">{order.orderId}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium text-slate-200">{order.contactName}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-slate-300">{order.product}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-slate-400">{order.quantity}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium text-slate-200">R{order.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-slate-400">{order.orderDate}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {order.badges.map((badge) => (
                        <span key={badge} className={`text-xs font-medium px-2 py-0.5 rounded ${badgeColors[badge]}`}>
                          {badge}
                        </span>
                      ))}
                      {order.badges.length === 0 && <span className="text-slate-600">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-slate-500">No orders found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Placeholder Order Drawer */}
      {selectedOrder && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="fixed right-0 top-0 h-screen w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold text-white">Order Details</h2>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">{selectedOrder.orderId}</h3>
                <p className="text-sm text-slate-400 mt-1">{selectedOrder.contactName}</p>
                <p className="text-lg font-bold text-teal-400 mt-2">R{selectedOrder.amount.toLocaleString()}</p>
                <span className={`inline-block mt-3 text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[selectedOrder.status]}`}>
                  {selectedOrder.status}
                </span>
                <p className="text-xs text-slate-500 mt-6 max-w-[240px]">
                  Order detail drawer will be implemented in the next iteration.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Click outside to close dropdowns */}
      {openFilter && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpenFilter(null)}
        />
      )}
    </div>
  );
}
