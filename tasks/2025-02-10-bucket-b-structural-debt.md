# Bucket B: Structural & Component Debt (Long Tail)

**Score impact**: 260 items, 864 weighted points. Strict 80 → 92 if all resolved (unlikely — realistic target ~87-88).
**Effort**: Weeks. Mix of props threshold tweak (free), medium decompositions, and large refactors.

## Overview

After the 6 major refactoring targets (lightbox, timeline, ImageGenerationToolPage, ImageGenerationForm, MediaGallery, HomePage trio), 260 structural findings remain spread across ~130 files. No single file dominates — this is the long tail.

The debt breaks down into:
- **79 props** (237w) — bloated interfaces, many borderline
- **65 large** (260w) — files 500-1300 LOC
- **59 structural T3** (177w) — complexity, mixed concerns
- **33 structural T4** (132w) — multi-signal god components
- **12 dupes T3** (36w) — near-duplicate functions
- **12 misc** (22w) — unused, deprecated, exports

## Quick win: raise props threshold

53 of the 138 props findings (across all targets) have 11-14 props. That's a normal interface size. Of the 79 uncovered props, 28 are in this range. Raising the detector threshold from 10 to 15 would reclassify these as noise.

```bash
# Check what's in the 11-14 range
python3 -m scripts.decruftify show props --status wontfix --top 50
# Look at prop_count in the detail — anything ≤14 is normal
```

To implement: change the threshold in `scripts/decruftify/detectors/props.py`, then rescan. Existing findings below the new threshold will auto-resolve.

## Areas by priority

### 1. travel-between-images (78 findings, 263w) — THE BIGGEST AREA

This tool has the most structural debt by far. The 6 major targets already cover Timeline/TimelineContainer prop drilling, but there are 78 MORE findings in surrounding files.

```bash
python3 -m scripts.decruftify show "src/tools/travel-between-images" --status wontfix --top 50
```

**High-weight files** (11-12w each, multiple detector signals):
| File | LOC | Signals |
|------|-----|---------|
| `GuidanceVideoStrip.tsx` | ~550 | large, props, structural, unused var |
| `SegmentOutputStrip.tsx` | ~520 | large, props, structural |
| `ShotListDisplay.tsx` | ~530 | large, props, structural |
| `VideoShotDisplay.tsx` | ~520 | large, props, structural, smell |
| `FinalVideoSection.tsx` | ~530 | large, props, structural |
| `SortableShotItem.tsx` | ~510 | large, props, structural |
| `BatchGuidanceVideo.tsx` | ~520 | large, props, structural |

These 7 files share a pattern: each is a mid-size component (500-550 LOC) with 15-25 props that receives shot/timeline/structure-video data via props. The underlying issue is **prop drilling from ShotEditor** — the same data passes through 3-4 levels.

