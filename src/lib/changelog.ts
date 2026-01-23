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
