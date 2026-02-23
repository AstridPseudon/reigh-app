import { describe, expect, it } from 'vitest';
import { handleStorageOperations, getStoragePublicUrl, cleanupFile } from './storage.ts';

describe('complete_task/storage exports', () => {
  it('exports storage helpers', () => {
    expect(handleStorageOperations).toBeTypeOf('function');
    expect(getStoragePublicUrl).toBeTypeOf('function');
    expect(cleanupFile).toBeTypeOf('function');
  });
});