**Strategy**: After the timeline prop-drilling refactoring (#2 in your list) creates shared sub-interfaces, many of these prop counts will drop. Address these AFTER that refactoring, not before.

**Remaining 40+ files** are mostly T3-only props findings (11-20 props each). Many will fall below threshold if raised to 15.

### 2. shared/components (top-level) (34 findings, 114w)

Standalone shared components that grew large:

```bash
python3 -m scripts.decruftify show "src/shared/components" --status wontfix --top 30
# Filter out MediaLightbox, MediaGallery, ShotImageManager (covered elsewhere)
```

**Top targets**:
| File | Weight | Signals |
|------|--------|---------|
| `PhaseConfigVertical.tsx` | 13w | large, props, structural, dupe |
| `InlineSegmentVideo.tsx` | 10w | large, props, structural |
| `GlobalHeader.tsx` | 8w | large, structural |
| `PromptEditorModal.tsx` | 8w | large, structural |
| `DatasetBrowserModal.tsx` | 8w | large, structural |
| `segmentSettingsUtils.ts` | 7w | large, structural |

**Strategy**: Each is an independent extraction. `PhaseConfigVertical` has the most signals — extract phase presets into a hook. `GlobalHeader` likely needs its navigation/theme logic separated from render.

### 3. shared/hooks (26 findings, 85w)

Hooks that grew large and complex:

```bash
python3 -m scripts.decruftify show "src/shared/hooks" --status wontfix --top 20
```

**Top targets**:
| File | Weight | Signals |
|------|--------|---------|
| `useShotGenerationMutations.ts` | 9w | unused var, large, structural |
| `useLoraManager.tsx` | 8w | large, structural T4 |
| `useSegmentOutputsForShot.ts` | 7w | large, structural |
| `useTasks.ts` | 7w | large, structural |
| `useToolSettings.ts` | 7w | large, structural |
| `useTimelineCore.ts` | 7w | large, structural |
| `useAutoSaveSettings.ts` | 7w | large, structural |
| `useEntityState.ts` | 7w | large, structural |

**Strategy**: These are all 500-900 LOC hooks. Each does one thing but has accumulated helper functions. Split the helpers into separate files, keeping the main hook as a thin orchestrator.

### 4. ShotImageManager (20 findings, 63w)

```bash
python3 -m scripts.decruftify show "src/shared/components/ShotImageManager" --status wontfix
```

**The standout**: `EmptyState.tsx` has 7 dupe findings (21w) — 7 drag/drop handlers duplicated from other components. This is the single highest-weight file not on your list.

**Strategy**: Extract shared drag/drop handlers into `useFileDragTracking` (which already exists from the T2 cleanup — check if EmptyState is using it yet).

### 5. PhaseConfigSelectorModal (11 findings, 36w)

```bash
python3 -m scripts.decruftify show "src/shared/components/PhaseConfigSelectorModal" --status wontfix
```

Two large tab components (`AddNewPresetTab`, `BrowsePresetsTab`) + 6 props findings. Standard modal decomposition pattern.

### 6. TasksPane (8 findings, 28w)

```bash
python3 -m scripts.decruftify show "src/shared/components/TasksPane" --status wontfix
```

`TaskItem.tsx` and `TasksPane.tsx` are both large+structural T4. Extract task rendering logic into sub-components.

### 7. Remaining areas (combined ~100 findings, ~300w)

| Area | Findings | Weight | Notes |
|------|----------|--------|-------|
| shared/lib | 9 | 25w | `imageGeneration.ts` has dupes |
| training-data-helper | 6 | 21w | `BatchSelector` + `useTrainingData` |
| pages/Home | 6 | 20w | `HeroSection` + `TravelSelector` |
| edit-images | 5 | 19w | `EditImagesPage` + `InlineEditView` |
| JoinClipsSettingsForm | 5 | 17w | Form + visualization |
| VariantSelector | 5 | 17w | Large index + sub-components |
| edit-video | 4 | 16w | `InlineEditVideoView` + page |
| contexts | 4 | 14w | `ProjectContext` is large |
| join-clips | 4 | 14w | `useClipManager` + page |
| LoraSelectorModal | 4 | 12w | Types + modal |
| Others (<12w each) | ~48 | ~125w | Scattered |

## Execution plan

### Phase 1: Free points (minutes)
1. Raise props threshold 10 → 15 in detector
2. Reclassify the 8 stale deprecated/unused/export findings
3. Rescan

### Phase 2: Medium decompositions (days)
Work through areas 1-6 above, prioritized by weight:
1. **ShotImageManager/EmptyState** — dedupe 7 drag handlers (21w, highest single-file)
2. **travel-between-images** — AFTER timeline prop-drilling refactoring
3. **shared/components top-level** — PhaseConfigVertical, InlineSegmentVideo, GlobalHeader
4. **shared/hooks** — split large hooks (useShotGenerationMutations, useLoraManager, etc.)
5. **PhaseConfigSelectorModal** — tab decomposition
6. **TasksPane** — task item extraction

### Phase 3: Remaining long tail
Address remaining ~100 findings by area. Many will auto-resolve as cascading effects of Phase 2.

## How to rescan

After each batch of fixes:

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Rescan — this auto-resolves fixed wontfix findings
python3 -m scripts.decruftify scan --path src/

# 3. Check progress
python3 -m scripts.decruftify status

# 4. If score didn't move as expected, check what's still there:
python3 -m scripts.decruftify show <area> --status wontfix
```

The rescan will automatically upgrade wontfixed findings to `auto_resolved` when the underlying issue disappears (e.g., file shrinks below 500 LOC, prop count drops below threshold, complexity score drops). This means you don't need to manually resolve findings — just fix the code and rescan.

## Expected outcome

| Phase | Strict score |
|-------|-------------|
| Current | 80 |
| After Phase 1 (threshold + stale) | ~83 |
| After Phase 2 (medium decompositions) | ~88 |
| After Phase 3 (long tail) | ~92 |
| After all 6 major targets complete | ~95-97 |
| Theoretical max (everything) | 100 |
