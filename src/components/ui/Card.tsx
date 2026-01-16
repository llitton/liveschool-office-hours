import Link from 'next/link';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({
  children,
  className = '',
  hover = false,
  padding = 'none',
}: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-xl border border-[#E0E0E0]
        ${hover ? 'hover:border-[#6F71EE]/30 hover:shadow-sm transition' : ''}
        ${paddingClasses[padding]}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}

// Card with link wrapper
interface LinkCardProps extends CardProps {
  href: string;
}

export function LinkCard({ href, children, className = '', padding = 'none' }: LinkCardProps) {
  return (
    <Link
      href={href}
      className={`
        block bg-white rounded-xl border border-[#E0E0E0]
        hover:border-[#6F71EE]/30 hover:shadow-sm transition group
        ${paddingClasses[padding]}
        ${className}
      `.trim()}
    >
      {children}
    </Link>
  );
}

// Card header
interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="px-6 py-4 border-b border-[#E0E0E0] flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-[#101E57]">{title}</h3>
        {description && (
          <p className="text-sm text-[#667085] mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// Card body
interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}

// Card footer
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`px-6 py-4 border-t border-[#E0E0E0] bg-[#FAFAFA] ${className}`}>
      {children}
    </div>
  );
}

// Callout card (muted background)
interface CalloutCardProps {
  children: React.ReactNode;
  className?: string;
}

export function CalloutCard({ children, className = '' }: CalloutCardProps) {
  return (
    <div className={`bg-[#FAFAFA] rounded-xl border border-[#E0E0E0] p-5 ${className}`}>
      {children}
    </div>
  );
}

// Empty state card
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card padding="lg" className="text-center">
      {icon && (
        <div className="w-14 h-14 bg-[#F6F6F9] rounded-2xl flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[#101E57] mb-2">{title}</h3>
      <p className="text-[#667085] mb-6 max-w-md mx-auto">{description}</p>
      {action}
    </Card>
  );
}
