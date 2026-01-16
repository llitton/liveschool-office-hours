import { badgeVariants } from '@/lib/design-tokens';

type BadgeVariant = keyof typeof badgeVariants;

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'inactive', children, className = '' }: BadgeProps) {
  return (
    <span className={`${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Convenience exports for common badges
export function ActiveBadge({ children = 'Active' }: { children?: React.ReactNode }) {
  return <Badge variant="active">{children}</Badge>;
}

export function InactiveBadge({ children = 'Inactive' }: { children?: React.ReactNode }) {
  return <Badge variant="inactive">{children}</Badge>;
}

export function DraftBadge({ children = 'Draft' }: { children?: React.ReactNode }) {
  return <Badge variant="draft">{children}</Badge>;
}

export function ErrorBadge({ children = 'Error' }: { children?: React.ReactNode }) {
  return <Badge variant="error">{children}</Badge>;
}

export function NewBadge({ children = 'New' }: { children?: React.ReactNode }) {
  return <Badge variant="new">{children}</Badge>;
}

export function CountBadge({ count }: { count: number }) {
  return <Badge variant="count">{count}</Badge>;
}

// Connection status badge (for integrations)
interface ConnectionBadgeProps {
  connected: boolean;
}

export function ConnectionBadge({ connected }: ConnectionBadgeProps) {
  return (
    <Badge variant={connected ? 'active' : 'inactive'}>
      {connected ? 'Connected' : 'Not connected'}
    </Badge>
  );
}

// Attendance rate badge
interface AttendanceBadgeProps {
  rate: number | null;
}

export function AttendanceBadge({ rate }: AttendanceBadgeProps) {
  if (rate === null) return <Badge variant="inactive">No data</Badge>;
  if (rate >= 80) return <Badge variant="active">{Math.round(rate)}%</Badge>;
  if (rate >= 50) return <Badge variant="draft">{Math.round(rate)}%</Badge>;
  return <Badge variant="error">{Math.round(rate)}%</Badge>;
}
