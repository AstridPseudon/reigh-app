# Handler Types Consolidation Plan

## Status: ✅ COMPLETED (2026-02-02)

All phases implemented successfully. `strictFunctionTypes: true` enabled with zero errors.

---

## Problem Statement

Handler type definitions are duplicated across 8+ files with inconsistent signatures. This caused runtime errors during refactoring because `strict: false` allowed mismatches to go undetected.

---

## Domain Analysis

There are **two distinct domains** (not three):

### Domain 1: MediaGallery (Project-level operations)

**Purpose:** Operations on generations at the project level
**Components:** `MediaGallery`, `GenerationsPane`, tool page galleries

```typescript
// MediaGallery/types.ts - already clean
onDelete?: (id: string) => void;  // Deletes GENERATION from project
onAddToLastShot?: (generationId: string, imageUrl?: string, thumbUrl?: string) => Promise<boolean>;
```

**Status:** ✅ Clean, single source of truth. No changes needed.

---

### Domain 2: Shot Image Manipulation (Timeline + ShotImageManager unified)

**Purpose:** Manipulate images within a shot
**Components:** `Timeline`, `TimelineContainer`, `ShotImageManager`, `BatchDropZone`

Both components:
- Operate on `shot_generations` table
- Store `timeline_frame` (not position)
- Have identical operations: delete, duplicate, reorder, drop

**Key insight:** `targetPosition` is never stored. The handler just needs the calculated frame:

```typescript
// Current (leaky abstraction)
onFileDrop?: (files: File[], targetPosition?: number, framePosition?: number) => Promise<void>

// What the handler actually does:
const timelineFrame = framePosition ?? targetPosition;  // Just wants a frame number
```

**Unified signature:**
```typescript
onFileDrop?: (files: File[], targetFrame?: number) => Promise<void>
```

Component calculates frame from its UI model (grid index × spacing, or pixel position), then passes the frame.

---

## Unified Handler Types

Create `/src/shared/types/imageHandlers.ts`:

```typescript
/**
 * Shared handler types for shot image manipulation.
 * Used by both Timeline and ShotImageManager.
 */

/** Remove image from shot (by shot_generations.id) */
export type ImageDeleteHandler = (id: string) => void;

/** Remove multiple images from shot */
export type BatchImageDeleteHandler = (ids: string[]) => void;

/** Duplicate image at specified frame */
export type ImageDuplicateHandler = (id: string, atFrame: number) => void;

/** Reorder images (IDs in new order) */
export type ImageReorderHandler = (
  orderedIds: string[],
  draggedItemId?: string
) => void;

/** Drop files onto shot at specified frame */
export type FileDropHandler = (
  files: File[],
  targetFrame?: number
) => Promise<void>;

/** Drop generation onto shot at specified frame */
export type GenerationDropHandler = (
  generationId: string,
  imageUrl: string,
  thumbUrl: string | undefined,
  targetFrame?: number
) => Promise<void>;

/** Upload files via input element */
export type ImageUploadHandler = (
  event: React.ChangeEvent<HTMLInputElement>
) => Promise<void>;

/** Complete set of shot image handlers */
export interface ShotImageHandlers {
  onDelete: ImageDeleteHandler;
  onBatchDelete?: BatchImageDeleteHandler;
  onDuplicate?: ImageDuplicateHandler;
  onReorder: ImageReorderHandler;
  onFileDrop?: FileDropHandler;
  onGenerationDrop?: GenerationDropHandler;
  onUpload?: ImageUploadHandler;
}
```

---

## Implementation Plan

### Phase 1: Create shared types (30 min) ✅ COMPLETED

- [x] Create `/src/shared/types/imageHandlers.ts` with types above
- [x] ~~Export from `/src/shared/types/index.ts`~~ (not needed - direct imports work)

---

### Phase 2: Update ShotImageManager (1 hour) ✅ COMPLETED

Update `/src/shared/components/ShotImageManager/types.ts`:

```typescript
import type {
  ImageDeleteHandler,
  ImageDuplicateHandler,
  ImageReorderHandler,
  FileDropHandler,
  GenerationDropHandler,
} from '@/shared/types/imageHandlers';

export interface ShotImageManagerProps {
  onImageDelete?: ImageDeleteHandler;
  onImageDuplicate?: ImageDuplicateHandler;
  onImageReorder?: ImageReorderHandler;
  onFileDrop?: FileDropHandler;           // Was: (files, targetPosition?, framePosition?)
  onGenerationDrop?: GenerationDropHandler; // Was: (id, url, thumb, targetPosition?, framePosition?)
  // ...
}
```

