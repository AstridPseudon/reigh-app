import { fireEvent, render, screen } from '@testing-library/react';
import type { RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPreview } from './CommandPreview';

describe('CommandPreview', () => {
  it('renders collapsed preview and triggers copy/reveal callbacks', () => {
    const onCopy = vi.fn();
    const onReveal = vi.fn();
    const onHide = vi.fn();
    const commandRef = { current: null } as RefObject<HTMLDivElement>;

    const { container } = render(
      <CommandPreview
        command="python run.py --arg value"
        copied={false}
        showFull={false}
        onCopy={onCopy}
        onReveal={onReveal}
        onHide={onHide}
        commandRef={commandRef}
      />,
    );

    expect(screen.getByText('python run.py --arg value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument();

    const gradientOverlay = container.querySelector('.pointer-events-none');
    expect(gradientOverlay).not.toBeNull();

    const previewBox = container.querySelector('.bg-gray-900.text-green-400');
    expect(previewBox).toHaveStyle({ height: '100px' });

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onHide).not.toHaveBeenCalled();
  });

  it('renders expanded preview with copied state and hide behavior', () => {
    const onCopy = vi.fn();
    const onReveal = vi.fn();
    const onHide = vi.fn();
    const commandRef = { current: null } as RefObject<HTMLDivElement>;

    const { container } = render(
      <CommandPreview
        command="npm run build"
        copied={true}
        showFull={true}
        onCopy={onCopy}
        onReveal={onReveal}
        onHide={onHide}
        commandRef={commandRef}
      />,
    );

    expect(screen.getByText('Copied!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    const gradientOverlay = container.querySelector('.pointer-events-none');
    expect(gradientOverlay).toBeNull();

    const previewBox = container.querySelector('.bg-gray-900.text-green-400');
    expect(previewBox).toHaveClass('overflow-x-auto');
    expect(previewBox).toHaveStyle({ height: 'auto' });

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));

    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onReveal).not.toHaveBeenCalled();
  });
});
