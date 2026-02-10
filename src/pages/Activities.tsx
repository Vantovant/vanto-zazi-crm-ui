import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Phone,
  Calendar,
  ShoppingCart,
  FileText,
  CheckCircle,
  X,
  Plus,
  Clock,
} from 'lucide-react';
import { timelineActivities, activityFilterOptions, prospects, type TimelineActivity } from '../data/mockData';
import { ContactDrawer } from '../components/ContactDrawer';
import { LogActivityModal } from '../components/LogActivityModal';

const activityIcons: Record<string, typeof Phone> = {
  whatsapp: MessageCircle,
  call: Phone,
  meeting: Calendar,
  order: ShoppingCart,
  note: FileText,
  registration: CheckCircle,
};

const activityColors: Record<string, string> = {
  whatsapp: 'bg-green-500/20 text-green-400 border-green-500/40',
  call: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  meeting: 'bg-violet-500/20 text-violet-400 border-violet-500/40',
  order: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
  note: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
  registration: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};

const activityLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  call: 'Call',
  meeting: 'Meeting',
  order: 'Order',
  note: 'Note',
  registration: 'Registration',
};

type FilterKey = 'type' | 'contact';

export function Activities() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, string>>({
    type: '',
    contact: '',
  });
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [showLogActivity, setShowLogActivity] = useState(false);

  // Get unique contacts from activities
  const uniqueContacts = useMemo(() => {
    return [...new Set(timelineActivities.map(a => a.contactName))];
  }, []);

  const filteredActivities = useMemo(() => {
    return timelineActivities.filter((activity) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = `${activity.contactName} ${activity.summary} ${activity.details}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Type filter
      if (activeFilters.type && activity.type !== activeFilters.type) return false;

      // Contact filter
      if (activeFilters.contact && activity.contactName !== activeFilters.contact) return false;

      // Date range
      if (dateRange.from && activity.date < dateRange.from) return false;
      if (dateRange.to && activity.date > dateRange.to) return false;

      return true;
    });
  }, [searchQuery, activeFilters, dateRange]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, TimelineActivity[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };

    for (const activity of filteredActivities) {
      groups[activity.dateGroup].push(activity);
    }

    return groups;
  }, [filteredActivities]);

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedActivities(newExpanded);
  };

  const clearFilter = (key: FilterKey) => {
    setActiveFilters((prev) => ({ ...prev, [key]: '' }));
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length + (dateRange.from || dateRange.to ? 1 : 0);

  const selectedProspect = selectedContactId ? prospects.find(p => p.id === selectedContactId) : null;

  const handleContactClick = (contactId: number) => {
    setSelectedContactId(contactId);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Activities</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filteredActivities.length} activities logged
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowLogActivity(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Activity
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-500"
          />
        </div>

        {/* Activity Type Filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg border transition-colors ${
              activeFilters.type
                ? 'bg-teal-600/20 border-teal-500/50 text-teal-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            Activity Type
            {activeFilters.type && (
              <span className="text-xs bg-teal-500/30 px-1.5 py-0.5 rounded capitalize">{activeFilters.type}</span>
            )}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {openFilter === 'type' && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
              <button
                type="button"
                onClick={() => { clearFilter('type'); setOpenFilter(null); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-slate-700"
              >
                All Types
              </button>
              {activityFilterOptions.type.map((type) => {
                const Icon = activityIcons[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setActiveFilters(prev => ({ ...prev, type })); setOpenFilter(null); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 ${activeFilters.type === type ? 'text-teal-400' : 'text-slate-300'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="capitalize">{type}</span>
                  </button>
                );
              })}
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
                All Contacts
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
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
          />
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
              setActiveFilters({ type: '', contact: '' });
              setDateRange({ from: '', to: '' });
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-rose-400 hover:text-rose-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-8">
        {/* Today */}
        {groupedActivities.today.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold text-white">Today</h3>
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500">{groupedActivities.today.length} activities</span>
            </div>
            <div className="relative pl-8">
              {/* Timeline line */}
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />

              <div className="space-y-4">
                {groupedActivities.today.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    isExpanded={expandedActivities.has(activity.id)}
                    onToggle={() => toggleExpand(activity.id)}
                    onContactClick={() => handleContactClick(activity.contactId)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Yesterday */}
        {groupedActivities.yesterday.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold text-white">Yesterday</h3>
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500">{groupedActivities.yesterday.length} activities</span>
            </div>
            <div className="relative pl-8">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />

              <div className="space-y-4">
                {groupedActivities.yesterday.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    isExpanded={expandedActivities.has(activity.id)}
                    onToggle={() => toggleExpand(activity.id)}
                    onContactClick={() => handleContactClick(activity.contactId)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Earlier */}
        {groupedActivities.earlier.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold text-white">Earlier</h3>
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500">{groupedActivities.earlier.length} activities</span>
            </div>
            <div className="relative pl-8">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-700" />

              <div className="space-y-4">
                {groupedActivities.earlier.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    isExpanded={expandedActivities.has(activity.id)}
                    onToggle={() => toggleExpand(activity.id)}
                    onContactClick={() => handleContactClick(activity.contactId)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredActivities.length === 0 && (
          <div className="py-16 text-center">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No activities found matching your criteria.</p>
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

      {/* Click outside to close dropdowns */}
      {openFilter && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpenFilter(null)}
        />
      )}

      {showLogActivity && (
        <LogActivityModal onClose={() => setShowLogActivity(false)} />
      )}
    </div>
  );
}

// Activity Card Component
interface ActivityCardProps {
  activity: TimelineActivity;
  isExpanded: boolean;
  onToggle: () => void;
  onContactClick: () => void;
}

function ActivityCard({ activity, isExpanded, onToggle, onContactClick }: ActivityCardProps) {
  const Icon = activityIcons[activity.type];
  const colorClass = activityColors[activity.type];

  return (
    <div className="relative">
      {/* Icon on timeline */}
      <div className={`absolute -left-8 w-6 h-6 rounded-full border-2 ${colorClass} flex items-center justify-center bg-slate-900`}>
        <Icon className="w-3 h-3" />
      </div>

      {/* Card */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:bg-slate-800/70 transition-colors">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Type badge and timestamp */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorClass}`}>
                  {activityLabels[activity.type]}
                </span>
                <span className="text-xs text-slate-500">{activity.timestamp}</span>
                <span className="text-xs text-slate-600">•</span>
                <span className="text-xs text-slate-500">{activity.date}</span>
              </div>

              {/* Contact name (clickable) */}
              <button
                type="button"
                onClick={onContactClick}
                className="text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors mb-1"
              >
                {activity.contactName}
              </button>

              {/* Summary */}
              <p className="text-sm font-medium text-slate-200">{activity.summary}</p>
            </div>

            {/* Expand button */}
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          </div>

          {/* Expandable details */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-sm text-slate-400">{activity.details}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
