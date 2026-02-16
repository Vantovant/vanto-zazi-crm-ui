import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Users,
  ShoppingCart,
  Award,
  X,
  Filter,
  Download,
} from 'lucide-react';
import { type Prospect, type Order } from '../data/mockData';
import { ContactDrawer } from '../components/ContactDrawer';
import { useCrm } from '@/contexts/CrmContext';

// Deal status derived from GO Status and registration
type DealStatus = 'activated-no-status' | 'activated-with-status';

interface Deal {
  contact: Prospect;
  status: DealStatus;
  statusLabel: string;
  goStatus: string;
  orderCount: number;
  totalOrderValue: number;
  lastOrderDate: string | null;
}

// Minimum investment by GO-Status rank (USD value × 15 ZAR conversion)
function estimatedMinValue(goStatus: string): number {
  const s = goStatus.toLowerCase();
  if (s.includes('diamond')) return 45000;   // $3,000 × 15
  if (s.includes('mentor')) return 9000;      // $600 × 15
  if (s.includes('builder')) return 6000;     // $400 × 15
  if (s.includes('associate')) return 3000;   // $200 × 15
  if (s.includes('promoter')) return 1500;    // $100 × 15
  // Activation only (no rank) = R375 activation fee
  return 375;
}

function deriveDealStatus(contact: Prospect, contactOrders: Order[]): Deal {
  const totalOrderValue = contactOrders.reduce((sum, o) => sum + o.amount, 0);
  const lastOrder = contactOrders.sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0];

  const goStatus = contact.GOStatus || 'No status';
  const hasRank = goStatus !== 'No status' && goStatus !== '';

  const status: DealStatus = hasRank ? 'activated-with-status' : 'activated-no-status';
  const statusLabel = hasRank ? goStatus : 'Activation Only';

  // Use actual orders if available, otherwise estimate from GO-Status
  const minValue = estimatedMinValue(goStatus);
  const displayValue = totalOrderValue > 0 ? totalOrderValue : minValue;

  return {
    contact,
    status,
    statusLabel,
    goStatus,
    orderCount: contactOrders.length,
    totalOrderValue: displayValue,
    lastOrderDate: lastOrder?.orderDate || null,
  };
}

const statusColors: Record<DealStatus, string> = {
  'activated-no-status': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'activated-with-status': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};

const statusIcons: Record<DealStatus, typeof Users> = {
  'activated-no-status': ShoppingCart,
  'activated-with-status': Award,
};

type StatusFilter = 'all' | DealStatus;

export function Deals() {
  const { contacts: prospects, orders } = useCrm();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  // Derive deals from Purchase_Status contacts only (actual distributors)
  const deals = useMemo(() => {
    return prospects
      .filter((c) => c.LeadType === 'Purchase_Status')
      .map((contact) => {
        const contactOrders = orders.filter((o) => o.contactName === contact.FullName);
        return deriveDealStatus(contact, contactOrders);
      });
  }, [prospects, orders]);

  // Filter deals
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = `${deal.contact.FullName} ${deal.statusLabel} ${deal.contact.City} ${deal.goStatus}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      if (statusFilter !== 'all' && deal.status !== statusFilter) return false;
      return true;
    });
  }, [deals, searchQuery, statusFilter]);

  // Count by status
  const statusCounts = useMemo(() => {
    return {
      all: deals.length,
      'activated-no-status': deals.filter((d) => d.status === 'activated-no-status').length,
      'activated-with-status': deals.filter((d) => d.status === 'activated-with-status').length,
    };
  }, [deals]);

  const selectedProspect = selectedContactId ? prospects.find((p) => p.id === selectedContactId) : null;

  const filterLabels: Record<StatusFilter, string> = {
    all: 'All Deals',
    'activated-no-status': 'Activation Only',
    'activated-with-status': 'With GO-Status',
  };

  const exportCSV = (filterStatus: DealStatus, fileLabel: string) => {
    const filtered = deals.filter((d) => d.status === filterStatus);
    const headers = ['email_address', 'first_name', 'last_name', 'tags', 'source', 'opt_in_date'];
    const rows = filtered.map((deal) => {
      const nameParts = deal.contact.FullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const isRanked = filterStatus === 'activated-with-status';
      const rankTag = isRanked && deal.goStatus ? `Rank_${deal.goStatus.replace(/\s+/g, '_')}` : '';
      const tags = [
        'Activated_Distributor',
        isRanked ? 'Has_GO_Status' : 'Activation_Only_R375',
        rankTag,
        deal.contact.FocusArea ? deal.contact.FocusArea.replace(/\s+/g, '_') : '',
        deal.contact.LeadTemperature ? `Temp_${deal.contact.LeadTemperature}` : '',
        deal.contact.InterestLevel ? `Interest_${deal.contact.InterestLevel}` : '',
      ].filter(Boolean).join(', ');
      const source = deal.contact.LeadPath || 'Manual';
      const optInDate = deal.contact.DateCaptured || '';
      return [
        deal.contact.EmailAddress,
        firstName,
        lastName,
        tags,
        source,
        optInDate,
      ].map((v) => `"${(v || '').replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zazi-mail-${fileLabel}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Deals</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {deals.length} activated distributors — {statusCounts['activated-with-status']} with GO-Status, {statusCounts['activated-no-status']} activation only
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportCSV('activated-no-status', 'activation-only')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Activation Only ({statusCounts['activated-no-status']})
          </button>
          <button
            type="button"
            onClick={() => exportCSV('activated-with-status', 'go-status-ranked')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export GO-Status ({statusCounts['activated-with-status']})
          </button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('activated-no-status')}
          className={`p-4 rounded-xl border transition-all ${
            statusFilter === 'activated-no-status'
              ? 'bg-amber-500/10 border-amber-500/40'
              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{statusCounts['activated-no-status']}</p>
              <p className="text-xs text-slate-400">Activation Only (R375+VAT)</p>
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
              <p className="text-xs text-slate-400">With GO-Status</p>
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

                {/* Order Stats — always show estimated min investment based on GO-Status */}
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
                      <p className="text-lg font-bold text-emerald-400">R{deal.totalOrderValue.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">
                        Est. min investment ({deal.goStatus !== 'No status' ? deal.goStatus : 'Activation R375'})
                      </p>
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
                {deal.goStatus && deal.goStatus !== 'No status' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">GO-Status:</span>
                    <span className="text-xs font-medium text-emerald-400">{deal.goStatus}</span>
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
