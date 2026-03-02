import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportStrokeMask } from '../maskExport';
import type { BrushStroke } from '../../../hooks/inpainting/types';

// Konva needs a DOM container — jsdom provides this, but Konva.Stage.toDataURL
// may not produce real pixel data. We test the function's structural behavior:
// null for empty, non-null data URL for strokes, error resilience.

function makeLineStroke(overrides?: Partial<BrushStroke>): BrushStroke {
  return {
    id: 'stroke-1',
    points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
    isErasing: false,
    brushSize: 20,
    shapeType: 'line',
    ...overrides,
  };
}

function makeRectStroke(overrides?: Partial<BrushStroke>): BrushStroke {
  return {
    id: 'rect-1',
    points: [{ x: 10, y: 10 }, { x: 200, y: 200 }],
    isErasing: false,
    brushSize: 20,
    shapeType: 'rectangle',
    ...overrides,
  };
}

function makeFreeFormRectStroke(): BrushStroke {
  return {
    id: 'freeform-1',
    points: [
      { x: 10, y: 10 },
      { x: 200, y: 10 },
      { x: 200, y: 200 },
      { x: 10, y: 200 },
    ],
    isErasing: false,
    brushSize: 20,
    shapeType: 'rectangle',
    isFreeForm: true,
  };
}

describe('exportStrokeMask', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when there are no strokes to export', () => {
    const result = exportStrokeMask({
      strokes: [],
      imageWidth: 512,
      imageHeight: 512,
    });

    expect(result).toBeNull();
  });

  it('returns a data URL for a line stroke', () => {
    const result = exportStrokeMask({
      strokes: [makeLineStroke()],
      imageWidth: 256,
      imageHeight: 256,
    });

    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
  });

  it('returns a data URL for a rectangle stroke', () => {
    const result = exportStrokeMask({
      strokes: [makeRectStroke()],
      imageWidth: 256,
      imageHeight: 256,
    });

    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
  });

  it('returns a data URL for a free-form rectangle stroke', () => {
    const result = exportStrokeMask({
      strokes: [makeFreeFormRectStroke()],
      imageWidth: 256,
      imageHeight: 256,
    });

    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
  });

  it('handles multiple strokes of mixed types', () => {
    const result = exportStrokeMask({
      strokes: [makeLineStroke(), makeRectStroke(), makeFreeFormRectStroke()],
      imageWidth: 512,
      imageHeight: 512,
    });

    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
  });

  it('skips strokes with fewer than 2 points', () => {
    const result = exportStrokeMask({
      strokes: [
        makeLineStroke({ id: 'empty', points: [{ x: 0, y: 0 }] }),
      ],
      imageWidth: 256,
      imageHeight: 256,
    });

    // The only stroke is skipped, but the mask is still generated (black background only)
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
  });

  it('cleans up the offscreen container even when Konva throws', () => {
    const originalCreateElement = document.createElement.bind(document);
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    // Sabotage the container so Konva.Stage fails
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'div') {
        Object.defineProperty(el, 'clientWidth', { get: () => { throw new Error('boom'); } });
      }
      return el;
    });

    const result = exportStrokeMask({
      strokes: [makeLineStroke()],
      imageWidth: 256,
      imageHeight: 256,
    });

    // Should return null on error
    expect(result).toBeNull();
    // Container should still be cleaned up (finally block)
    expect(removeSpy.mock.calls.length).toBeGreaterThanOrEqual(appendSpy.mock.calls.length);
  });

  it('accepts a custom pixelRatio', () => {
    // Just verify it doesn't throw with non-default pixelRatio
    const result = exportStrokeMask({
      strokes: [makeLineStroke()],
      imageWidth: 128,
      imageHeight: 128,
      pixelRatio: 2,
    });

    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
  });
});
