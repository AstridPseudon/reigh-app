import React from 'react';
import { OnboardingContinueButton } from './OnboardingContinueButton';

interface OnboardingStepWithContinueProps {
  onNext: () => void;
  children: React.ReactNode;
}

export function OnboardingStepWithContinue({
  onNext,
  children,
}: OnboardingStepWithContinueProps) {
  return (
    <>
      {children}
      <OnboardingContinueButton onClick={onNext} />
    </>
  );
}
