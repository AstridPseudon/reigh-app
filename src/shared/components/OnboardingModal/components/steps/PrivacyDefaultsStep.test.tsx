import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseUserUIState = vi.fn();

vi.mock('@/shared/hooks/useUserUIState', () => ({
  useUserUIState: (...args: unknown[]) => mockUseUserUIState(...args),
}));

vi.mock('@/shared/components/ui/dialog', () => ({
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock('@/shared/components/ui/composed/privacy-toggle', () => ({
  PrivacyToggle: ({
    isPublic,
    onValueChange,
  }: {
    isPublic: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label={isPublic ? 'privacy-toggle-public' : 'privacy-toggle-private'}
      onClick={() => onValueChange(!isPublic)}
    >
      {isPublic ? 'Public' : 'Private'}
    </button>
  ),
}));

import { PrivacyDefaultsStep } from './PrivacyDefaultsStep';

beforeEach(() => {
  mockUseUserUIState.mockReset();
});

describe('PrivacyDefaultsStep', () => {
  it('renders loading state while privacy defaults are loading', () => {
    mockUseUserUIState.mockReturnValue({
      value: { resourcesPublic: true, generationsPublic: false },
      update: vi.fn(),
      isLoading: true,
    });

    render(<PrivacyDefaultsStep onNext={vi.fn()} />);

    expect(screen.getByText('Privacy Defaults')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('renders both privacy sections and updates each setting', () => {
    const update = vi.fn();

    mockUseUserUIState.mockReturnValue({
      value: { resourcesPublic: true, generationsPublic: false },
      update,
      isLoading: false,
    });

    render(<PrivacyDefaultsStep onNext={vi.fn()} />);

    expect(screen.getByText('Are you okay with your creations being public?')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Generations')).toBeInTheDocument();

    const toggles = screen.getAllByRole('button', { name: /privacy-toggle/i });
    fireEvent.click(toggles[0]);
    fireEvent.click(toggles[1]);

    expect(update).toHaveBeenNthCalledWith(1, { resourcesPublic: false });
    expect(update).toHaveBeenNthCalledWith(2, { generationsPublic: true });
  });

  it('calls onNext when continue is clicked', () => {
    const onNext = vi.fn();

    mockUseUserUIState.mockReturnValue({
      value: { resourcesPublic: true, generationsPublic: false },
      update: vi.fn(),
      isLoading: false,
    });

    render(<PrivacyDefaultsStep onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
