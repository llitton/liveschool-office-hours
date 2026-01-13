import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { saveSlackConfig, testSlackWebhook } from '@/lib/slack';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { webhook_url, default_channel, notify_on_booking, daily_digest, post_session_summary } = body;

  if (!webhook_url) {
    return NextResponse.json(
      { error: 'webhook_url is required' },
      { status: 400 }
    );
  }

  // Validate webhook URL format
  if (!webhook_url.startsWith('https://hooks.slack.com/')) {
    return NextResponse.json(
      { error: 'Invalid Slack webhook URL format' },
      { status: 400 }
    );
  }

  // Test the webhook
  const isValid = await testSlackWebhook(webhook_url);
  if (!isValid) {
    return NextResponse.json(
      { error: 'Failed to verify Slack webhook. Please check the URL and try again.' },
      { status: 400 }
    );
  }

  // Save config
  const success = await saveSlackConfig({
    webhook_url,
    default_channel,
    notify_on_booking: notify_on_booking ?? true,
    daily_digest: daily_digest ?? true,
    post_session_summary: post_session_summary ?? true,
  });

  if (!success) {
    return NextResponse.json(
      { error: 'Failed to save Slack configuration' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
