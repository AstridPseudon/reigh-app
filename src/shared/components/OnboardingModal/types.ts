export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface OnboardingStepProps {
  onNext: () => void;
  onClose: () => void;
}

type OnboardingStepComponent = React.ComponentType<OnboardingStepProps>;

export interface OnboardingStepDefinition {
  id: number;
  title: string;
  component: OnboardingStepComponent;
}
