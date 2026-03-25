import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { ImageIcon, Type } from 'lucide-react';
import type { TimelineRow } from '@xzdarcy/timeline-engine';
import type { ClipMeta } from '@/tools/video-editor/lib/timeline-data';
import type { ResolvedTimelineConfig } from '@/tools/video-editor/types';

interface OverlayEditorProps {
  rows: TimelineRow[];
  meta: Record<string, ClipMeta>;
  registry: ResolvedTimelineConfig['registry'];
  currentTime: number;
  playerContainerRef: RefObject<HTMLDivElement | null>;
  trackScaleMap: Record<string, number>;
  compositionWidth: number;
  compositionHeight: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onOverlayChange: (actionId: string, patch: Partial<ClipMeta>) => void;
  onDoubleClickAsset?: (assetKey: string) => void;
}

type DragMode =
  | 'move'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se'
  | 'crop-n'
  | 'crop-s'
  | 'crop-e'
  | 'crop-w';
type CropValues = { cropTop: number; cropBottom: number; cropLeft: number; cropRight: number };
type OverlayBounds = { x: number; y: number; width: number; height: number };
type OverlayLayout = { left: number; top: number; width: number; height: number };
type OverlayViewModel = {
  actionId: string;
  track: string;
  label: string;
  bounds: OverlayBounds;
  fullBounds: OverlayBounds;
  cropValues: CropValues;
  isText: boolean;
};

const MIN_CLIP_SIZE = 20;
const MAX_CROP_FRACTION = 0.99;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeCropValues = (cropValues?: Partial<CropValues>): CropValues => {
  let cropTop = clamp(cropValues?.cropTop ?? 0, 0, 1);
  let cropBottom = clamp(cropValues?.cropBottom ?? 0, 0, 1);
  let cropLeft = clamp(cropValues?.cropLeft ?? 0, 0, 1);
  let cropRight = clamp(cropValues?.cropRight ?? 0, 0, 1);

  const horizontalTotal = cropLeft + cropRight;
  if (horizontalTotal > MAX_CROP_FRACTION) {
    const scale = MAX_CROP_FRACTION / horizontalTotal;
    cropLeft *= scale;
    cropRight *= scale;
  }

  const verticalTotal = cropTop + cropBottom;
  if (verticalTotal > MAX_CROP_FRACTION) {
    const scale = MAX_CROP_FRACTION / verticalTotal;
    cropTop *= scale;
    cropBottom *= scale;
  }

  return { cropTop, cropBottom, cropLeft, cropRight };
};

const getVisibleBoundsFromCrop = (fullBounds: OverlayBounds, cropValues: CropValues): OverlayBounds => {
  const normalizedCrop = normalizeCropValues(cropValues);
  const visibleWidthFactor = Math.max(0.01, 1 - normalizedCrop.cropLeft - normalizedCrop.cropRight);
  const visibleHeightFactor = Math.max(0.01, 1 - normalizedCrop.cropTop - normalizedCrop.cropBottom);

  return {
    x: fullBounds.x + fullBounds.width * normalizedCrop.cropLeft,
    y: fullBounds.y + fullBounds.height * normalizedCrop.cropTop,
    width: fullBounds.width * visibleWidthFactor,
    height: fullBounds.height * visibleHeightFactor,
  };
};

const getFullBoundsFromVisibleBounds = (visibleBounds: OverlayBounds, cropValues: CropValues): OverlayBounds => {
  const normalizedCrop = normalizeCropValues(cropValues);
  const visibleWidthFactor = Math.max(0.01, 1 - normalizedCrop.cropLeft - normalizedCrop.cropRight);
  const visibleHeightFactor = Math.max(0.01, 1 - normalizedCrop.cropTop - normalizedCrop.cropBottom);
  const fullWidth = visibleBounds.width / visibleWidthFactor;
  const fullHeight = visibleBounds.height / visibleHeightFactor;

  return {
    x: visibleBounds.x - fullWidth * normalizedCrop.cropLeft,
    y: visibleBounds.y - fullHeight * normalizedCrop.cropTop,
    width: fullWidth,
    height: fullHeight,
  };
};

