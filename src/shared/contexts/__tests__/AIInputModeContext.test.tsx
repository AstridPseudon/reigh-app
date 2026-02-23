/**
 * AIInputModeContext Tests
 *
 * Tests for AI input mode context.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock dependencies - use vi.hoisted to avoid hoisting issues
const { mockUpdate } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
}));

vi.mock('@/shared/hooks/useUserUIState', () => ({
  useUserUIState: vi.fn().mockReturnValue({
    value: { mode: 'voice' },
    update: mockUpdate,
    isLoading: false,
  }),
}));

import { AIInputModeProvider, useAIInputMode } from '../AIInputModeContext';

// Test consumer component
function AIInputConsumer() {
  const { mode, setMode, isLoading } = useAIInputMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="isLoading">{String(isLoading)}</span>
      <button data-testid="setText" onClick={() => setMode('text')}>
        Text
      </button>
      <button data-testid="setVoice" onClick={() => setMode('voice')}>
        Voice
      </button>
      <button data-testid="setNone" onClick={() => setMode('none')}>
        None
      </button>
    </div>
  );
}

describe('AIInputModeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAIInputMode hook', () => {
    it('throws when used outside provider', () => {
      function FallbackConsumer() {
        const { mode } = useAIInputMode();
        return <span>{mode}</span>;
      }

      // Suppress React error boundary console output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<FallbackConsumer />)).toThrow(
        'useAIInputMode must be used within an AIInputModeProvider'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('AIInputModeProvider', () => {
    it('renders children', () => {
      render(
        <AIInputModeProvider>
          <div data-testid="child">Hello</div>
        </AIInputModeProvider>
      );

      expect(screen.getByTestId('child')).toHaveTextContent('Hello');
    });

    it('provides mode from user settings', () => {
      render(
        <AIInputModeProvider>
          <AIInputConsumer />
        </AIInputModeProvider>
      );

      expect(screen.getByTestId('mode')).toHaveTextContent('voice');
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    it('calls update when setMode is invoked', () => {
      render(
        <AIInputModeProvider>
          <AIInputConsumer />
        </AIInputModeProvider>
      );

      act(() => {
        screen.getByTestId('setText').click();
      });

      expect(mockUpdate).toHaveBeenCalledWith({ mode: 'text' });
    });
  });
});
