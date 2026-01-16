'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminHeaderProps {
  email: string;
  userName?: string;
  profileImage?: string | null;
}

// Primary nav items
const navItems = [
  { href: '/admin', label: 'Sessions', matchPaths: ['/admin', '/admin/events', '/admin/upcoming', '/admin/past'] },
  { href: '/admin/prepare', label: 'Prepare', matchPaths: ['/admin/prepare', '/admin/analytics'] },
  { href: '/admin/people', label: 'People', matchPaths: ['/admin/people', '/admin/team', '/admin/routing'] },
  { href: '/admin/insights', label: 'Insights', matchPaths: ['/admin/insights', '/admin/team-health'] },
  { href: '/admin/integrations', label: 'Integrations', matchPaths: ['/admin/integrations'] },
  { href: '/admin/settings', label: 'Settings', matchPaths: ['/admin/settings'] },
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

function UserMenu({ email, userName, profileImage }: { email: string; userName?: string; profileImage?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = userName || email.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#F6F6F9] transition"
      >
        {profileImage ? (
          <img src={profileImage} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#101E57] text-white flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
        <svg
          className={`w-4 h-4 text-[#667085] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#E0E0E0] py-2 z-50">
          <div className="px-4 py-2 border-b border-[#E0E0E0]">
            <p className="text-sm font-medium text-[#101E57]">{displayName}</p>
            <p className="text-xs text-[#667085] truncate">{email}</p>
          </div>
          <div className="py-1">
            <Link
              href="/admin/settings"
              className="block px-4 py-2 text-sm text-[#101E57] hover:bg-[#F6F6F9] transition"
              onClick={() => setIsOpen(false)}
            >
              Account settings
            </Link>
            <Link
              href="/admin/help"
              className="block px-4 py-2 text-sm text-[#101E57] hover:bg-[#F6F6F9] transition md:hidden"
              onClick={() => setIsOpen(false)}
            >
              Help
            </Link>
          </div>
          <div className="border-t border-[#E0E0E0] py-1">
            <a
              href="/api/auth/logout"
              className="block px-4 py-2 text-sm text-[#667085] hover:bg-[#F6F6F9] transition"
            >
              Sign out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminHeader({ email, userName, profileImage }: AdminHeaderProps) {
  const pathname = usePathname();

  const isActive = (item: typeof navItems[0]) => {
    return item.matchPaths.some(path =>
      path === pathname || pathname.startsWith(path + '/')
    );
  };

  const isSubActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // Determine current section for sub-nav
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
    <header className="bg-white border-b border-[#E0E0E0] sticky top-0 z-40">
      {/* Main header row */}
      <div className="h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Left: Logo + Product name */}
          <div className="flex items-center gap-2.5">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Image
                src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
                alt="LiveSchool"
                width={100}
                height={26}
                className="h-[26px] w-auto"
              />
              <span className="text-[#101E57] text-[15px] font-semibold">Sessions</span>
            </Link>
          </div>

          {/* Center: Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-2 text-[14px] font-medium rounded-lg transition ${
                    active
                      ? 'text-[#101E57]'
                      : 'text-[#667085] hover:text-[#101E57] hover:bg-[#F6F6F9]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#6F71EE] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Help + User menu */}
          <div className="flex items-center gap-2">
            <Link
              href="/admin/help"
              className={`hidden md:flex p-2 rounded-lg transition ${
                pathname === '/admin/help'
                  ? 'text-[#101E57] bg-[#F6F6F9]'
                  : 'text-[#667085] hover:text-[#101E57] hover:bg-[#F6F6F9]'
              }`}
              title="Help"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Link>
            <UserMenu email={email} userName={userName} profileImage={profileImage} />
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      {currentSubNav && (
        <div className="border-t border-[#E0E0E0] bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center gap-6 h-10 -mb-px">
              {currentSubNav.map((item) => {
                const active = isSubActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative text-[13px] font-medium py-2.5 transition ${
                      active
                        ? 'text-[#101E57]'
                        : 'text-[#667085] hover:text-[#101E57]'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6F71EE] rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
