'use client';

import { OnboardingProvider } from '@/contexts/OnboardingContext';
import WelcomeChecklist from '@/components/WelcomeChecklist';
import OnboardingTour from '@/components/OnboardingTour';
import type { OnboardingState } from '@/types';

interface OnboardingWrapperProps {
  children: React.ReactNode;
  adminId?: string;
  initialState?: OnboardingState | null;
  hasGoogleConnected: boolean;
  hasEvents: boolean;
  hasSlots: boolean;
  firstEventSlug?: string;
}

export default function OnboardingWrapper({
  children,
  adminId,
  initialState,
  hasGoogleConnected,
  hasEvents,
  hasSlots,
  firstEventSlug,
}: OnboardingWrapperProps) {
  return (
    <OnboardingProvider adminId={adminId} initialState={initialState}>
      {children}
      {/* Checklist - positioned absolutely within the main content */}
      <div className="fixed bottom-6 right-6 z-40 w-[400px] max-w-[calc(100vw-48px)]">
        <WelcomeChecklist
          hasGoogleConnected={hasGoogleConnected}
          hasEvents={hasEvents}
          hasSlots={hasSlots}
          firstEventSlug={firstEventSlug}
        />
      </div>
      {/* Tour overlay */}
      <OnboardingTour />
    </OnboardingProvider>
  );
}
