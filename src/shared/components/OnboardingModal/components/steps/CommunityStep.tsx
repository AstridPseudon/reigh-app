import { Users } from 'lucide-react';
import { DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { getStepColors } from '@/shared/components/OnboardingModal/lib/onboardingColors';
import type { OnboardingStepProps } from '@/shared/components/OnboardingModal/types';

export function CommunityStep({ onNext }: OnboardingStepProps) {
  const colors = getStepColors(2);

  return (
    <>
      <DialogHeader className="text-center space-y-4 mb-6">
        <div className={`mx-auto w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center`}>
          <Users className={`w-8 h-8 ${colors.icon}`} />
        </div>
        <DialogTitle className="text-2xl font-bold text-center">
          Join Our Community
        </DialogTitle>
      </DialogHeader>

      <div className="text-center space-y-4">
        <p className="text-muted-foreground">
          If you want to get good at creating art, the hardest part is not
          giving up.
        </p>
        <p className="text-muted-foreground">
          Our community will grow to become a place where artists can learn
          from, support, and inspire each other.
        </p>
      </div>

      <div className="flex flex-col gap-y-2 pt-5 pb-2">
        <Button
          variant="retro"
          size="retro-sm"
          onClick={() => window.open('https://discord.gg/D5K2c6kfhy', '_blank')}
          className="w-full"
        >
          <Users className="w-4 h-4 mr-2" />
          Join Discord Community
        </Button>
        <Button variant="retro-secondary" size="retro-sm" onClick={onNext} className="w-full">
          Continue Setup
        </Button>
      </div>
    </>
  );
}
