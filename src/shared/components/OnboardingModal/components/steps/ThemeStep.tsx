import { Moon, Sun } from 'lucide-react';
import { DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/shared/components/ui/segmented-control';
import { useDarkMode } from '@/shared/hooks/core/useDarkMode';
import { useUserUIState } from '@/shared/hooks/useUserUIState';
import { getStepColors } from '@/shared/components/OnboardingModal/lib/onboardingColors';
import { OnboardingStepWithContinue } from '@/shared/components/OnboardingModal/components/OnboardingStepWithContinue';
import type { OnboardingStepProps } from '@/shared/components/OnboardingModal/types';

export function ThemeStep({ onNext }: OnboardingStepProps) {
  const colors = getStepColors(4);
  const { darkMode, setDarkMode } = useDarkMode();
  const { update: updateThemePreference } = useUserUIState('theme', { darkMode: true });

  const handleThemeChange = (isDark: boolean) => {
    setDarkMode(isDark);
    updateThemePreference({ darkMode: isDark });
  };

  return (
    <OnboardingStepWithContinue onNext={onNext}>
      <DialogHeader className="text-center space-y-4 mb-6">
        <div className={`mx-auto w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center`}>
          {darkMode ? (
            <Moon className={`w-8 h-8 ${colors.icon}`} />
          ) : (
            <Sun className={`w-8 h-8 ${colors.icon}`} />
          )}
        </div>
        <DialogTitle className="text-2xl font-bold text-center">
          Choose Your Theme
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        <p className="text-center text-muted-foreground">
          Which mode do you prefer? You can always change this later in settings.
        </p>

        <div className="flex justify-center px-4">
          <SegmentedControl
            value={darkMode ? 'dark' : 'light'}
            onValueChange={(value) => handleThemeChange(value === 'dark')}
            variant="pill"
          >
            <SegmentedControlItem value="light" colorScheme="amber" icon={<Sun className="h-4 w-4" />}>
              Light
            </SegmentedControlItem>
            <SegmentedControlItem value="dark" colorScheme="violet" icon={<Moon className="h-4 w-4" />}>
              Dark
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>

    </OnboardingStepWithContinue>
  );
}
