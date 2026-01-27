'use client';

import { useState, useRef, useEffect } from 'react';
import { PageContainer } from '@/components/AppShell';
import Link from 'next/link';

// Section data for navigation
const sections = [
  { id: 'intro', label: 'Introduction' },
  { id: 'problem', label: 'The Problem' },
  { id: 'tools', label: 'Our Tools' },
  { id: 'process', label: 'The Process' },
  { id: 'features', label: 'What We Built' },
  { id: 'tips', label: 'Tips' },
  { id: 'investment', label: 'Investment' },
];

// Feature categories for the expandable list
const featureCategories = [
  {
    id: 'core',
    name: 'Core Booking',
    icon: '📅',
    features: [
      { name: 'Event booking system', desc: 'Public booking pages with custom questions' },
      { name: 'Google Calendar sync', desc: 'Reads availability, creates events' },
      { name: 'Outlook calendar overlay', desc: 'Attendees can see their calendar when booking' },
      { name: 'Waitlist management', desc: 'Auto-promote when spots open' },
      { name: 'Meeting polls', desc: 'Find times that work for groups' },
      { name: 'Bulk slot creation', desc: 'Copy weeks, import CSV files' },
    ],
  },
  {
    id: 'team',
    name: 'Team Features',
    icon: '👥',
    features: [
      { name: 'Round-robin scheduling', desc: 'Distribute bookings with priority-based assignment' },
      { name: 'Host priorities', desc: 'Set 1-10 weight priorities with % distribution preview' },
      { name: 'Co-host calendar sync', desc: 'All co-hosts automatically receive calendar invites' },
      { name: 'Team invitations', desc: 'Invite members with polished emails, status tracking, and resend capability' },
      { name: 'Routing forms', desc: 'Direct people to right event type' },
      { name: 'Quick Links', desc: 'Personal booking URLs for team' },
    ],
  },
  {
    id: 'comms',
    name: 'Communications',
    icon: '💬',
    features: [
      { name: 'Email confirmations', desc: 'Modern email templates with Unicode emoji for Gmail compatibility' },
      { name: 'SMS reminders', desc: 'Text notifications with delivery tracking dashboard' },
      { name: 'Email validation', desc: 'Block fake/disposable emails with MX check' },
      { name: 'Phone pre-fill', desc: 'Auto-fill from HubSpot contacts' },
      { name: 'Confirmation page UX', desc: 'Email pill, calendar buttons, copy link as primary action' },
    ],
  },
  {
    id: 'integrations',
    name: 'Integrations',
    icon: '🔗',
    features: [
      { name: 'HubSpot integration', desc: 'Contacts and meetings sync automatically' },
      { name: 'HubSpot meeting types', desc: 'Map events to HubSpot activity types for tracking' },
      { name: 'Attendee role badges', desc: 'Show Teacher/Admin/Site Leader from HubSpot user_type' },
      { name: 'Attendee role breakdown', desc: 'See who is attending at a glance (e.g., "2 site leaders, 1 admin")' },
      { name: 'Instant context cards', desc: 'HubSpot data pre-fetched when you expand attendees — no waiting' },
      { name: 'Slack notifications', desc: 'Per-event booking alerts with attendee context' },
      { name: 'Slack wrap-up summary', desc: 'Send post-session report with attendance, resources, and all question responses' },
      { name: 'Session resources', desc: 'Add deck link and shared links during wrap-up, included in follow-up emails' },
      { name: 'Attendance auto-sync', desc: 'Detects who joined Google Meet (requires Google reconnect)' },
      { name: 'Google disconnect/reconnect', desc: 'Re-authorize Google to get new permissions in Settings' },
    ],
  },
  {
    id: 'ux',
    name: 'User Experience',
    icon: '✨',
    features: [
      { name: 'Event settings UX', desc: 'Sidebar nav, live preview, sticky save buttons' },
      { name: 'Buffer visualization', desc: 'Visual timeline showing meeting and buffer times' },
      { name: 'Real-time URL validation', desc: 'Check slug availability as you type' },
      { name: 'Event templates', desc: 'Create, edit, and apply templates for quick event setup' },
      { name: 'What\'s New changelog', desc: 'Badge notification for new features with per-user tracking' },
      { name: 'Dashboard UX', desc: 'Collapsible attendee lists, prominent Join Meet button, dimmed inactive cards' },
      { name: 'Compact event cards', desc: 'Two-column grid, condensed info, reduced padding for less scrolling' },
      { name: 'Team page table', desc: 'Compact table view with search, collapsible add form' },
      { name: 'Dismissible alerts', desc: 'Dashboard alerts can be dismissed for 24 hours with X button' },
      { name: 'Status badge colors', desc: 'High-contrast emerald/amber/red badges for quick status scanning' },
      { name: 'Empty state CTAs', desc: 'Copy Link button on events with no bookings to reduce friction' },
      { name: 'Prominent search', desc: 'Larger search bar with purple accent and shadow' },
      { name: 'QR code generator', desc: 'Print codes for easy booking' },
      { name: 'Visual consistency', desc: 'Same action = same color (brand purple for all calendar icons)' },
      { name: 'Mobile-first design', desc: '44px+ touch targets for accessibility on all devices' },
      { name: 'Complete navigation', desc: 'Every admin page accessible via nav - no orphaned pages' },
      { name: 'Sticky headers', desc: 'Event details page keeps title and actions visible while scrolling' },
      { name: 'Attendee search', desc: 'Search bar for sessions with 6+ attendees to quickly find people' },
      { name: 'Visual section hierarchy', desc: 'Configuration sections use dashed borders and badges to separate from content' },
      { name: 'Attendee status badges', desc: 'Blue "New", purple "Returning", green "Frequent" badges at a glance' },
      { name: 'Session topics display', desc: 'See what each attendee wants to discuss directly on the slot card' },
      { name: 'Co-host visibility', desc: 'Today and Upcoming pages show only sessions where you are a host or co-host' },
      { name: 'Past session deep links', desc: 'Click Earlier sessions to jump directly to the slot on the event page' },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics & Testing',
    icon: '📊',
    features: [
      { name: 'Booking conversion analytics', desc: 'Track funnel from view to booking' },
      { name: 'Attendee feedback', desc: 'Star ratings, comments, and topic suggestions from attendees' },
      { name: 'Feedback visibility', desc: 'See ratings in Past Sessions, event details, and daily summaries' },
      { name: 'CSV export', desc: 'Download analytics and booking data' },
      { name: 'Automated test suite', desc: '409+ tests covering auth, email validation, routing, iCal, SMS, Slack, and booking logic' },
      { name: 'URL handling tests', desc: 'Automated checks prevent hardcoded URLs in emails and API routes' },
      { name: 'System status dashboard', desc: 'Real-time monitoring of database, integrations, and system health' },
      { name: 'Migration verification', desc: 'API endpoint to verify all database migrations are applied' },
    ],
  },
];

// Tools with brand colors and links
const tools = [
  {
    name: 'Claude Code',
    description: 'The AI assistant that writes the code. You describe what you want in plain English, and it figures out how to build it.',
    color: '#D97706',
    bgColor: '#FEF3C7',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    ),
    link: 'https://claude.ai/download',
  },
  {
    name: 'GitHub',
    description: 'Where the code lives. Every change is saved here with detailed version history.',
    color: '#24292F',
    bgColor: '#F3F4F6',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    ),
    link: 'https://github.com',
  },
  {
    name: 'Vercel',
    description: 'The service that runs the website. Push code to GitHub, and Vercel automatically updates the live site.',
    color: '#000000',
    bgColor: '#F3F4F6',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M24 22.525H0l12-21.05 12 21.05z"/>
      </svg>
    ),
    link: 'https://vercel.com',
  },
  {
    name: 'Supabase',
    description: 'The database that stores everything—bookings, events, user info. Like a really smart spreadsheet.',
    color: '#3ECF8E',
    bgColor: '#ECFDF5',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z"/>
      </svg>
    ),
    link: 'https://supabase.com',
  },
  {
    name: 'Google Calendar API',
    description: 'Reads your calendar to know when you\'re busy, and creates events when someone books.',
    color: '#4285F4',
    bgColor: '#EFF6FF',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z"/>
      </svg>
    ),
    link: 'https://developers.google.com/calendar',
  },
  {
    name: 'Vitest & Playwright',
    description: '248+ automated tests verify every feature works. Like a robot QA team checking for bugs.',
    color: '#729B1B',
    bgColor: '#F7FEE7',
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
    link: 'https://vitest.dev',
  },
];

