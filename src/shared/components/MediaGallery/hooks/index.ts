// Export hooks (now using the optimized implementations)
export { useMediaGalleryStateOptimized as useMediaGalleryState } from './useMediaGalleryStateOptimized';
export { useMediaGalleryFiltersOptimized as useMediaGalleryFilters } from './useMediaGalleryFiltersOptimized';
export { useMediaGalleryPagination } from './useMediaGalleryPagination';
export { useMediaGalleryActions } from './useMediaGalleryActions';
export { useMobileInteractions } from './useMobileInteractions';
export { useContainerWidth, useContainerDimensions } from './useContainerWidth';
export type { ContainerDimensions } from './useContainerWidth';

// Export types (using the optimized implementations)
export type { UseMediaGalleryStateOptimizedProps as UseMediaGalleryStateProps, UseMediaGalleryStateOptimizedReturn as UseMediaGalleryStateReturn } from './useMediaGalleryStateOptimized';
export type { UseMediaGalleryFiltersOptimizedProps as UseMediaGalleryFiltersProps, UseMediaGalleryFiltersOptimizedReturn as UseMediaGalleryFiltersReturn } from './useMediaGalleryFiltersOptimized';
export type { UseMediaGalleryPaginationProps, UseMediaGalleryPaginationReturn, NavigationState, NavigationStatus } from './useMediaGalleryPagination';
export type { UseMediaGalleryActionsProps, UseMediaGalleryActionsReturn } from './useMediaGalleryActions';
export type { UseMobileInteractionsProps, UseMobileInteractionsReturn } from './useMobileInteractions';
