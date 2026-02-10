# Backwards Coupling Cleanup: shared/ → tools/ Dependencies

**Impact**: Architectural integrity. Shared code should never import from tool-specific code.
**Effort**: 1-2 hours. Small, surgical changes.
**Status**: DONE

## Problem

Two shared files directly import from tool-specific code, violating the dependency direction (`tools/ → shared/`, never the reverse). Plus ~8 instances of hardcoded tool-type strings in shared code.

## Critical: Direct Imports

### 1. `useEditVideoSettings` imports from `@/tools/edit-video/settings`

**Status**: FIXED

Moved `editVideoSettings` + `EditVideoSettings` to `src/shared/lib/editVideoDefaults.ts`.
`tools/edit-video/settings.ts` now re-exports from shared.
`shared/hooks/useEditVideoSettings.ts` imports from `shared/lib/editVideoDefaults.ts`.

### 2. `createJoinClipsTask` imports from `@/tools/join-clips/settings`

**Status**: FIXED

Moved `joinClipsSettings` + `JoinClipsSettings` to `src/shared/lib/joinClipsDefaults.ts`.
`tools/join-clips/settings.ts` now re-exports from shared.
`shared/lib/tasks/joinClips.ts` imports from `shared/lib/joinClipsDefaults.ts`.

## Medium: Hardcoded Tool-Type Strings

| File | String | Status | Notes |
|------|--------|--------|-------|
| `useShotNavigation.ts` | `/tools/travel-between-images` URLs | FIXED | Uses `TOOL_ROUTES` + `travelShotUrl()` from `shared/lib/toolRoutes.ts` |
| `TasksPane/hooks/useTaskNavigation.ts` | `/tools/travel-between-images#` URLs (3x) | FIXED | Uses `travelShotUrl()` from `shared/lib/toolRoutes.ts` |
| `ProductTour/index.tsx` | `/tools/travel-between-images` | FIXED | Uses `TOOL_ROUTES.TRAVEL_BETWEEN_IMAGES` |
| `ImageGenerationModal.tsx` | `/tools/image-generation` | FIXED | Uses `TOOL_ROUTES.IMAGE_GENERATION` |
| `MediaLightbox/hooks/useJoinClips.ts` | `/tools/join-clips` | FIXED | Uses `TOOL_ROUTES.JOIN_CLIPS` |
| `GenerationsPane/GenerationsPane.tsx` | `/tools/image-generation` (2x) | FIXED | Uses `TOOL_ROUTES.IMAGE_GENERATION` |
| `app/Layout.tsx` | `/tools/travel-between-images` (2x) | FIXED | Uses `TOOL_ROUTES.TRAVEL_BETWEEN_IMAGES` |
| `individualTravelSegment.ts` | `tool_type: 'travel-between-images'` | SKIPPED | Database value in travel-specific task creation file — acceptable |
| `generationTransformers.ts` | `params?.tool_type === 'travel-between-images'` | SKIPPED | Reads stored DB value — data-driven, not a coupling issue |
| `settingsMigration.ts` | `shots.settings['travel-between-images']` | SKIPPED | Migration code — inherently tool-specific |
| `preloader.ts` | `url.includes('_joined_frame.jpg')` | SKIPPED | URL pattern check, not a tool ID |
| `useProjectGenerationModesCache.ts` | `const toolId = 'travel-between-images'` | SKIPPED | Settings lookup key in travel-specific cache — acceptable |
| `ToolsPane.tsx` | Tool manifest with all tool IDs | SKIPPED | IS the registry — acceptable |

## New Files Created

- `src/shared/lib/editVideoDefaults.ts` — canonical edit-video settings definition
- `src/shared/lib/joinClipsDefaults.ts` — canonical join-clips settings definition
- `src/shared/lib/toolRoutes.ts` — shared tool route path constants + `travelShotUrl()` helper

## Verification

```bash
# Zero shared → tools imports:
grep -r "from '@/tools/" src/shared/ --include="*.ts" --include="*.tsx" | grep -v node_modules
# (no output)

# Zero hardcoded tool route strings in shared (except the constants file):
grep -rn "'/tools/" src/shared/ --include="*.ts" --include="*.tsx"
# Only hits in src/shared/lib/toolRoutes.ts

# Type check passes:
npx tsc --noEmit
# (clean)
```

## Checklist

- [x] Move `editVideoSettings` defaults to `src/shared/lib/editVideoDefaults.ts`
- [x] Update `useEditVideoSettings.ts` import
- [x] Update `tools/edit-video/settings.ts` to re-export from shared
- [x] Move `joinClipsSettings` defaults to `src/shared/lib/joinClipsDefaults.ts`
- [x] Update `joinClips.ts` import
- [x] Update `tools/join-clips/settings.ts` to re-export from shared
- [x] Create `src/shared/lib/toolRoutes.ts` with route constants
- [x] Replace hardcoded route strings in 7 shared files
- [x] Verify: `grep -r "from '@/tools/" src/shared/` → no results
- [x] `npx tsc --noEmit` → clean
