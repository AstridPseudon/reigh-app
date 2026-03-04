import { useMemo } from 'react';
import { GRID_COLUMN_CLASSES, calculateGalleryLayout } from '../utils';

interface UseAspectRatioLayoutParams {
  projectAspectRatio?: string;
  isMobile: boolean;
  containerWidth: number;
  reducedSpacing: boolean;
  columnsPerRow: 'auto' | number;
  itemsPerPage?: number;
}

export function useAspectRatioLayout({
  projectAspectRatio,
  isMobile,
  containerWidth,
  reducedSpacing,
  columnsPerRow,
  itemsPerPage,
}: UseAspectRatioLayoutParams) {
  const aspectRatioLayout = useMemo(
    () => calculateGalleryLayout(projectAspectRatio, isMobile, containerWidth, undefined, reducedSpacing),
    [projectAspectRatio, isMobile, containerWidth, reducedSpacing],
  );

  const effectiveColumnsPerRow = columnsPerRow === 'auto' ? aspectRatioLayout.columns : columnsPerRow;
  const defaultItemsPerPage = aspectRatioLayout.itemsPerPage;

  const rawItemsPerPage = itemsPerPage ?? defaultItemsPerPage;
  const actualItemsPerPage =
    Math.floor(rawItemsPerPage / effectiveColumnsPerRow) * effectiveColumnsPerRow || effectiveColumnsPerRow;

  const gridColumnClasses = useMemo(
    () =>
      GRID_COLUMN_CLASSES[effectiveColumnsPerRow as keyof typeof GRID_COLUMN_CLASSES] ||
      aspectRatioLayout.gridColumnClasses,
    [effectiveColumnsPerRow, aspectRatioLayout.gridColumnClasses],
  );

  return {
    aspectRatioLayout,
    effectiveColumnsPerRow,
    actualItemsPerPage,
    gridColumnClasses,
  };
}
