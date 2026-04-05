// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SelectionContextMenu } from './SelectionContextMenu';

describe('SelectionContextMenu', () => {
  it('renders into document.body and forwards menu actions', () => {
    const onCreateShot = vi.fn();
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

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreateShot).toHaveBeenCalledTimes(1);
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
});
