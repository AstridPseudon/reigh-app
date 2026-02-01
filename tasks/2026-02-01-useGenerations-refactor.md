# Plan: Refactor useGenerations.ts - Simplification + Cleanup

## Current State

- **1,353 lines**, but significant portions are dead code or debugging artifacts
- **33 console.log statements** in this file alone (59 total across related files)
- **~250 lines of dead code** (unused hooks)
- **Over-engineered star toggle** (170 lines for a simple boolean update)
- **Duplicate implementations** (source generation hook exists in two places)

---

## Phase 1: Delete Dead Code (~250 lines)

### 1.1 Unused Hooks

These are defined in useGenerations.ts but **never imported anywhere**:

| Hook | Lines | Status |
|------|-------|--------|
| `useSourceGeneration` | ~15 | ❌ Never imported - MediaLightbox has its own implementation |
| `fetchSourceGeneration` | ~95 | ❌ Never imported - only used by unused hook above |
| `useUpdateGenerationName` | ~45 | ❌ Never imported anywhere |
| `useUpdateGenerationParams` | ~40 | ❌ Never imported anywhere |

**Action:** Delete these 4 exports entirely. ~195 lines removed.

### 1.2 Unused Helper Function

```ts
async function updateGenerationName(id: string, name: string): Promise<void> {
  // ~25 lines - only used by useUpdateGenerationName which is unused
}
```

**Action:** Delete. ~25 lines removed.

**Total Phase 1 savings: ~220 lines**

---

## Phase 2: Remove Debug Logging (~100 lines)

### Current State

59 console.log statements across 7 files with prefixes like:
- `[StarPersist] 🚀`, `[StarPersist] 📊`, `[StarPersist] ✅`
- `[EditVariants]`, `[DerivedItems]`, `[BasedOnDebug]`
- `[GenerationUpdate]`

Most of these are debugging artifacts that were never cleaned up. Example from star toggle:

```ts
console.log('[StarPersist] 🔵 Mutation function called', { id, starred, shotId });
console.log('[StarPersist] 🟡 onMutate: Optimistically updating caches', {...});
console.log('[StarPersist] 📊 Found generations queries to update:', {...});
// ... 15 more in this one hook
```

### Action

**Option A (Recommended):** Delete all debug logs from this file. They're dev artifacts, not useful instrumentation.

**Option B:** If debugging is occasionally needed, add a single `DEBUG_GENERATIONS` flag:
```ts
const DEBUG = process.env.NODE_ENV === 'development' && localStorage.getItem('DEBUG_GENERATIONS');
```

**Estimated savings: ~80 lines of console.log calls + cleaner code**

---

## Phase 3: Simplify Star Toggle (~100 lines saved)

### Current Problem

`useToggleGenerationStar` is **170 lines** for toggling a boolean. It:
1. Cancels queries across 3 cache types
2. Snapshots all caches for rollback
3. Optimistically updates 3 different caches
4. Has complex rollback logic
5. Emits a custom DOM event
6. Has 20+ debug log statements

**But the code itself says:** "Generation star toggle events are now handled by DataFreshnessManager via realtime events"

### Proposed Simplification

If realtime handles cache updates, we may not need all this optimistic complexity:

```ts
export function useToggleGenerationStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      toggleGenerationStar(id, starred),
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to toggle star');
    },
    // Let realtime/DataFreshnessManager handle cache invalidation
  });
}
```

**From 170 lines to ~15 lines.**

### Caveat

Need to verify realtime actually handles this reliably. If there's noticeable lag, we could keep minimal optimistic update for just `['unified-generations']`.

---

## Phase 4: Consolidate Duplicate Hooks

### Source Generation Duplication

**Two implementations exist:**

1. `useGenerations.ts` - `useSourceGeneration` (React Query, **UNUSED**)
2. `MediaLightbox/hooks/useSourceGeneration.ts` (useState + useEffect + direct Supabase, **USED**)

