import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { findOrCreateContact, createTask as createHubSpotTask } from '@/lib/hubspot';
import { getUserFriendlyError } from '@/lib/errors';

// Helper: verify the requesting admin hosts the event for this booking
async function verifyBookingAccess(supabase: ReturnType<typeof getServiceSupabase>, bookingId: string, sessionEmail: string): Promise<boolean> {
  const { data: booking } = await supabase
    .from('oh_bookings')
    .select('slot:oh_slots!slot_id(event_id)')
    .eq('id', bookingId)
    .single();

  if (!booking) return false;

  const slotData = booking.slot as { event_id?: string } | null;
  const eventId = slotData?.event_id;
  if (!eventId) return false;

  // Check if primary host
  const { data: primaryEvent } = await supabase
    .from('oh_events')
    .select('id')
    .eq('id', eventId)
    .eq('host_email', sessionEmail)
    .single();

  if (primaryEvent) return true;

  // Check if co-host
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', sessionEmail)
    .single();

  if (admin) {
    const { data: coHostEntry } = await supabase
      .from('oh_event_hosts')
      .select('id')
      .eq('event_id', eventId)
      .eq('admin_id', admin.id)
      .single();

    if (coHostEntry) return true;
  }

  return false;
}

// GET tasks for a booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const supabase = getServiceSupabase();

  // Verify the requesting admin hosts the event for this booking
  const hasAccess = await verifyBookingAccess(supabase, bookingId, session.email);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: tasks, error } = await supabase
    .from('oh_quick_tasks')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  return NextResponse.json(tasks);
}

// POST create a task for a booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const body = await request.json();
  const { title, notes, due_date, sync_to_hubspot = false } = body;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify the requesting admin hosts the event for this booking
  const hasPostAccess = await verifyBookingAccess(supabase, bookingId, session.email);
  if (!hasPostAccess) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Get booking details for HubSpot sync
  const { data: booking } = await supabase
    .from('oh_bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  let hubspotTaskId = null;

  // Optionally sync to HubSpot
  if (sync_to_hubspot) {
    try {
      // Find or create contact
      const contact = await findOrCreateContact(
        booking.email,
        booking.first_name,
        booking.last_name
      );

      if (contact) {
        hubspotTaskId = await createHubSpotTask({
          subject: title,
          body: notes,
          dueDate: due_date ? new Date(due_date) : undefined,
          contactId: contact.id,
        });

        // Update booking with contact ID if not set
        if (!booking.hubspot_contact_id) {
          await supabase
            .from('oh_bookings')
            .update({ hubspot_contact_id: contact.id })
            .eq('id', bookingId);
        }
      }
    } catch (err) {
      console.error('Failed to create HubSpot task:', err);
      // Continue - we'll still create the local task
    }
  }

  // Create local task
  const { data: task, error } = await supabase
    .from('oh_quick_tasks')
    .insert({
      booking_id: bookingId,
      title,
      notes,
      due_date,
      hubspot_task_id: hubspotTaskId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  return NextResponse.json(task);
}

// PATCH update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const body = await request.json();
  const { task_id, completed } = body;

  if (!task_id) {
    return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify the requesting admin hosts the event for this booking
  const hasPatchAccess = await verifyBookingAccess(supabase, bookingId, session.email);
  if (!hasPatchAccess) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (completed !== undefined) {
    updateData.completed_at = completed ? new Date().toISOString() : null;
  }

  const { data: task, error } = await supabase
    .from('oh_quick_tasks')
    .update(updateData)
    .eq('id', task_id)
    .eq('booking_id', bookingId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  return NextResponse.json(task);
}

// DELETE a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bookingId } = await params;
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify the requesting admin hosts the event for this booking
  const hasDeleteAccess = await verifyBookingAccess(supabase, bookingId, session.email);
  if (!hasDeleteAccess) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('oh_quick_tasks')
    .delete()
    .eq('id', taskId)
    .eq('booking_id', bookingId);

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
