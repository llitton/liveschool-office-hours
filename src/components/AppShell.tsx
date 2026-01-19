'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// =============================================================================
// TYPES
// =============================================================================
interface AppShellProps {
  children: React.ReactNode;
}

interface SubNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

// =============================================================================
// NAVIGATION CONFIGURATION
// =============================================================================
const primaryNavItems = [
  {
    href: '/admin',
    label: 'Sessions',
    matchPaths: ['/admin', '/admin/events', '/admin/past'],
  },
  {
    href: '/admin/prepare',
    label: 'Upcoming',
    matchPaths: ['/admin/prepare'],
  },
  {
    href: '/admin/people',
    label: 'People',
    matchPaths: ['/admin/people', '/admin/team', '/admin/routing'],
  },
  {
    href: '/admin/insights',
    label: 'Insights',
    matchPaths: ['/admin/insights', '/admin/team-health'],
  },
  {
    href: '/admin/integrations',
    label: 'Integrations',
    matchPaths: ['/admin/integrations'],
  },
  {
    href: '/admin/sms',
    label: 'SMS',
    matchPaths: ['/admin/sms'],
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    matchPaths: ['/admin/settings'],
  },
];

const subNavConfig: Record<string, SubNavItem[]> = {
  sessions: [
    { href: '/admin', label: 'Today', exact: true },
    { href: '/admin/past', label: 'Past' },
    { href: '/admin/one-off', label: 'One-off' },
    { href: '/admin/polls', label: 'Polls' },
  ],
  // No sub-nav for "upcoming" - it's a single page now
  people: [
    { href: '/admin/people', label: 'Team', exact: true },
    { href: '/admin/people/routing', label: 'Routing' },
  ],
  insights: [
    { href: '/admin/insights', label: 'Overview', exact: true },
    { href: '/admin/insights/conversions', label: 'Conversions' },
    { href: '/admin/insights/attendance', label: 'Attendance' },
    { href: '/admin/insights/topics', label: 'Topics' },
  ],
  sms: [
    { href: '/admin/sms', label: 'Dashboard', exact: true },
    { href: '/admin/sms/logs', label: 'Logs' },
  ],
  settings: [
    { href: '/admin/settings', label: 'General', exact: true },
    { href: '/admin/settings/templates', label: 'Templates' },
  ],
};

// =============================================================================
// USER MENU COMPONENT
// =============================================================================
interface UserData {
  id: string;
  name: string | null;
  email: string;
  profile_image: string | null;
}

function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch user data
    fetch('/api/admin/me')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#F6F6F9] transition"
        aria-label="User menu"
      >
        {user?.profile_image ? (
          <img
            src={user.profile_image}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#101E57] text-white flex items-center justify-center text-sm font-medium">
            {initial}
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
            <p className="text-xs text-[#667085] truncate">{displayEmail}</p>
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
              href="/admin/how-we-built-this"
              className="block px-4 py-2 text-sm text-[#101E57] hover:bg-[#F6F6F9] transition"
              onClick={() => setIsOpen(false)}
            >
              How we built this
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

// =============================================================================
// HEADER COMPONENT
// =============================================================================
function Header() {
  const pathname = usePathname();

  const isNavActive = (item: typeof primaryNavItems[0]) => {
    return item.matchPaths.some(
      (path) => path === pathname || pathname.startsWith(path + '/')
    );
  };

  return (
    <header className="bg-white border-b border-[#E0E0E0] sticky top-0 z-40">
      <div className="h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Left: Logo + Product name */}
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

          {/* Center: Primary navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {primaryNavItems.map((item) => {
              const active = isNavActive(item);
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
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

// =============================================================================
// SUB-NAVIGATION COMPONENT
// =============================================================================
function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  const isActive = (item: SubNavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <div className="border-b border-[#E0E0E0] bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex items-center gap-6 h-10 -mb-px">
          {items.map((item) => {
            const active = isActive(item);
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
  );
}

// =============================================================================
// APP SHELL COMPONENT
// =============================================================================
export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // Determine current section for sub-nav
  const getCurrentSection = (): string | null => {
    if (
      pathname === '/admin' ||
      pathname.startsWith('/admin/events') ||
      pathname === '/admin/upcoming' ||
      pathname === '/admin/past' ||
      pathname.startsWith('/admin/one-off') ||
      pathname.startsWith('/admin/polls')
    ) {
      return 'sessions';
    }
    // No sub-nav for /admin/prepare (Upcoming) - it's a single page
    if (
      pathname.startsWith('/admin/people') ||
      pathname.startsWith('/admin/team') ||
      pathname.startsWith('/admin/routing')
    ) {
      return 'people';
    }
    if (pathname.startsWith('/admin/insights') || pathname.startsWith('/admin/team-health')) {
      return 'insights';
    }
    return null;
  };

  const currentSection = getCurrentSection();
  const subNavItems = currentSection ? subNavConfig[currentSection] : null;

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <Header />
      {subNavItems && <SubNav items={subNavItems} />}
      <main>{children}</main>
    </div>
  );
}

// =============================================================================
// PAGE LAYOUT COMPONENTS
// =============================================================================

// Standard page container
interface PageContainerProps {
  children: React.ReactNode;
  narrow?: boolean;
  className?: string;
}

export function PageContainer({ children, narrow = false, className = '' }: PageContainerProps) {
  return (
    <div
      className={`${narrow ? 'max-w-5xl' : 'max-w-7xl'} mx-auto px-4 py-8 ${className}`}
    >
      {children}
    </div>
  );
}

// Page header with title and optional action
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backLink?: { href: string; label: string };
}

export function PageHeader({ title, description, action, backLink }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {backLink && (
        <Link
          href={backLink.href}
          className="text-sm text-[#6F71EE] hover:underline flex items-center gap-1 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLink.label}
        </Link>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101E57] mb-2">{title}</h1>
          {description && <p className="text-[#667085]">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

// Two-column layout
interface TwoColumnLayoutProps {
  main: React.ReactNode;
  sidebar: React.ReactNode;
  sidebarPosition?: 'left' | 'right';
}

export function TwoColumnLayout({
  main,
  sidebar,
  sidebarPosition = 'right',
}: TwoColumnLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {sidebarPosition === 'left' && (
        <div className="lg:col-span-1">{sidebar}</div>
      )}
      <div className="lg:col-span-2">{main}</div>
      {sidebarPosition === 'right' && (
        <div className="lg:col-span-1">{sidebar}</div>
      )}
    </div>
  );
}
