import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { createTask, getContactWithCompany } from '@/lib/hubspot';
import { parseISO } from 'date-fns';

// POST schedule a follow-up for an attendee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const body = await request.json();
  const { title, notes, dueDate, syncToHubspot } = body;

  if (!title) {
    return NextResponse.json(
      { error: 'title is required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get the booking with attendee info
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select(`
      id,
      email,
      first_name,
      last_name,
      slot:oh_slots(
        event_id,
        event:oh_events(
          name,
          host_email
        )
      )
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Handle nested event type - Supabase may return array or object
  const slotRaw = booking.slot as unknown;
  const slotData = Array.isArray(slotRaw) ? slotRaw[0] : slotRaw;
  const slot = slotData as {
    event_id: string;
    event?: { name: string; host_email: string }[] | { name: string; host_email: string };
  } | null;
  const eventRaw = slot?.event;
  const event = Array.isArray(eventRaw) ? eventRaw[0] : eventRaw;

  // Create internal task
  const parsedDueDate = dueDate ? parseISO(dueDate) : null;

  const { data: task, error: taskError } = await supabase
    .from('oh_quick_tasks')
    .insert({
      booking_id: bookingId,
      title,
      notes: notes || null,
      due_date: parsedDueDate?.toISOString() || null,
      created_by: session.email,
    })
    .select()
    .single();

  if (taskError) {
    console.error('Failed to create task:', taskError);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }

  // Sync to HubSpot if requested
  let hubspotTaskId: string | null = null;
  if (syncToHubspot) {
    try {
      // Get HubSpot contact ID
      const contact = await getContactWithCompany(booking.email);
      if (contact?.id) {
        hubspotTaskId = await createTask({
          subject: title,
          body: notes || `Follow-up for ${booking.first_name} ${booking.last_name} from ${event?.name || 'Session'}`,
          contactId: contact.id,
          dueDate: parsedDueDate || undefined,
          priority: 'MEDIUM',
        });

        // Update the internal task with HubSpot ID
        if (hubspotTaskId) {
          await supabase
            .from('oh_quick_tasks')
            .update({ hubspot_task_id: hubspotTaskId })
            .eq('id', task.id);
        }
      }
    } catch (err) {
      console.error('Failed to create HubSpot task:', err);
      // Don't fail the whole request, just log the error
    }
  }

  return NextResponse.json({
    success: true,
    task: {
      ...task,
      hubspot_task_id: hubspotTaskId,
    },
  });
}
