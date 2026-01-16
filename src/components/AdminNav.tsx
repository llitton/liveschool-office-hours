'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Navigation organized by frequency of use:
// Daily ops (Hannah's main workflow) -> Insights -> Setup/Config
const navItems = [
  { href: '/admin', label: 'Events', exact: true },
  { href: '/admin/analytics', label: 'Topics' },
  { href: '/admin/routing', label: 'Routing' },
  { href: '/admin/team', label: 'Team' },
  { href: '/admin/team-health', label: 'Health' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/settings', label: 'Settings' },
];

interface AdminNavProps {
  currentPage?: string;
}

export default function AdminNav({ currentPage }: AdminNavProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
            isActive(item.href, item.exact)
              ? 'bg-[#6F71EE] text-white'
              : 'text-[#667085] hover:text-[#101E57] hover:bg-gray-100'
          }`}
        >
          {item.label}
        </Link>
      ))}
      {/* Help link */}
      <Link
        href="/admin/help"
        className={`ml-2 px-2 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1 ${
          currentPage === 'help' || pathname === '/admin/help'
            ? 'bg-[#6F71EE] text-white'
            : 'text-[#667085] hover:text-[#101E57] hover:bg-gray-100'
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
    </nav>
  );
}
