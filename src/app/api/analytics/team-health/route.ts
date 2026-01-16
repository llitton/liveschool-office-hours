import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { subDays, format } from 'date-fns';

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

// GET team health metrics
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month'; // week, month, quarter, all

  const supabase = getServiceSupabase();
  const now = new Date();

  // Calculate start date based on period
  let startDate: Date;
  if (period === 'week') {
    startDate = subDays(now, 7);
  } else if (period === 'quarter') {
    startDate = subDays(now, 90);
  } else if (period === 'all') {
    startDate = new Date('2020-01-01');
  } else {
    // Default to month
    startDate = subDays(now, 30);
  }

  // Get all team members
  const { data: admins, error: adminsError } = await supabase
    .from('oh_admins')
    .select('id, name, email, profile_image');

  if (adminsError) {
    return NextResponse.json({ error: adminsError.message }, { status: 500 });
  }

  // Get all bookings with their slots for the period
  // We need bookings where the slot's start_time is in our period
  const { data: bookings, error: bookingsError } = await supabase
    .from('oh_bookings')
    .select(`
      id,
      assigned_host_id,
      attended_at,
      no_show_at,
      cancelled_at,
      feedback_rating,
      slot:oh_slots!inner(
        id,
        start_time,
        is_cancelled
      )
    `)
    .gte('slot.start_time', startDate.toISOString())
    .lte('slot.start_time', now.toISOString())
    .eq('slot.is_cancelled', false)
    .is('cancelled_at', null);

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  // Aggregate metrics per team member
  const memberMetrics: Record<string, {
    totalSessions: Set<string>;
    attendedCount: number;
    noShowCount: number;
    trackedCount: number;
    feedbackSum: number;
    feedbackCount: number;
  }> = {};

  // Initialize metrics for all admins
  admins?.forEach((admin) => {
    memberMetrics[admin.id] = {
      totalSessions: new Set(),
      attendedCount: 0,
      noShowCount: 0,
      trackedCount: 0,
      feedbackSum: 0,
      feedbackCount: 0,
    };
  });

  // Process bookings
  bookings?.forEach((booking) => {
    const hostId = booking.assigned_host_id;
    if (!hostId || !memberMetrics[hostId]) return;

    // slot comes back as an object due to !inner join
    const slot = booking.slot as unknown as { id: string; start_time: string } | null;
    if (!slot) return;

    // Track unique sessions
    memberMetrics[hostId].totalSessions.add(slot.id);

    // Track attendance (only for past sessions)
    const slotTime = new Date(slot.start_time);
    if (slotTime < now) {
      if (booking.attended_at) {
        memberMetrics[hostId].attendedCount++;
        memberMetrics[hostId].trackedCount++;
      } else if (booking.no_show_at) {
        memberMetrics[hostId].noShowCount++;
        memberMetrics[hostId].trackedCount++;
      }
    }

    // Track feedback
    if (booking.feedback_rating !== null && booking.feedback_rating !== undefined) {
      memberMetrics[hostId].feedbackSum += booking.feedback_rating;
      memberMetrics[hostId].feedbackCount++;
    }
  });

  // Calculate totals for workload percentage
  const totalSessionsAll = Object.values(memberMetrics).reduce(
    (sum, m) => sum + m.totalSessions.size,
    0
  );

  // Build response
  const members: TeamMemberHealth[] = (admins || []).map((admin) => {
    const metrics = memberMetrics[admin.id];
    const sessionCount = metrics.totalSessions.size;

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      profile_image: admin.profile_image,
      totalSessions: sessionCount,
      attendedCount: metrics.attendedCount,
      noShowCount: metrics.noShowCount,
      trackedCount: metrics.trackedCount,
      attendanceRate: metrics.trackedCount > 0
        ? Math.round((metrics.attendedCount / metrics.trackedCount) * 100)
        : null,
      noShowRate: metrics.trackedCount > 0
        ? Math.round((metrics.noShowCount / metrics.trackedCount) * 100)
        : null,
      avgFeedbackRating: metrics.feedbackCount > 0
        ? Math.round((metrics.feedbackSum / metrics.feedbackCount) * 10) / 10
        : null,
      feedbackCount: metrics.feedbackCount,
      workloadPercentage: totalSessionsAll > 0
        ? Math.round((sessionCount / totalSessionsAll) * 100)
        : 0,
    };
  });

  // Sort by sessions (most active first)
  members.sort((a, b) => b.totalSessions - a.totalSessions);

  // Calculate summary metrics
  const activeMembers = members.filter((m) => m.totalSessions > 0);
  const totalAttended = members.reduce((sum, m) => sum + m.attendedCount, 0);
  const totalTracked = members.reduce((sum, m) => sum + m.trackedCount, 0);
  const totalFeedbackSum = members.reduce((sum, m) => sum + (m.avgFeedbackRating || 0) * m.feedbackCount, 0);
  const totalFeedbackCount = members.reduce((sum, m) => sum + m.feedbackCount, 0);

  const summary: TeamHealthSummary = {
    period,
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(now, 'yyyy-MM-dd'),
    totalSessions: totalSessionsAll,
    totalTeamMembers: admins?.length || 0,
    activeTeamMembers: activeMembers.length,
    overallAttendanceRate: totalTracked > 0
      ? Math.round((totalAttended / totalTracked) * 100)
      : null,
    overallAvgRating: totalFeedbackCount > 0
      ? Math.round((totalFeedbackSum / totalFeedbackCount) * 10) / 10
      : null,
    totalFeedbackCount,
  };

  return NextResponse.json({
    summary,
    members,
  });
}
