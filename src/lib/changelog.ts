// Changelog entries - add new entries at the TOP of the array
// Each entry needs a unique id, date, title, and description

export interface ChangelogEntry {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix';
  details?: string[]; // Optional bullet points for more detail
}

export const changelog: ChangelogEntry[] = [
  {
    id: '2026-01-29-auto-attendance',
    date: '2026-01-29',
    title: 'Automatic Attendance from Google Meet',
    description: 'Attendance is now automatically synced from Google Meet after sessions end.',
    category: 'feature',
    details: [
      'No more manual clicking "Sync from Google Meet" - it happens automatically',
      'Runs 30-90 minutes after your session ends',
      'Attendees in the meeting for 5+ minutes are marked as attended',
      'Others are marked as no-show',
      'Still syncs to HubSpot if connected',
    ],
  },
  {
    id: '2026-01-29-disable-auto-emails',
    date: '2026-01-29',
    title: 'Control Automated Post-Session Emails',
    description: 'New toggle to disable automated follow-up emails when you prefer to send them manually.',
    category: 'feature',
    details: [
      'Find it in Event Settings → Auto Emails section',
      'When disabled, no automated emails are sent after sessions',
      'You can still send follow-ups manually from the Wrap Up modal',
      'Great for sessions where you want full control over communications',
    ],
  },
  {
    id: '2026-01-28-feedback-modal-fix',
    date: '2026-01-28',
    title: 'Feedback Modal Now Working',
    description: 'Fixed an issue where clicking on star ratings would fail to show feedback details.',
    category: 'fix',
    details: [
      'Clicking star ratings on Past Sessions now opens the feedback modal correctly',
      'View individual attendee feedback comments and ratings',
      'See topic suggestions for future sessions',
    ],
  },
  {
    id: '2026-01-28-email-tracking',
    date: '2026-01-28',
    title: 'No More Duplicate Emails',
    description: 'Manual follow-ups now prevent automated emails from being sent to the same people.',
    category: 'fix',
    details: [
      'When you send a follow-up, those attendees are marked as "already emailed"',
      'Automated cron jobs skip people who already received a manual follow-up',
      'Prevents attendees from receiving multiple thank-you or no-show emails',
    ],
  },
  {
    id: '2026-01-28-sent-from-toast',
    date: '2026-01-28',
    title: 'See Which Account Sent Emails',
    description: 'Follow-up success message now shows which email account sent the messages.',
    category: 'improvement',
    details: [
      'After sending follow-up emails, you\'ll see "Sent from: yourname@example.com"',
      'Helps verify emails went out from the correct account',
      'Emails also appear in that account\'s Gmail Sent folder',
    ],
  },
  {
    id: '2026-01-28-past-sessions-complete',
    date: '2026-01-28',
    title: 'Visual Distinction for Wrapped-Up Sessions',
    description: 'Past sessions now show when they\'ve been fully wrapped up.',
    category: 'improvement',
    details: [
      'Green "Complete" badge shows when all attendees marked as attended or no-show',
      'Completed sessions have a subtle green tint',
      'New "Hide wrapped-up sessions" toggle to reduce clutter',
    ],
  },
  {
    id: '2026-01-27-session-wrap-up',
    date: '2026-01-27',
    title: 'Enhanced Session Wrap-Up',
    description: 'Add deck links, shared resources, and send a Slack summary after each session.',
    category: 'feature',
    details: [
      'Add your deck/slides link in the Wrap Up modal',
      'Add any links you shared during the session',
      'Resources are included in follow-up emails to attendees',
      'Send a Slack summary with attendance and all question responses',
    ],
  },
  {
    id: '2026-01-27-google-reconnect',
    date: '2026-01-27',
    title: 'Google Disconnect & Reconnect',
    description: 'Easily re-authorize Google to get new features like Meet auto-attendance.',
    category: 'feature',
    details: [
      'Go to Settings → Google Calendar Sync → Disconnect',
      'Click "Reconnect Google" to re-authorize with updated permissions',
      'Required for Google Meet auto-attendance feature',
      'Each team member needs to reconnect once for new scopes',
    ],
  },
  {
    id: '2026-01-27-followup-from-sender',
    date: '2026-01-27',
    title: 'Follow-Up Emails From You',
    description: 'Follow-up emails now come from whoever clicks Send, not the primary host.',
    category: 'improvement',
    details: [
      'When you click "Send Follow-Up", emails come from your account',
      'Previously, all emails came from the event\'s primary host',
      'More natural for co-hosts who actually ran the session',
    ],
  },
  {
    id: '2026-01-26-attendee-context-performance',
    date: '2026-01-26',
    title: 'Faster Attendee Context Loading',
    description: 'Attendee context cards now load instantly when you expand them.',
    category: 'improvement',
    details: [
      'Context data is pre-fetched when you expand the attendees list',
      'Clicking "Context" on any attendee shows their HubSpot info immediately',
      'No more waiting for individual API calls per attendee',
      'Batch API reduces HubSpot requests and improves reliability',
    ],
  },
  {
    id: '2026-01-26-attendee-roles',
    date: '2026-01-26',
    title: 'Attendee Role Breakdown',
    description: 'See at a glance who is attending each session with role-based summaries.',
    category: 'feature',
    details: [
      'Attendee header shows breakdown by role (e.g., "2 site leaders, 1 administrator")',
      'User type badge (Teacher/Administrator/Site Leader) shown in attendee context card',
      'Color-coded badges: purple for Admin, amber for Site Leader, blue for Teacher',
      'Roles fetched from HubSpot user_type field',
    ],
  },
  {
    id: '2026-01-26-event-details-ux',
    date: '2026-01-26',
    title: 'Event Details Page UX Improvements',
    description: 'Better information hierarchy and streamlined attendee management on the event details page.',
    category: 'improvement',
    details: [
      'Sticky header keeps event title and booking link visible while scrolling',
      'Visual distinction between "Add Time Slots" configuration and content sections',
      'Larger breadcrumb for better navigation wayfinding',
      'Prominent "Join Meet" button with video icon for upcoming sessions',
      '"New" badge identifies first-time attendees at a glance',
      'Search bar to quickly find attendees in large sessions (6+ attendees)',
      'Mobile-responsive attendee cards that stack gracefully on small screens',
      '"Topics to Discuss" section shows what each attendee wants to cover for this specific session',
    ],
  },
  {
    id: '2026-01-26-hubspot-context-fix',
    date: '2026-01-26',
    title: 'HubSpot Attendee Context Improvements',
    description: 'Fixed company/deal display and "View in HubSpot" link in attendee context cards.',
    category: 'fix',
    details: [
      'Company and deal info now displays correctly (requires HubSpot reconnection if previously connected)',
      '"View in HubSpot" link now opens the correct contact record',
      'Portal ID is now automatically retrieved and saved',
      '"Previous topics" now only shows topics from past sessions (not the current session)',
    ],
  },
  {
    id: '2026-01-26-dashboard-improvements',
    date: '2026-01-26',
    title: 'Dashboard Improvements',
    description: 'Several usability fixes to the admin dashboard.',
    category: 'improvement',
    details: [
      '"Next session" banner now shows which event it\'s for',
      '"Allow Any Time" events no longer incorrectly show as "Fully booked"',
      'Drag-and-drop reorder handles are now visible (not hidden until hover)',
    ],
  },
  {
    id: '2026-01-26-expanded-test-coverage',
    date: '2026-01-26',
    title: 'Expanded Test Coverage',
    description: 'Added 135 new automated tests covering core business logic modules.',
    category: 'improvement',
    details: [
      '409 total tests now run on every deployment',
      'Email validation, error handling, and routing logic fully tested',
      'iCal generation and calendar URL tests added',
      'HTML email template tests ensure consistent formatting',
    ],
  },
  {
    id: '2026-01-25-migration-verification',
    date: '2026-01-25',
    title: 'Database Migration Verification',
    description: 'New admin tool to verify all database migrations have been applied.',
    category: 'feature',
    details: [
      'Visit /api/admin/verify-migrations to check schema status',
      'Shows which migrations are complete vs missing',
      'Identifies specific columns/tables that need to be created',
      'Helps troubleshoot database sync issues',
    ],
  },
  {
    id: '2026-01-25-team-page-redesign',
    date: '2026-01-25',
    title: 'Team Page Redesign',
    description: 'Manage your team faster with the new compact table view.',
    category: 'improvement',
    details: [
      'Compact table layout shows more members at a glance',
      'Collapsible "Add Team Member" form — click the button to expand',
      'Search by name or email to quickly find team members',
      'Status badges with clear Active/Pending indicators',
    ],
  },
  {
    id: '2026-01-25-compact-event-cards',
    date: '2026-01-25',
    title: 'Compact Event Cards',
    description: 'See more events at a glance with our new compact card layout.',
    category: 'improvement',
    details: [
      'Two-column grid on larger screens',
      'Reduced card height with tighter spacing',
      'Condensed analytics into a single line',
      'Event reordering now persists correctly',
    ],
  },
  {
    id: '2026-01-25-dashboard-ux-improvements',
    date: '2026-01-25',
    title: 'Dashboard UX Improvements',
    description: 'Better visual hierarchy and actionable elements on the admin dashboard.',
    category: 'improvement',
    details: [
      'Dismissible alert banners — click X to hide for 24 hours',
      'Bolder status badges with high-contrast colors for quick scanning',
      'Larger, more prominent search bar with purple accent',
      'New "Copy Link" CTA on events with no bookings yet',
    ],
  },
  {
    id: '2026-01-25-feedback-details',
    date: '2026-01-25',
    title: 'View Feedback Details',
    description: 'Click on feedback stars in Past Sessions to see the full details of what attendees shared.',
    category: 'feature',
    details: [
      'Click the stars on any session to open the feedback modal',
      'See individual ratings from each attendee',
      'Read their comments and topic suggestions',
      'Average rating displayed at the top',
    ],
  },
  {
    id: '2026-01-25-navigation-cleanup',
    date: '2026-01-25',
    title: 'Improved Navigation',
    description: 'All admin pages are now accessible from the main navigation - no hidden pages.',
    category: 'improvement',
    details: [
      'Analytics and Team Health added to Insights menu',
      'System Status added to Settings menu',
      'Removed duplicate pages for cleaner navigation',
    ],
  },
  {
    id: '2026-01-25-system-status',
    date: '2026-01-25',
    title: 'System Status Dashboard',
    description: 'New admin page to monitor system health and integration status at a glance.',
    category: 'feature',
    details: [
      'View database connectivity status',
      'Check Google Calendar connections for all team members',
      'Monitor HubSpot, Slack, and SMS integration status',
      'See active events and upcoming slots count',
      'Auto-refreshes every 60 seconds',
    ],
  },
  {
    id: '2026-01-25-url-standardization',
    date: '2026-01-25',
    title: 'Improved Email Link Reliability',
    description: 'All email links (confirmations, reminders, feedback requests) now use consistent URLs that work correctly in all environments.',
    category: 'fix',
    details: [
      'Fixed an issue where some email links could point to incorrect URLs',
      'Standardized URL handling across all API routes',
      'Poll booking confirmations now show times in the host\'s timezone',
      'Team invitation emails use the correct application URL',
    ],
  },
  {
    id: '2026-01-25-feedback-visibility',
    date: '2026-01-25',
    title: 'Feedback Stars Visible Everywhere',
    description: 'See attendee feedback ratings at a glance in the Past Sessions page, event details, and session summaries.',
    category: 'feature',
    details: [
      'Past Sessions page now shows star ratings and feedback counts per session',
      'Daily summaries include aggregated feedback with average ratings',
      'Event details show feedback in the quick status line (no need to expand attendees)',
      'Individual attendee feedback with comments viewable in the expanded attendee list',
    ],
  },
  {
    id: '2026-01-23-new-question-types',
    date: '2026-01-23',
    title: 'New Question Types',
    description: 'More ways to collect information from attendees with radio buttons, checkboxes, and phone number fields.',
    category: 'feature',
    details: [
      'Radio buttons — single choice from a list of options',
      'Checkboxes — multiple choice (select all that apply)',
      'Phone number — formatted phone input field',
      'All types available in event settings under Questions',
    ],
  },
  {
    id: '2026-01-23-dropdown-options-fix',
    date: '2026-01-23',
    title: 'Dropdown Options Input Fixed',
    description: 'Pressing Enter now works correctly when adding multiple options to dropdown questions.',
    category: 'fix',
    details: [
      'Enter key now creates new lines as expected',
      'Empty lines are cleaned up when you click away',
      'Affects dropdown questions in event settings',
    ],
  },
  {
    id: '2026-01-23-invite-email-ux',
    date: '2026-01-23',
    title: 'Improved Invitation Emails',
    description: 'Team invitation emails now have better visual hierarchy and clearer calls-to-action.',
    category: 'improvement',
    details: [
      'Prominent "Get Started →" button in brand purple',
      'Emoji icons make features scannable at a glance',
      'Bold action verbs highlight what recipients can do',
      'Sender\'s profile photo appears in signature',
    ],
  },
  {
    id: '2026-01-23-resend-invites',
    date: '2026-01-23',
    title: 'Resend Team Invitations',
    description: 'Easily resend invitation emails to team members who haven\'t activated their account yet.',
    category: 'feature',
    details: [
      'Team page now shows "Active" vs "Pending" status for each member',
      'Click "Resend Invite" to send a reminder email',
      'See when the last invitation was sent',
      'Pending members can connect Google whenever they\'re ready',
    ],
  },
  {
    id: '2026-01-23-dashboard-ux',
    date: '2026-01-23',
    title: 'Dashboard UX Improvements',
    description: 'Better information hierarchy and visual feedback on the admin dashboard.',
    category: 'improvement',
    details: [
      'Prominent Join Meet button with video icon for quick session access',
      'Collapsible attendee lists show first 3 with "View All" modal',
      'Improved reminder badges with clock and bell icons',
      'Disabled events now appear dimmed to reduce visual clutter',
    ],
  },
  {
    id: '2026-01-23-slack-per-event',
    date: '2026-01-23',
    title: 'Per-Event Slack Notifications',
    description: 'Control which events send Slack notifications. Enable notifications only for the sessions that matter to your team.',
    category: 'feature',
    details: [
      'Toggle Slack notifications on/off per event in Settings → Slack',
      'Only enabled events will notify your Slack channel when booked',
      'Great for filtering out internal bookings or demos',
    ],
  },
  {
    id: '2026-01-23-template-editing',
    date: '2026-01-23',
    title: 'Edit Event Templates',
    description: 'You can now edit your custom templates. Fix descriptions, update settings, or tweak any configuration.',
    category: 'feature',
    details: [
      'Go to Settings → Templates to see all your templates',
      'Click the pencil icon to edit any custom template',
      'Update name, description, meeting type, and all settings',
    ],
  },
  {
    id: '2026-01-23-slack-improvements',
    date: '2026-01-23',
    title: 'Improved Slack Booking Notifications',
    description: 'Slack notifications now include more context to help hosts prepare for sessions.',
    category: 'improvement',
    details: [
      'Shows first-time vs returning attendee status',
      'Displays time in the event\'s timezone (not UTC)',
      'Includes all custom question responses with labels',
      'Single-column layout prevents email wrapping',
    ],
  },
  {
    id: '2026-01-22-host-avatars',
    date: '2026-01-22',
    title: 'Better Host Avatar Display',
    description: 'Event cards now show the primary host\'s photo first, with co-hosts displayed in role order.',
    category: 'improvement',
    details: [
      'Primary host (owner) avatar appears first',
      'Co-hosts sorted by role: owner → host → backup',
      'Prevents showing backup hosts before primary hosts',
    ],
  },
  {
    id: '2026-01-21-webinar-cohosts',
    date: '2026-01-21',
    title: 'Webinar Co-Host Calendar Invitations',
    description: 'All co-hosts on webinar events now receive calendar invitations, including backup hosts.',
    category: 'fix',
    details: [
      'Backup hosts on webinars now get calendar invites',
      'Ensures everyone on the team has the meeting on their calendar',
    ],
  },
];

// Get the most recent changelog date
export function getLatestChangelogDate(): Date {
  if (changelog.length === 0) return new Date(0);
  return new Date(changelog[0].date);
}

// Check if there are unseen updates
export function hasUnseenUpdates(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return changelog.length > 0;
  const latestDate = getLatestChangelogDate();
  return latestDate > lastSeenAt;
}

// Get unseen entries count
export function getUnseenCount(lastSeenAt: Date | null): number {
  if (!lastSeenAt) return changelog.length;
  return changelog.filter(entry => new Date(entry.date) > lastSeenAt).length;
}
