'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { OnboardingState, OnboardingStep } from '@/types';
import { DEFAULT_ONBOARDING_STATE } from '@/types';

interface OnboardingContextType {
  state: OnboardingState;
  isLoading: boolean;
  // Checklist
  completeStep: (step: OnboardingStep) => void;
  isStepComplete: (step: OnboardingStep) => boolean;
  dismissChecklist: () => void;
  showChecklist: () => void;
  // Tour
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  isTourActive: boolean;
  // Tooltips
  dismissTooltip: (tooltipId: string) => void;
  isTooltipDismissed: (tooltipId: string) => boolean;
  // Welcome
  markWelcomeSeen: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_KEY = 'liveschool-onboarding';

interface OnboardingProviderProps {
  children: React.ReactNode;
  adminId?: string;
  initialState?: OnboardingState | null;
}

export function OnboardingProvider({
  children,
  adminId,
  initialState
}: OnboardingProviderProps) {
  const [state, setState] = useState<OnboardingState>(() => {
    // Use initial state from server if provided
    if (initialState) return initialState;
    return DEFAULT_ONBOARDING_STATE;
  });
  const [isLoading, setIsLoading] = useState(!initialState);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(prev => ({ ...prev, ...parsed }));
      } catch {
        // Ignore parse errors
      }
    }
    setIsLoading(false);
  }, []);

  // Persist to localStorage and API when state changes
  const persistState = useCallback(async (newState: OnboardingState) => {
    if (typeof window === 'undefined') return;

    // Save to localStorage immediately for fast UI updates
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));

    // Persist to database if we have an admin ID
    if (adminId) {
      try {
        await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId, state: newState }),
        });
      } catch {
        // Silently fail - localStorage is the source of truth for UI
      }
    }
  }, [adminId]);

  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  // Checklist methods
  const completeStep = useCallback((step: OnboardingStep) => {
    setState(prev => {
      if (prev.completedSteps.includes(step)) return prev;
      const newState = {
        ...prev,
        completedSteps: [...prev.completedSteps, step],
      };
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  const isStepComplete = useCallback((step: OnboardingStep) => {
    return state.completedSteps.includes(step);
  }, [state.completedSteps]);

  const dismissChecklist = useCallback(() => {
    updateState({ checklistDismissed: true });
  }, [updateState]);

  const showChecklist = useCallback(() => {
    updateState({ checklistDismissed: false });
  }, [updateState]);

  // Tour methods
  const TOUR_STEPS_COUNT = 6;

  const startTour = useCallback(() => {
    updateState({ tourStep: 0 });
  }, [updateState]);

  const nextTourStep = useCallback(() => {
    setState(prev => {
      if (prev.tourStep === null) return prev;
      const nextStep = prev.tourStep + 1;
      if (nextStep >= TOUR_STEPS_COUNT) {
        const newState = { ...prev, tourStep: null, tourCompleted: true };
        persistState(newState);
        return newState;
      }
      const newState = { ...prev, tourStep: nextStep };
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  const prevTourStep = useCallback(() => {
    setState(prev => {
      if (prev.tourStep === null || prev.tourStep === 0) return prev;
      const newState = { ...prev, tourStep: prev.tourStep - 1 };
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  const skipTour = useCallback(() => {
    updateState({ tourStep: null, tourCompleted: true });
  }, [updateState]);

  const completeTour = useCallback(() => {
    updateState({ tourStep: null, tourCompleted: true });
  }, [updateState]);

  const isTourActive = state.tourStep !== null;

  // Tooltip methods
  const dismissTooltip = useCallback((tooltipId: string) => {
    setState(prev => {
      if (prev.tooltipsDismissed.includes(tooltipId)) return prev;
      const newState = {
        ...prev,
        tooltipsDismissed: [...prev.tooltipsDismissed, tooltipId],
      };
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  const isTooltipDismissed = useCallback((tooltipId: string) => {
    return state.tooltipsDismissed.includes(tooltipId);
  }, [state.tooltipsDismissed]);

  // Welcome methods
  const markWelcomeSeen = useCallback(() => {
    updateState({ welcomeSeen: true });
  }, [updateState]);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        isLoading,
        completeStep,
        isStepComplete,
        dismissChecklist,
        showChecklist,
        startTour,
        nextTourStep,
        prevTourStep,
        skipTour,
        completeTour,
        isTourActive,
        dismissTooltip,
        isTooltipDismissed,
        markWelcomeSeen,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
