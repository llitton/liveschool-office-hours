import { format } from 'date-fns';

interface CalendarEventData {
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  organizer?: {
    name: string;
    email: string;
  };
}

function formatICalDate(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateICalFile(event: CalendarEventData): string {
  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@liveschool-office-hours`;
  const now = new Date();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LiveSchool//Office Hours//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICalDate(now)}`,
    `DTSTART:${formatICalDate(event.startTime)}`,
    `DTEND:${formatICalDate(event.endTime)}`,
    `SUMMARY:${escapeICalText(event.title)}`,
    `DESCRIPTION:${escapeICalText(event.description)}`,
    `LOCATION:${escapeICalText(event.location)}`,
  ];

  if (event.organizer) {
    lines.push(`ORGANIZER;CN=${escapeICalText(event.organizer.name)}:mailto:${event.organizer.email}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

export function generateGoogleCalendarUrl(event: CalendarEventData): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    location: event.location,
    dates: `${format(event.startTime, "yyyyMMdd'T'HHmmss'Z'")}/${format(event.endTime, "yyyyMMdd'T'HHmmss'Z'")}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateOutlookUrl(event: CalendarEventData): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    body: event.description,
    location: event.location,
    startdt: event.startTime.toISOString(),
    enddt: event.endTime.toISOString(),
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
