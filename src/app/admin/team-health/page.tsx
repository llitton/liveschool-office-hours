'use client';

import { useState, useEffect } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';

interface TeamMemberHealth {
  id: string;
  name: string | null;
  email: string;
  profile_image: string | null;
  totalSessions: number;
  attendedCount: number;
  noShowCount: number;
  trackedCount: number;
  attendanceRate: number | null;
  noShowRate: number | null;
  avgFeedbackRating: number | null;
  feedbackCount: number;
  workloadPercentage: number;
}

interface TeamHealthSummary {
  period: string;
  startDate: string;
  endDate: string;
  totalSessions: number;
  totalTeamMembers: number;
  activeTeamMembers: number;
  overallAttendanceRate: number | null;
  overallAvgRating: number | null;
  totalFeedbackCount: number;
}

interface TeamHealthData {
  summary: TeamHealthSummary;
  members: TeamMemberHealth[];
}

type Period = 'week' | 'month' | 'quarter' | 'all';

// Health status color coding
function getHealthColor(attendanceRate: number | null): string {
  if (attendanceRate === null) return '#667085'; // Gray for no data
  if (attendanceRate >= 80) return '#417762'; // Green
  if (attendanceRate >= 60) return '#F4B03D'; // Amber
  return '#EF4444'; // Red
}

function getHealthLabel(attendanceRate: number | null): string {
  if (attendanceRate === null) return 'No data';
  if (attendanceRate >= 80) return 'Healthy';
  if (attendanceRate >= 60) return 'Needs attention';
  return 'Low';
}

export default function TeamHealthPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<TeamHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/analytics/team-health?period=${period}`);
      if (!response.ok) throw new Error('Failed to load team health data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Team Health"
        description="Monitor team performance and workload distribution"
        action={
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        }
      />

        {loading ? (
          <div className="text-center py-12 text-[#667085]">Loading team health data...</div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
        ) : !data || data.summary.totalSessions === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <SummaryCard
                label="Total Sessions"
                value={data.summary.totalSessions.toString()}
              />
              <SummaryCard
                label="Team Attendance"
                value={data.summary.overallAttendanceRate !== null ? `${data.summary.overallAttendanceRate}%` : '-'}
                color={getHealthColor(data.summary.overallAttendanceRate)}
              />
              <SummaryCard
                label="Avg Feedback"
                value={data.summary.overallAvgRating !== null ? `${data.summary.overallAvgRating} / 5` : '-'}
                subtitle={data.summary.totalFeedbackCount > 0 ? `${data.summary.totalFeedbackCount} ratings` : undefined}
              />
              <SummaryCard
                label="Active Hosts"
                value={`${data.summary.activeTeamMembers} / ${data.summary.totalTeamMembers}`}
              />
            </div>

            {/* Workload Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-[#101E57] mb-4">Workload Distribution</h2>
              <div className="space-y-3">
                {data.members.filter(m => m.totalSessions > 0).map((member) => (
                  <WorkloadBar key={member.id} member={member} />
                ))}
              </div>
              {data.members.filter(m => m.totalSessions > 0).length === 0 && (
                <p className="text-[#667085] text-sm">No sessions hosted in this period</p>
              )}
            </div>

            {/* Team Member Cards */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-[#101E57] mb-4">Team Members</h2>
              <div className="space-y-4">
                {data.members.map((member) => (
                  <TeamMemberCard key={member.id} member={member} />
                ))}
              </div>
            </div>
          </>
        )}
    </PageContainer>
  );
}

// Summary Card Component
function SummaryCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <p className="text-xs font-medium text-[#667085] uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-semibold" style={{ color: color || '#101E57' }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-[#667085] mt-1">{subtitle}</p>
      )}
    </div>
  );
}

// Workload Bar Component
function WorkloadBar({ member }: { member: TeamMemberHealth }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 flex items-center gap-2 flex-shrink-0">
        {member.profile_image ? (
          <img
            src={member.profile_image}
            alt={member.name || member.email}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] text-xs font-medium">
            {(member.name || member.email).charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm text-[#101E57] truncate">
          {member.name || member.email.split('@')[0]}
        </span>
      </div>
      <div className="flex-1 h-6 bg-[#F6F6F9] rounded overflow-hidden">
        <div
          className="h-full bg-[#6F71EE] rounded transition-all duration-300"
          style={{ width: `${member.workloadPercentage}%` }}
        />
      </div>
      <span className="w-12 text-sm text-[#667085] text-right">
        {member.workloadPercentage}%
      </span>
      <span className="w-20 text-xs text-[#667085] text-right">
        {member.totalSessions} session{member.totalSessions !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// Team Member Card Component
function TeamMemberCard({ member }: { member: TeamMemberHealth }) {
  const healthColor = getHealthColor(member.attendanceRate);
  const healthLabel = getHealthLabel(member.attendanceRate);

  return (
    <div className="flex items-center gap-4 p-4 bg-[#F6F6F9] rounded-lg">
      {/* Health indicator dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: healthColor }}
        title={healthLabel}
      />

      {/* Profile */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {member.profile_image ? (
          <img
            src={member.profile_image}
            alt={member.name || member.email}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] font-medium">
            {(member.name || member.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium text-[#101E57] truncate">
            {member.name || member.email.split('@')[0]}
          </p>
          <p className="text-sm text-[#667085] truncate">{member.email}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="text-center">
          <p className="text-lg font-semibold text-[#101E57]">{member.totalSessions}</p>
          <p className="text-xs text-[#667085]">Sessions</p>
        </div>
        <div className="text-center">
          <p
            className="text-lg font-semibold"
            style={{ color: healthColor }}
          >
            {member.attendanceRate !== null ? `${member.attendanceRate}%` : '-'}
          </p>
          <p className="text-xs text-[#667085]">Attendance</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-[#101E57]">
            {member.avgFeedbackRating !== null ? (
              <>
                {member.avgFeedbackRating}
                <span className="text-[#F4B03D] ml-0.5">&#9733;</span>
              </>
            ) : (
              '-'
            )}
          </p>
          <p className="text-xs text-[#667085]">
            {member.feedbackCount > 0 ? `${member.feedbackCount} reviews` : 'No reviews'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
      <div className="w-16 h-16 bg-[#6F71EE]/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-[#101E57] mb-2">No session data yet</h3>
      <p className="text-[#667085] max-w-md mx-auto mb-6">
        Team health metrics will appear here once your team starts hosting sessions and bookings are assigned to hosts.
      </p>
      <div className="bg-[#F6F6F9] rounded-lg p-4 max-w-md mx-auto text-left">
        <p className="text-sm font-medium text-[#101E57] mb-2">To see team metrics:</p>
        <ul className="text-sm text-[#667085] space-y-1">
          <li>1. Create events with multiple hosts or round-robin</li>
          <li>2. Attendees book sessions</li>
          <li>3. Mark attendance after sessions</li>
          <li>4. Collect feedback from attendees</li>
        </ul>
      </div>
    </div>
  );
}
