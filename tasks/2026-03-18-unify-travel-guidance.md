# Plan: Unify Batch and Segment Travel Guidance on the Existing Defaults/Overrides System

## Summary

Make both batch generation and individual segment regeneration use the same shared travel settings
model and the same two-layer persistence model that already exists:

- Shot-level defaults remain the base source of truth (two stores: `travel-between-images` for
  motion config, `travel-structure-video` for canonical structure videos + guidance).
- Segment regeneration stores only explicit per-segment overrides in
  `shot_generations.metadata.segmentOverrides`.
- Batch and segment both render the same model-aware guidance editor from the same normalized state.

This plan extends the current shot defaults + segmentOverrides pattern so model selector, travel
guidance mode, and LTX-specific controls all participate in the same inheritance model as
prompt/motion/LoRAs already do. No parallel "segment travel settings" system.

## Current State (verified)

### Two shot-level settings stores (intentional, keep both)

| Store key | Access hook | Contains |
|-----------|-------------|----------|
| `travel-between-images` | `useShotSettings()` | General motion config: prompt, frames, motion, model, LoRAs, legacy `structureVideo` (vestigial) |
| `travel-structure-video` | `useStructureVideo()` | Canonical structure videos array, `travel_guidance`, `travel_guidance_by_model`, `structure_guidance` |

The split exists because structure videos are per-shot canvas state accessed independently during
segment regeneration. The regeneration path (`useVideoRegenerateMode`) reads exclusively from
`travel-structure-video`.

### Current SegmentSettings type (flat, no model fields)

```typescript
interface SegmentSettings {
  prompt, negativePrompt, textBeforePrompts?, textAfterPrompts?,
  motionMode, amountOfMotion, phaseConfig?, selectedPhasePresetId,
  loras, numFrames, randomSeed, seed?,
  makePrimaryVariant,
  structureMotionStrength?, structureTreatment?, structureUni3cEndPercent?
}
type SegmentOverrides = Partial<Omit<SegmentSettings, 'makePrimaryVariant'>>
```

No model selection, no guidance mode, no LTX guidanceScale. The `structure*` fields map to a
subset of what `TravelGuidanceControls` represents.

### Current UI gap

| Control | Batch (BatchModeContent) | Segment (StructureVideoSection) |
|---------|--------------------------|--------------------------------|
| Model family selector | Button pills (WAN vs LTX) | None |
| LTX variant selector | Button pills (Full vs Distilled) | None |
| Guidance mode selector | Button pills (model-aware options) | Read-only badge |
| Treatment (adjust/clip) | Separate in BatchSettingsForm | SegmentedControl (timeline only) |
| Strength slider | Yes | Yes + "Set as Default" |
| Uni3C end % slider | Yes (conditional on mode) | Yes + "Set as Default" |
| Full LTX warning | Yes | None |

### Existing normalized UI type

`TravelGuidanceControls` already exists in `travelGuidance.ts`:

```typescript
interface TravelGuidanceControls {
  mode: TravelGuidanceMode      // 'uni3c' | 'flow' | 'canny' | 'depth' | 'raw' | 'pose' | 'video'
  strength: number               // 0-1
  uni3cEndPercent: number         // 0-1
  cannyIntensity?: number
  depthContrast?: number
}
```

## Persistence Model

### 1. Keep the two-store split

No changes to the shot-level storage layout:

- `travel-between-images` → general motion config + model selection
- `travel-structure-video` → canonical structure videos + guidance

### 2. Expand SegmentOverrides with guidance + model fields (flat)

Add new flat fields to `SegmentSettings`:

```typescript
interface SegmentSettings {
  // ... existing fields ...

  // NEW: model override
  modelName?: string                       // e.g. 'wan-2.1', 'ltx-video-0.9.7-distilled'

  // NEW: guidance controls (replacing the 3 structure* fields)
  guidanceMode?: TravelGuidanceMode        // replaces implicit mode from structureVideoType
  guidanceStrength?: number                 // replaces structureMotionStrength
  guidanceTreatment?: 'adjust' | 'clip'    // replaces structureTreatment
  guidanceUni3cEndPercent?: number          // replaces structureUni3cEndPercent
  guidanceCannyIntensity?: number           // NEW
  guidanceDepthContrast?: number            // NEW
  ltxGuidanceScale?: number                 // NEW: LTX-specific
}
```