**Action:**
- Delete the unused one from useGenerations.ts (done in Phase 1)
- Keep MediaLightbox version as-is (it's specific to lightbox needs)
- Or refactor MediaLightbox to use React Query if beneficial

### Star Toggle Wrapper

MediaLightbox has `useStarToggle` which wraps `useToggleGenerationStar` and adds:
- Local state management
- Grace period logic to prevent stale prop syncing
- 13 more console.log statements

**Consider:** After simplifying `useToggleGenerationStar`, evaluate if wrapper is still needed.

---

## Phase 5: Simplify fetchGenerations Filter Logic

### Current Problem

`fetchGenerations` is 280 lines with **duplicated filter logic** between count and data queries:

```ts
// Count query filters (lines 217-300)
if (filters?.toolType && !filters?.shotId) { ... }
if (filters?.mediaType && filters.mediaType !== 'all') { ... }
if (filters?.starredOnly) { ... }
// ... etc

// Data query filters (lines 352-407) - SAME LOGIC REPEATED
if (filters?.toolType && !filters?.shotId) { ... }
if (filters?.mediaType && filters.mediaType !== 'all') { ... }
if (filters?.starredOnly) { ... }
// ... etc
```

### Solution

Extract a helper function:

```ts
function applyGenerationFilters<T extends PostgrestFilterBuilder>(
  query: T,
  filters: GenerationFilters | undefined,
  options?: { forCount?: boolean }
): T {
  if (!filters) return query;

  if (filters.toolType && !filters.shotId) {
    query = filters.toolType === 'image-generation'
      ? query.eq('params->>tool_type', 'image-generation')
      : query.or(`params->>tool_type.eq.${filters.toolType},...`);
  }
  // ... all filter logic once
  return query;
}
```

**Estimated savings: ~80 lines of duplicated filter code**

---

## Summary: Before & After

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Total lines | 1,353 | **942** | **-411 lines (30%)** |
| Dead code | ~225 lines | 0 | -225 |
| Console statements | 33 | 7 (errors only) | -26 |
| Star toggle | 170 lines | ~85 | -85 |
| Filter duplication | ~120 lines | ~65 (shared helper) | -55 |
| Exports | 17 | 13 | -4 unused |

**All steps completed.**

---

## Implementation Order

### Step 1: Delete dead code (safe, no behavior change) ✅ DONE
- [x] Remove `useUpdateGenerationName` + helper (~70 lines)
- [x] Remove `useUpdateGenerationParams` (~40 lines)
- [x] Remove `useSourceGeneration` + `fetchSourceGeneration` (~115 lines)
- [x] Verify build passes

### Step 2: Remove debug logging ✅ DONE
- [x] Delete all `[StarPersist]`, `[EditVariants]`, etc. console.logs (26 removed)
- [x] Kept 7 console.error statements (actual error handling)
- [x] Verify no runtime errors

### Step 3: Simplify star toggle ✅ DONE (partial)
- [x] Removed verbose logging (~85 lines saved)
- [x] Kept optimistic updates (they provide instant UI feedback)
- [x] Kept custom DOM event (used by Timeline)
- [ ] Could potentially simplify further if realtime handles updates reliably

### Step 4: DRY filter logic ✅ DONE
- [x] Extract `applyGenerationFilters` helper (~65 lines of shared logic)
- [x] Apply to both count and data queries
- [x] Verify TypeScript compiles
- **Savings: ~54 lines**

### Step 5: Organize remaining code - SKIPPED
- At 942 lines, file is manageable without splitting

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Removing "used" code | Grep verified no imports for dead hooks |
| Star toggle lag | Test realtime first; keep minimal optimistic if needed |
| Filter regression | Add basic tests for filter combinations |
| Breaking imports | Barrel file maintains same export names |

---

## Key Insight

**The original plan was reorganizing complexity. This plan eliminates it.**

- Dead code deletion is free wins
- Debug logs are noise that make the code harder to read
- Over-engineered optimistic updates may be obsolete with realtime
- DRY principles reduce maintenance burden

Only after cleanup should we consider reorganization - and we may not need it if the file shrinks to ~750 lines.
