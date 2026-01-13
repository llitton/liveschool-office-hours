'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { format, addMinutes, parseISO } from 'date-fns';
import type { OHEvent, OHSlot, OHBooking } from '@/types';

interface SlotWithBookings extends OHSlot {
  booking_count: number;
}

export default function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<OHEvent | null>(null);
  const [slots, setSlots] = useState<SlotWithBookings[]>([]);
  const [bookings, setBookings] = useState<Record<string, OHBooking[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New slot form
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('10:00');
  const [addingSlot, setAddingSlot] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [eventRes, slotsRes] = await Promise.all([
        fetch(`/api/events/${id}`),
        fetch(`/api/slots?eventId=${id}`),
      ]);

      if (!eventRes.ok) throw new Error('Event not found');

      const eventData = await eventRes.json();
      const slotsData = await slotsRes.json();

      setEvent(eventData);
      setSlots(slotsData);

      // Fetch bookings for each slot
      const bookingsData: Record<string, OHBooking[]> = {};
      for (const slot of slotsData) {
        const bookingsRes = await fetch(`/api/bookings?slotId=${slot.id}`);
        if (bookingsRes.ok) {
          bookingsData[slot.id] = await bookingsRes.json();
        }
      }
      setBookings(bookingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !newSlotDate || !newSlotTime) return;

    setAddingSlot(true);
    setError('');

    try {
      const startTime = new Date(`${newSlotDate}T${newSlotTime}:00`);
      const endTime = addMinutes(startTime, event.duration_minutes);

      const response = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add slot');
      }

      // Refresh data
      await fetchData();
      setNewSlotDate('');
      setNewSlotTime('10:00');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slot');
    } finally {
      setAddingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to cancel this time slot?')) return;

    try {
      const response = await fetch(`/api/slots/${slotId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel slot');
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel slot');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Event not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link href="/admin" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>
        )}

        {/* Event Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-gray-500 mt-1">
            {event.duration_minutes} min · {event.host_name} · Max {event.max_attendees} attendees
          </p>
          {event.description && (
            <p className="text-gray-600 mt-2">{event.description}</p>
          )}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Public booking link:{' '}
              <a
                href={`/book/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                /book/{event.slug}
              </a>
            </p>
          </div>
        </div>

        {/* Add New Slot */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Add New Time Slot</h2>
          <form onSubmit={handleAddSlot} className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={newSlotDate}
                onChange={(e) => setNewSlotDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <input
                type="time"
                required
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={addingSlot}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {addingSlot ? 'Adding...' : 'Add Slot'}
            </button>
          </form>
          <p className="text-sm text-gray-500 mt-2">
            Duration: {event.duration_minutes} minutes (ends automatically)
          </p>
        </div>

        {/* Existing Slots */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Upcoming Time Slots</h2>

          {slots.length === 0 ? (
            <p className="text-gray-500">No time slots scheduled yet.</p>
          ) : (
            <div className="space-y-4">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="border rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {format(parseISO(slot.start_time), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-gray-600">
                        {format(parseISO(slot.start_time), 'h:mm a')} -{' '}
                        {format(parseISO(slot.end_time), 'h:mm a')}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {slot.booking_count} / {event.max_attendees} booked
                      </p>
                      {slot.google_meet_link && (
                        <a
                          href={slot.google_meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Google Meet Link
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Cancel Slot
                    </button>
                  </div>

                  {/* Bookings for this slot */}
                  {bookings[slot.id] && bookings[slot.id].length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Attendees:
                      </p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {bookings[slot.id].map((booking) => (
                          <li key={booking.id}>
                            {booking.first_name} {booking.last_name} ({booking.email})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
