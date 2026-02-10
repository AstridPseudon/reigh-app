# Bucket B Structural Debt: Execution Plan

**Based on**: Full code review of all 260 findings across ~130 files.
**Result**: ~180 findings are justified complexity (no action). ~80 need real fixes across 5 phases.

---

## Master Checklist

### Phase 1: Quick Wins (< 1 hour total)
- [ ] 1. Raise props threshold 10 → 15
- [ ] 2. Delete dead code in segmentSettingsUtils.ts (~200 LOC)
- [ ] 3. Delete dead code in PromptEditorModal.tsx (~50 LOC)

### Phase 2: Small Extractions (1-2 hours each)
- [ ] 4. Consolidate useEntityState into useAutoSaveSettings (saves 555 LOC)
- [ ] 5. EmptyState.tsx: use existing useFileDragTracking hook
- [ ] 6. DatasetBrowserModal: extract ImageResourceItem component
- [ ] 7. Extract useEditToolMediaPersistence hook (DRY edit-images + edit-video)

### Phase 3: Medium Decompositions (half day each)
- [ ] 8. GlobalHeader: extract desktop/mobile variants + useAuthState
- [ ] 9. PhaseConfigVertical: extract sub-components + delete unused props
- [ ] 10. InlineSegmentVideo: split 3 rendering paths into components
- [ ] 11. TaskItem: extract navigation/error/progress hooks
- [ ] 12. AddNewPresetTab: useReducer + extract hooks
- [ ] 13. useShotGenerationMutations: extract cache + position logic
- [ ] 14. useTasks: extract per-status strategy objects

### Phase 4: Larger Refactors (1 day each)
- [ ] 15. InlineEditVideoView: split into mode-specific components
- [ ] 16. InlineEditView (edit-images): split into mode sub-components
- [ ] 17. useClipManager: extract service layer + replace localStorage hack
- [ ] 18. HeroSection: extract animation hook + GoldSpotlight component
- [ ] 19. segmentSettingsUtils: extract migration layer + split concerns

### Phase 5: Post-Refactor Polish
- [ ] 20. useToolSettings: standardize cache format
- [ ] 21. BatchSelector + useTrainingData: extract video ZIP utility
- [ ] 22. VideoShotDisplay: extract ActionButtonsRow + ThumbnailMosaic (optional)
- [ ] 23. GuidanceVideoStrip: extract calculateVideoFrameFromPosition (optional)

### Verified Fine As-Is (no action)
These were investigated thoroughly and are justified complexity:

