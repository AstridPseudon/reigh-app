import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyToClipboard } from './useCopyToClipboard';

const { mockWriteClipboardTextSafe } = vi.hoisted(() => ({
  mockWriteClipboardTextSafe: vi.fn(),
}));

vi.mock('@/shared/lib/browser/clipboard', () => ({
  writeClipboardTextSafe: mockWriteClipboardTextSafe,
}));

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('sets copied value and resets after timeout when copy succeeds', async () => {
    mockWriteClipboardTextSafe.mockResolvedValue(true);
    const { result } = renderHook(() => useCopyToClipboard<'task-id'>(500));

    await act(async () => {
      await result.current.copyText('hello world', 'task-id');
    });

    expect(result.current.copiedValue).toBe('task-id');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.copiedValue).toBeNull();
  });

  it('does not set copied value when clipboard write fails', async () => {
    mockWriteClipboardTextSafe.mockResolvedValue(false);
    const { result } = renderHook(() => useCopyToClipboard<string>(500));

    let didCopy = true;
    await act(async () => {
      didCopy = await result.current.copyText('hello world', 'done');
    });

    expect(didCopy).toBe(false);
    expect(result.current.copiedValue).toBeNull();
  });
});
