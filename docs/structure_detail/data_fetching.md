# Data Fetching System

**Purpose**: Document which hooks own which data, how mutations invalidate caches, and when to use each hook.

**Source of Truth**: `src/shared/lib/queryKeys.ts` (all cache keys), `src/shared/hooks/invalidation/useGenerationInvalidation.ts` (invalidation patterns).

---

## Query Scopes

Three intentionally separate scopes for generation data. These are NOT duplication.

| Scope | Hook | Query Key | Table | Use Case |
|-------|------|-----------|-------|----------|
| Project | `useProjectGenerations` | `['unified-generations', 'project', projectId, ...]` | `generations` | Paginated gallery (GenerationsPane, MediaGallery) |
| Shot | `useShotImages` | `['all-shot-generations', shotId]` | `shot_generations` JOIN `generations` | Timeline, ShotEditor, shot image grids |
| Variant | `useVariants` | `['generation-variants', generationId]` | `generation_variants` | Lightbox variant switching |

### Derived/selector hooks (no separate queries)

| Hook | Derives From | Filters |
|------|-------------|---------|
| `useTimelineImages(shotId)` | `useShotImages` | Positioned, non-video, valid location |
| `useUnpositionedImages(shotId)` | `useShotImages` | Null timeline_frame, non-video |
| `useVideoOutputs(shotId)` | `useShotImages` | Video type only |
| `useDerivedItems(generationId)` | Own query `['derived-items', id]` | Edits/children of a generation |

---

## Mutation Ownership

Mutations live in `useGenerationMutations.ts` (re-exported from `useProjectGenerations.ts` for compatibility).

| Mutation Hook | Table | Invalidation |
|---------------|-------|-------------|
| `useDeleteGeneration` | `generations` | None (caller invalidates) |
| `useDeleteVariant` | `generation_variants` | None (caller invalidates) |
| `useUpdateGenerationLocation` | `generations` | None (caller invalidates) |
| `useCreateGeneration` | `generations` + `generation_variants` | None (caller invalidates) |
| `useToggleGenerationStar` | `generations` | Optimistic update on `unified-generations`, `shots`, `all-shot-generations` |

Variant mutations in `useVariants`:

| Mutation | Table | Invalidation |
|----------|-------|-------------|
| `setPrimaryVariant` | `generation_variants` | `invalidateVariantChange()` — variants, detail, badges, all shot-generations, unified |
| `deleteVariant` | `generation_variants` | `invalidateVariantChange()` |

---

## Invalidation Patterns

### Centralized: `useGenerationInvalidation.ts`

| Function | When to Use | What It Invalidates |
|----------|------------|-------------------|
| `useInvalidateGenerations()(shotId, opts)` | After shot-scoped changes (reorder, add/remove from shot) | `all-shot-generations`, `segment-live-timeline`, `shot-generations-meta`, `unpositioned-count` (scoped by `opts.scope`) |
| `invalidateVariantChange(qc, opts)` | After variant create/update/set-primary | Variants, detail, badges, all shot-generations (broad), unified, derived, segment children/sources |
| `invalidateGenerationUpdate(qc, opts)` | After generation data change (not variant) | Detail, unified, derived, segment children/parents |
| `invalidateAllShotGenerations(qc, reason)` | Global fallback (avoid if possible) | All `all-shot-generations` queries via predicate |

### Realtime: `SimpleRealtimeProvider`

Listens to Supabase realtime events, dispatches batched custom events, invalidates caches:

| Event | Triggers | Invalidation |
|-------|----------|-------------|
| `realtime:task-update-batch` | Task status changes | `tasks.*`, and if Complete: `unified`, `all-shot-generations`, segments |
| `realtime:task-new-batch` | New tasks created | `tasks.*` only (no generation data yet) |
| `realtime:shot-generation-change-batch` | `shot_generations` INSERT/UPDATE/DELETE | `all-shot-generations` per shot (skips for INSERT-only to avoid flicker) |
| `realtime:generation-update-batch` | `generations` UPDATE (location, upscale) | `unified`, `all-shot-generations` (broad), `shots`, detail |
| `realtime:generation-insert-batch` | `generations` INSERT (new children) | `unified`, `all-shot-generations` (broad), detail |
| `realtime:variant-change-batch` | `generation_variants` changes | Per-generation variants + badges, `unified`, `all-shot-generations` (broad) |

### Smart Polling (fallback)

`DataFreshnessManager` + `useSmartPollingConfig` provides intelligent polling when realtime is unhealthy. Hooks opt in via `useSmartPollingConfig(['namespace', id])`.

---

## When to Use Which Hook

| I want to... | Use |
|-------------|-----|
| Show a paginated gallery of all project generations | `useProjectGenerations(projectId, page, limit, enabled, filters)` |
| Show images in a shot's timeline or grid | `useShotImages(shotId)` |
| Get only positioned timeline images | `useTimelineImages(shotId)` |
| Get unpositioned images for a shot | `useUnpositionedImages(shotId)` |
| Get video outputs for a shot | `useVideoOutputs(shotId)` |
| Show/switch variants in lightbox | `useVariants({ generationId })` |
| Show edits/children of a generation | `useDerivedItems(generationId)` |
| Delete/star/create generations | Import from `useGenerationMutations` |
| Invalidate after shot-scoped changes | `useInvalidateGenerations()` |
| Invalidate after variant changes | `invalidateVariantChange()` |

---

## Key Invariants

1. **Three scopes, three hooks** — project, shot, variant. Don't merge them.
2. **Mutations in `useGenerationMutations.ts`** — not in query hooks.
3. **All query keys in `queryKeys` registry** — no hardcoded strings.
4. **Optimistic updates only in `useToggleGenerationStar`** — other mutations rely on invalidation.
5. **Realtime → invalidation, not direct cache updates** — keeps cache consistent with DB.
6. **Smart polling is fallback** — primary freshness comes from realtime events.
