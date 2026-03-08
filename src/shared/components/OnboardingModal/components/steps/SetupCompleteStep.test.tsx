import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockDispatchAppEvent = vi.fn();

vi.mock('@/shared/lib/typedEvents', () => ({
  dispatchAppEvent: (...args: unknown[]) => mockDispatchAppEvent(...args),
}));

vi.mock('@/shared/components/ui/dialog', () => ({
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

import { SetupCompleteStep } from './SetupCompleteStep';

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('SetupCompleteStep', () => {
  it('renders final setup messaging and actions', () => {
    render(<SetupCompleteStep onClose={vi.fn()} />);

    expect(screen.getByText('One more thing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Settings to Get Set Up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Creating' })).toBeInTheDocument();
  });

  it('calls onClose immediately and dispatches openSettings after timeout', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(<SetupCompleteStep onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings to Get Set Up' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockDispatchAppEvent).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(mockDispatchAppEvent).toHaveBeenCalledWith('openSettings', {
      tab: 'generate-locally',
    });
  });

  it('starts creating immediately when secondary action is clicked', () => {
    const onClose = vi.fn();

    render(<SetupCompleteStep onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Creating' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockDispatchAppEvent).not.toHaveBeenCalled();
  });
});
