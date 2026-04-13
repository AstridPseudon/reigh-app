import { useCallback, useEffect, useRef } from 'react';
import type { GenerationRow } from '@/domains/generation/types';
import {
  type GallerySelectionItem,
  useGallerySelectionOptional,
} from '@/shared/contexts/GallerySelectionContext';

interface UseGallerySelectionBridgeArgs {
  selectedIds: string[];
  images: GenerationRow[];
  clearLocalSelection: () => void;
}

export function useGallerySelectionBridge({
  selectedIds,
  images,
  clearLocalSelection,
}: UseGallerySelectionBridgeArgs): void {
  const gallery = useGallerySelectionOptional();
  const isPeerClearingRef = useRef(false);
  const isSelfSelectingRef = useRef(false);
  const imagesRef = useRef(images);
  const selectedIdsRef = useRef(selectedIds);

  imagesRef.current = images;
  selectedIdsRef.current = selectedIds;

  // Called by GallerySelectionContext when ANOTHER surface selects.
  // Guard against self-originated calls: when this bridge calls
  // selectGalleryItems, the context fires peerClear — skip that.
  const peerClearCallback = useCallback(() => {
    if (isSelfSelectingRef.current) {
      return;
    }
    isPeerClearingRef.current = true;
    clearLocalSelection();
  }, [clearLocalSelection]);

  useEffect(() => {
    if (!gallery) {
      return;
    }

    gallery.registerPeerClear(peerClearCallback);
    return () => {
      gallery.registerPeerClear(null);
    };
  }, [gallery, peerClearCallback]);

  useEffect(() => {
    if (!gallery) {
      return;
    }

    if (isPeerClearingRef.current) {
      isPeerClearingRef.current = false;
      return;
    }

    if (selectedIds.length === 0) {
      gallery.clearGallerySelection();
      return;
    }

    const items: GallerySelectionItem[] = selectedIds.flatMap((id) => {
      const image = imagesRef.current.find((candidate) => candidate.id === id);
      if (!image) {
        return [];
      }

      return [{
        id: image.id,
        url: image.imageUrl ?? image.location ?? '',
        type: image.type ?? image.contentType ?? 'image/png',
        generationId: image.generation_id ?? image.id,
        variantId: image.primary_variant_id ?? undefined,
      }];
    });

    if (items.length > 0) {
      isSelfSelectingRef.current = true;
      gallery.selectGalleryItems(items);
      isSelfSelectingRef.current = false;
    }
  }, [gallery, selectedIds]);
}
