# Code Quality Audit: From Functional to Beautiful

This document catalogs patterns, inconsistencies, and areas preventing the codebase from being truly excellent. Issues are organized by severity and area.

---

## Table of Contents
1. [High Severity: Structural Issues](#high-severity-structural-issues)
2. [High Severity: Type Safety](#high-severity-type-safety)
3. [Medium Severity: Consistency Issues](#medium-severity-consistency-issues)
4. [Low Severity: Style & Polish](#low-severity-style--polish)
5. [Summary Table](#summary-table)
6. [Prioritized Recommendations](#prioritized-recommendations)

---

## High Severity: Structural Issues

### 1. Oversized Hooks (Single Responsibility Violation)

The hook layer contains monolithic files combining multiple concerns:

| File | Lines | Problem | Status |
|------|-------|---------|--------|
| `src/shared/hooks/useShots.ts` | ~~2,350~~ | ~~Shot CRUD, cache management, transformations all mixed~~ | ✅ **REFACTORED** → `src/shared/hooks/shots/` |
| `src/shared/hooks/useSegmentSettings.ts` | 1,160 | Settings logic intertwined with UI concerns | ❌ Pending |
| `src/shared/hooks/useGenerations.ts` | 942 | Generation queries, mutations, selectors combined | ❌ Pending (reduced from 1,353) |
| `src/shared/hooks/shots/useShotGenerationMutations.ts` | 924 | Shot generation mutations | ❌ Pending (part of shots refactor) |
| `src/shared/hooks/useUnifiedGenerations.ts` | 870 | Another generation approach alongside existing ones | ❌ Pending |
| `src/shared/hooks/useGenerationsPageLogic.ts` | 865 | Page-specific logic in shared hooks | ❌ Pending |
| `src/shared/hooks/useTimelinePositionUtils.ts` | 855 | Position calculations mixed with state | ❌ Pending |
| `src/shared/hooks/useToolSettings.ts` | 772 | Three scopes of settings in one file | ⚠️ Borderline (under 800) |

**Borderline hooks (600-800 lines):**
- `useTasks.ts` (733 lines)
- `useTimelineCore.ts` (667 lines)
- `useAutoSaveSettings.ts` (634 lines)

**Impact:** Hard to test in isolation, difficult to understand, high cognitive load.

**Completed refactor example (`useShots.ts` → `src/shared/hooks/shots/`):**
```
src/shared/hooks/shots/
  index.ts              # Barrel file (re-exports all)
  cacheUtils.ts         # Cache key management
  debug.ts              # Debug logging utility
  mappers.ts            # Data transformation mappers
  useShotsCrud.ts       # Create, duplicate, delete, reorder
  useShotsQueries.ts    # List shots, project stats
  useShotUpdates.ts     # Update shot fields (name, aspect ratio)
  useShotGenerations.ts # Add, remove, reorder images in shots
  useShotCreation.ts    # Composite creation workflows
```

---

### 2. Giant Components (>1000 Lines)

**Critical (>2000 lines):**

| File | Lines | Core Problem | Status |
|------|-------|--------------|--------|
| `src/tools/travel-between-images/components/ShotImagesEditor.tsx` | 3,775 | Massive editor combining many concerns | ❌ **CRITICAL** |
| `src/tools/image-generation/components/ImageGenerationForm/index.tsx` | 3,081 | Form + validation + previews combined | ❌ **CRITICAL** |
| `src/tools/travel-between-images/components/ShotEditor/index.tsx` | 3,034 | Full editor in single component | ❌ **CRITICAL** |
| `src/tools/travel-between-images/components/Timeline/TimelineContainer.tsx` | 2,241 | Timeline container + interactions | ❌ **CRITICAL** |

**Oversized (1000-2000 lines):**

| File | Lines | Core Problem | Status |
|------|-------|--------------|--------|
| `src/shared/components/MediaLightbox/MediaLightbox.tsx` | ~~2,617~~ 189 | ~~Gallery, navigation, actions, keyboard handling~~ | ✅ **REFACTORED** |
| `src/shared/components/PhaseConfigSelectorModal/PhaseConfigSelectorModal.tsx` | 1,973 | Modal + form + validation + preview | ❌ Pending |
| `src/tools/travel-between-images/pages/VideoTravelToolPage.tsx` | 1,852 | Full page in single component | ❌ Pending |
| `src/tools/join-clips/pages/JoinClipsPage.tsx` | 1,833 | Full page in single component | ❌ Pending |
| `src/shared/components/MediaGalleryItem.tsx` | 1,700 | Rendering + interaction + context menu + drag/drop | ❌ Pending |
| `src/shared/components/SegmentSettingsForm.tsx` | 1,570 | Form + validation + dependent field logic | ❌ Pending |
| `src/tools/travel-between-images/components/VideoGallery/components/VideoItem.tsx` | 1,532 | Video item rendering + interactions | ❌ Pending |
| `src/tools/travel-between-images/components/Timeline/GuidanceVideoStrip.tsx` | 1,456 | Video strip + thumbnails + timing | ❌ Pending |
| `src/shared/components/SettingsModal.tsx` | 1,320 | Modal shell + multiple settings tabs | ❌ Pending |
| `src/tools/travel-between-images/components/Timeline.tsx` | 1,226 | Timeline + segments + markers + interactions | ❌ Pending |
| `src/tools/travel-between-images/components/VideoGallery/index.tsx` | 1,201 | Gallery + filtering + selection + actions | ❌ Pending |
| `src/tools/image-generation/pages/ImageGenerationToolPage.tsx` | 1,167 | Full page in single component | ❌ Pending |

**Total: 15 components >1000 lines (4 critical >2000 lines)**

**Impact:** Multiple concerns entangled, hard to test, reuse, or modify safely.

**Completed refactor example (`MediaLightbox/`):**
```
src/shared/components/MediaLightbox/
  MediaLightbox.tsx         # Shell component (189 lines)
  index.tsx                 # Barrel file
  types.ts                  # Shared types
  contexts/                 # LightboxStateContext, LightboxVariantContext
  components/               # 40+ modular UI components
    layouts/                # Desktop/mobile layouts, overlays
    controls/               # Brush, annotation, position controls
  hooks/                    # 30+ focused hooks (navigation, editing, etc.)
    inpainting/             # Inpainting-specific hooks
  utils/                    # Download utilities
```

---

### 3. Cache Invalidation Complexity

**Status:** ✅ **COMPLETE** — Centralized query key registry + domain invalidation hooks

**Implemented:**
- `src/shared/lib/queryKeys.ts` — Central registry for all 38 query key patterns with TypeScript autocomplete
- `src/shared/hooks/invalidation/` — Domain-specific invalidation hooks:
  - `useGenerationInvalidation.ts` — Generations, variants, unified queries
  - `useShotInvalidation.ts` — Shot lists, details, positions
  - `useTaskInvalidation.ts` — Tasks, counts, mappings
  - `useSettingsInvalidation.ts` — Tool, segment, user settings

**Results:**
- 327 → 199 inline query key usages (-39%)
- Type-safe key construction with autocomplete
- Consistent invalidation patterns across codebase

**Pattern:**
```typescript
import { queryKeys } from '@/shared/lib/queryKeys';

// In useQuery
useQuery({
  queryKey: queryKeys.generations.byShot(shotId),
  queryFn: fetchGenerations,
});

// In invalidation
queryClient.invalidateQueries({ queryKey: queryKeys.generations.byShot(shotId) });
```

---

### 4. Excessive Console Logging in Production Code

**Status:** ✅ **MITIGATED** — Production builds are safe

The logger system (`src/shared/lib/logger.ts`) intercepts and suppresses `console.log/warn/info/debug` when `VITE_DEBUG_LOGS` is unset (production default). Only `console.error` remains active.

**Current state:**
- 4,011 console logging statements across 339 files
- Most use tagged debug format (e.g., `[SegmentSaveDebug]`, `[DataTrace]`)
- Security audit: CLEAN — no sensitive data (tokens, keys) logged

**Debug config system** (`src/shared/lib/debugConfig.ts`):
- 15 granular env flags control debug categories
- Runtime API at `window.debugConfig` for toggling

**Gradual improvement:** Migrate high-frequency debug tags to structured logger:
- `[ApplySettings]` (104 uses)
- `[EDIT_DEBUG]` (75 uses)
- `[ShotNavPerf]` (40 uses)

---

### 5. Inconsistent Error Handling

**Status:** ✅ **COMPLETE** — Codebase migrated to centralized `handleError()`

**Implemented:**
- Migrated 107 files from scattered `console.error`/`toast.error` to `handleError()`
- Removed 228 `console.error` calls, 80 `toast.error` calls
- Added 348 structured `handleError()` calls with context

**Pattern applied consistently:**
```typescript
import { handleError } from '@/shared/lib/errorHandler';

// Internal errors (no user notification)
handleError(error, { context: 'AuthStateManager', showToast: false });

// User-facing errors (with toast)
handleError(error, { context: 'useCredits', toastTitle: 'Failed to save' });
```

**Infrastructure (unchanged):**
- `AppError` + typed subclasses (`NetworkError`, `AuthError`, `ValidationError`, `ServerError`, `SilentError`)
- `handleError()` with auto-categorization, context logging, toast support
- 2 error boundaries (app-level + dynamic import)

---

## High Severity: Type Safety

### 6. Excessive `any` Usage

**Current state:** 1,316 occurrences across 242 files

**Top offenders by count:**
| File | `any` count |
|------|-------------|
| `ShotImagesEditor.tsx` | 65 |
| `useLightboxLayoutProps.ts` | 40 |
| `useUnifiedGenerations.ts` | 22 |
| `ShotEditor/index.tsx` | 21 |
| `MediaGalleryItem.tsx` | 19 |
| `useQueryDebugLogging.ts` | 17 |
| `useToolSettings.ts` | 16 |
| `VideoLightbox.tsx` | 14 |

**Common patterns:**
```typescript
// useToolSettings.ts
function deepMerge(target: any, ...sources: any[]): any {
  // Should use generics
}

// useToolSettings.ts
const mapDbProjectToProject = (row: any): Project => {
  // Should type the database row
}

// useQuickShotCreate.ts
onSuccess: (data: any) => {
  // Should type the mutation response
}
```

**Fix:** Use proper generics and database types:
```typescript
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  // ...
}

// Import from generated types
import type { Database } from '@/integrations/supabase/types';
type ProjectRow = Database['public']['Tables']['projects']['Row'];
const mapDbProjectToProject = (row: ProjectRow): Project => {
  // ...
}
```

---

### 7. Double Type Casts (Anti-pattern)

**Current state:** 15 occurrences across 7 files

Double casts (`as unknown as X`) are a code smell indicating type system fights:

| File | Count |
|------|-------|
| `ImageGenerationToolPage.tsx` | 4 |
| `useStickyHeader.ts` | 4 |
| `TaskItemActions.tsx` | 3 |
| `useReferralTracking.ts` | 1 |
| `useUserUIState.ts` | 1 |
| `select.tsx` | 1 |
| `VideoGallery/index.tsx` | 1 |

**Examples:**
```typescript
// ImageGenerationToolPage.tsx (appears 4 times!)
rafId as unknown as number

// VideoGallery/index.tsx
onDelete as unknown as (id: string) => Promise<void>

// select.tsx
container as unknown as HTMLElement
```

**Impact:** Bypasses type safety entirely, hides mismatched interfaces.

**Fix:** Fix the underlying type mismatch:
```typescript
// Instead of: rafId as unknown as number
// Fix: ensure rafId is typed correctly from requestAnimationFrame
const rafId: number = requestAnimationFrame(callback);

// Instead of: onDelete as unknown as (id: string) => Promise<void>
// Fix: align the prop types in the component interface
interface Props {
  onDelete: (id: string) => Promise<void>;
}
```

---

### 8. Type Ignores Without Justification

```typescript
// ToolPageHeaderContext.tsx
// @ts-ignore
const value = someOperation();

// useStarToggle.ts
// @ts-ignore – media may include starred
const starred = media.starred;
```

**Fix:** Either fix the type issue or document why the ignore is necessary:
```typescript
// @ts-expect-error - React Query v4 types don't include this field,
// but it exists at runtime. Fixed in v5: https://github.com/...
const starred = media.starred;
```

---

## Medium Severity: Consistency Issues

### 9. Naming Inconsistencies

**Hook naming:**
- `useToolSettings` vs `useShotSettings` vs `useSegmentSettings` - Unclear relationship hierarchy
- Are these composable? Does one use another?

**Function naming:**
- `mapShotGenerationToRow` - Maps TO a database row
- `mapDbTaskToTask` - Maps FROM a database row
- `mapDbProjectToProject` - Maps FROM a database row
- Inconsistent direction in naming convention

**Selector naming:**
- `selectGenerations` vs `filterVisibleTasks` vs `getActiveTasks`
- No clear convention: `select*` vs `filter*` vs `get*`

**Fix:** Establish and document conventions:
```typescript
// Convention: map{Source}To{Target}
mapRowToShotGeneration()  // DB row -> Domain object
mapShotGenerationToRow()  // Domain object -> DB row

// Convention: use* for hooks, get* for sync getters, select* for selectors
useGenerations()           // Hook
getGenerationById()        // Sync getter (pure function)
selectVisibleGenerations() // Selector (for memoization)
```

---

### 10. Mixed State Management Approaches

No clear decision matrix for when to use each approach:

| Approach | Used For | Problem |
|----------|----------|---------|
| `useState` | Local component state | Sometimes used for server-derived state |
| React Query | Server state | Sometimes mixed with local state |
| Context | Shared state | Sometimes duplicates React Query cache |
| localStorage | Persistence | No clear policy on what persists |
| Refs | Instance values | Sometimes used to avoid re-renders that should happen |

**Fix:** Document a decision matrix in `structure.md`:
```markdown
## State Management Decision Matrix

| Data Type | Approach | Example |
|-----------|----------|---------|
| Server data | React Query | Shots, generations, tasks |
| Form state (in progress) | useState or react-hook-form | Form inputs before submit |
| UI state (ephemeral) | useState | Modal open/closed, tab selection |
| UI state (shared) | Context | Current tool, selected shot |
| User preferences | React Query + localStorage sync | Theme, sidebar collapsed |
```

---

### 11. Duplicate Data Transformers

Multiple functions do similar transformations:

| Function | Location | Purpose |
|----------|----------|---------|
| `mapShotGenerationToRow` | useShots.ts:99-138 | Shot generation -> DB row format |
| `transformForUnifiedGenerations` | generationTransformers.ts | Generation -> Unified format |
| `transformForTimeline` | generationTransformers.ts | Generation -> Timeline format |
| `transformGeneration` | generationTransformers.ts | Generic transformation |

**Questions:**
- When should each be used?
- Do they produce consistent results?
- Why do we need multiple formats?

**Fix:** Consolidate into a single transformation layer:
```typescript
// src/shared/lib/generationTransformers.ts
export const generationTransformers = {
  // Single source of truth for generation shapes
  toRow: (gen: Generation): GenerationRow => { ... },
  fromRow: (row: GenerationRow): Generation => { ... },
  toTimelineItem: (gen: Generation): TimelineItem => { ... },
  toUnifiedFormat: (gen: Generation): UnifiedGeneration => { ... },
} as const;
```

---

### 12. Deep Import Chains

Relative imports spanning 4+ levels:

```typescript
// VideoShotDisplay.tsx
import { Something } from '../../../../shared/components/Something';

// AdjacentSegmentNavigation.tsx
import { Other } from '../../../../hooks/useOther';
```

**Impact:** Hard to move files, hard to understand dependencies at a glance.

**Fix:** Use path aliases consistently:
```typescript
// tsconfig.json already has "@/*" alias
import { Something } from '@/shared/components/Something';
import { Other } from '@/shared/hooks/useOther';
```

---

### 13. ESLint Disables

**Status:** ✅ **WELL-MANAGED** — All 17 instances properly documented

**Current state:** 17 eslint-disable comments across 11 files, all with explanatory comments.

| File | Count | Rules Disabled |
|------|-------|----------------|
| `logger.ts` | 5 | no-console (intentional) |
| `PhilosophyPane.tsx` | 2 | react-hooks/exhaustive-deps |
| `useRenderLogger.ts` | 2 | react-hooks/exhaustive-deps |
| Other files | 1 each | Various |

**Best practice example from codebase:**
```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
// Safe: handleResize is stable (uses refs internally), adding it would cause
// unnecessary re-subscriptions to the resize observer
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

**Recommendation:** Maintain current practice — document all new disables.

---

### 14. Magic Numbers and Strings

Hardcoded values without explanation:

```typescript
// useToolSettings.ts
const USER_CACHE_MS = 10_000;  // Good - named constant
timeoutMs = 15000              // Bad - why 15 seconds?
staleTime: 10 * 60 * 1000      // Bad - why 10 minutes?
failureCount < 3               // Bad - why 3 retries?

// useTasks.ts
PROCESSING_FETCH_MULTIPLIER: 2  // Why 2x?
PROCESSING_MAX_FETCH: 100       // Why 100?
DEFAULT_LIMIT: 50               // Why 50?
```

**Fix:** Create documented constants:
```typescript
// src/shared/constants/performance.ts
export const CACHE_SETTINGS = {
  /** User settings cache duration - short to catch permission changes */
  USER_SETTINGS_MS: 10_000,

  /** Tool settings stale time - longer as settings change infrequently */
  TOOL_SETTINGS_STALE_MS: 10 * 60 * 1000,

  /** Auth check timeout - balance between UX and allowing slow networks */
  AUTH_TIMEOUT_MS: 15_000,
} as const;

export const RETRY_SETTINGS = {
  /** Max retries for transient failures - 3 covers most network blips */
  MAX_RETRIES: 3,
} as const;
```

---

### 15. TODO Comments

**Status:** ✅ **LOW COUNT** — Only 7 TODOs in entire codebase

| File | TODOs |
|------|-------|
| `CharacterEditor.tsx` | 1 |
| `ShotImagesEditor.tsx` | 1 |
| `Timeline.tsx` | 1 |
| `useToolSettings.ts` | 1 |
| `ImageLightbox.tsx` | 1 |
| `MediaGalleryLightbox.tsx` | 2 |

**Example:**
```typescript
// TODO: Optimize for large timelines
```

**Recommendation:** Either resolve or link to tracking system:
```typescript
// TODO(#123): Optimize for large timelines
// Context: Performance degrades with >100 segments
```

---

## Low Severity: Style & Polish

### 16. Inconsistent Import Organization

Files don't follow consistent import ordering:

```typescript
// File A: React, external, internal
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';

// File B: Mixed order
import { Button } from '@/shared/components/ui/button';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
```

**Fix:** Configure eslint-plugin-import or prettier-plugin-organize-imports.

---

### 17. Missing JSDoc on Public APIs

Exported functions lack documentation:

```typescript
// No JSDoc - what does this return? What are valid inputs?
export function mapShotGenerationToRow(gen: ShotGeneration) {
  // ...
}
```

**Fix:** Add JSDoc for exported functions:
```typescript
/**
 * Transforms a ShotGeneration domain object to database row format.
 *
 * @param gen - The shot generation to transform
 * @returns Row format suitable for Supabase insert/update
 *
 * @example
 * const row = mapShotGenerationToRow(generation);
 * await supabase.from('shot_generations').insert(row);
 */
export function mapShotGenerationToRow(gen: ShotGeneration): ShotGenerationRow {
  // ...
}
```

---

### 18. Test Coverage

**Status:** ✅ **IMPROVED** — 211 test files present

**Previous audit found only 3 test files; current count is 211.**

Test coverage now exists across the codebase, though specific coverage percentages were not measured.

**Areas still needing coverage:**
- Oversized hooks (useToolSettings, useGenerations, useSegmentSettings)
- Data transformers (generationTransformers.ts)
- Giant components (ShotImagesEditor, ShotEditor, ImageGenerationForm)

**Recommendation:** Focus new tests on the oversized files before refactoring them.

---

### 19. Query Key Inconsistency

**Status:** ✅ **FIXED** — See section 3 (Cache Invalidation Complexity)

Centralized query key registry now in `src/shared/lib/queryKeys.ts` with TypeScript autocomplete and consistent patterns across the codebase.

---

## Summary Table

| Category | Severity | Count | Status |
|----------|----------|-------|--------|
| Giant components | **Critical** | 15 (4 critical >2000 LOC) | ❌ `ShotImagesEditor` (3,775), `ImageGenerationForm` (3,081), etc. |
| Type safety (`any`) | High | 1,316 in 242 files | ❌ Top: `ShotImagesEditor` (65), `useLightboxLayoutProps` (40) |
| Oversized hooks | High | 7 hooks >800 LOC | ❌ `useSegmentSettings` (1,160), `useGenerations` (942), etc. |
| Double casts | High | 15 in 7 files | ❌ `ImageGenerationToolPage` (4), `useStickyHeader` (4) |
| Cache complexity | High | 3+ patterns | ✅ **FIXED** — `queryKeys.ts` registry + invalidation hooks |
| Error handling | Medium | Adoption gap | ✅ **FIXED** — 107 files migrated to `handleError()` |
| Console logging | Low | 4,011 in 339 files | ✅ **MITIGATED** — Production suppressed via logger |
| ESLint disables | Low | 17 total | ✅ **All documented** — 0 unexplained |
| TODO comments | Low | 7 total | ✅ **Low count** — Good tracking practices |
| Test coverage | Low | 211 test files | ✅ **IMPROVED** — Up from 3 |
| Naming inconsistency | Medium | 15+ | ❌ No documented conventions |
| State management mix | Medium | Many | ❌ No decision matrix |
| Deep imports | Medium | 15+ | ❌ Should use `@/` aliases |
| Duplicate transformers | Medium | 4 | ❌ Multiple transformation patterns |
| Magic numbers | Medium | 20+ | ❌ Undocumented constants |
| Import organization | Low | Many | ❌ No consistent style |
| Missing JSDoc | Low | Many | ❌ Exported functions undocumented |

---

## In-Progress Refactors

| Refactor | Status | Notes |
|----------|--------|-------|
| `useShots.ts` → `shots/` | ✅ **COMPLETE** | 2,350 → 10 files. Note: `useShotGenerationMutations.ts` now 924 lines (split candidate). |
| `useGenerations.ts` cleanup | ⏳ **IN PROGRESS** | 1,353 → 942 lines. Dead code removed. Further split pending. |
| `MediaLightbox.tsx` | ✅ **COMPLETE** | 2,617 → 189 lines (split into 90+ modular files) |
| Cache invalidation centralization | ✅ **COMPLETE** | `queryKeys.ts` registry + 4 domain invalidation hooks. 327 → 199 inline usages (-39%). |
| Error handling migration | ✅ **COMPLETE** | 107 files migrated to `handleError()`. 308 scattered calls → 348 structured calls. |

**New Critical Items Discovered:**
- `ShotImagesEditor.tsx` (3,775 lines) — highest priority component
- `ImageGenerationForm/index.tsx` (3,081 lines)
- `ShotEditor/index.tsx` (3,034 lines)
- `TimelineContainer.tsx` (2,241 lines)

---

## Prioritized Recommendations

### Phase 1: Critical Components (Highest Impact)
1. **Split `ShotImagesEditor.tsx`** (3,775 lines) — Largest component, blocks other refactors
2. **Split `ImageGenerationForm/index.tsx`** (3,081 lines) — Core user-facing form
3. **Split `ShotEditor/index.tsx`** (3,034 lines) — Major editing interface
4. ~~**Create centralized query keys**~~ ✅ **DONE** — `queryKeys.ts` + invalidation hooks

### Phase 2: Type Safety
5. **Fix double casts** (15 occurrences) — Address underlying type mismatches
6. **Reduce `any` types in top files** — Start with `ShotImagesEditor` (65), `useLightboxLayoutProps` (40)
7. ~~**Standardize error handling adoption**~~ ✅ **DONE** — 107 files migrated to `handleError()`

### Phase 3: Hook Structure
8. **Split `useSegmentSettings.ts`** (1,160 lines) — Largest remaining hook
9. **Split `useShotGenerationMutations.ts`** (924 lines) — Part of shots module
10. **Continue `useGenerations.ts`** (942 lines) — Further decomposition

### Phase 4: Consistency
11. **Document naming conventions** — Add to `structure.md`
12. **Create state management decision matrix** — Document when to use what
13. **Add path alias enforcement** — ESLint rule for `@/` imports

### Phase 5: Polish
14. **Add JSDoc to public APIs** — Focus on shared hooks first
15. **Configure import sorting** — Automated consistency

### Completed ✅
- Console logging mitigated (production suppressed)
- ESLint disables all documented
- TODO comments minimal (7 total)
- Test coverage improved (211 files)
- `useShots.ts` refactored
- `MediaLightbox.tsx` refactored
- Cache invalidation centralized (`queryKeys.ts` + invalidation hooks)
- Error handling standardized (107 files migrated to `handleError()`)

---

## Appendix: File-by-File Quick Reference

### Critical Priority (>3000 lines)
| File | Lines | Action |
|------|-------|--------|
| `src/tools/travel-between-images/components/ShotImagesEditor.tsx` | 3,775 | Split into feature modules |
| `src/tools/image-generation/components/ImageGenerationForm/index.tsx` | 3,081 | Extract form sections |
| `src/tools/travel-between-images/components/ShotEditor/index.tsx` | 3,034 | Decompose editor |

### High Priority (2000-3000 lines)
| File | Lines | Action |
|------|-------|--------|
| `src/tools/travel-between-images/components/Timeline/TimelineContainer.tsx` | 2,241 | Extract timeline logic |

### Medium Priority (1500-2000 lines)
| File | Lines | Action |
|------|-------|--------|
| `src/shared/components/PhaseConfigSelectorModal/PhaseConfigSelectorModal.tsx` | 1,973 | Extract form + preview |
| `src/tools/travel-between-images/pages/VideoTravelToolPage.tsx` | 1,852 | Page decomposition |
| `src/tools/join-clips/pages/JoinClipsPage.tsx` | 1,833 | Page decomposition |
| `src/shared/components/MediaGalleryItem.tsx` | 1,700 | Extract interactions |
| `src/shared/components/SegmentSettingsForm.tsx` | 1,570 | Extract field groups |
| `src/tools/travel-between-images/components/VideoGallery/components/VideoItem.tsx` | 1,532 | Extract interactions |

### Completed ✅
- ~~`src/shared/hooks/useShots.ts`~~ → `src/shared/hooks/shots/` (10 files)
- ~~`src/shared/components/MediaLightbox/MediaLightbox.tsx`~~ → 90+ modular files

### Files Setting Good Examples
- `src/shared/lib/errors.ts` — Good error typing pattern
- `src/shared/lib/logger.ts` — Production-safe logging with suppression
- `src/shared/constants/` — Constants extraction done well
- `src/shared/components/ui/` — Consistent shadcn patterns
- `src/shared/hooks/shots/` — Good hook decomposition pattern

---

*Last updated: 2026-02-01*
