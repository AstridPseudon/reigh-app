import { describe, it, expect } from 'vitest';
import { useEditModeLoras } from '../useEditModeLoras';

describe('useEditModeLoras', () => {
  it('exports expected members', () => {
    expect(useEditModeLoras).toBeDefined();
  });

  it('useEditModeLoras is a callable function', () => {
    expect(typeof useEditModeLoras).toBe('function');
    expect(useEditModeLoras.name).toBeDefined();
  });
});
