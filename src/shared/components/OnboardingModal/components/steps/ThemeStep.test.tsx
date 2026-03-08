import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Children, cloneElement, isValidElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseDarkMode = vi.fn();
const mockUseUserUIState = vi.fn();

vi.mock('@/shared/hooks/core/useDarkMode', () => ({
  useDarkMode: () => mockUseDarkMode(),
}));

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
  }) => (
    <button type="button" onClick={() => onSelect?.(value)}>
      {children}
    </button>
  ),
}));

import { ThemeStep } from './ThemeStep';

beforeEach(() => {
  mockUseDarkMode.mockReset();
  mockUseUserUIState.mockReset();
});

describe('ThemeStep', () => {
  it('renders theme chooser content', () => {
    mockUseDarkMode.mockReturnValue({ darkMode: true, setDarkMode: vi.fn() });
    mockUseUserUIState.mockReturnValue({ update: vi.fn() });

    render(<ThemeStep onNext={vi.fn()} />);

    expect(screen.getByText('Choose Your Theme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('updates dark mode preference when selecting light mode', () => {
    const setDarkMode = vi.fn();
    const update = vi.fn();

    mockUseDarkMode.mockReturnValue({ darkMode: true, setDarkMode });
    mockUseUserUIState.mockReturnValue({ update });

    render(<ThemeStep onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));

    expect(setDarkMode).toHaveBeenCalledWith(false);
    expect(update).toHaveBeenCalledWith({ darkMode: false });
  });

  it('updates dark mode preference when selecting dark mode', () => {
    const setDarkMode = vi.fn();
    const update = vi.fn();

    mockUseDarkMode.mockReturnValue({ darkMode: false, setDarkMode });
    mockUseUserUIState.mockReturnValue({ update });

    render(<ThemeStep onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(setDarkMode).toHaveBeenCalledWith(true);
    expect(update).toHaveBeenCalledWith({ darkMode: true });
  });

  it('calls onNext when continue is clicked', () => {
    const onNext = vi.fn();

    mockUseDarkMode.mockReturnValue({ darkMode: true, setDarkMode: vi.fn() });
    mockUseUserUIState.mockReturnValue({ update: vi.fn() });

    render(<ThemeStep onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
