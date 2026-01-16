'use client';

import { useState, useRef, useEffect } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface FeatureTooltipProps {
  id: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}

export default function FeatureTooltip({
  id,
  title,
  description,
  position = 'bottom',
  children,
}: FeatureTooltipProps) {
  const { isTooltipDismissed, dismissTooltip } = useOnboarding();
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't show if dismissed
  if (isTooltipDismissed(id)) {
    return <>{children}</>;
  }

  const handleDismiss = () => {
    dismissTooltip(id);
    setIsOpen(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-white',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-white',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-white',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-white',
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      {children}
      <div ref={triggerRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-4 h-4 rounded-full bg-[#6F71EE]/10 text-[#6F71EE] flex items-center justify-center hover:bg-[#6F71EE]/20 transition text-xs font-medium"
          title="Learn more"
        >
          ?
        </button>
      </div>

      {isOpen && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 ${positionClasses[position]}`}
        >
          <div className="bg-white rounded-lg shadow-lg border border-[#E0E0E0] p-4 w-64">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-[#101E57] text-sm">{title}</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#667085] hover:text-[#101E57] transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-[#667085] mb-3">{description}</p>
            <button
              onClick={handleDismiss}
              className="text-xs text-[#6F71EE] hover:text-[#5355d1] font-medium"
            >
              Got it, don&apos;t show again
            </button>
          </div>
          {/* Arrow */}
          <div className={`absolute w-0 h-0 border-8 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
}

// Simple info tooltip without persistent dismissal
export function InfoTooltip({
  content,
  position = 'top',
}: {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="w-4 h-4 rounded-full bg-gray-100 text-[#667085] flex items-center justify-center hover:bg-gray-200 transition text-xs"
        title={content}
      >
        ?
      </button>

      {isOpen && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-[#101E57] text-white rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
