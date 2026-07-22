import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  Columns3,
  UserPlus,
  X,
  Loader2,
  Trash2,
  Cloud,
} from 'lucide-react';
import { prospectColumns, filterOptions, type Prospect } from '../data/mockData';
import { ContactDrawer } from '../components/ContactDrawer';
import { AddContactModal } from '../components/AddContactModal';
import { DataStatusBanner } from '../components/DataStatusBanner';
import { useCrm } from '@/contexts/CrmContext';
import { supabase } from '@/integrations/supabase/client';

type FilterKey = keyof typeof filterOptions;

const temperatureColors: Record<string, string> = {
  Hot: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  Warm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Cold: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

const statusColors: Record<string, string> = {
  New: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'In Progress': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const regStatusColors: Record<string, string> = {
  Registered: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Not Registered': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Activated: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const leadTypeColors: Record<string, string> = {
  Prospect: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Registered_Nopurchase: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Purchase_Nostatus: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  Purchase_Status: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  Expired: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

export function Contacts() {
  const outletContext = useOutletContext<{ setSelectedContactId?: (id: string | null) => void }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(prospectColumns.filter((c) => c.default).map((c) => c.key))
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, string>>({
    LeadTemperature: '',
    RegistrationStatus: '',
    LeadType: '',
    FocusArea: '',
    LeadPath: '',
  });
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const { contacts: prospects, contactsLoading, contactsDbActive, deleteContact } = useCrm();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Notify layout of selected contact for ZAZI copilot
  useEffect(() => {
    outletContext?.setSelectedContactId?.(selectedProspect ? String(selectedProspect.id) : null);
  }, [selectedProspect, outletContext]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProspects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProspects.map(p => String(p.id))));
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} contact(s)? This cannot be undone.`)) return;
    setDeleting(true);
    for (const id of selectedIds) {
      await deleteContact(id);
    }
    setSelectedIds(new Set());
    setDeleting(false);
  };
  const filteredProspects = useMemo(() => {
    const rawQuery = searchQuery.trim();
    const query = rawQuery.toLowerCase();
    // Strip non-digits for phone-style numeric matching (e.g. "27 72 960 8908" → "27729608908")
    const queryDigits = rawQuery.replace(/[^0-9]/g, '');

    return prospects.filter((prospect) => {
      if (rawQuery) {
        // Explicit identity fields searched first (covers aplgo_id, phone variants, email variants, name, level, leg, GO status)
        const explicitFields: string[] = [
          (prospect.FullName ?? '').toString(),
          (prospect.APLGoID ?? '').toString(),
          (prospect.PhoneNumber ?? '').toString(),
          (prospect.PhoneNumber ?? '').toString().replace(/[^0-9]/g, ''), // phone_normalized equivalent
          (prospect.EmailAddress ?? '').toString(),
          (prospect.EmailAddress ?? '').toString().toLowerCase().trim(), // email_normalized equivalent
          (prospect.GOStatus ?? '').toString(),
          (prospect.Level ?? '').toString(),
          (prospect.Leg ?? '').toString(),
          (prospect.SponsorName ?? '').toString(),
          (prospect.City ?? '').toString(),
          (prospect.Country ?? '').toString(),
        ].map(v => v.toLowerCase());

        const explicitHit = explicitFields.some(v => v && v.includes(query));
        const digitHit = queryDigits.length >= 4 && (
          (prospect.PhoneNumber ?? '').toString().replace(/[^0-9]/g, '').includes(queryDigits) ||
          (prospect.APLGoID ?? '').toString().replace(/[^0-9]/g, '').includes(queryDigits)
        );

        // Fallback: full-row text search (preserves prior behaviour for any other column)
        const fallbackHit = !explicitHit && !digitHit
          ? Object.values(prospect).join(' ').toLowerCase().includes(query)
          : false;

        if (!explicitHit && !digitHit && !fallbackHit) return false;
      }
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value && prospect[key as keyof Prospect] !== value) {
          return false;
        }
      }
      return true;
    });
  }, [searchQuery, activeFilters, prospects]);

  const toggleColumn = (key: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(key)) {
      newVisible.delete(key);
    } else {
      newVisible.add(key);
    }
    setVisibleColumns(newVisible);
  };

  const clearFilter = (key: FilterKey) => {
    setActiveFilters((prev) => ({ ...prev, [key]: '' }));
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  const renderCellValue = (prospect: Prospect, key: string) => {
    const value = prospect[key as keyof Prospect];

    if (key === 'LeadTemperature') {
      return (
        <span className={`text-xs font-medium px-2 py-1 rounded border ${temperatureColors[value as string] || ''}`}>
          {value}
        </span>
      );
    }

    if (key === 'CommunicationStatus') {
      return (
        <span className={`text-xs font-medium px-2 py-1 rounded border ${statusColors[value as string] || ''}`}>
          {value}
        </span>
      );
    }

    if (key === 'RegistrationStatus') {
      return (
        <span className={`text-xs font-medium px-2 py-1 rounded border ${regStatusColors[value as string] || ''}`}>
          {value}
        </span>
      );
    }

    if (key === 'LeadType') {
      return (
        <span className={`text-xs font-medium px-2 py-1 rounded border ${leadTypeColors[value as string] || ''}`}>
          {value}
        </span>
      );
    }

    if (key === 'DateCaptured') {
      return <span className="text-slate-400 text-sm">{value}</span>;
    }

    if (!value) {
      return <span className="text-slate-600">—</span>;
    }

    return <span className="text-slate-300 text-sm">{value}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Data Status Banner */}
      <DataStatusBanner dbActive={contactsDbActive} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Prospects</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {contactsLoading ? 'Loading...' : `${filteredProspects.length} of ${prospects.length} prospects`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Prospect
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search all columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Filter Dropdowns */}
        {(Object.keys(filterOptions) as FilterKey[]).map((filterKey) => (
          <div key={filterKey} className="relative">
            <button
              type="button"
              onClick={() => setOpenFilter(openFilter === filterKey ? null : filterKey)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                activeFilters[filterKey]
                  ? 'bg-teal-600/20 border-teal-500/50 text-teal-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {filterKey.replace(/([A-Z])/g, ' $1').trim()}
              {activeFilters[filterKey] && (
                <span className="text-xs bg-teal-500/30 px-1.5 py-0.5 rounded">
                  {activeFilters[filterKey]}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {openFilter === filterKey && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                <button
                  type="button"
                  onClick={() => {
                    clearFilter(filterKey);
                    setOpenFilter(null);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                >
                  All
                </button>
                {filterOptions[filterKey].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setActiveFilters((prev) => ({ ...prev, [filterKey]: option }));
                      setOpenFilter(null);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${
                      activeFilters[filterKey] === option
                        ? 'text-teal-400 bg-teal-500/10'
                        : 'text-slate-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() =>
              setActiveFilters({
                LeadTemperature: '',
                RegistrationStatus: '',
                LeadType: '',
                FocusArea: '',
                LeadPath: '',
              })
            }
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-rose-400 hover:text-rose-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear ({activeFilterCount})
          </button>
        )}

        {/* Column Picker */}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 rounded-lg transition-colors"
          >
            <Columns3 className="w-4 h-4" />
            Columns
          </button>

          {showColumnPicker && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-2 max-h-80 overflow-y-auto">
              {prospectColumns.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-teal-500 focus:ring-teal-500/40"
                  />
                  <span className="text-sm text-slate-300">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg">
          <span className="text-sm text-slate-300">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={deleting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete Selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Active filter / search banner — shown whenever results are restricted */}
      {(searchQuery.trim() || activeFilterCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
          <span className="font-semibold">Filtered view:</span>
          {searchQuery.trim() && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20">search: "{searchQuery.trim()}"</span>
          )}
          {Object.entries(activeFilters).filter(([, v]) => v).map(([k, v]) => (
            <span key={k} className="px-2 py-0.5 rounded bg-amber-500/20">{k}: {v}</span>
          ))}
          <span className="ml-auto text-amber-200/80">
            Showing {filteredProspects.length} of {prospects.length}
          </span>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setActiveFilters({ LeadTemperature: '', RegistrationStatus: '', LeadType: '', FocusArea: '', LeadPath: '' }); }}
            className="text-amber-300 underline hover:text-amber-200"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filteredProspects.length > 0 && selectedIds.size === filteredProspects.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-teal-500 focus:ring-teal-500/40"
                  />
                </th>
                {prospectColumns
                  .filter((col) => visibleColumns.has(col.key))
                  .map((col) => (
                    <th
                      key={col.key}
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredProspects.map((prospect) => (
                <tr
                  key={prospect.id}
                  onClick={() => setSelectedProspect(prospect)}
                  className={`hover:bg-slate-700/30 cursor-pointer transition-colors ${selectedIds.has(String(prospect.id)) ? 'bg-teal-500/5' : ''}`}
                >
                  <td className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(prospect.id))}
                      onChange={() => {}}
                      onClick={(e) => toggleSelect(String(prospect.id), e)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-teal-500 focus:ring-teal-500/40"
                    />
                  </td>
                  {prospectColumns
                    .filter((col) => visibleColumns.has(col.key))
                    .map((col) => (
                      <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                        {renderCellValue(prospect, col.key)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredProspects.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-slate-500">No prospects found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Contact Detail Drawer */}
      {selectedProspect && (
        <ContactDrawer
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
        />
      )}

      {/* Click outside to close dropdowns */}
      {(openFilter || showColumnPicker) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setOpenFilter(null);
            setShowColumnPicker(false);
          }}
        />
      )}

      {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
