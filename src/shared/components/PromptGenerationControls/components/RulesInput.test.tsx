import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { RulesInput } from './RulesInput';

vi.mock('@/shared/components/ui/primitives/label', () => ({
  Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock('@/shared/components/ui/textarea', () => ({
  Textarea: ({
    id,
    value,
    onChange,
    onKeyDown,
    onFocus,
    placeholder,
    rows,
    disabled,
    onClear,
    onVoiceResult,
  }: Record<string, unknown>) => (
    <div>
      <textarea
        id={id as string}
        value={value as string}
        onChange={onChange as (event: Event) => void}
        onKeyDown={onKeyDown as (event: Event) => void}
        onFocus={onFocus as (event: Event) => void}
        placeholder={placeholder as string}
        rows={rows as number}
        disabled={disabled as boolean}
      />
      <button type="button" onClick={() => onClear?.()}>clear</button>
      <button
        type="button"
        onClick={() => onVoiceResult?.({ prompt: 'voice prompt', transcription: '' })}
      >
        voice
      </button>
      <button
        type="button"
        onClick={() => onVoiceResult?.({ prompt: '• bullet prompt', transcription: '' })}
      >
        voice-bullet
      </button>
      <button
        type="button"
        onClick={() =>
          onKeyDown?.({
            key: 'Backspace',
            preventDefault: vi.fn(),
            target: {
              selectionStart: 7,
              selectionEnd: 7,
              value: 'first\n• ',
              setSelectionRange: vi.fn(),
            },
          })
        }
      >
        backspace-empty-bullet
      </button>
    </div>
  ),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe('RulesInput', () => {
  it('formats plain lines into bullet lines on change', () => {
    const onChange = vi.fn();

    render(
      <RulesInput
        value=""
        onChange={onChange}
        disabled={false}
        isDesktop={true}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'line one\n• line two\n* line three' } });

    expect(onChange).toHaveBeenCalledWith('• line one\n• line two\n* line three');
  });

  it('adds initial bullet on focus and handles Enter bullet insertion', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    render(<RulesInput value="" onChange={onChange} disabled={false} isDesktop={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const setSelectionRange = vi.spyOn(textarea, 'setSelectionRange');

    fireEvent.focus(textarea);
    expect(onChange).toHaveBeenCalledWith('• ');

    vi.advanceTimersByTime(0);
    expect(setSelectionRange).toHaveBeenCalledWith(2, 2);

    const onChangeForEnter = vi.fn();
    render(<RulesInput value="• abc" onChange={onChangeForEnter} disabled={false} isDesktop={false} />);
    const textareaForEnter = screen.getAllByRole('textbox')[1] as HTMLTextAreaElement;

    Object.defineProperty(textareaForEnter, 'selectionStart', { value: 5, writable: true, configurable: true });
    Object.defineProperty(textareaForEnter, 'selectionEnd', { value: 5, writable: true, configurable: true });

    fireEvent.keyDown(textareaForEnter, { key: 'Enter' });
    expect(onChangeForEnter).toHaveBeenCalledWith('• abc\n• ');
  });

  it('removes empty bullet line on backspace and supports clear/voice actions', () => {
    const onChange = vi.fn();

    render(<RulesInput value={'first\n• '} onChange={onChange} disabled={false} isDesktop={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'backspace-empty-bullet' }));
    expect(onChange).toHaveBeenCalledWith('first');

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));
    expect(onChange).toHaveBeenCalledWith('');

    fireEvent.click(screen.getByRole('button', { name: 'voice' }));
    expect(onChange).toHaveBeenCalledWith('• voice prompt');

    fireEvent.click(screen.getByRole('button', { name: 'voice-bullet' }));
    expect(onChange).toHaveBeenCalledWith('• bullet prompt');
  });
});
