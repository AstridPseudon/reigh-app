import React from 'react';
import { Film, Loader2, Trash2 } from 'lucide-react';
import type { GenerationRow } from '@/domains/generation/types';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { VideoItem } from './VideoGallery/components/VideoItem';

const noop = () => {};

interface FinalVideoSectionDisplayProps {
  projectAspectRatio?: string;
  shouldShowSkeleton: boolean;
  hasFinalOutput: boolean;
  parentVideoRow: GenerationRow | null;
  isMobile: boolean;
  projectId: string;
  onLightboxOpen: () => void;
  onMobileTap: () => void;
  onApplySettingsFromTask?: (taskId: string, replaceImages: boolean, inputImages: string[]) => void;
  readOnly: boolean;
  onDelete?: (generationId: string) => void;
  onDeleteSelected: () => void;
  isDeleting: boolean;
  isCurrentlyLoading: boolean;
  hasActiveJoinTask: boolean;
}

function getFinalVideoWidthStyle(projectAspectRatio?: string): React.CSSProperties {
  if (!projectAspectRatio) {
    return { width: '50%' };
  }

  const [width, height] = projectAspectRatio.split(':').map(Number);
  if (!width || !height) {
    return { width: '50%' };
  }

  const ratio = width / height;
  if (height > width) {
    return { width: `min(100%, calc(60vh * ${ratio}))` };
  }

  return { width: '50%' };
}

export const FinalVideoSectionDisplay: React.FC<FinalVideoSectionDisplayProps> = ({
  projectAspectRatio,
  shouldShowSkeleton,
  hasFinalOutput,
  parentVideoRow,
  isMobile,
  projectId,
  onLightboxOpen,
  onMobileTap,
  onApplySettingsFromTask,
  readOnly,
  onDelete,
  onDeleteSelected,
  isDeleting,
  isCurrentlyLoading,
  hasActiveJoinTask,
}) => {
  if (shouldShowSkeleton) {
    return (
      <div className="flex justify-center mt-4">
        <div style={getFinalVideoWidthStyle(projectAspectRatio)}>
          <Skeleton
            className="w-full rounded-lg"
            style={{
              aspectRatio: projectAspectRatio ? projectAspectRatio.replace(':', '/') : '16/9',
            }}
          />
        </div>
      </div>
    );
  }

  if (hasFinalOutput && parentVideoRow) {
    return (
      <div className="flex justify-center mt-4">
        <div className="relative group" style={getFinalVideoWidthStyle(projectAspectRatio)}>
          <VideoItem
            video={parentVideoRow}
            index={0}
            originalIndex={0}
            shouldPreload="metadata"
            isMobile={isMobile}
            projectAspectRatio={projectAspectRatio}
            projectId={projectId}
            onLightboxOpen={() => onLightboxOpen()}
            onMobileTap={() => onMobileTap()}
            onDelete={noop}
            deletingVideoId={null}
            onHoverStart={noop}
            onHoverEnd={noop}
            onMobileModalOpen={noop}
            selectedVideoForDetails={null}
            showTaskDetailsModal={false}
            onApplySettingsFromTask={onApplySettingsFromTask || noop}
            hideActions
          />

          {!readOnly && onDelete && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 bg-red-600/80 hover:bg-red-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteSelected();
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete final video</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center pt-4 pb-1 text-muted-foreground">
      {isCurrentlyLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : hasActiveJoinTask ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Generating joined clip...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 opacity-40" />
          <span className="text-sm">No final video yet</span>
        </div>
      )}
    </div>
  );
};
