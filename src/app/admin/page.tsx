import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">LiveSchool Office Hours</h1>
          <p className="text-gray-600 mb-6">Admin Dashboard</p>

          {error === 'unauthorized' && (
            <div className="bg-red-50 text-red-700 p-4 rounded mb-4">
              Your email is not authorized. Please contact an administrator.
            </div>
          )}

          {error === 'auth_failed' && (
            <div className="bg-red-50 text-red-700 p-4 rounded mb-4">
              Authentication failed. Please try again.
            </div>
          )}

          <a
            href="/api/auth/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">LiveSchool Office Hours - Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{session.email}</span>
            <a
              href="/api/auth/logout"
              className="text-red-600 hover:text-red-700"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Office Hours Events</h2>
          <Link
            href="/admin/events/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Create New Event
          </Link>
        </div>

        {!events || events.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No events yet.</p>
            <Link
              href="/admin/events/new"
              className="text-blue-600 hover:underline"
            >
              Create your first office hours event
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
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

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold">{event.name}</h3>
                      <p className="text-gray-500 text-sm">
                        /{event.slug} · {event.duration_minutes} min ·{' '}
                        {event.host_name}
                      </p>
                      {event.description && (
                        <p className="text-gray-600 mt-2 text-sm">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Manage
                      </Link>
                      <a
                        href={`/book/${event.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 text-sm"
                      >
                        View Public Page
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t flex gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">Upcoming slots:</span>{' '}
                      <strong>{activeSlots.length}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Total bookings:</span>{' '}
                      <strong>{totalBookings}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Max per slot:</span>{' '}
                      <strong>{event.max_attendees}</strong>
                    </div>
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
