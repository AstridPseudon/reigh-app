import { describe, expect, it } from 'vitest';
import { CommunityStep } from '@/shared/components/OnboardingModal/components/steps/CommunityStep';
import { GenerationMethodStep } from '@/shared/components/OnboardingModal/components/steps/GenerationMethodStep';
import { IntroductionStep } from '@/shared/components/OnboardingModal/components/steps/IntroductionStep';
import { PrivacyDefaultsStep } from '@/shared/components/OnboardingModal/components/steps/PrivacyDefaultsStep';
import { SetupCompleteStep } from '@/shared/components/OnboardingModal/components/steps/SetupCompleteStep';
import { ThemeStep } from '@/shared/components/OnboardingModal/components/steps/ThemeStep';
import { ONBOARDING_STEPS } from './onboardingSteps';

describe('ONBOARDING_STEPS', () => {
  it('defines six ordered onboarding steps with stable ids and titles', () => {
    expect(ONBOARDING_STEPS).toHaveLength(6);
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ONBOARDING_STEPS.map((step) => step.title)).toEqual([
      'Welcome',
      'Community',
      'Generation',
      'Theme',
      'Privacy',
      'Complete',
    ]);
  });

  it('maps each step id to the intended component', () => {
    expect(ONBOARDING_STEPS[0].component).toBe(IntroductionStep);
    expect(ONBOARDING_STEPS[1].component).toBe(CommunityStep);
    expect(ONBOARDING_STEPS[2].component).toBe(GenerationMethodStep);
    expect(ONBOARDING_STEPS[3].component).toBe(ThemeStep);
    expect(ONBOARDING_STEPS[4].component).toBe(PrivacyDefaultsStep);
    expect(ONBOARDING_STEPS[5].component).toBe(SetupCompleteStep);
  });
});
