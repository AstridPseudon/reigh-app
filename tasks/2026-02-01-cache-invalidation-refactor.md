# Cache Invalidation Refactor Plan

## Goal
Centralize React Query cache management to eliminate 38 scattered query key patterns across 55 files, while ensuring zero loss of functionality.

## Key Decisions (TL;DR)

| Question | Decision |
|----------|----------|
| Predicate invalidation (`queryKey[0] === '...'`) | Keep as-is, add `*All` variants to registry |
| `setQueryData` optimistic updates | Use registry (must match query key exactly) |
| `['shot-generations']` legacy key | Remove (only invalidated, never queried) |

---

## Current State Summary

| Metric | Value |
|--------|-------|
| Unique query key patterns | 38 |
| Files with inline queryClient ops | 55 |
| Centralized invalidation hooks | 1 (generations only) |
| Centralized cache key factories | 1 (unified-generations only) |

**Existing good patterns to preserve:**
- `useGenerationInvalidation.ts` - scoped invalidation with reasons, batching, debug logging
- `queryDefaults.ts` - QUERY_PRESETS for staleTime/gcTime configuration
- `DataFreshnessManager.ts` - polling interval decisions
- `debugConfig.isEnabled('invalidation')` - toggleable debug logging

---

## Phase 0: Preparation & Baseline

### 0.1 Create Invalidation Audit Script

Create a script to capture current invalidation behavior for comparison after migration.

**File:** `scripts/audit-cache-keys.ts`

```typescript
// Scans codebase and outputs:
// 1. All query keys in use (from useQuery/useMutation calls)
// 2. All invalidation calls (invalidateQueries, setQueryData, refetchQueries)
// 3. Mapping of which files invalidate which keys
```

**Output:** `scripts/cache-audit-baseline.json`

### 0.2 Document Current Invalidation Flows

Create a reference document of what gets invalidated when. This becomes our test matrix.

| Trigger | Files | Keys Invalidated | Notes |
|---------|-------|------------------|-------|
| Generation created (realtime) | SimpleRealtimeProvider.tsx:142 | `unified-generations`, `shot-generations`, `all-shot-generations` | Via predicate |
| Variant set as primary | useGenerationInvalidation.ts:228 | `generation-variants`, `generation`, `variant-badges`, `all-shot-generations`, `unified-generations`, `derived-items`, `segment-child-generations` | Cascading |
| Shot deleted | useShots.ts:??? | `shots`, `all-shot-generations` | Need to verify |
| Task completed (realtime) | SimpleRealtimeProvider.tsx:??? | `tasks`, `task-status-counts`, `unified-generations` | Need to verify |
| Settings updated | ??? | `toolSettings`, `segmentSettings` | Scattered - need to audit |

### 0.3 Sense-Check: Baseline Test Suite

Before any changes, manually test these flows and document expected behavior:

- [ ] Create a generation → appears in gallery within 2s
- [ ] Set variant as primary → thumbnail updates in gallery
- [ ] Delete a shot → removed from shot list, generations cleaned up
- [ ] Complete a task → task list updates, generation appears
- [ ] Update tool settings → new generations use updated settings
- [ ] Update segment settings → timeline reflects changes

**Record:** Screenshots/videos of each flow for comparison.

---

## Phase 1: Query Key Registry (Zero Risk)

### 1.1 Create Query Key Registry

**New file:** `src/shared/lib/queryKeys.ts`

