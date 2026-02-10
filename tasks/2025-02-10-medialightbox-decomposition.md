# MediaLightbox: Structural Decomposition

**Impact**: 50 structural findings (T3:48, T4:2), 152 weighted points. Second-largest area.
**Effort**: Days. The lightbox is complex — image editing, video editing, variant management, keyboard shortcuts.

## Overview

The MediaLightbox has grown into a complex component system with ~15 hooks and 2 large entry points (ImageLightbox at 1186 LOC, VideoLightbox at 963 LOC). The shared state hook (`useSharedLightboxState`) has 52 input props — it's the central data aggregator.

## T4 Files (decomposition required)

### 1. `ImageLightbox.tsx` (1186 LOC, 11 hooks, 45 props)
- **Concerns**: jsx_rendering, data_transforms(3), handlers(8)
- **Fix strategy**:
  1. Extract `useImageLightboxKeyboard` — keyboard shortcut handlers (arrow keys, escape, shortcuts)
  2. Extract `useImageEditActions` — the edit mode state machine (reposition, inpaint, annotate)
  3. Extract variant management useEffect block into `useVariantSelection`
  4. Split JSX into `LightboxHeader`, `LightboxContent`, `LightboxFooter` sub-components
- **Finding**: `structural::src/shared/components/MediaLightbox/ImageLightbox.tsx`

### 2. `VideoLightbox.tsx` (963 LOC, 8 hooks, 46 props)
- **Fix strategy**: Similar to ImageLightbox:
  1. Extract keyboard handlers into `useVideoLightboxKeyboard`
  2. Extract video-specific edit actions (trim, enhance, regenerate) into `useVideoEditActions`
  3. The trim/enhance/regenerate mode panels are already separate components (good)
- **Finding**: `structural::src/shared/components/MediaLightbox/VideoLightbox.tsx`

## High-Weight T3 Files

### 3. `useSharedLightboxState.ts` (675 LOC, 52 props interface)
- **The central problem**: This hook takes 52 inputs and computes shared state. It's the orchestrator.
- **Fix**: Group the 52 inputs into sub-interfaces: `LightboxMediaProps`, `LightboxEditProps`, `LightboxNavigationProps`, `LightboxVariantProps`. This reduces the visual surface without changing logic.

### 4. `EditModePanel.tsx` (866 LOC, 42 props, complexity:11)
- **Fix**: Extract each edit mode (inpaint, annotate, reposition) into separate panel components. The 42 props can be grouped by mode since each mode only uses a subset.

### 5. `SegmentRegenerateForm.tsx` (483 LOC, 31 props)
- **Dupes**: `structureVideoForTask` and `handleSubmit` are near-duplicated with `SegmentSlotFormView`
- **Fix**: Extract shared task preparation logic into a `useSegmentTaskPrep` hook used by both forms

### 6. `MediaDisplayWithCanvas.tsx` — props bloat from canvas overlay system

## Prop Bloat Pattern

The prop counts cascade from the top:
```
ImageLightbox (45 props)
  → ControlsPanel (35+ props)
    → EditModePanel (42 props)
      → InpaintPanel / AnnotatePanel / RepositionPanel
```

**Strategy**: Same as travel — create grouped sub-interfaces at the top, cascade through. The edit mode panels only need `editModeProps` not the full 42 individual props.

## Near-Duplicate Drag Handlers

`EmptyState.tsx` has 7 duplicate findings — drag/drop handlers duplicated between ShotImageManager and Timeline. These are short (~10 lines) and tightly coupled to local state. The wontfix notes say "abstracting adds more complexity than duplication." This is correct — leave as-is or extract a minimal `useDropZoneState` hook that handles the `isDragOver`/`dragType` state machine.

## Execution Order

1. **Group prop interfaces** (reduces ~20 findings across all files)
2. **Decompose ImageLightbox** (extract 3 hooks + split JSX)
3. **Decompose VideoLightbox** (extract 2 hooks)
4. **Decompose EditModePanel** (split by edit mode)
5. **Extract shared segment task prep** (deduplicates SegmentRegenerateForm/SegmentSlotFormView)
6. **Review remaining** (many will auto-resolve)

## Verification

```bash
npx tsc --noEmit
python3 -m scripts.decruftify scan --path src/
python3 -m scripts.decruftify show "src/shared/components/MediaLightbox" --status wontfix --top 30
```
