# Adding a New Tool

Follow these steps and your tool will be auto-wired into the system (routing, persistence, UI visibility).

---

## Step-by-Step Checklist

### 1. Create Tool Structure

Create your tool directory with this layout:

```
src/tools/my-new-tool/
├── pages/
│   └── MyNewToolPage.tsx      # Primary UI component
├── components/                 # Tool-specific widgets
├── hooks/                      # Custom hooks (optional)
└── settings.ts                 # Config & defaults
```

### 2. Define Tool Settings

Create `settings.ts` with your tool's configuration:

```typescript
// src/tools/my-new-tool/settings.ts
export const myNewToolSettings = {
  id: 'my-new-tool',
  scope: ['project'] as const,     // Can be: ['user'], ['project'], ['shot'], or combinations
  defaults: {
    // Your strongly-typed default values
    enableFeatureX: true,
    maxItems: 10,
    apiEndpoint: 'https://api.example.com',
  },
};

// TypeScript type for your settings
export type MyNewToolSettings = typeof myNewToolSettings.defaults;
```

### 3. Register in Tool Manifest

Add your tool to the global registry:

```typescript
// src/tools/index.ts

// 1. Export your settings
export { myNewToolSettings } from './my-new-tool/settings';

// 2. Add to manifest array
toolsManifest.push(myNewToolSettings);

// 3. Add UI metadata
toolsUIManifest.push({
  id: myNewToolSettings.id,
  name: 'My New Tool',               // Display name
  path: '/tools/my-new-tool',        // Route path
  icon: SomeIcon,                    // Lucide icon component
  description: 'Tool description',   // Optional
  category: 'generation',            // Optional categorization
});
```

### 4. Add Route

Register the route in the app router:

```typescript
// src/app/routes.tsx

// Import your page component
import { MyNewToolPage } from '@/tools/my-new-tool/pages/MyNewToolPage';

// Add to routes array
{
  path: '/tools/my-new-tool',
  element: <MyNewToolPage />
}
```

### 5. Implement Tool UI

Create your main page component using `useAutoSaveSettings` (recommended for full-featured auto-save):

```typescript
// src/tools/my-new-tool/pages/MyNewToolPage.tsx
import { useAutoSaveSettings } from '@/shared/hooks/useAutoSaveSettings';
import { useProject } from '@/shared/contexts/ProjectContext';
import { myNewToolSettings, MyNewToolSettings } from '../settings';

export function MyNewToolPage() {
  const { selectedProjectId } = useProject();

  const { settings, updateField, updateFields, status } = useAutoSaveSettings<MyNewToolSettings>({
    toolId: myNewToolSettings.id,
    projectId: selectedProjectId,
    scope: 'project',
    defaults: myNewToolSettings.defaults,
    enabled: !!selectedProjectId,
  });

  if (status !== 'ready') {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1>My New Tool</h1>
      {/* Read settings */}
      <p>Feature X: {settings.enableFeatureX ? 'enabled' : 'disabled'}</p>

      {/* Update single field */}
      <button onClick={() => updateField('enableFeatureX', !settings.enableFeatureX)}>
        Toggle Feature X
      </button>

      {/* Update multiple fields */}
      <button onClick={() => updateFields({ maxItems: 20, apiEndpoint: 'new-url' })}>
        Update Multiple
      </button>
    </div>
  );
}
```

> **See also:** [Settings System](./settings_system.md) for full API docs and alternative hooks (`usePersistentToolState` for binding existing useState, `useToolSettings` for low-level access).

### 6. (Optional) Add Backend Logic

If your tool needs server-side processing, create an Edge Function:

```bash
# Create new Edge Function
supabase functions new my-tool-process

# Implement in supabase/functions/my-tool-process/index.ts
# Deploy with: supabase functions deploy my-tool-process
```

---

## Notes

- **Settings scope** -- choose based on where settings should persist:
  - `user`: Global user preferences
  - `project`: Project-specific config
  - `shot`: Shot-level overrides
- **State management** -- use `markAsInteracted()` after programmatic changes to ensure saves trigger correctly.

---

**Related Docs:**
[Back to Structure](../../structure.md) | [Settings System](./settings_system.md) | [Design Guidelines](./design_motion_guidelines.md)