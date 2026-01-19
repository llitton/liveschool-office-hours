'use client';

import { useState, useEffect } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { ExportButton } from '@/components/ExportButton';

interface FunnelStep {
  step: string;
  count: number;
  dropOffRate: number | null;
  conversionRate: number | null;
}

interface DropOff {
  from: string;
  to: string;
  rate: number;
}

interface EventBreakdown {
  eventId: string;
  eventName: string;
  eventSlug: string;
  pageViews: number;
  bookings: number;
  conversionRate: number;
}

interface TrendData {
  date: string;
  pageViews: number;
  bookings: number;
}

interface ConversionData {
  summary: {
    pageViews: number;
    bookings: number;
    conversionRate: number;
    dropOffRate: number;
  };
  funnel: FunnelStep[];
  topDropOffs: DropOff[];
  eventBreakdown: EventBreakdown[];
  trends: TrendData[];
  period: string;
}

type Period = 'week' | 'month' | 'all';

const STEP_LABELS: Record<string, string> = {
  page_view: 'Page View',
  slot_selection: 'Slot Selected',
  form_start: 'Form Started',
  form_submit: 'Form Submitted',
  booking_created: 'Booking Created',
};

// Funnel visualization component
function ConversionFunnel({ funnel }: { funnel: FunnelStep[] }) {
  const maxCount = Math.max(...funnel.map((f) => f.count), 1);

  return (
    <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
      <h3 className="font-semibold text-[#101E57] mb-6">Booking Funnel</h3>
      <div className="space-y-3">
        {funnel.map((step, index) => {
          const width = Math.max((step.count / maxCount) * 100, 5);
          const isLast = index === funnel.length - 1;

          return (
            <div key={step.step} className="relative">
              <div className="flex items-center gap-4">
                {/* Step bar */}
                <div className="flex-1">
                  <div
                    className={`h-12 rounded-lg flex items-center px-4 transition-all ${
                      isLast ? 'bg-[#417762]' : 'bg-[#6F71EE]'
                    }`}
                    style={{ width: `${width}%` }}
                  >
                    <span className="text-white font-medium text-sm whitespace-nowrap">
                      {STEP_LABELS[step.step] || step.step}
                    </span>
                  </div>
                </div>

                {/* Count and drop-off */}
                <div className="w-24 text-right">
                  <p className="text-lg font-bold text-[#101E57]">{step.count.toLocaleString()}</p>
                </div>

                <div className="w-20 text-right">
                  {step.dropOffRate !== null && step.dropOffRate > 0 ? (
                    <span className="text-sm text-red-500 font-medium">-{step.dropOffRate}%</span>
                  ) : index === 0 ? (
                    <span className="text-sm text-[#667085]">—</span>
                  ) : (
                    <span className="text-sm text-[#417762]">0%</span>
                  )}
                </div>
              </div>

              {/* Connector arrow */}
              {!isLast && (
                <div className="absolute left-4 -bottom-2 z-10">
                  <svg className="w-4 h-4 text-[#E0E0E0]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 16l-6-6h12z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-[#E0E0E0] flex items-center justify-between text-sm text-[#667085]">
        <span>Unique sessions at each stage</span>
        <span>Drop-off rate from previous stage</span>
      </div>
    </div>
  );
}

// Simple bar chart for trends
function ConversionChart({ trends }: { trends: TrendData[] }) {
  if (trends.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
        <h3 className="font-semibold text-[#101E57] mb-4">Daily Trends</h3>
        <div className="h-48 flex items-center justify-center text-[#667085]">
          No trend data available
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...trends.map((t) => Math.max(t.pageViews, t.bookings)), 1);

  // Show last 14 days max
  const displayTrends = trends.slice(-14);

  return (
    <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
      <h3 className="font-semibold text-[#101E57] mb-4">Daily Trends</h3>

      <div className="flex items-end gap-1 h-48">
        {displayTrends.map((day) => {
          const pageViewHeight = (day.pageViews / maxValue) * 100;
          const bookingHeight = (day.bookings / maxValue) * 100;
          const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5 h-40">
                <div
                  className="flex-1 bg-[#6F71EE]/30 rounded-t"
                  style={{ height: `${Math.max(pageViewHeight, 2)}%` }}
                  title={`${day.pageViews} page views`}
                />
                <div
                  className="flex-1 bg-[#417762] rounded-t"
                  style={{ height: `${Math.max(bookingHeight, 2)}%` }}
                  title={`${day.bookings} bookings`}
                />
              </div>
              <span className="text-xs text-[#667085]">{dayLabel}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-[#E0E0E0] flex items-center gap-6 text-sm">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-[#6F71EE]/30 rounded" />
          <span className="text-[#667085]">Page Views</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-[#417762] rounded" />
          <span className="text-[#667085]">Bookings</span>
        </span>
      </div>
    </div>
  );
}

export default function ConversionsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<ConversionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/conversions?period=${period}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch conversion data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Booking Conversions"
        description="Track how visitors move through your booking funnel and identify drop-off points."
        action={
          <div className="flex items-center gap-3">
            <ExportButton
              endpoint="/api/analytics/conversions/export"
              params={{ period }}
              filename={`conversions-${period}.csv`}
            />
            <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E0E0E0] p-1">
              {(['week', 'month', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    period === p
                      ? 'bg-[#101E57] text-white'
                      : 'text-[#667085] hover:text-[#101E57]'
                  }`}
                >
                  {p === 'all' ? 'All time' : p === 'week' ? 'Past week' : 'Past month'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E0E0E0] p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-6 animate-pulse h-80" />
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <p className="text-sm text-[#667085] mb-1">Page Views</p>
              <p className="text-3xl font-bold text-[#101E57]">{data.summary.pageViews.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <p className="text-sm text-[#667085] mb-1">Bookings</p>
              <p className="text-3xl font-bold text-[#417762]">{data.summary.bookings.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <p className="text-sm text-[#667085] mb-1">Conversion Rate</p>
              <p className="text-3xl font-bold text-[#6F71EE]">{data.summary.conversionRate}%</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <p className="text-sm text-[#667085] mb-1">Drop-off Rate</p>
              <p className="text-3xl font-bold text-[#EF4444]">{data.summary.dropOffRate}%</p>
            </div>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Funnel - takes 2 columns */}
            <div className="col-span-2">
              <ConversionFunnel funnel={data.funnel} />
            </div>

            {/* Top drop-offs */}
            <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
              <h3 className="font-semibold text-[#101E57] mb-4">Top Drop-off Points</h3>
              {data.topDropOffs.length === 0 ? (
                <p className="text-[#667085] text-sm">No drop-off data yet</p>
              ) : (
                <div className="space-y-4">
                  {data.topDropOffs.map((dropOff, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-[#101E57]">
                            {dropOff.from} → {dropOff.to}
                          </p>
                        </div>
                      </div>
                      <span className="text-red-500 font-bold">{dropOff.rate}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations based on drop-offs */}
              {data.topDropOffs.length > 0 && (
                <div className="mt-6 pt-4 border-t border-[#E0E0E0]">
                  <h4 className="text-sm font-medium text-[#101E57] mb-2">Recommendations</h4>
                  <ul className="text-sm text-[#667085] space-y-2">
                    {data.topDropOffs[0]?.from?.toLowerCase().includes('form') && (
                      <li className="flex items-start gap-2">
                        <span className="text-[#6F71EE]">•</span>
                        Consider simplifying your booking form
                      </li>
                    )}
                    {data.topDropOffs[0]?.from?.toLowerCase().includes('slot') && (
                      <li className="flex items-start gap-2">
                        <span className="text-[#6F71EE]">•</span>
                        Offer more available time slots
                      </li>
                    )}
                    {data.topDropOffs[0]?.from?.toLowerCase().includes('page') && (
                      <li className="flex items-start gap-2">
                        <span className="text-[#6F71EE]">•</span>
                        Improve your event description
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Trends chart */}
          <div className="mb-6">
            <ConversionChart trends={data.trends} />
          </div>

          {/* Event breakdown */}
          <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E0E0E0]">
              <h3 className="font-semibold text-[#101E57]">By Event</h3>
            </div>
            {data.eventBreakdown.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-[#101E57] mb-2">No conversion data yet</h4>
                <p className="text-sm text-[#667085] max-w-xs mx-auto">
                  Once visitors start viewing your booking pages, conversion data will appear here.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#F6F6F9]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#667085] uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#667085] uppercase tracking-wider">
                      Bookings
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#667085] uppercase tracking-wider">
                      Conversion
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0]">
                  {data.eventBreakdown.map((event) => (
                    <tr key={event.eventId} className="hover:bg-[#FAFAFA]">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-[#101E57]">{event.eventName}</p>
                          <p className="text-sm text-[#667085]">/book/{event.eventSlug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-[#101E57]">
                        {event.pageViews.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-[#417762]">
                        {event.bookings.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                            event.conversionRate >= 10
                              ? 'bg-green-100 text-green-800'
                              : event.conversionRate >= 5
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {event.conversionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-12 text-center">
          <p className="text-[#667085]">Failed to load conversion data. Please try again.</p>
        </div>
      )}
    </PageContainer>
  );
}
