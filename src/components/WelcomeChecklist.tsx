'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useOnboarding } from '@/contexts/OnboardingContext';
import type { OnboardingStep } from '@/types';

interface ChecklistStepData {
  id: OnboardingStep;
  title: string;
  description: string;
  action: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  checkComplete?: boolean;
}

interface WelcomeChecklistProps {
  hasGoogleConnected: boolean;
  hasEvents: boolean;
  firstEventSlug?: string;
}

export default function WelcomeChecklist({
  hasGoogleConnected,
  hasEvents,
  firstEventSlug,
}: WelcomeChecklistProps) {
  const { state, completeStep, isStepComplete, dismissChecklist, startTour } = useOnboarding();
  const [copiedLink, setCopiedLink] = useState(false);

  // Don't render if checklist is dismissed
  if (state.checklistDismissed) {
    return null;
  }

  const handleCopyLink = async () => {
    if (!firstEventSlug) return;
    const url = `${window.location.origin}/book/${firstEventSlug}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    completeStep('share');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const steps: ChecklistStepData[] = [
    {
      id: 'google',
      title: 'Connect Google Calendar',
      description: 'Sync your calendar to automatically block busy times and create Google Meet links.',
      action: {
        label: hasGoogleConnected ? 'Connected' : 'Connect',
        href: '/admin/integrations',
      },
      checkComplete: hasGoogleConnected,
    },
    {
      id: 'event',
      title: 'Create Your First Event',
      description: 'Set up a 1:1, Group, or Round-Robin event. Use Quick Start templates or customize your own.',
      action: {
        label: hasEvents ? 'View Events' : 'Create Event',
        href: hasEvents ? '/admin' : '/admin/events/new',
      },
      checkComplete: hasEvents,
    },
    {
      id: 'share',
      title: 'Share Your Booking Link',
      description: 'Send your booking link to let people schedule sessions with you.',
      action: {
        label: copiedLink ? 'Copied!' : 'Copy Link',
        onClick: handleCopyLink,
      },
      checkComplete: isStepComplete('share'),
    },
  ];

  // Mark steps as complete based on external state
  if (hasGoogleConnected && !isStepComplete('google')) {
    completeStep('google');
  }
  if (hasEvents && !isStepComplete('event')) {
    completeStep('event');
  }

  const completedCount = steps.filter(
    (step) => step.checkComplete || isStepComplete(step.id)
  ).length;
  const totalSteps = steps.length;
  const progress = (completedCount / totalSteps) * 100;

  // All steps complete - show celebration
  if (completedCount === totalSteps) {
    return (
      <div className="bg-gradient-to-r from-[#6F71EE]/10 to-[#5355d1]/10 rounded-xl p-6 border border-[#6F71EE]/20">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6F71EE] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#101E57]">You&apos;re all set!</h3>
              <p className="text-sm text-[#667085]">
                Your booking page is ready. People can now schedule sessions with you.
              </p>
            </div>
          </div>
          <button
            onClick={dismissChecklist}
            className="text-[#667085] hover:text-[#101E57] transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E0E0E0]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#6F71EE]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#101E57]">Welcome to LiveSchool Connect</h3>
              <p className="text-sm text-[#667085]">Complete these steps to start accepting bookings</p>
            </div>
          </div>
          <button
            onClick={dismissChecklist}
            className="text-[#667085] hover:text-[#101E57] transition p-1"
            title="Dismiss checklist"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6F71EE] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-[#667085]">
            {completedCount}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-[#E0E0E0]">
        {steps.map((step, index) => {
          const isComplete = step.checkComplete || isStepComplete(step.id);
          return (
            <div
              key={step.id}
              className={`px-6 py-4 flex items-start gap-4 ${isComplete ? 'bg-gray-50/50' : ''}`}
            >
              {/* Step number / check */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isComplete
                    ? 'bg-[#10B981] text-white'
                    : 'bg-[#F3F4F6] text-[#667085]'
                }`}
              >
                {isComplete ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4
                  className={`text-sm font-medium ${
                    isComplete ? 'text-[#667085]' : 'text-[#101E57]'
                  }`}
                >
                  {step.title}
                </h4>
                <p className="text-sm text-[#667085] mt-0.5">{step.description}</p>
              </div>

              {/* Action */}
              <div className="flex-shrink-0">
                {step.action.href ? (
                  <Link
                    href={step.action.href}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isComplete
                        ? 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                        : 'bg-[#6F71EE] text-white hover:bg-[#5355d1]'
                    }`}
                  >
                    {step.action.label}
                  </Link>
                ) : (
                  <button
                    onClick={step.action.onClick}
                    disabled={!firstEventSlug}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isComplete
                        ? 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                        : firstEventSlug
                        ? 'bg-[#6F71EE] text-white hover:bg-[#5355d1]'
                        : 'bg-gray-100 text-[#667085] cursor-not-allowed'
                    }`}
                  >
                    {step.action.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer - Take a tour link */}
      <div className="px-6 py-3 bg-gray-50 border-t border-[#E0E0E0]">
        <button
          onClick={startTour}
          className="text-sm text-[#6F71EE] hover:text-[#5355d1] font-medium flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Take a guided tour
        </button>
      </div>
    </div>
  );
}
