import { getServiceSupabase } from './supabase';
import { slackLogger } from './logger';

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
    slackLogger.debug('Not configured, skipping notification', { operation: 'sendSlackMessage' });
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Slack] Webhook error:', response.status, errorText);
    }

    return response.ok;
  } catch (error) {
    console.error('[Slack] Failed to send message:', error);
    return false;
  }
}

/**
 * Format relative time (e.g., "in 2 days", "tomorrow", "in 3 hours")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    if (diffHours <= 1) return 'in about an hour';
    return `in ${diffHours} hours`;
  } else if (diffDays === 1) {
    return 'tomorrow';
  } else if (diffDays < 7) {
    return `in ${diffDays} days`;
  } else if (diffDays < 14) {
    return 'next week';
  } else {
    return `in ${Math.floor(diffDays / 7)} weeks`;
  }
}

/**
 * Send booking notification to Slack
 */
export async function notifyNewBooking(booking: {
  id: string;
  attendee_name: string;
  attendee_email: string;
  question_responses?: Record<string, string> | null;
}, event: {
  name: string;
  slug: string;
  custom_questions?: Array<{ id: string; question: string }> | null;
  timezone?: string | null;
}, slot: {
  start_time: string;
  end_time: string;
  google_meet_link?: string;
}, enrichment?: {
  organization?: string | null;
  isFirstTime?: boolean;
  previousBookings?: number;
  hubspotContactId?: string | null;
}): Promise<boolean> {
  const config = await getSlackConfig();
  if (!config || !config.notify_on_booking) {
    return false;
  }

  // Use event timezone or default to Central
  const timezone = event.timezone || 'America/Chicago';

  const startDate = new Date(slot.start_time);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  });
  const formattedTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  // Get short timezone name (e.g., "CT" for Central)
  const tzAbbrev = startDate.toLocaleTimeString('en-US', {
    timeZoneName: 'short',
    timeZone: timezone,
  }).split(' ').pop() || '';

  const relativeTime = formatRelativeTime(startDate);

  // Build first-time/returning status
  let statusText = '';
  if (enrichment?.isFirstTime) {
    statusText = '✨ First session';
  } else if (enrichment?.previousBookings && enrichment.previousBookings > 0) {
    const suffix = enrichment.previousBookings === 1 ? 'session' : 'sessions';
    statusText = `🔄 ${enrichment.previousBookings} previous ${suffix}`;
  }

  // Build message with single-column layout to avoid email wrapping
  const message: SlackMessage = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📅 New Booking: ${event.name}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `👤 *${booking.attendee_name}*${statusText ? `  ${statusText}` : ''}\n${booking.attendee_email}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🕐 *${formattedDate} at ${formattedTime} ${tzAbbrev}* (${relativeTime})`,
        },
      },
    ],
  };

  // Add all question responses with their labels
  if (booking.question_responses && typeof booking.question_responses === 'object') {
    // Create a map of question IDs to their question text
    const questionLabels: Record<string, string> = {};
    if (event.custom_questions && Array.isArray(event.custom_questions)) {
      for (const q of event.custom_questions) {
        if (q && q.id && q.question) {
          questionLabels[q.id] = q.question;
        }
      }
    }

    // Add each question/response as a section
    for (const [questionId, response] of Object.entries(booking.question_responses)) {
      // Ensure response is a non-empty string
      if (response && typeof response === 'string' && response.trim()) {
        const label = questionLabels[questionId] || 'Response';
        message.blocks!.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💬 *${label}*\n>${response.replace(/\n/g, '\n>')}`,
          },
        });
      }
    }
  }

  // Add HubSpot link if available (Google Meet link omitted - host has it in calendar)
  if (enrichment?.hubspotContactId) {
    message.blocks!.push({
      type: 'divider',
    } as SlackBlock);

    const hubspotUrl = `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID || ''}/contact/${enrichment.hubspotContactId}`;
    message.blocks!.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${hubspotUrl}|View in HubSpot>`,
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
