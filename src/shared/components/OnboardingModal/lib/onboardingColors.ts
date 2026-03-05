interface OnboardingStepColors {
  bg: string;
  icon: string;
}

export function getStepColors(stepIndex: number): OnboardingStepColors {
  const colors: OnboardingStepColors[] = [
    { bg: 'bg-accent', icon: 'text-primary' },
    { bg: 'bg-secondary', icon: 'text-secondary-foreground' },
    { bg: 'bg-muted', icon: 'text-foreground' },
    { bg: 'bg-accent', icon: 'text-primary' },
    { bg: 'bg-secondary', icon: 'text-secondary-foreground' },
    { bg: 'bg-muted', icon: 'text-foreground' },
    { bg: 'bg-accent', icon: 'text-primary' },
  ];

  return colors[(stepIndex - 1) % colors.length];
}
