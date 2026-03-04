import { useEffect, useRef, useState } from 'react';
import { ONBOARDING_STEPS } from '@/shared/components/OnboardingModal/data/onboardingSteps';

export function useOnboardingSteps(isOpen: boolean) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isShaking, setIsShaking] = useState(false);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  const handleNext = () => {
    setCurrentStep((previous) => Math.min(previous + 1, ONBOARDING_STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep((previous) => Math.max(previous - 1, 1));
  };

  const handleShake = () => {
    setIsShaking(true);
    if (shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }
    shakeTimeoutRef.current = setTimeout(() => setIsShaking(false), 500);
  };

  const currentStepDefinition =
    ONBOARDING_STEPS[currentStep - 1] ?? ONBOARDING_STEPS[0];
  const stepTitles = ONBOARDING_STEPS.map((step) => step.title);

  return {
    currentStep,
    isShaking,
    handleNext,
    handleBack,
    handleShake,
    currentStepDefinition,
    stepTitles,
  };
}
