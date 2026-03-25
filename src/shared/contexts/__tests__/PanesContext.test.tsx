/**
 * PanesContext Tests
 *
 * Tests for panel/pane layout context.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Mock dependencies
vi.mock('@/shared/hooks/useUserUIState', () => ({
  useUserUIState: vi.fn().mockReturnValue({
    value: { shots: false, tasks: false, gens: false, editor: false },
    update: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/shared/hooks/mobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
  useIsTablet: vi.fn().mockReturnValue(false),
}));

vi.mock('@/shared/config/panes', () => ({
  PANE_CONFIG: {
    dimensions: {
      DEFAULT_HEIGHT: 300,
      DEFAULT_WIDTH: 280,
    },
  },
}));

vi.mock('@/shared/hooks/settings/useToolSettings', () => ({
  updateToolSettingsSupabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/integrations/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  }),
}));

import { PanesProvider, usePanes } from '../PanesContext';

// Test consumer component
function PanesConsumer() {
  const ctx = usePanes();
  return (
    <div>
      <span data-testid="gensLocked">{String(ctx.isGenerationsPaneLocked)}</span>
      <span data-testid="editorLocked">{String(ctx.isEditorPaneLocked)}</span>
      <span data-testid="shotsLocked">{String(ctx.isShotsPaneLocked)}</span>
      <span data-testid="tasksLocked">{String(ctx.isTasksPaneLocked)}</span>
      <span data-testid="gensOpen">{String(ctx.isGenerationsPaneOpen)}</span>
      <span data-testid="editorOpen">{String(ctx.isEditorPaneOpen)}</span>
      <span data-testid="tasksOpen">{String(ctx.isTasksPaneOpen)}</span>
      <span data-testid="gensHeight">{ctx.generationsPaneHeight}</span>
      <span data-testid="effectiveGensHeight">{ctx.effectiveGenerationsPaneHeight}</span>
      <span data-testid="editorHeight">{ctx.editorPaneHeight}</span>
      <span data-testid="effectiveEditorHeight">{ctx.effectiveEditorPaneHeight}</span>
      <span data-testid="activeTaskId">{ctx.activeTaskId ?? 'null'}</span>
      <button data-testid="lockGens" onClick={() => ctx.setIsGenerationsPaneLocked(true)}>
        Lock Gens
      </button>
      <button data-testid="lockEditor" onClick={() => ctx.setIsEditorPaneLocked(true)}>
        Lock Editor
      </button>
      <button data-testid="openGens" onClick={() => ctx.setIsGenerationsPaneOpen(true)}>
        Open Gens
      </button>
      <button data-testid="openEditor" onClick={() => ctx.setIsEditorPaneOpen(true)}>
        Open Editor
      </button>
      <button data-testid="setGensHeightSmall" onClick={() => ctx.setGenerationsPaneHeight(60)}>
        Set Small Gens Height
      </button>
      <button data-testid="setGensHeightLarge" onClick={() => ctx.setGenerationsPaneHeight(400)}>
        Set Large Gens Height
      </button>
      <button data-testid="setActiveTask" onClick={() => ctx.setActiveTaskId('task-1')}>
        Set Active Task
      </button>
      <button data-testid="resetLocks" onClick={() => ctx.resetAllPaneLocks()}>
        Reset
      </button>
    </div>
  );
}

describe('PanesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 600,
    });
  });

  describe('usePanes hook', () => {
    it('throws when used outside PanesProvider', () => {
      function BadConsumer() {
        usePanes();
        return null;
      }

      expect(() => {
        render(<BadConsumer />);
      }).toThrow('usePanes must be used within a PanesProvider');
    });
  });

  describe('PanesProvider', () => {
    it('renders children', () => {
      render(
        <PanesProvider>
          <div data-testid="child">Hello</div>
        </PanesProvider>
      );

      expect(screen.getByTestId('child')).toHaveTextContent('Hello');
    });

    it('provides initial unlocked state', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      expect(screen.getByTestId('gensLocked')).toHaveTextContent('false');
      expect(screen.getByTestId('editorLocked')).toHaveTextContent('false');
      expect(screen.getByTestId('shotsLocked')).toHaveTextContent('false');
      expect(screen.getByTestId('tasksLocked')).toHaveTextContent('false');
    });

    it('provides initial pane states', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      expect(screen.getByTestId('gensOpen')).toHaveTextContent('false');
      expect(screen.getByTestId('editorOpen')).toHaveTextContent('false');
      expect(screen.getByTestId('tasksOpen')).toHaveTextContent('false');
      expect(screen.getByTestId('gensHeight')).toHaveTextContent('300');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('300');
      expect(screen.getByTestId('editorHeight')).toHaveTextContent('540');
      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('540');
      expect(screen.getByTestId('activeTaskId')).toHaveTextContent('null');
    });

    it('allows locking generations pane', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('lockGens').click();
      });

      expect(screen.getByTestId('gensLocked')).toHaveTextContent('true');
    });

    it('allows opening generations pane', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('openGens').click();
      });

      expect(screen.getByTestId('gensOpen')).toHaveTextContent('true');
    });

    it('keeps the editor at 90% height when it is the only visible top pane', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('openEditor').click();
      });

      expect(screen.getByTestId('editorOpen')).toHaveTextContent('true');
      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('540');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('300');
    });

    it('uses the ideal-fit tier when both panes fit within the viewport budget', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('setGensHeightSmall').click();
        screen.getByTestId('openGens').click();
        screen.getByTestId('openEditor').click();
      });

      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('540');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('60');
      expect(
        Number(screen.getByTestId('effectiveEditorHeight').textContent) +
          Number(screen.getByTestId('effectiveGensHeight').textContent)
      ).toBe(600);
    });

    it('uses the shrink-to-fit tier when both panes are visible in a 600px viewport', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('openGens').click();
        screen.getByTestId('openEditor').click();
      });

      expect(screen.getByTestId('gensOpen')).toHaveTextContent('true');
      expect(screen.getByTestId('editorOpen')).toHaveTextContent('true');
      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('300');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('300');
      expect(
        Number(screen.getByTestId('effectiveEditorHeight').textContent) +
          Number(screen.getByTestId('effectiveGensHeight').textContent)
      ).toBe(600);
    });

    it('keeps generations at its configured height until the editor reaches its minimum', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('setGensHeightLarge').click();
        screen.getByTestId('openGens').click();
        screen.getByTestId('openEditor').click();
      });

      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('200');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('400');
      expect(
        Number(screen.getByTestId('effectiveEditorHeight').textContent) +
          Number(screen.getByTestId('effectiveGensHeight').textContent)
      ).toBe(600);
    });

    it('uses the degraded proportional split tier below the combined minimum height', () => {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: 250,
      });

      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('openGens').click();
        screen.getByTestId('openEditor').click();
      });

      expect(screen.getByTestId('editorHeight')).toHaveTextContent('225');
      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('156');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('94');
      expect(
        Number(screen.getByTestId('effectiveEditorHeight').textContent) +
          Number(screen.getByTestId('effectiveGensHeight').textContent)
      ).toBe(250);
    });

    it('recomputes effective heights when a second top pane becomes visible', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('540');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('300');

      act(() => {
        screen.getByTestId('openEditor').click();
      });

      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('540');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('300');

      act(() => {
        screen.getByTestId('openGens').click();
      });

      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('300');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('300');
    });

    it('uses 70% ideal when generations is locked', () => {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: 1200,
      });

      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('lockGens').click();
        screen.getByTestId('lockEditor').click();
      });

      expect(screen.getByTestId('gensLocked')).toHaveTextContent('true');
      expect(screen.getByTestId('editorLocked')).toHaveTextContent('true');
      expect(screen.getByTestId('editorHeight')).toHaveTextContent('840');
      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('840');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('300');
    });

    it('uses 90% ideal when generations is not locked', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('lockEditor').click();
      });

      expect(screen.getByTestId('editorLocked')).toHaveTextContent('true');
      expect(screen.getByTestId('editorHeight')).toHaveTextContent('540');
      expect(screen.getByTestId('effectiveEditorHeight')).toHaveTextContent('540');
      expect(screen.getByTestId('effectiveGensHeight')).toHaveTextContent('300');
    });

    it('allows setting active task', () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      act(() => {
        screen.getByTestId('setActiveTask').click();
      });

      expect(screen.getByTestId('activeTaskId')).toHaveTextContent('task-1');
    });

    it('resetAllPaneLocks unlocks all panes', async () => {
      render(
        <PanesProvider>
          <PanesConsumer />
        </PanesProvider>
      );

      // Lock a pane first
      act(() => {
        screen.getByTestId('lockGens').click();
      });
      expect(screen.getByTestId('gensLocked')).toHaveTextContent('true');

      // Reset all locks
      await act(async () => {
        screen.getByTestId('resetLocks').click();
      });

      expect(screen.getByTestId('gensLocked')).toHaveTextContent('false');
      expect(screen.getByTestId('shotsLocked')).toHaveTextContent('false');
      expect(screen.getByTestId('tasksLocked')).toHaveTextContent('false');
    });
  });
});
