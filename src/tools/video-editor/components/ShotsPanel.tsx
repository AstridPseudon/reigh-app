import { useMemo, useState } from 'react';
import type React from 'react';
import { GripVertical, ImageIcon, Search } from 'lucide-react';
import type { Shot } from '@/domains/generation/types';
import { useShots } from '@/shared/contexts/ShotsContext';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/components/ui/contracts/cn';
import { setShotDragData } from '@/shared/lib/dnd/dragDrop';
import { getGenerationId } from '@/shared/lib/media/mediaTypeHelpers';
import { isVideoGeneration } from '@/shared/lib/typeGuards';
import { useShotFinalVideos } from '@/tools/travel-between-images/hooks/video/useShotFinalVideos';

interface ShotsPanelProps {
  projectId: string;
  highlightedShotIds: ReadonlySet<string>;
}

function getShotThumbnail(shot: Shot, finalThumbnailUrl: string | null | undefined) {
  return finalThumbnailUrl
    ?? shot.images?.[0]?.imageUrl
    ?? shot.images?.[0]?.location
    ?? null;
}

function getShotImageGenerationIds(shot: Shot) {
  return (shot.images ?? [])
    .filter((image) => !isVideoGeneration(image))
    .map((image) => getGenerationId(image))
    .filter((generationId): generationId is string => typeof generationId === 'string' && generationId.length > 0);
}

function ShotsPanelCard({
  shot,
  thumbnailUrl,
  highlighted,
}: {
  shot: Shot;
  thumbnailUrl: string | null;
  highlighted: boolean;
}) {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    setShotDragData(event, {
      shotId: shot.id,
      shotName: shot.name,
      imageGenerationIds: getShotImageGenerationIds(shot),
    });
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'group flex w-44 cursor-grab select-none flex-col gap-2 rounded-lg border bg-background/70 p-2 transition-colors active:cursor-grabbing',
        highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:border-primary/50',
      )}
      title={shot.name}
    >
      <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={shot.name}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <div className="absolute right-1 top-1 rounded bg-background/85 p-1 text-muted-foreground shadow-sm">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="truncate text-xs font-medium text-foreground">
        {shot.name || 'Untitled shot'}
      </div>
    </div>
  );
}

function ShotsPanelLoading() {
  return (
    <div className="overflow-x-auto">
      <div className="grid auto-cols-[11rem] grid-flow-col grid-rows-2 gap-3 pb-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex w-44 flex-col gap-2 rounded-lg border bg-background/60 p-2">
            <Skeleton className="aspect-video w-full rounded-md" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShotsPanel({
  projectId,
  highlightedShotIds,
}: ShotsPanelProps) {
  const [query, setQuery] = useState('');
  const [showRelatedOnly, setShowRelatedOnly] = useState(false);
  const { shots, isLoading, error } = useShots();
  const { finalVideoMap } = useShotFinalVideos(projectId);

  const filteredShots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (shots ?? []).filter((shot) => {
      const matchesQuery = normalizedQuery.length === 0
        || shot.name.toLowerCase().includes(normalizedQuery);
      const matchesRelated = !showRelatedOnly || highlightedShotIds.has(shot.id);
      return matchesQuery && matchesRelated;
    });
  }, [highlightedShotIds, query, shots, showRelatedOnly]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 rounded-xl border bg-card/60 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Search shots"
            className="h-9 pl-9"
          />
        </div>
        <Button
          type="button"
          variant={showRelatedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowRelatedOnly((current) => !current)}
          className="h-9 shrink-0"
        >
          Related
        </Button>
      </div>

      {isLoading && shots === undefined ? (
        <ShotsPanelLoading />
      ) : error ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Failed to load shots
        </div>
      ) : filteredShots.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {(shots?.length ?? 0) === 0 ? 'No shots yet' : 'No matching shots'}
        </div>
      ) : (
        <div className="min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="grid auto-cols-[11rem] grid-flow-col grid-rows-2 gap-3 pb-2">
            {filteredShots.map((shot) => (
              <ShotsPanelCard
                key={shot.id}
                shot={shot}
                thumbnailUrl={getShotThumbnail(shot, finalVideoMap.get(shot.id)?.thumbnailUrl)}
                highlighted={highlightedShotIds.has(shot.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
