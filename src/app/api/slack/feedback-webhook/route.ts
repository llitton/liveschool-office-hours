import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { feedback_webhook_url } = body;

  const supabase = getServiceSupabase();

  // Update the active Slack config with the feedback webhook
  const { error } = await supabase
    .from('oh_slack_config')
    .update({ feedback_webhook_url: feedback_webhook_url || null })
    .eq('is_active', true);

  if (error) {
    console.error('Failed to save feedback webhook:', error);
    return NextResponse.json({ error: 'Failed to save feedback webhook' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
