import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clapperboard, FolderPlus, ImageIcon, Layers, Music2, RefreshCw, Scissors, Trash2, Type, X } from 'lucide-react';
import { cn } from '@/shared/components/ui/contracts/cn';
import type { ClipMeta } from '@/tools/video-editor/lib/timeline-data';
import type { TimelineAction } from '@/tools/video-editor/types/timeline-canvas';

interface ContextMenuState {
  x: number;
  y: number;
  clientX: number;
}

interface ClipActionProps {
  action: TimelineAction;
  clipMeta: ClipMeta;
  isSelected: boolean;
  isPrimary?: boolean;
  selectedClipIds?: string[];
  thumbnailSrc?: string;
  onSelect: (clipId: string, trackId: string) => void;
  onDoubleClickAsset?: (assetKey: string) => void;
  onSplitHere?: (clipId: string, clientX: number) => void;
  onSplitClipsAtPlayhead?: (clipIds: string[]) => void;
  onDeleteClip?: (clipId: string) => void;
  onDeleteClips?: (clipIds: string[]) => void;
  onToggleMuteClips?: (clipIds: string[]) => void;
  /** True when the clip's file no longer matches the generation's current primary variant */
  isVariantStale?: boolean;
  /** True when the clip is linked to a generation (enables "Update to current variant" in menu) */
  isGenerationAsset?: boolean;
  onUpdateVariant?: () => void;
  onDismissStale?: () => void;
  canCreateShotFromSelection?: boolean;
  onCreateShotFromSelection?: () => void | Promise<void>;
  onGenerateVideoFromSelection?: () => void | Promise<void>;
  isCreatingShot?: boolean;
}

const menuItemClassName = 'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground';
const destructiveMenuItemClassName = `${menuItemClassName} hover:bg-destructive hover:text-destructive-foreground`;
const disabledMenuItemClassName = 'disabled:cursor-wait disabled:opacity-60';

type ClipContextMenuProps = Pick<ClipActionProps, 'isGenerationAsset' | 'onUpdateVariant' | 'isVariantStale' | 'onDismissStale' | 'onSplitHere' | 'onToggleMuteClips' | 'onSplitClipsAtPlayhead' | 'onCreateShotFromSelection' | 'onGenerateVideoFromSelection' | 'isCreatingShot' | 'onDeleteClip' | 'onDeleteClips'> & { actionId: string; contextMenu: ContextMenuState; menuRef: React.RefObject<HTMLDivElement | null>; closeMenu: () => void; hasBatchSelection: boolean; selectedClipIds: string[]; showShotActions: boolean; hasActionsBeforeShotSection: boolean; };
type ClipContextMenuItemProps = { icon: React.ComponentType<{ className?: string }>; onClick: () => void; children: React.ReactNode; disabled?: boolean; destructive?: boolean; suffix?: React.ReactNode; };

function ClipContextMenuItem({ icon: Icon, onClick, children, disabled = false, destructive = false, suffix }: ClipContextMenuItemProps) {
  return (
    <button
      type="button"
      className={cn(destructive ? destructiveMenuItemClassName : menuItemClassName, disabled && disabledMenuItemClassName)}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4" />
      {children}
      {suffix}
    </button>
  );
}

