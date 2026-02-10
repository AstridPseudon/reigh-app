# Remaining Structural Areas (Long Tail)

**Impact**: ~100 findings across ~25 areas, each <20 weighted points.
**Effort**: 1-2 days for all combined. Most are independent, can be parallelized.

## Areas by Weight

### 1. `src/tools/training-data-helper` (4 findings, 25w)

| File | Issue | Fix |
|------|-------|-----|
| `BatchSelector.tsx` (619 LOC, T4) | 11 hooks, 11 useStates, mixed concerns | Extract `useBatchSelectorState` (the 11 useStates → reducer). Extract `useBatchSelectorActions` (5 handlers). |
| `useTrainingData.ts` (717 LOC) | Large hook | Extract data transformation helpers. |
| `VideoPlayerControls.tsx` | 29 props | Group into `PlaybackProps`, `SegmentProps`, `ActionProps` |
| `SegmentFormDialog.tsx` | 16 props | Borderline — leave |

### 2. `src/app` (6 findings, 18w)

Likely routing/layout components. Check:
```bash
python3 -m scripts.decruftify show "src/app" --status wontfix --top 10
```

### 3. `src/shared/components/MediaGalleryItem` (6 findings, 18w)

Gallery item with variant display, hover state, selection. All T3 props/structural.

### 4. `src/shared/components/VariantSelector` (4 findings, 12w)

Large index + sub-components. Extract variant comparison logic into hook.

### 5. `src/shared/components/LoraSelectorModal` (4 findings, 12w)

Modal + types. Extract lora search/filtering into `useLoraSearch` hook.

### 6. `src/tools/edit-images` (5 findings, 19w)

`EditImagesPage` + `InlineEditView`. Already a known refactoring target.

### 7. `src/tools/edit-video` (4 findings, 16w)

`InlineEditVideoView` + page. Already a known refactoring target.

### 8. `src/tools/join-clips` (4 findings, 14w)

`useClipManager` + page. Extract clip ordering/sequencing logic.

### 9. `src/shared/lib` (9 findings, 25w)

Mostly `imageGeneration.ts` with duplicate task creation patterns. Extract shared task parameter construction.

### 10. `src/shared/contexts` (4 findings, 14w)

`ProjectContext` is large. Extract project data fetching into a separate hook.

## Strategy

These are all independent — pick any area and decompose. Many are borderline (just over 500 LOC or 10 props). After the major area decompositions (travel, lightbox, ImageGenerationForm), rescan first — many of these may auto-resolve as cascading effects.

## Batch Approach for Sub-Agents

For each area above, a sub-agent should:
1. Read all files in the area
2. Read the structural findings (`decruftify show <area> --status wontfix`)
3. Identify the decomposition strategy
4. Implement the changes
5. Run `npx tsc --noEmit` to verify
6. Report what was done

## Verification

```bash
npx tsc --noEmit
python3 -m scripts.decruftify scan --path src/
python3 -m scripts.decruftify status
```
