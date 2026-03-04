import { ChevronRight, Palette } from 'lucide-react';
import { DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { getStepColors } from '@/shared/components/OnboardingModal/lib/onboardingColors';
import type { OnboardingStepProps } from '@/shared/components/OnboardingModal/types';

export function IntroductionStep({ onNext }: OnboardingStepProps) {
  const colors = getStepColors(1);

  return (
    <>
      <DialogHeader className="text-center space-y-4 mb-6">
        <div className={`mx-auto w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center`}>
          <Palette className={`w-8 h-8 ${colors.icon}`} />
        </div>
        <DialogTitle className="text-2xl font-bold text-center">
          Welcome to Reigh!
        </DialogTitle>
      </DialogHeader>

      <div className="text-center space-y-4">
        <p className="text-muted-foreground">
          We believe that combining image anchoring with additional control
          mechanisms can allow artists to steer AI video with unparalleled
          precision and ease.
        </p>
        <p className="text-muted-foreground">
          Reigh aims to provide you with the best techniques in the open source
          AI art ecosystem for both generating anchor images, and travelling
          between them. We want to make the struggle of creating art that feels
          truly your own as easy as possible.
        </p>
      </div>

      <div className="flex justify-center pt-5 pb-2">
        <Button variant="retro" size="retro-sm" onClick={onNext} className="w-full sm:w-auto">
          Let's get started
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </>
  );
}
