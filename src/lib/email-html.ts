/**
 * Modern, accessible HTML email templates
 *
 * Design principles:
 * - Mobile-first with 44px minimum touch targets
 * - Critical info (date, time, join link) prominently displayed
 * - Visual hierarchy through color and spacing
 * - Inline styles for email client compatibility
 * - Unicode emoji instead of images (more reliable across email clients)
 */

interface ConfirmationEmailData {
  firstName: string;
  eventName: string;
  hostName: string;
  date: string; // e.g., "Thursday, January 23, 2025"
  time: string; // e.g., "3:00 PM"
  timezoneAbbr: string; // e.g., "ET"
  timezone: string; // e.g., "Eastern Time"
  meetLink: string | null;
  manageUrl: string;
  googleCalUrl: string;
  outlookUrl: string;
  icalUrl: string;
  eventDescription?: string | null;
  prepMaterials?: string | null;
  userTopic?: string | null;
  prepResources?: Array<{ title: string; content: string; link?: string }>;
  schoolName?: string;
  customBodyHtml?: string;
}

// Brand colors
const COLORS = {
  purple: '#6F71EE',
  purpleHover: '#5a5cd0',
  navy: '#101E57',
  gray: '#667085',
  lightGray: '#F6F6F9',
  border: '#E5E7EB',
  green: '#417762',
  white: '#FFFFFF',
};

