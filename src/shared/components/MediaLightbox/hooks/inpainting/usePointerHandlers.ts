/**
 * Pointer event handlers for Konva-based drawing.
 * Handles stroke drawing, shape selection, and drag operations.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { BrushStroke, EditMode, AnnotationMode } from './types';
import { isPointOnShape, getClickedCornerIndex, getRectangleClickType, getRectangleCorners } from './shapeHelpers';

interface UsePointerHandlersProps {
  // Mode state
  isInpaintMode: boolean;
  editMode: EditMode;
  annotationMode: AnnotationMode;
  isAnnotateMode: boolean;
  // Drawing state
  brushStrokes: BrushStroke[];
  annotationStrokes: BrushStroke[];
  isEraseMode: boolean;
  brushSize: number;
  // Setters
  setBrushStrokes: React.Dispatch<React.SetStateAction<BrushStroke[]>>;
  setAnnotationStrokes: React.Dispatch<React.SetStateAction<BrushStroke[]>>;
  // Text mode hint
  setShowTextModeHint: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UsePointerHandlersReturn {
  // Drawing state
  isDrawing: boolean;
  currentStroke: Array<{ x: number; y: number }>;
  selectedShapeId: string | null;
  setSelectedShapeId: React.Dispatch<React.SetStateAction<string | null>>;
  // Handlers
  handleKonvaPointerDown: (point: { x: number; y: number }, e: KonvaEventObject<PointerEvent>) => void;
  handleKonvaPointerMove: (point: { x: number; y: number }, e: KonvaEventObject<PointerEvent>) => void;
  handleKonvaPointerUp: (e: KonvaEventObject<PointerEvent>) => void;
  handleShapeClick: (strokeId: string, point: { x: number; y: number }) => void;
}

export function usePointerHandlers({
  isInpaintMode,
  editMode,
  annotationMode,
  isAnnotateMode,
  brushStrokes,
  annotationStrokes,
  isEraseMode,
  brushSize,
  setBrushStrokes,
  setAnnotationStrokes,
  setShowTextModeHint,
}: UsePointerHandlersProps): UsePointerHandlersReturn {
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  // Drag state
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize'>('resize');
  const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null);

  // Refs for tracking
  const lastClickTimeRef = useRef<number>(0);
  const lastClickPositionRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const selectedShapeRef = useRef<BrushStroke | null>(null);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedCanvasRef = useRef<boolean>(false);
  const lastDrawnPointRef = useRef<{ x: number; y: number } | null>(null);

  // Cleanup hint timeout on unmount
  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Handle pointer down - start drawing or select/drag shape
   */
  const handleKonvaPointerDown = useCallback((point: { x: number; y: number }, e: KonvaEventObject<PointerEvent>) => {
    const { x, y } = point;

    // Allow both inpaint mode and annotate mode
    if (!isInpaintMode && !isAnnotateMode) return;

    // Prevent drawing in text edit mode
    if (editMode === 'text') {
      setShowTextModeHint(true);
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => {
        setShowTextModeHint(false);
        hintTimeoutRef.current = null;
      }, 2000);
      return;
    }

    // Store drag start position for tap detection
    dragStartPosRef.current = { x, y };

    // In annotate mode, check if clicking on existing shape
    if (isAnnotateMode && annotationMode === 'rectangle') {
      for (let i = brushStrokes.length - 1; i >= 0; i--) {
        const stroke = brushStrokes[i];
        if (stroke.shapeType === 'rectangle' && isPointOnShape(x, y, stroke)) {
          console.log('[Annotate] Clicked on rectangle:', stroke.id);
          setSelectedShapeId(stroke.id);

          // Check for corner click (for free-form dragging)
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
            setDraggingCornerIndex(cornerIndex);
            setIsDraggingShape(true);
            selectedShapeRef.current = stroke;
            return;
          }

          // Double-click to enable free-form mode
          if (isDoubleClick && cornerIndex !== null && !stroke.isFreeForm) {
            const corners = getRectangleCorners(stroke);
            const updatedStroke: BrushStroke = {
              ...stroke,
              points: corners,
              isFreeForm: true
            };
            const newStrokes = brushStrokes.map(s => s.id === stroke.id ? updatedStroke : s);
            setBrushStrokes(newStrokes);
            selectedShapeRef.current = updatedStroke;
            setDraggingCornerIndex(cornerIndex);
            setIsDraggingShape(true);
            return;
          }

          // Determine if clicking edge (move) or corner (resize)
          const clickType = getRectangleClickType(x, y, stroke);

          if (clickType === 'edge') {
            setDragMode('move');
            setIsDraggingShape(true);
            selectedShapeRef.current = stroke;
            const startPoint = stroke.points[0];
            setDragOffset({ x: x - startPoint.x, y: y - startPoint.y });
            return;
          } else if (clickType === 'corner' && !stroke.isFreeForm) {
            setDragMode('resize');
            setIsDraggingShape(true);
            selectedShapeRef.current = stroke;
            const startPoint = stroke.points[0];
            setDragOffset({ x: x - startPoint.x, y: y - startPoint.y });
            return;
          }

          return; // Clicked in middle, just keep selected
        }
      }

      // Clicked on empty space, deselect
      if (selectedShapeId) {
        setSelectedShapeId(null);
      }
    }

    // Start new stroke
    console.log('[Inpaint] Starting new stroke (Konva)', { x, y, isAnnotateMode, annotationMode });
    setIsDrawing(true);
    hasInitializedCanvasRef.current = false;
    lastDrawnPointRef.current = null;
    setCurrentStroke([{ x, y }]);
  }, [isInpaintMode, isAnnotateMode, annotationMode, brushStrokes, selectedShapeId, editMode, setBrushStrokes, setShowTextModeHint]);

  /**
   * Handle pointer move - continue drawing or dragging
   */
  const handleKonvaPointerMove = useCallback((point: { x: number; y: number }, e: KonvaEventObject<PointerEvent>) => {
    // Allow both inpaint mode and annotate mode
    if (!isInpaintMode && !isAnnotateMode) return;
    if (editMode === 'text' && !isDraggingShape) return;

    // Check if the pointer button was released outside the canvas and user returned
    if ((isDrawing || isDraggingShape) && e.evt.buttons === 0) {
      console.log('[Inpaint] Pointer returned with no button pressed - canceling');
      if (isDrawing) {
        setIsDrawing(false);
        hasInitializedCanvasRef.current = false;
        lastDrawnPointRef.current = null;
        setCurrentStroke([]);
      }
      if (isDraggingShape) {
        setIsDraggingShape(false);
        setDragOffset(null);
        setDraggingCornerIndex(null);
        selectedShapeRef.current = null;
      }
      return;
    }

    const { x, y } = point;

    // Handle dragging selected shape
    if (isDraggingShape && selectedShapeRef.current) {
      const shape = selectedShapeRef.current;

      // Free-form corner dragging
      if (draggingCornerIndex !== null && shape.isFreeForm && shape.points.length === 4) {
        const newPoints = [...shape.points];
        newPoints[draggingCornerIndex] = { x, y };

        const updatedShape: BrushStroke = {
          ...shape,
          points: newPoints,
          isFreeForm: true
        };

        const newStrokes = brushStrokes.map(s => s.id === shape.id ? updatedShape : s);
        setBrushStrokes(newStrokes);
        selectedShapeRef.current = updatedShape;
        return;
      }

      // Move mode
      if (dragMode === 'move' && dragOffset) {
        const newStartX = x - dragOffset.x;
        const newStartY = y - dragOffset.y;
        const oldStartPoint = shape.points[0];
        const deltaX = newStartX - oldStartPoint.x;
        const deltaY = newStartY - oldStartPoint.y;

        const updatedPoints = shape.points.map(p => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        }));

        const updatedShape: BrushStroke = {
          ...shape,
          points: updatedPoints,
          isFreeForm: shape.isFreeForm
        };

        const newStrokes = brushStrokes.map(s => s.id === shape.id ? updatedShape : s);
        setBrushStrokes(newStrokes);
        selectedShapeRef.current = updatedShape;
        return;
      }

      // Resize mode
      if (dragMode === 'resize' && !shape.isFreeForm) {
        const endPoint = shape.points[1];
        const updatedShape: BrushStroke = {
          ...shape,
          points: [{ x, y }, endPoint]
        };

        const newStrokes = brushStrokes.map(s => s.id === shape.id ? updatedShape : s);
        setBrushStrokes(newStrokes);
        selectedShapeRef.current = updatedShape;
        return;
      }
    }

    // Continue drawing stroke
    if (!isDrawing) return;

    setCurrentStroke(prev => [...prev, { x, y }]);
  }, [isInpaintMode, isAnnotateMode, editMode, isDrawing, isDraggingShape, dragMode, dragOffset, draggingCornerIndex, brushStrokes, setBrushStrokes]);

  /**
   * Handle pointer up - finish drawing or dragging
   */
  const handleKonvaPointerUp = useCallback((e: KonvaEventObject<PointerEvent>) => {
    // Handle finishing drag operation
    if (isDraggingShape) {
      setIsDraggingShape(false);
      setDragOffset(null);
      setDraggingCornerIndex(null);
      selectedShapeRef.current = null;
      return;
    }

    // Allow both inpaint mode and annotate mode
    if ((!isInpaintMode && !isAnnotateMode) || !isDrawing) return;
    if (editMode === 'text') return;

    setIsDrawing(false);
    hasInitializedCanvasRef.current = false;
    lastDrawnPointRef.current = null;

    if (currentStroke.length > 1) {
      const shapeType = isAnnotateMode && annotationMode ? annotationMode : 'line';

      // For rectangles, require minimum drag distance
      if (shapeType === 'rectangle') {
        const startPoint = currentStroke[0];
        const endPoint = currentStroke[currentStroke.length - 1];
        const dragDistance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
        if (dragDistance < 10) {
          setCurrentStroke([]);
          return;
        }
      }

      const strokePoints = shapeType === 'rectangle'
        ? [currentStroke[0], currentStroke[currentStroke.length - 1]]
        : currentStroke;

      const newStroke: BrushStroke = {
        id: nanoid(),
        points: strokePoints,
        isErasing: isEraseMode,
        brushSize: brushSize,
        shapeType
      };

      // Limit to one rectangle in annotate mode
      if (isAnnotateMode && shapeType === 'rectangle' && annotationStrokes.length > 0) {
        console.log('[Annotate] Replacing existing rectangle');
        setAnnotationStrokes([newStroke]);
      } else {
        console.log('[Inpaint] Adding new stroke');
        if (isAnnotateMode) {
          setAnnotationStrokes(prev => [...prev, newStroke]);
        } else {
          setBrushStrokes(prev => [...prev, newStroke]);
        }
      }

      // Auto-select rectangle after drawing
      if (isAnnotateMode && shapeType === 'rectangle') {
        setSelectedShapeId(newStroke.id);
      }

      console.log('[Inpaint] Stroke added', {
        strokeId: newStroke.id,
        shapeType,
        points: newStroke.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        mode: isAnnotateMode ? 'annotate' : 'inpaint',
      });
    }

    setCurrentStroke([]);
  }, [isInpaintMode, isDrawing, currentStroke, isEraseMode, brushSize, isAnnotateMode, annotationMode, isDraggingShape, editMode, annotationStrokes.length, setBrushStrokes, setAnnotationStrokes]);

  /**
   * Handle shape click (from StrokeOverlay)
   */
  const handleShapeClick = useCallback((strokeId: string, point: { x: number; y: number }) => {
    console.log('[Annotate] Shape clicked:', strokeId);
    setSelectedShapeId(strokeId);
  }, []);

  /**
   * Global pointerup listener to catch pointer release outside canvas
   * Prevents "stuck" drawing state when dragging off the edge of the screen
   */
  useEffect(() => {
    if (!isDrawing && !isDraggingShape) return;

    const handleGlobalPointerUp = () => {
      if (isDrawing) {
        console.log('[Inpaint] Global pointerup - releasing stuck drawing state');
        setIsDrawing(false);
        hasInitializedCanvasRef.current = false;
        lastDrawnPointRef.current = null;
        setCurrentStroke([]);
      }
      if (isDraggingShape) {
        console.log('[Inpaint] Global pointerup - releasing stuck drag state');
        setIsDraggingShape(false);
        setDragOffset(null);
        setDraggingCornerIndex(null);
        selectedShapeRef.current = null;
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [isDrawing, isDraggingShape]);

  return {
    isDrawing,
    currentStroke,
    selectedShapeId,
    setSelectedShapeId,
    handleKonvaPointerDown,
    handleKonvaPointerMove,
    handleKonvaPointerUp,
    handleShapeClick,
  };
}
