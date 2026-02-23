import { describe, expect, it } from 'vitest';
import { toJson } from '../supabaseTypeHelpers';

describe('toJson', () => {
  it('returns the same object reference', () => {
    const payload = { nested: { value: 1 }, list: ['a', 'b'] };
    const result = toJson(payload);

    expect(result).toBe(payload);
  });

  it('supports primitive values', () => {
    expect(toJson('text')).toBe('text');
    expect(toJson(42)).toBe(42);
    expect(toJson(true)).toBe(true);
    expect(toJson(null)).toBe(null);
  });

  it('supports arrays', () => {
    const payload = [{ id: 1 }, { id: 2 }];
    const result = toJson(payload);

    expect(result).toEqual(payload);
  });
});
