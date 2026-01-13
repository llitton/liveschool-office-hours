import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSlackConfig, sendSlackMessage } from '@/lib/slack';

export async function POST() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getSlackConfig();
  if (!config || !config.webhook_url) {
    return NextResponse.json(
      { error: 'Slack not configured' },
      { status: 400 }
    );
  }

  const success = await sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'LiveSchool Office Hours',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Your Slack integration is working! You\'ll receive notifications here when someone books an office hours session.',
        },
      },
    ],
  });

  if (success) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json(
      { error: 'Failed to send test message' },
      { status: 500 }
    );
  }
}
