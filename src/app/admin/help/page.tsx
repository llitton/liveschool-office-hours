'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminNav from '@/components/AdminNav';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  articles: {
    id: string;
    title: string;
    content: string;
  }[];
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    articles: [
      {
        id: 'connect-google',
        title: 'Connecting Google Calendar',
        content: `To get started, you need to connect your Google Calendar. This allows LiveSchool Connect to:

• Check your availability and avoid double-booking
• Automatically create Google Meet links for sessions
• Add bookings to your calendar

**How to connect:**
1. Go to **Settings > Integrations**
2. Click **Connect Google Calendar**
3. Sign in with your Google account
4. Grant the necessary permissions

Once connected, your calendar will sync automatically.`,
      },
      {
        id: 'create-event',
        title: 'Creating Your First Event',
        content: `Events are the booking types you offer. For example, "Office Hours" or "1:1 Support".

**To create an event:**
1. Click **Create New Event** on the Events page
2. Choose a template or start from scratch
3. Fill in the event details:
   - **Name**: What people will see (e.g., "Office Hours")
   - **Duration**: How long each session lasts
   - **Capacity**: Max number of attendees per slot
4. Add any custom questions you want to ask attendees
5. Click **Create Event**

**Pro tip:** Use session templates for common event types to save time!`,
      },
      {
        id: 'add-slots',
        title: 'Adding Time Slots',
        content: `Time slots are the available times when people can book sessions with you.

**To add slots:**
1. Open an event from the Events page
2. Click **Add Time Slots**
3. Select the date(s) and times
4. Click **Create Slots**

**Tips for managing slots:**
• Add multiple slots at once by selecting a date range
• You can delete upcoming slots that have no bookings
• Cancelled slots can be recreated if needed`,
      },
      {
        id: 'share-link',
        title: 'Sharing Your Booking Link',
        content: `Once your event has time slots, you can share the booking link with others.

**To share your link:**
1. Go to the Events page
2. Find your event and click the **Copy Link** button
3. Share the link via email, Slack, or your website

**Your booking link format:**
\`yoursite.com/book/event-slug\`

People who visit this link can:
• See your available time slots
• Select a time that works for them
• Fill in their information and book`,
      },
    ],
  },
  {
    id: 'events',
    title: 'Managing Events',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    articles: [
      {
        id: 'event-settings',
        title: 'Event Settings',
        content: `Each event has settings you can customize:

**Basic Settings:**
• **Name & Description**: What attendees see when booking
• **Duration**: Length of each session
• **Capacity**: Maximum attendees per slot

**Booking Rules:**
• **Minimum Notice**: How far in advance people must book
• **Booking Window**: How far ahead they can book
• **Require Approval**: Manually approve each booking

**Buffers:**
• Add time before/after sessions for prep or breaks`,
      },
      {
        id: 'custom-questions',
        title: 'Custom Questions',
        content: `Ask attendees questions when they book to be better prepared.

**Question types:**
• **Text**: Short answer (name, topic)
• **Textarea**: Long answer (describe your question)
• **Select**: Choose from options

**To add questions:**
1. Go to event settings
2. Scroll to **Custom Questions**
3. Click **Add Question**
4. Choose the type and enter your question
5. Mark as required if needed`,
      },
      {
        id: 'email-templates',
        title: 'Email Templates',
        content: `Customize the emails sent to attendees:

**Email types:**
• **Confirmation**: Sent when someone books
• **Reminder**: Sent before the session (24h and 1h)
• **Cancellation**: Sent when a booking is cancelled
• **No-Show**: Sent to attendees who don't show up

**Available variables:**
• \`{{first_name}}\` - Attendee's first name
• \`{{event_name}}\` - Name of the event
• \`{{date}}\` - Session date
• \`{{time}}\` - Session time
• \`{{google_meet_link}}\` - Meeting link`,
      },
      {
        id: 'session-templates',
        title: 'Session Templates',
        content: `Templates help you quickly create common event types.

**Built-in templates:**
• **Office Hours**: Open Q&A sessions
• **Product Demo**: Guided walkthroughs
• **1:1 Support**: Private support sessions
• **Training Workshop**: Hands-on learning

**Using templates:**
1. Click **Create New Event**
2. Choose a template from **Quick Start**
3. The form will be pre-filled with common settings
4. Customize as needed`,
      },
    ],
  },
  {
    id: 'sessions',
    title: 'Running Sessions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    articles: [
      {
        id: 'today-sessions',
        title: "Today's Sessions View",
        content: `The dashboard shows all sessions happening today at a glance.

**What you'll see:**
• Upcoming sessions with attendee counts
• First-time attendees are highlighted
• Quick access to join Google Meet
• Session status (upcoming, in progress, completed)

**Quick actions:**
• Click a session to see attendee details
• Join Google Meet directly from the card
• Start the wrap-up workflow after sessions`,
      },
      {
        id: 'join-meet',
        title: 'Joining Google Meet',
        content: `Each booked session automatically gets a Google Meet link.

**To join:**
1. Find your session in the dashboard
2. Click **Join Meeting** or the Google Meet link
3. The meeting opens in a new tab

**Tips:**
• Join a few minutes early to greet attendees
• The same link is sent to all attendees
• Links are unique per session for security`,
      },
      {
        id: 'mark-attendance',
        title: 'Marking Attendance',
        content: `Track who showed up to your sessions.

**To mark attendance:**
1. Open the session from the event page
2. Click **Wrap Up** after the session ends
3. Check the box next to each attendee who joined
4. Click **Save**

**Why track attendance:**
• Identify no-shows for follow-up
• Build attendance history for reporting
• Enable attendance certificates for PD credit`,
      },
      {
        id: 'wrap-up',
        title: 'Post-Session Wrap Up',
        content: `After each session, use the wrap-up workflow to:

**1. Mark Attendance**
Check off who attended vs. who was a no-show

**2. Add Notes**
Record key discussion points or follow-ups

**3. Add Recording**
Link the Fireflies recording for attendees

**4. Send Follow-ups**
• Recording link to attendees
• Re-engagement email to no-shows
• Feedback request

**Certificates:**
Attended sessions can download attendance certificates for PD credits.`,
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Understanding Analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    articles: [
      {
        id: 'topic-trends',
        title: 'Topic Trends',
        content: `The Topics page shows what attendees want to discuss.

**What you'll see:**
• Common questions and topics from bookings
• Trending topics over time
• Search and filter by keyword

**Use this to:**
• Prepare for upcoming sessions
• Identify common pain points
• Create FAQ content or documentation
• Plan future webinars around hot topics`,
      },
      {
        id: 'team-health',
        title: 'Team Health',
        content: `Monitor your team's session performance.

**Metrics tracked:**
• Sessions completed per host
• Attendance rates
• Feedback scores
• No-show rates

**Access Team Health:**
Go to **Health** in the navigation to see team-wide metrics and individual host performance.`,
      },
      {
        id: 'attendance-tracking',
        title: 'Attendance Tracking',
        content: `Track attendance patterns over time.

**Available data:**
• Overall attendance rate
• No-show rate by event
• First-time vs. returning attendees
• Attendance by day of week/time

**Improving attendance:**
• Send reminder emails (automatic)
• Enable SMS reminders for mobile
• Follow up with no-shows to reschedule`,
      },
    ],
  },
];