**Why flat, not nested**: The existing override resolution uses `??` on flat fields. Nesting under
a `guidance: Partial<TravelGuidanceControls>` object would require deep merge, changing the merge
logic throughout `useSegmentSettings`. Not worth it for ~7 fields.

**Migration of existing fields**: The 3 existing `structure*` fields map to `guidance*` fields.
Handle in `readSegmentOverrides` (read-side migration, same pattern as the 20260125 migration):

- `structureMotionStrength` → `guidanceStrength`
- `structureTreatment` → `guidanceTreatment`
- `structureUni3cEndPercent` → `guidanceUni3cEndPercent`

Read both old and new names; write only new names. No SQL migration needed — the read-side
migration in `readSegmentOverrides` already handles this pattern with defensive type coercion.

### 3. Override semantics (unchanged)

- absent field = inherit shot default
- explicit value = override shot default
- reset/restore default = clear the override key from metadata

### 4. Diff semantics for model-dependent defaults

When diffing segment state against shot defaults to decide what to persist:

- Always diff against **shot-level values as stored**, not re-derived for a different model.
- If the user picks a different model for a segment, store the model override AND any guidance
  fields that differ from shot defaults.
- A model change at shot level propagates to segments without a model override (standard
  inheritance). Segments with an explicit model override keep their model.

This keeps the mental model simple: overrides = "what differs from shot level."

## Shared State / UI Architecture

### 5. Shared travel guidance editor component

Create a controlled component (not a hook) that both batch and segment host:

```tsx
<TravelGuidanceEditor
  // Data (effective values after inheritance)
  modelName={effectiveModel}
  guidanceMode={effectiveMode}
  strength={effectiveStrength}
  treatment={effectiveTreatment}
  uni3cEndPercent={effectiveEndPercent}
  cannyIntensity={effectiveCannyIntensity}
  depthContrast={effectiveDepthContrast}
  ltxGuidanceScale={effectiveLtxScale}

  // Context
  hasStructureVideo={!!structureVideoUrl}
  availableModels={availableModels}           // from tool config
  supportedGuidanceModes={supportedModes}     // derived from model

  // Capabilities (host decides what's editable)
  canSelectModel={true}
  canSelectGuidanceMode={true}
  canSetAsDefault={isSegmentMode}

  // Handlers
  onChange={handleGuidanceChange}              // partial update: { mode?, strength?, ... }
  onSetFieldAsDefault={handleSetDefault}       // segment only
/>
```

**Structure video upload stays separate.** Batch uses `BatchGuidanceVideo` (shot-level, one video).
Segment uses `StructureVideoSection` upload/preview (per-pair, timeline mode). The guidance editor
takes `hasStructureVideo` as input — it doesn't own the upload UX.

### 6. Host responsibilities

**Batch host** (BatchModeContent):
- Provides model from shot-level settings
- Provides guidance state from `travel-structure-video` settings
- `onChange` writes to shot-level settings stores
- `canSetAsDefault = false` (these ARE the defaults)

**Segment host** (SegmentSettingsForm / SegmentRegenerateForm):
- Merges shot defaults + segment overrides via `useSegmentSettings` (existing pattern)
- Passes effective values to editor
- `onChange` writes to local segment form state
- `canSetAsDefault = true` → calls `saveFieldAsDefault` on the shot-level store
- `onSetFieldAsDefault` clears the segment override for that field

### 7. Full LTX handling

Both hosts render the same warning from `TravelGuidanceEditor` when model is full LTX: guidance
editing is hidden, only the "unguided" message appears. No special-casing needed per host.

## Payload and Save Behavior

### 8. Single normalized write path

Both batch and segment build request payloads through:

1. Effective `TravelGuidanceControls` (from editor state)
2. `buildTravelGuidanceFromControls(modelName, structureVideos, controls)` → `TravelGuidance`
3. Include in task params as `travel_guidance`

No segment-only reconstruction from `structureVideoType + strength + treatment`. The current
segment path in `submitSegmentTask` that manually builds guidance from the 3 structure fields
gets replaced by the same `buildTravelGuidanceFromControls` call the batch path uses.

