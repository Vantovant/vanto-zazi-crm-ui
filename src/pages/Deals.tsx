import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Users,
  ShoppingCart,
  Award,
  X,
  Filter,
} from 'lucide-react';
import { prospects, orders, type Prospect } from '../data/mockData';
import { ContactDrawer } from '../components/ContactDrawer';

// Derive Deal Status from contact and order data
type DealStatus = 'registered-no-purchase' | 'activated-no-status' | 'activated-with-status';

interface Deal {
  contact: Prospect;
  status: DealStatus;
  statusLabel: string;
  orderCount: number;
  totalOrderValue: number;
  lastOrderDate: string | null;
}

function deriveDealStatus(contact: Prospect, contactOrders: typeof orders): Deal {
  const hasOrders = contactOrders.length > 0;
  const totalOrderValue = contactOrders.reduce((sum, o) => sum + o.amount, 0);
  const lastOrder = contactOrders.sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0];

  let status: DealStatus;
  let statusLabel: string;

  if (contact.RegistrationStatus === 'Registered' && !hasOrders) {
    // Registered but no purchase
    status = 'registered-no-purchase';
    statusLabel = 'Registered — No Purchase';
  } else if (hasOrders && (!contact.AssociateStatus || contact.AssociateStatus === '' || contact.AssociateStatus === 'Pending')) {
    // Has orders but no status yet
    status = 'activated-no-status';
    statusLabel = 'Activated — No Status Yet';
  } else if (hasOrders && contact.AssociateStatus && contact.AssociateStatus !== '' && contact.AssociateStatus !== 'Pending') {
    // Has orders and has associate status
    status = 'activated-with-status';
    statusLabel = `Activated — ${contact.AssociateStatus}`;
  } else {
    // Default case (not registered, no orders)
    status = 'registered-no-purchase';
    statusLabel = 'Prospect';
  }

  return {
    contact,
    status,
    statusLabel,
    orderCount: contactOrders.length,
    totalOrderValue,
    lastOrderDate: lastOrder?.orderDate || null,
  };
}

const statusColors: Record<DealStatus, string> = {
  'registered-no-purchase': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'activated-no-status': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  'activated-with-status': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};

const statusIcons: Record<DealStatus, typeof Users> = {
  'registered-no-purchase': Users,
  'activated-no-status': ShoppingCart,
  'activated-with-status': Award,
};

type StatusFilter = 'all' | DealStatus;

export function Deals() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  // Derive deals from contacts and orders
  const deals = useMemo(() => {
    return prospects.map((contact) => {
      const contactOrders = orders.filter((o) => o.contactName === contact.FullName);
      return deriveDealStatus(contact, contactOrders);
    });
  }, []);

  // Filter deals
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = `${deal.contact.FullName} ${deal.statusLabel} ${deal.contact.City}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && deal.status !== statusFilter) return false;

      return true;
    });
  }, [deals, searchQuery, statusFilter]);

  // Count by status
  const statusCounts = useMemo(() => {
    return {
      all: deals.length,
      'registered-no-purchase': deals.filter((d) => d.status === 'registered-no-purchase').length,
      'activated-no-status': deals.filter((d) => d.status === 'activated-no-status').length,
      'activated-with-status': deals.filter((d) => d.status === 'activated-with-status').length,
    };
  }, [deals]);

  const selectedProspect = selectedContactId ? prospects.find((p) => p.id === selectedContactId) : null;

  const filterLabels: Record<StatusFilter, string> = {
    all: 'All Deals',
    'registered-no-purchase': 'Registered — No Purchase',
    'activated-no-status': 'Activated — No Status',
    'activated-with-status': 'Activated — With Status',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Deals</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            MLM lifecycle tracking for {deals.length} contacts
          </p>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('registered-no-purchase')}
          className={`p-4 rounded-xl border transition-all ${
            statusFilter === 'registered-no-purchase'
              ? 'bg-amber-500/10 border-amber-500/40'
              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{statusCounts['registered-no-purchase']}</p>
              <p className="text-xs text-slate-400">Registered — No Purchase</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('activated-no-status')}
          className={`p-4 rounded-xl border transition-all ${
            statusFilter === 'activated-no-status'
              ? 'bg-cyan-500/10 border-cyan-500/40'
              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{statusCounts['activated-no-status']}</p>
              <p className="text-xs text-slate-400">Activated — No Status Yet</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('activated-with-status')}
          className={`p-4 rounded-xl border transition-all ${
            statusFilter === 'activated-with-status'
              ? 'bg-emerald-500/10 border-emerald-500/40'
              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Award className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{statusCounts['activated-with-status']}</p>
              <p className="text-xs text-slate-400">Activated — With Status</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
              statusFilter !== 'all'
                ? 'bg-teal-600/20 border-teal-500/50 text-teal-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            {filterLabels[statusFilter]}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showFilterDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
              {(Object.keys(filterLabels) as StatusFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(key);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 flex items-center justify-between ${
                    statusFilter === key ? 'text-teal-400' : 'text-slate-300'
                  }`}
                >
                  {filterLabels[key]}
                  <span className="text-xs text-slate-500">{statusCounts[key]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear Filter */}
        {statusFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-rose-400 hover:text-rose-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Deals List */}
      <div className="space-y-3">
        {filteredDeals.map((deal) => {
          const StatusIcon = statusIcons[deal.status];
          return (
            <div
              key={deal.contact.id}
              onClick={() => setSelectedContactId(deal.contact.id)}
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 hover:bg-slate-800/70 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {deal.contact.FullName.split(' ').map((n) => n[0]).join('')}
                </div>

                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-white">{deal.contact.FullName}</h3>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusColors[deal.status]}`}>
                      <StatusIcon className="w-3 h-3" />
                      {deal.statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {deal.contact.City}, {deal.contact.Province} · {deal.contact.PhoneNumber}
                  </p>
                </div>

                {/* Order Stats */}
                <div className="text-right flex-shrink-0">
                  {deal.orderCount > 0 ? (
                    <>
                      <p className="text-lg font-bold text-white">R{deal.totalOrderValue.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">
                        {deal.orderCount} order{deal.orderCount > 1 ? 's' : ''}
                        {deal.lastOrderDate && ` · ${deal.lastOrderDate}`}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-slate-500">R0</p>
                      <p className="text-xs text-slate-500">No orders yet</p>
                    </>
                  )}
                </div>
              </div>

              {/* Additional Info Row */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Lead Type:</span>
                  <span className="text-xs font-medium text-slate-300">{deal.contact.LeadType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Focus:</span>
                  <span className="text-xs font-medium text-slate-300">{deal.contact.FocusArea}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Path:</span>
                  <span className="text-xs font-medium text-slate-300">{deal.contact.LeadPath}</span>
                </div>
                {deal.contact.AssociateStatus && deal.contact.AssociateStatus !== '' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Status:</span>
                    <span className="text-xs font-medium text-emerald-400">{deal.contact.AssociateStatus}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredDeals.length === 0 && (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No deals found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Contact Drawer */}
      {selectedProspect && (
        <ContactDrawer
          prospect={selectedProspect}
          onClose={() => setSelectedContactId(null)}
        />
      )}

      {/* Click outside to close dropdown */}
      {showFilterDropdown && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowFilterDropdown(false)}
        />
      )}
    </div>
  );
}
