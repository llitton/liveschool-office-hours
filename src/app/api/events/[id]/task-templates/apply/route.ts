import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { addHours } from 'date-fns';
import { findOrCreateContact, createTask as createHubSpotTask } from '@/lib/hubspot';

// POST apply task templates to a booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const body = await request.json();
  const { booking_id, template_ids, slot_end_time } = body;

  if (!booking_id) {
    return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get the templates to apply
  let query = supabase
    .from('oh_task_templates')
    .select('*')
    .eq('event_id', eventId);

  // If specific templates provided, filter to those
  if (template_ids && template_ids.length > 0) {
    query = query.in('id', template_ids);
  }

  const { data: templates, error: templateError } = await query;

  if (templateError) {
    return NextResponse.json({ error: templateError.message }, { status: 500 });
  }

  if (!templates || templates.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  // Check if any templates need HubSpot sync
  const needsHubSpot = templates.some((t) => t.sync_to_hubspot);
  let hubspotContact: { id: string } | null = null;

  // Get booking details if we need HubSpot sync
  if (needsHubSpot) {
    const { data: booking } = await supabase
      .from('oh_bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (booking) {
      try {
        const firstName = booking.first_name || '';
        const lastName = booking.last_name || '';
        hubspotContact = await findOrCreateContact(booking.email, firstName, lastName);

        // Update booking with contact ID if not set
        if (hubspotContact && !booking.hubspot_contact_id) {
          await supabase
            .from('oh_bookings')
            .update({ hubspot_contact_id: hubspotContact.id })
            .eq('id', booking_id);
        }
      } catch (err) {
        console.error('Failed to find/create HubSpot contact:', err);
      }
    }
  }

  // Create tasks from templates
  const tasksToCreate = [];
  const hubspotTaskPromises: Promise<{ templateId: string; hubspotTaskId: string | null }>[] = [];

  for (const template of templates) {
    let due_date = null;

    // Calculate due date if offset is set
    if (template.default_due_offset_hours !== null && slot_end_time) {
      const baseTime = new Date(slot_end_time);
      due_date = addHours(baseTime, template.default_due_offset_hours).toISOString();
    }

    // Create HubSpot task if sync is enabled and we have a contact
    if (template.sync_to_hubspot && hubspotContact) {
      hubspotTaskPromises.push(
        createHubSpotTask({
          subject: template.title,
          body: template.description || undefined,
          dueDate: due_date ? new Date(due_date) : undefined,
          contactId: hubspotContact.id,
        })
          .then((taskId) => ({ templateId: template.id, hubspotTaskId: taskId }))
          .catch((err) => {
            console.error('Failed to create HubSpot task:', err);
            return { templateId: template.id, hubspotTaskId: null };
          })
      );
    }

    tasksToCreate.push({
      booking_id,
      title: template.title,
      notes: template.description,
      due_date,
      template_id: template.id,
    });
  }

  // Wait for HubSpot tasks to be created
  const hubspotResults = await Promise.all(hubspotTaskPromises);
  const hubspotTaskMap = new Map(
    hubspotResults.map((r) => [r.templateId, r.hubspotTaskId])
  );

  // Add HubSpot task IDs to local tasks
  const tasksWithHubSpot = tasksToCreate.map((task) => ({
    ...task,
    hubspot_task_id: hubspotTaskMap.get(task.template_id) || null,
  }));

  const { data: tasks, error: insertError } = await supabase
    .from('oh_quick_tasks')
    .insert(tasksWithHubSpot)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ tasks });
}
