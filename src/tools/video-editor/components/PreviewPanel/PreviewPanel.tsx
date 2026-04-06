import { memo, type RefObject } from 'react';
import OverlayEditor from '@/tools/video-editor/components/PreviewPanel/OverlayEditor';
import {
  useTimelineEditorData,
  useTimelineEditorOps,
} from '@/tools/video-editor/contexts/TimelineEditorContext';
import { useTimelinePlaybackContext } from '@/tools/video-editor/contexts/TimelinePlaybackContext';
import { useRenderDiagnostic } from '@/tools/video-editor/hooks/usePerfDiagnostics';

interface PreviewPanelProps {
  previewSlotRef: RefObject<HTMLDivElement | null>;
}

function PreviewPanelComponent({ previewSlotRef }: PreviewPanelProps) {
  useRenderDiagnostic('PreviewPanel');
  const {
    data,
    resolvedConfig,
    trackScaleMap,
    compositionSize,
    selectedClipId,
  } = useTimelineEditorData();
  const {
    setSelectedClipId,
    onOverlayChange,
    onDoubleClickAsset,
  } = useTimelineEditorOps();
  const {
    playerContainerRef,
    currentTime,
  } = useTimelinePlaybackContext();

  if (!data || !resolvedConfig) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card/80">
      <div className="relative flex min-h-0 flex-1">
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background"
          onMouseDownCapture={(event) => {
            const target = event.target;
            if (!(target instanceof Element)) {
              return;
            }

            if (target.closest("[data-overlay-hit='true'], [data-inline-text-editor='true']")) {
              return;
            }

            setSelectedClipId(null);
          }}
        >
          <div ref={previewSlotRef} className="flex h-full w-full min-h-0 items-center justify-center" />
          <OverlayEditor
            rows={data.rows}
            meta={data.meta}
            registry={resolvedConfig.registry}
            currentTime={currentTime}
            playerContainerRef={playerContainerRef}
            trackScaleMap={trackScaleMap}
            compositionWidth={compositionSize.width}
            compositionHeight={compositionSize.height}
            selectedClipId={selectedClipId}
            onSelectClip={setSelectedClipId}
            onOverlayChange={onOverlayChange}
            onDoubleClickAsset={onDoubleClickAsset}
          />
        </div>
      </div>
    </div>
  );
}

export const PreviewPanel = memo(PreviewPanelComponent);
