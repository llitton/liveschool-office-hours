import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { nanoid } from 'nanoid';
import { getUserFriendlyError, safeParseJSON } from '@/lib/errors';

// GET list polls for the current user
export async function GET() {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get admin ID
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Get polls with options and vote counts
  const { data: polls, error } = await supabase
    .from('oh_polls')
    .select(`
      *,
      options:oh_poll_options!poll_id(
        id,
        start_time,
        end_time,
        vote_count,
        sort_order
      )
    `)
    .eq('host_id', admin.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: getUserFriendlyError(error) }, { status: 500 });
  }

  // Calculate total participants for each poll
  const enrichedPolls = await Promise.all(
    (polls || []).map(async (poll) => {
      const { count } = await supabase
        .from('oh_poll_votes')
        .select('voter_email', { count: 'exact', head: true })
        .eq('poll_id', poll.id);

      // Get unique voter count
      const { data: voters } = await supabase
        .from('oh_poll_votes')
        .select('voter_email')
        .eq('poll_id', poll.id);

      const uniqueVoters = new Set(voters?.map((v) => v.voter_email) || []);

      return {
        ...poll,
        total_participants: uniqueVoters.size,
      };
    })
  );

  return NextResponse.json(enrichedPolls);
}

// POST create a new poll
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await safeParseJSON<Record<string, any>>(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const {
    title,
    description,
    duration_minutes = 30,
    location = 'Google Meet',
    time_options, // Array of { start: ISO string, end: ISO string }
    show_votes = false,
    max_votes_per_person,
  } = body;

  if (!title) {
    return NextResponse.json({ error: 'Poll title is required' }, { status: 400 });
  }

  if (!time_options || time_options.length === 0) {
    return NextResponse.json({ error: 'At least one time option is required' }, { status: 400 });
  }

  if (time_options.length > 40) {
    return NextResponse.json({ error: 'Maximum 40 time options allowed' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get admin
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Generate unique slug
  const slug = `poll-${nanoid(10)}`;

  // Create the poll
  const { data: poll, error: pollError } = await supabase
    .from('oh_polls')
    .insert({
      slug,
      title,
      description: description || null,
      host_id: admin.id,
      duration_minutes,
      location,
      show_votes,
      max_votes_per_person: max_votes_per_person || null,
      status: 'open',
    })
    .select()
    .single();

  if (pollError) {
    return NextResponse.json({ error: getUserFriendlyError(pollError) }, { status: 500 });
  }

  // Validate time options
  for (const opt of time_options) {
    if (!opt.start || !opt.end) {
      return NextResponse.json({ error: 'Each time option must have start and end' }, { status: 400 });
    }
    if (new Date(opt.start) >= new Date(opt.end)) {
      return NextResponse.json({ error: 'Time option start must be before end' }, { status: 400 });
    }
  }

  // Create options
  const optionsToInsert = time_options.map((opt: { start: string; end: string }, index: number) => ({
    poll_id: poll.id,
    start_time: opt.start,
    end_time: opt.end,
    sort_order: index,
  }));

  const { data: options, error: optionsError } = await supabase
    .from('oh_poll_options')
    .insert(optionsToInsert)
    .select();

  if (optionsError) {
    // Clean up poll if options failed
    await supabase.from('oh_polls').delete().eq('id', poll.id);
    return NextResponse.json({ error: getUserFriendlyError(optionsError) }, { status: 500 });
  }

  const pollUrl = `${process.env.NEXT_PUBLIC_APP_URL}/vote/${slug}`;

  return NextResponse.json({
    ...poll,
    options,
    poll_url: pollUrl,
  });
}
