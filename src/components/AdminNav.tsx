'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Navigation organized by frequency of use:
// Daily ops (Hannah's main workflow) -> Insights -> Setup/Config
const navItems = [
  { href: '/admin', label: 'Events', exact: true },
  { href: '/admin/sessions', label: 'Today' },
  { href: '/admin/analytics', label: 'Topics' },
  { href: '/admin/routing', label: 'Routing' },
  { href: '/admin/team', label: 'Team' },
  { href: '/admin/team-health', label: 'Health' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminNav() {
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
    </nav>
  );
}