```typescript
/**
 * Centralized query key registry.
 *
 * ALL React Query keys should be defined here. This provides:
 * - TypeScript autocomplete (catches typos)
 * - Single source of truth (easy refactoring)
 * - Visibility into cache structure
 *
 * Naming conventions:
 * - Use nouns for entities: 'shots', 'generations', 'tasks'
 * - Use kebab-case for multi-word: 'all-shot-generations'
 * - Scope from broad to specific: ['shots', projectId] not [projectId, 'shots']
 */

// Helper for type inference
const createQueryKey = <T extends readonly unknown[]>(key: T): T => key;

export const queryKeys = {
  // ============ SHOTS ============
  shots: {
    all: createQueryKey(['shots'] as const),
    list: (projectId: string) => createQueryKey(['shots', projectId] as const),
    detail: (shotId: string) => createQueryKey(['shot', shotId] as const),
  },

  // ============ GENERATIONS ============
  generations: {
    // All generations (rarely used directly)
    all: createQueryKey(['generations'] as const),

    // Shot-scoped generation queries (primary key for shot generation data)
    byShot: (shotId: string) => createQueryKey(['all-shot-generations', shotId] as const),
    // NOTE: ['shot-generations'] was removed - it was only invalidated, never queried

    // Unified generations (paginated, filtered)
    unified: {
      base: createQueryKey(['unified-generations'] as const),
      byShot: (shotId: string, page?: number, limit?: number, filters?: string) =>
        createQueryKey(['unified-generations', 'shot', shotId, page, limit, filters] as const),
      byProject: (projectId: string, page?: number, limit?: number, filters?: string) =>
        createQueryKey(['unified-generations', 'project', projectId, page, limit, filters] as const),
    },

    // Single generation
    detail: (generationId: string) => createQueryKey(['generation', generationId] as const),

    // Generation metadata (counts, positions)
    meta: (shotId: string) => createQueryKey(['shot-generations-meta', shotId] as const),
    unpositionedCount: (shotId: string) => createQueryKey(['unpositioned-count', shotId] as const),

    // Variants
    variants: (generationId: string) => createQueryKey(['generation-variants', generationId] as const),
    variantBadges: createQueryKey(['variant-badges'] as const),

    // Derived/child generations
    derived: (generationId: string) => createQueryKey(['derived-items', generationId] as const),
    derivedAll: createQueryKey(['derived-items'] as const),

    // Segment-specific
    segmentChildren: (segmentId: string) => createQueryKey(['segment-child-generations', segmentId] as const),
    segmentChildrenAll: createQueryKey(['segment-child-generations'] as const),
    segmentParents: (segmentId: string) => createQueryKey(['segment-parent-generations', segmentId] as const),
    segmentParentsAll: createQueryKey(['segment-parent-generations'] as const),
    segmentLiveTimeline: (shotId: string) => createQueryKey(['segment-live-timeline', shotId] as const),

    // Source slot (for video warnings)
    sourceSlot: (slotId: string) => createQueryKey(['source-slot-generations', slotId] as const),
    sourceSlotAll: createQueryKey(['source-slot-generations'] as const),
  },

  // ============ TASKS ============
  tasks: {
    all: createQueryKey(['tasks'] as const),
    list: (projectId: string) => createQueryKey(['tasks', projectId] as const),
    detail: (taskId: string) => createQueryKey(['task', taskId] as const),
    statusCounts: (projectId: string) => createQueryKey(['task-status-counts', projectId] as const),
    processing: (projectId: string) => createQueryKey(['tasks', 'processing', projectId] as const),
  },

  // ============ SETTINGS ============
  settings: {
    // Tool settings (per-tool, per-project)
    tool: (toolId: string, projectId: string) =>
      createQueryKey(['toolSettings', toolId, projectId] as const),
    toolWithScope: (toolId: string, scope: string, scopeId: string) =>
      createQueryKey(['toolSettings', toolId, scope, scopeId] as const),

    // Segment settings
    segment: (segmentId: string) => createQueryKey(['segmentSettings', segmentId] as const),

    // User-level settings
    user: createQueryKey(['user-settings'] as const),

    // Pair metadata (segment editor)
    pairMetadata: (pairId: string) => createQueryKey(['pair-metadata', pairId] as const),
  },

  // ============ RESOURCES ============
  resources: {
    all: (projectId: string) => createQueryKey(['resources', projectId] as const),
    detail: (resourceId: string) => createQueryKey(['resource', resourceId] as const),
  },

  // ============ CREDITS/BILLING ============
  credits: {
    balance: createQueryKey(['credits', 'balance'] as const),
    history: createQueryKey(['credits', 'history'] as const),
  },

  // ============ PROJECTS ============
  projects: {
    all: createQueryKey(['projects'] as const),
    detail: (projectId: string) => createQueryKey(['project', projectId] as const),
  },

  // ============ USER ============
  user: {
    profile: createQueryKey(['user-profile'] as const),
    subscription: createQueryKey(['subscription'] as const),
  },
} as const;

// Type exports for consumers
export type QueryKeys = typeof queryKeys;
export type ShotQueryKey = ReturnType<typeof queryKeys.shots.list>;
export type GenerationQueryKey = ReturnType<typeof queryKeys.generations.byShot>;
```

