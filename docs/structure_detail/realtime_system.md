# Realtime System

This document describes the current realtime system used to keep the UI in sync with backend changes. The design favors the official Supabase Realtime patterns, immediate React Query invalidation for fast UI updates, and a smart polling fallback that adapts when realtime is degraded.

## Goals
- Simple, reliable realtime updates using standard Supabase patterns
- Immediate UI updates via React Query invalidation
- Smart polling fallback driven by data freshness when realtime is degraded
- Clear separation between transport (Supabase), coordination (provider/manager), and presentation (components)
- Easy debugging and observability

## High-Level Architecture
- SimpleRealtimeManager handles all Supabase channel operations
- SimpleRealtimeProvider bridges realtime events to React and invalidates React Query
- DataFreshnessManager tracks freshness to drive smart polling for queries

```text
Supabase ──▶ SimpleRealtimeManager ──▶ (window) Custom Events
                                │
                                ▼
                     SimpleRealtimeProvider ──▶ React Query (invalidate)
                                │
                                ▼
                      DataFreshnessManager ──▶ Smart polling (fallback)

UI Components ◀──────── React Query cache (data)
```

## Components & Files

- SimpleRealtimeManager
  - Path: `src/shared/realtime/SimpleRealtimeManager.ts`
  - Responsibilities:
    - Creates and manages a single Supabase channel per project: `task-updates:${projectId}`
    - Follows official pattern: `channel.on(...).on(...).subscribe(cb)`
    - Subscribes to:
      - Broadcast: `task-update`
      - Postgres changes: `tasks` table (INSERT/UPDATE) filtered by `project_id`
    - Emits DOM events for React consumption: `realtime:task-update`, `realtime:task-new`
    - Reports events and connection status to `DataFreshnessManager`
    - **Enhanced Features:** Auth validation via `getSession()` + `realtime.setAuth()`, exponential backoff reconnection (max 3 attempts), `realtime:auth-heal` listener from ReconnectScheduler, robust cleanup and timeout clearing

- SimpleRealtimeProvider
  - Path: `src/shared/providers/SimpleRealtimeProvider.tsx`
  - Responsibilities:
    - Manages connection lifecycle based on selected project
    - Listens to custom DOM events and performs React Query invalidation
    - Exposes connection state via `useSimpleRealtime()`
    - Invalidates the following query key families on relevant events:
      - `['tasks']`
      - `['task-status-counts']`
      - `['unified-generations']`
      - `['shots']`
      - `['unpositioned-count']`
      - `['project-video-counts']`

- DataFreshnessManager
  - Path: `src/shared/realtime/DataFreshnessManager.ts`
  - Responsibilities:
    - Tracks last event times per query key family
    - Tracks realtime connection status (connected/disconnected/error)
    - Provides polling intervals and freshness diagnostics
    - Integrated via `useSmartPolling` / `useSmartPollingConfig`

- useSimpleRealtime hook
  - Path: `src/shared/hooks/useSimpleRealtime.ts`
  - Responsibilities:
    - Access connection state in React components
    - Optional: consume last received event metadata for UI feedback

## Event Handling

### Supabase Channel Events (current coverage)
- Broadcast: `task-update`
- Postgres changes: `tasks` (INSERT, UPDATE), filtered by `project_id`
- Postgres changes: `shot_generations` (INSERT, UPDATE)
- Postgres changes: `generations` (UPDATE), filtered by `project_id`

### Custom DOM Events
- `realtime:task-update-batch` — fired when task updates are received
- `realtime:task-new-batch` — fired when new tasks are created
- `realtime:shot-generation-change-batch` — fired when shot generation links/positions change
- `realtime:generation-update-batch` — fired when generations update (e.g. upscaling, location changes)

### React Query Invalidation (primary mechanism)
On realtime events, the provider invalidates these query key families:
- `['tasks']` — paginated tasks, single task queries, etc.
- `['task-status-counts']` — counts used by task panes and badges
- `['unified-generations']` — all variants (project/shot/paginated)
- `['generations']` — project-wide generation lists
- `['generation']` — single generation details
- `['derived-generations']` — generations based on source images (lineage tracking)
- `['shots']` — shot lists and shot details influenced by task outcomes
- `['shot-generations']` — shot-specific generations (timeline)
- `['unpositioned-count']` — per-shot generation counts
- `['project-video-counts']` — aggregated video counts by project

React Query invalidation uses prefix matching, so the families above cover all concrete keys (e.g., `['tasks', 'paginated', projectId, ...]`).

## Smart Polling Fallback

When realtime is degraded or temporarily unavailable, queries that opt in to smart polling use:
- `useSmartPolling` / `useSmartPollingConfig` (path: `src/shared/hooks/useSmartPolling.ts`)
- Polling intervals are derived from `DataFreshnessManager` and typically behave as:
  - Realtime connected with recent events (<30s): ~30s polling
  - Realtime connected but events aging: ~10–15s polling
  - Realtime disconnected/error: ~5s aggressive polling

This fallback complements (but does not replace) direct invalidation. With a healthy realtime connection, UI updates are immediate due to invalidation; smart polling ensures resilience.

## Usage Examples

### Basic Setup
Already configured in `App.tsx`.

### Using Connection Status
```tsx
const { isConnected, isConnecting, error } = useSimpleRealtime();
// Returns boolean flags for connected/connecting and an optional error string.
```

### Listening to Custom Events
Subscribe to DOM events listed in Event Handling above via `window.addEventListener('realtime:task-update-batch', handler)` in a `useEffect` cleanup pattern.

## Observability & Debugging

### Console Logs (key prefixes)
- `[SimpleRealtime]` — channel join/leave, event delivery, status, auth checks, reconnection attempts
- `[SimpleRealtimeProvider]` — provider lifecycle
- `[TasksPaneRealtimeDebug]` — end-to-end invalidation + query freshness
- `[DataFreshness]` — freshness state, intervals, subscribers
- `[SmartPolling]` — polling updates per query key
- `[ReconnectScheduler]` — reconnection intent management and debouncing

### Runtime Diagnostics
- `window.__REALTIME_SNAPSHOT__` — last channel state and event time
- `window.__DATA_FRESHNESS_MANAGER__` — freshness manager instance (diagnostics available)
- `window.__RECONNECT_SCHEDULER__` — reconnection scheduler state and pending intents

### Common Checks
1. **CHANNEL_ERROR issues**: Check authentication state in logs - user must be signed in
2. **Rapid reconnection loops**: Look for reconnection attempt limits being reached (max 3 attempts)
3. **Not receiving updates**: verify channel status logs, project id, and authentication
4. **UI not updating**: ensure invalidated query key families match active queries
5. **Excess polling**: check DataFreshness diagnostics and realtime connection state

## Notes & Limitations
- The system subscribes to `tasks`, `shot_generations`, and `generations` Postgres changes, plus `task-update` broadcasts (see Event Handling above). Pure backend changes not covered by these subscriptions (e.g., background thumbnail writes) are picked up by the smart polling fallback.
- Invalidation uses broad key families to ensure all relevant variants refetch without bespoke wiring per consumer.
- Smart polling is a real fallback system, not just a safety net -- it actively adapts intervals based on connection health and data freshness.
