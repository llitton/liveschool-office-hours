import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardStats from './DashboardStats';
import TodaysSessions from '@/components/TodaysSessions';
import OnboardingWrapper from './OnboardingWrapper';
import { PageContainer } from '@/components/AppShell';
import EventsGrid from './EventsGrid';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const error = params.error;

  if (!session) {
    // Redirect to login page with any error params
    const loginUrl = error ? `/login?error=${error}` : '/login';
    redirect(loginUrl);
  }

  // Fetch events and admin data
  const supabase = getServiceSupabase();

  const [eventsResult, adminResult, analyticsResult] = await Promise.all([
    supabase
      .from('oh_events')
      .select(`
        *,
        slots:oh_slots(
          id,
          start_time,
          end_time,
          is_cancelled,
          bookings:oh_bookings(count)
        ),
        hosts:oh_event_hosts(
          admin_id,
          role,
          admin:oh_admins(name, email, profile_image)
        ),
        primary_host:oh_admins!host_id(name, email, profile_image)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('oh_admins')
      .select('id, google_access_token, onboarding_progress')
      .eq('email', session.email)
      .single(),
    // Aggregate booking analytics per event
    supabase
      .from('oh_bookings')
      .select('slot:oh_slots!inner(event_id), created_at')
      .is('cancelled_at', null)
  ]);

  const events = eventsResult.data;
  const admin = adminResult.data;
  const bookings = analyticsResult.data;

  // Compute analytics per event
  const eventAnalytics = new Map<string, { total: number; lastBooked: string | null }>();
  if (bookings) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookings.forEach((booking: any) => {
      // Supabase returns join as object when using !inner
      const eventId = booking.slot?.event_id;
      if (!eventId) return;

      const current = eventAnalytics.get(eventId) || { total: 0, lastBooked: null };
      current.total++;
      if (!current.lastBooked || booking.created_at > current.lastBooked) {
        current.lastBooked = booking.created_at;
      }
      eventAnalytics.set(eventId, current);
    });
  }

  // Enrich events with analytics
  const eventsWithAnalytics = events?.map((event) => {
    const analytics = eventAnalytics.get(event.id);
    return {
      ...event,
      total_bookings: analytics?.total ?? 0,
      last_booked_at: analytics?.lastBooked ?? null,
    };
  });

  // Determine onboarding status
  const hasGoogleConnected = !!admin?.google_access_token;
  const hasEvents = (events?.length || 0) > 0;
  const firstEventSlug = events?.[0]?.slug;

  return (
    <OnboardingWrapper
      adminId={admin?.id}
      initialState={admin?.onboarding_progress}
      hasGoogleConnected={hasGoogleConnected}
      hasEvents={hasEvents}
      firstEventSlug={firstEventSlug}
    >
      <PageContainer>
        <DashboardStats />
        <TodaysSessions />

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-[#101E57]">Events</h2>
          <Link
            href="/admin/events/new"
            className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
          >
            Create New Event
          </Link>
        </div>

        {!eventsWithAnalytics || eventsWithAnalytics.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">No events yet</h3>
            <p className="text-[#667085] mb-6 max-w-sm mx-auto">
              Create your first event to start accepting bookings from attendees.
            </p>
            <Link
              href="/admin/events/new"
              className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-6 py-3 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Event
            </Link>
          </div>
        ) : (
          <EventsGrid events={eventsWithAnalytics} />
        )}
      </PageContainer>
    </OnboardingWrapper>
  );
}
