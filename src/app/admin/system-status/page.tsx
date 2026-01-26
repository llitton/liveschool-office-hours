'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StatusCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

interface SystemStatus {
  status: 'ok' | 'warning' | 'error';
  timestamp: string;
  checks: StatusCheck[];
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/system-status');
      if (!response.ok) {
        throw new Error('Failed to fetch system status');
      }
      const data = await response.json();
      setStatus(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  const getOverallStatusMessage = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return 'All systems operational';
      case 'warning':
        return 'Some services need attention';
      case 'error':
        return 'Critical issues detected';
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-semibold text-[#101E57]">System Status</h1>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD1] transition disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading && !status ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6F71EE]"></div>
          </div>
        ) : status ? (
          <>
            {/* Overall Status */}
            <div className={`mb-6 p-6 rounded-xl border-2 ${getStatusColor(status.status)}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                  {getStatusIcon(status.status)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {getOverallStatusMessage(status.status)}
                  </h2>
                  <p className="text-sm opacity-75">
                    Last checked: {lastRefresh?.toLocaleTimeString() || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>

            {/* Individual Checks */}
            <div className="space-y-4">
              {status.checks.map((check, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        check.status === 'ok' ? 'bg-green-100' :
                        check.status === 'warning' ? 'bg-amber-100' : 'bg-red-100'
                      }`}>
                        {getStatusIcon(check.status)}
                      </div>
                      <div>
                        <h3 className="font-medium text-[#101E57]">{check.name}</h3>
                        <p className="text-sm text-gray-600">{check.message}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      check.status === 'ok' ? 'bg-green-100 text-green-700' :
                      check.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {check.status.toUpperCase()}
                    </span>
                  </div>

                  {check.details && Object.keys(check.details).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                          View details
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-50 rounded-lg overflow-x-auto text-xs text-gray-700">
                          {JSON.stringify(check.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Links */}
            <div className="mt-8 p-4 bg-white rounded-xl border border-gray-200">
              <h3 className="font-medium text-[#101E57] mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin/settings/integrations"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition"
                >
                  Manage Integrations
                </Link>
                <Link
                  href="/admin/people"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition"
                >
                  Team Members
                </Link>
                <Link
                  href="/admin/events"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition"
                >
                  Events
                </Link>
                <Link
                  href="/admin/changelog"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition"
                >
                  Changelog
                </Link>
                <a
                  href="/api/admin/verify-migrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition"
                >
                  Verify Migrations
                </a>
              </div>
            </div>

            {/* Environment Info */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
              <p>App URL: {status.checks.find(c => c.name === 'Environment Variables')?.details?.appUrl as string || 'Unknown'}</p>
              <p>Status timestamp: {status.timestamp}</p>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
