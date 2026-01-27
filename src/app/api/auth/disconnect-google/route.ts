import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

// POST disconnect Google account (clears tokens, keeps account)
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Clear Google tokens for the current user
  const { error } = await supabase
    .from('oh_admins')
    .update({
      google_access_token: null,
      google_refresh_token: null,
    })
    .eq('email', session.email);

  if (error) {
    console.error('[Auth] Failed to disconnect Google:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google account' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Google account disconnected. You will need to reconnect to use calendar features.',
  });
}
