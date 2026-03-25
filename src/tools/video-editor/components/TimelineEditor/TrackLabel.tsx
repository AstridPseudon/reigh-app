import { ArrowDown, ArrowUp, Trash2, Video, Volume2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/components/ui/contracts/cn';
import type { TrackDefinition } from '@/tools/video-editor/types';

interface TrackLabelProps {
  track: TrackDefinition;
  isSelected: boolean;
  trackCount: number;
  trackIndex: number;
  sameKindCount: number;
  onSelect: (trackId: string) => void;
  onChange: (trackId: string, patch: Partial<TrackDefinition>) => void;
  onReorder: (trackId: string, direction: -1 | 1) => void;
  onRemove: (trackId: string) => void;
}

export function TrackLabel({
  track,
  isSelected,
  trackCount,
  trackIndex,
  sameKindCount,
  onSelect,
  onChange,
  onReorder,
  onRemove,
}: TrackLabelProps) {
  return (
    <div
      className={cn(
        'group flex h-9 items-center gap-1 border-b border-border px-2 text-xs text-foreground',
        isSelected ? 'bg-accent/70' : 'bg-card/60 hover:bg-accent/50',
      )}
      onClick={() => onSelect(track.id)}
    >
      <span className="shrink-0 text-muted-foreground">
        {track.kind === 'visual' ? <Video className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent outline-none"
        value={track.label}
        onChange={(event) => onChange(track.id, { label: event.target.value })}
        onClick={(event) => event.stopPropagation()}
      />
      <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          disabled={trackIndex === 0 || sameKindCount <= 1}
          onClick={(event) => {
            event.stopPropagation();
            onReorder(track.id, -1);
          }}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          disabled={trackIndex >= trackCount - 1 || sameKindCount <= 1}
          onClick={(event) => {
            event.stopPropagation();
            onReorder(track.id, 1);
          }}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(track.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
