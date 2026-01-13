import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_events')
    .update({
      confirmation_subject: body.confirmation_subject,
      confirmation_body: body.confirmation_body,
      reminder_subject: body.reminder_subject,
      reminder_body: body.reminder_body,
      cancellation_subject: body.cancellation_subject,
      cancellation_body: body.cancellation_body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating templates:', error);
    return NextResponse.json(
      { error: 'Failed to update email templates' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
