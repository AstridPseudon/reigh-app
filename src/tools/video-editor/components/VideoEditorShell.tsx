import { memo, useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Download, GripHorizontal, Maximize2, Minimize2, Type, Video, Volume2, ZoomIn, ZoomOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { CompactPreview } from '@/tools/video-editor/components/CompactPreview';
import { PreviewPanel } from '@/tools/video-editor/components/PreviewPanel/PreviewPanel';
import { PropertiesPanel } from '@/tools/video-editor/components/PropertiesPanel/PropertiesPanel';
import { TimelineEditor } from '@/tools/video-editor/components/TimelineEditor/TimelineEditor';
import { useTimelineChromeContext } from '@/tools/video-editor/contexts/TimelineChromeContext';
import { useTimelineEditorContext } from '@/tools/video-editor/contexts/TimelineEditorContext';
import { useTimelinePlaybackContext } from '@/tools/video-editor/contexts/TimelinePlaybackContext';
import { useKeyboardShortcuts } from '@/tools/video-editor/hooks/useKeyboardShortcuts';
import { useTimelineRealtime } from '@/tools/video-editor/hooks/useTimelineRealtime';

const MIN_TIMELINE_HEIGHT = 140;
const MIN_PREVIEW_HEIGHT = 180;
const STATUS_VARIANT = {
  saved: 'default',
  saving: 'secondary',
  dirty: 'outline',
  error: 'destructive',
} as const;

interface VideoEditorShellProps {
  mode: 'full' | 'compact';
  timelineId?: string | null;
  onCreateTimeline?: () => void;
}

function FullEditorLayout({ timelineId }: { timelineId: string }) {
  const editor = useTimelineEditorContext();
  const chrome = useTimelineChromeContext();
  const playback = useTimelinePlaybackContext();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [timelineHeight, setTimelineHeight] = useState<number | null>(null);
  const [isTimelineMaximized, setIsTimelineMaximized] = useState(false);
  const conflict = useTimelineRealtime({
    timelineId,
    saveStatus: chrome.saveStatus,
    onDiscardRemoteChanges: chrome.reloadFromServer,
  });

  useKeyboardShortcuts({
    hasSelectedClip: Boolean(editor.selectedClipId),
    moveSelectedClipToTrack: editor.moveSelectedClipToTrack,
    togglePlayPause: () => playback.previewRef.current?.togglePlayPause(),
    seekRelative: (deltaSeconds) => playback.previewRef.current?.seek(Math.max(0, playback.currentTime + deltaSeconds)),
    toggleMute: editor.handleToggleMute,
    splitSelectedClip: editor.handleSplitSelectedClip,
    deleteSelectedClip: () => {
      if (editor.selectedClipId) {
        editor.handleDeleteClip(editor.selectedClipId);
      }
    },
    clearSelection: () => editor.setSelectedClipId(null),
  });

  const onDividerMouseDown = useCallback((event: ReactMouseEvent) => {
    event.preventDefault();
    setIsTimelineMaximized(false);
    const container = containerRef.current;
    const divider = dividerRef.current;
    if (!container || !divider) {
      return;
    }

    divider.classList.add('is-dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nextHeight = Math.max(MIN_TIMELINE_HEIGHT, rect.bottom - moveEvent.clientY);
      if (rect.height - nextHeight < MIN_PREVIEW_HEIGHT) {
        return;
      }
      container.style.gridTemplateRows = `minmax(0,1fr) auto ${nextHeight}px`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      divider.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const match = container.style.gridTemplateRows.match(/(\d+)px$/);
      container.style.gridTemplateRows = '';
      if (match) {
        setTimelineHeight(Number.parseInt(match[1], 10));
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const gridTemplateRows = isTimelineMaximized
    ? `${MIN_PREVIEW_HEIGHT}px auto 1fr`
    : (timelineHeight ? `minmax(0,1fr) auto ${timelineHeight}px` : 'minmax(0,1fr) auto minmax(200px,36%)');

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
        <div className="flex h-10 items-center gap-3 border-b border-border bg-background px-3 text-sm text-muted-foreground">
          <button
            type="button"
            className="shrink-0 transition-colors hover:text-foreground"
            onClick={() => navigate('/')}
          >
            ← Back
          </button>
          <div className="truncate text-foreground">{chrome.timelineName ?? 'Untitled timeline'}</div>
        </div>
        <main
          ref={containerRef}
          className="grid h-full min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-3 p-3"
          style={{ gridTemplateRows }}
        >
          <div className="relative min-h-0">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 py-3">
              <div className="pointer-events-auto flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[chrome.saveStatus]} className="h-5 px-1.5 text-[10px] capitalize">
                  {chrome.saveStatus}
                </Badge>
                <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">{playback.formatTime(playback.currentTime)}</span>
              </div>
              <div className="pointer-events-auto flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={chrome.handleAddText}>
                  <Type className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1.5 px-3 text-[11px]"
                  onClick={() => void chrome.startRender()}
                  disabled={chrome.renderStatus === 'rendering'}
                >
                  <Download className="h-3.5 w-3.5" />
                  {chrome.renderStatus === 'rendering' && chrome.renderProgress
                    ? `Render ${chrome.renderProgress.percent}%`
                    : 'Render'}
                </Button>
                {chrome.renderResultUrl && chrome.renderStatus === 'done' && !chrome.renderDirty && (
                  <a
                    href={chrome.renderResultUrl}
                    download={chrome.renderResultFilename ?? undefined}
                    className="rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Download
                  </a>
                )}
              </div>
            </div>
            <PreviewPanel />
          </div>

          <div className="row-span-3 min-h-0 overflow-hidden">
            <PropertiesPanel />
          </div>

          <div
            ref={dividerRef}
            className="col-span-1 flex h-7 items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/80 px-2 text-muted-foreground"
          >
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => chrome.handleAddTrack('visual')}>
                <Video className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => chrome.handleAddTrack('audio')}>
                <Volume2 className="h-3.5 w-3.5" />
              </Button>
              {chrome.unusedTrackCount > 0 && (
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={chrome.handleClearUnusedTracks}>
                  Clear {chrome.unusedTrackCount} unused
                </Button>
              )}
            </div>
            <div
              className="flex h-full flex-1 cursor-row-resize items-center justify-center"
              onMouseDown={onDividerMouseDown}
            >
              <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <GripHorizontal className="h-3 w-3" />
                Resize
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsTimelineMaximized((value) => !value)}
                title={isTimelineMaximized ? 'Restore preview and timeline split' : 'Maximize timeline'}
              >
                {isTimelineMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => chrome.setScaleWidth((value) => Math.max(value / 1.4, 40))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => chrome.setScaleWidth((value) => Math.min(value * 1.4, 500))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 overflow-hidden">
            <TimelineEditor />
          </div>
        </main>
      </div>

      <AlertDialog open={conflict.isOpen} onOpenChange={conflict.setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remote timeline changes detected</AlertDialogTitle>
            <AlertDialogDescription>
              Another tab updated this timeline while you still have unsaved local edits. Keep your local draft or discard it and reload the latest server version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={conflict.keepLocalChanges}>Keep local draft</AlertDialogCancel>
            <AlertDialogAction onClick={() => void conflict.discardAndReload()}>Discard and reload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function VideoEditorShellComponent({ mode, timelineId, onCreateTimeline }: VideoEditorShellProps) {
  if (mode === 'compact') {
    return <CompactPreview timelineId={timelineId} onCreateTimeline={onCreateTimeline} />;
  }

  if (!timelineId) {
    return null;
  }

  return <FullEditorLayout timelineId={timelineId} />;
}

export const VideoEditorShell = memo(VideoEditorShellComponent);
