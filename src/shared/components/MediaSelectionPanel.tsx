/**
 * MediaSelectionPanel
 *
 * Shared gallery panel for selecting an image or video from the project.
 * Used by EditVideoPage (video selection) and EditImagesPage (image selection).
 */

import React, { useState, useEffect } from 'react';
import { LayoutGrid } from 'lucide-react';
import { GenerationRow } from '@/types/shots';
import { ReighLoading } from '@/shared/components/ReighLoading';
import { useProject } from '@/shared/contexts/ProjectContext';
import { useProjectGenerations, type GenerationsPaginatedResponse } from '@/shared/hooks/useProjectGenerations';
import MediaGallery from '@/shared/components/MediaGallery';
import { useListShots } from '@/shared/hooks/useShots';

interface MediaSelectionPanelProps {
  /** Called when the user selects a media item */
  onSelect: (media: GenerationRow) => void;
  /** 'image' or 'video' */
  mediaType: 'image' | 'video';
  /** Header label, e.g. "Select a Video" */
  label?: string;
}

export function MediaSelectionPanel({ onSelect, mediaType, label }: MediaSelectionPanelProps) {
  const { selectedProjectId } = useProject();
  const [shotFilter, setShotFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: shots } = useListShots(selectedProjectId);
  const itemsPerPage = 15;

  const {
    data: generationsData,
    isLoading: isGalleryLoading,
  } = useProjectGenerations(
    selectedProjectId || null,
    currentPage,
    itemsPerPage,
    true,
    {
      shotId: shotFilter === 'all' ? undefined : shotFilter,
      mediaType,
      searchTerm: searchTerm.trim() || undefined
    }
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [shotFilter, searchTerm]);

  const headerText = label ?? (mediaType === 'video' ? 'Select a Video' : 'Select an Image');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 pt-4 pb-2 border-b">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <LayoutGrid className="w-4 h-4" />
          {headerText}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-0 m-0 relative pt-4 px-4 md:px-6">
         {isGalleryLoading && !generationsData ? (
            <ReighLoading />
         ) : (
            <MediaGallery
               images={(generationsData as GenerationsPaginatedResponse | undefined)?.items || []}
               onImageClick={(media) => onSelect(media as GenerationRow)}
               allShots={shots || []}
               showShotFilter={true}
               initialShotFilter={shotFilter}
               onShotFilterChange={setShotFilter}
               showSearch={true}
               initialSearchTerm={searchTerm}
               onSearchChange={setSearchTerm}
               initialMediaTypeFilter={mediaType}
               initialToolTypeFilter={mediaType === 'image' ? false : undefined}
               hideTopFilters={true}
               hideShotNotifier={true}
               initialExcludePositioned={false}
               itemsPerPage={itemsPerPage}
               offset={(currentPage - 1) * itemsPerPage}
               totalCount={(generationsData as GenerationsPaginatedResponse | undefined)?.total || 0}
               onServerPageChange={setCurrentPage}
               serverPage={currentPage}
               showDelete={false}
               showDownload={false}
               showShare={false}
               showEdit={false}
               showStar={false}
               showAddToShot={false}
               enableSingleClick={true}
               hideBottomPagination={true}
               videosAsThumbnails={mediaType === 'video'}
            />
         )}
      </div>
    </div>
  );
}
