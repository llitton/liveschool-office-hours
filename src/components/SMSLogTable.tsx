'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { OHSMSLog } from '@/types';

interface SMSLogTableProps {
  logs: OHSMSLog[];
  loading?: boolean;
}

const statusStyles: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const statusIcons: Record<string, string> = {
  sent: '→',
  delivered: '✓',
  failed: '✕',
};

const typeLabels: Record<string, string> = {
  reminder_24h: '24h Reminder',
  reminder_1h: '1h Reminder',
  test: 'Test',
  custom: 'Custom',
};

export function SMSLogTable({ logs, loading = false }: SMSLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="animate-pulse p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <p className="text-[#101E57] font-medium mb-1">No SMS messages yet</p>
        <p className="text-sm text-[#667085]">
          SMS logs will appear here once reminders are sent.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F6F6F9] border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                Recipient
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                Event
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                Sent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                Message
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log) => (
              <tr
                key={log.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#101E57]">
                      {log.recipient_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-[#667085]">{log.recipient_phone}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-[#101E57]">
                    {log.event?.name || '—'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-[#667085]">
                    {typeLabels[log.message_type] || log.message_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[log.status]}`}>
                    <span>{statusIcons[log.status]}</span>
                    {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-[#667085]">
                    {log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mm a') : '—'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-[#667085] truncate max-w-[200px]">
                    {log.message_body}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded message view */}
      {expandedId && (
        <div className="border-t border-gray-200 bg-[#F6F6F9] p-4">
          {(() => {
            const log = logs.find((l) => l.id === expandedId);
            if (!log) return null;

            return (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-[#667085] mb-1">Full Message</p>
                  <p className="text-sm text-[#101E57] bg-white p-3 rounded-lg border border-gray-200">
                    {log.message_body}
                  </p>
                </div>
                <div className="flex gap-6 text-xs text-[#667085]">
                  <div>
                    <span className="font-medium">Characters:</span> {log.character_count}
                  </div>
                  <div>
                    <span className="font-medium">Segments:</span> {log.segment_count}
                  </div>
                  <div>
                    <span className="font-medium">Provider:</span> {log.provider}
                  </div>
                  {log.error_message && (
                    <div className="text-red-600">
                      <span className="font-medium">Error:</span> {log.error_message}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