### 1.2 Sense-Check: Compilation

```bash
# Must compile without errors
npx tsc --noEmit src/shared/lib/queryKeys.ts
```

### 1.3 Sense-Check: Coverage Audit

Run audit script to verify all 38 current patterns have a corresponding entry:

```bash
npx ts-node scripts/audit-cache-keys.ts --compare src/shared/lib/queryKeys.ts
```

**Expected output:** List of any keys in use that aren't in the registry (should be 0).

---

## Phase 2: Domain Invalidation Hooks (Low Risk)

### 2.1 Create Invalidation Hook Directory Structure

```
src/shared/hooks/invalidation/
├── index.ts                      # Barrel export
├── useGenerationInvalidation.ts  # MOVE existing file here
├── useShotInvalidation.ts        # NEW
├── useTaskInvalidation.ts        # NEW
├── useSettingsInvalidation.ts    # NEW
└── useResourceInvalidation.ts    # NEW
```

### 2.2 Move Existing Generation Invalidation

```bash
# Move file (git tracks the move)
git mv src/shared/hooks/useGenerationInvalidation.ts \
       src/shared/hooks/invalidation/useGenerationInvalidation.ts
```

**Update imports:** Find and replace all imports. Expected ~15 files.

### 2.3 Create Shot Invalidation Hook

**File:** `src/shared/hooks/invalidation/useShotInvalidation.ts`

```typescript
/**
 * useShotInvalidation.ts
 *
 * Centralized hook for invalidating shot-related React Query caches.
 *
 * Invalidation scopes:
 * - 'list': Just the shots list for a project
 * - 'detail': A specific shot's detail data
 * - 'all': List + all related generation caches
 */

import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '../../lib/queryKeys';
import { debugConfig } from '../../lib/debugConfig';

export type ShotInvalidationScope = 'list' | 'detail' | 'all';

export interface ShotInvalidationOptions {
  scope?: ShotInvalidationScope;
  reason: string;
  /** Shot ID - required for 'detail' and 'all' scopes */
  shotId?: string;
  /** Project ID - required for 'list' and 'all' scopes */
  projectId?: string;
}

export function useInvalidateShots() {
  const queryClient = useQueryClient();

  return useCallback((options: ShotInvalidationOptions) => {
    const { scope = 'all', reason, shotId, projectId } = options;

    if (debugConfig.isEnabled('invalidation')) {
      console.log(`[Invalidation] Shots: ${reason}`, {
        scope,
        shotId: shotId?.substring(0, 8),
        projectId: projectId?.substring(0, 8),
      });
    }

    if ((scope === 'list' || scope === 'all') && projectId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.shots.list(projectId) });
    }

    if ((scope === 'detail' || scope === 'all') && shotId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.shots.detail(shotId) });
      // Also invalidate generation caches for this shot
      queryClient.invalidateQueries({ queryKey: queryKeys.generations.byShot(shotId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.generations.meta(shotId) });
    }
  }, [queryClient]);
}

// Non-hook version for use outside React
export function invalidateShotsSync(
  queryClient: QueryClient,
  options: ShotInvalidationOptions
): void {
  // Same implementation as hook callback
}
```

### 2.4 Create Task Invalidation Hook

**File:** `src/shared/hooks/invalidation/useTaskInvalidation.ts`