### 9. Save paths honor inheritance

**Shot-level save**: write to existing stores (`travel-between-images` for model,
`travel-structure-video` for guidance).

**Segment-level save**: diff effective state against shot defaults → write only changed fields
into `segmentOverrides`. Clearing a field removes the override key.

**"Set as Shot Defaults"**: write to shot-level store, then clear the corresponding segment
override. Existing pattern, unchanged.

## Implementation Order

### Phase 1: Type expansion + read/write migration
- [ ] Add new `guidance*`, `modelName`, `ltxGuidanceScale` fields to `SegmentSettings`
- [ ] Update `readSegmentOverrides` to read new fields + migrate old `structure*` names
- [ ] Update `writeSegmentOverrides` to write new fields
- [ ] Update `detectOverrides` and `SegmentOverrideFlags` for new fields
- [ ] Tests: round-trip read/write, legacy field migration, override detection

### Phase 2: Shared editor component
- [ ] Extract `TravelGuidanceEditor` from BatchModeContent's guidance controls
- [ ] Props contract: model, mode, strength, treatment, uni3c, canny, depth, ltxScale, capabilities
- [ ] Include model selector, guidance mode pills, sliders, full-LTX warning
- [ ] Wire into BatchModeContent (replacing inline controls)
- [ ] Tests: renders correct modes per model, hides controls for full LTX

### Phase 3: Segment integration
- [ ] Wire `TravelGuidanceEditor` into SegmentSettingsForm / SegmentRegenerateForm
- [ ] Remove old `StructureVideoSection` guidance badge + reduced controls
- [ ] Keep `StructureVideoSection` for upload/preview/replace (timeline mode)
- [ ] Add "Set as Default" per-field controls for guidance fields
- [ ] Update `submitSegmentTask` to use `buildTravelGuidanceFromControls` instead of manual build
- [ ] Tests: segment inherits shot model, segment overrides model, segment inherits guidance mode

### Phase 4: Payload unification
- [ ] Verify batch and segment produce identical `TravelGuidance` for identical effective state
- [ ] Remove segment-only guidance reconstruction code
- [ ] Tests: equivalent states → equivalent payloads, model override flows through to payload

## Tests (comprehensive list)

### Inheritance
- Shot travel defaults + shot structure defaults + segment overrides → correct effective state
- Clearing a segment field falls back to shot default
- Model change at shot level propagates to segments without model override
- Segments with explicit model override keep their model after shot-level model change

### UI parity
- Batch and segment render same model/guidance options for same effective state
- Segment shows LTX guidanceScale when selected model supports it
- Full LTX hides guidance editing in both hosts
- Guidance mode options update when model changes (both hosts)

### Save
- Shot save writes to existing stores (travel-between-images + travel-structure-video)
- Segment save writes only sparse overrides into metadata.segmentOverrides
- "Set as Shot Defaults" updates shot-level store AND clears segment override for that field
- Segment with model override: diffed against shot defaults as-is, not re-derived

### Payload
- Equivalent batch and segment editor states → equivalent canonical travel_guidance
- Segment payload includes model override and LTX fields when overridden
- Segment without overrides produces same payload as batch for that shot

### Backward compat
- Old segments with `structureMotionStrength` read correctly as `guidanceStrength`
- Old segments without new fields inherit from shot defaults (no crash, no null)
- No SQL migration required (read-side only)

### Regression
- No badge-only segment guidance UI
- No silent drop of LTX settings in segment regen
- Model selector available in segment regen when structure video present

## Assumptions (verified)

- The two-store split (`travel-between-images` / `travel-structure-video`) is intentional and
  remains. Verified: regeneration path reads exclusively from `travel-structure-video`.
- Worker contract: full LTX unguided only, distilled LTX guided, WAN/VACE guided.
- Segment regeneration remains override-based (sparse), not an independent settings silo.
- No SQL migration needed: `readSegmentOverrides` already handles read-side migration with
  defensive type coercion (proven pattern from 20260125 migration).
- `GenerationMetadata` has `[key: string]: unknown`, safe for new fields without schema changes.
