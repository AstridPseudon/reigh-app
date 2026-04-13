// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';
import type { Shot } from '@/domains/generation/types';

const { updateShotAspectRatioMock } = vi.hoisted(() => ({
  updateShotAspectRatioMock: vi.fn(),
}));

vi.mock('@/shared/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
}));

vi.mock('@/shared/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}));

vi.mock('@/shared/components/GenerationControls/AspectRatioSelector', () => ({
  AspectRatioSelector: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <button
      type="button"
      data-testid="aspect-ratio-selector"
      onClick={() => onValueChange('4:3')}
    >
      aspect:{value}
    </button>
  ),
}));

vi.mock('@/shared/hooks/shots', () => ({
  useUpdateShotAspectRatio: () => ({
    updateShotAspectRatio: updateShotAspectRatioMock,
  }),
}));

function createSelectedShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: 'shot-1',
    name: 'Shot 1',
    aspect_ratio: '16:9',
    ...overrides,
  } as Shot;
}

function renderHeader(overrides: Partial<React.ComponentProps<typeof Header>> = {}) {
  const props: React.ComponentProps<typeof Header> = {
    selectedShot: createSelectedShot(),
    isEditingName: false,
    editingName: 'Shot 1',
    onBack: vi.fn(),
    onUpdateShotName: vi.fn(),
    onPreviousShot: vi.fn(),
    onNextShot: vi.fn(),
    hasPrevious: true,
    hasNext: true,
    onNameClick: vi.fn(),
    onNameSave: vi.fn(),
    onNameCancel: vi.fn(),
    onNameKeyDown: vi.fn(),
    onEditingNameChange: vi.fn(),
    autoAdjustedInfo: null,
    onRevertAspectRatio: vi.fn(),
    onManualAspectRatioChange: vi.fn(),
    projectAspectRatio: '16:9',
    projectId: 'project-1',
    centerSectionRef: { current: null },
    isSticky: false,
    ...overrides,
  };

  return {
    ...render(<Header {...props} />),
    props,
  };
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateShotAspectRatioMock.mockResolvedValue(true);
  });

  it('renders the auto-adjust notice and revert button when autoAdjustedInfo is present', () => {
    renderHeader({
      autoAdjustedInfo: {
        previousAspectRatio: '1:1',
        adjustedTo: '16:9',
      },
    });

    const revertButton = screen.getByRole('button', { name: 'Revert to project dimensions' });
    expect(revertButton).toBeInTheDocument();
    expect(revertButton.parentElement?.className).toContain('absolute');
    expect(screen.getAllByTestId('aspect-ratio-selector')).toHaveLength(2);
  });

  it('calls onRevertAspectRatio when Revert is clicked', () => {
    const onRevertAspectRatio = vi.fn();

    renderHeader({
      autoAdjustedInfo: {
        previousAspectRatio: '1:1',
        adjustedTo: '16:9',
      },
      onRevertAspectRatio,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revert to project dimensions' }));

    expect(onRevertAspectRatio).toHaveBeenCalledTimes(1);
  });

  it('calls onManualAspectRatioChange when the aspect ratio selector changes', async () => {
    const onManualAspectRatioChange = vi.fn();

    renderHeader({
      onManualAspectRatioChange,
    });

    fireEvent.click(screen.getAllByTestId('aspect-ratio-selector')[0]);

    await waitFor(() => {
      expect(onManualAspectRatioChange).toHaveBeenCalledTimes(1);
    });
    expect(updateShotAspectRatioMock).toHaveBeenCalledWith('shot-1', 'project-1', '4:3');
  });
});
