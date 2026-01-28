import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { findOrCreateContact, createTask } from '@/lib/hubspot';

// POST - Create a task for a booking
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { booking_id, title, notes, due_date, priority } = body;

  if (!booking_id || !title) {
    return NextResponse.json(
      { error: 'booking_id and title are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get booking details
  const { data: booking, error: bookingError } = await supabase
    .from('oh_bookings')
    .select('*')
    .eq('id', booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Find or create HubSpot contact
  const contact = await findOrCreateContact(
    booking.email,
    booking.first_name,
    booking.last_name
  );

  if (!contact) {
    return NextResponse.json(
      { error: 'Failed to find or create HubSpot contact' },
      { status: 500 }
    );
  }

  // Create HubSpot task
  const hubspotTaskId = await createTask({
    subject: title,
    body: notes,
    dueDate: due_date ? new Date(due_date) : undefined,
    priority: priority || 'MEDIUM',
    contactId: contact.id,
  });

  if (!hubspotTaskId) {
    return NextResponse.json(
      { error: 'Failed to create HubSpot task' },
      { status: 500 }
    );
  }

  // Save quick task locally
  const { data: quickTask, error: taskError } = await supabase
    .from('oh_quick_tasks')
    .insert({
      booking_id,
      title,
      notes,
      due_date,
      hubspot_task_id: hubspotTaskId,
    })
    .select()
    .single();

  if (taskError) {
    console.error('Failed to save quick task locally:', taskError);
    // Don't fail - HubSpot task was created
  }

  // Update booking with HubSpot contact ID if not already set
  if (!booking.hubspot_contact_id) {
    await supabase
      .from('oh_bookings')
      .update({ hubspot_contact_id: contact.id })
      .eq('id', booking_id);
  }

  return NextResponse.json({
    success: true,
    hubspotTaskId,
    quickTask,
    contactId: contact.id,
  });
}
