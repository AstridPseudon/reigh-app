/**
 * StrokeOverlay - Konva-based stroke overlay for inpainting/annotation.
 *
 * Owns the entire drawing state machine internally:
 * - Freehand stroke drawing (inpaint mode)
 * - Rectangle drawing (annotate mode)
 * - Shape selection, move, resize, and free-form corner drag
 * - Pointer capture for edge-of-canvas drawing
 *
 * Parent components pass in strokes (data) and receive callbacks when strokes change.
 * Exposes exportMask() via ref for generating mask images.
 */

import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Stage, Layer, Line, Rect } from 'react-konva';
import Konva from 'konva';
import { nanoid } from 'nanoid';
import type { KonvaEventObject } from 'konva/lib/Node';
import { handleError } from '@/shared/lib/errorHandler';
import { isPointOnShape, getClickedCornerIndex, getRectangleClickType, getRectangleCorners } from '../hooks/inpainting/shapeHelpers';

export interface BrushStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  isErasing: boolean;
  brushSize: number;
  shapeType?: 'line' | 'rectangle';
  isFreeForm?: boolean;
}

interface StrokeOverlayProps {
  // Image dimensions (strokes are stored in these coordinates)
  imageWidth: number;
  imageHeight: number;

  // Display dimensions (how big the overlay appears on screen)
  displayWidth: number;
  displayHeight: number;

  // Strokes to render
  strokes: BrushStroke[];

  // Drawing settings
  isEraseMode: boolean;
  brushSize: number;
  annotationMode: 'rectangle' | null;

  // Mode flags (needed for guard logic)
  isInpaintMode: boolean;
  isAnnotateMode: boolean;
  editMode: 'text' | 'inpaint' | 'annotate' | 'reposition' | 'img2img';

  // OUT: callbacks
  onStrokeComplete: (stroke: BrushStroke) => void;
  onStrokesChange: (strokes: BrushStroke[]) => void;
  onSelectionChange: (shapeId: string | null) => void;
  onTextModeHint?: () => void;
}

export interface StrokeOverlayHandle {
  /** Export strokes as a mask image (white shapes on black background). */
  exportMask: (options?: { pixelRatio?: number }) => string | null;
  /** Get the currently selected shape ID. */
  getSelectedShapeId: () => string | null;
  /** Undo last stroke. */
  undo: () => void;
  /** Clear all strokes. */
  clear: () => void;
  /** Delete the currently selected shape. */
  deleteSelected: () => void;
  /** Toggle free-form mode for the selected rectangle. */
  toggleFreeForm: () => void;
}

type DragMode = 'move' | 'resize';

