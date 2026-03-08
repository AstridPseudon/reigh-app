import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface OnboardingContinueButtonProps {
  onClick: () => void;
}

export function OnboardingContinueButton({ onClick }: OnboardingContinueButtonProps) {
  return (
    <div className="flex justify-center pt-5 pb-2">
      <Button variant="retro" size="retro-sm" onClick={onClick} className="w-full sm:w-auto">
        Continue
        <ChevronRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
