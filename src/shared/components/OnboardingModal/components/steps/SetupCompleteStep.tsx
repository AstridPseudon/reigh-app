import { MoreHorizontal, Settings } from 'lucide-react';
import { DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { dispatchAppEvent } from '@/shared/lib/typedEvents';
import { getStepColors } from '@/shared/components/OnboardingModal/lib/onboardingColors';
import type { OnboardingStepProps } from '@/shared/components/OnboardingModal/types';

export function SetupCompleteStep({ onClose }: OnboardingStepProps) {
  const colors = getStepColors(6);

  const handleOpenSettings = () => {
    onClose();
    setTimeout(() => {
      dispatchAppEvent('openSettings', { tab: 'generate-locally' });
    }, 100);
  };

  return (
    <>
      <DialogHeader className="text-center space-y-4 mb-6">
        <div className={`mx-auto w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center`}>
          <MoreHorizontal className={`w-8 h-8 ${colors.icon}`} />
        </div>
        <DialogTitle className="text-2xl font-bold text-center">
          One more thing
        </DialogTitle>
      </DialogHeader>

      <div className="text-center space-y-4">
        <p className="text-muted-foreground">
          Reigh is an early-stage tool. If there's anything that isn't working
          for you or could be better, please drop into our Discord and leave a
          message in our #support channel or DM POM.
        </p>
        <p className="text-muted-foreground">
          There's no feedback too big or too small - so please share!
        </p>
      </div>

      <div className="flex flex-col gap-y-2 pt-5 pb-2">
        <Button variant="retro" size="retro-sm" onClick={handleOpenSettings} className="w-full">
          <Settings className="w-4 h-4 mr-2" />
          Open Settings to Get Set Up
        </Button>
        <Button variant="retro-secondary" size="retro-sm" onClick={onClose} className="w-full">
          Start Creating
        </Button>
      </div>
    </>
  );
}
