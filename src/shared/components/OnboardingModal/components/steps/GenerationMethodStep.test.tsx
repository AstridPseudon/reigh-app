import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Children, cloneElement, isValidElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

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

vi.mock('@/shared/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

vi.mock('@/shared/components/ui/segmented-control', () => ({
  SegmentedControl: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => (
    <div>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) {
          return child;
        }
        return cloneElement(child as ReactElement<{ onSelect?: (value: string) => void }>, {
          onSelect: onValueChange,
          key: index,
        });
      })}
    </div>
  ),
  SegmentedControlItem: ({
    children,
    value,
    onSelect,
  }: {
    children: ReactNode;
    value: string;
    onSelect?: (value: string) => void;
  }) => <button onClick={() => onSelect?.(value)}>{children}</button>,
}));

import { GenerationMethodStep } from './GenerationMethodStep';

beforeEach(() => {
  mockUseUserUIState.mockReset();
});

describe('GenerationMethodStep', () => {
  it('renders loading skeleton when generation methods are loading', () => {
    mockUseUserUIState.mockReturnValue({
      value: { onComputer: true, inCloud: true },
      update: vi.fn(),
      isLoading: true,
    });

    render(<GenerationMethodStep onNext={vi.fn()} />);

    expect(screen.getByText('How would you like to generate?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('shows empty-state prompt and updates selection through segmented controls', () => {
    const update = vi.fn();

    mockUseUserUIState.mockReturnValue({
      value: { onComputer: false, inCloud: false },
      update,
      isLoading: false,
    });

    render(<GenerationMethodStep onNext={vi.fn()} />);

    expect(screen.getByText('Select at least one option to continue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'In the cloud ☁️' }));
    expect(update).toHaveBeenCalledWith({ inCloud: true, onComputer: false });

    fireEvent.click(screen.getByRole('button', { name: 'On my computer 💻' }));
    expect(update).toHaveBeenCalledWith({ onComputer: true, inCloud: false });
  });

  it('enables continue and calls onNext when a local generation method is selected', () => {
    const onNext = vi.fn();

    mockUseUserUIState.mockReturnValue({
      value: { onComputer: true, inCloud: false },
      update: vi.fn(),
      isLoading: false,
    });

    render(<GenerationMethodStep onNext={onNext} />);

    expect(screen.getByText(/Free to use, requires setup/i)).toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeEnabled();

    fireEvent.click(continueButton);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('shows cloud-specific helper text for cloud-only selection', () => {
    mockUseUserUIState.mockReturnValue({
      value: { onComputer: false, inCloud: true },
      update: vi.fn(),
      isLoading: false,
    });

    render(<GenerationMethodStep onNext={vi.fn()} />);

    expect(screen.getByText(/Easy setup, pay-per-use/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});
