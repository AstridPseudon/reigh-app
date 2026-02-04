# Realtime System

Keeps the UI in sync with backend changes using Supabase Realtime, React Query invalidation, and smart polling fallback.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                  RealtimeConnection                          │
│  - Supabase WebSocket lifecycle                             │
│  - State machine: disconnected → connecting → connected     │
│                                  ↔ reconnecting → failed    │
│  - Exponential backoff reconnection (max 5 attempts)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ raw events
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  RealtimeEventProcessor                      │
│  - Batches events within 100ms window                       │
│  - Normalizes payload shapes                                │
│  - Groups by event type                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ processed events
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useRealtimeInvalidation (hook)                  │
│  - All invalidation logic in one place                      │
│  - Decides what to invalidate based on event type           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  DataFreshnessManager                        │
│  - Tracks query freshness                                   │
│  - Controls polling intervals via useSmartPolling           │
│  - Fallback: 5s polling when realtime is down               │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `src/shared/realtime/RealtimeConnection.ts` | WebSocket lifecycle, reconnection |
| `src/shared/realtime/RealtimeEventProcessor.ts` | Event batching and normalization |
| `src/shared/realtime/DataFreshnessManager.ts` | Polling decision engine |
| `src/shared/realtime/types.ts` | Type definitions |
| `src/shared/hooks/useRealtimeInvalidation.ts` | React Query invalidation logic |
| `src/shared/providers/RealtimeProvider.tsx` | Wires components, exposes status |

## Connection States

```typescript
type ConnectionStatus =
  | 'disconnected'   // No project selected
  | 'connecting'     // Initial connection attempt
  | 'connected'      // Successfully subscribed
  | 'reconnecting'   // Failed, retrying with backoff
  | 'failed';        // Exhausted retries, polling fallback active
```

## Database Events

| Table | Events | Filter |
|-------|--------|--------|
| `tasks` | INSERT, UPDATE | `project_id=eq.${projectId}` |
| `generations` | INSERT, UPDATE | `project_id=eq.${projectId}` |
| `shot_generations` | INSERT, UPDATE | None |
| `generation_variants` | INSERT, UPDATE | None |

## Processed Events

| Event Type | Invalidates |
|------------|-------------|
| `tasks-created` | tasks, task-status-counts |
| `tasks-updated` | tasks, + generations if complete |
| `generations-inserted` | unified, generations, shot-generations |
| `generations-updated` | unified, generations (if meaningful) |
| `shot-generations-changed` | shot-specific queries |
| `variants-changed` | variant queries, shot-generations |

## Usage

```tsx
// App.tsx - wrap with provider
import { RealtimeProvider } from '@/shared/providers/RealtimeProvider';

<RealtimeProvider>
  {/* app content */}
</RealtimeProvider>

// In components - access status
import { useRealtime } from '@/shared/providers/RealtimeProvider';

const { isConnected, isFailed, reconnect } = useRealtime();
```

## Debugging

Console log prefixes:
- `[RealtimeConnection]` — connection lifecycle
- `[RealtimeEventProcessor]` — event batching
- `[RealtimeInvalidation]` — invalidation decisions
- `[DataFreshness]` — polling intervals

Runtime diagnostics:
```javascript
realtimeConnection.getState()
window.__DATA_FRESHNESS_MANAGER__.getDiagnostics()
```
