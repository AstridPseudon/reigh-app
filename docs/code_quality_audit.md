# Code Quality Audit

Present state of the codebase. Last updated: 2026-02-02.

---

## Summary

| Category | Status | Verdict |
|----------|--------|---------|
| Double-casts | ✅ None | All fixed |
| Cache/error handling | ✅ Good | Centralized patterns |
| Hardcoded colors | ✅ Intentional | Brand/retro theme, not bugs |
| Page hook counts | ✅ Appropriate | Complex orchestration, not a problem |
| Large components | ⚠️ 4 files | Worth decomposing when touched |
| Large hooks | ⚠️ 8 files | Split candidates identified |
| `any` usage | ⚠️ ~1,900 | Mix of fixable and intentional |

---

## What's Actually Fine

### Hardcoded Colors (181 instances)
**Verdict: Leave as-is.** These are intentional brand colors for the retro/vintage aesthetic.

- `GlobalHeader.tsx` (40): Retro dark palette (`#6a8a8a`, `#3a4a4a`, etc.) - forms cohesive system
- `HeroSection.tsx` (23): Marketing landing page - performance-critical, uses inline styles intentionally
- `select.tsx` (11): CVA component variants - part of retro UI system

If the retro palette becomes system-wide, extract to CSS variables. Not urgent.

### Page Hook Counts
**Verdict: Appropriate complexity.**

| Page | Hooks | Assessment |
|------|-------|------------|
| `VideoTravelToolPage` | 12 | ✅ Clean router/orchestrator |
| `JoinClipsPage` | 18 | ✅ Well-factored, justified by video editor complexity |
| `ImageGenerationToolPage` | 25+ | ⚠️ Could extract 3 utility hooks for readability |

The hook counts reflect legitimate feature complexity (gallery + form + filtering + pagination). Not a performance issue.

**Optional cleanup for ImageGenerationToolPage:**
- Extract `useStickyHeaderPosition()` (~60 lines)
- Extract `useGalleryFiltering()` (9 filter state vars)
- Extract `useAdjacentPagePrefetch()` (~100 lines)

### SimpleRealtimeManager.ts (39 `any`)
**Verdict: Leave as-is.** The `any` types here are justified:

- TypeScript types are compile-time only; Supabase websocket payloads need runtime validation for real safety
- Handlers already use defensive `payload?.new?.id` optional chaining
- Supabase's `old` record is unreliable (partial data) — types would give false confidence
- The channel `.on()` API doesn't type cleanly anyway

Type this file only if actively debugging realtime issues or making significant changes.

---

## What Needs Attention

### 1. `any` Usage (~1,900 instances)

**Medium effort (20-30 hours):**

| File | Count | Issue | Fix |
|------|-------|-------|-----|
| `useLightboxLayoutProps.ts` | 41 | Props aggregation hook | Create domain interfaces (video editing, annotation, transform) |
| `useSegmentOutputsForShot.ts` | 26 | Defensive casts for `parent_generation_id` | Extend `GenerationRow` with optional parent/child fields |
| `VideoGallery/index.tsx` | 26 | Generic type constraints | Extract hook return types, define `VideoItemData` |

**Leave alone:**
- `Record<string, any>` for dynamic settings objects is intentional
- `SimpleRealtimeManager.ts` — defensive coding approach is correct (see above)

### 2. Large Hooks (>800 lines)

| Hook | Lines | Split Strategy |
|------|-------|----------------|
| `useGenerationActions.ts` | 906 | Extract deletion, duplication, drop handlers into separate hooks |
| `useGenerations.ts` | ~920 | Extract filter logic, edit variants, star toggle |
| `useShotGenerationMutations.ts` | 925 | Extract frame position calculator, batch updater |
| `useReferenceManagement.ts` | 909 | Extract upload pipeline, mode switching, sync effects |

**Dead code to investigate:**
- `useGenerationActions.ts` lines 71-120: 50-line ref stabilization block suggests parent component issues

### 3. Large Components (1000-1700 lines)

| Component | Lines | Decomposition Strategy | Effort |
|-----------|-------|------------------------|--------|
| `MediaGalleryItem.tsx` | 1,696 | Extract `useImageLoader`, `ShotAddButton`, `ProgressiveImage` | 40-60h |
| `VideoItem.tsx` | 1,504 | Extract `JoinClipsModal`, `useMobileVideoPreload`, `ShareButton` | 35-50h |
| `SettingsModal.tsx` | 1,320 | Extract `InstallTab`, `RunTab`, `ConfigOptions`, command generators | 25-35h |
| `VideoGallery/index.tsx` | 1,202 | Extract pagination, skeleton, navigation hooks | 30-40h |

**Recommended order:** SettingsModal → VideoItem → VideoGallery → MediaGalleryItem (least tangled first)

---

## Established Patterns

| Area | Location | Pattern |
|------|----------|---------|
| Hook decomposition | `src/shared/hooks/shots/` | 10 focused files from monolith |
| Component decomposition | `ShotImagesEditor/` | 32 line index + 13 files |
| Context for state | `ImageGenerationFormContext` | Eliminates prop drilling |
| Cache keys | `src/shared/lib/queryKeys.ts` | Centralized registry |
| Error handling | `src/shared/lib/errorHandler.ts` | `handleError()` with context |
| Lightbox architecture | `MediaLightbox/` | Shell + orchestrators + contexts |

---

## Action Items

### Next Up
1. Decompose `SettingsModal.tsx` - extract Install/Run tabs and command generators

### When Touched
2. Split large hooks when modifying them
3. Decompose large components when adding features to them
4. Type `any`-heavy files when working in that area

---

## Recent Refactors

| Before | After |
|--------|-------|
| `ShotImagesEditor.tsx` (3,775 lines) | 32 line index |
| `MediaLightbox.tsx` (2,617 lines) | 189 line shell |
| `PhaseConfigSelectorModal.tsx` (1,973 lines) | 287 lines |
| `GuidanceVideoStrip.tsx` (1,456 lines) | 683 lines |
| `ImageGenerationForm/index.tsx` (1,164 lines) | 52 lines |
| `useGenerationActions.ts` (1,222 lines) | 906 lines |
| Double-casts (8 files) | 0 files |
| `SharedMetadataDetails.tsx` (28 `as any`) | 0 casts (interface extended) |
| `useGenerations.ts` dead code | Removed `shouldSkipCount` branches |
