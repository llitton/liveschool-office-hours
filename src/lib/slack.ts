import { getServiceSupabase } from './supabase';

interface SlackConfig {
  webhook_url: string;
  default_channel: string | null;
  notify_on_booking: boolean;
  daily_digest: boolean;
  post_session_summary: boolean;
  is_active: boolean;
}

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: string;
    url?: string;
    action_id?: string;
  }>;
}

interface SlackAttachment {
  color?: string;
  fallback?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
}

/**
 * Get Slack configuration from database
 */
export async function getSlackConfig(): Promise<SlackConfig | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_slack_config')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Save Slack configuration
 */
export async function saveSlackConfig(config: Partial<SlackConfig>): Promise<boolean> {
  const supabase = getServiceSupabase();

  // Deactivate existing config
  await supabase
    .from('oh_slack_config')
    .update({ is_active: false })
    .eq('is_active', true);

  // Create new config
  const { error } = await supabase
    .from('oh_slack_config')
    .insert({
      webhook_url: config.webhook_url,
      default_channel: config.default_channel || null,
      notify_on_booking: config.notify_on_booking ?? true,
      daily_digest: config.daily_digest ?? true,
      post_session_summary: config.post_session_summary ?? true,
      is_active: true,
    });

  return !error;
}

/**
 * Send a message to Slack
 */
export async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  const config = await getSlackConfig();
  if (!config || !config.webhook_url) {
    console.log('Slack not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send Slack message:', error);
    return false;
  }
}

/**
 * Send booking notification to Slack
 */
export async function notifyNewBooking(booking: {
  id: string;
  attendee_name: string;
  attendee_email: string;
  response_text?: string;
}, event: {
  name: string;
  slug: string;
}, slot: {
  start_time: string;
  end_time: string;
  google_meet_link?: string;
}): Promise<boolean> {
  const config = await getSlackConfig();
  if (!config || !config.notify_on_booking) {
    return false;
  }

  const startDate = new Date(slot.start_time);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const message: SlackMessage = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'New Connect Booking',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Event:*\n${event.name}`,
          },
          {
            type: 'mrkdwn',
            text: `*When:*\n${formattedDate} at ${formattedTime}`,
          },
          {
            type: 'mrkdwn',
            text: `*Attendee:*\n${booking.attendee_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${booking.attendee_email}`,
          },
        ],
      },
    ],
  };

  if (booking.response_text) {
    message.blocks!.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Topic/Question:*\n>${booking.response_text.replace(/\n/g, '\n>')}`,
      },
    });
  }

  if (slot.google_meet_link) {
    message.blocks!.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${slot.google_meet_link}|Join Google Meet>`,
      },
    });
  }

  return sendSlackMessage(message);
}

/**
 * Send daily digest to Slack
 */
export async function sendDailyDigest(sessions: Array<{
  eventName: string;
  startTime: string;
  bookingCount: number;
  googleMeetLink?: string;
}>): Promise<boolean> {
  const config = await getSlackConfig();
  if (!config || !config.daily_digest) {
    return false;
  }

  if (sessions.length === 0) {
    return sendSlackMessage({
      text: 'No sessions scheduled for today.',
    });
  }

  const sessionBlocks: SlackBlock[] = sessions.map((session) => {
    const time = new Date(session.startTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${time}* - ${session.eventName} (${session.bookingCount} attendee${session.bookingCount !== 1 ? 's' : ''})${session.googleMeetLink ? ` | <${session.googleMeetLink}|Join>` : ''}`,
      },
    };
  });

  return sendSlackMessage({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Today's Connect (${sessions.length} session${sessions.length !== 1 ? 's' : ''})`,
          emoji: true,
        },
      },
      ...sessionBlocks,
    ],
  });
}

/**
 * Send post-session summary to Slack
 */
export async function sendSessionSummary(session: {
  eventName: string;
  startTime: string;
  attendedCount: number;
  noShowCount: number;
  topics: string[];
}): Promise<boolean> {
  const config = await getSlackConfig();
  if (!config || !config.post_session_summary) {
    return false;
  }

  const time = new Date(session.startTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const message: SlackMessage = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Connect Session Complete',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Session:*\n${session.eventName} at ${time}`,
          },
          {
            type: 'mrkdwn',
            text: `*Attendance:*\n${session.attendedCount} attended, ${session.noShowCount} no-shows`,
          },
        ],
      },
    ],
  };

  if (session.topics.length > 0) {
    message.blocks!.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Topics Discussed:*\n${session.topics.map((t) => `• ${t}`).join('\n')}`,
      },
    });
  }

  return sendSlackMessage(message);
}

/**
 * Test Slack webhook connection
 */
export async function testSlackWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test message from LiveSchool Connect - your Slack integration is working!',
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
