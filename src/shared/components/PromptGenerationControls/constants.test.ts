import { describe, expect, it } from 'vitest';
import { temperatureOptions } from './constants';

describe('temperatureOptions', () => {
  it('defines the expected preset labels and values', () => {
    expect(temperatureOptions).toEqual([
      { value: 0.4, label: 'Predictable', description: 'Very consistent' },
      { value: 0.6, label: 'Interesting', description: 'Some variation' },
      { value: 0.8, label: 'Balanced', description: 'Balanced creativity' },
      { value: 1.0, label: 'Chaotic', description: 'Wild & unexpected' },
      { value: 1.2, label: 'Insane', description: 'Maximum randomness' },
    ]);
  });

  it('keeps values in ascending order for slider/select rendering', () => {
    const values = temperatureOptions.map((option) => option.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});
