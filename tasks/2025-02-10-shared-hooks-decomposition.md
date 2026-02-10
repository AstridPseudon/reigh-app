# Shared Hooks: Structural Decomposition

**Impact**: 14 findings (T3:13, T4:1), 43 weighted points.
**Effort**: 1-2 days. Each hook is independent.

## Overview

These are all 500-900 LOC hooks that do one thing but have accumulated internal helper functions. The fix pattern is consistent: split helpers into separate files, keep the main hook as a thin orchestrator.

## T4 File

### 1. `useLoraManager.tsx` (511 LOC, 16 hooks, complexity:9)
- **Concerns**: jsx_rendering, data_transforms(8), handlers(6)
- **Unique problem**: This is a `.tsx` file — a hook that returns JSX. It manages lora selection state AND renders UI.
- **Fix**: Split into `useLoraManagerState` (pure hook, no JSX) and `LoraManagerUI` component. The 8 data transforms should become a `loraTransforms.ts` utility file.

## T3 Files (large but cohesive)

### 2. `useShotGenerationMutations.ts` (857 LOC)
- **Largest hook**. Contains all shot-level generation mutations (create, variant, regenerate, etc.)
- **Fix**: Group mutations by operation type. Extract `useCreateGenerationMutation`, `useVariantMutation`, `useRegenerateMutation` into separate files. Keep `useShotGenerationMutations` as re-export barrel.

### 3. `useTasks.ts` (705 LOC)
- **Task polling, filtering, and state management**
- **Fix**: Extract task filtering/sorting logic into `taskFilters.ts`. Extract polling configuration into `useTaskPolling`. The main hook orchestrates.

### 4. `useTimelineCore.ts` (656 LOC)
- **Timeline frame/position calculations**
- **Fix**: Extract frame math utilities (`frameToPosition`, `positionToFrame`, `snapToGrid`) into `timelineFrameUtils.ts`. Keep the stateful hook thin.

### 5. `useToolSettings.ts` (643 LOC)
- **Settings scope resolution and write queue integration**
- **Fix**: Extract scope merge logic into `settingsScopeMerge.ts`. Extract write queue integration into separate module. This hook is well-documented (see `settings_system.md`) — changes need careful testing.

### 6. `useSegmentOutputsForShot.ts` (572 LOC)
- Wontfix notes: "cohesive single concern, no obvious split point"
- **Assessment**: Borderline. At 572 LOC it's just over threshold. May auto-resolve if props threshold changes reduce the finding. Leave for last.

### 7. `useAutoSaveSettings.ts` (559 LOC)
- Wontfix notes: "cohesive single concern"
- **Assessment**: Like useSegmentOutputsForShot — this is a state machine with clear phases. The LOC is mostly from careful handling of race conditions and unmount flushing. Splitting would scatter the state machine logic.
- **Recommendation**: Wontfix is correct for this one. The complexity is inherent, not incidental.

### 8. `useEntityState.ts` (554 LOC)
- Wontfix notes: "cohesive single concern"
- **Assessment**: Entity state management with optimistic updates. Similar to useAutoSaveSettings — the complexity is inherent. Splitting would increase complexity.
- **Recommendation**: Wontfix is correct.

### 9. `useGalleryFilterState.ts` (476 LOC, complexity:8)
- **Fix**: Extract filter predicate construction into `galleryFilterPredicates.ts`. The computation of which filters apply to which gallery items is the bulk of the code.

### 10. `useResources.ts` (466 LOC, complexity:5)
- Borderline size, moderate complexity. Leave for last.

### 11. `useServerForm.ts` and `useSlidingPane.ts`
- Both show "0 LOC" (bug — LOC wasn't computed for complexity-only findings, now fixed)
- Both are moderate-size hooks with inherent complexity. Review after rescan corrects LOC.

## Hooks That Should Stay As-Is

Some of these wontfixes are correct:
- **`useAutoSaveSettings`**: State machine logic — splitting scatters the invariants
- **`useEntityState`**: Optimistic update logic — splitting increases complexity
- **`useSegmentOutputsForShot`**: Cohesive data transformation pipeline

For these, the right action is to reclassify as `false_positive` (not a real problem) rather than spending effort splitting for no gain.

## Execution Order

1. **`useLoraManager`** — T4, highest weight, clear decomposition (split JSX from logic)
2. **`useShotGenerationMutations`** — largest, clear grouping by mutation type
3. **`useTasks`** — extract filtering/sorting utilities
4. **`useTimelineCore`** — extract frame math utilities
5. **`useToolSettings`** — extract scope merge (careful — well-documented, needs testing)
6. **Reclassify correct wontfixes** as false_positive (useAutoSaveSettings, useEntityState, useSegmentOutputsForShot)
7. **Review remaining** after rescan

## Verification

```bash
npx tsc --noEmit
python3 -m scripts.decruftify scan --path src/
python3 -m scripts.decruftify show "src/shared/hooks" --status wontfix --top 20
```
