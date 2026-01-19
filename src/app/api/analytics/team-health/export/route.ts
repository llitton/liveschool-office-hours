import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { subDays, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month';

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
    startDate = subDays(now, 30);
  }

  // Get all team members
  const { data: admins, error: adminsError } = await supabase
    .from('oh_admins')
    .select('id, name, email');

  if (adminsError) {
    return NextResponse.json({ error: adminsError.message }, { status: 500 });
  }

  // Get all bookings with their slots for the period
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

  bookings?.forEach((booking) => {
    const hostId = booking.assigned_host_id;
    if (!hostId || !memberMetrics[hostId]) return;

    const slot = booking.slot as unknown as { id: string; start_time: string } | null;
    if (!slot) return;

    memberMetrics[hostId].totalSessions.add(slot.id);

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

    if (booking.feedback_rating !== null && booking.feedback_rating !== undefined) {
      memberMetrics[hostId].feedbackSum += booking.feedback_rating;
      memberMetrics[hostId].feedbackCount++;
    }
  });

  // Calculate totals
  const totalSessionsAll = Object.values(memberMetrics).reduce(
    (sum, m) => sum + m.totalSessions.size,
    0
  );

  // Build member data
  const members = (admins || []).map((admin) => {
    const metrics = memberMetrics[admin.id];
    const sessionCount = metrics.totalSessions.size;

    return {
      name: admin.name || admin.email.split('@')[0],
      email: admin.email,
      sessions: sessionCount,
      attended: metrics.attendedCount,
      noShows: metrics.noShowCount,
      attendanceRate: metrics.trackedCount > 0
        ? Math.round((metrics.attendedCount / metrics.trackedCount) * 100)
        : null,
      avgRating: metrics.feedbackCount > 0
        ? Math.round((metrics.feedbackSum / metrics.feedbackCount) * 10) / 10
        : null,
      feedbackCount: metrics.feedbackCount,
      workload: totalSessionsAll > 0
        ? Math.round((sessionCount / totalSessionsAll) * 100)
        : 0,
    };
  });

  members.sort((a, b) => b.sessions - a.sessions);

  // Summary calculations
  const activeMembers = members.filter((m) => m.sessions > 0);
  const totalAttended = members.reduce((sum, m) => sum + m.attended, 0);
  const totalTracked = members.reduce((sum, m) => sum + m.attended + m.noShows, 0);
  const totalFeedbackSum = members.reduce((sum, m) => sum + (m.avgRating || 0) * m.feedbackCount, 0);
  const totalFeedbackCount = members.reduce((sum, m) => sum + m.feedbackCount, 0);

  // Build CSV
  const csvRows: string[][] = [];

  // Summary section
  csvRows.push(['SUMMARY']);
  csvRows.push(['Metric', 'Value']);
  csvRows.push(['Period', period === 'all' ? 'All Time' : period === 'week' ? 'Past 7 Days' : period === 'quarter' ? 'Past 90 Days' : 'Past 30 Days']);
  csvRows.push(['Date Range', `${format(startDate, 'yyyy-MM-dd')} to ${format(now, 'yyyy-MM-dd')}`]);
  csvRows.push(['Total Sessions', totalSessionsAll.toString()]);
  csvRows.push(['Total Team Members', (admins?.length || 0).toString()]);
  csvRows.push(['Active Team Members', activeMembers.length.toString()]);
  csvRows.push(['Overall Attendance Rate', totalTracked > 0 ? `${Math.round((totalAttended / totalTracked) * 100)}%` : 'N/A']);
  csvRows.push(['Overall Avg Rating', totalFeedbackCount > 0 ? (totalFeedbackSum / totalFeedbackCount).toFixed(1) : 'N/A']);
  csvRows.push([]);

  // Team members section
  csvRows.push(['TEAM MEMBERS']);
  csvRows.push(['Name', 'Email', 'Sessions', 'Attended', 'No-Shows', 'Attendance Rate', 'Avg Rating', 'Feedback Count', 'Workload %']);
  for (const member of members) {
    csvRows.push([
      member.name,
      member.email,
      member.sessions.toString(),
      member.attended.toString(),
      member.noShows.toString(),
      member.attendanceRate !== null ? `${member.attendanceRate}%` : 'N/A',
      member.avgRating !== null ? member.avgRating.toFixed(1) : 'N/A',
      member.feedbackCount.toString(),
      `${member.workload}%`,
    ]);
  }

  // Build CSV content
  const csvContent = csvRows
    .map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const filename = `team-health-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`;

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
