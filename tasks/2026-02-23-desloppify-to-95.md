# Plan: Desloppify Strict Score 93 → 95+

Current strict score: **93.0** | Verified: **95.3** | Objective: **95.8**

The strict score is a weighted average across 24 dimensions. The highest-weighted dimensions have the most leverage. This plan is organized by **impact** (weight × gap-to-95).

---

## Tier 1: Highest Impact (>80 weighted points)

### Mid Elegance — 89.0, weight 22x, impact 132pts

The single most impactful dimension. 8 open issues:

- [ ] **MediaGallery prop routing** — `src/shared/components/MediaGallery/index.tsx` (635 lines) routes ~50 props to MediaGalleryGrid. Pass hook return objects directly instead of destructuring/re-threading.
- [ ] **useInlineEditState return grouping** — `src/tools/edit-images/hooks/useInlineEditState.ts` (447 lines) returns 50+ flat fields. Group into sub-objects by concern (inpainting, reposition, img2img).
- [ ] **imageGeneration.ts IIFEs** — `src/shared/lib/tasks/imageGeneration.ts` lines 326-362 use IIFEs inside object spread. Extract named helpers (buildLoraMap, buildReferenceParams).
- [ ] **imageGeneration.ts lora validation duplication** — Identical validation in validateImageGenerationParams and validateBatchImageGenerationParams. Extract shared validateLoras() helper.
- [ ] **generateVideoService param count** — `src/tools/travel-between-images/components/ShotEditor/services/generateVideoService.ts` (654 lines), buildTravelRequestBody takes 24 params. Group into sub-objects.
- [ ] **clientThumbnailGenerator promise anti-pattern** — `src/shared/lib/clientThumbnailGenerator.ts` has nested callbacks (reader.onload → img.onload → canvas.toBlob). Refactor to async helpers.
- [ ] **useLineageChain N+1 queries** — `src/shared/hooks/useLineageChain.ts` does one Supabase query per ancestor in a while loop. Use RPC/recursive CTE.
- [ ] **Time formatting not shared** — `src/shared/hooks/useProcessingTimestamp.ts` and `useUpdatingTimestamp.ts` have separate relative-time implementations. Use shared `timeFormatting.ts`.

### High Elegance — 89.8, weight 22x, impact 114pts

10 open issues. Many overlap with already-fixed items (ShotActions was grouped, colors were fixed). Remaining:

- [ ] **Retro button hex colors** — `src/shared/components/ui/button.tsx` retro/retro-secondary variants still use inline hex (#e8e4db, #3a4a4a, #6a8a8a). Move to CSS custom properties. *(Note: we added --retro vars but the component may still have some inline hex for retro-secondary.)*
- [ ] **ShotActions hardcoded overlay colors** — bg-green-500, bg-gray-500/60 in ShotActions.tsx. Use semantic tokens.
- [ ] **ActiveLoRAsDisplay hardcoded colors** — bg-slate-50/50, dark:bg-slate-800/30. Replace with bg-muted or bg-card.
- [ ] **setTimeout hack in useMediaGalleryHandlers** — setTimeout(100ms) for state sequencing. Replace with synchronous state update (React 18 batching).
- [ ] **useAIInteractionService cleanup** — unused apiKey param, trivial wrapper, stale comments.
- [ ] **useApiKeys upsert** — manual check-then-insert-or-update. Replace with .upsert().
- [ ] **InstallInstructionsModal colors** — ~91 hardcoded gray instances. These are browser chrome mockups — add comment explaining they're intentional, or move to CSS vars.

### Type Safety — 88.0, weight 12x, impact 84pts

4 open issues:

- [ ] **Edge function auth.ts unknown types** — `supabase/functions/_shared/auth.ts` types supabaseAdmin as 'unknown'. Import SupabaseClient type.
- [ ] **useGenerationMutations casts** — Casts cache data to Array<Record<string, unknown>>. Use proper Shot[] type assertions.
- [ ] **createGeneration return type** — Returns Promise<Record<string, unknown>> instead of GenerationRow.
- [ ] **Dead interfaces in generationTaskBridge** — GenerationTaskMapping/TaskGenerationMapping never used. Delete.

---

## Tier 2: Medium Impact (20-80 weighted points)

### Contracts — 92.0, weight 12x, impact 36pts

- [ ] **complete_task fetchTaskContext supabase typed as unknown** — Add SupabaseClient type.
- [ ] **usePaginatedTasks placeholderData signature** — Non-standard vs React Query v5. Fix signature.

### Abstraction Fit — 90.5, weight 8x, impact 36pts

- [ ] **VideoLightbox flat props** — Check if the grouped-props refactor fully resolved this finding, or if the scanner still sees flat props.
- [ ] **VisibilityManager dead singleton** — `src/shared/lib/VisibilityManager.ts` (268 lines), zero importers. Delete.
- [ ] **generationTaskBridge dead code** — Unused interfaces. Delete.

### Convention Drift — 84.0, weight 3x, impact 33pts

- [ ] **Retro button hardcoded colors** — Same as High Elegance finding. Fix once.
- [ ] **process.env.NODE_ENV inconsistency** — 2 files still use process.env instead of import.meta.env.DEV.
- [ ] **Edge function dependency versions** — Three different Deno std versions and supabase-js import schemes. Standardize.

### Logic Clarity — 90.0, weight 6x, impact 30pts

- [ ] **createGeneration variant error swallowed** — Variant insert failure logged but function returns success. Should throw.
- [ ] **useTasks window global fallback** — Falls back to window.__PROJECT_CONTEXT__. Use React context.

### Low Elegance — 92.8, weight 12x, impact 26pts

- [ ] **Delete performanceUtils.ts** — Empty file, zero importers.
- [ ] **Fix debugRendering.ts** — Empty else-if branch + dead `changed` computation.
- [ ] **Remove _onClose param** — useInlineEditState.ts accepts but never uses it.
- [ ] **Fix React import pattern** — useTasks.ts mixes React.useRef with destructured imports.

### Structure Nav — 90.5, weight 5x, impact 22pts

- [ ] **Error handling path consolidation** — errorHandler.ts barrel coexists with errorHandling/ directory. Simplify.
- [ ] **queryKeys dual structure** — queryKeys.ts barrel + queryKeys/ directory. Clean up.
- [ ] **shared/utils/ parallel directory** — 7 files could move to shared/lib/.
- [ ] **Colocated test files** — 5 test files in src/shared/lib/ should be in __tests__/.
- [ ] **Rename pane-positioning/** — Already done? Verify.
- [ ] **Delete README from hooks** — src/shared/hooks/README_timestamp_updates.md.
- [ ] **Group debug files** — debugConfig.ts, debugPolling.ts, debugRendering.ts scattered in shared/lib root.

### Stale Migration — 88.0, weight 3x, impact 21pts

- [ ] **Deprecated shims still consumed** — Check useSegmentOutputsForShot, VideoPortionEditor, useSegmentSettings shims. *(Most were deleted — verify scanner reflects this.)*
- [ ] **Deprecated fields in ProjectImageSettings** — 7 @deprecated fields needed by migration hooks. Document as intentional.
- [ ] **useSegmentSettingsForm deprecated return fields** — 2 deprecated fields with zero consumers. Remove.

---

## Tier 3: Lower Impact (<20 weighted points)

### Test Strategy — 90.0, weight 3x, impact 15pts
- [ ] Fix supabaseTypeHelpers test gap
- [ ] Move colocated test files

### API Coherence — 91.0, weight 3x, impact 12pts
- [ ] Remove PendingClipAction.type dead field
- [ ] Consolidate localStorage token reading (3 files)

### Auth Consistency — 91.0, weight 3x, impact 12pts
- [ ] Add JWT auth to complete_task if missing
- [ ] Add CORS handling to complete_task

### Error Consistency — 94.0, weight 3x, impact 3pts
- [ ] Sanitize complete_task internal error messages
- [ ] Remove DataFreshnessManager success toast if present

---

## Mechanical Detectors (not weighted by dimension)

### Boilerplate Duplication — 90.6, 362 open findings
- [ ] **Delete 457 stub test files** — These are `expect(X).toBeDefined()` filler that account for most boilerplate_duplication findings. Single highest-impact mechanical action.

### Code Quality — responsibility_cohesion (10 issues, 0.3 pass rate)
- [ ] Split applySettingsService.ts into focused modules (15 functions in 12 disconnected clusters)
- [ ] Split taskCreation.ts (13 functions in 9 clusters)
- [ ] Split clipManagerService.ts (10 functions in 9 clusters)

### Props detector — 125 open findings
- [ ] Group props on remaining high-prop-count components: ShotImagesEditorProps (78), BatchModeContentProps (56), MediaLightboxProps (54), JoinClipsSettingsFormProps (50)

### File Health — 77 "needs decomposition" findings
Top targets:
- [ ] complete_task/index.ts (2576 LOC) — split into route handlers
- [ ] useShotEditorController.ts (938 LOC) — extract sub-controllers
- [ ] useTimelinePositions.ts (811 LOC) — extract position calculation helpers
- [ ] TimelineContainer.tsx (805 LOC) — extract sub-components
- [ ] VideoShotDisplay.tsx (798 LOC) — extract sub-components

---

## Execution Order

### Phase 1: Quick wins (30 min, ~+1.0 strict score)
Delete empty files, remove dead interfaces, fix imports, delete README, standardize process.env, remove unused params. These are 1-line changes that clear multiple findings.

### Phase 2: Stub test deletion (15 min, ~+1.5 strict score)
Delete the 457 stub test files. Biggest single action for boilerplate_duplication and ai_generated_debt.

### Phase 3: Mid/High Elegance fixes (2-3 hrs, ~+0.5 strict score)
Group params in generateVideoService, useInlineEditState. Extract helpers in imageGeneration.ts. Fix clientThumbnailGenerator. These target the two highest-weighted dimensions.

### Phase 4: Type Safety + Contracts (1 hr, ~+0.3 strict score)
Type the edge function auth, fix useGenerationMutations casts, clean generationTaskBridge.

### Phase 5: Structural splits (3-5 hrs, ~+0.5 strict score)
Split the worst god files: applySettingsService, complete_task/index.ts, useShotEditorController. High effort, moderate score impact but improves multiple dimensions.

### Phase 6: Remaining prop grouping (2-3 hrs, ~+0.3 strict score)
Group props on ShotImagesEditor, BatchModeContent, JoinClipsSettingsForm.

**Estimated total: 93.0 → ~96-97 strict score**
