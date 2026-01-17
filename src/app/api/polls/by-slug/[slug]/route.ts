import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// GET poll details by slug (public - no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = getServiceSupabase();

  // Get poll with options and host info
  const { data: poll, error } = await supabase
    .from('oh_polls')
    .select(`
      id,
      slug,
      title,
      description,
      duration_minutes,
      location,
      show_votes,
      max_votes_per_person,
      status,
      created_at,
      host:oh_admins!host_id(
        name,
        email,
        profile_image
      ),
      options:oh_poll_options(
        id,
        start_time,
        end_time,
        vote_count,
        sort_order
      )
    `)
    .eq('slug', slug)
    .single();

  if (error || !poll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
  }

  // If show_votes is enabled, include voter info
  let options = poll.options;
  if (poll.show_votes && poll.status !== 'booked') {
    const { data: optionsWithVotes } = await supabase
      .from('oh_poll_options')
      .select(`
        id,
        start_time,
        end_time,
        vote_count,
        sort_order,
        votes:oh_poll_votes(
          voter_name,
          vote_type
        )
      `)
      .eq('poll_id', poll.id)
      .order('sort_order', { ascending: true });

    options = optionsWithVotes || poll.options;
  }

  // Calculate total unique participants
  const { data: voters } = await supabase
    .from('oh_poll_votes')
    .select('voter_email')
    .eq('poll_id', poll.id);

  const uniqueVoters = new Set(voters?.map((v) => v.voter_email) || []);

  return NextResponse.json({
    ...poll,
    options: options?.sort((a: { sort_order: number }, b: { sort_order: number }) =>
      a.sort_order - b.sort_order
    ),
    total_participants: uniqueVoters.size,
  });
}
