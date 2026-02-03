# God Objects Refactoring Plan

## Summary

Analyzed three files criticized as "God Objects":

| File | Lines | Actually God Object? | Priority |
|------|-------|---------------------|----------|
| `useSharedLightboxState` | 674 | ❌ No - justified orchestrator | Low |
| `ProjectContext` | 1,036 | ✅ Yes - unrelated domains tangled | **High** |
| `useRepositionMode` | 859 | ✅ Yes - mixed abstraction levels | Medium |

---

## 1. ProjectContext (HIGH PRIORITY)

**Location:** `src/shared/contexts/ProjectContext.tsx`

**Problem:** Mixes 3 unrelated domains:
- **Auth** (user ID, auth state changes, debouncing)
- **User Preferences** (settings fetch/update, mobile recovery)
- **Projects CRUD** (fetch, create, update, delete, selection)

These have different change frequencies, data sources, and consumers.

### Refactoring Plan

#### Phase 1: Extract AuthContext

```
src/shared/contexts/AuthContext.tsx (~150 lines)
├── State: userId, isAuthenticated
├── Auth state change listener
├── Duplicate event debouncing
└── Fast resume localStorage persistence
```

**Consumers:** ProjectContext (internal), TopNav, ProtectedRoutes

#### Phase 2: Extract UserPreferencesContext

```
src/shared/contexts/UserPreferencesContext.tsx (~150 lines)
├── State: userPreferences, isLoadingPreferences
├── fetchUserPreferences()
├── updateUserPreferences()
├── Mobile recovery timeout handling
└── Depends on: AuthContext (userId)
```

**Consumers:** Settings panels, LoRA preferences, UI state

#### Phase 3: Slim ProjectContext

```
src/shared/contexts/ProjectContext.tsx (~400 lines, down from 1,036)
├── State: projects, selectedProjectId, loading states
├── fetchProjects()
├── addNewProject() (with settings inheritance)
├── updateProject()
├── deleteProject()
├── Project selection logic (localStorage + server sync)
└── Depends on: AuthContext (userId), UserPreferencesContext
```

### Migration Strategy

1. Create AuthContext, have ProjectContext consume it internally first
2. Extract UserPreferencesContext, keep ProjectContext re-exporting for compatibility
3. Update consumers incrementally (30+ files) to use specific contexts
4. Remove re-exports once migration complete

### Files to Update
- [ ] `src/shared/contexts/AuthContext.tsx` (new)
- [ ] `src/shared/contexts/UserPreferencesContext.tsx` (new)
- [ ] `src/shared/contexts/ProjectContext.tsx` (slim)
- [ ] `src/shared/contexts/index.ts` (exports)
- [ ] Update 30+ consumer files gradually

---

## 2. useRepositionMode (MEDIUM PRIORITY)

**Location:** `src/shared/hooks/useRepositionMode.ts`

**Problem:** Mixes 5 domains at different abstraction levels:
1. Transform state management (pure UI state)
2. Canvas rendering & image processing (browser APIs)
3. Drag-to-move interaction (event handlers)
4. Inpaint task creation (business logic + API)
5. Variant persistence (database + React Query)

### Refactoring Plan

#### Extract 1: useImageTransform (~100 lines)

```typescript
// src/shared/hooks/reposition/useImageTransform.ts
export function useImageTransform(initialVariantId: string | null) {
  // Transform state (translateX, translateY, scale, rotation, flipH, flipV)
  // Per-variant transform caching
  // Transform setters and reset
  // hasTransformChanges computation
}
```

#### Extract 2: useCanvasTransform (~150 lines)

```typescript
// src/shared/hooks/reposition/useCanvasTransform.ts
export function useCanvasTransform() {
  // getTransformStyle() - CSS transform generation
  // createTransformedCanvas() - canvas manipulation
  // Canvas utility functions
}
```

#### Extract 3: useRepositionDrag (~80 lines)

```typescript
// src/shared/hooks/reposition/useRepositionDrag.ts
export function useRepositionDrag(transform, setTransform, scale) {
  // Drag state (isDragging)
  // Pointer event handlers (down, move, up, cancel)
  // Delta calculation with scale awareness
}
```

#### Extract 4: Mask Generation Utility (~60 lines)

```typescript
// src/shared/lib/maskGeneration.ts
export function generateMaskFromCanvas(
  canvas: HTMLCanvasElement,
  threshold: number,
  dilationPixels: number
): HTMLCanvasElement {
  // Alpha threshold logic
  // Mask dilation algorithm
  // Green background fill
}
```

#### Extract 5: useRepositionTaskCreation (~200 lines)