```typescript
/**
 * useTaskInvalidation.ts
 *
 * Centralized hook for invalidating task-related React Query caches.
 *
 * Invalidation scopes:
 * - 'list': Task list for a project
 * - 'detail': Specific task
 * - 'counts': Just status counts (lightweight)
 * - 'all': Everything task-related
 */

export type TaskInvalidationScope = 'list' | 'detail' | 'counts' | 'all';

export interface TaskInvalidationOptions {
  scope?: TaskInvalidationScope;
  reason: string;
  taskId?: string;
  projectId?: string;
  /** Also invalidate generation caches (for task completion) */
  includeGenerations?: boolean;
  shotId?: string; // Required if includeGenerations is true
}

export function useInvalidateTasks() {
  const queryClient = useQueryClient();

  return useCallback((options: TaskInvalidationOptions) => {
    const { scope = 'all', reason, taskId, projectId, includeGenerations, shotId } = options;

    if (debugConfig.isEnabled('invalidation')) {
      console.log(`[Invalidation] Tasks: ${reason}`, { scope, taskId, projectId });
    }

    if ((scope === 'list' || scope === 'all') && projectId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
    }

    if ((scope === 'detail' || scope === 'all') && taskId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) });
    }

    if ((scope === 'counts' || scope === 'all') && projectId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.statusCounts(projectId) });
    }

    // Task completion often means new generations
    if (includeGenerations && shotId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.generations.byShot(shotId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.generations.unified.base });
    }
  }, [queryClient]);
}
```

### 2.5 Create Settings Invalidation Hook

**File:** `src/shared/hooks/invalidation/useSettingsInvalidation.ts`

```typescript
/**
 * useSettingsInvalidation.ts
 *
 * Centralized hook for invalidating settings-related React Query caches.
 */

export type SettingsInvalidationScope = 'tool' | 'segment' | 'user' | 'pair' | 'all';

export interface SettingsInvalidationOptions {
  scope: SettingsInvalidationScope;
  reason: string;
  toolId?: string;
  projectId?: string;
  segmentId?: string;
  pairId?: string;
}

export function useInvalidateSettings() {
  const queryClient = useQueryClient();

  return useCallback((options: SettingsInvalidationOptions) => {
    const { scope, reason, toolId, projectId, segmentId, pairId } = options;

    if (debugConfig.isEnabled('invalidation')) {
      console.log(`[Invalidation] Settings: ${reason}`, { scope, toolId, segmentId });
    }

    if (scope === 'tool' && toolId && projectId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.tool(toolId, projectId)
      });
    }

    if (scope === 'segment' && segmentId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.segment(segmentId)
      });
    }

    if (scope === 'pair' && pairId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.pairMetadata(pairId)
      });
    }

    if (scope === 'user') {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.user });
    }
  }, [queryClient]);
}
```

### 2.6 Create Barrel Export

**File:** `src/shared/hooks/invalidation/index.ts`

```typescript
export * from './useGenerationInvalidation';
export * from './useShotInvalidation';
export * from './useTaskInvalidation';
export * from './useSettingsInvalidation';
```

### 2.7 Sense-Check: No Broken Imports

```bash
# Find any broken imports after moving useGenerationInvalidation
npm run build 2>&1 | grep -i "useGenerationInvalidation"

# Should show 0 errors
```

### 2.8 Sense-Check: Manual Test Generation Flows

Since we moved `useGenerationInvalidation.ts`, re-test:

- [ ] Set variant as primary → thumbnail updates
- [ ] Delete generation → removed from gallery
- [ ] Create generation (via task) → appears in gallery

---

## Phase 3: Migrate Generation Keys (Medium Risk)

This phase updates `useGenerationInvalidation.ts` to use `queryKeys.*` instead of hardcoded strings.

### 3.1 Update useGenerationInvalidation.ts

**Before:**
```typescript
queryClient.invalidateQueries({ queryKey: ['all-shot-generations', shotId] });
queryClient.invalidateQueries({ queryKey: ['shot-generations', shotId] });
```

**After:**
```typescript
import { queryKeys } from '../../lib/queryKeys';

queryClient.invalidateQueries({ queryKey: queryKeys.generations.byShot(shotId) });
queryClient.invalidateQueries({ queryKey: queryKeys.generations.byShotLegacy(shotId) });
```

### 3.2 Sense-Check: Key Equivalence

Before committing, verify the keys are identical:

```typescript
// Add temporary test in useGenerationInvalidation.ts
console.assert(
  JSON.stringify(['all-shot-generations', 'test-id']) ===
  JSON.stringify(queryKeys.generations.byShot('test-id')),
  'Key mismatch: byShot'
);
```

### 3.3 Sense-Check: Full Generation Test Suite

