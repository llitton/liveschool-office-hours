'use client';

import { useState, useEffect } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';
import type { ChangelogEntry } from '@/lib/changelog';

const CATEGORY_STYLES = {
  feature: {
    bg: 'bg-[#6F71EE]/10',
    text: 'text-[#6F71EE]',
    label: 'New Feature',
  },
  improvement: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Improvement',
  },
  fix: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    label: 'Fix',
  },
};

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChangelog();
  }, []);

  const fetchChangelog = async () => {
    try {
      const response = await fetch('/api/changelog');
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries);
        setLastSeenAt(data.lastSeenAt);

        // Mark as seen after loading
        await fetch('/api/changelog', { method: 'POST' });
      }
    } catch (error) {
      console.error('Failed to fetch changelog:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isNew = (entryDate: string) => {
    if (!lastSeenAt) return true;
    return new Date(entryDate) > new Date(lastSeenAt);
  };

  // Group entries by month
  const groupedEntries = entries.reduce((acc, entry) => {
    const date = new Date(entry.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (!acc[monthKey]) {
      acc[monthKey] = { label: monthLabel, entries: [] };
    }
    acc[monthKey].entries.push(entry);
    return acc;
  }, {} as Record<string, { label: string; entries: ChangelogEntry[] }>);

  return (
    <PageContainer>
      <PageHeader
        title="What's New"
        description="See the latest updates and improvements to Connect."
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E0E0E0] p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center">
          <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h3 className="font-medium text-[#101E57] mb-2">No updates yet</h3>
          <p className="text-sm text-[#667085]">Check back later for new features and improvements.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEntries).map(([monthKey, { label, entries: monthEntries }]) => (
            <div key={monthKey}>
              <h2 className="text-lg font-semibold text-[#101E57] mb-4">{label}</h2>
              <div className="space-y-4">
                {monthEntries.map((entry) => {
                  const style = CATEGORY_STYLES[entry.category];
                  const entryIsNew = isNew(entry.date);

                  return (
                    <div
                      key={entry.id}
                      className={`bg-white rounded-xl border p-6 transition ${
                        entryIsNew ? 'border-[#6F71EE] ring-1 ring-[#6F71EE]/20' : 'border-[#E0E0E0]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          {entryIsNew && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#6F71EE] text-white">
                              New
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-[#667085]">{formatDate(entry.date)}</span>
                      </div>

                      <h3 className="text-lg font-semibold text-[#101E57] mb-2">{entry.title}</h3>
                      <p className="text-[#667085] mb-3">{entry.description}</p>

                      {entry.details && entry.details.length > 0 && (
                        <ul className="space-y-1.5">
                          {entry.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[#667085]">
                              <svg className="w-4 h-4 text-[#6F71EE] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
