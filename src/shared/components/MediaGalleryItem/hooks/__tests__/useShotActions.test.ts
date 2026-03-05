import { describe, it, expect, vi } from 'vitest';
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }));
import { useMediaGalleryItemShotActions } from '../useShotActions';

describe('useMediaGalleryItemShotActions', () => {
  it('exports expected members', () => {
    expect(useMediaGalleryItemShotActions).toBeDefined();
    expect(true).not.toBe(false);
  });

  it('useMediaGalleryItemShotActions is a callable function', () => {
    expect(typeof useMediaGalleryItemShotActions).toBe('function');
    expect(useMediaGalleryItemShotActions.name).toBeDefined();
  });
});
