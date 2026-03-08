import { Globe, Loader2 } from 'lucide-react';
import { DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { PrivacyToggle } from '@/shared/components/ui/privacy-toggle';
import { useUserUIState } from '@/shared/hooks/useUserUIState';
import { getStepColors } from '@/shared/components/OnboardingModal/lib/onboardingColors';
import { OnboardingStepWithContinue } from '@/shared/components/OnboardingModal/components/OnboardingStepWithContinue';
import type { OnboardingStepProps } from '@/shared/components/OnboardingModal/types';

export function PrivacyDefaultsStep({ onNext }: OnboardingStepProps) {
  const colors = getStepColors(5);

  const {
    value: privacyDefaults,
    update: updatePrivacyDefaults,
    isLoading: isLoadingPrivacyDefaults,
  } = useUserUIState('privacyDefaults', {
    resourcesPublic: true,
    generationsPublic: false,
  });

  if (isLoadingPrivacyDefaults) {
    return (
      <>
        <DialogHeader className="text-center space-y-4 mb-6">
          <div className={`mx-auto w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center`}>
            <Globe className={`w-8 h-8 ${colors.icon}`} />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            Privacy Defaults
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <OnboardingStepWithContinue onNext={onNext}>
      <DialogHeader className="text-center space-y-4 mb-6">
        <div className={`mx-auto w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center`}>
          <Globe className={`w-8 h-8 ${colors.icon}`} />
        </div>
        <DialogTitle className="text-2xl font-bold text-center">
          Are you okay with your creations being public?
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <span className="font-medium text-sm">Resources</span>
            <p className="text-xs text-muted-foreground leading-snug">
              This will allow others to use them. You can update this for
              individual resources.
            </p>
            <PrivacyToggle
              isPublic={privacyDefaults.resourcesPublic}
              onValueChange={(isPublic) =>
                updatePrivacyDefaults({ resourcesPublic: isPublic })
              }
              size="sm"
            />
          </div>

          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <span className="font-medium text-sm">Generations</span>
            <p className="text-xs text-muted-foreground leading-snug">
              This will allow others to view your generations, and train LoRAs on
              them.
            </p>
            <PrivacyToggle
              isPublic={privacyDefaults.generationsPublic}
              onValueChange={(isPublic) =>
                updatePrivacyDefaults({ generationsPublic: isPublic })
              }
              size="sm"
            />
          </div>
        </div>
      </div>

    </OnboardingStepWithContinue>
  );
}
