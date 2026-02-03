import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { getUserFriendlyError, CommonErrors, safeParseJSON } from '@/lib/errors';

// GET poll details with all votes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get admin
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Get poll with options and votes
  const { data: poll, error } = await supabase
    .from('oh_polls')
    .select(`
      *,
      options:oh_poll_options!poll_id(
        id,
        start_time,
        end_time,
        vote_count,
        sort_order,
        votes:oh_poll_votes!option_id(
          id,
          voter_name,
          voter_email,
          vote_type,
          created_at
        )
      ),
      invitees:oh_poll_invitees!poll_id(
        id,
        name,
        email,
        added_at
      )
    `)
    .eq('id', id)
    .eq('host_id', admin.id)
    .single();

  if (error || !poll) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Calculate unique participants
  const allVoterEmails = new Set<string>();
  poll.options?.forEach((opt: { votes?: { voter_email: string }[] }) => {
    opt.votes?.forEach((v) => allVoterEmails.add(v.voter_email));
  });

  return NextResponse.json({
    ...poll,
    total_participants: allVoterEmails.size,
    participants: Array.from(allVoterEmails),
  });
}

// PATCH update poll (close it)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const body = await safeParseJSON<{ action?: string }>(request);
  if (!body) {
    return NextResponse.json({ error: CommonErrors.VALIDATION_ERROR }, { status: 400 });
  }
  const { action } = body;

  const supabase = getServiceSupabase();

  // Get admin
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Verify ownership
  const { data: poll } = await supabase
    .from('oh_polls')
    .select('id, status, host_id')
    .eq('id', id)
    .single();

  if (!poll || poll.host_id !== admin.id) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  if (action === 'close') {
    if (poll.status !== 'open') {
      return NextResponse.json({ error: 'Poll is already closed' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('oh_polls')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
    }

    return NextResponse.json(updated);
  }

  if (action === 'reopen') {
    if (poll.status === 'booked') {
      return NextResponse.json({ error: 'Cannot reopen a booked poll' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('oh_polls')
      .update({
        status: 'open',
        closed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
    }

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// DELETE a poll
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: CommonErrors.UNAUTHORIZED }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get admin
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Verify ownership
  const { data: poll } = await supabase
    .from('oh_polls')
    .select('id, host_id')
    .eq('id', id)
    .eq('host_id', admin.id)
    .single();

  if (!poll) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  // Get option IDs for cascading vote deletion
  const { data: options } = await supabase
    .from('oh_poll_options')
    .select('id')
    .eq('poll_id', id);

  if (options && options.length > 0) {
    const optionIds = options.map((o) => o.id);
    await supabase.from('oh_poll_votes').delete().in('option_id', optionIds);
  }

  // Clean up related data
  await supabase.from('oh_poll_options').delete().eq('poll_id', id);
  await supabase.from('oh_poll_invitees').delete().eq('poll_id', id);

  // Delete the poll
  const { error } = await supabase
    .from('oh_polls')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