```typescript
// src/shared/hooks/reposition/useRepositionTaskCreation.ts
export function useRepositionTaskCreation(
  transform: ImageTransform,
  createTransformedCanvas: () => Promise<HTMLCanvasElement>
) {
  // handleGenerateReposition()
  // Mask generation via utility
  // Upload handling
  // Task creation via createImageInpaintTask()
  // Success state management
}
```

#### Extract 6: useRepositionVariantSave (~180 lines)

```typescript
// src/shared/hooks/reposition/useRepositionVariantSave.ts
export function useRepositionVariantSave(
  transform: ImageTransform,
  createTransformedCanvas: () => Promise<HTMLCanvasElement>
) {
  // handleSaveAsVariant()
  // Thumbnail generation
  // Upload handling
  // DB insertion logic
  // Cache invalidation
}
```

#### Final: useRepositionMode Orchestrator (~50 lines)

```typescript
// src/shared/hooks/useRepositionMode.ts
export function useRepositionMode(props) {
  const transform = useImageTransform(props.variantId);
  const canvas = useCanvasTransform();
  const drag = useRepositionDrag(transform.state, transform.setTransform, props.scale);
  const taskCreation = useRepositionTaskCreation(transform.state, canvas.createTransformedCanvas);
  const variantSave = useRepositionVariantSave(transform.state, canvas.createTransformedCanvas);

  return { ...transform, ...drag, ...taskCreation, ...variantSave };
}
```

### Files to Create
- [ ] `src/shared/hooks/reposition/useImageTransform.ts`
- [ ] `src/shared/hooks/reposition/useCanvasTransform.ts`
- [ ] `src/shared/hooks/reposition/useRepositionDrag.ts`
- [ ] `src/shared/hooks/reposition/useRepositionTaskCreation.ts`
- [ ] `src/shared/hooks/reposition/useRepositionVariantSave.ts`
- [ ] `src/shared/lib/maskGeneration.ts`
- [ ] Refactor `src/shared/hooks/useRepositionMode.ts` to orchestrator

---

## 3. useSharedLightboxState (LOW PRIORITY - Optional)

**Location:** `src/shared/hooks/useSharedLightboxState.ts`

**Finding:** NOT a true God Object. It's a well-architected orchestrator that:
- Delegates to 17+ specialized hooks
- Groups return values into 7 namespaces
- The 11 concerns ARE inherently coupled by the Lightbox UI pattern

### Optional Improvements

If props become unwieldy (currently 50+), consider:

1. **Group input props via context providers** in parent components:
   ```typescript
   // Instead of passing 10 shot-related props
   <ShotManagementProvider shotId={...} onAddToShot={...}>
     <ImageLightbox />  // reads from context
   </ShotManagementProvider>
   ```

2. **Extract layout calculation** (~60 lines):
   ```typescript
   // src/shared/hooks/lightbox/useLightboxLayout.ts
   export function useLightboxLayout(isTabletMode, isPortrait, generation) { ... }
   ```

**Recommendation:** Leave as-is unless props management becomes a maintenance burden.

---

## Master Checklist

### Phase 1: ProjectContext Split (High Priority)
- [ ] Create `AuthContext.tsx` with auth state and userId
- [ ] Create `UserPreferencesContext.tsx` with preferences
- [ ] Update `ProjectContext.tsx` to consume new contexts
- [ ] Add re-exports for backward compatibility
- [ ] Update docs: `docs/structure_detail/settings_system.md`
- [ ] Gradually migrate consumers to use specific contexts
- [ ] Remove re-exports once migration complete

### Phase 2: useRepositionMode Split (Medium Priority)
- [ ] Create `reposition/` directory with extracted hooks
- [ ] Extract `maskGeneration.ts` utility
- [ ] Refactor main hook to orchestrator pattern
- [ ] Update consumers (ImageLightbox, InlineEditView)
- [ ] Add unit tests for mask generation utility

### Phase 3: useSharedLightboxState (Optional)
- [ ] Only if props become maintenance burden
- [ ] Consider context-based prop grouping
- [ ] Extract layout calculation if helpful

---

## Benefits After Refactoring

| Metric | Before | After |
|--------|--------|-------|
| ProjectContext lines | 1,036 | ~400 (+ 2 new contexts @ 150 each) |
| useRepositionMode lines | 859 | ~50 (+ 5 extracted hooks @ 100-200 each) |
| Testability | Low (mocking 10+ domains) | High (isolated concerns) |
| New developer onboarding | Read 1,000+ lines | Read specific 100-200 line hook |
| Adding features | Modify god object + all consumers | Modify specific hook only |