export function generateConfirmationEmailHtml(data: ConfirmationEmailData): string {
  const {
    firstName,
    eventName,
    hostName,
    date,
    time,
    timezoneAbbr,
    timezone,
    meetLink,
    manageUrl,
    googleCalUrl,
    outlookUrl,
    icalUrl,
    eventDescription,
    prepMaterials,
    userTopic,
    prepResources,
    schoolName,
    customBodyHtml,
  } = data;

  // Generate preparation checklist if we have prep materials
  const prepChecklist = prepMaterials
    ? `
      <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: ${COLORS.navy}; font-size: 16px; font-weight: 600;">
          📋 Before Your Session
        </h3>
        <div style="color: ${COLORS.gray}; font-size: 14px; line-height: 1.8;">
          ${prepMaterials.split('\n').map(line =>
            line.trim() ? `<div style="margin-bottom: 8px;">☐ ${line}</div>` : ''
          ).join('')}
        </div>
      </div>
    `
    : '';

  // Prep resources section
  const prepResourcesHtml = prepResources && prepResources.length > 0
    ? `
      <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; color: ${COLORS.navy}; font-size: 16px; font-weight: 600;">
          📚 Helpful Resources
        </h3>
        ${prepResources.map(resource => `
          <div style="background: white; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <strong style="color: ${COLORS.navy};">${resource.title}</strong>
            <p style="color: ${COLORS.gray}; margin: 8px 0 0 0; font-size: 14px;">${resource.content}</p>
            ${resource.link ? `<a href="${resource.link}" style="color: ${COLORS.purple}; font-size: 14px;">Learn more →</a>` : ''}
          </div>
        `).join('')}
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your spot is confirmed!</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Hero Section -->
          <tr>
            <td style="background: ${COLORS.green}; border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
              <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">
                You're all set${schoolName ? `, ${schoolName}` : ''}!
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">
                Your spot is confirmed for <strong>${eventName}</strong>
              </p>
            </td>
          </tr>

          <!-- Session Details Card -->
          <tr>
            <td style="background: white; padding: 0 32px;">
              <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 24px; margin: -20px 0 24px 0; border: 2px solid ${COLORS.border};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-bottom: 16px; border-bottom: 1px solid ${COLORS.border};">
                      <div style="margin-bottom: 12px;">
                        <span style="font-size: 18px; margin-right: 8px;">📅</span>
                        <span style="color: ${COLORS.navy}; font-size: 18px; font-weight: 600;">${date}</span>
                      </div>
                      <div>
                        <span style="font-size: 18px; margin-right: 8px;">🕐</span>
                        <span style="color: ${COLORS.navy}; font-size: 18px; font-weight: 600;">${time} ${timezoneAbbr}</span>
                        <span style="color: ${COLORS.gray}; font-size: 14px; margin-left: 8px;">(${timezone})</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 16px;">
                      <p style="color: ${COLORS.gray}; margin: 0 0 8px 0; font-size: 14px;">Host</p>
                      <p style="color: ${COLORS.navy}; margin: 0; font-size: 16px; font-weight: 500;">${hostName}</p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Primary CTA: Join Meeting -->
          ${meetLink ? `
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px; text-align: center;">
              <a href="${meetLink}" style="display: inline-block; background: ${COLORS.green}; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; min-width: 200px;">
                🎥 Join Google Meet
              </a>
              <p style="color: ${COLORS.gray}; font-size: 12px; margin: 12px 0 0 0;">
                Save this link! You'll need it to join on ${date.split(',')[0]}.
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Add to Calendar -->
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px;">
              <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="color: ${COLORS.navy}; margin: 0 0 16px 0; font-size: 14px; font-weight: 600;">
                  📆 Add to your calendar
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                  <tr>
                    <td style="padding: 0 8px;">
                      <a href="${googleCalUrl}" target="_blank" style="display: inline-block; background: white; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 12px 20px; text-decoration: none; min-width: 80px; text-align: center;">
                        <span style="color: ${COLORS.navy}; font-size: 13px; font-weight: 500;">Google</span>
                      </a>
                    </td>
                    <td style="padding: 0 8px;">
                      <a href="${outlookUrl}" target="_blank" style="display: inline-block; background: white; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 12px 20px; text-decoration: none; min-width: 80px; text-align: center;">
                        <span style="color: ${COLORS.navy}; font-size: 13px; font-weight: 500;">Outlook</span>
                      </a>
                    </td>
                    <td style="padding: 0 8px;">
                      <a href="${icalUrl}" style="display: inline-block; background: white; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 12px 20px; text-decoration: none; min-width: 80px; text-align: center;">
                        <span style="color: ${COLORS.navy}; font-size: 13px; font-weight: 500;">Apple</span>
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- User's Topic (if provided) -->
          ${userTopic ? `
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px;">
              <div style="background: #EEF0FF; border-left: 4px solid ${COLORS.purple}; padding: 16px 20px; border-radius: 0 12px 12px 0;">
                <p style="margin: 0 0 8px 0; color: ${COLORS.navy}; font-size: 14px; font-weight: 600;">
                  💬 What you want to discuss:
                </p>
                <p style="color: ${COLORS.gray}; margin: 0; font-style: italic; font-size: 15px;">
                  "${userTopic}"
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Custom body content or default -->
          ${customBodyHtml ? `
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px;">
              ${customBodyHtml}
            </td>
          </tr>
          ` : `
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px;">
              <h2 style="color: ${COLORS.navy}; font-size: 18px; margin: 0 0 16px 0; font-weight: 600;">
                What to Expect
              </h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 12px 0; vertical-align: top;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="font-size: 20px;">🎯</span>
                        </td>
                        <td>
                          <strong style="color: ${COLORS.navy};">Your Time, Your Topics</strong>
                          <p style="color: ${COLORS.gray}; margin: 4px 0 0 0; font-size: 14px;">Come prepared with any questions or challenges you'd like to discuss.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; vertical-align: top;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="font-size: 20px;">💡</span>
                        </td>
                        <td>
                          <strong style="color: ${COLORS.navy};">Practical Guidance</strong>
                          <p style="color: ${COLORS.gray}; margin: 4px 0 0 0; font-size: 14px;">We'll work through solutions together that fit your specific situation.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `}

          <!-- About This Session -->
          ${eventDescription ? `
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px;">
              <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px;">
                <h3 style="margin: 0 0 12px 0; color: ${COLORS.navy}; font-size: 16px; font-weight: 600;">
                  About This Session
                </h3>
                <p style="color: ${COLORS.gray}; margin: 0; font-size: 14px; line-height: 1.6;">
                  ${eventDescription}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Preparation Checklist -->
          ${prepChecklist ? `
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px;">
              ${prepChecklist}
            </td>
          </tr>
          ` : ''}

          <!-- Prep Resources -->
          ${prepResourcesHtml ? `
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px;">
              ${prepResourcesHtml}
            </td>
          </tr>
          ` : ''}

          <!-- Reschedule/Cancel -->
          <tr>
            <td style="background: white; padding: 0 32px 32px 32px;">
              <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 24px; text-align: center;">
                <p style="color: ${COLORS.gray}; margin: 0 0 16px 0; font-size: 14px;">
                  Something come up? No problem.
                </p>
                <a href="${manageUrl}" style="display: inline-block; background: white; border: 2px solid ${COLORS.purple}; color: ${COLORS.purple}; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Reschedule or Cancel
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: ${COLORS.navy}; border-radius: 0 0 16px 16px; padding: 24px 32px; text-align: center;">
              <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 0;">
                Sent from Connect with LiveSchool
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate a simpler reminder email
 */
export function generateReminderEmailHtml(data: {
  firstName: string;
  eventName: string;
  hostName: string;
  date: string;
  time: string;
  timezoneAbbr: string;
  meetLink: string | null;
  manageUrl: string;
  reminderTiming: string; // "tomorrow" or "in about 1 hour"
}): string {
  const { firstName, eventName, hostName, date, time, timezoneAbbr, meetLink, manageUrl, reminderTiming } = data;

  const isUrgent = reminderTiming.includes('hour');
  const headerColor = isUrgent ? '#F59E0B' : COLORS.purple;
  const headerEmoji = isUrgent ? '⏰' : '📅';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background: white; border-radius: 16px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background: ${headerColor}; padding: 32px; text-align: center;">
              <p style="font-size: 36px; margin: 0 0 8px 0;">${headerEmoji}</p>
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">
                See you ${reminderTiming}!
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="color: ${COLORS.navy}; font-size: 16px; margin: 0 0 24px 0;">
                Hi ${firstName}, just a friendly reminder about your upcoming session.
              </p>

              <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h2 style="color: ${COLORS.navy}; margin: 0 0 12px 0; font-size: 18px;">${eventName}</h2>
                <p style="color: ${COLORS.gray}; margin: 0 0 8px 0;">📅 ${date} at ${time} ${timezoneAbbr}</p>
                <p style="color: ${COLORS.gray}; margin: 0;">👤 with ${hostName}</p>
              </div>

              ${meetLink ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${meetLink}" style="display: inline-block; background: ${COLORS.green}; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  🎥 Join Google Meet
                </a>
              </div>
              ` : ''}

              <div style="text-align: center;">
                <a href="${manageUrl}" style="color: ${COLORS.purple}; font-size: 14px;">
                  Need to reschedule?
                </a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate a styled follow-up email for post-session communication
 * Supports both "thank you" (attended) and "we missed you" (no-show) variants
 */
export interface FollowupEmailData {
  recipientFirstName: string;
  eventName: string;
  hostName: string;
  sessionDate: string; // e.g., "Friday, January 31"
  sessionTime: string; // e.g., "10:30 AM"
  timezoneAbbr: string; // e.g., "CT"
  recordingLink?: string | null;
  deckLink?: string | null;
  sharedLinks?: Array<{ title: string; url: string }> | null;
  bookingPageUrl: string; // e.g., "https://liveschoolhelp.com/book/office-hours"
  isNoShow?: boolean;
  customMessage?: string; // Optional custom message from the host
}

export function generateFollowupEmailHtml(data: FollowupEmailData): string {
  const {
    recipientFirstName,
    eventName,
    hostName,
    sessionDate,
    sessionTime,
    timezoneAbbr,
    recordingLink,
    deckLink,
    sharedLinks,
    bookingPageUrl,
    isNoShow = false,
    customMessage,
  } = data;

  const headerColor = isNoShow ? '#F59E0B' : COLORS.purple;
  const headerEmoji = isNoShow ? '👋' : '🎉';
  const headerTitle = isNoShow
    ? `We missed you, ${recipientFirstName}!`
    : `Thanks for joining, ${recipientFirstName}!`;
  const headerSubtitle = isNoShow
    ? `We're sorry we couldn't connect at ${eventName}`
    : `Great chatting with you at ${eventName}`;

  // Build resources section (only for attended, not no-shows)
  const hasResources = !isNoShow && (recordingLink || deckLink || (sharedLinks && sharedLinks.length > 0));

  const resourcesSection = hasResources ? `
    <tr>
      <td style="background: white; padding: 0 32px 24px 32px;">
        <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 24px;">
          <h3 style="margin: 0 0 16px 0; color: ${COLORS.navy}; font-size: 16px; font-weight: 600;">
            📚 Session Resources
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${recordingLink ? `
            <tr>
              <td style="padding: 8px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width: 28px; vertical-align: middle;">
                      <span style="font-size: 18px;">🎥</span>
                    </td>
                    <td>
                      <a href="${recordingLink}" style="color: ${COLORS.purple}; text-decoration: none; font-weight: 500; font-size: 15px;">
                        Watch Recording →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ` : ''}
            ${deckLink ? `
            <tr>
              <td style="padding: 8px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width: 28px; vertical-align: middle;">
                      <span style="font-size: 18px;">📊</span>
                    </td>
                    <td>
                      <a href="${deckLink}" style="color: ${COLORS.purple}; text-decoration: none; font-weight: 500; font-size: 15px;">
                        View Slides →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ` : ''}
            ${sharedLinks && sharedLinks.length > 0 ? sharedLinks.map(link => `
            <tr>
              <td style="padding: 8px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width: 28px; vertical-align: middle;">
                      <span style="font-size: 18px;">📎</span>
                    </td>
                    <td>
                      <a href="${link.url}" style="color: ${COLORS.purple}; text-decoration: none; font-weight: 500; font-size: 15px;">
                        ${link.title} →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            `).join('') : ''}
          </table>
        </div>
      </td>
    </tr>
  ` : '';

  // Primary CTA for recording (only if attended and recording exists)
  const recordingCta = !isNoShow && recordingLink ? `
    <tr>
      <td style="background: white; padding: 0 32px 24px 32px; text-align: center;">
        <a href="${recordingLink}" style="display: inline-block; background: ${COLORS.green}; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          🎥 Watch Recording
        </a>
      </td>
    </tr>
  ` : '';

  // Custom message section
  const customMessageSection = customMessage ? `
    <tr>
      <td style="background: white; padding: 0 32px 24px 32px;">
        <div style="color: ${COLORS.navy}; font-size: 15px; line-height: 1.6;">
          ${customMessage.split('\n').map(line => `<p style="margin: 0 0 12px 0;">${line}</p>`).join('')}
        </div>
      </td>
    </tr>
  ` : '';

  // Book another session CTA
  const bookingCtaText = isNoShow
    ? "Let's find a time that works"
    : "Want to continue the conversation?";
  const bookingCtaButton = isNoShow ? "Book a Session" : "Book Another Session";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isNoShow ? 'We missed you!' : 'Thanks for joining!'}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Hero Section -->
          <tr>
            <td style="background: ${headerColor}; border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">${headerEmoji}</div>
              <h1 style="color: white; margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">
                ${headerTitle}
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">
                ${headerSubtitle}
              </p>
            </td>
          </tr>

          <!-- Session Details Card -->
          <tr>
            <td style="background: white; padding: 0 32px;">
              <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; margin: -20px 0 24px 0; border: 2px solid ${COLORS.border};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <div style="display: inline-block;">
                        <span style="font-size: 16px; margin-right: 8px;">📅</span>
                        <span style="color: ${COLORS.navy}; font-size: 16px; font-weight: 500;">${sessionDate} at ${sessionTime} ${timezoneAbbr}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span style="font-size: 16px; margin-right: 8px;">👤</span>
                      <span style="color: ${COLORS.gray}; font-size: 14px;">Hosted by ${hostName}</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Custom Message -->
          ${customMessageSection}

          <!-- Primary CTA: Watch Recording (if attended and recording exists) -->
          ${recordingCta}

          <!-- Resources Section (if attended and has resources) -->
          ${resourcesSection}

          <!-- Book Another Session CTA -->
          <tr>
            <td style="background: white; padding: 0 32px 32px 32px;">
              <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 24px; text-align: center;">
                <p style="color: ${COLORS.navy}; margin: 0 0 16px 0; font-size: 15px; font-weight: 500;">
                  ${bookingCtaText}
                </p>
                <a href="${bookingPageUrl}" style="display: inline-block; background: white; border: 2px solid ${COLORS.purple}; color: ${COLORS.purple}; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  ${bookingCtaButton}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: ${COLORS.navy}; border-radius: 0 0 16px 16px; padding: 24px 32px; text-align: center;">
              <p style="color: rgba(255,255,255,0.9); font-size: 13px; margin: 0 0 8px 0;">
                Questions? Just reply to this email.
              </p>
              <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">
                Sent from Connect with LiveSchool
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