- [ ] Create generation → appears in shot gallery
- [ ] Create generation → appears in unified gallery
- [ ] Set variant as primary → thumbnail updates everywhere
- [ ] Delete generation → removed from all views
- [ ] Reposition generation on timeline → position persists
- [ ] Create segment output → appears in timeline strip

---

## Phase 4: Migrate SimpleRealtimeProvider (High Risk)

This is the highest-risk phase because realtime events drive most cache updates.

### 4.1 Create Realtime Invalidation Map

**New file:** `src/shared/lib/realtimeInvalidationMap.ts`

```typescript
/**
 * Maps Supabase realtime events to cache invalidation actions.
 *
 * This centralizes the 20+ inline invalidation calls in SimpleRealtimeProvider.
 * Each handler receives the event payload and queryClient.
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import {
  invalidateGenerationsSync,
  invalidateVariantChange
} from '../hooks/invalidation';
import { debugConfig } from './debugConfig';

type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';
type TableName = 'generations' | 'generation_variants' | 'tasks' | 'shots' | 'variant_badges';

interface RealtimeEvent {
  new: Record<string, any>;
  old: Record<string, any>;
  eventType: RealtimeEventType;
  table: TableName;
}

type InvalidationHandler = (
  event: RealtimeEvent,
  queryClient: QueryClient
) => void | Promise<void>;

export const REALTIME_INVALIDATION_MAP: Record<string, InvalidationHandler> = {
  // ============ GENERATIONS ============
  'generations:INSERT': (event, queryClient) => {
    const shotId = event.new.shot_id;
    const projectId = event.new.project_id;

    if (debugConfig.isEnabled('invalidation')) {
      console.log('[Realtime] generations:INSERT', { shotId, projectId });
    }

    invalidateGenerationsSync(queryClient, shotId, {
      reason: 'realtime:generations:INSERT',
      scope: 'all',
      includeProjectUnified: true,
      projectId,
    });
  },

  'generations:UPDATE': (event, queryClient) => {
    const shotId = event.new.shot_id;

    invalidateGenerationsSync(queryClient, shotId, {
      reason: 'realtime:generations:UPDATE',
      scope: 'images', // Lighter weight - just image data
    });
  },

  'generations:DELETE': (event, queryClient) => {
    const shotId = event.old.shot_id;
    const projectId = event.old.project_id;

    invalidateGenerationsSync(queryClient, shotId, {
      reason: 'realtime:generations:DELETE',
      scope: 'all',
      includeProjectUnified: true,
      projectId,
    });
  },

  // ============ VARIANTS ============
  'generation_variants:INSERT': async (event, queryClient) => {
    await invalidateVariantChange(queryClient, {
      reason: 'realtime:generation_variants:INSERT',
      generationId: event.new.generation_id,
    });
  },

  'generation_variants:UPDATE': async (event, queryClient) => {
    await invalidateVariantChange(queryClient, {
      reason: 'realtime:generation_variants:UPDATE',
      generationId: event.new.generation_id,
    });
  },

  // ============ TASKS ============
  'tasks:INSERT': (event, queryClient) => {
    const projectId = event.new.project_id;

    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.statusCounts(projectId) });
  },

  'tasks:UPDATE': (event, queryClient) => {
    const projectId = event.new.project_id;
    const taskId = event.new.id;

    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.statusCounts(projectId) });

    // If task completed, also invalidate generations
    if (event.new.status === 'completed' && event.old.status !== 'completed') {
      const shotId = event.new.shot_id;
      if (shotId) {
        invalidateGenerationsSync(queryClient, shotId, {
          reason: 'realtime:tasks:completed',
          scope: 'all',
        });
      }
    }
  },

  // ============ VARIANT BADGES ============
  'variant_badges:INSERT': (event, queryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.generations.variantBadges });
  },

  'variant_badges:UPDATE': (event, queryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.generations.variantBadges });
  },
};

/**
 * Handle a realtime event by looking up and executing the appropriate invalidation.
 */
export function handleRealtimeInvalidation(
  table: string,
  eventType: string,
  event: RealtimeEvent,
  queryClient: QueryClient
): void {
  const key = `${table}:${eventType}`;
  const handler = REALTIME_INVALIDATION_MAP[key];

  if (handler) {
    handler(event, queryClient);
  } else if (debugConfig.isEnabled('invalidation')) {
    console.log(`[Realtime] No handler for ${key}`);
  }
}
```

