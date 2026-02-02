# Code Quality Audit

Present state of the codebase. Last updated: 2026-02-02.

---

## Summary

| Category | Status | Details |
|----------|--------|---------|
| Giant components (>2000 LOC) | ✅ None | All critical components refactored |
| Components 1000-2000 LOC | ⚠️ 4 remain | Gallery/item components |
| Double-casts (`as unknown as`) | ✅ None | All 8 fixed with proper types |
| Type safety (`any` usage) | ⚠️ ~1,980 instances | Across ~411 files |
| Cache invalidation | ✅ Centralized | `queryKeys.ts` + domain hooks |
| Error handling | ✅ Standardized | `handleError()` throughout |
| Console logging | ✅ Production-safe | Suppressed via logger system |

---

## Large Files

### Components (1000-2000 lines)

| File | Lines | Notes |
|------|-------|-------|
| `MediaGalleryItem.tsx` | 1,696 | Rendering + interactions + drag/drop |
| `VideoItem.tsx` | 1,504 | Video item + interactions |
| `SettingsModal.tsx` | 1,320 | Modal + multiple tabs |
| `VideoGallery/index.tsx` | 1,202 | Gallery + filtering + actions |

**Orchestrators (intentionally larger, coordinate subsystems):**
- `ImageLightbox.tsx` (1,303), `ShotEditor/index.tsx` (1,190), `VideoLightbox.tsx` (1,071)

### Hooks (>800 lines)

| Hook | Lines |
|------|-------|
| `useGenerations.ts` | 938 |
| `useShotGenerationMutations.ts` | 925 |
| `useReferenceManagement.ts` | 909 |
| `useGenerationActions.ts` | 906 |
| `useUnifiedGenerations.ts` | 870 |
| `useRepositionMode.ts` | 859 |
| `useTimelinePositionUtils.ts` | 856 |
| `useGenerationsPageLogic.ts` | 855 |

### Page Components

| File | Lines | Hooks |
|------|-------|-------|
| `JoinClipsPage.tsx` | 1,824 | 40 |
| `VideoTravelToolPage.tsx` | 1,823 | 106 |
| `ImageGenerationToolPage.tsx` | 1,174 | 62 |

High hook counts reflect complex orchestration. Not necessarily a problem if the page performs well.

---

## Type Safety

**~1,980 `any` usages** across ~411 files. Top files:

| File | Count |
|------|-------|
| `useLightboxLayoutProps.ts` | 41 |
| `SimpleRealtimeManager.ts` | 39 |
| `SharedMetadataDetails.tsx` | 28 |
| `useSegmentOutputsForShot.ts` | 26 |
| `VideoGallery/index.tsx` | 26 |

---

## Hardcoded Colors

**181 instances** of hex/rgb/hsl literals:

| File | Count |
|------|-------|
| `GlobalHeader.tsx` | 40 |
| `HeroSection.tsx` | 23 |
| `select.tsx` | 11 |

These are mostly in marketing/landing pages and UI primitives.

---

## Established Patterns

| Area | Location | Pattern |
|------|----------|---------|
| Hook decomposition | `src/shared/hooks/shots/` | 10 focused files from monolith |
| Query/mutation separation | `src/shared/hooks/segments/` | Clean split + `useServerForm` |
| Component decomposition | `ShotImagesEditor/` | 32 line index + 13 files |
| Context for state | `ImageGenerationFormContext` | Eliminates prop drilling |
| Cache keys | `src/shared/lib/queryKeys.ts` | Centralized registry |
| Error handling | `src/shared/lib/errorHandler.ts` | `handleError()` with context |
| Lightbox architecture | `MediaLightbox/` | Shell + orchestrators + contexts |
| Dead code detection | `useGenerationActions.ts` cleanup | Grep for unused exports in return objects |

---

## Cleanup Patterns

**Dead code in hooks** — Check for:
- Exports in return object that nothing consumes (grep `hookName.exportName`)
- Refs declared but only assigned, never read
- Mutations/hooks called but result never used
- Vestigial stubs from removed features (empty functions, hardcoded `false`)

Example: `useGenerationActions.ts` had 6 unused exports, ~320 lines removed (26%).

---

## Recent Refactors

| Before | After |
|--------|-------|
| `ShotImagesEditor.tsx` (3,775 lines) | `ShotImagesEditor/` (32 line index) |
| `useShots.ts` (2,350 lines) | `hooks/shots/` (10 files) |
| `MediaLightbox.tsx` (2,617 lines) | `MediaLightbox/` (189 line shell) |
| `PhaseConfigSelectorModal.tsx` (1,973 lines) | 287 lines |
| `GuidanceVideoStrip.tsx` (1,456 lines) | 683 lines |
| `ImageGenerationForm/index.tsx` (1,164 lines) | 52 lines |
| `useGenerationActions.ts` (1,222 lines) | 906 lines (dead code removal) |
| Double-casts (8 files) | 0 files |