export const StrokeOverlay = forwardRef<StrokeOverlayHandle, StrokeOverlayProps>(({
  imageWidth,
  imageHeight,
  displayWidth,
  displayHeight,
  strokes,
  isEraseMode,
  brushSize,
  annotationMode,
  isInpaintMode,
  isAnnotateMode,
  editMode,
  onStrokeComplete,
  onStrokesChange,
  onSelectionChange,
  onTextModeHint,
}, ref) => {

  const stageRef = useRef<Konva.Stage>(null);

  // ============================================
  // Drawing state
  // ============================================
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  // Refs for synchronous access in pointer event handlers.
  // React state updates are async, so useCallback closures may see stale
  // values when pointer events fire in rapid succession.
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

  // ============================================
  // Drag state (absorbed from useDragState)
  // ============================================
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('resize');
  const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null);
  const draggedShapeRef = useRef<BrushStroke | null>(null);

  // Misc refs
  const lastClickTimeRef = useRef<number>(0);
  const lastClickPositionRef = useRef<{ x: number; y: number } | null>(null);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scale factors: display coords -> image coords
  const scaleX = displayWidth / imageWidth;
  const scaleY = displayHeight / imageHeight;

  // Convert stage coordinates to image coordinates
  const stageToImage = (stageX: number, stageY: number) => ({
    x: stageX / scaleX,
    y: stageY / scaleY,
  });

  // Convert image coordinates to stage coordinates
  const imageToStage = (imageX: number, imageY: number) => ({
    x: imageX * scaleX,
    y: imageY * scaleY,
  });

  // Notify parent of selection changes
  const updateSelection = useCallback((shapeId: string | null) => {
    setSelectedShapeId(shapeId);
    onSelectionChange(shapeId);
  }, [onSelectionChange]);

  // ============================================
  // Drag helpers
  // ============================================
  const startMoveDrag = useCallback((shape: BrushStroke, pointerX: number, pointerY: number) => {
    const startPoint = shape.points[0];
    setDragMode('move');
    setIsDragging(true);
    setDragOffset({ x: pointerX - startPoint.x, y: pointerY - startPoint.y });
    setDraggingCornerIndex(null);
    draggedShapeRef.current = shape;
  }, []);

  const startResizeDrag = useCallback((shape: BrushStroke, pointerX: number, pointerY: number) => {
    const startPoint = shape.points[0];
    setDragMode('resize');
    setIsDragging(true);
    setDragOffset({ x: pointerX - startPoint.x, y: pointerY - startPoint.y });
    setDraggingCornerIndex(null);
    draggedShapeRef.current = shape;
  }, []);

  const startCornerDrag = useCallback((shape: BrushStroke, cornerIndex: number) => {
    setDraggingCornerIndex(cornerIndex);
    setIsDragging(true);
    setDragOffset(null);
    draggedShapeRef.current = shape;
  }, []);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    setDragOffset(null);
    setDraggingCornerIndex(null);
    draggedShapeRef.current = null;
  }, []);

  // Cleanup hint timeout on unmount
  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = null;
      }
    };
  }, []);

  // ============================================
  // Pointer position helper
  // ============================================
  const getClampedPointerPosition = (e: KonvaEventObject<PointerEvent>): { x: number; y: number } | null => {
    const stage = e.target.getStage();
    if (!stage) return null;

    const pos = stage.getPointerPosition();
    if (pos) {
      return {
        x: Math.max(0, Math.min(displayWidth, pos.x)),
        y: Math.max(0, Math.min(displayHeight, pos.y)),
      };
    }

    const container = stage.container();
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const nativeEvent = e.evt;
    const x = Math.max(0, Math.min(displayWidth, nativeEvent.clientX - rect.left));
    const y = Math.max(0, Math.min(displayHeight, nativeEvent.clientY - rect.top));

    return { x, y };
  };

  // ============================================
  // Pointer handlers (absorbed from usePointerHandlers)
  // ============================================

  const handlePointerDown = useCallback((e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pos = (() => {
      const p = stage.getPointerPosition();
      if (p) return { x: Math.max(0, Math.min(displayWidth, p.x)), y: Math.max(0, Math.min(displayHeight, p.y)) };
      const container = stage.container();
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(displayWidth, e.evt.clientX - rect.left)),
        y: Math.max(0, Math.min(displayHeight, e.evt.clientY - rect.top)),
      };
    })();
    if (!pos) return;

    // Capture pointer
    if (stage.content && e.evt.pointerId !== undefined) {
      try { stage.content.setPointerCapture(e.evt.pointerId); } catch { /* ok */ }
    }

    const imagePoint = stageToImage(pos.x, pos.y);
    const { x, y } = imagePoint;

    // Guard: must be in a drawing mode
    if (!isInpaintMode && !isAnnotateMode) return;

    // Prevent drawing in text edit mode
    if (editMode === 'text') {
      onTextModeHint?.();
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => { hintTimeoutRef.current = null; }, 2000);
      return;
    }

    // In annotate+rectangle mode, check if clicking on existing shape
    if (isAnnotateMode && annotationMode === 'rectangle') {
      for (let i = strokes.length - 1; i >= 0; i--) {
        const stroke = strokes[i];
        if (stroke.shapeType === 'rectangle' && isPointOnShape(x, y, stroke)) {
          updateSelection(stroke.id);

          const now = Date.now();
          const cornerIndex = getClickedCornerIndex(x, y, stroke);
          const lastClickPos = lastClickPositionRef.current;
          const isDoubleClick = cornerIndex !== null &&
            now - lastClickTimeRef.current < 300 &&
            lastClickPos &&
            Math.hypot(x - lastClickPos.x, y - lastClickPos.y) < 10;

          lastClickTimeRef.current = now;
          lastClickPositionRef.current = { x, y };

          // Free-form corner dragging
          if (stroke.isFreeForm && cornerIndex !== null) {
            startCornerDrag(stroke, cornerIndex);
            return;
          }

          // Double-click to enable free-form mode
          if (isDoubleClick && cornerIndex !== null && !stroke.isFreeForm) {
            const corners = getRectangleCorners(stroke);
            const updatedStroke: BrushStroke = { ...stroke, points: corners, isFreeForm: true };
            const newStrokes = strokes.map(s => s.id === stroke.id ? updatedStroke : s);
            onStrokesChange(newStrokes);
            startCornerDrag(updatedStroke, cornerIndex);
            return;
          }

          const clickType = getRectangleClickType(x, y, stroke);
          if (clickType === 'edge') { startMoveDrag(stroke, x, y); return; }
          if (clickType === 'corner' && !stroke.isFreeForm) { startResizeDrag(stroke, x, y); return; }

          return; // Clicked in middle, just keep selected
        }
      }

      // Clicked on empty space, deselect
      if (selectedShapeId) {
        updateSelection(null);
      }
    }

    // Start new stroke
    isDrawingRef.current = true;
    setIsDrawing(true);
    const initialStroke = [{ x, y }];
    currentStrokeRef.current = initialStroke;
    setCurrentStroke(initialStroke);
  }, [displayWidth, displayHeight, isInpaintMode, isAnnotateMode, annotationMode, strokes, selectedShapeId, editMode, onStrokesChange, onTextModeHint, updateSelection, startCornerDrag, startMoveDrag, startResizeDrag, stageToImage]);

  const handlePointerMove = useCallback((e: KonvaEventObject<PointerEvent>) => {
    if (!isInpaintMode && !isAnnotateMode) return;
    if (editMode === 'text' && !isDragging) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pos = (() => {
      const p = stage.getPointerPosition();
      if (p) return { x: Math.max(0, Math.min(displayWidth, p.x)), y: Math.max(0, Math.min(displayHeight, p.y)) };
      const container = stage.container();
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(displayWidth, e.evt.clientX - rect.left)),
        y: Math.max(0, Math.min(displayHeight, e.evt.clientY - rect.top)),
      };
    })();
    if (!pos) return;

    const { x, y } = stageToImage(pos.x, pos.y);

    // Handle drag operations
    if (isDragging && draggedShapeRef.current) {
      const shape = draggedShapeRef.current;

      // Free-form corner dragging
      if (draggingCornerIndex !== null && shape.isFreeForm && shape.points.length === 4) {
        const newPoints = [...shape.points];
        newPoints[draggingCornerIndex] = { x, y };
        const updatedShape: BrushStroke = { ...shape, points: newPoints, isFreeForm: true };
        const newStrokes = strokes.map(s => s.id === shape.id ? updatedShape : s);
        onStrokesChange(newStrokes);
        draggedShapeRef.current = updatedShape;
        return;
      }

      // Move mode
      if (dragMode === 'move' && dragOffset) {
        const newStartX = x - dragOffset.x;
        const newStartY = y - dragOffset.y;
        const oldStartPoint = shape.points[0];
        const deltaX = newStartX - oldStartPoint.x;
        const deltaY = newStartY - oldStartPoint.y;
        const updatedPoints = shape.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
        const updatedShape: BrushStroke = { ...shape, points: updatedPoints, isFreeForm: shape.isFreeForm };
        const newStrokes = strokes.map(s => s.id === shape.id ? updatedShape : s);
        onStrokesChange(newStrokes);
        draggedShapeRef.current = updatedShape;
        return;
      }

      // Resize mode
      if (dragMode === 'resize' && !shape.isFreeForm) {
        const endPoint = shape.points[1];
        const updatedShape: BrushStroke = { ...shape, points: [{ x, y }, endPoint] };
        const newStrokes = strokes.map(s => s.id === shape.id ? updatedShape : s);
        onStrokesChange(newStrokes);
        draggedShapeRef.current = updatedShape;
        return;
      }
    }

    // Continue drawing stroke
    if (!isDrawingRef.current) return;
    const newStroke = [...currentStrokeRef.current, { x, y }];
    currentStrokeRef.current = newStroke;
    setCurrentStroke(newStroke);
  }, [isInpaintMode, isAnnotateMode, editMode, isDragging, dragMode, dragOffset, draggingCornerIndex, strokes, displayWidth, displayHeight, onStrokesChange, stageToImage]);

  const handlePointerUp = useCallback((e: KonvaEventObject<PointerEvent>) => {
    // Release pointer capture
    const stage = e.target.getStage();
    if (stage?.content && e.evt.pointerId !== undefined) {
      try { stage.content.releasePointerCapture(e.evt.pointerId); } catch { /* ok */ }
    }

    // Finish drag
    if (isDragging) {
      endDrag();
      return;
    }

    if ((!isInpaintMode && !isAnnotateMode) || !isDrawingRef.current) return;
    if (editMode === 'text') return;

    isDrawingRef.current = false;
    setIsDrawing(false);

    const finalStroke = currentStrokeRef.current;

    if (finalStroke.length > 1) {
      const shapeType = isAnnotateMode && annotationMode ? annotationMode : 'line';

      // For rectangles, require minimum drag distance
      if (shapeType === 'rectangle') {
        const startPoint = finalStroke[0];
        const endPoint = finalStroke[finalStroke.length - 1];
        if (Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y) < 10) {
          currentStrokeRef.current = [];
          setCurrentStroke([]);
          return;
        }
      }

      const strokePoints = shapeType === 'rectangle'
        ? [finalStroke[0], finalStroke[finalStroke.length - 1]]
        : finalStroke;

      const newStroke: BrushStroke = {
        id: nanoid(),
        points: strokePoints,
        isErasing: isEraseMode,
        brushSize,
        shapeType,
      };

      onStrokeComplete(newStroke);

      // Auto-select rectangle after drawing
      if (isAnnotateMode && shapeType === 'rectangle') {
        updateSelection(newStroke.id);
      }
    }

    currentStrokeRef.current = [];
    setCurrentStroke([]);
  }, [isInpaintMode, isAnnotateMode, isEraseMode, brushSize, annotationMode, isDragging, editMode, endDrag, onStrokeComplete, updateSelection]);

  // ============================================
  // Global pointer release safety net
  // Only active when drawing (drag has its own via isDragging effect)
  // ============================================
  useEffect(() => {
    if (!isDrawing && !isDragging) return;

    const handleGlobalPointerUp = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        setIsDrawing(false);
        currentStrokeRef.current = [];
        setCurrentStroke([]);
      }
      if (isDragging) {
        endDrag();
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [isDrawing, isDragging, endDrag]);

  // ============================================
  // Expose ref methods
  // ============================================
  useImperativeHandle(ref, () => ({
    exportMask: (options?: { pixelRatio?: number }) => {
      const pixelRatio = options?.pixelRatio ?? 1.5;
      if (strokes.length === 0) return null;

      const maskWidth = imageWidth;
      const maskHeight = imageHeight;

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      try {
        const offscreenStage = new Konva.Stage({ container, width: maskWidth, height: maskHeight });
        const layer = new Konva.Layer();
        offscreenStage.add(layer);

        layer.add(new Konva.Rect({ x: 0, y: 0, width: maskWidth, height: maskHeight, fill: 'black' }));

        const strokeWidth = 6;
        strokes.forEach((stroke) => {
          if (stroke.points.length < 2) return;
          if (stroke.shapeType === 'rectangle') {
            if (stroke.isFreeForm && stroke.points.length === 4) {
              layer.add(new Konva.Line({
                points: stroke.points.flatMap(p => [p.x, p.y]),
                stroke: 'white', strokeWidth, closed: true, lineCap: 'round', lineJoin: 'round',
              }));
            } else {
              const x = Math.min(stroke.points[0].x, stroke.points[1].x);
              const y = Math.min(stroke.points[0].y, stroke.points[1].y);
              const width = Math.abs(stroke.points[1].x - stroke.points[0].x);
              const height = Math.abs(stroke.points[1].y - stroke.points[0].y);
              layer.add(new Konva.Rect({ x, y, width, height, stroke: 'white', strokeWidth }));
            }
          } else {
            layer.add(new Konva.Line({
              points: stroke.points.flatMap(p => [p.x, p.y]),
              stroke: 'white', strokeWidth: stroke.brushSize, lineCap: 'round', lineJoin: 'round',
            }));
          }
        });

        layer.draw();
        const dataUrl = offscreenStage.toDataURL({ pixelRatio, mimeType: 'image/png' });
        offscreenStage.destroy();
        document.body.removeChild(container);
        return dataUrl;
      } catch (error) {
        handleError(error, { context: 'StrokeOverlay', showToast: false });
        document.body.removeChild(container);
        return null;
      }
    },
    getSelectedShapeId: () => selectedShapeId,
    undo: () => {
      if (strokes.length === 0) return;
      onStrokesChange(strokes.slice(0, -1));
    },
    clear: () => {
      onStrokesChange([]);
      updateSelection(null);
    },
    deleteSelected: () => {
      if (!selectedShapeId) return;
      onStrokesChange(strokes.filter(s => s.id !== selectedShapeId));
      updateSelection(null);
    },
    toggleFreeForm: () => {
      if (!selectedShapeId) return;
      const shape = strokes.find(s => s.id === selectedShapeId);
      if (!shape || shape.shapeType !== 'rectangle') return;

      let updatedShape: BrushStroke;
      if (shape.isFreeForm) {
        const corners = getRectangleCorners(shape);
        const minX = Math.min(...corners.map(c => c.x));
        const maxX = Math.max(...corners.map(c => c.x));
        const minY = Math.min(...corners.map(c => c.y));
        const maxY = Math.max(...corners.map(c => c.y));
        updatedShape = { ...shape, points: [{ x: minX, y: minY }, { x: maxX, y: maxY }], isFreeForm: false };
      } else {
        const corners = getRectangleCorners(shape);
        updatedShape = { ...shape, points: corners, isFreeForm: true };
      }
      onStrokesChange(strokes.map(s => s.id === selectedShapeId ? updatedShape : s));
    },
  }), [strokes, imageWidth, imageHeight, selectedShapeId, onStrokesChange, updateSelection]);

  // ============================================
  // Keyboard handler for DELETE key
  // ============================================
  useEffect(() => {
    if (!isInpaintMode || !isAnnotateMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.isContentEditable
      );
      if (isTyping) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
        e.preventDefault();
        onStrokesChange(strokes.filter(s => s.id !== selectedShapeId));
        updateSelection(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInpaintMode, isAnnotateMode, selectedShapeId, strokes, onStrokesChange, updateSelection]);

  // ============================================
  // Rendering
  // ============================================

  const renderStroke = (stroke: BrushStroke) => {
    const isSelected = stroke.id === selectedShapeId;
    const strokeColor = isSelected ? 'rgba(0, 255, 100, 0.9)' :
                        stroke.isErasing ? 'rgba(0, 0, 0, 0.5)' :
                        'rgba(255, 0, 0, 0.7)';

    if (stroke.shapeType === 'rectangle' && stroke.points.length >= 2) {
      if (stroke.isFreeForm && stroke.points.length === 4) {
        const flatPoints = stroke.points.flatMap(p => {
          const stagePos = imageToStage(p.x, p.y);
          return [stagePos.x, stagePos.y];
        });
        return (
          <Line
            key={stroke.id}
            points={[...flatPoints, flatPoints[0], flatPoints[1]]}
            stroke={strokeColor}
            strokeWidth={3}
            closed
          />
        );
      } else {
        const p0 = imageToStage(stroke.points[0].x, stroke.points[0].y);
        const p1 = imageToStage(stroke.points[1].x, stroke.points[1].y);
        const x = Math.min(p0.x, p1.x);
        const y = Math.min(p0.y, p1.y);
        const width = Math.abs(p1.x - p0.x);
        const height = Math.abs(p1.y - p0.y);
        return (
          <Rect
            key={stroke.id}
            x={x} y={y} width={width} height={height}
            stroke={strokeColor}
            strokeWidth={3}
          />
        );
      }
    } else {
      const flatPoints = stroke.points.flatMap(p => {
        const stagePos = imageToStage(p.x, p.y);
        return [stagePos.x, stagePos.y];
      });
      const scaledBrushSize = stroke.brushSize * scaleX;
      const effectiveStrokeColor = stroke.isErasing ? 'rgba(0, 0, 0, 1)' : strokeColor;
      return (
        <Line
          key={stroke.id}
          points={flatPoints}
          stroke={effectiveStrokeColor}
          strokeWidth={scaledBrushSize}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation={stroke.isErasing ? 'destination-out' : 'source-over'}
        />
      );
    }
  };

  const renderCurrentStroke = () => {
    if (currentStroke.length === 0) return null;
    const strokeColor = isEraseMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.4)';

    if (annotationMode === 'rectangle' && currentStroke.length >= 1) {
      const start = imageToStage(currentStroke[0].x, currentStroke[0].y);
      const end = imageToStage(currentStroke[currentStroke.length - 1].x, currentStroke[currentStroke.length - 1].y);
      return (
        <Rect
          x={Math.min(start.x, end.x)}
          y={Math.min(start.y, end.y)}
          width={Math.abs(end.x - start.x)}
          height={Math.abs(end.y - start.y)}
          stroke="rgba(100, 200, 255, 0.8)"
          strokeWidth={3}
          dash={[5, 5]}
        />
      );
    } else {
      const flatPoints = currentStroke.flatMap(p => {
        const stagePos = imageToStage(p.x, p.y);
        return [stagePos.x, stagePos.y];
      });
      return (
        <Line
          points={flatPoints}
          stroke={strokeColor}
          strokeWidth={brushSize * scaleX}
          lineCap="round"
          lineJoin="round"
        />
      );
    }
  };

  if (displayWidth === 0 || displayHeight === 0) {
    return null;
  }

  return (
    <Stage
      ref={stageRef}
      width={displayWidth}
      height={displayHeight}
      style={{
        display: 'block',
        cursor: 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Layer>
        {strokes.map(stroke => renderStroke(stroke))}
        {renderCurrentStroke()}
      </Layer>
    </Stage>
  );
});

StrokeOverlay.displayName = 'StrokeOverlay';
