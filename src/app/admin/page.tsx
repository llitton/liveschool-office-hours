import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import EventActions from './EventActions';
import DashboardStats from './DashboardStats';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const error = params.error;

  if (!session) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            alt="LiveSchool"
            width={180}
            height={48}
            className="mx-auto mb-6"
          />
          <h1 className="text-2xl font-semibold text-[#101E57] mb-2">Office Hours</h1>
          <p className="text-[#667085] mb-6">Admin Dashboard</p>

          {error === 'unauthorized' && (
            <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
              Your email is not authorized. Please contact an administrator.
            </div>
          )}

          {error === 'auth_failed' && (
            <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">
              Authentication failed. Please try again.
            </div>
          )}

          <a
            href="/api/auth/login"
            className="inline-flex items-center gap-2 bg-[#101E57] text-white px-6 py-3 rounded-lg hover:bg-[#1a2d6e] transition font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </a>
        </div>
      </div>
    );
  }

  // Fetch events
  const supabase = getServiceSupabase();
  const { data: events } = await supabase
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
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Image
              src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
              alt="LiveSchool"
              width={140}
              height={36}
            />
            <span className="text-[#667085] text-sm font-medium">Office Hours Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#667085] text-sm">{session.email}</span>
            <a
              href="/api/auth/logout"
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <DashboardStats />

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-[#101E57]">Office Hours Events</h2>
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
              Create your first office hours event to start accepting bookings from attendees.
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
                    <EventActions eventId={event.id} eventSlug={event.slug} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
