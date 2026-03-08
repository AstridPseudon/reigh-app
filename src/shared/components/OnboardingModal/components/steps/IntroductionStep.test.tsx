import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/components/ui/dialog', () => ({
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

import { IntroductionStep } from './IntroductionStep';

describe('IntroductionStep', () => {
  it('renders onboarding introduction copy', () => {
    render(<IntroductionStep onNext={vi.fn()} />);

    expect(screen.getByText('Welcome to Reigh!')).toBeInTheDocument();
    expect(screen.getByText(/combining image anchoring/i)).toBeInTheDocument();
    expect(screen.getByText(/best techniques in the open source AI art ecosystem/i)).toBeInTheDocument();
  });

  it('calls onNext when starting onboarding', () => {
    const onNext = vi.fn();

    render(<IntroductionStep onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: "Let's get started" }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
