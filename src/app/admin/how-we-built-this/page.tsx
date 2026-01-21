'use client';

import { PageContainer } from '@/components/AppShell';
import Link from 'next/link';

export default function HowWeBuiltThisPage() {
  return (
    <PageContainer narrow>
      {/* Header */}
      <div className="mb-12">
        <Link
          href="/admin"
          className="text-sm text-[#6F71EE] hover:underline flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-[#101E57] mb-3">
          How We Built This App with AI
        </h1>
        <p className="text-lg text-[#667085]">
          A non-technical guide to building software with AI tools
        </p>
      </div>

      {/* Introduction */}
      <section className="mb-12">
        <div className="bg-gradient-to-r from-[#6F71EE]/10 to-[#417762]/10 rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-[#101E57] mb-4">
            The Big Idea
          </h2>
          <p className="text-[#667085] leading-relaxed">
            This entire application—the booking system, calendar integration, email reminders,
            HubSpot sync, and everything else you see—was built by having conversations with AI.
            No traditional coding experience required. Just clear thinking about what problems
            needed solving and the patience to work through them one conversation at a time.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#101E57] mb-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] font-bold">1</span>
          It Started with a Problem
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <p className="text-[#667085] leading-relaxed mb-4">
            We needed a way for schools and educators to book sessions with our team.
            Existing tools like Calendly were fine, but they didn&apos;t integrate the way we needed:
          </p>
          <ul className="space-y-3">
            {[
              'We wanted booking data to flow directly into HubSpot',
              'We needed custom questions for each type of session',
              'We wanted to see who was booking and what they wanted to discuss',
              'Round-robin scheduling with priority-based assignment was important',
              'We needed SMS reminders, not just email',
              'We wanted real-time validation to prevent duplicate URLs',
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-amber-800">
            <strong>Key Insight:</strong> The best projects start with real problems you personally
            experience. You don&apos;t need to invent something new—you need to solve something that
            bugs you every day.
          </p>
        </div>
      </section>

      {/* The Tools */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#101E57] mb-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] font-bold">2</span>
          The Tools We Used
        </h2>
        <p className="text-[#667085] mb-6">
          You don&apos;t need to understand how these work internally. You just need to know what they do:
        </p>
        <div className="grid gap-4">
          {[
            {
              name: 'Claude Code',
              description: 'The AI assistant that writes the code. You describe what you want in plain English, and it figures out how to build it. Think of it as a very patient developer who never gets frustrated with questions.',
              icon: '🤖',
            },
            {
              name: 'GitHub',
              description: 'Where the code lives. Every change is saved here, like a detailed version history. If something breaks, you can always go back to when it worked.',
              icon: '📁',
            },
            {
              name: 'Vercel',
              description: 'The service that runs the website. When you push code to GitHub, Vercel automatically updates the live site. It\'s like magic deployment.',
              icon: '🚀',
            },
            {
              name: 'Supabase',
              description: 'The database that stores everything—bookings, events, user info. It\'s like a really smart spreadsheet that the app can read and write to.',
              icon: '🗄️',
            },
            {
              name: 'Google Calendar API',
              description: 'Lets the app read your calendar to know when you\'re busy, and create calendar events when someone books a session.',
              icon: '📅',
            },
          ].map((tool) => (
            <div key={tool.name} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl">{tool.icon}</span>
                <div>
                  <h3 className="font-semibold text-[#101E57] mb-2">{tool.name}</h3>
                  <p className="text-[#667085] text-sm">{tool.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The Process */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#101E57] mb-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] font-bold">3</span>
          How the Conversations Work
        </h2>
        <p className="text-[#667085] mb-6">
          Building with AI is like having a conversation with a very capable assistant. Here&apos;s what it actually looks like:
        </p>

        <div className="space-y-6">
          {/* Example conversation */}
          <div className="bg-[#F6F6F9] rounded-xl p-6">
            <h3 className="font-semibold text-[#101E57] mb-4">Example: Adding Email Validation</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#6F71EE] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  Y
                </div>
                <div className="bg-white rounded-xl p-4 flex-1">
                  <p className="text-[#101E57] text-sm">
                    &quot;We&apos;re getting a lot of fake email addresses when people book demos.
                    Can we validate that the email is real before accepting the booking?&quot;
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#417762] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  AI
                </div>
                <div className="bg-white rounded-xl p-4 flex-1">
                  <p className="text-[#101E57] text-sm">
                    &quot;I can add email validation that checks: 1) The email format is correct,
                    2) The domain has valid mail servers (catches typos like gmial.com),
                    3) Blocks disposable email providers like mailinator. Want me to implement this?&quot;
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#6F71EE] flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  Y
                </div>
                <div className="bg-white rounded-xl p-4 flex-1">
                  <p className="text-[#101E57] text-sm">
                    &quot;Yes! And can we also require phone numbers so we can call them if they don&apos;t show up?&quot;
                  </p>
                </div>
              </div>
            </div>
            <p className="text-[#667085] text-sm mt-4 italic">
              ...and then the AI writes all the code, tests it, and deploys it.
            </p>
          </div>
        </div>
      </section>

      {/* What We Built */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#101E57] mb-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] font-bold">4</span>
          What We Built (So Far)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { feature: 'Event booking system', desc: 'Public booking pages with custom questions' },
            { feature: 'Google Calendar sync', desc: 'Reads availability, creates events' },
            { feature: 'Outlook calendar overlay', desc: 'Attendees can see their calendar when booking' },
            { feature: 'Email confirmations', desc: 'Automated emails with calendar links' },
            { feature: 'SMS reminders', desc: 'Text notifications with delivery tracking dashboard' },
            { feature: 'HubSpot integration', desc: 'Contacts and meetings sync automatically' },
            { feature: 'Round-robin scheduling', desc: 'Distribute bookings with priority-based assignment' },
            { feature: 'Host priorities', desc: 'Set 1-5 star priorities for team members' },
            { feature: 'Waitlist management', desc: 'Auto-promote when spots open' },
            { feature: 'Email validation', desc: 'Block fake/disposable emails with MX check' },
            { feature: 'Phone pre-fill', desc: 'Auto-fill from HubSpot contacts' },
            { feature: 'Meeting polls', desc: 'Find times that work for groups' },
            { feature: 'Routing forms', desc: 'Direct people to right event type' },
            { feature: 'Quick Links', desc: 'Personal booking URLs for team' },
            { feature: 'Booking conversion analytics', desc: 'Track funnel from view to booking' },
            { feature: 'CSV export', desc: 'Download analytics and booking data' },
            { feature: 'Event templates', desc: 'Quick Start templates for common session types' },
            { feature: 'Real-time URL validation', desc: 'Check slug availability as you type' },
            { feature: 'Bulk slot creation', desc: 'Copy weeks, import CSV files' },
            { feature: 'QR code generator', desc: 'Print codes for easy booking' },
            { feature: 'Attendance auto-sync', desc: 'Detects who joined Google Meet' },
          ].map((item) => (
            <div key={item.feature} className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-medium text-[#101E57] mb-1">{item.feature}</h3>
              <p className="text-[#667085] text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#101E57] mb-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] font-bold">5</span>
          Tips for Building with AI
        </h2>
        <div className="space-y-4">
          {[
            {
              title: 'Start with what annoys you',
              desc: 'The best features came from moments of frustration. "I wish this would..." is a great starting point.',
            },
            {
              title: 'Describe the problem, not the solution',
              desc: 'Instead of "add a button here," say "users are getting confused about how to cancel." Let the AI suggest solutions.',
            },
            {
              title: 'Test as a user would',
              desc: 'After each change, actually use it. Book a session. See what\'s confusing. That\'s your next conversation.',
            },
            {
              title: 'It\'s okay to not understand the code',
              desc: 'You don\'t need to read the code. Focus on whether it works and feels right. The AI handles the technical details.',
            },
            {
              title: 'Break big ideas into small steps',
              desc: '"Build a booking system" is overwhelming. "Let someone pick a time slot" is doable. Chain small wins together.',
            },
            {
              title: 'Save your conversations',
              desc: 'Good prompts are reusable. When something works well, remember how you asked for it.',
            },
          ].map((tip, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-[#101E57] mb-2">{tip.title}</h3>
              <p className="text-[#667085]">{tip.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Time Investment */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#101E57] mb-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] font-bold">6</span>
          The Real Investment
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-[#667085] mb-6">
            Building this wasn&apos;t free, but it wasn&apos;t what you might expect:
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#6F71EE] mb-2">$20/mo</div>
              <div className="text-sm text-[#667085]">Claude Pro subscription</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#6F71EE] mb-2">$0</div>
              <div className="text-sm text-[#667085]">Vercel (free tier)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#6F71EE] mb-2">$25/mo</div>
              <div className="text-sm text-[#667085]">Supabase (small plan)</div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-[#667085]">
              <strong className="text-[#101E57]">The real cost is time and curiosity.</strong> Expect to spend
              evenings and weekends over several weeks. But unlike hiring a developer, you end up
              understanding your own product deeply—and you can keep improving it forever.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="mb-12">
        <div className="bg-[#101E57] rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Want to Build Something?
          </h2>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            The barrier to building software has never been lower. If you can describe what you want
            clearly, you can build it. Start with something small that would make your day easier.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-sm text-[#667085] pb-8">
        <p>
          Built with curiosity and AI by the LiveSchool team.
        </p>
      </footer>
    </PageContainer>
  );
}
