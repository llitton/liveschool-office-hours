import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { addHours } from 'date-fns';

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

  // Create tasks from templates
  const tasksToCreate = templates.map((template) => {
    let due_date = null;

    // Calculate due date if offset is set
    if (template.default_due_offset_hours !== null && slot_end_time) {
      const baseTime = new Date(slot_end_time);
      due_date = addHours(baseTime, template.default_due_offset_hours).toISOString();
    }

    return {
      booking_id,
      title: template.title,
      notes: template.description,
      due_date,
      template_id: template.id,
    };
  });

  const { data: tasks, error: insertError } = await supabase
    .from('oh_quick_tasks')
    .insert(tasksToCreate)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ tasks });
}