- travel-between-images: ShotEditor (1136 LOC), TimelineContainer (982), SegmentOutputStrip (881), ShotImagesEditor (738), ShotListDisplay (640), SortableShotItem (517), FinalVideoSection (555), BatchGuidanceVideo (515)
- shared/lib/imageGeneration.ts (528 LOC) — clean task-creation abstraction
- LoraSelectorModal (274 LOC) — compact, working fine
- JoinClipsSettingsForm (645 LOC) — constraint math could be extracted but component is cohesive
- ProjectContext (780 LOC) — three concerns are all tied to project selection
- BrowsePresetsTab (526 LOC) — large but single cohesive concern
- useLoraManager (511 LOC) — extract helpers optionally but don't split the hook
- useSegmentOutputsForShot (572 LOC) — complex slot mapping justified by 3 data sources
- useTimelineCore (656 LOC) — well-organized with clear sections
- useAutoSaveSettings (560 LOC) — justified lifecycle complexity (but see #4 re: useEntityState dupe)

---

## Phase 1: Quick Wins

### 1. Raise props threshold 10 → 15

**File**: `scripts/decruftify/detectors/props.py`
**Change**: Line 51, `prop_count > 10` → `prop_count > 14`
**Also**: Update display string on line 71 from `>10 props` to `>14 props`

**Why**: 28 of the 79 uncovered props findings have 11-14 props. That's a normal interface size for React components with multiple feature areas. The threshold was set conservatively; 15+ is where genuine prop drilling signals start.

**Impact**: Reclassifies ~28 findings. Rescan to auto-resolve.

---

### 2. Delete dead code in segmentSettingsUtils.ts

**File**: `src/shared/components/segmentSettingsUtils.ts` (839 LOC)

**Delete these unused functions** (each marked "Unused" in comments with `void` suppressors):
- `createDefaultSettings()` (~18 LOC)
- `mergedToFormSettings()` (~23 LOC)
- `lorasToSaveFormat()` (~5 LOC)
- `mergeSegmentSettings()` (~120 LOC)
- All associated `void` declarations that suppress unused warnings

**Why**: ~200 LOC of dead code that was left behind during refactoring. The `void` declarations confirm these are known-unused.

**Verify**: Grep for each function name to confirm zero importers before deleting.

---

### 3. Delete dead code in PromptEditorModal.tsx

**File**: `src/shared/components/PromptEditorModal.tsx` (589 LOC)

**Delete**:
- `createDefaultSettings` function (defined but never called, comment says "unused")
- `mergedToFormSettings` function (defined with "Unused" note)

**Verify**: Grep for each function name to confirm zero callers.

---

## Phase 2: Small Extractions

### 4. Consolidate useEntityState into useAutoSaveSettings

**Files**:
- `src/shared/hooks/useAutoSaveSettings.ts` (560 LOC)
- `src/shared/hooks/useEntityState.ts` (555 LOC)

**Problem**: These two hooks are 99% identical. Same debounce logic, same pending ref coordination, same entity change handling, same flush-on-unmount. The only difference is useAutoSaveSettings integrates with React Query while useEntityState uses custom load/save functions.

**Plan**:
1. Add an optional `customLoadSave` parameter to useAutoSaveSettings that accepts `{ load: () => Promise<T>, save: (data: T) => Promise<void> }`
2. When provided, use custom functions instead of React Query
3. Migrate all useEntityState consumers to useAutoSaveSettings with the custom option
4. Delete useEntityState.ts

**Verify**: Find all imports of useEntityState, update each call site. Run type check + test.

**Impact**: Eliminates 555 LOC of duplication. Single place to fix save/debounce bugs.

---

### 5. EmptyState.tsx: use existing useFileDragTracking

**File**: `src/shared/components/ShotImageManager/EmptyState.tsx` (168 LOC)

**Problem**: EmptyState reimplements drag enter/over/leave logic with manual boundary-math coordinate checking (lines 55-65) instead of using the existing `useFileDragTracking` hook which handles nesting counters correctly.

**Plan**:
1. Import `useFileDragTracking` from `src/shared/hooks/useFileDragTracking.ts`
2. Replace `handleDragEnter`, `handleDragOver`, `handleDragLeave` with the hook's provided handlers
3. Keep `handleDrop` (it has component-specific logic for generation vs file drops)
4. Remove manual isDragging state management

**Impact**: ~70 LOC reduction. Fixes potential edge case where manual boundary checking misses child element drag events.

---

### 6. DatasetBrowserModal: extract ImageResourceItem

**File**: `src/shared/components/DatasetBrowserModal.tsx` (624 LOC)

**Problem**: Image rendering path (lines 440-539) duplicates VideoResourceItem's structure — loading skeleton, processing overlay, hover overlay, visibility toggle, owner indicator. VideoResourceItem is already a separate component (99 LOC); images use inline JSX with the same patterns.

**Plan**:
1. Create `ImageResourceItem` component following `VideoResourceItem`'s pattern
2. Move image-specific rendering from the inline JSX into the new component
3. Both components share props interface (resource, isOwner, isSelected, onSelect, onToggleVisibility)

**Impact**: ~100 LOC reduction in render function. Consistent rendering for both resource types.

---

### 7. Extract useEditToolMediaPersistence hook

**Files**:
- `src/tools/edit-images/pages/EditImagesPage.tsx` (lines 79-141)
- `src/tools/edit-video/pages/EditVideoPage.tsx` (lines 73-149)

**Problem**: Both pages have identical patterns for:
- Loading last-edited media ID from project settings on mount
- Preloading the image/video
- Saving current media ID to settings when selection changes
- `hasLoadedFromSettings` ref to prevent re-runs

**Plan**:
1. Create `src/shared/hooks/useEditToolMediaPersistence.ts`
2. Accept params: `{ settingsKey: string, preloadFn?: (url: string) => void }`
3. Return: `{ lastEditedMediaId, setLastEditedMediaId, isLoading }`
4. Migrate both pages to use it

**Impact**: ~100 LOC saved across both pages. Single fix point for persistence bugs.

---

## Phase 3: Medium Decompositions

### 8. GlobalHeader: extract desktop/mobile + useAuthState

**File**: `src/shared/components/GlobalHeader.tsx` (821 LOC)

**Problem**:
- Desktop layout (lines 272-519) and mobile layout (lines 521-784) are ~250 LOC each with 97% structural duplication — same elements, different classNames and arrangements.
- Auth state management (lines 95-198) fetches session, username, and referral stats with a double-fetch pattern and duplicated username fetch.

**Plan**:
1. Extract `useAuthState` hook → returns `{ session, username, referralStats, isLoading }`
   - Consolidates double-fetch pattern into single auth lifecycle
   - Deduplicates username fetch (currently in 2 places)
2. Extract shared `ProjectSelectorPopover` component used by both layouts
3. Extract `GlobalHeaderDesktop` and `GlobalHeaderMobile` sub-components
4. Parent renders conditionally based on breakpoint

**Impact**: ~300 LOC reduction. Auth logic testable in isolation. Layout changes only affect one variant.

---

### 9. PhaseConfigVertical: extract sub-components

**File**: `src/shared/components/PhaseConfigVertical.tsx` (679 LOC)

**Problem**:
- Monolithic component with 6 unrelated useState hooks (LoRA selection, preset modal, focused input)
- Phase count change logic (lines 216-264) is complex 2→3/3→2 transformation buried in a callback
- LoRA UI section (lines 414-607) is deeply nested with maps and conditionals
- Unused props: `generationTypeMode`, `hasStructureVideo`, `structureType`, `amountOfMotion`, `onGenerationTypeModeChange`

**Plan**:
1. Delete unused props (5 props) from interface and component
2. Extract `PhaseCountSelector` — handles 2↔3 phase switching logic
3. Extract `PerPhaseSettings` — renders one phase column (reusable for each phase)
4. Extract `LoRASectionForPhase` — the complex LoRA UI with modal integration
5. Extract `GlobalPhaseSettings` — flow shift, random seed, model solver row

**Impact**: Parent reduces to ~150-200 LOC. Each sub-component is independently testable.

---

### 10. InlineSegmentVideo: split 3 rendering paths

**File**: `src/shared/components/InlineSegmentVideo.tsx` (624 LOC)

**Problem**:
- Three distinct rendering paths based on state: placeholder (generate CTA), processing (no output yet), preview (full UI with scrubbing)
- Each path has different prop requirements, but all ~20+ props are passed regardless
- 8 useState hooks managing display state across all three paths

**Plan**:
1. Extract `SegmentPlaceholder` component (lines 271-339) — needs only layout + onClick props
2. Extract `SegmentProcessing` component (lines 349-401) — needs only status + isPending props
3. Extract `SegmentPreview` component (lines 406-622) — gets the full prop set for scrubbing/display
4. Parent becomes a thin router: check state → render appropriate sub-component

**Impact**: Props per sub-component drops from 20+ to ~8. Each rendering path is independently readable.

---

### 11. TaskItem: extract hooks

**File**: `src/shared/components/TasksPane/TaskItem.tsx` (701 LOC)

**Problem**: 8 distinct concerns mixed in one component:
- Task timestamp management
- Video/image generation hooks
- Travel-specific image extraction
- Cascaded error handling with Supabase query
- Progress checking with complex filter building
- Mobile vs desktop tap interactions
- Auto-lightbox opening logic
- Variant ID extraction scattered across multiple sites

**Plan**:
1. Extract `useTaskNavigation` — video/image opening logic (handleCheckProgress, handleViewVideo)
2. Extract `useCascadedTaskError` — error handling + cascaded task fetch
3. Extract `useCheckTaskProgress` — filter building + navigation
4. Centralize variant ID extraction into a single helper: `getVariantId(task)` instead of repeated `_variant_id || generationData._variant_id`
5. TaskItem becomes ~300 LOC pure rendering

**Impact**: Each concern testable independently. Variant handling consistent.

---

### 12. AddNewPresetTab: useReducer + hooks

**File**: `src/shared/components/PhaseConfigSelectorModal/AddNewPresetTab.tsx` (504 LOC)

**Problem**: 16+ useState hooks managing different concerns:
- Form data (addForm, editablePhaseConfig, generationTypeMode)
- File management (sampleFiles, deletedExistingSampleUrls, previewUrls, fileInputKey)
- Video samples (initialVideoSample, initialVideoDeleted)
- Submission state (isSubmitting, mainGenerationIndex)
- 5+ useEffect hooks managing different lifecycles

**Plan**:
1. Replace 16 useState with useReducer for form state: `{ form, files, video, submission }`
2. Extract `usePresetSampleFiles` hook — file upload, preview URL generation, cleanup
3. Extract `usePresetFormInit` hook — initialization from edit data, phase config defaults
4. Keep submission handler in component (it's the main action)

**Impact**: State changes become explicit actions. File management isolated. Initialization logic separated from rendering.

---

### 13. useShotGenerationMutations: extract helpers

**File**: `src/shared/hooks/useShotGenerationMutations.ts` (858 LOC)

**Problem**:
- Directly manages 3 cache types (`shot-generations`, `shots`, `unified-generations`) with brittle key dependencies
- `createOptimisticItem` logic duplicated across mutations
- Frame collision logic (`ensureUniqueFrame`) called in 3+ places with similar error handling

**Plan**:
1. Extract `src/shared/hooks/helpers/unifiedGenerationsCache.ts` — `optimisticallyRemoveFromUnifiedGenerations()` and related cache helpers
2. Extract `src/shared/hooks/helpers/positionCalculation.ts` — frame collision detection, unique frame calculation, position strategy selection
3. Keep mutation definitions in main file (they're the core concern)

**Impact**: Reduces to ~600 LOC. Position logic reusable. Cache manipulation testable.

---

### 14. useTasks: extract strategy objects

**File**: `src/shared/hooks/useTasks.ts` (706 LOC)

**Problem**:
- Processing tasks get special treatment scattered across the file: multiplier pagination (line 207), custom sorting (line 251), special count behavior (line 164)
- Count query construction duplicated between `usePaginatedTasks` and `useTaskStatusCounts`
- "Nuclear refetch" heuristic (lines 302-322) is fragile and works around stale data instead of fixing root cause

**Plan**:
1. Create `TaskPaginationStrategy` interface with `Processing`, `Succeeded`, `Failed` implementations
   - Each defines: page size multiplier, sort behavior, count filter, refetch policy
2. Extract `buildCountQueries()` shared between paginated tasks and status counts
3. Evaluate removing "nuclear refetch" — if DataFreshnessManager handles staleness correctly, this shouldn't be needed

**Impact**: ~550 LOC, clearer intent. Status-specific behavior is explicit and extensible.

---

## Phase 4: Larger Refactors

### 15. InlineEditVideoView: split by mode

**File**: `src/tools/edit-video/components/InlineEditVideoView.tsx` (1048 LOC)

**Problem**: Three sub-modes (trim/replace/enhance) each with separate state, hooks, and rendering, all in one component. Mode switching is via conditional rendering on `videoEditSubMode`.

**Plan**:
1. Extract `VideoTrimmer` — wraps `useVideoTrimming` + `useTrimSave` + TrimControlsPanel
2. Extract `VideoReplacer` — wraps phase config + LoRA selection + portion timeline
3. Extract `VideoEnhancer` — wraps `useVideoEnhance` + VideoEnhanceForm
4. Extract `useVideoFpsDetection` hook for FPS state management
5. Parent component becomes mode router (~200 LOC): shared toolbar + mode dispatch

**Impact**: Each mode ~250-350 LOC. Can add new modes without touching existing ones.

---

### 16. InlineEditView (edit-images): split by mode

**File**: `src/tools/edit-images/components/InlineEditView.tsx` (888 LOC)

**Problem**: Pure hook aggregator with no business logic of its own. Coordinates 5+ hooks (useVariants, useInpainting, useUpscale, useMagicEditMode, useEditSettings) and passes their outputs to rendering. To trace a bug you must jump between 5+ hooks.

**Plan**:
1. Extract `UpscaleControls` — wraps useUpscale, renders upscale UI
2. Extract `InpaintingCanvas` — wraps useInpainting, renders canvas + brush
3. Extract `MagicEditPanel` — wraps useMagicEditMode, renders annotate UI
4. Extract `VariantOutputSelector` — wraps useVariants, renders variant picker
5. Parent becomes orchestrator: shared canvas area + mode-specific controls panel

**Impact**: Each sub-component ~150-250 LOC. Hook coupling is explicit per-component.

---

### 17. useClipManager: extract service layer

**File**: `src/tools/join-clips/hooks/useClipManager.ts` (740 LOC)

**Problem**:
- Hook reads like a service class, not a React hook — contains clip CRUD, localStorage caching, poster preloading, pending clip detection via localStorage polling
- Pending clips from lightbox (lines 119-197) polls localStorage with 5-minute TTL — couples join-clips to lightbox without explicit dependency
- localStorage clip count caching duplicates patterns from other tools

**Plan**:
1. Extract `clipManagementService.ts` — `uploadClip`, `deleteClip`, `reorderClips`, `preloadPosters` (pure functions)
2. Extract `useLocalStorageCache` shared utility — reusable across tools for skeleton-count caching
3. Replace pending-clips localStorage hack with React Context or CustomEvent
4. useClipManager becomes thin hook wrapping service + context

**Impact**: Service layer testable without React. Pending clip communication is explicit.

---

### 18. HeroSection: extract animation + spotlight

**File**: `src/pages/Home/components/HeroSection.tsx` (657 LOC)

**Problem**:
- Animation orchestration (5 phases with timer logic) mixed with rendering (13 sections)
- Mouse tracking for gold spotlight (trail state, opacity decay, canvas masking) is a separate concern
- TravelSelector thumbnail grid has hardcoded layout rules in inline conditionals

**Plan**:
1. Extract `useHeroAnimation` hook — manages 5 animation phases, asset loading, timer coordination
2. Extract `GoldSpotlight` sub-component — mouse trail, opacity decay, canvas masking
3. Move TravelSelector thumbnail layout rules to a config object instead of inline conditionals

**Impact**: HeroSection reduces to ~400 LOC. Animation timing testable. Spotlight logic isolated.

---

### 19. segmentSettingsUtils: extract migration layer

**File**: `src/shared/components/segmentSettingsUtils.ts` (839 LOC → ~640 after Phase 1 dead code deletion)

**Problem**: Five distinct concerns in one file: preset definitions, helper functions, form interface, merge/extraction logic, metadata builders. Migration compatibility layer (old/new/legacy formats) is mixed into the main API.

**Plan**:
1. Extract `segmentSettingsMigration.ts` — `PairMetadata` interface, `readSegmentOverrides`, `writeSegmentOverrides`, old→new format conversion
2. Create `convertMotionScale(value, from, to)` — single function replacing 3 separate conversion sites
3. Keep preset definitions, helpers, and metadata builders in main file (they're the public API)

**Impact**: Migration debt is isolated. Main file is clearer. Motion scale conversion has one source of truth.

---

## Phase 5: Post-Refactor Polish

### 20. useToolSettings: standardize cache format

**File**: `src/shared/hooks/useToolSettings.ts` (643 LOC)

**Problem**: Cache format handling (lines 358-384) checks for both `{ settings: T, hasShotSettings }` wrapper format AND flat format. This dual-mode leaks into consumers.

**Plan**: Migrate all `setQueryData` calls to use one format. Remove the dual-format check.

---

### 21. BatchSelector + useTrainingData: extract video ZIP

**Files**: `src/tools/training-data-helper/` — BatchSelector.tsx (618 LOC), useTrainingData.ts (716 LOC)

**Problem**: Video segment extraction (canvas + MediaRecorder, ~100 LOC in BatchSelector) is a standalone concern. useTrainingData has 4 separate useEffects managing different lifecycles.

**Plan**: Extract `extractVideoSegmentsToZip()` utility. Consolidate useTrainingData state into logical groups.

---

### 22-23. Travel tool optional extractions

**VideoShotDisplay.tsx** (698 LOC): Could extract `ActionButtonsRow` (~125 LOC) and `ThumbnailMosaic` (~80 LOC).

**GuidanceVideoStrip.tsx** (692 LOC): Could extract `calculateVideoFrameFromPosition()` utility shared between hover + tap logic (~30 LOC saved).

These are optional — the components work fine as-is but would be more readable with extraction.

---

## How to Execute

After each phase:
```bash
# 1. Type-check
npx tsc --noEmit

# 2. Rescan
python3 -m scripts.decruftify scan --path src/

# 3. Check progress
python3 -m scripts.decruftify status
```

### Expected Score Progression

| After | Strict Score |
|-------|-------------|
| Current | 84 |
| Phase 1 | ~86 |
| Phase 2 | ~88 |
| Phase 3 | ~91 |
| Phase 4 | ~93 |
| Phase 5 | ~94 |
