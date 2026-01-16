'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/settings', label: 'My Settings' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/team-health', label: 'Team Health' },
  { href: '/admin/routing', label: 'Routing' },
  { href: '/admin/integrations', label: 'Integrations' },
  { href: '/admin/team', label: 'Team' },
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
