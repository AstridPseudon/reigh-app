import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

function OnboardingContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center pt-5 pb-2">
      <Button variant="retro" size="retro-sm" onClick={onClick} className="w-full sm:w-auto">
        Continue
        <ChevronRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

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
