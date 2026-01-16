'use client';

import { useOnboarding } from '@/contexts/OnboardingContext';
import Link from 'next/link';

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

const tourSteps: TourStep[] = [
  {
    title: 'Welcome to LiveSchool Connect!',
    description:
      "Let's take a quick tour to help you get started. This tool helps you schedule and manage sessions with educators.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
        />
      </svg>
    ),
  },
  {
    title: 'Your Events Dashboard',
    description:
      'The Events page is your home base. Here you can see all your booking events, their status, and how many people have signed up.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    action: {
      label: 'Go to Events',
      href: '/admin',
    },
  },
  {
    title: "Today's Sessions",
    description:
      "See all sessions happening today at a glance. You can join Google Meet directly, see who's registered, and start your wrap-up workflow after each session.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Create Your First Event',
    description:
      'Click "Create New Event" to set up a booking type. Choose from templates like Office Hours, Product Demo, or 1:1 Support to get started quickly.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 4v16m8-8H4"
        />
      </svg>
    ),
    action: {
      label: 'Create Event',
      href: '/admin/events/new',
    },
  },
  {
    title: 'Discover Topics',
    description:
      'The Topics page shows you what attendees want to discuss. Use this to prepare for sessions and identify common questions.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    action: {
      label: 'View Topics',
      href: '/admin/topics',
    },
  },
  {
    title: "You're All Set!",
    description:
      'You now know the basics of LiveSchool Connect. Check out the Help page anytime for more detailed guides. Happy scheduling!',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    action: {
      label: 'View Help Docs',
      href: '/admin/help',
    },
  },
];

export default function OnboardingTour() {
  const { state, nextTourStep, prevTourStep, skipTour, completeTour, isTourActive } = useOnboarding();

  if (!isTourActive || state.tourStep === null) {
    return null;
  }

  const currentStep = tourSteps[state.tourStep];
  const isFirstStep = state.tourStep === 0;
  const isLastStep = state.tourStep === tourSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      completeTour();
    } else {
      nextTourStep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={skipTour} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-[#6F71EE] transition-all duration-300"
            style={{ width: `${((state.tourStep + 1) / tourSteps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[#6F71EE]/10 flex items-center justify-center text-[#6F71EE] mb-6">
            {currentStep.icon}
          </div>

          {/* Text */}
          <h2 className="text-xl font-bold text-[#101E57] mb-3">{currentStep.title}</h2>
          <p className="text-[#667085] leading-relaxed mb-6">{currentStep.description}</p>

          {/* Action button */}
          {currentStep.action && (
            <div className="mb-6">
              {currentStep.action.href ? (
                <Link
                  href={currentStep.action.href}
                  className="inline-flex items-center gap-2 text-[#6F71EE] hover:text-[#5355d1] font-medium"
                >
                  {currentStep.action.label}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </Link>
              ) : (
                <button
                  onClick={currentStep.action.onClick}
                  className="inline-flex items-center gap-2 text-[#6F71EE] hover:text-[#5355d1] font-medium"
                >
                  {currentStep.action.label}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition ${
                    index === state.tourStep ? 'bg-[#6F71EE]' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              {!isFirstStep && (
                <button
                  onClick={prevTourStep}
                  className="px-4 py-2 text-sm font-medium text-[#667085] hover:text-[#101E57] transition"
                >
                  Back
                </button>
              )}
              {isFirstStep && (
                <button
                  onClick={skipTour}
                  className="px-4 py-2 text-sm font-medium text-[#667085] hover:text-[#101E57] transition"
                >
                  Skip Tour
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-[#6F71EE] text-white rounded-lg font-medium hover:bg-[#5355d1] transition"
              >
                {isLastStep ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