### 4.2 Update SimpleRealtimeProvider

**Before (inline calls):**
```typescript
channel.on('postgres_changes', { event: 'INSERT', table: 'generations' }, (payload) => {
  queryClient.invalidateQueries({ queryKey: ['unified-generations', 'shot', payload.new.shot_id] });
  queryClient.invalidateQueries({ queryKey: ['shot-generations', payload.new.shot_id] });
  // ... more inline calls
});
```

**After (delegated):**
```typescript
import { handleRealtimeInvalidation } from '../lib/realtimeInvalidationMap';

channel.on('postgres_changes', { event: '*', table: 'generations' }, (payload) => {
  handleRealtimeInvalidation('generations', payload.eventType, payload, queryClient);
});
```

### 4.3 Sense-Check: Side-by-Side Comparison

Before replacing, add logging to compare old vs new behavior:

```typescript
// Temporary: run both old and new, compare outputs
const oldKeys = captureOldInvalidations(payload);
const newKeys = captureNewInvalidations(payload);
console.assert(
  JSON.stringify(oldKeys.sort()) === JSON.stringify(newKeys.sort()),
  'Invalidation mismatch',
  { old: oldKeys, new: newKeys }
);
```

### 4.4 Sense-Check: Full Realtime Test Suite

Test with network tab open to verify correct queries are refetched:

- [ ] Create generation (via API) → gallery updates
- [ ] Task starts → task list shows "processing"
- [ ] Task completes → generation appears, task shows "completed"
- [ ] Set variant as primary (via another tab) → updates in first tab
- [ ] Delete generation (via another tab) → removed in first tab

### 4.5 Rollback Plan

If issues discovered:
1. Revert `SimpleRealtimeProvider.tsx` to previous commit
2. Keep `realtimeInvalidationMap.ts` for future use
3. Document what failed in this file

---

## Phase 5: Migrate Remaining Inline Calls (Medium Risk)

### 5.1 Audit Remaining Inline Calls

```bash
# Find all remaining inline queryClient calls
grep -r "invalidateQueries\|setQueryData\|refetchQueries" \
  --include="*.ts" --include="*.tsx" \
  src/ \
  | grep -v "node_modules" \
  | grep -v "invalidation/" \
  | grep -v "realtimeInvalidationMap"
```

Expected files (~40):
- `ImageGenerationForm/index.tsx` (8 calls)
- `SegmentSettingsModal.tsx` (multiple)
- `ShotImagesEditor.tsx` (6 calls)
- `PaymentSuccessPage.tsx` (2 calls)
- `ShotsPage.tsx` (1 call)
- ... etc

### 5.2 Migrate by Domain

#### 5.2.1 Settings Domain (~12 calls)

Files:
- `ImageGenerationForm/index.tsx`
- `SegmentSettingsModal.tsx`
- `useToolSettings.ts`

**Before:**
```typescript
queryClient.invalidateQueries({
  queryKey: ['toolSettings', 'project-image-settings', projectId]
});
```

**After:**
```typescript
const invalidateSettings = useInvalidateSettings();
// ...
invalidateSettings({
  scope: 'tool',
  reason: 'form-submit',
  toolId: 'project-image-settings',
  projectId,
});
```

#### 5.2.2 Credits Domain (~4 calls)

Files:
- `PaymentSuccessPage.tsx`
- `useCredits.ts`

**Before:**
```typescript
queryClient.invalidateQueries({ queryKey: ['credits', 'balance'] });
```

