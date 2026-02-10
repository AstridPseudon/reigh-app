# Shared Components (Top-Level): Structural Decomposition

**Impact**: 28 findings (T3:25, T4:3), 87 weighted points. Excludes MediaLightbox, ShotImageManager, ImageGenerationForm (covered separately).
**Effort**: 2-3 days. Independent extractions — each file can be tackled alone.

## T4 Files (decomposition required)

### 1. `ImageGenerationForm.tsx` (902 LOC, complexity:23, 16 hooks)
- **Concerns**: jsx_rendering, data_fetching, data_transforms(3)
- **This is the main form orchestrator**. At complexity:23 it's the most complex single file in shared/.
- **Fix**: Extract `useImageGenFormState` (the 9 useState calls), extract `useImageGenEffects` (the 5 useEffects), and split the JSX into form sections (PromptSection, ReferenceSection, SettingsSection, SubmitSection).
- **Covered in detail**: See separate ImageGenerationForm section below.

### 2. `PhaseConfigVertical.tsx` (678 LOC, 16 props, complexity:6)
- **Internal dupe**: `newPhases` computed in two similar branches (94% match) — these are phase transition branches (2→3 vs 3→2), not true duplication.
- **Fix**: Extract phase transition logic into `usePhaseTransitions` hook. Extract preset management into `usePhasePresets`.

### 3. `GlobalHeader.tsx` — large + structural
- **Fix**: Extract navigation logic and theme management into hooks.

## T3 Files (large or bloated props)

| File | LOC | Props | Signals | Fix |
|------|-----|-------|---------|-----|
| `InlineSegmentVideo.tsx` | ~600 | ~15 | large, props, structural | Extract video player state into hook |
| `PromptEditorModal.tsx` | ~580 | - | large, structural | Extract prompt history/autocomplete into hooks |
| `DatasetBrowserModal.tsx` | ~550 | - | large, structural | Extract dataset filtering/search into hook |
| `segmentSettingsUtils.ts` | ~500 | - | large, structural | Split into segment validation + defaults |
| `PhaseConfigSelectorModal/` | 9 findings | - | Two large tab components | Extract tab content into focused components |
| `TasksPane/` | 6 findings | - | TaskItem + TasksPane both T4-adjacent | Extract task rendering into sub-components |

## ImageGenerationForm Subsystem (14 findings, 43w)

This is a self-contained subsystem with its own hooks directory:

| File | LOC | Props | Priority |
|------|-----|-------|----------|
| `ImageGenerationForm.tsx` | 902 | T4 | High — orchestrator |
| `useReferenceManagement.ts` | 882 | 15 | High — largest hook |
| `useFormSubmission.ts` | 508 | 26 | Medium |
| `useLegacyMigrations.ts` | 402 | 11 | Low — migration code |
| `usePromptManagement.ts` | - | 16 | Low — reasonable size |
| `types.ts` | - | PromptInputRowProps:16 | Low |
| Various reference components | - | 11 each | Low |

**Strategy for ImageGenerationForm**:
1. **useReferenceManagement** (882 LOC): Split into `useReferenceUpload`, `useReferenceSelection`, `useReferenceValidation`
2. **ImageGenerationForm** (902 LOC): Extract state + effects into hooks, split JSX into sections
3. **useFormSubmission** (508 LOC): Moderate size, cohesive. Could extract validation into `useFormValidation`.
4. **useLegacyMigrations**: Leave as-is. Migration code is inherently ugly and temporary.

## ShotImageManager Subsystem (17 findings, 53w)

| File | Findings | Notes |
|------|----------|-------|
| `types.ts` | 3 props findings (46, 29, 16 props) | Group into sub-interfaces |
| `EmptyState.tsx` | 7 dupe findings | Drag handlers — short, local. Wontfix is correct. |
| Desktop/Mobile components | 7 remaining | Props cascade from types.ts grouping |

**Strategy**: Group `ShotImageManagerProps` (46 props) into `ShotDragProps`, `ShotUploadProps`, `ShotStructureProps`, `ShotManagementProps`. This cascades to reduce BaseShotImageManagerProps and downstream.

## Remaining Components

### PhaseConfigSelectorModal (9 findings, 28w)
- `AddNewPresetTab.tsx` and `BrowsePresetsTab.tsx` are both large
- Standard modal tab decomposition — extract tab content into focused components

### TasksPane (6 findings, 20w)
- `TaskItem.tsx` and `TasksPane.tsx` both large + T4-adjacent
- Extract: task progress rendering, task action buttons, task status display into sub-components

### MediaGallery (6 findings, 19w)
- Covered by existing major refactoring target

### VariantSelector (4 findings, 12w)
- Large index + sub-components. Extract variant comparison logic.

### LoraSelectorModal (4 findings, 12w)
- Types + modal. Extract lora search/filtering into hook.

## Execution Order

1. **Prop interface grouping** (ShotImageManager types, lightbox types) — cascading effect
2. **ImageGenerationForm decomposition** — highest complexity score
3. **PhaseConfigVertical** — extract phase transitions
4. **Remaining large components** — one at a time, in weight order

## Verification

```bash
npx tsc --noEmit
python3 -m scripts.decruftify scan --path src/
python3 -m scripts.decruftify show "src/shared/components" --status wontfix --top 30
```
