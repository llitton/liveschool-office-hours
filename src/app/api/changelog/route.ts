import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { changelog, getLatestChangelogDate, hasUnseenUpdates, getUnseenCount } from '@/lib/changelog';

// GET - Get changelog entries and status
export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get user's last seen timestamp
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('last_seen_changelog_at')
    .eq('email', session.email)
    .single();

  const lastSeenAt = admin?.last_seen_changelog_at ? new Date(admin.last_seen_changelog_at) : null;

  return NextResponse.json({
    entries: changelog,
    lastSeenAt: lastSeenAt?.toISOString() || null,
    hasUnseen: hasUnseenUpdates(lastSeenAt),
    unseenCount: getUnseenCount(lastSeenAt),
    latestDate: getLatestChangelogDate().toISOString(),
  });
}

// POST - Mark changelog as seen
export async function POST() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from('oh_admins')
    .update({ last_seen_changelog_at: new Date().toISOString() })
    .eq('email', session.email);

  if (error) {
    console.error('Failed to update changelog seen status:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
