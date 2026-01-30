'use client';

import { useState, useRef, useEffect } from 'react';
import { PageContainer, PageHeader, TwoColumnLayout } from '@/components/AppShell';

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
  lists?: { label: string; items: string[] }[];
  code?: string;
  body?: string;
}

interface HelpSection {
  id: string;
  title: string;
  articles: HelpArticle[];
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    articles: [
      {
        id: 'connect-google',
        title: 'Connecting Google Calendar',
        description: 'Sync your calendar to check availability, create Meet links, and add bookings.',
        body: 'Connecting your Google Calendar allows Connect with LiveSchool to check your availability, automatically create Google Meet links, and add bookings to your calendar.',
        steps: [
          'Go to Settings in the top navigation',
          'In the Google Calendar Sync section, click "Reconnect Google"',
          'Sign in with your Google account',
          'Grant the necessary permissions',
        ],
        tips: [
          'Your calendar syncs automatically after connecting',
          'You can disconnect and reconnect at any time from Settings',
          'Calendar events use your session name as the title (e.g., "Office Hours")',
          'For webinars with co-hosts, all co-hosts receive calendar invitations automatically',
          'If new features require additional permissions (like Meet auto-attendance), disconnect and reconnect to grant them',
        ],
      },
      {
        id: 'create-event',
        title: 'Creating Your First Session',
        description: 'Set up a booking type like Office Hours or 1:1 Support.',
        body: 'Sessions are the booking types you offer. Create one to let people schedule time with you.',
        steps: [
          'Click Create New Session on the Sessions page',
          'Choose a Quick Start template or configure from scratch',
          'Select a meeting type: 1:1, Group, Round-Robin, Collective, or Webinar',
          'Enter a name, duration, and customize your URL slug',
          'Add any questions you want to ask attendees',
          'Click Create Session',
        ],
        lists: [
          {
            label: 'Meeting types',
            items: [
              '1:1 — Private sessions with one attendee',
              'Group — Multiple attendees at the same time',
              'Round-Robin — Distribute across your team automatically',
              'Collective — Requires all hosts to be available',
              'Webinar — Scheduled sessions with manual time slots',
            ],
          },
        ],
        tips: [
          'Use Quick Start templates for common session types',
          'Your URL slug is auto-generated but can be customized',
          'You can always edit settings after creation',
        ],
      },
      {
        id: 'availability',
        title: 'How Availability Works',
        description: 'Understand how attendees see your available times.',
        body: 'LiveSchool uses dynamic availability for most event types. Your available times are automatically generated based on your Google Calendar.',
        lists: [
          {
            label: 'For most events (1:1, Group, Round-Robin)',
            items: [
              'Availability is calculated automatically from your calendar',
              'Busy times are blocked, free times are shown',
              'No need to manually create time slots',
              'Just connect Google Calendar and share your link',
            ],
          },
          {
            label: 'For Webinars only',
            items: [
              'Webinars require specific time slots to be created',
              'This lets you schedule sessions at exact times',
              'Use calendar view, bulk create, or recurring options',
              'Attendees can only book the slots you create',
            ],
          },
        ],
        tips: [
          'Most users never need to create time slots manually',
          'Your calendar is synced in real-time for accurate availability',
        ],
      },
      {
        id: 'share-link',
        title: 'Sharing Your Booking Link',
        description: 'Send your link or QR code to let people schedule sessions.',
        body: 'Share your booking link via email, Slack, your website, or print a QR code for in-person events. Each event has a unique URL that you can customize.',
        steps: [
          'Go to the Sessions page',
          'Find your session and click the Copy Link button (primary action)',
          'Share the link with attendees',
        ],
        code: 'liveschoolhelp.com/book/your-session-slug',
        lists: [
          {
            label: 'People who visit this link can',
            items: [
              'See your available time slots',
              'Select a time that works for them',
              'Fill in their information and book',
            ],
          },
          {
            label: 'Quick actions on the dashboard',
            items: [
              'Copy Link — instantly copy the booking URL to clipboard',
              'View public page — preview what attendees see',
              'Duplicate event — create a copy with the same settings',
            ],
          },
          {
            label: 'QR codes for easy sharing',
            items: [
              'Open your event and click the menu (...)',
              'Select QR Code to generate a scannable code',
              'Download as PNG or SVG for printing',
              'Great for classrooms, flyers, and events',
            ],
          },
        ],
      },
      {
        id: 'whats-new',
        title: 'What\'s New',
        description: 'Stay updated on new features and improvements.',
        body: 'Connect is always improving. The What\'s New page shows you the latest features, improvements, and fixes so you never miss an update.',
        lists: [
          {
            label: 'How it works',
            items: [
              'Look for the megaphone icon in the header (next to Help)',
              'A badge shows how many updates you haven\'t seen yet',
              'Click to view the changelog with all recent updates',
              'Updates are grouped by month with "New" badges on unseen items',
            ],
          },
          {
            label: 'Update categories',
            items: [
              'New Feature — major new capabilities',
              'Improvement — enhancements to existing features',
              'Fix — bug fixes and corrections',
            ],
          },
        ],
        tips: [
          'The badge clears automatically when you visit the changelog',
          'Check back periodically to see what\'s new',
          'Each update includes details on how to use the new feature',
        ],
      },
      {
        id: 'team-members',
        title: 'Adding Team Members',
        description: 'Invite colleagues to access the admin dashboard.',
        body: 'Add team members so they can manage their own sessions, view bookings, and participate in round-robin events.',
        steps: [
          'Go to People → Team in the navigation',
          'Enter their email address and optionally their name',
          'Click Add Team Member to send an invitation',
          'They\'ll receive an email with a link to get started',
        ],
        lists: [
          {
            label: 'Team member status',
            items: [
              'Active — Google connected, ready to use the dashboard',
              'Pending — Waiting to connect their Google account',
            ],
          },
          {
            label: 'Resending invitations',
            items: [
              'Find the pending team member in the list',
              'Click "Resend Invite" to send another email',
              'Shows when the last invite was sent (e.g., "2d ago")',
            ],
          },
          {
            label: 'Invitation email design',
            items: [
              'Prominent "Get Started →" button in brand purple',
              '"Takes less than 60 seconds" reassurance below the button',
              'Emoji icons make features scannable at a glance',
              'Your profile photo appears in the signature',
              'Resend emails include "Reminder:" in the subject line',
            ],
          },
        ],
        tips: [
          'You need Google connected to send invitation emails',
          'Pending users can still sign in at any time - the invite is just a reminder',
          'Team members get full admin access once they connect Google',
        ],
      },
    ],
  },
  {
    id: 'managing-sessions',
    title: 'Managing Sessions',
    articles: [
      {
        id: 'session-settings',
        title: 'Session Settings',
        description: 'Configure duration, capacity, booking rules, and buffers.',
        lists: [
          {
            label: 'Basic settings',
            items: [
              'Name and description — what attendees see when booking',
              'URL slug — customize your booking link (validated in real-time)',
              'Duration — how long each session lasts',
              'Capacity — maximum attendees per slot',
            ],
          },
          {
            label: 'Booking rules',
            items: [
              'Minimum notice — how far in advance people must book',
              'Booking window — how far ahead they can book',
              'Require approval — manually approve each booking',
            ],
          },
          {
            label: 'Buffers',
            items: ['Add time before or after sessions for prep or breaks'],
          },
          {
            label: 'Round-robin settings',
            items: [
              'Add team members as participating hosts',
              'Set host priorities (1-5 stars) for assignment order',
              'Choose a distribution strategy',
            ],
          },
        ],
      },
      {
        id: 'custom-questions',
        title: 'Booking Questions',
        description: 'Ask attendees questions when they book to prepare better.',
        body: 'Questions help you understand who is booking and what they need. Responses appear in the booking details.',
        steps: [
          'Go to session settings',
          'Scroll to Booking Questions',
          'Click Add Question',
          'Choose the type and enter your question',
          'Mark as required if needed',
        ],
        lists: [
          {
            label: 'Question types',
            items: [
              'Short text — single line for names or brief answers',
              'Long text — multiple lines for detailed responses',
              'Phone number — formatted phone input',
              'Radio buttons — single choice from options',
              'Checkboxes — multiple choice (select all that apply)',
              'Dropdown — single choice from a dropdown menu',
            ],
          },
          {
            label: 'Adding options (radio, checkbox, dropdown)',
            items: [
              'Select the answer type that needs options',
              'Enter each option on its own line in the Options field',
              'Press Enter to add more options',
              'Empty lines are automatically cleaned up when you click away',
            ],
          },
        ],
      },
      {
        id: 'email-templates',
        title: 'Email Templates',
        description: 'Customize confirmation, reminder, and follow-up emails.',
        lists: [
          {
            label: 'Email types',
            items: [
              'Confirmation — sent when someone books',
              'Reminder — sent before the session (24h and 1h)',
              'Cancellation — sent when a booking is cancelled',
              'No-show — sent to attendees who do not show up',
            ],
          },
          {
            label: 'Available variables',
            items: [
              '{{first_name}} — attendee\'s first name',
              '{{event_name}} — name of the session',
              '{{date}} — session date',
              '{{time}} — session time',
              '{{google_meet_link}} — meeting link',
            ],
          },
          {
            label: 'Email design best practices',
            items: [
              'Modern emails use Unicode emoji for visual elements (Gmail blocks SVG images)',
              'Calendar buttons link directly to Google Calendar, Outlook, and Apple Calendar (.ics)',
              'Clean, table-based HTML layouts work across all email clients',
              'Important actions like "Join Meeting" use prominent button styling',
            ],
          },
        ],
      },
      {
        id: 'confirmation-page',
        title: 'Booking Confirmation Page',
        description: 'What attendees see after successfully booking a session.',
        body: 'After booking, attendees see a confirmation page with all the details they need. The page is designed for quick action and easy reference.',
        lists: [
          {
            label: 'Confirmation page elements',
            items: [
              'Large green checkmark with success message',
              'Email verification pill showing where confirmation was sent',
              'Quick link to reschedule or cancel (at the top, not buried)',
              'Session details: date, time, duration, host name',
              'Add to Calendar buttons for Google, Outlook, and Apple',
              'Copy Meeting Link as the primary action button',
              'Join Now as secondary action (available close to meeting time)',
            ],
          },
          {
            label: 'UX design principles',
            items: [
              'Calendar buttons all use consistent brand purple styling',
              'Touch targets are at least 44px for mobile accessibility',
              'Most important actions (Copy Link, Add to Calendar) are prominently displayed',
              'Attendees can immediately add the event to their calendar without scrolling',
            ],
          },
        ],
        tips: [
          'The confirmation page URL can be shared — attendees can return to it later',
          'Calendar files (.ics) work with any calendar application',
          'Copy Meeting Link is recommended over sharing the full Meet URL manually',
        ],
      },
      {
        id: 'templates',
        title: 'Session Templates',
        description: 'Save and reuse complete event configurations for quick setup.',
        body: 'Templates capture your entire event configuration — not just basic settings, but everything including email templates, SMS messages, booking rules, and more. When you apply a template, your new event is fully pre-configured.',
        lists: [
          {
            label: 'What templates capture',
            items: [
              'Meeting type, duration, and capacity',
              'Booking rules (notice time, window, daily/weekly limits)',
              'Buffer times and start time increments',
              'Email templates (confirmation, reminder, cancellation, no-show)',
              'SMS reminder templates',
              'Custom questions and prep materials',
              'Waitlist and guest settings',
              'Timezone and "Allow Any Time" settings',
              'Slack notification preference',
            ],
          },
          {
            label: 'Built-in templates',
            items: [
              'Office Hours — open Q&A sessions',
              'Product Demo — guided walkthroughs',
              '1:1 Support — private support sessions',
              'Training Workshop — hands-on learning',
            ],
          },
          {
            label: 'Save your own templates',
            items: [
              'Configure an event exactly how you want it (including email templates, SMS, etc.)',
              'Click the menu (...) and choose Save as Template',
              'Name your template and add a description',
              'Your complete configuration is saved for reuse',
            ],
          },
          {
            label: 'Manage templates',
            items: [
              'Go to Settings → Templates to view all your templates',
              'Click the pencil icon to edit a custom template',
              'Update the name, description, or any settings',
              'System templates (built-in) cannot be edited',
            ],
          },
        ],
        steps: [
          'To use a template: Click Create New Session → Choose a Quick Start template',
          'All fields are pre-filled with the template configuration',
          'A unique URL slug is auto-generated (e.g., "my-event-2" if "my-event" exists)',
          'Customize any fields you want, then create your event',
        ],
        tips: [
          'Templates save ALL settings, so you can recreate complex event setups instantly',
          'Host name/email are not saved — they are set from the current user or assigned dynamically',
          'Edit templates anytime at Settings → Templates to fix descriptions or update settings',
        ],
      },
    ],
  },
  {
    id: 'running-sessions',
    title: 'Running Sessions',
    articles: [
      {
        id: 'today-view',
        title: 'Today\'s Sessions',
        description: 'See all sessions happening today at a glance.',
        body: 'The dashboard shows your upcoming sessions, attendee counts, and quick actions. Sessions with attendees get expanded cards while empty sessions show as compact rows.',
        lists: [
          {
            label: 'What you will see',
            items: [
              'Upcoming sessions with attendee counts',
              'First-time attendees highlighted with "New" badge',
              'First 3 attendees shown inline with "View All" for larger sessions',
              'Reminder status badges showing 24h and 1h notification status',
              'Session status (upcoming, in progress, completed)',
            ],
          },
          {
            label: 'Quick actions',
            items: [
              'Click the prominent Join Meet button (with video icon) to join your session',
              'Click "View All" to see the complete attendee list in a modal',
              'Start the wrap-up workflow after sessions',
            ],
          },
        ],
      },
      {
        id: 'event-details',
        title: 'Event Details Page',
        description: 'Manage slots, attendees, and post-session workflows for any event.',
        body: 'The event details page gives you full control over a single event. View all upcoming slots, manage attendees, and handle post-session tasks.',
        lists: [
          {
            label: 'Page layout',
            items: [
              'Sticky header with back button, event title, status badge, and session health metrics',
              'Session health metrics show average rating and attendance rate from past sessions',
              'Visual distinction between configuration (Add Time Slots) and content sections',
              'Add Time Slots section has a dashed border and "Configuration" badge',
              'Past sessions are collapsible accordions — only most recent is expanded by default',
              'Expand All / Collapse All toggle for past sessions',
              'Semantic status pills: green=Attended, red=No-show, amber=Unmarked',
            ],
          },
          {
            label: 'Attendee management',
            items: [
              'Role breakdown shows who is attending (e.g., "2 site leaders, 1 administrator")',
              'Search bar appears when a slot has 6+ attendees — filter by name or email',
              'Status badges: "New" (blue) for first-time, "Returning" (purple), "Frequent" (green)',
              'High no-show rate warning (red) helps identify attendance risks',
              'Mobile-responsive cards stack on smaller screens',
            ],
          },
          {
            label: 'HubSpot context',
            items: [
              'Click "Context" to see attendee details from HubSpot — loads instantly',
              'Role badge shows user type: Teacher (blue), Administrator (purple), Site Leader (amber)',
              'Company name and ARR displayed when available',
              'Session history shows attendance record',
              '"View in HubSpot" link opens the contact record directly',
              'Data is pre-fetched when you expand attendees, so no waiting',
            ],
          },
          {
            label: 'Slot actions',
            items: [
              'Prominent purple "Join Meet" button with video icon for upcoming sessions',
              'Export attendee list to CSV',
              'Cancel Slot button with red hover state for clear destructive action',
            ],
          },
          {
            label: 'Session preparation',
            items: [
              '"Topics to Discuss" section shows what each attendee wants to cover',
              'Topics are pulled from attendee responses to topic-related questions',
              'See exactly what THIS session\'s attendees requested — not aggregate data',
              'Prepare targeted content based on specific attendee needs',
            ],
          },
        ],
        tips: [
          'Use the search bar to quickly find specific attendees in large sessions',
          'The "New" badge helps you identify first-time attendees for extra attention',
          'Check "Topics to Discuss" before each session to see what attendees want to cover',
          'Sticky header keeps quick actions accessible even on long pages',
        ],
      },
      {
        id: 'join-meet',
        title: 'Joining Google Meet',
        description: 'Each session gets a unique Google Meet link automatically.',
        steps: [
          'Find your session in the dashboard',
          'Click Join Meeting or the Meet link',
          'The meeting opens in a new tab',
        ],
        tips: [
          'Join a few minutes early to greet attendees',
          'The same link is sent to all attendees',
          'Links are unique per session for security',
        ],
      },
      {
        id: 'attendance',
        title: 'Marking Attendance',
        description: 'Attendance is synced automatically from Google Meet, or you can mark it manually.',
        body: 'Attendance is now automatically synced from Google Meet about 30-60 minutes after your session ends. Attendees who were in the meeting for at least 5 minutes are marked as attended; others are marked as no-show.',
        lists: [
          {
            label: 'Automatic attendance sync',
            items: [
              'Runs automatically 30-90 minutes after sessions end',
              'Uses Google Meet participant data to determine who attended',
              'Requires 5+ minutes in the meeting to count as attended',
              'Syncs to HubSpot automatically if connected',
            ],
          },
          {
            label: 'Manual attendance (if needed)',
            items: [
              'Open the Wrap Up modal from the event details page',
              'Click "Sync from Google Meet" to pull latest data',
              'Or manually check/uncheck attendees',
              'Use manual mode for edge cases the auto-sync missed',
            ],
          },
          {
            label: 'Why track attendance',
            items: [
              'Identify no-shows for follow-up emails',
              'Build attendance history for reporting',
              'Enable attendance certificates for PD credit',
            ],
          },
        ],
        tips: [
          'Auto-sync requires the host to have Google connected with Meet permissions',
          'If auto-sync didn\'t run, you can manually sync from the Wrap Up modal',
          'Attendance is synced to HubSpot as meeting outcomes (Completed/No-Show)',
        ],
      },
      {
        id: 'past-sessions',
        title: 'Past Sessions Page',
        description: 'Review all completed sessions with attendance and feedback summaries.',
        body: 'The Past Sessions page (Sessions → Past in navigation) shows all your completed sessions grouped by date. Use it to review attendance, track feedback, and identify sessions that still need wrap-up.',
        lists: [
          {
            label: 'Visual indicators',
            items: [
              'Green "Complete" badge — all attendees marked as attended or no-show',
              'Green tint — completed sessions have subtle background color',
              'Star ratings — feedback scores from attendees who responded',
              'Attendance stats — X/Y attended with percentage',
            ],
          },
          {
            label: 'Filtering options',
            items: [
              '"Hide wrapped-up sessions" toggle — reduce clutter by hiding completed ones',
              'Click any session to go to the event details page',
              'Feedback count shows how many attendees submitted ratings',
            ],
          },
        ],
        tips: [
          'Sessions without the "Complete" badge still need attendance marked',
          'Use the toggle to focus on sessions that need attention',
          'Click the star ratings to see detailed feedback comments',
        ],
      },
      {
        id: 'wrap-up',
        title: 'Post-Session Wrap Up',
        description: 'Mark attendance, add recordings, deck links, shared resources, send Slack summaries, and follow-ups.',
        body: 'After each session, use the wrap-up workflow to close out the session properly. Find the "Wrap Up Session" button in the Past Sessions section of the event details page.',
        steps: [
          'Go to the event details page (click the session from Today or Sessions)',
          'Scroll to "Past Sessions" to find your completed session',
          'Click the "Wrap Up Session" button',
          'Mark attendance — check off who attended vs. no-shows',
          'Add recording link — paste the Fireflies or other recording URL',
          'Add deck link — paste the link to your slides/presentation',
          'Add shared links — any resources you shared during the session',
          'Click "Send Summary to Slack" to notify your team (if Slack enabled)',
          'Click "Send Follow-Up" to email attendees (includes resources you added)',
          'Click "Done" to close the wrap-up modal',
        ],
        lists: [
          {
            label: 'Resources you can add',
            items: [
              'Recording link — Fireflies, Loom, or any video recording URL',
              'Deck link — Google Slides, PowerPoint, PDF of your presentation',
              'Shared links — Any other resources shared during the session',
            ],
          },
          {
            label: 'Slack summary includes',
            items: [
              'Event name and session time',
              'Attendance count (X attended, Y no-shows)',
              'Recording link, deck link, and shared links (if added)',
              'Each attendee\'s name, email, and attendance status',
              'All booking question responses from each attendee',
            ],
          },
          {
            label: 'Follow-up email options',
            items: [
              'Thank You Email — send to attendees who joined (includes resources)',
              'We Missed You — send to no-shows for re-engagement',
              'Emails come from YOU, not the primary host',
              'Success toast shows "Sent from: [email]" so you know which account sent',
              'Manual follow-ups prevent automated emails from duplicating',
            ],
          },
        ],
        tips: [
          'Slack summary only appears if Slack notifications are enabled for the event',
          'Added resources are automatically included in follow-up emails',
          'Attendees can download certificates for PD credit after being marked as attended',
          'The Wrap Up button only shows for past sessions with bookings',
          'Once you send a follow-up, the automated cron won\'t send duplicates',
          'To disable automated emails entirely, go to Event Settings → Auto Emails',
        ],
      },
      {
        id: 'auto-emails',
        title: 'Controlling Automated Emails',
        description: 'Choose whether to send post-session emails automatically or manually.',
        body: 'By default, the system automatically sends follow-up emails after sessions. You can disable them for an entire event, or skip them for a specific session in the Wrap Up modal.',
        lists: [
          {
            label: 'Automated emails (when enabled)',
            items: [
              'Thank you emails sent to attended bookings (2-3 hours after)',
              'No-show re-engagement emails (if enabled for the event)',
              'Feedback request emails (1-2 hours after)',
              'Recording link emails (when you add a recording)',
            ],
          },
          {
            label: 'Event-level control',
            items: [
              'Go to Event Settings → "Auto Emails" section',
              'Toggle off "Enable Automated Emails" for the entire event',
              'Great for events where you always send manual follow-ups',
            ],
          },
          {
            label: 'Per-session control (NEW)',
            items: [
              'Open the Wrap Up Session modal after a session',
              'Find the "Automated Emails" section',
              'Toggle on "Skip automated emails for this session"',
              'Only this session\'s auto emails are skipped — other sessions unaffected',
              'Perfect when you\'ve already sent manual follow-ups',
            ],
          },
          {
            label: 'Email sent status indicators',
            items: [
              'In the Wrap Up modal, each attendee shows which emails have been sent',
              'Green "Follow-up" badge — thank you email was sent',
              'Amber "Missed you" badge — no-show re-engagement email was sent',
              'Blue "Feedback" badge — feedback request email was sent',
              'These badges help you see at a glance what emails went out',
            ],
          },
        ],
        steps: [
          'To skip auto emails for ONE session:',
          'Open the Wrap Up Session modal from the event details page',
          'Find the "Automated Emails" section',
          'Toggle on "Skip automated emails for this session"',
          'The "What Happens Next" section will gray out to confirm',
          'You can still send manual emails via the buttons above',
        ],
        tips: [
          'Per-session toggle is great when you\'ve already sent personalized follow-ups',
          'Event-level toggle is better when you never want auto emails for that event type',
          'Manual emails via Wrap Up buttons work regardless of toggle state',
          'Email status badges update in real-time as emails are sent',
        ],
      },
      {
        id: 'feedback',
        title: 'Collecting & Viewing Feedback',
        description: 'See what attendees thought about their sessions with star ratings and comments.',
        body: 'After sessions, attendees receive a feedback request email. Their responses help you understand what\'s working and what topics to cover next.',
        lists: [
          {
            label: 'How feedback works',
            items: [
              'Feedback emails are sent automatically after sessions end',
              'Attendees rate their experience (1-5 stars)',
              'They can add comments and suggest future topics',
              'Feedback is linked to each booking record',
            ],
          },
          {
            label: 'Where to see feedback',
            items: [
              'Past Sessions page — star ratings and counts per session with daily averages',
              'Event details — feedback summary in the quick status line for past slots',
              'Expanded attendee list — individual ratings with comments and topic suggestions',
              'Insights page — aggregated feedback trends across all sessions',
            ],
          },
          {
            label: 'Feedback data collected',
            items: [
              'Star rating (1-5 stars)',
              'Optional comment about the session',
              'Topic suggestions for future sessions',
              'Timestamp of when feedback was submitted',
            ],
          },
        ],
        tips: [
          'Use topic suggestions to plan future sessions around attendee interests',
          'Track average ratings over time to measure improvement',
          'Follow up personally on sessions with lower ratings to understand issues',
        ],
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    articles: [
      {
        id: 'topics',
        title: 'Topic Trends',
        description: 'See what attendees want to discuss based on booking questions.',
        body: 'The Prepare section shows common questions and topics from bookings, helping you prepare for sessions.',
        lists: [
          {
            label: 'Use this to',
            items: [
              'Prepare for upcoming sessions',
              'Identify common pain points',
              'Create FAQ content or documentation',
              'Plan future sessions around hot topics',
            ],
          },
        ],
      },
      {
        id: 'conversions',
        title: 'Booking Conversions',
        description: 'Track how visitors become bookings through your funnel.',
        body: 'The Conversions dashboard shows how people move from viewing your booking page to completing a booking.',
        lists: [
          {
            label: 'Funnel stages tracked',
            items: [
              'Page views — visitors who saw your booking page',
              'Time selected — visitors who clicked a time slot',
              'Form started — visitors who began entering details',
              'Bookings completed — successful bookings',
            ],
          },
          {
            label: 'Use this data to',
            items: [
              'Identify drop-off points in your booking flow',
              'Compare conversion rates across events',
              'Spot trends over time (daily, weekly, monthly)',
              'Optimize your booking page and questions',
            ],
          },
        ],
      },
      {
        id: 'insights',
        title: 'Team Insights',
        description: 'Monitor session performance across your team.',
        body: 'Go to Insights to see team-wide metrics and individual host performance.',
        lists: [
          {
            label: 'Metrics tracked',
            items: [
              'Sessions completed per host',
              'Attendance rates',
              'Feedback scores',
              'No-show rates',
            ],
          },
        ],
      },
      {
        id: 'attendance-trends',
        title: 'Attendance Tracking',
        description: 'Understand attendance patterns over time.',
        lists: [
          {
            label: 'Available data',
            items: [
              'Overall attendance rate',
              'No-show rate by session',
              'First-time vs. returning attendees',
              'Attendance by day of week and time',
            ],
          },
          {
            label: 'Improving attendance',
            items: [
              'Reminder emails are sent automatically',
              'Enable SMS reminders for mobile',
              'Follow up with no-shows to reschedule',
            ],
          },
        ],
      },
      {
        id: 'export-data',
        title: 'Exporting Data',
        description: 'Download analytics and booking data as CSV files.',
        body: 'Export your data for reporting, analysis in spreadsheets, or integration with other tools.',
        lists: [
          {
            label: 'What you can export',
            items: [
              'Booking conversions — funnel data and trends',
              'Team health metrics — host performance data',
              'Event bookings — attendee list for any event',
            ],
          },
        ],
        steps: [
          'Go to Insights → Conversions or Team Health',
          'Click the Export CSV button in the header',
          'Open the downloaded file in Excel or Google Sheets',
        ],
        tips: [
          'Exports include all data for the selected time period',
          'Event booking exports are available from the event menu',
        ],
      },
    ],
  },
  {
    id: 'event-types',
    title: 'Event Types',
    articles: [
      {
        id: 'one-on-one',
        title: 'One-on-One Meetings',
        description: 'Private meetings between you and one attendee.',
        body: 'One-on-one meetings are the most common type. Each booking is a private session with one attendee.',
        lists: [
          {
            label: 'Best for',
            items: [
              '1:1 support calls',
              'Coaching sessions',
              'Discovery calls',
              'Private consultations',
            ],
          },
        ],
      },
      {
        id: 'group-events',
        title: 'Group Sessions',
        description: 'Sessions with multiple attendees at the same time.',
        body: 'Group sessions let multiple people book the same time slot. Great for workshops and office hours.',
        lists: [
          {
            label: 'Best for',
            items: [
              'Office hours with multiple attendees',
              'Training workshops',
              'Q&A sessions',
              'Group coaching',
            ],
          },
        ],
        tips: [
          'Set the maximum attendees per slot in event settings',
          'Attendees see how many spots are left',
        ],
      },
      {
        id: 'round-robin',
        title: 'Round-Robin Events',
        description: 'Distribute bookings across multiple hosts automatically.',
        body: 'Round-robin events spread bookings evenly across your team. All distribution strategies show the same available time slots to attendees—the strategy only affects which host gets assigned when someone books.',
        steps: [
          'Create an event and select Round-Robin type',
          'Add team members as participating hosts',
          'Set host priorities (optional) — higher priority hosts get meetings first',
          'Choose a distribution strategy',
          'Bookings are automatically assigned to available hosts',
        ],
        lists: [
          {
            label: 'Distribution strategies',
            items: [
              'Maximize Availability (Priority) — assigns to highest-priority available host, like Calendly',
              'Load Balanced — assigns to host with fewest sessions for even distribution',
              'Round Robin (Cycle) — rotates through hosts in order',
              'Availability Weighted — considers availability windows when assigning',
            ],
          },
          {
            label: 'Setting host priorities',
            items: [
              'Each team member has a weight from 1-10 (slider)',
              'Weights are converted to percentages showing expected distribution',
              'Higher weight = more meetings assigned to that host',
              'Great for senior team members or specialists',
              'Visual preview shows percentage breakdown by host',
            ],
          },
        ],
        tips: [
          'For maximum calendar coverage, use "Maximize Availability" with priorities',
          'All strategies show the same slots—only assignment logic differs',
          'Team members must connect their Google Calendar to participate',
        ],
      },
      {
        id: 'collective',
        title: 'Collective Events',
        description: 'Meetings that require all hosts to be available.',
        body: 'Collective events check availability across all hosts. Only times when everyone is free are shown.',
        lists: [
          {
            label: 'Best for',
            items: [
              'Panel interviews',
              'Team meetings with customers',
              'Multi-expert consultations',
            ],
          },
        ],
      },
      {
        id: 'webinars',
        title: 'Webinars',
        description: 'Scheduled sessions at specific times with bulk creation tools.',
        body: 'Webinars require manually created time slots. The calendar view shows your availability at a glance - purple cells are available, gray cells are busy. Just click to create a slot.',
        lists: [
          {
            label: 'How webinars differ',
            items: [
              'You create specific time slots manually',
              'Attendees can only book the times you create',
              'Great for scheduled broadcasts or training sessions',
              'Supports high attendee counts',
            ],
          },
          {
            label: 'Calendar view features',
            items: [
              'Purple cells show times you can book',
              'Gray cells show busy times from your calendar',
              'Click any available cell to create a slot instantly',
              'Week navigation to plan ahead',
            ],
          },
          {
            label: 'Co-host availability',
            items: [
              'Add co-hosts in event settings',
              'Calendar automatically shows combined availability',
              'Only times when ALL hosts are free appear as available',
              'Co-host names shown in the legend',
              'Co-hosts automatically receive calendar invitations when you create slots',
            ],
          },
          {
            label: 'Slot creation options',
            items: [
              'Calendar View — click to create slots visually (default)',
              'Single Slot — add one specific date and time',
              'Bulk Create — set a date range and days of week',
              'Weekly Recurring — repeat slots every week',
              'Copy Week — duplicate slots from one week to another',
              'Import CSV — upload a file with dates and times',
            ],
          },
        ],
        tips: [
          'Use the dropdown menu in the top right to switch between creation modes',
          'Calendar View is the fastest way to create individual slots',
          'Use Copy Week to quickly replicate your schedule',
        ],
      },
    ],
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    articles: [
      {
        id: 'meeting-polls',
        title: 'Meeting Polls',
        description: 'Let attendees vote on the best time for a meeting.',
        body: 'Meeting polls help find times that work for multiple people. Share a poll link and let participants vote on their preferred times.',
        steps: [
          'Go to Polls in the sidebar',
          'Click Create New Poll',
          'Add the times you could meet',
          'Share the poll link with participants',
          'Once voting is done, book the winning time',
        ],
        tips: [
          'Great for scheduling meetings with external groups',
          'Participants don\'t need an account to vote',
        ],
      },
      {
        id: 'quick-links',
        title: 'Quick Links & Chrome Extension',
        description: 'Access your booking links quickly without logging in.',
        body: 'Quick Links gives you a personal page with all your booking links. The Chrome extension makes it even faster.',
        steps: [
          'Go to Settings',
          'Find your Quick Links token',
          'Bookmark your personal Quick Links page',
          'Or install the Chrome extension for one-click access',
        ],
        lists: [
          {
            label: 'Chrome extension features',
            items: [
              'See all your events in a popup',
              'Copy booking links with one click',
              'See upcoming slot availability',
              'No login required once connected',
            ],
          },
        ],
      },
      {
        id: 'routing-forms',
        title: 'Routing Forms',
        description: 'Direct attendees to the right event based on their answers.',
        body: 'Routing forms ask qualifying questions and automatically direct people to the appropriate event or host.',
        steps: [
          'Go to Routing in the sidebar',
          'Create a new routing form',
          'Add questions with conditional routing',
          'Map answers to specific events or hosts',
          'Share the routing form link',
        ],
        lists: [
          {
            label: 'Use cases',
            items: [
              'Route support requests by product',
              'Match customers to the right expert',
              'Qualify leads before sales calls',
              'Direct to different event types by need',
            ],
          },
        ],
      },
      {
        id: 'waitlist',
        title: 'Waitlist',
        description: 'Let people join a waitlist when sessions are full.',
        body: 'When a session fills up, people can join a waitlist. If someone cancels, the next person is automatically notified.',
        steps: [
          'Enable waitlist in event settings',
          'Optionally set a waitlist limit',
          'When full, attendees see "Join Waitlist"',
          'Cancellations automatically promote waitlisted attendees',
        ],
        tips: [
          'Waitlisted attendees get their position number',
          'They\'re notified immediately if a spot opens',
        ],
      },
      {
        id: 'sms-reminders',
        title: 'SMS Reminders',
        description: 'Send text message reminders before sessions.',
        body: 'SMS reminders can significantly reduce no-shows (up to 30%). Enable them per event to send texts before sessions. View delivery stats and logs in the SMS dashboard.',
        steps: [
          'Connect an SMS provider (Twilio or Aircall) in Integrations',
          'Enable SMS reminders in event settings',
          'Optionally require phone numbers from attendees',
          'Customize reminder templates with variables like {{first_name}}',
          'Test your templates with the "Send Test SMS" button',
          'Monitor delivery in the SMS dashboard',
        ],
        lists: [
          {
            label: 'SMS Dashboard features',
            items: [
              'View total messages sent, delivered, and failed',
              'See delivery rates and segment counts',
              'Track messages by event and type',
              'Search logs by phone number or name',
            ],
          },
        ],
        tips: [
          'SMS has 98% open rate vs 20% for email',
          'Attendees must opt-in to receive texts',
          'Preview messages in real-time before saving',
          'Use the dashboard to monitor delivery rates',
        ],
      },
      {
        id: 'one-off-meetings',
        title: 'One-Off Meeting Links',
        description: 'Create single-use links for specific meetings.',
        body: 'One-off meeting links are perfect for scheduling a single meeting. The link expires after use or a set date.',
        steps: [
          'Click One-Off Meeting in the sidebar',
          'Set the duration and optional expiration',
          'Share the unique link',
          'Once booked, the link becomes inactive',
        ],
        lists: [
          {
            label: 'Options',
            items: [
              'Single use — link works once',
              'Expiration date — link expires on a date',
              'No expiration — stays active until booked',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    articles: [
      {
        id: 'booking-errors',
        title: 'Booking Errors & Warnings',
        description: 'Understand what happens when something goes wrong during booking.',
        body: 'Connect with LiveSchool is designed to be resilient. When something goes wrong, we try to complete as much as possible and tell you exactly what happened.',
        lists: [
          {
            label: 'What you might see',
            items: [
              'Green success — everything worked perfectly',
              'Amber warning — booking saved but calendar/email had issues',
              'Red error — booking could not be completed',
            ],
          },
          {
            label: 'If calendar invite fails',
            items: [
              'Your booking is still saved and confirmed',
              'You will see a warning to add the event manually',
              'The system retries automatically up to 3 times',
              'Check your Google Calendar connection in Settings',
            ],
          },
          {
            label: 'If confirmation email fails',
            items: [
              'Your booking is still saved and confirmed',
              'Take a screenshot of the confirmation page',
              'Check your spam folder',
              'The system retries automatically',
            ],
          },
        ],
        tips: [
          'Error messages are designed to be helpful, not technical',
          'If you see repeated errors, check Integrations in Settings',
          'Calendar sync issues often resolve by reconnecting Google',
        ],
      },
      {
        id: 'calendar-sync',
        title: 'Calendar Sync Issues',
        description: 'Fix common Google Calendar connection problems.',
        body: 'If your availability is not showing correctly or calendar events are not being created, try these steps.',
        steps: [
          'Go to Settings → Integrations',
          'Click Disconnect next to Google Calendar',
          'Wait a few seconds, then click Connect Google Calendar',
          'Make sure to grant all requested permissions',
          'Your availability will resync automatically',
        ],
        lists: [
          {
            label: 'Common causes',
            items: [
              'Token expired — reconnecting fixes this',
              'Permissions changed — reconnect to re-grant',
              'Calendar was renamed or deleted — check Google Calendar settings',
              'Network issues — usually resolve automatically with retries',
            ],
          },
        ],
        tips: [
          'Calendar operations automatically retry up to 3 times',
          'If issues persist after reconnecting, contact support',
        ],
      },
      {
        id: 'integration-status',
        title: 'Understanding Integration Status',
        description: 'Learn what the status indicators mean for your integrations.',
        body: 'Each integration shows its connection status. Green means connected, amber means needs attention, gray means not set up.',
        lists: [
          {
            label: 'Status meanings',
            items: [
              'Connected (green) — working normally',
              'Needs Attention (amber) — credentials may have expired',
              'Not Connected (gray) — not yet set up',
              'Error (red) — connection failed, needs reconnection',
            ],
          },
          {
            label: 'Integrations to check',
            items: [
              'Google Calendar — required for availability and Meet links',
              'HubSpot — optional, for CRM sync',
              'Slack — optional, for notifications',
              'SMS (Twilio/Aircall) — optional, for text reminders',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    articles: [
      {
        id: 'hubspot',
        title: 'HubSpot Integration',
        description: 'Sync bookings and attendance with HubSpot CRM.',
        body: 'Connect HubSpot to automatically log meetings, update contacts, and track engagement. You can also map events to specific HubSpot meeting types for better tracking and reporting.',
        lists: [
          {
            label: 'What syncs automatically',
            items: [
              'New bookings create or update contacts',
              'Meeting activities are logged with the correct meeting type',
              'Attendance status is recorded',
              'No-shows are tracked for follow-up',
            ],
          },
          {
            label: 'HubSpot Meeting Types',
            items: [
              'Map each event to a HubSpot meeting type (e.g., "First Demo", "Discovery Call")',
              'Meetings are logged with the correct hs_activity_type for reporting',
              'Configure in Event Settings under HubSpot Integration',
              'Types are fetched directly from your HubSpot account',
            ],
          },
        ],
        steps: [
          'Go to Settings > Integrations',
          'Click Connect HubSpot',
          'Authorize access to your HubSpot account',
          'Bookings will now sync automatically',
          'To set meeting types: Go to Event Settings > HubSpot Integration',
          'Select the meeting type from the dropdown',
        ],
        tips: [
          'Meeting types help you track stats across different session categories',
          'Create custom meeting types in HubSpot Settings > Properties > Meetings',
        ],
      },
      {
        id: 'slack',
        title: 'Slack Notifications',
        description: 'Get notified in Slack when bookings happen with context to help you prepare.',
        body: 'Connect Slack to receive real-time notifications about new bookings. You can enable notifications per event, so only the sessions you care about will alert your team.',
        lists: [
          {
            label: 'Enabling notifications for an event',
            items: [
              'Go to the event\'s Settings page',
              'Find the Slack section in the sidebar',
              'Toggle "Enable Slack Notifications" on',
              'New bookings for this event will now notify your Slack channel',
            ],
          },
          {
            label: 'New booking notifications include',
            items: [
              'Attendee name and email',
              'First-time or returning status (e.g., "First session" or "3 previous sessions")',
              'Date and time in the event\'s timezone (e.g., "Friday at 3:00 PM CT")',
              'Relative time indicator (e.g., "in 2 days", "tomorrow")',
              'All booking question responses with their question text',
            ],
          },
          {
            label: 'Post-session summary (Wrap Up)',
            items: [
              'After a session ends, click "Wrap Up Session" on the event page',
              'Click "Send Summary to Slack" to notify your team',
              'Includes attendance, recording link, and all attendee responses',
              'Perfect for sharing session outcomes with your team',
            ],
          },
        ],
        tips: [
          'Enable notifications only for events where you need alerts (e.g., Office Hours) — not demos or internal bookings',
          'Times are displayed in the event\'s timezone so they match the host\'s calendar',
          'Google Meet links are not included since hosts already have them in calendar invitations',
          'First-time/returning status helps hosts tailor their approach',
        ],
      },
      {
        id: 'sms-provider',
        title: 'SMS Provider Setup',
        description: 'Connect Twilio or Aircall to send SMS reminders.',
        body: 'SMS reminders require a provider like Twilio or Aircall. Both offer reliable delivery and support international numbers.',
        steps: [
          'Go to Integrations',
          'Click Set Up SMS in the SMS Reminders section',
          'Choose your provider (Twilio or Aircall)',
          'Follow the step-by-step guide to get your API credentials',
          'Enter your credentials and sender phone number',
          'Click Connect SMS',
        ],
        lists: [
          {
            label: 'Twilio setup',
            items: [
              'Create a Twilio account at twilio.com',
              'Find your Account SID and Auth Token in the Console',
              'Purchase an SMS-capable phone number',
              'Enter the credentials in Integrations',
            ],
          },
          {
            label: 'Aircall setup',
            items: [
              'Log in to your Aircall account',
              'Go to Integrations → Public API',
              'Generate an API key with SMS permissions',
              'Enter the API key and phone number in Integrations',
            ],
          },
        ],
        tips: [
          'Twilio is recommended for high-volume sending',
          'Both providers support international numbers',
          'Test your connection with the Send Test SMS button',
        ],
      },
    ],
  },
  {
    id: 'development',
    title: 'Development & Testing',
    articles: [
      {
        id: 'running-tests',
        title: 'Running Tests',
        description: 'Run automated tests to verify the application works correctly.',
        body: 'Connect with LiveSchool uses Vitest for unit and integration tests, and Playwright for end-to-end browser tests. Tests help ensure new features work correctly and existing functionality isn\'t broken.',
        lists: [
          {
            label: 'Test commands',
            items: [
              'npm run test — Run all unit/integration tests in watch mode',
              'npm run test -- --run — Run tests once (for CI)',
              'npm run test:unit — Run only unit tests',
              'npm run test:integration — Run only integration tests',
              'npm run test:e2e — Run end-to-end browser tests',
              'npm run test:coverage — Generate coverage report',
            ],
          },
          {
            label: 'What each test type covers',
            items: [
              'Unit tests — Individual functions like booking validation, availability calculation',
              'Integration tests — API endpoints, database operations, service integrations',
              'E2E tests — Full user flows in a real browser (booking flow, admin dashboard)',
            ],
          },
        ],
        tips: [
          'Run tests before deploying new features',
          'E2E tests require a running dev server (started automatically)',
          'Check CLAUDE.md for detailed test patterns and examples',
        ],
      },
      {
        id: 'test-coverage',
        title: 'Test Coverage Areas',
        description: 'Understand what parts of the codebase are tested.',
        lists: [
          {
            label: 'Well-tested areas (100% coverage)',
            items: [
              'Auth & Sessions — session management, token refresh, event access',
              'Timezone utilities — formatting, conversion, slot grouping',
              'Slack integration — webhooks, notifications, daily digest',
            ],
          },
          {
            label: 'Good coverage (70-80%)',
            items: [
              'SMS utilities — phone validation, templates, segment calculation',
              'Booking constraints — validation rules, buffer times',
              'HubSpot integration — contact sync, meeting types, activity logging',
            ],
          },
          {
            label: 'Moderate coverage (40-60%)',
            items: [
              'Availability calculation — slot generation logic',
              'API routes — booking, event, and slot endpoints',
            ],
          },
          {
            label: 'Test file locations',
            items: [
              'tests/unit/lib/ — Unit tests for business logic (8 test files)',
              'tests/integration/api/ — API endpoint tests',
              'tests/e2e/ — Browser-based end-to-end tests',
              'tests/mocks/ — Reusable mock factories',
            ],
          },
        ],
      },
      {
        id: 'writing-tests',
        title: 'Writing New Tests',
        description: 'Guidelines for adding tests when building new features.',
        body: 'When adding new functionality, write tests to verify it works correctly. The codebase includes helpful utilities for mocking Supabase and external services.',
        lists: [
          {
            label: 'Test patterns',
            items: [
              'Use createMockSupabase() from tests/mocks/supabase.ts for database mocking',
              'Mock external services (Google, HubSpot) with vi.mock()',
              'Group related tests with describe() blocks',
              'Use clear test names that describe the behavior being tested',
            ],
          },
          {
            label: 'When to write tests',
            items: [
              'New API endpoints — integration tests',
              'New business logic — unit tests',
              'User-facing features — E2E tests',
              'Bug fixes — regression tests to prevent recurrence',
            ],
          },
        ],
        tips: [
          'Refer to existing test files for patterns and examples',
          'See CLAUDE.md for the full testing guide',
        ],
      },
      {
        id: 'database-security',
        title: 'Database Security (RLS)',
        description: 'Understanding Row Level Security for Supabase tables.',
        body: 'All database tables use Row Level Security (RLS) to control access. This is critical for security — without RLS, tables would be publicly accessible via the Supabase API.',
        lists: [
          {
            label: 'How RLS works',
            items: [
              'service_role key (used by API routes) bypasses RLS — full access',
              'anon key (public) is restricted by RLS policies',
              'Each table needs RLS enabled + appropriate policies',
            ],
          },
          {
            label: 'Table access levels',
            items: [
              'Admin-only — oh_admins, oh_sms_config, oh_hubspot_config (contain tokens/keys)',
              'Public read — oh_events (active), oh_slots (available) for booking pages',
              'Public read/write — oh_bookings, oh_poll_votes for attendee actions',
            ],
          },
          {
            label: 'When adding new tables',
            items: [
              'Always enable RLS: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY',
              'Create policies based on who needs access',
              'Tables with API keys or tokens should have NO public policies',
              'Check Supabase dashboard for "RLS Disabled" warnings',
            ],
          },
        ],
        tips: [
          'Migrations 006 and 031 contain all RLS policies',
          'API routes use getServiceSupabase() which bypasses RLS',
          'See CLAUDE.md for the full security guide',
        ],
      },
      {
        id: 'verify-migrations',
        title: 'Verifying Database Migrations',
        description: 'Check if all required database migrations have been applied.',
        body: 'The migration verification endpoint checks your database for all required columns, tables, and structures. Use it to troubleshoot issues or verify a fresh deployment.',
        lists: [
          {
            label: 'How to check migrations',
            items: [
              'Visit /api/admin/verify-migrations while logged in',
              'The response shows total migrations, how many are complete, and which are missing',
              'If migrations are missing, run the SQL files from the migrations/ folder',
              'Run migrations in order (002, 003, 004, etc.) in the Supabase SQL Editor',
            ],
          },
          {
            label: 'Migration categories',
            items: [
              '002-005 — Core tables (availability, hosts, round-robin)',
              '006, 031 — Row Level Security policies',
              '007-019 — Features (routing, SMS, waitlist, templates, polls)',
              '020-035 — Booking features and structural improvements',
              '036-043 — Recent features (Slack, changelog, auto-attendance)',
            ],
          },
          {
            label: 'Structural migrations (special)',
            items: [
              '034 — Adds CHECK constraints (data validation at database level)',
              '035 — Creates atomic booking function (prevents race conditions)',
              'These are verified by checking affected tables exist',
              'If you see constraint errors, manually verify these were run',
            ],
          },
        ],
        tips: [
          'Always run migrations in numerical order',
          'The endpoint requires admin authentication to access',
          'Missing migrations often cause 500 errors or missing features',
          'After running migrations, refresh the verify endpoint to confirm',
        ],
      },
      {
        id: 'branding',
        title: 'Branding & Favicon',
        description: 'Brand colors, favicon, and visual identity guidelines.',
        body: 'Connect with LiveSchool uses a consistent visual identity across the application. The favicon is a purple calendar with checkmark that stands out in browser tabs.',
        lists: [
          {
            label: 'Brand colors',
            items: [
              'Primary Purple (#6F71EE) — main brand color, buttons, links, interactive elements',
              'Navy (#101E57) — headers, dark text, sidebar navigation',
              'Green (#417762) — success states, confirmations, positive actions',
              'Gray (#667085) — secondary text, descriptions, muted elements',
            ],
          },
          {
            label: 'Favicon',
            items: [
              'Located at src/app/icon.svg',
              'Calendar icon with checkmark in brand purple',
              'SVG format for crisp display at all sizes',
              'Next.js App Router serves it automatically',
            ],
          },
          {
            label: 'When to use each color',
            items: [
              'Purple — primary actions, active states, links, focus rings',
              'Navy — page titles, card headers, navigation items',
              'Green — success messages, connected status, confirmations',
              'Gray — helper text, disabled states, borders',
            ],
          },
        ],
        tips: [
          'Maintain consistency by using Tailwind classes like text-[#6F71EE] for brand purple',
          'The favicon helps users identify the app among many browser tabs',
          'See CLAUDE.md for the full branding guide',
        ],
      },
    ],
  },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 my-3">
      <code className="flex-1 px-3 py-2 bg-[#F6F6F9] rounded-lg text-sm font-mono text-[#101E57]">
        {code}
      </code>
      <button
        onClick={handleCopy}
        className="px-3 py-2 text-sm font-medium text-[#667085] hover:text-[#101E57] hover:bg-[#F6F6F9] rounded-lg transition"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function ArticleContent({ article }: { article: HelpArticle }) {
  return (
    <div className="max-w-[720px]">
      {article.body && (
        <p className="text-[#475467] leading-relaxed mb-4">{article.body}</p>
      )}

      {article.steps && article.steps.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-[#101E57] mb-2">Steps</p>
          <ol className="space-y-2">
            {article.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[#475467] leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F6F6F9] text-[#667085] text-xs font-medium flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {article.code && <CodeBlock code={article.code} />}

      {article.lists?.map((list, i) => (
        <div key={i} className="mb-4">
          <p className="text-sm font-medium text-[#101E57] mb-2">{list.label}</p>
          <ul className="space-y-1.5">
            {list.items.map((item, j) => (
              <li key={j} className="flex gap-2 text-[#475467] leading-relaxed">
                <span className="text-[#98A2B3] mt-1.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {article.tips && article.tips.length > 0 && (
        <div className="mt-4 p-4 bg-[#FAFAFA] rounded-lg border border-[#E0E0E0]">
          <p className="text-sm font-medium text-[#101E57] mb-2">Tips</p>
          <ul className="space-y-1.5">
            {article.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#475467]">
                <span className="text-[#98A2B3]">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ArticleAccordion({
  article,
  isOpen,
  onToggle,
}: {
  article: HelpArticle;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`border border-[#E0E0E0] rounded-xl overflow-hidden transition-all ${
        isOpen ? 'bg-white shadow-sm' : 'bg-white hover:border-[#C4C4C4] hover:bg-[#FAFAFA]'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6F71EE]/30 focus-visible:ring-offset-2 rounded-xl"
      >
        <div className="flex-1 min-w-0 pr-4">
          <h3 className={`font-medium text-[15px] ${isOpen ? 'text-[#101E57]' : 'text-[#101E57]'}`}>
            {article.title}
          </h3>
          {!isOpen && (
            <p className="text-sm text-[#667085] mt-0.5 truncate">{article.description}</p>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-[#98A2B3] flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-[#E0E0E0] pt-4">
          <ArticleContent article={article} />
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [openArticles, setOpenArticles] = useState<Set<string>>(new Set(['connect-google']));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('getting-started');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const toggleArticle = (id: string) => {
    setOpenArticles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  // Filter articles by search query
  const filteredSections = searchQuery
    ? helpSections
        .map((section) => ({
          ...section,
          articles: section.articles.filter(
            (article) =>
              article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              article.description.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((section) => section.articles.length > 0)
    : helpSections;

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 200;
      for (const section of helpSections) {
        const el = sectionRefs.current[section.id];
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(section.id);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Help Center"
        description="Learn how to get the most out of Connect with LiveSchool."
      />

        {/* Search */}
        <div className="mb-8 max-w-xl">
          <label className="block text-sm font-medium text-[#101E57] mb-1.5">Search</label>
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#98A2B3]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search articles, features, and setup steps"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 border border-[#E0E0E0] rounded-lg bg-white text-[#101E57] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE] transition"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#98A2B3] hover:text-[#667085] transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-8">
          {/* Left sidebar */}
          {!searchQuery && (
            <div className="w-48 flex-shrink-0">
              <nav className="sticky top-8 space-y-1">
                {helpSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                      activeSection === section.id
                        ? 'bg-[#101E57] text-white'
                        : 'text-[#667085] hover:text-[#101E57] hover:bg-white'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* Right content */}
          <div className={`flex-1 ${searchQuery ? '' : 'max-w-3xl'}`}>
            {/* Sections */}
            <div className="space-y-10">
              {filteredSections.map((section) => (
                <div
                  key={section.id}
                  ref={(el) => { sectionRefs.current[section.id] = el; }}
                >
                  <h2 className="text-base font-semibold text-[#101E57] mb-4">{section.title}</h2>
                  <div className="space-y-3">
                    {section.articles.map((article) => (
                      <ArticleAccordion
                        key={article.id}
                        article={article}
                        isOpen={openArticles.has(article.id)}
                        onToggle={() => toggleArticle(article.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {filteredSections.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E0E0E0] p-12 text-center">
                <div className="w-14 h-14 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[#101E57] mb-2">No results found</h3>
                <p className="text-sm text-[#667085] mb-4">
                  Try a different search term or browse the sections.
                </p>
                <button
                  onClick={clearSearch}
                  className="text-sm text-[#6F71EE] hover:text-[#5355d1] font-medium"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Contact Laura */}
            <div className="mt-10 p-5 bg-white rounded-xl border border-[#E0E0E0] flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[#101E57] mb-1">Need more help?</h3>
                <p className="text-sm text-[#667085]">
                  Can&apos;t find what you&apos;re looking for? Ask Laura.
                </p>
              </div>
              <span className="flex-shrink-0 px-4 py-2 bg-[#F6F6F9] text-[#101E57] text-sm font-medium rounded-lg">
                Ask Laura
              </span>
            </div>
          </div>
        </div>
    </PageContainer>
  );
}