**After:**
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.credits.balance });
```

#### 5.2.3 Shots Domain (~6 calls)

Files:
- `ShotsPage.tsx`
- `useShots.ts`
- `ShotImagesEditor.tsx`

**Before:**
```typescript
queryClient.invalidateQueries({ queryKey: ['shots', selectedProjectId] });
```

**After:**
```typescript
const invalidateShots = useInvalidateShots();
// ...
invalidateShots({
  scope: 'list',
  reason: 'shot-created',
  projectId: selectedProjectId,
});
```

#### 5.2.4 Optimistic Updates (setQueryData) (~15 calls)

Files with `setQueryData`:
- `useShots.ts` (optimistic shot/generation updates)
- `ImageGenerationForm/index.tsx` (resources, settings)
- `generationTaskBridge.ts` (mapping cache)
- `useTimelinePositionUtils.ts` (position updates)

**Pattern:**
```typescript
// Before
await queryClient.cancelQueries({ queryKey: ['all-shot-generations', shotId] });
const previous = queryClient.getQueryData(['all-shot-generations', shotId]);
queryClient.setQueryData(['all-shot-generations', shotId], (old) => [...old, newGen]);

// After
await queryClient.cancelQueries({ queryKey: queryKeys.generations.byShot(shotId) });
const previous = queryClient.getQueryData(queryKeys.generations.byShot(shotId));
queryClient.setQueryData(queryKeys.generations.byShot(shotId), (old) => [...old, newGen]);
```

**Sense-check:** After migrating each file, test the optimistic flow:
1. Perform action (e.g., delete generation)
2. Verify UI updates immediately (before server response)
3. Verify final state matches server after response

### 5.3 Sense-Check: Per-File Verification

After each file migration, test the specific feature:

| File | Test |
|------|------|
| `ImageGenerationForm/index.tsx` | Submit form → settings persist on reload |
| `SegmentSettingsModal.tsx` | Save segment settings → timeline updates |
| `PaymentSuccessPage.tsx` | Complete payment → credits update |
| `ShotsPage.tsx` | Create shot → appears in list |

---

## Phase 6: Add ESLint Rule (Prevention)

### 6.1 Create Custom ESLint Rule

**File:** `eslint-rules/no-inline-query-keys.js`

```javascript
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce using queryKeys registry instead of inline query keys',
    },
    messages: {
      useQueryKeys: 'Use queryKeys.* from @/shared/lib/queryKeys instead of inline query key',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check for useQuery, useMutation, invalidateQueries, etc.
        const callee = node.callee;
        if (callee.type === 'MemberExpression' &&
            ['invalidateQueries', 'setQueryData', 'refetchQueries'].includes(callee.property.name)) {
          const arg = node.arguments[0];
          if (arg?.type === 'ObjectExpression') {
            const queryKeyProp = arg.properties.find(p => p.key?.name === 'queryKey');
            if (queryKeyProp?.value?.type === 'ArrayExpression') {
              context.report({
                node: queryKeyProp,
                messageId: 'useQueryKeys',
              });
            }
          }
        }
      },
    };
  },
};
```

### 6.2 Add to ESLint Config

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'local/no-inline-query-keys': 'warn', // Start as warning, upgrade to error later
  },
};
```

### 6.3 Sense-Check: Rule Catches Violations

```bash
# Should report warnings for any remaining inline keys
npm run lint 2>&1 | grep "no-inline-query-keys"
```

---

## Phase 7: Final Validation

### 7.1 Run Full Audit Comparison

```bash
npx ts-node scripts/audit-cache-keys.ts --compare scripts/cache-audit-baseline.json
```

**Expected:** No missing invalidations compared to baseline.

### 7.2 Full Manual Test Suite

Re-run all tests from Phase 0:

- [ ] Create a generation → appears in gallery within 2s
- [ ] Set variant as primary → thumbnail updates in gallery
- [ ] Delete a shot → removed from shot list, generations cleaned up
- [ ] Complete a task → task list updates, generation appears
- [ ] Update tool settings → new generations use updated settings
- [ ] Update segment settings → timeline reflects changes
- [ ] Realtime updates from another tab → reflected in current tab
- [ ] Payment completion → credits update

### 7.3 Performance Check

Compare network waterfall before/after:

```bash
# Count queries on page load (before)
# Count queries on page load (after)
# Should be equal or fewer
```

### 7.4 Upgrade ESLint Rule to Error

```javascript
// .eslintrc.js
rules: {
  'local/no-inline-query-keys': 'error', // Now enforced
},
```

---

## Rollback Procedures

### Per-Phase Rollback