function ClipContextMenu(props: ClipContextMenuProps) {
  return createPortal(
    <div
      ref={props.menuRef}
      className="fixed z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: props.contextMenu.x, top: props.contextMenu.y }}
    >
      {!props.hasBatchSelection && props.isGenerationAsset && props.onUpdateVariant && (
        <ClipContextMenuItem icon={RefreshCw} onClick={() => { props.onUpdateVariant?.(); props.closeMenu(); }}>
          Update to current variant
        </ClipContextMenuItem>
      )}
      {!props.hasBatchSelection && props.isVariantStale && props.onDismissStale && (
        <ClipContextMenuItem icon={X} onClick={() => { props.onDismissStale?.(); props.closeMenu(); }}>
          Dismiss reminder
        </ClipContextMenuItem>
      )}
      {((props.isGenerationAsset && props.onUpdateVariant) || (props.isVariantStale && props.onDismissStale)) && !props.hasBatchSelection && (
        <div className="my-1 h-px bg-border" />
      )}
      {!props.hasBatchSelection && props.onSplitHere && (
        <ClipContextMenuItem icon={Scissors} onClick={() => { props.onSplitHere?.(props.actionId, props.contextMenu.clientX); props.closeMenu(); }}>
          Split Here
        </ClipContextMenuItem>
      )}
      {props.hasBatchSelection && props.onToggleMuteClips && (
        <ClipContextMenuItem icon={Music2} onClick={() => { props.onToggleMuteClips?.(props.selectedClipIds); props.closeMenu(); }}>
          Mute/Unmute {props.selectedClipIds.length} clips
        </ClipContextMenuItem>
      )}
      {props.hasBatchSelection && props.onSplitClipsAtPlayhead && (
        <ClipContextMenuItem icon={Scissors} onClick={() => { props.onSplitClipsAtPlayhead?.(props.selectedClipIds); props.closeMenu(); }}>
          Split {props.selectedClipIds.length} clips at playhead
        </ClipContextMenuItem>
      )}
      {props.showShotActions && props.hasActionsBeforeShotSection && <div className="my-1 h-px bg-border" />}
      {props.showShotActions && props.onCreateShotFromSelection && (
        <ClipContextMenuItem icon={FolderPlus} onClick={() => { props.closeMenu(); void props.onCreateShotFromSelection?.(); }} disabled={props.isCreatingShot}>
          Create Shot
        </ClipContextMenuItem>
      )}
      {props.showShotActions && props.onGenerateVideoFromSelection && (
        <ClipContextMenuItem icon={Clapperboard} onClick={() => { props.closeMenu(); void props.onGenerateVideoFromSelection?.(); }} disabled={props.isCreatingShot}>
          Generate Video
        </ClipContextMenuItem>
      )}
      {props.hasBatchSelection && props.onDeleteClips ? (
        <ClipContextMenuItem
          icon={Trash2}
          onClick={() => { props.onDeleteClips?.(props.selectedClipIds); props.closeMenu(); }}
          destructive
          suffix={<span className="ml-auto text-xs tracking-widest opacity-60">Del</span>}
        >
          Delete {props.selectedClipIds.length} clips
        </ClipContextMenuItem>
      ) : props.onDeleteClip && (
        <ClipContextMenuItem
          icon={Trash2}
          onClick={() => { props.onDeleteClip?.(props.actionId); props.closeMenu(); }}
          destructive
          suffix={<span className="ml-auto text-xs tracking-widest opacity-60">Del</span>}
        >
          Delete Clip
        </ClipContextMenuItem>
      )}
    </div>,
    document.body,
  );
}

