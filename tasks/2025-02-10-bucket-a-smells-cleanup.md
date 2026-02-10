# Bucket A: Mechanical Smells Cleanup

**Score impact**: 40 items, 120 weighted points. Strict 80 → ~82 if all resolved.
**Effort**: Hours. Each fix is small and localized.

## Overview

40 code smell findings across 6 categories, all wontfixed with notes explaining why they were skipped during the T3 cleanup pass. Most were skipped because the fix wasn't obvious in a batch review — but with focused attention, many are fixable.

## How to find them

```bash
# All open smells (should be 0 — these are wontfixed, so use --status)
python3 -m scripts.decruftify show smells --status wontfix

# Or filter to specific smell types:
python3 -m scripts.decruftify show "smells::*::console_error_no_throw" --status wontfix
python3 -m scripts.decruftify show "smells::*::hardcoded_rgb" --status wontfix
python3 -m scripts.decruftify show "smells::*::magic_number" --status wontfix
```

## Categories

### 1. `console_error_no_throw` (17 items, 51w) — MIXED

These are `console.error()` calls without a corresponding `throw` or user-facing error. Each was reviewed and given a per-item note. Re-review each note and decide:

- **Already handled** (toast shown, state reset, throw follows): reclassify as `false_positive`
- **Silent failure** (error swallowed, user sees nothing): add `toast.error()` or `throw`
- **Defensive catch** (protecting event loops from subscriber bugs): reclassify as `false_positive`

Files:
| File | Note |
|------|------|
| `AppErrorBoundary.tsx` | Error boundary — logging IS the purpose |
| `TaskItem.tsx` | Already shows toast + clearVideoWaiting |
| `ProjectContext.tsx` | localStorage fallbacks (non-critical) |
| `RealtimeConnection.ts` | 5x defensive catches in subscriber dispatch |
| `RealtimeEventProcessor.ts` | Defensive catch in event loop |
| `useVideoPlayback.ts` | 4x video play/capture with UI recovery |
| `useTrainingData.ts` | 10x immediately followed by throw |
| `BatchSettingsForm.tsx` | Dev-time validation warning |
| `SharedGenerationView.tsx` | Already shows toast + resets loading |
| `useApplySettingsHandler.ts` | Fixed outer; remaining before throw |
| `useGenerationActions.ts` | Already followed by toast + return |
| `applySettingsService.ts` | All followed by return |
| `generateVideoService.ts` | Already followed by toast + return |
| `Header.tsx` | Debounced — reverts optimistic update via setState |
| `useTimelinePositions.ts` | Dup detection with toast + return |
| `useJoinSegmentsSettings.ts` | Fire-and-forget .catch() |
| `useShotSettings.ts` | Fire-and-forget .catch() |

**Recommendation**: Re-read each note. Most of these were correctly wontfixed (the error IS handled, just not via throw). Reclassify the clearly-valid ones as `false_positive`. Fix the 2-3 that are genuinely silent failures.

### 2. `hardcoded_rgb` (17 items, 51w) — MOSTLY FALSE POSITIVE

Hardcoded RGB/hex color values instead of CSS variables or Tailwind tokens.

| Category | Count | Action |
|----------|-------|--------|
| Retro theme CVA variants (`ui/*.tsx`) | 10 | **False positive** — these ARE the design system definition |
| Canvas API (`ConstellationCanvas.tsx`) | 1 | **False positive** — Canvas can't use CSS vars |
| Dark-mode forced styling (`HeroSection.tsx`, `GlobalHeader.tsx`) | 2 | **False positive** — intentional overrides |
| Inline shadows/glows (various) | 4 | **Evaluate** — could some use Tailwind shadow utilities? |

**Recommendation**: Reclassify the 13 design-system/canvas/intentional ones as `false_positive`. Evaluate the 4 inline shadows individually.

### 3. `magic_number` (3 items, 9w) — FALSE POSITIVE

All in training-data-helper:
- `VideoPlayerControls.tsx`: `*100` in percentage calc, `0.1` range step
- `VideoUploadList.tsx`: `0`, `2`, `60` (obvious constants)
- `settings.ts`: Settings config with inline comments

**Recommendation**: Reclassify all 3 as `false_positive`. These are self-documenting.

### 4. `any_type` (1 item, 3w) — FALSE POSITIVE

`queryKeys.ts`: TypeScript conditional type inference with `infer` requires `any[]`.

**Recommendation**: `false_positive` — language limitation.

### 5. `ts_ignore` (1 item, 3w) — ALREADY FIXED

`logger.ts`: Already replaced with `@ts-expect-error` + comments.

**Recommendation**: `false_positive` — already the best it can be.

### 6. `hardcoded_color` (1 item, 3w) — FALSE POSITIVE

`HeroSection.tsx`: Dark-mode hero animation spotlight colors.

**Recommendation**: `false_positive`.

## Execution

```bash
# 1. Reclassify the clear false positives (estimated ~30 of 40)
python3 -m scripts.decruftify resolve false_positive \
  "smells::src/shared/lib/queryKeys.ts::any_type" \
  "smells::src/shared/lib/logger.ts::ts_ignore" \
  --note "Language/platform limitation, not fixable"

# ... (resolve each batch with specific notes)

# 2. Fix the 2-3 genuinely silent failures
# - Add toast.error() where errors are swallowed
# - Or add throw where the caller should handle it

# 3. Rescan to verify
python3 -m scripts.decruftify scan --path src/

# 4. Check the score
python3 -m scripts.decruftify status
```

## Expected outcome

~30 reclassified as `false_positive`, ~5 actually fixed, ~5 remain as `wontfix`. Strict score: 80 → ~82.
