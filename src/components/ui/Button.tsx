import Link from 'next/link';
import { buttonVariants } from '@/lib/design-tokens';

type ButtonVariant = keyof typeof buttonVariants;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

interface LinkButtonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  href: string;
  external?: boolean;
  children: React.ReactNode;
  className?: string;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: '', // Default size is in the variant
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClass = buttonVariants[variant];
  const sizeClass = size === 'sm' ? sizeClasses.sm : '';

  return (
    <button
      className={`${baseClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  href,
  external = false,
  className = '',
  children,
}: LinkButtonProps) {
  const baseClass = buttonVariants[variant];
  const sizeClass = size === 'sm' ? sizeClasses.sm : '';
  const combinedClass = `${baseClass} ${sizeClass} ${className}`.trim();

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={combinedClass}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={combinedClass}>
      {children}
    </Link>
  );
}

// Icon button variant
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'tertiary';
  children: React.ReactNode;
}

export function IconButton({
  variant = 'ghost',
  className = '',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`p-2 rounded-lg transition ${
        variant === 'ghost'
          ? 'text-[#667085] hover:text-[#101E57] hover:bg-[#F6F6F9]'
          : 'text-[#6F71EE] hover:bg-[#6F71EE]/10'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