Update `BatchDropZone` to calculate frame before calling handler:
```typescript
// Before
await onFileDrop(files, targetPosition, framePosition);

// After
await onFileDrop(files, framePosition);  // Component calculates frame, passes it
```

---

### Phase 3: Update Timeline types (30 min) ✅ COMPLETED

Update `/src/tools/travel-between-images/components/Timeline/TimelineContainer/types.ts`:

```typescript
import type {
  ImageDeleteHandler,
  ImageDuplicateHandler,
  ImageReorderHandler,
  FileDropHandler,
  GenerationDropHandler,
} from '@/shared/types/imageHandlers';

export interface TimelineContainerProps {
  onImageDelete?: ImageDeleteHandler;
  onImageDuplicate?: ImageDuplicateHandler;
  onImageReorder?: ImageReorderHandler;
  onImageDrop?: FileDropHandler;          // Same type, different prop name is OK
  onGenerationDrop?: GenerationDropHandler;
  // ...
}
```

---

### Phase 4: Update ShotSettingsContext (1 hour) ✅ COMPLETED

Update `/src/tools/travel-between-images/components/ShotEditor/ShotSettingsContext.tsx`:

```typescript
import type { ShotImageHandlers } from '@/shared/types/imageHandlers';

// Use the shared interface directly
export interface ShotImageHandlers extends ShotImageHandlers {
  // Can add context-specific handlers here if needed
}
```

Update `useShotSettingsValue.ts`:
- Remove `targetPosition` parameter from handler implementations
- Just pass `targetFrame` through

---

### Phase 5: Update intermediate components (1 hour) ✅ COMPLETED

Files to update:
- `/src/tools/travel-between-images/components/ShotImagesEditor/types.ts`
- `/src/tools/travel-between-images/components/ShotImagesEditor/components/BatchModeContent.tsx`
- `/src/tools/travel-between-images/components/ShotImagesEditor/components/TimelineModeContent.tsx`

Pattern: Import shared types, remove duplicate definitions.

---

### Phase 6: Enable strictFunctionTypes (2-4 hours) ✅ COMPLETED

Update `/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "strictFunctionTypes": true
  }
}
```

**Result:** No errors! All handler types aligned correctly.

---

## Files Summary

| Phase | File | Action |
|-------|------|--------|
| 1 | `/src/shared/types/imageHandlers.ts` | CREATE |
| 2 | `/src/shared/components/ShotImageManager/types.ts` | UPDATE |
| 2 | `/src/shared/components/BatchDropZone.tsx` | UPDATE - remove targetPosition |
| 3 | `/src/tools/.../Timeline/TimelineContainer/types.ts` | UPDATE |
| 4 | `/src/tools/.../ShotEditor/ShotSettingsContext.tsx` | UPDATE |
| 4 | `/src/tools/.../ShotEditor/hooks/useShotSettingsValue.ts` | UPDATE |
| 5 | `/src/tools/.../ShotImagesEditor/types.ts` | UPDATE |
| 5 | `/src/tools/.../ShotImagesEditor/components/*.tsx` | UPDATE |
| 6 | `/tsconfig.app.json` | ADD strictFunctionTypes |

---

## What We're NOT Doing

1. **NOT touching MediaGallery** - Different domain (project-level), already clean
2. **NOT keeping position/frame split** - Handler just needs frame, component calculates it
3. **NOT enabling full strict mode** - Just `strictFunctionTypes` for now (532 vs 829 errors)

---

## Migration Notes

**For BatchDropZone / ShotImageManager:**
```typescript
// Before: pass both position and frame
const framePosition = targetPosition * frameSpacing;
await onFileDrop(files, targetPosition, framePosition);

// After: just pass the frame
const targetFrame = targetPosition * frameSpacing;
await onFileDrop(files, targetFrame);
```

**For Timeline:**
```typescript
// Already uses frame - no change needed
const targetFrame = pixelToFrame(dropX);
await onImageDrop(files, targetFrame);
```

---

## Success Criteria ✅ ALL MET

1. ✅ **One source of truth** for handler types (`/src/shared/types/imageHandlers.ts`)
2. ✅ **Unified signature** using `targetFrame` (not position + frame)
3. ✅ **Both Timeline and ShotImageManager** import from shared types
4. ✅ **`strictFunctionTypes: true`** enabled and passing
5. ✅ **No runtime signature mismatches** possible

---

## Estimated Effort

| Phase | Time |
|-------|------|
| 1. Create shared types | 30 min |
| 2. Update ShotImageManager | 1 hour |
| 3. Update Timeline | 30 min |
| 4. Update ShotSettingsContext | 1 hour |
| 5. Update intermediate components | 1 hour |
| 6. Enable strictFunctionTypes | 2-4 hours |

**Total: 1-1.5 days**
