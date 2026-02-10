# Travel-Between-Images: Structural Decomposition

**Impact**: 64 structural findings (204 weighted points). Largest single area of debt.
**Effort**: Days. Requires careful component-by-component decomposition.

## Overview

The travel tool has 64 structural findings (52 T3, 12 T4) across ~20 files. The pattern is consistent: mid-size components (500-900 LOC) with 15-45 props, many hooks, and mixed concerns (rendering + data fetching + transforms + handlers).

## T4 Files (highest priority — multiple complexity signals)

These 8 files each have 3+ structural signals and need dedicated decomposition:

### 1. `Timeline.tsx` (744 LOC, 10 hooks, complexity:18)
- **Props**: TimelineProps has 43 props — mostly pass-through from ShotImagesEditor
- **Fix**: Extract `useTimelineOrchestration` hook (frame position + segment management). Extract empty-state drag handlers (already identified as dupes with ShotImageManager/EmptyState).
- **Finding**: `structural::src/tools/travel-between-images/components/Timeline.tsx`

### 2. `SegmentOutputStrip.tsx` (881 LOC, 11 hooks, 25 props)
- **Concerns**: jsx_rendering, data_fetching, data_transforms(11)
- **Fix**: Extract `useSegmentOutputRendering` (output-to-display mapping), `useSegmentOutputDrag` (drag interaction state). The rendering transforms are the bulk — they compute display positions from raw segment data.
- **Finding**: `structural::src/tools/travel-between-images/components/Timeline/SegmentOutputStrip.tsx`

### 3. `VideoShotDisplay.tsx` (699 LOC, 12 hooks, 14 props)
- **Concerns**: jsx_rendering, data_transforms(6), handlers(12)
- **Fix**: Extract handler groups (video playback, scrubbing, task creation) into focused hooks. The 12 handlers suggest this component orchestrates too many user interactions.

### 4. `ShotListDisplay.tsx` (641 LOC, 16 hooks, 11 props)
- **Concerns**: jsx_rendering, data_fetching, data_transforms(12)
- **Fix**: Extract data transforms (shot ordering, filtering, grouping) into a `useShotListData` hook. The 12 transforms suggest heavy data preparation that doesn't belong in the render component.

### 5. `BatchGuidanceVideo.tsx` (515 LOC, 10 hooks, 17 props)
- **Concerns**: jsx_rendering, data_fetching, handlers(10)
- **Fix**: Extract batch operation handlers into `useBatchGuidanceActions`.

### 6. `SortableShotItem.tsx` (518 LOC, 17 hooks, 16 props)
- **Concerns**: jsx_rendering, data_transforms(4), handlers(10)
- **Fix**: Extract drag/sort interaction into `useSortableShotDrag`. Extract shot action handlers into `useShotItemActions`.

### 7. `FinalVideoSection.tsx` (555 LOC, 7 complexity, 15 props)
- **Concerns**: jsx_rendering, data_fetching, data_transforms(4)
- **Fix**: Extract final stitch status computation into `useFinalVideoStatus` hook.

### 8. `TimelineOrchestrator hook` (801 LOC, complexity:8, 28 props)
- **File**: `Timeline/hooks/useTimelineOrchestrator.ts`
- **Fix**: This is already a hook but at 801 LOC needs internal decomposition. Split frame calculation, segment positioning, and drag state into sub-hooks.

## T3 Files (20+ props or large but cohesive)

These are less urgent — many are borderline or have legitimate complexity:

| File | LOC | Props | Priority | Notes |
|------|-----|-------|----------|-------|
| `MotionControl.tsx` | 693 | 33 | Medium | Large + mixed. Extract data fetching. |
| `TimelineItem.tsx` | 556 | 27 | Low | Large but cohesive. |
| `GuidanceVideoStrip.tsx` | 692 | 21 | Medium | Large. Extract guidance video state. |
| `ShotEditor` hooks | various | various | After T4 | Prop counts will drop after Timeline refactoring |

## Prop Drilling Strategy

Many prop counts (TimelineProps: 43, SegmentOutputStripProps: 25, etc.) trace back to pass-through from `ShotEditor`. The right fix is:

1. **Create sub-interfaces**: Group related props into `TimelineVideoProps`, `TimelineAudioProps`, `TimelineShotProps`, `TimelineStructureProps`
2. **Use in ShotEditor**: Construct these objects once, pass as 4 grouped props instead of 40 individual ones
3. **Cascade**: All child components destructure from the grouped objects

This should be done FIRST, before individual component decomposition, because it will naturally reduce the prop count findings across all downstream components.

## Execution Order

1. **Create sub-interfaces** (reduces 20+ prop findings across all files)
2. **Decompose T4 files** (8 files, highest weight)
3. **Review T3 files** (many will auto-resolve after step 1-2)

## Verification

```bash
# After each batch of changes:
npx tsc --noEmit
python3 -m scripts.decruftify scan --path src/
python3 -m scripts.decruftify show "src/tools/travel-between-images" --status wontfix --top 30
```
