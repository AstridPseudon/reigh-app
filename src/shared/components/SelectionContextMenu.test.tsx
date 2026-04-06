// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SelectionContextMenu } from './SelectionContextMenu';

describe('SelectionContextMenu', () => {
  it('renders into document.body and forwards menu actions', async () => {
    const onCreateShot = vi.fn().mockResolvedValue(null);
    const onGenerateVideo = vi.fn();
    const onClose = vi.fn();

    render(
      <SelectionContextMenu
        position={{ x: 24, y: 48 }}
        onClose={onClose}
        onCreateShot={onCreateShot}
        onGenerateVideo={onGenerateVideo}
      />,
    );

    const createShotButton = screen.getByRole('button', { name: 'Create Shot' });
    expect(document.body).toContainElement(createShotButton);

    fireEvent.click(createShotButton);

    await waitFor(() => {
      expect(onCreateShot).toHaveBeenCalledTimes(1);
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(onGenerateVideo).not.toHaveBeenCalled();
  });

  it('closes on escape and click-away', () => {
    const onClose = vi.fn();

    render(
      <div>
        <button type="button">outside</button>
        <SelectionContextMenu
          position={{ x: 24, y: 48 }}
          onClose={onClose}
          onCreateShot={vi.fn()}
          onGenerateVideo={vi.fn()}
        />
      </div>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders existing shots above creation actions and filters out the inline created shot', async () => {
    const onNavigateToShot = vi.fn();
    const onOpenGenerateVideo = vi.fn();

    render(
      <SelectionContextMenu
        position={{ x: 24, y: 48 }}
        onClose={vi.fn()}
        onCreateShot={vi.fn().mockResolvedValue({ id: 'shot-1', name: 'Shot 1' })}
        onGenerateVideo={vi.fn()}
        onNavigateToShot={onNavigateToShot}
        onOpenGenerateVideo={onOpenGenerateVideo}
        existingShots={[
          { id: 'shot-1', name: 'Shot 1' },
          { id: 'shot-2', name: 'Shot 2' },
        ]}
      />,
    );

    // Existing shots render as compact rows: name + icon buttons
    expect(screen.getByText('Shot 1')).toBeInTheDocument();
    expect(screen.getByText('Shot 2')).toBeInTheDocument();
    expect(screen.getAllByTitle('Jump to shot')).toHaveLength(2);
    expect(screen.getAllByTitle('Generate Video')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Create Shot' }));

    // After creating Shot 1, it moves from existing list to inline — only Shot 2 remains in compact row
    await waitFor(() => {
      expect(screen.queryAllByText('Shot 1')).toHaveLength(1); // inline "Jump to Shot 1"
    });
    expect(screen.getByText('Shot 2')).toBeInTheDocument();

    // Click Shot 2's jump and generate icon buttons
    const shot2Row = screen.getByText('Shot 2').closest('div')!;
    fireEvent.click(shot2Row.querySelector('[title="Jump to shot"]')!);
    fireEvent.click(shot2Row.querySelector('[title="Generate Video"]')!);

    expect(onNavigateToShot).toHaveBeenCalledWith({ id: 'shot-2', name: 'Shot 2' });
    expect(onOpenGenerateVideo).toHaveBeenCalledWith({ id: 'shot-2', name: 'Shot 2' });
  });
});
