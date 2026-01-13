import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET notes for an attendee
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: notes, error } = await supabase
    .from('oh_attendee_notes')
    .select('*')
    .eq('attendee_email', email.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(notes || []);
}

// POST create a new note
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { attendee_email, note } = body;

  if (!attendee_email || !note) {
    return NextResponse.json(
      { error: 'attendee_email and note are required' },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_attendee_notes')
    .insert({
      attendee_email: attendee_email.toLowerCase(),
      admin_email: session.email,
      note,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