// Chat message component for the conversation example
function ChatMessage({ isUser, children }: { isUser: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex gap-3 ${isUser ? '' : 'flex-row-reverse'}`}>
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${
          isUser ? 'bg-[#6F71EE]' : 'bg-[#417762]'
        }`}
      >
        {isUser ? 'You' : 'AI'}
      </div>
      <div
        className={`flex-1 rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-[#6F71EE] text-white rounded-tl-sm'
            : 'bg-white border border-gray-200 text-[#101E57] rounded-tr-sm'
        }`}
      >
        <p className="text-[15px] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// Feature category accordion
function FeatureCategory({
  category,
  isOpen,
  onToggle,
}: {
  category: typeof featureCategories[number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition"
      >
        <span className="text-2xl">{category.icon}</span>
        <div className="flex-1">
          <h4 className="font-semibold text-[#101E57]">{category.name}</h4>
          <p className="text-sm text-[#667085]">{category.features.length} features</p>
        </div>
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
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid gap-3 sm:grid-cols-2">
            {category.features.map((feature) => (
              <div key={feature.name} className="bg-white rounded-lg p-3 border border-gray-100">
                <h5 className="font-medium text-[#101E57] text-sm mb-1">{feature.name}</h5>
                <p className="text-xs text-[#667085]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HowWeBuiltThisPage() {
  const [activeSection, setActiveSection] = useState('intro');
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['core']));
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAllCategories = () => {
    setOpenCategories(new Set(featureCategories.map((c) => c.id)));
  };

  const collapseAllCategories = () => {
    setOpenCategories(new Set());
  };

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 150;
      for (const section of sections) {
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
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#101E57] transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <a
          href="https://claude.ai/download"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5355d1] transition"
        >
          Start Building
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Two-column layout with sticky nav */}
      <div className="flex gap-8">
        {/* Sticky Side Navigation */}
        <div className="hidden lg:block w-48 flex-shrink-0">
          <nav className="sticky top-8 space-y-1">
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wider mb-3 px-3">
              Contents
            </p>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                  activeSection === section.id
                    ? 'bg-[#101E57] text-white'
                    : 'text-[#667085] hover:text-[#101E57] hover:bg-gray-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-3xl">
          {/* Header */}
          <section
            id="intro"
            ref={(el) => { sectionRefs.current['intro'] = el; }}
            className="mb-16"
          >
            <h1 className="text-4xl font-bold text-[#101E57] mb-4">
              How We Built This App with AI
            </h1>
            <p className="text-xl text-[#667085] mb-8">
              A non-technical guide to building software with AI tools — no coding experience required
            </p>

            {/* The Big Idea - Distinct styling */}
            <div className="relative bg-gradient-to-br from-[#6F71EE] to-[#417762] rounded-2xl p-8 text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <div className="inline-block bg-white/20 rounded-full px-3 py-1 text-sm font-medium mb-4">
                  The Big Idea
                </div>
                <p className="text-lg leading-relaxed opacity-95">
                  This entire application—the booking system, calendar integration, email reminders,
                  HubSpot sync, and everything else you see—was built by having conversations with AI.
                  No traditional coding experience required. Just clear thinking about what problems
                  needed solving and the patience to work through them one conversation at a time.
                </p>
              </div>
            </div>
          </section>

          {/* Section 1: The Problem */}
          <section
            id="problem"
            ref={(el) => { sectionRefs.current['problem'] = el; }}
            className="mb-16"
          >
            <div className="flex items-center gap-4 mb-6">
              <span className="w-12 h-12 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] text-xl font-bold">
                1
              </span>
              <h2 className="text-2xl font-bold text-[#101E57]">It Started with a Problem</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-[#667085] leading-relaxed mb-4">
                  We needed a way for schools and educators to book sessions with our team.
                  Existing tools like Calendly were fine, but they didn&apos;t integrate the way we needed:
                </p>
                <ul className="space-y-3">
                  {[
                    'Booking data to flow directly into HubSpot',
                    'Custom questions for each type of session',
                    'See who was booking and what they wanted',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[#667085]">
                      <svg className="w-5 h-5 text-[#6F71EE] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <ul className="space-y-3">
                  {[
                    'Round-robin scheduling with priority-based assignment',
                    'SMS reminders, not just email',
                    'Real-time validation to prevent duplicate URLs',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[#667085]">
                      <svg className="w-5 h-5 text-[#6F71EE] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 text-sm">
                    <strong>Key Insight:</strong> The best projects start with real problems you personally experience.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: The Tools */}
          <section
            id="tools"
            ref={(el) => { sectionRefs.current['tools'] = el; }}
            className="mb-16"
          >
            <div className="flex items-center gap-4 mb-6">
              <span className="w-12 h-12 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] text-xl font-bold">
                2
              </span>
              <h2 className="text-2xl font-bold text-[#101E57]">The Tools We Used</h2>
            </div>

            <p className="text-[#667085] mb-6">
              You don&apos;t need to understand how these work internally. Just know what they do:
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {tools.map((tool) => (
                <a
                  key={tool.name}
                  href={tool.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: tool.bgColor, color: tool.color }}
                    >
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#101E57] group-hover:text-[#6F71EE] transition">
                          {tool.name}
                        </h3>
                        <svg className="w-4 h-4 text-[#667085] opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                      <p className="text-sm text-[#667085] line-clamp-2">{tool.description}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* Section 3: How the Conversations Work */}
          <section
            id="process"
            ref={(el) => { sectionRefs.current['process'] = el; }}
            className="mb-16"
          >
            <div className="flex items-center gap-4 mb-6">
              <span className="w-12 h-12 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] text-xl font-bold">
                3
              </span>
              <h2 className="text-2xl font-bold text-[#101E57]">How the Conversations Work</h2>
            </div>

            <p className="text-[#667085] mb-6">
              Building with AI is like having a conversation with a very capable assistant. Here&apos;s what it actually looks like:
            </p>

            {/* Chat UI Example */}
            <div className="bg-[#F6F6F9] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-sm text-[#667085] font-medium">Example: Adding Email Validation</span>
              </div>

              <div className="space-y-4">
                <ChatMessage isUser={true}>
                  We&apos;re getting a lot of fake email addresses when people book demos.
                  Can we validate that the email is real before accepting the booking?
                </ChatMessage>

                <ChatMessage isUser={false}>
                  I can add email validation that checks: 1) The email format is correct,
                  2) The domain has valid mail servers (catches typos like gmial.com),
                  3) Blocks disposable email providers like mailinator. Want me to implement this?
                </ChatMessage>

                <ChatMessage isUser={true}>
                  Yes! And can we also require phone numbers so we can call them if they don&apos;t show up?
                </ChatMessage>

                <ChatMessage isUser={false}>
                  Done! I&apos;ve added phone number validation with auto-formatting for US numbers,
                  and it pre-fills from HubSpot if we already have their number on file.
                  The validation runs in real-time as they type.
                </ChatMessage>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-300/50">
                <p className="text-sm text-[#667085] italic text-center">
                  ...and then the AI writes all the code, tests it, and deploys it.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: What We Built */}
          <section
            id="features"
            ref={(el) => { sectionRefs.current['features'] = el; }}
            className="mb-16"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] text-xl font-bold">
                  4
                </span>
                <h2 className="text-2xl font-bold text-[#101E57]">What We Built (So Far)</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={expandAllCategories}
                  className="text-sm text-[#6F71EE] hover:underline"
                >
                  Expand all
                </button>
                <span className="text-[#D0D5DD]">|</span>
                <button
                  onClick={collapseAllCategories}
                  className="text-sm text-[#6F71EE] hover:underline"
                >
                  Collapse all
                </button>
              </div>
            </div>

            <p className="text-[#667085] mb-6">
              25+ features organized by category. Click to expand and see the details.
            </p>

            <div className="space-y-3">
              {featureCategories.map((category) => (
                <FeatureCategory
                  key={category.id}
                  category={category}
                  isOpen={openCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                />
              ))}
            </div>
          </section>

          {/* Section 5: Tips */}
          <section
            id="tips"
            ref={(el) => { sectionRefs.current['tips'] = el; }}
            className="mb-16"
          >
            <div className="flex items-center gap-4 mb-6">
              <span className="w-12 h-12 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] text-xl font-bold">
                5
              </span>
              <h2 className="text-2xl font-bold text-[#101E57]">Tips for Building with AI</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: 'Start with what annoys you',
                  desc: 'The best features came from moments of frustration. "I wish this would..." is a great starting point.',
                  icon: '💡',
                },
                {
                  title: 'Describe the problem, not the solution',
                  desc: 'Instead of "add a button here," say "users are getting confused about how to cancel."',
                  icon: '🎯',
                },
                {
                  title: 'Test as a user would',
                  desc: 'After each change, actually use it. Book a session. See what\'s confusing. That\'s your next conversation.',
                  icon: '🧪',
                },
                {
                  title: 'It\'s okay to not understand the code',
                  desc: 'Focus on whether it works and feels right. The AI handles the technical details.',
                  icon: '🤷',
                },
                {
                  title: 'Break big ideas into small steps',
                  desc: '"Build a booking system" is overwhelming. "Let someone pick a time slot" is doable.',
                  icon: '🧩',
                },
                {
                  title: 'Save your conversations',
                  desc: 'Good prompts are reusable. When something works well, remember how you asked for it.',
                  icon: '💾',
                },
              ].map((tip, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition">
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{tip.icon}</span>
                    <div>
                      <h3 className="font-semibold text-[#101E57] mb-1">{tip.title}</h3>
                      <p className="text-sm text-[#667085]">{tip.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 6: The Real Investment */}
          <section
            id="investment"
            ref={(el) => { sectionRefs.current['investment'] = el; }}
            className="mb-16"
          >
            <div className="flex items-center gap-4 mb-6">
              <span className="w-12 h-12 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] text-xl font-bold">
                6
              </span>
              <h2 className="text-2xl font-bold text-[#101E57]">The Real Investment</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <p className="text-[#667085]">
                  Building this wasn&apos;t free, but it wasn&apos;t what you might expect:
                </p>
              </div>
              <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                <div className="p-6 text-center">
                  <div className="text-3xl font-bold text-[#6F71EE] mb-1">$20/mo</div>
                  <div className="text-sm text-[#667085]">Claude Pro subscription</div>
                </div>
                <div className="p-6 text-center">
                  <div className="text-3xl font-bold text-[#6F71EE] mb-1">$0</div>
                  <div className="text-sm text-[#667085]">Vercel (free tier)</div>
                </div>
                <div className="p-6 text-center">
                  <div className="text-3xl font-bold text-[#6F71EE] mb-1">$25/mo</div>
                  <div className="text-sm text-[#667085]">Supabase (small plan)</div>
                </div>
              </div>
              <div className="p-6 bg-gray-50">
                <p className="text-[#667085]">
                  <strong className="text-[#101E57]">The real cost is time and curiosity.</strong> Expect to spend
                  evenings and weekends over several weeks. But unlike hiring a developer, you end up
                  understanding your own product deeply—and you can keep improving it forever.
                </p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="mb-16">
            <div className="bg-[#101E57] rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">
                Want to Build Something?
              </h2>
              <p className="text-white/80 mb-6 max-w-lg mx-auto">
                The barrier to building software has never been lower. If you can describe what you want
                clearly, you can build it. Start with something small that would make your day easier.
              </p>
              <a
                href="https://claude.ai/download"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white text-[#101E57] px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition"
              >
                Try Claude Code
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </section>

          {/* Footer */}
          <footer className="text-center text-sm text-[#667085] pb-8">
            <p>Built with curiosity and AI by the LiveSchool team.</p>
          </footer>
        </div>
      </div>
    </PageContainer>
  );
}
