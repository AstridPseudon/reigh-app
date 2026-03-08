import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AdvancedOptionsPanel } from './AdvancedOptionsPanel';

vi.mock('@/shared/components/ui/primitives/label', () => ({
  Label: ({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) => (
    <label htmlFor={htmlFor} className={className}>{children}</label>
  ),
}));

vi.mock('@/shared/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
    disabled,
  }: {
    id: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}));

vi.mock('./RulesInput', () => ({
  RulesInput: ({ value, disabled }: { value: string; disabled?: boolean }) => (
    <div data-testid="rules-input" data-value={value} data-disabled={disabled ? 'true' : 'false'} />
  ),
}));

vi.mock('./TemperatureSelector', () => ({
  TemperatureSelector: ({
    temperature,
    onChange,
    disabled,
  }: {
    temperature: number;
    onChange: (value: number) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      data-testid="temperature-selector"
      data-temperature={temperature}
      disabled={disabled}
      onClick={() => onChange(0.5)}
    >
      temp
    </button>
  ),
}));

function buildProps(overrides: Record<string, unknown> = {}) {
  return {
    isDesktop: true,
    remixMode: false,
    rulesToRememberText: 'always include camera movement',
    onRulesToRememberTextChange: vi.fn(),
    temperature: 0.8,
    onTemperatureChange: vi.fn(),
    includeExistingContext: true,
    onIncludeExistingContextChange: vi.fn(),
    replaceCurrentPrompts: false,
    onReplaceCurrentPromptsChange: vi.fn(),
    hasApiKey: true,
    isGenerating: false,
    existingPromptsCount: 2,
    ...overrides,
  };
}

describe('AdvancedOptionsPanel', () => {
  it('renders rules + temperature controls and forwards temperature changes', () => {
    const props = buildProps();
    const { container } = render(<AdvancedOptionsPanel {...(props as never)} />);

    expect(screen.getByTestId('rules-input')).toHaveAttribute('data-value', 'always include camera movement');
    expect(screen.getByTestId('rules-input')).toHaveAttribute('data-disabled', 'false');

    fireEvent.click(screen.getByTestId('temperature-selector'));
    expect(props.onTemperatureChange).toHaveBeenCalledWith(0.5);

    expect(container.firstChild).toHaveClass('hidden', 'lg:block', 'w-80');
  });

  it('disables controls when api key is missing or generation is active', () => {
    const props = buildProps({ hasApiKey: false, isGenerating: true });
    render(<AdvancedOptionsPanel {...(props as never)} />);

    expect(screen.getByTestId('rules-input')).toHaveAttribute('data-disabled', 'true');
    expect(screen.getByTestId('temperature-selector')).toBeDisabled();

    const includeCheckbox = screen.getByLabelText('Include current prompts') as HTMLInputElement;
    const replaceCheckbox = screen.getByLabelText('Replace current prompts') as HTMLInputElement;
    expect(includeCheckbox.disabled).toBe(true);
    expect(replaceCheckbox.disabled).toBe(true);
  });

  it('wires checkbox callbacks and blocks include-context when no prompts exist', () => {
    const props = buildProps({ existingPromptsCount: 0, isDesktop: false });
    const { container } = render(<AdvancedOptionsPanel {...(props as never)} />);

    expect(container.firstChild).toHaveClass('w-full', 'lg:w-80', 'lg:hidden');

    const includeCheckbox = screen.getByLabelText('Include current prompts') as HTMLInputElement;
    const replaceCheckbox = screen.getByLabelText('Replace current prompts') as HTMLInputElement;

    expect(includeCheckbox.disabled).toBe(true);
    expect(replaceCheckbox.disabled).toBe(false);

    fireEvent.click(replaceCheckbox);
    expect(props.onReplaceCurrentPromptsChange).toHaveBeenCalledWith(true);
  });

  it('hides checkbox options in remix mode', () => {
    render(<AdvancedOptionsPanel {...(buildProps({ remixMode: true }) as never)} />);

    expect(screen.queryByLabelText('Include current prompts')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Replace current prompts')).not.toBeInTheDocument();
  });
});
