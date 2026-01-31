import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSlackConfig } from '@/lib/slack';

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getSlackConfig();

  if (!config) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    webhookConfigured: !!config.webhook_url,
    webhook_url: config.webhook_url ? '***configured***' : null,
    default_channel: config.default_channel,
    notify_on_booking: config.notify_on_booking,
    daily_digest: config.daily_digest,
    post_session_summary: config.post_session_summary,
    feedback_webhook_url: config.feedback_webhook_url ? '***configured***' : null,
  });
}
