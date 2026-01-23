/**
 * Modern, accessible HTML email templates
 *
 * Design principles:
 * - Mobile-first with 44px minimum touch targets
 * - Critical info (date, time, join link) prominently displayed
 * - Visual hierarchy through color and spacing
 * - Inline styles for email client compatibility
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
  // New optional fields for personalization
  schoolName?: string;
  customBodyHtml?: string; // If admin has custom template, we'll use this as base
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

// SVG icons as data URIs for email compatibility
const ICONS = {
  calendar: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236F71EE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='16' y1='2' x2='16' y2='6'%3E%3C/line%3E%3Cline x1='8' y1='2' x2='8' y2='6'%3E%3C/line%3E%3Cline x1='3' y1='10' x2='21' y2='10'%3E%3C/line%3E%3C/svg%3E" alt="" style="vertical-align: middle; margin-right: 8px;" width="20" height="20">`,
  clock: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236F71EE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cpolyline points='12 6 12 12 16 14'%3E%3C/polyline%3E%3C/svg%3E" alt="" style="vertical-align: middle; margin-right: 8px;" width="20" height="20">`,
  video: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='23 7 16 12 23 17 23 7'%3E%3C/polygon%3E%3Crect x='1' y='5' width='15' height='14' rx='2' ry='2'%3E%3C/rect%3E%3C/svg%3E" alt="" style="vertical-align: middle; margin-right: 8px;" width="20" height="20">`,
  checkCircle: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='%23417762' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cpolyline points='9 12 11 14 15 10'%3E%3C/polyline%3E%3C/svg%3E" alt="Confirmed" width="48" height="48">`,
  google: `<img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" alt="Google Calendar" width="24" height="24" style="vertical-align: middle;">`,
  outlook: `<img src="https://img.icons8.com/fluency/48/microsoft-outlook-2019.png" alt="Outlook" width="24" height="24" style="vertical-align: middle;">`,
  apple: `<img src="https://img.icons8.com/ios-filled/50/000000/mac-os.png" alt="Apple Calendar" width="24" height="24" style="vertical-align: middle;">`,
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
            <td style="background: linear-gradient(135deg, ${COLORS.purple} 0%, #5a5cd0 100%); border-radius: 16px 16px 0 0; padding: 40px 32px; text-align: center;">
              <div style="margin-bottom: 16px;">
                ${ICONS.checkCircle}
              </div>
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
                      <div style="display: inline-block; margin-bottom: 12px;">
                        ${ICONS.calendar}
                        <span style="color: ${COLORS.navy}; font-size: 18px; font-weight: 600;">${date}</span>
                      </div>
                      <br>
                      <div style="display: inline-block;">
                        ${ICONS.clock}
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
                ${ICONS.video}
                Join Google Meet
              </a>
              <p style="color: ${COLORS.gray}; font-size: 12px; margin: 12px 0 0 0;">
                Save this link! You'll need it to join on ${date.split(',')[0]}.
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- Add to Calendar - Icon Buttons -->
          <tr>
            <td style="background: white; padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px;">
                <tr>
                  <td style="padding: 16px; text-align: center;">
                    <p style="color: ${COLORS.navy}; margin: 0 0 16px 0; font-size: 14px; font-weight: 600;">
                      Add to your calendar
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 12px;">
                          <a href="${googleCalUrl}" target="_blank" style="display: inline-block; background: white; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 12px 20px; text-decoration: none; min-width: 44px; min-height: 44px;">
                            ${ICONS.google}
                            <span style="color: ${COLORS.navy}; font-size: 13px; display: block; margin-top: 4px;">Google</span>
                          </a>
                        </td>
                        <td style="padding: 0 12px;">
                          <a href="${outlookUrl}" target="_blank" style="display: inline-block; background: white; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 12px 20px; text-decoration: none; min-width: 44px; min-height: 44px;">
                            ${ICONS.outlook}
                            <span style="color: ${COLORS.navy}; font-size: 13px; display: block; margin-top: 4px;">Outlook</span>
                          </a>
                        </td>
                        <td style="padding: 0 12px;">
                          <a href="${icalUrl}" style="display: inline-block; background: white; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 12px 20px; text-decoration: none; min-width: 44px; min-height: 44px;">
                            ${ICONS.apple}
                            <span style="color: ${COLORS.navy}; font-size: 13px; display: block; margin-top: 4px;">Apple</span>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
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
                    <span style="display: inline-block; width: 32px; height: 32px; background: #EEF0FF; border-radius: 50%; text-align: center; line-height: 32px; margin-right: 12px;">🎯</span>
                    <div style="display: inline-block; vertical-align: top; width: calc(100% - 50px);">
                      <strong style="color: ${COLORS.navy};">Your Time, Your Topics</strong>
                      <p style="color: ${COLORS.gray}; margin: 4px 0 0 0; font-size: 14px;">Come prepared with any questions or challenges you'd like to discuss.</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; vertical-align: top;">
                    <span style="display: inline-block; width: 32px; height: 32px; background: #E0F2FE; border-radius: 50%; text-align: center; line-height: 32px; margin-right: 12px;">💡</span>
                    <div style="display: inline-block; vertical-align: top; width: calc(100% - 50px);">
                      <strong style="color: ${COLORS.navy};">Practical Guidance</strong>
                      <p style="color: ${COLORS.gray}; margin: 4px 0 0 0; font-size: 14px;">We'll work through solutions together that fit your specific situation.</p>
                    </div>
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
                <a href="${manageUrl}" style="display: inline-block; background: white; border: 2px solid ${COLORS.purple}; color: ${COLORS.purple}; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; min-height: 44px; line-height: 1;">
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
                <p style="color: ${COLORS.gray}; margin: 0 0 8px 0;">${date} at ${time} ${timezoneAbbr}</p>
                <p style="color: ${COLORS.gray}; margin: 0;">with ${hostName}</p>
              </div>

              ${meetLink ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${meetLink}" style="display: inline-block; background: ${COLORS.green}; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Join Google Meet
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
