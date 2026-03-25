import { memo, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import AssetPanel from '@/tools/video-editor/components/PropertiesPanel/AssetPanel';
import { ClipPanel, getVisibleClipTabs } from '@/tools/video-editor/components/PropertiesPanel/ClipPanel';
import { useTimelineEditorContext } from '@/tools/video-editor/contexts/TimelineEditorContext';

function PropertiesPanelComponent() {
  const {
    data,
    selectedClip,
    selectedTrack,
    selectedClipHasPredecessor,
    compositionSize,
    setSelectedClipId,
    handleDeleteClip,
    handleSelectedClipChange,
    handleResetClipPosition,
    handleToggleMute,
    preferences,
    setActiveClipTab,
    setAssetPanelState,
    uploadFiles,
  } = useTimelineEditorContext();
  const [assetsExpanded, setAssetsExpanded] = useState(false);
  const prevClipIdRef = useRef(selectedClip?.id);

  useEffect(() => {
    const nextVisibleTabs = getVisibleClipTabs(selectedClip, selectedTrack);
    const isClipChange = selectedClip?.id !== prevClipIdRef.current;

    if (isClipChange && selectedClip?.clipType === 'text') {
      setActiveClipTab('text');
    } else if (!nextVisibleTabs.includes(preferences.activeClipTab)) {
      setActiveClipTab('effects');
    }

    prevClipIdRef.current = selectedClip?.id;
  }, [preferences.activeClipTab, selectedClip, selectedTrack, setActiveClipTab]);

  if (!data) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card/80">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => setAssetsExpanded((value) => !value)}
        >
          {assetsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Assets
        </button>
        {assetsExpanded && (
          <div className="border-t border-border px-3 pb-3">
            <AssetPanel
              assetMap={data.assetMap}
              rows={data.rows}
              meta={data.meta}
              backgroundAsset={data.output.background ?? undefined}
              showAll={preferences.assetPanel.showAll}
              showHidden={preferences.assetPanel.showHidden}
              hidden={preferences.assetPanel.hidden}
              setPanelState={setAssetPanelState}
              onUploadFiles={uploadFiles}
              registry={data.registry.assets}
            />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card/80 p-3">
        <ClipPanel
          clip={selectedClip}
          track={selectedTrack}
          hasPredecessor={selectedClipHasPredecessor}
          onChange={handleSelectedClipChange}
          onResetPosition={handleResetClipPosition}
          onClose={() => setSelectedClipId(null)}
          onDelete={selectedClip ? () => handleDeleteClip(selectedClip.id) : undefined}
          onToggleMute={handleToggleMute}
          compositionWidth={compositionSize.width}
          compositionHeight={compositionSize.height}
          activeTab={preferences.activeClipTab}
          setActiveTab={setActiveClipTab}
        />
      </div>
    </div>
  );
}

export const PropertiesPanel = memo(PropertiesPanelComponent);