export function ClipAction({
  action,
  clipMeta,
  isSelected,
  isPrimary = false,
  selectedClipIds = [],
  thumbnailSrc,
  onSelect,
  onDoubleClickAsset,
  onSplitHere,
  onSplitClipsAtPlayhead,
  onDeleteClip,
  onDeleteClips,
  onToggleMuteClips,
  isVariantStale,
  isGenerationAsset,
  onUpdateVariant,
  onDismissStale,
  canCreateShotFromSelection = false,
  onCreateShotFromSelection,
  onGenerateVideoFromSelection,
  isCreatingShot = false,
}: ClipActionProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setContextMenu(null), []);
  const openMenuAt = useCallback((x: number, y: number) => { setContextMenu({ x, y, clientX: x }); }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu, closeMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { clientX, clientY } = e;
    if (!isSelected) {
      onSelect(action.id, clipMeta.track);
      requestAnimationFrame(() => openMenuAt(clientX, clientY));
      return;
    }
    openMenuAt(clientX, clientY);
  }, [action.id, clipMeta.track, isSelected, onSelect, openMenuAt]);
  const isEffectLayer = clipMeta.clipType === 'effect-layer';
  const icon = isEffectLayer
    ? <Layers className="h-3 w-3" />
    : clipMeta.clipType === 'text'
    ? <Type className="h-3 w-3" />
    : clipMeta.track.startsWith('A')
      ? <Music2 className="h-3 w-3" />
      : <ImageIcon className="h-3 w-3" />;
  const hasBatchSelection = isSelected && selectedClipIds.length > 1;
  const showShotActions = canCreateShotFromSelection && (
    typeof onCreateShotFromSelection === 'function' || typeof onGenerateVideoFromSelection === 'function'
  );
  const hasActionsBeforeShotSection = (
    (!hasBatchSelection && isGenerationAsset && onUpdateVariant)
    || (!hasBatchSelection && isVariantStale && onDismissStale)
    || (!hasBatchSelection && onSplitHere)
    || (hasBatchSelection && onToggleMuteClips)
    || (hasBatchSelection && onSplitClipsAtPlayhead)
  );
  const effectBadges = [clipMeta.entrance?.type ? `In:${clipMeta.entrance.type}` : null, clipMeta.continuous?.type ? `Loop:${clipMeta.continuous.type}` : null, clipMeta.exit?.type ? `Out:${clipMeta.exit.type}` : null].filter(Boolean);

  return (
    <>
      <button
        type="button"
        className={cn(
          'clip-action group relative flex h-full w-full overflow-hidden rounded-md border text-left',
          isEffectLayer && isSelected
            ? 'border-violet-400 bg-violet-500/20 text-violet-50'
            : isEffectLayer
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:border-violet-400/60'
            : isSelected
            ? 'border-sky-400 bg-sky-500/20 text-sky-50'
            : 'border-border bg-card/90 text-foreground hover:border-accent',
        )}
        data-clip-id={action.id}
        data-row-id={clipMeta.track}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (!isEffectLayer && clipMeta.clipType !== 'text' && clipMeta.asset) {
            onDoubleClickAsset?.(clipMeta.asset);
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {thumbnailSrc ? (
          <img src={thumbnailSrc} alt="" className="h-full w-10 shrink-0 object-cover opacity-80" draggable={false} />
        ) : (
          <div className="flex h-full w-8 shrink-0 items-center justify-center bg-background/60 text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1 px-2 py-1">
          <div className="truncate text-[11px] font-medium">
            {isEffectLayer
              ? (clipMeta.continuous?.type || 'Effect Layer')
              : (clipMeta.text?.content || clipMeta.asset || action.id)}
          </div>
          {effectBadges.length > 0 && (
            <div className="mt-1 flex gap-1 overflow-hidden">
              {effectBadges.slice(0, 2).map((badge) => (
                <span key={badge} className="truncate rounded bg-background/60 px-1 py-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
        {isVariantStale && (
          <div
            className="absolute right-1 top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-400"
            title="Variant outdated"
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              const { clientX, clientY } = e;
              if (!isSelected) {
                onSelect(action.id, clipMeta.track);
                requestAnimationFrame(() => openMenuAt(clientX, clientY));
                return;
              }
              openMenuAt(clientX, clientY);
            }}
          >
            <RefreshCw className="h-2.5 w-2.5" />
          </div>
        )}
      </button>

      {contextMenu && (
        <ClipContextMenu
          actionId={action.id}
          contextMenu={contextMenu}
          menuRef={menuRef}
          closeMenu={closeMenu}
          hasBatchSelection={hasBatchSelection}
          selectedClipIds={selectedClipIds}
          isGenerationAsset={isGenerationAsset}
          onUpdateVariant={onUpdateVariant}
          isVariantStale={isVariantStale}
          onDismissStale={onDismissStale}
          onSplitHere={onSplitHere}
          onToggleMuteClips={onToggleMuteClips}
          onSplitClipsAtPlayhead={onSplitClipsAtPlayhead}
          showShotActions={showShotActions}
          hasActionsBeforeShotSection={hasActionsBeforeShotSection}
          onCreateShotFromSelection={onCreateShotFromSelection}
          onGenerateVideoFromSelection={onGenerateVideoFromSelection}
          isCreatingShot={isCreatingShot}
          onDeleteClip={onDeleteClip}
          onDeleteClips={onDeleteClips}
        />
      )}
    </>
  );
}
