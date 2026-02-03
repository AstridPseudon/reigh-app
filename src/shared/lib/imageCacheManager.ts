/**
 * Centralized Image Cache Manager
 *
 * Single source of truth for all image caching operations.
 * Replaces the scattered cache management across multiple files.
 */

// Global cache map to store cache status by image ID
const globalImageCache = new Map<string, boolean>();

// URL-based cache for progressive loading (stores by actual image URL)
const urlCache = new Map<string, { loadedAt: number; width?: number; height?: number }>();

// Debug logging configuration
const CACHE_DEBUG_LOG_RATE = 0.05; // 5% of cache checks will be logged

/** Image with an id property for caching */
interface CacheableImage {
  id: string;
  __memoryCached?: boolean;
}

/**
 * Mark an image as cached or uncached
 */
export const setImageCacheStatus = (image: CacheableImage, isCached: boolean = true): void => {
  const imageId = image.id;
  if (!imageId) {
    console.warn('[ImageCacheManager] Cannot cache image without ID:', image);
    return;
  }

  const prevState = globalImageCache.get(imageId);

  // Update global cache (primary storage)
  globalImageCache.set(imageId, isCached);

  // Update object cache for backwards compatibility (will be phased out)
  image.__memoryCached = isCached;

  // Only log when state changes to reduce noise
  if (prevState !== isCached) {
    console.log(`[ImageCacheManager] Cache status changed:`, {
      imageId,
      from: prevState ?? 'unknown',
      to: isCached,
      cacheSize: globalImageCache.size,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Remove images from cache (for cleanup) - internal function
 */
const removeCachedImages = (imageIds: string[]): number => {
  let removedCount = 0;

  imageIds.forEach(imageId => {
    if (globalImageCache.has(imageId)) {
      globalImageCache.delete(imageId);
      removedCount++;
    }
  });

  if (removedCount > 0) {
    console.log(`[ImageCacheManager] Removed ${removedCount} images from cache, new size: ${globalImageCache.size}`);
  }

  return removedCount;
};

/**
 * Clear images from cache by page/query data
 */
export const clearCacheForImages = (images: Array<{ id: string }>): number => {
  const imageIds = images
    .map(img => img.id)
    .filter(id => id); // Only valid IDs

  return removeCachedImages(imageIds);
};

/**
 * Clear cache for project switch - removes all cached images to ensure fresh content
 */
export const clearCacheForProjectSwitch = (reason: string = 'project switch'): number => {
  const prevSize = globalImageCache.size;
  globalImageCache.clear();

  console.log(`[ImageCacheManager] Cleared cache for ${reason}, removed ${prevSize} entries`);
  return prevSize;
};

/**
 * Check if a URL is cached
 */
export const isImageCached = (urlOrImage: string | CacheableImage): boolean => {
  // Handle both URL strings and image objects
  if (typeof urlOrImage === 'string') {
    return urlCache.has(urlOrImage);
  }

  // Legacy image object handling
  const imageId = urlOrImage?.id;
  if (!imageId) {
    return false;
  }

  // Primary source: global cache
  const isCached = globalImageCache.get(imageId) === true;

  // Sync object cache if needed (backwards compatibility)
  if (isCached && urlOrImage.__memoryCached !== true) {
    urlOrImage.__memoryCached = true;
  }

  // Occasional debug logging (reduced noise)
  if (Math.random() < CACHE_DEBUG_LOG_RATE) {
    console.log(`[ImageCacheManager] Cache check:`, {
      imageId,
      isCached,
      cacheSize: globalImageCache.size
    });
  }

  return isCached;
};

/**
 * Mark a URL as cached
 */
export const markImageAsCached = (urlOrImage: string | CacheableImage, metadata?: { width?: number; height?: number }): void => {
  // Handle both URL strings and image objects
  if (typeof urlOrImage === 'string') {
    urlCache.set(urlOrImage, {
      loadedAt: Date.now(),
      ...metadata
    });
    return;
  }

  // Legacy image object handling
  setImageCacheStatus(urlOrImage, true);
};
