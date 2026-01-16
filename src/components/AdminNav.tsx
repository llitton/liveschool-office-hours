'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Intent-based navigation: what the user wants to do, not database objects
// Sessions = "What's happening?" | Prepare = "Am I ready?" | People = "Who's involved?"
// Insights = "Is this working?" | Settings = "Everything else"

const primaryNavItems = [
  { href: '/admin', label: 'Sessions', exact: true, matchPaths: ['/admin', '/admin/events'] },
  { href: '/admin/prepare', label: 'Prepare', matchPaths: ['/admin/prepare', '/admin/analytics'] },
  { href: '/admin/people', label: 'People', matchPaths: ['/admin/people', '/admin/team', '/admin/routing'] },
  { href: '/admin/insights', label: 'Insights', matchPaths: ['/admin/insights', '/admin/team-health'] },
];

const secondaryNavItems = [
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/settings', label: 'Settings' },
];

// Sub-navigation for each section
const subNavItems: Record<string, { href: string; label: string; exact?: boolean }[]> = {
  sessions: [
    { href: '/admin', label: 'Today', exact: true },
    { href: '/admin/upcoming', label: 'Upcoming' },
    { href: '/admin/past', label: 'Past' },
  ],
  prepare: [
    { href: '/admin/prepare', label: 'Overview', exact: true },
    { href: '/admin/prepare/agenda', label: 'Agenda' },
    { href: '/admin/prepare/questions', label: 'Questions' },
    { href: '/admin/prepare/logistics', label: 'Logistics' },
    { href: '/admin/prepare/messaging', label: 'Messaging' },
  ],
  people: [
    { href: '/admin/people', label: 'Team', exact: true },
    { href: '/admin/people/routing', label: 'Routing' },
  ],
  insights: [
    { href: '/admin/insights', label: 'Overview', exact: true },
    { href: '/admin/insights/attendance', label: 'Attendance' },
    { href: '/admin/insights/topics', label: 'Topics' },
  ],
};

interface AdminNavProps {
  currentPage?: string;
  showSubNav?: boolean;
}

export default function AdminNav({ currentPage, showSubNav = true }: AdminNavProps) {
  const pathname = usePathname();

  const isActive = (item: typeof primaryNavItems[0]) => {
    if (item.exact && pathname === item.href) return true;
    return item.matchPaths?.some(path =>
      path === pathname || pathname.startsWith(path + '/')
    );
  };

  const isSubActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // Determine which section we're in for sub-nav
  const getCurrentSection = (): string | null => {
    if (pathname === '/admin' || pathname.startsWith('/admin/events') || pathname === '/admin/upcoming' || pathname === '/admin/past') {
      return 'sessions';
    }
    if (pathname.startsWith('/admin/prepare') || pathname === '/admin/analytics') {
      return 'prepare';
    }
    if (pathname.startsWith('/admin/people') || pathname.startsWith('/admin/team') || pathname.startsWith('/admin/routing')) {
      return 'people';
    }
    if (pathname.startsWith('/admin/insights') || pathname.startsWith('/admin/team-health')) {
      return 'insights';
    }
    return null;
  };

  const currentSection = getCurrentSection();
  const currentSubNav = currentSection ? subNavItems[currentSection] : null;

  return (
    <div className="border-b border-[#E0E0E0] bg-white">
      {/* Primary navigation */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left: Primary nav items */}
          <nav className="flex items-center gap-1">
            {primaryNavItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#101E57] text-white shadow-sm'
                      : 'text-[#667085] hover:text-[#101E57] hover:bg-[#F6F6F9]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Secondary nav + Help */}
          <div className="flex items-center gap-1">
            {secondaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm transition ${
                  pathname.startsWith(item.href)
                    ? 'text-[#101E57] font-medium'
                    : 'text-[#98A2B3] hover:text-[#667085]'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="w-px h-5 bg-[#E0E0E0] mx-2" />

            {/* Help icon */}
            <Link
              href="/admin/help"
              className={`p-2 rounded-md transition ${
                currentPage === 'help' || pathname === '/admin/help'
                  ? 'text-[#101E57] bg-[#F6F6F9]'
                  : 'text-[#98A2B3] hover:text-[#667085] hover:bg-[#F6F6F9]'
              }`}
              title="Help"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      {showSubNav && currentSubNav && (
        <div className="bg-[#FAFAFA] border-t border-[#E0E0E0]">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center gap-6 h-10">
              {currentSubNav.map((item) => {
                const active = isSubActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm transition-all border-b-2 -mb-px py-2.5 ${
                      active
                        ? 'text-[#101E57] font-medium border-[#6F71EE]'
                        : 'text-[#667085] hover:text-[#101E57] border-transparent'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
