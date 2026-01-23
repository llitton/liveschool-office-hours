import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getUserFriendlyError, CommonErrors } from '@/lib/errors';

// POST submit votes (public - no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pollId } = await params;

  const body = await request.json();
  const {
    voter_name,
    voter_email,
    votes, // Array of { option_id: string, vote_type: 'yes' | 'maybe' }
  } = body;

  if (!voter_name || !voter_email) {
    return NextResponse.json(
      { error: 'Name and email are required' },
      { status: 400 }
    );
  }

  if (!votes || !Array.isArray(votes) || votes.length === 0) {
    return NextResponse.json(
      { error: 'At least one vote is required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  // Get poll and verify it's open
  const { data: poll, error: pollError } = await supabase
    .from('oh_polls')
    .select('id, status, max_votes_per_person')
    .eq('id', pollId)
    .single();

  if (pollError || !poll) {
    return NextResponse.json({ error: CommonErrors.NOT_FOUND }, { status: 404 });
  }

  if (poll.status !== 'open') {
    return NextResponse.json(
      { error: 'This poll is no longer accepting votes' },
      { status: 400 }
    );
  }

  // Check vote limit if set
  if (poll.max_votes_per_person && votes.length > poll.max_votes_per_person) {
    return NextResponse.json(
      { error: `Maximum ${poll.max_votes_per_person} votes allowed` },
      { status: 400 }
    );
  }

  // Check if user has already voted
  const { data: existingVotes } = await supabase
    .from('oh_poll_votes')
    .select('id')
    .eq('poll_id', pollId)
    .eq('voter_email', voter_email.toLowerCase());

  if (existingVotes && existingVotes.length > 0) {
    return NextResponse.json(
      { error: 'You have already submitted your votes for this poll' },
      { status: 400 }
    );
  }

  // Verify all option IDs belong to this poll
  const optionIds = votes.map((v: { option_id: string }) => v.option_id);
  const { data: validOptions } = await supabase
    .from('oh_poll_options')
    .select('id')
    .eq('poll_id', pollId)
    .in('id', optionIds);

  if (!validOptions || validOptions.length !== optionIds.length) {
    return NextResponse.json(
      { error: 'Invalid option IDs' },
      { status: 400 }
    );
  }

  // Insert votes
  const votesToInsert = votes.map((v: { option_id: string; vote_type?: 'yes' | 'maybe' }) => ({
    poll_id: pollId,
    option_id: v.option_id,
    voter_name,
    voter_email: voter_email.toLowerCase(),
    vote_type: v.vote_type || 'yes',
  }));

  const { error: insertError } = await supabase
    .from('oh_poll_votes')
    .insert(votesToInsert);

  if (insertError) {
    // Handle unique constraint violation
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'You have already voted for one of these options' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: getUserFriendlyError(insertError) }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Your votes have been recorded',
    votes_submitted: votes.length,
  });
}
