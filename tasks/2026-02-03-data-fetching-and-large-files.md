# Data Fetching Cleanup & Large File Decomposition

## Context

The data fetching architecture is **fundamentally sound** — three hooks at three scopes (project, shot, variant), smart polling, centralized invalidation, no circular dependencies. The "3 hooks, 2,411 lines" number is misleading: `useGalleryPageState` (904 lines) is a page orchestrator, not a data fetcher.

The real remaining issues are:
1. **Mixed concerns** in `useProjectGenerations` (mutations inside a query hook)
2. **39 files over 800 lines** (19 over 1,000) — the largest quality gap
3. Minor inconsistencies in query key usage and unused exports

---

## Architecture (current state)

```
useGalleryPageState (904 LOC) — page orchestrator
  └─ useProjectGenerations (944 LOC) — project-wide paginated queries + 5 mutations
       └─ useSmartPollingConfig ← DataFreshnessManager ← SimpleRealtimeManager

useShotImages (554 LOC) — shot-scoped queries, pure (no mutations)
  └─ useSmartPollingConfig (same)

useVariants (331 LOC) — single-generation variant management
  └─ useGenerationInvalidation (manual invalidation after mutations)

SimpleRealtimeProvider — listens to DB changes, invalidates caches
```

**Three query scopes** (intentionally separate — NOT duplication):
- `unified-generations:project:{id}` — paginated gallery (useProjectGenerations)
- `all-shot-generations:{shotId}` — full shot images (useShotImages)
- `generation-variants:{genId}` — variants for one generation (useVariants)

**Invalidation flow**: Realtime events → SimpleRealtimeProvider → queryClient.invalidateQueries. Mutations in useVariants also call `invalidateVariantChange()` directly. Smart polling is fallback when realtime is broken.

---

## Tasks

### 1. Extract mutations from `useProjectGenerations`

**Problem**: 354 of 944 lines (37%) are mutations. The actual query logic is ~56 lines. The hook name says "queries" but it's also the home of `useDeleteGeneration`, `useToggleGenerationStar`, etc.

**Discovery**: Only 3 of 5 exported mutations have active consumers:
- `useDeleteGeneration` — used by useGalleryPageState, MediaGallery
- `useDeleteVariant` — used internally by useVariants
- `useToggleGenerationStar` — used by useGalleryPageState, MediaGallery, useStarToggle

`useUpdateGenerationLocation` and `useCreateGeneration` have **no hook consumers** — verify if they're used via direct imports anywhere, or if they're dead code.

**Action**:
- [ ] Verify `useUpdateGenerationLocation` and `useCreateGeneration` are actually used (grep for all import sites, not just hook usage)
- [ ] Create `src/shared/hooks/useGenerationMutations.ts` with the 3 active mutations
- [ ] Move `useDeleteGeneration`, `useDeleteVariant`, `useToggleGenerationStar` there
- [ ] Delete or move unused mutations if confirmed dead
- [ ] Update ~5 consumer imports
- [ ] `useProjectGenerations.ts` should drop from 944 → ~590 lines (queries + fetch helpers only)

**Risk**: Low — mutations are self-contained functions, just changing which file they live in.

---

### 2. Fix hardcoded query key in `useShotImages`

**Problem**: `useShotImages.ts:151` uses `['all-shot-generations', shotId]` hardcoded instead of `queryKeys.generations.byShot(shotId)`.

**Discovery**: The registry key `queryKeys.generations.byShot(shotId)` resolves to exactly `['all-shot-generations', shotId]`, so this isn't broken — just inconsistent.

**Action**:
- [ ] Replace hardcoded key with `queryKeys.generations.byShot(shotId)` import
- [ ] Check for any other hardcoded query keys in data hooks

**Risk**: None — same value, just using the registry.

---

### 3. Large file decomposition (prioritized)

19 files over 1,000 lines. The proven pattern is `useRepositionMode` (859 → 161-line orchestrator + 5 focused hooks). Prioritize by: impact on shared code first, then tool-specific files.

**Template**: For each file, extract into a directory with:
```
ComponentName/
  index.tsx          — orchestrator (state + composition, <300 LOC)
  components/        — UI pieces
  hooks/             — state/logic hooks
  types.ts           — shared types
```

#### Tier 1: Shared components (high value — used across tools)

