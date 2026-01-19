'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { SMSLogTable } from '@/components/SMSLogTable';
import type { OHSMSLog, SMSUsageStats } from '@/types';

export default function SMSDashboardPage() {
  const [usage, setUsage] = useState<SMSUsageStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<OHSMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usageRes, logsRes] = await Promise.all([
        fetch(`/api/sms/usage?period=${period}`),
        fetch('/api/sms/logs?limit=5'),
      ]);

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setRecentLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch SMS data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="SMS Reminders"
        description="Monitor SMS delivery and usage"
        action={
          <Link
            href="/admin/integrations"
            className="px-4 py-2 text-sm font-medium text-[#6F71EE] bg-[#6F71EE]/10 rounded-lg hover:bg-[#6F71EE]/20 transition"
          >
            SMS Settings
          </Link>
        }
      />

      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {(['week', 'month', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
              period === p
                ? 'bg-[#6F71EE] text-white'
                : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
            }`}
          >
            {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-[#667085] mb-1">Messages Sent</p>
          <p className="text-2xl font-semibold text-[#101E57]">
            {loading ? '—' : usage?.totalSent || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-[#667085] mb-1">Delivered</p>
          <p className="text-2xl font-semibold text-green-600">
            {loading ? '—' : usage?.totalDelivered || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-[#667085] mb-1">Failed</p>
          <p className="text-2xl font-semibold text-red-600">
            {loading ? '—' : usage?.totalFailed || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-[#667085] mb-1">Delivery Rate</p>
          <p className="text-2xl font-semibold text-[#6F71EE]">
            {loading ? '—' : `${usage?.deliveryRate || 0}%`}
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Messages by Type */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-[#101E57] mb-4">By Message Type</h3>
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-8 bg-gray-200 rounded w-full" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ) : (
            <div className="space-y-3">
              {usage?.byType && Object.entries(usage.byType).map(([type, count]) => {
                const total = Object.values(usage.byType).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                const labels: Record<string, string> = {
                  reminder_24h: '24-Hour Reminders',
                  reminder_1h: '1-Hour Reminders',
                  test: 'Test Messages',
                  custom: 'Custom Messages',
                };

                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#667085]">{labels[type] || type}</span>
                      <span className="text-[#101E57] font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6F71EE] rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {(!usage?.byType || Object.values(usage.byType).every(v => v === 0)) && (
                <p className="text-sm text-[#667085] text-center py-4">No data yet</p>
              )}
            </div>
          )}
        </div>

        {/* Top Events */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-[#101E57] mb-4">Top Events by SMS Volume</h3>
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-gray-200 rounded w-full" />
              <div className="h-6 bg-gray-200 rounded w-full" />
              <div className="h-6 bg-gray-200 rounded w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {usage?.byEvent && usage.byEvent.length > 0 ? (
                usage.byEvent.slice(0, 5).map((event, i) => (
                  <div key={event.eventId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-[#F6F6F9] rounded-full flex items-center justify-center text-xs font-medium text-[#667085]">
                        {i + 1}
                      </span>
                      <span className="text-sm text-[#101E57]">{event.eventName}</span>
                    </div>
                    <span className="text-sm font-medium text-[#667085]">{event.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#667085] text-center py-4">No data yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent messages */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#101E57]">Recent Messages</h3>
          <Link
            href="/admin/sms/logs"
            className="text-sm text-[#6F71EE] hover:underline"
          >
            View all →
          </Link>
        </div>
        <SMSLogTable logs={recentLogs} loading={loading} />
      </div>
    </PageContainer>
  );
}
