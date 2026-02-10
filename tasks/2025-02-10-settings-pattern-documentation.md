# Settings Pattern Consolidation

**Impact**: Clarity, not score. Prevents new code from picking the wrong pattern.
**Effort**: 2-3 hours. Documentation + minor refactoring.

## Problem

The codebase has 5 settings persistence hooks. They're intentionally different (different scopes, different auto-save semantics), but there's no clear guidance on when to use which. One form (`useImageGenForm`) uses 3 simultaneously.

## The 5 Patterns

| Hook | Scope | Auto-save | Best for |
|------|-------|-----------|----------|
| `useToolSettings` | user/project/shot | Manual | Complex, multi-scope needs |
| `useAutoSaveSettings` | user/project/shot | Yes (300ms) | **Most use cases** (recommended) |
| `usePersistentToolState` | project (default) | Yes (100ms) | Binding existing useState to persistence |
| `useUserUIState` | user-only | Yes (200ms) | UI preferences (theme, pane locks) |
| `useServerForm` | Custom | Optional | Generic form editing (not settings-specific) |

## What's NOT a Problem

- **`useImageGenForm` using 3 patterns**: This is correct — it has project-scoped settings (usePersistentToolState), shared project image settings (useToolSettings), and user preferences (useUserUIState). Different scopes need different hooks.
- **`useAutoSaveSettings` wrapping `useToolSettings`**: Intentional layering — auto-save is a feature on top of the base.
- **`useServerForm` being generic**: It's not a settings hook — it's a form-over-server-data pattern.

## What IS a Problem

1. **No decision tree in docs**: `settings_system.md` documents the system but doesn't have a "which hook should I use?" guide
2. **`usePersistentToolState`** could be deprecated in favor of `useAutoSaveSettings` — they overlap significantly
3. **`useUserUIState` bypasses the write queue**: Direct supabase `.update()` instead of using the global settings write queue. This could cause race conditions if other hooks write to the same `users.settings` row simultaneously.

## Actions

### 1. Add decision tree to `settings_system.md`

```
Need to persist settings?
├─ New feature? → useAutoSaveSettings (recommended)
├─ Existing useState you want to persist? → usePersistentToolState
├─ User-scoped UI preference? → useUserUIState
├─ Generic form data (not settings)? → useServerForm
└─ Need manual save control? → useToolSettings
```

### 2. Evaluate `usePersistentToolState` deprecation

It's only used in `useImageGenForm`. If that can migrate to `useAutoSaveSettings`, the pattern can be deprecated. However, the `markAsInteracted()` guard is unique — `useAutoSaveSettings` would need to support it or the migration would change behavior.

**Recommendation**: Don't deprecate yet. Document the difference clearly and leave it.

### 3. Audit `useUserUIState` write path

Check if the direct supabase write in `useUserUIState` can conflict with the settings write queue used by other hooks writing to `users.settings`. If so, migrate to use the write queue.

## Checklist

- [ ] Add decision tree to `docs/structure_detail/settings_system.md`
- [ ] Add "When to use which" section with examples
- [ ] Audit `useUserUIState` for write queue conflict
- [ ] Add JSDoc comments to each hook pointing to the decision tree
- [ ] Consider: should `usePersistentToolState` get a deprecation notice?