| File | Lines | Decomposition approach |
|------|-------|----------------------|
| `ImageLightbox.tsx` | 1,296 | Extract editing modes (img2img, inpaint, reposition) into mode-specific hooks — similar to how VideoLightbox/reposition was already done |
| `MyLorasTab.tsx` | 1,168 | Extract LoRA list, upload form, and management actions into separate components |
| `ImageGenerationForm.tsx` | 1,133 | Already a directory — extract remaining large sections into sub-components |
| `VideoLightbox.tsx` | 1,064 | Extract editing modes similar to ImageLightbox approach |
| `MediaGallery/index.tsx` | 1,027 | Extract pagination logic, skeleton rendering, and navigation into hooks |
| `VariantSelector/index.tsx` | 1,001 | Extract variant list, comparison view, and action buttons |

#### Tier 2: Tool pages (self-contained, lower risk)

| File | Lines | Decomposition approach |
|------|-------|----------------------|
| `JoinClipsPage.tsx` | 1,823 | Largest file. Extract form state, clip list, and preview into separate components/hooks |
| `generateVideoService.ts` | 1,568 | Split by generation phase (structure, motion, prompt, model config) |
| `VideoItem.tsx` | 1,504 | Extract join modal, mobile preload, and share into separate components |
| `VideoSegmentEditor.tsx` | 1,363 | Extract segment list, preview, and timing controls |
| `JoinClipsSettingsForm.tsx` | 1,309 | Extract form sections into sub-components |
| `Timeline.tsx` | 1,227 | Extract interaction handlers, rendering, and position calculation |
| `ShotEditor/index.tsx` | 1,200 | Extract sections (header, forms, modals) — already has hooks directory |
| `VideoGallery/index.tsx` | 1,181 | Extract grid layout, filtering, and item rendering |
| `ImageGenerationToolPage.tsx` | 1,169 | Extract gallery section, form section, and settings panel |

#### Tier 3: Large hooks (extract sub-concerns)

| File | Lines | Decomposition approach |
|------|-------|----------------------|
| `useProjectGenerations.ts` | 944 | Task 1 handles this — extract mutations, leaving ~590 lines of queries |
| `useGalleryPageState.ts` | 904 | Extract filter state management, skeleton count tracking, and action handlers into focused hooks |
| `useTimelinePositionUtils.ts` | 858 | Pure utility functions — split by concern (position calculation, drag handling, snap logic) |

**Approach for each**: Read the file, identify 3-5 concerns, extract each into its own file, leave an orchestrator under 300 lines. Don't change any behavior.

---

### 4. Document data ownership matrix

**Problem**: No single place documents which hook owns which data and mutations.

**Action**:
- [ ] Add to `docs/structure_detail/` a `data_fetching.md` with:
  - Hook → query key → table mapping
  - Mutation → hook → invalidation mapping
  - "When to use which hook" guide
  - Realtime invalidation flow diagram

---

## What NOT to do

| Approach | Why wrong |
|----------|-----------|
| Merge the 3 query hooks into 1 | They serve distinct scopes (project/shot/variant) |
| Consolidate variant fetching | `fetchEditVariants`, `useDerivedItems`, `useVariants` serve different use cases — gallery filter, lineage display, lightbox management |
| Add predicate-based invalidation | Current approach works; the DataFreshnessManager + realtime is more reliable than manual predicates |
| Build a QueryFactory abstraction | Over-engineering for 3 hooks |
| Extract fetch helpers into a "data layer" | Supabase client is already the data layer |

---

## Checklist

- [x] **Task 1**: Extract mutations from useProjectGenerations → useGenerationMutations.ts
- [x] **Task 2**: Fix hardcoded query key in useShotImages
- [x] **Task 3a**: MyLorasTab → directory with components/ + hooks/
- [x] **Task 3b**: VariantSelector → VariantCard, VariantGrid, MobileInfoModal
- [x] **Task 3c**: useGalleryPageState → useGalleryFilterState extracted
- [x] **Task 3d**: useTimelinePositionUtils → 4 focused files in timeline/
- [x] **Task 3e**: JoinClipsPage → SortableClip, useClipManager, useJoinClipsGenerate
- [x] **Task 3f**: VideoItem → VideoItemActions, VideoItemMemo, JoinClipsModal
- [x] **Task 3g**: VideoSegmentEditor → directory with components/ + hooks/
- [x] **Task 3h**: travelBetweenImages → directory with types, defaults, payloadBuilder
- [x] **Task 4**: Write data_fetching.md ownership doc
- [x] **Task 5**: Update code_quality_audit.md
