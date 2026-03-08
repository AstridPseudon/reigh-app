import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemperatureSelector } from './TemperatureSelector';

vi.mock('@/shared/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    disabled,
  }: {
    value: number;
    onValueChange: (value: number) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid="temperature-slider"
      type="range"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(Number(event.target.value))}
    />
  ),
}));

describe('TemperatureSelector', () => {
  it('shows creativity labels and selected option description', () => {
    render(
      <TemperatureSelector
        temperature={0.8}
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText('Level of creativity')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Balanced creativity')).toBeInTheDocument();
  });

  it('falls back to default description for non-standard temperature values', () => {
    render(
      <TemperatureSelector
        temperature={0.7}
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText('Good balance of creativity')).toBeInTheDocument();
  });

  it('forwards slider updates and respects disabled state', () => {
    const onChange = vi.fn();

    render(
      <TemperatureSelector
        temperature={0.6}
        onChange={onChange}
        disabled={true}
      />,
    );

    const slider = screen.getByTestId('temperature-slider');
    expect(slider).toBeDisabled();

    fireEvent.change(slider, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
