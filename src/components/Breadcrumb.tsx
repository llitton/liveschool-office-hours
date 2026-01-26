'use client';

import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  size?: 'sm' | 'base' | 'lg';
}

export default function Breadcrumb({ items, size = 'sm' }: BreadcrumbProps) {
  const sizeClasses = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
  };

  return (
    <nav className={`flex items-center gap-2 ${sizeClasses[size]}`}>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          {index > 0 && <span className="text-[#667085]">/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="text-[#6F71EE] hover:text-[#5a5cd0] font-medium"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#101E57] font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