| Phase | Rollback Command |
|-------|------------------|
| 1 | `git checkout HEAD -- src/shared/lib/queryKeys.ts` |
| 2 | `git checkout HEAD -- src/shared/hooks/invalidation/` |
| 3 | `git checkout HEAD -- src/shared/hooks/invalidation/useGenerationInvalidation.ts` |
| 4 | `git checkout HEAD -- src/shared/providers/SimpleRealtimeProvider.tsx src/shared/lib/realtimeInvalidationMap.ts` |
| 5 | `git checkout HEAD -- <specific files>` |
| 6 | Remove rule from `.eslintrc.js` |

### Full Rollback

```bash
git revert --no-commit <first-commit>..<last-commit>
git commit -m "Revert: cache invalidation refactor (issues found)"
```

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| Files with inline query keys | 55 | 0 |
| Query key patterns | 38 scattered | 1 registry file |
| Invalidation hooks | 1 (generations) | 4 (all domains) |
| ESLint coverage | None | Error on violations |
| Test failures | 0 | 0 |
| Realtime latency | Baseline | ≤ Baseline |

---

## Timeline Estimate

| Phase | Scope |
|-------|-------|
| 0 | Preparation |
| 1 | Query key registry |
| 2 | Domain hooks |
| 3 | Generation migration |
| 4 | Realtime migration |
| 5 | Remaining inline calls |
| 6 | ESLint rule |
| 7 | Final validation |

---

## Decisions (Resolved)

### 1. Predicate-based invalidation
**Decision:** Keep predicate pattern where currently used.

Rationale: Predicates like `predicate: (q) => q.queryKey[0] === 'segment-child-generations'` are used for wildcard invalidation where we don't know the specific ID. This is functionally necessary for cases like "invalidate all segment children regardless of which segment".

The registry will include `*All` variants for these:
```typescript
segmentChildrenAll: createQueryKey(['segment-child-generations'] as const),
```

### 2. setQueryData optimistic updates
**Decision:** Yes, use the registry for all setQueryData calls.

Rationale:
- The key **must** match the query exactly for optimistic updates to work
- If someone refactors a query key but not the corresponding `setQueryData`, it silently breaks
- Using `queryKeys.*` ensures compile-time safety
- Type inference helps catch shape mismatches

**Example migration:**
```typescript
// Before
queryClient.setQueryData(['all-shot-generations', shotId], (old) => [...old, newGen]);

// After
queryClient.setQueryData(queryKeys.generations.byShot(shotId), (old) => [...old, newGen]);
```

### 3. Legacy key cleanup
**Decision:** Remove `['shot-generations', shotId]` - it's dead code.

**Evidence:**
- `['all-shot-generations', shotId]` → Actual query in `useShotGenerations.ts:177`
- `['shot-generations', shotId]` → Only invalidated (6 places), never queried

**Migration:**
1. Remove from `useGenerationInvalidation.ts:113`
2. Remove from `SimpleRealtimeProvider.tsx:327`
3. Remove from `SimpleRealtimeManager.ts:376,454,538`
4. Do NOT add to `queryKeys.ts` registry

**Sense-check:** Search codebase for any `useQuery` with `shot-generations` key before removing.

---

## Additional Phase: Legacy Cleanup

Insert after Phase 3:

### Phase 3.5: Remove Dead Query Keys

#### 3.5.1 Verify No Queries Use Legacy Keys

```bash
# Must return 0 results (excluding invalidation calls and docs)
grep -r "queryKey.*\['shot-generations'" src/ \
  | grep -v "invalidate" \
  | grep -v "cancelQueries" \
  | grep -v ".md:"
```

#### 3.5.2 Remove Legacy Invalidations

**Files to update:**

| File | Line | Change |
|------|------|--------|
| `useGenerationInvalidation.ts` | 113 | Delete line |
| `SimpleRealtimeProvider.tsx` | 327 | Delete line |
| `SimpleRealtimeManager.ts` | 376, 454, 538 | Delete lines |

#### 3.5.3 Sense-Check: Generation Flows Still Work

- [ ] Create generation → appears in gallery
- [ ] Realtime update from another tab → reflected
- [ ] Set variant as primary → thumbnail updates

If any fail, the legacy key was actually needed somewhere we missed. Revert and investigate.