function HelpArticle({
  article,
  isOpen,
  onToggle,
}: {
  article: { id: string; title: string; content: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#E0E0E0] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 px-4 text-left hover:bg-gray-50 transition"
      >
        <span className={`font-medium ${isOpen ? 'text-[#6F71EE]' : 'text-[#101E57]'}`}>
          {article.title}
        </span>
        <svg
          className={`w-5 h-5 text-[#667085] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <div className="prose prose-sm max-w-none text-[#667085]">
            {article.content.split('\n\n').map((paragraph, i) => {
              // Handle lists
              if (paragraph.startsWith('•')) {
                const items = paragraph.split('\n').filter(l => l.trim());
                return (
                  <ul key={i} className="list-disc list-inside space-y-1 my-2">
                    {items.map((item, j) => (
                      <li key={j}>{item.replace('• ', '')}</li>
                    ))}
                  </ul>
                );
              }
              // Handle numbered lists
              if (/^\d+\./.test(paragraph)) {
                const items = paragraph.split('\n').filter(l => l.trim());
                return (
                  <ol key={i} className="list-decimal list-inside space-y-1 my-2">
                    {items.map((item, j) => (
                      <li key={j}>{item.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                  </ol>
                );
              }
              // Handle headings
              if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                return (
                  <h4 key={i} className="font-semibold text-[#101E57] mt-4 mb-2">
                    {paragraph.replace(/\*\*/g, '')}
                  </h4>
                );
              }
              // Handle bold text inline
              const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i} className="my-2">
                  {parts.map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return (
                        <strong key={j} className="font-semibold text-[#101E57]">
                          {part.replace(/\*\*/g, '')}
                        </strong>
                      );
                    }
                    // Handle code
                    const codeParts = part.split(/(`[^`]+`)/g);
                    return codeParts.map((codePart, k) => {
                      if (codePart.startsWith('`') && codePart.endsWith('`')) {
                        return (
                          <code key={k} className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">
                            {codePart.replace(/`/g, '')}
                          </code>
                        );
                      }
                      return codePart;
                    });
                  })}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [openArticles, setOpenArticles] = useState<Set<string>>(new Set(['connect-google']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleArticle = (id: string) => {
    setOpenArticles(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter articles by search query
  const filteredSections = searchQuery
    ? helpSections.map(section => ({
        ...section,
        articles: section.articles.filter(
          article =>
            article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.content.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(section => section.articles.length > 0)
    : helpSections;

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <AdminNav currentPage="help" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-[#667085] hover:text-[#101E57] mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-[#101E57] mb-2">Help Center</h1>
          <p className="text-[#667085]">
            Learn how to get the most out of LiveSchool Connect
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#667085]"
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
              type="text"
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-[#E0E0E0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE]"
            />
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {filteredSections.map(section => (
            <div key={section.id} className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-[#E0E0E0] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE]">
                  {section.icon}
                </div>
                <h2 className="text-lg font-semibold text-[#101E57]">{section.title}</h2>
              </div>
              <div>
                {section.articles.map(article => (
                  <HelpArticle
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
          <div className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] p-12 text-center">
            <div className="w-16 h-16 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">No results found</h3>
            <p className="text-[#667085]">
              Try a different search term or browse the sections below.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-[#6F71EE] hover:text-[#5355d1] font-medium"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Contact support */}
        <div className="mt-8 bg-gradient-to-r from-[#6F71EE]/10 to-[#5355d1]/10 rounded-xl p-6 border border-[#6F71EE]/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#6F71EE] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[#101E57] mb-1">Need more help?</h3>
              <p className="text-sm text-[#667085] mb-3">
                Can&apos;t find what you&apos;re looking for? Reach out to the LiveSchool team.
              </p>
              <a
                href="mailto:support@whyliveschool.com"
                className="inline-flex items-center gap-2 text-[#6F71EE] hover:text-[#5355d1] font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
