'use client';

import { MeetingType, MEETING_TYPE_LABELS } from '@/types';
import ViewToggle from '@/components/ui/ViewToggle';

interface EventFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: MeetingType | 'all';
  onTabChange: (tab: MeetingType | 'all') => void;
  tabCounts: Record<MeetingType | 'all', number>;
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
}

export default function EventFilters({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  tabCounts,
  view,
  onViewChange,
}: EventFiltersProps) {
  const tabs: (MeetingType | 'all')[] = [
    'all',
    'one_on_one',
    'group',
    'round_robin',
    'collective',
    'panel',
    'webinar',
  ];

  const getTabLabel = (tab: MeetingType | 'all') => {
    if (tab === 'all') return 'All';
    return MEETING_TYPE_LABELS[tab];
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Search and View Toggle Row */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-lg">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6F71EE]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search events by name or host..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-sm
              focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/30 focus:border-[#6F71EE]
              placeholder:text-[#9CA3AF] shadow-sm hover:border-gray-400 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#101E57] p-1 rounded-full hover:bg-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <ViewToggle view={view} onChange={onViewChange} />
      </div>

      {/* Meeting Type Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1">
        {tabs.map((tab) => {
          const count = tabCounts[tab];
          // Only show tabs that have events (or always show 'all')
          if (tab !== 'all' && count === 0) return null;

          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                whitespace-nowrap transition ${
                  activeTab === tab
                    ? 'bg-[#6F71EE] text-white'
                    : 'text-[#667085] hover:bg-[#F6F6F9] hover:text-[#101E57]'
                }`}
            >
              {getTabLabel(tab)}
              <span
                className={`px-1.5 py-0.5 rounded text-xs ${
                  activeTab === tab
                    ? 'bg-white/20'
                    : 'bg-[#F6F6F9]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
