import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import EventActions from './EventActions';
import DashboardStats from './DashboardStats';
import TodaysSessions from '@/components/TodaysSessions';
import OnboardingWrapper from './OnboardingWrapper';
import { PageContainer } from '@/components/AppShell';

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

  const [eventsResult, adminResult] = await Promise.all([
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
        )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('oh_admins')
      .select('id, google_access_token, onboarding_progress')
      .eq('email', session.email)
      .single()
  ]);

  const events = eventsResult.data;
  const admin = adminResult.data;

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

        {!events || events.length === 0 ? (
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
          <div className="grid gap-4">
            {events.map((event) => {
              const activeSlots = event.slots?.filter(
                (s: { is_cancelled: boolean; start_time: string }) =>
                  !s.is_cancelled && new Date(s.start_time) > new Date()
              ) || [];
              const totalBookings = activeSlots.reduce(
                (sum: number, s: { bookings: { count: number }[] }) =>
                  sum + (s.bookings?.[0]?.count || 0),
                0
              );
              const totalCapacity = activeSlots.length * event.max_attendees;
              const capacityPercent = totalCapacity > 0 ? Math.round((totalBookings / totalCapacity) * 100) : 0;

              // Determine status
              let status: { label: string; color: string; bg: string };
              if (activeSlots.length === 0) {
                status = { label: 'No slots', color: 'text-amber-700', bg: 'bg-amber-100' };
              } else if (capacityPercent >= 100) {
                status = { label: 'Fully booked', color: 'text-red-700', bg: 'bg-red-100' };
              } else if (capacityPercent >= 80) {
                status = { label: 'Almost full', color: 'text-amber-700', bg: 'bg-amber-100' };
              } else {
                status = { label: 'Active', color: 'text-[#417762]', bg: 'bg-[#417762]/10' };
              }

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:border-[#6F71EE]/30 transition group"
                >
                  <Link href={`/admin/events/${event.id}`} className="block p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-[#101E57] group-hover:text-[#6F71EE] transition">
                            {event.name}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-[#667085] text-sm">
                          {event.duration_minutes} min · {event.host_name}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-[#667085] group-hover:text-[#6F71EE] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                    {/* Capacity bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#667085]">
                          {totalBookings} booked across {activeSlots.length} slot{activeSlots.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[#101E57] font-medium">
                          {totalCapacity > 0 ? `${capacityPercent}% full` : 'No capacity'}
                        </span>
                      </div>
                      <div className="h-2 bg-[#F6F6F9] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            capacityPercent >= 100 ? 'bg-red-500' :
                            capacityPercent >= 80 ? 'bg-amber-500' :
                            capacityPercent > 0 ? 'bg-[#6F71EE]' : 'bg-gray-200'
                          }`}
                          style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </Link>

                  {/* Quick actions bar */}
                  <div className="px-6 py-3 bg-[#F6F6F9] border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-[#667085]">/{event.slug}</span>
                    <EventActions eventId={event.id} eventSlug={event.slug} eventName={event.name} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>
    </OnboardingWrapper>
  );
}