function OverlayEditorComponent({
  rows,
  meta,
  registry,
  currentTime,
  playerContainerRef,
  trackScaleMap,
  compositionWidth,
  compositionHeight,
  selectedClipId,
  onSelectClip,
  onOverlayChange,
  onDoubleClickAsset,
}: OverlayEditorProps) {
  const [layout, setLayout] = useState<OverlayLayout | null>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [dragOverride, setDragOverride] = useState<{
    actionId: string;
    bounds: OverlayBounds;
    cropValues: CropValues;
    startBounds: OverlayBounds;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragState = useRef<{
    mode: DragMode;
    actionId: string;
    startMouseX: number;
    startMouseY: number;
    scaleX: number;
    scaleY: number;
    startBounds: OverlayBounds;
    startFullBounds: OverlayBounds;
    startCropValues: CropValues;
    latestBounds: OverlayBounds;
    cropValues: CropValues;
    hasChanges: boolean;
  } | null>(null);

  const getTrackDefaultBounds = useCallback((trackId: string): OverlayBounds => {
    const trackScale = Math.max(trackScaleMap[trackId] ?? 1, 0.01);
    return {
      x: Math.round(compositionWidth * (1 - trackScale) / 2),
      y: Math.round(compositionHeight * (1 - trackScale) / 2),
      width: Math.round(compositionWidth * trackScale),
      height: Math.round(compositionHeight * trackScale),
    };
  }, [compositionHeight, compositionWidth, trackScaleMap]);

  const getClipBounds = useCallback((clipMeta: ClipMeta, trackId: string): OverlayBounds => {
    if (clipMeta.clipType === 'text') {
      return {
        x: clipMeta.x ?? 0,
        y: clipMeta.y ?? 0,
        width: clipMeta.width ?? 640,
        height: clipMeta.height ?? 180,
      };
    }

    if (
      clipMeta.x !== undefined
      || clipMeta.y !== undefined
      || clipMeta.width !== undefined
      || clipMeta.height !== undefined
    ) {
      return {
        x: clipMeta.x ?? 0,
        y: clipMeta.y ?? 0,
        width: clipMeta.width ?? compositionWidth,
        height: clipMeta.height ?? compositionHeight,
      };
    }

    return getTrackDefaultBounds(trackId);
  }, [compositionHeight, compositionWidth, getTrackDefaultBounds]);

  const activeOverlays = useMemo(() => {
    const overlays: OverlayViewModel[] = [];
    for (const row of rows) {
      if (!row.id.startsWith('V')) {
        continue;
      }

      for (const action of row.actions) {
        if (currentTime < action.start || currentTime >= action.end) {
          continue;
        }

        const clipMeta = meta[action.id];
        if (!clipMeta || clipMeta.track !== row.id) {
          continue;
        }

        const hasPositionOverride = clipMeta.clipType === 'text'
          || clipMeta.x !== undefined
          || clipMeta.y !== undefined
          || clipMeta.width !== undefined
          || clipMeta.height !== undefined
          || clipMeta.cropTop !== undefined
          || clipMeta.cropBottom !== undefined
          || clipMeta.cropLeft !== undefined
          || clipMeta.cropRight !== undefined;
        if (!hasPositionOverride && selectedClipId !== action.id) {
          continue;
        }

        const fullBounds = getClipBounds(clipMeta, row.id);
        const cropValues = normalizeCropValues({
          cropTop: clipMeta.cropTop,
          cropBottom: clipMeta.cropBottom,
          cropLeft: clipMeta.cropLeft,
          cropRight: clipMeta.cropRight,
        });
        overlays.push({
          actionId: action.id,
          track: row.id,
          label: clipMeta.text?.content || clipMeta.asset || action.id,
          bounds: getVisibleBoundsFromCrop(fullBounds, cropValues),
          fullBounds,
          cropValues,
          isText: clipMeta.clipType === 'text',
        });
      }
    }

    return overlays;
  }, [currentTime, getClipBounds, meta, rows, selectedClipId]);

  const effectiveOverlays = useMemo(() => {
    if (!dragOverride) {
      return activeOverlays;
    }

    return activeOverlays.map((overlay) => (
      overlay.actionId === dragOverride.actionId
        ? {
            ...overlay,
            bounds: dragOverride.bounds,
            fullBounds: getFullBoundsFromVisibleBounds(dragOverride.bounds, dragOverride.cropValues),
            cropValues: dragOverride.cropValues,
          }
        : overlay
    ));
  }, [activeOverlays, dragOverride]);

  const computeLayout = useCallback((): OverlayLayout | null => {
    const player = playerContainerRef.current;
    if (!player || compositionWidth <= 0 || compositionHeight <= 0) {
      return null;
    }

    const parent = player.offsetParent as HTMLElement | null;
    if (!parent) {
      return null;
    }

    const playerRect = player.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const videoAspect = compositionWidth / compositionHeight;
    const containerAspect = playerRect.width / Math.max(1, playerRect.height);
    const videoWidth = containerAspect > videoAspect ? playerRect.height * videoAspect : playerRect.width;
    const videoHeight = containerAspect > videoAspect ? playerRect.height : playerRect.width / videoAspect;

    return {
      left: playerRect.left - parentRect.left + (playerRect.width - videoWidth) / 2,
      top: playerRect.top - parentRect.top + (playerRect.height - videoHeight) / 2,
      width: videoWidth,
      height: videoHeight,
    };
  }, [compositionHeight, compositionWidth, playerContainerRef]);

  useEffect(() => {
    const updateLayout = () => setLayout(computeLayout());

    updateLayout();
    window.addEventListener('resize', updateLayout);
    const player = playerContainerRef.current;
    const observer = typeof ResizeObserver !== 'undefined' && player ? new ResizeObserver(updateLayout) : null;
    if (observer && player) {
      observer.observe(player);
    }

    return () => {
      window.removeEventListener('resize', updateLayout);
      observer?.disconnect();
    };
  }, [computeLayout, playerContainerRef]);

  const commitDragChange = useCallback(() => {
    const state = dragState.current;
    dragState.current = null;
    setDragOverride(null);

    if (!state || !state.hasChanges) {
      return;
    }

    if (state.mode.startsWith('crop-')) {
      onOverlayChange(state.actionId, {
        cropTop: state.cropValues.cropTop || undefined,
        cropBottom: state.cropValues.cropBottom || undefined,
        cropLeft: state.cropValues.cropLeft || undefined,
        cropRight: state.cropValues.cropRight || undefined,
      });
      return;
    }

    onOverlayChange(state.actionId, getFullBoundsFromVisibleBounds(state.latestBounds, state.cropValues));
  }, [onOverlayChange]);

  const cancelDrag = useCallback(() => {
    dragState.current = null;
    setDragOverride(null);
    setDragActive(false);
  }, []);

  useEffect(() => {
    if (!dragActive) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const state = dragState.current;
      if (!state) {
        return;
      }

      const deltaX = (event.clientX - state.startMouseX) * state.scaleX;
      const deltaY = (event.clientY - state.startMouseY) * state.scaleY;
      let nextBounds = { ...state.startBounds };
      let nextCropValues = state.cropValues;

      if (state.mode === 'move') {
        nextBounds.x += deltaX;
        nextBounds.y += deltaY;
      } else if (state.mode.startsWith('crop-')) {
        const minVisibleWidthFraction = Math.min(
          MAX_CROP_FRACTION,
          MIN_CLIP_SIZE / Math.max(MIN_CLIP_SIZE, state.startFullBounds.width),
        );
        const minVisibleHeightFraction = Math.min(
          MAX_CROP_FRACTION,
          MIN_CLIP_SIZE / Math.max(MIN_CLIP_SIZE, state.startFullBounds.height),
        );
        nextCropValues = { ...state.startCropValues };

        if (state.mode === 'crop-e') {
          nextCropValues.cropRight = clamp(
            state.startCropValues.cropRight - deltaX / Math.max(MIN_CLIP_SIZE, state.startFullBounds.width),
            0,
            1 - state.startCropValues.cropLeft - minVisibleWidthFraction,
          );
        }
        if (state.mode === 'crop-w') {
          nextCropValues.cropLeft = clamp(
            state.startCropValues.cropLeft + deltaX / Math.max(MIN_CLIP_SIZE, state.startFullBounds.width),
            0,
            1 - state.startCropValues.cropRight - minVisibleWidthFraction,
          );
        }
        if (state.mode === 'crop-s') {
          nextCropValues.cropBottom = clamp(
            state.startCropValues.cropBottom - deltaY / Math.max(MIN_CLIP_SIZE, state.startFullBounds.height),
            0,
            1 - state.startCropValues.cropTop - minVisibleHeightFraction,
          );
        }
        if (state.mode === 'crop-n') {
          nextCropValues.cropTop = clamp(
            state.startCropValues.cropTop + deltaY / Math.max(MIN_CLIP_SIZE, state.startFullBounds.height),
            0,
            1 - state.startCropValues.cropBottom - minVisibleHeightFraction,
          );
        }

        nextCropValues = normalizeCropValues(nextCropValues);
        nextBounds = getVisibleBoundsFromCrop(state.startFullBounds, nextCropValues);
      } else {
        if (state.mode.includes('e')) {
          nextBounds.width = Math.max(MIN_CLIP_SIZE, state.startBounds.width + deltaX);
        }
        if (state.mode.includes('s')) {
          nextBounds.height = Math.max(MIN_CLIP_SIZE, state.startBounds.height + deltaY);
        }
        if (state.mode.includes('w')) {
          nextBounds.x = state.startBounds.x + deltaX;
          nextBounds.width = Math.max(MIN_CLIP_SIZE, state.startBounds.width - deltaX);
        }
        if (state.mode.includes('n')) {
          nextBounds.y = state.startBounds.y + deltaY;
          nextBounds.height = Math.max(MIN_CLIP_SIZE, state.startBounds.height - deltaY);
        }
      }

      state.latestBounds = nextBounds;
      state.cropValues = nextCropValues;
      state.hasChanges = true;
      setDragOverride({
        actionId: state.actionId,
        bounds: nextBounds,
        cropValues: nextCropValues,
        startBounds: state.startBounds,
      });
    };

    const onMouseUp = () => {
      commitDragChange();
      setDragActive(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelDrag();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', cancelDrag);
    window.addEventListener('contextmenu', cancelDrag);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', cancelDrag);
      window.removeEventListener('contextmenu', cancelDrag);
    };
  }, [dragActive, commitDragChange, cancelDrag]);

  const startDrag = useCallback((event: ReactMouseEvent, overlay: OverlayViewModel, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectClip(overlay.actionId);

    const scaleX = compositionWidth / Math.max(1, layout?.width ?? 1);
    const scaleY = compositionHeight / Math.max(1, layout?.height ?? 1);
    dragState.current = {
      mode,
      actionId: overlay.actionId,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      scaleX,
      scaleY,
      startBounds: { ...overlay.bounds },
      startFullBounds: { ...overlay.fullBounds },
      startCropValues: { ...overlay.cropValues },
      latestBounds: { ...overlay.bounds },
      cropValues: { ...overlay.cropValues },
      hasChanges: false,
    };
    setDragActive(true);
  }, [compositionHeight, compositionWidth, layout, onSelectClip]);

  const beginTextEdit = useCallback((actionId: string) => {
    const clipMeta = meta[actionId];
    if (clipMeta?.clipType !== 'text') {
      return;
    }

    setEditingClipId(actionId);
    setEditText(clipMeta.text?.content ?? '');
  }, [meta]);

  const commitText = useCallback(() => {
    if (!editingClipId) {
      return;
    }

    const clipMeta = meta[editingClipId];
    if (clipMeta?.clipType === 'text') {
      onOverlayChange(editingClipId, {
        text: {
          ...(clipMeta.text ?? { content: '' }),
          content: editText,
        },
      });
    }
    setEditingClipId(null);
  }, [editText, editingClipId, meta, onOverlayChange]);

  if (!layout) {
    return null;
  }

  const fontScale = layout.width / Math.max(1, compositionWidth);
  const draggingId = dragOverride?.actionId ?? null;

  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height }}
    >
      {effectiveOverlays.map((overlay) => {
        const left = (overlay.bounds.x / compositionWidth) * layout.width;
        const top = (overlay.bounds.y / compositionHeight) * layout.height;
        const width = (overlay.bounds.width / compositionWidth) * layout.width;
        const height = (overlay.bounds.height / compositionHeight) * layout.height;
        const style: CSSProperties = { left, top, width, height };
        const isSelected = selectedClipId === overlay.actionId;
        const hasCrop = (
          overlay.cropValues.cropTop > 0
          || overlay.cropValues.cropBottom > 0
          || overlay.cropValues.cropLeft > 0
          || overlay.cropValues.cropRight > 0
        );
        const ghostStyle: CSSProperties | null = isSelected && hasCrop
          ? {
              left: ((overlay.fullBounds.x - overlay.bounds.x) / compositionWidth) * layout.width,
              top: ((overlay.fullBounds.y - overlay.bounds.y) / compositionHeight) * layout.height,
              width: (overlay.fullBounds.width / compositionWidth) * layout.width,
              height: (overlay.fullBounds.height / compositionHeight) * layout.height,
            }
          : null;
        const clipMeta = meta[overlay.actionId];
        const scaledFontSize = Math.max(12, (clipMeta?.text?.fontSize ?? 64) * fontScale);
        const assetEntry = clipMeta?.asset ? registry[clipMeta.asset] : undefined;
        const isDragging = draggingId === overlay.actionId;
        const isImageClip = Boolean(assetEntry?.type?.startsWith('image'));
        const dragPreview = isDragging ? (
          <div className="absolute inset-0 overflow-hidden rounded bg-black/65">
            {clipMeta?.clipType === 'text' ? (
              <div
                className="flex h-full w-full items-center justify-center px-4 text-center"
                style={{
                  color: clipMeta.text?.color ?? '#ffffff',
                  fontFamily: clipMeta.text?.fontFamily ?? 'Georgia, serif',
                  fontSize: scaledFontSize,
                  fontWeight: clipMeta.text?.bold ? 700 : 400,
                  fontStyle: clipMeta.text?.italic ? 'italic' : 'normal',
                  textAlign: clipMeta.text?.align ?? 'center',
                  lineHeight: 1.1,
                  textShadow: '0 2px 18px rgba(0, 0, 0, 0.35)',
                }}
              >
                {clipMeta.text?.content ?? 'Text'}
              </div>
            ) : isImageClip && assetEntry?.src ? (
              <img
                src={assetEntry.src}
                alt=""
                className="h-full w-full object-cover opacity-95"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/90">
                {clipMeta?.clipType === 'text' ? <Type className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                <span className="max-w-full truncate px-3 text-xs">{overlay.label}</span>
              </div>
            )}
          </div>
        ) : null;

        return (
          <div
            key={overlay.actionId}
            data-overlay-hit="true"
            className="absolute pointer-events-auto"
            style={style}
          >
            {ghostStyle && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded border border-dashed border-white/35 bg-white/5 opacity-80"
                style={ghostStyle}
              />
            )}
            {editingClipId === overlay.actionId && overlay.isText ? (
              <textarea
                data-inline-text-editor="true"
                className="h-full w-full resize-none rounded border border-sky-400 bg-black/80 p-2 text-white outline-none"
                value={editText}
                style={{
                  fontSize: scaledFontSize,
                  color: clipMeta?.text?.color ?? '#ffffff',
                  textAlign: clipMeta?.text?.align ?? 'left',
                }}
                onChange={(event) => setEditText(event.target.value)}
                onBlur={commitText}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    commitText();
                  }
                }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className={`group relative h-full w-full rounded border text-left transition ${isSelected ? 'border-sky-400 bg-sky-400/10 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]' : 'border-white/30 bg-black/10 hover:border-white/60'}`}
                onMouseDown={(event) => startDrag(event, overlay, 'move')}
                onDoubleClick={() => {
                  if (clipMeta?.clipType === 'text') {
                    beginTextEdit(overlay.actionId);
                  } else if (clipMeta?.asset) {
                    onDoubleClickAsset?.(clipMeta.asset);
                  }
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectClip(overlay.actionId);
                }}
              >
                {dragPreview}
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                  {overlay.label}
                </span>
                {(['resize-nw', 'resize-ne', 'resize-sw', 'resize-se'] as const).map((mode) => {
                  const position = {
                    'resize-nw': 'left-0 top-0 cursor-nwse-resize',
                    'resize-ne': 'right-0 top-0 cursor-nesw-resize',
                    'resize-sw': 'bottom-0 left-0 cursor-nesw-resize',
                    'resize-se': 'bottom-0 right-0 cursor-nwse-resize',
                  }[mode];
                  return (
                    <span
                      key={mode}
                      className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-sky-400 ${position}`}
                      onMouseDown={(event) => startDrag(event, overlay, mode)}
                    />
                  );
                })}
                {!overlay.isText && ([
                  {
                    mode: 'crop-n',
                    hitClassName: 'left-1.5 right-1.5 top-0 h-3 -translate-y-1/2 cursor-ns-resize',
                    lineClassName: 'left-1 right-1 top-1/2 h-px -translate-y-1/2',
                  },
                  {
                    mode: 'crop-s',
                    hitClassName: 'bottom-0 left-1.5 right-1.5 h-3 translate-y-1/2 cursor-ns-resize',
                    lineClassName: 'bottom-1/2 left-1 right-1 h-px translate-y-1/2',
                  },
                  {
                    mode: 'crop-w',
                    hitClassName: 'bottom-1.5 left-0 top-1.5 w-3 -translate-x-1/2 cursor-ew-resize',
                    lineClassName: 'bottom-1 left-1/2 top-1 w-px -translate-x-1/2',
                  },
                  {
                    mode: 'crop-e',
                    hitClassName: 'bottom-1.5 right-0 top-1.5 w-3 translate-x-1/2 cursor-ew-resize',
                    lineClassName: 'bottom-1 right-1/2 top-1 w-px translate-x-1/2',
                  },
                ] as const).map(({ mode, hitClassName, lineClassName }) => (
                  <span
                    key={mode}
                    className={`absolute ${hitClassName}`}
                    onMouseDown={(event) => startDrag(event, overlay, mode)}
                  >
                    <span
                      className={`pointer-events-none absolute rounded-full transition ${lineClassName} ${isSelected ? 'bg-sky-300/70' : 'bg-white/0 group-hover:bg-white/50'}`}
                    />
                  </span>
                ))}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const OverlayEditor = memo(OverlayEditorComponent);

export default OverlayEditor;
