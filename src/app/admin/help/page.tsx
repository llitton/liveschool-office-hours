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
        body: 'Connecting your Google Calendar allows LiveSchool Sessions to check your availability, automatically create Google Meet links, and add bookings to your calendar.',
        steps: [
          'Go to Settings, then Integrations',
          'Click Connect Google Calendar',
          'Sign in with your Google account',
          'Grant the necessary permissions',
        ],
        tips: [
          'Your calendar syncs automatically after connecting',
          'You can disconnect and reconnect at any time',
        ],
      },
      {
        id: 'create-event',
        title: 'Creating Your First Session',
        description: 'Set up a booking type like Office Hours or 1:1 Support.',
        body: 'Sessions are the booking types you offer. Create one to let people schedule time with you.',
        steps: [
          'Click Create New Session on the Sessions page',
          'Choose a template or start from scratch',
          'Enter a name, duration, and capacity',
          'Add any questions you want to ask attendees',
          'Click Create Session',
        ],
        tips: [
          'Use templates to save time on common session types',
          'You can always edit settings later',
        ],
      },
      {
        id: 'add-slots',
        title: 'Adding Time Slots',
        description: 'Create available times when people can book with you.',
        body: 'Time slots are the windows when people can book sessions. Add them to make your session available.',
        steps: [
          'Open a session from the Sessions page',
          'Click Add Time Slots',
          'Select the date(s) and times',
          'Click Create Slots',
        ],
        tips: [
          'Add multiple slots at once by selecting a date range',
          'Delete upcoming slots that have no bookings',
          'Cancelled slots can be recreated if needed',
        ],
      },
      {
        id: 'share-link',
        title: 'Sharing Your Booking Link',
        description: 'Send your link to let people schedule sessions.',
        body: 'Once your session has time slots, share the booking link with others via email, Slack, or your website.',
        steps: [
          'Go to the Sessions page',
          'Find your session and click Copy Link',
          'Share the link with attendees',
        ],
        code: 'yoursite.com/book/session-slug',
        lists: [
          {
            label: 'People who visit this link can',
            items: [
              'See your available time slots',
              'Select a time that works for them',
              'Fill in their information and book',
            ],
          },
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
              'Text — short answer for names or topics',
              'Long text — detailed answers or descriptions',
              'Select — choose from predefined options',
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
        ],
      },
      {
        id: 'templates',
        title: 'Session Templates',
        description: 'Quickly create common session types with pre-filled settings.',
        body: 'Templates save time when creating sessions you run often.',
        lists: [
          {
            label: 'Built-in templates',
            items: [
              'Office Hours — open Q&A sessions',
              'Product Demo — guided walkthroughs',
              '1:1 Support — private support sessions',
              'Training Workshop — hands-on learning',
            ],
          },
        ],
        steps: [
          'Click Create New Session',
          'Choose a template from Quick Start',
          'The form will be pre-filled with common settings',
          'Customize as needed',
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
        body: 'The dashboard shows your upcoming sessions, attendee counts, and quick actions.',
        lists: [
          {
            label: 'What you will see',
            items: [
              'Upcoming sessions with attendee counts',
              'First-time attendees highlighted',
              'Quick access to join Google Meet',
              'Session status (upcoming, in progress, completed)',
            ],
          },
          {
            label: 'Quick actions',
            items: [
              'Click a session to see attendee details',
              'Join Google Meet directly from the card',
              'Start the wrap-up workflow after sessions',
            ],
          },
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
        description: 'Track who showed up to enable follow-ups and certificates.',
        steps: [
          'Open the session from the Sessions page',
          'Click Wrap Up after the session ends',
          'Check the box next to each attendee who joined',
          'Click Save',
        ],
        lists: [
          {
            label: 'Why track attendance',
            items: [
              'Identify no-shows for follow-up emails',
              'Build attendance history for reporting',
              'Enable attendance certificates for PD credit',
            ],
          },
        ],
      },
      {
        id: 'wrap-up',
        title: 'Post-Session Wrap Up',
        description: 'Mark attendance, add notes, link recordings, and send follow-ups.',
        body: 'After each session, use the wrap-up workflow to close out the session properly.',
        steps: [
          'Mark attendance — check off who attended vs. no-shows',
          'Add notes — record key discussion points or follow-ups',
          'Add recording — link the Fireflies recording',
          'Send follow-ups — recording to attendees, re-engagement to no-shows',
        ],
        tips: [
          'Attendees can download certificates for PD credit after being marked as attended',
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
        description="Learn how to get the most out of LiveSchool Sessions."
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

            {/* Contact support */}
            <div className="mt-10 p-5 bg-white rounded-xl border border-[#E0E0E0] flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[#101E57] mb-1">Need more help?</h3>
                <p className="text-sm text-[#667085]">
                  Can&apos;t find what you&apos;re looking for? Reach out to the LiveSchool team.
                </p>
              </div>
              <a
                href="mailto:support@whyliveschool.com"
                className="flex-shrink-0 px-4 py-2 bg-[#101E57] text-white text-sm font-medium rounded-lg hover:bg-[#1a2d6e] transition"
              >
                Contact support
              </a>
            </div>
          </div>
        </div>
    </PageContainer>
  );
}
