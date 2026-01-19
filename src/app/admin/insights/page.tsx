'use client';

import { useState, useEffect } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { ExportButton } from '@/components/ExportButton';

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

function getHealthColor(attendanceRate: number | null): string {
  if (attendanceRate === null) return '#667085';
  if (attendanceRate >= 80) return '#10B981';
  if (attendanceRate >= 60) return '#F59E0B';
  return '#EF4444';
}

function getHealthLabel(attendanceRate: number | null): string {
  if (attendanceRate === null) return 'No data';
  if (attendanceRate >= 80) return 'Healthy';
  if (attendanceRate >= 60) return 'Needs attention';
  return 'Low';
}

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<TeamHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/team-health?period=${period}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Insights"
        description="Understand how your sessions are performing and where to improve."
        action={
          <div className="flex items-center gap-3">
            <ExportButton
              endpoint="/api/analytics/team-health/export"
              params={{ period }}
              filename={`team-health-${period}.csv`}
            />
            <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E0E0E0] p-1">
              {(['week', 'month', 'quarter', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    period === p
                      ? 'bg-[#101E57] text-white'
                      : 'text-[#667085] hover:text-[#101E57]'
                  }`}
                >
                  {p === 'all' ? 'All time' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        }
      />

        {loading ? (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E0E0E0] p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : data ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
                <p className="text-sm text-[#667085] mb-1">Total sessions</p>
                <p className="text-3xl font-bold text-[#101E57]">{data.summary.totalSessions}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
                <p className="text-sm text-[#667085] mb-1">Attendance rate</p>
                <p className="text-3xl font-bold" style={{ color: getHealthColor(data.summary.overallAttendanceRate) }}>
                  {data.summary.overallAttendanceRate !== null
                    ? `${Math.round(data.summary.overallAttendanceRate)}%`
                    : '—'}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
                <p className="text-sm text-[#667085] mb-1">Avg feedback rating</p>
                <p className="text-3xl font-bold text-[#101E57]">
                  {data.summary.overallAvgRating !== null
                    ? data.summary.overallAvgRating.toFixed(1)
                    : '—'}
                  {data.summary.overallAvgRating !== null && (
                    <span className="text-sm font-normal text-[#667085]">/5</span>
                  )}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
                <p className="text-sm text-[#667085] mb-1">Active hosts</p>
                <p className="text-3xl font-bold text-[#101E57]">
                  {data.summary.activeTeamMembers}
                  <span className="text-sm font-normal text-[#667085]">
                    /{data.summary.totalTeamMembers}
                  </span>
                </p>
              </div>
            </div>

            {/* Team performance */}
            <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E0E0E0]">
                <h2 className="text-lg font-semibold text-[#101E57]">Team performance</h2>
              </div>

              {data.members.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-[#101E57] mb-2">No session data yet</h3>
                  <p className="text-sm text-[#667085] max-w-xs mx-auto">
                    Run some sessions to see performance insights here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E0E0E0]">
                  {data.members.map((member) => (
                    <div key={member.id} className="px-6 py-4 hover:bg-[#FAFAFA] transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {member.profile_image ? (
                            <img
                              src={member.profile_image}
                              alt={member.name || member.email}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-full flex items-center justify-center text-[#6F71EE] font-semibold">
                              {(member.name || member.email)[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-[#101E57]">
                              {member.name || member.email.split('@')[0]}
                            </p>
                            <p className="text-sm text-[#667085]">{member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-sm text-[#667085]">Sessions</p>
                            <p className="font-semibold text-[#101E57]">{member.totalSessions}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-[#667085]">Attendance</p>
                            <p className="font-semibold" style={{ color: getHealthColor(member.attendanceRate) }}>
                              {member.attendanceRate !== null ? `${Math.round(member.attendanceRate)}%` : '—'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-[#667085]">Rating</p>
                            <p className="font-semibold text-[#101E57]">
                              {member.avgFeedbackRating !== null ? member.avgFeedbackRating.toFixed(1) : '—'}
                            </p>
                          </div>
                          <div className="w-24">
                            <p className="text-xs text-[#667085] mb-1">Status</p>
                            <span
                              className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${getHealthColor(member.attendanceRate)}15`,
                                color: getHealthColor(member.attendanceRate),
                              }}
                            >
                              {getHealthLabel(member.attendanceRate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-12 text-center">
            <p className="text-[#667085]">Failed to load insights. Please try again.</p>
          </div>
        )}
    </PageContainer>
  );
}
