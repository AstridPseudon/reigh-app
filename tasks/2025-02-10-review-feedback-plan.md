# Review Feedback Action Plan

Compiled from 4 review agents: functional regressions, skip decisions, structural cleanliness, counterproductive decompositions.

## Master Checklist

- [ ] 1. Move `projectSettingsInheritance.ts` to `shared/lib/` (quick win)
- [ ] 2. Rename `toolRoutes.ts` → `toolConstants.ts` + update importers (quick win)
- [ ] 3. Consolidate duplicate `LoraHeaderActions` + fix hardcoded colors
- [ ] 4. Complete TOOL_IDS migration in remaining ~40 files
- [ ] 5. Decompose `useTimelineOrchestrator.ts` (801 LOC → ~610 LOC)
- [ ] 6. Extract `MotionControl.tsx` auto-select effect + `SelectedPresetCard`

---

## 1. Move `projectSettingsInheritance.ts` (quick win)

**Why**: Contains 3 pure utility functions (no React context, no hooks). Lives in `shared/contexts/` but should be in `shared/lib/`.

**Action**:
- Move `src/shared/contexts/projectSettingsInheritance.ts` → `src/shared/lib/projectSettingsInheritance.ts`
- Update import in `src/shared/contexts/ProjectContext.tsx` (sole consumer)

---

## 2. Rename `toolRoutes.ts` → `toolConstants.ts` (quick win)

**Why**: Primary export is `TOOL_IDS` (~20 importers), not `TOOL_ROUTES` (~7 importers). Current name undersells scope.

**Action**:
- Rename `src/shared/lib/toolRoutes.ts` → `src/shared/lib/toolConstants.ts`
- Update all ~27 import paths across codebase

---

## 3. Consolidate duplicate `LoraHeaderActions`

**Why**: Two nearly-identical components exist:
- `src/shared/components/LoraHeaderActions.tsx` (extracted from `useLoraManager`)
- `src/tools/travel-between-images/components/ShotEditor/ui/LoraHeaderActions.tsx` (extracted from `useLoraSync`)

They differ slightly: shared version takes `savedLorasContent: string`; travel version takes `savedLoras?: Array<{id, strength}>` and formats the string itself.

**Action**:
- Unify into one component in `src/shared/components/LoraHeaderActions.tsx`
- Accept either `savedLorasContent` or `savedLoras` (compute content string internally when raw array provided)
- Update `useLoraSync.tsx` to import from shared
- Delete `tools/travel-between-images/components/ShotEditor/ui/LoraHeaderActions.tsx`
- While here: replace hardcoded `bg-green-*`/`text-white` with semantic color tokens

---

## 4. Complete TOOL_IDS migration

**Why**: We added `TOOL_IDS` and migrated ~20 shared/ files, but ~40+ hardcoded tool ID strings remain in `tools/` directories and `routes.tsx`.

**Key targets** (highest value first):
- `src/app/routes.tsx` — hardcoded route paths on ~9 lines
- `src/tools/index.ts` line 98 — `id: 'edit-images' // Hardcoded to avoid import issues` (has a comment acknowledging it)
- `src/tools/index.ts` lines 52-112 — all `path:` values in `toolsUIManifest`
- Each tool's `settings.ts` — `id: 'tool-name'` should use `TOOL_IDS.*`
- Each tool's page file — `const TOOL_TYPE = 'tool-name'` should use `TOOL_IDS.*`
- Each tool's hooks — scattered hardcoded strings

**Files to sweep** (grouped by tool):
- `travel-between-images/`: settings.ts, useShotSettings.ts, useVideoTravelData.ts, Timeline.tsx, BatchModeContent.tsx, VideoTravelVideosGallery.tsx, useJoinSegmentsHandler.ts, Header.tsx, useVideoItemJoinClips.ts, useHashDeepLink.ts, SharedGenerationView.tsx
- `image-generation/`: settings.ts, useImageGenGallery.ts, ImageGenerationToolPage.tsx
- `edit-video/`: EditVideoPage.tsx, VideoReplaceMode.tsx
- `join-clips/`: JoinClipsPage.tsx, useJoinClipsGenerate.ts, useJoinClipsSettings.ts
- `character-animate/`: CharacterAnimatePage.tsx, useCharacterAnimateSettings.ts, settings.ts
- `edit-images/`: EditImagesPage.tsx, settings.ts
- `app/`: routes.tsx
- `tools/`: index.ts (both IDs and paths)

---

## 5. Decompose `useTimelineOrchestrator.ts` (801 LOC)

**Why**: Lazy skip identified by review. Hook manages timeline segment orchestration with 3 extractable responsibilities.

**Action** — extract 3 focused hooks (~190 LOC total):

### 5a. `useEndpointDrag` (~60 LOC)
- Endpoint drag-and-drop logic (handles start/end image replacement via drag)
- Self-contained state: drag target, drop validation, completion handler

### 5b. `useTapToMove` (~60 LOC)
- Tap-to-reorder segment logic (tap source, tap destination, execute move)
- Self-contained state: tap mode active, selected source, animation

### 5c. `useComputedTimelineData` (~70 LOC)
- Derived data from segments: merged pairs, slot positions, gap calculations
- Pure computation from inputs, no side effects
- Used by the remaining orchestrator + Timeline component

Leave the remaining ~610 LOC in `useTimelineOrchestrator` as the coordination layer that wires these sub-hooks together.

---

## 6. Extract `MotionControl.tsx` auto-select effect

**Why**: Borderline skip. The auto-select preset effect is a self-contained behavior with its own dependency management.

**Action**:
- Extract the auto-select `useEffect` into `usePresetAutoSelect` hook (co-located in same directory)
- Move `SelectedPresetCard` inline component to its own file `SelectedPresetCard.tsx`
- This reduces `MotionControl.tsx` by ~100 LOC and separates preset logic from motion UI

---

## Items NOT actioned (with justification)

| Item | Reason |
|------|--------|
| `useSegmentOutputStrip.ts` (568 LOC) | Just extracted this session. Further decomposition risks over-splitting a cohesive stateful hook. Revisit if it grows. |
| `useAutoSaveSettings` skip | State machine with shared refs — splitting would require passing refs between hooks, adding complexity. |
| `useTrainingDataHelper` skip | 370 LOC after extraction, below threshold. Single-purpose hook. |
| `useGalleryFilterState` skip | 280 LOC, cohesive filter state machine. Below threshold. |
| `useTimelineCore` skip | 287 LOC, tight coupling between state and handlers. Below threshold. |
| Revert any decompositions | All reviewed, none counterproductive. |
