'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { SMSLogTable } from '@/components/SMSLogTable';
import type { OHSMSLog, OHEvent } from '@/types';

interface LogsResponse {
  logs: OHSMSLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    sent: number;
    delivered: number;
    failed: number;
  };
}

export default function SMSLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<OHEvent[]>([]);

  // Filters
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');
  const [eventId, setEventId] = useState<string>('');
  const [messageType, setMessageType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, status, eventId, messageType, search]);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const eventsData = await res.json();
        setEvents(eventsData);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '25');
      if (status) params.set('status', status);
      if (eventId) params.set('event_id', eventId);
      if (messageType) params.set('type', messageType);
      if (search) params.set('search', search);

      const res = await fetch(`/api/sms/logs?${params.toString()}`);
      if (res.ok) {
        const logsData = await res.json();
        setData(logsData);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setStatus('');
    setEventId('');
    setMessageType('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const hasFilters = status || eventId || messageType || search;

  return (
    <PageContainer>
      <PageHeader
        title="SMS Logs"
        description="View all SMS messages sent"
        action={
          <Link
            href="/admin/sms"
            className="px-4 py-2 text-sm font-medium text-[#667085] hover:text-[#101E57]"
          >
            ← Back to Dashboard
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-[#667085]">Sent</p>
          <p className="text-xl font-semibold text-blue-600">{data?.summary.sent || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-[#667085]">Delivered</p>
          <p className="text-xl font-semibold text-green-600">{data?.summary.delivered || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-[#667085]">Failed</p>
          <p className="text-xl font-semibold text-red-600">{data?.summary.failed || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-[#667085] mb-1">Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Phone number or name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE]"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Status filter */}
          <div>
            <label className="block text-xs font-medium text-[#667085] mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE]"
            >
              <option value="">All</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Event filter */}
          <div>
            <label className="block text-xs font-medium text-[#667085] mb-1">Event</label>
            <select
              value={eventId}
              onChange={(e) => { setEventId(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] max-w-[200px]"
            >
              <option value="">All Events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-xs font-medium text-[#667085] mb-1">Type</label>
            <select
              value={messageType}
              onChange={(e) => { setMessageType(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE]"
            >
              <option value="">All Types</option>
              <option value="reminder_24h">24h Reminder</option>
              <option value="reminder_1h">1h Reminder</option>
              <option value="test">Test</option>
            </select>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-[#667085] hover:text-[#101E57]"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Logs table */}
      <SMSLogTable logs={data?.logs || []} loading={loading} />

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#667085]">
            Showing {((page - 1) * 25) + 1} to {Math.min(page * 25, data.pagination.total)} of {data.pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= data.pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
