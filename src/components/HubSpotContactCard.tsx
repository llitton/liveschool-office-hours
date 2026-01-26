'use client';

import { useState, useEffect } from 'react';
import type { HubSpotEnrichedContact } from '@/lib/hubspot';

interface SessionHistory {
  totalSessions: number;
  attendedCount: number;
  previousTopics: string[];
  firstSession: string | null;
  lastSession: string | null;
}

interface HubSpotContactData {
  connected: boolean;
  fromCache?: boolean;
  portalId?: string;
  hubspot: HubSpotEnrichedContact | null;
  sessionHistory: SessionHistory;
}

interface HubSpotContactCardProps {
  email: string;
  expanded?: boolean;
  onToggle?: () => void;
}

// Map deal stages to colors (customize based on your HubSpot pipeline)
const stageColors: Record<string, { bg: string; text: string; label: string }> = {
  appointmentscheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Appointment' },
  qualifiedtobuy: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Qualified' },
  presentationscheduled: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Presentation' },
  decisionmakerboughtin: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Decision Maker' },
  contractsent: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Contract Sent' },
  closedwon: { bg: 'bg-green-100', text: 'text-green-700', label: 'Customer' },
  closedlost: { bg: 'bg-red-100', text: 'text-red-700', label: 'Closed Lost' },
  // Default for unknown stages
  unknown: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Unknown' },
};

function getStageStyle(stage: string) {
  const normalized = stage.toLowerCase().replace(/[^a-z]/g, '');
  return stageColors[normalized] || stageColors.unknown;
}

export default function HubSpotContactCard({
  email,
  expanded = false,
  onToggle,
}: HubSpotContactCardProps) {
  const [data, setData] = useState<HubSpotContactData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expanded && !data && !loading) {
      fetchData();
    }
  }, [expanded, email]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/attendees/${encodeURIComponent(email)}/hubspot`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Collapsed view - just show a button
  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        className="text-[#6F71EE] hover:text-[#5a5cd0] text-xs flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Context
      </button>
    );
  }

  // Expanded view
  return (
    <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-xs font-semibold text-[#101E57] uppercase tracking-wide">
          Attendee Context
        </h4>
        <button
          onClick={onToggle}
          className="text-[#667085] hover:text-[#101E57] text-xs"
        >
          Hide
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[#667085]">
          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Loading...
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {data && !data.connected && (
        <p className="text-xs text-[#667085]">
          HubSpot not connected.{' '}
          <a href="/admin/integrations" className="text-[#6F71EE] hover:underline">
            Set up integration
          </a>
        </p>
      )}

      {data && data.connected && (
        <div className="space-y-3">
          {/* Role Badge & Company Info */}
          {data.hubspot && (
            <div className="space-y-2">
              {/* User Role Badge */}
              {data.hubspot.role && (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    data.hubspot.role.toLowerCase() === 'administrator'
                      ? 'bg-purple-100 text-purple-700'
                      : data.hubspot.role.toLowerCase() === 'site leader' || data.hubspot.role.toLowerCase() === 'site_leader'
                      ? 'bg-amber-100 text-amber-700'
                      : data.hubspot.role.toLowerCase() === 'teacher'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {data.hubspot.role.replace(/_/g, ' ')}
                  </span>
                </div>
              )}

              {data.hubspot.company && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-sm font-medium text-[#101E57]">
                    {data.hubspot.company.name}
                  </span>
                </div>
              )}

              {data.hubspot.deal && (
                <div className="flex items-center gap-2">
                  {/* Only show stage badge if we have a known stage name */}
                  {getStageStyle(data.hubspot.deal.stage).label !== 'Unknown' && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStageStyle(data.hubspot.deal.stage).bg} ${getStageStyle(data.hubspot.deal.stage).text}`}>
                      {getStageStyle(data.hubspot.deal.stage).label}
                    </span>
                  )}
                  {data.hubspot.deal.amount && (
                    <span className="text-xs text-[#667085]">
                      ARR ${data.hubspot.deal.amount.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {!data.hubspot.company && !data.hubspot.deal && (
                <p className="text-xs text-[#667085] italic">
                  No company or deal associated
                </p>
              )}
            </div>
          )}

          {/* Session History */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-[#667085]">Sessions: </span>
                <span className="font-medium text-[#101E57]">
                  {data.sessionHistory.attendedCount}/{data.sessionHistory.totalSessions}
                </span>
              </div>
              {data.hubspot?.meetingsCount !== undefined && data.hubspot.meetingsCount > 0 && (
                <div>
                  <span className="text-[#667085]">HubSpot meetings: </span>
                  <span className="font-medium text-[#101E57]">
                    {data.hubspot.meetingsCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Previous Topics */}
          {data.sessionHistory.previousTopics.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-[#667085] mb-1">Previous topics:</p>
              <div className="space-y-1">
                {data.sessionHistory.previousTopics.slice(0, 3).map((topic, i) => (
                  <p key={i} className="text-xs text-[#101E57] bg-[#F6F6F9] p-1.5 rounded line-clamp-2">
                    &quot;{topic}&quot;
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Quick link to HubSpot */}
          {data.hubspot?.id && data.portalId && (
            <div className="pt-2 border-t border-gray-100">
              <a
                href={`https://app.hubspot.com/contacts/${data.portalId}/record/0-1/${data.hubspot.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#6F71EE] hover:underline flex items-center gap-1"
              >
                View in HubSpot
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
