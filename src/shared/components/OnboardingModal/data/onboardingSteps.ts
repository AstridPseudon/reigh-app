import { CommunityStep } from '@/shared/components/OnboardingModal/components/steps/CommunityStep';
import { GenerationMethodStep } from '@/shared/components/OnboardingModal/components/steps/GenerationMethodStep';
import { IntroductionStep } from '@/shared/components/OnboardingModal/components/steps/IntroductionStep';
import { PrivacyDefaultsStep } from '@/shared/components/OnboardingModal/components/steps/PrivacyDefaultsStep';
import { SetupCompleteStep } from '@/shared/components/OnboardingModal/components/steps/SetupCompleteStep';
import { ThemeStep } from '@/shared/components/OnboardingModal/components/steps/ThemeStep';
import type { OnboardingStepDefinition } from '@/shared/components/OnboardingModal/types';

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  { id: 1, title: 'Welcome', component: IntroductionStep },
  { id: 2, title: 'Community', component: CommunityStep },
  { id: 3, title: 'Generation', component: GenerationMethodStep },
  { id: 4, title: 'Theme', component: ThemeStep },
  { id: 5, title: 'Privacy', component: PrivacyDefaultsStep },
  { id: 6, title: 'Complete', component: SetupCompleteStep },
];
